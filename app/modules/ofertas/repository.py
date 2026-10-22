from psycopg.rows import dict_row


OFERTA_SELECT = """
    SELECT
        o.*,
        v.id_producto,
        v.nombre_variante,
        v.sku,
        v.precio_minorista AS precio_minorista_actual,
        p.nombre AS producto_nombre,
        COALESCE(unidades.unidades, '[]'::jsonb) AS unidades,
        (o.precio_regular_referencia - o.precio_oferta)::numeric(14,2)
            AS ahorro_unitario,
        CASE
            WHEN o.precio_regular_referencia > 0
            THEN ROUND(
                (
                    (o.precio_regular_referencia - o.precio_oferta)
                    / o.precio_regular_referencia
                ) * 100,
                2
            )
            ELSE 0
        END AS porcentaje_descuento,
        (
            o.activa = TRUE
            AND CURRENT_DATE BETWEEN o.fecha_desde AND o.fecha_hasta
        ) AS vigente,
        CASE
            WHEN o.activa = FALSE THEN 'inactiva'
            WHEN CURRENT_DATE < o.fecha_desde THEN 'programada'
            WHEN CURRENT_DATE > o.fecha_hasta THEN 'vencida'
            ELSE 'vigente'
        END AS estado_calculado
    FROM ofertas o
    INNER JOIN variantes v ON v.id = o.id_variante
    INNER JOIN productos p ON p.id = v.id_producto
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', bs.id,
                'numero_cuadro', bs.numero_cuadro,
                'estado', bs.estado,
                'estado_tecnico', bs.estado_tecnico,
                'condicion_comercial', bs.condicion_comercial,
                'costo_total_unitario', COALESCE(bs.costo_total_unitario, 0),
                'ganancia_estimada', o.precio_oferta - COALESCE(bs.costo_total_unitario, 0),
                'margen_estimado', CASE
                    WHEN o.precio_oferta > 0 THEN ROUND(
                        ((o.precio_oferta - COALESCE(bs.costo_total_unitario, 0)) / o.precio_oferta) * 100,
                        2
                    )
                    ELSE NULL
                END
            ) ORDER BY bs.numero_cuadro, bs.id
        ) AS unidades
        FROM oferta_bicicletas_serializadas obs
        INNER JOIN bicicletas_serializadas bs
            ON bs.id = obs.id_bicicleta_serializada
        WHERE obs.id_oferta = o.id
    ) unidades ON TRUE
"""


def get_variante_para_oferta(conn, id_variante: int, *, for_update: bool = False):
    lock = "FOR UPDATE" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                v.id,
                v.id_producto,
                v.nombre_variante,
                v.sku,
                v.precio_minorista,
                v.activo,
                p.nombre AS producto_nombre,
                p.activo AS producto_activo
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            {lock}
            """,
            (id_variante,),
        )
        return cur.fetchone()


def get_oferta_by_id(conn, oferta_id: int, *, for_update: bool = False):
    lock = "FOR UPDATE OF o" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"{OFERTA_SELECT} WHERE o.id = %s {lock}",
            (oferta_id,),
        )
        return cur.fetchone()


def listar_ofertas(conn, *, incluir_inactivas: bool = True, id_variante: int | None = None):
    filtros = []
    params = []
    if not incluir_inactivas:
        filtros.append("o.activa = TRUE")
    if id_variante is not None:
        filtros.append("o.id_variante = %s")
        params.append(id_variante)

    where = f"WHERE {' AND '.join(filtros)}" if filtros else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            {OFERTA_SELECT}
            {where}
            ORDER BY o.activa DESC, o.fecha_desde DESC, o.id DESC
            """,
            params,
        )
        return cur.fetchall()


def desactivar_ofertas_vencidas(conn, *, id_usuario: int) -> list[int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ofertas
            SET activa = FALSE,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE activa = TRUE
              AND fecha_hasta < CURRENT_DATE
            RETURNING id
            """,
            (id_usuario,),
        )
        return [row["id"] for row in cur.fetchall()]


def existe_oferta_superpuesta(
    conn,
    *,
    id_variante: int,
    fecha_desde,
    fecha_hasta,
    excluir_id: int | None = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM ofertas o
                WHERE o.id_variante = %s
                  AND o.alcance = 'variante'
                  AND o.activa = TRUE
                  AND o.id IS DISTINCT FROM %s
                  AND daterange(o.fecha_desde, o.fecha_hasta, '[]')
                      && daterange(%s::date, %s::date, '[]')
            ) AS existe
            """,
            (id_variante, excluir_id, fecha_desde, fecha_hasta),
        )
        return bool(cur.fetchone()["existe"])


def get_bicicletas_para_oferta(conn, ids: list[int], *, for_update: bool = False):
    if not ids:
        return []
    lock = "FOR UPDATE OF bs" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                bs.id,
                bs.id_variante,
                bs.numero_cuadro,
                bs.estado,
                bs.estado_tecnico,
                bs.condicion_comercial,
                COALESCE(bs.costo_total_unitario, 0) AS costo_total_unitario
            FROM bicicletas_serializadas bs
            WHERE bs.id = ANY(%s)
            ORDER BY bs.id
            {lock}
            """,
            (ids,),
        )
        return cur.fetchall()


def get_ids_unidades_oferta(conn, oferta_id: int) -> list[int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_bicicleta_serializada
            FROM oferta_bicicletas_serializadas
            WHERE id_oferta = %s
            ORDER BY id_bicicleta_serializada
            """,
            (oferta_id,),
        )
        return [row["id_bicicleta_serializada"] for row in cur.fetchall()]


def existe_oferta_unidad_superpuesta(
    conn,
    *,
    ids_bicicletas: list[int],
    fecha_desde,
    fecha_hasta,
    excluir_id: int | None = None,
):
    if not ids_bicicletas:
        return None
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT bs.numero_cuadro, o.nombre
            FROM ofertas o
            INNER JOIN oferta_bicicletas_serializadas obs ON obs.id_oferta = o.id
            INNER JOIN bicicletas_serializadas bs ON bs.id = obs.id_bicicleta_serializada
            WHERE o.alcance = 'unidades'
              AND o.activa = TRUE
              AND o.id IS DISTINCT FROM %s
              AND obs.id_bicicleta_serializada = ANY(%s)
              AND daterange(o.fecha_desde, o.fecha_hasta, '[]')
                  && daterange(%s::date, %s::date, '[]')
            ORDER BY bs.numero_cuadro, o.id
            LIMIT 1
            """,
            (excluir_id, ids_bicicletas, fecha_desde, fecha_hasta),
        )
        return cur.fetchone()


def reemplazar_unidades_oferta(conn, oferta_id: int, ids_bicicletas: list[int]):
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM oferta_bicicletas_serializadas WHERE id_oferta = %s",
            (oferta_id,),
        )
        if ids_bicicletas:
            cur.executemany(
                """
                INSERT INTO oferta_bicicletas_serializadas (
                    id_oferta, id_bicicleta_serializada
                ) VALUES (%s, %s)
                """,
                [(oferta_id, bicicleta_id) for bicicleta_id in ids_bicicletas],
            )


def insert_oferta(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ofertas (
                id_variante,
                alcance,
                politica_contado,
                nombre,
                precio_regular_referencia,
                precio_oferta,
                fecha_desde,
                fecha_hasta,
                motivo,
                activa,
                id_usuario_creador,
                id_usuario_actualizador
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s)
            RETURNING id
            """,
            (
                data["id_variante"],
                data["alcance"],
                data["politica_contado"],
                data["nombre"],
                data["precio_regular_referencia"],
                data["precio_oferta"],
                data["fecha_desde"],
                data["fecha_hasta"],
                data.get("motivo"),
                data["id_usuario"],
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def update_oferta(conn, oferta_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ofertas
            SET alcance = %s,
                politica_contado = %s,
                nombre = %s,
                precio_oferta = %s,
                fecha_desde = %s,
                fecha_hasta = %s,
                motivo = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data["alcance"],
                data["politica_contado"],
                data["nombre"],
                data["precio_oferta"],
                data["fecha_desde"],
                data["fecha_hasta"],
                data.get("motivo"),
                data["id_usuario"],
                oferta_id,
            ),
        )


def update_oferta_estado(conn, oferta_id: int, *, activa: bool, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ofertas
            SET activa = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (activa, id_usuario, oferta_id),
        )


def get_oferta_vigente_variante(
    conn,
    id_variante: int,
    *,
    id_bicicleta_serializada: int | None = None,
    for_update: bool = False,
):
    lock = "FOR UPDATE OF o" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                o.id,
                o.id_variante,
                o.nombre,
                o.precio_regular_referencia,
                o.precio_oferta,
                o.alcance,
                o.politica_contado,
                o.fecha_desde,
                o.fecha_hasta
            FROM ofertas o
            LEFT JOIN oferta_bicicletas_serializadas obs
                ON obs.id_oferta = o.id
               AND obs.id_bicicleta_serializada = %s
            WHERE o.id_variante = %s
              AND o.activa = TRUE
              AND CURRENT_DATE BETWEEN o.fecha_desde AND o.fecha_hasta
              AND (
                    (o.alcance = 'unidades' AND obs.id IS NOT NULL)
                    OR o.alcance = 'variante'
              )
            ORDER BY
                CASE WHEN o.alcance = 'unidades' THEN 0 ELSE 1 END,
                o.fecha_desde DESC,
                o.id DESC
            LIMIT 1
            {lock}
            """,
            (id_bicicleta_serializada, id_variante),
        )
        return cur.fetchone()
