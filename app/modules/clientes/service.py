from fastapi import HTTPException

from app.db.connection import get_connection
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import unicodedata
from app.core.text_normalization import clean_text, normalize_text_upper
from app.modules.auditoria import service as auditoria_service
from app.modules.rentabilidad.repository import get_detalle_rentabilidad_diaria
from app.modules.rentabilidad.service import (
    resumir_detalles_por_rubro,
    validar_detalles_rentabilidad,
)
from app.modules.taller.repository import (
    validar_sucursal_activa,
    validar_usuario_activo,
    insert_orden_taller,
    insert_orden_taller_evento,
    get_orden_taller_by_id,
    get_orden_postventa_abierta_por_bicicleta,
)
from .repository import (
    get_clientes,
    get_contexto_crm_clientes,
    get_cliente_by_id,
    find_cliente_duplicado_fuerte,
    get_clientes_duplicados_resumen,
    insert_cliente,
    update_cliente,
    desactivar_cliente,
    activar_cliente,
    get_resumen_ventas_cliente,
    get_contexto_analisis_cliente,
    get_ventas_cliente,
    get_historial_cliente_enriquecido,
    get_ordenes_taller_cliente,
    get_bicicletas_cliente,
    insert_bicicleta_cliente,
    get_bicicleta_cliente_detalle,
    update_bicicleta_cliente,
    get_historial_taller_bicicleta_cliente,
    get_notas_tecnicas_bicicleta_cliente,
    get_timeline_bicicleta_cliente,
    get_venta_origen_bicicleta_cliente,
    autorizar_service_vencido_bicicleta_cliente,
)


CLIENTE_CONSUMIDOR_FINAL_ID = 1
TIPOS_CLIENTE_VALIDOS = {"consumidor_final", "minorista", "mayorista"}
PERIODOS_ANALISIS_CLIENTE = {
    "30d": 30,
    "90d": 90,
    "365d": 365,
}
UMBRAL_CLIENTE_NUEVO_DIAS = 30
UMBRAL_CLIENTE_INACTIVO_DIAS = 90
UMBRAL_CLIENTE_RECURRENTE_OPERACIONES = 2
UMBRAL_CLIENTE_FRECUENTE_TALLER = 2


def _normalizar_create_input(data):
    data.nombre_persona = normalize_text_upper(data.nombre_persona)
    data.apellido = normalize_text_upper(data.apellido)
    data.nombre = normalize_text_upper(data.nombre)
    data.nombre = _resolver_nombre_display(data)
    data.telefono = clean_text(data.telefono)
    data.dni = clean_text(data.dni)
    data.direccion = clean_text(data.direccion)
    data.notas = clean_text(data.notas)
    data.cuit = clean_text(data.cuit)
    data.razon_social = normalize_text_upper(data.razon_social)
    return data


def _normalizar_update_input(data):
    data.nombre_persona = normalize_text_upper(data.nombre_persona)
    data.apellido = normalize_text_upper(data.apellido)
    data.nombre = normalize_text_upper(data.nombre)
    data.nombre = _resolver_nombre_display(data)
    data.telefono = clean_text(data.telefono)
    data.dni = clean_text(data.dni)
    data.direccion = clean_text(data.direccion)
    data.notas = clean_text(data.notas)
    data.cuit = clean_text(data.cuit)
    data.razon_social = normalize_text_upper(data.razon_social)
    return data


def _validar_tipo_cliente(tipo_cliente: str):
    if tipo_cliente not in TIPOS_CLIENTE_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de cliente inválido: {tipo_cliente}",
        )


def _resolver_nombre_display(data):
    partes = [
        data.nombre_persona,
        data.apellido,
    ]
    nombre_desde_partes = " ".join(parte for parte in partes if parte)

    return normalize_text_upper(nombre_desde_partes or data.nombre)


def _validar_campos_cliente(data):
    if not data.nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    if not data.telefono:
        raise HTTPException(status_code=400, detail="El teléfono es obligatorio")

    _validar_tipo_cliente(data.tipo_cliente)


def _obtener_cliente_o_404(conn, cliente_id: int):
    cliente = get_cliente_by_id(conn, cliente_id)

    if cliente is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe el cliente {cliente_id}",
        )

    return cliente


def _validar_no_editar_consumidor_final(cliente_id: int):
    if cliente_id == CLIENTE_CONSUMIDOR_FINAL_ID:
        raise HTTPException(
            status_code=400,
            detail="El cliente 'Consumidor final' no se puede modificar desde este módulo",
        )


def _validar_no_desactivar_consumidor_final(cliente_id: int):
    if cliente_id == CLIENTE_CONSUMIDOR_FINAL_ID:
        raise HTTPException(
            status_code=400,
            detail="El cliente 'Consumidor final' no se puede desactivar",
        )


def _validar_no_crear_otro_consumidor_final(data):
    if data.tipo_cliente == "consumidor_final":
        raise HTTPException(
            status_code=400,
            detail="No se puede crear manualmente otro cliente de tipo consumidor_final",
        )

    if data.nombre and data.nombre.strip().lower() == "consumidor final":
        raise HTTPException(
            status_code=400,
            detail="Ese nombre está reservado para el cliente genérico del sistema",
        )


def _validar_cliente_sin_duplicado_fuerte(conn, data, cliente_id_actual: int | None = None):
    duplicado = find_cliente_duplicado_fuerte(
        conn,
        data,
        cliente_id_actual=cliente_id_actual,
    )

    if duplicado is None:
        return

    if data.cuit and _solo_digitos(data.cuit) == _solo_digitos(duplicado.get("cuit")):
        campo = "CUIT"
        valor = data.cuit
    elif data.dni and _solo_digitos(data.dni) == _solo_digitos(duplicado.get("dni")):
        campo = "DNI"
        valor = data.dni
    else:
        campo = "teléfono"
        valor = data.telefono

    raise HTTPException(
        status_code=400,
        detail=(
            f"Posible cliente duplicado: ya existe el cliente "
            f"#{duplicado['id']} ({duplicado['nombre']}) con el mismo {campo} {valor}."
        ),
    )


def _solo_digitos(value: str | None):
    if not value:
        return None
    return "".join(ch for ch in str(value) if ch.isdigit()) or None


def _normalizar_bicicleta_cliente_input(data):
    data.marca = normalize_text_upper(data.marca)
    data.modelo = normalize_text_upper(data.modelo)
    data.rodado = clean_text(data.rodado)
    data.color = normalize_text_upper(data.color)
    data.numero_cuadro = normalize_text_upper(data.numero_cuadro)
    data.notas = clean_text(data.notas)
    return data


def listar_clientes_service(q=None, solo_activos=False, orden="nombre"):
    conn = get_connection()

    try:
        return get_clientes(
            conn,
            q=q,
            solo_activos=solo_activos,
            orden=orden,
        )
    finally:
        conn.close()


def listar_clientes_crm_service(
    *,
    q=None,
    vista="todos",
    tipo_cliente=None,
    rubro=None,
    orden="reciente",
    solo_activos=True,
    limit=50,
    offset=0,
    puede_ver_rentabilidad=False,
):
    vistas_validas = {
        "todos",
        "recientes",
        "recurrentes",
        "inactivos",
        "deuda",
        "credito",
        "taller",
        "alto_valor",
        "sin_actividad",
    }
    ordenes_validos = {"reciente", "inactividad", "actividad", "valor", "nombre"}
    if vista not in vistas_validas:
        raise HTTPException(status_code=400, detail="Vista CRM invalida")
    if orden not in ordenes_validos:
        raise HTTPException(status_code=400, detail="Orden CRM invalido")

    conn = get_connection()
    try:
        hoy = datetime.now(timezone(timedelta(hours=-3))).date()
        fecha_desde = hoy - timedelta(days=364)
        contextos = get_contexto_crm_clientes(conn, fecha_desde, hoy)
        detalles = get_detalle_rentabilidad_diaria(conn, fecha_desde, fecha_hasta=hoy)

        detalles_por_cliente = defaultdict(list)
        for detalle in detalles:
            detalles_por_cliente[int(detalle["id_cliente"])].append(detalle)

        items = []
        for contexto in contextos:
            cliente_id = int(contexto["id"])
            detalle_cliente = detalles_por_cliente.get(cliente_id, [])
            resumen = _resumir_detalles_cliente(detalle_cliente)
            rubros = _rubros_cliente(detalle_cliente)
            actividad = _actividad_cliente(
                detalles=detalle_cliente,
                contexto=contexto,
                hoy=hoy,
            )
            segmentos = _segmentos_cliente(
                cliente=contexto,
                resumen=resumen,
                resumen_anterior=_resumir_detalles_cliente([]),
                actividad=actividad,
                contexto=contexto,
            )
            items.append(
                {
                    "id": cliente_id,
                    "nombre": contexto["nombre"],
                    "telefono": contexto.get("telefono"),
                    "dni": contexto.get("dni"),
                    "cuit": contexto.get("cuit"),
                    "razon_social": contexto.get("razon_social"),
                    "tipo_cliente": contexto.get("tipo_cliente"),
                    "activo": bool(contexto.get("activo")),
                    "created_at": contexto.get("created_at"),
                    "ultima_actividad_fecha": actividad["ultima_actividad_fecha"],
                    "dias_desde_ultima_actividad": actividad["dias_desde_ultima_actividad"],
                    "operaciones_365": resumen["cantidad_operaciones"],
                    "ventas_365": resumen["ventas_netas"],
                    "ganancia_365": resumen["ganancia_comercial"],
                    "margen_365": resumen["margen_porcentaje"],
                    "ordenes_taller_365": actividad["ordenes_taller_periodo"],
                    "bicicletas_registradas": actividad["bicicletas_registradas"],
                    "deuda_vigente": _monto(contexto.get("deuda_vigente")),
                    "credito_vigente": _monto(contexto.get("credito_vigente")),
                    "rubro_principal": rubros[0] if rubros else None,
                    "segmentos": segmentos,
                    "seguimiento_pendiente": (
                        {
                            "id": contexto["seguimiento_pendiente_id"],
                            "tipo": contexto["seguimiento_pendiente_tipo"],
                            "motivo": contexto["seguimiento_pendiente_motivo"],
                            "fecha_objetivo": contexto["seguimiento_pendiente_fecha"],
                            "prioridad": contexto["seguimiento_pendiente_prioridad"],
                            "id_usuario_responsable": contexto["seguimiento_responsable_id"],
                            "responsable_nombre": contexto["seguimiento_responsable_nombre"],
                        }
                        if contexto.get("seguimiento_pendiente_id")
                        else None
                    ),
                    "_bicicletas_busqueda": contexto.get("bicicletas_busqueda") or "",
                }
            )

        umbral_alto_valor = _percentil_75(
            [item["ventas_365"] for item in items if _decimal(item["ventas_365"]) > 0]
        )
        for item in items:
            if umbral_alto_valor > 0 and _decimal(item["ventas_365"]) >= umbral_alto_valor:
                item["segmentos"].append(
                    {
                        "clave": "alto_valor",
                        "nombre": "Alto valor",
                        "motivo": f"Sus ventas de 12 meses estan dentro del 25% superior, desde {_importe_ars(umbral_alto_valor)}.",
                        "tono": "success",
                    }
                )
            if not item["ultima_actividad_fecha"]:
                item["segmentos"].append(
                    {
                        "clave": "sin_actividad",
                        "nombre": "Sin actividad",
                        "motivo": "No posee ventas ni ordenes de taller registradas.",
                        "tono": "neutral",
                    }
                )
            seguimiento = item.get("seguimiento_pendiente")
            if seguimiento and seguimiento["fecha_objetivo"] < hoy:
                item["segmentos"].append(
                    {
                        "clave": "seguimiento_vencido",
                        "nombre": "Seguimiento vencido",
                        "motivo": f"Tiene una tarea pendiente desde {seguimiento['fecha_objetivo'].strftime('%d/%m/%Y')}.",
                        "tono": "danger",
                    }
                )
            item["accion_sugerida"] = _accion_sugerida_crm(item)

        base = [item for item in items if not solo_activos or item["activo"]]
        if q and q.strip():
            termino = _normalizar_busqueda(q)
            base = [item for item in base if termino in _texto_busqueda_crm(item)]

        resumen_vistas = {
            "todos": len(base),
            "recientes": sum(_cumple_vista_crm(item, "recientes") for item in base),
            "recurrentes": sum(_cumple_vista_crm(item, "recurrentes") for item in base),
            "inactivos": sum(_cumple_vista_crm(item, "inactivos") for item in base),
            "deuda": sum(_cumple_vista_crm(item, "deuda") for item in base),
            "credito": sum(_cumple_vista_crm(item, "credito") for item in base),
            "taller": sum(_cumple_vista_crm(item, "taller") for item in base),
            "alto_valor": sum(_cumple_vista_crm(item, "alto_valor") for item in base),
            "sin_actividad": sum(_cumple_vista_crm(item, "sin_actividad") for item in base),
        }

        filtrados = [item for item in base if _cumple_vista_crm(item, vista)]
        if tipo_cliente:
            filtrados = [item for item in filtrados if item["tipo_cliente"] == tipo_cliente]
        if rubro:
            filtrados = [
                item for item in filtrados
                if (item.get("rubro_principal") or {}).get("clave") == rubro
            ]

        _ordenar_clientes_crm(filtrados, orden)
        total = len(filtrados)
        pagina = filtrados[offset:offset + limit]
        for item in pagina:
            item.pop("_bicicletas_busqueda", None)
            if not puede_ver_rentabilidad:
                item["ganancia_365"] = None
                item["margen_365"] = None
                if item["rubro_principal"]:
                    item["rubro_principal"]["costo_mercaderia"] = None
                    item["rubro_principal"]["ganancia_comercial"] = None
                    item["rubro_principal"]["margen_porcentaje"] = None

        rubros_disponibles = sorted(
            {
                (item["rubro_principal"]["clave"], item["rubro_principal"]["nombre"])
                for item in base
                if item.get("rubro_principal")
            },
            key=lambda valor: valor[1],
        )
        return {
            "periodo": {"fecha_desde": fecha_desde, "fecha_hasta": hoy},
            "puede_ver_rentabilidad": puede_ver_rentabilidad,
            "total": total,
            "limit": limit,
            "offset": offset,
            "resumen_vistas": resumen_vistas,
            "umbral_alto_valor": umbral_alto_valor if puede_ver_rentabilidad else None,
            "rubros_disponibles": [
                {"clave": clave, "nombre": nombre}
                for clave, nombre in rubros_disponibles
            ],
            "items": pagina,
        }
    finally:
        conn.close()


def _percentil_75(valores):
    ordenados = sorted(_decimal(valor) for valor in valores)
    if not ordenados:
        return Decimal("0")
    indice = int((len(ordenados) - 1) * 0.75)
    return _monto(ordenados[indice])


def _claves_segmentos(item):
    return {segmento["clave"] for segmento in item.get("segmentos") or []}


def _cumple_vista_crm(item, vista):
    if vista == "todos":
        return True
    claves = _claves_segmentos(item)
    equivalencias = {
        "recientes": "nuevo",
        "recurrentes": "recurrente",
        "inactivos": "inactivo",
        "deuda": "con_deuda",
        "credito": "con_credito",
        "taller": "frecuente_taller",
        "alto_valor": "alto_valor",
        "sin_actividad": "sin_actividad",
    }
    return equivalencias[vista] in claves


def _normalizar_busqueda(valor):
    texto = unicodedata.normalize("NFD", str(valor or ""))
    return "".join(ch for ch in texto if unicodedata.category(ch) != "Mn").lower()


def _texto_busqueda_crm(item):
    return _normalizar_busqueda(
        " ".join(
            str(item.get(campo) or "")
            for campo in (
                "nombre",
                "telefono",
                "dni",
                "cuit",
                "razon_social",
                "_bicicletas_busqueda",
            )
        )
    )


def _accion_sugerida_crm(item):
    claves = _claves_segmentos(item)
    seguimiento = item.get("seguimiento_pendiente")
    if seguimiento:
        if "seguimiento_vencido" in claves:
            return {
                "clave": "seguimiento_vencido",
                "label": "Seguimiento vencido",
                "tono": "danger",
            }
        return {
            "clave": "seguimiento_pendiente",
            "label": f"{seguimiento['tipo'].capitalize()} · {seguimiento['responsable_nombre']}",
            "tono": "warning" if seguimiento["prioridad"] in {"alta", "urgente"} else "info",
        }
    if "con_deuda" in claves:
        return {"clave": "revisar_deuda", "label": "Revisar deuda", "tono": "danger"}
    if "inactivo" in claves:
        return {"clave": "retomar_contacto", "label": "Retomar contacto", "tono": "warning"}
    if "con_credito" in claves:
        return {"clave": "recordar_credito", "label": "Credito disponible", "tono": "success"}
    if "sin_actividad" in claves:
        return {"clave": "sin_actividad", "label": "Sin movimientos", "tono": "neutral"}
    return {"clave": "sin_urgencia", "label": "Sin urgencia", "tono": "neutral"}


def _ordenar_clientes_crm(items, orden):
    if orden == "nombre":
        items.sort(key=lambda item: _normalizar_busqueda(item["nombre"]))
    elif orden == "inactividad":
        items.sort(
            key=lambda item: item["dias_desde_ultima_actividad"]
            if item["dias_desde_ultima_actividad"] is not None
            else 10**9,
            reverse=True,
        )
    elif orden == "actividad":
        items.sort(key=lambda item: (item["operaciones_365"], item["ventas_365"]), reverse=True)
    elif orden == "valor":
        items.sort(key=lambda item: item["ventas_365"], reverse=True)
    else:
        items.sort(
            key=lambda item: item["ultima_actividad_fecha"] or date(1900, 1, 1),
            reverse=True,
        )


def obtener_cliente_service(cliente_id: int):
    conn = get_connection()

    try:
        cliente = _obtener_cliente_o_404(conn, cliente_id)
        resumen = get_resumen_ventas_cliente(conn, cliente_id)
        ventas = get_ventas_cliente(conn, cliente_id, limit=20)

        return {
            "cliente": cliente,
            "resumen_ventas": resumen,
            "ventas_recientes": ventas,
        }
    finally:
        conn.close()


def obtener_analisis_cliente_service(
    cliente_id: int,
    periodo: str = "365d",
    puede_ver_rentabilidad: bool = False,
):
    if periodo not in {*PERIODOS_ANALISIS_CLIENTE, "all"}:
        raise HTTPException(status_code=400, detail="Periodo de analisis invalido")

    conn = get_connection()
    try:
        cliente = _obtener_cliente_o_404(conn, cliente_id)
        hoy = datetime.now(timezone(timedelta(hours=-3))).date()
        fecha_desde, fecha_hasta, comparacion_desde, comparacion_hasta = (
            _resolver_periodo_analisis(periodo, hoy)
        )

        detalles = get_detalle_rentabilidad_diaria(
            conn,
            fecha_desde,
            fecha_hasta=fecha_hasta,
            id_cliente=cliente_id,
        )
        detalles_comparacion = []
        if comparacion_desde and comparacion_hasta:
            detalles_comparacion = get_detalle_rentabilidad_diaria(
                conn,
                comparacion_desde,
                fecha_hasta=comparacion_hasta,
                id_cliente=cliente_id,
            )

        contexto = get_contexto_analisis_cliente(
            conn,
            cliente_id,
            fecha_desde,
            fecha_hasta,
        ) or {}

        resumen = _resumir_detalles_cliente(detalles)
        resumen_anterior = _resumir_detalles_cliente(detalles_comparacion)
        rubros_oficiales = resumir_detalles_por_rubro(detalles)
        rubros = _rubros_cliente(detalles, rubros_oficiales=rubros_oficiales)
        calidad = validar_detalles_rentabilidad(
            {
                "resumen_por_rubro": rubros_oficiales,
                "venta_comercial": resumen["ventas_netas"],
                "cmv_comercial": resumen["costo_mercaderia"],
                "margen_esperado": resumen["ganancia_comercial"],
            },
            detalles,
        )
        actividad = _actividad_cliente(
            detalles=detalles,
            contexto=contexto,
            hoy=hoy,
        )
        segmentos = _segmentos_cliente(
            cliente=cliente,
            resumen=resumen,
            resumen_anterior=resumen_anterior,
            actividad=actividad,
            contexto=contexto,
        )

        salida = {
            "cliente_id": cliente_id,
            "periodo": {
                "clave": periodo,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "comparacion_desde": comparacion_desde,
                "comparacion_hasta": comparacion_hasta,
            },
            "puede_ver_rentabilidad": puede_ver_rentabilidad,
            "resumen": resumen,
            "comparacion": _comparar_resumenes(resumen, resumen_anterior)
            if comparacion_desde
            else None,
            "actividad": actividad,
            "estado_financiero": {
                "deuda_vigente": _decimal(contexto.get("deuda_vigente")),
                "credito_vigente": _decimal(contexto.get("credito_vigente")),
            },
            "rubros": rubros,
            "evolucion_mensual": _evolucion_mensual_cliente(detalles),
            "productos_principales": _productos_principales_cliente(detalles),
            "segmentos": segmentos,
            "calidad_datos": calidad,
        }
        salida["lectura"] = _lectura_analisis_cliente(salida)

        if not puede_ver_rentabilidad:
            _ocultar_rentabilidad_cliente(salida)

        return salida
    finally:
        conn.close()


def _resolver_periodo_analisis(periodo: str, hoy: date):
    if periodo == "all":
        return date(2000, 1, 1), hoy, None, None

    dias = PERIODOS_ANALISIS_CLIENTE[periodo]
    fecha_desde = hoy - timedelta(days=dias - 1)
    comparacion_hasta = fecha_desde - timedelta(days=1)
    comparacion_desde = comparacion_hasta - timedelta(days=dias - 1)
    return fecha_desde, hoy, comparacion_desde, comparacion_hasta


def _decimal(valor) -> Decimal:
    return Decimal(str(valor or 0))


def _monto(valor) -> Decimal:
    return _decimal(valor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _porcentaje(numerador, denominador):
    base = _decimal(denominador)
    if base == 0:
        return None
    return (_decimal(numerador) / base * Decimal("100")).quantize(Decimal("0.01"))


def _fecha(valor):
    if valor is None:
        return None
    return valor.date() if hasattr(valor, "date") else valor


def _resumir_detalles_cliente(detalles):
    ventas = {int(item["id_venta"]) for item in detalles}
    ventas_netas = sum((_decimal(item.get("ingreso_comercial")) for item in detalles), Decimal("0"))
    costo = sum((_decimal(item.get("costo_total")) for item in detalles), Decimal("0"))
    ganancia = ventas_netas - costo
    cantidad_operaciones = len(ventas)
    return {
        "cantidad_operaciones": cantidad_operaciones,
        "cantidad_items": len(detalles),
        "cantidad_unidades": _monto(
            sum((_decimal(item.get("cantidad_neta")) for item in detalles), Decimal("0"))
        ),
        "ventas_netas": _monto(ventas_netas),
        "costo_mercaderia": _monto(costo),
        "ganancia_comercial": _monto(ganancia),
        "margen_porcentaje": _porcentaje(ganancia, ventas_netas),
        "ticket_promedio": _monto(ventas_netas / cantidad_operaciones)
        if cantidad_operaciones
        else Decimal("0.00"),
    }


def _comparar_resumenes(actual, anterior):
    comparacion = {}
    for clave in ("cantidad_operaciones", "ventas_netas", "ticket_promedio", "ganancia_comercial"):
        valor_actual = _decimal(actual.get(clave))
        valor_anterior = _decimal(anterior.get(clave))
        comparacion[clave] = {
            "actual": valor_actual,
            "anterior": valor_anterior,
            "diferencia": valor_actual - valor_anterior,
            "variacion_porcentaje": _porcentaje(valor_actual - valor_anterior, valor_anterior),
        }
    return comparacion


def _rubros_cliente(detalles, rubros_oficiales=None):
    salida = []
    for rubro in rubros_oficiales or resumir_detalles_por_rubro(detalles):
        venta = _monto(rubro.get("venta_comercial"))
        costo = _monto(rubro.get("cmv_comercial"))
        ganancia = venta - costo
        salida.append(
            {
                "clave": rubro["clave"],
                "nombre": rubro["nombre"],
                "cantidad_operaciones": rubro["cantidad_ventas"],
                "cantidad_items": rubro["cantidad_items"],
                "cantidad_unidades": _monto(rubro["cantidad_unidades"]),
                "ventas_netas": venta,
                "costo_mercaderia": costo,
                "ganancia_comercial": ganancia,
                "margen_porcentaje": _porcentaje(ganancia, venta),
            }
        )
    salida.sort(key=lambda item: item["ventas_netas"], reverse=True)
    return salida


def _actividad_cliente(*, detalles, contexto, hoy):
    ventas = {}
    for item in detalles:
        venta_id = int(item["id_venta"])
        ventas.setdefault(venta_id, _fecha(item.get("fecha")))
    fechas = sorted(fecha for fecha in ventas.values() if fecha)
    intervalos = [
        (actual - anterior).days
        for anterior, actual in zip(fechas, fechas[1:])
    ]
    primera_venta = _fecha(contexto.get("primera_venta_fecha"))
    ultima_venta = _fecha(contexto.get("ultima_venta_fecha"))
    ultima_orden = _fecha(contexto.get("ultima_orden_taller_fecha"))
    fechas_globales = [fecha for fecha in (ultima_venta, ultima_orden) if fecha]
    ultima_actividad = max(fechas_globales) if fechas_globales else None
    return {
        "primera_venta_fecha": primera_venta,
        "dias_desde_primera_venta": max((hoy - primera_venta).days, 0)
        if primera_venta
        else None,
        "ultima_venta_fecha": ultima_venta,
        "ultima_orden_taller_fecha": ultima_orden,
        "ultima_actividad_fecha": ultima_actividad,
        "dias_desde_ultima_actividad": max((hoy - ultima_actividad).days, 0)
        if ultima_actividad
        else None,
        "promedio_dias_entre_compras": (
            Decimal(str(sum(intervalos) / len(intervalos))).quantize(Decimal("0.1"))
            if intervalos
            else None
        ),
        "ordenes_taller_periodo": int(contexto.get("ordenes_taller_periodo") or 0),
        "bicicletas_registradas": int(contexto.get("bicicletas_registradas") or 0),
    }


def _evolucion_mensual_cliente(detalles):
    grupos = defaultdict(lambda: {
        "ventas": Decimal("0"),
        "costos": Decimal("0"),
        "operaciones": set(),
    })
    for item in detalles:
        fecha_item = _fecha(item.get("fecha"))
        if not fecha_item:
            continue
        clave = fecha_item.strftime("%Y-%m")
        grupos[clave]["ventas"] += _decimal(item.get("ingreso_comercial"))
        grupos[clave]["costos"] += _decimal(item.get("costo_total"))
        grupos[clave]["operaciones"].add(int(item["id_venta"]))

    return [
        {
            "mes": mes,
            "cantidad_operaciones": len(datos["operaciones"]),
            "ventas_netas": _monto(datos["ventas"]),
            "costo_mercaderia": _monto(datos["costos"]),
            "ganancia_comercial": _monto(datos["ventas"] - datos["costos"]),
        }
        for mes, datos in sorted(grupos.items())
    ]


def _productos_principales_cliente(detalles, limite=8):
    grupos = defaultdict(lambda: {
        "cantidad": Decimal("0"),
        "ventas": Decimal("0"),
        "operaciones": set(),
    })
    for item in detalles:
        nombre = str(item.get("producto") or item.get("descripcion_snapshot") or "Item sin nombre")
        variante = str(item.get("variante") or "").strip()
        clave = (nombre, variante)
        grupos[clave]["cantidad"] += _decimal(item.get("cantidad_neta"))
        grupos[clave]["ventas"] += _decimal(item.get("ingreso_comercial"))
        grupos[clave]["operaciones"].add(int(item["id_venta"]))

    salida = [
        {
            "nombre": nombre,
            "variante": variante or None,
            "cantidad": _monto(datos["cantidad"]),
            "ventas_netas": _monto(datos["ventas"]),
            "cantidad_operaciones": len(datos["operaciones"]),
        }
        for (nombre, variante), datos in grupos.items()
    ]
    salida.sort(key=lambda item: (item["ventas_netas"], item["cantidad"]), reverse=True)
    return salida[:limite]


def _segmentos_cliente(*, cliente, resumen, resumen_anterior, actividad, contexto):
    segmentos = []

    def agregar(clave, nombre, motivo, tono="neutral"):
        segmentos.append({"clave": clave, "nombre": nombre, "motivo": motivo, "tono": tono})

    if cliente.get("tipo_cliente") == "mayorista":
        agregar("mayorista", "Mayorista", "El tipo comercial del cliente es mayorista.", "info")
    if _decimal(contexto.get("deuda_vigente")) > 0:
        agregar("con_deuda", "Con deuda", "Posee saldo de deuda vigente.", "danger")
    if _decimal(contexto.get("credito_vigente")) > 0:
        agregar("con_credito", "Con credito", "Posee credito disponible para aplicar.", "success")
    if resumen["cantidad_operaciones"] >= UMBRAL_CLIENTE_RECURRENTE_OPERACIONES:
        agregar(
            "recurrente",
            "Recurrente",
            f"Realizo {resumen['cantidad_operaciones']} operaciones en el periodo seleccionado.",
            "success",
        )
    if actividad["ordenes_taller_periodo"] >= UMBRAL_CLIENTE_FRECUENTE_TALLER:
        agregar(
            "frecuente_taller",
            "Frecuente de taller",
            f"Registra {actividad['ordenes_taller_periodo']} ordenes de taller en el periodo.",
            "info",
        )
    dias_desde_primera = actividad.get("dias_desde_primera_venta")
    if dias_desde_primera is not None and dias_desde_primera <= UMBRAL_CLIENTE_NUEVO_DIAS:
        agregar("nuevo", "Cliente nuevo", "Su primera actividad comercial fue reciente.", "info")
    dias_inactivo = actividad.get("dias_desde_ultima_actividad")
    if dias_inactivo is not None and dias_inactivo >= UMBRAL_CLIENTE_INACTIVO_DIAS:
        agregar(
            "inactivo",
            "Inactivo",
            f"Pasaron {dias_inactivo} dias desde su ultima actividad comercial.",
            "warning",
        )
    if (
        resumen_anterior["cantidad_operaciones"] >= 2
        and resumen["cantidad_operaciones"] < resumen_anterior["cantidad_operaciones"]
    ):
        agregar(
            "actividad_en_caida",
            "Actividad en baja",
            "Tuvo menos operaciones que en el periodo anterior equivalente.",
            "warning",
        )
    return segmentos


def _lectura_analisis_cliente(data):
    resumen = data["resumen"]
    actividad = data["actividad"]
    rubros = data["rubros"]
    cantidad = int(resumen["cantidad_operaciones"] or 0)
    operaciones = "operacion" if cantidad == 1 else "operaciones"
    partes = [
        f"Realizo {cantidad} {operaciones} en el periodo seleccionado por un total de {_importe_ars(resumen['ventas_netas'])}."
    ]
    if rubros:
        partes.append(f"Su principal actividad fue {rubros[0]['nombre']}.")
    if actividad.get("dias_desde_ultima_actividad") is not None:
        partes.append(
            f"La ultima actividad registrada fue hace {actividad['dias_desde_ultima_actividad']} dia(s)."
        )
    deuda = _decimal(data["estado_financiero"]["deuda_vigente"])
    credito = _decimal(data["estado_financiero"]["credito_vigente"])
    if deuda > 0:
        partes.append("Posee deuda vigente.")
    elif credito > 0:
        partes.append("Posee credito disponible.")
    else:
        partes.append("No posee deuda ni credito vigente.")
    return " ".join(partes)


def _importe_ars(valor):
    numero = _monto(valor)
    texto = f"{numero:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"$ {texto}"


def _ocultar_rentabilidad_cliente(data):
    campos_resumen = ("costo_mercaderia", "ganancia_comercial", "margen_porcentaje")
    for campo in campos_resumen:
        data["resumen"][campo] = None
    if data.get("comparacion"):
        data["comparacion"].pop("ganancia_comercial", None)
    for rubro in data["rubros"]:
        for campo in campos_resumen:
            rubro[campo] = None
    for mes in data["evolucion_mensual"]:
        mes["costo_mercaderia"] = None
        mes["ganancia_comercial"] = None
    data["calidad_datos"] = None


def obtener_historial_cliente_service(cliente_id: int):
    conn = get_connection()
    try:
        _obtener_cliente_o_404(conn, cliente_id)
        return get_historial_cliente_enriquecido(conn, cliente_id)
    finally:
        conn.close()


def obtener_taller_cliente_service(cliente_id: int):
    conn = get_connection()
    try:
        _obtener_cliente_o_404(conn, cliente_id)
        return get_ordenes_taller_cliente(conn, cliente_id)
    finally:
        conn.close()


def crear_cliente_service(data):
    conn = get_connection()

    try:
        with conn.transaction():
            data = _normalizar_create_input(data)
            _validar_campos_cliente(data)
            _validar_no_crear_otro_consumidor_final(data)
            _validar_cliente_sin_duplicado_fuerte(conn, data)

            cliente_id = insert_cliente(conn, data)

        return {
            "ok": True,
            "cliente_id": cliente_id,
        }
    finally:
        conn.close()


def actualizar_cliente_service(cliente_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)
            _validar_no_editar_consumidor_final(cliente_id)

            data = _normalizar_update_input(data)
            _validar_campos_cliente(data)

            if data.tipo_cliente == "consumidor_final":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede cambiar un cliente manual a tipo consumidor_final",
                )

            _validar_cliente_sin_duplicado_fuerte(
                conn,
                data,
                cliente_id_actual=cliente_id,
            )

            update_cliente(conn, cliente_id, data)

        return {
            "ok": True,
            "cliente_id": cliente_id,
        }
    finally:
        conn.close()


def desactivar_cliente_service(cliente_id: int):
    conn = get_connection()

    try:
        with conn.transaction():
            cliente = _obtener_cliente_o_404(conn, cliente_id)
            _validar_no_desactivar_consumidor_final(cliente_id)

            if not cliente["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"El cliente {cliente_id} ya está inactivo",
                )

            desactivar_cliente(conn, cliente_id)

        return {
            "ok": True,
            "cliente_id": cliente_id,
            "activo": False,
        }
    finally:
        conn.close()
    
def activar_cliente_service(cliente_id: int):
    conn = get_connection()

    try:
        with conn.transaction():
            cliente = _obtener_cliente_o_404(conn, cliente_id)

            if cliente_id == CLIENTE_CONSUMIDOR_FINAL_ID:
                raise HTTPException(
                    status_code=400,
                    detail="El cliente 'Consumidor final' no requiere activación",
                )

            if cliente["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"El cliente {cliente_id} ya está activo",
                )

            activar_cliente(conn, cliente_id)

        return {
            "ok": True,
            "cliente_id": cliente_id,
            "activo": True,
        }
    finally:
        conn.close()

def listar_bicicletas_cliente_service(cliente_id: int):
    conn = get_connection()
    try:
        _obtener_cliente_o_404(conn, cliente_id)
        return get_bicicletas_cliente(conn, cliente_id)
    finally:
        conn.close()


def crear_bicicleta_cliente_service(cliente_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            data = _normalizar_bicicleta_cliente_input(data)

            if not data.marca:
                raise HTTPException(status_code=400, detail="La marca es obligatoria")

            return insert_bicicleta_cliente(conn, cliente_id, data)
    finally:
        conn.close()


def obtener_duplicados_clientes_service():
    conn = get_connection()

    try:
        return get_clientes_duplicados_resumen(conn)
    finally:
        conn.close()


def actualizar_bicicleta_cliente_service(cliente_id: int, bicicleta_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            anterior = get_bicicleta_cliente_detalle(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
            )

            if anterior is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            data = _normalizar_bicicleta_cliente_input(data)

            if not data.marca:
                raise HTTPException(status_code=400, detail="La marca es obligatoria")

            actualizada = update_bicicleta_cliente(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
                data=data,
            )

            if actualizada is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            if data.id_usuario:
                auditoria_service.registrar_evento(
                    conn,
                    id_usuario=data.id_usuario,
                    id_sucursal=data.id_sucursal,
                    entidad="bicicleta_cliente",
                    entidad_id=bicicleta_id,
                    accion="bicicleta_cliente_actualizada",
                    detalle=(
                        "Bicicleta de cliente actualizada. "
                        f"cliente_id={cliente_id}, bicicleta_id={bicicleta_id}"
                    ),
                    metadata={
                        "cliente_id": cliente_id,
                        "antes": {
                            "marca": anterior.get("marca"),
                            "modelo": anterior.get("modelo"),
                            "rodado": anterior.get("rodado"),
                            "color": anterior.get("color"),
                            "numero_cuadro": anterior.get("numero_cuadro"),
                            "notas": anterior.get("notas"),
                        },
                        "despues": {
                            "marca": actualizada.get("marca"),
                            "modelo": actualizada.get("modelo"),
                            "rodado": actualizada.get("rodado"),
                            "color": actualizada.get("color"),
                            "numero_cuadro": actualizada.get("numero_cuadro"),
                            "notas": actualizada.get("notas"),
                        },
                    },
                )

            return actualizada
    finally:
        conn.close()


def obtener_historial_bicicleta_cliente_service(cliente_id: int, bicicleta_id: int):
    conn = get_connection()

    try:
        _obtener_cliente_o_404(conn, cliente_id)

        bicicleta = get_bicicleta_cliente_detalle(
            conn,
            cliente_id=cliente_id,
            bicicleta_id=bicicleta_id,
        )

        if bicicleta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
            )

        venta_origen = get_venta_origen_bicicleta_cliente(
            conn,
            bicicleta.get("id_venta_origen"),
        )

        historial_taller = get_historial_taller_bicicleta_cliente(
            conn,
            bicicleta_id=bicicleta_id,
        )
        timeline = get_timeline_bicicleta_cliente(conn, bicicleta_id)
        notas_tecnicas = get_notas_tecnicas_bicicleta_cliente(
            conn,
            bicicleta_id,
        )

        return {
            "bicicleta": bicicleta,
            "venta_origen": venta_origen,
            "historial_taller": historial_taller,
            "timeline": timeline,
            "notas_tecnicas": notas_tecnicas,
        }
    finally:
        conn.close()
    
def autorizar_service_vencido_bicicleta_cliente_service(
    cliente_id: int,
    bicicleta_id: int,
    data,
):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            bicicleta = get_bicicleta_cliente_detalle(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
            )

            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            if bicicleta.get("plan_postventa") != "service_30_dias":
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta no tiene plan de service 30 días",
                )

            if bicicleta.get("service_gratis_usado"):
                raise HTTPException(
                    status_code=400,
                    detail="El service bonificado ya fue usado",
                )

            motivo = clean_text(data.motivo)

            if not motivo:
                raise HTTPException(
                    status_code=400,
                    detail="El motivo es obligatorio",
                )

            resultado = autorizar_service_vencido_bicicleta_cliente(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
                id_usuario=data.id_usuario,
                motivo=motivo,
            )

            if resultado is None:
                raise HTTPException(
                    status_code=404,
                    detail="No se pudo autorizar el service vencido",
                )

            return {
                "ok": True,
                "cliente_id": cliente_id,
                "bicicleta_id": bicicleta_id,
                "autorizacion": resultado,
            }
    finally:
        conn.close()

def crear_orden_service_postventa_bicicleta_cliente_service(
    cliente_id: int,
    bicicleta_id: int,
    data,
):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            try:
                validar_sucursal_activa(conn, data.id_sucursal)
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            bicicleta = get_bicicleta_cliente_detalle(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
            )

            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            if bicicleta.get("plan_postventa") != "service_30_dias":
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta no tiene plan de service 30 días",
                )

            if bicicleta.get("service_gratis_usado"):
                raise HTTPException(
                    status_code=400,
                    detail="El service bonificado ya fue usado",
                )

            fecha_limite = bicicleta.get("fecha_limite_service_gratis")
            autorizado_fuera_plazo = bool(
                bicicleta.get("service_gratis_autorizado_fuera_plazo")
            )
            orden_postventa_abierta = get_orden_postventa_abierta_por_bicicleta(
                conn,
                bicicleta_id=bicicleta_id,
            )

            if orden_postventa_abierta is not None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Ya existe una orden de service postventa pendiente "
                        f"para esta bicicleta: #{orden_postventa_abierta['id']}"
                    ),
                )
            if fecha_limite and fecha_limite < date.today() and not autorizado_fuera_plazo:
                raise HTTPException(
                    status_code=400,
                    detail="El service bonificado está vencido. Primero autorizá la excepción fuera de plazo.",
                )

            orden = insert_orden_taller(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": cliente_id,
                    "id_bicicleta_cliente": bicicleta_id,
                    "estado": "ingresada",
                    "problema_reportado": "SERVICE BONIFICADO 30 DIAS",
                    "fecha_prometida": data.fecha_prometida,
                    "prioridad": data.prioridad,
                    "es_service_postventa": True,
                    "tipo_postventa": "service_30_dias",
                    "id_usuario": data.id_usuario,
                },
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden["id"],
                tipo_evento="creada",
                detalle="Orden de service postventa 30 días creada desde ficha de bicicleta",
                id_usuario=data.id_usuario,
            )

            return {
                "ok": True,
                "cliente_id": cliente_id,
                "bicicleta_id": bicicleta_id,
                "orden_id": orden["id"],
                "orden": get_orden_taller_by_id(conn, orden["id"]),
            }
    finally:
        conn.close()
