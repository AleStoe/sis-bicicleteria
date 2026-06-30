from psycopg.rows import dict_row


_BASE_SELECT_TURNOS = """
    SELECT
        at.*,
        bc.id_bicicleta_serializada,
        bc.id_venta_origen AS bicicleta_id_venta_origen,
        bc.fecha_compra AS bicicleta_fecha_venta,
        bc.plan_postventa,
        bc.fecha_limite_service_gratis,
        bc.service_gratis_usado,
        bc.service_gratis_autorizado_fuera_plazo,
        CASE
            WHEN bc.id IS NULL THEN NULL
            ELSE CONCAT_WS(
                ' · ',
                NULLIF(TRIM(COALESCE(bc.marca, '')), ''),
                NULLIF(TRIM(COALESCE(bc.modelo, '')), ''),
                CASE
                    WHEN bc.numero_cuadro IS NOT NULL AND TRIM(bc.numero_cuadro) <> ''
                    THEN 'Cuadro ' || bc.numero_cuadro
                    ELSE NULL
                END
            )
        END AS bicicleta_descripcion
    FROM agenda_taller at
    LEFT JOIN bicicletas_clientes bc
        ON bc.id = at.id_bicicleta_cliente
"""


def insert_turno_agenda(conn, data, *, id_venta_origen=None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO agenda_taller (
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                id_venta_origen,
                cliente_nombre,
                cliente_telefono,
                fecha,
                franja,
                hora_inicio,
                hora_fin,
                fecha_prometida_entrega,
                tipo_turno,
                tipo_servicio,
                descripcion,
                notas,
                id_usuario_creador
            )
            VALUES (
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
            RETURNING *
            """,
            (
                data.id_sucursal,
                data.id_cliente,
                data.id_bicicleta_cliente,
                id_venta_origen,
                data.cliente_nombre,
                data.cliente_telefono,
                data.fecha,
                data.franja,
                data.hora_inicio,
                data.hora_fin,
                data.fecha_prometida_entrega,
                data.tipo_turno,
                data.tipo_servicio,
                data.descripcion,
                data.notas,
                data.id_usuario_creador,
            ),
        )
        return cur.fetchone()


def insert_historial_turno(
    conn,
    *,
    id_turno_agenda,
    tipo_evento,
    detalle=None,
    fecha_anterior=None,
    fecha_nueva=None,
    hora_inicio_anterior=None,
    hora_inicio_nueva=None,
    estado_anterior=None,
    estado_nuevo=None,
    id_usuario=None,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO agenda_taller_historial (
                id_turno_agenda,
                tipo_evento,
                detalle,
                fecha_anterior,
                fecha_nueva,
                hora_inicio_anterior,
                hora_inicio_nueva,
                estado_anterior,
                estado_nuevo,
                id_usuario
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING *
            """,
            (
                id_turno_agenda,
                tipo_evento,
                detalle,
                fecha_anterior,
                fecha_nueva,
                hora_inicio_anterior,
                hora_inicio_nueva,
                estado_anterior,
                estado_nuevo,
                id_usuario,
            ),
        )
        return cur.fetchone()


def get_turnos_agenda(
    conn,
    fecha_desde=None,
    fecha_hasta=None,
    estado=None,
    id_sucursal=None,
    solo_pendientes=False,
    mostrar_convertidos=False,
):
    sql = _BASE_SELECT_TURNOS + " WHERE 1=1"
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
    elif solo_pendientes:
        sql += " AND at.estado IN ('pendiente', 'confirmado', 'en_taller')"
    elif not mostrar_convertidos:
        sql += " AND at.estado <> 'convertido_orden'"

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


def get_turnos_agenda_para_fecha(conn, fecha, id_sucursal=None):
    sql = _BASE_SELECT_TURNOS + """
        WHERE at.fecha = %s
          AND at.estado IN ('pendiente', 'confirmado', 'en_taller')
    """
    params = [fecha]

    if id_sucursal:
        sql += " AND at.id_sucursal = %s"
        params.append(id_sucursal)

    sql += """
        ORDER BY
            at.hora_inicio ASC,
            at.id ASC
    """

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_turnos_agenda_atrasados(conn, fecha_limite, id_sucursal=None):
    sql = _BASE_SELECT_TURNOS + """
        WHERE at.fecha < %s
          AND at.estado IN ('pendiente', 'confirmado', 'en_taller')
    """
    params = [fecha_limite]

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
            _BASE_SELECT_TURNOS + " WHERE at.id = %s",
            (turno_id,),
        )
        return cur.fetchone()


def get_historial_turno(conn, turno_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM agenda_taller_historial
            WHERE id_turno_agenda = %s
            ORDER BY created_at ASC, id ASC
            """,
            (turno_id,),
        )
        return cur.fetchall()


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


def get_turno_postventa_activo_por_bicicleta(
    conn,
    bicicleta_id,
    *,
    excluir_turno_id=None,
):
    sql = """
        SELECT id
        FROM agenda_taller
        WHERE id_bicicleta_cliente = %s
          AND tipo_turno = 'service_postventa_30_dias'
          AND estado IN ('pendiente', 'confirmado', 'en_taller')
    """
    params = [bicicleta_id]

    if excluir_turno_id is not None:
        sql += " AND id <> %s"
        params.append(excluir_turno_id)

    sql += " ORDER BY id DESC LIMIT 1"

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def update_turno_agenda(conn, turno_id, data, *, id_venta_origen=None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE agenda_taller
            SET
                id_cliente = %s,
                id_bicicleta_cliente = %s,
                id_venta_origen = %s,
                cliente_nombre = %s,
                cliente_telefono = %s,
                fecha = %s,
                franja = %s,
                hora_inicio = %s,
                hora_fin = %s,
                fecha_prometida_entrega = %s,
                tipo_turno = %s,
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
                id_venta_origen,
                data.cliente_nombre,
                data.cliente_telefono,
                data.fecha,
                data.franja,
                data.hora_inicio,
                data.hora_fin,
                data.fecha_prometida_entrega,
                data.tipo_turno,
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
            (estado, turno_id),
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
            (orden_id, turno_id),
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


def marcar_cliente_avisado(conn, turno_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE agenda_taller
            SET
                cliente_avisado = TRUE,
                fecha_cliente_avisado = now(),
                updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (turno_id,),
        )
        return cur.fetchone()
