from psycopg.rows import dict_row


def insert_turno_agenda(conn, data):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO agenda_taller (
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                cliente_nombre,
                cliente_telefono,
                fecha,
                franja,
                hora_inicio,
                hora_fin,
                tipo_servicio,
                descripcion,
                notas,
                id_usuario_creador
            )
            VALUES (
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
            RETURNING *
            """,
            (
                data.id_sucursal,
                data.id_cliente,
                data.id_bicicleta_cliente,
                data.cliente_nombre,
                data.cliente_telefono,
                data.fecha,
                data.franja,
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
    estado=None,
    id_sucursal=None,
):
    sql = """
        SELECT
            at.*,

            CASE
                WHEN bc.id IS NULL THEN NULL
                ELSE CONCAT_WS(
                    ' · ',
                    NULLIF(TRIM(COALESCE(bc.marca, '')), ''),
                    NULLIF(TRIM(COALESCE(bc.modelo, '')), ''),
                    CASE
                        WHEN bc.numero_cuadro IS NOT NULL
                        THEN 'Cuadro ' || bc.numero_cuadro
                        ELSE NULL
                    END
                )
            END AS bicicleta_descripcion

        FROM agenda_taller at

        LEFT JOIN bicicletas_clientes bc
            ON bc.id = at.id_bicicleta_cliente

        WHERE 1=1
    """

    params = []

    if fecha_desde:
        sql += " AND at.fecha >= %s"
        params.append(fecha_desde)

    if fecha_hasta:
        sql += " AND at.fecha <= %s"
        params.append(fecha_hasta)

    if estado:
        sql += " AND at.estado = %s"
        params.append(estado)

    if id_sucursal:
        sql += " AND at.id_sucursal = %s"
        params.append(id_sucursal)

    sql += """
        ORDER BY
            at.fecha ASC,
            at.hora_inicio ASC,
            at.id ASC
    """

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_turno_agenda_by_id(conn, turno_id):
    with conn.cursor(row_factory=dict_row) as cur:
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
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE agenda_taller
            SET
                id_cliente = %s,
                id_bicicleta_cliente = %s,
                cliente_nombre = %s,
                cliente_telefono = %s,
                fecha = %s,
                franja = %s,
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
                data.id_bicicleta_cliente,
                data.cliente_nombre,
                data.cliente_telefono,
                data.fecha,
                data.franja,
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
    with conn.cursor(row_factory=dict_row) as cur:
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

def get_turno_agenda_for_update(conn, turno_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM agenda_taller
            WHERE id = %s
            FOR UPDATE
            """,
            (turno_id,),
        )
        return cur.fetchone()


def update_turno_convertido_orden(conn, turno_id, orden_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE agenda_taller
            SET
                estado = 'convertido_orden',
                id_orden_taller = %s,
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (
                orden_id,
                turno_id,
            ),
        )
        return cur.fetchone()

def marcar_recordatorio_enviado(conn, turno_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE agenda_taller
            SET
                recordatorio_enviado = TRUE,
                fecha_recordatorio = now(),
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (turno_id,),
        )
        return cur.fetchone()