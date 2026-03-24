from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.modules.creditos import service as creditos_service
from tests.conftest import get_creditos_by_cliente, get_credito_movimientos, get_venta,get_caja_movimientos, get_creditos_by_cliente, get_credito_movimientos


def _to_decimal(value) -> Decimal:
    return Decimal(str(value))


def _abrir_caja(client, sucursal_id: int, usuario_id: int):
    return client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )


def _crear_venta_basica(client, seed_venta_basica):
    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }
        ],
    }
    return client.post("/ventas/", json=payload)


def _pagar_venta(client, venta_id: int, seed_venta_basica, monto):
    return client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": float(monto),
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago test crédito",
        },
    )


def test_anular_venta_sin_pagos_no_genera_credito(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "sin pagos",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200
    assert anular.json()["credito_generado"] is False
    assert _to_decimal(anular.json()["monto_credito"]) == Decimal("0")

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"
    assert _to_decimal(venta["saldo_pendiente"]) == Decimal("0")

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 0


def test_anular_venta_con_pago_parcial_genera_credito_parcial(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    monto_pagado = Decimal("10000")

    pago = _pagar_venta(client, venta_id, seed_venta_basica, monto_pagado)
    assert pago.status_code == 200

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "pago parcial",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200
    assert anular.json()["credito_generado"] is True
    assert _to_decimal(anular.json()["monto_credito"]) == monto_pagado

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"
    assert _to_decimal(venta["saldo_pendiente"]) == Decimal("0")

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1

    credito = creditos[0]
    assert _to_decimal(credito["saldo_actual"]) == monto_pagado
    assert credito["estado"] == "abierto"
    assert credito["origen_tipo"] == "venta"
    assert credito["origen_id"] == venta_id

    movimientos = get_credito_movimientos(db_conn, credito["id"])
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "credito_generado"
    assert _to_decimal(movimientos[0]["monto"]) == monto_pagado


def test_anular_venta_con_pago_total_genera_credito_total(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    monto_total = _to_decimal(seed_venta_basica["precio_venta"])

    pago = _pagar_venta(client, venta_id, seed_venta_basica, monto_total)
    assert pago.status_code == 200

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "pago total",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200
    assert anular.json()["credito_generado"] is True
    assert _to_decimal(anular.json()["monto_credito"]) == monto_total

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"
    assert _to_decimal(venta["saldo_pendiente"]) == Decimal("0")

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1

    credito = creditos[0]
    assert _to_decimal(credito["saldo_actual"]) == monto_total
    assert credito["estado"] == "abierto"
    assert credito["origen_tipo"] == "venta"
    assert credito["origen_id"] == venta_id

    movimientos = get_credito_movimientos(db_conn, credito["id"])
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "credito_generado"
    assert _to_decimal(movimientos[0]["monto"]) == monto_total


def test_no_duplica_credito_para_misma_venta(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    monto_pagado = Decimal("10000")

    pago = _pagar_venta(client, venta_id, seed_venta_basica, monto_pagado)
    assert pago.status_code == 200

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "anulación para crédito único",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200
    assert anular.json()["credito_generado"] is True
    assert _to_decimal(anular.json()["monto_credito"]) == monto_pagado

    with pytest.raises(HTTPException) as exc:
        creditos_service.crear_credito_por_anulacion_venta(
            db_conn,
            id_cliente=seed_venta_basica["cliente_id"],
            id_venta=venta_id,
            monto_credito=monto_pagado,
            id_usuario=seed_venta_basica["usuario_id"],
        )

    assert exc.value.status_code == 400
    assert "ya tiene un crédito generado" in exc.value.detail

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1

    credito = creditos[0]
    assert credito["origen_tipo"] == "venta"
    assert credito["origen_id"] == venta_id
    assert _to_decimal(credito["saldo_actual"]) == monto_pagado

    movimientos = get_credito_movimientos(db_conn, credito["id"])
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "credito_generado"
    assert _to_decimal(movimientos[0]["monto"]) == monto_pagado

def test_anular_venta_con_pago_no_toca_caja(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    monto_pagado = Decimal("10000")

    pago = _pagar_venta(client, venta_id, seed_venta_basica, monto_pagado)
    assert pago.status_code == 200

    movimientos_antes = get_caja_movimientos(db_conn, caja_id)
    cantidad_antes = len(movimientos_antes)

    # sanity check: el pago tuvo que haber generado al menos un movimiento
    assert cantidad_antes >= 1

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "anulación sin tocar caja",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200
    assert anular.json()["credito_generado"] is True
    assert Decimal(str(anular.json()["monto_credito"])) == monto_pagado

    movimientos_despues = get_caja_movimientos(db_conn, caja_id)
    cantidad_despues = len(movimientos_despues)

    # La anulación NO debe agregar movimientos de caja
    assert cantidad_despues == cantidad_antes

    ids_antes = [m["id"] for m in movimientos_antes]
    ids_despues = [m["id"] for m in movimientos_despues]
    assert ids_despues == ids_antes

    # Igual se debe haber generado el crédito
    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1

    credito = creditos[0]
    assert Decimal(str(credito["saldo_actual"])) == monto_pagado
    assert credito["origen_tipo"] == "venta"
    assert credito["origen_id"] == venta_id

    movimientos_credito = get_credito_movimientos(db_conn, credito["id"])
    assert len(movimientos_credito) == 1
    assert movimientos_credito[0]["tipo_movimiento"] == "credito_generado"
    assert Decimal(str(movimientos_credito[0]["monto"])) == monto_pagado