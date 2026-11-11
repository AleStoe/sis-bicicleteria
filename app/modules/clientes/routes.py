from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import exigir_permiso_actual, requerir_permiso
from app.shared.constants import (
    PERMISO_GESTIONAR_GARANTIAS,
    PERMISO_GESTIONAR_POSTVENTA,
    PERMISO_GESTIONAR_TALLER,
    PERMISO_GESTIONAR_CRM,
    PERMISO_VER_RENTABILIDAD,
)

from .schema import ClienteCreateInput, ClienteUpdateInput, BicicletaClienteCreateInput, BicicletaClienteUpdateInput, AutorizarServiceVencidoInput, CrearOrdenServicePostventaInput 
from .crm_schema import (
    SeguimientoCreateInput,
    SeguimientoReprogramarInput,
    SeguimientoCerrarInput,
    ComunicacionCreateInput,
    PreferenciaContactoInput,
)
from .crm_service import (
    listar_responsables_crm_service,
    listar_seguimientos_crm_service,
    crear_seguimiento_crm_service,
    reprogramar_seguimiento_crm_service,
    cerrar_seguimiento_crm_service,
    listar_eventos_seguimiento_crm_service,
    listar_oportunidades_crm_service,
    listar_candidatos_comunicacion_crm_service,
    listar_comunicaciones_cliente_service,
    registrar_comunicacion_cliente_service,
    actualizar_preferencia_contacto_service,
)
from .service import (
    listar_clientes_service,
    listar_clientes_crm_service,
    obtener_cliente_service,
    obtener_historial_cliente_service,
    obtener_taller_cliente_service,
    obtener_analisis_cliente_service,
    crear_cliente_service,
    actualizar_cliente_service,
    desactivar_cliente_service,
    activar_cliente_service,
    listar_bicicletas_cliente_service,
    crear_bicicleta_cliente_service,
    actualizar_bicicleta_cliente_service,
    obtener_historial_bicicleta_cliente_service,
    autorizar_service_vencido_bicicleta_cliente_service,
    crear_orden_service_postventa_bicicleta_cliente_service,
    obtener_duplicados_clientes_service,
    )

router = APIRouter()
puede_gestionar_postventa = requerir_permiso(PERMISO_GESTIONAR_POSTVENTA)
puede_gestionar_crm = requerir_permiso(PERMISO_GESTIONAR_CRM)


def _actor_crm(usuario: CurrentUser, actor_enviado: int | None) -> int | None:
    return actor_enviado if usuario.auth_disabled else usuario.id


@router.get("/")
def listar_clientes(
    q: str | None = Query(default=None),
    solo_activos: bool = Query(default=False),
    orden: str = Query(default="nombre", pattern="^(nombre|recientes)$"),
):
    return listar_clientes_service(
        q=q,
        solo_activos=solo_activos,
        orden=orden,
    )


@router.get("/duplicados/resumen")
def obtener_duplicados_clientes():
    return obtener_duplicados_clientes_service()


@router.get("/crm/panel")
def obtener_panel_crm_clientes(
    q: str | None = Query(default=None),
    vista: str = Query(default="todos", pattern="^(todos|recientes|recurrentes|inactivos|deuda|credito|taller|alto_valor|sin_actividad)$"),
    tipo_cliente: str | None = Query(default=None, pattern="^(minorista|mayorista)$"),
    rubro: str | None = Query(default=None),
    orden: str = Query(default="reciente", pattern="^(reciente|inactividad|actividad|valor|nombre)$"),
    solo_activos: bool = Query(default=True),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    puede_ver_rentabilidad = (
        usuario.auth_disabled
        or "*" in usuario.permisos
        or PERMISO_VER_RENTABILIDAD in usuario.permisos
    )
    return listar_clientes_crm_service(
        q=q,
        vista=vista,
        tipo_cliente=tipo_cliente,
        rubro=rubro,
        orden=orden,
        solo_activos=solo_activos,
        limit=limit,
        offset=offset,
        puede_ver_rentabilidad=puede_ver_rentabilidad,
    )


@router.get("/crm/responsables")
def listar_responsables_crm(
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_responsables_crm_service()


@router.get("/crm/seguimientos")
def listar_agenda_seguimientos_crm(
    bandeja: str = Query(default="pendientes", pattern="^(hoy|vencidos|proximos|pendientes|cerrados|todos)$"),
    id_usuario_responsable: int | None = Query(default=None, gt=0),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_seguimientos_crm_service(
        bandeja=bandeja,
        id_usuario_responsable=id_usuario_responsable,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get("/crm/oportunidades")
def listar_oportunidades_crm(
    tipo: str | None = Query(default=None, pattern="^(service|cotizacion|reserva|postventa)$"),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_oportunidades_crm_service(
        tipo=tipo,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get("/crm/comunicaciones")
def listar_candidatos_comunicacion_crm(
    q: str | None = Query(default=None),
    vista: str = Query(default="inactivos", pattern="^(todos|recientes|recurrentes|inactivos|deuda|credito|taller|alto_valor|sin_actividad)$"),
    tipo_cliente: str | None = Query(default=None, pattern="^(minorista|mayorista)$"),
    orden: str = Query(default="inactividad", pattern="^(reciente|inactividad|actividad|valor|nombre)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_candidatos_comunicacion_crm_service(
        q=q,
        vista=vista,
        tipo_cliente=tipo_cliente,
        orden=orden,
        limit=limit,
        offset=offset,
    )


@router.get("/{cliente_id}/seguimientos")
def listar_seguimientos_cliente(
    cliente_id: int,
    bandeja: str = Query(default="todos", pattern="^(hoy|vencidos|proximos|pendientes|cerrados|todos)$"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_seguimientos_crm_service(
        bandeja=bandeja,
        id_cliente=cliente_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{cliente_id}/oportunidades")
def listar_oportunidades_cliente(
    cliente_id: int,
    tipo: str | None = Query(default=None, pattern="^(service|cotizacion|reserva|postventa)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_oportunidades_crm_service(
        id_cliente=cliente_id,
        tipo=tipo,
        limit=limit,
        offset=offset,
    )


@router.get("/{cliente_id}/comunicaciones")
def listar_comunicaciones_cliente(
    cliente_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_comunicaciones_cliente_service(cliente_id, limit=limit, offset=offset)


@router.post("/{cliente_id}/comunicaciones", dependencies=[Depends(puede_gestionar_crm)])
def registrar_comunicacion_cliente(
    cliente_id: int,
    data: ComunicacionCreateInput,
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return registrar_comunicacion_cliente_service(
        cliente_id,
        data,
        actor_id=_actor_crm(usuario, data.id_usuario_actor),
    )


@router.patch("/{cliente_id}/preferencia-contacto", dependencies=[Depends(puede_gestionar_crm)])
def actualizar_preferencia_contacto(
    cliente_id: int,
    data: PreferenciaContactoInput,
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return actualizar_preferencia_contacto_service(
        cliente_id,
        data,
        actor_id=_actor_crm(usuario, data.id_usuario_actor),
    )


@router.post("/{cliente_id}/seguimientos", status_code=201)
def crear_seguimiento_cliente(
    cliente_id: int,
    data: SeguimientoCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_crm),
):
    return crear_seguimiento_crm_service(
        cliente_id,
        data,
        actor_id=_actor_crm(usuario, data.id_usuario_actor),
    )


@router.patch("/{cliente_id}/seguimientos/{seguimiento_id}/reprogramar")
def reprogramar_seguimiento_cliente(
    cliente_id: int,
    seguimiento_id: int,
    data: SeguimientoReprogramarInput,
    usuario: CurrentUser = Depends(puede_gestionar_crm),
):
    return reprogramar_seguimiento_crm_service(
        cliente_id,
        seguimiento_id,
        data,
        actor_id=_actor_crm(usuario, data.id_usuario_actor),
    )


@router.patch("/{cliente_id}/seguimientos/{seguimiento_id}/cerrar")
def cerrar_seguimiento_cliente(
    cliente_id: int,
    seguimiento_id: int,
    data: SeguimientoCerrarInput,
    usuario: CurrentUser = Depends(puede_gestionar_crm),
):
    return cerrar_seguimiento_crm_service(
        cliente_id,
        seguimiento_id,
        data,
        actor_id=_actor_crm(usuario, data.id_usuario_actor),
    )


@router.get("/{cliente_id}/seguimientos/{seguimiento_id}/eventos")
def listar_eventos_seguimiento_cliente(
    cliente_id: int,
    seguimiento_id: int,
    _usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    return listar_eventos_seguimiento_crm_service(cliente_id, seguimiento_id)


@router.get("/{cliente_id}")
def obtener_cliente(cliente_id: int):
    return obtener_cliente_service(cliente_id)


@router.get("/{cliente_id}/historial")
def obtener_historial_cliente(cliente_id: int):
    return obtener_historial_cliente_service(cliente_id)


@router.get("/{cliente_id}/taller")
def obtener_taller_cliente(cliente_id: int):
    return obtener_taller_cliente_service(cliente_id)


@router.get("/{cliente_id}/analisis")
def obtener_analisis_cliente(
    cliente_id: int,
    periodo: str = Query(default="365d", pattern="^(30d|90d|365d|all)$"),
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    puede_ver_rentabilidad = (
        usuario.auth_disabled
        or "*" in usuario.permisos
        or PERMISO_VER_RENTABILIDAD in usuario.permisos
    )
    return obtener_analisis_cliente_service(
        cliente_id,
        periodo=periodo,
        puede_ver_rentabilidad=puede_ver_rentabilidad,
    )


@router.post("/")
def crear_cliente(data: ClienteCreateInput):
    return crear_cliente_service(data)


@router.put("/{cliente_id}")
def actualizar_cliente(cliente_id: int, data: ClienteUpdateInput):
    return actualizar_cliente_service(cliente_id, data)


@router.patch("/{cliente_id}/desactivar")
def desactivar_cliente(cliente_id: int):
    return desactivar_cliente_service(cliente_id)

@router.patch("/{cliente_id}/activar")
def activar_cliente_route(cliente_id: int):
    return activar_cliente_service(cliente_id)

@router.get("/{cliente_id}/bicicletas")
def listar_bicicletas_cliente(cliente_id: int):
    return listar_bicicletas_cliente_service(cliente_id)


@router.post("/{cliente_id}/bicicletas", status_code=201)
def crear_bicicleta_cliente(cliente_id: int, data: BicicletaClienteCreateInput):
    return crear_bicicleta_cliente_service(cliente_id, data)

@router.patch("/{cliente_id}/bicicletas/{bicicleta_id}")
def actualizar_bicicleta_cliente(
    cliente_id: int,
    bicicleta_id: int,
    data: BicicletaClienteUpdateInput,
):
    return actualizar_bicicleta_cliente_service(cliente_id, bicicleta_id, data)

@router.get("/{cliente_id}/bicicletas/{bicicleta_id}/historial")
def historial_bicicleta_cliente(cliente_id: int, bicicleta_id: int):
    return obtener_historial_bicicleta_cliente_service(
        cliente_id=cliente_id,
        bicicleta_id=bicicleta_id,
    )

@router.patch("/{cliente_id}/bicicletas/{bicicleta_id}/autorizar-service-vencido")
def autorizar_service_vencido_bicicleta(
    cliente_id: int,
    bicicleta_id: int,
    data: AutorizarServiceVencidoInput,
    usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    aplicar_actor_actual(data, usuario)
    exigir_permiso_actual(usuario, PERMISO_GESTIONAR_GARANTIAS)
    return autorizar_service_vencido_bicicleta_cliente_service(
        cliente_id=cliente_id,
        bicicleta_id=bicicleta_id,
        data=data,
    )

@router.post("/{cliente_id}/bicicletas/{bicicleta_id}/crear-service-postventa")
def crear_service_postventa_bicicleta(
    cliente_id: int,
    bicicleta_id: int,
    data: CrearOrdenServicePostventaInput,
    usuario: CurrentUser = Depends(puede_gestionar_postventa),
):
    aplicar_actor_actual(data, usuario)
    exigir_permiso_actual(usuario, PERMISO_GESTIONAR_TALLER)
    return crear_orden_service_postventa_bicicleta_cliente_service(
        cliente_id=cliente_id,
        bicicleta_id=bicicleta_id,
        data=data,
    )
