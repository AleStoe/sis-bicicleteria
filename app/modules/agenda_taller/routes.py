from datetime import date

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import exigir_permiso_actual, requerir_permiso
from app.shared.constants import (
    PERMISO_GESTIONAR_AGENDA_TALLER,
    PERMISO_GESTIONAR_GARANTIAS,
    PERMISO_GESTIONAR_POSTVENTA,
    PERMISO_GESTIONAR_TALLER,
)

from .schema import (
    AgendaTallerCreateInput,
    AgendaTallerUpdateInput,
    AgendaTallerEstadoInput,
    AgendaTallerClienteAvisadoInput,
    AgendaTallerConvertirOrdenInput,
    AgendaTallerConvertirOrdenOutput,
)
from .service import (
    crear_turno,
    listar_turnos,
    listar_turnos_para_manana,
    listar_turnos_atrasados,
    obtener_turno,
    obtener_historial_turno,
    editar_turno,
    cambiar_estado,
    convertir_turno_a_orden,
    registrar_recordatorio_enviado,
    registrar_cliente_avisado,
)

router = APIRouter()
puede_gestionar_agenda = requerir_permiso(PERMISO_GESTIONAR_AGENDA_TALLER)


def _exigir_permiso_por_tipo_turno(usuario: CurrentUser, tipo_turno: str) -> None:
    if tipo_turno == "service_postventa_30_dias":
        exigir_permiso_actual(usuario, PERMISO_GESTIONAR_POSTVENTA)
    elif tipo_turno == "garantia":
        exigir_permiso_actual(usuario, PERMISO_GESTIONAR_GARANTIAS)


@router.post("/")
def crear_turno_route(
    data: AgendaTallerCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_agenda),
):
    aplicar_actor_actual(data, usuario, campo="id_usuario_creador")
    _exigir_permiso_por_tipo_turno(usuario, data.tipo_turno)
    return crear_turno(data)


@router.get("/")
def listar_turnos_route(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    estado: str | None = None,
    id_sucursal: int | None = None,
    solo_pendientes: bool = False,
    mostrar_convertidos: bool = False,
):
    return listar_turnos(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        id_sucursal=id_sucursal,
        solo_pendientes=solo_pendientes,
        mostrar_convertidos=mostrar_convertidos,
    )


@router.get("/para-manana")
def listar_para_manana_route(
    id_sucursal: int | None = None,
):
    return listar_turnos_para_manana(id_sucursal=id_sucursal)


@router.get("/atrasadas")
def listar_atrasadas_route(
    id_sucursal: int | None = None,
):
    return listar_turnos_atrasados(id_sucursal=id_sucursal)


@router.get("/{turno_id}")
def obtener_turno_route(turno_id: int):
    return obtener_turno(turno_id)


@router.get("/{turno_id}/historial")
def obtener_historial_turno_route(turno_id: int):
    return obtener_historial_turno(turno_id)


@router.put("/{turno_id}")
def editar_turno_route(
    turno_id: int,
    data: AgendaTallerUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_agenda),
):
    aplicar_actor_actual(data, usuario)
    turno_actual = obtener_turno(turno_id)
    _exigir_permiso_por_tipo_turno(usuario, turno_actual.get("tipo_turno"))
    _exigir_permiso_por_tipo_turno(usuario, data.tipo_turno)
    return editar_turno(turno_id, data)


@router.patch("/{turno_id}/estado")
def cambiar_estado_route(
    turno_id: int,
    data: AgendaTallerEstadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_agenda),
):
    aplicar_actor_actual(data, usuario)
    turno_actual = obtener_turno(turno_id)
    _exigir_permiso_por_tipo_turno(usuario, turno_actual.get("tipo_turno"))
    return cambiar_estado(turno_id, data)


@router.post(
    "/{turno_id}/convertir-orden",
    response_model=AgendaTallerConvertirOrdenOutput,
)
def convertir_turno_orden_route(
    turno_id: int,
    data: AgendaTallerConvertirOrdenInput,
    usuario: CurrentUser = Depends(puede_gestionar_agenda),
):
    aplicar_actor_actual(data, usuario)
    exigir_permiso_actual(usuario, PERMISO_GESTIONAR_TALLER)
    turno = obtener_turno(turno_id)
    _exigir_permiso_por_tipo_turno(usuario, turno.get("tipo_turno"))
    return convertir_turno_a_orden(turno_id, data)


@router.patch("/{turno_id}/recordatorio-enviado")
def marcar_recordatorio_enviado_route(
    turno_id: int,
    usuario: CurrentUser = Depends(puede_gestionar_agenda),
):
    actor_id = None if usuario.auth_disabled else usuario.id
    return registrar_recordatorio_enviado(turno_id, id_usuario=actor_id)


@router.patch("/{turno_id}/cliente-avisado")
def marcar_cliente_avisado_route(
    turno_id: int,
    data: AgendaTallerClienteAvisadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_agenda),
):
    aplicar_actor_actual(data, usuario)
    return registrar_cliente_avisado(turno_id, data)
