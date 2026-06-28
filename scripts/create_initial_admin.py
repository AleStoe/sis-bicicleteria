import argparse
import getpass
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db.connection import get_connection
from app.modules.usuarios.service import hash_password


def parse_args():
    parser = argparse.ArgumentParser(
        description="Crea el primer usuario administrador sin guardar contraseñas en archivos."
    )
    parser.add_argument("--username", default="ale")
    parser.add_argument("--name", default="ALE ADMIN")
    parser.add_argument(
        "--password-env",
        help="Nombre de una variable de entorno con la contraseña. Sólo para automatización.",
    )
    return parser.parse_args()


def read_password(env_name: str | None) -> str:
    if env_name:
        password = os.environ.get(env_name, "")
        if not password:
            raise ValueError(f"La variable {env_name} está vacía o no existe")
        return password

    password = getpass.getpass("Contraseña inicial: ")
    confirmation = getpass.getpass("Repetir contraseña: ")
    if password != confirmation:
        raise ValueError("Las contraseñas no coinciden")
    return password


def main() -> int:
    args = parse_args()
    username = args.username.strip().lower()
    display_name = args.name.strip().upper()

    if not username or " " in username:
        raise ValueError("El username es obligatorio y no puede contener espacios")
    if not display_name:
        raise ValueError("El nombre visible es obligatorio")

    password = read_password(args.password_env)
    if len(password) < 10:
        raise ValueError("La contraseña debe tener al menos 10 caracteres")

    conn = get_connection()
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM roles WHERE nombre = 'administrador'")
                role = cur.fetchone()
                if role is None:
                    raise ValueError(
                        "Falta el rol administrador. Aplicá database/seed_minimo_beta.sql."
                    )

                cur.execute(
                    "SELECT id FROM usuarios WHERE LOWER(username) = LOWER(%s)",
                    (username,),
                )
                if cur.fetchone() is not None:
                    raise ValueError(f"Ya existe el usuario '{username}'")

                cur.execute(
                    """
                    INSERT INTO usuarios (
                        nombre,
                        username,
                        password_hash,
                        activo
                    )
                    VALUES (%s, %s, %s, TRUE)
                    RETURNING id
                    """,
                    (display_name, username, hash_password(password)),
                )
                user_id = cur.fetchone()["id"]

                cur.execute(
                    """
                    INSERT INTO usuario_roles (id_usuario, id_rol)
                    VALUES (%s, %s)
                    ON CONFLICT (id_usuario, id_rol) DO NOTHING
                    """,
                    (user_id, role["id"]),
                )

        print(f"Administrador creado: {username} (id={user_id})")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
