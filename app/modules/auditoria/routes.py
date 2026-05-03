from typing import List
from fastapi import APIRouter, Query

from .schema import AuditoriaEventoOutput
from .service import listar_eventos, obtener_evento

router = APIRouter()


@router.get("/", response_model=List[AuditoriaEventoOutput])
def eventos(limit: int = Query(default=100, ge=1, le=500)):
    return listar_eventos(limit)


@router.get("/{evento_id}", response_model=AuditoriaEventoOutput)
def evento_detalle(evento_id: int):
    return obtener_evento(evento_id)