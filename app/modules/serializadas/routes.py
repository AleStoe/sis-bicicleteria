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
    BicicletaSerializadaFichaUpdateInput,
)
from .service import (
    armar_bicicleta_serializada,
    corregir_numero_cuadro_bicicleta_serializada,
    listar_bicicletas_serializadas,
    listar_bicicletas_serializadas_disponibles,
    listar_correcciones_numero_cuadro,
    actualizar_ficha_bicicleta_serializada,
)

router = APIRouter()
puede_gestionar_catalogo = requerir_permiso(PERMISO_GESTIONAR_CATALOGO)


@router.get("/", response_model=List[BicicletaSerializadaDetalleOutput])
def listar_serializadas(
    id_variante: int | None = Query(default=None, gt=0),
    id_sucursal: int | None = Query(default=None, gt=0),
    estado: str | None = Query(default=None),
    estado_tecnico: str | None = Query(
        default=None,
        pattern="^(pendiente_revision|en_acondicionamiento|lista|bloqueada)$",
    ),
    condicion_comercial: str | None = Query(
        default=None,
        pattern="^(normal|reacondicionada|oferta)$",
    ),
    ubicacion_fisica: str | None = Query(default=None, max_length=120),
    query: str | None = Query(default=None, max_length=120),
):
    return listar_bicicletas_serializadas(
        id_variante=id_variante,
        id_sucursal=id_sucursal,
        estado=estado,
        estado_tecnico=estado_tecnico,
        condicion_comercial=condicion_comercial,
        ubicacion_fisica=ubicacion_fisica,
        query=query,
    )


@router.get("/disponibles", response_model=List[BicicletaSerializadaDetalleOutput])
def listar_serializadas_disponibles(
    id_variante: int | None = Query(default=None, gt=0),
    id_sucursal: int | None = Query(default=None, gt=0),
    query: str | None = Query(default=None, max_length=120),
):
    return listar_bicicletas_serializadas_disponibles(
        id_variante=id_variante,
        id_sucursal=id_sucursal,
        query=query,
    )


@router.post("/", response_model=BicicletaSerializadaCreateOutput)
def armar_bicicleta_serializada_route(
    data: BicicletaSerializadaCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return armar_bicicleta_serializada(data)


@router.patch(
    "/{bicicleta_id}/ficha",
    response_model=BicicletaSerializadaDetalleOutput,
)
def actualizar_ficha_serializada_route(
    bicicleta_id: int,
    data: BicicletaSerializadaFichaUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_catalogo),
):
    aplicar_actor_actual(data, usuario)
    return actualizar_ficha_bicicleta_serializada(bicicleta_id, data)


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
