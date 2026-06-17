from datetime import date, timedelta

from fastapi import HTTPException

from app.db.connection import get_connection
from app.core.text_normalization import normalize_text_upper
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
    insert_historial_turno,
    get_turnos_agenda,
    get_turnos_agenda_para_fecha,
    get_turnos_agenda_atrasados,
    get_turno_agenda_by_id,
    get_historial_turno,
    update_turno_agenda,
    update_estado_turno,
    get_turno_agenda_for_update,
    update_turno_convertido_orden,
    marcar_recordatorio_enviado,
    marcar_cliente_avisado,
)


ESTADOS_ACTIVOS = {"pendiente", "confirmado", "en_taller"}


def _build_problema_reportado_desde_turno(turno):
    partes = []

    if turno.get("tipo_servicio"):
        partes.append(str(turno["tipo_servicio"]).strip())

    if turno.get("descripcion"):
        partes.append(str(turno["descripcion"]).strip())

    texto = " - ".join([parte for parte in partes if parte])
    return normalize_text_upper(texto) or "TURNO CONVERTIDO DESDE AGENDA"


def _build_observaciones_desde_turno(turno):
    lineas = [
        "Orden creada desde agenda de taller.",
        f"Turno #{turno['id']}",
        f"Fecha turno: {turno['fecha']}",
        f"Hora turno: {turno['hora_inicio']}",
    ]

    if turno.get("fecha_prometida_entrega"):
        lineas.append(f"Fecha prometida: {turno['fecha_prometida_entrega']}")

    if turno.get("cliente_telefono"):
        lineas.append(f"Teléfono registrado: {turno['cliente_telefono']}")

    if turno.get("notas"):
        lineas.append("")
        lineas.append("Notas:")
        lineas.append(str(turno["notas"]).strip())

    return "\n".join(lineas)


def _es_reprogramacion(turno_anterior, data):
    return (
        turno_anterior.get("fecha") != data.fecha
        or turno_anterior.get("franja") != data.franja
        or turno_anterior.get("hora_inicio") != data.hora_inicio
        or turno_anterior.get("hora_fin") != data.hora_fin
    )


def crear_turno(data):
    conn = get_connection()

    try:
        with conn.transaction():
            turno = insert_turno_agenda(conn, data)
            insert_historial_turno(
                conn,
                id_turno_agenda=turno["id"],
                tipo_evento="creado",
                detalle="Turno creado en agenda de taller",
                fecha_nueva=turno.get("fecha"),
                hora_inicio_nueva=turno.get("hora_inicio"),
                estado_nuevo=turno.get("estado"),
                id_usuario=data.id_usuario_creador,
            )
            return turno
    finally:
        conn.close()


def listar_turnos(
    fecha_desde=None,
    fecha_hasta=None,
    estado=None,
    id_sucursal=None,
    solo_pendientes=False,
    mostrar_convertidos=False,
):
    conn = get_connection()

    try:
        return get_turnos_agenda(
            conn,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            estado=estado,
            id_sucursal=id_sucursal,
            solo_pendientes=solo_pendientes,
            mostrar_convertidos=mostrar_convertidos,
        )
    finally:
        conn.close()


def listar_turnos_para_manana(id_sucursal=None):
    conn = get_connection()

    try:
        manana = date.today() + timedelta(days=1)
        return get_turnos_agenda_para_fecha(
            conn,
            fecha=manana,
            id_sucursal=id_sucursal,
        )
    finally:
        conn.close()


def listar_turnos_atrasados(id_sucursal=None):
    conn = get_connection()

    try:
        hoy = date.today()
        return get_turnos_agenda_atrasados(
            conn,
            fecha_limite=hoy,
            id_sucursal=id_sucursal,
        )
    finally:
        conn.close()


def obtener_turno(turno_id):
    conn = get_connection()

    try:
        turno = get_turno_agenda_by_id(conn, turno_id)
        if turno is None:
            raise HTTPException(status_code=404, detail="Turno no encontrado")
        return turno
    finally:
        conn.close()


def obtener_historial_turno(turno_id):
    conn = get_connection()

    try:
        turno = get_turno_agenda_by_id(conn, turno_id)
        if turno is None:
            raise HTTPException(status_code=404, detail="Turno no encontrado")
        return get_historial_turno(conn, turno_id)
    finally:
        conn.close()


def editar_turno(turno_id, data):
    conn = get_connection()

    try:
        with conn.transaction():
            turno_anterior = get_turno_agenda_for_update(conn, turno_id)
            if turno_anterior is None:
                raise HTTPException(status_code=404, detail="Turno no encontrado")

            if turno_anterior["estado"] == "convertido_orden":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede editar un turno ya convertido a orden",
                )

            reprogramado = _es_reprogramacion(turno_anterior, data)
            turno = update_turno_agenda(conn, turno_id, data)

            insert_historial_turno(
                conn,
                id_turno_agenda=turno_id,
                tipo_evento="reprogramado" if reprogramado else "editado",
                detalle="Turno reprogramado" if reprogramado else "Turno editado",
                fecha_anterior=turno_anterior.get("fecha") if reprogramado else None,
                fecha_nueva=turno.get("fecha") if reprogramado else None,
                hora_inicio_anterior=turno_anterior.get("hora_inicio") if reprogramado else None,
                hora_inicio_nueva=turno.get("hora_inicio") if reprogramado else None,
                estado_anterior=turno_anterior.get("estado"),
                estado_nuevo=turno.get("estado"),
                id_usuario=data.id_usuario,
            )

            return turno
    finally:
        conn.close()


def cambiar_estado(turno_id, data):
    conn = get_connection()

    try:
        with conn.transaction():
            turno_anterior = get_turno_agenda_for_update(conn, turno_id)
            if turno_anterior is None:
                raise HTTPException(status_code=404, detail="Turno no encontrado")

            if turno_anterior["estado"] == "convertido_orden" and data.estado != "convertido_orden":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede cambiar el estado de un turno ya convertido a orden",
                )

            turno = update_estado_turno(conn, turno_id, data.estado)
            insert_historial_turno(
                conn,
                id_turno_agenda=turno_id,
                tipo_evento="estado",
                detalle="Cambio de estado de turno",
                estado_anterior=turno_anterior.get("estado"),
                estado_nuevo=turno.get("estado"),
                id_usuario=data.id_usuario,
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
                raise HTTPException(status_code=404, detail="Turno no encontrado")

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
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

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

            observaciones = _build_observaciones_desde_turno(turno)
            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden["id"],
                tipo_evento=ORDEN_TALLER_EVENTO_CREADA,
                detalle=observaciones,
                id_usuario=data.id_usuario,
            )

            update_turno_convertido_orden(conn, turno_id, orden["id"])
            insert_historial_turno(
                conn,
                id_turno_agenda=turno_id,
                tipo_evento="convertido_orden",
                detalle=f"Turno convertido a orden de taller #{orden['id']}",
                estado_anterior=turno.get("estado"),
                estado_nuevo="convertido_orden",
                id_usuario=data.id_usuario,
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
            turno_anterior = get_turno_agenda_for_update(conn, turno_id)
            if turno_anterior is None:
                raise HTTPException(status_code=404, detail="Turno no encontrado")

            if turno_anterior["estado"] == "cancelado":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede marcar recordatorio en un turno cancelado",
                )

            turno = marcar_recordatorio_enviado(conn, turno_id)
            insert_historial_turno(
                conn,
                id_turno_agenda=turno_id,
                tipo_evento="recordatorio_enviado",
                detalle="Recordatorio de turno enviado",
                estado_anterior=turno_anterior.get("estado"),
                estado_nuevo=turno.get("estado"),
            )

            return turno
    finally:
        conn.close()


def registrar_cliente_avisado(turno_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            turno_anterior = get_turno_agenda_for_update(conn, turno_id)
            if turno_anterior is None:
                raise HTTPException(status_code=404, detail="Turno no encontrado")

            if turno_anterior["estado"] == "cancelado":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede marcar cliente avisado en un turno cancelado",
                )

            turno = marcar_cliente_avisado(conn, turno_id)
            insert_historial_turno(
                conn,
                id_turno_agenda=turno_id,
                tipo_evento="cliente_avisado",
                detalle=data.observacion or "Cliente avisado",
                estado_anterior=turno_anterior.get("estado"),
                estado_nuevo=turno.get("estado"),
                id_usuario=data.id_usuario,
            )

            return turno
    finally:
        conn.close()
