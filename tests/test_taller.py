from app.shared.constants import(
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

    assert orden["id_sucursal"] == seed_taller_basico["sucursal_id"]
    assert orden["id_cliente"] == seed_taller_basico["cliente_id"]
    assert orden["id_bicicleta_cliente"] == seed_taller_basico["bicicleta_cliente_id"]
    assert orden["estado"] == ORDEN_TALLER_ESTADO_INGRESADA
    assert orden["problema_reportado"] == "No frena la rueda trasera"
    assert float(orden["total_final"]) == 0.0
    assert float(orden["saldo_pendiente"]) == 0.0

    detalle_response = client.get(f"/ordenes_taller/{orden_id}")
    assert detalle_response.status_code == 200

    detalle = detalle_response.json()
    assert detalle["id"] == orden_id
    assert detalle["estado"] == ORDEN_TALLER_ESTADO_INGRESADA
    assert detalle["problema_reportado"] == "No frena la rueda trasera"
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

    orden_actualizada = cambiar_estado_response.json()
    assert orden_actualizada["id"] == orden_id
    assert orden_actualizada["estado"] == ORDEN_TALLER_ESTADO_PRESUPUESTADA

    detalle_actualizado_response = client.get(f"/ordenes_taller/{orden_id}")
    assert detalle_actualizado_response.status_code == 200

    detalle_actualizado = detalle_actualizado_response.json()
    assert detalle_actualizado["estado"] == ORDEN_TALLER_ESTADO_PRESUPUESTADA
    assert len(detalle_actualizado["eventos"]) == 2
    assert detalle_actualizado["eventos"][0]["tipo_evento"] == ORDEN_TALLER_EVENTO_CREADA
    assert detalle_actualizado["eventos"][1]["tipo_evento"] == ORDEN_TALLER_EVENTO_CAMBIO_ESTADO
    assert ORDEN_TALLER_ESTADO_INGRESADA in detalle_actualizado["eventos"][1]["detalle"]
    assert ORDEN_TALLER_ESTADO_PRESUPUESTADA in detalle_actualizado["eventos"][1]["detalle"]

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

from app.shared.constants import ORDEN_TALLER_ESTADO_INGRESADA

def test_no_permite_cambiar_al_mismo_estado(client, seed_taller_basico):
    # Crear orden
    crear_response = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Test estado duplicado",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear_response.status_code == 201

    orden_id = crear_response.json()["id"]

    # Intentar cambiar al mismo estado
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