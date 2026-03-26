from fastapi import HTTPException

from app.db.connection import get_connection
from app.shared.constants import(
    ORDEN_TALLER_ESTADO_INGRESADA,
    ORDEN_TALLER_EVENTO_CREADA,
    ORDEN_TALLER_EVENTO_CAMBIO_ESTADO,
)

from .repository import (
    validar_sucursal_activa,
    validar_usuario_activo,
    validar_cliente_existente,
    get_bicicleta_cliente,
    insert_orden_taller,
    get_ordenes_taller,
    get_orden_taller_by_id,
    get_orden_taller_by_id_for_update,
    update_orden_taller_estado,
    insert_orden_taller_evento,
    get_eventos_orden_taller,
)


def crear_orden_taller(data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_sucursal_activa(conn, data.id_sucursal)
                validar_usuario_activo(conn, data.id_usuario)
                validar_cliente_existente(conn, data.id_cliente)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            bicicleta = get_bicicleta_cliente(conn, data.id_bicicleta_cliente)
            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta del cliente {data.id_bicicleta_cliente}",
                )

            if bicicleta["id_cliente"] != data.id_cliente:
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta indicada no pertenece al cliente informado",
                )

            orden = insert_orden_taller(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": data.id_cliente,
                    "id_bicicleta_cliente": data.id_bicicleta_cliente,
                    "estado": ORDEN_TALLER_ESTADO_INGRESADA,
                    "problema_reportado": data.problema_reportado.strip(),
                    "id_usuario": data.id_usuario,
                },
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden["id"],
                tipo_evento=ORDEN_TALLER_EVENTO_CREADA,
                detalle="Orden de taller creada",
                id_usuario=data.id_usuario,
            )

            return orden
    finally:
        conn.close()


def listar_ordenes_taller():
    conn = get_connection()
    try:
        return get_ordenes_taller(conn)
    finally:
        conn.close()


def obtener_orden_taller(orden_id: int):
    conn = get_connection()
    try:
        orden = get_orden_taller_by_id(conn, orden_id)
        if orden is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la orden de taller {orden_id}",
            )

        eventos = get_eventos_orden_taller(conn, orden_id)

        return {
            **orden,
            "eventos": eventos,
        }
    finally:
        conn.close()


def cambiar_estado_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] == data.nuevo_estado:
                raise HTTPException(
                    status_code=400,
                    detail=f"La orden {orden_id} ya está en estado {data.nuevo_estado}",
                )

            update_orden_taller_estado(conn, orden_id, data.nuevo_estado)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_CAMBIO_ESTADO,
                detalle=f"Estado cambiado de {orden['estado']} a {data.nuevo_estado}",
                id_usuario=data.id_usuario,
            )

            orden_actualizada = get_orden_taller_by_id(conn, orden_id)
            return orden_actualizada
    finally:
        conn.close()