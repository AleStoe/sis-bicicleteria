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
    crear_producto,
    crear_variante,    
    listar_marcas,
    crear_marca,
)

from .schema import (
    CategoriaOut,
    ProductoOut,
    VarianteOut,
    CatalogoImagenCreate,
    CatalogoImagenUpdate,
    CatalogoImagenOut,
    CatalogoPOSItemOut,
    ProductoCreate,
    ProductoCreateOut,
    VarianteCreate,
    VarianteCreateOut,    
    MarcaOut,
    MarcaCreate,
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

@router.post("/productos", response_model=ProductoCreateOut)
def crear_producto_route(data: ProductoCreate):
    return crear_producto(data)


@router.post("/variantes", response_model=VarianteCreateOut)
def crear_variante_route(data: VarianteCreate):
    return crear_variante(data)

@router.get("/marcas", response_model=list[MarcaOut])
def marcas():
    return listar_marcas()


@router.post("/marcas", response_model=MarcaOut)
def crear_marca_route(data: MarcaCreate):
    return crear_marca(data)