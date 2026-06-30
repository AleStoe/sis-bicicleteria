from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser
from app.modules.authz.service import requerir_permiso
from app.shared.constants import PERMISO_VER_RENTABILIDAD
from .schema import DashboardResumenOutput
from .service import obtener_dashboard_resumen

router = APIRouter()
puede_ver_rentabilidad = requerir_permiso(PERMISO_VER_RENTABILIDAD)


@router.get("/resumen", response_model=DashboardResumenOutput)
def dashboard_resumen_route(
    periodo_mes: Optional[date] = None,
    id_sucursal: Optional[int] = Query(default=None, gt=0),
    dias_sin_movimiento: int = Query(default=90, ge=1, le=3650),
    umbral_repuestos_criticos: int = Query(default=2, ge=0, le=999999),
    limit: int = Query(default=10, ge=1, le=50),
    usuario: CurrentUser = Depends(puede_ver_rentabilidad),
):
    return obtener_dashboard_resumen(
        periodo_mes=periodo_mes,
        id_sucursal=id_sucursal,
        dias_sin_movimiento=dias_sin_movimiento,
        umbral_repuestos_criticos=umbral_repuestos_criticos,
        limit=limit,
        id_usuario=None if usuario.auth_disabled else usuario.id,
    )
