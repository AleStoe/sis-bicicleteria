from fastapi import APIRouter

from .service import (
    listar_categorias,
    listar_productos,
    listar_variantes,
    crear_imagen,
    obtener_imagenes_producto,
    obtener_imagenes_variante,
    editar_imagen,
    eliminar_imagen,
    listar_catalogo_pos,
)

from .schema import (
    CategoriaOut,
    ProductoOut,
    VarianteOut,
    CatalogoImagenCreate,
    CatalogoImagenUpdate,
    CatalogoImagenOut,
    CatalogoPOSItemOut,
)

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

@router.post("/imagenes", response_model=CatalogoImagenOut)
def crear_imagen_catalogo(data: CatalogoImagenCreate):
    return crear_imagen(data)


@router.get("/productos/{id_producto}/imagenes", response_model=list[CatalogoImagenOut])
def imagenes_producto(id_producto: int):
    return obtener_imagenes_producto(id_producto)


@router.get("/variantes/{id_variante}/imagenes", response_model=list[CatalogoImagenOut])
def imagenes_variante(id_variante: int):
    return obtener_imagenes_variante(id_variante)


@router.put("/imagenes/{imagen_id}", response_model=CatalogoImagenOut)
def actualizar_imagen(imagen_id: int, data: CatalogoImagenUpdate):
    return editar_imagen(imagen_id, data)


@router.delete("/imagenes/{imagen_id}", response_model=CatalogoImagenOut)
def borrar_imagen(imagen_id: int):
    return eliminar_imagen(imagen_id)

@router.get("/pos", response_model=list[CatalogoPOSItemOut])
def catalogo_pos(
    id_sucursal: int,
    query: str | None = None,
    categoria_id: int | None = None,
    limit: int = 50,
):
    return listar_catalogo_pos(
        id_sucursal=id_sucursal,
        query=query,
        categoria_id=categoria_id,
        limit=limit,
    )