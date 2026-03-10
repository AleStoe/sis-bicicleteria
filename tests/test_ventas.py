from tests.conftest import get_stock_row, get_venta, get_movimientos_by_venta


def test_crear_venta_sube_pendiente_y_no_baja_fisico(client, db_conn, seed_venta_basica):
    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }
        ],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["ok"] is True
    assert data["estado"] == "creada"

    venta_id = data["venta_id"]
    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 6.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "venta"


def test_entregar_venta_baja_fisico_y_baja_pendiente(client, db_conn, seed_venta_basica):
    crear_payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }
        ],
    }

    crear_response = client.post("/ventas/", json=crear_payload)
    venta_id = crear_response.json()["venta_id"]

    entregar_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entregar_response.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 5.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta", "entrega"]


def test_anular_venta_creada_libera_pendiente_y_no_toca_fisico(client, db_conn, seed_venta_basica):
    crear_payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }
        ],
    }

    crear_response = client.post("/ventas/", json=crear_payload)
    venta_id = crear_response.json()["venta_id"]

    anular_response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "prueba de anulacion",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular_response.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 6.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta", "ajuste"]


def test_rechaza_sobreventa_y_no_toca_stock(client, db_conn, seed_venta_basica):
    stock_antes = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 7,
            }
        ],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 400
    assert "Stock insuficiente" in response.json()["detail"]

    stock_despues = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    assert float(stock_antes["stock_fisico"]) == float(stock_despues["stock_fisico"])
    assert float(stock_antes["stock_vendido_pendiente_entrega"]) == float(
        stock_despues["stock_vendido_pendiente_entrega"]
    )

def test_no_permite_entregar_dos_veces(client, db_conn, seed_venta_basica):
    crear_payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }
        ],
    }

    crear_response = client.post("/ventas/", json=crear_payload)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    primera_entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert primera_entrega.status_code == 200

    segunda_entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert segunda_entrega.status_code == 400
    assert "ya fue entregada" in segunda_entrega.json()["detail"]


def test_no_permite_anular_venta_entregada(client, db_conn, seed_venta_basica):
    crear_payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }
        ],
    }

    crear_response = client.post("/ventas/", json=crear_payload)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    entregar_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entregar_response.status_code == 200

    anular_response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "prueba de anulacion invalida",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular_response.status_code == 400
    assert "no se puede anular" in anular_response.json()["detail"]


def test_rechaza_venta_sin_items(client, seed_venta_basica):
    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "La venta debe tener al menos un item"


def test_rechaza_cantidad_cero(client, seed_venta_basica):
    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 0,
            }
        ],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 422