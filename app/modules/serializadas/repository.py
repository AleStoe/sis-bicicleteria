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