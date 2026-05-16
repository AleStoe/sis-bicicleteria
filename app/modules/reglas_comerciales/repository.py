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