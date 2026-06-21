from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

from .service import (
    listar_categorias,
    crear_categoria,
    editar_categoria,
    cambiar_estado_categoria,
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
    buscar_catalogo_pos_por_codigo,
    obtener_ficha_tecnica_producto,
    reemplazar_ficha_tecnica_producto_service,
    generar_catalogo_mayorista_pdf_service,
    generar_catalogo_bicicletas_pdf_service,
   
)

from .schema import (
    CategoriaOut,
    CategoriaCreate,
    CategoriaUpdate,
    CategoriaEstadoUpdate,
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
    ProductoFichaTecnicaItemOut,
    ProductoFichaTecnicaReplaceInput,
)

router = APIRouter()


@router.get("/categorias", response_model=list[CategoriaOut])
def categorias(incluir_inactivas: bool = False):
    return listar_categorias(incluir_inactivas=incluir_inactivas)


@router.post("/categorias", response_model=CategoriaOut)
def crear_categoria_route(data: CategoriaCreate):
    return crear_categoria(data)


@router.put("/categorias/{categoria_id}", response_model=CategoriaOut)
def editar_categoria_route(categoria_id: int, data: CategoriaUpdate):
    return editar_categoria(categoria_id, data)


@router.patch("/categorias/{categoria_id}/estado", response_model=CategoriaOut)
def cambiar_estado_categoria_route(categoria_id: int, data: CategoriaEstadoUpdate):
    return cambiar_estado_categoria(categoria_id, data)


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
    marca_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
):
    return listar_catalogo_pos(
        id_sucursal=id_sucursal,
        query=query,
        categoria_id=categoria_id,
        marca_id=marca_id,
        limit=limit,
        offset=offset,
    )


@router.get("/pdf/mayorista")
def catalogo_mayorista_pdf(
    id_sucursal: int,
    categoria_id: int | None = None,
    marca_id: int | None = None,
):
    pdf_bytes = generar_catalogo_mayorista_pdf_service(
        id_sucursal=id_sucursal,
        categoria_id=categoria_id,
        marca_id=marca_id,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="catalogo-mayorista.pdf"'
        },
    )


@router.get("/pdf/bicicletas")
def catalogo_bicicletas_pdf(
    id_sucursal: int,
    marca_id: int | None = None,
):
    pdf_bytes = generar_catalogo_bicicletas_pdf_service(
        id_sucursal=id_sucursal,
        marca_id=marca_id,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="catalogo-bicicletas.pdf"'
        },
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

@router.get("/pos/buscar-exacto", response_model=CatalogoPOSItemOut)
def catalogo_pos_buscar_exacto(
    id_sucursal: int,
    codigo: str,
):
    return buscar_catalogo_pos_por_codigo(
        id_sucursal=id_sucursal,
        codigo=codigo,
    )

BASE_DIR = Path(__file__).resolve().parents[3]
UPLOADS_CATALOGO_DIR = BASE_DIR / "uploads" / "catalogo"
UPLOADS_CATALOGO_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/imagenes/upload", response_model=CatalogoImagenOut)
async def subir_imagen_catalogo(
    archivo: UploadFile = File(...),
    id_producto: int | None = Form(default=None),
    id_variante: int | None = Form(default=None),
    es_principal: bool = Form(default=True),
    orden: int = Form(default=0),
):
    if id_producto is None and id_variante is None:
        raise HTTPException(
            status_code=400,
            detail="La imagen debe pertenecer a un producto o a una variante",
        )

    if id_producto is not None and id_variante is not None:
        raise HTTPException(
            status_code=400,
            detail="La imagen no puede pertenecer a producto y variante al mismo tiempo",
        )

    extension = Path(archivo.filename or "").suffix.lower()

    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(
            status_code=400,
            detail="Formato de imagen no permitido. Usá jpg, jpeg, png o webp",
        )

    nombre_archivo = f"{uuid4().hex}{extension}"
    destino = UPLOADS_CATALOGO_DIR / nombre_archivo

    contenido = await archivo.read()

    if len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="La imagen no puede superar 5MB",
        )

    destino.write_bytes(contenido)

    url = f"/uploads/catalogo/{nombre_archivo}"

    return crear_imagen(
        CatalogoImagenCreate(
            id_producto=id_producto,
            id_variante=id_variante,
            url=url,
            es_principal=es_principal,
            orden=orden,
        )
    )

@router.get(
    "/productos/{producto_id}/ficha-tecnica",
    response_model=list[ProductoFichaTecnicaItemOut],
)
def ficha_tecnica_producto(producto_id: int):
    return obtener_ficha_tecnica_producto(producto_id)


@router.put(
    "/productos/{producto_id}/ficha-tecnica",
    response_model=list[ProductoFichaTecnicaItemOut],
)
def reemplazar_ficha_tecnica_producto_route(
    producto_id: int,
    data: ProductoFichaTecnicaReplaceInput,
):
    return reemplazar_ficha_tecnica_producto_service(producto_id, data)
