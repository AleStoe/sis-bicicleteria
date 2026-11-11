import io
from decimal import Decimal

from openpyxl import Workbook
import pytest

from app.modules.precios import listas_service


@pytest.fixture(autouse=True)
def _uploads_temporales(monkeypatch, tmp_path):
    monkeypatch.setattr(listas_service, "UPLOADS_ROOT", tmp_path)
    monkeypatch.setattr(listas_service, "UPLOAD_DIR", tmp_path / "precios" / "listas")


def _crear_proveedor(db_conn, nombre="Proveedor listas precios"):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO proveedores (nombre, activo) VALUES (%s, TRUE) RETURNING id",
            (nombre,),
        )
        proveedor_id = cur.fetchone()["id"]
    db_conn.commit()
    return proveedor_id


def _crear_usuario(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Operador precios', 'operador_precios', 'hash', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]
    db_conn.commit()
    return usuario_id


def _crear_variante(
    db_conn,
    *,
    proveedor_id,
    producto,
    variante,
    sku,
    codigo_proveedor=None,
    ean=None,
    costo_reposicion="100",
    precio_minorista="230",
    precio_mayorista="180",
    permite_precio_libre=False,
):
    with db_conn.cursor() as cur:
        cur.execute("INSERT INTO categorias (nombre) VALUES (%s) RETURNING id", (f"Cat {sku}",))
        categoria_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO productos (id_categoria, nombre, tipo_item, stockeable, serializable, activo)
            VALUES (%s, %s, 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_id, producto),
        )
        producto_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO variantes (
                id_producto, nombre_variante, sku, codigo_proveedor, codigo_barras,
                proveedor_preferido_id, costo_promedio_vigente, costo_reposicion,
                precio_minorista, precio_mayorista, permite_precio_libre, activo
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
            RETURNING id
            """,
            (
                producto_id, variante, sku, codigo_proveedor, ean, proveedor_id,
                costo_reposicion, costo_reposicion, precio_minorista,
                precio_mayorista, permite_precio_libre,
            ),
        )
        variante_id = cur.fetchone()["id"]
    db_conn.commit()
    return variante_id


def _importar_csv(client, *, proveedor_id, usuario_id, nombre, filas):
    content = "Código;Descripción;Costo\n" + "\n".join(filas) + "\n"
    response = client.post(
        "/precios/listas-lotes/importar",
        data={"id_proveedor": proveedor_id, "id_usuario": usuario_id},
        files={"archivo": (nombre, content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _procesar_lote(client, lote_id, usuario_id):
    response = client.post(
        f"/precios/listas-lotes/{lote_id}/coincidencias/procesar",
        json={"id_usuario": usuario_id},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _xlsx_lista_bytes():
    workbook = Workbook()
    portada = workbook.active
    portada.title = "Portada"
    portada.append(["Lista vigente noviembre 2026"])

    lista = workbook.create_sheet("Lista precios")
    lista.append(["Proveedor de prueba"])
    lista.append([])
    lista.append(["Código", "Producto", "Precio lista", "Moneda"])
    lista.append([15419, "Luz trasera solar", 5886.94, "ARS"])
    lista["A4"].number_format = "0000000"
    lista.append(["0015413", "Luz delantera USB", "16.206,27", "ARS"])

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_importa_xlsx_multihoja_preserva_filas_y_no_toca_catalogo(
    client,
    db_conn,
    clean_db,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor XLSX precios")
    usuario_id = _crear_usuario(db_conn)
    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM variantes")
        variantes_antes = cur.fetchone()["total"]

    response = client.post(
        "/precios/listas-lotes/importar",
        data={"id_proveedor": proveedor_id, "id_usuario": usuario_id},
        files={
            "archivo": (
                "lista-noviembre.xlsx",
                _xlsx_lista_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["estado"] == "listo_para_revisar"
    assert data["hoja_detectada"] == "Lista precios"
    assert data["fila_encabezado_detectada"] == 3
    assert data["mapeo_detectado"]["codigo"] == 0
    assert data["mapeo_detectado"]["costo"] == 2
    assert data["total_filas"] == 2
    assert data["items"][0]["codigo_original"] == "0015419"
    assert data["items"][0]["costo_original"] == "5886.94"
    assert data["items"][1]["costo_original"] == "16.206,27"
    assert data["documento"]["sha256"]

    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM variantes")
        assert cur.fetchone()["total"] == variantes_antes


def test_csv_detecta_delimitador_bloquea_duplicado_guarda_perfil_y_anula(
    client,
    db_conn,
    clean_db,
):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor CSV precios")
    usuario_id = _crear_usuario(db_conn)
    contenido = (
        "Reporte de precios noviembre\n"
        "Código;Descripción;Costo unitario\n"
        "000123; Cable de cambio ;1.234,56\n"
        "000124;Forro de cambio;850,40\n"
    ).encode("utf-8")

    first = client.post(
        "/precios/listas-lotes/importar",
        data={
            "id_proveedor": proveedor_id,
            "id_usuario": usuario_id,
            "observaciones": "Lista mensual",
        },
        files={"archivo": ("lista.csv", contenido, "text/csv")},
    )
    assert first.status_code == 200, first.text
    lote = first.json()
    assert lote["delimitador_detectado"] == ";"
    assert lote["fila_encabezado_detectada"] == 2
    assert lote["items"][0]["codigo_original"] == "000123"
    assert lote["items"][0]["descripcion_original"] == "Cable de cambio"
    assert lote["items"][0]["valores_originales"][1] == " Cable de cambio "

    duplicate = client.post(
        "/precios/listas-lotes/importar",
        data={"id_proveedor": proveedor_id, "id_usuario": usuario_id},
        files={"archivo": ("otra-copia.csv", contenido, "text/csv")},
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["detail"]["lote_id"] == lote["id"]

    perfil = client.post(
        f"/precios/listas-lotes/{lote['id']}/perfil",
        json={"nombre": "Formato mensual Bicipartes", "id_usuario": usuario_id},
    )
    assert perfil.status_code == 200, perfil.text
    assert perfil.json()["mapeo_columnas"]["codigo"] == 0
    assert perfil.json()["delimitador"] == ";"

    cancel = client.post(
        f"/precios/listas-lotes/{lote['id']}/anular",
        json={
            "motivo": "Archivo cargado solo para probar el formato",
            "id_usuario": usuario_id,
        },
    )
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["estado"] == "anulado"
    assert cancel.json()["documento"]["sha256"] == lote["documento"]["sha256"]


def test_importa_txt_tabulado(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor TXT precios")
    usuario_id = _crear_usuario(db_conn)
    contenido = (
        "SKU\tNombre\tCosto\n"
        "0007-A\tCadena 7 velocidades\t$ 12.500,00\n"
    ).encode("cp1252")

    response = client.post(
        "/precios/listas-lotes/importar",
        data={"id_proveedor": proveedor_id, "id_usuario": usuario_id},
        files={"archivo": ("lista.txt", contenido, "text/plain")},
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["formato"] == "txt"
    assert data["delimitador_detectado"] == "\t"
    assert data["items"][0]["codigo_original"] == "0007-A"
    assert data["items"][0]["costo_original"] == "$ 12.500,00"


def test_coincidencias_exactas_por_alias_sku_y_ean(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor coincidencias exactas")
    usuario_id = _crear_usuario(db_conn)
    variante_alias = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Cadena TEC C9",
        variante="9 velocidades 116L",
        sku="CAD-TEC-C9",
        codigo_proveedor="15427",
    )
    variante_sku = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Luz delantera SLP",
        variante="USB 3W",
        sku="LUZ-SLP-3W",
    )
    variante_ean = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Candado SLP",
        variante="8x1000 con soporte",
        sku="CAND-81000",
        ean="7791234567890",
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedor_producto_codigos (id_proveedor, codigo_proveedor, id_variante, activo)
            VALUES (%s, '0015427', %s, TRUE)
            """,
            (proveedor_id, variante_alias),
        )
    db_conn.commit()

    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="exactas.csv",
        filas=[
            "0015427;Cadena TEC C9;11555,66",
            "LUZ-SLP-3W;Luz delantera USB;16206,27",
            "7791234567890;Candado SLP;3454,76",
        ],
    )
    response = client.post(
        f"/precios/listas-lotes/{lote['id']}/coincidencias/procesar",
        json={"id_usuario": usuario_id},
    )
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [item["estado_coincidencia"] for item in items] == ["exacta", "exacta", "exacta"]
    assert items[0]["id_variante"] == variante_alias
    assert items[0]["origen_coincidencia"] == "alias_proveedor"
    assert items[1]["id_variante"] == variante_sku
    assert items[1]["origen_coincidencia"] == "sku"
    assert items[2]["id_variante"] == variante_ean
    assert items[2]["origen_coincidencia"] == "ean"


def test_codigos_normalizados_y_descripciones_solo_se_sugieren(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor sugerencias")
    usuario_id = _crear_usuario(db_conn)
    variante_codigo = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Cadena TEC C9",
        variante="9 velocidades 116L",
        sku="CADENA-C9",
        codigo_proveedor="15427",
    )
    variante_descripcion = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Inflador Beto aluminio",
        variante="Con medidor",
        sku="INFL-BETO-MED",
    )
    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="sugerencias.csv",
        filas=[
            "00015427;Cadena TEC C9;11555,66",
            "NUEVO-77;Inflador Beto aluminio con medidor;24665,52",
        ],
    )
    response = client.post(
        f"/precios/listas-lotes/{lote['id']}/coincidencias/procesar",
        json={"id_usuario": usuario_id},
    )
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert items[0]["estado_coincidencia"] == "sugerida"
    assert items[0]["id_variante"] is None
    assert items[0]["candidatos"][0]["id_variante"] == variante_codigo
    assert items[0]["candidatos"][0]["motivo"] == "codigo_normalizado"
    assert items[1]["estado_coincidencia"] == "sugerida"
    assert items[1]["id_variante"] is None
    assert items[1]["candidatos"][0]["id_variante"] == variante_descripcion


def test_vinculo_manual_recuerda_alias_y_resuelve_ambiguedad(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor aprendizaje")
    usuario_id = _crear_usuario(db_conn)
    variante_correcta = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Dirección semi integrada",
        variante="44x30 mm",
        sku="DIR-4430-A",
        codigo_proveedor="DUP-01",
    )
    variante_alternativa = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Dirección semi integrada",
        variante="44-50.6x30 mm",
        sku="DIR-4450-B",
        codigo_proveedor="DUP-01",
    )
    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="ambiguo.csv",
        filas=["DUP-01;Dirección semi integrada 44x30;1883,81"],
    )
    processed = client.post(
        f"/precios/listas-lotes/{lote['id']}/coincidencias/procesar",
        json={"id_usuario": usuario_id},
    )
    assert processed.status_code == 200, processed.text
    item = processed.json()["items"][0]
    assert item["estado_coincidencia"] == "ambigua"
    assert len(item["candidatos"]) == 2

    linked = client.post(
        f"/precios/listas-lotes/{lote['id']}/items/{item['id']}/vincular",
        json={
            "id_variante": variante_correcta,
            "recordar_alias": True,
            "id_usuario": usuario_id,
        },
    )
    assert linked.status_code == 200, linked.text
    linked_item = linked.json()["items"][0]
    assert linked_item["id_variante"] == variante_correcta
    assert linked_item["coincidencia_confirmada"] is True
    assert linked_item["origen_coincidencia"] == "manual"

    second_lot = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="aprendido.csv",
        filas=["DUP-01;Dirección semi integrada 44x30;2000,00"],
    )
    learned = client.post(
        f"/precios/listas-lotes/{second_lot['id']}/coincidencias/procesar",
        json={"id_usuario": usuario_id},
    )
    assert learned.status_code == 200, learned.text
    learned_item = learned.json()["items"][0]
    assert learned_item["estado_coincidencia"] == "exacta"
    assert learned_item["id_variante"] == variante_correcta
    assert learned_item["origen_coincidencia"] == "alias_proveedor"

    blocked = client.post(
        f"/precios/listas-lotes/{second_lot['id']}/items/{learned_item['id']}/vincular",
        json={
            "id_variante": variante_alternativa,
            "recordar_alias": True,
            "id_usuario": usuario_id,
        },
    )
    assert blocked.status_code == 409, blocked.text

    replaced = client.post(
        f"/precios/listas-lotes/{second_lot['id']}/items/{learned_item['id']}/vincular",
        json={
            "id_variante": variante_alternativa,
            "recordar_alias": True,
            "reemplazar_alias": True,
            "id_usuario": usuario_id,
        },
    )
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["items"][0]["id_variante"] == variante_alternativa
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_variante
            FROM proveedor_producto_codigos
            WHERE id_proveedor = %s AND codigo_proveedor = 'DUP-01'
            """,
            (proveedor_id,),
        )
        assert cur.fetchone()["id_variante"] == variante_alternativa


def test_preview_conserva_margen_efectivo_redondea_y_no_modifica_catalogo(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor preview margen")
    usuario_id = _crear_usuario(db_conn)
    variante_id = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Cadena preview",
        variante="Única",
        sku="PREVIEW-MARGEN",
        costo_reposicion="100",
        precio_minorista="230",
        precio_mayorista="180",
    )
    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="preview-margen.csv",
        filas=["PREVIEW-MARGEN;Cadena preview;120,00"],
    )
    _procesar_lote(client, lote["id"], usuario_id)
    response = client.post(
        f"/precios/listas-lotes/{lote['id']}/preview",
        json={
            "estrategia": "conservar_margen",
            "descuento_minorista_pct": "10",
            "descuento_mayorista_pct": "0",
            "redondeo_minorista": "10",
            "redondeo_mayorista": "10",
            "alerta_variacion_pct": "10",
            "id_usuario": usuario_id,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    item = data["items"][0]
    assert data["estado"] == "listo_para_aplicar"
    assert Decimal(item["costo_reposicion_anterior_snapshot"]) == Decimal("100")
    assert Decimal(item["costo_reposicion_nuevo"]) == Decimal("120")
    assert Decimal(item["precio_minorista_propuesto"]) == Decimal("280")
    assert Decimal(item["precio_mayorista_propuesto"]) == Decimal("220")
    assert item["explicacion_preview"]["minorista"].startswith("margen efectivo conservado")
    assert any(alert["codigo"] == "variacion_costo" for alert in item["alertas_preview"])
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT costo_reposicion, precio_minorista, precio_mayorista FROM variantes WHERE id = %s",
            (variante_id,),
        )
        variant = cur.fetchone()
        assert Decimal(variant["costo_reposicion"]) == Decimal("100")
        assert Decimal(variant["precio_minorista"]) == Decimal("230")
        assert Decimal(variant["precio_mayorista"]) == Decimal("180")


def test_preview_no_baja_precio_y_muestra_oferta(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor preview baja")
    usuario_id = _crear_usuario(db_conn)
    variante_id = _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Producto en oferta",
        variante="Única",
        sku="PREVIEW-OFERTA",
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ofertas (
                id_variante, nombre, precio_regular_referencia, precio_oferta,
                fecha_desde, fecha_hasta, activa, id_usuario_creador,
                alcance, politica_contado
            ) VALUES (%s, 'OFERTA TEST', 230, 200, CURRENT_DATE - 1,
                      CURRENT_DATE + 10, TRUE, %s, 'variante', 'precio_lista_promocional')
            """,
            (variante_id, usuario_id),
        )
    db_conn.commit()
    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="preview-baja.csv",
        filas=["PREVIEW-OFERTA;Producto en oferta;80,00"],
    )
    _procesar_lote(client, lote["id"], usuario_id)
    response = client.post(
        f"/precios/listas-lotes/{lote['id']}/preview",
        json={
            "estrategia": "conservar_margen",
            "descuento_minorista_pct": 10,
            "descuento_mayorista_pct": 0,
            "redondeo_minorista": 10,
            "redondeo_mayorista": 10,
            "alerta_variacion_pct": 10,
            "id_usuario": usuario_id,
        },
    )
    assert response.status_code == 200, response.text
    item = response.json()["items"][0]
    assert Decimal(item["precio_minorista_propuesto"]) == Decimal("230")
    assert Decimal(item["precio_mayorista_propuesto"]) == Decimal("180")
    assert item["oferta_vigente_snapshot"]["nombre"] == "OFERTA TEST"
    assert any(alert["codigo"] == "baja_sin_bajar_precio" for alert in item["alertas_preview"])
    assert any(alert["codigo"] == "oferta_vigente" for alert in item["alertas_preview"])


def test_preview_usa_reglas_por_canal(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor preview reglas")
    usuario_id = _crear_usuario(db_conn)
    _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Producto con regla",
        variante="Única",
        sku="PREVIEW-REGLA",
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO reglas_precio (
                nombre, id_proveedor, tipo_cliente, margen_porcentaje,
                redondeo_base, descuento_base_porcentaje,
                margen_minimo_porcentaje, activa
            ) VALUES
                ('REGLA LISTA MIN', %s, 'minorista', 100, 10, 10, 50, TRUE),
                ('REGLA LISTA MAY', %s, 'mayorista', 50, 10, 0, 25, TRUE)
            """,
            (proveedor_id, proveedor_id),
        )
    db_conn.commit()
    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="preview-regla.csv",
        filas=["PREVIEW-REGLA;Producto con regla;120,00"],
    )
    _procesar_lote(client, lote["id"], usuario_id)
    response = client.post(
        f"/precios/listas-lotes/{lote['id']}/preview",
        json={"estrategia": "usar_regla", "id_usuario": usuario_id},
    )
    assert response.status_code == 200, response.text
    item = response.json()["items"][0]
    assert Decimal(item["precio_minorista_propuesto"]) == Decimal("270")
    assert Decimal(item["precio_mayorista_propuesto"]) == Decimal("180")
    assert item["regla_minorista_snapshot"]["nombre"] == "REGLA LISTA MIN"
    assert item["regla_mayorista_snapshot"]["nombre"] == "REGLA LISTA MAY"


def test_preview_precio_libre_manual_e_ignorar_sin_coincidencia(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor preview manual")
    usuario_id = _crear_usuario(db_conn)
    _crear_variante(
        db_conn,
        proveedor_id=proveedor_id,
        producto="Producto libre",
        variante="Única",
        sku="PREVIEW-LIBRE",
        permite_precio_libre=True,
    )
    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="preview-manual.csv",
        filas=[
            "PREVIEW-LIBRE;Producto libre;120,00",
            "NO-EXISTE;Producto desconocido;50,00",
        ],
    )
    processed = _procesar_lote(client, lote["id"], usuario_id)
    response = client.post(
        f"/precios/listas-lotes/{lote['id']}/preview",
        json={"estrategia": "conservar_margen", "id_usuario": usuario_id},
    )
    assert response.status_code == 200, response.text
    preview = response.json()
    assert preview["estado"] == "requiere_revision"
    exact_item = next(item for item in preview["items"] if item["codigo_original"] == "PREVIEW-LIBRE")
    unknown_item = next(item for item in preview["items"] if item["codigo_original"] == "NO-EXISTE")
    assert any(alert["codigo"] == "precio_libre" for alert in exact_item["alertas_preview"])

    manual = client.patch(
        f"/precios/listas-lotes/{lote['id']}/items/{exact_item['id']}/preview",
        json={
            "estrategia_minorista": "manual",
            "estrategia_mayorista": "manual",
            "precio_minorista_manual": 300,
            "precio_mayorista_manual": 250,
            "seleccionado_aplicar": True,
            "confirmar_precio_libre": True,
            "id_usuario": usuario_id,
        },
    )
    assert manual.status_code == 200, manual.text
    ignored = client.patch(
        f"/precios/listas-lotes/{lote['id']}/items/{unknown_item['id']}/preview",
        json={
            "estrategia_minorista": "ignorar",
            "estrategia_mayorista": "ignorar",
            "seleccionado_aplicar": False,
            "id_usuario": usuario_id,
        },
    )
    assert ignored.status_code == 200, ignored.text
    final = ignored.json()
    assert final["estado"] == "listo_para_aplicar"
    final_exact = next(item for item in final["items"] if item["codigo_original"] == "PREVIEW-LIBRE")
    assert Decimal(final_exact["precio_minorista_propuesto"]) == Decimal("300")
    assert final_exact["preview_valido"] is True


def _crear_lote_listo(client, db_conn, *, proveedor_id, usuario_id, variantes):
    filas = []
    for index, variant in enumerate(variantes, start=1):
        _crear_variante(
            db_conn,
            proveedor_id=proveedor_id,
            producto=variant["producto"],
            variante="Única",
            sku=variant["sku"],
            costo_reposicion=variant.get("costo", "100"),
            precio_minorista=variant.get("minorista", "230"),
            precio_mayorista=variant.get("mayorista", "180"),
        )
        filas.append(f"{variant['sku']};{variant['producto']};{variant.get('nuevo_costo', '120')},00")
    lote = _importar_csv(
        client,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        nombre="lista-aplicar.csv",
        filas=filas,
    )
    _procesar_lote(client, lote["id"], usuario_id)
    preview = client.post(
        f"/precios/listas-lotes/{lote['id']}/preview",
        json={
            "estrategia": "conservar_margen",
            "descuento_minorista_pct": 10,
            "descuento_mayorista_pct": 0,
            "redondeo_minorista": 10,
            "redondeo_mayorista": 10,
            "id_usuario": usuario_id,
        },
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["estado"] == "listo_para_aplicar"
    return preview.json()


def test_aplica_lote_atomico_idempotente_y_genera_informe(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor aplicación")
    usuario_id = _crear_usuario(db_conn)
    preview = _crear_lote_listo(
        client,
        db_conn,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        variantes=[{"sku": "APLICAR-01", "producto": "Cadena para aplicar"}],
    )
    item = preview["items"][0]

    applied = client.post(
        f"/precios/listas-lotes/{preview['id']}/aplicar",
        json={"preview_version": preview["preview_version"], "id_usuario": usuario_id},
    )
    assert applied.status_code == 200, applied.text
    data = applied.json()
    assert data["estado"] == "aplicado"
    assert data["aplicado_at"] is not None
    assert data["items"][0]["precio_movimiento_aplicacion_id"] is not None

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT costo_reposicion, precio_minorista, precio_mayorista, costo_reposicion_origen FROM variantes WHERE id = %s",
            (item["id_variante"],),
        )
        variant = cur.fetchone()
        assert Decimal(variant["costo_reposicion"]) == Decimal("120")
        assert Decimal(variant["precio_minorista"]) == Decimal("280")
        assert Decimal(variant["precio_mayorista"]) == Decimal("220")
        assert variant["costo_reposicion_origen"] == "lista_proveedor"
        cur.execute("SELECT COUNT(*) AS total FROM precios_movimientos WHERE origen_tipo = 'precio_lista_lote' AND origen_id = %s", (preview["id"],))
        assert cur.fetchone()["total"] == 1

    repeated = client.post(
        f"/precios/listas-lotes/{preview['id']}/aplicar",
        json={"preview_version": preview["preview_version"], "id_usuario": usuario_id},
    )
    assert repeated.status_code == 200, repeated.text
    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM precios_movimientos WHERE origen_tipo = 'precio_lista_lote' AND origen_id = %s", (preview["id"],))
        assert cur.fetchone()["total"] == 1

    report = client.get(f"/precios/listas-lotes/{preview['id']}/informe")
    assert report.status_code == 200, report.text
    assert report.headers["content-type"].startswith("application/pdf")
    assert report.content.startswith(b"%PDF")


def test_aplicacion_detecta_conflicto_y_no_deja_cambios_parciales(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor conflicto")
    usuario_id = _crear_usuario(db_conn)
    preview = _crear_lote_listo(
        client,
        db_conn,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        variantes=[
            {"sku": "CONFLICTO-01", "producto": "Producto primero"},
            {"sku": "CONFLICTO-02", "producto": "Producto segundo"},
        ],
    )
    second = next(item for item in preview["items"] if item["codigo_original"] == "CONFLICTO-02")
    with db_conn.cursor() as cur:
        cur.execute("UPDATE variantes SET precio_minorista = 999 WHERE id = %s", (second["id_variante"],))
    db_conn.commit()

    response = client.post(
        f"/precios/listas-lotes/{preview['id']}/aplicar",
        json={"preview_version": preview["preview_version"], "id_usuario": usuario_id},
    )
    assert response.status_code == 409, response.text
    assert "No se aplicó ningún precio" in response.json()["detail"]["mensaje"]
    with db_conn.cursor() as cur:
        cur.execute("SELECT sku, costo_reposicion, precio_minorista FROM variantes WHERE sku IN ('CONFLICTO-01', 'CONFLICTO-02') ORDER BY sku")
        rows = cur.fetchall()
        assert Decimal(rows[0]["costo_reposicion"]) == Decimal("100")
        assert Decimal(rows[0]["precio_minorista"]) == Decimal("230")
        cur.execute("SELECT COUNT(*) AS total FROM precios_movimientos WHERE origen_tipo = 'precio_lista_lote' AND origen_id = %s", (preview["id"],))
        assert cur.fetchone()["total"] == 0


def test_revierte_lote_y_es_idempotente(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor reversión")
    usuario_id = _crear_usuario(db_conn)
    preview = _crear_lote_listo(
        client,
        db_conn,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        variantes=[{"sku": "REVERTIR-01", "producto": "Producto reversible"}],
    )
    item = preview["items"][0]
    applied = client.post(
        f"/precios/listas-lotes/{preview['id']}/aplicar",
        json={"preview_version": preview["preview_version"], "id_usuario": usuario_id},
    )
    assert applied.status_code == 200, applied.text
    reverted = client.post(
        f"/precios/listas-lotes/{preview['id']}/revertir",
        json={"motivo": "Lista cargada por error", "id_usuario": usuario_id},
    )
    assert reverted.status_code == 200, reverted.text
    assert reverted.json()["estado"] == "revertido"
    with db_conn.cursor() as cur:
        cur.execute("SELECT costo_reposicion, precio_minorista, precio_mayorista FROM variantes WHERE id = %s", (item["id_variante"],))
        variant = cur.fetchone()
        assert Decimal(variant["costo_reposicion"]) == Decimal("100")
        assert Decimal(variant["precio_minorista"]) == Decimal("230")
        assert Decimal(variant["precio_mayorista"]) == Decimal("180")
        cur.execute("SELECT COUNT(*) AS total FROM precios_movimientos WHERE origen_id = %s AND origen_tipo IN ('precio_lista_lote', 'reversion_precio_lista_lote')", (preview["id"],))
        assert cur.fetchone()["total"] == 2

    repeated = client.post(
        f"/precios/listas-lotes/{preview['id']}/revertir",
        json={"motivo": "Segundo clic", "id_usuario": usuario_id},
    )
    assert repeated.status_code == 200, repeated.text
    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM precios_movimientos WHERE origen_id = %s AND origen_tipo IN ('precio_lista_lote', 'reversion_precio_lista_lote')", (preview["id"],))
        assert cur.fetchone()["total"] == 2


def test_reversion_bloqueada_si_hubo_movimiento_posterior(client, db_conn, clean_db):
    proveedor_id = _crear_proveedor(db_conn, "Proveedor bloqueo reversión")
    usuario_id = _crear_usuario(db_conn)
    preview = _crear_lote_listo(
        client,
        db_conn,
        proveedor_id=proveedor_id,
        usuario_id=usuario_id,
        variantes=[{"sku": "REVERTIR-BLOQUEO", "producto": "Producto modificado luego"}],
    )
    item = preview["items"][0]
    applied = client.post(
        f"/precios/listas-lotes/{preview['id']}/aplicar",
        json={"preview_version": preview["preview_version"], "id_usuario": usuario_id},
    )
    assert applied.status_code == 200, applied.text
    later = client.post(
        f"/precios/variantes/{item['id_variante']}/actualizar",
        json={
            "precio_minorista": 300,
            "precio_mayorista": 240,
            "tipo_movimiento": "actualizacion_manual",
            "motivo": "Cambio posterior",
            "id_usuario": usuario_id,
        },
    )
    assert later.status_code == 200, later.text
    reverted = client.post(
        f"/precios/listas-lotes/{preview['id']}/revertir",
        json={"motivo": "Intento posterior", "id_usuario": usuario_id},
    )
    assert reverted.status_code == 409, reverted.text
    assert "movimientos posteriores" in reverted.json()["detail"]["conflictos"][0]["motivo"]
    detail = client.get(f"/precios/listas-lotes/{preview['id']}")
    assert detail.json()["estado"] == "aplicado"
