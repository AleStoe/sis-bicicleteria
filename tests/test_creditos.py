from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.modules.creditos import service as creditos_service
from tests.conftest import (
    get_creditos_by_cliente,
    get_credito_movimientos,
    get_venta,
    get_caja_movimientos,
    get_auditoria_by_entidad,
    asignar_rol_usuario,
)

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

def _crear_usuario_sin_permiso(db_conn, username: str = "operador_sin_permiso_credito"):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES (%s, %s, %s, TRUE)
            RETURNING id
            """,
            ("Operador Credito", username, "hash_dummy"),
        )
        usuario_id = cur.fetchone()["id"]

    asignar_rol_usuario(db_conn, usuario_id, "operador")
    db_conn.commit()
    return usuario_id 

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

def test_reintegro_parcial_credito(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    venta_id = crear.json()["venta_id"]

    _abrir_caja(client, seed_venta_basica["sucursal_id"], seed_venta_basica["usuario_id"])

    _pagar_venta(client, venta_id, seed_venta_basica, 10000)

    client.post(f"/ventas/{venta_id}/anular", json={
        "motivo": "genera credito",
        "id_usuario": seed_venta_basica["usuario_id"],
    })

    credito = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]

    response = client.post(
        f"/creditos/{credito['id']}/reintegrar",
        json={
            "monto": 5000,
            "medio_pago": "efectivo",
            "motivo": "reintegro parcial",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200

    credito_actualizado = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]
    assert Decimal(str(credito_actualizado["saldo_actual"])) == Decimal("5000")

def test_reintegro_total_credito(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    venta_id = crear.json()["venta_id"]

    _abrir_caja(client, seed_venta_basica["sucursal_id"], seed_venta_basica["usuario_id"])

    _pagar_venta(client, venta_id, seed_venta_basica, 10000)

    client.post(f"/ventas/{venta_id}/anular", json={
        "motivo": "credito total",
        "id_usuario": seed_venta_basica["usuario_id"],
    })

    credito = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]

    response = client.post(
        f"/creditos/{credito['id']}/reintegrar",
        json={
            "monto": 10000,
            "medio_pago": "efectivo",
            "motivo": "reintegro total",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200

    credito_actualizado = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]
    assert Decimal(str(credito_actualizado["saldo_actual"])) == Decimal("0")

def test_rechaza_reintegro_mayor_al_saldo(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    venta_id = crear.json()["venta_id"]

    _abrir_caja(client, seed_venta_basica["sucursal_id"], seed_venta_basica["usuario_id"])

    _pagar_venta(client, venta_id, seed_venta_basica, 10000)

    client.post(f"/ventas/{venta_id}/anular", json={
        "motivo": "credito",
        "id_usuario": seed_venta_basica["usuario_id"],
    })

    credito = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]

    response = client.post(
        f"/creditos/{credito['id']}/reintegrar",
        json={
            "monto": 20000,
            "medio_pago": "efectivo",
            "motivo": "exceso",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400

def test_reintegro_credito_genera_egreso_caja_movimiento_y_auditoria(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(client, seed_venta_basica["sucursal_id"], seed_venta_basica["usuario_id"])
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    pago = _pagar_venta(client, venta_id, seed_venta_basica, 10000)
    assert pago.status_code == 200

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={"motivo": "genera credito para reintegro", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert anular.status_code == 200

    credito = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]

    response = client.post(
        f"/creditos/{credito['id']}/reintegrar",
        json={
            "monto": 5000,
            "medio_pago": "efectivo",
            "motivo": "reintegro auditado",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert response.status_code == 200, response.text

    movimientos_credito = get_credito_movimientos(db_conn, credito["id"])
    assert [m["tipo_movimiento"] for m in movimientos_credito] == [
        "credito_generado",
        "reintegro",
    ]
    assert _to_decimal(movimientos_credito[1]["monto"]) == Decimal("5000")

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    assert movimientos_caja[-1]["tipo_movimiento"] == "egreso"
    assert movimientos_caja[-1]["submedio"] == "efectivo"
    assert _to_decimal(movimientos_caja[-1]["monto"]) == Decimal("5000")

    auditoria = get_auditoria_by_entidad(db_conn, "credito", credito["id"])
    acciones = [a["accion"] for a in auditoria]
    assert "credito_reintegrado" in acciones


def test_rechaza_reintegro_credito_sin_caja_abierta(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(client, seed_venta_basica["sucursal_id"], seed_venta_basica["usuario_id"])
    assert abrir.status_code == 200

    pago = _pagar_venta(client, venta_id, seed_venta_basica, 10000)
    assert pago.status_code == 200

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={"motivo": "credito sin caja", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert anular.status_code == 200

    credito = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]

    cerrar = client.post(
        f"/cajas/{abrir.json()['caja_id']}/cerrar",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_cierre_real": 10000,
        },
    )
    assert cerrar.status_code == 200

    response = client.post(
        f"/creditos/{credito['id']}/reintegrar",
        json={
            "monto": 5000,
            "medio_pago": "efectivo",
            "motivo": "sin caja abierta",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "No hay caja abierta" in response.json()["detail"]


def test_rechaza_reintegro_credito_sin_permiso(client, db_conn, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(client, seed_venta_basica["sucursal_id"], seed_venta_basica["usuario_id"])
    assert abrir.status_code == 200

    pago = _pagar_venta(client, venta_id, seed_venta_basica, 10000)
    assert pago.status_code == 200

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={"motivo": "credito sin permiso", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert anular.status_code == 200

    credito = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])[0]
    usuario_sin_permiso = _crear_usuario_sin_permiso(db_conn)

    response = client.post(
        f"/creditos/{credito['id']}/reintegrar",
        json={
            "monto": 5000,
            "medio_pago": "efectivo",
            "motivo": "sin permiso",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": usuario_sin_permiso,
        },
    )

    assert response.status_code == 403