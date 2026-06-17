from app.db.connection import get_connection

from .repository import (
    get_bicis_listas_hace_dias,
    get_deudas_vencidas,
    get_reservas_vencidas,
    get_stock_critico,
    get_taller_atrasado,
)


def obtener_alertas_operativas(dias_lista_retiro: int = 7, stock_umbral: int = 2):
    conn = get_connection()
    try:
        data = {
            "bicis_listas": get_bicis_listas_hace_dias(conn, dias=dias_lista_retiro),
            "reservas_vencidas": get_reservas_vencidas(conn),
            "deudas_vencidas": get_deudas_vencidas(conn),
            "taller_atrasado": get_taller_atrasado(conn),
            "stock_critico": get_stock_critico(conn, umbral=stock_umbral),
        }
        data["resumen"] = {key: len(value) for key, value in data.items()}
        return data
    finally:
        conn.close()
