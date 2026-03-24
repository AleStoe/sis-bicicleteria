from tests.conftest import get_venta


def _abrir_caja(client, sucursal_id: int, usuario_id: int):
    return client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )


def _payload_pago(venta_id: int, medio_pago: str, monto: float, id_usuario: int, nota: str = ""):
    return {
        "origen_tipo": "venta",
        "origen_id": venta_id,
        "medio_pago": medio_pago,
        "monto": monto,
        "id_usuario": id_usuario,
        "nota": nota,
    }


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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total efectivo",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total transferencia",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "mercadopago",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total mercadopago",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "tarjeta",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total tarjeta",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            30000,
            seed_venta_basica["usuario_id"],
            "Sobrepago",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            1000,
            seed_venta_basica["usuario_id"],
            "Pago inválido venta anulada",
        ),
    )

    assert pago_response.status_code == 400
    assert "está anulada" in pago_response.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"


def test_rechaza_medio_pago_invalido(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "cheque",
            1000,
            seed_venta_basica["usuario_id"],
            "Medio inválido",
        ),
    )

    # si el schema valida enum en request puede ser 422; si lo valida service puede ser 400
    assert response.status_code in (400, 422)


def test_rechaza_pago_sin_saldo_pendiente(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    primer_pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago completo",
        ),
    )
    assert primer_pago.status_code == 200

    segundo_pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            1,
            seed_venta_basica["usuario_id"],
            "Pago sobrante",
        ),
    )

    assert segundo_pago.status_code == 400
    assert "no tiene saldo pendiente" in segundo_pago.json()["detail"]


def test_permite_dos_pagos_hasta_cancelar_total(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Primer pago",
        ),
    )
    assert pago_1.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 14440.0

    pago_2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            14440,
            seed_venta_basica["usuario_id"],
            "Segundo pago",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            20000,
            seed_venta_basica["usuario_id"],
            "Primer pago grande",
        ),
    )
    assert pago_1.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 4440.0

    pago_2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            5000,
            seed_venta_basica["usuario_id"],
            "Segundo pago excedido",
        ),
    )
    assert pago_2.status_code == 400
    assert "supera el saldo pendiente" in pago_2.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 4440.0


def test_lista_pagos_de_una_venta_con_dos_medios(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Primer pago lista",
        ),
    )
    assert pago_1.status_code == 200

    pago_2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            14440,
            seed_venta_basica["usuario_id"],
            "Segundo pago lista",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_parcial = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial entrega bloqueada",
        ),
    )
    assert pago_parcial.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    assert entrega.status_code == 400
    assert "saldo pendiente" in entrega.json()["detail"]


def test_flujo_completo_venta_pago_y_entrega(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Flujo completo",
        ),
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

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total inicial",
        ),
    )

    assert pago.status_code == 200

    segundo_pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            100,
            seed_venta_basica["usuario_id"],
            "Pago sobrante final",
        ),
    )

    assert segundo_pago.status_code == 400