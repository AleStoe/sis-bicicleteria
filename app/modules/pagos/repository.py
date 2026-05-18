from psycopg.rows import dict_row
from decimal import Decimal

# =========================================================
# PAGOS
# =========================================================

def insert_pago(conn, data: dict):
    """
    Inserta un pago genérico.
    V2:
    - monto_total_cobrado: dinero real que entra a caja
    - monto_base_aplicado: base comercial del tramo
    - monto_descuento_aplicado: descuento congelado del tramo
    - monto_recargo_aplicado: recargo congelado del tramo
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
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
                estado,
                nota,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'confirmado', %s, %s)
            RETURNING id
            """,
            (
                data.get("id_cliente"),
                data["origen_tipo"],
                data["origen_id"],
                data["medio_pago"],
                data["monto_total_cobrado"],
                data.get("monto_base_aplicado", data["monto_total_cobrado"]),
                data.get("monto_descuento_aplicado", Decimal("0")),
                data.get("monto_recargo_aplicado", Decimal("0")),
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
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
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
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
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
                p.id,
                p.fecha,
                p.id_cliente,
                p.origen_tipo,
                p.origen_id,
                p.medio_pago,
                p.monto_total_cobrado,
                p.monto_base_aplicado,
                p.monto_descuento_aplicado,
                p.monto_recargo_aplicado,
                p.estado,
                p.nota,
                p.id_usuario,

                d.id_tarjeta_plan,
                tp.nombre AS tarjeta_plan_nombre,
                d.cuotas,
                d.entidad,
                d.monto_base,
                d.monto_recargo_financiero,
                d.porcentaje_recargo_aplicado,
                d.monto_neto_liquidado

            FROM pagos p
            LEFT JOIN pagos_tarjeta_detalle d
                ON d.id_pago = p.id
            LEFT JOIN tarjeta_planes tp
                ON tp.id = d.id_tarjeta_plan
            WHERE p.origen_tipo = 'venta'
              AND p.origen_id = %s
            ORDER BY p.fecha, p.id
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


def get_total_pagado_confirmado_por_venta(conn, venta_id: int) -> Decimal:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(monto_total_cobrado), 0) AS total_pagado
            FROM pagos
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
              AND estado = 'confirmado'
            """,
            (venta_id,),
        )
        row = cur.fetchone()
        return Decimal(str(row["total_pagado"]))


def insert_pago_tarjeta_detalle(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO pagos_tarjeta_detalle (
                id_pago,
                id_tarjeta_plan,
                monto_base,
                monto_recargo_financiero,
                porcentaje_recargo_aplicado,
                monto_neto_liquidado,
                cuotas,
                entidad,
                observacion
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_pago"],
                data.get("id_tarjeta_plan"),
                data["monto_base"],
                data["monto_recargo_financiero"],
                data.get("porcentaje_recargo_aplicado"),
                data["monto_neto_liquidado"],
                data["cuotas"],
                data["entidad"],
                data.get("observacion"),
            ),
        )
        return cur.fetchone()["id"]