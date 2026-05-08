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
    obtener_producto,
    editar_producto,
    cambiar_estado_producto,
    obtener_variante,
    editar_variante,
    cambiar_estado_variante,
   
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
    ProductoUpdate,
    ProductoEstadoUpdate,
    VarianteUpdate,
    VarianteEstadoUpdate,
    CatalogoPOSPaginatedOut,
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

@router.get("/pos", response_model=CatalogoPOSPaginatedOut)
def catalogo_pos(
    id_sucursal: int,
    query: str | None = None,
    categoria_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
):
    return listar_catalogo_pos(
        id_sucursal=id_sucursal,
        query=query,
        categoria_id=categoria_id,
        limit=limit,
        offset=offset,
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

@router.get("/productos/{producto_id}", response_model=ProductoCreateOut)
def producto_detalle_route(producto_id: int):
    return obtener_producto(producto_id)


@router.put("/productos/{producto_id}", response_model=ProductoCreateOut)
def editar_producto_route(producto_id: int, data: ProductoUpdate):
    return editar_producto(producto_id, data)


@router.post("/productos/{producto_id}/estado", response_model=ProductoCreateOut)
def cambiar_estado_producto_route(producto_id: int, data: ProductoEstadoUpdate):
    return cambiar_estado_producto(producto_id, data)


@router.get("/variantes/{variante_id}", response_model=VarianteOut)
def variante_detalle_route(variante_id: int):
    return obtener_variante(variante_id)


@router.put("/variantes/{variante_id}", response_model=VarianteOut)
def editar_variante_route(variante_id: int, data: VarianteUpdate):
    return editar_variante(variante_id, data)


@router.post("/variantes/{variante_id}/estado", response_model=VarianteOut)
def cambiar_estado_variante_route(variante_id: int, data: VarianteEstadoUpdate):
    return cambiar_estado_variante(variante_id, data)