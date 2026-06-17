from calendar import monthrange
from datetime import date
from decimal import Decimal

from app.db.connection import get_connection

from .repository import (
    get_ventas_mes,
    get_gastos_mes,
    get_resultado_estimado,
    get_resultado_dia,
    get_caja_actual,
    get_total_deudas_abiertas,
    get_total_creditos_abiertos,
    get_ventas_pendientes_entrega_count,
    get_taller_pendiente_count,
    get_top_productos,
    get_repuestos_criticos,
    count_repuestos_criticos,
    get_productos_sin_movimiento,
    count_productos_sin_movimiento,
    get_bicis_listas_retiro_count,
    get_reservas_vencidas_count,
    get_deudas_vencidas_resumen,
    get_taller_atrasado_count,
    get_ventas_ultimos_meses,
    get_top_clientes,
    get_capital_inmovilizado,
    get_ventas_pendientes_entrega,
    get_taller_pendiente,
)


def _periodo_bounds(periodo_mes: date | None):
    if periodo_mes is None:
        hoy = date.today()
        periodo_mes = date(hoy.year, hoy.month, 1)
    else:
        periodo_mes = date(periodo_mes.year, periodo_mes.month, 1)

    ultimo_dia = monthrange(periodo_mes.year, periodo_mes.month)[1]
    fecha_hasta = date(periodo_mes.year, periodo_mes.month, ultimo_dia)
    return periodo_mes, periodo_mes, fecha_hasta


def _alerta(tipo, titulo, detalle, cantidad, severidad, to):
    return {
        "tipo": tipo,
        "titulo": titulo,
        "detalle": detalle,
        "cantidad": cantidad,
        "severidad": severidad,
        "to": to,
    }


def _build_alertas_operativas(
    *,
    caja,
    bicis_listas,
    reservas_vencidas,
    deudas_vencidas,
    taller_atrasado,
    stock_critico,
):
    alertas = []

    if not caja.get("caja_abierta_id"):
        alertas.append(
            _alerta(
                "caja_cerrada",
                "Caja cerrada",
                "Abrir caja antes de cobrar o registrar movimientos.",
                1,
                "alta",
                "/caja",
            )
        )

    if taller_atrasado:
        alertas.append(
            _alerta(
                "taller_atrasado",
                "Taller atrasado",
                "Ordenes con fecha prometida vencida.",
                taller_atrasado,
                "alta",
                "/alertas-operativas",
            )
        )

    if bicis_listas:
        alertas.append(
            _alerta(
                "bicis_listas",
                "Bicis listas hace 7 dias",
                "Avisar o insistir para retiro.",
                bicis_listas,
                "media",
                "/alertas-operativas",
            )
        )

    if reservas_vencidas:
        alertas.append(
            _alerta(
                "reservas_vencidas",
                "Reservas vencidas",
                "Revisar si se convierten, cancelan o vencen formalmente.",
                reservas_vencidas,
                "alta",
                "/alertas-operativas",
            )
        )

    deuda_count = int(deudas_vencidas.get("cantidad") or 0)
    deuda_total = Decimal(str(deudas_vencidas.get("total") or 0))
    if deuda_count:
        alertas.append(
            _alerta(
                "deudas_vencidas",
                "Deudas vencidas",
                f"{deuda_count} deuda(s), total ${deuda_total:,.2f}",
                deuda_count,
                "alta",
                "/alertas-operativas",
            )
        )

    if stock_critico:
        alertas.append(
            _alerta(
                "stock_critico",
                "Stock critico",
                "Repuestos por debajo del umbral operativo.",
                stock_critico,
                "media",
                "/stock?estado_stock=stock_bajo",
            )
        )

    return alertas


def obtener_dashboard_resumen(
    *,
    periodo_mes: date | None = None,
    id_sucursal: int | None = None,
    dias_sin_movimiento: int = 90,
    umbral_repuestos_criticos: int = 2,
    limit: int = 10,
):
    periodo_mes, fecha_desde, fecha_hasta = _periodo_bounds(periodo_mes)

    conn = get_connection()
    try:
        ventas_mes = get_ventas_mes(conn, fecha_desde, fecha_hasta, id_sucursal)
        gastos_mes = get_gastos_mes(conn, fecha_desde, fecha_hasta, id_sucursal)
        rent = get_resultado_estimado(conn, fecha_desde, fecha_hasta, id_sucursal)
        resultado_estimado = Decimal(str(rent["margen_bruto"] or 0)) - Decimal(str(gastos_mes or 0))
        hoy = date.today()
        resultado_hoy = get_resultado_dia(conn, hoy, id_sucursal=id_sucursal)
        caja = get_caja_actual(conn, id_sucursal)

        deudas_abiertas = get_total_deudas_abiertas(conn)
        creditos_abiertos = get_total_creditos_abiertos(conn)
        ventas_pendientes_entrega_count = get_ventas_pendientes_entrega_count(conn, id_sucursal)
        taller_pendiente_count = get_taller_pendiente_count(conn, id_sucursal)
        repuestos_criticos_count = count_repuestos_criticos(conn, id_sucursal=id_sucursal, umbral=umbral_repuestos_criticos)
        sin_mov_count = count_productos_sin_movimiento(
            conn,
            id_sucursal=id_sucursal,
            dias=dias_sin_movimiento,
        )
        bicis_listas_count = get_bicis_listas_retiro_count(
            conn,
            id_sucursal=id_sucursal,
            dias=7,
        )
        reservas_vencidas_count = get_reservas_vencidas_count(
            conn,
            id_sucursal=id_sucursal,
        )
        deudas_vencidas = get_deudas_vencidas_resumen(conn)
        taller_atrasado_count = get_taller_atrasado_count(
            conn,
            id_sucursal=id_sucursal,
        )

        ventas_ultimos_meses = get_ventas_ultimos_meses(
            conn,
            fecha_hasta,
            id_sucursal=id_sucursal,
            meses=6,
        )
        top_clientes = get_top_clientes(
            conn,
            fecha_desde,
            fecha_hasta,
            id_sucursal=id_sucursal,
            limit=limit,
        )
        top_cantidad = get_top_productos(
            conn,
            fecha_desde,
            fecha_hasta,
            id_sucursal=id_sucursal,
            order_by="cantidad",
            limit=limit,
        )
        repuestos_criticos = get_repuestos_criticos(
            conn,
            id_sucursal=id_sucursal,
            umbral=umbral_repuestos_criticos,
            limit=limit,
        )
        sin_movimiento = get_productos_sin_movimiento(
            conn,
            id_sucursal=id_sucursal,
            dias=dias_sin_movimiento,
            limit=limit,
        )
        ventas_pendientes_entrega = get_ventas_pendientes_entrega(
            conn,
            id_sucursal=id_sucursal,
            limit=limit,
        )
        taller_pendiente = get_taller_pendiente(
            conn,
            id_sucursal=id_sucursal,
            limit=limit,
        )

        return {
            "periodo_mes": periodo_mes,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "id_sucursal": id_sucursal,
            "kpis": {
                "ventas_mes": ventas_mes,
                "gastos_mes": gastos_mes,
                "resultado_estimado": resultado_estimado,
                "caja_actual": caja["saldo_teorico"],
                "deudas_abiertas": deudas_abiertas,
                "creditos_abiertos": creditos_abiertos,
                "ventas_pendientes_entrega": ventas_pendientes_entrega_count,
                "taller_pendiente": taller_pendiente_count,
                "repuestos_criticos": repuestos_criticos_count,
                "productos_sin_movimiento": sin_mov_count,
            },
            "caja": caja,
            "resultado_hoy": {
                "fecha": hoy,
                **resultado_hoy,
            },
            "alertas_operativas": _build_alertas_operativas(
                caja=caja,
                bicis_listas=bicis_listas_count,
                reservas_vencidas=reservas_vencidas_count,
                deudas_vencidas=deudas_vencidas,
                taller_atrasado=taller_atrasado_count,
                stock_critico=repuestos_criticos_count,
            ),
            "ventas_ultimos_meses": ventas_ultimos_meses,
            "top_clientes": top_clientes,
            "top_productos_cantidad": top_cantidad,
            "productos_sin_movimiento": sin_movimiento,
            "repuestos_criticos": repuestos_criticos,
            "capital_inmovilizado": get_capital_inmovilizado(conn, id_sucursal=id_sucursal, limit=limit),
            "taller_pendiente": taller_pendiente,
            "ventas_pendientes_entrega": ventas_pendientes_entrega,
        }
    finally:
        conn.close()
