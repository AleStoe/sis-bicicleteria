def test_crear_servicio_taller(client):
    response = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Service completo",
            "descripcion": "Revisión general, ajustes y lubricación",
            "precio_sugerido": 15000,
            "duracion_estimada_min": 60,
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["id"] > 0
    assert data["nombre"] == "Service completo"
    assert data["descripcion"] == "Revisión general, ajustes y lubricación"
    assert float(data["precio_sugerido"]) == 15000.0
    assert data["duracion_estimada_min"] == 60
    assert data["activo"] is True
    assert data["created_at"] is not None
    assert data["updated_at"] is not None


def test_listar_servicios_taller_solo_activos(client):
    crear_activo = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Ajuste de frenos",
            "descripcion": "Ajuste delantero y trasero",
            "precio_sugerido": 5000,
            "duracion_estimada_min": 30,
        },
    )
    assert crear_activo.status_code == 201

    crear_inactivo = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Servicio inactivo test",
            "descripcion": "Servicio para probar filtro",
            "precio_sugerido": 1000,
            "duracion_estimada_min": 15,
        },
    )
    assert crear_inactivo.status_code == 201
    servicio_inactivo_id = crear_inactivo.json()["id"]

    desactivar = client.patch(f"/servicios_taller/{servicio_inactivo_id}/desactivar")
    assert desactivar.status_code == 200
    assert desactivar.json()["activo"] is False

    response = client.get("/servicios_taller/")
    assert response.status_code == 200

    servicios = response.json()
    ids = [servicio["id"] for servicio in servicios]

    assert crear_activo.json()["id"] in ids
    assert servicio_inactivo_id not in ids


def test_listar_servicios_taller_incluyendo_inactivos(client):
    crear = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Servicio para incluir inactivos",
            "descripcion": None,
            "precio_sugerido": 7000,
            "duracion_estimada_min": None,
        },
    )
    assert crear.status_code == 201
    servicio_id = crear.json()["id"]

    desactivar = client.patch(f"/servicios_taller/{servicio_id}/desactivar")
    assert desactivar.status_code == 200

    response = client.get("/servicios_taller/", params={"incluir_inactivos": True})
    assert response.status_code == 200

    ids = [servicio["id"] for servicio in response.json()]
    assert servicio_id in ids


def test_obtener_servicio_taller_por_id(client):
    crear = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Armado de bicicleta",
            "descripcion": "Armado inicial",
            "precio_sugerido": 12000,
            "duracion_estimada_min": 45,
        },
    )
    assert crear.status_code == 201
    servicio_id = crear.json()["id"]

    response = client.get(f"/servicios_taller/{servicio_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == servicio_id
    assert data["nombre"] == "Armado de bicicleta"


def test_obtener_servicio_taller_inexistente(client):
    response = client.get("/servicios_taller/999999")
    assert response.status_code == 404


def test_editar_servicio_taller(client):
    crear = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Service básico",
            "descripcion": "Descripción inicial",
            "precio_sugerido": 8000,
            "duracion_estimada_min": 30,
        },
    )
    assert crear.status_code == 201
    servicio_id = crear.json()["id"]

    response = client.put(
        f"/servicios_taller/{servicio_id}",
        json={
            "nombre": "Service completo actualizado",
            "descripcion": "Descripción actualizada",
            "precio_sugerido": 18000,
            "duracion_estimada_min": 90,
            "activo": True,
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == servicio_id
    assert data["nombre"] == "Service completo actualizado"
    assert data["descripcion"] == "Descripción actualizada"
    assert float(data["precio_sugerido"]) == 18000.0
    assert data["duracion_estimada_min"] == 90
    assert data["activo"] is True


def test_editar_servicio_taller_inexistente(client):
    response = client.put(
        "/servicios_taller/999999",
        json={
            "nombre": "No existe",
            "descripcion": None,
            "precio_sugerido": 1000,
            "duracion_estimada_min": None,
            "activo": True,
        },
    )

    assert response.status_code == 404


def test_desactivar_y_activar_servicio_taller(client):
    crear = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Centrado de rueda",
            "descripcion": "Centrado básico",
            "precio_sugerido": 6000,
            "duracion_estimada_min": 30,
        },
    )
    assert crear.status_code == 201
    servicio_id = crear.json()["id"]

    desactivar = client.patch(f"/servicios_taller/{servicio_id}/desactivar")
    assert desactivar.status_code == 200
    assert desactivar.json()["activo"] is False

    activar = client.patch(f"/servicios_taller/{servicio_id}/activar")
    assert activar.status_code == 200
    assert activar.json()["activo"] is True


def test_desactivar_servicio_taller_inexistente(client):
    response = client.patch("/servicios_taller/999999/desactivar")
    assert response.status_code == 404


def test_no_permite_crear_servicio_sin_nombre(client):
    response = client.post(
        "/servicios_taller/",
        json={
            "nombre": "",
            "descripcion": "Sin nombre",
            "precio_sugerido": 1000,
            "duracion_estimada_min": 30,
        },
    )

    assert response.status_code == 422


def test_no_permite_precio_negativo(client):
    response = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Servicio inválido",
            "descripcion": "Precio negativo",
            "precio_sugerido": -1,
            "duracion_estimada_min": 30,
        },
    )

    assert response.status_code == 422


def test_no_permite_duracion_cero(client):
    response = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Servicio inválido",
            "descripcion": "Duración cero",
            "precio_sugerido": 1000,
            "duracion_estimada_min": 0,
        },
    )

    assert response.status_code == 422