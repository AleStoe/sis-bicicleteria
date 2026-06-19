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
    assert data["nombre"] == "PROVEEDOR TEST"
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
    assert any(p["nombre"] == "PROVEEDOR LISTA" for p in data)


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
    assert data["nombre"] == "PROVEEDOR DETALLE"


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


def test_modifica_proveedor(client, seed_venta_basica):
    crear = client.post(
        "/proveedores/",
        json={
            "nombre": "Proveedor Editar",
            "telefono": "2911111111",
            "email": "viejo@test.com",
            "notas": "Antes",
        },
    )
    assert crear.status_code == 200, crear.text

    proveedor_id = crear.json()["id"]

    response = client.put(
        f"/proveedores/{proveedor_id}",
        json={
            "nombre": "Proveedor Editado",
            "telefono": "2912222222",
            "email": "nuevo@test.com",
            "notas": "Despues",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == proveedor_id
    assert data["nombre"] == "PROVEEDOR EDITADO"
    assert data["telefono"] == "2912222222"
    assert data["email"] == "nuevo@test.com"
    assert data["notas"] == "Despues"
    assert data["activo"] is True


def test_no_permite_renombrar_proveedor_a_nombre_duplicado(client, seed_venta_basica):
    primero = client.post("/proveedores/", json={"nombre": "Proveedor Uno"})
    assert primero.status_code == 200, primero.text

    segundo = client.post("/proveedores/", json={"nombre": "Proveedor Dos"})
    assert segundo.status_code == 200, segundo.text

    response = client.put(
        f"/proveedores/{segundo.json()['id']}",
        json={"nombre": "Proveedor Uno"},
    )

    assert response.status_code == 400
    assert "ya existe" in response.json()["detail"].lower()


def test_desactiva_y_reactiva_proveedor(client, seed_venta_basica):
    crear = client.post("/proveedores/", json={"nombre": "Proveedor Estado"})
    assert crear.status_code == 200, crear.text

    proveedor_id = crear.json()["id"]

    desactivar = client.patch(f"/proveedores/{proveedor_id}/desactivar")
    assert desactivar.status_code == 200, desactivar.text
    assert desactivar.json()["activo"] is False

    activos = client.get("/proveedores/")
    assert activos.status_code == 200, activos.text
    assert all(p["id"] != proveedor_id for p in activos.json())

    todos = client.get("/proveedores/", params={"solo_activos": False})
    assert todos.status_code == 200, todos.text
    assert any(p["id"] == proveedor_id and p["activo"] is False for p in todos.json())

    activar = client.patch(f"/proveedores/{proveedor_id}/activar")
    assert activar.status_code == 200, activar.text
    assert activar.json()["activo"] is True


def test_modificar_o_desactivar_proveedor_inexistente_devuelve_404(client, seed_venta_basica):
    editar = client.put("/proveedores/999999", json={"nombre": "Proveedor Fantasma"})
    assert editar.status_code == 404

    desactivar = client.patch("/proveedores/999999/desactivar")
    assert desactivar.status_code == 404


def test_proveedor_inexistente_devuelve_404(client, seed_venta_basica):
    response = client.get("/proveedores/999999")

    assert response.status_code == 404
    assert "no existe" in response.json()["detail"].lower()
