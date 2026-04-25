from fastapi import APIRouter

from app.db.connection import get_connection

from .schema import (
    CreditoDetalleResponse,
    CreditoReintegroInput,
    CreditoReintegroResponse,
)
from .service import (
    obtener_credito_detalle,
    reintegrar_credito,
)

router = APIRouter()


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