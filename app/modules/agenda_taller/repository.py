def insert_turno_agenda(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO agenda_taller (
                id_sucursal,
                id_cliente,
                cliente_nombre,
                cliente_telefono,
                fecha,
                hora_inicio,
                hora_fin,
                tipo_servicio,
                descripcion,
                notas,
                id_usuario_creador
            )
            VALUES (
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
            RETURNING *
            """,
            (
                data.id_sucursal,
                data.id_cliente,
                data.cliente_nombre,
                data.cliente_telefono,
                data.fecha,
                data.hora_inicio,
                data.hora_fin,
                data.tipo_servicio,
                data.descripcion,
                data.notas,
                data.id_usuario_creador,
            ),
        )
        return cur.fetchone()


def get_turnos_agenda(
    conn,
    fecha_desde=None,
    fecha_hasta=None,
):
    sql = """
        SELECT *
        FROM agenda_taller
        WHERE 1=1
    """

    params = []

    if fecha_desde:
        sql += " AND fecha >= %s"
        params.append(fecha_desde)

    if fecha_hasta:
        sql += " AND fecha <= %s"
        params.append(fecha_hasta)

    sql += """
        ORDER BY
            fecha ASC,
            hora_inicio ASC,
            id ASC
    """

    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_turno_agenda_by_id(conn, turno_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM agenda_taller
            WHERE id = %s
            """,
            (turno_id,),
        )
        return cur.fetchone()


def update_turno_agenda(conn, turno_id, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE agenda_taller
            SET
                id_cliente = %s,
                cliente_nombre = %s,
                cliente_telefono = %s,
                fecha = %s,
                hora_inicio = %s,
                hora_fin = %s,
                tipo_servicio = %s,
                descripcion = %s,
                notas = %s,
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (
                data.id_cliente,
                data.cliente_nombre,
                data.cliente_telefono,
                data.fecha,
                data.hora_inicio,
                data.hora_fin,
                data.tipo_servicio,
                data.descripcion,
                data.notas,
                turno_id,
            ),
        )
        return cur.fetchone()


def update_estado_turno(conn, turno_id, estado):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE agenda_taller
            SET
                estado = %s,
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (
                estado,
                turno_id,
            ),
        )
        return cur.fetchone()