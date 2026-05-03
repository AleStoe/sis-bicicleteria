from decimal import Decimal
from tests.conftest import get_stock_row


def _dec(v):
    return Decimal(str(v))


def test_master_taller_flujo_completo(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_taller_basico["usuario_id"]
    variante_id = seed_venta_basica["variante_id"]

    # 1. abrir caja
    client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )

    # 2. crear orden
    orden = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "test completo",
            "id_usuario": usuario_id,
        },
    )
    orden_id = orden.json()["id"]

    # 3. item
    item = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": variante_id,
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": usuario_id,
        },
    )
    item_id = item.json()["id"]

    # 4. aprobar
    client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={"aprobado": True, "id_usuario": usuario_id},
    )

    # 5. ejecutar
    client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": usuario_id},
    )

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("5")

    # 6. cobrar
    pago = client.post(
        "/pagos/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": seed_taller_basico["cliente_id"],
            "origen_tipo": "orden_taller",
            "origen_id": orden_id,
            "medio_pago": "efectivo",
            "monto": 1000,
            "id_usuario": usuario_id,
        },
    )

    assert pago.status_code == 200