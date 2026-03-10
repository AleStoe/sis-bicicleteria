from app.db.connection import get_connection
from .repository import get_stock_sucursal, crear_ingreso_stock


def listar_stock():

    conn = get_connection()

    try:
        return get_stock_sucursal(conn)

    finally:
        conn.close()


def registrar_ingreso_stock(data):

    conn = get_connection()

    try:
        return crear_ingreso_stock(conn, data)

    finally:
        conn.close()