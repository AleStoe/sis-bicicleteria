def test_reemplaza_ficha_tecnica_producto(client):
    categoria = client.get("/catalogo/categorias").json()[0]

    producto_resp = client.post(
        "/catalogo/productos",
        json={
            "id_categoria": categoria["id"],
            "id_marca": None,
            "nombre": "Bicicleta Ficha Tecnica Test",
            "tipo_item": "producto",
            "stockeable": True,
            "serializable": True,
            "rodado": "29",
            "tipo_bicicleta": "MTB",
            "material_cuadro": "Aluminio",
        },
    )

    assert producto_resp.status_code == 200, producto_resp.text
    producto = producto_resp.json()

    ficha_resp = client.put(
        f"/catalogo/productos/{producto['id']}/ficha-tecnica",
        json={
            "items": [
                {
                    "grupo": "transmisión",
                    "clave": "Cambio",
                    "valor": "Shimano Tourney",
                    "orden": 1,
                },
                {
                    "grupo": "frenos",
                    "clave": "Sistema",
                    "valor": "Disco mecánico",
                    "orden": 2,
                },
            ]
        },
    )

    assert ficha_resp.status_code == 200, ficha_resp.text
    ficha = ficha_resp.json()

    assert len(ficha) == 2
    assert ficha[0]["id_producto"] == producto["id"]
    assert ficha[0]["grupo"] == "TRANSMISIÓN"
    assert ficha[0]["clave"] == "Cambio"
    assert ficha[0]["valor"] == "Shimano Tourney"

    get_resp = client.get(
        f"/catalogo/productos/{producto['id']}/ficha-tecnica"
    )

    assert get_resp.status_code == 200, get_resp.text
    assert len(get_resp.json()) == 2

    reemplazo_resp = client.put(
        f"/catalogo/productos/{producto['id']}/ficha-tecnica",
        json={
            "items": [
                {
                    "grupo": "ruedas",
                    "clave": "Cubiertas",
                    "valor": "29x2.20",
                    "orden": 1,
                }
            ]
        },
    )

    assert reemplazo_resp.status_code == 200, reemplazo_resp.text

    get_reemplazo_resp = client.get(
        f"/catalogo/productos/{producto['id']}/ficha-tecnica"
    )

    assert get_reemplazo_resp.status_code == 200, get_reemplazo_resp.text

    ficha_reemplazada = get_reemplazo_resp.json()

    assert len(ficha_reemplazada) == 1
    assert ficha_reemplazada[0]["grupo"] == "RUEDAS"
    assert ficha_reemplazada[0]["clave"] == "Cubiertas"


def test_ficha_tecnica_producto_inexistente_devuelve_404(client):
    response = client.get("/catalogo/productos/999999/ficha-tecnica")

    assert response.status_code == 404