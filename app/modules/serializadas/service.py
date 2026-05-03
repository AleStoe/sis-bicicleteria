from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.stock import service as stock_service
from app.modules.ventas.repository import get_variantes_by_ids, get_sucursal_by_id
from .repository import (
    get_bicicleta_serializada_by_numero_cuadro,
    insert_bicicleta_serializada,
)


def _validar_sucursal(conn, id_sucursal: int):
    sucursal = get_sucursal_by_id(conn, id_sucursal)

    if sucursal is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la sucursal {id_sucursal}",
        )

    if not sucursal["activa"]:
        raise HTTPException(
            status_code=400,
            detail=f"La sucursal {id_sucursal} está inactiva",
        )

    return sucursal


def _validar_variante(conn, id_variante: int):
    variantes = get_variantes_by_ids(conn, [id_variante])

    if not variantes:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la variante {id_variante}",
        )

    variante = variantes[0]

    if not variante["producto_activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"El producto de la variante {id_variante} está inactivo",
        )

    if not variante["variante_activa"]:
        raise HTTPException(
            status_code=400,
            detail=f"La variante {id_variante} está inactiva",
        )

    if not variante["stockeable"]:
        raise HTTPException(
            status_code=400,
            detail="La variante no es stockeable",
        )

    if not variante["serializable"]:
        raise HTTPException(
            status_code=400,
            detail="La variante no es serializable",
        )

    return variante


def armar_bicicleta_serializada(data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_variante(conn, data.id_variante)
            _validar_sucursal(conn, data.id_sucursal_actual)

            numero_cuadro = data.numero_cuadro.strip()

            existente = get_bicicleta_serializada_by_numero_cuadro(conn, numero_cuadro)
            if existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ya existe una bicicleta con número de cuadro {numero_cuadro}",
                )

            bicicleta_id = insert_bicicleta_serializada(
                conn,
                {
                    "id_variante": data.id_variante,
                    "id_sucursal_actual": data.id_sucursal_actual,
                    "numero_cuadro": numero_cuadro,
                    "estado": "disponible",
                    "observaciones": data.observaciones,
                },
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=data.id_sucursal_actual,
                entidad="bicicleta_serializada",
                entidad_id=bicicleta_id,
                accion="bicicleta_serializada_armada",
                detalle=(
                    f"Bicicleta serializada armada. "
                    f"id_variante={data.id_variante}, "
                    f"numero_cuadro={numero_cuadro}, "
                    f"estado=disponible"
                ),
                metadata={
                    "tipo": "bicicleta_serializada_armada",
                    "bicicleta_id": bicicleta_id,
                    "id_variante": data.id_variante,
                    "numero_cuadro": numero_cuadro,
                    "id_sucursal": data.id_sucursal_actual,
                    "estado_final": "disponible",
                },
                origen_tipo="bicicleta_serializada",
                origen_id=bicicleta_id,
            )

        return {
            "ok": True,
            "bicicleta_id": bicicleta_id,
            "estado": "disponible",
        }

    finally:
        conn.close()