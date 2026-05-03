from decimal import Decimal

from tests.conftest import get_caja_movimientos, get_venta


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _crear_venta(client, seed_venta_basica):
    response = client.post(
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
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def test_no_permite_pago_de_venta_sin_caja_abierta(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_id = _crear_venta(client, seed_venta_basica)

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 1000,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago sin caja abierta",
        },
    )

    assert pago.status_code == 400

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"
    assert _dec(venta["saldo_pendiente"]) == Decimal("24440")


def test_no_permite_pago_mayor_al_saldo_de_venta(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_id = _crear_venta(client, seed_venta_basica)

    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200, caja.text
    caja_id = caja.json()["caja_id"]

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 999999,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago mayor al saldo",
        },
    )

    assert pago.status_code == 400

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"
    assert _dec(venta["saldo_pendiente"]) == Decimal("24440")

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingresos = [m for m in movimientos_caja if m["tipo_movimiento"] == "ingreso"]
    assert ingresos == []


def test_no_permite_pagar_venta_entregada_con_saldo_pendiente(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_id = _crear_venta(client, seed_venta_basica)

    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200, caja.text

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 1000,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago directo sobre venta entregada",
        },
    )

    assert pago.status_code == 400