from fastapi import APIRouter
from .service import listar_categorias, listar_productos, listar_variantes
from .schema import CategoriaOut, ProductoOut, VarianteOut

router = APIRouter()


@router.get("/categorias", response_model=list[CategoriaOut])
def categorias():
    return listar_categorias()


@router.get("/productos", response_model=list[ProductoOut])
def productos():
    return listar_productos()


@router.get("/variantes", response_model=list[VarianteOut])
def variantes():
    return listar_variantes()