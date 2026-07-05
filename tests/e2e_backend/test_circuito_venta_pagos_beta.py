from decimal import Decimal

from tests.conftest import get_caja_movimientos, get_pagos_by_venta, get_venta


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _abrir_caja(client, seed):
    response = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed["sucursal_id"],
            "id_usuario": seed["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["caja_id"]


def _item_seed(seed):
    return {
        "id_variante": seed["variante_id"],
        "cantidad": 1,
    }


def _crear_venta(client, seed, pagos=None):
    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed["cliente_id"],
            "id_sucursal": seed["sucursal_id"],
            "id_usuario": seed["usuario_id"],
            "tipo_precio": "minorista",
            "items": [_item_seed(seed)],
            "pagos": pagos or [],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def test_venta_contado_efectivo_completa_con_descuento(
    client,
    db_conn,
    seed_venta_basica,
):
    caja_id = _abrir_caja(client, seed_venta_basica)
    total_base = Decimal(str(seed_venta_basica["precio_venta"]))

    venta_id = _crear_venta(
        client,
        seed_venta_basica,
        pagos=[
            {
                "medio_pago": "efectivo",
                "monto_base": str(total_base),
                "nota": "Pago efectivo completo beta",
            }
        ],
    )

    venta = get_venta(db_conn, venta_id)
    pagos = get_pagos_by_venta(db_conn, venta_id)
    movimientos = get_caja_movimientos(db_conn, caja_id)

    assert venta["estado"] == "pagada_total"
    assert _dec(venta["subtotal_base"]) == total_base
    assert _dec(venta["descuento_total"]) == Decimal("2444.00")
    assert _dec(venta["total_final"]) == Decimal("21996.00")
    assert _dec(venta["saldo_pendiente"]) == Decimal("0.00")

    assert len(pagos) == 1
    assert _dec(pagos[0]["monto_base_aplicado"]) == total_base
    assert _dec(pagos[0]["monto_descuento_aplicado"]) == Decimal("2444.00")
    assert _dec(pagos[0]["monto_total_cobrado"]) == Decimal("21996.00")

    ingresos = [m for m in movimientos if m["tipo_movimiento"] == "ingreso"]
    assert len(ingresos) == 1
    assert ingresos[0]["submedio"] == "efectivo"
    assert _dec(ingresos[0]["monto"]) == Decimal("21996.00")


def test_venta_tarjeta_completa_con_recargo(
    client,
    db_conn,
    seed_venta_basica,
):
    caja_id = _abrir_caja(client, seed_venta_basica)
    total_base = Decimal(str(seed_venta_basica["precio_venta"]))

    venta_id = _crear_venta(
        client,
        seed_venta_basica,
        pagos=[
            {
                "medio_pago": "tarjeta",
                "monto_base": str(total_base),
                "cuotas": 3,
                "entidad": None,
                "nota": "Pago tarjeta completo beta",
            }
        ],
    )

    venta = get_venta(db_conn, venta_id)
    pagos = get_pagos_by_venta(db_conn, venta_id)
    movimientos = get_caja_movimientos(db_conn, caja_id)

    assert venta["estado"] == "pagada_total"
    assert _dec(venta["subtotal_base"]) == total_base
    assert _dec(venta["recargo_total"]) == Decimal("3666.00")
    assert _dec(venta["total_final"]) == Decimal("28106.00")
    assert _dec(venta["saldo_pendiente"]) == Decimal("0.00")

    assert len(pagos) == 1
    assert _dec(pagos[0]["monto_base_aplicado"]) == total_base
    assert _dec(pagos[0]["monto_recargo_aplicado"]) == Decimal("3666.00")
    assert _dec(pagos[0]["monto_total_cobrado"]) == Decimal("28106.00")

    ingresos = [m for m in movimientos if m["tipo_movimiento"] == "ingreso"]
    assert len(ingresos) == 1
    assert ingresos[0]["submedio"] == "tarjeta"
    assert _dec(ingresos[0]["monto"]) == Decimal("28106.00")


def test_venta_mixta_efectivo_tarjeta_completa(
    client,
    db_conn,
    seed_venta_basica,
):
    caja_id = _abrir_caja(client, seed_venta_basica)
    venta_id = _crear_venta(client, seed_venta_basica)

    efectivo = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto_base": "10000.00",
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Tramo efectivo beta",
        },
    )
    assert efectivo.status_code == 200, efectivo.text

    tarjeta = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "tarjeta",
            "monto_base": "14440.00",
            "cuotas": 3,
            "entidad": None,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Tramo tarjeta beta",
        },
    )
    assert tarjeta.status_code == 200, tarjeta.text

    venta = get_venta(db_conn, venta_id)
    pagos = get_pagos_by_venta(db_conn, venta_id)
    movimientos = get_caja_movimientos(db_conn, caja_id)

    assert venta["estado"] == "pagada_total"
    assert _dec(venta["descuento_total"]) == Decimal("1000.00")
    assert _dec(venta["recargo_total"]) == Decimal("2166.00")
    assert _dec(venta["total_final"]) == Decimal("25606.00")
    assert _dec(venta["saldo_pendiente"]) == Decimal("0.00")

    assert len(pagos) == 2
    assert sorted(_dec(p["monto_base_aplicado"]) for p in pagos) == [
        Decimal("10000.00"),
        Decimal("14440.00"),
    ]

    ingresos = sorted(
        (m["submedio"], _dec(m["monto"]))
        for m in movimientos
        if m["tipo_movimiento"] == "ingreso"
    )
    assert ingresos == [
        ("efectivo", Decimal("9000.00")),
        ("tarjeta", Decimal("16606.00")),
    ]
