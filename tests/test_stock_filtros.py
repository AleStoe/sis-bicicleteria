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


def test_reponer_stock_filtra_stock_bajo_sin_alterar_stock(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
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
            VALUES (%s, 'Repuesto beta stock bajo', 'producto', TRUE, FALSE, TRUE)
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
                precio_minorista,
                precio_mayorista,
                activo
            )
            VALUES (%s, 'UNICA', 'REPONER-STOCK-TEST', 'REPONER-STOCK-TEST', 1000, 800, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 1, 0, 0)
            """,
            (seed_venta_basica["sucursal_id"], variante_id),
        )
    db_conn.commit()

    stock_bajo = client.get(
        "/stock/",
        params={
            "estado_stock": "stock_bajo",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "stock_bajo_umbral": 2,
            "q": "Repuesto beta stock bajo",
        },
    )
    assert stock_bajo.status_code == 200, stock_bajo.text
    assert [item["variante_id"] for item in stock_bajo.json()] == [variante_id]

    marcar_no_reponer = client.post(
        f"/catalogo/variantes/{variante_id}/reponer-stock",
        json={
            "reponer_stock": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert marcar_no_reponer.status_code == 200, marcar_no_reponer.text
    assert marcar_no_reponer.json()["reponer_stock"] is False

    stock_bajo = client.get(
        "/stock/",
        params={
            "estado_stock": "stock_bajo",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "stock_bajo_umbral": 2,
            "q": "Repuesto beta stock bajo",
        },
    )
    assert stock_bajo.status_code == 200, stock_bajo.text
    assert stock_bajo.json() == []

    visible = client.get(
        "/stock/",
        params={
            "estado_stock": "todos",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "q": "Repuesto beta stock bajo",
        },
    )
    assert visible.status_code == 200, visible.text
    assert visible.json()[0]["variante_id"] == variante_id
    assert visible.json()[0]["reponer_stock"] is False
    assert visible.json()[0]["stock_fisico"] == "1.000"

    marcar_masivo = client.post(
        "/catalogo/variantes/reponer-stock-masivo",
        json={
            "ids_variantes": [variante_id],
            "reponer_stock": True,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert marcar_masivo.status_code == 200, marcar_masivo.text
    assert marcar_masivo.json()["actualizadas"] == 1

    visible = client.get(
        "/stock/",
        params={
            "estado_stock": "todos",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "q": "Repuesto beta stock bajo",
        },
    )
    assert visible.status_code == 200, visible.text
    assert visible.json()[0]["reponer_stock"] is True
    assert visible.json()[0]["stock_fisico"] == "1.000"


def test_pedido_sugerido_agrupa_por_proveedor_y_excluye_no_reponer(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor pedido sugerido', TRUE)
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
            VALUES
                (%s, 'Pedido sugerido incluir', 'producto', TRUE, FALSE, TRUE),
                (%s, 'Pedido sugerido no reponer', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (seed_venta_basica["categoria_id"], seed_venta_basica["categoria_id"]),
        )
        producto_incluir_id = cur.fetchone()["id"]
        producto_no_reponer_id = cur.fetchone()["id"]

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
                reponer_stock,
                activo
            )
            VALUES
                (%s, 'UNICA', 'PEDIDO-INCLUIR', 'PEDIDO-INCLUIR', %s, 1000, 800, TRUE, TRUE),
                (%s, 'UNICA', 'PEDIDO-NO-REPONER', 'PEDIDO-NO-REPONER', %s, 1000, 800, FALSE, TRUE)
            RETURNING id
            """,
            (producto_incluir_id, proveedor_id, producto_no_reponer_id, proveedor_id),
        )
        variante_incluir_id = cur.fetchone()["id"]
        variante_no_reponer_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES
                (%s, %s, 1, 0, 0),
                (%s, %s, 1, 0, 0)
            """,
            (
                seed_venta_basica["sucursal_id"],
                variante_incluir_id,
                seed_venta_basica["sucursal_id"],
                variante_no_reponer_id,
            ),
        )
    db_conn.commit()

    response = client.get(
        "/stock/pedido-sugerido",
        params={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "stock_bajo_umbral": 2,
            "q": "Pedido sugerido",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_proveedores"] == 1
    assert data["total_items"] == 1
    assert data["proveedores"][0]["proveedor_nombre"] == "Proveedor pedido sugerido"
    items_ids = [item["variante_id"] for item in data["proveedores"][0]["items"]]
    assert items_ids == [variante_incluir_id]
    assert variante_no_reponer_id not in items_ids
    assert data["proveedores"][0]["items"][0]["cantidad_sugerida"] == "3.000"
