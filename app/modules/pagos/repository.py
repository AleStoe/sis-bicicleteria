from psycopg.rows import dict_row


# =========================================================
# PAGOS
# =========================================================

def insert_pago(conn, data: dict):
    """
    Inserta un pago genérico (venta, reserva, etc.)
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                estado,
                nota,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, 'confirmado', %s, %s)
            RETURNING id
            """,
            (
                data.get("id_cliente"),
                data["origen_tipo"],
                data["origen_id"],
                data["medio_pago"],
                data["monto_total_cobrado"],
                data.get("nota"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def get_pago_by_id_for_update(conn, pago_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                estado,
                nota,
                id_usuario
            FROM pagos
            WHERE id = %s
            FOR UPDATE
            """,
            (pago_id,),
        )
        return cur.fetchone()


def update_pago_estado(conn, pago_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE pagos
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (estado, pago_id),
        )


def get_pagos(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                estado,
                nota,
                id_usuario
            FROM pagos
            ORDER BY fecha DESC, id DESC
            """
        )
        return cur.fetchall()


def obtener_pagos_por_venta(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                estado,
                nota,
                id_usuario
            FROM pagos
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY fecha, id
            """,
            (venta_id,),
        )
        return cur.fetchall()


# =========================================================
# VENTAS (USADO POR PAGOS)
# =========================================================

def get_venta_for_update(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                id_sucursal,
                total_final,
                saldo_pendiente,
                estado
            FROM ventas
            WHERE id = %s
            FOR UPDATE
            """,
            (venta_id,),
        )
        return cur.fetchone()


def update_venta_saldo_y_estado(conn, venta_id: int, saldo_pendiente, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET saldo_pendiente = %s,
                estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (saldo_pendiente, estado, venta_id),
        )


# =========================================================
# REVERSIÓN DE PAGOS
# =========================================================

def insert_pago_reversion_relacion(
    conn,
    id_pago_original: int,
    id_pago_reversion: int,
    motivo: str,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pagos_reversion (
                id_pago_original,
                id_pago_reversion,
                motivo
            )
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (
                id_pago_original,
                id_pago_reversion,
                motivo,
            ),
        )
        return cur.fetchone()["id"]


def get_reversion_by_pago_original(conn, pago_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id
            FROM pagos_reversion
            WHERE id_pago_original = %s
            """,
            (pago_id,),
        )
        return cur.fetchone()