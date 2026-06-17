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
                ss.stock_fisico,
                (ss.stock_fisico - ss.stock_reservado - ss.stock_vendido_pendiente_entrega) AS stock_disponible
            FROM stock_sucursal ss
            JOIN sucursales s ON s.id = ss.id_sucursal
            JOIN variantes v ON v.id = ss.id_variante
            JOIN productos p ON p.id = v.id_producto
            WHERE p.stockeable = TRUE
              AND p.activo = TRUE
              AND v.activo = TRUE
              AND (ss.stock_fisico - ss.stock_reservado - ss.stock_vendido_pendiente_entrega) <= %s
            ORDER BY stock_disponible ASC, p.nombre ASC
            LIMIT 80
            """,
            (umbral,),
        )
        return cur.fetchall()
