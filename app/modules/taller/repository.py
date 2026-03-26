from psycopg.rows import dict_row


def validar_sucursal_activa(conn, id_sucursal: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM sucursales
            WHERE id = %s
              AND activa = TRUE
            """,
            (id_sucursal,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("La sucursal no existe o está inactiva")


def validar_usuario_activo(conn, id_usuario: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM usuarios
            WHERE id = %s
              AND activo = TRUE
            """,
            (id_usuario,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El usuario no existe o está inactivo")


def validar_cliente_existente(conn, id_cliente: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM clientes
            WHERE id = %s
            """,
            (id_cliente,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El cliente no existe")


def get_bicicleta_cliente(conn, id_bicicleta_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            FROM bicicletas_clientes
            WHERE id = %s
            """,
            (id_bicicleta_cliente,),
        )
        return cur.fetchone()


def insert_orden_taller(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ordenes_taller (
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                fecha_ingreso,
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                observaciones,
                fecha_prometida,
                total_final,
                saldo_pendiente,
                id_usuario,
                created_at,
                updated_at
            """,
            (
                data["id_sucursal"],
                data["id_cliente"],
                data["id_bicicleta_cliente"],
                data["estado"],
                data["problema_reportado"],
                data["id_usuario"],
            ),
        )
        return cur.fetchone()


def get_ordenes_taller(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha_ingreso,
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                observaciones,
                fecha_prometida,
                total_final,
                saldo_pendiente,
                id_usuario,
                created_at,
                updated_at
            FROM ordenes_taller
            ORDER BY fecha_ingreso DESC, id DESC
            """
        )
        return cur.fetchall()


def get_orden_taller_by_id(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha_ingreso,
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                observaciones,
                fecha_prometida,
                total_final,
                saldo_pendiente,
                id_usuario,
                created_at,
                updated_at
            FROM ordenes_taller
            WHERE id = %s
            """,
            (orden_id,),
        )
        return cur.fetchone()


def get_orden_taller_by_id_for_update(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha_ingreso,
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                observaciones,
                fecha_prometida,
                total_final,
                saldo_pendiente,
                id_usuario,
                created_at,
                updated_at
            FROM ordenes_taller
            WHERE id = %s
            FOR UPDATE
            """,
            (orden_id,),
        )
        return cur.fetchone()


def update_orden_taller_estado(conn, orden_id: int, nuevo_estado: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ordenes_taller
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_estado, orden_id),
        )


def insert_orden_taller_evento(
    conn,
    id_orden_taller: int,
    tipo_evento: str,
    detalle: str | None,
    id_usuario: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ordenes_taller_eventos (
                id_orden_taller,
                tipo_evento,
                detalle,
                id_usuario
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                id,
                id_orden_taller,
                fecha,
                tipo_evento,
                detalle,
                id_usuario,
                created_at
            """,
            (id_orden_taller, tipo_evento, detalle, id_usuario),
        )
        return cur.fetchone()


def get_eventos_orden_taller(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_orden_taller,
                fecha,
                tipo_evento,
                detalle,
                id_usuario,
                created_at
            FROM ordenes_taller_eventos
            WHERE id_orden_taller = %s
            ORDER BY fecha, id
            """,
            (orden_id,),
        )
        return cur.fetchall()