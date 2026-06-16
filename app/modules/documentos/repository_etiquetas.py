def get_variante_etiqueta_by_id(conn, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id AS id_variante,
                v.id_producto,
                v.nombre_variante,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                v.talle,
                v.color,
                v.precio_minorista,
                v.precio_mayorista,
                p.nombre AS producto_nombre,
                p.descripcion AS producto_descripcion,
                p.rodado,
                p.tipo_bicicleta,
                p.material_cuadro,
                p.serializable,
                c.nombre AS categoria_nombre,
                m.nombre AS marca_nombre,
                COALESCE(stock.stock_fisico_total, 0) AS stock_fisico_total,
                COALESCE(stock.stock_disponible_total, 0) AS stock_disponible_total,
                img.url AS imagen_principal
            FROM variantes v
            JOIN productos p ON p.id = v.id_producto
            JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN marcas m ON m.id = p.id_marca
            LEFT JOIN LATERAL (
                SELECT
                    SUM(ss.stock_fisico) AS stock_fisico_total,
                    SUM(
                        ss.stock_fisico
                        - ss.stock_reservado
                        - ss.stock_vendido_pendiente_entrega
                    ) AS stock_disponible_total
                FROM stock_sucursal ss
                WHERE ss.id_variante = v.id
            ) stock ON true
            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.activo = true
                  AND (
                    ci.id_variante = v.id
                    OR ci.id_producto = p.id
                  )
                ORDER BY
                    CASE WHEN ci.id_variante = v.id THEN 0 ELSE 1 END,
                    ci.es_principal DESC,
                    ci.orden ASC,
                    ci.id ASC
                LIMIT 1
            ) img ON true
            WHERE v.id = %s
            """,
            (variante_id,),
        )
        return cur.fetchone()


def get_bicicleta_etiqueta_by_id(conn, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                bs.id AS id_bicicleta,
                bs.numero_cuadro,
                bs.estado,
                bs.observaciones,
                bs.fecha_alta,
                bs.id_sucursal_actual,
                s.nombre AS sucursal_nombre,
                v.id AS id_variante,
                v.id_producto,
                v.nombre_variante,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                v.talle,
                v.color,
                v.precio_minorista,
                v.precio_mayorista,
                p.nombre AS producto_nombre,
                p.descripcion AS producto_descripcion,
                p.rodado,
                p.tipo_bicicleta,
                p.material_cuadro,
                c.nombre AS categoria_nombre,
                m.nombre AS marca_nombre,
                img.url AS imagen_principal
            FROM bicicletas_serializadas bs
            JOIN variantes v ON v.id = bs.id_variante
            JOIN productos p ON p.id = v.id_producto
            JOIN categorias c ON c.id = p.id_categoria
            JOIN sucursales s ON s.id = bs.id_sucursal_actual
            LEFT JOIN marcas m ON m.id = p.id_marca
            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.activo = true
                  AND (
                    ci.id_variante = v.id
                    OR ci.id_producto = p.id
                  )
                ORDER BY
                    CASE WHEN ci.id_variante = v.id THEN 0 ELSE 1 END,
                    ci.es_principal DESC,
                    ci.orden ASC,
                    ci.id ASC
                LIMIT 1
            ) img ON true
            WHERE bs.id = %s
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()
