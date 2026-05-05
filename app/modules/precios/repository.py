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

def get_categoria_by_id(conn, categoria_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, activo
            FROM categorias
            WHERE id = %s
            """,
            (categoria_id,),
        )
        return cur.fetchone()


def get_marca_by_id(conn, marca_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, activa
            FROM marcas
            WHERE id = %s
            """,
            (marca_id,),
        )
        return cur.fetchone()


def insert_regla_precio(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO reglas_precio (
                nombre,
                id_categoria,
                id_marca,
                tipo_cliente,
                margen_porcentaje,
                redondeo_base,
                activa
            )
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            RETURNING id
            """,
            (
                data["nombre"],
                data.get("id_categoria"),
                data.get("id_marca"),
                data["tipo_cliente"],
                data["margen_porcentaje"],
                data["redondeo_base"],
            ),
        )
        return cur.fetchone()["id"]


def get_reglas_precio(conn, solo_activas: bool = True):
    with conn.cursor(row_factory=dict_row) as cur:
        filtros = []
        params = []

        if solo_activas:
            filtros.append("rp.activa = TRUE")

        where_sql = f"WHERE {' AND '.join(filtros)}" if filtros else ""

        cur.execute(
            f"""
            SELECT
                rp.id,
                rp.nombre,
                rp.id_categoria,
                c.nombre AS categoria_nombre,
                rp.id_marca,
                m.nombre AS marca_nombre,
                rp.tipo_cliente,
                rp.margen_porcentaje,
                rp.redondeo_base,
                rp.activa,
                rp.created_at,
                rp.updated_at
            FROM reglas_precio rp
            LEFT JOIN categorias c ON c.id = rp.id_categoria
            LEFT JOIN marcas m ON m.id = rp.id_marca
            {where_sql}
            ORDER BY rp.activa DESC, rp.id DESC
            """,
            params,
        )
        return cur.fetchall()


def get_regla_precio_by_id(conn, regla_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                rp.id,
                rp.nombre,
                rp.id_categoria,
                c.nombre AS categoria_nombre,
                rp.id_marca,
                m.nombre AS marca_nombre,
                rp.tipo_cliente,
                rp.margen_porcentaje,
                rp.redondeo_base,
                rp.activa,
                rp.created_at,
                rp.updated_at
            FROM reglas_precio rp
            LEFT JOIN categorias c ON c.id = rp.id_categoria
            LEFT JOIN marcas m ON m.id = rp.id_marca
            WHERE rp.id = %s
            """,
            (regla_id,),
        )
        return cur.fetchone()


def update_regla_precio_estado(conn, regla_id: int, activa: bool):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE reglas_precio
            SET activa = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (activa, regla_id),
        )


def get_variante_contexto_precio(conn, id_variante: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.id_producto,
                v.nombre_variante,
                v.precio_minorista,
                v.precio_mayorista,
                v.costo_promedio_vigente,
                v.activo,
                p.nombre AS producto_nombre,
                p.id_categoria,
                p.id_marca
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            """,
            (id_variante,),
        )
        return cur.fetchone()


def buscar_regla_precio_aplicable(conn, data: dict):
    """
    Prioridad:
    1. categoría + marca
    2. marca
    3. categoría
    4. global
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                id_categoria,
                id_marca,
                tipo_cliente,
                margen_porcentaje,
                redondeo_base,
                activa,
                CASE
                    WHEN id_categoria = %(id_categoria)s AND id_marca = %(id_marca)s THEN 4
                    WHEN id_categoria IS NULL AND id_marca = %(id_marca)s THEN 3
                    WHEN id_categoria = %(id_categoria)s AND id_marca IS NULL THEN 2
                    WHEN id_categoria IS NULL AND id_marca IS NULL THEN 1
                    ELSE 0
                END AS prioridad
            FROM reglas_precio
            WHERE activa = TRUE
              AND tipo_cliente = %(tipo_cliente)s
              AND (
                    (id_categoria = %(id_categoria)s AND id_marca = %(id_marca)s)
                 OR (id_categoria IS NULL AND id_marca = %(id_marca)s)
                 OR (id_categoria = %(id_categoria)s AND id_marca IS NULL)
                 OR (id_categoria IS NULL AND id_marca IS NULL)
              )
            ORDER BY prioridad DESC, id DESC
            LIMIT 1
            """,
            data,
        )
        return cur.fetchone()
    
def get_variantes_contexto_precio(conn, filtros: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        where = ["v.activo = TRUE", "p.activo = TRUE"]
        params = {}

        if filtros.get("id_proveedor") is not None:
            where.append("v.proveedor_preferido_id = %(id_proveedor)s")
            params["id_proveedor"] = filtros["id_proveedor"]

        if filtros.get("id_categoria") is not None:
            where.append("p.id_categoria = %(id_categoria)s")
            params["id_categoria"] = filtros["id_categoria"]

        if filtros.get("id_marca") is not None:
            where.append("p.id_marca = %(id_marca)s")
            params["id_marca"] = filtros["id_marca"]

        where_sql = " AND ".join(where)

        cur.execute(
            f"""
            SELECT
                v.id,
                v.id_producto,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.precio_minorista,
                v.precio_mayorista,
                v.costo_promedio_vigente,
                v.proveedor_preferido_id,
                p.id_categoria,
                p.id_marca
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE {where_sql}
            ORDER BY p.nombre, v.nombre_variante
            """,
            params,
        )
        return cur.fetchall()