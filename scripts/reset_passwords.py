import bcrypt
from app.db.connection import get_connection

conn = get_connection()

usuarios = {
    "Ale": "ale123456",
    "angel": "angel123456",
    "justi": "justi123456",
    "taller": "taller123456",
}

with conn.transaction():
    with conn.cursor() as cur:
        for username, password in usuarios.items():
            h = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            cur.execute(
                """
                UPDATE usuarios
                SET password_hash = %s,
                    updated_at = NOW()
                WHERE username = %s
                RETURNING id, username, password_hash
                """,
                (h, username),
            )
            print(cur.fetchone())

conn.close()