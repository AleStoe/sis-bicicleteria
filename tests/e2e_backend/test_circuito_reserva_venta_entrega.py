from decimal import Decimal

from tests.conftest import (
    get_caja_movimientos,
    get_movimientos_by_venta,
    get_reserva,
    get_stock_row,
    get_venta,
)


def _dec(value) -> Decimal:
    return Decimal(str(value))


def test_circuito_reserva_senia_conversion_venta_entrega_stock_caja(
    client,
    db_conn,
    seed_venta_basica,
):
    # 1. Abrir caja
    caja_response = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert caja_response.status_code == 200, caja_response.text
    caja_id = caja_response.json()["caja_id"]

    # 2. Crear reserva con seña
    reserva_response = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "pago_inicial": {
                "registrar": True,
                "medio_pago": "efectivo",
                "monto": 5000,
                "nota": "Seña inicial circuito e2e",
            },
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "precio_estimado": 24440,
                }
            ],
        },
    )
    assert reserva_response.status_code == 200, reserva_response.text
    reserva_id = reserva_response.json()["reserva_id"]

    reserva = get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "activa"
    assert _dec(reserva["sena_total"]) == Decimal("5000")
    print(reserva.keys())
    print(reserva)
    # 3. La reserva bloquea stock reservado, no stock físico
    stock_post_reserva = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_reserva["stock_fisico"]) == Decimal("6")
    assert _dec(stock_post_reserva["stock_reservado"]) == Decimal("1")

    # 4. La seña entra a caja
    movimientos_caja_post_reserva = get_caja_movimientos(db_conn, caja_id)
    ingresos = [
        m for m in movimientos_caja_post_reserva
        if m["tipo_movimiento"] == "ingreso"
        and m["submedio"] == "efectivo"
    ]
    assert len(ingresos) == 1
    assert _dec(ingresos[0]["monto"]) == Decimal("5000")

    # 5. Convertir reserva a venta
    conversion_response = client.post(
        f"/reservas/{reserva_id}/convertir-a-venta",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert conversion_response.status_code == 200, conversion_response.text
    venta_id = conversion_response.json()["venta_id"]

    reserva_convertida = get_reserva(db_conn, reserva_id)
    assert reserva_convertida["estado"] == "convertida_en_venta"

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] in ("creada", "pagada_parcial")
    assert _dec(venta["total_final"]) == Decimal("24440")

    # 6. Al convertir: reservado baja y pendiente entrega sube
    stock_post_conversion = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_conversion["stock_fisico"]) == Decimal("6")
    assert _dec(stock_post_conversion["stock_reservado"]) == Decimal("0")
    assert _dec(stock_post_conversion["stock_vendido_pendiente_entrega"]) == Decimal("1")

    # 7. Completar pago de venta si quedó saldo
    saldo = _dec(venta["saldo_pendiente"])

    if saldo > 0:
        pago_response = client.post(
            "/pagos/",
            json={
                "origen_tipo": "venta",
                "origen_id": venta_id,
                "medio_pago": "efectivo",
                "monto": str(saldo),
                "id_usuario": seed_venta_basica["usuario_id"],
                "nota": "Completa saldo de venta convertida desde reserva",
            },
        )
        assert pago_response.status_code == 200, pago_response.text

    venta_pagada = get_venta(db_conn, venta_id)
    assert venta_pagada["estado"] == "pagada_total"
    assert _dec(venta_pagada["saldo_pendiente"]) == Decimal("0")

    # 8. Entregar venta
    entrega_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert entrega_response.status_code == 200, entrega_response.text

    venta_entregada = get_venta(db_conn, venta_id)
    assert venta_entregada["estado"] == "entregada"

    # 9. Entrega baja físico y limpia pendiente
    stock_post_entrega = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_entrega["stock_fisico"]) == Decimal("5")
    assert _dec(stock_post_entrega["stock_reservado"]) == Decimal("0")
    assert _dec(stock_post_entrega["stock_vendido_pendiente_entrega"]) == Decimal("0")

    movimientos_stock = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos_stock]

    assert "venta" in tipos
    assert "entrega" in tipos

    # 10. Caja debe tener seña + pago restante
    movimientos_caja_final = get_caja_movimientos(db_conn, caja_id)
    ingresos_finales = [
        m for m in movimientos_caja_final
        if m["tipo_movimiento"] == "ingreso"
        and m["submedio"] == "efectivo"
    ]

    montos = sorted(_dec(m["monto"]) for m in ingresos_finales)
    assert montos == [Decimal("5000"), Decimal("19440")]