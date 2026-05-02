from app.shared.constants import (
    ORDEN_TALLER_ESTADO_INGRESADA,
    ORDEN_TALLER_ESTADO_PRESUPUESTADA,
    ORDEN_TALLER_EVENTO_CREADA,
    ORDEN_TALLER_EVENTO_CAMBIO_ESTADO,
)


def test_flujo_base_taller_crear_obtener_y_cambiar_estado(client, seed_taller_basico):
    crear_response = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "No frena la rueda trasera",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear_response.status_code == 201

    orden = crear_response.json()
    orden_id = orden["id"]

    assert orden["estado"] == ORDEN_TALLER_ESTADO_INGRESADA

    detalle = client.get(f"/ordenes_taller/{orden_id}").json()
    assert len(detalle["eventos"]) == 1
    assert detalle["eventos"][0]["tipo_evento"] == ORDEN_TALLER_EVENTO_CREADA

    cambiar_estado_response = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={
            "nuevo_estado": ORDEN_TALLER_ESTADO_PRESUPUESTADA,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert cambiar_estado_response.status_code == 200

    detalle_actualizado = client.get(f"/ordenes_taller/{orden_id}").json()

    assert detalle_actualizado["estado"] == ORDEN_TALLER_ESTADO_PRESUPUESTADA
    assert len(detalle_actualizado["eventos"]) == 2
    assert detalle_actualizado["eventos"][1]["tipo_evento"] == ORDEN_TALLER_EVENTO_CAMBIO_ESTADO


def test_no_permite_crear_orden_con_bicicleta_de_otro_cliente(client, seed_taller_basico):
    crear_response = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["otro_cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Test inválido",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert crear_response.status_code == 400
    assert "no pertenece al cliente" in crear_response.json()["detail"]


def test_no_permite_cambiar_al_mismo_estado(client, seed_taller_basico):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Test estado duplicado",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    orden_id = crear.json()["id"]

    response = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={
            "nuevo_estado": ORDEN_TALLER_ESTADO_INGRESADA,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert response.status_code == 400


def test_obtener_orden_inexistente(client):
    response = client.get("/ordenes_taller/999999")
    assert response.status_code == 404


# ---------------------------
# 🆕 TESTS DE ITEMS
# ---------------------------

def test_agregar_item_repuesto(client, seed_taller_basico, seed_venta_basica):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de frenos",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 2,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert item_response.status_code == 201
    item = item_response.json()

    assert float(item["cantidad"]) == 2.0
    assert float(item["subtotal"]) == 2000.0


def test_agregar_item_servicio(client, seed_taller_basico, seed_venta_mixta):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Armado",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_mixta["variante_servicio_id"],
            "cantidad": 1,
            "precio_unitario": 5000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert response.status_code == 201


def test_recalcula_total_final(client, seed_taller_basico, seed_venta_basica):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Test total",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 2,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    detalle = client.get(f"/ordenes_taller/{orden_id}").json()
    assert float(detalle["total_final"]) == 3000.0

def test_variante_inexistente(client, seed_taller_basico):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Test variante",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    orden_id = crear.json()["id"]

    response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": 999999,
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert response.status_code == 404

def test_no_permite_salto_invalido_de_ingresada_a_terminada(client, seed_taller_basico):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Test salto inválido",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    response = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={
            "nuevo_estado": "terminada",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "Transición inválida" in response.json()["detail"]


def test_flujo_valido_hasta_retirada(client, seed_taller_basico):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Service completo",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    flujo = [
        "presupuestada",
        "en_reparacion",
        "terminada",
        "lista_para_retirar",
        "retirada",
    ]

    for estado in flujo:
        response = client.post(
            f"/ordenes_taller/{orden_id}/estado",
            json={
                "nuevo_estado": estado,
                "id_usuario": seed_taller_basico["usuario_id"],
            },
        )

        assert response.status_code == 200
        assert response.json()["estado"] == estado


def test_no_permite_mover_orden_retirada(client, seed_taller_basico):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Orden terminal",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    for estado in [
        "presupuestada",
        "en_reparacion",
        "terminada",
        "lista_para_retirar",
        "retirada",
    ]:
        response = client.post(
            f"/ordenes_taller/{orden_id}/estado",
            json={
                "nuevo_estado": estado,
                "id_usuario": seed_taller_basico["usuario_id"],
            },
        )
        assert response.status_code == 200

    response = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        json={
            "nuevo_estado": "en_reparacion",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "Transición inválida" in response.json()["detail"]


def test_aprobar_item_taller(client, seed_taller_basico, seed_venta_basica):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    orden_id = crear.json()["id"]

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    item_id = item_response.json()["id"]

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert aprobar.status_code == 200
    item = aprobar.json()
    assert item["aprobado"] is True
    assert item["etapa"] == "agregado"


def test_no_permite_aprobar_dos_veces_mismo_item(client, seed_taller_basico, seed_venta_basica):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cubierta",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    orden_id = crear.json()["id"]

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    item_id = item_response.json()["id"]

    primera = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert primera.status_code == 200

    segunda = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert segunda.status_code == 400
    assert "ya tiene ese estado" in segunda.json()["detail"]

def test_no_permite_aprobar_item_de_otra_orden(client, seed_taller_basico, seed_venta_basica):
    crear_1 = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Orden 1",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    orden_1_id = crear_1.json()["id"]

    item_response = client.post(
        f"/ordenes_taller/{orden_1_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    item_id = item_response.json()["id"]

    crear_2 = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Orden 2",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    orden_2_id = crear_2.json()["id"]

    response = client.post(
        f"/ordenes_taller/{orden_2_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "no pertenece" in response.json()["detail"]
def test_ejecutar_item_consumo_stock(client, db_conn, seed_taller_basico, seed_venta_basica):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, %s, 0, 0)
            ON CONFLICT (id_sucursal, id_variante)
            DO UPDATE SET
                stock_fisico = EXCLUDED.stock_fisico,
                stock_reservado = 0,
                stock_vendido_pendiente_entrega = 0
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
                10,
            ),
        )
    db_conn.commit()

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert aprobar.status_code == 200

    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": seed_taller_basico["usuario_id"]},
    )

    assert ejecutar.status_code == 200
    assert ejecutar.json()["etapa"] == "ejecutado"

def test_ejecutar_item_descuenta_stock_y_registra_movimiento(
    client, db_conn, seed_taller_basico, seed_venta_basica
):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, %s, 0, 0)
            ON CONFLICT (id_sucursal, id_variante)
            DO UPDATE SET
                stock_fisico = EXCLUDED.stock_fisico,
                stock_reservado = 0,
                stock_vendido_pendiente_entrega = 0
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
                10,
            ),
        )
    db_conn.commit()

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert aprobar.status_code == 200

    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": seed_taller_basico["usuario_id"]},
    )

    assert ejecutar.status_code == 200
    assert ejecutar.json()["etapa"] == "ejecutado"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
            ),
        )
        stock_row = cur.fetchone()

        cur.execute(
            """
            SELECT tipo_movimiento, cantidad, origen_tipo, origen_id
            FROM movimientos_stock
            WHERE tipo_movimiento = 'uso_taller'
              AND origen_tipo = 'orden_taller'
              AND origen_id = %s
              AND id_variante = %s
            """,
            (
                orden_id,
                seed_venta_basica["variante_id"],
            ),
        )
        movimiento = cur.fetchone()

    assert stock_row["stock_fisico"] == 9

    assert movimiento is not None
    assert movimiento["tipo_movimiento"] == "uso_taller"
    assert movimiento["cantidad"] == 1
    assert movimiento["origen_tipo"] == "orden_taller"
    assert movimiento["origen_id"] == orden_id

def test_no_permite_ejecutar_item_dos_veces(
    client, db_conn, seed_taller_basico, seed_venta_basica
):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, %s, 0, 0)
            ON CONFLICT (id_sucursal, id_variante)
            DO UPDATE SET
                stock_fisico = EXCLUDED.stock_fisico,
                stock_reservado = 0,
                stock_vendido_pendiente_entrega = 0
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
                10,
            ),
        )
    db_conn.commit()

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert aprobar.status_code == 200

    primera = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": seed_taller_basico["usuario_id"]},
    )
    assert primera.status_code == 200
    assert primera.json()["etapa"] == "ejecutado"

    segunda = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": seed_taller_basico["usuario_id"]},
    )

    assert segunda.status_code == 400
    assert "ejecutado" in segunda.json()["detail"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
            ),
        )
        stock_row = cur.fetchone()

        cur.execute(
            """
            SELECT COUNT(*) AS cantidad_movimientos
            FROM movimientos_stock
            WHERE tipo_movimiento = 'uso_taller'
              AND origen_tipo = 'orden_taller'
              AND origen_id = %s
              AND id_variante = %s
            """,
            (
                orden_id,
                seed_venta_basica["variante_id"],
            ),
        )
        movimientos_row = cur.fetchone()

    assert stock_row["stock_fisico"] == 9
    assert movimientos_row["cantidad_movimientos"] == 1

def test_revertir_ejecucion_item_devuelve_stock_y_registra_movimiento(
    client, db_conn, seed_taller_basico, seed_venta_basica
):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, %s, 0, 0)
            ON CONFLICT (id_sucursal, id_variante)
            DO UPDATE SET
                stock_fisico = EXCLUDED.stock_fisico,
                stock_reservado = 0,
                stock_vendido_pendiente_entrega = 0
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
                10,
            ),
        )
    db_conn.commit()

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert aprobar.status_code == 200

    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": seed_taller_basico["usuario_id"]},
    )
    assert ejecutar.status_code == 200
    assert ejecutar.json()["etapa"] == "ejecutado"

    revertir = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/revertir-ejecucion",
        json={
            "id_usuario": seed_taller_basico["usuario_id"],
            "motivo": "Carga por error",
        },
    )

    assert revertir.status_code == 200
    assert revertir.json()["etapa"] == "agregado"
    assert revertir.json()["aprobado"] is True

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
            ),
        )
        stock_row = cur.fetchone()

        cur.execute(
            """
            SELECT tipo_movimiento, cantidad, origen_tipo, origen_id
            FROM movimientos_stock
            WHERE tipo_movimiento = 'reversion_uso_taller'
              AND origen_tipo = 'orden_taller'
              AND origen_id = %s
              AND id_variante = %s
            """,
            (
                orden_id,
                seed_venta_basica["variante_id"],
            ),
        )
        movimiento = cur.fetchone()

        cur.execute(
            """
            SELECT tipo_evento, detalle
            FROM ordenes_taller_eventos
            WHERE id_orden_taller = %s
              AND tipo_evento = 'item_ejecucion_revertida'
            """,
            (orden_id,),
        )
        evento = cur.fetchone()

    assert stock_row["stock_fisico"] == 10

    assert movimiento is not None
    assert movimiento["tipo_movimiento"] == "reversion_uso_taller"
    assert movimiento["cantidad"] == 1
    assert movimiento["origen_tipo"] == "orden_taller"
    assert movimiento["origen_id"] == orden_id

    assert evento is not None
    assert evento["tipo_evento"] == "item_ejecucion_revertida"
    assert "Carga por error" in evento["detalle"]


def test_no_permite_revertir_item_no_ejecutado(
    client, db_conn, seed_taller_basico, seed_venta_basica
):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    response = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/revertir-ejecucion",
        json={
            "id_usuario": seed_taller_basico["usuario_id"],
            "motivo": "Intento inválido",
        },
    )

    assert response.status_code == 400
    assert "ejecutado" in response.json()["detail"]


def test_no_permite_revertir_ejecucion_sin_motivo(
    client, db_conn, seed_taller_basico, seed_venta_basica
):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, %s, 0, 0)
            ON CONFLICT (id_sucursal, id_variante)
            DO UPDATE SET
                stock_fisico = EXCLUDED.stock_fisico,
                stock_reservado = 0,
                stock_vendido_pendiente_entrega = 0
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
                10,
            ),
        )
    db_conn.commit()

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert aprobar.status_code == 200

    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": seed_taller_basico["usuario_id"]},
    )
    assert ejecutar.status_code == 200

    response = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/revertir-ejecucion",
        json={
            "id_usuario": seed_taller_basico["usuario_id"],
            "motivo": "   ",
        },
    )

    assert response.status_code in (400, 422)


def test_no_permite_revertir_ejecucion_en_orden_retirada(
    client, db_conn, seed_taller_basico, seed_venta_basica
):
    crear = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Cambio de cámara",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 201
    orden_id = crear.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, %s, 0, 0)
            ON CONFLICT (id_sucursal, id_variante)
            DO UPDATE SET
                stock_fisico = EXCLUDED.stock_fisico,
                stock_reservado = 0,
                stock_vendido_pendiente_entrega = 0
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_venta_basica["variante_id"],
                10,
            ),
        )
    db_conn.commit()

    item_response = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 1000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    aprobar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/aprobacion",
        json={
            "aprobado": True,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert aprobar.status_code == 200

    ejecutar = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/ejecutar",
        params={"id_usuario": seed_taller_basico["usuario_id"]},
    )
    assert ejecutar.status_code == 200

    for estado in [
        "presupuestada",
        "en_reparacion",
        "terminada",
        "lista_para_retirar",
        "retirada",
    ]:
        cambiar = client.post(
            f"/ordenes_taller/{orden_id}/estado",
            json={
                "nuevo_estado": estado,
                "id_usuario": seed_taller_basico["usuario_id"],
            },
        )
        assert cambiar.status_code == 200

    response = client.post(
        f"/ordenes_taller/{orden_id}/items/{item_id}/revertir-ejecucion",
        json={
            "id_usuario": seed_taller_basico["usuario_id"],
            "motivo": "No debería permitirse",
        },
    )

    assert response.status_code == 400
    assert "retirada" in response.json()["detail"]