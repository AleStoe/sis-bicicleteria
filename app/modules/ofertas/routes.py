from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_OFERTAS

from .schema import (
    OfertaCreateInput,
    OfertaEstadoInput,
    OfertaOutput,
    OfertaUpdateInput,
)
from .service import (
    cambiar_estado_oferta,
    crear_oferta,
    editar_oferta,
    listar_ofertas,
)


router = APIRouter()
puede_gestionar_ofertas = requerir_permiso(PERMISO_GESTIONAR_OFERTAS)


@router.get("", response_model=list[OfertaOutput])
def listar_ofertas_route(
    incluir_inactivas: bool = True,
    id_variante: int | None = None,
    _usuario: CurrentUser = Depends(puede_gestionar_ofertas),
):
    return listar_ofertas(
        incluir_inactivas=incluir_inactivas,
        id_variante=id_variante,
    )


@router.post("", response_model=OfertaOutput, status_code=201)
def crear_oferta_route(
    data: OfertaCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_ofertas),
):
    aplicar_actor_actual(data, usuario)
    return crear_oferta(data)


@router.put("/{oferta_id}", response_model=OfertaOutput)
def editar_oferta_route(
    oferta_id: int,
    data: OfertaUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_ofertas),
):
    aplicar_actor_actual(data, usuario)
    return editar_oferta(oferta_id, data)


@router.patch("/{oferta_id}/estado", response_model=OfertaOutput)
def cambiar_estado_oferta_route(
    oferta_id: int,
    data: OfertaEstadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_ofertas),
):
    aplicar_actor_actual(data, usuario)
    return cambiar_estado_oferta(oferta_id, data)
