from psycopg.rows import dict_row


def get_proveedores(conn, solo_activos: bool = True):
    with conn.cursor(row_factory=dict_row) as cur:
        where_sql = "WHERE activo = TRUE" if solo_activos else ""

        cur.execute(
            f"""
            SELECT
                id,
                nombre,
                telefono,
                email,
                notas,
                activo,
                created_at,
                updated_at
            FROM proveedores
            {where_sql}
            ORDER BY nombre
            """
        )
        return cur.fetchall()


def get_proveedor_by_id(conn, proveedor_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                telefono,
                email,
                notas,
                activo,
                created_at,
                updated_at
            FROM proveedores
            WHERE id = %s
            """,
            (proveedor_id,),
        )
        return cur.fetchone()


def insert_proveedor(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO proveedores (
                nombre,
                telefono,
                email,
                notas,
                activo
            )
            VALUES (%s, %s, %s, %s, TRUE)
            RETURNING
                id,
                nombre,
                telefono,
                email,
                notas,
                activo,
                created_at,
                updated_at
            """,
            (
                data["nombre"],
                data.get("telefono"),
                data.get("email"),
                data.get("notas"),
            ),
        )
        return cur.fetchone()