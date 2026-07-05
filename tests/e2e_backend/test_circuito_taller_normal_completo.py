from decimal import Decimal

from tests.conftest import (
    get_caja_movimientos,
    get_movimientos_by_venta,
    get_pagos_by_venta,
    get_stock_row,
    get_venta,
    get_venta_items,
)


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _get_movimientos_taller(conn, orden_id: int, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM movimientos_stock
            WHERE origen_tipo = 'orden_taller'
              AND origen_id = %s
              AND id_variante = %s
            ORDER BY id
            """,
            (orden_id, variante_id),
        )
        return cur.fetchall()


def test_circuito_taller_normal_completo_turno_ot_venta_cobro_retiro(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
):
    usuario_id = seed_taller_basico["usuario_id"]
    cliente_id = seed_taller_basico["cliente_id"]
    bicicleta_id = seed_taller_basico["bicicleta_cliente_id"]
    sucursal_id = seed_venta_basica["sucursal_id"]
    variante_id = seed_venta_basica["variante_id"]

    stock_inicial = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_inicial["stock_fisico"]) == Decimal("6")

    caja_response = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )
    assert caja_response.status_code == 200, caja_response.text
    caja_id = caja_response.json()["caja_id"]

    servicio_response = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Service completo e2e",
            "descripcion": "Servicio de taller para circuito completo",
            "precio_sugerido": 12000,
            "duracion_estimada_min": 45,
        },
    )
    assert servicio_response.status_code == 201, servicio_response.text
    servicio_id = servicio_response.json()["id"]

    turno_response = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": bicicleta_id,
            "cliente_nombre": "Cliente Taller",
            "cliente_telefono": "2912222222",
            "fecha": "2026-07-10",
            "hora_inicio": "09:00:00",
            "hora_fin": "09:30:00",
            "tipo_servicio": "Service completo",
            "descripcion": "Cambio de repuesto y service",
            "id_usuario_creador": usuario_id,
        },
    )
    assert turno_response.status_code == 200, turno_response.text
    turno_id = turno_response.json()["id"]

    convertir_response = client.post(
        f"/agenda-taller/{turno_id}/convertir-orden",
        json={"id_usuario": usuario_id},
    )
    assert convertir_response.status_code == 200, convertir_response.text
    orden_id = convertir_response.json()["orden_id"]

    detalle_turno = client.get(f"/agenda-taller/{turno_id}")
    assert detalle_turno.status_code == 200, detalle_turno.text
    assert detalle_turno.json()["estado"] == "convertido_orden"
    assert detalle_turno.json()["id_orden_taller"] == orden_id

    repuesto_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "tipo_item": "repuesto",
            "id_variante": variante_id,
            "cantidad": 1,
            "precio_unitario": 10000,
            "id_usuario": usuario_id,
        },
    )
    assert repuesto_response.status_code == 201, repuesto_response.text
    repuesto_item_id = repuesto_response.json()["id"]

    servicio_item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "tipo_item": "servicio",
            "id_servicio_taller": servicio_id,
            "cantidad": 1,
            "precio_unitario": 12000,
            "id_usuario": usuario_id,
        },
    )
    assert servicio_item_response.status_code == 201, servicio_item_response.text
    servicio_item_id = servicio_item_response.json()["id"]

    presupuestada = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={"nuevo_estado": "presupuestada", "id_usuario": usuario_id},
    )
    assert presupuestada.status_code == 200, presupuestada.text

    for item_id in [repuesto_item_id, servicio_item_id]:
        aprobar = client.post(
            f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
            json={"aprobado": True, "id_usuario": usuario_id},
        )
        assert aprobar.status_code == 200, aprobar.text

    en_reparacion = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={"nuevo_estado": "en_reparacion", "id_usuario": usuario_id},
    )
    assert en_reparacion.status_code == 200, en_reparacion.text

    ejecutar_repuesto = client.post(
        f"/ordenes_taller/{orden_id}/items/{repuesto_item_id}/ejecutar",
        params={"id_usuario": usuario_id},
    )
    assert ejecutar_repuesto.status_code == 200, ejecutar_repuesto.text

    stock_post_repuesto = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_post_repuesto["stock_fisico"]) == Decimal("5")

    ejecutar_servicio = client.post(
        f"/ordenes_taller/{orden_id}/items/{servicio_item_id}/ejecutar",
        params={"id_usuario": usuario_id},
    )
    assert ejecutar_servicio.status_code == 200, ejecutar_servicio.text

    stock_post_servicio = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_post_servicio["stock_fisico"]) == Decimal("5")

    movimientos_taller = _get_movimientos_taller(db_conn, orden_id, variante_id)
    assert len(movimientos_taller) == 1
    assert movimientos_taller[0]["tipo_movimiento"] == "uso_taller"

    terminada = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={"nuevo_estado": "terminada", "id_usuario": usuario_id},
    )
    assert terminada.status_code == 200, terminada.text

    venta_response = client.post(
        f"/ordenes_taller/{orden_id}/generar-venta",
        json={"id_usuario": usuario_id},
    )
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    venta_items = get_venta_items(db_conn, venta_id)
    assert len(venta_items) == 2
    assert {item["tipo_item"] for item in venta_items} == {"producto", "servicio_taller"}
    assert {item["id_orden_taller_item"] for item in venta_items} == {
        repuesto_item_id,
        servicio_item_id,
    }

    bloqueada = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={"nuevo_estado": "lista_para_retirar", "id_usuario": usuario_id},
    )
    assert bloqueada.status_code == 400
    assert "no está pagada ni entregada con deuda formal" in bloqueada.json()["detail"]

    pago_efectivo = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto_base": "10000.00",
            "id_usuario": usuario_id,
            "nota": "Pago efectivo taller e2e",
        },
    )
    assert pago_efectivo.status_code == 200, pago_efectivo.text

    pago_tarjeta = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "tarjeta",
            "monto_base": "12000.00",
            "cuotas": 3,
            "entidad": None,
            "id_usuario": usuario_id,
            "nota": "Pago tarjeta taller e2e",
        },
    )
    assert pago_tarjeta.status_code == 200, pago_tarjeta.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert _dec(venta["subtotal_base"]) == Decimal("22000.00")
    assert _dec(venta["descuento_total"]) == Decimal("1000.00")
    assert _dec(venta["recargo_total"]) == Decimal("1800.00")
    assert _dec(venta["total_final"]) == Decimal("22800.00")
    assert _dec(venta["saldo_pendiente"]) == Decimal("0.00")

    pagos = get_pagos_by_venta(db_conn, venta_id)
    assert len(pagos) == 2

    pago_efectivo_db = next(p for p in pagos if p["medio_pago"] == "efectivo")
    pago_tarjeta_db = next(p for p in pagos if p["medio_pago"] == "tarjeta")

    assert _dec(pago_efectivo_db["monto_base_aplicado"]) == Decimal("10000.00")
    assert _dec(pago_efectivo_db["monto_descuento_aplicado"]) == Decimal("1000.00")
    assert _dec(pago_efectivo_db["monto_total_cobrado"]) == Decimal("9000.00")

    assert _dec(pago_tarjeta_db["monto_base_aplicado"]) == Decimal("12000.00")
    assert _dec(pago_tarjeta_db["monto_recargo_aplicado"]) == Decimal("1800.00")
    assert _dec(pago_tarjeta_db["monto_total_cobrado"]) == Decimal("13800.00")

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingresos = [
        movimiento
        for movimiento in movimientos_caja
        if movimiento["tipo_movimiento"] == "ingreso"
        and movimiento["origen_tipo"] == "pago"
    ]
    assert len(ingresos) == 2
    assert sorted(_dec(m["monto"]) for m in ingresos) == [
        Decimal("9000.00"),
        Decimal("13800.00"),
    ]

    lista = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={"nuevo_estado": "lista_para_retirar", "id_usuario": usuario_id},
    )
    assert lista.status_code == 200, lista.text
    assert lista.json()["estado"] == "lista_para_retirar"

    retirada = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={"nuevo_estado": "retirada", "id_usuario": usuario_id},
    )
    assert retirada.status_code == 200, retirada.text
    assert retirada.json()["estado"] == "retirada"

    stock_final = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_final["stock_fisico"]) == Decimal("5")
    assert _dec(stock_final["stock_vendido_pendiente_entrega"]) == Decimal("0")

    movimientos_venta = get_movimientos_by_venta(db_conn, venta_id)
    assert movimientos_venta == []
