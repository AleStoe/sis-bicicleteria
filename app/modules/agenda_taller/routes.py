from datetime import date

from fastapi import APIRouter

from .schema import (
    AgendaTallerCreateInput,
    AgendaTallerUpdateInput,
    AgendaTallerEstadoInput,
)

from .service import (
    crear_turno,
    listar_turnos,
    obtener_turno,
    editar_turno,
    cambiar_estado,
)

router = APIRouter()


@router.post("/")
def crear_turno_route(data: AgendaTallerCreateInput):
    return crear_turno(data)


@router.get("/")
def listar_turnos_route(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
):
    return listar_turnos(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/{turno_id}")
def obtener_turno_route(turno_id: int):
    return obtener_turno(turno_id)


@router.put("/{turno_id}")
def editar_turno_route(
    turno_id: int,
    data: AgendaTallerUpdateInput,
):
    return editar_turno(
        turno_id,
        data,
    )


@router.patch("/{turno_id}/estado")
def cambiar_estado_route(
    turno_id: int,
    data: AgendaTallerEstadoInput,
):
    return cambiar_estado(
        turno_id,
        data,
    )