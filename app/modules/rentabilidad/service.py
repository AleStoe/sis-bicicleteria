from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
import unicodedata

from fastapi import HTTPException
from psycopg import errors

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.shared.constants import (
    AUDITORIA_ACCION_CIERRE_RENTABILIDAD_ANULADO,
    AUDITORIA_ENTIDAD_CIERRE_RENTABILIDAD,
)
from .repository import (
    anular_cierre,
    distribuir_monto,
    get_cierre_by_id,
    get_cierre_by_periodo,
    get_cierre_distribuciones,
    get_cierres,
    get_cobros_rentabilidad_periodo_por_venta,
    get_detalle_rentabilidad_diaria,
    get_gastos_periodo,
    get_bonificaciones_garantias,
    get_participante_by_id,
    get_regla_activa,
    get_regla_by_id,
    get_regla_items,
    get_reglas,
    get_recuperacion_caja_periodo,
    get_ventas_rentabilidad,
    insert_cierre,
    insert_cierre_distribucion,
    insert_regla,
    insert_regla_item,
    update_regla_estado,
)


def _normalizar_texto(valor: str) -> str:
    return " ".join(valor.strip().split())


def _periodo_bounds(periodo_mes: date):
    inicio = date(periodo_mes.year, periodo_mes.month, 1)
    ultimo_dia = monthrange(periodo_mes.year, periodo_mes.month)[1]
    fin = date(periodo_mes.year, periodo_mes.month, ultimo_dia)
    return inicio, fin


def _normalizar_clasificacion(valor) -> str:
    texto = str(valor or "")
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    return texto.lower()


def _clasificar_rubro_detalle(detalle):
    tipo_precio = _normalizar_clasificacion(detalle.get("tipo_precio"))
    tipo_item = _normalizar_clasificacion(detalle.get("tipo_item"))
    rubro = _normalizar_clasificacion(detalle.get("producto_rubro"))
    categoria = _normalizar_clasificacion(detalle.get("categoria_nombre"))
    nombre = _normalizar_clasificacion(
        f"{detalle.get('producto') or ''} {detalle.get('descripcion_snapshot') or ''}"
    )

    if tipo_item == "servicio_taller" or detalle.get("id_servicio_taller"):
        return {
            "clave": "taller",
            "nombre": "Taller / servicios",
            "detalle": "Mano de obra y servicios cargados",
        }
    if "bicicleta" in rubro or "bicicleta" in categoria or "bicicleta" in nombre:
        return {
            "clave": "bicicletas",
            "nombre": "Bicicletas",
            "detalle": "Bicicletas vendidas por mostrador, reserva o taller",
        }
    if "triciclo" in rubro or "triciclo" in categoria or "triciclo" in nombre:
        return {
            "clave": "triciclos",
            "nombre": "Triciclos",
            "detalle": "Triciclos vendidos por mostrador o pedido",
        }
    if "cuatriciclo" in rubro or "cuatriciclo" in categoria or "cuatriciclo" in nombre:
        return {
            "clave": "cuatriciclos",
            "nombre": "Cuatriciclos",
            "detalle": "Cuatriciclos vendidos por mostrador o pedido",
        }
    if "accesorio" in rubro or "accesorio" in categoria:
        return {
            "clave": "accesorios",
            "nombre": "Accesorios",
            "detalle": "Accesorios y complementos",
        }
    if "repuesto" in rubro or "repuesto" in categoria:
        return {
            "clave": "repuestos",
            "nombre": "Repuestos",
            "detalle": "Repuestos y componentes",
        }
    if "indumentaria" in rubro or "indumentaria" in categoria:
        return {"clave": "indumentaria", "nombre": "Indumentaria", "detalle": "Indumentaria y proteccion"}
    if "herramienta" in rubro or "herramienta" in categoria:
        return {"clave": "herramientas", "nombre": "Herramientas", "detalle": "Herramientas y equipamiento"}
    if "cubiertas auto" in rubro or "cubierta auto" in categoria:
        return {"clave": "cubiertas_auto", "nombre": "Cubiertas de auto", "detalle": "Cubiertas para automotor"}
    return {
        "clave": "otros",
        "nombre": "Otros",
        "detalle": "Ítems sin rubro comercial específico",
    }


def _resumen_por_rubro(detalles):
    grupos = {}
    for detalle in detalles:
        rubro = _clasificar_rubro_detalle(detalle)
        clave = rubro["clave"]
        if clave not in grupos:
            grupos[clave] = {
                **rubro,
                "cantidad_ventas": 0,
                "cantidad_items": 0,
                "cantidad_unidades": Decimal("0"),
                "venta_comercial": Decimal("0"),
                "cmv_comercial": Decimal("0"),
                "margen_esperado": Decimal("0"),
                "cobrado_comercial_reconocido": Decimal("0"),
                "capital_recuperado": Decimal("0"),
                "capital_inmovilizado": Decimal("0"),
                "utilidad_liberada": Decimal("0"),
                "utilidad_pendiente": Decimal("0"),
                "_ventas": set(),
            }

        grupo = grupos[clave]
        grupo["cantidad_items"] += 1
        grupo["_ventas"].add(detalle["id_venta"])
        grupo["cantidad_unidades"] += Decimal(str(detalle["cantidad_neta"] or 0))
        grupo["venta_comercial"] += Decimal(str(detalle["ingreso_comercial"] or 0))
        grupo["cmv_comercial"] += Decimal(str(detalle["costo_total"] or 0))
        grupo["margen_esperado"] += Decimal(str(detalle["margen_bruto"] or 0))
        grupo["cobrado_comercial_reconocido"] += Decimal(
            str(detalle["cobrado_comercial_reconocido"] or 0)
        )
        grupo["capital_recuperado"] += Decimal(str(detalle["capital_recuperado"] or 0))
        grupo["capital_inmovilizado"] += Decimal(str(detalle["capital_inmovilizado"] or 0))
        grupo["utilidad_liberada"] += Decimal(str(detalle["utilidad_liberada"] or 0))
        grupo["utilidad_pendiente"] += Decimal(str(detalle["utilidad_pendiente"] or 0))

    orden = ["taller", "bicicletas", "triciclos", "cuatriciclos", "accesorios", "repuestos", "indumentaria", "herramientas", "cubiertas_auto", "otros"]
    salida = []
    for grupo in grupos.values():
        grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
        grupo["margen_esperado"] = grupo["venta_comercial"] - grupo["cmv_comercial"]
        salida.append(grupo)
    salida.sort(
        key=lambda item: (
            orden.index(item["clave"]) if item["clave"] in orden else 99,
            item["nombre"],
        )
    )
    return salida


def resumir_detalles_por_rubro(detalles):
    """Fuente compartida para agrupar el detalle comercial oficial."""
    return _resumen_por_rubro(detalles)


def _conciliar_resumen_rubros(resumen, ventas_general, costos_general):
    ventas_rubros = sum((_decimal(item["venta_comercial"]) for item in resumen), Decimal("0"))
    costos_rubros = sum((_decimal(item["cmv_comercial"]) for item in resumen), Decimal("0"))
    ajuste_ventas = _decimal(ventas_general) - ventas_rubros
    ajuste_costos = _decimal(costos_general) - costos_rubros
    if ajuste_ventas == 0 and ajuste_costos == 0:
        return resumen
    return [
        *resumen,
        {
            "clave": "ajustes_redondeo",
            "nombre": "Ajustes y redondeo",
            "detalle": "Diferencias de asignacion expuestas para conciliar con el resumen general",
            "cantidad_ventas": 0,
            "cantidad_items": 0,
            "cantidad_unidades": Decimal("0"),
            "venta_comercial": ajuste_ventas,
            "cmv_comercial": ajuste_costos,
            "margen_esperado": ajuste_ventas - ajuste_costos,
            "cobrado_comercial_reconocido": Decimal("0"),
            "capital_recuperado": Decimal("0"),
            "capital_inmovilizado": Decimal("0"),
            "utilidad_liberada": Decimal("0"),
            "utilidad_pendiente": Decimal("0"),
        },
    ]


def _decimal(valor) -> Decimal:
    return Decimal(str(valor or 0))


def _porcentaje(numerador, denominador):
    base = _decimal(denominador)
    if base == 0:
        return None
    return (_decimal(numerador) / base * Decimal("100")).quantize(Decimal("0.01"))


def _importe_texto(valor):
    numero = _decimal(valor).quantize(Decimal("0.01"))
    texto = f"{abs(numero):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{'-' if numero < 0 else ''}$ {texto}"


def _validar_resumen(data, detalles):
    rubros = data.get("resumen_por_rubro") or []
    ventas_rubros = sum((_decimal(item["venta_comercial"]) for item in rubros), Decimal("0"))
    costos_rubros = sum((_decimal(item["cmv_comercial"]) for item in rubros), Decimal("0"))
    ganancia_rubros = sum((_decimal(item["margen_esperado"]) for item in rubros), Decimal("0"))
    ventas_general = _decimal(data.get("venta_comercial"))
    costos_general = _decimal(data.get("cmv_comercial"))
    ganancia_general = _decimal(data.get("margen_esperado"))
    diferencia_ventas = ventas_general - ventas_rubros
    diferencia_costos = costos_general - costos_rubros
    diferencia_ganancia = ganancia_general - ganancia_rubros
    servicios_costo_cero = sum(
        1 for item in detalles
        if (item.get("tipo_item") == "servicio_taller" or item.get("id_servicio_taller"))
        and _decimal(item.get("costo_total")) == 0
        and _decimal(item.get("cantidad_neta")) > 0
    )
    mercaderia_sin_costo = sum(
        1 for item in detalles
        if not (item.get("tipo_item") == "servicio_taller" or item.get("id_servicio_taller"))
        and _decimal(item.get("costo_total")) == 0
        and _decimal(item.get("cantidad_neta")) > 0
    )
    notas = []
    if servicios_costo_cero:
        notas.append(
            f"{servicios_costo_cero} servicio(s) tienen costo directo cero; su margen se muestra antes de gastos operativos."
        )
    if mercaderia_sin_costo:
        nombres_sin_costo = []
        for item in detalles:
            if (item.get("tipo_item") == "servicio_taller" or item.get("id_servicio_taller")):
                continue
            if _decimal(item.get("costo_total")) != 0 or _decimal(item.get("cantidad_neta")) <= 0:
                continue
            nombre = str(item.get("producto") or item.get("descripcion_snapshot") or "Item sin nombre")
            if nombre not in nombres_sin_costo:
                nombres_sin_costo.append(nombre)
        notas.append(
            f"Advertencia: {mercaderia_sin_costo} item(s) de mercaderia no tienen costo cargado: "
            + "; ".join(nombres_sin_costo[:5])
            + ("; ..." if len(nombres_sin_costo) > 5 else "")
        )
    if any(valor != 0 for valor in (diferencia_ventas, diferencia_costos, diferencia_ganancia)):
        notas.append("Hay diferencias de redondeo o asignacion entre el detalle por rubro y el resumen general.")
    return {
        "valida": diferencia_ventas == 0 and diferencia_costos == 0 and diferencia_ganancia == 0,
        "ventas_rubros": ventas_rubros,
        "ventas_general": ventas_general,
        "diferencia_ventas": diferencia_ventas,
        "costos_rubros": costos_rubros,
        "costos_general": costos_general,
        "diferencia_costos": diferencia_costos,
        "ganancia_rubros": ganancia_rubros,
        "ganancia_general": ganancia_general,
        "diferencia_ganancia": diferencia_ganancia,
        "servicios_costo_cero": servicios_costo_cero,
        "mercaderia_sin_costo": mercaderia_sin_costo,
        "notas": notas,
    }


def validar_detalles_rentabilidad(data, detalles):
    """Expone la conciliacion oficial sin duplicar reglas en otros modulos."""
    return _validar_resumen(data, detalles)


def _metrica_comparada(clave, nombre, actual, anterior, *, margen=False):
    actual = _decimal(actual)
    anterior = _decimal(anterior)
    return {
        "clave": clave,
        "nombre": nombre,
        "anterior": anterior,
        "actual": actual,
        "diferencia": actual - anterior,
        "variacion_porcentual": None if anterior == 0 else ((actual - anterior) / abs(anterior) * Decimal("100")).quantize(Decimal("0.01")),
        "diferencia_puntos_porcentuales": (actual - anterior) if margen else None,
    }


def _comparar_rubros(actual, anterior):
    actuales = {item["clave"]: item for item in actual.get("resumen_por_rubro") or []}
    anteriores = {item["clave"]: item for item in anterior.get("resumen_por_rubro") or []}
    salida = []
    for clave in set(actuales) | set(anteriores):
        ahora = actuales.get(clave, {})
        antes = anteriores.get(clave, {})
        ventas_actual = _decimal(ahora.get("venta_comercial"))
        ventas_anterior = _decimal(antes.get("venta_comercial"))
        ganancia_actual = _decimal(ahora.get("margen_esperado"))
        ganancia_anterior = _decimal(antes.get("margen_esperado"))
        salida.append({
            "clave": clave,
            "nombre": ahora.get("nombre") or antes.get("nombre") or clave.title(),
            "ventas_anterior": ventas_anterior,
            "ventas_actual": ventas_actual,
            "costos_anterior": _decimal(antes.get("cmv_comercial")),
            "costos_actual": _decimal(ahora.get("cmv_comercial")),
            "ganancia_anterior": ganancia_anterior,
            "ganancia_actual": ganancia_actual,
            "margen_anterior": _porcentaje(ganancia_anterior, ventas_anterior),
            "margen_actual": _porcentaje(ganancia_actual, ventas_actual),
            "variacion_ganancia": ganancia_actual - ganancia_anterior,
        })
    salida.sort(key=lambda item: abs(item["variacion_ganancia"]), reverse=True)
    return salida


def _explicar_rubros(rubros):
    positivos = [item for item in rubros if item["variacion_ganancia"] > 0]
    negativos = [item for item in rubros if item["variacion_ganancia"] < 0]
    textos = []
    if negativos:
        principal = negativos[0]
        textos.append(
            f"La ganancia comercial de {principal['nombre']} bajo {_importe_texto(abs(principal['variacion_ganancia']))}."
        )
    if positivos:
        principal = positivos[0]
        compensacion = sum((item["variacion_ganancia"] for item in positivos), Decimal("0"))
        cierre = " y compensaron parte de las caidas" if negativos else ""
        textos.append(
            f"{principal['nombre']} fue el mayor aporte positivo; los rubros que crecieron sumaron {_importe_texto(compensacion)}{cierre}."
        )
    if not textos:
        textos.append("La ganancia comercial por rubro no cambio respecto del mes anterior.")
    return textos


def _nombre_producto_detalle(detalle) -> str:
    producto = detalle.get("producto") or detalle.get("descripcion_snapshot") or "Sin producto"
    variante = str(detalle.get("variante") or "").strip()
    if variante and _normalizar_clasificacion(variante) not in {"unica"}:
        return f"{producto} - {variante}"
    return producto


def _top_clientes(detalles, limit: int = 5):
    grupos = {}
    for detalle in detalles:
        cliente = detalle.get("cliente_nombre") or "Sin cliente"
        if cliente not in grupos:
            grupos[cliente] = {
                "cliente_nombre": cliente,
                "cantidad_ventas": 0,
                "cantidad_items": 0,
                "cantidad_unidades": Decimal("0"),
                "venta_comercial": Decimal("0"),
                "cobrado_comercial_reconocido": Decimal("0"),
                "utilidad_liberada": Decimal("0"),
                "_ventas": set(),
            }

        grupo = grupos[cliente]
        grupo["cantidad_items"] += 1
        grupo["_ventas"].add(detalle["id_venta"])
        grupo["cantidad_unidades"] += Decimal(str(detalle.get("cantidad_neta") or 0))
        grupo["venta_comercial"] += Decimal(str(detalle.get("ingreso_comercial") or 0))
        grupo["cobrado_comercial_reconocido"] += Decimal(
            str(detalle.get("cobrado_comercial_reconocido") or 0)
        )
        grupo["utilidad_liberada"] += Decimal(str(detalle.get("utilidad_liberada") or 0))

    salida = []
    for grupo in grupos.values():
        grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
        salida.append(grupo)
    salida.sort(
        key=lambda item: (
            item["venta_comercial"],
            item["utilidad_liberada"],
            item["cantidad_unidades"],
        ),
        reverse=True,
    )
    return salida[:limit]


def _productos_estrella_por_rubro(detalles):
    grupos = {}
    for detalle in detalles:
        rubro = _clasificar_rubro_detalle(detalle)
        producto = _nombre_producto_detalle(detalle)
        clave_producto = (
            rubro["clave"],
            detalle.get("tipo_item"),
            detalle.get("id_variante"),
            detalle.get("id_servicio_taller"),
            producto,
        )
        if clave_producto not in grupos:
            grupos[clave_producto] = {
                "rubro_clave": rubro["clave"],
                "rubro_nombre": rubro["nombre"],
                "producto": producto,
                "cantidad_ventas": 0,
                "cantidad_unidades": Decimal("0"),
                "venta_comercial": Decimal("0"),
                "margen_esperado": Decimal("0"),
                "utilidad_liberada": Decimal("0"),
                "_ventas": set(),
            }

        grupo = grupos[clave_producto]
        grupo["_ventas"].add(detalle["id_venta"])
        grupo["cantidad_unidades"] += Decimal(str(detalle.get("cantidad_neta") or 0))
        grupo["venta_comercial"] += Decimal(str(detalle.get("ingreso_comercial") or 0))
        grupo["margen_esperado"] += Decimal(str(detalle.get("margen_bruto") or 0))
        grupo["utilidad_liberada"] += Decimal(str(detalle.get("utilidad_liberada") or 0))

    mejores_por_rubro = {}
    for grupo in grupos.values():
        grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
        clave = grupo["rubro_clave"]
        actual = mejores_por_rubro.get(clave)
        ranking = (
            grupo["utilidad_liberada"],
            grupo["venta_comercial"],
            grupo["cantidad_unidades"],
        )
        ranking_actual = (
            actual["utilidad_liberada"],
            actual["venta_comercial"],
            actual["cantidad_unidades"],
        ) if actual else None
        if actual is None or ranking > ranking_actual:
            mejores_por_rubro[clave] = grupo

    orden = ["taller", "bicicletas", "triciclos", "cuatriciclos", "accesorios", "repuestos", "mayorista", "otros"]
    salida = list(mejores_por_rubro.values())
    salida.sort(
        key=lambda item: (
            orden.index(item["rubro_clave"]) if item["rubro_clave"] in orden else 99,
            item["rubro_nombre"],
        )
    )
    return salida


def _armar_regla(regla, items):
    if regla is None:
        return None
    return {
        **regla,
        "items": items,
    }


def _obtener_regla_para_calculo(conn, regla_id: int | None = None):
    regla = get_regla_by_id(conn, regla_id) if regla_id else get_regla_activa(conn)
    if regla is None:
        return None, []
    if not regla["activa"]:
        raise HTTPException(status_code=400, detail="La regla de distribución está inactiva")

    items = get_regla_items(conn, regla["id"])
    if not items:
        raise HTTPException(status_code=400, detail="La regla de distribución no tiene participantes activos")

    total = sum((Decimal(str(i["porcentaje"])) for i in items), Decimal("0"))
    if total != Decimal("100.0000") and total != Decimal("100"):
        raise HTTPException(status_code=400, detail="La regla de distribución no suma 100%")

    return regla, items


def crear_regla_distribucion(data):
    conn = get_connection()
    try:
        with conn.transaction():
            nombres_ids = set()
            for item in data.items:
                if item.id_participante in nombres_ids:
                    raise HTTPException(status_code=400, detail="No se puede repetir participante en la regla")
                nombres_ids.add(item.id_participante)

                participante = get_participante_by_id(conn, item.id_participante)
                if participante is None:
                    raise HTTPException(status_code=400, detail=f"No existe el participante {item.id_participante}")
                if not participante["activo"]:
                    raise HTTPException(status_code=400, detail=f"El participante {participante['nombre']} está inactivo")

            try:
                regla = insert_regla(conn, _normalizar_texto(data.nombre), data.descripcion)
            except errors.UniqueViolation:
                raise HTTPException(status_code=400, detail="Ya existe una regla de distribución con ese nombre")

            for item in data.items:
                insert_regla_item(conn, regla["id"], item.id_participante, item.porcentaje)

            items = get_regla_items(conn, regla["id"])
            return _armar_regla(regla, items)
    finally:
        conn.close()


def listar_reglas(incluir_inactivas: bool = False):
    conn = get_connection()
    try:
        reglas = get_reglas(conn, incluir_inactivas=incluir_inactivas)
        salida = []
        for regla in reglas:
            salida.append(_armar_regla(regla, get_regla_items(conn, regla["id"])))
        return salida
    finally:
        conn.close()


def cambiar_estado_regla(regla_id: int, activa: bool):
    conn = get_connection()
    try:
        with conn.transaction():
            regla = update_regla_estado(conn, regla_id, activa)
            if regla is None:
                raise HTTPException(status_code=404, detail=f"No existe la regla {regla_id}")
            return {"ok": True, "regla_id": regla["id"], "activa": regla["activa"]}
    finally:
        conn.close()


def calcular_rentabilidad_mensual(periodo_mes: date, id_sucursal: int | None = None, id_regla_distribucion: int | None = None):
    fecha_desde, fecha_hasta = _periodo_bounds(periodo_mes)
    conn = get_connection()
    try:
        ventas = get_ventas_rentabilidad(conn, fecha_desde, fecha_hasta, id_sucursal=id_sucursal)
        gastos = get_gastos_periodo(conn, fecha_desde, fecha_hasta, id_sucursal=id_sucursal)
        detalles_periodo = get_detalle_rentabilidad_diaria(
            conn,
            fecha_desde,
            fecha_hasta=fecha_hasta,
            id_sucursal=id_sucursal,
        )

        cantidad_ventas = int(ventas["cantidad_ventas"] or 0)
        ventas_brutas = Decimal(str(ventas["ventas_brutas"] or 0))
        devoluciones_total = Decimal(str(ventas["devoluciones_total"] or 0))
        ventas_netas = Decimal(str(ventas["ventas_netas"] or 0))
        ventas_cobradas = Decimal(str(ventas["ventas_cobradas"] or 0))
        saldo_pendiente_por_cobrar = Decimal(
            str(ventas["saldo_pendiente_por_cobrar"] or 0)
        )
        financiacion_excluida = Decimal(
            str(ventas["financiacion_total"] or 0)
        )
        financiacion_cobrada = Decimal(
            str(ventas["financiacion_cobrada"] or 0)
        )
        costos_financieros = Decimal(
            str(ventas["costos_financieros"] or 0)
        )
        ingreso_real_neto = Decimal(
            str(ventas["ingreso_real_neto"] or 0)
        )
        credito_aplicado = Decimal(str(ventas.get("credito_aplicado") or 0))
        resultado_financiero = financiacion_cobrada - costos_financieros
        cmv_bruto = Decimal(str(ventas["cmv_bruto"] or 0))
        cmv_devoluciones = Decimal(str(ventas["cmv_devoluciones"] or 0))
        cmv_neto = Decimal(str(ventas["cmv_neto"] or 0))
        cmv_cobrado = Decimal(str(ventas["cmv_cobrado"] or 0))
        cobrado_comercial_reconocido = Decimal(
            str(ventas["cobrado_comercial_reconocido"] or 0)
        )
        conciliacion_cobranza_ajuste = ingreso_real_neto - (
            cobrado_comercial_reconocido
            - credito_aplicado
            + financiacion_cobrada
            - costos_financieros
        )
        capital_recuperado = Decimal(str(ventas["capital_recuperado"] or 0))
        capital_inmovilizado = Decimal(str(ventas["capital_inmovilizado"] or 0))
        utilidad_liberada = Decimal(str(ventas["utilidad_liberada"] or 0))
        utilidad_pendiente = Decimal(str(ventas["utilidad_pendiente"] or 0))
        margen_cobrado = Decimal(str(ventas["margen_cobrado"] or 0))
        margen_pendiente = Decimal(str(ventas["margen_pendiente"] or 0))
        gastos_operativos = Decimal(str(gastos or 0))
        margen_bruto = ventas_netas - cmv_neto
        margen_real = utilidad_liberada + resultado_financiero
        resultado_distribuible = (
            utilidad_liberada + resultado_financiero - gastos_operativos
        )

        regla, items = _obtener_regla_para_calculo(conn, id_regla_distribucion)
        distribuciones = distribuir_monto(resultado_distribuible, items) if regla else []

        resumen_por_rubro = _conciliar_resumen_rubros(
            _resumen_por_rubro(detalles_periodo),
            ventas_netas,
            cmv_neto,
        )

        return {
            "periodo_mes": fecha_desde,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "id_sucursal": id_sucursal,
            "cantidad_ventas": cantidad_ventas,
            "ventas_brutas": ventas_brutas,
            "devoluciones_total": devoluciones_total,
            "ventas_netas": ventas_netas,
            "venta_comercial": ventas_netas,
            "ventas_cobradas": ventas_cobradas,
            "cobrado_comercial_reconocido": cobrado_comercial_reconocido,
            "saldo_pendiente_por_cobrar": saldo_pendiente_por_cobrar,
            "financiacion_excluida": financiacion_excluida,
            "financiacion_cobrada": financiacion_cobrada,
            "costos_financieros": costos_financieros,
            "ingreso_real_neto": ingreso_real_neto,
            "credito_aplicado": credito_aplicado,
            "conciliacion_cobranza_ajuste": conciliacion_cobranza_ajuste,
            "cobrado_ventas_periodo": Decimal(str(ventas.get("cobrado_ventas_periodo") or 0)),
            "cobrado_ventas_anteriores": Decimal(str(ventas.get("cobrado_ventas_anteriores") or 0)),
            "capital_recuperado_ventas_periodo": Decimal(str(ventas.get("capital_recuperado_ventas_periodo") or 0)),
            "capital_recuperado_ventas_anteriores": Decimal(str(ventas.get("capital_recuperado_ventas_anteriores") or 0)),
            "utilidad_liberada_ventas_periodo": Decimal(str(ventas.get("utilidad_liberada_ventas_periodo") or 0)),
            "utilidad_liberada_ventas_anteriores": Decimal(str(ventas.get("utilidad_liberada_ventas_anteriores") or 0)),
            "resultado_financiero": resultado_financiero,
            "cmv_bruto": cmv_bruto,
            "cmv_devoluciones": cmv_devoluciones,
            "cmv_neto": cmv_neto,
            "cmv_comercial": cmv_neto,
            "cmv_cobrado": cmv_cobrado,
            "capital_recuperado": capital_recuperado,
            "capital_inmovilizado": capital_inmovilizado,
            "margen_bruto": margen_bruto,
            "margen_esperado": margen_bruto,
            "margen_cobrado": margen_cobrado,
            "margen_pendiente": margen_pendiente,
            "utilidad_liberada": utilidad_liberada,
            "utilidad_pendiente": utilidad_pendiente,
            "margen_real": margen_real,
            "gastos_operativos": gastos_operativos,
            "resultado_distribuible": resultado_distribuible,
            "regla_distribucion": _armar_regla(regla, items) if regla else None,
            "distribuciones_sugeridas": distribuciones,
            "resumen_por_rubro": resumen_por_rubro,
            "top_clientes": _top_clientes(detalles_periodo),
            "productos_estrella_por_rubro": _productos_estrella_por_rubro(detalles_periodo),
        }
    finally:
        conn.close()


def calcular_comparacion_rentabilidad(
    periodo_mes: date,
    id_sucursal: int | None = None,
    id_regla_distribucion: int | None = None,
):
    actual = calcular_rentabilidad_mensual(periodo_mes, id_sucursal, id_regla_distribucion)
    fin_anterior = date(periodo_mes.year, periodo_mes.month, 1) - timedelta(days=1)
    periodo_anterior = date(fin_anterior.year, fin_anterior.month, 1)
    anterior = calcular_rentabilidad_mensual(periodo_anterior, id_sucursal, id_regla_distribucion)

    venta_actual = _decimal(actual["venta_comercial"])
    venta_anterior = _decimal(anterior["venta_comercial"])
    ganancia_actual = _decimal(actual["margen_esperado"])
    ganancia_anterior = _decimal(anterior["margen_esperado"])
    margen_actual = _porcentaje(ganancia_actual, venta_actual) or Decimal("0")
    margen_anterior = _porcentaje(ganancia_anterior, venta_anterior) or Decimal("0")

    if venta_anterior != 0:
        efecto_ventas = ((venta_actual - venta_anterior) * margen_anterior / Decimal("100")).quantize(Decimal("0.01"))
        efecto_margen = ganancia_actual - ganancia_anterior - efecto_ventas
    else:
        efecto_ventas = ganancia_actual - ganancia_anterior
        efecto_margen = Decimal("0")

    brecha_actual = _decimal(actual["utilidad_liberada"]) - ganancia_actual
    brecha_anterior = _decimal(anterior["utilidad_liberada"]) - ganancia_anterior
    conciliacion = [
        {"clave": "resultado_anterior", "nombre": "Resultado distribuible anterior", "importe": _decimal(anterior["resultado_distribuible"])},
        {"clave": "ganancia_comercial", "nombre": "Cambio en ganancia comercial esperada", "importe": ganancia_actual - ganancia_anterior, "detalle": f"Efecto ventas {efecto_ventas}; efecto margen {efecto_margen}"},
        {"clave": "liberacion_vs_esperada", "nombre": "Cambio en utilidad liberada vs. esperada", "importe": brecha_actual - brecha_anterior},
        {"clave": "financiero", "nombre": "Cambio en resultado financiero", "importe": _decimal(actual["resultado_financiero"]) - _decimal(anterior["resultado_financiero"])},
        {"clave": "gastos", "nombre": "Cambio en gastos operativos", "importe": -(_decimal(actual["gastos_operativos"]) - _decimal(anterior["gastos_operativos"]))},
        {"clave": "resultado_actual", "nombre": "Resultado distribuible actual", "importe": _decimal(actual["resultado_distribuible"])},
    ]

    rubros = _comparar_rubros(actual, anterior)
    metricas = [
        _metrica_comparada("ventas", "Ventas comerciales netas", venta_actual, venta_anterior),
        _metrica_comparada("cmv", "Costo de mercaderia vendida", actual["cmv_comercial"], anterior["cmv_comercial"]),
        _metrica_comparada("ganancia", "Ganancia comercial esperada", ganancia_actual, ganancia_anterior),
        _metrica_comparada("margen", "Margen sobre ventas", margen_actual, margen_anterior, margen=True),
        _metrica_comparada("utilidad", "Utilidad liberada por cobros", actual["utilidad_liberada"], anterior["utilidad_liberada"]),
        _metrica_comparada("financiero", "Resultado financiero", actual["resultado_financiero"], anterior["resultado_financiero"]),
        _metrica_comparada("gastos", "Gastos operativos", actual["gastos_operativos"], anterior["gastos_operativos"]),
        _metrica_comparada("distribuible", "Resultado distribuible", actual["resultado_distribuible"], anterior["resultado_distribuible"]),
    ]

    conn = get_connection()
    try:
        detalles_actual = get_detalle_rentabilidad_diaria(conn, actual["fecha_desde"], fecha_hasta=actual["fecha_hasta"], id_sucursal=id_sucursal)
        detalles_anterior = get_detalle_rentabilidad_diaria(conn, anterior["fecha_desde"], fecha_hasta=anterior["fecha_hasta"], id_sucursal=id_sucursal)
    finally:
        conn.close()

    return {
        "periodo_actual": actual["periodo_mes"],
        "periodo_anterior": anterior["periodo_mes"],
        "actual": actual,
        "anterior": anterior,
        "metricas": metricas,
        "rubros": rubros,
        "conciliacion_resultado": conciliacion,
        "efecto_ventas": efecto_ventas,
        "efecto_margen": efecto_margen,
        "explicaciones": _explicar_rubros(rubros),
        "validacion_actual": _validar_resumen(actual, detalles_actual),
        "validacion_anterior": _validar_resumen(anterior, detalles_anterior),
    }


def calcular_bonificaciones_garantias(
    periodo_mes: date,
    id_sucursal: int | None = None,
):
    fecha_desde, fecha_hasta = _periodo_bounds(periodo_mes)
    conn = get_connection()
    try:
        items = get_bonificaciones_garantias(
            conn,
            fecha_desde,
            fecha_hasta,
            id_sucursal=id_sucursal,
        )

        def sumar(campo):
            return sum(
                (Decimal(str(item[campo] or 0)) for item in items),
                Decimal("0"),
            )

        return {
            "periodo_mes": fecha_desde,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "id_sucursal": id_sucursal,
            "cantidad_operaciones": len({item["id_venta"] for item in items}),
            "cantidad_items": len(items),
            "cantidad_productos": sum(
                1 for item in items if item["tipo_item"] == "producto"
            ),
            "cantidad_servicios": sum(
                1 for item in items if item["tipo_item"] == "servicio_taller"
            ),
            "valor_lista": sumar("valor_lista"),
            "valor_bonificado": sumar("valor_bonificado"),
            "importe_post_bonificacion": sumar("importe_post_bonificacion"),
            "costo_capital": sumar("costo_capital"),
            "ingreso_neto_asignado": sumar("ingreso_neto_asignado"),
            "resultado_economico": sumar("resultado_economico"),
            "items": items,
        }
    finally:
        conn.close()


def calcular_rentabilidad_diaria(
    fecha: date,
    id_sucursal: int | None = None,
):
    conn = get_connection()
    try:
        detalles = get_detalle_rentabilidad_diaria(
            conn,
            fecha,
            id_sucursal=id_sucursal,
        )
        caja_dia = get_recuperacion_caja_periodo(
            conn,
            fecha,
            fecha,
            id_sucursal=id_sucursal,
        )
        cobros_ventas = get_cobros_rentabilidad_periodo_por_venta(
            conn,
            fecha,
            fecha,
            id_sucursal=id_sucursal,
        )

        grupos = {}
        for detalle in detalles:
            clave_id = (
                detalle["id_variante"]
                or detalle["id_servicio_taller"]
                or detalle["descripcion_snapshot"]
            )
            clave = (detalle["tipo_item"], clave_id)
            if clave not in grupos:
                grupos[clave] = {
                    "tipo_item": detalle["tipo_item"],
                    "id_variante": detalle["id_variante"],
                    "id_servicio_taller": detalle["id_servicio_taller"],
                    "producto": detalle["producto"],
                    "variante": detalle["variante"],
                    "cantidad_vendida": Decimal("0"),
                    "cantidad_ventas": 0,
                    "valor_lista": Decimal("0"),
                    "bonificacion_total": Decimal("0"),
                    "descuento_comercial": Decimal("0"),
                    "financiacion_excluida": Decimal("0"),
                    "financiacion_cobrada": Decimal("0"),
                    "costo_financiero": Decimal("0"),
                    "ingreso_real_neto": Decimal("0"),
                    "cobrado_comercial_reconocido": Decimal("0"),
                    "devoluciones_total": Decimal("0"),
                    "venta_total": Decimal("0"),
                    "venta_cobrada": Decimal("0"),
                    "costo_total": Decimal("0"),
                    "costo_cobrado": Decimal("0"),
                    "capital_recuperado": Decimal("0"),
                    "capital_inmovilizado": Decimal("0"),
                    "utilidad_liberada": Decimal("0"),
                    "margen_bruto": Decimal("0"),
                    "margen_cobrado": Decimal("0"),
                    "margen_pendiente": Decimal("0"),
                    "utilidad_pendiente": Decimal("0"),
                    "margen_real": Decimal("0"),
                    "_ventas": set(),
                    "detalles": [],
                }

            grupo = grupos[clave]
            grupo["cantidad_vendida"] += Decimal(
                str(detalle["cantidad_neta"] or 0)
            )
            grupo["valor_lista"] += (
                Decimal(str(detalle["precio_lista"] or 0))
                * Decimal(str(detalle["cantidad_neta"] or 0))
            )
            grupo["bonificacion_total"] += Decimal(
                str(detalle["bonificacion_total"] or 0)
            )
            grupo["descuento_comercial"] += Decimal(
                str(detalle["descuento_comercial_asignado"] or 0)
            )
            grupo["financiacion_excluida"] += Decimal(
                str(detalle["financiacion_excluida"] or 0)
            )
            grupo["financiacion_cobrada"] += Decimal(
                str(detalle["financiacion_cobrada"] or 0)
            )
            grupo["costo_financiero"] += Decimal(
                str(detalle["costo_financiero"] or 0)
            )
            grupo["ingreso_real_neto"] += Decimal(
                str(detalle["ingreso_real_neto"] or 0)
            )
            grupo["cobrado_comercial_reconocido"] += Decimal(
                str(detalle["cobrado_comercial_reconocido"] or 0)
            )
            grupo["devoluciones_total"] += Decimal(
                str(detalle["devolucion_comercial"] or 0)
            )
            grupo["venta_total"] += Decimal(
                str(detalle["ingreso_comercial"] or 0)
            )
            grupo["venta_cobrada"] += Decimal(
                str(detalle["venta_cobrada"] or 0)
            )
            grupo["costo_total"] += Decimal(
                str(detalle["costo_total"] or 0)
            )
            grupo["costo_cobrado"] += Decimal(
                str(detalle["costo_cobrado"] or 0)
            )
            grupo["capital_recuperado"] += Decimal(
                str(detalle["capital_recuperado"] or 0)
            )
            grupo["capital_inmovilizado"] += Decimal(
                str(detalle["capital_inmovilizado"] or 0)
            )
            grupo["utilidad_liberada"] += Decimal(
                str(detalle["utilidad_liberada"] or 0)
            )
            grupo["margen_bruto"] += Decimal(
                str(detalle["margen_bruto"] or 0)
            )
            grupo["margen_cobrado"] += Decimal(
                str(detalle["margen_cobrado"] or 0)
            )
            grupo["margen_pendiente"] += Decimal(
                str(detalle["margen_pendiente"] or 0)
            )
            grupo["utilidad_pendiente"] += Decimal(
                str(detalle["utilidad_pendiente"] or 0)
            )
            grupo["margen_real"] += Decimal(
                str(detalle["margen_real"] or 0)
            )
            grupo["_ventas"].add(detalle["id_venta"])
            grupo["detalles"].append(detalle)

        salida_articulos = []
        for grupo in grupos.values():
            grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
            venta_total = grupo["venta_cobrada"] or grupo["venta_total"]
            grupo["margen_porcentaje"] = (
                grupo["margen_real"] / venta_total * Decimal("100")
                if venta_total > 0
                else Decimal("0")
            )
            salida_articulos.append(grupo)

        salida_articulos.sort(
            key=lambda articulo: articulo["venta_total"],
            reverse=True,
        )

        ventas_netas = sum(
            (Decimal(str(item["ingreso_comercial"] or 0)) for item in detalles),
            Decimal("0"),
        )
        financiacion_excluida = sum(
            (
                Decimal(str(item["financiacion_excluida"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        financiacion_cobrada = sum(
            (
                Decimal(str(item["financiacion_cobrada"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        costos_financieros = sum(
            (
                Decimal(str(item["costo_financiero"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        ingreso_real_neto = sum(
            (
                Decimal(str(item["ingreso_real_neto"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        devoluciones_total = sum(
            (
                Decimal(str(item["devolucion_comercial"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        cmv = sum(
            (Decimal(str(item["costo_total"] or 0)) for item in detalles),
            Decimal("0"),
        )
        ventas_cobradas_items = sum(
            (Decimal(str(item["venta_cobrada"] or 0)) for item in detalles),
            Decimal("0"),
        )
        saldo_pendiente_por_cobrar = ventas_netas - ventas_cobradas_items
        ventas_cobradas = Decimal(
            str(caja_dia["cobrado_comercial_reconocido"] or 0)
        )
        cobrado_comercial_reconocido = ventas_cobradas
        financiacion_cobrada = Decimal(str(caja_dia["financiacion_cobrada"] or 0))
        costos_financieros = Decimal(str(caja_dia["costos_financieros"] or 0))
        ingreso_real_neto = Decimal(str(caja_dia["ingreso_real_neto"] or 0))
        cmv_cobrado = Decimal(str(caja_dia["capital_recuperado"] or 0))
        capital_recuperado = cmv_cobrado
        capital_inmovilizado = Decimal(str(caja_dia["capital_inmovilizado"] or 0))
        utilidad_liberada = Decimal(str(caja_dia["utilidad_liberada"] or 0))
        margen_cobrado = sum(
            (Decimal(str(item["margen_cobrado"] or 0)) for item in detalles),
            Decimal("0"),
        )
        margen_pendiente = sum(
            (Decimal(str(item["margen_pendiente"] or 0)) for item in detalles),
            Decimal("0"),
        )
        utilidad_pendiente = sum(
            (Decimal(str(item["utilidad_pendiente"] or 0)) for item in detalles),
            Decimal("0"),
        )
        margen_bruto = ventas_netas - cmv
        resultado_financiero = financiacion_cobrada - costos_financieros
        margen_real = utilidad_liberada + resultado_financiero

        return {
            "fecha": fecha,
            "id_sucursal": id_sucursal,
            "cantidad_ventas": len(
                {detalle["id_venta"] for detalle in detalles}
            ),
            "ventas_netas": ventas_netas,
            "venta_comercial": ventas_netas,
            "ventas_cobradas": ventas_cobradas,
            "cobrado_comercial_reconocido": cobrado_comercial_reconocido,
            "saldo_pendiente_por_cobrar": saldo_pendiente_por_cobrar,
            "financiacion_excluida": financiacion_excluida,
            "financiacion_cobrada": financiacion_cobrada,
            "costos_financieros": costos_financieros,
            "ingreso_real_neto": ingreso_real_neto,
            "resultado_financiero": resultado_financiero,
            "devoluciones_total": devoluciones_total,
            "cmv": cmv,
            "cmv_comercial": cmv,
            "cmv_cobrado": cmv_cobrado,
            "capital_recuperado": capital_recuperado,
            "capital_inmovilizado": capital_inmovilizado,
            "margen_bruto": margen_bruto,
            "margen_esperado": margen_bruto,
            "margen_cobrado": margen_cobrado,
            "margen_pendiente": margen_pendiente,
            "utilidad_liberada": utilidad_liberada,
            "utilidad_pendiente": utilidad_pendiente,
            "margen_real": margen_real,
            "margen_porcentaje": (
                margen_real / ventas_cobradas * Decimal("100")
                if ventas_cobradas > 0
                else Decimal("0")
            ),
            "cobros_ventas": cobros_ventas,
            "articulos": salida_articulos,
        }
    finally:
        conn.close()


def crear_cierre_rentabilidad(data):
    fecha_desde, fecha_hasta = _periodo_bounds(data.periodo_mes)
    if fecha_hasta >= date.today():
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden cerrar meses ya terminados. Elegí el primer día del mes que querés cerrar.",
        )

    conn = get_connection()
    try:
        with conn.transaction():
            existente = get_cierre_by_periodo(conn, fecha_desde, id_sucursal=data.id_sucursal)
            if existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe un cierre de rentabilidad para ese período y sucursal",
                )

            ventas = get_ventas_rentabilidad(conn, fecha_desde, fecha_hasta, id_sucursal=data.id_sucursal)
            gastos = get_gastos_periodo(conn, fecha_desde, fecha_hasta, id_sucursal=data.id_sucursal)

            ventas_brutas = Decimal(str(ventas["ventas_brutas"] or 0))
            devoluciones_total = Decimal(str(ventas["devoluciones_total"] or 0))
            ventas_netas = Decimal(str(ventas["ventas_netas"] or 0))
            utilidad_liberada = Decimal(str(ventas["utilidad_liberada"] or 0))
            cmv_bruto = Decimal(str(ventas["cmv_bruto"] or 0))
            cmv_devoluciones = Decimal(str(ventas["cmv_devoluciones"] or 0))
            cmv_neto = Decimal(str(ventas["cmv_neto"] or 0))
            financiacion_cobrada = Decimal(
                str(ventas["financiacion_cobrada"] or 0)
            )
            costos_financieros = Decimal(
                str(ventas["costos_financieros"] or 0)
            )
            resultado_financiero = (
                financiacion_cobrada - costos_financieros
            )
            gastos_operativos = Decimal(str(gastos or 0))
            margen_bruto = ventas_netas - cmv_neto
            margen_real = utilidad_liberada + resultado_financiero
            resultado_distribuible = (
                utilidad_liberada + resultado_financiero - gastos_operativos
            )

            regla, items = _obtener_regla_para_calculo(conn, data.id_regla_distribucion)
            if regla is None:
                raise HTTPException(status_code=400, detail="No hay regla de distribución activa para cerrar el mes")

            cierre = insert_cierre(
                conn,
                {
                    "periodo_mes": fecha_desde,
                    "fecha_desde": fecha_desde,
                    "fecha_hasta": fecha_hasta,
                    "id_sucursal": data.id_sucursal,
                    "id_regla_distribucion": regla["id"],
                    "regla_nombre_snapshot": regla["nombre"],
                    "ventas_brutas": ventas_brutas,
                    "devoluciones_total": devoluciones_total,
                    "ventas_netas": ventas_netas,
                    "cmv_bruto": cmv_bruto,
                    "cmv_devoluciones": cmv_devoluciones,
                    "cmv_neto": cmv_neto,
                    "margen_bruto": margen_bruto,
                    "financiacion_cobrada": financiacion_cobrada,
                    "costos_financieros": costos_financieros,
                    "resultado_financiero": resultado_financiero,
                    "margen_real": margen_real,
                    "gastos_operativos": gastos_operativos,
                    "resultado_distribuible": resultado_distribuible,
                    "id_usuario_cierre": data.id_usuario,
                    "observaciones": data.observaciones,
                },
            )

            distribuciones = distribuir_monto(resultado_distribuible, items)
            for dist in distribuciones:
                insert_cierre_distribucion(conn, cierre["id"], dist)

            return {"ok": True, "cierre_id": cierre["id"]}
    finally:
        conn.close()


def anular_cierre_rentabilidad(cierre_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            cierre_actual = get_cierre_by_id(conn, cierre_id)
            if cierre_actual is None:
                raise HTTPException(status_code=404, detail=f"No existe el cierre {cierre_id}")

            if cierre_actual["estado"] != "cerrado":
                raise HTTPException(status_code=400, detail="El cierre ya está anulado")

            cierre = anular_cierre(conn, cierre_id, motivo=data.motivo)
            if cierre is None:
                raise HTTPException(status_code=400, detail="No se pudo anular el cierre")

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=cierre["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CIERRE_RENTABILIDAD,
                entidad_id=cierre["id"],
                accion=AUDITORIA_ACCION_CIERRE_RENTABILIDAD_ANULADO,
                detalle=f"Cierre de rentabilidad {cierre['periodo_mes']} anulado",
                metadata={
                    "periodo_mes": str(cierre["periodo_mes"]),
                    "motivo": data.motivo,
                    "resultado_distribuible": str(cierre["resultado_distribuible"]),
                },
            )

            return {**cierre, "distribuciones": get_cierre_distribuciones(conn, cierre_id)}
    finally:
        conn.close()


def listar_cierres(limit: int = 100, offset: int = 0):
    conn = get_connection()
    try:
        cierres = get_cierres(conn, limit=limit, offset=offset)
        salida = []
        for cierre in cierres:
            salida.append({**cierre, "distribuciones": get_cierre_distribuciones(conn, cierre["id"])})
        return salida
    finally:
        conn.close()


def obtener_cierre(cierre_id: int):
    conn = get_connection()
    try:
        cierre = get_cierre_by_id(conn, cierre_id)
        if cierre is None:
            raise HTTPException(status_code=404, detail=f"No existe el cierre {cierre_id}")
        return {**cierre, "distribuciones": get_cierre_distribuciones(conn, cierre_id)}
    finally:
        conn.close()
