from decimal import Decimal


def _dec(value):
    return Decimal(str(value))


def _crear_venta_sin_pagos(client, seed_venta_basica):
    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
            "pagos": [],
        },
    )

    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def test_simular_tramo_efectivo_v2(
    client,
    seed_venta_basica,
):
    venta_id = _crear_venta_sin_pagos(
        client,
        seed_venta_basica,
    )

    response = client.post(
        "/pagos/ventas/simular-tramo",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto_base": "10000",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["monto_base_aplicado"]) == Decimal("10000")
    assert _dec(data["descuento_aplicado"]) == Decimal("1000")
    assert _dec(data["recargo_aplicado"]) == Decimal("0")
    assert _dec(data["monto_total_cobrado"]) == Decimal("9000")


def test_simular_tramo_tarjeta_v2(
    client,
    seed_venta_basica,
):
    venta_id = _crear_venta_sin_pagos(
        client,
        seed_venta_basica,
    )

    response = client.post(
        "/pagos/ventas/simular-tramo",
        json={
            "venta_id": venta_id,
            "medio_pago": "tarjeta",
            "monto_base": "10000",
            "cuotas": 3,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["monto_base_aplicado"]) == Decimal("10000")
    assert _dec(data["descuento_aplicado"]) == Decimal("0")
    assert _dec(data["recargo_aplicado"]) == Decimal("1500")
    assert _dec(data["monto_total_cobrado"]) == Decimal("11500")

def test_simular_tramo_efectivo_para_saldar_cobrado_objetivo(
    client,
    seed_venta_basica,
):
    venta_id = _crear_venta_sin_pagos(client, seed_venta_basica)

    response = client.post(
        "/pagos/ventas/simular-tramo",
        json={
            "venta_id": venta_id,
            "medio_pago": "efectivo",
            "monto_cobrado_objetivo": "9000",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["monto_base_aplicado"]) == Decimal("10000.00")
    assert _dec(data["descuento_aplicado"]) == Decimal("1000.00")
    assert _dec(data["monto_total_cobrado"]) == Decimal("9000.00")