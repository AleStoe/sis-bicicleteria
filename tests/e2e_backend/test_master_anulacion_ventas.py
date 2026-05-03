from decimal import Decimal

from tests.conftest import get_venta, get_stock_row, get_creditos_by_cliente


def _dec(v):
    return Decimal(str(v))


def test_anular_venta_no_entregada_libera_pendiente_y_no_toca_fisico(
    client,
    db_conn,
    seed_venta_basica,
):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
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

    stock_post_venta = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_venta["stock_fisico"]) == Decimal("6")
    assert _dec(stock_post_venta["stock_vendido_pendiente_entrega"]) == Decimal("1")

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "Cliente cancela antes de retirar",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    venta_anulada = get_venta(db_conn, venta_id)
    assert venta_anulada["estado"] == "anulada"
    assert _dec(venta_anulada["saldo_pendiente"]) == Decimal("0")

    stock_final = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_final["stock_fisico"]) == Decimal("6")
    assert _dec(stock_final["stock_vendido_pendiente_entrega"]) == Decimal("0")


def test_anular_venta_con_pago_genera_credito_y_no_egreso_caja(
    client,
    db_conn,
    seed_venta_basica,
):
    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200, caja.text

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
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

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago.status_code == 200, pago.text

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "Cliente cancela con pago parcial",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    venta_anulada = get_venta(db_conn, venta_id)
    assert venta_anulada["estado"] == "anulada"

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1
    assert _dec(creditos[0]["saldo_actual"]) == Decimal("10000")