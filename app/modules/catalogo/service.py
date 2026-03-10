from app.db.connection import get_connection
from .repository import get_categorias, get_productos, get_variantes


def listar_categorias():
    conn = get_connection()

    try:
        return get_categorias(conn)

    finally:
        conn.close()


def listar_productos():
    conn = get_connection()

    try:
        return get_productos(conn)

    finally:
        conn.close()


def listar_variantes():
    conn = get_connection()

    try:
        return get_variantes(conn)

    finally:
        conn.close()