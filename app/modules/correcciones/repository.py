from psycopg.rows import dict_row


def get_capital_sin_caja(conn, limit: int = 50):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                m.id,
                m.fecha,
                m.id_sucursal,
                s.nombre AS sucursal_nombre,
                m.id_participante,
                p.nombre AS participante_nombre,
                m.tipo_movimiento,
                m.descripcion,
                m.monto,
                m.medio_pago,
                m.estado,
                m.created_at
            FROM capital_movimientos m
            INNER JOIN capital_participantes p ON p.id = m.id_participante
            LEFT JOIN sucursales s ON s.id = m.id_sucursal
            WHERE m.estado = 'activo'
              AND m.tipo_movimiento IN (
                  'devolucion_prestamo',
                  'retiro_personal',
                  'distribucion_ganancia'
              )
              AND COALESCE(m.impacta_caja, FALSE) = FALSE
              AND m.id_caja_movimiento IS NULL
            ORDER BY m.fecha DESC, m.id DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def get_ventas_saldo_sin_deuda(conn, limit: int = 50):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                v.estado,
                v.total_final,
                v.saldo_pendiente
            FROM ventas v
            INNER JOIN clientes c ON c.id = v.id_cliente
            WHERE COALESCE(v.saldo_pendiente, 0) > 0
              AND v.estado = 'entregada'
              AND NOT EXISTS (
                  SELECT 1
                  FROM deudas_cliente d
                  WHERE d.origen_tipo = 'venta'
                    AND d.origen_id = v.id
              )
            ORDER BY v.fecha ASC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def get_creditos_anulacion_dudosos(conn, limit: int = 50):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                cr.id,
                cr.id_cliente,
                c.nombre AS cliente_nombre,
                cr.origen_tipo,
                cr.origen_id,
                cr.saldo_actual,
                cr.estado,
                cr.observacion,
                pagos.medio_electronico
            FROM creditos_cliente cr
            INNER JOIN clientes c ON c.id = cr.id_cliente
            LEFT JOIN LATERAL (
                SELECT p.medio_pago AS medio_electronico
                FROM pagos p
                WHERE p.origen_tipo = 'venta'
                  AND p.origen_id = cr.origen_id
                  AND p.medio_pago IN ('tarjeta', 'mercadopago')
                ORDER BY p.id DESC
                LIMIT 1
            ) pagos ON TRUE
            WHERE cr.origen_tipo = 'venta'
              AND cr.estado IN ('abierto', 'aplicado_parcial')
              AND cr.saldo_actual > 0
              AND pagos.medio_electronico IS NOT NULL
            ORDER BY cr.id DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def get_cajas_abiertas_anteriores(conn, limit: int = 50):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                c.id,
                c.fecha,
                c.id_sucursal,
                s.nombre AS sucursal_nombre,
                c.estado,
                c.monto_apertura
            FROM cajas c
            INNER JOIN sucursales s ON s.id = c.id_sucursal
            WHERE c.estado = 'abierta'
              AND c.fecha < CURRENT_DATE
            ORDER BY c.fecha ASC, c.id ASC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def get_movimiento_capital_correccion_for_update(conn, movimiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                m.*,
                p.nombre AS participante_nombre
            FROM capital_movimientos m
            INNER JOIN capital_participantes p ON p.id = m.id_participante
            WHERE m.id = %s
            FOR UPDATE
            """,
            (movimiento_id,),
        )
        return cur.fetchone()


def vincular_capital_a_caja(conn, movimiento_id: int, caja_movimiento_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE capital_movimientos
            SET impacta_caja = TRUE,
                id_caja_movimiento = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (caja_movimiento_id, movimiento_id),
        )
