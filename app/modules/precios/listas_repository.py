from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def get_proveedor_activo(conn, proveedor_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre, activo FROM proveedores WHERE id = %s",
            (proveedor_id,),
        )
        return cur.fetchone()


def get_documento_by_hash(conn, sha256: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT d.*, l.estado AS lote_estado
            FROM precio_lista_documentos d
            INNER JOIN precio_lista_lotes l ON l.id = d.id_lote
            WHERE d.sha256 = %s
            """,
            (sha256,),
        )
        return cur.fetchone()


def insert_lote(conn, data: dict) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO precio_lista_lotes (
                id_proveedor, proveedor_nombre_snapshot, estado, nombre_archivo,
                formato, hoja_detectada, fila_encabezado_detectada,
                delimitador_detectado, codificacion_detectada, encabezados,
                mapeo_detectado, total_filas, observaciones, id_usuario_creador
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                data["id_proveedor"],
                data["proveedor_nombre_snapshot"],
                data["estado"],
                data["nombre_archivo"],
                data["formato"],
                data.get("hoja_detectada"),
                data.get("fila_encabezado_detectada"),
                data.get("delimitador_detectado"),
                data.get("codificacion_detectada"),
                Jsonb(data.get("encabezados") or []),
                Jsonb(data.get("mapeo_detectado") or {}),
                data["total_filas"],
                data.get("observaciones"),
                data.get("id_usuario_creador"),
            ),
        )
        return cur.fetchone()["id"]


def insert_documento(conn, data: dict) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO precio_lista_documentos (
                id_lote, nombre_original, nombre_guardado, ruta_relativa,
                mime_type, extension, tamano_bytes, sha256, extractor,
                metadata_lectura
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_lote"],
                data["nombre_original"],
                data["nombre_guardado"],
                data["ruta_relativa"],
                data.get("mime_type"),
                data["extension"],
                data["tamano_bytes"],
                data["sha256"],
                data["extractor"],
                Jsonb(data.get("metadata_lectura") or {}),
            ),
        )
        return cur.fetchone()["id"]


def insert_items(conn, lote_id: int, items: list[dict]):
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO precio_lista_items (
                id_lote, numero_fila, valores_originales, linea_original,
                codigo_original, descripcion_original, costo_original,
                cantidad_original, moneda_original, estado
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    lote_id,
                    item["numero_fila"],
                    Jsonb(item["valores_originales"]),
                    item.get("linea_original"),
                    item.get("codigo_original"),
                    item.get("descripcion_original"),
                    item.get("costo_original"),
                    item.get("cantidad_original"),
                    item.get("moneda_original"),
                    item["estado"],
                )
                for item in items
            ],
        )


def get_lote(conn, lote_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT l.*, p.nombre AS proveedor_nombre,
                   d.id AS documento_id, d.nombre_original AS documento_nombre,
                   d.ruta_relativa AS documento_ruta, d.mime_type,
                   d.extension, d.tamano_bytes, d.sha256, d.extractor,
                   d.metadata_lectura
            FROM precio_lista_lotes l
            INNER JOIN proveedores p ON p.id = l.id_proveedor
            LEFT JOIN precio_lista_documentos d ON d.id_lote = l.id
            WHERE l.id = %s
            """,
            (lote_id,),
        )
        return cur.fetchone()


def get_lote_items(conn, lote_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT i.*,
                   p.nombre AS variante_producto_nombre,
                   v.nombre_variante AS variante_nombre,
                   v.sku AS variante_sku,
                   v.codigo_barras AS variante_ean
            FROM precio_lista_items i
            LEFT JOIN variantes v ON v.id = i.id_variante
            LEFT JOIN productos p ON p.id = v.id_producto
            WHERE i.id_lote = %s
            ORDER BY i.numero_fila, i.id
            """,
            (lote_id,),
        )
        return cur.fetchall()


def list_catalogo_coincidencias(conn, proveedor_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT v.id AS id_variante, v.sku, v.codigo_barras, v.codigo_proveedor,
                   v.proveedor_preferido_id, v.nombre_variante,
                   p.nombre AS producto_nombre,
                   COALESCE(
                       ARRAY_AGG(DISTINCT ppc.codigo_proveedor)
                           FILTER (WHERE ppc.id IS NOT NULL AND ppc.activo = TRUE),
                       ARRAY[]::VARCHAR[]
                   ) AS aliases,
                   COALESCE(
                       ARRAY_AGG(DISTINCT ppc.codigo_proveedor)
                           FILTER (
                               WHERE ppc.id IS NOT NULL
                                 AND ppc.activo = TRUE
                                 AND ppc.id_proveedor = %s
                           ),
                       ARRAY[]::VARCHAR[]
                   ) AS aliases_proveedor
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            LEFT JOIN proveedor_producto_codigos ppc ON ppc.id_variante = v.id
            WHERE v.activo = TRUE AND p.activo = TRUE
            GROUP BY v.id, p.nombre
            ORDER BY v.id
            """,
            (proveedor_id,),
        )
        return cur.fetchall()


def update_item_coincidencia(conn, item_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE precio_lista_items
            SET codigo_normalizado = %s,
                estado_coincidencia = %s,
                id_variante = %s,
                origen_coincidencia = %s,
                confianza_coincidencia = %s,
                candidatos = %s,
                mensaje_coincidencia = %s,
                coincidencia_confirmada = %s,
                id_usuario_confirmacion = %s,
                confirmado_at = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data.get("codigo_normalizado"),
                data["estado_coincidencia"],
                data.get("id_variante"),
                data.get("origen_coincidencia"),
                data.get("confianza_coincidencia"),
                Jsonb(data.get("candidatos") or []),
                data.get("mensaje_coincidencia"),
                data.get("coincidencia_confirmada", False),
                data.get("id_usuario_confirmacion"),
                data.get("confirmado_at"),
                item_id,
            ),
        )


def get_item_coincidencia(conn, lote_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT i.*, l.id_proveedor, l.estado AS lote_estado,
                   l.id_usuario_creador
            FROM precio_lista_items i
            INNER JOIN precio_lista_lotes l ON l.id = i.id_lote
            WHERE i.id = %s AND i.id_lote = %s
            FOR UPDATE
            """,
            (item_id, lote_id),
        )
        return cur.fetchone()


def get_variante_activa(conn, variante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT v.id, v.sku, v.codigo_barras, v.codigo_proveedor,
                   v.nombre_variante, p.nombre AS producto_nombre
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s AND v.activo = TRUE AND p.activo = TRUE
            """,
            (variante_id,),
        )
        return cur.fetchone()


def get_alias_proveedor(conn, proveedor_id: int, codigo: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM proveedor_producto_codigos
            WHERE id_proveedor = %s
              AND UPPER(TRIM(codigo_proveedor)) = UPPER(TRIM(%s))
              AND activo = TRUE
            FOR UPDATE
            """,
            (proveedor_id, codigo),
        )
        return cur.fetchone()


def guardar_alias_proveedor(
    conn,
    proveedor_id: int,
    codigo: str,
    variante_id: int,
    *,
    reemplazar: bool = False,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO proveedor_producto_codigos (
                id_proveedor, codigo_proveedor, id_variante, activo
            ) VALUES (%s, %s, %s, TRUE)
            ON CONFLICT (id_proveedor, UPPER(TRIM(codigo_proveedor)))
            DO UPDATE SET
                id_variante = CASE
                    WHEN %s THEN EXCLUDED.id_variante
                    ELSE proveedor_producto_codigos.id_variante
                END,
                activo = TRUE,
                updated_at = NOW()
            RETURNING *
            """,
            (proveedor_id, codigo, variante_id, reemplazar),
        )
        return cur.fetchone()


def touch_lote(conn, lote_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE precio_lista_lotes SET updated_at = NOW() WHERE id = %s",
            (lote_id,),
        )


def get_lote_for_update(conn, lote_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM precio_lista_lotes WHERE id = %s FOR UPDATE",
            (lote_id,),
        )
        return cur.fetchone()


def list_preview_contexts(conn, lote_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT i.*,
                   v.costo_reposicion, v.costo_promedio_vigente,
                   v.precio_minorista, v.precio_mayorista,
                   v.permite_precio_libre, v.proveedor_preferido_id,
                   p.id_categoria, p.id_marca, p.id_familia_precio, p.rubro,
                   p.nombre AS producto_nombre, v.nombre_variante,
                   oferta.oferta_snapshot
            FROM precio_lista_items i
            INNER JOIN variantes v ON v.id = i.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
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
            WHERE i.id_lote = %s
            ORDER BY i.numero_fila, i.id
            """,
            (lote_id,),
        )
        return cur.fetchall()


def update_item_preview(conn, item_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE precio_lista_items
            SET costo_reposicion_anterior_snapshot = %s,
                costo_reposicion_nuevo = %s,
                costo_variacion_pct = %s,
                precio_minorista_anterior_snapshot = %s,
                precio_mayorista_anterior_snapshot = %s,
                precio_minorista_propuesto = %s,
                precio_mayorista_propuesto = %s,
                margen_minorista_anterior_pct = %s,
                margen_mayorista_anterior_pct = %s,
                margen_minorista_resultante_pct = %s,
                margen_mayorista_resultante_pct = %s,
                estrategia_minorista = %s,
                estrategia_mayorista = %s,
                descuento_minorista_snapshot = %s,
                descuento_mayorista_snapshot = %s,
                redondeo_minorista_snapshot = %s,
                redondeo_mayorista_snapshot = %s,
                regla_minorista_snapshot = %s,
                regla_mayorista_snapshot = %s,
                oferta_vigente_snapshot = %s,
                permite_precio_libre_snapshot = %s,
                precio_libre_confirmado = %s,
                alertas_preview = %s,
                explicacion_preview = %s,
                seleccionado_aplicar = %s,
                preview_valido = %s,
                preview_generado_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data.get("costo_anterior"), data.get("costo_nuevo"),
                data.get("costo_variacion_pct"), data.get("precio_minorista_anterior"),
                data.get("precio_mayorista_anterior"), data.get("precio_minorista_nuevo"),
                data.get("precio_mayorista_nuevo"), data.get("margen_minorista_anterior"),
                data.get("margen_mayorista_anterior"), data.get("margen_minorista_nuevo"),
                data.get("margen_mayorista_nuevo"), data.get("estrategia_minorista"),
                data.get("estrategia_mayorista"), data.get("descuento_minorista"),
                data.get("descuento_mayorista"), data.get("redondeo_minorista"),
                data.get("redondeo_mayorista"), Jsonb(data.get("regla_minorista")) if data.get("regla_minorista") else None,
                Jsonb(data.get("regla_mayorista")) if data.get("regla_mayorista") else None,
                Jsonb(data.get("oferta")) if data.get("oferta") else None,
                data.get("permite_precio_libre", False), data.get("precio_libre_confirmado", False),
                Jsonb(data.get("alertas") or []), Jsonb(data.get("explicacion") or {}),
                data.get("seleccionado", True), data.get("valido", False), item_id,
            ),
        )


def update_lote_preview(conn, lote_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE precio_lista_lotes
            SET estado = %s,
                preview_generado_at = NOW(),
                estrategia_preview = %s,
                alerta_variacion_pct = %s,
                descuento_minorista_pct = %s,
                descuento_mayorista_pct = %s,
                redondeo_minorista = %s,
                redondeo_mayorista = %s,
                preview_version = preview_version + 1,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data["estado"], data["estrategia"], data["alerta_variacion_pct"],
                data["descuento_minorista"], data["descuento_mayorista"],
                data["redondeo_minorista"], data["redondeo_mayorista"], lote_id,
            ),
        )


def set_lote_estado(conn, lote_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE precio_lista_lotes SET estado = %s, updated_at = NOW() WHERE id = %s",
            (estado, lote_id),
        )


def list_selected_items_for_update(conn, lote_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM precio_lista_items
            WHERE id_lote = %s AND seleccionado_aplicar = TRUE
            ORDER BY id_variante, id
            FOR UPDATE
            """,
            (lote_id,),
        )
        return cur.fetchall()


def lock_variants(conn, variant_ids: list[int]):
    if not variant_ids:
        return []
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, activo, costo_promedio_vigente, costo_reposicion,
                   costo_reposicion_moneda, costo_reposicion_fecha,
                   costo_reposicion_proveedor_id, costo_reposicion_origen,
                   precio_minorista, precio_mayorista
            FROM variantes
            WHERE id = ANY(%s)
            ORDER BY id
            FOR UPDATE
            """,
            (variant_ids,),
        )
        return cur.fetchall()


def latest_price_movement_id(conn, variant_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM precios_movimientos WHERE id_variante = %s ORDER BY id DESC LIMIT 1",
            (variant_id,),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def update_variant_from_price_list(
    conn,
    variant_id: int,
    *,
    cost,
    retail_price,
    wholesale_price,
    currency: str,
    cost_date,
    provider_id: int | None,
    cost_origin: str | None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET costo_reposicion = %s,
                costo_reposicion_moneda = %s,
                costo_reposicion_fecha = %s,
                costo_reposicion_proveedor_id = %s,
                costo_reposicion_origen = %s,
                precio_minorista = %s,
                precio_mayorista = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                cost, currency, cost_date, provider_id, cost_origin,
                retail_price, wholesale_price, variant_id,
            ),
        )


def mark_item_applied(conn, item_id: int, movement_id: int, variant: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE precio_lista_items
            SET precio_movimiento_aplicacion_id = %s,
                costo_reposicion_previo_real = %s,
                costo_reposicion_moneda_previa = %s,
                costo_reposicion_fecha_previa = %s,
                costo_reposicion_proveedor_previo_id = %s,
                costo_reposicion_origen_previo = %s,
                aplicado_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                movement_id, variant.get("costo_reposicion"),
                variant.get("costo_reposicion_moneda"), variant.get("costo_reposicion_fecha"),
                variant.get("costo_reposicion_proveedor_id"), variant.get("costo_reposicion_origen"),
                item_id,
            ),
        )


def mark_lot_applied(conn, lote_id: int, user_id: int, preview_version: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE precio_lista_lotes
            SET estado = 'aplicado', aplicado_at = NOW(), aplicado_por = %s,
                preview_version_aplicada = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (user_id, preview_version, lote_id),
        )


def mark_item_reverted(conn, item_id: int, movement_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE precio_lista_items
            SET precio_movimiento_reversion_id = %s, revertido_at = NOW(), updated_at = NOW()
            WHERE id = %s
            """,
            (movement_id, item_id),
        )


def mark_lot_reverted(conn, lote_id: int, user_id: int, reason: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE precio_lista_lotes
            SET estado = 'revertido', revertido_at = NOW(), revertido_por = %s,
                motivo_reversion = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (user_id, reason, lote_id),
        )


def list_lotes(conn, *, estado: str | None, proveedor_id: int | None, limit: int):
    conditions = []
    params = []
    if estado:
        conditions.append("l.estado = %s")
        params.append(estado)
    if proveedor_id:
        conditions.append("l.id_proveedor = %s")
        params.append(proveedor_id)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.append(limit)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT l.id, l.id_proveedor, l.proveedor_nombre_snapshot,
                   l.estado, l.nombre_archivo, l.formato, l.hoja_detectada,
                   l.fila_encabezado_detectada, l.total_filas,
                   l.id_perfil, l.preview_generado_at, l.estrategia_preview,
                   l.alerta_variacion_pct, l.descuento_minorista_pct,
                   l.descuento_mayorista_pct, l.redondeo_minorista,
                   l.redondeo_mayorista, l.preview_version,
                   l.aplicado_at, l.aplicado_por, l.preview_version_aplicada,
                   l.revertido_at, l.revertido_por, l.motivo_reversion,
                   l.created_at, l.updated_at
            FROM precio_lista_lotes l
            {where}
            ORDER BY l.updated_at DESC, l.id DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def anular_lote(conn, lote_id: int, *, usuario_id: int | None, motivo: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE precio_lista_lotes
            SET estado = 'anulado', anulado_at = NOW(), anulado_por = %s,
                motivo_anulacion = %s, updated_at = NOW()
            WHERE id = %s AND estado IN ('borrador', 'requiere_revision', 'listo_para_revisar', 'listo_para_aplicar')
            RETURNING id
            """,
            (usuario_id, motivo, lote_id),
        )
        return cur.fetchone()


def insert_perfil_from_lote(conn, lote: dict, *, nombre: str, usuario_id: int | None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO precio_lista_perfiles (
                id_proveedor, nombre, formato, hoja, fila_encabezado,
                delimitador, codificacion, mapeo_columnas, id_usuario_creador
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                lote["id_proveedor"],
                nombre,
                lote["formato"],
                lote.get("hoja_detectada"),
                lote["fila_encabezado_detectada"],
                lote.get("delimitador_detectado"),
                lote.get("codificacion_detectada"),
                Jsonb(lote.get("mapeo_detectado") or {}),
                usuario_id,
            ),
        )
        return cur.fetchone()


def attach_perfil(conn, lote_id: int, perfil_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE precio_lista_lotes SET id_perfil = %s, updated_at = NOW() WHERE id = %s",
            (perfil_id, lote_id),
        )


def list_perfiles(conn, proveedor_id: int | None = None):
    params = []
    where = ""
    if proveedor_id:
        where = "WHERE pf.id_proveedor = %s"
        params.append(proveedor_id)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT pf.*, p.nombre AS proveedor_nombre
            FROM precio_lista_perfiles pf
            INNER JOIN proveedores p ON p.id = pf.id_proveedor
            {where}
            ORDER BY pf.activo DESC, pf.updated_at DESC, pf.id DESC
            """,
            params,
        )
        return cur.fetchall()
