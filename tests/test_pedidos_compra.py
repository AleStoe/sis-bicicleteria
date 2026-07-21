def test_pedido_compra_guarda_borrador_con_items_e_historial(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor Pedido Beta', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]
    db_conn.commit()

    response = client.post(
        "/pedidos-compra/",
        json={
            "id_proveedor": proveedor_id,
            "proveedor_nombre": "Proveedor Pedido Beta",
            "observaciones": "Pedir por WhatsApp",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "producto_nombre": "Aceite lubricante Zefal Pro",
                    "nombre_variante": "Dry Lube 120ML",
                    "sku": "ZEFAL-DRY-120",
                    "codigo_proveedor": "ZEFAL-DRY-120",
                    "stock_disponible_al_crear": 1,
                    "cantidad_sugerida": 2,
                    "cantidad_pedida": 3,
                }
            ],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["estado"] == "borrador"
    assert data["id_proveedor"] == proveedor_id
    assert data["proveedor_nombre_snapshot"] == "Proveedor Pedido Beta"
    assert data["total_items"] == 1
    assert data["cantidad_total_pedida"] == "3.000"
    assert data["items"][0]["id_variante"] == seed_venta_basica["variante_id"]
    assert data["historial"][0]["accion"] == "pedido_compra_creado"

    listado = client.get("/pedidos-compra/", params={"estado": "borrador"})
    assert listado.status_code == 200, listado.text
    assert listado.json()[0]["id"] == data["id"]


def test_pedido_compra_cambia_estado_y_registra_historial(
    client,
    db_conn,
    seed_venta_basica,
):
    creado = client.post(
        "/pedidos-compra/",
        json={
            "proveedor_nombre": "Proveedor sin maestro",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "producto_nombre": "Aceite lubricante Zefal Pro",
                    "nombre_variante": "Dry Lube 120ML",
                    "cantidad_pedida": 4,
                }
            ],
        },
    )
    assert creado.status_code == 200, creado.text
    pedido_id = creado.json()["id"]

    enviado = client.patch(
        f"/pedidos-compra/{pedido_id}/estado",
        json={
            "estado": "enviado",
            "observaciones": "Enviado al proveedor",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert enviado.status_code == 200, enviado.text
    data = enviado.json()
    assert data["estado"] == "enviado"
    assert data["observaciones"] == "Enviado al proveedor"
    assert data["fecha_envio"] is not None

    acciones = [evento["accion"] for evento in data["historial"]]
    assert "pedido_compra_estado_actualizado" in acciones
    assert "pedido_compra_creado" in acciones

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT accion, entidad, entidad_id
            FROM auditoria_eventos
            WHERE entidad = 'pedido_compra' AND entidad_id = %s
            ORDER BY id
            """,
            (pedido_id,),
        )
        auditorias = cur.fetchall()

    assert [evento["accion"] for evento in auditorias] == [
        "pedido_compra_creado",
        "pedido_compra_estado_actualizado",
    ]


def test_pedido_compra_recepciona_parcial_y_actualiza_stock_costo(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor Recepcion Pedido', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]
    db_conn.commit()

    creado = client.post(
        "/pedidos-compra/",
        json={
            "id_proveedor": proveedor_id,
            "proveedor_nombre": "Proveedor Recepcion Pedido",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "producto_nombre": "Aceite lubricante Zefal Pro",
                    "nombre_variante": "Dry Lube 120ML",
                    "sku": "ZEFAL-DRY-120",
                    "cantidad_pedida": 4,
                }
            ],
        },
    )
    assert creado.status_code == 200, creado.text
    pedido_id = creado.json()["id"]
    item_id = creado.json()["items"][0]["id"]

    enviado = client.patch(
        f"/pedidos-compra/{pedido_id}/estado",
        json={"estado": "enviado", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert enviado.status_code == 200, enviado.text

    recepcion = client.post(
        f"/pedidos-compra/{pedido_id}/recepciones",
        json={
            "observaciones": "Llegó parcial con aumento",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_item": item_id,
                    "id_sucursal": seed_venta_basica["sucursal_id"],
                    "cantidad_recibida": 2,
                    "costo_unitario": 12000,
                    "gastos_adicionales": 0,
                }
            ],
        },
    )

    assert recepcion.status_code == 200, recepcion.text
    data = recepcion.json()
    assert data["estado"] == "recibido_parcial"
    assert data["cantidad_total_recibida"] == "2.000"
    assert data["items"][0]["cantidad_recibida"] == "2.000"
    assert data["historial"][0]["accion"] == "pedido_compra_recepcion_registrada"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s AND id_variante = %s
            """,
            (seed_venta_basica["sucursal_id"], seed_venta_basica["variante_id"]),
        )
        assert cur.fetchone()["stock_fisico"] == 8

        cur.execute(
            "SELECT costo_promedio_vigente FROM variantes WHERE id = %s",
            (seed_venta_basica["variante_id"],),
        )
        assert cur.fetchone()["costo_promedio_vigente"] == 10500

        cur.execute(
            """
            SELECT cantidad_ingresada, costo_unitario_calculado, origen_ingreso
            FROM ingresos_stock
            WHERE id_variante = %s
            """,
            (seed_venta_basica["variante_id"],),
        )
        ingreso = cur.fetchone()
        assert ingreso["cantidad_ingresada"] == 2
        assert ingreso["costo_unitario_calculado"] == 12000
        assert ingreso["origen_ingreso"] == "pedido_compra"


def test_pedido_compra_recepcion_total_cierra_y_no_permite_excedente(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor Recepcion Total', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]
    db_conn.commit()

    creado = client.post(
        "/pedidos-compra/",
        json={
            "id_proveedor": proveedor_id,
            "proveedor_nombre": "Proveedor Recepcion Total",
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "producto_nombre": "Aceite lubricante Zefal Pro",
                    "nombre_variante": "Dry Lube 120ML",
                    "cantidad_pedida": 1,
                }
            ],
        },
    )
    assert creado.status_code == 200, creado.text
    pedido_id = creado.json()["id"]
    item_id = creado.json()["items"][0]["id"]

    client.patch(
        f"/pedidos-compra/{pedido_id}/estado",
        json={"estado": "enviado", "id_usuario": seed_venta_basica["usuario_id"]},
    )

    excedente = client.post(
        f"/pedidos-compra/{pedido_id}/recepciones",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_item": item_id,
                    "id_sucursal": seed_venta_basica["sucursal_id"],
                    "cantidad_recibida": 2,
                    "costo_unitario": 9000,
                }
            ],
        },
    )
    assert excedente.status_code == 400
    assert "supera lo pendiente" in excedente.json()["detail"]

    recepcion = client.post(
        f"/pedidos-compra/{pedido_id}/recepciones",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_item": item_id,
                    "id_sucursal": seed_venta_basica["sucursal_id"],
                    "cantidad_recibida": 1,
                    "costo_unitario": 9000,
                }
            ],
        },
    )
    assert recepcion.status_code == 200, recepcion.text
    assert recepcion.json()["estado"] == "cerrado"

    otra_recepcion = client.post(
        f"/pedidos-compra/{pedido_id}/recepciones",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_item": item_id,
                    "id_sucursal": seed_venta_basica["sucursal_id"],
                    "cantidad_recibida": 1,
                    "costo_unitario": 9000,
                }
            ],
        },
    )
    assert otra_recepcion.status_code == 400
    assert "Solo se pueden recibir" in otra_recepcion.json()["detail"]
