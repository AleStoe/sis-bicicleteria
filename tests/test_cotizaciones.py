from decimal import Decimal

from app.modules.cotizaciones.service import (
    _normalizar_telefono_whatsapp,
    _resolver_nombre_visible_cliente,
)
from app.modules.documentos.service import obtener_datos_cotizacion_pdf


def test_whatsapp_cotizacion_resuelve_nombre_y_telefono_compatibles():
    data = {
        "cliente_nombre_snapshot": None,
        "cliente_nombre": None,
        "cliente_nombre_persona": "Ana",
        "cliente_apellido": "Gomez",
    }

    assert _resolver_nombre_visible_cliente(data) == "Ana Gomez"
    assert _resolver_nombre_visible_cliente({}) == "cliente"
    assert _normalizar_telefono_whatsapp("(0291) 15 555 0000") == "5492915550000"


def _get_stock(conn, sucursal_id, variante_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico, stock_reservado, stock_vendido_pendiente_entrega
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (sucursal_id, variante_id),
        )
        return cur.fetchone()


def _crear_servicio_taller(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO servicios_taller (
                nombre,
                descripcion,
                precio_sugerido,
                duracion_estimada_min,
                activo
            )
            VALUES ('Service transmision test', 'Revision y ajuste', 18000, 60, TRUE)
            RETURNING id
            """
        )
        servicio_id = cur.fetchone()["id"]

    db_conn.commit()
    return servicio_id


def _crear_bicicleta_cliente(db_conn, cliente_id):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                condicion_entrega,
                plan_postventa
            )
            VALUES (%s, 'Venzo', 'Test', '29', 'Negra', 'armada', 'sin_service')
            RETURNING id
            """,
            (cliente_id,),
        )
        bicicleta_id = cur.fetchone()["id"]

    db_conn.commit()
    return bicicleta_id


def test_crear_cotizacion_venta_no_mueve_stock(client, db_conn, seed_venta_basica):
    stock_inicial = _get_stock(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    response = client.post(
        "/cotizaciones/",
        json={
            "tipo": "venta",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "producto",
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": "2",
                }
            ],
        },
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["numero"] == "COT-000001"
    assert data["tipo"] == "venta"
    assert data["tipo_precio"] == "minorista"
    assert data["estado"] == "borrador"
    assert Decimal(data["subtotal"]) == Decimal("48880.00")
    assert Decimal(data["total_final"]) == Decimal("48880.00")
    assert len(data["items"]) == 1
    assert data["items"][0]["descripcion_snapshot"].startswith("Aceite lubricante")

    stock_final = _get_stock(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert stock_final == stock_inicial


def test_crear_cotizacion_mayorista_usa_precio_mayorista(client, seed_venta_basica):
    response = client.post(
        "/cotizaciones/",
        json={
            "tipo": "venta",
            "tipo_precio": "mayorista",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "producto",
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": "1",
                }
            ],
        },
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["tipo_precio"] == "mayorista"
    assert Decimal(data["items"][0]["precio_unitario"]) == Decimal("20000.00")
    assert Decimal(data["total_final"]) == Decimal("20000.00")


def test_cotizacion_precio_manual_conserva_snapshot(client, seed_venta_basica):
    response = client.post(
        "/cotizaciones/",
        json={
            "tipo": "venta",
            "tipo_precio": "mayorista",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "producto",
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": "2",
                    "precio_unitario": "12345",
                }
            ],
        },
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["tipo_precio"] == "mayorista"
    assert Decimal(data["items"][0]["precio_unitario"]) == Decimal("12345.00")
    assert Decimal(data["total_final"]) == Decimal("24690.00")


def test_agregar_y_quitar_item_recalcula_total(client, seed_venta_basica):
    crear = client.post(
        "/cotizaciones/",
        json={
            "tipo": "venta",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "items": [],
        },
    )
    assert crear.status_code == 201, crear.text
    cotizacion_id = crear.json()["id"]

    agregar = client.post(
        f"/cotizaciones/{cotizacion_id}/items",
        json={
            "tipo_item": "linea_libre",
            "descripcion_snapshot": "Ajuste comercial",
            "cantidad": "1",
            "precio_unitario": "1500",
        },
    )
    assert agregar.status_code == 201, agregar.text
    item_id = agregar.json()["id"]

    detalle = client.get(f"/cotizaciones/{cotizacion_id}")
    assert detalle.status_code == 200
    assert Decimal(detalle.json()["total_final"]) == Decimal("1500.00")

    quitar = client.delete(f"/cotizaciones/{cotizacion_id}/items/{item_id}")
    assert quitar.status_code == 200, quitar.text

    detalle = client.get(f"/cotizaciones/{cotizacion_id}")
    assert Decimal(detalle.json()["total_final"]) == Decimal("0.00")
    assert detalle.json()["items"] == []


def test_cotizacion_reparacion_estados_y_whatsapp(client, db_conn, seed_venta_basica):
    servicio_id = _crear_servicio_taller(db_conn)
    bicicleta_id = _crear_bicicleta_cliente(db_conn, seed_venta_basica["cliente_id"])

    crear = client.post(
        "/cotizaciones/",
        json={
            "tipo": "reparacion",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_bicicleta_cliente": bicicleta_id,
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "problema_reportado": "Hace ruido al pedalear",
            "items": [
                {
                    "tipo_item": "servicio_taller",
                    "id_servicio_taller": servicio_id,
                    "cantidad": "1",
                }
            ],
        },
    )
    assert crear.status_code == 201, crear.text
    cotizacion_id = crear.json()["id"]
    assert Decimal(crear.json()["total_final"]) == Decimal("18000.00")

    enviada = client.post(
        f"/cotizaciones/{cotizacion_id}/estado",
        json={"estado": "enviada", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert enviada.status_code == 200, enviada.text
    assert enviada.json()["estado"] == "enviada"

    aceptada = client.post(
        f"/cotizaciones/{cotizacion_id}/estado",
        json={"estado": "aceptada", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert aceptada.status_code == 200, aceptada.text
    assert aceptada.json()["estado"] == "aceptada"

    whatsapp = client.get(f"/cotizaciones/{cotizacion_id}/mensaje-whatsapp")
    assert whatsapp.status_code == 200, whatsapp.text
    data = whatsapp.json()
    assert data["numero"] == crear.json()["numero"]
    assert "Lista aplicada: Minorista" in data["mensaje"]
    assert "HACE RUIDO AL PEDALEAR" in data["mensaje"]
    assert "Total estimado" in data["mensaje"]
    assert "Tipo: reparacion" not in data["mensaje"]
    assert data["whatsapp_url"].startswith("https://api.whatsapp.com/send?phone=549")


def test_whatsapp_cotizacion_mayorista_muestra_lista_y_precios_formateados(client, seed_venta_basica):
    crear = client.post(
        "/cotizaciones/",
        json={
            "tipo": "venta",
            "tipo_precio": "mayorista",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "producto",
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": "1",
                }
            ],
        },
    )
    assert crear.status_code == 201, crear.text

    whatsapp = client.get(f"/cotizaciones/{crear.json()['id']}/mensaje-whatsapp")
    assert whatsapp.status_code == 200, whatsapp.text
    mensaje = whatsapp.json()["mensaje"]

    assert "Lista aplicada: Mayorista" in mensaje
    assert "Total estimado: $20.000,00" in mensaje
    assert "Esta cotización no reserva stock" in mensaje
    assert "Tipo:" not in mensaje


def test_datos_pdf_cotizacion_incluyen_lista_y_opciones_pago(client, seed_venta_basica):
    crear = client.post(
        "/cotizaciones/",
        json={
            "tipo": "venta",
            "tipo_precio": "mayorista",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "producto",
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": "1",
                }
            ],
        },
    )
    assert crear.status_code == 201, crear.text

    data = obtener_datos_cotizacion_pdf(crear.json()["id"])
    assert data["cotizacion"]["tipo_precio"] == "mayorista"
    assert set(data["opciones_pago"].keys()) == {"contado", "tarjeta"}


def test_no_permite_editar_cotizacion_aceptada(client, seed_venta_basica):
    crear = client.post(
        "/cotizaciones/",
        json={
            "tipo": "venta",
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_usuario_creador": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "producto",
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": "1",
                }
            ],
        },
    )
    cotizacion_id = crear.json()["id"]

    aceptar = client.post(
        f"/cotizaciones/{cotizacion_id}/estado",
        json={"estado": "aceptada", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert aceptar.status_code == 200

    agregar = client.post(
        f"/cotizaciones/{cotizacion_id}/items",
        json={
            "tipo_item": "linea_libre",
            "descripcion_snapshot": "Extra",
            "cantidad": "1",
            "precio_unitario": "100",
        },
    )
    assert agregar.status_code == 400
    assert "Solo se pueden editar" in agregar.json()["detail"]
