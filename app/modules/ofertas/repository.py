from psycopg.rows import dict_row


OFERTA_SELECT = """
    SELECT
        o.*,
        v.id_producto,
        v.nombre_variante,
        v.sku,
        v.precio_minorista AS precio_minorista_actual,
        p.nombre AS producto_nombre,
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
        ) AS vigente
    FROM ofertas o
    INNER JOIN variantes v ON v.id = o.id_variante
    INNER JOIN productos p ON p.id = v.id_producto
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
                  AND o.activa = TRUE
                  AND o.id IS DISTINCT FROM %s
                  AND daterange(o.fecha_desde, o.fecha_hasta, '[]')
                      && daterange(%s::date, %s::date, '[]')
            ) AS existe
            """,
            (id_variante, excluir_id, fecha_desde, fecha_hasta),
        )
        return bool(cur.fetchone()["existe"])


def insert_oferta(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ofertas (
                id_variante,
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
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s)
            RETURNING id
            """,
            (
                data["id_variante"],
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
            SET nombre = %s,
                precio_oferta = %s,
                fecha_desde = %s,
                fecha_hasta = %s,
                motivo = %s,
                id_usuario_actualizador = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
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


def get_oferta_vigente_variante(conn, id_variante: int, *, for_update: bool = False):
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
                o.fecha_desde,
                o.fecha_hasta
            FROM ofertas o
            WHERE o.id_variante = %s
              AND o.activa = TRUE
              AND CURRENT_DATE BETWEEN o.fecha_desde AND o.fecha_hasta
            ORDER BY o.fecha_desde DESC, o.id DESC
            LIMIT 1
            {lock}
            """,
            (id_variante,),
        )
        return cur.fetchone()
