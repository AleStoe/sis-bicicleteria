from decimal import Decimal

from tests.conftest import get_venta, get_caja_movimientos


def _dec(v):
    return Decimal(str(v))


def test_reversion_pago_venta_restablece_estado_y_caja(
    client,
    db_conn,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    # 1. abrir caja
    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200, caja.text
    caja_id = caja.json()["caja_id"]

    # 2. crear venta
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    # 3. pagar venta completa
    v = get_venta(db_conn, venta_id)

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": str(v["saldo_pendiente"]),
            "id_usuario": usuario_id,
        },
    )
    assert pago.status_code == 200, pago.text

    pago_id = pago.json()["pago_id"]

    venta_pagada = get_venta(db_conn, venta_id)
    assert venta_pagada["estado"] == "pagada_total"
    assert _dec(venta_pagada["saldo_pendiente"]) == Decimal("0")

    # 4. revertir pago
    revertir = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "error en cobro",
            "id_usuario": usuario_id,
        },
    )
    assert revertir.status_code == 200, revertir.text

    # 5. validar venta volvió a deuda
    venta_revertida = get_venta(db_conn, venta_id)

    assert venta_revertida["estado"] in ["creada", "pagada_parcial"]
    assert _dec(venta_revertida["saldo_pendiente"]) == Decimal("24440")

    # 6. validar caja: ingreso + egreso
    movimientos = get_caja_movimientos(db_conn, caja_id)

    ingresos = [
        m for m in movimientos
        if m["tipo_movimiento"] == "ingreso"
    ]

    egresos = [
        m for m in movimientos
        if m["tipo_movimiento"] == "egreso"
    ]

    assert len(ingresos) == 1
    assert len(egresos) == 1

    monto_ingreso = _dec(ingresos[0]["monto"])
    monto_egreso = _dec(egresos[0]["monto"])

    assert monto_ingreso == monto_egreso