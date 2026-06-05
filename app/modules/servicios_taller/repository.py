from psycopg.rows import dict_row


def insert_servicio_taller(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO servicios_taller (
                nombre,
                descripcion,
                precio_sugerido,
                duracion_estimada_min
            )
            VALUES (%s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["nombre"],
                data.get("descripcion"),
                data["precio_sugerido"],
                data.get("duracion_estimada_min"),
            ),
        )
        return cur.fetchone()


def get_servicios_taller(conn, incluir_inactivos: bool = False):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM servicios_taller
            WHERE (%s = TRUE OR activo = TRUE)
            ORDER BY activo DESC, nombre ASC
            """,
            (incluir_inactivos,),
        )
        return cur.fetchall()


def get_servicio_taller_by_id(conn, servicio_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM servicios_taller
            WHERE id = %s
            """,
            (servicio_id,),
        )
        return cur.fetchone()


def update_servicio_taller(conn, servicio_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE servicios_taller
            SET nombre = %s,
                descripcion = %s,
                precio_sugerido = %s,
                duracion_estimada_min = %s,
                activo = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (
                data["nombre"],
                data.get("descripcion"),
                data["precio_sugerido"],
                data.get("duracion_estimada_min"),
                data["activo"],
                servicio_id,
            ),
        )
        return cur.fetchone()


def set_servicio_taller_activo(conn, servicio_id: int, activo: bool):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE servicios_taller
            SET activo = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (activo, servicio_id),
        )
        return cur.fetchone()