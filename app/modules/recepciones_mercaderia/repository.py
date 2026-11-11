from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def get_proveedor(conn, proveedor_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre, activo FROM proveedores WHERE id = %s",
            (proveedor_id,),
        )
        return cur.fetchone()


def get_sucursal(conn, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre, activa FROM sucursales WHERE id = %s",
            (sucursal_id,),
        )
        return cur.fetchone()


def buscar_variantes_por_codigo(conn, codigo: str, proveedor_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.proveedor_preferido_id,
                v.codigo_proveedor,
                v.codigo_barras,
                v.costo_promedio_vigente,
                v.nombre_variante,
                p.nombre AS producto_nombre,
                EXISTS (
                    SELECT 1
                    FROM proveedor_producto_codigos ppc
                    WHERE ppc.id_variante = v.id
                      AND ppc.id_proveedor = %s
                      AND (
                          UPPER(TRIM(ppc.codigo_proveedor)) = UPPER(TRIM(%s))
                          OR NULLIF(LTRIM(UPPER(TRIM(ppc.codigo_proveedor)), '0'), '') =
                             NULLIF(LTRIM(UPPER(TRIM(%s)), '0'), '')
                      )
                      AND ppc.activo = TRUE
                ) AS codigo_proveedor_vinculado
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE (
                    UPPER(TRIM(v.codigo_proveedor)) = UPPER(TRIM(%s))
                    OR NULLIF(LTRIM(UPPER(TRIM(v.codigo_proveedor)), '0'), '') =
                       NULLIF(LTRIM(UPPER(TRIM(%s)), '0'), '')
                    OR EXISTS (
                        SELECT 1
                        FROM proveedor_producto_codigos ppc
                        WHERE ppc.id_variante = v.id
                          AND ppc.id_proveedor = %s
                          AND (
                              UPPER(TRIM(ppc.codigo_proveedor)) = UPPER(TRIM(%s))
                              OR NULLIF(LTRIM(UPPER(TRIM(ppc.codigo_proveedor)), '0'), '') =
                                 NULLIF(LTRIM(UPPER(TRIM(%s)), '0'), '')
                          )
                          AND ppc.activo = TRUE
                    )
                )
              AND v.activo = TRUE
              AND p.activo = TRUE
            ORDER BY
                CASE WHEN UPPER(TRIM(v.codigo_proveedor)) = UPPER(TRIM(%s)) THEN 0 ELSE 1 END,
                CASE WHEN v.proveedor_preferido_id = %s THEN 0 ELSE 1 END,
                v.id
            """,
            (
                proveedor_id, codigo, codigo,
                codigo, codigo,
                proveedor_id, codigo, codigo,
                codigo, proveedor_id,
            ),
        )
        return cur.fetchall()


def buscar_variante_por_ean(conn, codigo: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT v.id, v.id_producto, v.nombre_variante,
                   v.proveedor_preferido_id, p.nombre AS producto_nombre
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.codigo_barras = %s
              AND v.activo = TRUE
              AND p.activo = TRUE
            ORDER BY v.id
            """,
            (codigo,),
        )
        return cur.fetchall()


def list_memorias_clasificacion(conn, *, limit: int = 500):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT m.*, c.nombre AS categoria_nombre, ma.nombre AS marca_nombre
            FROM recepcion_clasificaciones_memoria m
            LEFT JOIN categorias c ON c.id = m.id_categoria
            LEFT JOIN marcas ma ON ma.id = m.id_marca
            ORDER BY m.confirmaciones DESC, m.updated_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def list_reglas_clasificacion_aceptadas(conn, proveedor_id: int, *, limit: int = 200):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, titulo, motivo, payload, ocurrencias
            FROM recepcion_sugerencias_regla
            WHERE estado = 'aceptada'
              AND tipo = 'clasificacion'
              AND (id_proveedor IS NULL OR id_proveedor = %s)
            ORDER BY ocurrencias DESC, id DESC
            LIMIT %s
            """,
            (proveedor_id, limit),
        )
        return cur.fetchall()


def list_catalogo_candidatos(conn, *, limit: int = 1200):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT v.id AS id_variante, p.nombre AS producto_nombre,
                   v.nombre_variante, p.rubro, p.id_categoria, p.id_marca,
                   p.subtipo_catalogo, m.nombre AS marca_nombre
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            LEFT JOIN marcas m ON m.id = p.id_marca
            WHERE v.activo = TRUE AND p.activo = TRUE
            ORDER BY v.updated_at DESC, v.id DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def get_catalogo_referencia(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, nombre FROM categorias WHERE activo = TRUE ORDER BY nombre")
        categorias = cur.fetchall()
        cur.execute("SELECT id, nombre FROM marcas WHERE activa = TRUE ORDER BY nombre")
        marcas = cur.fetchall()
        cur.execute("SELECT nombre FROM catalogo_rubros WHERE activo = TRUE ORDER BY orden, nombre")
        rubros = [row["nombre"] for row in cur.fetchall()]
    return {"categorias": categorias, "marcas": marcas, "rubros": rubros}


def insert_recepcion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO recepciones_mercaderia (
                id_proveedor,
                proveedor_nombre_snapshot,
                id_sucursal,
                estado,
                origen_carga,
                texto_origen,
                observaciones,
                total_lineas,
                total_unidades,
                total_costo,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["id_proveedor"],
                data["proveedor_nombre_snapshot"],
                data["id_sucursal"],
                data["estado"],
                data["origen_carga"],
                data["texto_origen"],
                data.get("observaciones"),
                data["total_lineas"],
                data["total_unidades"],
                data["total_costo"],
                data.get("id_usuario"),
            ),
        )
        return cur.fetchone()


def insert_item(conn, recepcion_id: int, item: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO recepcion_mercaderia_items (
                id_recepcion,
                numero_linea,
                linea_original,
                codigo_proveedor,
                descripcion_original,
                descripcion_normalizada,
                cantidad,
                costo_unitario,
                costo_total,
                total_linea_documental,
                estado_resolucion,
                id_variante,
                mensaje_revision,
                nombre_propuesto,
                nombre_variante_propuesta,
                rubro_propuesto,
                id_categoria_propuesta,
                id_marca_propuesta,
                subtipo_propuesto,
                sku_propuesto,
                confianza_sugerencia,
                descuento_linea_pct,
                origen_extraccion,
                confianza_codigo,
                confianza_descripcion,
                confianza_cantidad,
                confianza_costo,
                lectura_confirmada
                , origen_resolucion
                , id_memoria_clasificacion
                , posible_duplicado
                , duplicado_candidatos
                , variacion_costo_pct
                , alerta_costo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                recepcion_id,
                item["numero_linea"],
                item["linea_original"],
                item.get("codigo_proveedor"),
                item.get("descripcion_original"),
                item.get("descripcion_normalizada"),
                item.get("cantidad"),
                item.get("costo_unitario"),
                item.get("costo_total"),
                item.get("total_linea_documental"),
                item["estado_resolucion"],
                item.get("id_variante"),
                item.get("mensaje_revision"),
                item.get("nombre_propuesto"),
                item.get("nombre_variante_propuesta"),
                item.get("rubro_propuesto"),
                item.get("id_categoria_propuesta"),
                item.get("id_marca_propuesta"),
                item.get("subtipo_propuesto"),
                item.get("sku_propuesto"),
                item.get("confianza_sugerencia"),
                item.get("descuento_linea_pct", 0),
                item.get("origen_extraccion", "estructurado"),
                item.get("confianza_codigo"),
                item.get("confianza_descripcion"),
                item.get("confianza_cantidad"),
                item.get("confianza_costo"),
                item.get("lectura_confirmada", True),
                item.get("origen_resolucion", "reglas"),
                item.get("id_memoria_clasificacion"),
                item.get("posible_duplicado", False),
                Jsonb(item.get("duplicado_candidatos") or []),
                item.get("variacion_costo_pct"),
                item.get("alerta_costo"),
            ),
        )
        return cur.fetchone()


def get_documento_by_hash(conn, sha256: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT d.*, r.id AS recepcion_id
            FROM recepcion_documentos d
            INNER JOIN recepciones_mercaderia r ON r.id = d.id_recepcion
            WHERE d.sha256 = %s
            """,
            (sha256,),
        )
        return cur.fetchone()


def insert_documento(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO recepcion_documentos (
                id_recepcion,
                nombre_original,
                nombre_guardado,
                ruta_relativa,
                mime_type,
                extension,
                tamano_bytes,
                sha256,
                estado,
                extractor,
                texto_extraido,
                metadata_extraida,
                error_extraccion,
                tipo_documento,
                numero_documento
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["id_recepcion"],
                data["nombre_original"],
                data["nombre_guardado"],
                data["ruta_relativa"],
                data.get("mime_type"),
                data["extension"],
                data["tamano_bytes"],
                data["sha256"],
                data["estado"],
                data.get("extractor"),
                data.get("texto_extraido"),
                Jsonb(data.get("metadata_extraida") or {}),
                data.get("error_extraccion"),
                data.get("tipo_documento", "documento"),
                data.get("numero_documento"),
            ),
        )
        return cur.fetchone()


def list_documentos(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, id_recepcion, nombre_original, mime_type, extension,
                   tamano_bytes, sha256, estado, extractor, metadata_extraida,
                   error_extraccion, tipo_documento, numero_documento,
                   procesado_at, cantidad_reprocesos, created_at
            FROM recepcion_documentos
            WHERE id_recepcion = %s
            ORDER BY created_at, id
            """,
            (recepcion_id,),
        )
        return cur.fetchall()


def get_documento(conn, documento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT d.*, r.estado AS recepcion_estado, r.id_proveedor, r.id_sucursal,
                   r.id_usuario_creador
            FROM recepcion_documentos d
            INNER JOIN recepciones_mercaderia r ON r.id = d.id_recepcion
            WHERE d.id = %s
            """,
            (documento_id,),
        )
        return cur.fetchone()


def eliminar_documento(conn, recepcion_id: int, documento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            DELETE FROM recepcion_documentos
            WHERE id = %s AND id_recepcion = %s
            RETURNING *
            """,
            (documento_id, recepcion_id),
        )
        return cur.fetchone()


def actualizar_documento_extraido(conn, documento_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepcion_documentos
            SET estado = %s,
                extractor = %s,
                texto_extraido = %s,
                metadata_extraida = %s,
                error_extraccion = %s,
                tipo_documento = %s,
                numero_documento = %s,
                procesado_at = NOW(),
                cantidad_reprocesos = cantidad_reprocesos + 1
            WHERE id = %s
            RETURNING *
            """,
            (
                data["estado"],
                data.get("extractor"),
                data.get("texto_extraido"),
                Jsonb(data.get("metadata_extraida") or {}),
                data.get("error_extraccion"),
                data.get("tipo_documento", "documento"),
                data.get("numero_documento"),
                documento_id,
            ),
        )
        return cur.fetchone()


def recalcular_cabecera(conn, recepcion_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepciones_mercaderia r
            SET total_lineas = datos.total_lineas,
                total_unidades = datos.total_unidades,
                total_costo = datos.total_costo,
                estado = CASE
                    WHEN datos.total_lineas = 0 THEN 'requiere_revision'
                    ELSE r.estado
                END,
                updated_at = NOW()
            FROM (
                SELECT COUNT(*)::int AS total_lineas,
                       COALESCE(SUM(cantidad), 0) AS total_unidades,
                       COALESCE(SUM(costo_total), 0) AS total_costo
                FROM recepcion_mercaderia_items
                WHERE id_recepcion = %s
            ) datos
            WHERE r.id = %s
            """,
            (recepcion_id, recepcion_id),
        )


def marcar_requiere_revision(conn, recepcion_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepciones_mercaderia
            SET estado = 'requiere_revision', updated_at = NOW()
            WHERE id = %s AND estado NOT IN ('confirmada', 'anulada')
            """,
            (recepcion_id,),
        )


def siguiente_numero_linea(conn, recepcion_id: int) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT COALESCE(MAX(numero_linea), 0) + 1 AS numero FROM recepcion_mercaderia_items WHERE id_recepcion = %s",
            (recepcion_id,),
        )
        return cur.fetchone()["numero"]


def actualizar_lectura_item(conn, item_id: int, item: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET linea_original = %s,
                codigo_proveedor = %s,
                descripcion_original = %s,
                descripcion_normalizada = %s,
                cantidad = %s,
                costo_unitario = %s,
                costo_total = %s,
                total_linea_documental = NULL,
                descuento_linea_pct = %s,
                estado_resolucion = %s,
                id_variante = %s,
                mensaje_revision = %s,
                nombre_propuesto = %s,
                nombre_variante_propuesta = %s,
                rubro_propuesto = %s,
                id_categoria_propuesta = %s,
                id_marca_propuesta = %s,
                subtipo_propuesto = %s,
                sku_propuesto = %s,
                confianza_sugerencia = %s,
                origen_extraccion = %s,
                origen_resolucion = %s,
                id_memoria_clasificacion = %s,
                posible_duplicado = %s,
                duplicado_candidatos = %s,
                variacion_costo_pct = %s,
                alerta_costo = %s,
                confianza_codigo = 1,
                confianza_descripcion = 1,
                confianza_cantidad = 1,
                confianza_costo = 1,
                lectura_confirmada = TRUE,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                item["linea_original"], item["codigo_proveedor"], item["descripcion_original"],
                item["descripcion_normalizada"], item["cantidad"], item["costo_unitario"],
                item["costo_total"], item.get("descuento_linea_pct", 0), item["estado_resolucion"],
                item.get("id_variante"), item.get("mensaje_revision"), item.get("nombre_propuesto"),
                item.get("nombre_variante_propuesta"), item.get("rubro_propuesto"),
                item.get("id_categoria_propuesta"), item.get("id_marca_propuesta"),
                item.get("subtipo_propuesto"), item.get("sku_propuesto"),
                item.get("confianza_sugerencia"), item.get("origen_extraccion", "manual"),
                item.get("origen_resolucion", "manual"), item.get("id_memoria_clasificacion"),
                item.get("posible_duplicado", False), Jsonb(item.get("duplicado_candidatos") or []),
                item.get("variacion_costo_pct"), item.get("alerta_costo"), item_id,
            ),
        )


def invalidar_costos(conn, recepcion_id: int):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM recepcion_mercaderia_costos WHERE id_recepcion = %s", (recepcion_id,))
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET importe_bruto = NULL,
                descuento_linea_monto = NULL,
                base_prorrateo = NULL,
                prorrateo_descuento_global = NULL,
                prorrateo_bonificacion_factura = NULL,
                prorrateo_nota_credito = NULL,
                nota_credito_linea_monto = 0,
                prorrateo_gastos = NULL,
                costo_total_calculado = NULL,
                costo_unitario_calculado = NULL,
                precio_revisado = FALSE,
                precio_revisado_at = NULL,
                alerta_precio = NULL
            WHERE id_recepcion = %s
            """,
            (recepcion_id,),
        )


def get_contexto_precio_item(conn, recepcion_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                i.*,
                r.id_proveedor,
                r.id_sucursal,
                r.estado AS recepcion_estado,
                v.precio_minorista AS precio_minorista_actual,
                v.precio_mayorista AS precio_mayorista_actual,
                COALESCE(v.costo_reposicion, v.costo_promedio_vigente) AS costo_anterior,
                v.permite_precio_libre,
                COALESCE(p.id_categoria, i.id_categoria_propuesta) AS id_categoria_precio,
                COALESCE(p.id_marca, i.id_marca_propuesta) AS id_marca_precio,
                p.id_familia_precio,
                COALESCE(p.rubro, i.rubro_propuesto) AS rubro_precio,
                COALESCE(ss.stock_fisico, 0) AS stock_fisico_actual,
                oferta.oferta_snapshot
            FROM recepcion_mercaderia_items i
            INNER JOIN recepciones_mercaderia r ON r.id = i.id_recepcion
            LEFT JOIN variantes v ON v.id = i.id_variante
            LEFT JOIN productos p ON p.id = v.id_producto
            LEFT JOIN stock_sucursal ss
              ON ss.id_sucursal = r.id_sucursal AND ss.id_variante = v.id
            LEFT JOIN LATERAL (
                SELECT jsonb_build_object(
                    'id', o.id,
                    'nombre', o.nombre,
                    'precio_regular_referencia', o.precio_regular_referencia,
                    'precio_oferta', o.precio_oferta,
                    'politica_contado', o.politica_contado,
                    'fecha_desde', o.fecha_desde,
                    'fecha_hasta', o.fecha_hasta
                ) AS oferta_snapshot
                FROM ofertas o
                WHERE o.id_variante = v.id
                  AND o.activa = TRUE
                  AND o.alcance = 'variante'
                  AND CURRENT_DATE BETWEEN o.fecha_desde AND o.fecha_hasta
                ORDER BY o.fecha_desde DESC, o.id DESC
                LIMIT 1
            ) oferta ON TRUE
            WHERE i.id_recepcion = %s AND i.id = %s
            """,
            (recepcion_id, item_id),
        )
        return cur.fetchone()


def guardar_preview_precio_item(conn, item_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET estrategia_precio = %(estrategia_precio)s,
                costo_anterior_snapshot = %(costo_anterior_snapshot)s,
                precio_minorista_anterior_snapshot = %(precio_minorista_anterior_snapshot)s,
                precio_mayorista_anterior_snapshot = %(precio_mayorista_anterior_snapshot)s,
                precio_minorista_propuesto = %(precio_minorista_propuesto)s,
                precio_mayorista_propuesto = %(precio_mayorista_propuesto)s,
                margen_minorista_anterior_pct = %(margen_minorista_anterior_pct)s,
                margen_mayorista_anterior_pct = %(margen_mayorista_anterior_pct)s,
                margen_minorista_resultante_pct = %(margen_minorista_resultante_pct)s,
                margen_mayorista_resultante_pct = %(margen_mayorista_resultante_pct)s,
                id_regla_minorista = %(id_regla_minorista)s,
                id_regla_mayorista = %(id_regla_mayorista)s,
                regla_minorista_snapshot = %(regla_minorista_snapshot)s,
                regla_mayorista_snapshot = %(regla_mayorista_snapshot)s,
                alerta_precio = %(alerta_precio)s,
                precio_revisado = TRUE,
                precio_revisado_at = NOW(),
                id_usuario_precio = %(id_usuario_precio)s,
                updated_at = NOW()
            WHERE id = %(item_id)s
            """,
            {**data, "item_id": item_id},
        )


def list_recepciones(conn, *, estado: str | None = None, limit: int = 100):
    where_sql = "WHERE r.estado = %s" if estado else ""
    params = [estado, limit] if estado else [limit]
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                r.*,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'exacta')::int AS exactas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'sugerida')::int AS sugeridas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'nueva')::int AS nuevas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'alta_preparada')::int AS altas_preparadas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'conflicto')::int AS conflictos,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'incompleta')::int AS incompletas
            FROM recepciones_mercaderia r
            LEFT JOIN recepcion_mercaderia_items i ON i.id_recepcion = r.id
            {where_sql}
            GROUP BY r.id
            ORDER BY r.updated_at DESC, r.id DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def get_recepcion(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                r.*,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'exacta')::int AS exactas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'sugerida')::int AS sugeridas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'nueva')::int AS nuevas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'alta_preparada')::int AS altas_preparadas,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'conflicto')::int AS conflictos,
                COUNT(i.id) FILTER (WHERE i.estado_resolucion = 'incompleta')::int AS incompletas
            FROM recepciones_mercaderia r
            LEFT JOIN recepcion_mercaderia_items i ON i.id_recepcion = r.id
            WHERE r.id = %s
            GROUP BY r.id
            """,
            (recepcion_id,),
        )
        return cur.fetchone()


def list_items(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                i.*,
                p.nombre AS producto_nombre,
                v.nombre_variante AS variante_nombre,
                cp.nombre AS categoria_propuesta_nombre,
                mp.nombre AS marca_propuesta_nombre
            FROM recepcion_mercaderia_items i
            LEFT JOIN variantes v ON v.id = COALESCE(i.id_variante_confirmada, i.id_variante)
            LEFT JOIN productos p ON p.id = v.id_producto
            LEFT JOIN categorias cp ON cp.id = i.id_categoria_propuesta
            LEFT JOIN marcas mp ON mp.id = i.id_marca_propuesta
            WHERE i.id_recepcion = %s
            ORDER BY i.numero_linea, i.id
            """,
            (recepcion_id,),
        )
        return cur.fetchall()


def get_costos(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM recepcion_mercaderia_costos WHERE id_recepcion = %s",
            (recepcion_id,),
        )
        return cur.fetchone()


def get_recepcion_editable(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, id_sucursal, id_usuario_creador, estado FROM recepciones_mercaderia WHERE id = %s",
            (recepcion_id,),
        )
        return cur.fetchone()


def get_item(conn, recepcion_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT i.*, r.estado AS recepcion_estado, r.id_sucursal, r.id_proveedor,
                   r.id_usuario_creador
            FROM recepcion_mercaderia_items i
            INNER JOIN recepciones_mercaderia r ON r.id = i.id_recepcion
            WHERE i.id = %s AND i.id_recepcion = %s
            """,
            (item_id, recepcion_id),
        )
        return cur.fetchone()


def get_categoria_activa(conn, categoria_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, nombre FROM categorias WHERE id = %s AND activo = TRUE", (categoria_id,))
        return cur.fetchone()


def get_marca_activa(conn, marca_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, nombre FROM marcas WHERE id = %s AND activa = TRUE", (marca_id,))
        return cur.fetchone()


def get_rubro_activo(conn, nombre: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre FROM catalogo_rubros WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(%s)) AND activo = TRUE",
            (nombre,),
        )
        return cur.fetchone()


def get_variante_activa(conn, variante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT v.id, v.id_producto, v.nombre_variante, p.nombre AS producto_nombre,
                   v.precio_minorista, v.precio_mayorista, v.costo_promedio_vigente,
                   v.permite_precio_libre, p.rubro, p.id_categoria, p.id_marca,
                   p.subtipo_catalogo
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s AND v.activo = TRUE AND p.activo = TRUE
            """,
            (variante_id,),
        )
        return cur.fetchone()


def preparar_alta_item(conn, item_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET nombre_propuesto = %s,
                nombre_variante_propuesta = %s,
                rubro_propuesto = %s,
                id_categoria_propuesta = %s,
                id_marca_propuesta = %s,
                subtipo_propuesto = %s,
                precio_minorista_propuesto = %s,
                precio_mayorista_propuesto = %s,
                serializable_propuesto = %s,
                sku_propuesto = COALESCE(sku_propuesto, 'AUTOMATICO'),
                confianza_sugerencia = 'confirmada',
                estado_resolucion = 'alta_preparada',
                lectura_confirmada = TRUE,
                id_variante = NULL,
                mensaje_revision = NULL,
                posible_duplicado = FALSE,
                duplicado_candidatos = '[]'::jsonb,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data["nombre_propuesto"],
                data["nombre_variante_propuesta"],
                data["rubro_propuesto"],
                data["id_categoria_propuesta"],
                data.get("id_marca_propuesta"),
                data["subtipo_propuesto"],
                data.get("precio_minorista_propuesto"),
                data.get("precio_mayorista_propuesto"),
                data.get("serializable_propuesto", False),
                item_id,
            ),
        )


def guardar_imagen_item(conn, item_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET imagen_ruta_relativa = %s,
                imagen_nombre_original = %s,
                imagen_mime_type = %s,
                imagen_tamano_bytes = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (
                data["imagen_ruta_relativa"],
                data["imagen_nombre_original"],
                data["imagen_mime_type"],
                data["imagen_tamano_bytes"],
                item_id,
            ),
        )
        return cur.fetchone()


def quitar_imagen_item(conn, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET imagen_ruta_relativa = NULL,
                imagen_nombre_original = NULL,
                imagen_mime_type = NULL,
                imagen_tamano_bytes = NULL,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (item_id,),
        )
        return cur.fetchone()


def vincular_item(conn, item_id: int, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET id_variante = %s,
                estado_resolucion = 'exacta',
                origen_resolucion = 'manual',
                lectura_confirmada = TRUE,
                mensaje_revision = NULL,
                posible_duplicado = FALSE,
                duplicado_candidatos = '[]'::jsonb,
                updated_at = NOW()
            WHERE id = %s
            """,
            (variante_id, item_id),
        )


def guardar_codigo_proveedor(conn, proveedor_id: int, codigo: str, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedor_producto_codigos (
                id_proveedor,
                codigo_proveedor,
                id_variante,
                activo
            )
            VALUES (%s, %s, %s, TRUE)
            ON CONFLICT (id_proveedor, UPPER(TRIM(codigo_proveedor)))
            DO UPDATE SET
                id_variante = EXCLUDED.id_variante,
                activo = TRUE,
                updated_at = NOW()
            """,
            (proveedor_id, codigo, variante_id),
        )


def actualizar_estado_recepcion(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepciones_mercaderia r
            SET estado = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM recepcion_mercaderia_items i
                        WHERE i.id_recepcion = r.id
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM recepcion_mercaderia_items i
                        WHERE i.id_recepcion = r.id
                          AND (
                              i.lectura_confirmada = FALSE
                              OR i.estado_resolucion NOT IN ('exacta', 'alta_preparada')
                              OR (
                                  i.estado_resolucion = 'alta_preparada'
                                  AND (
                                      COALESCE(i.precio_minorista_propuesto, 0) <= 0
                                      OR COALESCE(i.precio_mayorista_propuesto, 0) <= 0
                                  )
                              )
                          )
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM recepcion_mercaderia_costos c
                        WHERE c.id_recepcion = r.id
                          AND (c.total_documental IS NULL OR c.conciliado = FALSE)
                    ) THEN 'lista_para_confirmar'
                    ELSE 'requiere_revision'
                END,
                updated_at = NOW()
            WHERE r.id = %s
            RETURNING estado
            """,
            (recepcion_id,),
        )
        return cur.fetchone()


def eliminar_item(conn, recepcion_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            DELETE FROM recepcion_mercaderia_items
            WHERE id = %s AND id_recepcion = %s
            RETURNING *
            """,
            (item_id, recepcion_id),
        )
        return cur.fetchone()


def eliminar_items_recepcion(conn, recepcion_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM recepcion_mercaderia_items WHERE id_recepcion = %s",
            (recepcion_id,),
        )
        return cur.rowcount


def anular_recepcion(conn, recepcion_id: int, *, motivo: str, usuario_id: int | None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepciones_mercaderia
            SET estado = 'anulada',
                anulada_at = NOW(),
                id_usuario_anulador = %s,
                motivo_anulacion = %s,
                updated_at = NOW()
            WHERE id = %s AND estado NOT IN ('confirmada', 'anulada')
            RETURNING *
            """,
            (usuario_id, motivo, recepcion_id),
        )
        return cur.fetchone()


def clasificar_items_masivamente(conn, recepcion_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET rubro_propuesto = %s,
                id_categoria_propuesta = %s,
                id_marca_propuesta = %s,
                subtipo_propuesto = %s,
                origen_resolucion = 'manual',
                confianza_sugerencia = 'confirmada',
                estado_resolucion = CASE
                    WHEN estado_resolucion IN ('conflicto', 'incompleta') THEN 'nueva'
                    ELSE estado_resolucion
                END,
                mensaje_revision = 'Clasificación aplicada en bloque. Revisá nombre y precios antes de preparar el alta.',
                updated_at = NOW()
            WHERE id_recepcion = %s
              AND id = ANY(%s)
              AND estado_resolucion IN ('nueva', 'alta_preparada', 'conflicto', 'incompleta')
            RETURNING id
            """,
            (
                data["rubro_propuesto"], data["id_categoria_propuesta"],
                data.get("id_marca_propuesta"), data["subtipo_propuesto"],
                recepcion_id, data["ids_items"],
            ),
        )
        return [row["id"] for row in cur.fetchall()]


def guardar_costos(conn, recepcion_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO recepcion_mercaderia_costos (
                id_recepcion,
                descuento_global_pct,
                bonificacion_factura,
                nota_credito,
                nota_credito_modo,
                flete,
                iva_factura,
                otros_gastos,
                impuestos_no_recuperables,
                total_documental,
                subtotal_bruto,
                descuento_lineas_total,
                descuento_global_monto,
                total_calculado,
                diferencia_conciliacion,
                conciliado
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_recepcion)
            DO UPDATE SET
                descuento_global_pct = EXCLUDED.descuento_global_pct,
                bonificacion_factura = EXCLUDED.bonificacion_factura,
                nota_credito = EXCLUDED.nota_credito,
                nota_credito_modo = EXCLUDED.nota_credito_modo,
                flete = EXCLUDED.flete,
                iva_factura = EXCLUDED.iva_factura,
                otros_gastos = EXCLUDED.otros_gastos,
                impuestos_no_recuperables = EXCLUDED.impuestos_no_recuperables,
                total_documental = EXCLUDED.total_documental,
                subtotal_bruto = EXCLUDED.subtotal_bruto,
                descuento_lineas_total = EXCLUDED.descuento_lineas_total,
                descuento_global_monto = EXCLUDED.descuento_global_monto,
                total_calculado = EXCLUDED.total_calculado,
                diferencia_conciliacion = EXCLUDED.diferencia_conciliacion,
                conciliado = EXCLUDED.conciliado,
                updated_at = NOW()
            RETURNING *
            """,
            (
                recepcion_id,
                data["descuento_global_pct"],
                data["bonificacion_factura"],
                data["nota_credito"],
                data["nota_credito_modo"],
                data["flete"],
                data["iva_factura"],
                data["otros_gastos"],
                data["impuestos_no_recuperables"],
                data.get("total_documental"),
                data["subtotal_bruto"],
                data["descuento_lineas_total"],
                data["descuento_global_monto"],
                data["total_calculado"],
                data.get("diferencia_conciliacion"),
                data["conciliado"],
            ),
        )
        return cur.fetchone()


def guardar_costos_item(conn, item_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET descuento_linea_pct = %s,
                nota_credito_linea_monto = %s,
                importe_bruto = %s,
                descuento_linea_monto = %s,
                base_prorrateo = %s,
                prorrateo_descuento_global = %s,
                prorrateo_bonificacion_factura = %s,
                prorrateo_nota_credito = %s,
                prorrateo_gastos = %s,
                costo_total_calculado = %s,
                costo_unitario_calculado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data["descuento_linea_pct"],
                data["nota_credito_linea_monto"],
                data["importe_bruto"],
                data["descuento_linea_monto"],
                data["base_prorrateo"],
                data["prorrateo_descuento_global"],
                data["prorrateo_bonificacion_factura"],
                data["prorrateo_nota_credito"],
                data["prorrateo_gastos"],
                data["costo_total_calculado"],
                data["costo_unitario_calculado"],
                item_id,
            ),
        )


def actualizar_alerta_costo_item(conn, item_id: int, variacion, alerta):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET variacion_costo_pct = %s, alerta_costo = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (variacion, alerta, item_id),
        )


def actualizar_total_costo(conn, recepcion_id: int, total: object):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE recepciones_mercaderia SET total_costo = %s, updated_at = NOW() WHERE id = %s",
            (total, recepcion_id),
        )


def bloquear_recepcion(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM recepciones_mercaderia WHERE id = %s FOR UPDATE",
            (recepcion_id,),
        )
        return cur.fetchone()


def guardar_resultado_confirmacion_item(
    conn,
    item_id: int,
    *,
    producto_id: int,
    variante_id: int,
    ingreso_id: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET id_producto_confirmado = %s,
                id_variante_confirmada = %s,
                id_ingreso_stock = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (producto_id, variante_id, ingreso_id, item_id),
        )


def marcar_confirmada(conn, recepcion_id: int, usuario_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepciones_mercaderia
            SET estado = 'confirmada',
                confirmada_at = NOW(),
                id_usuario_confirmador = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (usuario_id, recepcion_id),
        )
        return cur.fetchone()


def deshacer_coincidencia_item(conn, item_id: int, propuesta: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET estado_resolucion = 'nueva',
                id_variante = NULL,
                origen_resolucion = 'manual',
                mensaje_revision = %s,
                nombre_propuesto = %s,
                nombre_variante_propuesta = %s,
                rubro_propuesto = %s,
                id_categoria_propuesta = %s,
                id_marca_propuesta = %s,
                subtipo_propuesto = %s,
                confianza_sugerencia = %s,
                id_memoria_clasificacion = %s,
                posible_duplicado = %s,
                duplicado_candidatos = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                propuesta.get("mensaje_revision"), propuesta.get("nombre_propuesto"),
                propuesta.get("nombre_variante_propuesta"), propuesta.get("rubro_propuesto"),
                propuesta.get("id_categoria_propuesta"), propuesta.get("id_marca_propuesta"),
                propuesta.get("subtipo_propuesto"), propuesta.get("confianza_sugerencia"),
                propuesta.get("id_memoria_clasificacion"),
                propuesta.get("posible_duplicado", False),
                Jsonb(propuesta.get("duplicado_candidatos") or []), item_id,
            ),
        )


def incrementar_correcciones(conn, recepcion_id: int, *, rechazo: bool = False, cantidad: int = 1):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepciones_mercaderia
            SET total_correcciones = total_correcciones + %s,
                coincidencias_rechazadas = coincidencias_rechazadas + %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (cantidad, cantidad if rechazo else 0, recepcion_id),
        )


def recalcular_metricas_aprendizaje(conn, recepcion_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepciones_mercaderia r
            SET coincidencias_automaticas = x.automaticas,
                coincidencias_sugeridas = x.sugeridas,
                duplicados_detectados = x.duplicados,
                alertas_costo = x.alertas_costo
            FROM (
                SELECT
                    COUNT(*) FILTER (WHERE origen_resolucion IN ('codigo_proveedor', 'ean'))::int AS automaticas,
                    COUNT(*) FILTER (WHERE origen_resolucion IN ('codigo_otro_proveedor', 'memoria_sugerida', 'descripcion_sugerida'))::int AS sugeridas,
                    COUNT(*) FILTER (WHERE posible_duplicado)::int AS duplicados,
                    COUNT(*) FILTER (WHERE alerta_costo IS NOT NULL)::int AS alertas_costo
                FROM recepcion_mercaderia_items
                WHERE id_recepcion = %s
            ) x
            WHERE r.id = %s
            """,
            (recepcion_id, recepcion_id),
        )


def get_aprendizaje_recepcion(conn, recepcion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT total_correcciones, coincidencias_automaticas,
                   coincidencias_sugeridas, coincidencias_rechazadas,
                   duplicados_detectados, alertas_costo,
                   EXTRACT(EPOCH FROM (COALESCE(confirmada_at, NOW()) - procesamiento_iniciado_at))::int AS duracion_segundos
            FROM recepciones_mercaderia
            WHERE id = %s
            """,
            (recepcion_id,),
        )
        aprendizaje = cur.fetchone()
        if aprendizaje is None:
            return None
        cur.execute(
            """
            SELECT id, tipo, titulo, motivo, payload, estado, ocurrencias, created_at
            FROM recepcion_sugerencias_regla
            WHERE estado = 'pendiente'
              AND (id_proveedor IS NULL OR id_proveedor = (
                    SELECT id_proveedor FROM recepciones_mercaderia WHERE id = %s
              ))
            ORDER BY ocurrencias DESC, id DESC
            LIMIT 10
            """,
            (recepcion_id,),
        )
        return {**dict(aprendizaje), "sugerencias_regla": cur.fetchall()}


def get_sugerencia_regla(conn, sugerencia_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM recepcion_sugerencias_regla WHERE id = %s",
            (sugerencia_id,),
        )
        return cur.fetchone()


def resolver_sugerencia_regla(conn, sugerencia_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE recepcion_sugerencias_regla
            SET estado = %s,
                nota_resolucion = %s,
                id_usuario_resolutor = %s,
                resuelta_at = NOW(),
                updated_at = NOW()
            WHERE id = %s AND estado = 'pendiente'
            RETURNING *
            """,
            (data["decision"], data.get("nota"), data.get("id_usuario"), sugerencia_id),
        )
        return cur.fetchone()


def registrar_formato_proveedor(conn, data: dict):
    confianza = data.get("confianza_promedio")
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recepcion_formatos_proveedor (
                id_proveedor, tipo_documento, extension, extractor,
                documentos_procesados, documentos_con_error, confianza_promedio
            ) VALUES (%s, %s, %s, %s, 1, %s, %s)
            ON CONFLICT (id_proveedor, tipo_documento, extension, extractor)
            DO UPDATE SET
                documentos_procesados = recepcion_formatos_proveedor.documentos_procesados + 1,
                documentos_con_error = recepcion_formatos_proveedor.documentos_con_error + EXCLUDED.documentos_con_error,
                confianza_promedio = CASE
                    WHEN EXCLUDED.confianza_promedio IS NULL THEN recepcion_formatos_proveedor.confianza_promedio
                    WHEN recepcion_formatos_proveedor.confianza_promedio IS NULL THEN EXCLUDED.confianza_promedio
                    ELSE ((recepcion_formatos_proveedor.confianza_promedio * recepcion_formatos_proveedor.documentos_procesados) + EXCLUDED.confianza_promedio)
                         / (recepcion_formatos_proveedor.documentos_procesados + 1)
                END,
                ultimo_documento_at = NOW(),
                updated_at = NOW()
            """,
            (
                data["id_proveedor"], data.get("tipo_documento") or "documento",
                data["extension"], data.get("extractor") or "desconocido",
                1 if data.get("estado") == "error" else 0, confianza,
            ),
        )


def incrementar_correccion_formato(conn, proveedor_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_formatos_proveedor
            SET correcciones_manuales = correcciones_manuales + 1, updated_at = NOW()
            WHERE id_proveedor = %s
              AND id = (
                  SELECT id FROM recepcion_formatos_proveedor
                  WHERE id_proveedor = %s
                  ORDER BY ultimo_documento_at DESC LIMIT 1
              )
            """,
            (proveedor_id, proveedor_id),
        )


def guardar_memoria_clasificacion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO recepcion_clasificaciones_memoria (
                id_proveedor, descripcion_normalizada, id_variante,
                rubro, id_categoria, id_marca, subtipo,
                confirmaciones, ultima_recepcion_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 1, %s)
            ON CONFLICT (id_proveedor, descripcion_normalizada)
            DO UPDATE SET
                id_variante = EXCLUDED.id_variante,
                rubro = EXCLUDED.rubro,
                id_categoria = EXCLUDED.id_categoria,
                id_marca = EXCLUDED.id_marca,
                subtipo = EXCLUDED.subtipo,
                confirmaciones = recepcion_clasificaciones_memoria.confirmaciones + 1,
                ultima_recepcion_id = EXCLUDED.ultima_recepcion_id,
                updated_at = NOW()
            RETURNING *
            """,
            (
                data.get("id_proveedor"), data["descripcion_normalizada"],
                data.get("id_variante"), data.get("rubro"), data.get("id_categoria"),
                data.get("id_marca"), data.get("subtipo"), data.get("ultima_recepcion_id"),
            ),
        )
        return cur.fetchone()


def guardar_sugerencia_regla(conn, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recepcion_sugerencias_regla (
                id_proveedor, tipo, titulo, motivo, payload, ocurrencias
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_proveedor, tipo, titulo)
            DO UPDATE SET
                motivo = EXCLUDED.motivo,
                payload = EXCLUDED.payload,
                ocurrencias = GREATEST(recepcion_sugerencias_regla.ocurrencias, EXCLUDED.ocurrencias),
                updated_at = NOW()
            """,
            (
                data.get("id_proveedor"), data["tipo"], data["titulo"], data["motivo"],
                Jsonb(data.get("payload") or {}), data.get("ocurrencias", 1),
            ),
        )
