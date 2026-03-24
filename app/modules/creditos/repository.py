from psycopg.rows import dict_row
from decimal import Decimal

def insert_credito_cliente(
    conn,
    *,
    id_cliente: int,
    origen_tipo: str,
    origen_id: int,
    saldo_actual: Decimal,
    observacion: str | None = None,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO creditos_cliente (
                id_cliente,
                origen_tipo,
                origen_id,
                saldo_actual,
                estado,
                observacion
            )
            VALUES (%s, %s, %s, %s, 'abierto', %s)
            RETURNING *
            """,
            (
                id_cliente,
                origen_tipo,
                origen_id,
                saldo_actual,
                observacion,
            ),
        )
        return cur.fetchone()



def insert_credito_movimiento(
    conn,
    *,
    id_credito: int,
    tipo_movimiento: str,
    monto: Decimal,
    origen_tipo: str | None,
    origen_id: int | None,
    nota: str | None,
    id_usuario: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO credito_movimientos (
                id_credito,
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
                id_credito,
                tipo_movimiento,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
            ),
        )
        return cur.fetchone()


def get_credito_by_id(conn, credito_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id = %s
            """,
            (credito_id,),
        )
        return cur.fetchone()


def get_creditos_cliente(conn, id_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
            ORDER BY id DESC
            """,
            (id_cliente,),
        )
        return cur.fetchall()


def get_credito_movimientos_by_credito(conn, credito_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM credito_movimientos
            WHERE id_credito = %s
            ORDER BY id
            """,
            (credito_id,),
        )
        return cur.fetchall()

def get_credito_abierto_by_origen(conn, *, origen_tipo: str, origen_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE origen_tipo = %s
              AND origen_id = %s
              AND estado IN ('abierto', 'aplicado_parcial')
            ORDER BY id DESC
            LIMIT 1
            """,
            (origen_tipo, origen_id),
        )
        return cur.fetchone()

def get_creditos_disponibles_cliente(conn, id_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
              AND estado IN ('abierto', 'aplicado_parcial')
              AND saldo_actual > 0
            ORDER BY id ASC
            """,
            (id_cliente,),
        )
        return cur.fetchall()


def update_credito_saldo_y_estado(
    conn,
    *,
    credito_id: int,
    saldo_actual: Decimal,
    estado: str,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE creditos_cliente
            SET saldo_actual = %s,
                estado = %s
            WHERE id = %s
            RETURNING *
            """,
            (
                saldo_actual,
                estado,
                credito_id,
            ),
        )
        return cur.fetchone()

def get_credito_movimientos(conn, credito_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM credito_movimientos
            WHERE id_credito = %s
            ORDER BY id ASC
            """,
            (credito_id,),
        )
        return cur.fetchall()


def get_creditos_disponibles_cliente_for_update(conn, id_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
              AND estado IN ('abierto', 'aplicado_parcial')
              AND saldo_actual > 0
            ORDER BY id ASC
            FOR UPDATE
            """,
            (id_cliente,),
        )
        return cur.fetchall()