from psycopg.rows import dict_row
from decimal import Decimal

def get_sucursal_by_id(conn, sucursal_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, nombre, activa
            FROM sucursales
            WHERE id = %s
            """,
            (sucursal_id,),
        )
        return cur.fetchone()


def get_caja_by_id(conn, caja_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id = %s
            """,
            (caja_id,),
        )
        return cur.fetchone()


def get_caja_by_id_for_update(conn, caja_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id = %s
            FOR UPDATE
            """,
            (caja_id,),
        )
        return cur.fetchone()


def get_caja_abierta_hoy_by_sucursal(conn, id_sucursal: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id_sucursal = %s
              AND fecha = CURRENT_DATE
              AND estado = 'abierta'
            LIMIT 1
            """,
            (id_sucursal,),
        )
        return cur.fetchone()


def get_caja_abierta_hoy_by_sucursal_for_update(conn, id_sucursal: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario_apertura,
                id_usuario_cierre
            FROM cajas
            WHERE id_sucursal = %s
              AND fecha = CURRENT_DATE
              AND estado = 'abierta'
            LIMIT 1
            FOR UPDATE
            """,
            (id_sucursal,),
        )
        return cur.fetchone()


def insert_caja(conn, id_sucursal: int, monto_apertura, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cajas (
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                id_usuario_apertura
            )
            VALUES (CURRENT_DATE, %s, 'abierta', %s, %s)
            RETURNING id
            """,
            (id_sucursal, monto_apertura, id_usuario),
        )
        return cur.fetchone()["id"]


def close_caja(
    conn,
    caja_id: int,
    monto_cierre_teorico,
    monto_cierre_real,
    diferencia,
    id_usuario: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE cajas
            SET estado = 'cerrada',
                monto_cierre_teorico = %s,
                monto_cierre_real = %s,
                diferencia = %s,
                id_usuario_cierre = %s
            WHERE id = %s
            """,
            (
                monto_cierre_teorico,
                monto_cierre_real,
                diferencia,
                id_usuario,
                caja_id,
            ),
        )


def insert_caja_movimiento(
    conn,
    id_caja,
    tipo_movimiento,
    submedio,
    monto,
    origen_tipo,
    origen_id,
    nota,
    id_usuario,
    direccion_ajuste=None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO caja_movimientos (
                id_caja,
                tipo_movimiento,
                submedio,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
                direccion_ajuste
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                id_caja,
                tipo_movimiento,
                submedio,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
                direccion_ajuste,
            ),
        )
        row = cur.fetchone()
        return row["id"]


def get_caja_movimientos(conn, caja_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_caja,
                fecha,
                tipo_movimiento,
                submedio,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
                direccion_ajuste
            FROM caja_movimientos
            WHERE id_caja = %s
            ORDER BY fecha, id
            """,
            (caja_id,),
        )
        return cur.fetchall()


def get_totales_por_submedio(conn, caja_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                submedio,
                COALESCE(SUM(
                    CASE
                        WHEN tipo_movimiento = 'ingreso' THEN monto
                        WHEN tipo_movimiento = 'egreso' THEN -monto
                        WHEN tipo_movimiento = 'ajuste' AND direccion_ajuste = 'positivo' THEN monto
                        WHEN tipo_movimiento = 'ajuste' AND direccion_ajuste = 'negativo' THEN -monto
                        ELSE 0
                    END
                ), 0) AS total
            FROM caja_movimientos
            WHERE id_caja = %s
            GROUP BY submedio
            """,
            (caja_id,),
        )
        rows = cur.fetchall()

    base = {
        "efectivo": Decimal("0"),
        "transferencia": Decimal("0"),
        "mercadopago": Decimal("0"),
        "tarjeta": Decimal("0"),
    }

    for row in rows:
        base[row["submedio"]] = row["total"]

    return base


def get_efectivo_teorico(conn, caja_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                c.monto_apertura
                + COALESCE(SUM(
                    CASE
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'ingreso' THEN cm.monto
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'egreso' THEN -cm.monto
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'ajuste' AND cm.direccion_ajuste = 'positivo' THEN cm.monto
                        WHEN cm.submedio = 'efectivo' AND cm.tipo_movimiento = 'ajuste' AND cm.direccion_ajuste = 'negativo' THEN -cm.monto
                        ELSE 0
                    END
                ), 0) AS efectivo_teorico
            FROM cajas c
            LEFT JOIN caja_movimientos cm ON cm.id_caja = c.id
            WHERE c.id = %s
            GROUP BY c.id, c.monto_apertura
            """,
            (caja_id,),
        )
        row = cur.fetchone()
        return row["efectivo_teorico"] if row else Decimal("0")