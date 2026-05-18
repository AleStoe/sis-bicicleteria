from decimal import Decimal

from tests.conftest import get_caja_movimientos, get_venta


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _abrir_caja(client, seed_venta_basica):
    response = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["caja_id"]


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


def _get_pago(db_conn, pago_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM pagos
            WHERE id = %s
            """,
            (pago_id,),
        )
        return cur.fetchone()


def _get_pago_tarjeta_detalle(db_conn, pago_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM pagos_tarjeta_detalle
            WHERE id_pago = %s
            """,
            (pago_id,),
        )
        return cur.fetchone()


def test_pago_posterior_efectivo_crea_tramo_v2_y_mueve_caja(
    client,
    db_conn,
    seed_venta_basica,
):
    caja_id = _abrir_caja(client, seed_venta_basica)
    venta_id = _crear_venta_sin_pagos(client, seed_venta_basica)

    venta_inicial = get_venta(db_conn, venta_id)

    assert _dec(venta_inicial["subtotal_base"]) == Decimal("24440.00")
    assert _dec(venta_inicial["total_final"]) == Decimal("24440.00")
    assert _dec(venta_inicial["saldo_pendiente"]) == Decimal("24440.00")

    response = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto_base": "10000.00",
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago posterior efectivo V2",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    pago_id = data["pago_id"]

    pago = _get_pago(db_conn, pago_id)

    assert pago is not None
    assert pago["medio_pago"] == "efectivo"

    assert _dec(pago["monto_base_aplicado"]) == Decimal("10000.00")
    assert _dec(pago["monto_descuento_aplicado"]) == Decimal("1000.00")
    assert _dec(pago["monto_recargo_aplicado"]) == Decimal("0.00")
    assert _dec(pago["monto_total_cobrado"]) == Decimal("9000.00")

    venta = get_venta(db_conn, venta_id)

    assert _dec(venta["saldo_pendiente"]) == Decimal("15440.00")
    assert venta["estado"] == "pagada_parcial"

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)

    ingresos_efectivo = [
        movimiento
        for movimiento in movimientos_caja
        if movimiento["tipo_movimiento"] == "ingreso"
        and movimiento["submedio"] == "efectivo"
        and movimiento["origen_tipo"] == "pago"
        and movimiento["origen_id"] == pago_id
    ]

    assert len(ingresos_efectivo) == 1
    assert _dec(ingresos_efectivo[0]["monto"]) == Decimal("9000.00")


def test_pago_posterior_tarjeta_crea_tramo_v2_detalle_tarjeta_y_mueve_caja(
    client,
    db_conn,
    seed_venta_basica,
):
    caja_id = _abrir_caja(client, seed_venta_basica)
    venta_id = _crear_venta_sin_pagos(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "tarjeta",
            "monto_base": "10000.00",
            "cuotas": 3,
            "entidad": None,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago posterior tarjeta V2",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    pago_id = data["pago_id"]

    pago = _get_pago(db_conn, pago_id)

    assert pago is not None
    assert pago["medio_pago"] == "tarjeta"

    assert _dec(pago["monto_base_aplicado"]) == Decimal("10000.00")
    assert _dec(pago["monto_descuento_aplicado"]) == Decimal("0.00")
    assert _dec(pago["monto_recargo_aplicado"]) == Decimal("1500.00")
    assert _dec(pago["monto_total_cobrado"]) == Decimal("11500.00")

    detalle = _get_pago_tarjeta_detalle(db_conn, pago_id)

    assert detalle is not None
    assert _dec(detalle["monto_base"]) == Decimal("10000.00")
    assert _dec(detalle["monto_recargo_financiero"]) == Decimal("1500.00")
    assert _dec(detalle["monto_neto_liquidado"]) == Decimal("11500.00")
    assert detalle["cuotas"] == 3
    assert _dec(detalle["porcentaje_recargo_aplicado"]) == Decimal("15.0000")

    venta = get_venta(db_conn, venta_id)

    assert _dec(venta["saldo_pendiente"]) == Decimal("12940.00")
    assert venta["estado"] == "pagada_parcial"

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)

    ingresos_tarjeta = [
        movimiento
        for movimiento in movimientos_caja
        if movimiento["tipo_movimiento"] == "ingreso"
        and movimiento["submedio"] == "tarjeta"
        and movimiento["origen_tipo"] == "pago"
        and movimiento["origen_id"] == pago_id
    ]

    assert len(ingresos_tarjeta) == 1
    assert _dec(ingresos_tarjeta[0]["monto"]) == Decimal("11500.00")


def test_pago_posterior_rechaza_si_cobrado_del_tramo_supera_saldo(
    client,
    seed_venta_basica,
):
    _abrir_caja(client, seed_venta_basica)
    venta_id = _crear_venta_sin_pagos(client, seed_venta_basica)

    response = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "tarjeta",
            "monto_base": "23000.00",
            "cuotas": 3,
            "entidad": None,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Debe fallar porque el cobrado supera saldo",
        },
    )

    assert response.status_code == 400
    assert "supera el saldo pendiente" in response.text