from decimal import Decimal

from app.modules.documentos.pdf import _detalle_pago_financiero
from app.modules.documentos.repository import get_pagos_comprobante_by_venta_id


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
    assert "Base aplicada:" in detalle
    assert "Descuento:" in detalle
    assert "Cobrado real:" in detalle

    response = client.get(f"/documentos/ventas/{venta_id}/comprobante-x")

    assert response.status_code == 200
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
