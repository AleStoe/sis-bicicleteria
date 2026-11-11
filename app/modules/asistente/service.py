from datetime import date
from decimal import Decimal
import re
import unicodedata

from app.db.connection import get_connection
from app.shared.constants import PERMISO_GESTIONAR_CRM, PERMISO_VER_RENTABILIDAD
from app.modules.clientes.service import (
    listar_clientes_service,
    obtener_analisis_cliente_service,
    obtener_cliente_service,
)
from app.modules.clientes.crm_service import (
    listar_oportunidades_crm_service,
    listar_seguimientos_crm_service,
)
from app.modules.clientes.crm_messages import borrador_apertura_conversacion

from . import repository


SUGERENCIAS_DEFAULT = [
    "Qué tengo que resolver hoy",
    "Ventas de hoy",
    "Caja actual",
    "Turnos de taller de hoy",
    "Taller pendiente",
    "Deudas abiertas",
    "Stock critico",
    "Última recepción de mercadería",
    "Analizar este cliente",
]


def _money(value) -> str:
    try:
        amount = Decimal(str(value or 0))
    except Exception:
        amount = Decimal("0")
    entero = int(amount.quantize(Decimal("1")))
    return f"$ {entero:,.0f}".replace(",", ".")


def _norm(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto or "")
    sin_tildes = "".join(ch for ch in normalizado if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", sin_tildes.lower()).strip()


def _tiene_permiso(usuario, permiso: str) -> bool:
    return usuario.auth_disabled or "*" in usuario.permisos or permiso in usuario.permisos


def _plural(cantidad, singular, plural=None) -> str:
    cantidad_int = int(cantidad or 0)
    palabra = singular if cantidad_int == 1 else (plural or f"{singular}s")
    return f"{cantidad_int} {palabra}"


def _antes_de_hoy(value, hoy) -> bool:
    if value is None:
        return False
    fecha = value.date() if hasattr(value, "date") else value
    return fecha < hoy


def _card(titulo, valor, detalle=None, tono="neutral", to=None):
    return {
        "titulo": titulo,
        "valor": valor,
        "detalle": detalle,
        "tono": tono,
        "to": to,
    }


def _item(titulo, *, subtitulo=None, detalle=None, monto=None, estado=None, to=None, metadata=None):
    return {
        "titulo": titulo,
        "subtitulo": subtitulo,
        "detalle": detalle,
        "monto": monto,
        "estado": estado,
        "to": to,
        "metadata": metadata or {},
    }


def _resumen_inicio(*, ventas, caja, turnos, taller, deudas, stock, alertas):
    partes = []

    if ventas["cantidad"]:
        partes.append(
            f"Hoy ya salieron {_plural(ventas['cantidad'], 'venta')} por {_money(ventas['total'])}"
        )
    else:
        partes.append("Hoy todavía no hay ventas cargadas")

    if caja["id"]:
        partes.append(f"la caja está abierta con {_money(caja['saldo_teorico'])}")
    else:
        partes.append("la caja está cerrada")

    pendientes = []
    if turnos:
        pendientes.append(_plural(len(turnos), "turno"))
    if int(taller["listas_retiro"] or 0):
        pendientes.append(f"{taller['listas_retiro']} bici(s) lista(s)")
    if int(deudas["vencidas"] or 0):
        pendientes.append(f"{deudas['vencidas']} deuda(s) vencida(s)")
    if stock:
        pendientes.append("stock bajo para revisar")

    if pendientes:
        return f"{', '.join(partes)}. Para mirar: {', '.join(pendientes)}."

    return f"{', '.join(partes)}. No veo urgencias fuertes en esta lectura rápida."


def obtener_resumen_asistente(*, id_sucursal: int | None, usuario):
    hoy = date.today()
    conn = get_connection()
    try:
        ventas = repository.get_ventas_hoy_resumen(conn, fecha=hoy, id_sucursal=id_sucursal)
        caja = repository.get_caja_abierta_resumen(conn, id_sucursal=id_sucursal)
        turnos = repository.get_turnos_hoy(conn, fecha=hoy, id_sucursal=id_sucursal, limit=3)
        taller = repository.get_taller_resumen(conn, id_sucursal=id_sucursal)
        deudas = repository.get_deudas_resumen(conn)
        stock = repository.get_stock_critico_items(conn, id_sucursal=id_sucursal, limit=1)
    finally:
        conn.close()

    alertas = 0
    if int(taller["atrasadas"] or 0):
        alertas += 1
    if int(deudas["vencidas"] or 0):
        alertas += 1
    if stock:
        alertas += 1
    if not caja["id"]:
        alertas += 1

    cards = [
        _card("Ventas hoy", _money(ventas["total"]), f"{ventas['cantidad']} venta(s)", "success", "/ventas"),
        _card(
            "Caja",
            _money(caja["saldo_teorico"]) if caja["id"] else "Cerrada",
            "Caja abierta" if caja["id"] else "Abrir caja antes de cobrar",
            "warning" if not caja["id"] else "neutral",
            "/caja",
        ),
        _card("Turnos hoy", len(turnos), "Agenda taller", "info", "/agenda-taller"),
        _card("Taller activo", taller["activas"], f"{taller['listas_retiro']} lista(s) para retirar", "neutral", "/taller"),
        _card("Deudas vencidas", deudas["vencidas"], _money(deudas["total_vencido"]), "danger" if deudas["vencidas"] else "neutral", "/deudas"),
        _card("Alertas", alertas, "Cosas para mirar hoy", "warning" if alertas else "success", "/salud-operativa"),
    ]

    saludo = _resumen_inicio(
        ventas=ventas,
        caja=caja,
        turnos=turnos,
        taller=taller,
        deudas=deudas,
        stock=stock,
        alertas=alertas,
    )

    return {
        "titulo": "Pulso del local",
        "resumen": saludo,
        "cards": cards,
        "sugerencias": SUGERENCIAS_DEFAULT,
        "fuentes": ["ventas", "caja", "agenda_taller", "ordenes_taller", "deudas_cliente", "stock_sucursal"],
        "solo_lectura": True,
    }


def responder_pregunta_asistente(
    *,
    pregunta: str,
    id_sucursal: int | None,
    usuario,
    cliente_id: int | None = None,
    periodo: str = "365d",
):
    texto = _norm(pregunta)
    hoy = date.today()

    if _es_consulta_cliente(texto) or (cliente_id and _es_consulta_cliente_contextual(texto)):
        return _respuesta_cliente_crm(
            pregunta=pregunta,
            texto=texto,
            cliente_id=cliente_id,
            periodo=periodo,
            usuario=usuario,
        )

    if any(palabra in texto for palabra in ["recepcion", "mercaderia", "factura proveedor", "ingreso proveedor"]):
        match = re.search(r"(?:recepcion|mercaderia)\s*#?\s*(\d+)", texto)
        return _respuesta_recepcion(
            recepcion_id=int(match.group(1)) if match else None,
            id_sucursal=id_sucursal,
        )

    if any(frase in texto for frase in ["resolver hoy", "pendiente hoy", "mirar hoy", "urgente", "que hago hoy"]):
        return _respuesta_resolver_hoy(hoy=hoy, id_sucursal=id_sucursal)

    if any(palabra in texto for palabra in ["turno", "agenda"]):
        return _respuesta_turnos_hoy(hoy=hoy, id_sucursal=id_sucursal)

    if any(palabra in texto for palabra in ["taller", "ot", "orden"]):
        return _respuesta_taller(id_sucursal=id_sucursal)

    if any(palabra in texto for palabra in ["deuda", "deben", "cobrar", "saldo pendiente"]):
        return _respuesta_deudas()

    if any(palabra in texto for palabra in ["stock", "critico", "sin stock", "reponer", "reposicion"]):
        return _respuesta_stock(id_sucursal=id_sucursal)

    if any(palabra in texto for palabra in ["caja", "plata", "efectivo", "saldo caja"]):
        return _respuesta_caja(id_sucursal=id_sucursal)

    if any(palabra in texto for palabra in ["rentabilidad", "utilidad", "distribuible", "ganancia"]):
        if not _tiene_permiso(usuario, PERMISO_VER_RENTABILIDAD):
            return {
                "intent": "rentabilidad_sin_permiso",
                "titulo": "Rentabilidad protegida",
                "resumen": "No tenés permiso para ver rentabilidad desde el asistente.",
                "cards": [],
                "items": [],
                "sugerencias": ["Caja actual", "Ventas de hoy", "Taller pendiente"],
                "fuentes": ["permisos"],
                "solo_lectura": True,
            }
        return _respuesta_rentabilidad_basica(hoy=hoy, id_sucursal=id_sucursal)

    return _respuesta_ventas_hoy(hoy=hoy, id_sucursal=id_sucursal)


def _es_consulta_cliente(texto: str) -> bool:
    return "cliente" in texto and any(
        palabra in texto
        for palabra in (
            "analiza", "analisis", "actividad", "compra", "saldo", "segmento",
            "inactivo", "recurrente", "mensaje", "contactar", "seguimiento", "tarea",
            "como esta", "relacion",
        )
    )


def _es_consulta_cliente_contextual(texto: str) -> bool:
    return any(
        frase in texto
        for frase in (
            "este cliente", "analiza", "analisis", "sus compra", "su actividad",
            "su saldo", "segmento", "pertenece", "preparar mensaje", "contactar",
            "seguimiento", "tarea para", "como esta",
        )
    )


def _resolver_cliente_consulta(*, pregunta: str, cliente_id: int | None):
    if cliente_id:
        return cliente_id, []

    match = re.search(r"cliente\s*#?\s*(\d+)", _norm(pregunta))
    if match:
        return int(match.group(1)), []

    texto = re.sub(
        r"\b(analiza|analisis|analizar|cliente|como|esta|actividad|compras?|saldos?|segmentos?|"
        r"inactivo|recurrente|mensaje|whatsapp|contactar|seguimiento|tarea|relacion|de|del|la|el|para|por|que)\b",
        " ",
        _norm(pregunta),
    )
    termino = re.sub(r"\s+", " ", texto).strip()
    if len(termino) < 3:
        return None, []
    candidatos = listar_clientes_service(q=termino, solo_activos=False)[:6]
    return (candidatos[0]["id"], candidatos) if len(candidatos) == 1 else (None, candidatos)


def _respuesta_cliente_crm(*, pregunta, texto, cliente_id, periodo, usuario):
    cliente_resuelto, candidatos = _resolver_cliente_consulta(
        pregunta=pregunta,
        cliente_id=cliente_id,
    )
    if cliente_resuelto is None:
        if candidatos:
            return {
                "intent": "cliente_ambiguo",
                "titulo": "Elegí el cliente",
                "resumen": "Encontré más de una coincidencia. Abrí la ficha correcta y volvé a preguntarme desde ahí.",
                "items": [
                    _item(
                        candidato["nombre"],
                        subtitulo=candidato.get("telefono") or "Sin teléfono",
                        to=f"/clientes/{candidato['id']}",
                    )
                    for candidato in candidatos
                ],
                "cards": [],
                "sugerencias": ["Analizar este cliente"],
                "fuentes": ["clientes"],
                "solo_lectura": True,
            }
        return {
            "intent": "cliente_requerido",
            "titulo": "Necesito identificar al cliente",
            "resumen": "Abrí su ficha y preguntame desde ahí, o escribí por ejemplo: analizar cliente #25.",
            "cards": [],
            "items": [],
            "sugerencias": ["Analizar este cliente", "Qué tengo que resolver hoy"],
            "fuentes": ["clientes"],
            "solo_lectura": True,
        }

    puede_ver_rentabilidad = _tiene_permiso(usuario, PERMISO_VER_RENTABILIDAD)
    contexto_cliente = obtener_cliente_service(cliente_resuelto)
    cliente = contexto_cliente["cliente"]
    analisis = obtener_analisis_cliente_service(
        cliente_resuelto,
        periodo=periodo,
        puede_ver_rentabilidad=puede_ver_rentabilidad,
    )
    seguimientos = listar_seguimientos_crm_service(
        bandeja="pendientes",
        id_cliente=cliente_resuelto,
        limit=3,
    )
    oportunidades = listar_oportunidades_crm_service(
        id_cliente=cliente_resuelto,
        limit=3,
    )

    resumen = analisis["resumen"]
    estado = analisis["estado_financiero"]
    cards = [
        _card("Ventas netas", _money(resumen["ventas_netas"]), f"{resumen['cantidad_operaciones']} operación(es)", "success", f"/clientes/{cliente_resuelto}"),
        _card("Deuda vigente", _money(estado["deuda_vigente"]), "Saldo actual", "danger" if estado["deuda_vigente"] else "neutral", f"/clientes/{cliente_resuelto}"),
        _card("Crédito disponible", _money(estado["credito_vigente"]), "Saldo a favor", "info" if estado["credito_vigente"] else "neutral", f"/clientes/{cliente_resuelto}"),
    ]
    if puede_ver_rentabilidad:
        cards.append(
            _card("Ganancia comercial", _money(resumen["ganancia_comercial"]), f"Margen {resumen['margen_porcentaje']}%", "success", f"/clientes/{cliente_resuelto}")
        )

    items = [
        _item(
            rubro["nombre"],
            subtitulo=f"{rubro['cantidad_operaciones']} operación(es) · {rubro['cantidad_unidades']} unidad(es)",
            detalle=f"Ventas netas {_money(rubro['ventas_netas'])}",
            monto=rubro["ventas_netas"],
            estado="rubro",
            to=f"/clientes/{cliente_resuelto}",
        )
        for rubro in analisis["rubros"][:3]
    ]
    items.extend([
        _item(
            segmento["nombre"],
            subtitulo="Segmento explicado",
            detalle=segmento["motivo"],
            estado=segmento["clave"],
            to=f"/clientes/{cliente_resuelto}",
        )
        for segmento in analisis["segmentos"]
    ])
    items.extend(
        _item(
            f"Seguimiento: {item['motivo']}",
            subtitulo=f"Responsable {item['responsable_nombre']}",
            detalle=f"Fecha objetivo {item['fecha_objetivo']}",
            estado=item["prioridad"],
            to=f"/clientes/{cliente_resuelto}",
        )
        for item in seguimientos["items"][:2]
    )

    quiere_mensaje = any(palabra in texto for palabra in ("mensaje", "whatsapp", "contactar"))
    quiere_tarea = any(palabra in texto for palabra in ("seguimiento", "tarea", "recordatorio"))
    borrador = _borrador_cliente(cliente, analisis, oportunidades) if quiere_mensaje else None
    puede_gestionar = _tiene_permiso(usuario, PERMISO_GESTIONAR_CRM)
    acciones = []
    if quiere_tarea or oportunidades["total"]:
        if puede_gestionar:
            acciones.append({"label": "Revisar y crear seguimiento", "to": f"/clientes/{cliente_resuelto}?tab=seguimientos"})

    lectura = analisis["lectura"]
    if seguimientos["total"]:
        lectura += f" Tiene {seguimientos['total']} seguimiento(s) pendiente(s)."
    elif oportunidades["total"]:
        lectura += f" Hay {oportunidades['total']} oportunidad(es) verificable(s) para revisar."

    fecha_desde = analisis["periodo"]["fecha_desde"]
    fecha_hasta = analisis["periodo"]["fecha_hasta"]
    ventas_referencia = [
        venta for venta in contexto_cliente["ventas_recientes"]
        if venta["estado"] not in ("anulada", "devuelta")
        and fecha_desde <= (venta["fecha"].date() if hasattr(venta["fecha"], "date") else venta["fecha"]) <= fecha_hasta
    ][:3]
    referencias = [
        {"label": f"Ficha del cliente #{cliente_resuelto}", "to": f"/clientes/{cliente_resuelto}"},
        {"label": f"Análisis oficial · {periodo}", "to": f"/clientes/{cliente_resuelto}?tab=analisis"},
    ]
    referencias.extend(
        {
            "label": f"Venta #{venta['id']} · {_money(venta['total'])}",
            "to": f"/ventas/{venta['id']}",
        }
        for venta in ventas_referencia
    )

    return {
        "intent": "cliente_crm",
        "titulo": f"Análisis de {cliente['nombre']}",
        "resumen": lectura,
        "cards": cards,
        "items": items[:8],
        "sugerencias": [
            "Por qué pertenece a esos segmentos",
            "Preparar un seguimiento para este cliente",
            "Preparar mensaje para este cliente",
        ],
        "fuentes": ["analisis_cliente", "seguimientos_crm", "oportunidades_crm"],
        "referencias": referencias,
        "acciones": acciones,
        "borrador_mensaje": borrador,
        "requiere_confirmacion": bool(acciones or borrador),
        "solo_lectura": True,
    }


def _borrador_cliente(cliente, analisis, oportunidades):
    tiene_bicicleta = int(analisis["actividad"].get("bicicletas_registradas") or 0) > 0
    return borrador_apertura_conversacion(
        nombre=cliente.get("nombre_persona") or cliente.get("nombre"),
        tiene_bicicleta=tiene_bicicleta,
        retomar_contacto=(
            analisis["actividad"].get("dias_desde_ultima_actividad") is not None
            and analisis["actividad"]["dias_desde_ultima_actividad"] >= 90
        ),
    )


def _respuesta_recepcion(*, recepcion_id, id_sucursal):
    conn = get_connection()
    try:
        recepcion = repository.get_recepcion_explicada(
            conn,
            recepcion_id=recepcion_id,
            id_sucursal=id_sucursal,
        )
    finally:
        conn.close()

    if recepcion is None:
        buscada = f" #{recepcion_id}" if recepcion_id else ""
        return {
            "intent": "recepcion_mercaderia",
            "titulo": "Recepción no encontrada",
            "resumen": f"No encontré una recepción{buscada} en la sucursal seleccionada.",
            "cards": [],
            "items": [],
            "sugerencias": ["Última recepción de mercadería", "Stock crítico"],
            "fuentes": ["recepciones_mercaderia"],
            "solo_lectura": True,
        }

    total = recepcion.get("total_calculado") or recepcion.get("total_costo") or 0
    confirmador = recepcion.get("usuario_confirmador_nombre") or recepcion.get("usuario_confirmador_username")
    if recepcion["estado"] == "confirmada":
        lectura = (
            f"La recepción #{recepcion['id']} de {recepcion['proveedor_nombre_snapshot']} está confirmada "
            f"por {_money(total)}. Ingresó {recepcion['unidades']} unidad(es) en {recepcion['lineas']} línea(s)."
        )
        if confirmador:
            lectura += f" La confirmó {confirmador}."
    else:
        lectura = (
            f"La recepción #{recepcion['id']} de {recepcion['proveedor_nombre_snapshot']} está en estado "
            f"{recepcion['estado']}. Tiene {recepcion['lineas']} línea(s) por {_money(total)}."
        )

    items = [
        _item(
            item["producto_nombre"] or item["descripcion_original"] or f"Línea {item['numero_linea']}",
            subtitulo=f"{item['codigo_proveedor'] or 'Sin código'} · {item['estado_resolucion']}",
            detalle=item["alerta_costo"] or f"Costo final unitario {_money(item['costo_unitario_calculado'])}",
            estado="alerta" if item["alerta_costo"] else item["origen_resolucion"],
            metadata={"precio_revisado": item["precio_revisado"]},
        )
        for item in recepcion["items"]
    ]
    return {
        "intent": "recepcion_mercaderia",
        "titulo": f"Recepción #{recepcion['id']}",
        "resumen": lectura,
        "cards": [
            _card("Costo final", _money(total), "Total conciliado", "success" if recepcion.get("conciliado") else "warning", "/recepciones-mercaderia"),
            _card("Automáticas", recepcion["automaticas"], f"{recepcion['total_correcciones']} corrección(es)", "info", "/recepciones-mercaderia"),
            _card("Documentos", len(recepcion["documentos"]), "Archivos vinculados", "neutral", "/recepciones-mercaderia"),
            _card("Alertas", recepcion["alertas_costo"], f"{recepcion['posibles_duplicados']} posible(s) duplicado(s)", "warning" if recepcion["alertas_costo"] else "neutral", "/recepciones-mercaderia"),
            _card("Precios", recepcion["precios_revisados"], "Líneas con precio revisado", "neutral", "/recepciones-mercaderia"),
        ],
        "items": items,
        "sugerencias": ["Última recepción de mercadería", "Stock crítico", "Ventas de hoy"],
        "fuentes": ["recepciones_mercaderia", "recepcion_documentos", "auditoria_eventos"],
        "solo_lectura": True,
    }


def _respuesta_ventas_hoy(*, hoy, id_sucursal):
    conn = get_connection()
    try:
        resumen = repository.get_ventas_hoy_resumen(conn, fecha=hoy, id_sucursal=id_sucursal)
        ventas = repository.get_ventas_hoy_items(conn, fecha=hoy, id_sucursal=id_sucursal, limit=8)
    finally:
        conn.close()

    items = [
        _item(
            f"Venta #{venta['id']}",
            subtitulo=venta["cliente_nombre"],
            detalle=f"{venta['estado']} · saldo {_money(venta['saldo_pendiente'])}",
            monto=venta["total_final"],
            estado=venta["estado"],
            to=f"/ventas/{venta['id']}",
        )
        for venta in ventas
    ]
    cantidad = int(resumen["cantidad"] or 0)
    saldo = Decimal(str(resumen["saldo_pendiente"] or 0))
    if not cantidad:
        lectura = "Hoy todavía no hay ventas cargadas. Si recién abriste el local, estamos en cero prolijo."
    elif saldo > 0:
        lectura = (
            f"Hoy salieron {_plural(cantidad, 'venta')} por {_money(resumen['total'])}. "
            f"Ojo: quedan {_money(saldo)} pendientes de cobrar."
        )
    else:
        lectura = f"Hoy salieron {_plural(cantidad, 'venta')} por {_money(resumen['total'])}, sin saldo pendiente."

    return {
        "intent": "ventas_hoy",
        "titulo": "Ventas de hoy",
        "resumen": lectura,
        "cards": [
            _card("Total vendido", _money(resumen["total"]), "Ventas registradas hoy", "success", "/ventas"),
            _card("Saldo pendiente", _money(resumen["saldo_pendiente"]), "Pendiente de cobro", "warning" if resumen["saldo_pendiente"] else "neutral", "/ventas"),
        ],
        "items": items,
        "sugerencias": ["Caja actual", "Deudas abiertas", "Taller pendiente"],
        "fuentes": ["ventas", "clientes"],
        "solo_lectura": True,
    }


def _respuesta_caja(*, id_sucursal):
    conn = get_connection()
    try:
        caja = repository.get_caja_abierta_resumen(conn, id_sucursal=id_sucursal)
    finally:
        conn.close()

    if not caja["id"]:
        resumen = "La caja está cerrada. Si van a cobrar o mover plata, lo primero es abrirla."
    else:
        resumen = (
            f"Caja #{caja['id']} abierta: saldo teórico {_money(caja['saldo_teorico'])}. "
            f"Entraron {_money(caja['ingresos'])} y salieron {_money(caja['egresos'])}."
        )

    return {
        "intent": "caja_actual",
        "titulo": "Caja actual",
        "resumen": resumen,
        "cards": [
            _card("Saldo teorico", _money(caja["saldo_teorico"]) if caja["id"] else "Sin caja", None, "neutral", "/caja"),
            _card("Ingresos", _money(caja["ingresos"]), "Movimientos de ingreso", "success", "/caja"),
            _card("Egresos", _money(caja["egresos"]), "Movimientos de egreso", "warning", "/caja"),
        ],
        "items": [],
        "sugerencias": ["Ventas de hoy", "Deudas abiertas", "Stock critico"],
        "fuentes": ["cajas", "caja_movimientos"],
        "solo_lectura": True,
    }


def _respuesta_turnos_hoy(*, hoy, id_sucursal):
    conn = get_connection()
    try:
        turnos = repository.get_turnos_hoy(conn, fecha=hoy, id_sucursal=id_sucursal, limit=10)
    finally:
        conn.close()

    items = [
        _item(
            turno["cliente_nombre"] or f"Turno #{turno['id']}",
            subtitulo=turno["tipo_servicio"] or turno["tipo_turno"],
            detalle=f"{turno['hora_inicio'] or turno['franja'] or 'Sin hora'} · {turno['estado']}",
            estado=turno["estado"],
            to="/agenda-taller",
            metadata={"turno_id": turno["id"]},
        )
        for turno in turnos
    ]
    if turnos:
        resumen = f"Hoy hay {_plural(len(turnos), 'turno')} en agenda. Te dejo los próximos para no andar buscando."
    else:
        resumen = "Hoy no veo turnos activos en agenda. Buen momento para adelantar taller o stock."

    return {
        "intent": "turnos_hoy",
        "titulo": "Turnos de taller de hoy",
        "resumen": resumen,
        "cards": [_card("Turnos", len(turnos), "Pendientes, confirmados o en taller", "info", "/agenda-taller")],
        "items": items,
        "sugerencias": ["Taller pendiente", "Ventas de hoy", "Bicis listas para retirar"],
        "fuentes": ["agenda_taller"],
        "solo_lectura": True,
    }


def _respuesta_taller(*, id_sucursal):
    conn = get_connection()
    try:
        resumen = repository.get_taller_resumen(conn, id_sucursal=id_sucursal)
        ordenes = repository.get_taller_items(conn, id_sucursal=id_sucursal, limit=8)
    finally:
        conn.close()

    items = [
        _item(
            f"OT #{orden['id']} · {orden['cliente_nombre']}",
            subtitulo=orden["problema_reportado"],
            detalle=f"Estado {orden['estado']}",
            estado=orden["estado"],
            to=f"/taller/{orden['id']}",
        )
        for orden in ordenes
    ]
    if resumen["atrasadas"]:
        lectura = (
            f"Taller pide atención: hay {resumen['atrasadas']} OT atrasada(s). "
            f"Además, {resumen['listas_retiro']} bici(s) están listas para retirar."
        )
    elif resumen["listas_retiro"]:
        lectura = f"Taller viene bien, pero hay {resumen['listas_retiro']} bici(s) listas para avisar o entregar."
    else:
        lectura = f"Hay {resumen['activas']} OT activa(s). No veo atrasos fuertes en esta lectura."

    return {
        "intent": "taller_pendiente",
        "titulo": "Taller pendiente",
        "resumen": lectura,
        "cards": [
            _card("Activas", resumen["activas"], "Sin retirar ni cancelar", "neutral", "/taller"),
            _card("Listas retiro", resumen["listas_retiro"], "Para avisar o entregar", "success", "/taller"),
            _card("Atrasadas", resumen["atrasadas"], "Fecha prometida vencida", "danger" if resumen["atrasadas"] else "neutral", "/taller"),
        ],
        "items": items,
        "sugerencias": ["Turnos de hoy", "Bicis listas para retirar", "Caja actual"],
        "fuentes": ["ordenes_taller", "clientes"],
        "solo_lectura": True,
    }


def _respuesta_deudas():
    conn = get_connection()
    try:
        resumen = repository.get_deudas_resumen(conn)
        deudas = repository.get_deudas_items(conn, limit=8)
    finally:
        conn.close()

    items = [
        _item(
            deuda["cliente_nombre"],
            subtitulo=f"Deuda #{deuda['id']}",
            detalle=f"Vence {deuda['proximo_vencimiento'] or 'sin fecha'}",
            monto=deuda["saldo_actual"],
            to=f"/deudas/{deuda['id']}",
        )
        for deuda in deudas
    ]
    if resumen["vencidas"]:
        lectura = (
            f"Hay {_plural(resumen['vencidas'], 'deuda vencida')} por {_money(resumen['total_vencido'])}. "
            "Arrancaría por esas antes que por las deudas sin fecha."
        )
    elif resumen["abiertas"]:
        lectura = f"Hay {_plural(resumen['abiertas'], 'deuda abierta')} por {_money(resumen['total_abierto'])}, sin vencidas fuertes."
    else:
        lectura = "No veo deudas abiertas con saldo. Esa parte está tranquila."

    return {
        "intent": "deudas",
        "titulo": "Deudas abiertas",
        "resumen": lectura,
        "cards": [
            _card("Abiertas", resumen["abiertas"], _money(resumen["total_abierto"]), "warning", "/deudas"),
            _card("Vencidas", resumen["vencidas"], _money(resumen["total_vencido"]), "danger" if resumen["vencidas"] else "neutral", "/deudas"),
        ],
        "items": items,
        "sugerencias": ["Ventas de hoy", "Caja actual", "Clientes con deuda"],
        "fuentes": ["deudas_cliente", "clientes"],
        "solo_lectura": True,
    }


def _respuesta_stock(*, id_sucursal):
    conn = get_connection()
    try:
        stock = repository.get_stock_critico_items(conn, id_sucursal=id_sucursal, limit=10)
    finally:
        conn.close()

    items = [
        _item(
            item["producto_nombre"],
            subtitulo=item["nombre_variante"],
            detalle=f"Stock disponible: {item['stock_disponible']} · SKU {item['sku'] or '-'}",
            estado="stock_critico",
            to=f"/stock?variante={item['id_variante']}",
            metadata={"id_variante": item["id_variante"]},
        )
        for item in stock
    ]
    if stock:
        lectura = f"Te dejo {len(stock)} producto(s) con stock bajo y marcados para reponer. Esto es para revisar, no para comprar a ciegas."
    else:
        lectura = "No encontré stock crítico con el filtro actual. Si algo falta, puede estar marcado como no reponer."

    return {
        "intent": "stock_critico",
        "titulo": "Stock crítico",
        "resumen": lectura,
        "cards": [_card("A revisar", len(stock), "Marcados como reponer", "warning", "/stock")],
        "items": items,
        "sugerencias": ["Ventas de hoy", "Pedido de compra", "Salud operativa"],
        "fuentes": ["stock_sucursal", "productos", "variantes"],
        "solo_lectura": True,
    }


def _respuesta_rentabilidad_basica(*, hoy, id_sucursal):
    # V1 informativa: no recalcula rentabilidad; deriva al panel oficial.
    ventas = _respuesta_ventas_hoy(hoy=hoy, id_sucursal=id_sucursal)
    return {
        "intent": "rentabilidad_basica",
        "titulo": "Lectura economica rápida",
        "resumen": "Para utilidad liberada y resultado distribuible uso el módulo de rentabilidad como fuente oficial. Te dejo la lectura de ventas de hoy y el acceso directo.",
        "cards": [
            *ventas["cards"],
            _card("Rentabilidad", "Ver panel", "Fuente oficial del resultado distribuible", "info", "/rentabilidad"),
        ],
        "items": ventas["items"],
        "sugerencias": ["Rentabilidad diaria", "Caja actual", "Ventas de hoy"],
        "fuentes": ["ventas", "rentabilidad"],
        "solo_lectura": True,
    }


def _respuesta_resolver_hoy(*, hoy, id_sucursal):
    conn = get_connection()
    try:
        caja = repository.get_caja_abierta_resumen(conn, id_sucursal=id_sucursal)
        turnos = repository.get_turnos_hoy(conn, fecha=hoy, id_sucursal=id_sucursal, limit=5)
        taller = repository.get_taller_resumen(conn, id_sucursal=id_sucursal)
        ordenes = repository.get_taller_items(conn, id_sucursal=id_sucursal, limit=5)
        deudas = repository.get_deudas_resumen(conn)
        deudas_vencidas = repository.get_deudas_vencidas_items(conn, limit=5)
        stock = repository.get_stock_critico_items(conn, id_sucursal=id_sucursal, limit=5)
    finally:
        conn.close()

    items = []
    if not caja["id"]:
        items.append(
            _item(
                "Abrir caja",
                subtitulo="Antes de cobrar o registrar movimientos",
                detalle="La caja está cerrada para la sucursal seleccionada.",
                estado="alta",
                to="/caja",
            )
        )

    for orden in ordenes:
        if orden["estado"] == "lista_para_retirar" or _antes_de_hoy(orden["fecha_prometida"], hoy):
            items.append(
                _item(
                    f"OT #{orden['id']} · {orden['cliente_nombre']}",
                    subtitulo=orden["problema_reportado"],
                    detalle=f"Estado {orden['estado']}",
                    estado=orden["estado"],
                    to=f"/taller/{orden['id']}",
                )
            )

    for deuda in deudas_vencidas:
        items.append(
            _item(
                f"Deuda vencida · {deuda['cliente_nombre']}",
                subtitulo=f"Deuda #{deuda['id']}",
                detalle=f"Venció {deuda['proximo_vencimiento']}",
                monto=deuda["saldo_actual"],
                estado="vencida",
                to=f"/deudas/{deuda['id']}",
            )
        )

    if turnos:
        items.append(
            _item(
                f"Agenda: {_plural(len(turnos), 'turno')} hoy",
                subtitulo="Revisar horarios antes de que arranque el movimiento",
                detalle="Entrá a agenda para ver el orden del día.",
                estado="agenda",
                to="/agenda-taller",
            )
        )

    if stock:
        items.append(
            _item(
                f"Stock: {len(stock)} producto(s) críticos",
                subtitulo="Marcados como reponer",
                detalle="No es compra automática: es lista para revisar.",
                estado="stock_critico",
                to="/stock",
            )
        )

    if items:
        resumen = "Yo arrancaría por esto: caja si está cerrada, después bicis listas/atrasadas y deudas vencidas."
    else:
        resumen = "No veo nada urgente en esta lectura. Podés mirar ventas, stock o taller más tranquilo."

    return {
        "intent": "resolver_hoy",
        "titulo": "Qué resolver hoy",
        "resumen": resumen,
        "cards": [
            _card("Caja", "Abierta" if caja["id"] else "Cerrada", "Primero si van a cobrar", "warning" if not caja["id"] else "success", "/caja"),
            _card("Taller", taller["atrasadas"], f"{taller['listas_retiro']} lista(s) retiro", "danger" if taller["atrasadas"] else "neutral", "/taller"),
            _card("Deudas vencidas", deudas["vencidas"], _money(deudas["total_vencido"]), "danger" if deudas["vencidas"] else "neutral", "/deudas"),
            _card("Turnos hoy", len(turnos), "Agenda taller", "info", "/agenda-taller"),
        ],
        "items": items[:8],
        "sugerencias": ["Ventas de hoy", "Caja actual", "Taller pendiente", "Deudas abiertas"],
        "fuentes": ["cajas", "ordenes_taller", "deudas_cliente", "agenda_taller", "stock_sucursal"],
        "solo_lectura": True,
    }
