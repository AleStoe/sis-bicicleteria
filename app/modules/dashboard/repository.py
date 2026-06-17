from psycopg.rows import dict_row

VENTAS_EXCLUIDAS = ("anulada", "devuelta")

NO_BICICLETAS_SQL = """
  AND p.serializable = FALSE
  AND LOWER(COALESCE(c.nombre, '')) NOT LIKE '%%bicicleta%%'
  AND LOWER(COALESCE(p.nombre, '')) NOT LIKE '%%bicicleta%%'
"""


def get_ventas_mes(conn, fecha_desde, fecha_hasta, id_sucursal=None):
    params = [fecha_desde, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COALESCE(SUM(v.total_final), 0)::numeric(14,2) AS total
            FROM ventas v
            WHERE v.fecha::date >= %s
              AND v.fecha::date <= %s
              AND v.estado NOT IN ('anulada', 'devuelta')
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["total"]


def get_gastos_mes(conn, fecha_desde, fecha_hasta, id_sucursal=None):
    params = [fecha_desde, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND go.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COALESCE(SUM(go.monto), 0)::numeric(14,2) AS total
            FROM gastos_operativos go
            WHERE COALESCE(go.periodo_mes, go.fecha)::date >= %s
              AND COALESCE(go.periodo_mes, go.fecha)::date <= %s
              AND go.estado = 'activo'
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["total"]


def get_resultado_estimado(conn, fecha_desde, fecha_hasta, id_sucursal=None):
    params = [fecha_desde, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              COALESCE(SUM(vi.subtotal), 0)::numeric(14,2) AS ventas_items_total,
              COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)::numeric(14,2) AS cmv,
              (
                COALESCE(SUM(vi.subtotal), 0)
                - COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)
              )::numeric(14,2) AS margen_bruto
            FROM ventas v
            INNER JOIN venta_items vi ON vi.id_venta = v.id
            WHERE v.fecha::date >= %s
              AND v.fecha::date <= %s
              AND v.estado NOT IN ('anulada', 'devuelta')
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()


def get_resultado_dia(conn, fecha, id_sucursal=None):
    params = [fecha]
    ventas_sucursal_sql = ""
    gastos_sucursal_sql = ""
    if id_sucursal is not None:
        ventas_sucursal_sql = "AND v.id_sucursal = %s"
        gastos_sucursal_sql = "AND go.id_sucursal = %s"
        params.append(id_sucursal)

    gastos_params = [fecha]
    if id_sucursal is not None:
        gastos_params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              COALESCE(SUM(v.total_final), 0)::numeric(14,2) AS ventas_total,
              COUNT(DISTINCT v.id)::int AS cantidad_ventas,
              COALESCE(SUM(vi.subtotal), 0)::numeric(14,2) AS ventas_items_total,
              COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)::numeric(14,2) AS cmv,
              (
                COALESCE(SUM(vi.subtotal), 0)
                - COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)
              )::numeric(14,2) AS margen_bruto
            FROM ventas v
            LEFT JOIN venta_items vi ON vi.id_venta = v.id
            WHERE v.fecha::date = %s
              AND v.estado NOT IN ('anulada', 'devuelta')
              {ventas_sucursal_sql}
            """,
            params,
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
        "resultado_estimado": ventas["margen_bruto"] - gastos,
    }


def get_caja_actual(conn, id_sucursal=None):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND c.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT id, fecha, estado, monto_apertura
            FROM cajas c
            WHERE c.estado = 'abierta'
              {sucursal_sql}
            ORDER BY c.fecha DESC, c.id DESC
            LIMIT 1
            """,
            params,
        )
        caja = cur.fetchone()

        if caja is None:
            return {
                "caja_abierta_id": None,
                "estado": None,
                "fecha": None,
                "saldo_teorico": 0,
                "ingresos": 0,
                "egresos": 0,
                "ajustes_positivos": 0,
                "ajustes_negativos": 0,
            }

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
            (caja["id"],),
        )
        movs = cur.fetchone()

    saldo = (
        caja["monto_apertura"]
        + movs["ingresos"]
        + movs["ajustes_positivos"]
        - movs["egresos"]
        - movs["ajustes_negativos"]
    )

    return {
        "caja_abierta_id": caja["id"],
        "estado": caja["estado"],
        "fecha": caja["fecha"],
        "saldo_teorico": saldo,
        "ingresos": movs["ingresos"],
        "egresos": movs["egresos"],
        "ajustes_positivos": movs["ajustes_positivos"],
        "ajustes_negativos": movs["ajustes_negativos"],
    }


def get_total_deudas_abiertas(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(saldo_actual), 0)::numeric(14,2) AS total
            FROM deudas_cliente
            WHERE estado = 'abierta'
            """
        )
        return cur.fetchone()["total"]


def get_total_creditos_abiertos(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(saldo_actual), 0)::numeric(14,2) AS total
            FROM creditos_cliente
            WHERE estado IN ('abierto', 'aplicado_parcial')
            """
        )
        return cur.fetchone()["total"]


def get_ventas_pendientes_entrega_count(conn, id_sucursal=None):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int AS cantidad
            FROM ventas v
            WHERE v.estado IN ('pagada_parcial', 'pagada_total')
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["cantidad"]


def get_taller_pendiente_count(conn, id_sucursal=None):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int AS cantidad
            FROM ordenes_taller
            WHERE estado NOT IN ('retirada', 'cancelada', 'facturada')
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["cantidad"]


def get_bicis_listas_retiro_count(conn, *, id_sucursal=None, dias=7):
    params = [dias]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND ot.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int AS cantidad
            FROM ordenes_taller ot
            WHERE ot.estado = 'lista_para_retirar'
              AND ot.updated_at <= NOW() - (%s || ' days')::interval
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["cantidad"]


def get_reservas_vencidas_count(conn, *, id_sucursal=None):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND r.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int AS cantidad
            FROM reservas r
            WHERE r.estado = 'activa'
              AND r.fecha_vencimiento IS NOT NULL
              AND r.fecha_vencimiento < NOW()
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["cantidad"]


def get_deudas_vencidas_resumen(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)::int AS cantidad,
              COALESCE(SUM(saldo_actual), 0)::numeric(14,2) AS total
            FROM deudas_cliente
            WHERE estado = 'abierta'
              AND saldo_actual > 0
              AND proximo_vencimiento IS NOT NULL
              AND proximo_vencimiento < NOW()
            """
        )
        return cur.fetchone()


def get_taller_atrasado_count(conn, *, id_sucursal=None):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND ot.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int AS cantidad
            FROM ordenes_taller ot
            WHERE ot.estado NOT IN ('retirada', 'cancelada')
              AND ot.fecha_prometida IS NOT NULL
              AND ot.fecha_prometida < NOW()
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["cantidad"]


def get_top_productos(conn, fecha_desde, fecha_hasta, *, id_sucursal=None, order_by="cantidad", limit=10):
    order_map = {
        "cantidad": "cantidad_vendida DESC",
        "facturacion": "venta_total DESC",
        "margen": "margen_bruto DESC",
    }
    order_sql = order_map.get(order_by, order_map["cantidad"])
    params = [fecha_desde, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              vi.id_variante,
              COALESCE(p.nombre, vi.descripcion_snapshot) AS producto,
              var.nombre_variante AS variante,
              COALESCE(SUM(vi.cantidad), 0)::numeric(14,3) AS cantidad_vendida,
              COALESCE(SUM(vi.subtotal), 0)::numeric(14,2) AS venta_total,
              COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)::numeric(14,2) AS costo_total,
              (
                COALESCE(SUM(vi.subtotal), 0)
                - COALESCE(SUM(vi.costo_unitario_aplicado * vi.cantidad), 0)
              )::numeric(14,2) AS margen_bruto
            FROM venta_items vi
            INNER JOIN ventas v ON v.id = vi.id_venta
            LEFT JOIN variantes var ON var.id = vi.id_variante
            LEFT JOIN productos p ON p.id = var.id_producto
            WHERE v.fecha::date >= %s
              AND v.fecha::date <= %s
              AND v.estado NOT IN ('anulada', 'devuelta')
              AND vi.tipo_item = 'producto'
              {sucursal_sql}
            GROUP BY vi.id_variante, COALESCE(p.nombre, vi.descripcion_snapshot), var.nombre_variante
            ORDER BY {order_sql}
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_repuestos_criticos(conn, *, id_sucursal=None, umbral=2, limit=20):
    params = [umbral]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND ss.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              ss.id_variante,
              p.nombre AS producto,
              var.nombre_variante AS variante,
              ss.stock_fisico,
              ss.stock_reservado,
              ss.stock_vendido_pendiente_entrega,
              var.costo_promedio_vigente
            FROM stock_sucursal ss
            INNER JOIN variantes var ON var.id = ss.id_variante
            INNER JOIN productos p ON p.id = var.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            WHERE ss.stock_fisico <= %s
              AND p.activo = TRUE
              AND var.activo = TRUE
              {NO_BICICLETAS_SQL}
              {sucursal_sql}
            ORDER BY ss.stock_fisico ASC, p.nombre ASC, var.nombre_variante ASC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def count_repuestos_criticos(conn, *, id_sucursal=None, umbral=2):
    params = [umbral]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND ss.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int AS cantidad
            FROM stock_sucursal ss
            INNER JOIN variantes var ON var.id = ss.id_variante
            INNER JOIN productos p ON p.id = var.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            WHERE ss.stock_fisico <= %s
              AND p.activo = TRUE
              AND var.activo = TRUE
              {NO_BICICLETAS_SQL}
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["cantidad"]


def get_productos_sin_movimiento(conn, *, id_sucursal=None, dias=90, limit=20):
    params = []
    ventas_sucursal_sql = ""
    sucursal_sql = ""
    if id_sucursal is not None:
        ventas_sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)
        sucursal_sql = "AND ss.id_sucursal = %s"
        params.append(id_sucursal)
    params.extend([dias, limit])

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            WITH ultimas_ventas AS (
              SELECT
                vi.id_variante,
                MAX(v.fecha) AS ultima_venta
              FROM venta_items vi
              INNER JOIN ventas v ON v.id = vi.id_venta
              WHERE v.estado NOT IN ('anulada', 'devuelta')
                AND vi.tipo_item = 'producto'
                {ventas_sucursal_sql}
              GROUP BY vi.id_variante
            )
            SELECT
              ss.id_variante,
              p.nombre AS producto,
              var.nombre_variante AS variante,
              ss.stock_fisico,
              var.costo_promedio_vigente,
              (ss.stock_fisico * var.costo_promedio_vigente)::numeric(14,2) AS capital_inmovilizado,
              uv.ultima_venta,
              CASE
                WHEN uv.ultima_venta IS NULL THEN NULL
                ELSE (CURRENT_DATE - uv.ultima_venta::date)::int
              END AS dias_sin_movimiento
            FROM stock_sucursal ss
            INNER JOIN variantes var ON var.id = ss.id_variante
            INNER JOIN productos p ON p.id = var.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN ultimas_ventas uv ON uv.id_variante = ss.id_variante
            WHERE ss.stock_fisico > 0
              AND p.activo = TRUE
              AND var.activo = TRUE
              {NO_BICICLETAS_SQL}
              AND (
                uv.ultima_venta IS NULL
                OR uv.ultima_venta::date <= CURRENT_DATE - (%s::int)
              )
              {sucursal_sql}
            ORDER BY uv.ultima_venta ASC NULLS FIRST, capital_inmovilizado DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def count_productos_sin_movimiento(conn, *, id_sucursal=None, dias=90):
    params = []
    ventas_sucursal_sql = ""
    sucursal_sql = ""
    if id_sucursal is not None:
        ventas_sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)
        sucursal_sql = "AND ss.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(dias)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            WITH ultimas_ventas AS (
              SELECT
                vi.id_variante,
                MAX(v.fecha) AS ultima_venta
              FROM venta_items vi
              INNER JOIN ventas v ON v.id = vi.id_venta
              WHERE v.estado NOT IN ('anulada', 'devuelta')
                AND vi.tipo_item = 'producto'
                {ventas_sucursal_sql}
              GROUP BY vi.id_variante
            )
            SELECT COUNT(*)::int AS cantidad
            FROM stock_sucursal ss
            INNER JOIN variantes var ON var.id = ss.id_variante
            INNER JOIN productos p ON p.id = var.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN ultimas_ventas uv ON uv.id_variante = ss.id_variante
            WHERE ss.stock_fisico > 0
              AND p.activo = TRUE
              AND var.activo = TRUE
              {NO_BICICLETAS_SQL}
              AND (
                uv.ultima_venta IS NULL
                OR uv.ultima_venta::date <= CURRENT_DATE - (%s::int)
              )
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["cantidad"]


def get_capital_inmovilizado(conn, *, id_sucursal=None, limit=10):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND ss.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              ss.id_variante,
              p.nombre AS producto,
              var.nombre_variante AS variante,
              ss.stock_fisico,
              var.costo_promedio_vigente,
              (ss.stock_fisico * var.costo_promedio_vigente)::numeric(14,2) AS capital_inmovilizado
            FROM stock_sucursal ss
            INNER JOIN variantes var ON var.id = ss.id_variante
            INNER JOIN productos p ON p.id = var.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            WHERE ss.stock_fisico > 0
              AND p.activo = TRUE
              AND var.activo = TRUE
              {NO_BICICLETAS_SQL}
              {sucursal_sql}
            ORDER BY capital_inmovilizado DESC, ss.stock_fisico DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_ventas_ultimos_meses(conn, fecha_hasta, *, id_sucursal=None, meses=6):
    params = [fecha_hasta, meses, fecha_hasta, fecha_hasta, meses, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            WITH meses AS (
              SELECT generate_series(
                date_trunc('month', %s::date) - ((%s::int - 1) * interval '1 month'),
                date_trunc('month', %s::date),
                interval '1 month'
              )::date AS periodo
            ), ventas_mes AS (
              SELECT
                date_trunc('month', v.fecha)::date AS periodo,
                COALESCE(SUM(v.total_final), 0)::numeric(14,2) AS ventas_total,
                COUNT(*)::int AS cantidad_ventas
              FROM ventas v
              WHERE v.fecha::date >= date_trunc('month', %s::date) - ((%s::int - 1) * interval '1 month')
                AND v.fecha::date <= %s::date
                AND v.estado NOT IN ('anulada', 'devuelta')
                {sucursal_sql}
              GROUP BY date_trunc('month', v.fecha)::date
            )
            SELECT
              m.periodo,
              to_char(m.periodo, 'Mon YYYY') AS etiqueta,
              COALESCE(vm.ventas_total, 0)::numeric(14,2) AS ventas_total,
              COALESCE(vm.cantidad_ventas, 0)::int AS cantidad_ventas
            FROM meses m
            LEFT JOIN ventas_mes vm ON vm.periodo = m.periodo
            ORDER BY m.periodo ASC
            """,
            params,
        )
        return cur.fetchall()


def get_top_clientes(conn, fecha_desde, fecha_hasta, *, id_sucursal=None, limit=10):
    params = [fecha_desde, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              c.id AS id_cliente,
              COALESCE(NULLIF(c.razon_social, ''), c.nombre) AS cliente_nombre,
              COUNT(v.id)::int AS cantidad_compras,
              COALESCE(SUM(v.total_final), 0)::numeric(14,2) AS total_comprado,
              COALESCE(AVG(v.total_final), 0)::numeric(14,2) AS ticket_promedio,
              MAX(v.fecha) AS ultima_compra
            FROM ventas v
            INNER JOIN clientes c ON c.id = v.id_cliente
            WHERE v.fecha::date >= %s
              AND v.fecha::date <= %s
              AND v.estado NOT IN ('anulada', 'devuelta')
              {sucursal_sql}
            GROUP BY c.id, COALESCE(NULLIF(c.razon_social, ''), c.nombre)
            ORDER BY total_comprado DESC, cantidad_compras DESC, cliente_nombre ASC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_ventas_pendientes_entrega(conn, *, id_sucursal=None, limit=10):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              v.id,
              v.fecha,
              COALESCE(NULLIF(c.razon_social, ''), c.nombre) AS cliente_nombre,
              v.estado,
              v.total_final,
              v.saldo_pendiente,
              COALESCE(SUM(vi.cantidad) FILTER (WHERE vi.tipo_item = 'producto'), 0)::numeric(14,3) AS cantidad_items
            FROM ventas v
            INNER JOIN clientes c ON c.id = v.id_cliente
            LEFT JOIN venta_items vi ON vi.id_venta = v.id
            WHERE v.estado IN ('pagada_parcial', 'pagada_total')
              {sucursal_sql}
            GROUP BY v.id, v.fecha, COALESCE(NULLIF(c.razon_social, ''), c.nombre), v.estado, v.total_final, v.saldo_pendiente
            ORDER BY v.fecha ASC, v.id ASC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_taller_pendiente(conn, *, id_sucursal=None, limit=10):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND ot.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              ot.id,
              ot.fecha_ingreso,
              c.nombre AS cliente_nombre,
              ot.estado,
              ot.problema_reportado,
              ot.total_final,
              ot.saldo_pendiente
            FROM ordenes_taller ot
            INNER JOIN clientes c ON c.id = ot.id_cliente
            WHERE ot.estado NOT IN ('retirada', 'cancelada', 'facturada')
              {sucursal_sql}
            ORDER BY ot.fecha_ingreso ASC, ot.id ASC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()
