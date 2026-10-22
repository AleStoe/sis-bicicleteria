from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def get_cliente(conn, cliente_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre, dni, telefono, activo FROM clientes WHERE id = %s",
            (cliente_id,),
        )
        return cur.fetchone()


def get_sucursal(conn, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre, activa FROM sucursales WHERE id = %s",
            (sucursal_id,),
        )
        return cur.fetchone()


def get_venta(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, id_cliente, id_sucursal FROM ventas WHERE id = %s",
            (venta_id,),
        )
        return cur.fetchone()


def get_variante_para_pedido(conn, variante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id AS id_variante,
                v.id_producto,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                v.precio_minorista,
                v.precio_mayorista,
                v.activo AS variante_activa,
                p.activo AS producto_activo
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            """,
            (variante_id,),
        )
        return cur.fetchone()


def insert_pedido(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pedidos_cliente (
                id_cliente,
                id_sucursal,
                tipo_precio,
                observaciones,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["id_cliente"],
                data["id_sucursal"],
                data.get("tipo_precio") or "minorista",
                data.get("observaciones"),
                data.get("id_usuario"),
            ),
        )
        return cur.fetchone()


def get_pedido(conn, pedido_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                p.*,
                c.nombre AS cliente_nombre,
                c.dni AS cliente_dni,
                c.telefono AS cliente_telefono,
                s.nombre AS sucursal_nombre,
                COUNT(i.id)::int AS total_items,
                COALESCE(SUM(i.cantidad), 0)::numeric(14,3) AS cantidad_total,
                COALESCE(
                    SUM(
                        i.cantidad *
                        CASE
                            WHEN p.tipo_precio = 'mayorista' THEN COALESCE(i.precio_mayorista_snapshot, 0)
                            ELSE COALESCE(i.precio_minorista_snapshot, 0)
                        END
                    ),
                    0
                )::numeric(14,2) AS total_estimado
            FROM pedidos_cliente p
            INNER JOIN clientes c ON c.id = p.id_cliente
            INNER JOIN sucursales s ON s.id = p.id_sucursal
            LEFT JOIN pedido_cliente_items i ON i.id_pedido = p.id
            WHERE p.id = %s
            GROUP BY p.id, c.nombre, c.dni, c.telefono, s.nombre
            """,
            (pedido_id,),
        )
        return cur.fetchone()


def get_pedido_for_update(conn, pedido_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM pedidos_cliente
            WHERE id = %s
            FOR UPDATE
            """,
            (pedido_id,),
        )
        return cur.fetchone()


def list_pedidos(
    conn,
    *,
    estado: str | None = None,
    q: str | None = None,
    limit: int = 100,
):
    where = []
    params = []
    if estado:
        where.append("p.estado = %s")
        params.append(estado)
    if q:
        where.append(
            """
            (
                unaccent(lower(c.nombre)) LIKE unaccent(lower(%s))
                OR COALESCE(c.dni, '') ILIKE %s
                OR COALESCE(c.telefono, '') ILIKE %s
                OR p.id::text = %s
            )
            """
        )
        like = f"%{q}%"
        params.extend([like, like, like, q])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                p.*,
                c.nombre AS cliente_nombre,
                c.dni AS cliente_dni,
                c.telefono AS cliente_telefono,
                s.nombre AS sucursal_nombre,
                COUNT(i.id)::int AS total_items,
                COALESCE(SUM(i.cantidad), 0)::numeric(14,3) AS cantidad_total,
                COALESCE(
                    SUM(
                        i.cantidad *
                        CASE
                            WHEN p.tipo_precio = 'mayorista' THEN COALESCE(i.precio_mayorista_snapshot, 0)
                            ELSE COALESCE(i.precio_minorista_snapshot, 0)
                        END
                    ),
                    0
                )::numeric(14,2) AS total_estimado
            FROM pedidos_cliente p
            INNER JOIN clientes c ON c.id = p.id_cliente
            INNER JOIN sucursales s ON s.id = p.id_sucursal
            LEFT JOIN pedido_cliente_items i ON i.id_pedido = p.id
            {where_sql}
            GROUP BY p.id, c.nombre, c.dni, c.telefono, s.nombre
            ORDER BY p.fecha_creacion DESC, p.id DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def upsert_item(conn, pedido_id: int, variante: dict, cantidad):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pedido_cliente_items (
                id_pedido,
                id_variante,
                producto_nombre_snapshot,
                variante_nombre_snapshot,
                sku_snapshot,
                codigo_barras_snapshot,
                codigo_proveedor_snapshot,
                precio_minorista_snapshot,
                precio_mayorista_snapshot,
                cantidad
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_pedido, id_variante)
            DO UPDATE SET
                cantidad = pedido_cliente_items.cantidad + EXCLUDED.cantidad,
                updated_at = now()
            RETURNING *
            """,
            (
                pedido_id,
                variante["id_variante"],
                variante["producto_nombre"],
                variante.get("nombre_variante"),
                variante.get("sku"),
                variante.get("codigo_barras"),
                variante.get("codigo_proveedor"),
                variante.get("precio_minorista") or 0,
                variante.get("precio_mayorista") or 0,
                cantidad,
            ),
        )
        return cur.fetchone()


def get_item_for_update(conn, pedido_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM pedido_cliente_items
            WHERE id_pedido = %s AND id = %s
            FOR UPDATE
            """,
            (pedido_id, item_id),
        )
        return cur.fetchone()


def update_item_cantidad(conn, item_id: int, cantidad):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE pedido_cliente_items
            SET cantidad = %s, updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (cantidad, item_id),
        )
        return cur.fetchone()


def delete_item(conn, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("DELETE FROM pedido_cliente_items WHERE id = %s", (item_id,))


def list_items(conn, pedido_id: int, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                i.id,
                i.id_pedido,
                i.id_variante,
                v.id_producto,
                COALESCE(p.nombre, i.producto_nombre_snapshot) AS producto_nombre,
                COALESCE(v.nombre_variante, i.variante_nombre_snapshot) AS nombre_variante,
                c.nombre AS categoria_nombre,
                p.tipo_item,
                COALESCE(p.stockeable, TRUE) AS stockeable,
                COALESCE(p.serializable, FALSE) AS serializable,
                COALESCE(v.precio_minorista, i.precio_minorista_snapshot, 0) AS precio_minorista,
                COALESCE(v.precio_mayorista, i.precio_mayorista_snapshot, 0) AS precio_mayorista,
                COALESCE(v.permite_precio_libre, FALSE) AS permite_precio_libre,
                COALESCE(v.sku, i.sku_snapshot) AS sku,
                COALESCE(v.codigo_barras, i.codigo_barras_snapshot) AS codigo_barras,
                COALESCE(v.codigo_proveedor, i.codigo_proveedor_snapshot) AS codigo_proveedor,
                CASE
                    WHEN UPPER(TRIM(COALESCE(v.nombre_variante, ''))) IN ('UNICA', 'ÚNICA')
                        THEN COALESCE(img_prod.url, img_var.url)
                    ELSE COALESCE(img_var.url, img_prod.url)
                END AS imagen_principal,
                COALESCE(ss.stock_fisico, 0) AS stock_fisico,
                COALESCE(ss.stock_reservado, 0) AS stock_reservado,
                COALESCE(ss.stock_vendido_pendiente_entrega, 0) AS stock_vendido_pendiente_entrega,
                GREATEST(
                    COALESCE(ss.stock_fisico, 0)
                    - COALESCE(ss.stock_reservado, 0)
                    - COALESCE(ss.stock_vendido_pendiente_entrega, 0),
                    0
                ) AS stock_disponible,
                COALESCE(serializadas.serializadas_disponibles, 0) AS serializadas_disponibles,
                CASE
                    WHEN p.stockeable = TRUE
                         AND p.serializable = TRUE
                         AND COALESCE(serializadas.serializadas_disponibles, 0) <= 0
                         AND (
                            COALESCE(ss.stock_fisico, 0)
                            - COALESCE(ss.stock_reservado, 0)
                            - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                         ) <= 0 THEN FALSE
                    WHEN p.stockeable = TRUE
                         AND p.serializable = FALSE
                         AND (
                            COALESCE(ss.stock_fisico, 0)
                            - COALESCE(ss.stock_reservado, 0)
                            - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                         ) <= 0 THEN FALSE
                    WHEN v.permite_precio_libre = FALSE
                         AND COALESCE(v.precio_minorista, 0) <= 0 THEN FALSE
                    ELSE TRUE
                END AS disponible_para_venta,
                CASE
                    WHEN p.stockeable = TRUE
                         AND p.serializable = TRUE
                         AND COALESCE(serializadas.serializadas_disponibles, 0) <= 0
                         AND (
                            COALESCE(ss.stock_fisico, 0)
                            - COALESCE(ss.stock_reservado, 0)
                            - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                         ) <= 0 THEN 'sin_stock'
                    WHEN p.stockeable = TRUE
                         AND p.serializable = FALSE
                         AND (
                            COALESCE(ss.stock_fisico, 0)
                            - COALESCE(ss.stock_reservado, 0)
                            - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                         ) <= 0 THEN 'sin_stock'
                    WHEN v.permite_precio_libre = FALSE
                         AND COALESCE(v.precio_minorista, 0) <= 0 THEN 'precio_no_definido'
                    ELSE NULL
                END AS motivo_no_disponible,
                (oferta.id IS NOT NULL) AS en_oferta,
                oferta.id AS oferta_id,
                oferta.nombre AS oferta_nombre,
                oferta.precio_oferta,
                oferta.alcance AS oferta_alcance,
                oferta.politica_contado AS oferta_politica_contado,
                oferta.fecha_desde AS oferta_fecha_desde,
                oferta.fecha_hasta AS oferta_fecha_hasta,
                i.cantidad,
                i.created_at,
                i.updated_at
            FROM pedido_cliente_items i
            INNER JOIN variantes v ON v.id = i.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN stock_sucursal ss
                ON ss.id_variante = v.id
               AND ss.id_sucursal = %s
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS serializadas_disponibles
                FROM bicicletas_serializadas bs
                WHERE bs.id_variante = v.id
                  AND bs.id_sucursal_actual = %s
                  AND bs.estado = 'disponible'
                  AND bs.estado_tecnico = 'lista'
            ) serializadas ON TRUE
            LEFT JOIN LATERAL (
                SELECT o.id, o.nombre, o.precio_oferta, o.fecha_desde, o.fecha_hasta,
                       o.alcance, o.politica_contado
                FROM ofertas o
                WHERE o.id_variante = v.id
                  AND o.alcance = 'variante'
                  AND o.activa = TRUE
                  AND CURRENT_DATE BETWEEN o.fecha_desde AND o.fecha_hasta
                ORDER BY o.fecha_desde DESC, o.id DESC
                LIMIT 1
            ) oferta ON TRUE
            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_producto = p.id AND ci.id_variante IS NULL
                ORDER BY ci.es_principal DESC, ci.orden ASC, ci.id ASC
                LIMIT 1
            ) img_prod ON TRUE
            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_variante = v.id
                ORDER BY ci.es_principal DESC, ci.orden ASC, ci.id ASC
                LIMIT 1
            ) img_var ON TRUE
            WHERE i.id_pedido = %s
            ORDER BY i.id ASC
            """,
            (sucursal_id, sucursal_id, pedido_id),
        )
        return cur.fetchall()


def insert_historial(conn, pedido_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pedido_cliente_historial (
                id_pedido,
                accion,
                estado_anterior,
                estado_nuevo,
                detalle,
                metadata,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                pedido_id,
                data["accion"],
                data.get("estado_anterior"),
                data.get("estado_nuevo"),
                data.get("detalle"),
                Jsonb(data.get("metadata") or {}),
                data.get("id_usuario"),
            ),
        )
        return cur.fetchone()


def list_historial(conn, pedido_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM pedido_cliente_historial
            WHERE id_pedido = %s
            ORDER BY fecha DESC, id DESC
            """,
            (pedido_id,),
        )
        return cur.fetchall()


def update_estado_cancelado(conn, pedido_id: int, motivo: str | None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE pedidos_cliente
            SET
                estado = 'cancelado',
                fecha_cancelacion = now(),
                observaciones = COALESCE(%s, observaciones),
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (motivo, pedido_id),
        )
        return cur.fetchone()


def update_estado_convertido(conn, pedido_id: int, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE pedidos_cliente
            SET
                estado = 'convertido_a_venta',
                id_venta_generada = %s,
                fecha_conversion = now(),
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (venta_id, pedido_id),
        )
        return cur.fetchone()
