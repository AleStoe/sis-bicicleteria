from psycopg.rows import dict_row


def get_usuarios(conn, q=None, solo_activos=False):
    sql = """
        SELECT
            u.id,
            u.nombre,
            u.email,
            u.username,
            u.activo,
            u.created_at,
            u.updated_at,
            r.nombre AS rol
        FROM usuarios u
        LEFT JOIN usuario_roles ur ON ur.id_usuario = u.id
        LEFT JOIN roles r ON r.id = ur.id_rol
        WHERE 1=1
    """
    params = []

    if solo_activos:
        sql += " AND u.activo = true"

    if q and q.strip():
        q_like = f"%{q.strip()}%"
        sql += """
            AND (
                u.nombre ILIKE %s
                OR u.username ILIKE %s
                OR COALESCE(u.email, '') ILIKE %s
                OR COALESCE(r.nombre, '') ILIKE %s
            )
        """
        params.extend([q_like, q_like, q_like, q_like])

    sql += " ORDER BY u.activo DESC, u.nombre ASC, u.id ASC"

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_usuario_by_id(conn, usuario_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                u.id,
                u.nombre,
                u.email,
                u.username,
                u.activo,
                u.created_at,
                u.updated_at,
                r.nombre AS rol
            FROM usuarios u
            LEFT JOIN usuario_roles ur ON ur.id_usuario = u.id
            LEFT JOIN roles r ON r.id = ur.id_rol
            WHERE u.id = %s
            """,
            (usuario_id,),
        )
        return cur.fetchone()


def get_usuario_by_username(conn, username: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id FROM usuarios WHERE lower(username) = lower(%s)",
            (username,),
        )
        return cur.fetchone()


def get_usuario_by_email(conn, email: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id FROM usuarios WHERE lower(email) = lower(%s)",
            (email,),
        )
        return cur.fetchone()


def get_rol_by_nombre(conn, rol: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre FROM roles WHERE nombre = %s",
            (rol,),
        )
        return cur.fetchone()


def insert_usuario(conn, data):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO usuarios (
                nombre,
                email,
                username,
                password_hash,
                activo
            )
            VALUES (%s, %s, %s, %s, true)
            RETURNING id
            """,
            (
                data.nombre,
                data.email,
                data.username,
                "temp_hash_cambiar_luego",
            ),
        )
        return cur.fetchone()["id"]


def update_usuario(conn, usuario_id: int, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE usuarios
            SET
                nombre = %s,
                email = %s,
                username = %s,
                activo = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (
                data.nombre,
                data.email,
                data.username,
                data.activo,
                usuario_id,
            ),
        )


def set_rol_usuario(conn, usuario_id: int, rol_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM usuario_roles WHERE id_usuario = %s",
            (usuario_id,),
        )
        cur.execute(
            """
            INSERT INTO usuario_roles (id_usuario, id_rol)
            VALUES (%s, %s)
            """,
            (usuario_id, rol_id),
        )


def activar_usuario(conn, usuario_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE usuarios
            SET activo = true, updated_at = now()
            WHERE id = %s
            """,
            (usuario_id,),
        )


def desactivar_usuario(conn, usuario_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE usuarios
            SET activo = false, updated_at = now()
            WHERE id = %s
            """,
            (usuario_id,),
        )