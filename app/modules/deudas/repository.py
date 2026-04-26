from psycopg.rows import dict_row


def get_cliente_by_id(conn, cliente_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, activo
            FROM clientes
            WHERE id = %s
            """,
            (cliente_id,),
        )
        return cur.fetchone()


def get_venta_by_id_for_update(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                id_sucursal,
                estado,
                total_final,
                saldo_pendiente
            FROM ventas
            WHERE id = %s
            FOR UPDATE
            """,
            (venta_id,),
        )
        return cur.fetchone()


def get_deuda_by_id(conn, deuda_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM deudas_cliente
            WHERE id = %s
            """,
            (deuda_id,),
        )
        return cur.fetchone()


def get_deuda_by_id_for_update(conn, deuda_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM deudas_cliente
            WHERE id = %s
            FOR UPDATE
            """,
            (deuda_id,),
        )
        return cur.fetchone()


def get_deuda_abierta_by_origen(conn, origen_tipo: str, origen_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM deudas_cliente
            WHERE origen_tipo = %s
              AND origen_id = %s
              AND estado = 'abierta'
            """,
            (origen_tipo, origen_id),
        )
        return cur.fetchone()


def get_deudas(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                d.*,
                c.nombre AS cliente_nombre
            FROM deudas_cliente d
            INNER JOIN clientes c
                ON c.id = d.id_cliente
            ORDER BY d.id DESC
            """
        )
        return cur.fetchall()


def get_deuda_movimientos(conn, deuda_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM deuda_movimientos
            WHERE id_deuda = %s
            ORDER BY id
            """,
            (deuda_id,),
        )
        return cur.fetchall()


def insert_deuda_cliente(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO deudas_cliente (
                id_cliente,
                origen_tipo,
                origen_id,
                saldo_actual,
                genera_recargo,
                tasa_recargo,
                proximo_vencimiento,
                estado,
                observacion
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["id_cliente"],
                data["origen_tipo"],
                data["origen_id"],
                data["saldo_actual"],
                data.get("genera_recargo", False),
                data.get("tasa_recargo"),
                data.get("proximo_vencimiento"),
                data.get("estado", "abierta"),
                data.get("observacion"),
            ),
        )
        return cur.fetchone()


def insert_deuda_movimiento(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO deuda_movimientos (
                id_deuda,
                tipo_movimiento,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["id_deuda"],
                data["tipo_movimiento"],
                data["monto"],
                data.get("origen_tipo"),
                data.get("origen_id"),
                data.get("nota"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()


def update_deuda_saldo_y_estado(conn, deuda_id: int, saldo_actual, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE deudas_cliente
            SET
                saldo_actual = %s,
                estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (saldo_actual, estado, deuda_id),
        )
    
def get_deudas_filtradas(
    conn,
    *,
    id_cliente: int | None = None,
    estado: str | None = None,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
):
    sql = """
        SELECT
            d.*,
            c.nombre AS cliente_nombre
        FROM deudas_cliente d
        INNER JOIN clientes c
            ON c.id = d.id_cliente
        WHERE 1=1
    """
    params = []

    if id_cliente is not None:
        sql += " AND d.id_cliente = %s"
        params.append(id_cliente)

    if estado is not None:
        sql += " AND d.estado = %s"
        params.append(estado)

    if origen_tipo is not None:
        sql += " AND d.origen_tipo = %s"
        params.append(origen_tipo)

    if origen_id is not None:
        sql += " AND d.origen_id = %s"
        params.append(origen_id)

    sql += " ORDER BY d.id DESC"

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, tuple(params))
        return cur.fetchall()