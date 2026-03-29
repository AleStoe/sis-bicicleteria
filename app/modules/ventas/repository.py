from psycopg.rows import dict_row


# =========================================================
# LOOKUPS / VALIDACIONES
# =========================================================

def get_cliente_by_id(conn, cliente_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
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
    with conn.cursor(row_factory=dict_row) as cur:
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
    with conn.cursor(row_factory=dict_row) as cur:
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


# =========================================================
# ESCRITURA
# =========================================================

def insert_venta(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ventas (
                id_sucursal,
                id_cliente,
                estado,
                subtotal_base,
                descuento_total,
                recargo_total,
                total_final,
                saldo_pendiente,
                id_usuario_creador,
                observaciones,
                id_reserva_origen
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_sucursal"],
                data["id_cliente"],
                data.get("estado", "creada"),
                data.get("subtotal_base", 0),
                data.get("descuento_total", 0),
                data.get("recargo_total", 0),
                data.get("total_final", 0),
                data.get("saldo_pendiente", 0),
                data["id_usuario_creador"],
                data.get("observaciones"),
                data.get("id_reserva_origen"),
            ),
        )
        return cur.fetchone()["id"]


def insert_venta_item(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO venta_items (
                id_venta,
                id_variante,
                id_bicicleta_serializada,
                descripcion_snapshot,
                cantidad,
                precio_lista,
                precio_final,
                costo_unitario_aplicado,
                subtotal
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_venta"],
                data["id_variante"],
                data.get("id_bicicleta_serializada"),
                data["descripcion_snapshot"],
                data["cantidad"],
                data["precio_lista"],
                data["precio_final"],
                data["costo_unitario_aplicado"],
                data["subtotal"],
            ),
        )
        return cur.fetchone()["id"]


def update_venta_totales_y_estado(
    conn,
    venta_id: int,
    subtotal_base,
    total_final,
    saldo_pendiente,
    estado: str,
    descuento_total=0,
    recargo_total=0,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET
                subtotal_base = %s,
                descuento_total = %s,
                recargo_total = %s,
                total_final = %s,
                saldo_pendiente = %s,
                estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                subtotal_base,
                descuento_total,
                recargo_total,
                total_final,
                saldo_pendiente,
                estado,
                venta_id,
            ),
        )


def update_venta_estado(conn, venta_id: int, nuevo_estado: str):
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


def update_venta_saldo_y_estado(conn, venta_id: int, saldo_pendiente, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET saldo_pendiente = %s,
                estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (saldo_pendiente, estado, venta_id),
        )


def insert_venta_anulacion(conn, venta_id: int, motivo: str, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
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


# =========================================================
# LECTURAS
# =========================================================

def get_ventas(conn):
    with conn.cursor(row_factory=dict_row) as cur:
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
                v.saldo_pendiente,
                v.id_reserva_origen
            FROM ventas v
            INNER JOIN clientes c
                ON c.id = v.id_cliente
            INNER JOIN sucursales s
                ON s.id = v.id_sucursal
            ORDER BY v.id DESC
            """
        )
        return cur.fetchall()


def get_venta_by_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
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
                v.saldo_pendiente,
                v.observaciones,
                v.id_reserva_origen
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


def get_venta_items_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
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

def get_venta_items_detallados_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                vi.id,
                vi.id_venta,
                vi.id_variante,
                vi.id_bicicleta_serializada,
                vi.descripcion_snapshot,
                vi.cantidad,
                vi.precio_lista,
                vi.precio_final,
                vi.costo_unitario_aplicado,
                vi.subtotal,
                v.id_producto,
                v.activo AS variante_activa,
                p.nombre AS producto_nombre,
                p.tipo_item,
                p.stockeable,
                p.serializable,
                p.activo AS producto_activo
            FROM venta_items vi
            INNER JOIN variantes v
                ON v.id = vi.id_variante
            INNER JOIN productos p
                ON p.id = v.id_producto
            WHERE vi.id_venta = %s
            ORDER BY vi.id
            """,
            (venta_id,),
        )
        return cur.fetchall()

def get_venta_for_update(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                id_sucursal,
                estado,
                total_final,
                saldo_pendiente,
                id_reserva_origen
            FROM ventas
            WHERE id = %s
            FOR UPDATE
            """,
            (venta_id,),
        )
        return cur.fetchone()

def insert_venta_devolucion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO venta_devoluciones (
                id_venta,
                id_venta_item,
                id_bicicleta_serializada,
                id_sucursal_reingreso,
                motivo,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_venta"],
                data["id_venta_item"],
                data["id_bicicleta_serializada"],
                data["id_sucursal_reingreso"],
                data["motivo"],
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]

def get_venta_devolucion_by_venta_item_id(conn, id_venta_item: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_venta,
                id_venta_item,
                id_bicicleta_serializada,
                id_sucursal_reingreso,
                fecha,
                motivo,
                id_usuario
            FROM venta_devoluciones
            WHERE id_venta_item = %s
            """,
            (id_venta_item,),
        )
        return cur.fetchone()