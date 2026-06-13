from fastapi import HTTPException

from app.db.connection import get_connection

from .repository import (
    insert_turno_agenda,
    get_turnos_agenda,
    get_turno_agenda_by_id,
    update_turno_agenda,
    update_estado_turno,
)


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
):
    conn = get_connection()

    try:
        return get_turnos_agenda(
            conn,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
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