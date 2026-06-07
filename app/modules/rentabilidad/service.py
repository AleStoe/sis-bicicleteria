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
    get_gastos_periodo,
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

        ventas_brutas = Decimal(str(ventas["ventas_brutas"] or 0))
        devoluciones_total = Decimal(str(ventas["devoluciones_total"] or 0))
        ventas_netas = Decimal(str(ventas["ventas_netas"] or 0))
        cmv_bruto = Decimal(str(ventas["cmv_bruto"] or 0))
        cmv_devoluciones = Decimal(str(ventas["cmv_devoluciones"] or 0))
        cmv_neto = Decimal(str(ventas["cmv_neto"] or 0))
        gastos_operativos = Decimal(str(gastos or 0))
        margen_bruto = ventas_netas - cmv_neto
        resultado_distribuible = margen_bruto - gastos_operativos

        regla, items = _obtener_regla_para_calculo(conn, id_regla_distribucion)
        distribuciones = distribuir_monto(resultado_distribuible, items) if regla else []

        return {
            "periodo_mes": fecha_desde,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "id_sucursal": id_sucursal,
            "ventas_brutas": ventas_brutas,
            "devoluciones_total": devoluciones_total,
            "ventas_netas": ventas_netas,
            "cmv_bruto": cmv_bruto,
            "cmv_devoluciones": cmv_devoluciones,
            "cmv_neto": cmv_neto,
            "margen_bruto": margen_bruto,
            "gastos_operativos": gastos_operativos,
            "resultado_distribuible": resultado_distribuible,
            "regla_distribucion": _armar_regla(regla, items) if regla else None,
            "distribuciones_sugeridas": distribuciones,
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
            cmv_bruto = Decimal(str(ventas["cmv_bruto"] or 0))
            cmv_devoluciones = Decimal(str(ventas["cmv_devoluciones"] or 0))
            cmv_neto = Decimal(str(ventas["cmv_neto"] or 0))
            gastos_operativos = Decimal(str(gastos or 0))
            margen_bruto = ventas_netas - cmv_neto
            resultado_distribuible = margen_bruto - gastos_operativos

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
