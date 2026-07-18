from decimal import Decimal

from fastapi import HTTPException

from app.modules.serializadas.repository import (
    get_bicicleta_serializada_costo_venta_for_update,
)
from app.shared.money import redondear_monto


ORIGEN_COSTO_FABRICACION_PROPIA = "fabricacion_propia"
ORIGEN_COSTO_PROMEDIO_VARIANTE = "costo_promedio_variante"


def resolver_costo_unitario_venta_serializada(
    conn,
    *,
    id_bicicleta_serializada: int | None,
    id_variante: int,
    costo_promedio_variante,
):
    costo_variante = redondear_monto(costo_promedio_variante or 0)
    if id_bicicleta_serializada is None:
        return {
            "costo_unitario_aplicado": costo_variante,
            "origen_costo": ORIGEN_COSTO_PROMEDIO_VARIANTE,
            "id_orden_armado_origen": None,
        }

    bicicleta = get_bicicleta_serializada_costo_venta_for_update(
        conn,
        id_bicicleta_serializada,
    )
    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la bicicleta serializada {id_bicicleta_serializada}",
        )

    if bicicleta["id_variante"] != id_variante:
        raise HTTPException(
            status_code=400,
            detail="La bicicleta serializada no corresponde a la variante informada",
        )

    if bicicleta["id_orden_armado_origen"] is None:
        return {
            "costo_unitario_aplicado": costo_variante,
            "origen_costo": ORIGEN_COSTO_PROMEDIO_VARIANTE,
            "id_orden_armado_origen": None,
        }

    costo_fabricacion = bicicleta["costo_fabricacion_final"]
    if costo_fabricacion is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "La bicicleta fabricada no tiene costo de fabricacion final "
                "congelado. Revisa la orden de armado antes de venderla."
            ),
        )

    costo_fabricacion = Decimal(str(costo_fabricacion))
    if costo_fabricacion < Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="La bicicleta fabricada tiene costo de fabricacion final invalido",
        )

    if bicicleta["orden_armado_estado"] != "terminada":
        raise HTTPException(
            status_code=400,
            detail=(
                "La bicicleta fabricada está vinculada a una orden de armado "
                "que no está terminada."
            ),
        )

    if bicicleta["id_bicicleta_serializada_resultante"] != id_bicicleta_serializada:
        raise HTTPException(
            status_code=400,
            detail=(
                "La orden de armado vinculada no coincide con la bicicleta "
                "serializada a vender."
            ),
        )

    if bicicleta["id_variante_final"] != id_variante:
        raise HTTPException(
            status_code=400,
            detail=(
                "La variante final de la orden de armado no coincide con la "
                "bicicleta serializada."
            ),
        )

    return {
        "costo_unitario_aplicado": redondear_monto(costo_fabricacion),
        "origen_costo": ORIGEN_COSTO_FABRICACION_PROPIA,
        "id_orden_armado_origen": bicicleta["id_orden_armado_origen"],
    }
