def get_cliente_by_id(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                activo
            FROM clientes
            WHERE id = %s
            """,
            (cliente_id,),
        )
        return cur.fetchone()


def get_sucursal_by_id(conn, sucursal_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                activa
            FROM sucursales
            WHERE id = %s
            """,
            (sucursal_id,),
        )
        return cur.fetchone()


def get_variantes_by_ids(conn, ids):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.nombre_variante,
                v.precio_minorista,
                v.costo_promedio_vigente,
                v.id_producto,
                v.activo AS variante_activa,
                p.nombre AS producto_nombre,
                p.stockeable,
                p.serializable,
                p.tipo_item,
                p.activo AS producto_activo
            FROM variantes v
            INNER JOIN productos p
                ON p.id = v.id_producto
            WHERE v.id = ANY(%s)
            """,
            (ids,),
        )
        return cur.fetchall()


def get_stock_for_update(conn, id_sucursal, id_variante):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            FOR UPDATE
            """,
            (id_sucursal, id_variante),
        )
        return cur.fetchone()


def insert_venta(conn, data, subtotal, id_usuario):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ventas (
                id_sucursal,
                id_cliente,
                subtotal_base,
                total_final,
                saldo_pendiente,
                estado,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s, %s, 'creada', %s)
            RETURNING id
            """,
            (
                data.id_sucursal,
                data.id_cliente,
                subtotal,
                subtotal,
                subtotal,
                id_usuario,
            ),
        )
        return cur.fetchone()["id"]


def insert_venta_item(conn, venta_id, item, variante, subtotal):
    descripcion_snapshot = f"{variante['producto_nombre']} - {variante['nombre_variante']}"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO venta_items (
                id_venta,
                id_variante,
                descripcion_snapshot,
                cantidad,
                precio_lista,
                precio_final,
                costo_unitario_aplicado,
                subtotal
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                venta_id,
                variante["id"],
                descripcion_snapshot,
                item["cantidad"],
                variante["precio_minorista"],
                variante["precio_minorista"],
                variante["costo_promedio_vigente"],
                subtotal,
            ),
        )


def mover_a_vendido_pendiente_entrega(conn, stock_id, cantidad):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_vendido_pendiente_entrega = stock_vendido_pendiente_entrega + %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (cantidad, stock_id),
        )


def registrar_entrega_stock(conn, stock_id, cantidad):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = stock_fisico - %s,
                stock_vendido_pendiente_entrega = stock_vendido_pendiente_entrega - %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (cantidad, cantidad, stock_id),
        )


def liberar_vendido_pendiente_entrega(conn, stock_id, cantidad):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_vendido_pendiente_entrega = stock_vendido_pendiente_entrega - %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (cantidad, stock_id),
        )


def insert_movimiento_venta(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO movimientos_stock (
                id_sucursal,
                id_variante,
                tipo_movimiento,
                cantidad,
                costo_unitario_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, %s, 'venta', %s, %s, 'venta', %s, %s, %s)
            """,
            (
                data["id_sucursal"],
                data["id_variante"],
                data["cantidad"],
                data["costo_unitario_aplicado"],
                data["venta_id"],
                data.get("nota"),
                data["id_usuario"],
            ),
        )


def insert_movimiento_entrega(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO movimientos_stock (
                id_sucursal,
                id_variante,
                tipo_movimiento,
                cantidad,
                costo_unitario_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, %s, 'entrega', %s, %s, 'venta', %s, %s, %s)
            """,
            (
                data["id_sucursal"],
                data["id_variante"],
                data["cantidad"],
                data["costo_unitario_aplicado"],
                data["venta_id"],
                data.get("nota"),
                data["id_usuario"],
            ),
        )


def insert_movimiento_anulacion_venta(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO movimientos_stock (
                id_sucursal,
                id_variante,
                tipo_movimiento,
                cantidad,
                costo_unitario_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, %s, 'ajuste', %s, %s, 'venta', %s, %s, %s)
            """,
            (
                data["id_sucursal"],
                data["id_variante"],
                data["cantidad"],
                data["costo_unitario_aplicado"],
                data["venta_id"],
                data["nota"],
                data["id_usuario"],
            ),
        )


def get_ventas(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                v.id_sucursal,
                s.nombre AS sucursal_nombre,
                v.estado,
                v.total_final,
                v.saldo_pendiente
            FROM ventas v
            INNER JOIN clientes c
                ON c.id = v.id_cliente
            INNER JOIN sucursales s
                ON s.id = v.id_sucursal
            ORDER BY v.id DESC
            """
        )
        return cur.fetchall()


def get_venta_by_id(conn, venta_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                v.id_sucursal,
                s.nombre AS sucursal_nombre,
                v.estado,
                v.subtotal_base,
                v.descuento_total,
                v.recargo_total,
                v.total_final,
                v.saldo_pendiente
            FROM ventas v
            INNER JOIN clientes c
                ON c.id = v.id_cliente
            INNER JOIN sucursales s
                ON s.id = v.id_sucursal
            WHERE v.id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()


def get_venta_items_by_venta_id(conn, venta_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_venta,
                id_variante,
                id_bicicleta_serializada,
                descripcion_snapshot,
                cantidad,
                precio_lista,
                precio_final,
                costo_unitario_aplicado,
                subtotal
            FROM venta_items
            WHERE id_venta = %s
            ORDER BY id
            """,
            (venta_id,),
        )
        return cur.fetchall()


def get_venta_for_update(conn, venta_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                id_sucursal,
                estado,
                total_final,
                saldo_pendiente
            FROM ventas
            WHERE id = %s
            FOR UPDATE
            """,
            (venta_id,),
        )
        return cur.fetchone()


def update_venta_estado(conn, venta_id, nuevo_estado):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_estado, venta_id),
        )


def insert_venta_anulacion(conn, venta_id, motivo, id_usuario):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO venta_anulaciones (
                id_venta,
                motivo,
                id_usuario
            )
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (venta_id, motivo, id_usuario),
        )
        return cur.fetchone()["id"]