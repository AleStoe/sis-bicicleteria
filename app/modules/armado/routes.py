from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_GESTIONAR_ARMADO

from .schema import (
    ArmadoConfiguracionCreateInput,
    ArmadoConfiguracionDuplicarInput,
    ArmadoConfiguracionItemInput,
    ArmadoConfiguracionOutput,
    ArmadoConfiguracionUpdateInput,
    ArmadoEstadoInput,
    ArmadoOrdenAccionInput,
    ArmadoOrdenCancelarInput,
    ArmadoOrdenControlInput,
    ArmadoOrdenCostoFinalInput,
    ArmadoModeloCreateInput,
    ArmadoOrdenFichaTecnicaOutput,
    ArmadoModeloOutput,
    ArmadoModeloUpdateInput,
    ArmadoOrdenCostoInput,
    ArmadoOrdenCreateInput,
    ArmadoOrdenEstadoInput,
    ArmadoOrdenOutput,
    ArmadoOrdenSustitucionInput,
    ArmadoOrdenUpdateInput,
    ArmadoOrdenVolverArmadoInput,
    ArmadoSimulacionInput,
    ArmadoSimulacionOutput,
    ArmadoVersionCreateInput,
    ArmadoVersionOutput,
    ArmadoVersionUpdateInput,
)
from .service import (
    activar_configuracion,
    agregar_item_configuracion,
    archivar_configuracion,
    agregar_costo_orden,
    actualizar_control_final,
    actualizar_costo_final_orden,
    cambiar_estado_modelo,
    cambiar_estado_orden,
    cambiar_estado_version,
    cancelar_orden,
    crear_configuracion,
    crear_modelo,
    crear_orden,
    crear_version,
    duplicar_configuracion,
    editar_configuracion,
    editar_item_configuracion,
    editar_modelo,
    editar_orden,
    editar_version,
    eliminar_item_configuracion,
    finalizar_orden,
    listar_modelos,
    listar_ordenes,
    listar_sucursales,
    listar_versiones,
    obtener_configuracion,
    obtener_configuracion_activa,
    obtener_ficha_tecnica_orden,
    obtener_modelo_detalle,
    obtener_orden,
    pasar_a_control_final,
    iniciar_orden,
    recalcular_disponibilidad_orden,
    simular_configuracion,
    sustituir_item_orden,
    volver_a_en_armado,
)


router = APIRouter()
puede_gestionar_armado = requerir_permiso(PERMISO_GESTIONAR_ARMADO)


@router.get("/modelos", response_model=list[ArmadoModeloOutput])
def listar_modelos_route(
    incluir_inactivos: bool = False,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return listar_modelos(incluir_inactivos=incluir_inactivos)


@router.get("/ordenes", response_model=list[ArmadoOrdenOutput])
def listar_ordenes_route(
    estado: str | None = None,
    id_modelo: int | None = None,
    id_version: int | None = None,
    id_sucursal: int | None = None,
    id_usuario_responsable: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return listar_ordenes(
        {
            "estado": estado,
            "id_modelo": id_modelo,
            "id_version": id_version,
            "id_sucursal": id_sucursal,
            "id_usuario_responsable": id_usuario_responsable,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
        }
    )


@router.post("/ordenes", response_model=ArmadoOrdenOutput, status_code=201)
def crear_orden_route(
    data: ArmadoOrdenCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return crear_orden(data)


@router.get("/ordenes/{orden_id}", response_model=ArmadoOrdenOutput)
def obtener_orden_route(
    orden_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return obtener_orden(orden_id)


@router.put("/ordenes/{orden_id}", response_model=ArmadoOrdenOutput)
def editar_orden_route(
    orden_id: int,
    data: ArmadoOrdenUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return editar_orden(orden_id, data)


@router.post("/ordenes/{orden_id}/costos", response_model=ArmadoOrdenOutput)
def agregar_costo_orden_route(
    orden_id: int,
    data: ArmadoOrdenCostoInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return agregar_costo_orden(orden_id, data)


@router.post("/ordenes/{orden_id}/items/{item_id}/sustituir", response_model=ArmadoOrdenOutput)
def sustituir_item_orden_route(
    orden_id: int,
    item_id: int,
    data: ArmadoOrdenSustitucionInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return sustituir_item_orden(orden_id, item_id, data)


@router.post("/ordenes/{orden_id}/recalcular-disponibilidad", response_model=ArmadoOrdenOutput)
def recalcular_disponibilidad_orden_route(
    orden_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return recalcular_disponibilidad_orden(orden_id)


@router.post("/ordenes/{orden_id}/iniciar", response_model=ArmadoOrdenOutput)
def iniciar_orden_route(
    orden_id: int,
    data: ArmadoOrdenAccionInput | None = None,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    data = data or ArmadoOrdenAccionInput()
    aplicar_actor_actual(data, usuario)
    return iniciar_orden(orden_id, data)


@router.post("/ordenes/{orden_id}/cancelar", response_model=ArmadoOrdenOutput)
def cancelar_orden_route(
    orden_id: int,
    data: ArmadoOrdenCancelarInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return cancelar_orden(orden_id, data)


@router.post("/ordenes/{orden_id}/control-final", response_model=ArmadoOrdenOutput)
def pasar_a_control_final_route(
    orden_id: int,
    data: ArmadoOrdenAccionInput | None = None,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    data = data or ArmadoOrdenAccionInput()
    aplicar_actor_actual(data, usuario)
    return pasar_a_control_final(orden_id, data)


@router.post("/ordenes/{orden_id}/volver-armado", response_model=ArmadoOrdenOutput)
def volver_a_en_armado_route(
    orden_id: int,
    data: ArmadoOrdenVolverArmadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return volver_a_en_armado(orden_id, data)


@router.put("/ordenes/{orden_id}/controles", response_model=ArmadoOrdenOutput)
def actualizar_control_final_route(
    orden_id: int,
    data: ArmadoOrdenControlInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return actualizar_control_final(orden_id, data)


@router.patch("/ordenes/{orden_id}/costos/{costo_id}/final", response_model=ArmadoOrdenOutput)
def actualizar_costo_final_route(
    orden_id: int,
    costo_id: int,
    data: ArmadoOrdenCostoFinalInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return actualizar_costo_final_orden(orden_id, costo_id, data)


@router.post("/ordenes/{orden_id}/finalizar", response_model=ArmadoOrdenOutput)
def finalizar_orden_route(
    orden_id: int,
    data: ArmadoOrdenAccionInput | None = None,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    data = data or ArmadoOrdenAccionInput()
    aplicar_actor_actual(data, usuario)
    return finalizar_orden(orden_id, data)


@router.get("/ordenes/{orden_id}/ficha-tecnica", response_model=ArmadoOrdenFichaTecnicaOutput)
def obtener_ficha_tecnica_route(
    orden_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return obtener_ficha_tecnica_orden(orden_id)


@router.patch("/ordenes/{orden_id}/estado", response_model=ArmadoOrdenOutput)
def cambiar_estado_orden_route(
    orden_id: int,
    data: ArmadoOrdenEstadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return cambiar_estado_orden(orden_id, data)


@router.get("/sucursales")
def listar_sucursales_route(
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return listar_sucursales()


@router.get("/modelos/{modelo_id}/detalle")
def obtener_modelo_detalle_route(
    modelo_id: int,
    id_sucursal: int | None = None,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return obtener_modelo_detalle(modelo_id, id_sucursal=id_sucursal)


@router.post("/modelos", response_model=ArmadoModeloOutput, status_code=201)
def crear_modelo_route(
    data: ArmadoModeloCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return crear_modelo(data)


@router.put("/modelos/{modelo_id}", response_model=ArmadoModeloOutput)
def editar_modelo_route(
    modelo_id: int,
    data: ArmadoModeloUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return editar_modelo(modelo_id, data)


@router.patch("/modelos/{modelo_id}/estado", response_model=ArmadoModeloOutput)
def cambiar_estado_modelo_route(
    modelo_id: int,
    data: ArmadoEstadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return cambiar_estado_modelo(modelo_id, data)


@router.get("/versiones", response_model=list[ArmadoVersionOutput])
def listar_versiones_route(
    id_modelo: int | None = None,
    incluir_inactivas: bool = False,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return listar_versiones(
        id_modelo=id_modelo,
        incluir_inactivas=incluir_inactivas,
    )


@router.get("/modelos/{modelo_id}/versiones", response_model=list[ArmadoVersionOutput])
def listar_versiones_modelo_route(
    modelo_id: int,
    incluir_inactivas: bool = False,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return listar_versiones(
        id_modelo=modelo_id,
        incluir_inactivas=incluir_inactivas,
    )


@router.post("/versiones", response_model=ArmadoVersionOutput, status_code=201)
def crear_version_route(
    data: ArmadoVersionCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return crear_version(data)


@router.put("/versiones/{version_id}", response_model=ArmadoVersionOutput)
def editar_version_route(
    version_id: int,
    data: ArmadoVersionUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return editar_version(version_id, data)


@router.patch("/versiones/{version_id}/estado", response_model=ArmadoVersionOutput)
def cambiar_estado_version_route(
    version_id: int,
    data: ArmadoEstadoInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return cambiar_estado_version(version_id, data)


@router.post("/configuraciones", response_model=ArmadoConfiguracionOutput, status_code=201)
def crear_configuracion_route(
    data: ArmadoConfiguracionCreateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return crear_configuracion(data)


@router.get("/configuraciones/{configuracion_id}", response_model=ArmadoConfiguracionOutput)
def obtener_configuracion_route(
    configuracion_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return obtener_configuracion(configuracion_id)


@router.post("/simulador/calcular", response_model=ArmadoSimulacionOutput)
def simular_configuracion_route(
    data: ArmadoSimulacionInput,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return simular_configuracion(data)


@router.get(
    "/versiones/{version_id}/configuracion-activa",
    response_model=ArmadoConfiguracionOutput,
)
def obtener_configuracion_activa_route(
    version_id: int,
    _usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return obtener_configuracion_activa(version_id)


@router.put("/configuraciones/{configuracion_id}", response_model=ArmadoConfiguracionOutput)
def editar_configuracion_route(
    configuracion_id: int,
    data: ArmadoConfiguracionUpdateInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return editar_configuracion(configuracion_id, data)


@router.post(
    "/configuraciones/{configuracion_id}/items",
    response_model=ArmadoConfiguracionOutput,
)
def agregar_item_configuracion_route(
    configuracion_id: int,
    data: ArmadoConfiguracionItemInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return agregar_item_configuracion(configuracion_id, data)


@router.put(
    "/configuraciones/{configuracion_id}/items/{item_id}",
    response_model=ArmadoConfiguracionOutput,
)
def editar_item_configuracion_route(
    configuracion_id: int,
    item_id: int,
    data: ArmadoConfiguracionItemInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return editar_item_configuracion(configuracion_id, item_id, data)


@router.delete(
    "/configuraciones/{configuracion_id}/items/{item_id}",
    response_model=ArmadoConfiguracionOutput,
)
def eliminar_item_configuracion_route(
    configuracion_id: int,
    item_id: int,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return eliminar_item_configuracion(
        configuracion_id,
        item_id,
        id_usuario=usuario.id,
    )


@router.post(
    "/configuraciones/{configuracion_id}/duplicar",
    response_model=ArmadoConfiguracionOutput,
)
def duplicar_configuracion_route(
    configuracion_id: int,
    data: ArmadoConfiguracionDuplicarInput,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    aplicar_actor_actual(data, usuario)
    return duplicar_configuracion(configuracion_id, data)


@router.post(
    "/configuraciones/{configuracion_id}/activar",
    response_model=ArmadoConfiguracionOutput,
)
def activar_configuracion_route(
    configuracion_id: int,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return activar_configuracion(configuracion_id, id_usuario=usuario.id)


@router.post(
    "/configuraciones/{configuracion_id}/archivar",
    response_model=ArmadoConfiguracionOutput,
)
def archivar_configuracion_route(
    configuracion_id: int,
    usuario: CurrentUser = Depends(puede_gestionar_armado),
):
    return archivar_configuracion(configuracion_id, id_usuario=usuario.id)
