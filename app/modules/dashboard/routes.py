from datetime import date
from typing import Optional

from fastapi import APIRouter, Query, Request

from app.core.config import settings
from .schema import DashboardResumenOutput
from .service import obtener_dashboard_resumen

router = APIRouter()


@router.get("/resumen", response_model=DashboardResumenOutput)
def dashboard_resumen_route(
    request: Request,
    periodo_mes: Optional[date] = None,
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    dias_sin_movimiento: int = Query(default=90, ge=1, le=3650),
    umbral_repuestos_criticos: int = Query(default=2, ge=0, le=999999),
    limit: int = Query(default=10, ge=1, le=50),
):
    id_usuario = None
    if not settings.auth_disabled:
        id_usuario = int(request.state.usuario["sub"])

    return obtener_dashboard_resumen(
        periodo_mes=periodo_mes,
        id_sucursal=id_sucursal,
        dias_sin_movimiento=dias_sin_movimiento,
        umbral_repuestos_criticos=umbral_repuestos_criticos,
        limit=limit,
        id_usuario=id_usuario,
    )
