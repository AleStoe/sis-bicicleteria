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