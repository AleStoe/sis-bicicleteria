from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import exigir_permiso_actual, requerir_permiso
from app.shared.constants import (
    PERMISO_CREAR_VENTA,
    PERMISO_GESTIONAR_GARANTIAS,
    PERMISO_GESTIONAR_POSTVENTA,
    PERMISO_GESTIONAR_TALLER,
)

from .schemas import (
    OrdenTallerCreate,
    OrdenTallerEstadoUpdate,
    OrdenTallerItemCreate,
    OrdenTallerResponse,
    OrdenTallerDetalleResponse,
    OrdenTallerItemResponse,
    OrdenTallerItemAprobacionUpdate,
    OrdenTallerItemCantidadUpdate,
    OrdenTallerItemReversionEjecucionInput,
    OrdenTallerItemCancelarInput,
    OrdenTallerGenerarVentaInput,
    OrdenTallerGenerarVentaOutput,
    OrdenTallerOperativoUpdate,
    OrdenTallerAvisoRetiroInput,
    OrdenTallerMensajeRetiroOutput,
    OrdenTallerDashboardOutput,
    OrdenTallerNotaCreate,
    OrdenTallerNotaUpdate,
    OrdenTallerNotaResponse,
)
from .service import (
    crear_orden_taller,
    listar_ordenes_taller,
    obtener_orden_taller,
    cambiar_estado_orden_taller,
    agregar_item_orden_taller,
    aprobar_item_orden_taller,
    actualizar_cantidad_item_borrador_orden_taller,
    ejecutar_item_orden_taller,
    revertir_ejecucion_item_orden_taller,
    cancelar_item_orden_taller,
    quitar_item_borrador_orden_taller,
    generar_venta_desde_orden_taller,
    actualizar_datos_operativos_orden_taller,
    generar_mensaje_lista_retiro_orden_taller,
    registrar_aviso_retiro_orden_taller,
    obtener_dashboard_taller,
    crear_nota_orden_taller,
    actualizar_nota_orden_taller,
)

router = APIRouter(prefix="/ordenes_taller", tags=["Taller"])
puede_gestionar_taller = requerir_permiso(PERMISO_GESTIONAR_TALLER)


def _exigir_postventa_si_se_consume(
    orden_id: int,
    nuevo_estado: str,
    usuario: CurrentUser,
) -> None:
    if nuevo_estado != "retirada":
        return

    orden = obtener_orden_taller(orden_id)
    if orden.get("es_service_postventa") is True:
        exigir_permiso_actual(usuario, PERMISO_GESTIONAR_POSTVENTA)


@router.post("/", response_model=OrdenTallerResponse, status_code=201)
def crear_orden(
    payload: OrdenTallerCreate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return crear_orden_taller(payload)


@router.get("/", response_model=list[OrdenTallerResponse])
def listar_ordenes(
    vista: str | None = None,
    estado: str | None = None,
    solo_pendientes: bool = True,
):
    return listar_ordenes_taller(
        vista=vista,
        estado=estado,
        solo_pendientes=solo_pendientes,
    )


@router.get("/dashboard/resumen", response_model=OrdenTallerDashboardOutput)
def dashboard_resumen():
    return obtener_dashboard_taller()


@router.get("/{orden_id}", response_model=OrdenTallerDetalleResponse)
def obtener_orden(orden_id: int):
    return obtener_orden_taller(orden_id)


@router.post("/{orden_id}/estado", response_model=OrdenTallerResponse)
def cambiar_estado(
    orden_id: int,
    payload: OrdenTallerEstadoUpdate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    _exigir_postventa_si_se_consume(orden_id, payload.nuevo_estado, usuario)
    return cambiar_estado_orden_taller(orden_id, payload)


@router.patch("/{orden_id}/operativo", response_model=OrdenTallerResponse)
def actualizar_operativo(
    orden_id: int,
    payload: OrdenTallerOperativoUpdate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return actualizar_datos_operativos_orden_taller(orden_id, payload)


@router.get(
    "/{orden_id}/mensaje-lista-retiro",
    response_model=OrdenTallerMensajeRetiroOutput,
)
def mensaje_lista_retiro(orden_id: int):
    return generar_mensaje_lista_retiro_orden_taller(orden_id)


@router.patch("/{orden_id}/aviso-retiro", response_model=OrdenTallerResponse)
def marcar_aviso_retiro(
    orden_id: int,
    payload: OrdenTallerAvisoRetiroInput,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return registrar_aviso_retiro_orden_taller(orden_id, payload)


@router.post(
    "/{orden_id}/notas",
    response_model=OrdenTallerNotaResponse,
    status_code=201,
)
def crear_nota(
    orden_id: int,
    payload: OrdenTallerNotaCreate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return crear_nota_orden_taller(orden_id, payload)


@router.patch(
    "/{orden_id}/notas/{nota_id}",
    response_model=OrdenTallerNotaResponse,
)
def actualizar_nota(
    orden_id: int,
    nota_id: int,
    payload: OrdenTallerNotaUpdate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return actualizar_nota_orden_taller(orden_id, nota_id, payload)


@router.post("/{orden_id}/items", response_model=OrdenTallerItemResponse, status_code=201)
def agregar_item(
    orden_id: int,
    payload: OrdenTallerItemCreate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    if (
        payload.valor_cobertura_unitario
        or payload.motivo_cobertura
        or payload.observacion_cobertura
    ):
        exigir_permiso_actual(usuario, PERMISO_GESTIONAR_GARANTIAS)
    return agregar_item_orden_taller(orden_id, payload)

@router.post(
    "/{orden_id}/items/{item_id}/aprobacion",
    response_model=OrdenTallerItemResponse,
)
def aprobar_item(
    orden_id: int,
    item_id: int,
    payload: OrdenTallerItemAprobacionUpdate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return aprobar_item_orden_taller(orden_id, item_id, payload)

@router.patch(
    "/{orden_id}/items/{item_id}/cantidad",
    response_model=OrdenTallerItemResponse,
)
def actualizar_cantidad_item_borrador(
    orden_id: int,
    item_id: int,
    payload: OrdenTallerItemCantidadUpdate,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return actualizar_cantidad_item_borrador_orden_taller(orden_id, item_id, payload)

@router.post(
    "/{orden_id}/items/{item_id}/ejecutar",
    response_model=OrdenTallerItemResponse,
)
def ejecutar_item(
    orden_id: int,
    item_id: int,
    id_usuario: int,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    actor_id = id_usuario if usuario.auth_disabled else usuario.id
    return ejecutar_item_orden_taller(orden_id, item_id, actor_id)

@router.post(
    "/{orden_id}/items/{item_id}/revertir-ejecucion",
    response_model=OrdenTallerItemResponse,
)
def revertir_ejecucion_item(
    orden_id: int,
    item_id: int,
    payload: OrdenTallerItemReversionEjecucionInput,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return revertir_ejecucion_item_orden_taller(orden_id, item_id, payload)

@router.post(
    "/{orden_id}/items/{item_id}/cancelar",
    response_model=OrdenTallerItemResponse,
)
def cancelar_item(
    orden_id: int,
    item_id: int,
    payload: OrdenTallerItemCancelarInput,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    return cancelar_item_orden_taller(orden_id, item_id, payload)

@router.delete("/{orden_id}/items/{item_id}", status_code=204)
def quitar_item_borrador(
    orden_id: int,
    item_id: int,
    id_usuario: int | None = Query(default=None),
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    actor_id = id_usuario if usuario.auth_disabled and id_usuario else usuario.id
    quitar_item_borrador_orden_taller(orden_id, item_id, actor_id)

@router.post(
    "/{orden_id}/generar-venta",
    response_model=OrdenTallerGenerarVentaOutput,
)
def generar_venta(
    orden_id: int,
    payload: OrdenTallerGenerarVentaInput,
    usuario: CurrentUser = Depends(puede_gestionar_taller),
):
    aplicar_actor_actual(payload, usuario)
    exigir_permiso_actual(usuario, PERMISO_CREAR_VENTA)
    orden = obtener_orden_taller(orden_id)
    if orden.get("es_service_postventa") is True:
        exigir_permiso_actual(usuario, PERMISO_GESTIONAR_POSTVENTA)
    return generar_venta_desde_orden_taller(orden_id, payload)
