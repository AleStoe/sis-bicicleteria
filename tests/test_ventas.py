from decimal import Decimal
from tests.conftest import get_auditoria_by_entidad
from tests.conftest import (
    get_caja_movimientos,
    get_creditos_by_cliente,
    get_credito_movimientos,
    get_movimientos_by_venta,
    get_stock_row,
    get_venta,
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


def _pagar_venta_basica_total(client, venta_id: int, seed_venta_basica):
    return client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": seed_venta_basica["precio_venta"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago total test venta básica",
        },
    )


def _crear_venta_mixta(client, seed_venta_mixta):
    payload = {
        "id_cliente": seed_venta_mixta["cliente_id"],
        "id_sucursal": seed_venta_mixta["sucursal_id"],
        "id_usuario": seed_venta_mixta["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_mixta["variante_stockeable_id"],
                "cantidad": 1,
            },
            {
                "id_variante": seed_venta_mixta["variante_servicio_id"],
                "cantidad": 1,
            },
        ],
    }
    return client.post("/ventas/", json=payload)


def _pagar_venta_mixta_total(client, venta_id: int, seed_venta_mixta):
    return client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": seed_venta_mixta["total_venta"],
            "id_usuario": seed_venta_mixta["usuario_id"],
            "nota": "Pago total test venta mixta",
        },
    )


def _crear_credito_por_anulacion(client, db_conn, seed_venta_basica, monto_pago: Decimal):
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

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": float(monto_pago),
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago para generar crédito",
        },
    )
    assert pago.status_code == 200

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "generar crédito para nueva venta",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200
    assert anular.json()["credito_generado"] is True
    assert _to_decimal(anular.json()["monto_credito"]) == monto_pago

    return {
        "venta_id": venta_id,
        "caja_id": caja_id,
    }


def test_crear_venta_sube_pendiente_y_no_baja_fisico(client, db_conn, seed_venta_basica):
    response = _crear_venta_basica(client, seed_venta_basica)
    assert response.status_code == 200

    data = response.json()
    assert data["ok"] is True
    assert data["estado"] == "creada"

    venta_id = data["venta_id"]
    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 6.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "venta"


def test_entregar_venta_pagada_baja_fisico_y_baja_pendiente(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    abrir_caja_response = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja_response.status_code == 200

    pago_response = _pagar_venta_basica_total(client, venta_id, seed_venta_basica)
    assert pago_response.status_code == 200

    entregar_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entregar_response.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert float(venta["saldo_pendiente"]) == 0.0

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 5.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta", "entrega"]


def test_anular_venta_creada_libera_pendiente_y_no_toca_fisico(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    anular_response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "prueba de anulacion",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular_response.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"
    assert float(venta["saldo_pendiente"]) == 0.0

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 6.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta", "cancelacion_venta"]


def test_rechaza_sobreventa_y_no_toca_stock(client, db_conn, seed_venta_basica):
    stock_antes = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 7,
            }
        ],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 400
    assert "No hay stock disponible suficiente" in response.json()["detail"]

    stock_despues = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    assert float(stock_antes["stock_fisico"]) == float(stock_despues["stock_fisico"])
    assert float(stock_antes["stock_vendido_pendiente_entrega"]) == float(
        stock_despues["stock_vendido_pendiente_entrega"]
    )


def test_no_permite_entregar_dos_veces(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    abrir_caja_response = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja_response.status_code == 200

    pago_response = _pagar_venta_basica_total(client, venta_id, seed_venta_basica)
    assert pago_response.status_code == 200

    primera_entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert primera_entrega.status_code == 200

    segunda_entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert segunda_entrega.status_code == 400
    assert "ya fue entregada" in segunda_entrega.json()["detail"]


def test_no_permite_anular_venta_entregada(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    abrir_caja_response = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja_response.status_code == 200

    pago_response = _pagar_venta_basica_total(client, venta_id, seed_venta_basica)
    assert pago_response.status_code == 200

    entregar_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entregar_response.status_code == 200

    anular_response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "prueba de anulacion invalida",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular_response.status_code == 400
    assert "no se puede anular" in anular_response.json()["detail"]


def test_rechaza_venta_sin_items(client, seed_venta_basica):
    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "La venta debe tener al menos un item"


def test_rechaza_cantidad_cero(client, seed_venta_basica):
    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 0,
            }
        ],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "La cantidad debe ser mayor a 0"


def test_venta_mixta_solo_mueve_stock_del_item_stockeable(client, db_conn, seed_venta_mixta):
    response = _crear_venta_mixta(client, seed_venta_mixta)
    assert response.status_code == 200
    venta_id = response.json()["venta_id"]

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "venta"
    assert movimientos[0]["id_variante"] == seed_venta_mixta["variante_stockeable_id"]

    stock = get_stock_row(
        db_conn,
        seed_venta_mixta["sucursal_id"],
        seed_venta_mixta["variante_stockeable_id"],
    )
    assert float(stock["stock_fisico"]) == 6.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"
    assert float(venta["saldo_pendiente"]) == 40000.0


def test_anular_venta_mixta_solo_libera_stockeable_y_deja_saldo_en_cero(client, db_conn, seed_venta_mixta):
    response = _crear_venta_mixta(client, seed_venta_mixta)
    assert response.status_code == 200
    venta_id = response.json()["venta_id"]

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "prueba mixta",
            "id_usuario": seed_venta_mixta["usuario_id"],
        },
    )
    assert anular.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"
    assert float(venta["saldo_pendiente"]) == 0.0

    stock = get_stock_row(
        db_conn,
        seed_venta_mixta["sucursal_id"],
        seed_venta_mixta["variante_stockeable_id"],
    )
    assert float(stock["stock_fisico"]) == 6.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    variantes = [m["id_variante"] for m in movimientos]

    assert tipos == ["venta", "cancelacion_venta"]
    assert variantes == [
        seed_venta_mixta["variante_stockeable_id"],
        seed_venta_mixta["variante_stockeable_id"],
    ]


def test_entregar_venta_mixta_solo_toca_stockeable(client, db_conn, seed_venta_mixta):
    crear = _crear_venta_mixta(client, seed_venta_mixta)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir_caja_response = _abrir_caja(
        client,
        seed_venta_mixta["sucursal_id"],
        seed_venta_mixta["usuario_id"],
    )
    assert abrir_caja_response.status_code == 200

    pagar = _pagar_venta_mixta_total(client, venta_id, seed_venta_mixta)
    assert pagar.status_code == 200

    entregar = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_mixta["usuario_id"]},
    )
    assert entregar.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert float(venta["saldo_pendiente"]) == 0.0

    stock = get_stock_row(
        db_conn,
        seed_venta_mixta["sucursal_id"],
        seed_venta_mixta["variante_stockeable_id"],
    )
    assert float(stock["stock_fisico"]) == 5.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    variantes = [m["id_variante"] for m in movimientos]

    assert tipos == ["venta", "entrega"]
    assert variantes == [
        seed_venta_mixta["variante_stockeable_id"],
        seed_venta_mixta["variante_stockeable_id"],
    ]


def test_crear_venta_con_credito_total_la_deja_pagada_total_y_no_toca_caja(
    client, db_conn, seed_venta_basica
):
    credito_contexto = _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal(str(seed_venta_basica["precio_venta"])),
    )
    caja_id = credito_contexto["caja_id"]

    movimientos_caja_antes = get_caja_movimientos(db_conn, caja_id)
    cantidad_antes = len(movimientos_caja_antes)
    assert cantidad_antes >= 1

    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "usar_credito": True,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert response.status_code == 200

    data = response.json()
    assert data["estado"] == "pagada_total"
    assert _to_decimal(data["credito_aplicado"]) == _to_decimal(seed_venta_basica["precio_venta"])
    assert _to_decimal(data["saldo_pendiente"]) == Decimal("0")

    venta = get_venta(db_conn, data["venta_id"])
    assert venta["estado"] == "pagada_total"
    assert _to_decimal(venta["saldo_pendiente"]) == Decimal("0")

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1
    assert _to_decimal(creditos[0]["saldo_actual"]) == Decimal("0")
    assert creditos[0]["estado"] == "aplicado_total"

    movimientos_credito = get_credito_movimientos(db_conn, creditos[0]["id"])
    tipos = [m["tipo_movimiento"] for m in movimientos_credito]
    assert tipos == ["credito_generado", "aplicacion_a_venta"]

    auditoria = get_auditoria_by_entidad(
        db_conn,
        "credito",
        creditos[0]["id"],
    )
    acciones = [a["accion"] for a in auditoria]

    assert "credito_generado" in acciones
    assert "credito_aplicado" in acciones

    movimientos_caja_despues = get_caja_movimientos(db_conn, caja_id)
    assert len(movimientos_caja_despues) == cantidad_antes


def test_crear_venta_con_credito_parcial_la_deja_pagada_parcial(
    client, db_conn, seed_venta_basica
):
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal("10000"),
    )

    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "usar_credito": True,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert response.status_code == 200

    data = response.json()
    assert data["estado"] == "pagada_parcial"
    assert _to_decimal(data["credito_aplicado"]) == Decimal("10000")
    assert _to_decimal(data["saldo_pendiente"]) == (
        _to_decimal(seed_venta_basica["precio_venta"]) - Decimal("10000")
    )

    venta = get_venta(db_conn, data["venta_id"])
    assert venta["estado"] == "pagada_parcial"
    assert _to_decimal(venta["saldo_pendiente"]) == (
        _to_decimal(seed_venta_basica["precio_venta"]) - Decimal("10000")
    )

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1
    assert _to_decimal(creditos[0]["saldo_actual"]) == Decimal("0")
    assert creditos[0]["estado"] == "aplicado_total"

    auditoria = get_auditoria_by_entidad(
        db_conn,
        "credito",
        creditos[0]["id"],
    )
    acciones = [a["accion"] for a in auditoria]

    assert "credito_generado" in acciones
    assert "credito_aplicado" in acciones
def test_crear_venta_con_monto_manual_de_credito_menor_al_disponible(
    client, db_conn, seed_venta_basica
):
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal(str(seed_venta_basica["precio_venta"])),
    )

    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "usar_credito": True,
            "monto_credito_a_aplicar": 5000,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert response.status_code == 200

    data = response.json()
    assert data["estado"] == "pagada_parcial"
    assert _to_decimal(data["credito_aplicado"]) == Decimal("5000")
    assert _to_decimal(data["saldo_pendiente"]) == (
        _to_decimal(seed_venta_basica["precio_venta"]) - Decimal("5000")
    )

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1
    assert _to_decimal(creditos[0]["saldo_actual"]) == (
        _to_decimal(seed_venta_basica["precio_venta"]) - Decimal("5000")
    )
    assert creditos[0]["estado"] == "aplicado_parcial"

    movimientos_credito = get_credito_movimientos(db_conn, creditos[0]["id"])
    tipos = [m["tipo_movimiento"] for m in movimientos_credito]
    assert tipos == ["credito_generado", "aplicacion_a_venta"]
    assert _to_decimal(movimientos_credito[1]["monto"]) == Decimal("5000")

    auditoria = get_auditoria_by_entidad(
        db_conn,
        "credito",
        creditos[0]["id"],
    )
    acciones = [a["accion"] for a in auditoria]

    assert "credito_generado" in acciones
    assert "credito_aplicado" in acciones

def test_rechaza_usar_mas_credito_del_disponible(client, db_conn, seed_venta_basica):
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal("10000"),
    )

    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "usar_credito": True,
            "monto_credito_a_aplicar": 15000,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert response.status_code == 400
    assert "crédito suficiente" in response.json()["detail"]


def test_crear_venta_sin_usar_credito_no_lo_consume(client, db_conn, seed_venta_basica):
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal("10000"),
    )

    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "usar_credito": False,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert response.status_code == 200

    data = response.json()
    assert data["estado"] == "creada"
    assert _to_decimal(data["credito_aplicado"]) == Decimal("0")
    assert _to_decimal(data["saldo_pendiente"]) == _to_decimal(seed_venta_basica["precio_venta"])

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1
    assert _to_decimal(creditos[0]["saldo_actual"]) == Decimal("10000")
    assert creditos[0]["estado"] == "abierto"

    auditoria = get_auditoria_by_entidad(
        db_conn,
        "credito",
        creditos[0]["id"],
    )
    acciones = [a["accion"] for a in auditoria]

    assert "credito_generado" in acciones
    assert "credito_aplicado" not in acciones