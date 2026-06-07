from psycopg.rows import dict_row


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


def get_participante_by_id(conn, participante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, tipo, activo, observaciones, created_at, updated_at
            FROM capital_participantes
            WHERE id = %s
            """,
            (participante_id,),
        )
        return cur.fetchone()


def insert_participante(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO capital_participantes (nombre, tipo, observaciones)
            VALUES (%s, %s, %s)
            ON CONFLICT (nombre)
            DO UPDATE SET activo = TRUE,
                          tipo = EXCLUDED.tipo,
                          observaciones = EXCLUDED.observaciones,
                          updated_at = NOW()
            RETURNING id, nombre, tipo, activo, observaciones, created_at, updated_at
            """,
            (data["nombre"], data["tipo"], data.get("observaciones")),
        )
        return cur.fetchone()


def update_participante(conn, participante_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE capital_participantes
            SET nombre = %s,
                tipo = %s,
                activo = %s,
                observaciones = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id, nombre, tipo, activo, observaciones, created_at, updated_at
            """,
            (
                data["nombre"],
                data["tipo"],
                data["activo"],
                data.get("observaciones"),
                participante_id,
            ),
        )
        return cur.fetchone()


def update_participante_estado(conn, participante_id: int, activo: bool):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE capital_participantes
            SET activo = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id, nombre, tipo, activo, observaciones, created_at, updated_at
            """,
            (activo, participante_id),
        )
        return cur.fetchone()


def get_participantes(conn, incluir_inactivos: bool = False):
    with conn.cursor(row_factory=dict_row) as cur:
        if incluir_inactivos:
            cur.execute(
                """
                SELECT id, nombre, tipo, activo, observaciones, created_at, updated_at
                FROM capital_participantes
                ORDER BY activo DESC, tipo, nombre
                """
            )
        else:
            cur.execute(
                """
                SELECT id, nombre, tipo, activo, observaciones, created_at, updated_at
                FROM capital_participantes
                WHERE activo = TRUE
                ORDER BY tipo, nombre
                """
            )
        return cur.fetchall()


def get_saldo_prestamo_participante(conn, participante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN tipo_movimiento = 'prestamo_socio' THEN monto
                        WHEN tipo_movimiento = 'devolucion_prestamo' THEN -monto
                        ELSE 0
                    END
                ), 0) AS saldo_prestamo
            FROM capital_movimientos
            WHERE id_participante = %s
              AND estado = 'activo'
            """,
            (participante_id,),
        )
        return cur.fetchone()["saldo_prestamo"]


def insert_movimiento_capital(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO capital_movimientos (
                fecha,
                id_sucursal,
                id_participante,
                tipo_movimiento,
                descripcion,
                monto,
                medio_pago,
                impacta_caja,
                id_caja_movimiento,
                estado,
                origen_tipo,
                origen_id,
                id_usuario
            )
            VALUES (
                COALESCE(%s, CURRENT_DATE),
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                FALSE,
                NULL,
                'activo',
                %s,
                %s,
                %s
            )
            RETURNING id
            """,
            (
                data.get("fecha"),
                data.get("id_sucursal"),
                data["id_participante"],
                data["tipo_movimiento"],
                data["descripcion"],
                data["monto"],
                data.get("medio_pago"),
                data.get("origen_tipo"),
                data.get("origen_id"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def vincular_movimiento_a_caja(conn, movimiento_id: int, caja_movimiento_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE capital_movimientos
            SET impacta_caja = TRUE,
                id_caja_movimiento = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (caja_movimiento_id, movimiento_id),
        )


def insert_historial(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO capital_movimientos_historial (
                id_movimiento,
                tipo_evento,
                monto,
                detalle,
                origen_tipo,
                origen_id,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_movimiento"],
                data["tipo_evento"],
                data["monto"],
                data.get("detalle"),
                data.get("origen_tipo"),
                data.get("origen_id"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def _build_movimientos_where(filtros: dict):
    where = []
    params = []

    if filtros.get("id_participante") is not None:
        where.append("m.id_participante = %s")
        params.append(filtros["id_participante"])

    if filtros.get("id_sucursal") is not None:
        where.append("m.id_sucursal = %s")
        params.append(filtros["id_sucursal"])

    if filtros.get("tipo_movimiento") is not None:
        where.append("m.tipo_movimiento = %s")
        params.append(filtros["tipo_movimiento"])

    if filtros.get("estado") is not None:
        where.append("m.estado = %s")
        params.append(filtros["estado"])

    if filtros.get("medio_pago") is not None:
        where.append("m.medio_pago = %s")
        params.append(filtros["medio_pago"])

    if filtros.get("impacta_caja") is not None:
        where.append("m.impacta_caja = %s")
        params.append(filtros["impacta_caja"])

    if filtros.get("fecha_desde") is not None:
        where.append("m.fecha >= %s")
        params.append(filtros["fecha_desde"])

    if filtros.get("fecha_hasta") is not None:
        where.append("m.fecha <= %s")
        params.append(filtros["fecha_hasta"])

    if filtros.get("q"):
        where.append("m.descripcion ILIKE %s")
        params.append(f"%{filtros['q']}%")

    if not where:
        return "", params

    return "WHERE " + " AND ".join(where), params


def get_movimientos(conn, filtros: dict | None = None):
    filtros = filtros or {}
    where_sql, params = _build_movimientos_where(filtros)
    limit = filtros.get("limit", 200)
    offset = filtros.get("offset", 0)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                m.id,
                m.fecha,
                m.id_sucursal,
                s.nombre AS sucursal_nombre,
                m.id_participante,
                p.nombre AS participante_nombre,
                p.tipo AS participante_tipo,
                m.tipo_movimiento,
                m.descripcion,
                m.monto,
                m.medio_pago,
                m.impacta_caja,
                m.id_caja_movimiento,
                m.estado,
                m.id_usuario,
                m.created_at,
                m.updated_at
            FROM capital_movimientos m
            INNER JOIN capital_participantes p ON p.id = m.id_participante
            LEFT JOIN sucursales s ON s.id = m.id_sucursal
            {where_sql}
            ORDER BY m.fecha DESC, m.id DESC
            LIMIT %s OFFSET %s
            """,
            (*params, limit, offset),
        )
        return cur.fetchall()


def get_movimiento_by_id(conn, movimiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                m.id,
                m.fecha,
                m.id_sucursal,
                s.nombre AS sucursal_nombre,
                m.id_participante,
                p.nombre AS participante_nombre,
                p.tipo AS participante_tipo,
                m.tipo_movimiento,
                m.descripcion,
                m.monto,
                m.medio_pago,
                m.impacta_caja,
                m.id_caja_movimiento,
                m.estado,
                m.id_usuario,
                m.created_at,
                m.updated_at
            FROM capital_movimientos m
            INNER JOIN capital_participantes p ON p.id = m.id_participante
            LEFT JOIN sucursales s ON s.id = m.id_sucursal
            WHERE m.id = %s
            """,
            (movimiento_id,),
        )
        return cur.fetchone()


def get_movimiento_for_update(conn, movimiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM capital_movimientos
            WHERE id = %s
            FOR UPDATE
            """,
            (movimiento_id,),
        )
        return cur.fetchone()


def get_historial(conn, movimiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_movimiento,
                tipo_evento,
                monto,
                detalle,
                origen_tipo,
                origen_id,
                id_usuario,
                created_at
            FROM capital_movimientos_historial
            WHERE id_movimiento = %s
            ORDER BY id
            """,
            (movimiento_id,),
        )
        return cur.fetchall()


def update_movimiento_estado(conn, movimiento_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE capital_movimientos
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (estado, movimiento_id),
        )


def get_caja_movimiento_with_caja_for_update(conn, caja_movimiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                cm.id,
                cm.id_caja,
                cm.submedio,
                cm.monto,
                cm.origen_tipo,
                cm.origen_id,
                c.estado AS caja_estado,
                c.id_sucursal
            FROM caja_movimientos cm
            INNER JOIN cajas c ON c.id = cm.id_caja
            WHERE cm.id = %s
            FOR UPDATE
            """,
            (caja_movimiento_id,),
        )
        return cur.fetchone()


def get_resumen(conn, filtros: dict | None = None):
    filtros = filtros or {}
    where_sql, params = _build_movimientos_where({**filtros, "estado": "activo"})

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                p.id AS id_participante,
                p.nombre AS participante_nombre,
                p.tipo AS participante_tipo,
                COALESCE(SUM(m.monto) FILTER (WHERE m.tipo_movimiento = 'aporte_capital'), 0) AS total_aportes,
                COALESCE(SUM(m.monto) FILTER (WHERE m.tipo_movimiento = 'prestamo_socio'), 0) AS total_prestamos,
                COALESCE(SUM(m.monto) FILTER (WHERE m.tipo_movimiento = 'devolucion_prestamo'), 0) AS total_devoluciones_prestamo,
                COALESCE(SUM(m.monto) FILTER (WHERE m.tipo_movimiento = 'retiro_personal'), 0) AS total_retiros,
                COALESCE(SUM(m.monto) FILTER (WHERE m.tipo_movimiento = 'distribucion_ganancia'), 0) AS total_distribuciones
            FROM capital_movimientos m
            INNER JOIN capital_participantes p ON p.id = m.id_participante
            LEFT JOIN sucursales s ON s.id = m.id_sucursal
            {where_sql}
            GROUP BY p.id, p.nombre, p.tipo
            ORDER BY p.tipo, p.nombre
            """,
            params,
        )
        return cur.fetchall()
