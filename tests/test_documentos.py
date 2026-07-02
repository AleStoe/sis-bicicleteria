from decimal import Decimal
from io import BytesIO
import re

from PIL import Image
from app.modules.documentos.pdf import _detalle_pago_financiero
from app.modules.documentos.pdf import generar_comprobante_x_pdf
from app.modules.documentos.pdf_etiquetas import _build_opciones_pago
from app.modules.documentos.download_names import (
    catalog_name,
    compact_date,
    dated_document_name,
    item_download_code,
)
from app.modules.documentos.pdf_taller_presupuesto import (
    generar_presupuesto_taller_pdf,
)
from app.modules.documentos.pdf_layout import (
    collapse_repeated_words,
    strip_leading_label,
    wrap_text,
)
from app.modules.documentos.repository import (
    get_pagos_comprobante_by_venta_id,
    get_venta_items_comprobante_by_venta_id,
)
from app.modules.documentos.repository_taller_presupuesto import (
    get_notas_visibles_presupuesto_taller,
)


def _pdf_page_count(pdf_bytes):
    return len(re.findall(rb"/Type\s*/Page(?!s)", pdf_bytes))


def test_nombres_descarga_son_identificables_y_consistentes():
    assert dated_document_name("REC", 52) == f"REC-000052-{compact_date()}.pdf"
    assert dated_document_name("PRE-OT", 8) == f"PRE-OT-000008-{compact_date()}.pdf"
    assert dated_document_name("COT", "COT-000015") == (
        f"COT-000015-{compact_date()}.pdf"
    )
    assert catalog_name("Bicicletas").startswith("Catalogo-Bicicletas-")
    assert item_download_code(
        {"item": {"sku": "VAR-000005"}},
        "VAR000001",
    ) == "VAR-000005"


def test_catalogo_mayorista_reutiliza_opciones_del_motor_financiero(monkeypatch):
    from app.modules.catalogo import service as catalogo_service

    class FakeConnection:
        def close(self):
            return None

    opciones = {
        "contado": [{"medio_pago": "efectivo", "porcentaje_descuento": 10}],
        "tarjeta": [{"label": "Tarjeta 3 cuotas", "cuotas": 3}],
    }
    captured = {}

    monkeypatch.setattr(catalogo_service, "get_connection", FakeConnection)
    monkeypatch.setattr(
        catalogo_service,
        "get_catalogo_mayorista_pdf_items",
        lambda *_args, **_kwargs: [{"id_variante": 1}],
    )
    monkeypatch.setattr(
        catalogo_service,
        "_opciones_pago_catalogo_bicicletas",
        lambda _conn: opciones,
    )

    def fake_pdf(data):
        captured.update(data)
        return b"%PDF-test"

    monkeypatch.setattr(
        catalogo_service,
        "generar_catalogo_mayorista_pdf",
        fake_pdf,
    )

    result = catalogo_service.generar_catalogo_mayorista_pdf_service(1)

    assert result == b"%PDF-test"
    assert captured["opciones_pago"] == opciones
    assert captured["items"] == [{"id_variante": 1}]


def test_pdf_layout_limpia_prefijos_repetidos():
    assert collapse_repeated_words("Producto Producto CADENA CADENA 9V") == (
        "Producto CADENA 9V"
    )
    assert strip_leading_label(
        "Bicicleta BICICLETA MTB TOTEM W790",
        "bicicleta",
    ) == "MTB TOTEM W790"
    wrapped = wrap_text(
        "DESCRIPCION MUY LARGA CON CODIGO-FINAL-445566",
        70,
        "Helvetica",
        9,
    )
    assert "CODIGO-FINAL-445566" in "".join(wrapped)


def test_presupuesto_taller_envuelve_texto_y_respeta_saltos_de_pagina(clean_db):
    descripcion_larga = (
        "REPUESTO REPUESTO CAMBIO TRASERO SHIMANO TOURNEY PARA BICICLETA "
        "RODADO 29 CON PATA LARGA Y COMPATIBILIDAD EXTENDIDA "
        "REFERENCIA-COMPLETA-FINAL-987654321"
    )
    items = [
        {
            "cantidad": 1,
            "precio_unitario": "25000",
            "subtotal": "25000",
            "descripcion_snapshot": f"{descripcion_larga} ITEM {index}",
            "imagen_principal": None,
            "valor_cobertura_unitario": "0",
        }
        for index in range(18)
    ]
    pdf = generar_presupuesto_taller_pdf(
        {
            "orden": {
                "id": 901,
                "estado": "presupuestada",
                "cliente_nombre": "CLIENTE DE PRUEBA CON NOMBRE EXTENSO",
                "cliente_telefono": "2914000000",
                "cliente_dni": "30111222",
                "usuario_creador_nombre": "TECNICO PRUEBA",
                "bicicleta_marca": "BICICLETA",
                "bicicleta_modelo": (
                    "BICICLETA MTB TOTEM W790 R29 ALUMINIO 21V SHIMANO TOURNEY"
                ),
                "bicicleta_rodado": "29",
                "bicicleta_color": "NEGRO TURQUESA",
                "bicicleta_numero_cuadro": "JY22003355",
                "problema_reportado": (
                    "EL CLIENTE REPORTA RUIDOS INTERMITENTES EN TRANSMISION "
                    "BAJO CARGA Y SOLICITA REVISION COMPLETA SIN OMITIR DETALLES"
                ),
                "observaciones": (
                    "Texto de observacion largo para verificar que el bloque inferior "
                    "se desplace y no se superponga con el detalle presupuestado."
                ),
            },
            "items": items,
            "notas": [
                {
                    "tipo": "recomendacion_futura",
                    "contenido": (
                        "Revisar cadena, cassette y platos nuevamente dentro de treinta dias."
                    ),
                }
            ],
        }
    )

    assert _pdf_page_count(pdf) >= 2
    assert pdf.startswith(b"%PDF")
    assert strip_leading_label(
        "BICICLETA BICICLETA MTB TOTEM W790 R29 ALUMINIO 21V SHIMANO TOURNEY",
        "bicicleta",
    ).startswith("MTB TOTEM")
    assert "REFERENCIA-COMPLETA-FINAL-987654321" in "".join(
        wrap_text(descripcion_larga, 260, "Helvetica", 8)
    )


def test_comprobante_x_no_trunca_items_largos_y_mueve_totales():
    descripcion_larga = (
        "PRODUCTO PRODUCTO CAJA PEDALERA EJE CUADRANTE SHIMANO ALTUS "
        "CON DESCRIPCION TECNICA COMPLETA Y CODIGO-FINAL-COMPROBANTE-445566"
    )
    items = [
        {
            "descripcion_snapshot": f"{descripcion_larga} ITEM {index}",
            "cantidad": "1",
            "precio_lista": "22222",
            "precio_final": "22222",
            "subtotal": "22222",
            "bonificado": False,
            "imagen_principal": None,
        }
        for index in range(20)
    ]
    pdf = generar_comprobante_x_pdf(
        {
            "venta": {
                "id": 902,
                "fecha": "2026-06-30T10:00:00",
                "cliente_nombre": "CLIENTE PRUEBA",
                "sucursal_nombre": "LOCAL PRINCIPAL",
                "subtotal_base": "444440",
                "descuento_total": "0",
                "recargo_total": "0",
                "total_final": "444440",
                "saldo_pendiente": "0",
                "observaciones": (
                    "Observacion completa que debe conservarse hasta la palabra "
                    "FINAL-OBSERVACION-778899 sin quedar cortada."
                ),
            },
            "items": items,
            "pagos": [],
        }
    )

    assert _pdf_page_count(pdf) >= 2
    assert pdf.startswith(b"%PDF")
    cleaned = collapse_repeated_words(descripcion_larga)
    assert "PRODUCTO PRODUCTO" not in cleaned
    assert "CODIGO-FINAL-COMPROBANTE-445566" in "".join(
        wrap_text(cleaned, 250, "Helvetica-Bold", 8)
    )


def test_servicio_sin_imagen_usa_placeholder_visual_en_documentos(
    clean_db,
    monkeypatch,
):
    from app.modules.documentos import pdf as comprobante_pdf
    from app.modules.documentos import pdf_taller_presupuesto as presupuesto_pdf

    placeholders = []

    def registrar_placeholder(*_args, **_kwargs):
        placeholders.append(True)

    monkeypatch.setattr(
        comprobante_pdf,
        "_draw_service_placeholder",
        registrar_placeholder,
    )
    monkeypatch.setattr(
        presupuesto_pdf,
        "_draw_service_placeholder",
        registrar_placeholder,
    )

    servicio = {
        "tipo_item": "servicio",
        "id_servicio_taller": 15,
        "descripcion_snapshot": "SERVICE COMPLETO DE TRANSMISION",
        "cantidad": "1",
        "precio_unitario": "18000",
        "precio_lista": "18000",
        "precio_final": "18000",
        "subtotal": "18000",
        "bonificado": False,
        "imagen_principal": None,
        "valor_cobertura_unitario": "0",
    }
    servicio_legacy_catalogo = {
        **servicio,
        "tipo_item": "producto",
        "id_servicio_taller": None,
        "producto_tipo_item": "servicio",
        "descripcion_snapshot": "ARMADO GENERAL",
    }

    presupuesto = generar_presupuesto_taller_pdf(
        {
            "orden": {
                "id": 903,
                "estado": "presupuestada",
                "cliente_nombre": "CLIENTE PRUEBA",
                "bicicleta_marca": "TOTEM",
                "bicicleta_modelo": "W790",
                "problema_reportado": "REALIZAR SERVICE COMPLETO",
            },
            "items": [servicio],
            "notas": [],
        }
    )
    comprobante = generar_comprobante_x_pdf(
        {
            "venta": {
                "id": 904,
                "fecha": "2026-07-01T10:00:00",
                "cliente_nombre": "CLIENTE PRUEBA",
                "sucursal_nombre": "LOCAL PRINCIPAL",
                "subtotal_base": "18000",
                "descuento_total": "0",
                "recargo_total": "0",
                "total_final": "18000",
                "saldo_pendiente": "0",
            },
            "items": [servicio, servicio_legacy_catalogo],
            "pagos": [],
        }
    )

    assert presupuesto.startswith(b"%PDF")
    assert comprobante.startswith(b"%PDF")
    assert len(placeholders) == 3


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
    assert (
        f'filename="FAC-{str(venta_id).zfill(6)}-{compact_date()}.pdf"'
        in response.headers["content-disposition"]
    )
    assert response.content.startswith(b"%PDF")


def test_presupuesto_taller_devuelve_pdf(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
):
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

    interna = client.post(
        f"/ordenes_taller/{orden_id}/notas",
        json={
            "tipo": "interna",
            "contenido": "Diagnóstico reservado del equipo",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    cliente = client.post(
        f"/ordenes_taller/{orden_id}/notas",
        json={
            "tipo": "cliente",
            "contenido": "Lubricar la cadena cada quince días",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert interna.status_code == 201, interna.text
    assert cliente.status_code == 201, cliente.text

    notas_pdf = get_notas_visibles_presupuesto_taller(db_conn, orden_id)
    assert [nota["contenido"] for nota in notas_pdf] == [
        "Lubricar la cadena cada quince días"
    ]

    response = client.get(f"/documentos/taller/{orden_id}/presupuesto")

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert (
        f'filename="PRE-OT-{str(orden_id).zfill(6)}-{compact_date()}.pdf"'
        in response.headers["content-disposition"]
    )
    assert response.content.startswith(b"%PDF")


def test_resumen_cobros_venta_devuelve_pdf(client, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200

    venta_id = crear.json()["venta_id"]

    response = client.get(f"/documentos/ventas/{venta_id}/resumen-cobros")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert (
        f'filename="COB-{str(venta_id).zfill(6)}-{compact_date()}.pdf"'
        in response.headers["content-disposition"]
    )
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
    assert (
        f'filename="REC-{str(pago_id).zfill(6)}-{compact_date()}.pdf"'
        in response.headers["content-disposition"]
    )
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
    assert response.headers["cache-control"] == "no-store, no-cache, must-revalidate"
    assert response.content.startswith(b"%PDF")


def test_historia_precio_variante_devuelve_png_9_16(client, seed_venta_basica):
    variante_id = seed_venta_basica["variante_id"]

    response = client.get(
        f"/documentos/etiquetas/variantes/{variante_id}/historia"
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "image/png"
    assert "attachment;" in response.headers["content-disposition"]
    assert 'filename="Etiqueta-' in response.headers["content-disposition"]
    assert response.content.startswith(b"\x89PNG")

    with Image.open(BytesIO(response.content)) as image:
        assert image.size == (1080, 1920)


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

    historia = client.get(
        f"/documentos/etiquetas/bicicletas/{bicicleta_id}/historia"
    )
    assert historia.status_code == 200, historia.text
    assert historia.headers["content-type"] == "image/png"
    with Image.open(BytesIO(historia.content)) as image:
        assert image.size == (1080, 1920)


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
