from typing import List

from fastapi import APIRouter, Query

from .schema import (
    ReservaCancelarInput,
    ReservaCreateInput,
    ReservaCreateOutput,
    ReservaDetalleOutput,
    ReservaEstadoOutput,
    ReservaResumenOutput,
    ReservaVencerInput,
    ReservaConvertirInput,
    ReservaConvertirOutput,
)
from .service import (
    cancelar_reserva,
    crear_reserva,
    listar_reservas,
    marcar_reserva_vencida,
    obtener_reserva,
    convertir_reserva_en_venta,
)

router = APIRouter()


@router.post("/", response_model=ReservaCreateOutput)
def registrar_reserva(data: ReservaCreateInput):
    return crear_reserva(data)


@router.get("/", response_model=List[ReservaResumenOutput])
def reservas(
    estado: str | None = Query(default=None),
    id_cliente: int | None = Query(default=None, gt=0),
    id_sucursal: int | None = Query(default=None, gt=0),
    solo_vencidas: bool = False,
    q: str | None = None,
):
    return listar_reservas(
        estado=estado,
        id_cliente=id_cliente,
        id_sucursal=id_sucursal,
        solo_vencidas=solo_vencidas,
        q=q,
    )


@router.get("/{reserva_id}", response_model=ReservaDetalleOutput)
def reserva_detalle(reserva_id: int):
    return obtener_reserva(reserva_id)


@router.patch("/{reserva_id}/vencer", response_model=ReservaEstadoOutput)
def vencer_reserva_route(reserva_id: int, data: ReservaVencerInput):
    return marcar_reserva_vencida(reserva_id, data)


@router.patch("/{reserva_id}/cancelar", response_model=ReservaEstadoOutput)
def cancelar_reserva_route(reserva_id: int, data: ReservaCancelarInput):
    payload = data.model_dump()
    payload["id_reserva"] = reserva_id
    return cancelar_reserva(payload)

@router.post("/{reserva_id}/convertir-a-venta", response_model=ReservaConvertirOutput)
def convertir_reserva_route(reserva_id: int, data: ReservaConvertirInput):
    return convertir_reserva_en_venta(reserva_id, data)

