from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, obtener_usuario_actual

from .schema import (
    AsistentePreguntaInput,
    AsistenteRespuestaOutput,
    AsistenteResumenOutput,
)
from .service import obtener_resumen_asistente, responder_pregunta_asistente

router = APIRouter()


@router.get("/resumen", response_model=AsistenteResumenOutput)
def resumen_asistente_route(
    id_sucursal: int | None = Query(default=None, gt=0),
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return obtener_resumen_asistente(id_sucursal=id_sucursal, usuario=usuario)


@router.post("/preguntar", response_model=AsistenteRespuestaOutput)
def preguntar_asistente_route(
    data: AsistentePreguntaInput,
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return responder_pregunta_asistente(
        pregunta=data.pregunta,
        id_sucursal=data.id_sucursal,
        usuario=usuario,
    )
