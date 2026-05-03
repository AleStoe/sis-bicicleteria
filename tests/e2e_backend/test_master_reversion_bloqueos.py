from decimal import Decimal

from tests.conftest import get_venta, get_caja_movimientos


def _dec(v):
    return Decimal(str(v))


def test_no_permite_revertir_pago_de_venta_entregada(
    client,
    db_conn,
    seed_venta_basica,
):
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

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": str(venta_creada["saldo_pendiente"]),
            "id_usuario": usuario_id,
        },
    )
    assert pago.status_code == 200, pago.text
    pago_id = pago.json()["pago_id"]

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": usuario_id},
    )
    assert entrega.status_code == 200, entrega.text

    venta_entregada = get_venta(db_conn, venta_id)
    assert venta_entregada["estado"] == "entregada"
    assert _dec(venta_entregada["saldo_pendiente"]) == Decimal("0")

    revertir = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "intento incorrecto luego de entrega",
            "id_usuario": usuario_id,
        },
    )

    assert revertir.status_code == 400

    venta_final = get_venta(db_conn, venta_id)
    assert venta_final["estado"] == "entregada"
    assert _dec(venta_final["saldo_pendiente"]) == Decimal("0")

    movimientos = get_caja_movimientos(db_conn, caja_id)
    ingresos = [m for m in movimientos if m["tipo_movimiento"] == "ingreso"]
    egresos = [m for m in movimientos if m["tipo_movimiento"] == "egreso"]

    assert len(ingresos) == 1
    assert egresos == []