from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Query

from .schema import (
    ParticipanteCapitalCreateInput,
    ParticipanteCapitalUpdateInput,
    ParticipanteCapitalEstadoInput,
    ParticipanteCapitalOutput,
    ParticipanteCapitalEstadoOutput,
    MovimientoCapitalCreateInput,
    MovimientoCapitalCreateOutput,
    MovimientoCapitalOutput,
    MovimientoCapitalDetalleOutput,
    MovimientoCapitalAnularInput,
    MovimientoCapitalEstadoOutput,
    CapitalResumenOutput,
    ParticipanteCapitalPerfilOutput,
)
from .service import (
    CapitalFiltros,
    crear_participante,
    listar_participantes,
    editar_participante,
    cambiar_estado_participante,
    crear_movimiento,
    listar_movimientos,
    obtener_movimiento,
    anular_movimiento,
    obtener_resumen,
    obtener_perfil_participante,
)

router = APIRouter()


@router.post("/participantes", response_model=ParticipanteCapitalOutput)
def crear_participante_route(data: ParticipanteCapitalCreateInput):
    return crear_participante(data)


@router.get("/participantes", response_model=List[ParticipanteCapitalOutput])
def participantes_route(incluir_inactivos: bool = False):
    return listar_participantes(incluir_inactivos=incluir_inactivos)


@router.get("/participantes/{participante_id}/perfil", response_model=ParticipanteCapitalPerfilOutput)
def participante_perfil_route(participante_id: int):
    return obtener_perfil_participante(participante_id)


@router.put("/participantes/{participante_id}", response_model=ParticipanteCapitalOutput)
def editar_participante_route(participante_id: int, data: ParticipanteCapitalUpdateInput):
    return editar_participante(participante_id, data)


@router.patch("/participantes/{participante_id}/estado", response_model=ParticipanteCapitalEstadoOutput)
def cambiar_estado_participante_route(participante_id: int, data: ParticipanteCapitalEstadoInput):
    return cambiar_estado_participante(participante_id, data)


@router.post("/movimientos", response_model=MovimientoCapitalCreateOutput)
def crear_movimiento_route(data: MovimientoCapitalCreateInput):
    return crear_movimiento(data)


@router.get("/movimientos", response_model=List[MovimientoCapitalOutput])
def movimientos_route(
    id_participante: Optional[int] = Query(default=None, gt=0),
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    tipo_movimiento: Optional[str] = None,
    estado: Optional[str] = None,
    medio_pago: Optional[str] = None,
    impacta_caja: Optional[bool] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    q: Optional[str] = Query(default=None, min_length=2, max_length=100),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    filtros = CapitalFiltros(
        id_participante=id_participante,
        id_sucursal=id_sucursal,
        tipo_movimiento=tipo_movimiento,
        estado=estado,
        medio_pago=medio_pago,
        impacta_caja=impacta_caja,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        q=q,
        limit=limit,
        offset=offset,
    )
    return listar_movimientos(filtros)


@router.get("/resumen", response_model=CapitalResumenOutput)
def resumen_route(
    id_participante: Optional[int] = Query(default=None, gt=0),
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
):
    filtros = CapitalFiltros(
        id_participante=id_participante,
        id_sucursal=id_sucursal,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=1,
        offset=0,
    )
    return obtener_resumen(filtros)


@router.get("/movimientos/{movimiento_id}", response_model=MovimientoCapitalDetalleOutput)
def movimiento_detalle_route(movimiento_id: int):
    return obtener_movimiento(movimiento_id)


@router.post("/movimientos/{movimiento_id}/anular", response_model=MovimientoCapitalEstadoOutput)
def anular_movimiento_route(movimiento_id: int, data: MovimientoCapitalAnularInput):
    return anular_movimiento(movimiento_id, data)
