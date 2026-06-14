from fastapi import HTTPException

from app.db.connection import get_connection
from app.shared.constants import (
    ORDEN_TALLER_ESTADO_INGRESADA,
    ORDEN_TALLER_EVENTO_CREADA,
)
from app.modules.taller.repository import (
    validar_sucursal_activa,
    validar_usuario_activo,
    validar_cliente_existente,
    get_bicicleta_cliente,
    insert_orden_taller,
    insert_orden_taller_evento,
)
from .repository import (
    insert_turno_agenda,
    get_turnos_agenda,
    get_turno_agenda_by_id,
    update_turno_agenda,
    update_estado_turno,
    get_turno_agenda_for_update,
    update_turno_convertido_orden,
    marcar_recordatorio_enviado,
)

def _build_problema_reportado_desde_turno(turno):
    partes = []

    if turno.get("tipo_servicio"):
        partes.append(str(turno["tipo_servicio"]).strip())

    if turno.get("descripcion"):
        partes.append(str(turno["descripcion"]).strip())

    texto = " - ".join([parte for parte in partes if parte])

    return texto or "Turno convertido desde agenda"


def _build_observaciones_desde_turno(turno):
    lineas = [
        "Orden creada desde agenda de taller.",
        f"Turno #{turno['id']}",
        f"Fecha turno: {turno['fecha']}",
        f"Hora turno: {turno['hora_inicio']}",
    ]

    if turno.get("cliente_telefono"):
        lineas.append(f"Teléfono registrado: {turno['cliente_telefono']}")

    if turno.get("notas"):
        lineas.append("")
        lineas.append("Notas:")
        lineas.append(str(turno["notas"]).strip())

    return "\n".join(lineas)


def crear_turno(data):
    conn = get_connection()

    try:
        with conn.transaction():
            return insert_turno_agenda(conn, data)
    finally:
        conn.close()


def listar_turnos(
    fecha_desde=None,
    fecha_hasta=None,
    estado=None,
    id_sucursal=None,
):
    conn = get_connection()

    try:
        return get_turnos_agenda(
            conn,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            estado=estado,
            id_sucursal=id_sucursal,
        )
    finally:
        conn.close()


def obtener_turno(turno_id):
    conn = get_connection()

    try:
        turno = get_turno_agenda_by_id(conn, turno_id)

        if turno is None:
            raise HTTPException(
                status_code=404,
                detail="Turno no encontrado",
            )

        return turno

    finally:
        conn.close()


def editar_turno(turno_id, data):
    conn = get_connection()

    try:
        with conn.transaction():
            turno = update_turno_agenda(
                conn,
                turno_id,
                data,
            )

            if turno is None:
                raise HTTPException(
                    status_code=404,
                    detail="Turno no encontrado",
                )

            return turno

    finally:
        conn.close()


def cambiar_estado(turno_id, data):
    conn = get_connection()

    try:
        with conn.transaction():
            turno = update_estado_turno(
                conn,
                turno_id,
                data.estado,
            )

            if turno is None:
                raise HTTPException(
                    status_code=404,
                    detail="Turno no encontrado",
                )

            return turno

    finally:
        conn.close()

def convertir_turno_a_orden(turno_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            turno = get_turno_agenda_for_update(conn, turno_id)

            if turno is None:
                raise HTTPException(
                    status_code=404,
                    detail="Turno no encontrado",
                )

            if turno["estado"] == "convertido_orden" or turno.get("id_orden_taller"):
                raise HTTPException(
                    status_code=400,
                    detail=f"El turno ya fue convertido a orden #{turno.get('id_orden_taller')}",
                )

            if turno["estado"] == "cancelado":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede convertir un turno cancelado a orden",
                )

            if turno.get("id_cliente") is None:
                raise HTTPException(
                    status_code=400,
                    detail="El turno debe tener un cliente asociado para crear una orden",
                )

            if turno.get("id_bicicleta_cliente") is None:
                raise HTTPException(
                    status_code=400,
                    detail="El turno debe tener una bicicleta asociada para crear una orden",
                )

            try:
                validar_sucursal_activa(conn, turno["id_sucursal"])
                validar_usuario_activo(conn, data.id_usuario)
                validar_cliente_existente(conn, turno["id_cliente"])
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            bicicleta = get_bicicleta_cliente(conn, turno["id_bicicleta_cliente"])

            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta del cliente {turno['id_bicicleta_cliente']}",
                )

            if bicicleta["id_cliente"] != turno["id_cliente"]:
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta indicada no pertenece al cliente del turno",
                )

            problema_reportado = _build_problema_reportado_desde_turno(turno)

            orden = insert_orden_taller(
                conn,
                {
                    "id_sucursal": turno["id_sucursal"],
                    "id_cliente": turno["id_cliente"],
                    "id_bicicleta_cliente": turno["id_bicicleta_cliente"],
                    "estado": ORDEN_TALLER_ESTADO_INGRESADA,
                    "problema_reportado": problema_reportado,
                    "id_usuario": data.id_usuario,
                },
            )

            # Tu insert_orden_taller actual no inserta observaciones.
            # Por eso las dejamos como evento para no tocar taller/repository en esta etapa.
            observaciones = _build_observaciones_desde_turno(turno)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden["id"],
                tipo_evento=ORDEN_TALLER_EVENTO_CREADA,
                detalle=observaciones,
                id_usuario=data.id_usuario,
            )

            update_turno_convertido_orden(
                conn,
                turno_id,
                orden["id"],
            )

            return {
                "ok": True,
                "turno_id": turno_id,
                "orden_id": orden["id"],
                "estado_turno": "convertido_orden",
            }

    finally:
        conn.close()
    
def registrar_recordatorio_enviado(turno_id: int):
    conn = get_connection()

    try:
        with conn.transaction():
            turno = marcar_recordatorio_enviado(conn, turno_id)

            if turno is None:
                raise HTTPException(
                    status_code=404,
                    detail="Turno no encontrado",
                )

            return turno
    finally:
        conn.close()