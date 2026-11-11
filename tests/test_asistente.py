from app.core.security import CurrentUser
from app.modules.asistente.service import responder_pregunta_asistente


def _crear_venta_asistente(client, seed_venta_basica):
    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def test_asistente_resumen_es_solo_lectura_y_devuelve_tarjetas(client, seed_venta_basica):
    _crear_venta_asistente(client, seed_venta_basica)

    response = client.get(
        "/asistente/resumen",
        params={"id_sucursal": seed_venta_basica["sucursal_id"]},
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["solo_lectura"] is True
    assert data["cards"]
    assert any(card["titulo"] == "Ventas hoy" for card in data["cards"])
    assert "ventas" in data["fuentes"]


def test_asistente_pregunta_ventas_hoy_devuelve_links(client, seed_venta_basica):
    venta_id = _crear_venta_asistente(client, seed_venta_basica)

    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "cuanto vendimos hoy",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "ventas_hoy"
    assert data["solo_lectura"] is True
    assert any(item["to"] == f"/ventas/{venta_id}" for item in data["items"])


def test_asistente_pregunta_stock_funciona_sin_movimientos(client, seed_venta_basica):
    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "stock critico",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "stock_critico"
    assert data["solo_lectura"] is True
    assert "stock_sucursal" in data["fuentes"]


def test_asistente_resolver_hoy_prioriza_caja_cerrada(client, seed_venta_basica):
    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "que tengo que resolver hoy",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "resolver_hoy"
    assert data["solo_lectura"] is True
    assert any(item["titulo"] == "Abrir caja" for item in data["items"])
    assert any(card["titulo"] == "Caja" and card["valor"] == "Cerrada" for card in data["cards"])


def test_asistente_explica_recepcion_mercaderia(client, db_conn, seed_venta_basica):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO proveedores (nombre, activo) VALUES ('PROVEEDOR ATENEA', TRUE) RETURNING id"
        )
        proveedor_id = cur.fetchone()["id"]
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "ATENEA-01\tPRODUCTO PARA EXPLICAR\t2\t$1.500,00",
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion_id = creada.json()["id"]

    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": f"mostrame la recepcion #{recepcion_id}",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "recepcion_mercaderia"
    assert data["titulo"] == f"Recepción #{recepcion_id}"
    assert "PROVEEDOR ATENEA" in data["resumen"]
    assert any(card["titulo"] == "Documentos" for card in data["cards"])
    assert data["solo_lectura"] is True


def test_atenea_cliente_reutiliza_analisis_oficial_y_cita_fuentes(client, seed_venta_basica):
    _crear_venta_asistente(client, seed_venta_basica)
    cliente_id = seed_venta_basica["cliente_id"]

    oficial = client.get(f"/clientes/{cliente_id}/analisis?periodo=365d")
    assert oficial.status_code == 200, oficial.text

    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "analizar este cliente",
            "cliente_id": cliente_id,
            "periodo": "365d",
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "cliente_crm"
    assert data["solo_lectura"] is True
    assert "analisis_cliente" in data["fuentes"]
    assert any(ref["label"].startswith("Análisis oficial") for ref in data["referencias"])
    assert any(card["titulo"] == "Ventas netas" for card in data["cards"])
    assert str(oficial.json()["resumen"]["cantidad_operaciones"]) in data["resumen"]


def test_atenea_prepara_borrador_sin_crear_seguimiento(client, seed_venta_basica):
    cliente_id = seed_venta_basica["cliente_id"]
    antes = client.get(f"/clientes/{cliente_id}/seguimientos?bandeja=pendientes").json()["total"]

    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "preparar mensaje para este cliente",
            "cliente_id": cliente_id,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["borrador_mensaje"]
    assert "registramos actividad" not in data["borrador_mensaje"].lower()
    assert data["requiere_confirmacion"] is True
    assert data["solo_lectura"] is True
    despues = client.get(f"/clientes/{cliente_id}/seguimientos?bandeja=pendientes").json()["total"]
    assert despues == antes


def test_atenea_cliente_oculta_ganancia_sin_permiso(seed_venta_basica):
    usuario = CurrentUser(
        id=seed_venta_basica["usuario_id"],
        username="consulta_crm",
        nombre="Consulta CRM",
        roles=frozenset({"operador"}),
        permisos=frozenset(),
    )
    data = responder_pregunta_asistente(
        pregunta="analizar este cliente",
        id_sucursal=seed_venta_basica["sucursal_id"],
        cliente_id=seed_venta_basica["cliente_id"],
        usuario=usuario,
    )
    assert all(card["titulo"] != "Ganancia comercial" for card in data["cards"])


def test_contexto_cliente_no_reemplaza_consultas_generales(client, seed_venta_basica):
    response = client.post(
        "/asistente/preguntar",
        json={
            "pregunta": "ventas de hoy",
            "cliente_id": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["intent"] == "ventas_hoy"


def test_atenea_resuelve_cliente_por_nombre_cuando_es_unico(client, seed_venta_basica):
    response = client.post(
        "/asistente/preguntar",
        json={"pregunta": "analizar cliente Test"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["intent"] == "cliente_crm"
    assert any(
        ref["to"] == f"/clientes/{seed_venta_basica['cliente_id']}"
        for ref in data["referencias"]
    )
