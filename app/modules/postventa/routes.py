from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_POSTVENTA

from .schema import (
    PostventaCasoCreateInput,
    PostventaCasoOutput,
    PostventaCasoUpdateInput,
    PostventaCerrarInput,
    PostventaEstadoInput,
    PostventaReabrirInput,
)
from .service import (
    actualizar_caso,
    cambiar_estado,
    cerrar_caso,
    crear_caso,
    listar_casos,
    obtener_caso,
    reabrir_caso,
)


router = APIRouter()
puede_gestionar_postventa = requerir_permiso(PERMISO_GESTIONAR_POSTVENTA)


@router.get("/casos", response_model=list[PostventaCasoOutput])
def listar_casos_route(
    estado: str | None = None,
    tipo_caso: str | None = None,
    id_cliente: int | None = None,
    id_bicicleta_cliente: int | None = None,
    id_venta_origen: int | None = None,
    q: str | None = None,
    limit: int = 100,
    _usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    return listar_casos(
        {
            "estado": estado,
            "tipo_caso": tipo_caso,
            "id_cliente": id_cliente,
            "id_bicicleta_cliente": id_bicicleta_cliente,
            "id_venta_origen": id_venta_origen,
            "q": q,
            "limit": limit,
        }
    )


@router.post("/casos", response_model=PostventaCasoOutput, status_code=201)
def crear_caso_route(
    data: PostventaCasoCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    aplicar_actor_actual(data, usuario)
    return crear_caso(data)


@router.get("/casos/{caso_id}", response_model=PostventaCasoOutput)
def obtener_caso_route(
    caso_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    return obtener_caso(caso_id)


@router.patch("/casos/{caso_id}", response_model=PostventaCasoOutput)
def actualizar_caso_route(
    caso_id: int,
    data: PostventaCasoUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    aplicar_actor_actual(data, usuario)
    return actualizar_caso(caso_id, data)


@router.post("/casos/{caso_id}/estado", response_model=PostventaCasoOutput)
def cambiar_estado_route(
    caso_id: int,
    data: PostventaEstadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    aplicar_actor_actual(data, usuario)
    return cambiar_estado(caso_id, data)


@router.post("/casos/{caso_id}/cerrar", response_model=PostventaCasoOutput)
def cerrar_caso_route(
    caso_id: int,
    data: PostventaCerrarInput,
    usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    aplicar_actor_actual(data, usuario)
    return cerrar_caso(caso_id, data)


@router.post("/casos/{caso_id}/reabrir", response_model=PostventaCasoOutput)
def reabrir_caso_route(
    caso_id: int,
    data: PostventaReabrirInput,
    usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    aplicar_actor_actual(data, usuario)
    return reabrir_caso(caso_id, data)
