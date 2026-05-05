from psycopg.rows import dict_row


def get_variante_precio_by_id(conn, id_variante: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.id_producto,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                v.precio_minorista,
                v.precio_mayorista,
                v.costo_promedio_vigente,
                v.activo
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            """,
            (id_variante,),
        )
        return cur.fetchone()


def get_variante_precio_for_update(conn, id_variante: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                precio_minorista,
                precio_mayorista,
                costo_promedio_vigente,
                activo
            FROM variantes
            WHERE id = %s
            FOR UPDATE
            """,
            (id_variante,),
        )
        return cur.fetchone()


def update_variante_precios(conn, id_variante: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET precio_minorista = %s,
                precio_mayorista = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data["precio_minorista"],
                data["precio_mayorista"],
                id_variante,
            ),
        )


def insert_precio_movimiento(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO precios_movimientos (
                id_variante,
                precio_minorista_anterior,
                precio_minorista_nuevo,
                precio_mayorista_anterior,
                precio_mayorista_nuevo,
                costo_anterior,
                costo_nuevo,
                tipo_movimiento,
                motivo,
                origen_tipo,
                origen_id,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_variante"],
                data["precio_minorista_anterior"],
                data["precio_minorista_nuevo"],
                data["precio_mayorista_anterior"],
                data["precio_mayorista_nuevo"],
                data["costo_anterior"],
                data["costo_nuevo"],
                data["tipo_movimiento"],
                data.get("motivo"),
                data.get("origen_tipo"),
                data.get("origen_id"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def get_historial_precios_by_variante(conn, id_variante: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_variante,
                precio_minorista_anterior,
                precio_minorista_nuevo,
                precio_mayorista_anterior,
                precio_mayorista_nuevo,
                costo_anterior,
                costo_nuevo,
                tipo_movimiento,
                motivo,
                origen_tipo,
                origen_id,
                id_usuario,
                created_at
            FROM precios_movimientos
            WHERE id_variante = %s
            ORDER BY id DESC
            """,
            (id_variante,),
        )
        return cur.fetchall()