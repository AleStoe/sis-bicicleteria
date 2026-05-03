from decimal import Decimal

from tests.conftest import get_stock_row


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _get_movimientos_taller(conn, orden_id: int, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT tipo_movimiento, cantidad, origen_tipo, origen_id
            FROM movimientos_stock
            WHERE origen_tipo = 'orden_taller'
              AND origen_id = %s
              AND id_variante = %s
            ORDER BY id
            """,
            (orden_id, variante_id),
        )
        return cur.fetchall()


def test_circuito_taller_aprobar_ejecutar_consumir_stock(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_taller_basico["usuario_id"]

    # 1. Crear orden de taller en la misma sucursal donde existe stock
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara y revisión general",
            "id_usuario": usuario_id,
        },
    )
    assert crear.status_code == 201, crear.text
    orden_id = crear.json()["id"]

    stock_inicial = get_stock_row(db_conn, sucursal_id, variante_id)
    assert stock_inicial is not None
    assert _dec(stock_inicial["stock_fisico"]) == Decimal("6")

    # 2. Agregar ítem presupuestado
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

    item = item_response.json()
    item_id = item["id"]

    assert item["etapa"] == "presupuestado"
    assert item["aprobado"] is False

    # Agregar ítem NO debe consumir stock
    stock_post_item = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_post_item["stock_fisico"]) == Decimal("6")

    movimientos_post_item = _get_movimientos_taller(db_conn, orden_id, variante_id)
    assert movimientos_post_item == []

    # 3. Aprobar ítem NO debe consumir stock
    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": usuario_id,
        },
    )
    assert aprobar.status_code == 200, aprobar.text

    item_aprobado = aprobar.json()
    assert item_aprobado["etapa"] == "agregado"
    assert item_aprobado["aprobado"] is True

    stock_post_aprobacion = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_post_aprobacion["stock_fisico"]) == Decimal("6")

    movimientos_post_aprobacion = _get_movimientos_taller(
        db_conn,
        orden_id,
        variante_id,
    )
    assert movimientos_post_aprobacion == []

    # 4. Ejecutar ítem SÍ debe consumir stock
    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={
            "id_usuario": usuario_id,
        },
    )
    assert ejecutar.status_code == 200, ejecutar.text

    item_ejecutado = ejecutar.json()
    assert item_ejecutado["etapa"] == "ejecutado"

    stock_post_ejecucion = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_post_ejecucion["stock_fisico"]) == Decimal("5")

    movimientos_post_ejecucion = _get_movimientos_taller(
        db_conn,
        orden_id,
        variante_id,
    )

    assert len(movimientos_post_ejecucion) == 1

    movimiento = movimientos_post_ejecucion[0]
    assert movimiento["tipo_movimiento"] == "uso_taller"
    assert _dec(movimiento["cantidad"]) == Decimal("1")
    assert movimiento["origen_tipo"] == "orden_taller"
    assert movimiento["origen_id"] == orden_id

    # 5. Ejecutar dos veces debe fallar y no debe volver a descontar stock
    ejecutar_otra_vez = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={
            "id_usuario": usuario_id,
        },
    )
    assert ejecutar_otra_vez.status_code == 400

    stock_final = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock_final["stock_fisico"]) == Decimal("5")

    movimientos_finales = _get_movimientos_taller(db_conn, orden_id, variante_id)
    assert len(movimientos_finales) == 1