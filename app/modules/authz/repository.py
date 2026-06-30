from psycopg.rows import dict_row


def get_contexto_usuario(conn, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                u.id,
                u.nombre,
                u.username,
                u.activo,
                ARRAY(
                    SELECT DISTINCT r.nombre
                    FROM usuario_roles ur
                    INNER JOIN roles r ON r.id = ur.id_rol
                    WHERE ur.id_usuario = u.id
                    ORDER BY r.nombre
                ) AS roles,
                ARRAY(
                    SELECT DISTINCT p.codigo
                    FROM usuario_roles ur
                    INNER JOIN rol_permisos rp ON rp.id_rol = ur.id_rol
                    INNER JOIN permisos p ON p.id = rp.id_permiso
                    WHERE ur.id_usuario = u.id
                    ORDER BY p.codigo
                ) AS permisos
            FROM usuarios u
            WHERE u.id = %s
            """,
            (id_usuario,),
        )
        return cur.fetchone()


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

def usuario_tiene_permiso(conn, id_usuario: int, permiso: str) -> bool:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM usuario_roles ur
                INNER JOIN rol_permisos rp
                    ON rp.id_rol = ur.id_rol
                INNER JOIN permisos p
                    ON p.id = rp.id_permiso
                WHERE ur.id_usuario = %s
                  AND p.codigo = %s
            ) AS tiene_permiso
            """,
            (id_usuario, permiso),
        )

        row = cur.fetchone()
        return bool(row and row["tiene_permiso"])
