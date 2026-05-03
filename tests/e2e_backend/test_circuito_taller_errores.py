from decimal import Decimal

from tests.conftest import get_stock_row


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


def _crear_orden_taller(client, seed_taller_basico, sucursal_id, usuario_id):
    response = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Test circuito error taller",
            "id_usuario": usuario_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _agregar_item(client, orden_id, variante_id, cantidad, usuario_id):
    response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": variante_id,
            "cantidad": cantidad,
            "precio_unitario": 1000,
            "id_usuario": usuario_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_taller_no_permite_ejecutar_item_sin_aprobar(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_taller_basico["usuario_id"]

    orden_id = _crear_orden_taller(client, seed_taller_basico, sucursal_id, usuario_id)
    item_id = _agregar_item(client, orden_id, variante_id, 1, usuario_id)

    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": usuario_id},
    )

    assert ejecutar.status_code == 400

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("6")

    movimientos = _get_movimientos_taller(db_conn, orden_id, variante_id)
    assert movimientos == []


def test_taller_no_permite_ejecutar_sin_stock_suficiente(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_taller_basico["usuario_id"]

    orden_id = _crear_orden_taller(client, seed_taller_basico, sucursal_id, usuario_id)
    item_id = _agregar_item(client, orden_id, variante_id, 999, usuario_id)

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": usuario_id,
        },
    )
    assert aprobar.status_code == 200, aprobar.text

    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": usuario_id},
    )

    assert ejecutar.status_code == 400

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("6")

    movimientos = _get_movimientos_taller(db_conn, orden_id, variante_id)
    assert movimientos == []