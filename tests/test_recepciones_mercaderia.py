import io
from decimal import Decimal, ROUND_CEILING
from pathlib import Path

from openpyxl import Workbook
from PIL import Image

from app.modules.recepciones_mercaderia import document_parser
from app.modules.recepciones_mercaderia import service as recepciones_service
from app.modules.recepciones_mercaderia.document_parser import DocumentExtraction


def _crear_proveedor(db_conn, nombre="Proveedor Recepcion Test"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO proveedores (nombre, activo) VALUES (%s, TRUE) RETURNING id",
            (nombre,),
        )
        proveedor_id = cur.fetchone()["id"]
    db_conn.commit()
    return proveedor_id


def _xlsx_bytes(rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Factura"
    for row in rows:
        sheet.append(row)
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def _image_bytes():
    image = Image.new("RGB", (400, 200), "white")
    output = io.BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def test_factura_pg_bike_separa_cantidad_unitario_y_total():
    texto = """
CODIGO DESCRIPCION CANT. P. UNITARIO TOTAL
416001103 CARAM.VENZO MOLECULE 500cc NG+RJ SIN PORTA 4,00 3.393,50 13.574,00
416001104 CARAM.VENZO MOLECULE 500cc NG+NAR SIN PORTA 4,00 3.393,50 13.574,00
416001005 CARAMAÑ. NIÑO OFERTA SIN PORTA 10,00 688,55 6.885,50
Descuentos: 17,350+7,01+6,03 Flete: 3,10%
Imp. Flete Subtotal Bonific. Neto IVA 21% Total
44.191,85 1.469.735, -408.265,9 1.061.469, 222.908,57 1.284.377,95
"""

    filas = document_parser._filas_desde_texto(texto)
    metadata = document_parser._metadata_pdf(texto)

    assert len(filas) == 3
    assert filas[0]["codigo"] == "416001103"
    assert filas[0]["cantidad"] == "4,00"
    assert Decimal(str(filas[0]["costo_unitario"]).replace(".", "").replace(",", ".")) == Decimal("3393.50")
    assert filas[2]["cantidad"] == "10,00"
    assert Decimal(str(filas[2]["costo_unitario"]).replace(".", "").replace(",", ".")) == Decimal("688.55")
    assert metadata["descuentos_sucesivos_pct"] == ["17.350", "7.01", "6.03"]
    assert metadata["flete"] == "44191.85"
    assert metadata["total_documental"] == "1284377.95"


def test_factura_pg_bike_detecta_bonificacion_con_importes_completos():
    texto = """
CODIGO DESCRIPCION CANT. P. UNITARIO TOTAL
416001103 CARAM.VENZO MOLECULE 500cc NG+RJ SIN PORTA 4,00 3.393,50 13.574,00
416001104 CARAM.VENZO MOLECULE 500cc NG+NAR SIN PORTA 4,00 3.393,50 13.574,00
Descuentos: 17,350+7,01+6,03    Flete: 3,10%
Imp. Flete        Subtotal        Bonific.            Neto           IVA 21%              Total
13.146,43       437.224,75      -121.453,1         315.771,60      66.312,04              382.083,64
"""

    metadata = document_parser._metadata_pdf(texto)

    assert metadata["descuentos_sucesivos_pct"] == ["17.350", "7.01", "6.03"]
    assert metadata["flete"] == "13146.43"
    assert metadata["subtotal_antes_bonificacion"] == "437224.75"
    assert metadata["bonificacion"] == "121453.15"
    assert metadata["neto"] == "315771.60"
    assert metadata["iva_21"] == "66312.04"
    assert metadata["total_documental"] == "382083.64"


def test_factura_bici_peretti_extrae_renglones_partidos_y_totales():
    texto = """
BICI PERETTI S.A.
CODIGO CANT. DESCRIPCION PRECIO PRECIO BONIF. TOTAL
 LUZ SLP TRASERA 2 LED SOLAR RECARGABLE2,00 9.012,084.743,20 ARS4.506,04 0015419
 CADENA 8V INDEX SLP 1/2X3/32X114 PLATA
 OSCURO/MARRÓN40,00 74.185,502.055,00 ARS1.854,64 0017999
 FORMA MTB SLP ALUM PALOMITA 31.8 720 MM
 GEN72,00 12.432,406.543,37 ARS6.216,20 0014140
95.629,98
Percepción de IIBB
SUB TOTAL:DESCUENTO:SUB TOTAL: I.V.A INSC. 21%:I.V.A NO INSC. 10,5%:TOTAL:
Observaciones:
0,0095.629,98 95.629,98 20.082,30 0,00 115.712,28
Tipo de cambio: 0
"""

    filas = document_parser._filas_desde_texto(texto)
    metadata = document_parser._metadata_pdf(texto)
    items = recepciones_service._items_desde_filas_extraidas(filas)

    assert len(filas) == 3
    assert filas[0]["codigo"] == "0015419"
    assert filas[0]["cantidad"] == "2,00"
    assert filas[0]["costo_unitario"] == "4.506,04"
    assert filas[1]["descripcion"] == "CADENA 8V INDEX SLP 1/2X3/32X114 PLATA OSCURO/MARRÓN"
    assert filas[1]["cantidad"] == "40,00"
    assert filas[2]["descripcion"] == "FORMA MTB SLP ALUM PALOMITA 31.8 720 MM GEN7"
    assert filas[2]["cantidad"] == "2,00"
    assert items[1]["costo_total"] == Decimal("74185.50")
    assert items[1]["total_linea_documental"] == Decimal("74185.50")
    assert metadata["iva_21"] == "20082.30"
    assert metadata["total_documental"] == "115712.28"


def test_sugerir_alta_reconoce_portapaquete_abreviado():
    item = {"descripcion_original": "PORTAPQTE. ALUMINIO REGUL. NEGRO CB-CR01"}
    referencia = {
        "rubros": ["ACCESORIOS"],
        "categorias": [{"id": 3, "nombre": "ACCESORIOS"}],
        "marcas": [],
    }

    recepciones_service._sugerir_alta(item, referencia)

    assert item["rubro_propuesto"] == "ACCESORIOS"
    assert item["id_categoria_propuesta"] == 3
    assert item["subtipo_propuesto"] == "PORTAPAQUETE"


def test_sugerir_alta_clasifica_abreviaturas_frecuentes_de_factura():
    referencia = {
        "rubros": ["ACCESORIOS", "REPUESTOS"],
        "categorias": [
            {"id": 11, "nombre": "LLANTAS"},
            {"id": 17, "nombre": "ASIENTOS Y PORTASILLAS"},
            {"id": 29, "nombre": "CARAMAÑOLA Y PORTACARAMAÑOLA"},
        ],
        "marcas": [{"id": 7, "nombre": "VENZO"}],
    }
    casos = [
        ("PORTACAR. PROFILE ROSA BC31", "ACCESORIOS", 29, "CARAMAÑOLA / PORTA"),
        ("LLANTA R-26 MTB VENZO 32", "REPUESTOS", 11, "LLANTA"),
        ("COLLAR+TORN. 31.8 MX", "REPUESTOS", 17, "ABRAZADERA DE ASIENTO"),
    ]

    for descripcion, rubro, categoria_id, subtipo in casos:
        item = {"descripcion_original": descripcion}
        recepciones_service._sugerir_alta(item, referencia)
        assert item["rubro_propuesto"] == rubro
        assert item["id_categoria_propuesta"] == categoria_id
        assert item["subtipo_propuesto"] == subtipo
        assert item.get("id_marca_propuesta") is None


def test_sugerir_alta_no_completa_marca_aunque_aparezca_en_el_nombre():
    item = {"descripcion_original": "CARAM.VENZO MOLECULE 500CC"}
    referencia = {
        "rubros": ["ACCESORIOS"],
        "categorias": [{"id": 29, "nombre": "CARAMAÑOLA Y PORTACARAMAÑOLA"}],
        "marcas": [{"id": 7, "nombre": "VENZO"}],
    }

    recepciones_service._sugerir_alta(item, referencia)

    assert item["rubro_propuesto"] == "ACCESORIOS"
    assert item["id_categoria_propuesta"] == 29
    assert item["subtipo_propuesto"] == "CARAMAÑOLA / PORTA"
    assert item.get("id_marca_propuesta") is None


def test_memoria_de_clasificacion_no_completa_marca():
    item = {
        "descripcion_original": "CARAMAÑOLA VENZO MOLECULE 500CC",
        "descripcion_normalizada": "CARAMAÑOLA VENZO MOLECULE 500CC",
        "id_marca_propuesta": None,
    }
    memorias = [{
        "id": 1,
        "descripcion_normalizada": "CARAMAÑOLA VENZO MOLECULE 500CC",
        "rubro": "ACCESORIOS",
        "id_categoria": 29,
        "id_marca": 7,
        "subtipo": "CARAMAÑOLA / PORTA",
        "confirmaciones": 4,
    }]

    recepciones_service._aplicar_memoria_y_duplicados(item, memorias, [])

    assert item["rubro_propuesto"] == "ACCESORIOS"
    assert item["id_categoria_propuesta"] == 29
    assert item["subtipo_propuesto"] == "CARAMAÑOLA / PORTA"
    assert item["id_marca_propuesta"] is None


def test_ocr_convierte_texto_reconocido_en_filas_revisables(monkeypatch):
    monkeypatch.setattr(
        document_parser,
        "_ejecutar_ocr_imagen",
        lambda _image: (
            "OCR-001 CUBIERTA PRUEBA 2 12.500,50",
            {"confianza_promedio": 0.91, "confianza_minima": 0.87, "ocr_fragmentos": []},
        ),
    )

    result = document_parser.extraer_documento("factura.jpg", _image_bytes())

    assert result.estado == "extraido"
    assert result.extractor == "rapidocr_onnx"
    assert result.metadata["confianza_promedio"] == 0.91
    assert result.filas == [
        {
            "numero_linea": 1,
            "codigo": "OCR-001",
            "descripcion": "CUBIERTA PRUEBA",
            "cantidad": "2",
            "costo_unitario": "12.500,50",
            "descuento_linea_pct": Decimal("0"),
            "confianza_campos": {
                "codigo": 0.91,
                "descripcion": 0.91,
                "cantidad": 0.91,
                "costo": 0.91,
            },
        }
    ]


def test_identifica_factura_pedido_y_nota_credito():
    factura = document_parser._identificar_documento(
        "FA-A-00004-00126057.pdf", "FACTURA A", ".pdf"
    )
    pedido = document_parser._identificar_documento(
        "PED 758300.pdf", "PEDIDO 758300", ".pdf"
    )
    nota = document_parser._identificar_documento(
        "NC-0001-00000042.pdf", "NOTA DE CREDITO", ".pdf"
    )

    assert factura == {"tipo_documento": "factura", "numero_documento": "A-00004-00126057"}
    assert pedido == {"tipo_documento": "pedido", "numero_documento": "758300"}
    assert nota == {"tipo_documento": "nota_credito", "numero_documento": "0001-00000042"}


def test_importar_excel_crea_borrador_y_conserva_descuento(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Excel")
    archivo = _xlsx_bytes(
        [
            ["Código", "Producto", "Cantidad", "Costo final por unidad", "Descuento"],
            ["XLS-001", "CUBIERTA TEST 29", 2, 12500.50, 8],
        ]
    )

    response = client.post(
        "/recepciones-mercaderia/importar-documento",
        data={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "observaciones": "Lista Excel test",
        },
        files={
            "archivo": (
                "lista-proveedor.xlsx",
                archivo,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_lineas"] == 1
    assert Decimal(str(data["total_unidades"])) == Decimal("2.000")
    assert Decimal(str(data["items"][0]["costo_unitario"])) == Decimal("12500.50")
    assert Decimal(str(data["items"][0]["descuento_linea_pct"])) == Decimal("8.0000")
    assert data["documentos"][0]["estado"] == "extraido"
    assert data["documentos"][0]["extractor"] == "openpyxl"
    assert data["documentos"][0]["metadata_extraida"]["filas_detectadas"] == 1


def test_importar_imagen_queda_pendiente_ocr_y_bloquea_duplicado(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Imagen")
    contenido = _image_bytes()
    data = {
        "id_proveedor": proveedor_id,
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
    }
    files = {"archivo": ("factura.jpg", contenido, "image/jpeg")}

    response = client.post(
        "/recepciones-mercaderia/importar-documento",
        data=data,
        files=files,
    )
    assert response.status_code == 200, response.text
    recepcion = response.json()
    assert recepcion["estado"] == "requiere_revision"
    assert recepcion["total_lineas"] == 0
    assert recepcion["documentos"][0]["estado"] == "requiere_revision"
    assert recepcion["documentos"][0]["extractor"] == "rapidocr_onnx"

    duplicada = client.post(
        "/recepciones-mercaderia/importar-documento",
        data=data,
        files=files,
    )
    assert duplicada.status_code == 409
    assert f"#{recepcion['id']}" in duplicada.json()["detail"]


def test_adjuntar_nota_credito_no_duplica_items(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Documentos Relacionados")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "DOC-001\tPRODUCTO DOCUMENTADO\t2\t$1.000,00",
        },
    ).json()

    response = client.post(
        "/recepciones-mercaderia/importar-documento",
        data={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "recepcion_id": creada["id"],
        },
        files={
            "archivo": (
                "NC-0001-00000042.txt",
                b"NOTA DE CREDITO NC-0001-00000042\nTOTAL $ 500,00",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == creada["id"]
    assert data["total_lineas"] == 1
    assert len(data["items"]) == 1
    assert len(data["documentos"]) == 1
    assert data["documentos"][0]["tipo_documento"] == "nota_credito"
    assert data["documentos"][0]["numero_documento"] == "0001-00000042"


def test_reprocesar_documento_completa_recepcion_vacia(
    client,
    db_conn,
    seed_venta_basica,
    monkeypatch,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Reproceso")
    creada = client.post(
        "/recepciones-mercaderia/importar-documento",
        data={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
        files={"archivo": ("reprocesar.jpg", _image_bytes(), "image/jpeg")},
    ).json()
    assert creada["total_lineas"] == 0

    monkeypatch.setattr(
        "app.modules.recepciones_mercaderia.service.extraer_documento",
        lambda _nombre, _contenido: DocumentExtraction(
            estado="extraido",
            extractor="rapidocr_onnx",
            filas=[
                {
                    "numero_linea": 1,
                    "codigo": "REPRO-01",
                    "descripcion": "PRODUCTO REPROCESADO",
                    "cantidad": "3",
                    "costo_unitario": "1500,00",
                    "descuento_linea_pct": Decimal("0"),
                }
            ],
            metadata={"tipo_documento": "imagen", "numero_documento": None},
        ),
    )
    response = client.post(
        f"/recepciones-mercaderia/documentos/{creada['documentos'][0]['id']}/reprocesar"
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == creada["id"]
    assert data["total_lineas"] == 1
    assert Decimal(str(data["total_unidades"])) == Decimal("3.000")
    assert data["documentos"][0]["cantidad_reprocesos"] == 1


def test_reprocesar_documento_reemplaza_lineas_solo_si_se_confirma(
    client,
    db_conn,
    seed_venta_basica,
    monkeypatch,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Reemplazo")
    extraccion = {
        "actual": DocumentExtraction(
            estado="extraido",
            extractor="pypdf",
            filas=[
                {
                    "numero_linea": 1,
                    "codigo": "MAL-01",
                    "descripcion": "LECTURA ANTERIOR",
                    "cantidad": "688,55",
                    "costo_unitario": "6885,50",
                }
            ],
            metadata={"tipo_documento": "factura"},
        )
    }
    monkeypatch.setattr(
        "app.modules.recepciones_mercaderia.service.extraer_documento",
        lambda _nombre, _contenido: extraccion["actual"],
    )
    creada = client.post(
        "/recepciones-mercaderia/importar-documento",
        data={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
        files={"archivo": ("factura.pdf", b"%PDF-1.4 prueba", "application/pdf")},
    ).json()
    assert creada["total_lineas"] == 1

    extraccion["actual"] = DocumentExtraction(
        estado="extraido",
        extractor="pypdf",
        filas=[
            {"numero_linea": 1, "codigo": "BIEN-01", "descripcion": "PRODUCTO UNO", "cantidad": "4", "costo_unitario": "3393,50"},
            {"numero_linea": 2, "codigo": "BIEN-02", "descripcion": "PRODUCTO DOS", "cantidad": "10", "costo_unitario": "688,55"},
        ],
        metadata={"tipo_documento": "factura"},
    )
    response = client.post(
        f"/recepciones-mercaderia/documentos/{creada['documentos'][0]['id']}/reprocesar?reemplazar_lineas=true"
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_lineas"] == 2
    assert [item["codigo_proveedor"] for item in data["items"]] == ["BIEN-01", "BIEN-02"]
    assert Decimal(str(data["total_unidades"])) == Decimal("14.000")


def test_corregir_y_agregar_lineas_recalcula_e_invalida_costos(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Correccion Lectura")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "LECT-01\tPRODUCTO MAL LEIDO\t1\t$100,00",
        },
    ).json()
    client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"total_documental": "100", "id_usuario": seed_venta_basica["usuario_id"]},
    )

    corregida = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/items/{creada['items'][0]['id']}/lectura",
        json={
            "codigo_proveedor": "LECT-01-CORR",
            "descripcion": "PRODUCTO CORREGIDO",
            "cantidad": "2",
            "costo_unitario": "150",
            "descuento_linea_pct": "5",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert corregida.status_code == 200, corregida.text
    data = corregida.json()
    assert data["costos"] is None
    assert Decimal(str(data["total_unidades"])) == Decimal("2.000")
    assert Decimal(str(data["total_costo"])) == Decimal("300.00")
    assert data["items"][0]["origen_extraccion"] == "manual"
    assert data["items"][0]["lectura_confirmada"] is True
    assert Decimal(str(data["items"][0]["confianza_codigo"])) == Decimal("1.0000")

    agregada = client.post(
        f"/recepciones-mercaderia/{creada['id']}/items/lectura",
        json={
            "codigo_proveedor": "LECT-02",
            "descripcion": "PRODUCTO OMITIDO",
            "cantidad": "3",
            "costo_unitario": "200",
            "descuento_linea_pct": "0",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert agregada.status_code == 200, agregada.text
    final = agregada.json()
    assert final["total_lineas"] == 2
    assert Decimal(str(final["total_unidades"])) == Decimal("5.000")
    assert Decimal(str(final["total_costo"])) == Decimal("900.00")


def test_importar_tabla_crea_borrador_y_clasifica_existente_nuevo(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn)
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO categorias (nombre, activo) VALUES ('CARAMAÑOLA Y PORTACARAMAÑOLA', TRUE)"
        )
        cur.execute(
            """
            UPDATE variantes
            SET codigo_proveedor = '483006243', proveedor_preferido_id = %s
            WHERE id = %s
            """,
            (proveedor_id, seed_venta_basica["variante_id"]),
        )
    db_conn.commit()

    response = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "observaciones": "Factura test",
            "texto": (
                "Código\tProducto\tCant.\tCosto final por unidad\n"
                "483006243\tRDA VZ R-29 DISC.6T\t2\t$84.286,14\n"
                "416001103\tCARAM.VENZO MOLECULE 500cc\t4\t$3.057,46"
            ),
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["estado"] == "requiere_revision"
    assert data["total_lineas"] == 2
    assert Decimal(str(data["total_unidades"])) == Decimal("6.000")
    assert Decimal(str(data["total_costo"])) == Decimal("180802.12")
    assert data["exactas"] == 1
    assert data["nuevas"] == 1
    assert data["conflictos"] == 0
    assert [item["estado_resolucion"] for item in data["items"]] == [
        "exacta",
        "nueva",
    ]
    assert data["items"][0]["id_variante"] == seed_venta_basica["variante_id"]
    assert data["items"][1]["nombre_propuesto"] == "CARAM.VENZO MOLECULE 500CC"
    assert data["items"][1]["rubro_propuesto"] == "ACCESORIOS"

    listado = client.get("/recepciones-mercaderia/")
    assert listado.status_code == 200, listado.text
    assert listado.json()[0]["id"] == data["id"]

    detalle = client.get(f"/recepciones-mercaderia/{data['id']}")
    assert detalle.status_code == 200, detalle.text
    assert detalle.json()["observaciones"] == "Factura test"


def test_importar_markdown_detecta_duplicados_e_incompletos(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Recepcion Markdown")
    response = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": """
| Código | Producto | Cant. | Costo final por unidad |
| --- | --- | --- | --- |
| 416001103 | CARAMAÑOLA UNO | 4 | $3.057,46 |
| 416001103 | CARAMAÑOLA REPETIDA | 2 | $3.057,46 |
fila imposible de interpretar
""",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_lineas"] == 3
    assert data["conflictos"] == 2
    assert data["incompletas"] == 1
    assert data["items"][0]["mensaje_revision"] == (
        "El codigo esta repetido dentro de esta recepcion."
    )
    assert data["items"][2]["estado_resolucion"] == "incompleta"


def test_importar_tabla_vacia_es_rechazada(client, db_conn, seed_venta_basica):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Recepcion Vacia")
    response = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "Código\tProducto\tCantidad\tCosto",
        },
    )

    assert response.status_code == 422
    assert "No encontre filas" in response.json()["detail"]


def test_preparar_alta_nueva_deja_recepcion_lista_para_confirmar(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Alta Preparada")
    with db_conn.cursor() as cur:
        cur.execute("SELECT id FROM categorias WHERE activo = TRUE ORDER BY id LIMIT 1")
        categoria_id = cur.fetchone()["id"]

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "NUEVO-01\tPRODUCTO NUEVO TEST\t3\t$1.500,00",
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion = creada.json()
    item_id = recepcion["items"][0]["id"]

    response = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/items/{item_id}/preparar-alta",
        json={
            "nombre_propuesto": "Producto nuevo preparado",
            "nombre_variante_propuesta": "Unica",
            "rubro_propuesto": "REPUESTOS",
            "id_categoria_propuesta": categoria_id,
            "subtipo_propuesto": "ADAPTADOR",
            "precio_minorista_propuesto": "3000",
            "precio_mayorista_propuesto": "2500",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["estado"] == "lista_para_confirmar"
    assert data["altas_preparadas"] == 1
    assert data["nuevas"] == 0
    assert data["items"][0]["estado_resolucion"] == "alta_preparada"
    assert data["items"][0]["nombre_propuesto"] == "PRODUCTO NUEVO PREPARADO"
    assert data["items"][0]["sku_propuesto"] == "AUTOMATICO"


def test_aceptar_vinculo_sugerido_convierte_linea_en_exacta(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_variante = _crear_proveedor(db_conn, "Proveedor Variante Existente")
    proveedor_recepcion = _crear_proveedor(db_conn, "Proveedor Vinculo Sugerido")
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE variantes SET codigo_proveedor = 'COD-SUG', proveedor_preferido_id = %s WHERE id = %s",
            (proveedor_variante, seed_venta_basica["variante_id"]),
        )
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_recepcion,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "COD-SUG\tPRODUCTO EXISTENTE\t1\t$1.000,00",
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion = creada.json()
    assert recepcion["items"][0]["estado_resolucion"] == "sugerida"
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recepcion_mercaderia_items
            SET posible_duplicado = TRUE,
                duplicado_candidatos = '[{"id_variante": 1, "producto": "CANDIDATO"}]'::jsonb
            WHERE id = %s
            """,
            (recepcion["items"][0]["id"],),
        )
    db_conn.commit()

    response = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/items/{recepcion['items'][0]['id']}/vincular",
        json={
            "id_variante": seed_venta_basica["variante_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["estado"] == "lista_para_confirmar"
    assert data["exactas"] == 1
    assert data["items"][0]["estado_resolucion"] == "exacta"
    assert data["items"][0]["posible_duplicado"] is False
    assert data["items"][0]["duplicado_candidatos"] == []

    reaprendida = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_recepcion,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "COD-SUG\tPRODUCTO EXISTENTE OTRA VEZ\t2\t$1.100,00",
        },
    )
    assert reaprendida.status_code == 200, reaprendida.text
    assert reaprendida.json()["items"][0]["estado_resolucion"] == "exacta"


def test_codigo_proveedor_reconoce_ceros_iniciales_sin_perder_codigo_original(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Ceros Iniciales")
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE variantes SET codigo_proveedor = '15427', proveedor_preferido_id = %s WHERE id = %s",
            (proveedor_id, seed_venta_basica["variante_id"]),
        )
    db_conn.commit()

    response = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "0015427\tCADENA 9V INDEX\t10\t$11.555,66",
        },
    )

    assert response.status_code == 200, response.text
    item = response.json()["items"][0]
    assert item["estado_resolucion"] == "exacta"
    assert item["id_variante"] == seed_venta_basica["variante_id"]
    assert item["codigo_proveedor"] == "0015427"


def test_coincidencia_automatica_se_puede_deshacer_y_queda_medida(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Deshacer Coincidencia")
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE variantes SET codigo_proveedor = 'AUTO-UNDO', proveedor_preferido_id = %s WHERE id = %s",
            (proveedor_id, seed_venta_basica["variante_id"]),
        )
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "AUTO-UNDO\tPRODUCTO COINCIDENCIA AUTOMATICA\t1\t$1.000,00",
        },
    )
    assert creada.status_code == 200, creada.text
    data = creada.json()
    assert data["items"][0]["origen_resolucion"] == "codigo_proveedor"
    assert data["aprendizaje"]["coincidencias_automaticas"] == 1

    deshecha = client.patch(
        f"/recepciones-mercaderia/{data['id']}/items/{data['items'][0]['id']}/deshacer-coincidencia",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert deshecha.status_code == 200, deshecha.text
    corregida = deshecha.json()
    assert corregida["items"][0]["estado_resolucion"] == "nueva"
    assert corregida["items"][0]["id_variante"] is None
    assert corregida["aprendizaje"]["coincidencias_rechazadas"] == 1
    assert corregida["aprendizaje"]["total_correcciones"] == 1


def test_alerta_costo_usa_costo_final_conciliado(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Alerta Costo")
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET codigo_proveedor = 'COSTO-ALERTA', proveedor_preferido_id = %s,
                costo_promedio_vigente = 100
            WHERE id = %s
            """,
            (proveedor_id, seed_venta_basica["variante_id"]),
        )
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "COSTO-ALERTA\tPRODUCTO CON COSTO NUEVO\t1\t$140,00",
        },
    ).json()
    calculada = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"total_documental": "140", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert calculada.status_code == 200, calculada.text
    data = calculada.json()
    assert Decimal(str(data["items"][0]["variacion_costo_pct"])) == Decimal("40.00")
    assert "variación extrema" in data["items"][0]["alerta_costo"]
    assert data["aprendizaje"]["alertas_costo"] == 1


def test_eliminar_linea_recalcula_totales_e_invalida_costos(
    client,
    seed_venta_basica,
    db_conn,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Eliminar Linea")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "DEL-1\tPRODUCTO UNO\t2\t$100,00\nDEL-2\tPRODUCTO DOS\t1\t$300,00",
        },
    ).json()
    calculada = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"total_documental": "500", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert calculada.status_code == 200, calculada.text
    assert calculada.json()["costos"] is not None

    eliminada = client.request(
        "DELETE",
        f"/recepciones-mercaderia/{creada['id']}/items/{creada['items'][0]['id']}",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert eliminada.status_code == 200, eliminada.text
    data = eliminada.json()
    assert data["total_lineas"] == 1
    assert Decimal(str(data["total_unidades"])) == Decimal("1.000")
    assert Decimal(str(data["total_costo"])) == Decimal("300.00")
    assert data["costos"] is None
    assert data["aprendizaje"]["total_correcciones"] == 1


def test_anular_recepcion_conserva_historial_y_bloquea_edicion(
    client,
    seed_venta_basica,
    db_conn,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Anulacion")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "ANU-1\tPRODUCTO A ANULAR\t1\t$100,00",
        },
    ).json()
    anulada = client.post(
        f"/recepciones-mercaderia/{creada['id']}/anular",
        json={"motivo": "Factura cargada dos veces", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert anulada.status_code == 200, anulada.text
    data = anulada.json()
    assert data["estado"] == "anulada"
    assert data["anulada_at"] is not None
    assert data["motivo_anulacion"] == "Factura cargada dos veces"

    bloqueada = client.request(
        "DELETE",
        f"/recepciones-mercaderia/{creada['id']}/items/{creada['items'][0]['id']}",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert bloqueada.status_code == 409


def test_clasificacion_masiva_actualiza_solo_lineas_seleccionadas(
    client,
    seed_venta_basica,
    db_conn,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Clasificacion Masiva")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "MAS-1\tPRODUCTO MASIVO UNO\t1\t$100,00\nMAS-2\tPRODUCTO MASIVO DOS\t1\t$120,00",
        },
    ).json()
    ids = [item["id"] for item in creada["items"]]
    response = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/items/clasificacion-masiva",
        json={
            "ids_items": ids,
            "rubro_propuesto": "REPUESTOS",
            "id_categoria_propuesta": seed_venta_basica["categoria_id"],
            "subtipo_propuesto": "ADAPTADOR",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert all(item["rubro_propuesto"] == "REPUESTOS" for item in data["items"])
    assert all(item["subtipo_propuesto"] == "ADAPTADOR" for item in data["items"])
    assert all(item["origen_resolucion"] == "manual" for item in data["items"])
    assert data["aprendizaje"]["total_correcciones"] == 2


def test_desvincular_documento_permite_volver_a_cargarlo(
    client,
    seed_venta_basica,
    db_conn,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Desvincular Documento")
    archivo = _xlsx_bytes(
        [["Código", "Producto", "Cantidad", "Costo"], ["DOC-DEL", "PRODUCTO DOCUMENTO", 1, 100]]
    )
    creada = client.post(
        "/recepciones-mercaderia/importar-documento",
        data={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
        files={"archivo": ("documento-eliminar.xlsx", archivo, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert creada.status_code == 200, creada.text
    data = creada.json()
    documento_id = data["documentos"][0]["id"]

    eliminada = client.request(
        "DELETE",
        f"/recepciones-mercaderia/{data['id']}/documentos/{documento_id}",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert eliminada.status_code == 200, eliminada.text
    assert eliminada.json()["documentos"] == []

    recargada = client.post(
        "/recepciones-mercaderia/importar-documento",
        data={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "recepcion_id": data["id"],
        },
        files={"archivo": ("documento-eliminar.xlsx", archivo, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert recargada.status_code == 200, recargada.text
    assert len(recargada.json()["documentos"]) == 1


def test_regla_sugerida_se_resuelve_una_sola_vez(
    client,
    seed_venta_basica,
    db_conn,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Regla Sugerida")
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recepcion_sugerencias_regla (
                id_proveedor, tipo, titulo, motivo, payload, ocurrencias
            ) VALUES (
                %s, 'clasificacion', 'CLASIFICAR ADAPTADORES', 'Patrón repetido',
                jsonb_build_object(
                    'descripcion_normalizada', 'ADAPTADOR DE ASIENTO REFORZADO',
                    'rubro', 'REPUESTOS',
                    'id_categoria', %s,
                    'subtipo', 'ADAPTADOR'
                ),
                3
            )
            RETURNING id
            """,
            (proveedor_id, seed_venta_basica["categoria_id"]),
        )
        sugerencia_id = cur.fetchone()["id"]
    db_conn.commit()

    response = client.patch(
        f"/recepciones-mercaderia/reglas-sugeridas/{sugerencia_id}",
        json={"decision": "aceptada", "nota": "Regla revisada", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "aceptada"
    assert response.json()["resuelta_at"] is not None

    sugerida = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "RULE-NEW\tADAPTADOR ASIENTO REFORZADO NEGRO\t1\t$500,00",
        },
    )
    assert sugerida.status_code == 200, sugerida.text
    item = sugerida.json()["items"][0]
    assert item["origen_resolucion"] == "descripcion_sugerida"
    assert item["rubro_propuesto"] == "REPUESTOS"
    assert item["subtipo_propuesto"] == "ADAPTADOR"

    repetida = client.patch(
        f"/recepciones-mercaderia/reglas-sugeridas/{sugerencia_id}",
        json={"decision": "descartada", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert repetida.status_code == 409


def test_motor_costos_prorratea_y_concilia_centavos(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Motor Costos")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": (
                "COSTO-1\tPRODUCTO COSTO UNO\t2\t$100,00\n"
                "COSTO-2\tPRODUCTO COSTO DOS\t1\t$200,00"
            ),
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion = creada.json()

    response = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/costos",
        json={
            "descuento_global_pct": "10",
            "bonificacion_factura": "4",
            "nota_credito": "20",
            "flete": "10",
            "iva_factura": "4",
            "otros_gastos": "5",
            "impuestos_no_recuperables": "3",
            "total_documental": "340",
            "descuentos_linea": [
                {"id_item": recepcion["items"][0]["id"], "descuento_pct": "10"},
                {"id_item": recepcion["items"][1]["id"], "descuento_pct": "0"},
            ],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert Decimal(str(data["costos"]["subtotal_bruto"])) == Decimal("400.00")
    assert Decimal(str(data["costos"]["descuento_lineas_total"])) == Decimal("20.00")
    assert Decimal(str(data["costos"]["descuento_global_monto"])) == Decimal("38.00")
    assert Decimal(str(data["costos"]["bonificacion_factura"])) == Decimal("4.00")
    assert Decimal(str(data["costos"]["iva_factura"])) == Decimal("4.00")
    assert Decimal(str(data["costos"]["total_calculado"])) == Decimal("340.00")
    assert Decimal(str(data["costos"]["diferencia_conciliacion"])) == Decimal("0.00")
    assert data["costos"]["conciliado"] is True
    assert Decimal(str(data["items"][0]["costo_total_calculado"])) == Decimal("161.06")
    assert Decimal(str(data["items"][1]["costo_total_calculado"])) == Decimal("178.94")
    assert sum(
        Decimal(str(item["prorrateo_bonificacion_factura"])) for item in data["items"]
    ) == Decimal("4.00")
    assert sum(
        Decimal(str(item["prorrateo_nota_credito"])) for item in data["items"]
    ) == Decimal("20.00")
    assert sum(
        Decimal(str(item["prorrateo_gastos"])) for item in data["items"]
    ) == Decimal("22.00")

    desajustada = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/costos",
        json={
            "descuento_global_pct": "10",
            "bonificacion_factura": "4",
            "nota_credito": "20",
            "flete": "10",
            "iva_factura": "4",
            "otros_gastos": "5",
            "impuestos_no_recuperables": "3",
            "total_documental": "339",
            "descuentos_linea": [
                {"id_item": recepcion["items"][0]["id"], "descuento_pct": "10"},
            ],
        },
    )
    assert desajustada.status_code == 200, desajustada.text
    assert desajustada.json()["costos"]["conciliado"] is False
    assert Decimal(str(desajustada.json()["costos"]["diferencia_conciliacion"])) == Decimal("-1.00")


def test_motor_costos_aplica_nota_credito_solo_a_productos_elegidos(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor NC dirigida")
    recepcion = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": (
                "NC-1\tPRODUCTO SIN AJUSTE\t2\t$100,00\n"
                "NC-2\tPRODUCTO CORREGIDO\t1\t$200,00"
            ),
        },
    ).json()
    primero, segundo = recepcion["items"]

    response = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/costos",
        json={
            "nota_credito": "30",
            "nota_credito_modo": "lineas",
            "total_documental": "370",
            "descuentos_linea": [
                {"id_item": primero["id"], "descuento_pct": "0", "nota_credito_monto": "0"},
                {"id_item": segundo["id"], "descuento_pct": "0", "nota_credito_monto": "30"},
            ],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["costos"]["nota_credito_modo"] == "lineas"
    assert data["costos"]["conciliado"] is True
    assert Decimal(str(data["items"][0]["prorrateo_nota_credito"])) == Decimal("0.00")
    assert Decimal(str(data["items"][1]["prorrateo_nota_credito"])) == Decimal("30.00")
    assert Decimal(str(data["items"][1]["nota_credito_linea_monto"])) == Decimal("30.00")

    incompleta = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/costos",
        json={
            "nota_credito": "30",
            "nota_credito_modo": "lineas",
            "total_documental": "370",
            "descuentos_linea": [
                {"id_item": segundo["id"], "nota_credito_monto": "20"},
            ],
        },
    )
    assert incompleta.status_code == 422
    assert "asignada por completo" in incompleta.json()["detail"]


def test_motor_costos_reproduce_costos_finales_factura_pg_bike(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "PG Bike Costos Finales")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": """
416001103\tCARAM.VENZO MOLECULE 500cc NG+RJ SIN PORTA\t4\t3393.50
416001104\tCARAM.VENZO MOLECULE 500cc NG+NAR SIN PORTA\t4\t3393.50
416001005\tCARAMAÑ. NIÑO OFERTA SIN PORTA\t10\t688.55
401034073\tCUB.MAXXIS 29x2.1 PACE C/ALAMBRE NEGRA\t1\t15950.00
483006243\tRDA VZ R-29 DISC.6T NG+ROJO S/CUB.S/CAM 36H C/MAZAS\t2\t93550.00
494049293\tSET TRAS. MT200 1550mm P/KITS MJAS+MANG+CALIPER HIDR\t3\t37719.39
401034085\tCUB.MAXXIS 29x2.25 ASPEN TUBELESS NEGRA EXO PROTECTI\t4\t46400.00
493006085\tPIÑON SHIMANO TZ500 7 COR. 14-28\t40\t13778.68
417001051\tSOPORTE DE COMPUT. NEGRA P/FORMA INTEG. ALUM. B1Team\t2\t11330.31
480008102\tGAFA VENZO BLANCO + ROSA VZ24-F27-001\t1\t63000.00
403001238\tPISTOLA DE ENGRASE BF06008.\t2\t17115.26
468010195\tVALV. TUBELESS T/FRANC VENZO x 2 UNID. 44mm BLISTER\t3\t16929.76
474001221\tPUÑOS MTB VZ. E05-010 NEGRO DIAM.32MM 130MM SILICONA\t2\t15793.55
474001222\tPUÑOS MTB VZ. E05-010 ROSA DIAM.32MM 130MM SILICONA\t2\t15793.55
494049294\tSET DELT. MT200 850mm P/KITS MJAS+MANG+CALIPER HIDR\t3\t34900.00
""",
        },
    ).json()

    response = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={
            "bonificacion_factura": "408265.96",
            "flete": "44191.85",
            "iva_factura": "222908.57",
            "total_documental": "1284377.95",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["costos"]["conciliado"] is True
    assert Decimal(str(data["costos"]["total_calculado"])) == Decimal("1284377.95")
    finales = {
        item["codigo_proveedor"]: Decimal(str(item["costo_unitario_calculado"]))
        for item in data["items"]
    }
    assert finales["416001103"] == Decimal("3057.46")
    assert finales["416001005"] == Decimal("620.37")
    assert finales["493006085"] == Decimal("12414.24")
    assert finales["494049294"] == Decimal("31444.00")


def test_motor_costos_rechaza_deducciones_mayores_al_total(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Costos Invalidos")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "COSTO-X\tPRODUCTO COSTO\t1\t$100,00",
        },
    ).json()

    response = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"descuento_global_pct": "50", "nota_credito": "60", "total_documental": "0"},
    )
    assert response.status_code == 422
    assert "superan el importe" in response.json()["detail"]


def test_diferencia_documental_bloquea_recepcion_resuelta(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Conciliacion Estado")
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE variantes SET codigo_proveedor = 'EXACTO-COSTO', proveedor_preferido_id = %s WHERE id = %s",
            (proveedor_id, seed_venta_basica["variante_id"]),
        )
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "EXACTO-COSTO\tPRODUCTO EXACTO\t1\t$100,00",
        },
    ).json()
    assert creada["estado"] == "lista_para_confirmar"

    con_diferencia = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"total_documental": "99", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert con_diferencia.status_code == 200, con_diferencia.text
    assert con_diferencia.json()["estado"] == "requiere_revision"

    conciliada = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"total_documental": "100", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert conciliada.status_code == 200, conciliada.text
    assert conciliada.json()["estado"] == "lista_para_confirmar"
    assert conciliada.json()["costos"]["conciliado"] is True


def test_confirmar_recepcion_crea_catalogo_ingresa_stock_y_es_idempotente(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Confirmacion")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "CONF-001\tPRODUCTO CONFIRMACION UNICO\t3\t$1.500,00",
        },
    ).json()
    item = creada["items"][0]

    imagen = client.post(
        f"/recepciones-mercaderia/{creada['id']}/items/{item['id']}/imagen",
        files={"archivo": ("producto-confirmacion.png", _image_bytes(), "image/png")},
    )
    assert imagen.status_code == 200, imagen.text
    assert imagen.json()["items"][0]["imagen_ruta_relativa"].startswith("catalogo/recepciones/")

    preparada = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/items/{item['id']}/preparar-alta",
        json={
            "nombre_propuesto": "Producto confirmacion unico",
            "nombre_variante_propuesta": "Unica",
            "rubro_propuesto": "REPUESTOS",
            "id_categoria_propuesta": seed_venta_basica["categoria_id"],
            "subtipo_propuesto": "ADAPTADOR",
            "precio_minorista_propuesto": "3000",
            "precio_mayorista_propuesto": "2500",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    ).json()
    conciliada = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"total_documental": "4500", "id_usuario": seed_venta_basica["usuario_id"]},
    ).json()
    assert preparada["altas_preparadas"] == 1
    assert conciliada["estado"] == "lista_para_confirmar"

    confirmada = client.post(
        f"/recepciones-mercaderia/{creada['id']}/confirmar",
        json={"confirmacion": "CONFIRMAR", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert confirmada.status_code == 200, confirmada.text
    data = confirmada.json()
    assert data["estado"] == "confirmada"
    assert data["confirmada_at"] is not None
    assert data["items"][0]["id_producto_confirmado"] is not None
    assert data["items"][0]["id_variante_confirmada"] is not None
    assert data["items"][0]["id_ingreso_stock"] is not None
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT confirmaciones, id_variante, rubro, subtipo
            FROM recepcion_clasificaciones_memoria
            WHERE id_proveedor = %s AND descripcion_normalizada = 'PRODUCTO CONFIRMACION UNICO'
            """,
            (proveedor_id,),
        )
        memoria = cur.fetchone()
    assert memoria is not None
    assert memoria["confirmaciones"] == 1
    assert memoria["id_variante"] == data["items"][0]["id_variante_confirmada"]
    assert memoria["rubro"] == "REPUESTOS"
    assert memoria["subtipo"] == "ADAPTADOR"

    variante_id = data["items"][0]["id_variante_confirmada"]
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT stock_fisico FROM stock_sucursal WHERE id_sucursal = %s AND id_variante = %s",
            (seed_venta_basica["sucursal_id"], variante_id),
        )
        assert Decimal(str(cur.fetchone()["stock_fisico"])) == Decimal("3")
        cur.execute(
            "SELECT precio_minorista, precio_mayorista, costo_promedio_vigente FROM variantes WHERE id = %s",
            (variante_id,),
        )
        variante = cur.fetchone()
        assert Decimal(str(variante["precio_minorista"])) == Decimal("3000")
        assert Decimal(str(variante["precio_mayorista"])) == Decimal("2500")
        assert Decimal(str(variante["costo_promedio_vigente"])) == Decimal("1500")
        cur.execute("SELECT COUNT(*) AS total FROM ingresos_stock WHERE id_variante = %s", (variante_id,))
        assert cur.fetchone()["total"] == 1
        cur.execute(
            "SELECT url, es_principal FROM catalogo_imagenes WHERE id_producto = %s AND activo = TRUE",
            (data["items"][0]["id_producto_confirmado"],),
        )
        imagen_catalogo = cur.fetchone()
        assert imagen_catalogo is not None
        assert imagen_catalogo["url"].startswith("/uploads/catalogo/recepciones/")
        assert imagen_catalogo["es_principal"] is True

    repetida = client.post(
        f"/recepciones-mercaderia/{creada['id']}/confirmar",
        json={"confirmacion": "CONFIRMAR", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert repetida.status_code == 200, repetida.text
    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM ingresos_stock WHERE id_variante = %s", (variante_id,))
        assert cur.fetchone()["total"] == 1
    ruta_imagen = Path(__file__).resolve().parents[1] / imagen_catalogo["url"].lstrip("/")
    ruta_imagen.unlink(missing_ok=True)


def test_confirmacion_revierte_todo_si_una_linea_falla(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Rollback Recepcion")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": (
                "ROLL-1\tPRODUCTO ROLLBACK PRIMERO\t1\t$100,00\n"
                "ROLL-2\tPRODUCTO ROLLBACK SEGUNDO\t1\t$200,00"
            ),
        },
    ).json()

    for indice, item in enumerate(creada["items"]):
        response = client.patch(
            f"/recepciones-mercaderia/{creada['id']}/items/{item['id']}/preparar-alta",
            json={
                "nombre_propuesto": item["descripcion_original"],
                "nombre_variante_propuesta": "UNICA",
                "rubro_propuesto": "REPUESTOS",
                "id_categoria_propuesta": seed_venta_basica["categoria_id"],
                "subtipo_propuesto": "ADAPTADOR",
                "precio_minorista_propuesto": "300" if indice == 0 else None,
                "precio_mayorista_propuesto": "250" if indice == 0 else None,
                "id_usuario": seed_venta_basica["usuario_id"],
            },
        )
        assert response.status_code == 200, response.text

    costos = client.patch(
        f"/recepciones-mercaderia/{creada['id']}/costos",
        json={"total_documental": "300", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert costos.status_code == 200, costos.text

    fallida = client.post(
        f"/recepciones-mercaderia/{creada['id']}/confirmar",
        json={"confirmacion": "CONFIRMAR", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert fallida.status_code == 409
    assert "precio minorista" in fallida.json()["detail"]

    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM productos WHERE nombre LIKE 'PRODUCTO ROLLBACK%'")
        assert cur.fetchone()["total"] == 0
        cur.execute("SELECT COUNT(*) AS total FROM ingresos_stock WHERE observacion LIKE %s", (f"Recepcion de mercaderia #{creada['id']}%",))
        assert cur.fetchone()["total"] == 0


def test_preview_precios_por_reglas_y_confirmacion_actualiza_variante(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Precios Recepcion")
    variante_id = seed_venta_basica["variante_id"]
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET codigo_proveedor = 'PRECIO-RX', proveedor_preferido_id = %s
            WHERE id = %s
            """,
            (proveedor_id, variante_id),
        )
        cur.execute(
            "SELECT precio_minorista, precio_mayorista, costo_promedio_vigente FROM variantes WHERE id = %s",
            (variante_id,),
        )
        anterior = cur.fetchone()
        cur.execute(
            "SELECT stock_fisico FROM stock_sucursal WHERE id_sucursal = %s AND id_variante = %s",
            (sucursal_id, variante_id),
        )
        stock_row = cur.fetchone()
        stock_anterior = Decimal(str(stock_row["stock_fisico"] if stock_row else 0))
        cur.execute(
            """
            INSERT INTO reglas_precio (
                nombre, id_proveedor, tipo_cliente, margen_porcentaje,
                redondeo_base, descuento_base_porcentaje,
                margen_minimo_porcentaje, activa
            ) VALUES
                ('RECEPCION MINORISTA', %s, 'minorista', 100, 100, 0, 50, TRUE),
                ('RECEPCION MAYORISTA', %s, 'mayorista', 50, 100, 0, 25, TRUE)
            """,
            (proveedor_id, proveedor_id),
        )
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "texto": "PRECIO-RX\tPRODUCTO PRECIO EXISTENTE\t2\t$20.000,00",
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion = creada.json()
    assert recepcion["items"][0]["estado_resolucion"] == "exacta"

    costos = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/costos",
        json={"total_documental": "40000", "id_usuario": usuario_id},
    )
    assert costos.status_code == 200, costos.text

    preview = client.post(
        f"/recepciones-mercaderia/{recepcion['id']}/precios/previsualizar",
        json={
            "estrategia": "reglas",
            "variacion_alerta_pct": "1",
            "redondeo_base": "100",
            "id_usuario": usuario_id,
        },
    )
    assert preview.status_code == 200, preview.text
    item = preview.json()["items"][0]
    costo_anterior = Decimal(str(anterior["costo_promedio_vigente"] or 0))
    costo_proyectado = (
        Decimal("20000")
        if stock_anterior <= 0
        else ((stock_anterior * costo_anterior) + Decimal("40000"))
        / (stock_anterior + Decimal("2"))
    ).quantize(Decimal("0.01"))
    esperado_minorista = (
        (costo_proyectado * Decimal("2") / Decimal("100"))
        .to_integral_value(rounding=ROUND_CEILING)
        * Decimal("100")
    )
    esperado_mayorista = (
        (costo_proyectado * Decimal("1.5") / Decimal("100"))
        .to_integral_value(rounding=ROUND_CEILING)
        * Decimal("100")
    )
    assert item["precio_revisado"] is True
    assert item["regla_minorista_snapshot"] == "RECEPCION MINORISTA"
    assert item["regla_mayorista_snapshot"] == "RECEPCION MAYORISTA"
    assert Decimal(str(item["precio_minorista_propuesto"])) == esperado_minorista
    assert Decimal(str(item["precio_mayorista_propuesto"])) == esperado_mayorista
    assert item["alerta_precio"]

    confirmada = client.post(
        f"/recepciones-mercaderia/{recepcion['id']}/confirmar",
        json={"confirmacion": "CONFIRMAR", "id_usuario": usuario_id},
    )
    assert confirmada.status_code == 200, confirmada.text

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT precio_minorista, precio_mayorista FROM variantes WHERE id = %s",
            (variante_id,),
        )
        actualizada = cur.fetchone()
        assert Decimal(str(actualizada["precio_minorista"])) == esperado_minorista
        assert Decimal(str(actualizada["precio_mayorista"])) == esperado_mayorista
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM precios_movimientos
            WHERE id_variante = %s
              AND origen_tipo = 'recepcion_mercaderia'
              AND origen_id = %s
            """,
            (variante_id, recepcion["id"]),
        )
        assert cur.fetchone()["total"] == 1


def test_sugerencia_individual_de_precios_no_modifica_el_alta(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Sugerencia Individual")
    usuario_id = seed_venta_basica["usuario_id"]
    categoria_id = seed_venta_basica["categoria_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO reglas_precio (
                nombre, id_proveedor, tipo_cliente, margen_porcentaje,
                redondeo_base, descuento_base_porcentaje,
                margen_minimo_porcentaje, activa
            ) VALUES
                ('ALTA NUEVA MINORISTA', %s, 'minorista', 100, 100, 0, 50, TRUE),
                ('ALTA NUEVA MAYORISTA', %s, 'mayorista', 50, 100, 0, 25, TRUE)
            """,
            (proveedor_id, proveedor_id),
        )
    db_conn.commit()

    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": usuario_id,
            "texto": "NUEVO-PRECIO-1\tPRODUCTO NUEVO PARA PRECIO\t2\t$1.000,00",
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion = creada.json()
    item = recepcion["items"][0]
    assert item["estado_resolucion"] == "nueva"

    costos = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/costos",
        json={"total_documental": "2000", "id_usuario": usuario_id},
    )
    assert costos.status_code == 200, costos.text

    sugerencia = client.post(
        f"/recepciones-mercaderia/{recepcion['id']}/items/{item['id']}/precios/sugerir",
        json={
            "rubro": "REPUESTOS",
            "id_categoria": categoria_id,
            "redondeo_base": "100",
        },
    )
    assert sugerencia.status_code == 200, sugerencia.text
    data = sugerencia.json()
    assert Decimal(str(data["costo_unitario"])) == Decimal("1000.00")
    assert Decimal(str(data["precio_minorista_sugerido"])) == Decimal("2000.00")
    assert Decimal(str(data["precio_mayorista_sugerido"])) == Decimal("1500.00")
    assert data["regla_minorista"] == "ALTA NUEVA MINORISTA"
    assert data["regla_mayorista"] == "ALTA NUEVA MAYORISTA"

    sin_cambios = client.get(f"/recepciones-mercaderia/{recepcion['id']}")
    assert sin_cambios.status_code == 200, sin_cambios.text
    item_sin_cambios = sin_cambios.json()["items"][0]
    assert item_sin_cambios["estado_resolucion"] == "nueva"
    assert item_sin_cambios["precio_minorista_propuesto"] is None
    assert item_sin_cambios["precio_mayorista_propuesto"] is None


def test_sugerencia_individual_usa_criterio_base_si_no_hay_reglas(
    client,
    db_conn,
    seed_venta_basica,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor Sin Reglas de Precio")
    creada = client.post(
        "/recepciones-mercaderia/importar-tabla",
        json={
            "id_proveedor": proveedor_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "texto": "SIN-REGLA-1\tPRODUCTO SIN REGLA\t1\t$1.001,00",
        },
    )
    assert creada.status_code == 200, creada.text
    recepcion = creada.json()
    item = recepcion["items"][0]

    costos = client.patch(
        f"/recepciones-mercaderia/{recepcion['id']}/costos",
        json={"total_documental": "1001", "id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert costos.status_code == 200, costos.text

    sugerencia = client.post(
        f"/recepciones-mercaderia/{recepcion['id']}/items/{item['id']}/precios/sugerir",
        json={
            "rubro": "REPUESTOS",
            "id_categoria": seed_venta_basica["categoria_id"],
            "redondeo_base": "50",
        },
    )
    assert sugerencia.status_code == 200, sugerencia.text
    data = sugerencia.json()
    assert Decimal(str(data["precio_minorista_sugerido"])) == Decimal("2250.00")
    assert Decimal(str(data["precio_mayorista_sugerido"])) == Decimal("1600.00")
    assert data["regla_minorista"] == "Criterio base de alta (120%)"
    assert data["regla_mayorista"] == "Criterio base de alta (55%)"
