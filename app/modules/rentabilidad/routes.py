from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core.security import CurrentUser, aplicar_actor_actual
from app.modules.documentos.pdf_resultado_distribuible import (
    generar_resultado_distribuible_pdf,
)
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_VER_RENTABILIDAD

from .schema import (
    BonificacionesGarantiasOutput,
    CierreRentabilidadCreateInput,
    CierreRentabilidadCreateOutput,
    CierreRentabilidadOutput,
    ReglaDistribucionCreateInput,
    ReglaDistribucionEstadoOutput,
    ReglaDistribucionOutput,
    RentabilidadDiariaOutput,
    RentabilidadMensualOutput,
)
from .service import (
    calcular_bonificaciones_garantias,
    calcular_rentabilidad_diaria,
    calcular_rentabilidad_mensual,
    cambiar_estado_regla,
    crear_cierre_rentabilidad,
    crear_regla_distribucion,
    listar_cierres,
    listar_reglas,
    obtener_cierre,
)

router = APIRouter()
puede_ver_rentabilidad = requerir_permiso(PERMISO_VER_RENTABILIDAD)


@router.post("/reglas", response_model=ReglaDistribucionOutput)
def crear_regla_route(
    data: ReglaDistribucionCreateInput,
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return crear_regla_distribucion(data)


@router.get("/reglas", response_model=List[ReglaDistribucionOutput])
def reglas_route(
    incluir_inactivas: bool = False,
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return listar_reglas(incluir_inactivas=incluir_inactivas)


@router.patch("/reglas/{regla_id}/estado", response_model=ReglaDistribucionEstadoOutput)
def cambiar_estado_regla_route(
    regla_id: int,
    activa: bool,
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return cambiar_estado_regla(regla_id, activa)


@router.get("/mensual", response_model=RentabilidadMensualOutput)
def rentabilidad_mensual_route(
    periodo_mes: date,
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    id_regla_distribucion: Optional[int] = Query(default=None, gt=0),
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return calcular_rentabilidad_mensual(periodo_mes, id_sucursal, id_regla_distribucion)


@router.get("/resultado-distribuible/pdf")
def resultado_distribuible_pdf_route(
    periodo_mes: date,
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    id_regla_distribucion: Optional[int] = Query(default=None, gt=0),
    incluir_detalle: bool = False,
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    data = calcular_rentabilidad_mensual(
        periodo_mes,
        id_sucursal,
        id_regla_distribucion,
    )

    mes_anterior = date(periodo_mes.year, periodo_mes.month, 1) - timedelta(days=1)
    periodo_anterior = calcular_rentabilidad_mensual(
        date(mes_anterior.year, mes_anterior.month, 1),
        id_sucursal,
        id_regla_distribucion,
    )

    detalle_diario = []
    if incluir_detalle:
        dia = data["fecha_desde"]
        while dia <= data["fecha_hasta"]:
            detalle_diario.append(calcular_rentabilidad_diaria(dia, id_sucursal))
            dia += timedelta(days=1)

    pdf_bytes = generar_resultado_distribuible_pdf(
        data,
        periodo_anterior=periodo_anterior,
        detalle_diario=detalle_diario,
    )
    filename = f"Resultado-Distribuible-{data['periodo_mes'].strftime('%Y-%m')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/diaria", response_model=RentabilidadDiariaOutput)
def rentabilidad_diaria_route(
    fecha: date,
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return calcular_rentabilidad_diaria(fecha, id_sucursal)


@router.get(
    "/bonificaciones-garantias",
    response_model=BonificacionesGarantiasOutput,
)
def bonificaciones_garantias_route(
    periodo_mes: date,
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return calcular_bonificaciones_garantias(periodo_mes, id_sucursal)


@router.post("/cierres", response_model=CierreRentabilidadCreateOutput)
def crear_cierre_route(
    data: CierreRentabilidadCreateInput,
    usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    aplicar_actor_actual(data, usuario)
    return crear_cierre_rentabilidad(data)


@router.get("/cierres", response_model=List[CierreRentabilidadOutput])
def cierres_route(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return listar_cierres(limit=limit, offset=offset)


@router.get("/cierres/{cierre_id}", response_model=CierreRentabilidadOutput)
def cierre_detalle_route(
    cierre_id: int,
    _usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return obtener_cierre(cierre_id)
