def _crear_venta_asistente(client, seed_venta_basica):
    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def test_asistente_resumen_es_solo_lectura_y_devuelve_tarjetas(client, seed_venta_basica):
    _crear_venta_asistente(client, seed_venta_basica)

    response = client.get(
        "/asistente/resumen",
        params={"id_sucursal": seed_venta_basica["sucursal_id"]},
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["solo_lectura"] is True
    assert data["cards"]
    assert any(card["titulo"] == "Ventas hoy" for card in data["cards"])
    assert "ventas" in data["fuentes"]


def test_asistente_pregunta_ventas_hoy_devuelve_links(client, seed_venta_basica):
    venta_id = _crear_venta_asistente(client, seed_venta_basica)

    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "cuanto vendimos hoy",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "ventas_hoy"
    assert data["solo_lectura"] is True
    assert any(item["to"] == f"/ventas/{venta_id}" for item in data["items"])


def test_asistente_pregunta_stock_funciona_sin_movimientos(client, seed_venta_basica):
    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "stock critico",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "stock_critico"
    assert data["solo_lectura"] is True
    assert "stock_sucursal" in data["fuentes"]


def test_asistente_resolver_hoy_prioriza_caja_cerrada(client, seed_venta_basica):
    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "que tengo que resolver hoy",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "resolver_hoy"
    assert data["solo_lectura"] is True
    assert any(item["titulo"] == "Abrir caja" for item in data["items"])
    assert any(card["titulo"] == "Caja" and card["valor"] == "Cerrada" for card in data["cards"])


def test_asistente_explica_recepcion_mercaderia(client, db_conn, seed_venta_basica):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO proveedores (nombre, activo) VALUES ('PROVEEDOR ATENEA', TRUE) RETURNING id"
        )
        proveedor_id = cur.fetchone()["id"]
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "ATENEA-01\tPRODUCTO PARA EXPLICAR\t2\t$1.500,00",
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion_id = creada.json()["id"]

    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": f"mostrame la recepcion #{recepcion_id}",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "recepcion_mercaderia"
    assert data["titulo"] == f"Recepción #{recepcion_id}"
    assert "PROVEEDOR ATENEA" in data["resumen"]
    assert any(card["titulo"] == "Documentos" for card in data["cards"])
    assert data["solo_lectura"] is True
