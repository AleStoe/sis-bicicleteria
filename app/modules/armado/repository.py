from psycopg.rows import dict_row


def get_modelo_by_id(conn, modelo_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                m.*,
                (
                    SELECT COUNT(*)::int
                    FROM armado_versiones v
                    WHERE v.id_modelo = m.id
                ) AS versiones
            FROM armado_modelos m
            WHERE m.id = %s
            {suffix}
            """,
            (modelo_id,),
        )
        return cur.fetchone()


def get_modelo_by_nombre(conn, nombre: str, *, excluir_id: int | None = None):
    params = [nombre]
    excluir_sql = ""
    if excluir_id is not None:
        excluir_sql = "AND id <> %s"
        params.append(excluir_id)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT *
            FROM armado_modelos
            WHERE nombre = %s
              {excluir_sql}
            """,
            params,
        )
        return cur.fetchone()


def listar_modelos(conn, *, incluir_inactivos: bool = False):
    where = "" if incluir_inactivos else "WHERE m.activo = TRUE"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                m.*,
                COUNT(v.id)::int AS versiones,
                COUNT(v.id) FILTER (WHERE v.activo = TRUE)::int AS versiones_activas,
                MIN(costos.costo_estimado_total) AS costo_estimado_min,
                MAX(costos.costo_estimado_total) AS costo_estimado_max
            FROM armado_modelos m
            LEFT JOIN armado_versiones v ON v.id_modelo = m.id
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(SUM(i.cantidad * vc.costo_promedio_vigente), 0)::numeric(14,4)
                        AS costo_estimado_total
                FROM armado_configuraciones c
                INNER JOIN armado_configuracion_items i ON i.id_configuracion = c.id
                INNER JOIN variantes vc ON vc.id = i.id_variante_componente
                WHERE c.id_version = v.id
                  AND c.estado = 'activa'
                GROUP BY c.id
                LIMIT 1
            ) costos ON TRUE
            {where}
            GROUP BY m.id
            ORDER BY m.activo DESC, m.nombre ASC
            """
        )
        return cur.fetchall()


def insert_modelo(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO armado_modelos (nombre, descripcion, id_usuario_creador)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (data["nombre"], data.get("descripcion"), data["id_usuario"]),
        )
        return cur.fetchone()["id"]


def update_modelo(conn, modelo_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_modelos
            SET nombre = %s,
                descripcion = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (
                data["nombre"],
                data.get("descripcion"),
                data["id_usuario"],
                modelo_id,
            ),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def update_modelo_estado(conn, modelo_id: int, *, activo: bool, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_modelos
            SET activo = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (activo, id_usuario, modelo_id),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def get_variante_detalle(conn, variante_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                v.id,
                v.nombre_variante,
                v.sku,
                v.codigo_proveedor,
                v.costo_promedio_vigente,
                v.activo AS variante_activa,
                p.id AS id_producto,
                p.nombre AS producto_nombre,
                p.activo AS producto_activo,
                p.stockeable,
                p.serializable
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            {suffix}
            """,
            (variante_id,),
        )
        return cur.fetchone()


def get_version_by_id(conn, version_id: int, *, for_update: bool = False):
    with conn.cursor(row_factory=dict_row) as cur:
        if for_update:
            cur.execute(
                """
                SELECT id
                FROM armado_versiones
                WHERE id = %s
                FOR UPDATE
                """,
                (version_id,),
            )
            if cur.fetchone() is None:
                return None

        cur.execute(
            """
            SELECT
                v.*,
                m.nombre AS modelo_nombre,
                vf.nombre_variante AS variante_final_nombre,
                pf.nombre AS producto_final_nombre,
                vf.precio_minorista AS precio_objetivo,
                activa.id AS configuracion_activa_id,
                activa.numero_revision AS configuracion_activa_revision,
                activa.costo_estimado AS costo_estimado,
                CASE
                    WHEN vf.precio_minorista > 0
                         AND activa.costo_estimado IS NOT NULL
                        THEN ((vf.precio_minorista - activa.costo_estimado) / vf.precio_minorista * 100)::numeric(8,2)
                    ELSE NULL
                END AS margen_estimado,
                (
                    SELECT COUNT(*)::int
                    FROM armado_configuraciones c
                    WHERE c.id_version = v.id
                ) AS configuraciones
            FROM armado_versiones v
            INNER JOIN armado_modelos m ON m.id = v.id_modelo
            INNER JOIN variantes vf ON vf.id = v.id_variante_final
            INNER JOIN productos pf ON pf.id = vf.id_producto
            LEFT JOIN LATERAL (
                SELECT
                    c.id,
                    c.numero_revision,
                    COALESCE(SUM(i.cantidad * vc.costo_promedio_vigente), 0)::numeric(14,4)
                        AS costo_estimado
                FROM armado_configuraciones c
                INNER JOIN armado_configuracion_items i ON i.id_configuracion = c.id
                INNER JOIN variantes vc ON vc.id = i.id_variante_componente
                WHERE c.id_version = v.id
                  AND c.estado = 'activa'
                GROUP BY c.id, c.numero_revision
                LIMIT 1
            ) activa ON TRUE
            WHERE v.id = %s
            """,
            (version_id,),
        )
        return cur.fetchone()


def get_version_by_nombre(conn, id_modelo: int, nombre: str, *, excluir_id: int | None = None):
    params = [id_modelo, nombre]
    excluir_sql = ""
    if excluir_id is not None:
        excluir_sql = "AND id <> %s"
        params.append(excluir_id)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT *
            FROM armado_versiones
            WHERE id_modelo = %s
              AND nombre = %s
              {excluir_sql}
            """,
            params,
        )
        return cur.fetchone()


def listar_versiones(conn, *, id_modelo: int | None = None, incluir_inactivas: bool = False):
    params = []
    where = []
    if id_modelo is not None:
        where.append("v.id_modelo = %s")
        params.append(id_modelo)
    if not incluir_inactivas:
        where.append("v.activo = TRUE")

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                v.*,
                m.nombre AS modelo_nombre,
                vf.nombre_variante AS variante_final_nombre,
                pf.nombre AS producto_final_nombre,
                vf.precio_minorista AS precio_objetivo,
                activa.id AS configuracion_activa_id,
                activa.numero_revision AS configuracion_activa_revision,
                activa.costo_estimado AS costo_estimado,
                CASE
                    WHEN vf.precio_minorista > 0
                         AND activa.costo_estimado IS NOT NULL
                        THEN ((vf.precio_minorista - activa.costo_estimado) / vf.precio_minorista * 100)::numeric(8,2)
                    ELSE NULL
                END AS margen_estimado,
                COUNT(c.id)::int AS configuraciones
            FROM armado_versiones v
            INNER JOIN armado_modelos m ON m.id = v.id_modelo
            INNER JOIN variantes vf ON vf.id = v.id_variante_final
            INNER JOIN productos pf ON pf.id = vf.id_producto
            LEFT JOIN armado_configuraciones c ON c.id_version = v.id
            LEFT JOIN LATERAL (
                SELECT
                    ca.id,
                    ca.numero_revision,
                    COALESCE(SUM(i.cantidad * vc.costo_promedio_vigente), 0)::numeric(14,4)
                        AS costo_estimado
                FROM armado_configuraciones ca
                INNER JOIN armado_configuracion_items i ON i.id_configuracion = ca.id
                INNER JOIN variantes vc ON vc.id = i.id_variante_componente
                WHERE ca.id_version = v.id
                  AND ca.estado = 'activa'
                GROUP BY ca.id, ca.numero_revision
                LIMIT 1
            ) activa ON TRUE
            {where_sql}
            GROUP BY
                v.id,
                m.nombre,
                vf.nombre_variante,
                pf.nombre,
                vf.precio_minorista,
                activa.id,
                activa.numero_revision,
                activa.costo_estimado
            ORDER BY m.nombre ASC, v.activo DESC, v.nombre ASC
            """,
            params,
        )
        return cur.fetchall()


def insert_version(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO armado_versiones (
                id_modelo,
                nombre,
                descripcion,
                id_variante_final,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_modelo"],
                data["nombre"],
                data.get("descripcion"),
                data["id_variante_final"],
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def update_version(conn, version_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_versiones
            SET nombre = %s,
                descripcion = %s,
                id_variante_final = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (
                data["nombre"],
                data.get("descripcion"),
                data["id_variante_final"],
                data["id_usuario"],
                version_id,
            ),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def update_version_estado(conn, version_id: int, *, activo: bool, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_versiones
            SET activo = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (activo, id_usuario, version_id),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def siguiente_numero_configuracion(conn, version_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(MAX(numero_revision), 0) + 1 AS numero
            FROM armado_configuraciones
            WHERE id_version = %s
            """,
            (version_id,),
        )
        return cur.fetchone()["numero"]


def insert_configuracion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO armado_configuraciones (
                id_version,
                nombre,
                descripcion,
                numero_revision,
                estado,
                id_configuracion_origen,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_version"],
                data["nombre"],
                data.get("descripcion"),
                data["numero_revision"],
                data.get("estado", "borrador"),
                data.get("id_configuracion_origen"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def get_configuracion_by_id(conn, configuracion_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                c.*,
                v.nombre AS version_nombre,
                m.nombre AS modelo_nombre,
                (
                    SELECT COALESCE(
                        SUM(i.cantidad * vc.costo_promedio_vigente),
                        0
                    )::numeric(14,4)
                    FROM armado_configuracion_items i
                    INNER JOIN variantes vc ON vc.id = i.id_variante_componente
                    WHERE i.id_configuracion = c.id
                ) AS costo_estimado_total
            FROM armado_configuraciones c
            INNER JOIN armado_versiones v ON v.id = c.id_version
            INNER JOIN armado_modelos m ON m.id = v.id_modelo
            WHERE c.id = %s
            {suffix}
            """,
            (configuracion_id,),
        )
        return cur.fetchone()


def get_configuracion_activa_by_version(conn, version_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id
            FROM armado_configuraciones
            WHERE id_version = %s
              AND estado = 'activa'
            LIMIT 1
            """,
            (version_id,),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def update_configuracion(conn, configuracion_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_configuraciones
            SET nombre = %s,
                descripcion = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (
                data["nombre"],
                data.get("descripcion"),
                data["id_usuario"],
                configuracion_id,
            ),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def update_configuracion_estado(conn, configuracion_id: int, *, estado: str, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_configuraciones
            SET estado = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (estado, id_usuario, configuracion_id),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def archivar_configuraciones_activas_version(
    conn,
    *,
    version_id: int,
    excluir_id: int,
    id_usuario: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_configuraciones
            SET estado = 'archivada',
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id_version = %s
              AND estado = 'activa'
              AND id <> %s
            RETURNING id
            """,
            (id_usuario, version_id, excluir_id),
        )
        return cur.fetchall()


def get_items_configuracion(conn, configuracion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                i.id,
                i.id_configuracion,
                i.id_variante_componente,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.sku,
                v.codigo_proveedor,
                c.nombre AS categoria_nombre,
                i.cantidad,
                v.costo_promedio_vigente::numeric(14,4) AS costo_unitario_estimado,
                (i.cantidad * v.costo_promedio_vigente)::numeric(14,4)
                    AS subtotal_estimado,
                'costo_promedio_vigente'::text AS origen_costo,
                (v.costo_promedio_vigente IS NOT NULL) AS costo_disponible,
                (v.costo_promedio_vigente = 0) AS costo_cero,
                i.orden,
                i.nota
            FROM armado_configuracion_items i
            INNER JOIN variantes v ON v.id = i.id_variante_componente
            INNER JOIN productos p ON p.id = v.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            WHERE i.id_configuracion = %s
            ORDER BY i.orden ASC, i.id ASC
            """,
            (configuracion_id,),
        )
        return cur.fetchall()


def get_item_configuracion_by_id(conn, item_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT *
            FROM armado_configuracion_items
            WHERE id = %s
            {suffix}
            """,
            (item_id,),
        )
        return cur.fetchone()


def insert_item_configuracion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO armado_configuracion_items (
                id_configuracion,
                id_variante_componente,
                cantidad,
                orden,
                nota
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_configuracion"],
                data["id_variante_componente"],
                data["cantidad"],
                data.get("orden", 0),
                data.get("nota"),
            ),
        )
        return cur.fetchone()["id"]


def update_item_configuracion(conn, item_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_configuracion_items
            SET id_variante_componente = %s,
                cantidad = %s,
                orden = %s,
                nota = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (
                data["id_variante_componente"],
                data["cantidad"],
                data.get("orden", 0),
                data.get("nota"),
                item_id,
            ),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def delete_item_configuracion(conn, item_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM armado_configuracion_items
            WHERE id = %s
            """,
            (item_id,),
        )


def copiar_items_configuracion(conn, *, origen_id: int, destino_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO armado_configuracion_items (
                id_configuracion,
                id_variante_componente,
                cantidad,
                orden,
                nota
            )
            SELECT
                %s,
                id_variante_componente,
                cantidad,
                orden,
                nota
            FROM armado_configuracion_items
            WHERE id_configuracion = %s
            ORDER BY orden ASC, id ASC
            """,
            (destino_id, origen_id),
        )


def get_sucursal_by_id(conn, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, activa
            FROM sucursales
            WHERE id = %s
            """,
            (sucursal_id,),
        )
        return cur.fetchone()


def listar_sucursales(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, activa
            FROM sucursales
            WHERE activa = TRUE
            ORDER BY nombre
            """
        )
        return cur.fetchall()


def get_componentes_detalle(conn, *, variante_ids: list[int], id_sucursal: int):
    if not variante_ids:
        return {}

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.nombre_variante,
                v.sku,
                v.codigo_proveedor,
                v.costo_promedio_vigente::numeric(14,4) AS costo_promedio_vigente,
                v.activo AS variante_activa,
                p.id AS id_producto,
                p.nombre AS producto_nombre,
                p.activo AS producto_activo,
                p.stockeable,
                p.serializable,
                c.nombre AS categoria_nombre,
                COALESCE(ss.stock_fisico, 0)::numeric(14,3) AS stock_fisico,
                COALESCE(ss.stock_reservado, 0)::numeric(14,3) AS stock_reservado,
                COALESCE(ss.stock_vendido_pendiente_entrega, 0)::numeric(14,3)
                    AS stock_vendido_pendiente,
                (
                    COALESCE(ss.stock_fisico, 0)
                    - COALESCE(ss.stock_reservado, 0)
                    - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                )::numeric(14,3) AS stock_disponible,
                (ss.id IS NOT NULL) AS stock_calculable
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            LEFT JOIN stock_sucursal ss
                ON ss.id_variante = v.id
               AND ss.id_sucursal = %s
            WHERE v.id = ANY(%s)
            """,
            (id_sucursal, variante_ids),
        )
        return {row["id"]: row for row in cur.fetchall()}


def insert_orden(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO armado_ordenes (
                id_modelo,
                id_version,
                id_configuracion,
                id_sucursal,
                estado,
                talle,
                color,
                numero_cuadro,
                descripcion_final,
                id_usuario_responsable,
                id_usuario_creacion,
                precio_objetivo,
                margen_objetivo,
                observaciones
            )
            VALUES (%s, %s, %s, %s, 'borrador', %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_modelo"],
                data["id_version"],
                data["id_configuracion"],
                data["id_sucursal"],
                data.get("talle"),
                data.get("color"),
                data.get("numero_cuadro"),
                data.get("descripcion_final"),
                data.get("id_usuario_responsable"),
                data["id_usuario"],
                data.get("precio_objetivo"),
                data.get("margen_objetivo"),
                data.get("observaciones"),
            ),
        )
        return cur.fetchone()["id"]


def copiar_items_a_orden(conn, *, orden_id: int, configuracion_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO armado_orden_items (
                id_orden,
                id_configuracion_item_origen,
                grupo,
                id_variante_prevista,
                id_variante_utilizada,
                cantidad_prevista,
                cantidad_utilizada,
                costo_unitario_previsto,
                subtotal_previsto,
                estado,
                observaciones
            )
            SELECT
                %s,
                i.id,
                COALESCE(c.nombre, 'componentes'),
                i.id_variante_componente,
                i.id_variante_componente,
                i.cantidad,
                i.cantidad,
                v.costo_promedio_vigente,
                CASE
                    WHEN v.costo_promedio_vigente IS NULL THEN NULL
                    ELSE (i.cantidad * v.costo_promedio_vigente)::numeric(14,2)
                END,
                'pendiente',
                i.nota
            FROM armado_configuracion_items i
            INNER JOIN variantes v ON v.id = i.id_variante_componente
            INNER JOIN productos p ON p.id = v.id_producto
            LEFT JOIN categorias c ON c.id = p.id_categoria
            WHERE i.id_configuracion = %s
            ORDER BY i.orden ASC, i.id ASC
            """,
            (orden_id, configuracion_id),
        )


def get_orden_by_id(conn, orden_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE OF o" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                o.*,
                m.nombre AS modelo_nombre,
                v.nombre AS version_nombre,
                c.nombre AS configuracion_nombre,
                c.numero_revision AS configuracion_revision,
                s.nombre AS sucursal_nombre,
                u.nombre AS responsable_nombre
            FROM armado_ordenes o
            INNER JOIN armado_modelos m ON m.id = o.id_modelo
            INNER JOIN armado_versiones v ON v.id = o.id_version
            INNER JOIN armado_configuraciones c ON c.id = o.id_configuracion
            INNER JOIN sucursales s ON s.id = o.id_sucursal
            LEFT JOIN usuarios u ON u.id = o.id_usuario_responsable
            WHERE o.id = %s
            {suffix}
            """,
            (orden_id,),
        )
        return cur.fetchone()


def listar_ordenes(conn, filtros: dict):
    params = []
    where = []
    for campo, columna in (
        ("estado", "o.estado"),
        ("id_modelo", "o.id_modelo"),
        ("id_version", "o.id_version"),
        ("id_sucursal", "o.id_sucursal"),
        ("id_usuario_responsable", "o.id_usuario_responsable"),
    ):
        if filtros.get(campo):
            where.append(f"{columna} = %s")
            params.append(filtros[campo])
    if filtros.get("fecha_desde"):
        where.append("o.fecha_creacion::date >= %s")
        params.append(filtros["fecha_desde"])
    if filtros.get("fecha_hasta"):
        where.append("o.fecha_creacion::date <= %s")
        params.append(filtros["fecha_hasta"])
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                o.*,
                m.nombre AS modelo_nombre,
                v.nombre AS version_nombre,
                c.nombre AS configuracion_nombre,
                c.numero_revision AS configuracion_revision,
                s.nombre AS sucursal_nombre,
                u.nombre AS responsable_nombre
            FROM armado_ordenes o
            INNER JOIN armado_modelos m ON m.id = o.id_modelo
            INNER JOIN armado_versiones v ON v.id = o.id_version
            INNER JOIN armado_configuraciones c ON c.id = o.id_configuracion
            INNER JOIN sucursales s ON s.id = o.id_sucursal
            LEFT JOIN usuarios u ON u.id = o.id_usuario_responsable
            {where_sql}
            ORDER BY o.fecha_creacion DESC, o.id DESC
            """,
            params,
        )
        return cur.fetchall()


def get_orden_items(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                i.*,
                pp.nombre AS producto_previsto_nombre,
                vp.nombre_variante AS variante_prevista_nombre,
                pu.nombre AS producto_utilizado_nombre,
                vu.nombre_variante AS variante_utilizada_nombre
            FROM armado_orden_items i
            INNER JOIN variantes vp ON vp.id = i.id_variante_prevista
            INNER JOIN productos pp ON pp.id = vp.id_producto
            INNER JOIN variantes vu ON vu.id = i.id_variante_utilizada
            INNER JOIN productos pu ON pu.id = vu.id_producto
            WHERE i.id_orden = %s
            ORDER BY i.id ASC
            """,
            (orden_id,),
        )
        return cur.fetchall()


def get_orden_items_for_update(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM armado_orden_items
            WHERE id_orden = %s
            ORDER BY id_variante_utilizada ASC, id ASC
            FOR UPDATE
            """,
            (orden_id,),
        )
        return cur.fetchall()


def get_orden_item_by_id(conn, item_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT *
            FROM armado_orden_items
            WHERE id = %s
            {suffix}
            """,
            (item_id,),
        )
        return cur.fetchone()


def get_orden_costos(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM armado_orden_costos
            WHERE id_orden = %s
            ORDER BY id ASC
            """,
            (orden_id,),
        )
        return cur.fetchall()


def get_orden_controles(conn, orden_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT *
            FROM armado_orden_controles
            WHERE id_orden = %s
            ORDER BY codigo_control ASC
            {suffix}
            """,
            (orden_id,),
        )
        return cur.fetchall()


def upsert_orden_control(conn, orden_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO armado_orden_controles (
                id_orden,
                codigo_control,
                aprobado,
                observaciones,
                id_usuario,
                fecha_control
            )
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id_orden, codigo_control)
            DO UPDATE SET
                aprobado = EXCLUDED.aprobado,
                observaciones = EXCLUDED.observaciones,
                id_usuario = EXCLUDED.id_usuario,
                fecha_control = NOW(),
                updated_at = NOW()
            RETURNING *
            """,
            (
                orden_id,
                data["codigo_control"],
                data["aprobado"],
                data.get("observaciones"),
                data.get("id_usuario"),
            ),
        )
        return cur.fetchone()


def insert_orden_costo(conn, data: dict):
    total = data["cantidad"] * data["costo_unitario"]
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO armado_orden_costos (
                id_orden,
                tipo,
                descripcion,
                cantidad,
                costo_unitario,
                total,
                observaciones
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_orden"],
                data["tipo"],
                data["descripcion"],
                data["cantidad"],
                data["costo_unitario"],
                total,
                data.get("observaciones"),
            ),
        )
        return cur.fetchone()["id"]


def update_orden_costo_final(conn, costo_id: int, *, costo_unitario_final, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE armado_orden_costos
            SET costo_unitario_final = %s,
                total_final = cantidad * %s,
                fecha_confirmacion_final = NOW(),
                id_usuario_confirmacion_final = %s
            WHERE id = %s
            RETURNING id_orden
            """,
            (costo_unitario_final, costo_unitario_final, id_usuario, costo_id),
        )
        row = cur.fetchone()
        return row["id_orden"] if row else None


def update_orden_item_sustitucion(conn, item_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_orden_items
            SET id_variante_utilizada = %s,
                cantidad_utilizada = %s,
                costo_unitario_previsto = %s,
                subtotal_previsto = %s,
                es_sustitucion = TRUE,
                motivo_sustitucion = %s,
                id_usuario_sustitucion = %s,
                fecha_sustitucion = NOW(),
                observaciones = %s,
                estado = 'sustituido',
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data["id_variante_utilizada"],
                data["cantidad_utilizada"],
                data["costo_unitario_previsto"],
                data["subtotal_previsto"],
                data["motivo_sustitucion"],
                data["id_usuario"],
                data.get("observaciones"),
                item_id,
            ),
        )


def update_orden_datos(conn, orden_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_ordenes
            SET talle = %s,
                color = %s,
                numero_cuadro = %s,
                descripcion_final = %s,
                id_usuario_responsable = %s,
                precio_objetivo = %s,
                margen_objetivo = %s,
                observaciones = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (
                data.get("talle"),
                data.get("color"),
                data.get("numero_cuadro"),
                data.get("descripcion_final"),
                data.get("id_usuario_responsable"),
                data.get("precio_objetivo"),
                data.get("margen_objetivo"),
                data.get("observaciones"),
                orden_id,
            ),
        )


def update_orden_estado(conn, orden_id: int, estado: str):
    fecha_cancelacion_sql = ", fecha_cancelacion = NOW()" if estado == "cancelada" else ""
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE armado_ordenes
            SET estado = %s,
                fecha_actualizacion = NOW()
                {fecha_cancelacion_sql}
            WHERE id = %s
            """,
            (estado, orden_id),
        )


def update_orden_inicio(conn, orden_id: int, *, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_ordenes
            SET estado = 'en_armado',
                fecha_inicio = NOW(),
                id_usuario_inicio = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (id_usuario, orden_id),
        )


def update_orden_cancelacion(
    conn,
    orden_id: int,
    *,
    motivo_cancelacion: str | None,
    id_usuario: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_ordenes
            SET estado = 'cancelada',
                fecha_cancelacion = NOW(),
                motivo_cancelacion = %s,
                id_usuario_cancelacion = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (motivo_cancelacion, id_usuario, orden_id),
        )


def update_orden_control_final(conn, orden_id: int, *, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_ordenes
            SET estado = 'control_final',
                fecha_control_final = NOW(),
                id_usuario_control_final = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (id_usuario, orden_id),
        )


def update_orden_volver_en_armado(conn, orden_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_ordenes
            SET estado = 'en_armado',
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (orden_id,),
        )


def update_orden_finalizada(
    conn,
    orden_id: int,
    *,
    bicicleta_id: int,
    costo_componentes_final,
    costo_adicional_final,
    costo_fabricacion_final,
    desvio_total,
    id_usuario: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_ordenes
            SET estado = 'terminada',
                id_bicicleta_serializada_resultante = %s,
                costo_componentes_final = %s,
                costo_adicional_final = %s,
                costo_fabricacion_final = %s,
                desvio_total = %s,
                fecha_finalizacion = NOW(),
                id_usuario_finalizacion = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (
                bicicleta_id,
                costo_componentes_final,
                costo_adicional_final,
                costo_fabricacion_final,
                desvio_total,
                id_usuario,
                orden_id,
            ),
        )


def update_orden_item_estado(conn, item_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_orden_items
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (estado, item_id),
        )


def update_orden_item_consumido(
    conn,
    item_id: int,
    *,
    cantidad_consumida,
    costo_unitario_real,
    subtotal_real,
    movimiento_id: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_orden_items
            SET estado = 'consumido',
                cantidad_consumida = %s,
                costo_unitario_real = %s,
                subtotal_real = %s,
                id_movimiento_consumo = %s,
                fecha_consumo = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                cantidad_consumida,
                costo_unitario_real,
                subtotal_real,
                movimiento_id,
                item_id,
            ),
        )


def update_orden_item_revertido(conn, item_id: int, *, movimiento_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE armado_orden_items
            SET estado = 'revertido',
                id_movimiento_reversion = %s,
                fecha_reversion = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (movimiento_id, item_id),
        )


def recalcular_totales_orden(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                COALESCE(SUM(subtotal_previsto), 0)::numeric(14,2) AS componentes,
                BOOL_AND(subtotal_previsto IS NOT NULL) AS completo
            FROM armado_orden_items
            WHERE id_orden = %s
              AND estado <> 'omitido'
            """,
            (orden_id,),
        )
        componentes = cur.fetchone()
        cur.execute(
            """
            SELECT COALESCE(SUM(total), 0)::numeric(14,2) AS adicionales
            FROM armado_orden_costos
            WHERE id_orden = %s
            """,
            (orden_id,),
        )
        adicionales = cur.fetchone()["adicionales"]
        total = componentes["componentes"] + adicionales
        cur.execute(
            """
            UPDATE armado_ordenes
            SET costo_componentes_previsto = %s,
                costo_adicional_previsto = %s,
                costo_total_previsto = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (componentes["componentes"], adicionales, total, orden_id),
        )
        return {"componentes": componentes["componentes"], "adicionales": adicionales, "total": total, "completo": componentes["completo"]}


def recalcular_totales_reales_orden(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                COALESCE(SUM(subtotal_real), 0)::numeric(14,4) AS componentes_real
            FROM armado_orden_items
            WHERE id_orden = %s
              AND estado IN ('consumido', 'revertido')
            """,
            (orden_id,),
        )
        componentes_real = cur.fetchone()["componentes_real"]
        cur.execute(
            """
            SELECT
                costo_componentes_previsto,
                costo_adicional_previsto
            FROM armado_ordenes
            WHERE id = %s
            """,
            (orden_id,),
        )
        orden = cur.fetchone()
        total_real = componentes_real + orden["costo_adicional_previsto"]
        desvio = componentes_real - orden["costo_componentes_previsto"]
        cur.execute(
            """
            UPDATE armado_ordenes
            SET costo_componentes_real = %s,
                costo_total_real = %s,
                desvio_componentes = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (componentes_real, total_real, desvio, orden_id),
        )
        return {
            "componentes_real": componentes_real,
            "total_real": total_real,
            "desvio": desvio,
        }


def recalcular_totales_finales_orden(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                COALESCE(SUM(subtotal_real), 0)::numeric(14,4) AS componentes_final
            FROM armado_orden_items
            WHERE id_orden = %s
              AND estado = 'consumido'
            """,
            (orden_id,),
        )
        componentes_final = cur.fetchone()["componentes_final"]
        cur.execute(
            """
            SELECT
                COALESCE(SUM(COALESCE(total_final, total)), 0)::numeric(14,4)
                    AS adicional_final
            FROM armado_orden_costos
            WHERE id_orden = %s
            """,
            (orden_id,),
        )
        adicional_final = cur.fetchone()["adicional_final"]
        cur.execute(
            """
            SELECT costo_total_previsto
            FROM armado_ordenes
            WHERE id = %s
            """,
            (orden_id,),
        )
        previsto = cur.fetchone()["costo_total_previsto"]
        total_final = componentes_final + adicional_final
        desvio_total = total_final - previsto
        cur.execute(
            """
            UPDATE armado_ordenes
            SET costo_componentes_final = %s,
                costo_adicional_final = %s,
                costo_fabricacion_final = %s,
                desvio_total = %s,
                fecha_actualizacion = NOW()
            WHERE id = %s
            """,
            (componentes_final, adicional_final, total_final, desvio_total, orden_id),
        )
        return {
            "componentes_final": componentes_final,
            "adicional_final": adicional_final,
            "total_final": total_final,
            "desvio_total": desvio_total,
        }


def insert_bicicleta_serializada_desde_armado(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado,
                observaciones,
                id_orden_armado_origen,
                costo_fabricacion_final,
                fecha_fabricacion,
                id_usuario_fabricacion
            )
            VALUES (%s, %s, %s, 'disponible', %s, %s, %s, NOW(), %s)
            RETURNING id
            """,
            (
                data["id_variante"],
                data["id_sucursal_actual"],
                data["numero_cuadro"],
                data.get("observaciones"),
                data["id_orden_armado_origen"],
                data["costo_fabricacion_final"],
                data["id_usuario_fabricacion"],
            ),
        )
        return cur.fetchone()["id"]


def get_bicicleta_serializada_by_orden(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicletas_serializadas
            WHERE id_orden_armado_origen = %s
            """,
            (orden_id,),
        )
        return cur.fetchone()


def get_ficha_tecnica_orden(conn, orden_id: int):
    orden = get_orden_by_id(conn, orden_id)
    if orden is None:
        return None
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                bs.id AS id_bicicleta_serializada,
                bs.numero_cuadro,
                bs.fecha_fabricacion,
                vf.id AS id_variante_final,
                vf.nombre_variante AS variante_final_nombre,
                pf.nombre AS producto_final_nombre
            FROM armado_ordenes o
            INNER JOIN armado_versiones av ON av.id = o.id_version
            INNER JOIN variantes vf ON vf.id = av.id_variante_final
            INNER JOIN productos pf ON pf.id = vf.id_producto
            INNER JOIN bicicletas_serializadas bs
                ON bs.id = o.id_bicicleta_serializada_resultante
            WHERE o.id = %s
            """,
            (orden_id,),
        )
        resultante = cur.fetchone()
    if resultante is None:
        return None
    return {
        **dict(orden),
        "id_orden": orden["id"],
        **dict(resultante),
        "componentes": get_orden_items(conn, orden_id),
        "costos": get_orden_costos(conn, orden_id),
    }
