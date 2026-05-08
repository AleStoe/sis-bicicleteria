from app.db.connection import get_connection
from fastapi import HTTPException
from psycopg.errors import UniqueViolation, CheckViolation, ForeignKeyViolation
from .repository import (
    get_categorias,
    get_productos,
    get_variantes,
    crear_imagen_catalogo,
    listar_imagenes_producto,
    listar_imagenes_variante,
    obtener_imagen_catalogo,
    actualizar_imagen_catalogo,
    desactivar_imagen_catalogo,
    get_catalogo_pos,
    get_categoria_by_id,
    get_marca_by_id,
    get_proveedor_by_id,
    get_producto_by_id,
    crear_producto_catalogo,
    crear_variante_catalogo,
    get_marcas,
    crear_marca_catalogo,
    update_producto_catalogo,
    update_producto_estado,
    get_variante_by_id,
    update_variante_catalogo,
    update_variante_estado,
    asignar_identidad_variante,
)


def listar_categorias():
    conn = get_connection()

    try:
        return get_categorias(conn)

    finally:
        conn.close()


def listar_productos():
    conn = get_connection()

    try:
        return get_productos(conn)

    finally:
        conn.close()


def listar_variantes():
    conn = get_connection()

    try:
        return get_variantes(conn)

    finally:
        conn.close()

def _validar_destino_imagen(data: dict):
    id_producto = data.get("id_producto")
    id_variante = data.get("id_variante")

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


def _quitar_principal_anterior(conn, imagen: dict):
    if not imagen.get("es_principal"):
        return

    with conn.cursor() as cur:
        if imagen.get("id_producto") is not None:
            cur.execute("""
                UPDATE catalogo_imagenes
                SET es_principal = FALSE
                WHERE id_producto = %s
                  AND activo = TRUE
            """, (imagen["id_producto"],))

        if imagen.get("id_variante") is not None:
            cur.execute("""
                UPDATE catalogo_imagenes
                SET es_principal = FALSE
                WHERE id_variante = %s
                  AND activo = TRUE
            """, (imagen["id_variante"],))


def crear_imagen(data):
    payload = data.model_dump()
    _validar_destino_imagen(payload)

    conn = get_connection()
    try:
        with conn.transaction():
            if payload.get("es_principal"):
                _quitar_principal_anterior(conn, payload)

            return crear_imagen_catalogo(conn, payload)
    finally:
        conn.close()


def obtener_imagenes_producto(id_producto: int):
    conn = get_connection()
    try:
        return listar_imagenes_producto(conn, id_producto)
    finally:
        conn.close()


def obtener_imagenes_variante(id_variante: int):
    conn = get_connection()
    try:
        return listar_imagenes_variante(conn, id_variante)
    finally:
        conn.close()


def editar_imagen(imagen_id: int, data):
    payload = data.model_dump(exclude_unset=True)

    conn = get_connection()
    try:
        with conn.transaction():
            imagen_actual = obtener_imagen_catalogo(conn, imagen_id)

            if imagen_actual is None:
                raise HTTPException(status_code=404, detail="Imagen no encontrada")

            if payload.get("es_principal") is True:
                _quitar_principal_anterior(conn, imagen_actual)

            return actualizar_imagen_catalogo(conn, imagen_id, payload)
    finally:
        conn.close()


def eliminar_imagen(imagen_id: int):
    conn = get_connection()
    try:
        with conn.transaction():
            imagen = desactivar_imagen_catalogo(conn, imagen_id)

            if imagen is None:
                raise HTTPException(status_code=404, detail="Imagen no encontrada")

            return imagen
    finally:
        conn.close()

def listar_catalogo_pos(
    id_sucursal: int,
    query: str | None = None,
    categoria_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
):
    if limit < 1:
        raise HTTPException(status_code=400, detail="El límite debe ser mayor a 0")

    if limit > 100:
        raise HTTPException(status_code=400, detail="El límite máximo permitido es 100")

    if offset < 0:
        raise HTTPException(status_code=400, detail="El offset no puede ser negativo")

    conn = get_connection()
    try:
        return get_catalogo_pos(
            conn,
            id_sucursal=id_sucursal,
            query=query,
            categoria_id=categoria_id,
            limit=limit,
            offset=offset,
        )
    finally:
        conn.close()
    
def _validar_categoria_activa(conn, categoria_id: int):
    categoria = get_categoria_by_id(conn, categoria_id)

    if categoria is None:
        raise HTTPException(status_code=400, detail="La categoría no existe")

    if not categoria["activo"]:
        raise HTTPException(status_code=400, detail="La categoría está inactiva")

    return categoria


def _validar_marca_activa(conn, marca_id: int | None):
    if marca_id is None:
        return None

    marca = get_marca_by_id(conn, marca_id)

    if marca is None:
        raise HTTPException(status_code=400, detail="La marca no existe")

    if not marca["activa"]:
        raise HTTPException(status_code=400, detail="La marca está inactiva")

    return marca


def _validar_proveedor_activo(conn, proveedor_id: int | None):
    if proveedor_id is None:
        return None

    proveedor = get_proveedor_by_id(conn, proveedor_id)

    if proveedor is None:
        raise HTTPException(status_code=400, detail="El proveedor no existe")

    if not proveedor["activo"]:
        raise HTTPException(status_code=400, detail="El proveedor está inactivo")

    return proveedor

def _generar_sku_variante(variante_id: int) -> str:
    return f"VAR-{variante_id:08d}"


def _calcular_digito_verificador_ean13(base_12: str) -> str:
    if len(base_12) != 12 or not base_12.isdigit():
        raise ValueError("La base EAN-13 debe tener 12 dígitos")

    suma = 0

    for index, char in enumerate(base_12):
        digito = int(char)
        suma += digito if index % 2 == 0 else digito * 3

    resto = suma % 10
    verificador = 0 if resto == 0 else 10 - resto

    return str(verificador)


def _generar_codigo_barras_interno(variante_id: int) -> str:
    if variante_id <= 0:
        raise ValueError("El id de variante debe ser mayor a 0")

    base = f"29{variante_id:010d}"
    return base + _calcular_digito_verificador_ean13(base)

def crear_producto(data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_categoria_activa(conn, data.id_categoria)
            _validar_marca_activa(conn, data.id_marca)

            if data.serializable and not data.stockeable:
                raise HTTPException(
                    status_code=400,
                    detail="Un producto serializable debe ser stockeable",
                )

            try:
                return crear_producto_catalogo(
                    conn,
                    {
                        "id_categoria": data.id_categoria,
                        "id_marca": data.id_marca,
                        "nombre": data.nombre.strip(),
                        "tipo_item": data.tipo_item,
                        "stockeable": data.stockeable,
                        "serializable": data.serializable,
                    },
                )
            except UniqueViolation:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe un producto con esos datos",
                )

    finally:
        conn.close()


def crear_variante(data):
    conn = get_connection()

    try:
        with conn.transaction():
            producto = get_producto_by_id(conn, data.id_producto)

            if producto is None:
                raise HTTPException(status_code=400, detail="El producto no existe")

            if not producto["activo"]:
                raise HTTPException(status_code=400, detail="El producto está inactivo")

            _validar_proveedor_activo(conn, data.proveedor_preferido_id)

            if not producto["stockeable"] and data.proveedor_preferido_id is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Un servicio no debería tener proveedor preferido",
                )

            try:
                variante = crear_variante_catalogo(
                    conn,
                    {
                        "id_producto": data.id_producto,
                        "nombre_variante": data.nombre_variante.strip(),
                        "sku": None,
                        "codigo_barras": None,
                        "codigo_proveedor": data.codigo_proveedor.strip() if data.codigo_proveedor else None,
                        "proveedor_preferido_id": data.proveedor_preferido_id,
                        "alicuota_iva": data.alicuota_iva,
                        "gravado": data.gravado,
                        "precio_minorista": data.precio_minorista,
                        "precio_mayorista": data.precio_mayorista,
                        "permite_precio_libre": data.permite_precio_libre,
                    },
                )

                sku = _generar_sku_variante(variante["id"])
                codigo_barras = _generar_codigo_barras_interno(variante["id"])

                return asignar_identidad_variante(
                    conn,
                    variante["id"],
                    sku,
                    codigo_barras,
                )

            except UniqueViolation:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe una variante con esos datos, SKU o código de barras",
                )
            except (CheckViolation, ForeignKeyViolation) as exc:
                raise HTTPException(status_code=400, detail=str(exc))

    finally:
        conn.close()
    
def listar_marcas():
    conn = get_connection()

    try:
        return get_marcas(conn)
    finally:
        conn.close()


def crear_marca(data):
    conn = get_connection()

    try:
        with conn.transaction():
            try:
                return crear_marca_catalogo(
                    conn,
                    {"nombre": data.nombre.strip()},
                )
            except UniqueViolation:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe una marca con ese nombre",
                )
    finally:
        conn.close()
    
def obtener_producto(producto_id: int):
    conn = get_connection()

    try:
        producto = get_producto_by_id(conn, producto_id)

        if producto is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        return producto
    finally:
        conn.close()


def editar_producto(producto_id: int, data):
    payload = data.model_dump(exclude_unset=True)

    conn = get_connection()

    try:
        with conn.transaction():
            producto = get_producto_by_id(conn, producto_id)

            if producto is None:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            if "id_categoria" in payload:
                _validar_categoria_activa(conn, payload["id_categoria"])

            if "id_marca" in payload:
                _validar_marca_activa(conn, payload["id_marca"])

            stockeable = payload.get("stockeable", producto["stockeable"])
            serializable = payload.get("serializable", producto["serializable"])

            if serializable and not stockeable:
                raise HTTPException(
                    status_code=400,
                    detail="Un producto serializable debe ser stockeable",
                )

            if "nombre" in payload and payload["nombre"] is not None:
                payload["nombre"] = payload["nombre"].strip()

            return update_producto_catalogo(conn, producto_id, payload)

    finally:
        conn.close()


def cambiar_estado_producto(producto_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            producto = get_producto_by_id(conn, producto_id)

            if producto is None:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            return update_producto_estado(conn, producto_id, data.activo)

    finally:
        conn.close()


def obtener_variante(variante_id: int):
    conn = get_connection()

    try:
        variante = get_variante_by_id(conn, variante_id)

        if variante is None:
            raise HTTPException(status_code=404, detail="Variante no encontrada")

        return variante
    finally:
        conn.close()


def editar_variante(variante_id: int, data):
    payload = data.model_dump(exclude_unset=True)

    conn = get_connection()

    try:
        with conn.transaction():
            variante = get_variante_by_id(conn, variante_id)

            if variante is None:
                raise HTTPException(status_code=404, detail="Variante no encontrada")

            producto = get_producto_by_id(conn, variante["id_producto"])

            if producto is None:
                raise HTTPException(status_code=400, detail="Producto no encontrado")

            if not producto["stockeable"] and payload.get("proveedor_preferido_id") is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Un servicio no debería tener proveedor preferido",
                )

            if "proveedor_preferido_id" in payload:
                _validar_proveedor_activo(conn, payload["proveedor_preferido_id"])

            payload.pop("sku", None)
            payload.pop("codigo_barras", None)

            for campo in ["nombre_variante", "codigo_proveedor"]:
                if campo in payload and payload[campo] is not None:
                    payload[campo] = payload[campo].strip()
            return update_variante_catalogo(conn, variante_id, payload)

    finally:
        conn.close()


def cambiar_estado_variante(variante_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            variante = get_variante_by_id(conn, variante_id)

            if variante is None:
                raise HTTPException(status_code=404, detail="Variante no encontrada")

            return update_variante_estado(conn, variante_id, data.activo)

    finally:
        conn.close()