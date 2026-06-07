def test_stock_listado_acepta_filtros_avanzados(client, seed_venta_basica):
    response = client.get(
        "/stock/",
        params={
            "q": "",
            "tipo_operativo": "todos",
            "estado_stock": "todos",
            "stock_bajo_umbral": 2,
            "ordenar_por": "producto",
            "orden": "asc",
            "limit": 20,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)

    if data:
        item = data[0]
        assert "producto_nombre" in item
        assert "stock_disponible" in item
        assert "categoria_nombre" in item
        assert "tipo_operativo" in item
        assert "capital_inmovilizado" in item
        assert "ultima_venta" in item
        assert "dias_sin_movimiento" in item


def test_stock_resumen_acepta_filtros_avanzados(client, seed_venta_basica):
    response = client.get(
        "/stock/resumen",
        params={
            "tipo_operativo": "no_bicicletas",
            "stock_bajo_umbral": 2,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "total_items" in data
    assert "con_stock" in data
    assert "sin_stock" in data
    assert "stock_bajo" in data
    assert "capital_inmovilizado_total" in data


def test_stock_ordenamiento_backend(client, seed_venta_basica):
    for ordenar_por in ["producto", "stock", "fisico", "capital", "ultima_venta", "categoria", "marca", "proveedor"]:
        response = client.get(
            "/stock/",
            params={
                "ordenar_por": ordenar_por,
                "orden": "desc",
                "limit": 10,
            },
        )
        assert response.status_code == 200, f"{ordenar_por}: {response.text}"
        assert isinstance(response.json(), list)


def test_stock_parametros_invalidos(client, seed_venta_basica):
    response = client.get("/stock/", params={"ordenar_por": "campo_invalido"})
    assert response.status_code == 422

    response = client.get("/stock/", params={"orden": "sideways"})
    assert response.status_code == 422
