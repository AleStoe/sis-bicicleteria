from typing import List

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_CATALOGO

from .schema import (
    BicicletaSerializadaCorreccionNumeroCuadroOutput,
    BicicletaSerializadaCorregirNumeroCuadroInput,
    BicicletaSerializadaCorregirNumeroCuadroOutput,
    BicicletaSerializadaCreateInput,
    BicicletaSerializadaCreateOutput,
    BicicletaSerializadaDetalleOutput,
)
from .service import (
    armar_bicicleta_serializada,
    corregir_numero_cuadro_bicicleta_serializada,
    listar_bicicletas_serializadas,
    listar_bicicletas_serializadas_disponibles,
    listar_correcciones_numero_cuadro,
)

router = APIRouter()
puede_gestionar_catalogo = requerir_permiso(PERMISO_GESTIONAR_CATALOGO)


@router.get("/", response_model=List[BicicletaSerializadaDetalleOutput])
def listar_serializadas(
    id_variante: int | None = Query(default=None, gt=0),
    id_sucursal: int | None = Query(default=None, gt=0),
    estado: str | None = Query(default=None),
):
    return listar_bicicletas_serializadas(
        id_variante=id_variante,
        id_sucursal=id_sucursal,
        estado=estado,
    )


@router.get("/disponibles", response_model=List[BicicletaSerializadaDetalleOutput])
def listar_serializadas_disponibles(
    id_variante: int | None = Query(default=None, gt=0),
    id_sucursal: int | None = Query(default=None, gt=0),
):
    return listar_bicicletas_serializadas_disponibles(
        id_variante=id_variante,
        id_sucursal=id_sucursal,
    )


@router.post("/", response_model=BicicletaSerializadaCreateOutput)
def armar_bicicleta_serializada_route(
    data: BicicletaSerializadaCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return armar_bicicleta_serializada(data)


@router.patch(
    "/{bicicleta_id}/numero-cuadro",
    response_model=BicicletaSerializadaCorregirNumeroCuadroOutput,
)
def corregir_numero_cuadro_route(
    bicicleta_id: int,
    data: BicicletaSerializadaCorregirNumeroCuadroInput,
    origen_accion: str | None = Query(default="serializadas", max_length=50),
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    return corregir_numero_cuadro_bicicleta_serializada(
        bicicleta_id,
        data,
        id_usuario=usuario.id,
        origen_accion=origen_accion or "serializadas",
    )


@router.get(
    "/{bicicleta_id}/correcciones-numero-cuadro",
    response_model=List[BicicletaSerializadaCorreccionNumeroCuadroOutput],
)
def listar_correcciones_numero_cuadro_route(bicicleta_id: int):
    return listar_correcciones_numero_cuadro(bicicleta_id)
