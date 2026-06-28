from decimal import Decimal
import uuid

import pytest


@pytest.fixture(autouse=True)
def ensure_categoria_catalogo(db_conn):
    with db_conn.cursor() as cur:
        cur.execute("SELECT id FROM categorias LIMIT 1")
        if cur.fetchone() is None:
            cur.execute(
                "INSERT INTO categorias (nombre, activo) VALUES (%s, true)",
                ("Categoria Test Catalogo",),
            )
    db_conn.commit()


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _get_first_categoria(client):
    response = client.get("/catalogo/categorias")
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) > 0
    return data[0]


def _crear_marca(client, nombre: str = "Marca Test Catalogo"):
    response = client.post(
        "/catalogo/marcas",
        json={"nombre": nombre},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _crear_producto(
    client,
    categoria_id: int,
    marca_id: int | None = None,
    nombre: str = "Producto Test Catalogo",
    tipo_item: str = "producto",
    stockeable: bool = True,
    serializable: bool = False,
):
    response = client.post(
        "/catalogo/productos",
        json={
            "id_categoria": categoria_id,
            "id_marca": marca_id,
            "nombre": nombre,
            "tipo_item": tipo_item,
            "stockeable": stockeable,
            "serializable": serializable,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _crear_variante(
    client,
    producto_id: int,
    nombre_variante: str = "Variante Test",
    sku: str | None = "SKU-TEST-CATALOGO",
    codigo_barras: str | None = "7790000000011",
    codigo_proveedor: str | None = None,
    proveedor_preferido_id: int | None = None,
    precio_minorista: int | float | str = 10000,
    precio_mayorista: int | float | str = 7000,
    permite_precio_libre: bool = False,
):
    codigo_proveedor_final = (
        codigo_proveedor
        if codigo_proveedor is not None
        else f"COD-PROV-{uuid.uuid4().hex[:8].upper()}"
    )

    response = client.post(
        "/catalogo/variantes",
        json={
            "id_producto": producto_id,
            "nombre_variante": nombre_variante,
            "sku": sku,
            "codigo_barras": codigo_barras,
            "codigo_proveedor": codigo_proveedor_final,
            "proveedor_preferido_id": proveedor_preferido_id,
            "alicuota_iva": 21,
            "gravado": True,
            "precio_minorista": precio_minorista,
            "precio_mayorista": precio_mayorista,
            "permite_precio_libre": permite_precio_libre,
        },
    )

    assert response.status_code == 200, response.text
    return response.json()


def _upsert_stock_sucursal(
    db_conn,
    *,
    id_sucursal: int,
    id_variante: int,
    stock_fisico=0,
    stock_reservado=0,
    stock_vendido_pendiente_entrega=0,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id_sucursal, id_variante)
            DO UPDATE SET
                stock_fisico = EXCLUDED.stock_fisico,
                stock_reservado = EXCLUDED.stock_reservado,
                stock_vendido_pendiente_entrega = EXCLUDED.stock_vendido_pendiente_entrega
            """,
            (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega,
            ),
        )
    db_conn.commit()


def _crear_bicicleta_serializada_catalogo(
    db_conn,
    *,
    id_variante: int,
    id_sucursal: int,
    numero_cuadro: str,
    estado: str = "disponible",
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (id_variante, id_sucursal, numero_cuadro, estado),
        )
        bicicleta_id = cur.fetchone()["id"]
    db_conn.commit()
    return bicicleta_id


def test_listar_categorias(client):
    response = client.get("/catalogo/categorias")

    assert response.status_code == 200, response.text
    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0
    assert "id" in data[0]
    assert "nombre" in data[0]


def test_crear_marca(client):
    marca = _crear_marca(client, "Marca Test Crear")

    assert marca["id"] > 0
    assert marca["nombre"] == "MARCA TEST CREAR"
    assert marca["activa"] is True


def test_listar_marcas(client):
    _crear_marca(client, "Marca Test Listar")

    response = client.get("/catalogo/marcas")

    assert response.status_code == 200, response.text
    data = response.json()

    assert isinstance(data, list)
    assert any(m["nombre"] == "MARCA TEST LISTAR" for m in data)
    assert "productos_asociados" in data[0]


def test_editar_marca_normaliza_y_evita_duplicados(client):
    marca = _crear_marca(client, "Marca Editar Test")
    _crear_marca(client, "Marca Duplicada Test")

    response = client.put(
        f"/catalogo/marcas/{marca['id']}",
        json={"nombre": "  marca editada test  "},
    )

    assert response.status_code == 200, response.text
    assert response.json()["nombre"] == "MARCA EDITADA TEST"

    duplicado = client.put(
        f"/catalogo/marcas/{marca['id']}",
        json={"nombre": "marca duplicada test"},
    )

    assert duplicado.status_code == 400


def test_desactivar_y_reactivar_marca(client):
    marca = _crear_marca(client, "Marca Estado Test")

    desactivar = client.patch(
        f"/catalogo/marcas/{marca['id']}/estado",
        json={"activa": False},
    )

    assert desactivar.status_code == 200, desactivar.text
    assert desactivar.json()["activa"] is False

    activas = client.get("/catalogo/marcas")
    assert activas.status_code == 200, activas.text
    assert all(m["id"] != marca["id"] for m in activas.json())

    todas = client.get("/catalogo/marcas?solo_activas=false")
    assert todas.status_code == 200, todas.text
    assert any(m["id"] == marca["id"] and m["activa"] is False for m in todas.json())

    reactivar = client.patch(
        f"/catalogo/marcas/{marca['id']}/estado",
        json={"activa": True},
    )

    assert reactivar.status_code == 200, reactivar.text
    assert reactivar.json()["activa"] is True


def test_marca_inactiva_no_aparece_para_altas_pero_producto_existente_conserva_marca(client):
    categoria = _get_first_categoria(client)
    marca = _crear_marca(client, "Marca Producto Inactiva Test")
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        marca_id=marca["id"],
        nombre="Producto Marca Inactiva Test",
    )

    response = client.patch(
        f"/catalogo/marcas/{marca['id']}/estado",
        json={"activa": False},
    )
    assert response.status_code == 200, response.text

    marcas_activas = client.get("/catalogo/marcas").json()
    assert all(m["id"] != marca["id"] for m in marcas_activas)

    detalle = client.get(f"/catalogo/productos/{producto['id']}")
    assert detalle.status_code == 200, detalle.text
    assert detalle.json()["id_marca"] == marca["id"]


def test_crear_producto_basico(client):
    categoria = _get_first_categoria(client)
    marca = _crear_marca(client, "Marca Producto Basico")

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        marca_id=marca["id"],
        nombre="Producto Catalogo Basico",
    )

    assert producto["id"] > 0
    assert producto["id_categoria"] == categoria["id"]
    assert producto["id_marca"] == marca["id"]
    assert producto["nombre"] == "PRODUCTO CATALOGO BASICO"
    assert producto["tipo_item"] == "producto"
    assert producto["stockeable"] is True
    assert producto["serializable"] is False
    assert producto["activo"] is True


def test_rechaza_producto_serializable_no_stockeable(client):
    categoria = _get_first_categoria(client)

    response = client.post(
        "/catalogo/productos",
        json={
            "id_categoria": categoria["id"],
            "id_marca": None,
            "nombre": "Producto Invalido Serializable",
            "tipo_item": "producto",
            "stockeable": False,
            "serializable": True,
        },
    )

    assert response.status_code == 400
    assert "serializable debe ser stockeable" in response.json()["detail"]


def test_rechaza_alta_de_servicio_en_catalogo(client):
    categoria = _get_first_categoria(client)

    response = client.post(
        "/catalogo/productos",
        json={
            "id_categoria": categoria["id"],
            "id_marca": None,
            "nombre": "Service armado viejo",
            "tipo_item": "servicio",
            "stockeable": False,
            "serializable": False,
        },
    )

    assert response.status_code == 400
    assert "módulo Servicios" in response.json()["detail"]


def test_obtener_producto_detalle(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Detalle Catalogo",
    )

    response = client.get(f"/catalogo/productos/{producto['id']}")

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["id"] == producto["id"]
    assert data["nombre"] == "PRODUCTO DETALLE CATALOGO"
    assert data["id_categoria"] == categoria["id"]
    assert data["activo"] is True


def test_obtener_producto_inexistente_devuelve_404(client):
    response = client.get("/catalogo/productos/99999999")

    assert response.status_code == 404
    assert "Producto no encontrado" in response.json()["detail"]


def test_editar_producto(client):
    categoria = _get_first_categoria(client)
    marca = _crear_marca(client, "Marca Producto Editar")

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        marca_id=marca["id"],
        nombre="Producto Antes Editar",
    )

    response = client.put(
        f"/catalogo/productos/{producto['id']}",
        json={
            "nombre": "Producto Despues Editar",
            "serializable": True,
            "stockeable": True,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["id"] == producto["id"]
    assert data["nombre"] == "PRODUCTO DESPUES EDITAR"
    assert data["serializable"] is True
    assert data["stockeable"] is True


def test_rechaza_editar_producto_serializable_no_stockeable(client):
    categoria = _get_first_categoria(client)

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Editar Invalido",
        stockeable=True,
        serializable=False,
    )

    response = client.put(
        f"/catalogo/productos/{producto['id']}",
        json={
            "stockeable": False,
            "serializable": True,
        },
    )

    assert response.status_code == 400
    assert "serializable debe ser stockeable" in response.json()["detail"]


def test_cambiar_estado_producto(client):
    categoria = _get_first_categoria(client)

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Estado Catalogo",
    )

    response = client.post(
        f"/catalogo/productos/{producto['id']}/estado",
        json={
            "activo": False,
            "id_usuario": 1,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["id"] == producto["id"]
    assert data["activo"] is False


def test_crear_variante_basica(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Para Variante",
    )

    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Rodado 29 Negro",
        sku="SKU-VAR-BASICA",
        codigo_barras="7790000000022",
        codigo_proveedor="PROV-VAR-BASICA",
        precio_minorista=15000,
        precio_mayorista=10000,
    )

    assert variante["id"] > 0
    assert variante["id_producto"] == producto["id"]
    assert variante["nombre_variante"] == "RODADO 29 NEGRO"
    assert variante["sku"] == f"VAR-{variante['id']:08d}"
    assert variante["codigo_barras"].startswith("29")
    assert _ean13_valido(variante["codigo_barras"])
    assert variante["codigo_proveedor"] == "PROV-VAR-BASICA"
    assert _dec(variante["precio_minorista"]) == Decimal("15000")
    assert _dec(variante["precio_mayorista"]) == Decimal("10000")
    assert variante["activo"] is True


def test_obtener_variante_detalle(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Variante Detalle",
    )
    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Detalle Variante",
        sku="SKU-VAR-DETALLE",
        codigo_barras="7790000000033",
    )

    response = client.get(f"/catalogo/variantes/{variante['id']}")

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["id"] == variante["id"]
    assert data["id_producto"] == producto["id"]
    assert data["producto_nombre"] == "PRODUCTO VARIANTE DETALLE"
    assert data["nombre_variante"] == "DETALLE VARIANTE"
    assert data["sku"] == f"VAR-{variante['id']:08d}"
    assert _ean13_valido(data["codigo_barras"])


def test_obtener_variante_inexistente_devuelve_404(client):
    response = client.get("/catalogo/variantes/99999999")

    assert response.status_code == 404
    assert "Variante no encontrada" in response.json()["detail"]


def test_editar_variante_sin_tocar_precios(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Editar Variante",
    )

    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Variante Antes Editar",
        sku="SKU-ANTES-EDITAR",
        codigo_barras="7790000000044",
        codigo_proveedor="PROV-ANTES-EDITAR",
        precio_minorista=22000,
        precio_mayorista=16000,
    )

    response = client.put(
        f"/catalogo/variantes/{variante['id']}",
        json={
            "nombre_variante": "Variante Despues Editar",
            "sku": "SKU-DESPUES-EDITAR",
            "codigo_barras": "7790000000055",
            "codigo_proveedor": "PROV-DESPUES-EDITAR",
            "permite_precio_libre": True,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["id"] == variante["id"]
    assert data["nombre_variante"] == "VARIANTE DESPUES EDITAR"
    assert data["sku"] == f"VAR-{variante['id']:08d}"
    assert data["codigo_barras"] == variante["codigo_barras"]
    assert _ean13_valido(data["codigo_barras"])
    assert data["codigo_proveedor"] == "PROV-DESPUES-EDITAR"
    assert data["permite_precio_libre"] is True

    assert _dec(data["precio_minorista"]) == Decimal("22000")
    assert _dec(data["precio_mayorista"]) == Decimal("16000")


def test_cambiar_estado_variante(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Estado Variante",
    )
    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Variante Estado",
        sku="SKU-VAR-ESTADO",
        codigo_barras="7790000000066",
    )

    response = client.post(
        f"/catalogo/variantes/{variante['id']}/estado",
        json={
            "activo": False,
            "id_usuario": 1,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["id"] == variante["id"]
    assert data["activo"] is False


def test_catalogo_pos_busca_por_nombre_sku_codigo_barras_y_codigo_proveedor(
    client,
    seed_venta_basica,
):
    categoria = _get_first_categoria(client)

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Cubierta Test Busqueda POS",
    )

    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="29x2.10 Negra POS",
        sku="SKU-BUSQUEDA-POS",
        codigo_barras="7791234567890",
        codigo_proveedor="COD-PROV-BUSQUEDA-POS",
        precio_minorista=18000,
        precio_mayorista=12000,
    )

    id_sucursal = seed_venta_basica["sucursal_id"]

    for query in [
        "Cubierta Test Busqueda POS",
        "29x2.10 Negra POS",
        variante["sku"],
        variante["codigo_barras"],
        "COD-PROV-BUSQUEDA-POS",
    ]:
        response = client.get(
            f"/catalogo/pos?id_sucursal={id_sucursal}&query={query}&limit=50&offset=0"
        )

        assert response.status_code == 200, response.text
        data = response.json()

        ids = [item["id_variante"] for item in data["items"]]
        assert variante["id"] in ids


def test_catalogo_pos_excluye_servicios_de_variantes(client, seed_venta_mixta):
    response = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_mixta['sucursal_id']}&query=Armado&limit=50&offset=0"
    )

    assert response.status_code == 200, response.text
    data = response.json()

    ids = [item["id_variante"] for item in data["items"]]
    assert seed_venta_mixta["variante_servicio_id"] not in ids
    assert all(item["tipo_item"] == "producto" for item in data["items"])


def test_catalogo_pos_busqueda_exacta_no_devuelve_servicio_de_variante(
    client,
    seed_venta_mixta,
):
    response = client.get(
        f"/catalogo/pos/buscar-exacto?id_sucursal={seed_venta_mixta['sucursal_id']}&codigo=SERV-TEST"
    )

    assert response.status_code == 404


def test_catalogo_pos_rechaza_limit_menor_a_1(client, seed_venta_basica):
    response = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_basica['sucursal_id']}&limit=0"
    )

    assert response.status_code == 400
    assert "límite debe ser mayor a 0" in response.json()["detail"]


def test_catalogo_pos_rechaza_limit_mayor_a_100(client, seed_venta_basica):
    response = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_basica['sucursal_id']}&limit=101"
    )

    assert response.status_code == 400
    assert "límite máximo permitido es 100" in response.json()["detail"]


def test_crear_imagen_producto_y_listarla(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Imagen Catalogo",
    )

    crear = client.post(
        "/catalogo/imagenes",
        json={
            "id_producto": producto["id"],
            "id_variante": None,
            "url": "https://example.com/producto-test.jpg",
            "es_principal": True,
            "orden": 0,
        },
    )

    assert crear.status_code == 200, crear.text
    imagen = crear.json()

    assert imagen["id"] > 0
    assert imagen["id_producto"] == producto["id"]
    assert imagen["id_variante"] is None
    assert imagen["url"] == "https://example.com/producto-test.jpg"
    assert imagen["es_principal"] is True
    assert imagen["activo"] is True

    listar = client.get(f"/catalogo/productos/{producto['id']}/imagenes")

    assert listar.status_code == 200, listar.text
    data = listar.json()

    assert any(img["id"] == imagen["id"] for img in data)


def test_crear_imagen_variante_y_listarla(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Imagen Variante",
    )
    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Variante Imagen",
        sku="SKU-IMG-VAR",
        codigo_barras="7790000000077",
    )

    crear = client.post(
        "/catalogo/imagenes",
        json={
            "id_producto": None,
            "id_variante": variante["id"],
            "url": "https://example.com/variante-test.jpg",
            "es_principal": True,
            "orden": 0,
        },
    )

    assert crear.status_code == 200, crear.text
    imagen = crear.json()

    assert imagen["id_variante"] == variante["id"]
    assert imagen["url"] == "https://example.com/variante-test.jpg"

    listar = client.get(f"/catalogo/variantes/{variante['id']}/imagenes")

    assert listar.status_code == 200, listar.text
    data = listar.json()

    assert any(img["id"] == imagen["id"] for img in data)


def test_rechaza_imagen_sin_producto_ni_variante(client):
    response = client.post(
        "/catalogo/imagenes",
        json={
            "id_producto": None,
            "id_variante": None,
            "url": "https://example.com/invalida.jpg",
            "es_principal": False,
            "orden": 0,
        },
    )

    assert response.status_code == 400
    assert "debe pertenecer a un producto o a una variante" in response.json()["detail"]


def test_rechaza_imagen_con_producto_y_variante(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Imagen Invalida",
    )
    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Variante Imagen Invalida",
        sku="SKU-IMG-INVALIDA",
        codigo_barras="7790000000088",
    )

    response = client.post(
        "/catalogo/imagenes",
        json={
            "id_producto": producto["id"],
            "id_variante": variante["id"],
            "url": "https://example.com/invalida.jpg",
            "es_principal": False,
            "orden": 0,
        },
    )

    assert response.status_code == 400
    assert "no puede pertenecer a producto y variante al mismo tiempo" in response.json()["detail"]


def test_editar_imagen_catalogo(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Editar Imagen",
    )

    crear = client.post(
        "/catalogo/imagenes",
        json={
            "id_producto": producto["id"],
            "url": "https://example.com/antes.jpg",
            "es_principal": False,
            "orden": 0,
        },
    )
    assert crear.status_code == 200, crear.text
    imagen_id = crear.json()["id"]

    editar = client.put(
        f"/catalogo/imagenes/{imagen_id}",
        json={
            "url": "https://example.com/despues.jpg",
            "es_principal": True,
            "orden": 2,
        },
    )

    assert editar.status_code == 200, editar.text
    data = editar.json()

    assert data["id"] == imagen_id
    assert data["url"] == "https://example.com/despues.jpg"
    assert data["es_principal"] is True
    assert data["orden"] == 2


def test_eliminar_imagen_catalogo_la_desactiva(client):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Eliminar Imagen",
    )

    crear = client.post(
        "/catalogo/imagenes",
        json={
            "id_producto": producto["id"],
            "url": "https://example.com/eliminar.jpg",
            "es_principal": False,
            "orden": 0,
        },
    )
    assert crear.status_code == 200, crear.text
    imagen_id = crear.json()["id"]

    eliminar = client.delete(f"/catalogo/imagenes/{imagen_id}")

    assert eliminar.status_code == 200, eliminar.text
    data = eliminar.json()

    assert data["id"] == imagen_id
    assert data["activo"] is False

def test_catalogo_pos_devuelve_respuesta_paginada(client, seed_venta_basica):
    response = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_basica['sucursal_id']}&limit=10&offset=0"
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert "total" in data
    assert "limit" in data
    assert "offset" in data
    assert "items" in data

    assert data["limit"] == 10
    assert data["offset"] == 0
    assert isinstance(data["total"], int)
    assert isinstance(data["items"], list)


def test_catalogo_pos_rechaza_offset_negativo(client, seed_venta_basica):
    response = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_basica['sucursal_id']}&limit=10&offset=-1"
    )

    assert response.status_code == 400
    assert "offset no puede ser negativo" in response.json()["detail"]


def test_catalogo_pos_incluye_marca_y_permite_buscar_por_marca(
    client,
    seed_venta_basica,
):
    categoria = _get_first_categoria(client)
    marca = _crear_marca(client, "Marca POS Busqueda Test")

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        marca_id=marca["id"],
        nombre="Producto Con Marca POS",
    )

    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Variante Marca POS",
        sku="SKU-MARCA-POS",
        codigo_barras="7795555555555",
        codigo_proveedor="COD-MARCA-POS",
        precio_minorista=10000,
        precio_mayorista=7000,
    )

    response = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_basica['sucursal_id']}&query=Marca POS Busqueda Test&limit=50&offset=0"
    )

    assert response.status_code == 200, response.text
    data = response.json()

    items = data["items"]
    item = next(i for i in items if i["id_variante"] == variante["id"])

    assert item["id_marca"] == marca["id"]
    assert item["marca_nombre"] == "MARCA POS BUSQUEDA TEST"

def _ean13_valido(value: str) -> bool:
    if not value or len(value) != 13 or not value.isdigit():
        return False

    base = value[:12]
    verificador = int(value[-1])

    suma = 0
    for index, char in enumerate(base):
        digito = int(char)
        suma += digito if index % 2 == 0 else digito * 3

    resto = suma % 10
    esperado = 0 if resto == 0 else 10 - resto

    return verificador == esperado

def test_catalogo_pos_busqueda_exacta_por_codigo(
    client,
    seed_venta_basica,
):
    categoria = _get_first_categoria(client)

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Codigo Exacto POS",
    )

    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Variante Exacta POS",
        sku="SKU-EXACTO-POS",
        codigo_barras="7799999999999",
        codigo_proveedor="COD-EXACTO-POS",
        precio_minorista=15000,
        precio_mayorista=10000,
    )

    codigo_barras = variante["codigo_barras"]

    response = client.get(
        f"/catalogo/pos/buscar-exacto?id_sucursal={seed_venta_basica['sucursal_id']}&codigo={codigo_barras}"
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["id_variante"] == variante["id"]
    assert data["producto_nombre"] == "PRODUCTO CODIGO EXACTO POS"
    assert data["codigo_barras"] == codigo_barras
    assert data["serializadas_disponibles"] == 0
    assert data["disponible_para_venta"] is False
    assert data["motivo_no_disponible"] == "sin_stock"


def test_catalogo_pos_serializable_con_stock_fisico_cero_y_serie_disponible_es_vendible(
    client,
    db_conn,
    seed_venta_basica,
):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Bicicleta Serializada POS Disponible",
        serializable=True,
    )
    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Rodado Test",
        sku=f"SKU-SER-POS-{uuid.uuid4().hex[:8].upper()}",
        codigo_barras=None,
        precio_minorista=150000,
        precio_mayorista=120000,
    )

    _upsert_stock_sucursal(
        db_conn,
        id_sucursal=seed_venta_basica["sucursal_id"],
        id_variante=variante["id"],
        stock_fisico=0,
    )
    _crear_bicicleta_serializada_catalogo(
        db_conn,
        id_variante=variante["id"],
        id_sucursal=seed_venta_basica["sucursal_id"],
        numero_cuadro=f"CUADRO-POS-{uuid.uuid4().hex[:8].upper()}",
    )

    response = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_basica['sucursal_id']}&query=Bicicleta Serializada POS Disponible&limit=50&offset=0"
    )

    assert response.status_code == 200, response.text
    item = next(i for i in response.json()["items"] if i["id_variante"] == variante["id"])
    assert item["stock_fisico"] == "0.000"
    assert item["stock_disponible"] == "0.000"
    assert item["serializadas_disponibles"] == 1
    assert item["disponible_para_venta"] is True
    assert item["motivo_no_disponible"] is None


def test_catalogo_pos_y_busqueda_exacta_son_consistentes_para_serializables(
    client,
    db_conn,
    seed_venta_basica,
):
    categoria = _get_first_categoria(client)
    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Bicicleta Serializada Consistente",
        serializable=True,
    )
    codigo_barras_input = f"779{uuid.uuid4().int % 10_000_000_000:010d}"
    variante = _crear_variante(
        client,
        producto_id=producto["id"],
        nombre_variante="Unica",
        sku=f"SKU-SER-CONS-{uuid.uuid4().hex[:8].upper()}",
        codigo_barras=codigo_barras_input,
        precio_minorista=180000,
        precio_mayorista=140000,
    )
    codigo_barras = variante["codigo_barras"]

    _upsert_stock_sucursal(
        db_conn,
        id_sucursal=seed_venta_basica["sucursal_id"],
        id_variante=variante["id"],
        stock_fisico=0,
    )
    _crear_bicicleta_serializada_catalogo(
        db_conn,
        id_variante=variante["id"],
        id_sucursal=seed_venta_basica["sucursal_id"],
        numero_cuadro=f"CUADRO-CONS-{uuid.uuid4().hex[:8].upper()}",
    )

    pos = client.get(
        f"/catalogo/pos?id_sucursal={seed_venta_basica['sucursal_id']}&query={codigo_barras}&limit=50&offset=0"
    )
    exacta = client.get(
        f"/catalogo/pos/buscar-exacto?id_sucursal={seed_venta_basica['sucursal_id']}&codigo={codigo_barras}"
    )

    assert pos.status_code == 200, pos.text
    assert exacta.status_code == 200, exacta.text

    item_pos = next(i for i in pos.json()["items"] if i["id_variante"] == variante["id"])
    item_exacto = exacta.json()

    assert item_pos["disponible_para_venta"] == item_exacto["disponible_para_venta"]
    assert item_pos["motivo_no_disponible"] == item_exacto["motivo_no_disponible"]
    assert item_pos["serializadas_disponibles"] == item_exacto["serializadas_disponibles"] == 1


def test_catalogo_pos_busqueda_exacta_inexistente_devuelve_404(
    client,
    seed_venta_basica,
):
    response = client.get(
        f"/catalogo/pos/buscar-exacto?id_sucursal={seed_venta_basica['sucursal_id']}&codigo=NO-EXISTE"
    )

    assert response.status_code == 404

def test_no_permite_codigo_proveedor_duplicado_en_variante(client):
    categoria = _get_first_categoria(client)

    producto = _crear_producto(
        client,
        categoria_id=categoria["id"],
        nombre="Producto Codigo Proveedor Duplicado",
    )

    payload = {
        "id_producto": producto["id"],
        "nombre_variante": "Variante A",
        "codigo_proveedor": "COD-DUP-TEST",
        "alicuota_iva": "21.00",
        "gravado": True,
        "precio_minorista": "1000",
        "precio_mayorista": "800",
        "permite_precio_libre": False,
    }

    primera = client.post("/catalogo/variantes", json=payload)
    assert primera.status_code == 200, primera.text

    segunda = client.post(
        "/catalogo/variantes",
        json={
            **payload,
            "nombre_variante": "Variante B",
        },
    )

    assert segunda.status_code == 400
    assert "código proveedor" in segunda.json()["detail"]
