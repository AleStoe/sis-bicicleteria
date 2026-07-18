def _marca_activo_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'marcas'
              AND column_name IN ('activo', 'activa')
            ORDER BY CASE column_name WHEN 'activo' THEN 0 ELSE 1 END
            LIMIT 1
            """
        )
        row = cur.fetchone()
        return row["column_name"] if row else "activo"


def get_bicis_listas_hace_dias(conn, dias: int = 7):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.updated_at,
                ot.id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                bc.marca,
                bc.modelo,
                bc.color,
                ot.problema_reportado
            FROM ordenes_taller ot
            JOIN clientes c ON c.id = ot.id_cliente
            JOIN bicicletas_clientes bc ON bc.id = ot.id_bicicleta_cliente
            WHERE ot.estado = 'lista_para_retirar'
              AND ot.updated_at <= NOW() - (%s || ' days')::interval
            ORDER BY ot.updated_at ASC
            LIMIT 50
            """,
            (dias,),
        )
        return cur.fetchall()


def get_reservas_vencidas(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                r.id,
                r.fecha_reserva,
                r.fecha_vencimiento,
                r.id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                r.sena_total,
                r.saldo_estimado
            FROM reservas r
            JOIN clientes c ON c.id = r.id_cliente
            WHERE r.estado = 'activa'
              AND r.fecha_vencimiento IS NOT NULL
              AND r.fecha_vencimiento < NOW()
            ORDER BY r.fecha_vencimiento ASC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_deudas_vencidas(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                d.id,
                d.id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                d.origen_tipo,
                d.origen_id,
                d.saldo_actual,
                d.proximo_vencimiento
            FROM deudas_cliente d
            JOIN clientes c ON c.id = d.id_cliente
            WHERE d.estado = 'abierta'
              AND d.saldo_actual > 0
              AND d.proximo_vencimiento IS NOT NULL
              AND d.proximo_vencimiento < NOW()
            ORDER BY d.proximo_vencimiento ASC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_taller_atrasado(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.fecha_prometida,
                ot.estado,
                ot.prioridad,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                bc.marca,
                bc.modelo,
                ot.problema_reportado
            FROM ordenes_taller ot
            JOIN clientes c ON c.id = ot.id_cliente
            JOIN bicicletas_clientes bc ON bc.id = ot.id_bicicleta_cliente
            WHERE ot.estado NOT IN ('retirada', 'cancelada')
              AND ot.fecha_prometida IS NOT NULL
              AND ot.fecha_prometida < NOW()
            ORDER BY ot.fecha_prometida ASC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_stock_critico(conn, umbral: int = 2):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                ss.id_sucursal,
                s.nombre AS sucursal_nombre,
                ss.id_variante,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.sku,
                v.codigo_proveedor,
                v.reponer_stock,
                ss.stock_fisico,
                (ss.stock_fisico - ss.stock_reservado - ss.stock_vendido_pendiente_entrega) AS stock_disponible
            FROM stock_sucursal ss
            JOIN sucursales s ON s.id = ss.id_sucursal
            JOIN variantes v ON v.id = ss.id_variante
            JOIN productos p ON p.id = v.id_producto
            WHERE p.stockeable = TRUE
              AND p.activo = TRUE
              AND v.activo = TRUE
              AND v.reponer_stock = TRUE
              AND (ss.stock_fisico - ss.stock_reservado - ss.stock_vendido_pendiente_entrega) <= %s
            ORDER BY stock_disponible ASC, p.nombre ASC
            LIMIT 80
            """,
            (umbral,),
        )
        return cur.fetchall()


def get_ventas_cobradas_no_entregadas(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                v.estado,
                v.total_final,
                v.saldo_pendiente
            FROM ventas v
            JOIN clientes c ON c.id = v.id_cliente
            WHERE v.estado = 'pagada_total'
              AND COALESCE(v.saldo_pendiente, 0) <= 0
            ORDER BY v.fecha ASC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_ventas_saldo_sin_deuda_formal(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                v.estado,
                v.total_final,
                v.saldo_pendiente
            FROM ventas v
            JOIN clientes c ON c.id = v.id_cliente
            WHERE COALESCE(v.saldo_pendiente, 0) > 0
              AND v.estado = 'entregada'
              AND NOT EXISTS (
                  SELECT 1
                  FROM deudas_cliente d
                  WHERE d.origen_tipo = 'venta'
                    AND d.origen_id = v.id
              )
            ORDER BY v.fecha ASC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_ventas_saldo_desincronizado_con_deuda(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                v.estado,
                v.total_final,
                v.saldo_pendiente,
                d.id AS deuda_id,
                d.estado AS deuda_estado,
                d.saldo_actual AS deuda_saldo_actual
            FROM ventas v
            JOIN clientes c ON c.id = v.id_cliente
            JOIN LATERAL (
                SELECT deuda.id, deuda.estado, deuda.saldo_actual
                FROM deudas_cliente deuda
                WHERE deuda.origen_tipo = 'venta'
                  AND deuda.origen_id = v.id
                ORDER BY deuda.id DESC
                LIMIT 1
            ) d ON TRUE
            WHERE v.estado NOT IN ('anulada', 'devuelta')
              AND COALESCE(v.saldo_pendiente, 0) <> COALESCE(d.saldo_actual, 0)
            ORDER BY v.fecha ASC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_venta_y_deuda_formal_for_update(conn, venta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.id_sucursal,
                v.estado,
                v.saldo_pendiente,
                d.id AS deuda_id,
                d.estado AS deuda_estado,
                d.saldo_actual AS deuda_saldo_actual
            FROM ventas v
            JOIN LATERAL (
                SELECT deuda.id, deuda.estado, deuda.saldo_actual
                FROM deudas_cliente deuda
                WHERE deuda.origen_tipo = 'venta'
                  AND deuda.origen_id = v.id
                ORDER BY deuda.id DESC
                LIMIT 1
                FOR UPDATE
            ) d ON TRUE
            WHERE v.id = %s
            FOR UPDATE OF v
            """,
            (venta_id,),
        )
        return cur.fetchone()


def update_venta_saldo_pendiente(conn, venta_id: int, saldo_pendiente):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET saldo_pendiente = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id, estado, saldo_pendiente
            """,
            (saldo_pendiente, venta_id),
        )
        return cur.fetchone()


def get_pagos_revertidos_hoy(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                p.id,
                p.fecha,
                p.origen_tipo,
                p.origen_id,
                p.medio_pago,
                p.monto_total_cobrado,
                p.id_cliente,
                c.nombre AS cliente_nombre
            FROM pagos p
            LEFT JOIN clientes c ON c.id = p.id_cliente
            WHERE p.estado = 'revertido'
              AND p.fecha::date = CURRENT_DATE
            ORDER BY p.fecha DESC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_cajas_abiertas_anteriores(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                cj.id,
                cj.fecha,
                cj.id_sucursal,
                s.nombre AS sucursal_nombre,
                cj.monto_apertura,
                cj.id_usuario_apertura,
                u.nombre AS usuario_nombre
            FROM cajas cj
            JOIN sucursales s ON s.id = cj.id_sucursal
            LEFT JOIN usuarios u ON u.id = cj.id_usuario_apertura
            WHERE cj.estado = 'abierta'
              AND cj.fecha < CURRENT_DATE
            ORDER BY cj.fecha ASC
            LIMIT 50
            """
        )
        return cur.fetchall()


def get_productos_maestros_incompletos(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                p.id,
                p.nombre,
                p.id_categoria,
                c.nombre AS categoria_nombre,
                p.id_marca,
                m.nombre AS marca_nombre,
                COUNT(v.id)::int AS variantes,
                COUNT(v.id) FILTER (WHERE v.proveedor_preferido_id IS NULL)::int AS variantes_sin_proveedor
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN marcas m ON m.id = p.id_marca
            LEFT JOIN variantes v ON v.id_producto = p.id AND v.activo = TRUE
            WHERE p.activo = TRUE
            GROUP BY p.id, p.nombre, p.id_categoria, c.nombre, p.id_marca, m.nombre
            HAVING p.id_categoria IS NULL
                OR p.id_marca IS NULL
                OR COUNT(v.id) FILTER (WHERE v.proveedor_preferido_id IS NULL) > 0
            ORDER BY p.nombre ASC
            LIMIT 80
            """
        )
        return cur.fetchall()


def get_maestros_inactivos_en_uso(conn):
    marca_activo_column = _marca_activo_column(conn)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                p.id,
                p.nombre,
                c.nombre AS categoria_nombre,
                c.activo AS categoria_activa,
                m.nombre AS marca_nombre,
                m.{marca_activo_column} AS marca_activa
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN marcas m ON m.id = p.id_marca
            WHERE p.activo = TRUE
              AND (
                COALESCE(c.activo, TRUE) = FALSE
                OR COALESCE(m.{marca_activo_column}, TRUE) = FALSE
              )
            ORDER BY p.nombre ASC
            LIMIT 80
            """
        )
        return cur.fetchall()
