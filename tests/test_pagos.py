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

def test_permite_dos_pagos_hasta_cancelar_total(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    pago_1 = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_1.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 14440.0

    pago_2 = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "transferencia",
            "monto": 14440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_2.status_code == 200

    data_2 = pago_2.json()
    assert data_2["estado_venta"] == "pagada_total"
    assert float(data_2["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_rechaza_sobrepago_acumulado_en_segundo_pago(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    pago_1 = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 20000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_1.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 4440.0

    pago_2 = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "transferencia",
            "monto": 5000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_2.status_code == 400
    assert "supera el saldo pendiente" in pago_2.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 4440.0


def test_lista_pagos_de_una_venta_con_dos_medios(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    pago_1 = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_1.status_code == 200

    pago_2 = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "transferencia",
            "monto": 14440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_2.status_code == 200

    response = client.get(f"/pagos/ventas/{venta_id}/pagos")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    assert data[0]["origen_id"] == venta_id
    assert data[1]["origen_id"] == venta_id

    medios = [p["medio_pago"] for p in data]
    assert medios == ["efectivo", "transferencia"]


def test_no_permite_entregar_venta_con_saldo_pendiente(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    pago_parcial = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_parcial.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    # Este test asume que vas a bloquear entregas con saldo pendiente.
    # Si hoy todavía entrega igual, entonces el backend todavía no está cerrado para mostrador.
    assert entrega.status_code == 400
    assert "saldo pendiente" in entrega.json()["detail"]

def test_flujo_completo_venta_pago_y_entrega(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    pago = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert pago.status_code == 200
    data_pago = pago.json()

    assert data_pago["estado_venta"] == "pagada_total"
    assert float(data_pago["saldo_restante"]) == 0.0

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    assert entrega.status_code == 200

    venta = get_venta(db_conn, venta_id)

    assert venta["estado"] == "entregada"
    assert float(venta["saldo_pendiente"]) == 0.0

def test_no_permite_pago_en_venta_totalmente_pagada(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    pago = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert pago.status_code == 200

    segundo_pago = client.post(
        "/pagos/",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 100,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert segundo_pago.status_code == 400