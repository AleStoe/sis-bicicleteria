from psycopg.rows import dict_row


def get_reglas_comerciales(conn, solo_activas: bool = True):
    with conn.cursor(row_factory=dict_row) as cur:
        filtros = []
        params = []

        if solo_activas:
            filtros.append("activa = TRUE")

        where_sql = f"WHERE {' AND '.join(filtros)}" if filtros else ""

        cur.execute(
            f"""
            SELECT
                id,
                nombre,
                tipo,
                medio_pago,
                porcentaje,
                monto_fijo,
                requiere_pago_total,
                combinable,
                prioridad,
                activa,
                fecha_desde,
                fecha_hasta,
                created_at,
                updated_at
            FROM reglas_comerciales
            {where_sql}
            ORDER BY activa DESC, prioridad ASC, id ASC
            """,
            params,
        )
        return cur.fetchall()


def get_reglas_activas_por_medios(conn, medios_pago: list[str]):
    if not medios_pago:
        return []

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                tipo,
                medio_pago,
                porcentaje,
                monto_fijo,
                requiere_pago_total,
                combinable,
                prioridad,
                activa,
                fecha_desde,
                fecha_hasta,
                created_at,
                updated_at
            FROM reglas_comerciales
            WHERE activa = TRUE
              AND (
                    medio_pago IS NULL
                    OR medio_pago = ANY(%s)
              )
              AND (fecha_desde IS NULL OR fecha_desde <= NOW())
              AND (fecha_hasta IS NULL OR fecha_hasta >= NOW())
            ORDER BY prioridad ASC, id ASC
            """,
            (medios_pago,),
        )
        return cur.fetchall()
    
def get_tarjeta_plan_activo(conn, *, medio_pago: str, cuotas: int, entidad: str | None = None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                medio_pago,
                entidad,
                cuotas,
                porcentaje_recargo_cliente,
                porcentaje_costo_financiero,
                activa,
                fecha_desde,
                fecha_hasta
            FROM tarjeta_planes
            WHERE activa = TRUE
              AND medio_pago = %s
              AND cuotas = %s
              AND (entidad IS NULL OR entidad = %s)
              AND (fecha_desde IS NULL OR fecha_desde <= NOW())
              AND (fecha_hasta IS NULL OR fecha_hasta >= NOW())
            ORDER BY
                CASE WHEN entidad = %s THEN 0 ELSE 1 END,
                id DESC
            LIMIT 1
            """,
            (medio_pago, cuotas, entidad, entidad),
        )
        return cur.fetchone()
    
def update_regla_comercial(conn, regla_id: int, data: dict):
    campos = []
    params = []

    for campo, valor in data.items():
        if valor is not None:
            campos.append(f"{campo} = %s")
            params.append(valor)

    if not campos:
        return None

    campos.append("updated_at = NOW()")
    params.append(regla_id)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            UPDATE reglas_comerciales
            SET {", ".join(campos)}
            WHERE id = %s
            RETURNING
                id,
                nombre,
                tipo,
                medio_pago,
                porcentaje,
                monto_fijo,
                requiere_pago_total,
                combinable,
                prioridad,
                activa,
                fecha_desde,
                fecha_hasta,
                created_at,
                updated_at
            """,
            params,
        )
        return cur.fetchone()


def get_tarjeta_planes(conn, solo_activos: bool = False):
    with conn.cursor(row_factory=dict_row) as cur:
        where_sql = "WHERE activa = TRUE" if solo_activos else ""

        cur.execute(
            f"""
            SELECT
                id,
                nombre,
                medio_pago,
                entidad,
                cuotas,
                porcentaje_recargo_cliente,
                porcentaje_costo_financiero,
                activa,
                fecha_desde,
                fecha_hasta
            FROM tarjeta_planes
            {where_sql}
            ORDER BY activa DESC, medio_pago ASC, entidad ASC NULLS FIRST, cuotas ASC, id ASC
            """
        )
        return cur.fetchall()


def insert_tarjeta_plan(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO tarjeta_planes (
                nombre,
                medio_pago,
                entidad,
                cuotas,
                porcentaje_recargo_cliente,
                porcentaje_costo_financiero,
                activa
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                nombre,
                medio_pago,
                entidad,
                cuotas,
                porcentaje_recargo_cliente,
                porcentaje_costo_financiero,
                activa,
                fecha_desde,
                fecha_hasta
            """,
            (
                data["nombre"],
                data["medio_pago"],
                data.get("entidad"),
                data["cuotas"],
                data["porcentaje_recargo_cliente"],
                data["porcentaje_costo_financiero"],
                data["activa"],
            ),
        )
        return cur.fetchone()


def update_tarjeta_plan(conn, plan_id: int, data: dict):
    campos = []
    params = []

    for campo, valor in data.items():
        if valor is not None:
            campos.append(f"{campo} = %s")
            params.append(valor)

    if not campos:
        return None

    params.append(plan_id)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            UPDATE tarjeta_planes
            SET {", ".join(campos)}
            WHERE id = %s
            RETURNING
                id,
                nombre,
                medio_pago,
                entidad,
                cuotas,
                porcentaje_recargo_cliente,
                porcentaje_costo_financiero,
                activa,
                fecha_desde,
                fecha_hasta
            """,
            params,
        )
        return cur.fetchone()