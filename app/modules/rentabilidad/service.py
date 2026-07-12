from calendar import monthrange
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from psycopg import errors

from app.db.connection import get_connection
from .repository import (
    distribuir_monto,
    get_cierre_by_id,
    get_cierre_by_periodo,
    get_cierre_distribuciones,
    get_cierres,
    get_detalle_rentabilidad_diaria,
    get_gastos_periodo,
    get_bonificaciones_garantias,
    get_participante_by_id,
    get_regla_activa,
    get_regla_by_id,
    get_regla_items,
    get_reglas,
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
        resultado_financiero = financiacion_cobrada - costos_financieros
        cmv_bruto = Decimal(str(ventas["cmv_bruto"] or 0))
        cmv_devoluciones = Decimal(str(ventas["cmv_devoluciones"] or 0))
        cmv_neto = Decimal(str(ventas["cmv_neto"] or 0))
        cmv_cobrado = Decimal(str(ventas["cmv_cobrado"] or 0))
        cobrado_comercial_reconocido = Decimal(
            str(ventas["cobrado_comercial_reconocido"] or 0)
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
        }
    finally:
        conn.close()


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
        ventas_cobradas = sum(
            (Decimal(str(item["venta_cobrada"] or 0)) for item in detalles),
            Decimal("0"),
        )
        cobrado_comercial_reconocido = sum(
            (
                Decimal(str(item["cobrado_comercial_reconocido"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        saldo_pendiente_por_cobrar = ventas_netas - ventas_cobradas
        cmv_cobrado = sum(
            (Decimal(str(item["costo_cobrado"] or 0)) for item in detalles),
            Decimal("0"),
        )
        capital_recuperado = sum(
            (Decimal(str(item["capital_recuperado"] or 0)) for item in detalles),
            Decimal("0"),
        )
        capital_inmovilizado = sum(
            (
                Decimal(str(item["capital_inmovilizado"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        utilidad_liberada = sum(
            (Decimal(str(item["utilidad_liberada"] or 0)) for item in detalles),
            Decimal("0"),
        )
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
            "articulos": salida_articulos,
        }
    finally:
        conn.close()


def crear_cierre_rentabilidad(data):
    fecha_desde, fecha_hasta = _periodo_bounds(data.periodo_mes)
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
