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


def get_sucursal_by_id(conn, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, activa
            FROM sucursales
            WHERE id = %s
            """,
            (sucursal_id,),
        )
        return cur.fetchone()


def get_variante_for_reserva(conn, variante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.nombre_variante,
                v.precio_minorista,
                v.costo_promedio_vigente,
                p.nombre AS producto_nombre,
                p.stockeable,
                p.serializable,
                p.tipo_item,
                p.activo AS producto_activo,
                v.activo AS variante_activa
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            """,
            (variante_id,),
        )
        return cur.fetchone()


def get_bicicleta_serializada_for_update(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado
            FROM bicicletas_serializadas
            WHERE id = %s
            FOR UPDATE
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()


def insert_reserva(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO reservas (
                id_cliente,
                id_sucursal,
                tipo_reserva,
                estado,
                fecha_vencimiento,
                sena_total,
                saldo_estimado,
                sena_perdida,
                nota,
                id_usuario
            )
            VALUES (%s, %s, 'comun', 'activa', %s, 0, 0, false, %s, %s)
            RETURNING id
            """,
            (
                data["id_cliente"],
                data["id_sucursal"],
                data.get("fecha_vencimiento"),
                data.get("nota"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def insert_reserva_item(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO reserva_items (
                id_reserva,
                id_variante,
                id_bicicleta_serializada,
                cantidad,
                precio_estimado,
                subtotal_estimado
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_reserva"],
                data["id_variante"],
                data.get("id_bicicleta_serializada"),
                data["cantidad"],
                data["precio_estimado"],
                data["subtotal_estimado"],
            ),
        )
        return cur.fetchone()["id"]


def update_bicicleta_serializada_estado(conn, bicicleta_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (estado, bicicleta_id),
        )


def insert_reserva_evento(
    conn,
    id_reserva: int,
    tipo_evento: str,
    detalle: str | None,
    id_usuario: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO reserva_eventos (
                id_reserva,
                tipo_evento,
                detalle,
                id_usuario
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (id_reserva, tipo_evento, detalle, id_usuario),
        )
        return cur.fetchone()["id"]


def update_reserva_estado(conn, reserva_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE reservas
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (estado, reserva_id),
        )


def update_reserva_cancelacion(
    conn,
    reserva_id: int,
    sena_perdida: bool,
    nota_adicional: str | None = None,
):
    with conn.cursor() as cur:
        if nota_adicional is None:
            cur.execute(
                """
                UPDATE reservas
                SET estado = 'cancelada',
                    sena_perdida = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (sena_perdida, reserva_id),
            )
        else:
            cur.execute(
                """
                UPDATE reservas
                SET estado = 'cancelada',
                    sena_perdida = %s,
                    nota = CONCAT(
                        COALESCE(nota, ''),
                        CASE
                            WHEN COALESCE(nota, '') = '' THEN ''
                            ELSE ' | '
                        END,
                        %s
                    ),
                    updated_at = NOW()
                WHERE id = %s
                """,
                (sena_perdida, nota_adicional, reserva_id),
            )


def get_reserva_by_id_for_update(conn, reserva_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                r.id,
                r.fecha_reserva,
                r.id_cliente,
                c.nombre AS cliente_nombre,
                r.id_sucursal,
                s.nombre AS sucursal_nombre,
                r.tipo_reserva,
                r.estado,
                r.fecha_vencimiento,
                r.sena_total,
                r.saldo_estimado,
                r.sena_perdida,
                r.nota,
                r.id_usuario
            FROM reservas r
            INNER JOIN clientes c ON c.id = r.id_cliente
            INNER JOIN sucursales s ON s.id = r.id_sucursal
            WHERE r.id = %s
            FOR UPDATE
            """,
            (reserva_id,),
        )
        return cur.fetchone()


def get_reserva_by_id(conn, reserva_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                r.id,
                r.fecha_reserva,
                r.id_cliente,
                c.nombre AS cliente_nombre,
                r.id_sucursal,
                s.nombre AS sucursal_nombre,
                r.tipo_reserva,
                r.estado,
                r.fecha_vencimiento,
                r.sena_total,
                r.saldo_estimado,
                r.sena_perdida,
                r.nota,
                r.id_usuario
            FROM reservas r
            INNER JOIN clientes c ON c.id = r.id_cliente
            INNER JOIN sucursales s ON s.id = r.id_sucursal
            WHERE r.id = %s
            """,
            (reserva_id,),
        )
        return cur.fetchone()


def get_reserva_items(conn, reserva_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                ri.id,
                ri.id_reserva,
                ri.id_variante,
                ri.id_bicicleta_serializada,
                CONCAT(p.nombre, ' - ', v.nombre_variante) AS descripcion_snapshot,
                ri.cantidad,
                ri.precio_estimado,
                ri.subtotal_estimado,
                v.costo_promedio_vigente,
                r.id_sucursal
            FROM reserva_items ri
            INNER JOIN reservas r ON r.id = ri.id_reserva
            INNER JOIN variantes v ON v.id = ri.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE ri.id_reserva = %s
            ORDER BY ri.id
            """,
            (reserva_id,),
        )
        return cur.fetchall()


def get_reserva_eventos(conn, reserva_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                tipo_evento,
                detalle,
                id_usuario
            FROM reserva_eventos
            WHERE id_reserva = %s
            ORDER BY fecha, id
            """,
            (reserva_id,),
        )
        return cur.fetchall()


def get_reserva_pagos(conn, reserva_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                medio_pago,
                monto_total_cobrado,
                estado,
                nota,
                id_usuario
            FROM pagos
            WHERE origen_tipo = 'reserva'
              AND origen_id = %s
            ORDER BY fecha, id
            """,
            (reserva_id,),
        )
        return cur.fetchall()


def list_reservas(
    conn,
    estado=None,
    id_cliente=None,
    id_sucursal=None,
    solo_vencidas: bool = False,
    q: str | None = None,
):
    condiciones = []
    params = []

    if estado:
        condiciones.append("r.estado = %s")
        params.append(estado)

    if id_cliente:
        condiciones.append("r.id_cliente = %s")
        params.append(id_cliente)

    if id_sucursal:
        condiciones.append("r.id_sucursal = %s")
        params.append(id_sucursal)

    if solo_vencidas:
        condiciones.append("r.estado = 'vencida'")

    if q:
        condiciones.append("(c.nombre ILIKE %s OR COALESCE(r.nota, '') ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like])

    where_sql = ""
    if condiciones:
        where_sql = "WHERE " + " AND ".join(condiciones)

    sql = f"""
        SELECT
            r.id,
            r.fecha_reserva,
            r.id_cliente,
            c.nombre AS cliente_nombre,
            r.id_sucursal,
            s.nombre AS sucursal_nombre,
            r.tipo_reserva,
            r.estado,
            r.fecha_vencimiento,
            r.sena_total,
            r.saldo_estimado,
            CASE
                WHEN r.saldo_estimado > 0 AND r.sena_total > 0
                THEN ((r.sena_total / NULLIF((r.sena_total + r.saldo_estimado), 0)) < 0.20)
                ELSE false
            END AS sena_baja
        FROM reservas r
        INNER JOIN clientes c ON c.id = r.id_cliente
        INNER JOIN sucursales s ON s.id = r.id_sucursal
        {where_sql}
        ORDER BY r.fecha_reserva DESC, r.id DESC
    """

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()

def actualizar_totales_reserva(
    conn,
    reserva_id: int,
    total_estimado: float,
    sena_total: float,
    saldo_estimado: float,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE reservas
            SET
                sena_total = %s,
                saldo_estimado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                sena_total,
                saldo_estimado,
                reserva_id,
            ),
        )