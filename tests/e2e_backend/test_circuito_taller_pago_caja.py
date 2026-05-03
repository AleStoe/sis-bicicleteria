from decimal import Decimal

from tests.conftest import get_caja_movimientos, get_stock_row


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _get_pagos_orden_taller(conn, orden_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM pagos
            WHERE origen_tipo = 'orden_taller'
              AND origen_id = %s
            ORDER BY id
            """,
            (orden_id,),
        )
        return cur.fetchall()


def test_circuito_taller_ejecutar_repuesto_cobrar_y_mover_caja(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_taller_basico["usuario_id"]
    cliente_id = seed_taller_basico["cliente_id"]

    # 1. Abrir caja
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

    # 2. Crear orden de taller
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara con cobro final",
            "id_usuario": usuario_id,
        },
    )
    assert crear.status_code == 201, crear.text
    orden_id = crear.json()["id"]

    stock_inicial = get_stock_row(db_conn, sucursal_id, variante_id)
    assert stock_inicial is not None
    assert _dec(stock_inicial["stock_fisico"]) == Decimal("6")

    # 3. Agregar repuesto
    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": variante_id,
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": usuario_id,
        },
    )
    assert item_response.status_code == 201, item_response.text
    item_id = item_response.json()["id"]

    # 4. Aprobar ítem
    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": usuario_id,
        },
    )
    assert aprobar.status_code == 200, aprobar.text

    # 5. Ejecutar ítem: consume stock
    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={
            "id_usuario": usuario_id,
        },
    )
    assert ejecutar.status_code == 200, ejecutar.text

    stock_post_ejecucion = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_post_ejecucion["stock_fisico"]) == Decimal("5")

    # 6. Cobrar orden de taller
    pago_response = client.post(
        "/pagos/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": cliente_id,
            "origen_tipo": "orden_taller",
            "origen_id": orden_id,
            "medio_pago": "efectivo",
            "monto": 1000,
            "id_usuario": usuario_id,
            "nota": "Pago orden taller circuito e2e",
        },
    )
    assert pago_response.status_code == 200, pago_response.text

    # 7. Validar pago registrado contra orden
    pagos = _get_pagos_orden_taller(db_conn, orden_id)
    assert len(pagos) == 1

    pago = pagos[0]
    assert pago["origen_tipo"] == "orden_taller"
    assert pago["origen_id"] == orden_id
    assert pago["medio_pago"] == "efectivo"
    assert pago["estado"] == "confirmado"
    assert _dec(pago["monto_total_cobrado"]) == Decimal("1000")

    # 8. Validar caja
    movimientos_caja = get_caja_movimientos(db_conn, caja_id)

    ingresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "ingreso"
        and m["submedio"] == "efectivo"
        and m["origen_tipo"] == "pago"
    ]

    assert len(ingresos) == 1
    assert _dec(ingresos[0]["monto"]) == Decimal("1000")
    assert ingresos[0]["origen_id"] == pago["id"]

    # 9. Stock no debe moverse por cobrar
    stock_final = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_final["stock_fisico"]) == Decimal("5")