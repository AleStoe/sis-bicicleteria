from typing import List

from fastapi import APIRouter

from app.db.connection import get_connection

from .schema import (
    CreditoDetalleResponse,
    CreditoReintegroInput,
    CreditoReintegroResponse,
    CreditoResponse,
)
from .service import (
    listar_creditos_cliente,
    obtener_credito_detalle,
    reintegrar_credito,
)

router = APIRouter()

@router.get("/cliente/{id_cliente}/disponibles", response_model=List[CreditoResponse])
def creditos_disponibles_cliente(id_cliente: int):
    conn = get_connection()
    try:
        from .service import listar_creditos_disponibles_cliente
        return listar_creditos_disponibles_cliente(conn, id_cliente)
    finally:
        conn.close()
        
@router.get("/cliente/{id_cliente}", response_model=List[CreditoResponse])
def creditos_por_cliente(id_cliente: int):
    conn = get_connection()
    try:
        return listar_creditos_cliente(conn, id_cliente)
    finally:
        conn.close()


@router.get("/{credito_id}", response_model=CreditoDetalleResponse)
def obtener_credito(credito_id: int):
    conn = get_connection()
    try:
        return obtener_credito_detalle(conn, credito_id)
    finally:
        conn.close()


@router.post("/{credito_id}/reintegrar", response_model=CreditoReintegroResponse)
def reintegrar_credito_route(credito_id: int, data: CreditoReintegroInput):
    conn = get_connection()
    try:
        with conn.transaction():
            return reintegrar_credito(conn, credito_id, data)
    finally:
        conn.close()