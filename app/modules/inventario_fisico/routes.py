from fastapi import APIRouter, Query

from .schemas import (
    InventarioFisicoCancelarInput,
    InventarioFisicoCerrarInput,
    InventarioFisicoConteoInput,
    InventarioFisicoCreate,
    InventarioFisicoDetalleOut,
    InventarioFisicoDiferenciaOut,
    InventarioFisicoItemOut,
    InventarioFisicoOut,
)
from .service import (
    cancelar_inventario_abierto,
    cargar_conteo,
    cerrar_y_ajustar_inventario,
    crear_inventario,
    listar_diferencias_inventario,
    listar_inventarios,
    obtener_inventario,
)

router = APIRouter()


@router.get("/", response_model=list[InventarioFisicoOut])
def listar():
    return listar_inventarios()


@router.post("/", response_model=InventarioFisicoDetalleOut, status_code=201)
def crear(payload: InventarioFisicoCreate):
    return crear_inventario(payload)


@router.get("/diferencias", response_model=list[InventarioFisicoDiferenciaOut])
def diferencias(
    id_sucursal: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    return listar_diferencias_inventario(id_sucursal=id_sucursal, limit=limit)


@router.get("/{inventario_id}", response_model=InventarioFisicoDetalleOut)
def detalle(inventario_id: int):
    return obtener_inventario(inventario_id)


@router.post("/{inventario_id}/conteos", response_model=InventarioFisicoItemOut)
def contar(inventario_id: int, payload: InventarioFisicoConteoInput):
    return cargar_conteo(inventario_id, payload)


@router.post("/{inventario_id}/cerrar", response_model=InventarioFisicoDetalleOut)
def cerrar(inventario_id: int, payload: InventarioFisicoCerrarInput):
    return cerrar_y_ajustar_inventario(inventario_id, payload)


@router.post("/{inventario_id}/cancelar", response_model=InventarioFisicoDetalleOut)
def cancelar(inventario_id: int, payload: InventarioFisicoCancelarInput):
    return cancelar_inventario_abierto(inventario_id, payload)
