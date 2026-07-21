from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def insert_pedido(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pedidos_compra (
                id_proveedor,
                proveedor_nombre_snapshot,
                observaciones,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s)
            RETURNING *
            """,
            (
                data.get("id_proveedor"),
                data["proveedor_nombre"],
                data.get("observaciones"),
                data.get("id_usuario"),
            ),
        )
        return cur.fetchone()


def insert_pedido_item(conn, pedido_id: int, item: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pedido_compra_items (
                id_pedido,
                id_variante,
                producto_nombre_snapshot,
                variante_nombre_snapshot,
                sku_snapshot,
                codigo_proveedor_snapshot,
                stock_disponible_al_crear,
                cantidad_sugerida,
                cantidad_pedida,
                observacion
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                pedido_id,
                item.get("id_variante"),
                item["producto_nombre"],
                item.get("nombre_variante"),
                item.get("sku"),
                item.get("codigo_proveedor"),
                item.get("stock_disponible_al_crear") or 0,
                item.get("cantidad_sugerida") or 0,
                item["cantidad_pedida"],
                item.get("observacion"),
            ),
        )
        return cur.fetchone()


def insert_historial(conn, pedido_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pedido_compra_historial (
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


def list_pedidos(conn, estado: str | None = None, id_proveedor: int | None = None, limit: int = 100):
    where = []
    params = []
    if estado:
        where.append("p.estado = %s")
        params.append(estado)
    if id_proveedor:
        where.append("p.id_proveedor = %s")
        params.append(id_proveedor)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    params.append(limit)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                p.*,
                COUNT(i.id)::int AS total_items,
                COALESCE(SUM(i.cantidad_pedida), 0)::numeric(14,3) AS cantidad_total_pedida,
                COALESCE(SUM(i.cantidad_recibida), 0)::numeric(14,3) AS cantidad_total_recibida
            FROM pedidos_compra p
            LEFT JOIN pedido_compra_items i ON i.id_pedido = p.id
            {where_sql}
            GROUP BY p.id
            ORDER BY p.fecha_creacion DESC, p.id DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_pedido_for_update(conn, pedido_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM pedidos_compra
            WHERE id = %s
            FOR UPDATE
            """,
            (pedido_id,),
        )
        return cur.fetchone()


def get_pedido(conn, pedido_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                p.*,
                COUNT(i.id)::int AS total_items,
                COALESCE(SUM(i.cantidad_pedida), 0)::numeric(14,3) AS cantidad_total_pedida,
                COALESCE(SUM(i.cantidad_recibida), 0)::numeric(14,3) AS cantidad_total_recibida
            FROM pedidos_compra p
            LEFT JOIN pedido_compra_items i ON i.id_pedido = p.id
            WHERE p.id = %s
            GROUP BY p.id
            """,
            (pedido_id,),
        )
        return cur.fetchone()


def list_items(conn, pedido_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM pedido_compra_items
            WHERE id_pedido = %s
            ORDER BY id ASC
            """,
            (pedido_id,),
        )
        return cur.fetchall()


def get_item_for_update(conn, pedido_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM pedido_compra_items
            WHERE id_pedido = %s AND id = %s
            FOR UPDATE
            """,
            (pedido_id, item_id),
        )
        return cur.fetchone()


def sumar_cantidad_recibida_item(conn, item_id: int, cantidad):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE pedido_compra_items
            SET
                cantidad_recibida = cantidad_recibida + %s,
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (cantidad, item_id),
        )
        return cur.fetchone()


def list_historial(conn, pedido_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM pedido_compra_historial
            WHERE id_pedido = %s
            ORDER BY fecha DESC, id DESC
            """,
            (pedido_id,),
        )
        return cur.fetchall()


def pedido_totalmente_recibido(conn, pedido_id: int) -> bool:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT bool_and(cantidad_recibida >= cantidad_pedida) AS completo
            FROM pedido_compra_items
            WHERE id_pedido = %s
            """,
            (pedido_id,),
        )
        row = cur.fetchone()
        return bool(row and row["completo"])


def update_estado(conn, pedido_id: int, estado: str, observaciones: str | None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE pedidos_compra
            SET
                estado = %s,
                observaciones = COALESCE(%s, observaciones),
                fecha_envio = CASE
                    WHEN %s = 'enviado' AND fecha_envio IS NULL THEN now()
                    ELSE fecha_envio
                END,
                fecha_cierre = CASE
                    WHEN %s = 'cerrado' AND fecha_cierre IS NULL THEN now()
                    ELSE fecha_cierre
                END,
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (estado, observaciones, estado, estado, pedido_id),
        )
        return cur.fetchone()
