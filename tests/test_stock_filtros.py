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


def test_variante_sin_fila_stock_aparece_y_permite_primer_ingreso(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor primer ingreso', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO productos (
                id_categoria,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                activo
            )
            VALUES (%s, 'Eje fino sin stock inicial', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (seed_venta_basica["categoria_id"],),
        )
        producto_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO variantes (
                id_producto,
                nombre_variante,
                sku,
                codigo_proveedor,
                proveedor_preferido_id,
                precio_minorista,
                precio_mayorista,
                activo
            )
            VALUES (%s, 'ÚNICA', 'EJE-FINO-SIN-STOCK', '11572', %s, 1111, 556, TRUE)
            RETURNING id
            """,
            (producto_id, proveedor_id),
        )
        variante_id = cur.fetchone()["id"]
    db_conn.commit()

    listado_inicial = client.get(
        "/stock/",
        params={
            "q": "Eje fino sin stock inicial",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert listado_inicial.status_code == 200, listado_inicial.text
    items_iniciales = listado_inicial.json()
    assert len(items_iniciales) == 1
    assert items_iniciales[0]["variante_id"] == variante_id
    assert items_iniciales[0]["stock_fisico"] == "0"
    assert items_iniciales[0]["stock_disponible"] == "0"

    ingreso = client.post(
        "/stock/ingresos",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_variante": variante_id,
            "id_proveedor": proveedor_id,
            "cantidad_ingresada": 5,
            "costo_productos": 5000,
            "gastos_adicionales": 0,
            "origen_ingreso": "manual",
            "observacion": "Primer ingreso desde Stock",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert ingreso.status_code == 200, ingreso.text
    assert ingreso.json()["stock_anterior"] == "0.000"
    assert ingreso.json()["stock_nuevo"] == "5.000"

    listado_final = client.get(
        "/stock/",
        params={
            "q": "Eje fino sin stock inicial",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert listado_final.status_code == 200, listado_final.text
    assert listado_final.json()[0]["stock_fisico"] == "5.000"
    assert listado_final.json()[0]["stock_disponible"] == "5.000"
