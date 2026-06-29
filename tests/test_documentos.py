from decimal import Decimal

from app.modules.documentos.pdf import _detalle_pago_financiero
from app.modules.documentos.pdf_etiquetas import _build_opciones_pago
from app.modules.documentos.repository import (
    get_pagos_comprobante_by_venta_id,
    get_venta_items_comprobante_by_venta_id,
)


def _crear_venta_basica(client, seed_venta_basica):
    return client.post(
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


def test_comprobante_x_venta_devuelve_pdf(client, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200

    venta_id = crear.json()["venta_id"]

    response = client.get(f"/documentos/ventas/{venta_id}/comprobante-x")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_comprobante_x_incluye_servicios_taller(client, db_conn, seed_venta_basica):
    servicio = client.post(
        "/servicios_taller/",
        json={
            "nombre": "Armado general comprobante",
            "descripcion": "Servicio para comprobante X",
            "precio_sugerido": 15000,
            "duracion_estimada_min": 60,
        },
    )
    assert servicio.status_code == 201, servicio.text
    servicio_id = servicio.json()["id"]

    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "servicio_taller",
                    "id_servicio_taller": servicio_id,
                    "cantidad": 1,
                    "precio_unitario_manual": 15000,
                    "motivo_precio_manual": "Test comprobante X servicio",
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    items = get_venta_items_comprobante_by_venta_id(db_conn, venta_id)
    assert len(items) == 1
    assert items[0]["tipo_item"] == "servicio_taller"
    assert items[0]["id_servicio_taller"] == servicio_id

    response = client.get(f"/documentos/ventas/{venta_id}/comprobante-x")

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_comprobante_x_usa_descuento_efectivo_del_motor_financiero(
    client,
    db_conn,
    seed_venta_basica,
    caja_abierta_basica,
):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200

    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute("SELECT total_final FROM ventas WHERE id = %s", (venta_id,))
        total = cur.fetchone()["total_final"]

    pago = client.post(
        "/pagos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto_base": str(total),
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago.status_code == 200, pago.text

    pagos = get_pagos_comprobante_by_venta_id(db_conn, venta_id)
    assert len(pagos) == 1

    pago_documento = pagos[0]
    assert Decimal(str(pago_documento["monto_base_aplicado"])) == Decimal(str(total))
    assert Decimal(str(pago_documento["monto_descuento_aplicado"])) > Decimal("0")
    assert Decimal(str(pago_documento["monto_total_cobrado"])) < Decimal(str(total))

    detalle = _detalle_pago_financiero(pago_documento)
    assert "Monto abonado:" in detalle
    assert "Bonificación aplicada:" in detalle

    response = client.get(f"/documentos/ventas/{venta_id}/comprobante-x")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_presupuesto_taller_devuelve_pdf(client, seed_taller_basico, seed_venta_basica):
    crear_orden = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_cliente": seed_taller_basico["cliente_id"],
            "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
            "problema_reportado": "Ruido en transmision",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear_orden.status_code == 201, crear_orden.text
    orden_id = crear_orden.json()["id"]

    item = client.post(
        f"/ordenes_taller/{orden_id}/items",
        json={
            "tipo_item": "repuesto",
            "id_variante": seed_venta_basica["variante_id"],
            "cantidad": 1,
            "precio_unitario": 5000,
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert item.status_code == 201, item.text

    response = client.get(f"/documentos/taller/{orden_id}/presupuesto")

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_resumen_cobros_venta_devuelve_pdf(client, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200

    venta_id = crear.json()["venta_id"]

    response = client.get(f"/documentos/ventas/{venta_id}/resumen-cobros")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_recibo_pago_devuelve_pdf(client, seed_venta_basica, caja_abierta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200

    venta_id = crear.json()["venta_id"]
    pago = client.post(
        "/pagos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto_base": "1000",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago.status_code == 200, pago.text

    pago_id = pago.json()["pago_id"]
    response = client.get(f"/documentos/pagos/{pago_id}/recibo")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_cotizacion_devuelve_pdf(client, seed_venta_basica):
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
    assert crear.status_code == 201, crear.text

    cotizacion_id = crear.json()["id"]
    response = client.get(f"/documentos/cotizaciones/{cotizacion_id}/pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_etiqueta_deposito_variante_devuelve_pdf(client, seed_venta_basica):
    variante_id = seed_venta_basica["variante_id"]

    response = client.get(f"/documentos/etiquetas/variantes/{variante_id}/deposito?copias=2")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_cartel_precio_variante_devuelve_pdf(client, seed_venta_basica):
    variante_id = seed_venta_basica["variante_id"]

    response = client.get(f"/documentos/etiquetas/variantes/{variante_id}/precio-a4")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_cartel_precio_ordena_opciones_comerciales_sin_inventar_planes():
    opciones = {
        "contado": [
            {
                "medio_pago": "efectivo",
                "porcentaje_descuento": Decimal("10"),
            }
        ],
        "tarjeta": [
            {"label": "Tarjeta 12 cuotas", "cuotas": 12, "porcentaje_recargo": 90},
            {"label": "Tarjeta 6 cuotas", "cuotas": 6, "porcentaje_recargo": 35},
            {"label": "Tarjeta 3 cuotas", "cuotas": 3, "porcentaje_recargo": 15},
        ],
    }

    lineas = _build_opciones_pago(327778, opciones)

    assert [linea["tipo"] for linea in lineas] == [
        "efectivo",
        "lista",
        "tarjeta",
        "tarjeta",
    ]
    assert [linea["label"] for linea in lineas] == [
        "Precio efectivo / transferencia",
        "Precio de lista",
        "Tarjeta 3 cuotas",
        "Tarjeta 6 cuotas",
    ]
    assert lineas[0]["badge"] == "10% OFF"


def test_etiqueta_deposito_bicicleta_serializada_devuelve_pdf(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado
            )
            VALUES (%s, %s, %s, 'disponible')
            RETURNING id
            """,
            (
                seed_venta_basica["variante_id"],
                seed_venta_basica["sucursal_id"],
                "TEST-CUADRO-ETIQUETA",
            ),
        )
        bicicleta_id = cur.fetchone()["id"]
    db_conn.commit()

    response = client.get(
        f"/documentos/etiquetas/bicicletas/{bicicleta_id}/deposito"
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_comprobante_x_venta_inexistente_devuelve_404(client):
    response = client.get("/documentos/ventas/999999/comprobante-x")

    assert response.status_code == 404


def test_documento_permite_token_por_query(client, db_conn, seed_venta_basica, monkeypatch):
    from app.core.auth import crear_token_usuario
    from app.core.config import settings

    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    token = crear_token_usuario(
        {
            "id": seed_venta_basica["usuario_id"],
            "username": "admin_test",
            "rol": "administrador",
        }
    )

    monkeypatch.setattr(settings, "auth_disabled", False)
    sin_token = client.get(f"/documentos/ventas/{venta_id}/comprobante-x")
    assert sin_token.status_code == 401

    con_token = client.get(
        f"/documentos/ventas/{venta_id}/comprobante-x?access_token={token}"
    )
    assert con_token.status_code == 200
    assert con_token.headers["content-type"] == "application/pdf"
    assert con_token.content.startswith(b"%PDF")
