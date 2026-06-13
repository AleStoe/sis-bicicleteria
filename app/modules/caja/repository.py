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
              AND estado = 'abierta'
            ORDER BY fecha DESC, id DESC
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
            WHERE id = (
                SELECT id
                FROM cajas
                WHERE id_sucursal = %s
                  AND estado = 'abierta'
                ORDER BY fecha DESC, id DESC
                LIMIT 1
            )
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
                id_usuario_cierre = %s,
                updated_at = NOW()
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
                cm.id,
                cm.id_caja,
                cm.fecha,
                cm.tipo_movimiento,
                cm.submedio,
                cm.monto,
                cm.origen_tipo,
                cm.origen_id,
                cm.nota,
                cm.id_usuario,
                u.nombre AS usuario_nombre,
                u.username AS usuario_username,
                cm.direccion_ajuste
            FROM caja_movimientos cm
            LEFT JOIN usuarios u
                ON u.id = cm.id_usuario
            WHERE cm.id_caja = %s
            ORDER BY cm.fecha, cm.id
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

def get_cajas_historial(
    conn,
    *,
    id_sucursal: int | None = None,
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    where = []
    params = []

    if id_sucursal is not None:
        where.append("c.id_sucursal = %s")
        params.append(id_sucursal)

    if fecha_desde is not None:
        where.append("c.fecha >= %s")
        params.append(fecha_desde)

    if fecha_hasta is not None:
        where.append("c.fecha <= %s")
        params.append(fecha_hasta)

    if estado is not None:
        where.append("c.estado = %s")
        params.append(estado)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                c.id,
                c.fecha,
                c.id_sucursal,
                s.nombre AS sucursal_nombre,
                c.estado,
                c.monto_apertura,
                c.monto_cierre_teorico,
                c.monto_cierre_real,
                c.diferencia,
                c.id_usuario_apertura,
                ua.nombre AS usuario_apertura_nombre,
                ua.username AS usuario_apertura_username,
                c.id_usuario_cierre,
                uc.nombre AS usuario_cierre_nombre,
                uc.username AS usuario_cierre_username
            FROM cajas c
            LEFT JOIN sucursales s
                ON s.id = c.id_sucursal
            LEFT JOIN usuarios ua
                ON ua.id = c.id_usuario_apertura
            LEFT JOIN usuarios uc
                ON uc.id = c.id_usuario_cierre
            {where_sql}
            ORDER BY c.fecha DESC, c.id DESC
            LIMIT %s OFFSET %s
            """,
            (*params, limit, offset),
        )
        return cur.fetchall()