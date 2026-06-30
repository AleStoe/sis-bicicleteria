from calendar import monthrange
from datetime import date
from decimal import Decimal

from app.db.connection import get_connection
from app.modules.alertas_operativas.service import obtener_alertas_operativas
from app.modules.authz.service import exigir_permiso
from app.shared.constants import PERMISO_VER_RENTABILIDAD

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


def _build_alertas_operativas(*, caja, salud):
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

    configuracion = (
        ("taller_atrasado", "Taller atrasado", "Órdenes con fecha prometida vencida.", "alta"),
        ("bicis_listas", "Bicis listas hace 7 días", "Conviene avisar o insistir para el retiro.", "media"),
        ("reservas_vencidas", "Reservas vencidas", "Revisar si se convierten o cancelan.", "alta"),
        ("deudas_vencidas", "Deudas vencidas", "Hay saldos con vencimiento cumplido.", "alta"),
        ("stock_critico", "Stock crítico", "Repuestos por debajo del umbral operativo.", "media"),
        ("ventas_cobradas_no_entregadas", "Ventas cobradas sin entregar", "Mercadería cobrada pendiente de entrega.", "alta"),
        ("ventas_saldo_sin_deuda", "Saldo sin deuda formal", "Ventas con saldo pendiente sin deuda asociada.", "alta"),
        ("ventas_saldo_desincronizado", "Saldo desactualizado", "Venta y deuda asociada conservan saldos distintos.", "alta"),
        ("pagos_revertidos_hoy", "Pagos revertidos hoy", "Revisar que saldos y caja hayan quedado correctos.", "media"),
        ("cajas_abiertas_anteriores", "Cajas anteriores abiertas", "Hay cajas de días anteriores sin cierre.", "alta"),
        ("productos_maestros_incompletos", "Productos incompletos", "Faltan datos importantes del catálogo.", "media"),
        ("maestros_inactivos_en_uso", "Maestros inactivos en uso", "Hay datos inactivos vinculados a operaciones.", "media"),
    )

    for tipo, titulo, detalle, severidad in configuracion:
        cantidad = len(salud.get(tipo) or [])
        if cantidad:
            alertas.append(
                _alerta(
                    tipo,
                    titulo,
                    detalle,
                    cantidad,
                    severidad,
                    "/salud-operativa",
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
    id_usuario: int | None = None,
):
    periodo_mes, fecha_desde, fecha_hasta = _periodo_bounds(periodo_mes)

    conn = get_connection()
    try:
        if id_usuario is not None:
            exigir_permiso(conn, id_usuario, PERMISO_VER_RENTABILIDAD)

        ventas_mes = get_ventas_mes(conn, fecha_desde, fecha_hasta, id_sucursal)
        gastos_mes = get_gastos_mes(conn, fecha_desde, fecha_hasta, id_sucursal)
        rent = get_resultado_estimado(conn, fecha_desde, fecha_hasta, id_sucursal)
        resultado_estimado = Decimal(str(rent["margen_bruto"] or 0)) - Decimal(str(gastos_mes or 0))
        cantidad_ventas_mes = int(rent.get("cantidad_ventas") or 0)
        ticket_promedio_mes = (
            Decimal(str(ventas_mes)) / Decimal(cantidad_ventas_mes)
            if cantidad_ventas_mes
            else Decimal("0")
        )
        margen_bruto_mes = Decimal(str(rent["margen_bruto"] or 0))
        margen_bruto_porcentaje = (
            margen_bruto_mes / Decimal(str(ventas_mes)) * Decimal("100")
            if Decimal(str(ventas_mes or 0)) > 0
            else Decimal("0")
        )
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
        salud = obtener_alertas_operativas(
            dias_lista_retiro=7,
            stock_umbral=umbral_repuestos_criticos,
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
                "margen_bruto_mes": margen_bruto_mes,
                "margen_bruto_porcentaje": margen_bruto_porcentaje,
                "cantidad_ventas_mes": cantidad_ventas_mes,
                "ticket_promedio_mes": ticket_promedio_mes,
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
                salud=salud,
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
