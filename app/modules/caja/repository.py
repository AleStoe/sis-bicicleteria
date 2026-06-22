from psycopg.rows import dict_row
from decimal import Decimal

def get_sucursal_by_id(conn, sucursal_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, nombre, activa
            FROM sucursales
            WHERE id = %s
            """,
            (sucursal_id,),
        )
        return cur.fetchone()


def get_caja_by_id(conn, caja_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id = %s
            """,
            (caja_id,),
        )
        return cur.fetchone()


def get_caja_by_id_for_update(conn, caja_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id = %s
            FOR UPDATE
            """,
            (caja_id,),
        )
        return cur.fetchone()


def get_caja_abierta_hoy_by_sucursal(conn, id_sucursal: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id_sucursal = %s
              AND estado = 'abierta'
            ORDER BY fecha DESC, id DESC
            LIMIT 1
            """,
            (id_sucursal,),
        )
        return cur.fetchone()


def get_caja_abierta_hoy_by_sucursal_for_update(conn, id_sucursal: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id = (
                SELECT id
                FROM cajas
                WHERE id_sucursal = %s
                  AND estado = 'abierta'
                ORDER BY fecha DESC, id DESC
                LIMIT 1
            )
            FOR UPDATE
            """,
            (id_sucursal,),
        )
        return cur.fetchone()

def insert_caja(conn, id_sucursal: int, monto_apertura, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cajas (
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                id_usuario_apertura
            )
            VALUES (CURRENT_DATE, %s, 'abierta', %s, %s)
            RETURNING id
            """,
            (id_sucursal, monto_apertura, id_usuario),
        )
        return cur.fetchone()["id"]


def close_caja(
    conn,
    caja_id: int,
    monto_cierre_teorico,
    monto_cierre_real,
    diferencia,
    id_usuario: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE cajas
            SET estado = 'cerrada',
                monto_cierre_teorico = %s,
                monto_cierre_real = %s,
                diferencia = %s,
                id_usuario_cierre = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario,
                caja_id,
            ),
        )


def insert_caja_movimiento(
    conn,
    id_caja,
    tipo_movimiento,
    submedio,
    monto,
    origen_tipo,
    origen_id,
    nota,
    id_usuario,
    direccion_ajuste=None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO caja_movimientos (
                id_caja,
                tipo_movimiento,
                submedio,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
                direccion_ajuste
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                id_caja,
                tipo_movimiento,
                submedio,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
                direccion_ajuste,
            ),
        )
        row = cur.fetchone()
        return row["id"]


def get_caja_movimientos(conn, caja_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                cm.id,
                cm.id_caja,
                cm.fecha,
                cm.tipo_movimiento,
                cm.submedio,
                cm.monto,
                cm.origen_tipo,
                cm.origen_id,
                cm.nota,
                cm.id_usuario,
                u.nombre AS usuario_nombre,
                u.username AS usuario_username,
                cm.direccion_ajuste
            FROM caja_movimientos cm
            LEFT JOIN usuarios u
                ON u.id = cm.id_usuario
            WHERE cm.id_caja = %s
            ORDER BY cm.fecha, cm.id
            """,
            (caja_id,),
        )
        return cur.fetchall()


def get_totales_por_submedio(conn, caja_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                submedio,
                COALESCE(SUM(
                    CASE
                        WHEN tipo_movimiento = 'ingreso' THEN monto
                        WHEN tipo_movimiento = 'egreso' THEN -monto
                        WHEN tipo_movimiento = 'ajuste' AND direccion_ajuste = 'positivo' THEN monto
                        WHEN tipo_movimiento = 'ajuste' AND direccion_ajuste = 'negativo' THEN -monto
                        ELSE 0
                    END
                ), 0) AS total
            FROM caja_movimientos
            WHERE id_caja = %s
            GROUP BY submedio
            """,
            (caja_id,),
        )
        rows = cur.fetchall()

    base = {
        "efectivo": Decimal("0"),
        "transferencia": Decimal("0"),
        "mercadopago": Decimal("0"),
        "tarjeta": Decimal("0"),
    }

    for row in rows:
        base[row["submedio"]] = row["total"]

    return base


def get_efectivo_teorico(conn, caja_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                c.monto_apertura
                + COALESCE(SUM(
                    CASE
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'ingreso' THEN cm.monto
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'egreso' THEN -cm.monto
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'ajuste' AND cm.direccion_ajuste = 'positivo' THEN cm.monto
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'ajuste' AND cm.direccion_ajuste = 'negativo' THEN -cm.monto
                        ELSE 0
                    END
                ), 0) AS efectivo_teorico
            FROM cajas c
            LEFT JOIN caja_movimientos cm ON cm.id_caja = c.id
            WHERE c.id = %s
            GROUP BY c.id, c.monto_apertura
            """,
            (caja_id,),
        )
        row = cur.fetchone()
        return row["efectivo_teorico"] if row else Decimal("0")

def get_cajas_historial(
    conn,
    *,
    id_sucursal: int | None = None,
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    where = []
    params = []

    if id_sucursal is not None:
        where.append("c.id_sucursal = %s")
        params.append(id_sucursal)

    if fecha_desde is not None:
        where.append("c.fecha >= %s")
        params.append(fecha_desde)

    if fecha_hasta is not None:
        where.append("c.fecha <= %s")
        params.append(fecha_hasta)

    if estado is not None:
        where.append("c.estado = %s")
        params.append(estado)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                c.id,
                c.fecha,
                c.id_sucursal,
                s.nombre AS sucursal_nombre,
                c.estado,
                c.monto_apertura,
                c.monto_cierre_teorico,
                c.monto_cierre_real,
                c.diferencia,
                c.id_usuario_apertura,
                ua.nombre AS usuario_apertura_nombre,
                ua.username AS usuario_apertura_username,
                c.id_usuario_cierre,
                uc.nombre AS usuario_cierre_nombre,
                uc.username AS usuario_cierre_username
            FROM cajas c
            LEFT JOIN sucursales s
                ON s.id = c.id_sucursal
            LEFT JOIN usuarios ua
                ON ua.id = c.id_usuario_apertura
            LEFT JOIN usuarios uc
                ON uc.id = c.id_usuario_cierre
            {where_sql}
            ORDER BY c.fecha DESC, c.id DESC
            LIMIT %s OFFSET %s
            """,
            (*params, limit, offset),
        )
        return cur.fetchall()


def get_caja_del_dia(conn, *, fecha, id_sucursal: int | None = None):
    params = [fecha]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_real,
                diferencia
            FROM cajas
            WHERE fecha = %s
              {sucursal_sql}
            ORDER BY id DESC
            LIMIT 1
            """,
            params,
        )
        return cur.fetchone()


def get_resumen_movimientos_caja(conn, caja_id: int | None):
    base = {
        "ingresos": Decimal("0"),
        "egresos": Decimal("0"),
        "ajustes_positivos": Decimal("0"),
        "ajustes_negativos": Decimal("0"),
    }
    if caja_id is None:
        return base

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                COALESCE(SUM(monto) FILTER (WHERE tipo_movimiento = 'ingreso'), 0)::numeric(14,2) AS ingresos,
                COALESCE(SUM(monto) FILTER (WHERE tipo_movimiento = 'egreso'), 0)::numeric(14,2) AS egresos,
                COALESCE(SUM(monto) FILTER (WHERE tipo_movimiento = 'ajuste' AND direccion_ajuste = 'positivo'), 0)::numeric(14,2) AS ajustes_positivos,
                COALESCE(SUM(monto) FILTER (WHERE tipo_movimiento = 'ajuste' AND direccion_ajuste = 'negativo'), 0)::numeric(14,2) AS ajustes_negativos
            FROM caja_movimientos
            WHERE id_caja = %s
            """,
            (caja_id,),
        )
        return cur.fetchone() or base


def get_resumen_pagos_caja(conn, caja_id: int | None, *, fecha, id_sucursal: int | None = None):
    if caja_id is not None:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    COUNT(DISTINCT p.id)::int AS cantidad_pagos,
                    COALESCE(SUM(cm.monto), 0)::numeric(14,2) AS total_cobrado,
                    COALESCE(SUM(p.monto_base_aplicado), 0)::numeric(14,2) AS base_aplicada,
                    COALESCE(SUM(p.monto_descuento_aplicado), 0)::numeric(14,2) AS descuentos_aplicados,
                    COALESCE(SUM(p.monto_recargo_aplicado), 0)::numeric(14,2) AS recargos_aplicados,
                    COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'efectivo'), 0)::numeric(14,2) AS efectivo,
                    COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'transferencia'), 0)::numeric(14,2) AS transferencia,
                    COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'mercadopago'), 0)::numeric(14,2) AS mercadopago,
                    COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'tarjeta'), 0)::numeric(14,2) AS tarjeta,
                    COALESCE(SUM(p.monto_total_cobrado) FILTER (WHERE p.medio_pago = 'tarjeta'), 0)::numeric(14,2) AS total_financiado_tarjeta
                FROM caja_movimientos cm
                INNER JOIN pagos p
                    ON p.id = cm.origen_id
                   AND cm.origen_tipo = 'pago'
                WHERE cm.id_caja = %s
                  AND p.estado = 'confirmado'
                """,
                (caja_id,),
            )
            return cur.fetchone()

    params = [fecha]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = """
          AND c.id_sucursal = %s
        """
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                COUNT(DISTINCT p.id)::int AS cantidad_pagos,
                COALESCE(SUM(cm.monto), 0)::numeric(14,2) AS total_cobrado,
                COALESCE(SUM(p.monto_base_aplicado), 0)::numeric(14,2) AS base_aplicada,
                COALESCE(SUM(p.monto_descuento_aplicado), 0)::numeric(14,2) AS descuentos_aplicados,
                COALESCE(SUM(p.monto_recargo_aplicado), 0)::numeric(14,2) AS recargos_aplicados,
                COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'efectivo'), 0)::numeric(14,2) AS efectivo,
                COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'transferencia'), 0)::numeric(14,2) AS transferencia,
                COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'mercadopago'), 0)::numeric(14,2) AS mercadopago,
                COALESCE(SUM(cm.monto) FILTER (WHERE cm.submedio = 'tarjeta'), 0)::numeric(14,2) AS tarjeta,
                COALESCE(SUM(p.monto_total_cobrado) FILTER (WHERE p.medio_pago = 'tarjeta'), 0)::numeric(14,2) AS total_financiado_tarjeta
            FROM caja_movimientos cm
            INNER JOIN pagos p
                ON p.id = cm.origen_id
               AND cm.origen_tipo = 'pago'
            INNER JOIN cajas c
                ON c.id = cm.id_caja
            LEFT JOIN ventas v
                ON p.origen_tipo = 'venta'
               AND v.id = p.origen_id
            LEFT JOIN reservas r
                ON p.origen_tipo = 'reserva'
               AND r.id = p.origen_id
            LEFT JOIN ordenes_taller ot
                ON p.origen_tipo = 'orden_taller'
               AND ot.id = p.origen_id
            WHERE cm.fecha::date = %s
              AND p.estado = 'confirmado'
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()


def get_resumen_rentabilidad_dia(conn, *, fecha, id_sucursal: int | None = None):
    sucursal_sql = ""
    estados_operativos = [
        "pagada_parcial",
        "pagada_total",
        "entregada",
        "devuelta_parcial",
        "devuelta",
    ]
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"

    bloque_ventas_params = [fecha, estados_operativos]
    if id_sucursal is not None:
        bloque_ventas_params.append(id_sucursal)

    rentabilidad_params = [
        *bloque_ventas_params,
        *bloque_ventas_params,
        *bloque_ventas_params,
    ]

    gastos_params = [fecha]
    gastos_sucursal_sql = ""
    if id_sucursal is not None:
        gastos_sucursal_sql = "AND go.id_sucursal = %s"
        gastos_params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                COUNT(DISTINCT v.id)::int AS cantidad_ventas,
                COALESCE((
                    SELECT SUM(v2.total_final)
                    FROM ventas v2
                    WHERE v2.fecha::date = %s
                      AND v2.estado = ANY(%s)
                      {sucursal_sql.replace('v.', 'v2.')}
                ), 0)::numeric(14,2) AS ventas_total,
                COALESCE(SUM(vi.subtotal), 0)::numeric(14,2) AS ventas_items_total,
                COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)::numeric(14,2) AS costo_mercaderia_vendida,
                (
                    COALESCE((
                        SELECT SUM(v2.total_final)
                        FROM ventas v2
                        WHERE v2.fecha::date = %s
                          AND v2.estado = ANY(%s)
                          {sucursal_sql.replace('v.', 'v2.')}
                    ), 0)
                    - COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)
                )::numeric(14,2) AS margen_bruto
            FROM ventas v
            LEFT JOIN venta_items vi ON vi.id_venta = v.id
            WHERE v.fecha::date = %s
              AND v.estado = ANY(%s)
              {sucursal_sql}
            """,
            rentabilidad_params,
        )
        ventas = cur.fetchone()

        cur.execute(
            f"""
            SELECT COALESCE(SUM(go.monto), 0)::numeric(14,2) AS gastos_operativos
            FROM gastos_operativos go
            WHERE COALESCE(go.periodo_mes, go.fecha)::date = %s
              AND go.estado = 'activo'
              {gastos_sucursal_sql}
            """,
            gastos_params,
        )
        gastos = cur.fetchone()["gastos_operativos"]

    return {
        **ventas,
        "gastos_operativos": gastos,
        "ganancia_dia": ventas["margen_bruto"] - gastos,
    }


def get_documentos_disponibles_dia(conn, *, fecha, id_sucursal: int | None = None):
    ventas_params = [fecha]
    sucursal_sql = ""
    estados_operativos = ["pagada_parcial", "pagada_total", "entregada"]
    if id_sucursal is not None:
        sucursal_sql = "AND id_sucursal = %s"
        ventas_params.append(id_sucursal)

    pagos_params = [fecha]
    pagos_sucursal_sql = ""
    if id_sucursal is not None:
        pagos_sucursal_sql = "AND COALESCE(v.id_sucursal, r.id_sucursal, ot.id_sucursal) = %s"
        pagos_params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int AS total
            FROM ventas
            WHERE fecha::date = %s
              AND estado = ANY(%s)
              {sucursal_sql}
            """,
            [fecha, estados_operativos, *ventas_params[1:]],
        )
        comprobantes_x = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT COUNT(DISTINCT p.id)::int AS total
            FROM pagos p
            LEFT JOIN ventas v
                ON p.origen_tipo = 'venta'
               AND v.id = p.origen_id
            LEFT JOIN reservas r
                ON p.origen_tipo = 'reserva'
               AND r.id = p.origen_id
            LEFT JOIN ordenes_taller ot
                ON p.origen_tipo = 'orden_taller'
               AND ot.id = p.origen_id
            WHERE p.fecha::date = %s
              AND p.estado = 'confirmado'
              {pagos_sucursal_sql}
            """,
            pagos_params,
        )
        recibos_pago = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT COUNT(*)::int AS total
            FROM cotizaciones
            WHERE fecha::date = %s
              {sucursal_sql}
            """,
            ventas_params,
        )
        cotizaciones = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT COUNT(*)::int AS total
            FROM ordenes_taller
            WHERE fecha_ingreso::date = %s
              {sucursal_sql}
            """,
            ventas_params,
        )
        presupuestos_taller = cur.fetchone()["total"]

    resumenes_cobro = comprobantes_x
    return {
        "comprobantes_x": comprobantes_x,
        "recibos_pago": recibos_pago,
        "resumenes_cobro": resumenes_cobro,
        "cotizaciones": cotizaciones,
        "presupuestos_taller": presupuestos_taller,
        "total_disponibles": (
            comprobantes_x
            + recibos_pago
            + resumenes_cobro
            + cotizaciones
            + presupuestos_taller
        ),
    }
