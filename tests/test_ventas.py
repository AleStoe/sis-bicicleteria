
from decimal import Decimal
from tests.conftest import (
    get_caja_movimientos,
    get_creditos_by_cliente,
    get_credito_movimientos,
    get_movimientos_by_venta,
    get_stock_row,
    get_venta,
    asignar_rol_usuario,
    get_auditoria_by_entidad,
    get_deudas_by_cliente,
    get_deuda_movimientos,
    get_pagos_by_venta,
)
from app.shared.constants import (
    AUDITORIA_ENTIDAD_VENTA,
    AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA,
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
    caja_id = abrir_caja_response.json()["caja_id"]

    pago_response = _pagar_venta_basica_total(client, venta_id, seed_venta_basica)
    assert pago_response.status_code == 200

    entregar_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entregar_response.status_code == 200

    venta_antes = get_venta(db_conn, venta_id)
    stock_antes = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    movimientos_stock_antes = get_movimientos_by_venta(db_conn, venta_id)
    movimientos_caja_antes = get_caja_movimientos(db_conn, caja_id)
    auditoria_antes = get_auditoria_by_entidad(db_conn, "venta", venta_id)
    deudas_antes = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])

    anular_response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "prueba de anulacion invalida",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert anular_response.status_code == 400
    assert "no se puede anular" in anular_response.json()["detail"]

    venta_despues = get_venta(db_conn, venta_id)
    stock_despues = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    movimientos_stock_despues = get_movimientos_by_venta(db_conn, venta_id)
    movimientos_caja_despues = get_caja_movimientos(db_conn, caja_id)
    auditoria_despues = get_auditoria_by_entidad(db_conn, "venta", venta_id)
    deudas_despues = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])

    assert venta_despues["estado"] == venta_antes["estado"]
    assert venta_despues["saldo_pendiente"] == venta_antes["saldo_pendiente"]

    assert stock_despues["stock_fisico"] == stock_antes["stock_fisico"]
    assert (
        stock_despues["stock_vendido_pendiente_entrega"]
        == stock_antes["stock_vendido_pendiente_entrega"]
    )

    assert movimientos_stock_despues == movimientos_stock_antes
    assert movimientos_caja_despues == movimientos_caja_antes
    assert auditoria_despues == auditoria_antes
    assert deudas_despues == deudas_antes


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
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == [
        "body",
        "items",
        0,
        "cantidad",
    ]
    assert "greater than 0" in response.json()["detail"][0]["msg"]


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
    assert _to_decimal(data["credito_base_cubierta"]) == _to_decimal(
        seed_venta_basica["precio_venta"]
    )
    assert _to_decimal(data["credito_aplicado"]) == (
        _to_decimal(data["credito_base_cubierta"])
        - _to_decimal(data["credito_descuento_aplicado"])
    )
    assert _to_decimal(data["saldo_pendiente"]) == Decimal("0")

    venta = get_venta(db_conn, data["venta_id"])
    assert venta["estado"] == "pagada_total"
    assert _to_decimal(venta["saldo_pendiente"]) == Decimal("0")

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(creditos) == 1
    assert _to_decimal(creditos[0]["saldo_actual"]) == (
        _to_decimal(seed_venta_basica["precio_venta"])
        - _to_decimal(data["credito_aplicado"])
    )
    assert creditos[0]["estado"] == "aplicado_parcial"

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


def test_credito_de_efectivo_con_descuento_cubre_la_misma_base_sin_regalar_reintegro(
    client, db_conn, seed_venta_basica
):
    crear_origen = _crear_venta_basica(client, seed_venta_basica)
    assert crear_origen.status_code == 200
    venta_origen_id = crear_origen.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    base_original = _to_decimal(seed_venta_basica["precio_venta"])
    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_origen_id,
            "medio_pago": "efectivo",
            "monto_base": str(base_original),
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago.status_code == 200, pago.text
    pago_db = get_pagos_by_venta(db_conn, venta_origen_id)[0]
    cobrado_real = _to_decimal(pago_db["monto_total_cobrado"])
    descuento_original = _to_decimal(pago_db["monto_descuento_aplicado"])
    assert cobrado_real == base_original - descuento_original

    anular = client.post(
        f"/ventas/{venta_origen_id}/anular",
        json={
            "motivo": "regresión crédito contado",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text
    assert _to_decimal(anular.json()["monto_credito"]) == cobrado_real

    credito = get_creditos_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )[0]
    assert _to_decimal(credito["saldo_actual"]) == cobrado_real

    detalle = client.get(f"/creditos/{credito['id']}")
    assert detalle.status_code == 200, detalle.text
    origen = detalle.json()["origen_venta"]
    assert _to_decimal(origen["total_base_pagada"]) == base_original
    assert _to_decimal(origen["total_descuento_aplicado"]) == descuento_original
    assert _to_decimal(origen["total_cobrado_real"]) == cobrado_real

    nueva = client.post(
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
    assert nueva.status_code == 200, nueva.text
    data = nueva.json()
    assert data["estado"] == "pagada_total"
    assert _to_decimal(data["credito_aplicado"]) == cobrado_real
    assert _to_decimal(data["credito_base_cubierta"]) == base_original
    assert _to_decimal(data["credito_descuento_aplicado"]) == descuento_original
    assert _to_decimal(data["saldo_pendiente"]) == Decimal("0")

    movimientos = get_credito_movimientos(db_conn, credito["id"])
    aplicacion = movimientos[-1]
    assert _to_decimal(aplicacion["monto"]) == cobrado_real
    assert _to_decimal(aplicacion["monto_base_aplicado"]) == base_original
    assert _to_decimal(
        aplicacion["monto_descuento_aplicado"]
    ) == descuento_original


def test_anular_venta_pagada_con_credito_restaura_el_saldo_original(
    client, db_conn, seed_venta_basica
):
    monto_credito_original = _to_decimal(seed_venta_basica["precio_venta"])
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        monto_credito_original,
    )

    credito = get_creditos_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )[0]
    nueva = client.post(
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
    assert nueva.status_code == 200, nueva.text
    venta_id = nueva.json()["venta_id"]
    credito_consumido = _to_decimal(nueva.json()["credito_aplicado"])

    saldo_despues_uso = get_creditos_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )[0]["saldo_actual"]
    assert _to_decimal(saldo_despues_uso) == (
        monto_credito_original - credito_consumido
    )

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "restaurar crédito consumido",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text
    assert _to_decimal(anular.json()["credito_restaurado"]) == credito_consumido
    assert _to_decimal(anular.json()["monto_credito"]) == Decimal("0")

    credito_restaurado = get_creditos_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )[0]
    assert credito_restaurado["id"] == credito["id"]
    assert _to_decimal(credito_restaurado["saldo_actual"]) == monto_credito_original
    assert credito_restaurado["estado"] == "abierto"

    movimientos = get_credito_movimientos(db_conn, credito["id"])
    assert [m["tipo_movimiento"] for m in movimientos] == [
        "credito_generado",
        "aplicacion_a_venta",
        "ajuste",
    ]
    assert movimientos[-1]["origen_tipo"] == "credito_aplicacion_restaurada"


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
        _to_decimal(seed_venta_basica["precio_venta"])
        - _to_decimal(data["credito_base_cubierta"])
    )

    venta = get_venta(db_conn, data["venta_id"])
    assert venta["estado"] == "pagada_parcial"
    assert _to_decimal(venta["saldo_pendiente"]) == (
        _to_decimal(seed_venta_basica["precio_venta"])
        - _to_decimal(data["credito_base_cubierta"])
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
        _to_decimal(seed_venta_basica["precio_venta"])
        - _to_decimal(data["credito_base_cubierta"])
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
    assert _to_decimal(
        movimientos_credito[1]["monto_base_aplicado"]
    ) == _to_decimal(data["credito_base_cubierta"])
    assert _to_decimal(
        movimientos_credito[1]["monto_descuento_aplicado"]
    ) == _to_decimal(data["credito_descuento_aplicado"])

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

def _crear_usuario_sin_permiso(db_conn, username: str = "operador_sin_permiso"):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES (%s, %s, %s, TRUE)
            RETURNING id
            """,
            ("Operador Test", username, "hash_dummy"),
        )
        usuario_id = cur.fetchone()["id"]

    # Le damos un rol distinto de administrador para probar el 403
    asignar_rol_usuario(db_conn, usuario_id, "operador")
    db_conn.commit()
    return usuario_id



def test_entregar_venta_con_deuda_sin_permiso_devuelve_403(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200

    venta_id = crear_response.json()["venta_id"]

    usuario_sin_permiso_id = _crear_usuario_sin_permiso(
        db_conn,
        "operador_entrega_deuda",
    )

    response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={
            "id_usuario": usuario_sin_permiso_id,
        },
    )

    assert response.status_code == 403, response.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] != "entregada"

    auditorias = get_auditoria_by_entidad(db_conn, AUDITORIA_ENTIDAD_VENTA, venta_id)
    acciones = [a["accion"] for a in auditorias]
    assert AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA not in acciones


def test_entregar_venta_con_deuda_con_permiso_registra_auditoria_especial(
    client,
    db_conn,
    seed_venta_basica,
):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200

    venta_id = crear_response.json()["venta_id"]

    response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["estado"] == "entregada"

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"

    auditorias = get_auditoria_by_entidad(db_conn, AUDITORIA_ENTIDAD_VENTA, venta_id)
    assert auditorias, "No se registró auditoría"

    ultima = auditorias[-1]
    assert ultima["accion"] == AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA
    assert "saldo_pendiente=" in (ultima["detalle"] or "")


def test_anular_venta_sin_permiso_devuelve_403(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200

    venta_id = crear_response.json()["venta_id"]

    venta_antes = get_venta(db_conn, venta_id)
    stock_antes = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    movimientos_stock_antes = get_movimientos_by_venta(db_conn, venta_id)
    auditoria_antes = get_auditoria_by_entidad(db_conn, "venta", venta_id)

    usuario_sin_permiso_id = _crear_usuario_sin_permiso(db_conn, "operador_anular")

    response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "id_usuario": usuario_sin_permiso_id,
            "motivo": "Intento sin permiso",
        },
    )

    assert response.status_code == 403, response.text

    venta_despues = get_venta(db_conn, venta_id)
    stock_despues = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    movimientos_stock_despues = get_movimientos_by_venta(db_conn, venta_id)
    auditoria_despues = get_auditoria_by_entidad(db_conn, "venta", venta_id)

    assert venta_despues["estado"] == venta_antes["estado"]
    assert venta_despues["saldo_pendiente"] == venta_antes["saldo_pendiente"]

    assert stock_despues["stock_fisico"] == stock_antes["stock_fisico"]
    assert (
        stock_despues["stock_vendido_pendiente_entrega"]
        == stock_antes["stock_vendido_pendiente_entrega"]
    )

    assert movimientos_stock_despues == movimientos_stock_antes
    assert auditoria_despues == auditoria_antes


def test_entregar_venta_con_deuda_crea_movimiento_cargo(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_parcial = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago parcial para movimiento de deuda",
        },
    )
    assert pago_parcial.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(deudas) == 1
    deuda_id = deudas[0]["id"]

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "cargo"
    assert _to_decimal(movimientos[0]["monto"]) == Decimal("14440")
    assert movimientos[0]["origen_tipo"] == "venta"
    assert movimientos[0]["origen_id"] == venta_id


def test_entregar_venta_con_deuda_registra_auditoria_especial_y_deuda(client, db_conn, seed_venta_basica):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_parcial = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago parcial con auditoría",
        },
    )
    assert pago_parcial.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    auditorias_venta = get_auditoria_by_entidad(db_conn, AUDITORIA_ENTIDAD_VENTA, venta_id)

    eventos_entrega_con_deuda = [
        e for e in auditorias_venta
        if e["accion"] == AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA
    ]

    assert len(eventos_entrega_con_deuda) == 1

    evento = eventos_entrega_con_deuda[0]

    assert evento["entidad"] == AUDITORIA_ENTIDAD_VENTA
    assert evento["entidad_id"] == venta_id
    assert evento["id_usuario"] == seed_venta_basica["usuario_id"]

    detalle = evento["detalle"] or ""

    assert "saldo_pendiente=14440" in detalle

def test_obtener_venta_pagada_total_no_devuelve_deuda_abierta(
    client, db_conn, seed_venta_basica
):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_total = _pagar_venta_basica_total(client, venta_id, seed_venta_basica)
    assert pago_total.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    response = client.get(f"/ventas/{venta_id}")
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["venta"]["id"] == venta_id
    assert data["situacion_financiera"]["tiene_deuda"] is False
    assert data["situacion_financiera"]["deuda_abierta"] is None

def test_obtener_venta_pagada_total_no_devuelve_deuda_abierta(
    client, db_conn, seed_venta_basica
):
    crear_response = _crear_venta_basica(client, seed_venta_basica)
    assert crear_response.status_code == 200
    venta_id = crear_response.json()["venta_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_total = _pagar_venta_basica_total(client, venta_id, seed_venta_basica)
    assert pago_total.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    response = client.get(f"/ventas/{venta_id}")
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["venta"]["id"] == venta_id
    assert data["situacion_financiera"]["tiene_deuda"] is False
    assert data["situacion_financiera"]["deuda_abierta"] is None    

def test_venta_creada_crea_evento_auditoria(client, db_conn, seed_venta_basica):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 2,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )

    assert venta.status_code == 200
    venta_id = venta.json()["venta_id"]

    eventos = get_auditoria_by_entidad(db_conn, "venta", venta_id)

    eventos_creacion = [
        e for e in eventos
        if e["accion"] == "venta_creada"
    ]

    assert len(eventos_creacion) == 1

    evento = eventos_creacion[0]

    assert evento["entidad"] == "venta"
    assert evento["entidad_id"] == venta_id
    assert evento["id_usuario"] == seed_venta_basica["usuario_id"]

    detalle = (evento["detalle"] or "").lower()

    assert "venta" in detalle

def test_venta_entregada_crea_evento_auditoria(client, db_conn, seed_venta_basica):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 2,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200
    venta_id = venta.json()["venta_id"]

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    eventos = get_auditoria_by_entidad(db_conn, "venta", venta_id)
    acciones = [e["accion"] for e in eventos]

    assert "entrega_venta_con_deuda" in acciones

def test_venta_entregada_sin_deuda_crea_evento_correcto(client, db_conn, seed_venta_basica):
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
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200
    venta_id = venta.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": seed_venta_basica["precio_venta"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago total",
        },
    )
    assert pago.status_code == 200, pago.text

    auditoria_antes = get_auditoria_by_entidad(db_conn, "venta", venta_id)

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    auditoria_despues = get_auditoria_by_entidad(db_conn, "venta", venta_id)
    nuevos_eventos = auditoria_despues[len(auditoria_antes):]

    eventos_entrega = [
        e for e in nuevos_eventos
        if e["accion"] == "venta_entregada"
    ]

    assert len(eventos_entrega) == 1

    evento = eventos_entrega[0]

    assert evento["entidad"] == "venta"
    assert evento["entidad_id"] == venta_id
    assert evento["id_usuario"] == seed_venta_basica["usuario_id"]

    detalle = (evento["detalle"] or "").lower()

    assert "entreg" in detalle

def test_anulacion_venta_crea_evento_auditoria(client, db_conn, seed_venta_basica):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 2,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200

    venta_id = venta.json()["venta_id"]

    auditoria_antes = get_auditoria_by_entidad(
        db_conn,
        "venta",
        venta_id,
    )

    anulacion = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "Auditoría anulación venta",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert anulacion.status_code == 200, anulacion.text

    auditoria_despues = get_auditoria_by_entidad(
        db_conn,
        "venta",
        venta_id,
    )

    nuevos_eventos = auditoria_despues[len(auditoria_antes):]

    eventos_anulacion = [
        e for e in nuevos_eventos
        if e["accion"] == "anular_venta"
    ]

    assert len(eventos_anulacion) == 1

    evento = eventos_anulacion[0]

    assert evento["entidad"] == "venta"
    assert evento["entidad_id"] == venta_id
    assert evento["id_usuario"] == seed_venta_basica["usuario_id"]

    detalle = (evento["detalle"] or "").lower()

    assert "anulación" in detalle or "anulacion" in detalle

def test_devolver_item_parcial_genera_credito_y_repone_stock(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 2,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": seed_venta_basica["precio_venta"] * 2,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago total para devolución parcial",
        },
    )
    assert pago.status_code == 200, pago.text

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    items = db_conn.execute(
        """
        SELECT id, cantidad, subtotal
        FROM venta_items
        WHERE id_venta = %s
        """,
        (venta_id,),
    ).fetchall()

    assert len(items) == 1
    venta_item_id = items[0]["id"]

    devolucion = client.post(
        f"/ventas/{venta_id}/devolver-items",
        json={
            "motivo": "devolución parcial test",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_venta_item": venta_item_id,
                    "cantidad": "1",
                }
            ],
        },
    )
    assert devolucion.status_code == 200, devolucion.text

    data = devolucion.json()
    assert data["ok"] is True
    assert data["venta_id"] == venta_id
    assert _to_decimal(data["credito_generado"]) == _to_decimal(seed_venta_basica["precio_venta"])

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "devuelta_parcial"

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    # Stock inicial 6.
    # Venta de 2: pendiente +2.
    # Entrega: físico baja a 4.
    # Devolución de 1: físico sube a 5.
    assert _to_decimal(stock["stock_fisico"]) == Decimal("5.000")
    assert _to_decimal(stock["stock_vendido_pendiente_entrega"]) == Decimal("0.000")

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta", "entrega", "devolucion_venta"]

    creditos = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    credito = creditos[0]
    assert _to_decimal(credito["saldo_actual"]) == _to_decimal(seed_venta_basica["precio_venta"])
    assert "devolución" in (credito["observacion"] or "").lower()

    devoluciones = db_conn.execute(
        """
        SELECT *
        FROM venta_item_devoluciones
        WHERE id_venta = %s
        """,
        (venta_id,),
    ).fetchall()

    assert len(devoluciones) == 1
    assert _to_decimal(devoluciones[0]["cantidad_devuelta"]) == Decimal("1.000")
    assert _to_decimal(devoluciones[0]["monto_credito_generado"]) == _to_decimal(
        seed_venta_basica["precio_venta"]
    )

    segunda = client.post(
        f"/ventas/{venta_id}/devolver-items",
        json={
            "motivo": "segunda devolución parcial test",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_venta_item": venta_item_id,
                    "cantidad": "1",
                }
            ],
        },
    )
    assert segunda.status_code == 200, segunda.text
    assert _to_decimal(segunda.json()["credito_generado"]) == _to_decimal(
        seed_venta_basica["precio_venta"]
    )

    venta_final = get_venta(db_conn, venta_id)
    assert venta_final["estado"] == "devuelta"

    creditos_finales = get_creditos_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )
    assert len(creditos_finales) == 1
    assert creditos_finales[0]["id"] == credito["id"]
    assert _to_decimal(creditos_finales[0]["saldo_actual"]) == (
        _to_decimal(seed_venta_basica["precio_venta"]) * 2
    )

    movimientos_credito = get_credito_movimientos(
        db_conn,
        credito["id"],
    )
    assert [m["tipo_movimiento"] for m in movimientos_credito] == [
        "credito_generado",
        "credito_generado",
    ]


def test_devolver_item_no_permite_devolver_mas_de_lo_vendido(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    pago = _pagar_venta_basica_total(client, venta_id, seed_venta_basica)
    assert pago.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    item = db_conn.execute(
        """
        SELECT id
        FROM venta_items
        WHERE id_venta = %s
        """,
        (venta_id,),
    ).fetchone()

    response = client.post(
        f"/ventas/{venta_id}/devolver-items",
        json={
            "motivo": "devolución inválida",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_venta_item": item["id"],
                    "cantidad": "2",
                }
            ],
        },
    )

    assert response.status_code == 400
    assert "supera lo disponible" in response.json()["detail"]


def test_devolucion_parcial_reduce_deuda_antes_de_generar_credito(
    client, db_conn, seed_venta_basica
):
    precio = _to_decimal(seed_venta_basica["precio_venta"])
    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 2,
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": "10000",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago.status_code == 200, pago.text

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    deuda = get_deudas_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )[0]
    assert _to_decimal(deuda["saldo_actual"]) == (
        precio * 2 - Decimal("10000")
    )

    item_id = db_conn.execute(
        "SELECT id FROM venta_items WHERE id_venta = %s",
        (venta_id,),
    ).fetchone()["id"]

    primera = client.post(
        f"/ventas/{venta_id}/devolver-items",
        json={
            "motivo": "devolución parcial contra deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [{"id_venta_item": item_id, "cantidad": "1"}],
        },
    )
    assert primera.status_code == 200, primera.text
    assert _to_decimal(primera.json()["credito_generado"]) == Decimal("0")

    deuda_parcial = get_deudas_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )[0]
    assert _to_decimal(deuda_parcial["saldo_actual"]) == (
        precio - Decimal("10000")
    )
    venta_parcial = get_venta(db_conn, venta_id)
    assert venta_parcial["estado"] == "devuelta_parcial"
    assert _to_decimal(venta_parcial["saldo_pendiente"]) == (
        precio - Decimal("10000")
    )
    assert get_creditos_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    ) == []

    segunda = client.post(
        f"/ventas/{venta_id}/devolver-items",
        json={
            "motivo": "devolución final contra deuda y efectivo",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [{"id_venta_item": item_id, "cantidad": "1"}],
        },
    )
    assert segunda.status_code == 200, segunda.text
    assert _to_decimal(segunda.json()["credito_generado"]) == Decimal("10000")

    deuda_final = get_deudas_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )[0]
    assert _to_decimal(deuda_final["saldo_actual"]) == Decimal("0")
    assert deuda_final["estado"] == "cerrada"
    venta_final = get_venta(db_conn, venta_id)
    assert venta_final["estado"] == "devuelta"
    assert _to_decimal(venta_final["saldo_pendiente"]) == Decimal("0")


def test_devolucion_total_mixta_separa_credito_y_reversion_externa(
    client, db_conn, seed_venta_basica
):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    efectivo = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": "10000",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert efectivo.status_code == 200, efectivo.text

    saldo = _to_decimal(get_venta(db_conn, venta_id)["saldo_pendiente"])
    mercado_pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "mercadopago",
            "monto_base": str(saldo),
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert mercado_pago.status_code == 200, mercado_pago.text

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    devolver = client.post(
        f"/ventas/{venta_id}/devolver",
        json={
            "motivo": "devolución mixta completa",
            "id_usuario": seed_venta_basica["usuario_id"],
            "modo_devolucion": "reversion_pago_externo",
        },
    )
    assert devolver.status_code == 200, devolver.text
    assert _to_decimal(devolver.json()["credito_generado"]) == Decimal("10000")

    pagos = get_pagos_by_venta(db_conn, venta_id)
    estados = {p["medio_pago"]: p["estado"] for p in pagos}
    assert estados["efectivo"] == "confirmado"
    assert estados["mercadopago"] == "devuelto_externo"

    creditos = get_creditos_by_cliente(
        db_conn,
        seed_venta_basica["cliente_id"],
    )
    assert len(creditos) == 1
    assert _to_decimal(creditos[0]["saldo_actual"]) == Decimal("10000")


def test_simular_venta_tarjeta_3_cuotas_aplica_plan_financiero(
    client,
    seed_venta_basica,
):
    response = client.post(
        "/ventas/simular",
        json={
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": "1",
                    "id_bicicleta_serializada": None,
                    "precio_unitario_manual": None,
                    "bonificado": False,
                    "motivo_precio_manual": None,
                    "motivo_bonificacion": None,
                }
            ],
            "pagos": [
                {
                    "medio_pago": "tarjeta",
                    "monto": str(seed_venta_basica["precio_venta"]),
                    "cuotas": 3,
                    "entidad": None,
                    "nota": None,
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    subtotal = _to_decimal(seed_venta_basica["precio_venta"])
    recargo_esperado = subtotal * Decimal("0.15")
    total_esperado = subtotal + recargo_esperado

    assert _to_decimal(data["subtotal_base"]) == subtotal
    assert _to_decimal(data["descuento_total"]) == Decimal("0")
    assert _to_decimal(data["recargo_total"]) == recargo_esperado
    assert _to_decimal(data["total_final"]) == total_esperado

    assert data["reglas_aplicadas"][0]["tipo"] == "recargo"
    assert data["reglas_aplicadas"][0]["medio_pago"] == "tarjeta"
    assert _to_decimal(data["reglas_aplicadas"][0]["porcentaje_aplicado"]) == Decimal("15.0000")


def test_anular_venta_con_pago_tarjeta_confirmado_requiere_reversion(
    client,
    db_conn,
    seed_venta_basica,
):
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
            "medio_pago": "tarjeta",
            "monto": seed_venta_basica["precio_venta"],
            "cuotas": 1,
            "entidad": "Test",
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago tarjeta para bloqueo anulación",
        },
    )
    assert pago.status_code == 200, pago.text

    venta_antes = get_venta(db_conn, venta_id)
    creditos_antes = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    movimientos_caja_antes = get_caja_movimientos(db_conn, caja_id)

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "intento anular con tarjeta sin revertir",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert anular.status_code == 400
    assert "Primero revertí/cancelá" in anular.json()["detail"]

    venta_despues = get_venta(db_conn, venta_id)
    creditos_despues = get_creditos_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    movimientos_caja_despues = get_caja_movimientos(db_conn, caja_id)

    assert venta_despues["estado"] == venta_antes["estado"]
    assert venta_despues["saldo_pendiente"] == venta_antes["saldo_pendiente"]
    assert creditos_despues == creditos_antes
    assert movimientos_caja_despues == movimientos_caja_antes

def test_simular_venta_cliente_sin_credito_no_aplica(client, seed_venta_basica):
    response = client.post(
        "/ventas/simular",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "tipo_precio": "minorista",
            "usar_credito": True,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _to_decimal(data["credito_disponible"]) == Decimal("0")
    assert _to_decimal(data["credito_aplicado"]) == Decimal("0")
    assert _to_decimal(data["total_a_cobrar"]) == _to_decimal(data["saldo_estimado"])
    assert _to_decimal(data["saldo_credito_restante"]) == Decimal("0")


def test_simular_venta_cliente_con_credito_menor_al_total(
    client, db_conn, seed_venta_basica
):
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal("10000"),
    )

    response = client.post(
        "/ventas/simular",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "tipo_precio": "minorista",
            "usar_credito": True,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _to_decimal(data["credito_disponible"]) == Decimal("10000")
    assert _to_decimal(data["credito_aplicado"]) == Decimal("10000")
    assert _to_decimal(data["total_a_cobrar"]) == (
        _to_decimal(data["saldo_estimado"])
        - _to_decimal(data["credito_base_cubierta"])
    )
    assert _to_decimal(data["saldo_credito_restante"]) == Decimal("0")


def test_simular_venta_cliente_con_credito_mayor_al_total(
    client, db_conn, seed_venta_basica
):
    monto_credito = _to_decimal(seed_venta_basica["precio_venta"])

    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        monto_credito,
    )

    response = client.post(
        "/ventas/simular",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "tipo_precio": "minorista",
            "usar_credito": True,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    saldo_estimado = _to_decimal(data["saldo_estimado"])

    assert _to_decimal(data["credito_disponible"]) == monto_credito
    assert _to_decimal(data["credito_base_cubierta"]) == saldo_estimado
    assert _to_decimal(data["credito_aplicado"]) == (
        saldo_estimado - _to_decimal(data["credito_descuento_aplicado"])
    )
    assert _to_decimal(data["total_a_cobrar"]) == Decimal("0")
    assert _to_decimal(data["saldo_credito_restante"]) == (
        monto_credito - _to_decimal(data["credito_aplicado"])
    )


def test_simular_venta_credito_mas_pago_mixto_aplica_sobre_saldo_estimado(
    client, db_conn, seed_venta_basica
):
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal("5000"),
    )

    response = client.post(
        "/ventas/simular",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "tipo_precio": "minorista",
            "usar_credito": True,
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
            "pagos": [
                {
                    "medio_pago": "efectivo",
                    "monto": "10000",
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _to_decimal(data["credito_disponible"]) == Decimal("5000")
    assert _to_decimal(data["credito_aplicado"]) == Decimal("5000")
    assert _to_decimal(data["total_a_cobrar"]) == (
        _to_decimal(data["saldo_estimado"])
        - _to_decimal(data["credito_base_cubierta"])
    )


def test_simular_venta_rechaza_credito_manual_mayor_al_disponible(
    client, db_conn, seed_venta_basica
):
    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        Decimal("5000"),
    )

    response = client.post(
        "/ventas/simular",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "tipo_precio": "minorista",
            "usar_credito": True,
            "monto_credito_a_aplicar": "10000",
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


def test_simular_venta_rechaza_credito_manual_mayor_al_saldo(
    client, db_conn, seed_venta_basica
):
    monto_credito = _to_decimal(seed_venta_basica["precio_venta"])

    _crear_credito_por_anulacion(
        client,
        db_conn,
        seed_venta_basica,
        monto_credito,
    )

    response = client.post(
        "/ventas/simular",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "tipo_precio": "minorista",
            "usar_credito": True,
            "monto_credito_a_aplicar": str(monto_credito),
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
            "pagos": [
                {
                    "medio_pago": "efectivo",
                    "monto": "1000",
                }
            ],
        },
    )

    assert response.status_code == 400
    assert "supera el importe contado" in response.json()["detail"]
