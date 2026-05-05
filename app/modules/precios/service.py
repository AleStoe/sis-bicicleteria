from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection

from .repository import (
    get_variante_precio_by_id,
    get_variante_precio_for_update,
    update_variante_precios,
    insert_precio_movimiento,
    get_historial_precios_by_variante,
)


def _dec(value) -> Decimal:
    return Decimal(str(value))


def obtener_precio_variante(id_variante: int):
    conn = get_connection()

    try:
        variante = get_variante_precio_by_id(conn, id_variante)

        if variante is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante {id_variante}",
            )

        return variante

    finally:
        conn.close()


def actualizar_precio_variante(id_variante: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            variante = get_variante_precio_for_update(conn, id_variante)

            if variante is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la variante {id_variante}",
                )

            if not variante["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"La variante {id_variante} está inactiva",
                )

            precio_minorista_anterior = _dec(variante["precio_minorista"])
            precio_mayorista_anterior = _dec(variante["precio_mayorista"])
            costo_anterior = _dec(variante["costo_promedio_vigente"])

            precio_minorista_nuevo = _dec(data.precio_minorista)
            precio_mayorista_nuevo = _dec(data.precio_mayorista)

            if (
                precio_minorista_anterior == precio_minorista_nuevo
                and precio_mayorista_anterior == precio_mayorista_nuevo
            ):
                raise HTTPException(
                    status_code=400,
                    detail="No hay cambios de precio para registrar",
                )

            movimiento_id = insert_precio_movimiento(
                conn,
                {
                    "id_variante": id_variante,
                    "precio_minorista_anterior": precio_minorista_anterior,
                    "precio_minorista_nuevo": precio_minorista_nuevo,
                    "precio_mayorista_anterior": precio_mayorista_anterior,
                    "precio_mayorista_nuevo": precio_mayorista_nuevo,
                    "costo_anterior": costo_anterior,
                    "costo_nuevo": costo_anterior,
                    "tipo_movimiento": data.tipo_movimiento,
                    "motivo": data.motivo,
                    "origen_tipo": data.origen_tipo,
                    "origen_id": data.origen_id,
                    "id_usuario": data.id_usuario,
                },
            )

            update_variante_precios(
                conn,
                id_variante,
                {
                    "precio_minorista": precio_minorista_nuevo,
                    "precio_mayorista": precio_mayorista_nuevo,
                },
            )

        return {
            "ok": True,
            "id_variante": id_variante,
            "movimiento_id": movimiento_id,
            "precio_minorista_anterior": precio_minorista_anterior,
            "precio_minorista_nuevo": precio_minorista_nuevo,
            "precio_mayorista_anterior": precio_mayorista_anterior,
            "precio_mayorista_nuevo": precio_mayorista_nuevo,
        }

    finally:
        conn.close()


def obtener_historial_precio_variante(id_variante: int):
    conn = get_connection()

    try:
        variante = get_variante_precio_by_id(conn, id_variante)

        if variante is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante {id_variante}",
            )

        movimientos = get_historial_precios_by_variante(conn, id_variante)

        return {
            "variante": variante,
            "movimientos": movimientos,
        }

    finally:
        conn.close()