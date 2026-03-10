from tests.conftest import get_venta


def crear_venta_base(client, seed_venta_basica):
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
    return response.json()["venta_id"]


def test_registra_pago_total_efectivo(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["ok"] is True
    assert data["venta_id"] == venta_id
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_total_transferencia(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "transferencia",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_total_mercadopago(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "mercadopago",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_total_tarjeta(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "tarjeta",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_parcial(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_parcial"
    assert float(data["saldo_restante"]) == 14440.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 14440.0


def test_rechaza_sobrepago(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 30000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "supera el saldo pendiente" in response.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"
    assert float(venta["saldo_pendiente"]) == 24440.0


def test_rechaza_pago_de_venta_anulada(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    anular_response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "anulacion de prueba",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular_response.status_code == 200

    pago_response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 1000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert pago_response.status_code == 400
    assert "está anulada" in pago_response.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"


def test_rechaza_medio_pago_invalido(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "cheque",
            "monto": 1000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "Medio de pago inválido" in response.json()["detail"]


def test_rechaza_pago_sin_saldo_pendiente(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    primer_pago = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert primer_pago.status_code == 200

    segundo_pago = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 1,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert segundo_pago.status_code == 400
    assert "no tiene saldo pendiente" in segundo_pago.json()["detail"]