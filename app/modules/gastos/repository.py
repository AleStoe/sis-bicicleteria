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


def get_categoria_by_id(conn, categoria_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, activa, created_at
            FROM gasto_categorias
            WHERE id = %s
            """,
            (categoria_id,),
        )
        return cur.fetchone()


def insert_categoria(conn, nombre: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO gasto_categorias (nombre)
            VALUES (%s)
            ON CONFLICT (nombre)
            DO UPDATE SET activa = TRUE
            RETURNING id, nombre, activa, created_at
            """,
            (nombre,),
        )
        return cur.fetchone()


def get_categorias(conn, incluir_inactivas: bool = False):
    with conn.cursor(row_factory=dict_row) as cur:
        if incluir_inactivas:
            cur.execute(
                """
                SELECT id, nombre, activa, created_at
                FROM gasto_categorias
                ORDER BY activa DESC, nombre
                """
            )
        else:
            cur.execute(
                """
                SELECT id, nombre, activa, created_at
                FROM gasto_categorias
                WHERE activa = TRUE
                ORDER BY nombre
                """
            )
        return cur.fetchall()


def update_categoria(conn, categoria_id: int, nombre: str, activa: bool):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE gasto_categorias
            SET nombre = %s,
                activa = %s
            WHERE id = %s
            RETURNING id, nombre, activa, created_at
            """,
            (nombre, activa, categoria_id),
        )
        return cur.fetchone()


def update_categoria_estado(conn, categoria_id: int, activa: bool):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE gasto_categorias
            SET activa = %s
            WHERE id = %s
            RETURNING id, nombre, activa, created_at
            """,
            (activa, categoria_id),
        )
        return cur.fetchone()


def insert_gasto_operativo(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO gastos_operativos (
                fecha,
                id_sucursal,
                id_categoria_gasto,
                descripcion,
                monto,
                medio_pago,
                impacta_caja,
                id_caja_movimiento,
                periodo_mes,
                es_recurrente,
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
                FALSE,
                NULL,
                %s,
                %s,
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
                data.get("id_categoria_gasto"),
                data["descripcion"],
                data["monto"],
                data.get("medio_pago"),
                data.get("periodo_mes"),
                data.get("es_recurrente", False),
                data.get("origen_tipo"),
                data.get("origen_id"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def vincular_gasto_a_caja(conn, gasto_id: int, caja_movimiento_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE gastos_operativos
            SET impacta_caja = TRUE,
                id_caja_movimiento = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (caja_movimiento_id, gasto_id),
        )


def insert_gasto_movimiento(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO gastos_movimientos (
                id_gasto,
                tipo_movimiento,
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
                data["id_gasto"],
                data["tipo_movimiento"],
                data["monto"],
                data.get("detalle"),
                data.get("origen_tipo"),
                data.get("origen_id"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def _build_gastos_where(filtros: dict):
    where = []
    params = []

    if filtros.get("id_sucursal") is not None:
        where.append("g.id_sucursal = %s")
        params.append(filtros["id_sucursal"])

    if filtros.get("id_categoria_gasto") is not None:
        where.append("g.id_categoria_gasto = %s")
        params.append(filtros["id_categoria_gasto"])

    if filtros.get("estado") is not None:
        where.append("g.estado = %s")
        params.append(filtros["estado"])

    if filtros.get("medio_pago") is not None:
        where.append("g.medio_pago = %s")
        params.append(filtros["medio_pago"])

    if filtros.get("impacta_caja") is not None:
        where.append("g.impacta_caja = %s")
        params.append(filtros["impacta_caja"])

    if filtros.get("es_recurrente") is not None:
        where.append("g.es_recurrente = %s")
        params.append(filtros["es_recurrente"])

    if filtros.get("fecha_desde") is not None:
        where.append("g.fecha >= %s")
        params.append(filtros["fecha_desde"])

    if filtros.get("fecha_hasta") is not None:
        where.append("g.fecha <= %s")
        params.append(filtros["fecha_hasta"])

    if filtros.get("periodo_mes") is not None:
        where.append("g.periodo_mes = %s")
        params.append(filtros["periodo_mes"])

    if filtros.get("q"):
        where.append("g.descripcion ILIKE %s")
        params.append(f"%{filtros['q']}%")

    if not where:
        return "", params

    return "WHERE " + " AND ".join(where), params


def get_gastos(conn, filtros: dict | None = None):
    filtros = filtros or {}
    where_sql, params = _build_gastos_where(filtros)
    limit = filtros.get("limit", 200)
    offset = filtros.get("offset", 0)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                g.id,
                g.fecha,
                g.id_sucursal,
                s.nombre AS sucursal_nombre,
                g.id_categoria_gasto,
                gc.nombre AS categoria_nombre,
                g.descripcion,
                g.monto,
                g.medio_pago,
                g.impacta_caja,
                g.id_caja_movimiento,
                g.periodo_mes,
                g.es_recurrente,
                g.estado,
                g.id_usuario,
                g.created_at,
                g.updated_at
            FROM gastos_operativos g
            LEFT JOIN sucursales s ON s.id = g.id_sucursal
            LEFT JOIN gasto_categorias gc ON gc.id = g.id_categoria_gasto
            {where_sql}
            ORDER BY g.fecha DESC, g.id DESC
            LIMIT %s OFFSET %s
            """,
            (*params, limit, offset),
        )
        return cur.fetchall()


def get_gastos_resumen(conn, filtros: dict | None = None):
    filtros = filtros or {}
    where_sql, params = _build_gastos_where(filtros)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                COALESCE(SUM(g.monto), 0) AS total,
                COUNT(*)::int AS cantidad,
                COALESCE(SUM(g.monto) FILTER (WHERE g.estado = 'activo'), 0) AS total_activos,
                COUNT(*) FILTER (WHERE g.estado = 'activo')::int AS cantidad_activos,
                COALESCE(SUM(g.monto) FILTER (WHERE g.estado = 'anulado'), 0) AS total_anulados,
                COUNT(*) FILTER (WHERE g.estado = 'anulado')::int AS cantidad_anulados
            FROM gastos_operativos g
            LEFT JOIN sucursales s ON s.id = g.id_sucursal
            LEFT JOIN gasto_categorias gc ON gc.id = g.id_categoria_gasto
            {where_sql}
            """,
            params,
        )
        return cur.fetchone()


def get_gasto_by_id(conn, gasto_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                g.id,
                g.fecha,
                g.id_sucursal,
                s.nombre AS sucursal_nombre,
                g.id_categoria_gasto,
                gc.nombre AS categoria_nombre,
                g.descripcion,
                g.monto,
                g.medio_pago,
                g.impacta_caja,
                g.id_caja_movimiento,
                g.periodo_mes,
                g.es_recurrente,
                g.estado,
                g.origen_tipo,
                g.origen_id,
                g.id_usuario,
                g.created_at,
                g.updated_at
            FROM gastos_operativos g
            LEFT JOIN sucursales s ON s.id = g.id_sucursal
            LEFT JOIN gasto_categorias gc ON gc.id = g.id_categoria_gasto
            WHERE g.id = %s
            """,
            (gasto_id,),
        )
        return cur.fetchone()


def get_gasto_for_update(conn, gasto_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                id_sucursal,
                id_categoria_gasto,
                descripcion,
                monto,
                medio_pago,
                impacta_caja,
                id_caja_movimiento,
                periodo_mes,
                es_recurrente,
                estado,
                origen_tipo,
                origen_id,
                id_usuario
            FROM gastos_operativos
            WHERE id = %s
            FOR UPDATE
            """,
            (gasto_id,),
        )
        return cur.fetchone()


def get_gasto_movimientos(conn, gasto_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_gasto,
                tipo_movimiento,
                monto,
                detalle,
                origen_tipo,
                origen_id,
                id_usuario,
                created_at
            FROM gastos_movimientos
            WHERE id_gasto = %s
            ORDER BY id
            """,
            (gasto_id,),
        )
        return cur.fetchall()


def update_gasto_corregido(conn, gasto_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE gastos_operativos
            SET descripcion = %s,
                monto = %s,
                id_categoria_gasto = %s,
                medio_pago = %s,
                periodo_mes = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data["descripcion"],
                data["monto"],
                data.get("id_categoria_gasto"),
                data.get("medio_pago"),
                data.get("periodo_mes"),
                gasto_id,
            ),
        )


def update_gasto_estado(conn, gasto_id: int, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE gastos_operativos
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (estado, gasto_id),
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
