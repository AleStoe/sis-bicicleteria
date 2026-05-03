from app.db.connection import get_connection


def get_categorias(conn):

    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, nombre
            FROM categorias
            WHERE activo = TRUE
            ORDER BY nombre
        """)
        result = cur.fetchall()

    return result


def get_productos(conn):

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                p.id,
                p.nombre,
                p.tipo_item,
                p.stockeable,
                p.serializable,
                p.activo,
                c.id AS categoria_id,
                c.nombre AS categoria_nombre
            FROM productos p
            INNER JOIN categorias c
                ON c.id = p.id_categoria
            ORDER BY p.nombre
        """)
        result = cur.fetchall()

    return result


def get_variantes(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                v.id,
                v.id_producto,
                p.nombre AS producto_nombre,
                p.tipo_item,
                p.stockeable,
                p.serializable,
                c.id AS categoria_id,
                c.nombre AS categoria_nombre,
                v.nombre_variante,
                v.sku,
                v.codigo_barras,
                v.proveedor_preferido_id,
                pr.nombre AS proveedor_preferido_nombre,
                v.alicuota_iva,
                v.gravado,
                v.precio_minorista,
                v.precio_mayorista,
                v.permite_precio_libre,
                v.costo_promedio_vigente,
                v.activo,
                COALESCE(img_var.url, img_prod.url) AS imagen_principal
            FROM variantes v
            INNER JOIN productos p
                ON p.id = v.id_producto
            INNER JOIN categorias c
                ON c.id = p.id_categoria
            LEFT JOIN proveedores pr
                ON pr.id = v.proveedor_preferido_id

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_variante = v.id
                  AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.orden ASC, ci.id ASC
                LIMIT 1
            ) img_var ON TRUE

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_producto = p.id
                  AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.orden ASC, ci.id ASC
                LIMIT 1
            ) img_prod ON TRUE

            ORDER BY p.nombre, v.nombre_variante
        """)
        result = cur.fetchall()

    return result

def crear_imagen_catalogo(conn, data):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO catalogo_imagenes (
                id_producto,
                id_variante,
                url,
                es_principal,
                orden,
                activo
            )
            VALUES (
                %(id_producto)s,
                %(id_variante)s,
                %(url)s,
                %(es_principal)s,
                %(orden)s,
                TRUE
            )
            RETURNING
                id,
                id_producto,
                id_variante,
                url,
                es_principal,
                orden,
                activo
        """, data)

        return cur.fetchone()


def listar_imagenes_producto(conn, id_producto: int):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                id,
                id_producto,
                id_variante,
                url,
                es_principal,
                orden,
                activo
            FROM catalogo_imagenes
            WHERE id_producto = %s
              AND activo = TRUE
            ORDER BY es_principal DESC, orden ASC, id ASC
        """, (id_producto,))

        return cur.fetchall()


def listar_imagenes_variante(conn, id_variante: int):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                id,
                id_producto,
                id_variante,
                url,
                es_principal,
                orden,
                activo
            FROM catalogo_imagenes
            WHERE id_variante = %s
              AND activo = TRUE
            ORDER BY es_principal DESC, orden ASC, id ASC
        """, (id_variante,))

        return cur.fetchall()


def obtener_imagen_catalogo(conn, imagen_id: int):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                id,
                id_producto,
                id_variante,
                url,
                es_principal,
                orden,
                activo
            FROM catalogo_imagenes
            WHERE id = %s
        """, (imagen_id,))

        return cur.fetchone()


def actualizar_imagen_catalogo(conn, imagen_id: int, data):
    campos = []
    valores = {}

    for campo in ["url", "es_principal", "orden", "activo"]:
        if campo in data and data[campo] is not None:
            campos.append(f"{campo} = %({campo})s")
            valores[campo] = data[campo]

    if not campos:
        return obtener_imagen_catalogo(conn, imagen_id)

    valores["imagen_id"] = imagen_id

    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE catalogo_imagenes
            SET {", ".join(campos)}
            WHERE id = %(imagen_id)s
            RETURNING
                id,
                id_producto,
                id_variante,
                url,
                es_principal,
                orden,
                activo
        """, valores)

        return cur.fetchone()


def desactivar_imagen_catalogo(conn, imagen_id: int):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE catalogo_imagenes
            SET activo = FALSE
            WHERE id = %s
            RETURNING
                id,
                id_producto,
                id_variante,
                url,
                es_principal,
                orden,
                activo
        """, (imagen_id,))

        return cur.fetchone()

def get_catalogo_pos(
    conn,
    id_sucursal: int,
    query: str | None = None,
    categoria_id: int | None = None,
    limit: int = 50,
):
    filtros = [
        "v.activo = TRUE",
        "p.activo = TRUE",
        "c.activo = TRUE",
    ]

    params = {
        "id_sucursal": id_sucursal,
        "limit": limit,
    }

    if categoria_id is not None:
        filtros.append("c.id = %(categoria_id)s")
        params["categoria_id"] = categoria_id

    if query:
        filtros.append("""
            (
                p.nombre ILIKE %(query)s
                OR v.nombre_variante ILIKE %(query)s
                OR v.sku ILIKE %(query)s
                OR v.codigo_barras ILIKE %(query)s
            )
        """)
        params["query"] = f"%{query.strip()}%"

    where_sql = " AND ".join(filtros)
    query_exacta = query.strip() if query else ""

    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT
                v.id AS id_variante,
                v.id_producto,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                c.id AS categoria_id,
                c.nombre AS categoria_nombre,
                p.tipo_item,
                p.stockeable,
                p.serializable,
                v.precio_minorista,
                v.precio_mayorista,
                v.permite_precio_libre,
                v.sku,
                v.codigo_barras,

                COALESCE(img_var.url, img_prod.url) AS imagen_principal,

                v.activo,

                COALESCE(ss.stock_fisico, 0) AS stock_fisico,
                COALESCE(ss.stock_reservado, 0) AS stock_reservado,
                COALESCE(ss.stock_vendido_pendiente_entrega, 0) AS stock_vendido_pendiente_entrega,

                GREATEST(
                    COALESCE(ss.stock_fisico, 0)
                    - COALESCE(ss.stock_reservado, 0)
                    - COALESCE(ss.stock_vendido_pendiente_entrega, 0),
                    0
                ) AS stock_disponible,

                CASE
                    WHEN p.stockeable = TRUE AND (
                        COALESCE(ss.stock_fisico, 0)
                        - COALESCE(ss.stock_reservado, 0)
                        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    ) <= 0 THEN FALSE

                    WHEN v.permite_precio_libre = FALSE
                         AND COALESCE(v.precio_minorista, 0) <= 0 THEN FALSE

                    ELSE TRUE
                END AS disponible_para_venta,

                CASE
                    WHEN p.stockeable = TRUE AND (
                        COALESCE(ss.stock_fisico, 0)
                        - COALESCE(ss.stock_reservado, 0)
                        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    ) <= 0 THEN 'sin_stock'

                    WHEN v.permite_precio_libre = FALSE
                         AND COALESCE(v.precio_minorista, 0) <= 0 THEN 'precio_no_definido'

                    ELSE NULL
                END AS motivo_no_disponible

            FROM variantes v
            INNER JOIN productos p
                ON p.id = v.id_producto
            INNER JOIN categorias c
                ON c.id = p.id_categoria

            LEFT JOIN stock_sucursal ss
                ON ss.id_variante = v.id
               AND ss.id_sucursal = %(id_sucursal)s

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_variante = v.id
                  AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.orden ASC, ci.id ASC
                LIMIT 1
            ) img_var ON TRUE

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_producto = p.id
                  AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.orden ASC, ci.id ASC
                LIMIT 1
            ) img_prod ON TRUE

            WHERE {where_sql}

            ORDER BY
                CASE
                    WHEN %(query_exacta)s <> ''
                         AND v.codigo_barras = %(query_exacta)s THEN 0
                    WHEN %(query_exacta)s <> ''
                         AND v.sku = %(query_exacta)s THEN 1
                    ELSE 2
                END,
                c.nombre,
                p.nombre,
                v.nombre_variante

            LIMIT %(limit)s
        """, {
            **params,
            "query_exacta": query_exacta,
        })

        return cur.fetchall()