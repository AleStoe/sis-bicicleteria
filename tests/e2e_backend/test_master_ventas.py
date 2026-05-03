from decimal import Decimal

from tests.conftest import get_venta, get_caja_movimientos


def _dec(v):
    return Decimal(str(v))


def test_master_venta_flujo_completo(client, db_conn, seed_venta_basica):
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    # 1. Abrir caja
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

    # 2. Crear venta
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

    venta_creada = get_venta(db_conn, venta_id)
    assert venta_creada["estado"] == "creada"
    assert _dec(venta_creada["saldo_pendiente"]) == Decimal("24440")

    # 3. Pago parcial
    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": usuario_id,
        },
    )
    assert pago.status_code == 200, pago.text

    venta_parcial = get_venta(db_conn, venta_id)
    assert venta_parcial["estado"] == "pagada_parcial"
    assert _dec(venta_parcial["saldo_pendiente"]) == Decimal("14440")

    # 4. Pago total
    pago_total = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": str(venta_parcial["saldo_pendiente"]),
            "id_usuario": usuario_id,
        },
    )
    assert pago_total.status_code == 200, pago_total.text

    venta_pagada = get_venta(db_conn, venta_id)
    assert venta_pagada["estado"] == "pagada_total"
    assert _dec(venta_pagada["saldo_pendiente"]) == Decimal("0")

    # 5. Entregar
    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": usuario_id},
    )
    assert entrega.status_code == 200, entrega.text

    venta_entregada = get_venta(db_conn, venta_id)
    assert venta_entregada["estado"] == "entregada"

    # 6. Caja consistente: pago parcial + pago total
    movimientos = get_caja_movimientos(db_conn, caja_id)
    ingresos = [
        m for m in movimientos
        if m["tipo_movimiento"] == "ingreso"
        and m["submedio"] == "efectivo"
    ]

    assert len(ingresos) == 2

    montos = sorted(_dec(m["monto"]) for m in ingresos)
    assert montos == [Decimal("10000"), Decimal("14440")]