from decimal import Decimal

from tests.conftest import get_venta, get_stock_row


def _dec(v):
    return Decimal(str(v))


def _get_deuda_por_venta(conn, venta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM deudas_cliente
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (venta_id,),
        )
        return cur.fetchone()


def test_entrega_luego_de_reversion_genera_deuda(
    client,
    db_conn,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_venta_basica["usuario_id"]
    variante_id = seed_venta_basica["variante_id"]

    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200, caja.text

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "items": [
                {
                    "id_variante": variante_id,
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

    venta_pagada = get_venta(db_conn, venta_id)
    assert venta_pagada["estado"] == "pagada_total"
    assert _dec(venta_pagada["saldo_pendiente"]) == Decimal("0")

    revertir = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "reversión antes de entrega",
            "id_usuario": usuario_id,
        },
    )
    assert revertir.status_code == 200, revertir.text

    venta_revertida = get_venta(db_conn, venta_id)
    assert venta_revertida["estado"] == "creada"
    assert _dec(venta_revertida["saldo_pendiente"]) == Decimal("24440")

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": usuario_id},
    )
    assert entrega.status_code == 200, entrega.text

    venta_final = get_venta(db_conn, venta_id)
    assert venta_final["estado"] == "entregada"
    assert _dec(venta_final["saldo_pendiente"]) == Decimal("24440")

    deuda = _get_deuda_por_venta(db_conn, venta_id)
    assert deuda is not None
    assert deuda["estado"] == "abierta"
    assert _dec(deuda["saldo_actual"]) == Decimal("24440")

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("5")
    assert _dec(stock["stock_vendido_pendiente_entrega"]) == Decimal("0")