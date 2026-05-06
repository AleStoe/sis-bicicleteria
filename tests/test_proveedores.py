def test_crea_proveedor(client, seed_venta_basica):
    response = client.post(
        "/proveedores/",
        json={
            "nombre": "Proveedor Test",
            "telefono": "2910000000",
            "email": "proveedor@test.com",
            "notas": "Proveedor para test",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["nombre"] == "Proveedor Test"
    assert data["telefono"] == "2910000000"
    assert data["email"] == "proveedor@test.com"
    assert data["activo"] is True


def test_lista_proveedores(client, seed_venta_basica):
    crear = client.post(
        "/proveedores/",
        json={"nombre": "Proveedor Lista"},
    )
    assert crear.status_code == 200, crear.text

    response = client.get("/proveedores/")

    assert response.status_code == 200, response.text

    data = response.json()
    assert any(p["nombre"] == "Proveedor Lista" for p in data)


def test_obtiene_proveedor_por_id(client, seed_venta_basica):
    crear = client.post(
        "/proveedores/",
        json={"nombre": "Proveedor Detalle"},
    )
    assert crear.status_code == 200, crear.text

    proveedor_id = crear.json()["id"]

    response = client.get(f"/proveedores/{proveedor_id}")

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["id"] == proveedor_id
    assert data["nombre"] == "Proveedor Detalle"


def test_no_permite_proveedor_duplicado(client, seed_venta_basica):
    primero = client.post(
        "/proveedores/",
        json={"nombre": "Proveedor Duplicado"},
    )
    assert primero.status_code == 200, primero.text

    segundo = client.post(
        "/proveedores/",
        json={"nombre": "Proveedor Duplicado"},
    )

    assert segundo.status_code == 400
    assert "ya existe" in segundo.json()["detail"].lower()


def test_proveedor_inexistente_devuelve_404(client, seed_venta_basica):
    response = client.get("/proveedores/999999")

    assert response.status_code == 404
    assert "no existe" in response.json()["detail"].lower()