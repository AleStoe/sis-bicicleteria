from psycopg.rows import dict_row


def get_bicicleta_serializada_by_numero_cuadro(conn, numero_cuadro: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado,
                observaciones
            FROM bicicletas_serializadas
            WHERE numero_cuadro = %s
            """,
            (numero_cuadro,),
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
                estado,
                observaciones
            FROM bicicletas_serializadas
            WHERE id = %s
            FOR UPDATE
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()


def insert_bicicleta_serializada(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado,
                observaciones
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_variante"],
                data["id_sucursal_actual"],
                data["numero_cuadro"],
                data.get("estado", "disponible"),
                data.get("observaciones"),
            ),
        )
        return cur.fetchone()["id"]


def update_bicicleta_serializada_estado(conn, bicicleta_id: int, nuevo_estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET
                estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_estado, bicicleta_id),
        )


def insert_bicicleta_cliente(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                numero_cuadro,
                notas
            )
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (
                data["id_cliente"],
                data["numero_cuadro"],
                data.get("notas"),
            ),
        )
        return cur.fetchone()["id"]

def get_bicicletas_serializadas(conn, *, id_variante=None, id_sucursal=None, estado=None):
    filtros = []
    params = {}

    if id_variante is not None:
        filtros.append("bs.id_variante = %(id_variante)s")
        params["id_variante"] = id_variante

    if id_sucursal is not None:
        filtros.append("bs.id_sucursal_actual = %(id_sucursal)s")
        params["id_sucursal"] = id_sucursal

    if estado is not None:
        filtros.append("bs.estado = %(estado)s")
        params["estado"] = estado

    where_sql = ""
    if filtros:
        where_sql = "WHERE " + " AND ".join(filtros)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                bs.id,
                bs.id_variante,
                bs.id_sucursal_actual,
                s.nombre AS sucursal_nombre,
                bs.numero_cuadro,
                bs.estado,
                bs.observaciones,
                v.nombre_variante,
                p.nombre AS producto_nombre
            FROM bicicletas_serializadas bs
            INNER JOIN variantes v ON v.id = bs.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN sucursales s ON s.id = bs.id_sucursal_actual
            {where_sql}
            ORDER BY bs.id DESC
            """,
            params,
        )
        return cur.fetchall()