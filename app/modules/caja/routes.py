from typing import List
from datetime import date
from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, aplicar_actor_actual, obtener_usuario_actual
from app.modules.authz.service import requerir_permiso
from app.shared.constants import (
    PERMISO_ABRIR_CAJA,
    PERMISO_AJUSTAR_CAJA,
    PERMISO_CERRAR_CAJA,
    PERMISO_REGISTRAR_EGRESO,
    PERMISO_VER_RENTABILIDAD,
)

from .schema import (
    CajaAbrirInput,
    CajaAbrirOutput,
    CajaAbiertaResumenOutput,
    CajaCerrarInput,
    CajaCerrarOutput,
    CajaDetalleOutput,
    CajaEgresoInput,
    CajaEgresoOutput,
    CajaAjusteInput,
    CajaHistorialOutput,
    CajaResumenDiarioOutput,
)
from .service import abrir_caja, cerrar_caja, obtener_caja_abierta, obtener_caja_detalle, registrar_egreso, registrar_ajuste, listar_historial_cajas, obtener_resumen_diario_caja

router = APIRouter()
puede_abrir_caja = requerir_permiso(PERMISO_ABRIR_CAJA)
puede_cerrar_caja = requerir_permiso(PERMISO_CERRAR_CAJA)
puede_ajustar_caja = requerir_permiso(PERMISO_AJUSTAR_CAJA)
puede_registrar_egreso = requerir_permiso(PERMISO_REGISTRAR_EGRESO)


@router.post("/abrir", response_model=CajaAbrirOutput)
def abrir_caja_route(
    data: CajaAbrirInput,
    usuario: CurrentUser = Depends(puede_abrir_caja),
):
    aplicar_actor_actual(data, usuario)
    return abrir_caja(data)


@router.get("/abierta", response_model=CajaAbiertaResumenOutput)
def caja_abierta(id_sucursal: int):
    return obtener_caja_abierta(id_sucursal)

@router.get("/historial", response_model=List[CajaHistorialOutput])
def caja_historial_route(
    id_sucursal: int | None = Query(default=None, gt=0),
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    estado: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return listar_historial_cajas(
        id_sucursal=id_sucursal,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        limit=limit,
        offset=offset,
    )

@router.get("/resumen-diario", response_model=CajaResumenDiarioOutput)
def caja_resumen_diario_route(
    fecha: date | None = None,
    id_sucursal: int | None = Query(default=None, gt=0),
    usuario: CurrentUser = Depends(obtener_usuario_actual),
):
    resumen = obtener_resumen_diario_caja(
        fecha=fecha,
        id_sucursal=id_sucursal,
    )
    puede_ver_rentabilidad = (
        usuario.auth_disabled
        or "*" in usuario.permisos
        or PERMISO_VER_RENTABILIDAD in usuario.permisos
    )
    if puede_ver_rentabilidad:
        return resumen

    rentabilidad = {
        **dict(resumen["rentabilidad"]),
        "costo_mercaderia_vendida": None,
        "margen_bruto": None,
        "ganancia_dia": None,
    }
    return {**dict(resumen), "rentabilidad": rentabilidad}

@router.get("/{caja_id}", response_model=CajaDetalleOutput)
def caja_detalle(caja_id: int):
    return obtener_caja_detalle(caja_id)


@router.post("/{caja_id}/egresos", response_model=CajaEgresoOutput)
def registrar_egreso_route(
    caja_id: int,
    data: CajaEgresoInput,
    usuario: CurrentUser = Depends(puede_registrar_egreso),
):
    aplicar_actor_actual(data, usuario)
    return registrar_egreso(caja_id, data)


@router.post("/{caja_id}/cerrar", response_model=CajaCerrarOutput)
def cerrar_caja_route(
    caja_id: int,
    data: CajaCerrarInput,
    usuario: CurrentUser = Depends(puede_cerrar_caja),
):
    aplicar_actor_actual(data, usuario)
    return cerrar_caja(caja_id, data)

@router.post("/{caja_id}/ajustes", response_model=CajaEgresoOutput)
def registrar_ajuste_route(
    caja_id: int,
    data: CajaAjusteInput,
    usuario: CurrentUser = Depends(puede_ajustar_caja),
):
    aplicar_actor_actual(data, usuario)
    return registrar_ajuste(caja_id, data)
