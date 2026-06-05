from fastapi import APIRouter

from .schemas import (
    ServicioTallerCreate,
    ServicioTallerUpdate,
    ServicioTallerResponse,
)
from .service import (
    crear_servicio_taller,
    listar_servicios_taller,
    obtener_servicio_taller,
    editar_servicio_taller,
    activar_servicio_taller,
    desactivar_servicio_taller,
)


router = APIRouter()

@router.post("/", response_model=ServicioTallerResponse, status_code=201)
def crear_servicio(payload: ServicioTallerCreate):
    return crear_servicio_taller(payload)


@router.get("/", response_model=list[ServicioTallerResponse])
def listar_servicios(incluir_inactivos: bool = False):
    return listar_servicios_taller(incluir_inactivos)


@router.get("/{servicio_id}", response_model=ServicioTallerResponse)
def obtener_servicio(servicio_id: int):
    return obtener_servicio_taller(servicio_id)


@router.put("/{servicio_id}", response_model=ServicioTallerResponse)
def editar_servicio(servicio_id: int, payload: ServicioTallerUpdate):
    return editar_servicio_taller(servicio_id, payload)


@router.patch("/{servicio_id}/activar", response_model=ServicioTallerResponse)
def activar_servicio(servicio_id: int):
    return activar_servicio_taller(servicio_id)


@router.patch("/{servicio_id}/desactivar", response_model=ServicioTallerResponse)
def desactivar_servicio(servicio_id: int):
    return desactivar_servicio_taller(servicio_id)