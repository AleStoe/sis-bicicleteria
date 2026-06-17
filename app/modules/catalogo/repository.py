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
                p.rodado,
                p.tipo_bicicleta,
                p.material_cuadro,
                c.id AS categoria_id,
                c.nombre AS categoria_nombre,
                p.id_marca,
                m.nombre AS marca_nombre
            FROM productos p
            INNER JOIN categorias c
                ON c.id = p.id_categoria
            LEFT JOIN marcas m
                ON m.id = p.id_marca
            ORDER BY p.nombre
        """)
        return cur.fetchall()


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
                v.talle,
                v.color,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
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
        return cur.fetchall()

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
    offset: int = 0,
):
    filtros = [
        "v.activo = TRUE",
        "p.activo = TRUE",
        "c.activo = TRUE",
        "p.tipo_item = 'producto'",
    ]

    params = {
        "id_sucursal": id_sucursal,
        "limit": limit,
        "offset": offset,
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
                OR v.codigo_proveedor ILIKE %(query)s
                OR m.nombre ILIKE %(query)s
                OR v.talle ILIKE %(query)s
                OR v.color ILIKE %(query)s
            )
        """)
        params["query"] = f"%{query.strip()}%"

    where_sql = " AND ".join(filtros)
    query_exacta = query.strip() if query else ""

    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT COUNT(*) AS total
            FROM variantes v
            INNER JOIN productos p
                ON p.id = v.id_producto
            INNER JOIN categorias c
                ON c.id = p.id_categoria
            LEFT JOIN marcas m
                ON m.id = p.id_marca
            WHERE {where_sql}
        """, params)

        total_row = cur.fetchone()
        total = total_row["total"]

        cur.execute(f"""
            SELECT
                v.id AS id_variante,
                v.id_producto,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.talle,
                v.color, 
                c.id AS categoria_id,
                c.nombre AS categoria_nombre,
                m.id AS id_marca,
                m.nombre AS marca_nombre,
                p.tipo_item,
                p.stockeable,
                p.serializable,
                v.precio_minorista,
                v.precio_mayorista,
                v.permite_precio_libre,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                v.proveedor_preferido_id,
                pr.nombre AS proveedor_preferido_nombre,
              

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
            LEFT JOIN marcas m
                ON m.id = p.id_marca
            LEFT JOIN proveedores pr
                ON pr.id = v.proveedor_preferido_id

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
                    WHEN %(query_exacta)s <> ''
                         AND v.codigo_proveedor = %(query_exacta)s THEN 2
                    ELSE 3
                END,
                c.nombre,
                m.nombre NULLS LAST,
                p.nombre,
                v.nombre_variante

            LIMIT %(limit)s
            OFFSET %(offset)s
        """, {
            **params,
            "query_exacta": query_exacta,
        })

        items = cur.fetchall()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }

def get_catalogo_pos_por_codigo(
    conn,
    id_sucursal: int,
    codigo: str,
):
    codigo = codigo.strip()

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                v.id AS id_variante,
                v.id_producto,
                v.talle,
                v.color,  
                p.nombre AS producto_nombre,
                v.nombre_variante,
                c.id AS categoria_id,
                c.nombre AS categoria_nombre,
                m.id AS id_marca,
                m.nombre AS marca_nombre,
                p.tipo_item,
                p.stockeable,
                p.serializable,
                v.precio_minorista,
                v.precio_mayorista,
                v.permite_precio_libre,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                v.proveedor_preferido_id,
                pr.nombre AS proveedor_preferido_nombre,

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
                         AND p.serializable = FALSE
                         AND (
                            COALESCE(ss.stock_fisico, 0)
                            - COALESCE(ss.stock_reservado, 0)
                            - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                         ) <= 0 THEN 'sin_stock'

                    WHEN v.permite_precio_libre = FALSE
                         AND COALESCE(v.precio_minorista, 0) <= 0 THEN 'precio_no_definido'

                    ELSE NULL
                END AS motivo_no_disponible

            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN marcas m ON m.id = p.id_marca
            LEFT JOIN proveedores pr ON pr.id = v.proveedor_preferido_id
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

            WHERE v.activo = TRUE
              AND p.activo = TRUE
              AND c.activo = TRUE
              AND p.tipo_item = 'producto'
              AND (
                v.codigo_barras = %(codigo)s
                OR v.sku = %(codigo)s
                OR v.codigo_proveedor = %(codigo)s
              )

            ORDER BY
                CASE
                    WHEN v.codigo_barras = %(codigo)s THEN 0
                    WHEN v.sku = %(codigo)s THEN 1
                    WHEN v.codigo_proveedor = %(codigo)s THEN 2
                    ELSE 3
                END

            LIMIT 1
        """, {
            "id_sucursal": id_sucursal,
            "codigo": codigo,
        })

        return cur.fetchone()

def get_categoria_by_id(conn, categoria_id: int):
    with conn.cursor() as cur:
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
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, nombre, activa
            FROM marcas
            WHERE id = %s
            """,
            (marca_id,),
        )
        return cur.fetchone()


def get_proveedor_by_id(conn, proveedor_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, nombre, activo
            FROM proveedores
            WHERE id = %s
            """,
            (proveedor_id,),
        )
        return cur.fetchone()


def get_producto_by_id(conn, producto_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                p.id,
                p.id_categoria,
                c.nombre AS categoria_nombre,
                p.id_marca,
                m.nombre AS marca_nombre,
                p.nombre,
                p.tipo_item,
                p.stockeable,
                p.serializable,
                p.rodado,
                p.tipo_bicicleta,
                p.material_cuadro,
                p.descripcion,
                p.activo
            FROM productos p
            INNER JOIN categorias c
                ON c.id = p.id_categoria
            LEFT JOIN marcas m
                ON m.id = p.id_marca
            WHERE p.id = %s
            """,
            (producto_id,),
        )
        return cur.fetchone()


def crear_producto_catalogo(conn, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO productos (
                id_categoria,
                id_marca,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                rodado,
                tipo_bicicleta,
                material_cuadro,
                activo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            RETURNING
                id,
                id_categoria,
                id_marca,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                rodado,
                tipo_bicicleta,
                material_cuadro,
                activo
            """,
            (
                data["id_categoria"],
                data.get("id_marca"),
                data["nombre"],
                data["tipo_item"],
                data["stockeable"],
                data["serializable"],
                data.get("rodado"),
                data.get("tipo_bicicleta"),
                data.get("material_cuadro"),
            ),
        )
        return cur.fetchone()


def crear_variante_catalogo(conn, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO variantes (
                id_producto,
                nombre_variante,
                talle,
                color,
                sku,
                codigo_barras,
                codigo_proveedor,
                proveedor_preferido_id,
                alicuota_iva,
                gravado,
                precio_minorista,
                precio_mayorista,
                permite_precio_libre,
                costo_promedio_vigente,
                activo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, TRUE)
            RETURNING
                id,
                id_producto,
                nombre_variante,
                talle,
                color,
                sku,
                codigo_barras,
                codigo_proveedor,
                proveedor_preferido_id,
                alicuota_iva,
                gravado,
                precio_minorista,
                precio_mayorista,
                permite_precio_libre,
                costo_promedio_vigente,
                activo
            """,
            (
                data["id_producto"],
                data["nombre_variante"],
                data.get("talle"),
                data.get("color"),
                data.get("sku"),
                data.get("codigo_barras"),
                data.get("codigo_proveedor"),
                data.get("proveedor_preferido_id"),
                data["alicuota_iva"],
                data["gravado"],
                data["precio_minorista"],
                data["precio_mayorista"],
                data["permite_precio_libre"],
            ),
        )
        return cur.fetchone()

def get_marcas(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, nombre, activa, created_at
            FROM marcas
            WHERE activa = TRUE
            ORDER BY nombre
            """
        )
        return cur.fetchall()


def crear_marca_catalogo(conn, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO marcas (nombre, activa)
            VALUES (%s, TRUE)
            RETURNING id, nombre, activa, created_at
            """,
            (data["nombre"],),
        )
        return cur.fetchone()

def update_producto_catalogo(conn, producto_id: int, data: dict):
    campos = []
    valores = {"producto_id": producto_id}

    for campo in [
        "id_categoria",
        "id_marca",
        "nombre",
        "tipo_item",
        "stockeable",
        "serializable",
        "rodado",
        "tipo_bicicleta",
        "material_cuadro",
    ]:
        if campo in data:
            campos.append(f"{campo} = %({campo})s")
            valores[campo] = data[campo]

    if not campos:
        return get_producto_by_id(conn, producto_id)

    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE productos
            SET {", ".join(campos)},
                updated_at = NOW()
            WHERE id = %(producto_id)s
            RETURNING
                id,
                id_categoria,
                id_marca,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                rodado,
                tipo_bicicleta,
                material_cuadro,
                activo
        """, valores)

        return cur.fetchone()


def update_producto_estado(conn, producto_id: int, activo: bool):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE productos
            SET activo = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING
                id,
                id_categoria,
                id_marca,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                rodado,
                tipo_bicicleta,
                material_cuadro,
                activo
        """, (activo, producto_id))

        return cur.fetchone()


def get_variante_by_id(conn, variante_id: int):
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
                v.talle,
                v.color,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
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
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN proveedores pr ON pr.id = v.proveedor_preferido_id

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

            WHERE v.id = %s
        """, (variante_id,))

        return cur.fetchone()


def update_variante_catalogo(conn, variante_id: int, data: dict):
    campos = []
    valores = {"variante_id": variante_id}

    for campo in [
        "nombre_variante",
        "talle",
        "color",
        "sku",
        "codigo_barras",
        "codigo_proveedor",
        "proveedor_preferido_id",
        "alicuota_iva",
        "gravado",
        "permite_precio_libre",
    ]:
        if campo in data:
            campos.append(f"{campo} = %({campo})s")
            valores[campo] = data[campo]

    if not campos:
        return get_variante_by_id(conn, variante_id)

    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE variantes
            SET {", ".join(campos)},
                updated_at = NOW()
            WHERE id = %(variante_id)s
            RETURNING id
        """, valores)

    return get_variante_by_id(conn, variante_id)


def update_variante_estado(conn, variante_id: int, activo: bool):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE variantes
            SET activo = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
        """, (activo, variante_id))

        row = cur.fetchone()

    if row is None:
        return None

    return get_variante_by_id(conn, variante_id)

def asignar_identidad_variante(conn, variante_id: int, sku: str, codigo_barras: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET sku = %s,
                codigo_barras = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING
                id,
                id_producto,
                nombre_variante,
                talle,
                color,
                sku,
                codigo_barras,
                codigo_proveedor,
                proveedor_preferido_id,
                alicuota_iva,
                gravado,
                precio_minorista,
                precio_mayorista,
                permite_precio_libre,
                costo_promedio_vigente,
                activo
            """,
            (sku, codigo_barras, variante_id),
        )
        return cur.fetchone()

def listar_ficha_tecnica_producto(conn, producto_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_producto,
                grupo,
                clave,
                valor,
                orden,
                activo
            FROM producto_ficha_tecnica
            WHERE id_producto = %s
              AND activo = TRUE
            ORDER BY grupo, orden, id
            """,
            (producto_id,),
        )
        return cur.fetchall()


def reemplazar_ficha_tecnica_producto(conn, producto_id: int, items: list[dict]):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE producto_ficha_tecnica
            SET activo = FALSE,
                updated_at = NOW()
            WHERE id_producto = %s
              AND activo = TRUE
            """,
            (producto_id,),
        )

        filas = []

        for item in items:
            cur.execute(
                """
                INSERT INTO producto_ficha_tecnica (
                    id_producto,
                    grupo,
                    clave,
                    valor,
                    orden,
                    activo
                )
                VALUES (%s, %s, %s, %s, %s, TRUE)
                RETURNING
                    id,
                    id_producto,
                    grupo,
                    clave,
                    valor,
                    orden,
                    activo
                """,
                (
                    producto_id,
                    item["grupo"],
                    item["clave"],
                    item["valor"],
                    item.get("orden", 0),
                ),
            )
            filas.append(cur.fetchone())

        return filas
    
def get_variante_activa_by_codigo_proveedor(conn, codigo_proveedor: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_producto,
                nombre_variante,
                codigo_proveedor,
                activo
            FROM variantes
            WHERE codigo_proveedor = %s
              AND activo = TRUE
            LIMIT 1
            """,
            (codigo_proveedor,),
        )
        return cur.fetchone()
