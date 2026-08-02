from typing import List
from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import exigir_permiso_actual, requerir_permiso
from app.shared.constants import (
    PERMISO_ANULAR_VENTA,
    PERMISO_APLICAR_CREDITO_VENTA,
    PERMISO_CREAR_VENTA,
    PERMISO_GESTIONAR_DEVOLUCIONES,
    PERMISO_GESTIONAR_CORRECCIONES,
    PERMISO_MODIFICAR_PRECIO_VENTA,
    PERMISO_REGISTRAR_PAGO,
    PERMISO_VER_RENTABILIDAD,
)
from .schema import (
    VentaCreateInput,
    VentaCreateOutput,
    VentaResumenOutput,
    VentaDetalleOutput,
    VentaEntregaInput,
    VentaEstadoOutput,
    VentaAnulacionInput,
    VentaAnulacionOutput,
    VentaCorreccionClienteInput,
    VentaCorreccionClienteOutput,
    VentaAsignarBicicletaSerializadaInput,
    VentaAsignarBicicletaSerializadaOutput,
    VentaDevolucionSerializadaInput,
    VentaDevolucionSerializadaOutput,
    VentaDevolucionInput,
    VentaDevolucionOutput,
    VentaDevolucionParcialInput,
    VentaDevolucionParcialOutput,
    VentaSimulacionInput, 
    VentaSimulacionOut
)
from .service import (
    crear_venta,
    listar_ventas,
    obtener_venta,
    entregar_venta,
    anular_venta,
    corregir_cliente_venta,
    asignar_bicicleta_serializada_a_venta,
    devolver_item_serializado_entregado,
    devolver_venta,
    devolver_items,
    simular_venta
)

router = APIRouter()
puede_crear_venta = requerir_permiso(PERMISO_CREAR_VENTA)
puede_anular_venta = requerir_permiso(PERMISO_ANULAR_VENTA)
puede_gestionar_devoluciones = requerir_permiso(PERMISO_GESTIONAR_DEVOLUCIONES)
puede_gestionar_correcciones = requerir_permiso(PERMISO_GESTIONAR_CORRECCIONES)


def _tiene_precio_manual_o_bonificacion(data: VentaCreateInput) -> bool:
    return any(
        item.precio_unitario_manual is not None
        or item.bonificado
        or item.bonificacion_unitaria_manual is not None
        for item in data.items
    )


@router.post("/", response_model=VentaCreateOutput)
def registrar_venta(
    data: VentaCreateInput,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(data, usuario)

    if data.pagos:
        exigir_permiso_actual(usuario, PERMISO_REGISTRAR_PAGO)

    if data.usar_credito:
        exigir_permiso_actual(usuario, PERMISO_APLICAR_CREDITO_VENTA)

    if _tiene_precio_manual_o_bonificacion(data):
        exigir_permiso_actual(usuario, PERMISO_MODIFICAR_PRECIO_VENTA)

    return crear_venta(data)


@router.get("/", response_model=List[VentaResumenOutput])
def ventas():
    return listar_ventas()


@router.get("/{venta_id}", response_model=VentaDetalleOutput)
def venta_detalle(
    venta_id: int,
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    detalle = obtener_venta(venta_id)
    puede_ver_costos = (
        usuario.auth_disabled
        or "*" in usuario.permisos
        or PERMISO_VER_RENTABILIDAD in usuario.permisos
    )
    if not puede_ver_costos:
        for item in detalle["items"]:
            item["costo_unitario_aplicado"] = None
            item["origen_costo"] = None
            item["id_orden_armado_origen"] = None
            item["codigo_orden_armado"] = None

    return detalle


@router.post("/{venta_id}/entregar", response_model=VentaEstadoOutput)
def entregar_venta_route(
    venta_id: int,
    data: VentaEntregaInput,
    usuario: CurrentUser = Depends(puede_crear_venta),
):
    aplicar_actor_actual(data, usuario)
    return entregar_venta(venta_id, data)


@router.post("/{venta_id}/anular", response_model=VentaAnulacionOutput)
def anular_venta_route(
    venta_id: int,
    data: VentaAnulacionInput,
    usuario: CurrentUser = Depends(puede_anular_venta),
):
    aplicar_actor_actual(data, usuario)
    return anular_venta(venta_id, data)


@router.post("/{venta_id}/corregir-cliente", response_model=VentaCorreccionClienteOutput)
def corregir_cliente_venta_route(
    venta_id: int,
    data: VentaCorreccionClienteInput,
    usuario: CurrentUser = Depends(puede_gestionar_correcciones),
):
    aplicar_actor_actual(data, usuario)
    return corregir_cliente_venta(venta_id, data)


@router.post(
    "/{venta_id}/asignar-bicicleta-serializada",
    response_model=VentaAsignarBicicletaSerializadaOutput,
)
def asignar_bicicleta_serializada_route(
    venta_id: int,
    data: VentaAsignarBicicletaSerializadaInput,
    usuario: CurrentUser = Depends(puede_gestionar_correcciones),
):
    aplicar_actor_actual(data, usuario)
    return asignar_bicicleta_serializada_a_venta(venta_id, data)


@router.post(
    "/{venta_id}/devolver-serializada",
    response_model=VentaDevolucionSerializadaOutput,
)
def devolver_serializada_route(
    venta_id: int,
    data: VentaDevolucionSerializadaInput,
    usuario: CurrentUser = Depends(puede_gestionar_devoluciones),
):
    aplicar_actor_actual(data, usuario)
    return devolver_item_serializado_entregado(venta_id, data)

@router.post("/{venta_id}/devolver", response_model=VentaDevolucionOutput)
def devolver_venta_route(
    venta_id: int,
    data: VentaDevolucionInput,
    usuario: CurrentUser = Depends(puede_gestionar_devoluciones),
):
    aplicar_actor_actual(data, usuario)
    return devolver_venta(venta_id, data)

@router.post("/{venta_id}/devolver-items", response_model=VentaDevolucionParcialOutput)
def devolver_items_route(
    venta_id: int,
    data: VentaDevolucionParcialInput,
    usuario: CurrentUser = Depends(puede_gestionar_devoluciones),
):
    aplicar_actor_actual(data, usuario)
    return devolver_items(venta_id, data)

@router.post("/simular", response_model=VentaSimulacionOut)
def simular_venta_endpoint(data: VentaSimulacionInput):
    return simular_venta(data)
