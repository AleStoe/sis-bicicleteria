from decimal import Decimal


def test_pedido_cliente_crea_borrador_y_no_mueve_stock(client, db_conn, seed_venta_basica):
    creado = client.post(
        "/pedidos-cliente/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "tipo_precio": "mayorista",
            "observaciones": "Cliente suma mÃ¡s cosas maÃ±ana",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert creado.status_code == 200, creado.text
    pedido = creado.json()
    assert pedido["estado"] == "borrador"
    assert pedido["cliente_nombre"] == "Cliente Test"
    assert pedido["historial"][0]["accion"] == "pedido_cliente_creado"

    agregado = client.post(
        f"/pedidos-cliente/{pedido['id']}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": "2",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert agregado.status_code == 200, agregado.text
    data = agregado.json()
    assert data["total_items"] == 1
    assert data["cantidad_total"] == "2.000"
    assert data["items"][0]["cantidad"] == "2.000"
    assert data["items"][0]["precio_mayorista"] == "20000.00"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico, stock_reservado, stock_vendido_pendiente_entrega
            FROM stock_sucursal
            WHERE id = %s
            """,
            (seed_venta_basica["stock_id"],),
        )
        stock = cur.fetchone()
    assert stock["stock_fisico"] == Decimal("6")
    assert stock["stock_reservado"] == Decimal("0")
    assert stock["stock_vendido_pendiente_entrega"] == Decimal("0")


def test_pedido_cliente_acumula_actualiza_y_quita_items(client, seed_venta_basica):
    creado = client.post(
        "/pedidos-cliente/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "tipo_precio": "minorista",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    ).json()

    for cantidad in ["1", "3"]:
        response = client.post(
            f"/pedidos-cliente/{creado['id']}/items",
            json={
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": cantidad,
                "id_usuario": seed_venta_basica["usuario_id"],
            },
        )
        assert response.status_code == 200, response.text

    acumulado = response.json()
    item = acumulado["items"][0]
    assert item["cantidad"] == "4.000"

    actualizado = client.patch(
        f"/pedidos-cliente/{creado['id']}/items/{item['id']}",
        json={"cantidad": "5", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert actualizado.status_code == 200, actualizado.text
    assert actualizado.json()["items"][0]["cantidad"] == "5.000"

    quitado = client.delete(f"/pedidos-cliente/{creado['id']}/items/{item['id']}")
    assert quitado.status_code == 200, quitado.text
    assert quitado.json()["items"] == []
    acciones = [evento["accion"] for evento in quitado.json()["historial"]]
    assert "pedido_cliente_item_quitado" in acciones


def test_pedido_cliente_convertido_no_permite_edicion(client, db_conn, seed_venta_basica):
    creado = client.post(
        "/pedidos-cliente/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "tipo_precio": "minorista",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    ).json()

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ventas (
                id_sucursal,
                id_cliente,
                estado,
                subtotal_base,
                total_final,
                saldo_pendiente,
                id_usuario_creador
            )
            VALUES (%s, %s, 'pagada_total', 24440, 24440, 0, %s)
            RETURNING id
            """,
            (
                seed_venta_basica["sucursal_id"],
                seed_venta_basica["cliente_id"],
                seed_venta_basica["usuario_id"],
            ),
        )
        venta_id = cur.fetchone()["id"]
    db_conn.commit()

    convertido = client.post(
        f"/pedidos-cliente/{creado['id']}/convertir",
        json={"id_venta": venta_id, "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert convertido.status_code == 200, convertido.text
    assert convertido.json()["estado"] == "convertido_a_venta"
    assert convertido.json()["id_venta_generada"] == venta_id

    bloqueado = client.post(
        f"/pedidos-cliente/{creado['id']}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": "1",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert bloqueado.status_code == 400
    assert "borrador" in bloqueado.json()["detail"].lower()


def test_pedido_cliente_cancelado_audita(client, db_conn, seed_venta_basica):
    creado = client.post(
        "/pedidos-cliente/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "tipo_precio": "minorista",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    ).json()

    cancelado = client.post(
        f"/pedidos-cliente/{creado['id']}/cancelar",
        json={"motivo": "Cliente no confirma", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert cancelado.status_code == 200, cancelado.text
    assert cancelado.json()["estado"] == "cancelado"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT accion
            FROM auditoria_eventos
            WHERE entidad = 'pedido_cliente' AND entidad_id = %s
            ORDER BY id
            """,
            (creado["id"],),
        )
        acciones = [row["accion"] for row in cur.fetchall()]

    assert acciones == ["pedido_cliente_creado", "pedido_cliente_cancelado"]
