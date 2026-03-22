def get_venta_for_update(conn, venta_id: int):
    with conn.cursor() as cur:
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


def get_pago_by_id_for_update(conn, pago_id: int):
    with conn.cursor() as cur:
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


def get_reversion_by_pago_original(conn, pago_id_original: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, id_pago_original, id_pago_reversion, motivo, created_at
            FROM pagos_reversiones
            WHERE id_pago_original = %s
            """,
            (pago_id_original,),
        )
        return cur.fetchone()


def insert_pago_venta(conn, data):
    with conn.cursor() as cur:
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
            VALUES (%s, 'venta', %s, %s, %s, 'confirmado', %s, %s)
            RETURNING id
            """,
            (
                data["id_cliente"],
                data["venta_id"],
                data["medio_pago"],
                data["monto"],
                data.get("nota"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def insert_pago_reversion(conn, data):
    with conn.cursor() as cur:
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
            VALUES (%s, 'venta', %s, %s, %s, 'confirmado', %s, %s)
            RETURNING id
            """,
            (
                data["id_cliente"],
                data["venta_id"],
                data["medio_pago"],
                data["monto"],
                data.get("nota"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def insert_pago_reversion_relacion(conn, id_pago_original: int, id_pago_reversion: int, motivo: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO pagos_reversiones (
                id_pago_original,
                id_pago_reversion,
                motivo
            )
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (id_pago_original, id_pago_reversion, motivo),
        )
        return cur.fetchone()["id"]


def update_pago_estado(conn, pago_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE pagos
            SET estado = %s
            WHERE id = %s
            """,
            (estado, pago_id),
        )


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


def get_pagos(conn):
    with conn.cursor() as cur:
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
            ORDER BY id DESC
            """
        )
        return cur.fetchall()


def obtener_pagos_por_venta(conn, venta_id: int):
    with conn.cursor() as cur:
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
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY fecha, id
            """,
            (venta_id,),
        )
        return cur.fetchall()
