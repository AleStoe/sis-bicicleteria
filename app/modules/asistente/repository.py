from psycopg.rows import dict_row


def get_ventas_hoy_resumen(conn, *, fecha, id_sucursal=None):
    params = [fecha]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                COUNT(*)::int AS cantidad,
                COALESCE(SUM(v.total_final), 0)::numeric(14,2) AS total,
                COALESCE(SUM(v.saldo_pendiente), 0)::numeric(14,2) AS saldo_pendiente
            FROM ventas v
            WHERE v.created_at::date = %s
              AND v.estado NOT IN ('anulada', 'devuelta')
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()


def get_ventas_hoy_items(conn, *, fecha, id_sucursal=None, limit=6):
    params = [fecha]
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
                v.estado,
                v.total_final,
                v.saldo_pendiente,
                v.created_at,
                c.nombre AS cliente_nombre
            FROM ventas v
            JOIN clientes c ON c.id = v.id_cliente
            WHERE v.created_at::date = %s
              AND v.estado NOT IN ('anulada', 'devuelta')
              {sucursal_sql}
            ORDER BY v.created_at DESC, v.id DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_caja_abierta_resumen(conn, *, id_sucursal=None):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND c.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT c.id, c.fecha, c.estado, c.monto_apertura
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
                "id": None,
                "fecha": None,
                "estado": None,
                "saldo_teorico": 0,
                "ingresos": 0,
                "egresos": 0,
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
        "id": caja["id"],
        "fecha": caja["fecha"],
        "estado": caja["estado"],
        "saldo_teorico": saldo,
        "ingresos": movs["ingresos"],
        "egresos": movs["egresos"],
    }


def get_turnos_hoy(conn, *, fecha, id_sucursal=None, limit=8):
    params = [fecha]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND at.id_sucursal = %s"
        params.append(id_sucursal)
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                at.id,
                at.fecha,
                at.hora_inicio,
                at.franja,
                at.estado,
                at.tipo_turno,
                at.tipo_servicio,
                at.cliente_nombre,
                at.descripcion
            FROM agenda_taller at
            WHERE at.fecha = %s
              AND at.estado IN ('pendiente', 'confirmado', 'en_taller')
              {sucursal_sql}
            ORDER BY at.hora_inicio ASC NULLS LAST, at.id ASC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_taller_resumen(conn, *, id_sucursal=None):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
              COUNT(*) FILTER (WHERE estado NOT IN ('retirada', 'cancelada'))::int AS activas,
              COUNT(*) FILTER (WHERE estado = 'lista_para_retirar')::int AS listas_retiro,
              COUNT(*) FILTER (
                WHERE estado NOT IN ('retirada', 'cancelada')
                  AND fecha_prometida IS NOT NULL
                  AND fecha_prometida < NOW()
              )::int AS atrasadas
            FROM ordenes_taller
            WHERE 1=1
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()


def get_taller_items(conn, *, id_sucursal=None, limit=6):
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
              ot.estado,
              ot.fecha_prometida,
              c.nombre AS cliente_nombre,
              ot.problema_reportado
            FROM ordenes_taller ot
            JOIN clientes c ON c.id = ot.id_cliente
            WHERE ot.estado NOT IN ('retirada', 'cancelada')
              {sucursal_sql}
            ORDER BY
              CASE WHEN ot.estado = 'lista_para_retirar' THEN 0 ELSE 1 END,
              ot.fecha_prometida ASC NULLS LAST,
              ot.id DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_deudas_resumen(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)::int AS abiertas,
              COALESCE(SUM(saldo_actual), 0)::numeric(14,2) AS total_abierto,
              COUNT(*) FILTER (
                WHERE proximo_vencimiento IS NOT NULL
                  AND proximo_vencimiento < NOW()
              )::int AS vencidas,
              COALESCE(SUM(saldo_actual) FILTER (
                WHERE proximo_vencimiento IS NOT NULL
                  AND proximo_vencimiento < NOW()
              ), 0)::numeric(14,2) AS total_vencido
            FROM deudas_cliente
            WHERE estado = 'abierta'
              AND saldo_actual > 0
            """
        )
        return cur.fetchone()


def get_deudas_items(conn, *, limit=6):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
              d.id,
              d.saldo_actual,
              d.proximo_vencimiento,
              c.nombre AS cliente_nombre
            FROM deudas_cliente d
            JOIN clientes c ON c.id = d.id_cliente
            WHERE d.estado = 'abierta'
              AND d.saldo_actual > 0
            ORDER BY
              d.proximo_vencimiento ASC NULLS LAST,
              d.saldo_actual DESC,
              d.id DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def get_deudas_vencidas_items(conn, *, limit=6):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
              d.id,
              d.saldo_actual,
              d.proximo_vencimiento,
              c.nombre AS cliente_nombre
            FROM deudas_cliente d
            JOIN clientes c ON c.id = d.id_cliente
            WHERE d.estado = 'abierta'
              AND d.saldo_actual > 0
              AND d.proximo_vencimiento IS NOT NULL
              AND d.proximo_vencimiento < NOW()
            ORDER BY
              d.proximo_vencimiento ASC,
              d.saldo_actual DESC,
              d.id DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def get_stock_critico_items(conn, *, id_sucursal=None, umbral=2, limit=8):
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
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.sku,
                (ss.stock_fisico - ss.stock_reservado - ss.stock_vendido_pendiente_entrega) AS stock_disponible
            FROM stock_sucursal ss
            JOIN variantes v ON v.id = ss.id_variante
            JOIN productos p ON p.id = v.id_producto
            WHERE p.stockeable = TRUE
              AND p.activo = TRUE
              AND v.activo = TRUE
              AND v.reponer_stock = TRUE
              AND (ss.stock_fisico - ss.stock_reservado - ss.stock_vendido_pendiente_entrega) <= %s
              {sucursal_sql}
            ORDER BY stock_disponible ASC, p.nombre ASC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()
