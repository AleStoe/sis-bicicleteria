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
              AND NOT EXISTS (
                  SELECT 1
                  FROM capital_movimientos_historial h
                  WHERE h.id_movimiento = m.id
                    AND h.tipo_evento = 'validacion_sin_caja'
              )
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


def get_ventas_items_costos_sospechosos(conn, limit: int = 50):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            WITH items AS (
                SELECT
                    vi.id,
                    vi.id_venta,
                    v.fecha,
                    v.estado AS venta_estado,
                    v.id_cliente,
                    c.nombre AS cliente_nombre,
                    vi.id_variante,
                    var.id_producto,
                    p.nombre AS producto_nombre,
                    var.nombre_variante,
                    var.sku,
                    vi.descripcion_snapshot,
                    vi.cantidad,
                    vi.precio_final,
                    vi.subtotal,
                    vi.costo_unitario_aplicado,
                    COALESCE(var.costo_promedio_vigente, 0) AS costo_vigente,
                    COALESCE(vi.bonificado, FALSE) AS bonificado,
                    ROUND((vi.costo_unitario_aplicado * vi.cantidad), 2) AS cmv_item,
                    ROUND((vi.subtotal - (vi.costo_unitario_aplicado * vi.cantidad)), 2) AS margen_item,
                    CASE
                        WHEN vi.subtotal > 0 THEN
                            ROUND(((vi.subtotal - (vi.costo_unitario_aplicado * vi.cantidad)) / vi.subtotal) * 100, 2)
                        ELSE NULL
                    END AS margen_porcentaje_sobre_venta,
                    CASE
                        WHEN COALESCE(var.costo_promedio_vigente, 0) > 0 THEN
                            ROUND(
                                ABS(vi.costo_unitario_aplicado - var.costo_promedio_vigente)
                                / var.costo_promedio_vigente
                                * 100,
                                2
                            )
                        ELSE NULL
                    END AS diferencia_costo_vigente_porcentaje,
                    CASE
                        WHEN vi.subtotal > 0
                             AND (vi.costo_unitario_aplicado * vi.cantidad) > vi.subtotal
                            THEN 'margen_negativo'
                        WHEN p.stockeable = TRUE
                             AND vi.costo_unitario_aplicado <= 0
                             AND COALESCE(vi.bonificado, FALSE) = FALSE
                            THEN 'producto_sin_costo'
                        WHEN vi.subtotal > 0
                             AND COALESCE(vi.bonificado, FALSE) = FALSE
                             AND ((vi.subtotal - (vi.costo_unitario_aplicado * vi.cantidad)) / vi.subtotal) < 0.15
                            THEN 'margen_muy_bajo'
                        WHEN COALESCE(var.costo_promedio_vigente, 0) > 0
                             AND ABS(vi.costo_unitario_aplicado - var.costo_promedio_vigente)
                                 / var.costo_promedio_vigente > 0.30
                            THEN 'costo_distinto_al_vigente'
                        ELSE NULL
                    END AS motivo_alerta
                FROM venta_items vi
                INNER JOIN ventas v ON v.id = vi.id_venta
                INNER JOIN clientes c ON c.id = v.id_cliente
                LEFT JOIN variantes var ON var.id = vi.id_variante
                LEFT JOIN productos p ON p.id = var.id_producto
                WHERE vi.tipo_item = 'producto'
                  AND v.estado IN ('creada', 'pagada_parcial', 'pagada_total', 'entregada')
            )
            SELECT *
            FROM items
            WHERE motivo_alerta IS NOT NULL
            ORDER BY
                CASE motivo_alerta
                    WHEN 'margen_negativo' THEN 1
                    WHEN 'producto_sin_costo' THEN 2
                    WHEN 'margen_muy_bajo' THEN 3
                    ELSE 4
                END,
                fecha DESC,
                id DESC
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
