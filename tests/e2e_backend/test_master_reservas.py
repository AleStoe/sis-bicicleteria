from decimal import Decimal

from tests.conftest import get_reserva, get_venta, get_caja_movimientos


def _dec(v):
    return Decimal(str(v))


def test_master_reserva_flujo_completo(client, db_conn, seed_venta_basica):
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_venta_basica["usuario_id"]

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

    r = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "pago_inicial": {
                "registrar": True,
                "medio_pago": "efectivo",
                "monto": 5000,
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
    assert r.status_code == 200, r.text
    reserva_id = r.json()["reserva_id"]

    reserva = get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "activa"
    assert _dec(reserva["sena_total"]) == Decimal("5000")
    assert _dec(reserva["saldo_estimado"]) == Decimal("19440")

    conv = client.post(
        f"/reservas/{reserva_id}/convertir-a-venta",
        json={"id_usuario": usuario_id},
    )
    assert conv.status_code == 200, conv.text

    venta_id = conv.json()["venta_id"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert _dec(venta["saldo_pendiente"]) == Decimal("19440")

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": str(venta["saldo_pendiente"]),
            "id_usuario": usuario_id,
        },
    )
    assert pago.status_code == 200, pago.text

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": usuario_id},
    )
    assert entrega.status_code == 200, entrega.text

    movimientos = get_caja_movimientos(db_conn, caja_id)
    ingresos = [
        m for m in movimientos
        if m["tipo_movimiento"] == "ingreso"
        and m["submedio"] == "efectivo"
    ]

    montos = sorted(_dec(m["monto"]) for m in ingresos)
    assert montos == [Decimal("5000"), Decimal("19440")]