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
                v.activo
            FROM variantes v
            INNER JOIN productos p
                ON p.id = v.id_producto
            LEFT JOIN proveedores pr
                ON pr.id = v.proveedor_preferido_id
            ORDER BY p.nombre, v.nombre_variante
        """)
        result = cur.fetchall()

    return result