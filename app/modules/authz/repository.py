from psycopg.rows import dict_row


def get_roles_usuario(conn, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT r.nombre
            FROM usuario_roles ur
            INNER JOIN roles r
                ON r.id = ur.id_rol
            WHERE ur.id_usuario = %s
            """,
            (id_usuario,),
        )
        return cur.fetchall()