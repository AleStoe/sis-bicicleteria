from datetime import date, timedelta
from decimal import Decimal


def _crear_oferta(client, seed, **overrides):
    hoy = date.today()
    payload = {
        "id_variante": seed["variante_id"],
        "nombre": "OFERTA CAMPEONES",
        "precio_oferta": "20000",
        "fecha_desde": hoy.isoformat(),
        "fecha_hasta": (hoy + timedelta(days=2)).isoformat(),
        "motivo": "Promocion comercial de prueba",
        "id_usuario": seed["usuario_id"],
    }
    payload.update(overrides)
    return client.post("/ofertas", json=payload)


def _preparar_variante_serializable(db_conn, seed):
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE productos SET serializable = TRUE WHERE id = %s",
            (seed["producto_id"],),
        )
    db_conn.commit()


def _crear_bicicleta(client, seed, numero_cuadro):
    response = client.post(
        "/bicicletas_serializadas",
        json={
            "id_variante": seed["variante_id"],
            "id_sucursal_actual": seed["sucursal_id"],
            "numero_cuadro": numero_cuadro,
            "observaciones": "Unidad para oferta individual",
            "id_usuario": seed["usuario_id"],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["bicicleta_id"]


def test_oferta_vigente_aparece_en_catalogo_pos(client, seed_venta_basica):
    crear = _crear_oferta(client, seed_venta_basica)
    assert crear.status_code == 201, crear.text

    response = client.get(
        "/catalogo/pos",
        params={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "query": "ZEFAL-DRY-120",
        },
    )
    assert response.status_code == 200, response.text

    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["en_oferta"] is True
    assert Decimal(items[0]["precio_oferta"]) == Decimal("20000")
    assert items[0]["oferta_nombre"] == "OFERTA CAMPEONES"


def test_oferta_no_permite_excluir_beneficio_contado(client, seed_venta_basica):
    response = _crear_oferta(
        client,
        seed_venta_basica,
        politica_contado="precio_final_contado",
    )

    assert response.status_code == 422


def test_historia_png_se_genera_con_oferta_vigente(client, seed_venta_basica):
    crear = _crear_oferta(client, seed_venta_basica)
    assert crear.status_code == 201, crear.text

    response = client.get(
        f"/documentos/etiquetas/variantes/{seed_venta_basica['variante_id']}/historia"
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_no_permite_ofertas_solapadas(client, seed_venta_basica):
    primera = _crear_oferta(client, seed_venta_basica)
    assert primera.status_code == 201, primera.text

    segunda = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="SEGUNDA OFERTA",
        precio_oferta="19000",
    )
    assert segunda.status_code == 400
    assert "oferta activa" in segunda.json()["detail"].lower()


def test_venta_minorista_aplica_oferta_y_congela_trazabilidad(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = _crear_oferta(client, seed_venta_basica)
    assert crear.status_code == 201, crear.text
    oferta_id = crear.json()["id"]

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.subtotal_base,
                vi.precio_lista,
                vi.precio_final,
                vi.id_oferta,
                vi.precio_catalogo_original,
                vi.descuento_oferta_unitario,
                vi.oferta_nombre_snapshot
            FROM ventas v
            JOIN venta_items vi ON vi.id_venta = v.id
            WHERE v.id = %s
            """,
            (venta_id,),
        )
        fila = cur.fetchone()

    assert Decimal(str(fila["subtotal_base"])) == Decimal("20000.00")
    assert Decimal(str(fila["precio_lista"])) == Decimal("20000.00")
    assert Decimal(str(fila["precio_final"])) == Decimal("20000.00")
    assert fila["id_oferta"] == oferta_id
    assert Decimal(str(fila["precio_catalogo_original"])) == Decimal("24440.00")
    assert Decimal(str(fila["descuento_oferta_unitario"])) == Decimal("4440.00")
    assert fila["oferta_nombre_snapshot"] == "OFERTA CAMPEONES"


def test_oferta_futura_no_modifica_venta(client, db_conn, seed_venta_basica):
    hoy = date.today()
    crear = _crear_oferta(
        client,
        seed_venta_basica,
        fecha_desde=(hoy + timedelta(days=1)).isoformat(),
        fecha_hasta=(hoy + timedelta(days=3)).isoformat(),
    )
    assert crear.status_code == 201, crear.text

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT precio_lista, id_oferta
            FROM venta_items
            WHERE id_venta = %s
            """,
            (venta.json()["venta_id"],),
        )
        item = cur.fetchone()

    assert Decimal(str(item["precio_lista"])) == Decimal("24440.00")
    assert item["id_oferta"] is None


def test_cierre_masivo_desactiva_ofertas_vencidas(client, seed_venta_basica):
    hoy = date.today()
    vencida = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="OFERTA VENCIDA PARA CIERRE",
        fecha_desde=(hoy - timedelta(days=5)).isoformat(),
        fecha_hasta=(hoy - timedelta(days=1)).isoformat(),
    )
    assert vencida.status_code == 201, vencida.text
    assert vencida.json()["estado_calculado"] == "vencida"
    assert vencida.json()["activa"] is True

    cierre = client.patch(
        "/ofertas/vencidas/desactivar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert cierre.status_code == 200, cierre.text
    assert cierre.json()["cantidad"] == 1
    assert cierre.json()["ids_ofertas"] == [vencida.json()["id"]]

    listado = client.get("/ofertas")
    assert listado.status_code == 200, listado.text
    oferta = next(item for item in listado.json() if item["id"] == vencida.json()["id"])
    assert oferta["activa"] is False
    assert oferta["estado_calculado"] == "inactiva"


def test_oferta_por_cuadro_tiene_prioridad_y_congela_alcance_en_venta(
    client,
    db_conn,
    seed_venta_basica,
):
    _preparar_variante_serializable(db_conn, seed_venta_basica)
    bici_oferta_id = _crear_bicicleta(client, seed_venta_basica, "CUADRO-OFERTA-001")
    bici_general_id = _crear_bicicleta(client, seed_venta_basica, "CUADRO-NORMAL-002")

    general = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="OFERTA GENERAL",
        precio_oferta="20000",
        politica_contado="precio_lista_promocional",
    )
    assert general.status_code == 201, general.text

    individual = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="OFERTA CUADRO 001",
        alcance="unidades",
        ids_bicicletas_serializadas=[bici_oferta_id],
        precio_oferta="18000",
        politica_contado="precio_lista_promocional",
    )
    assert individual.status_code == 201, individual.text
    individual_data = individual.json()
    assert individual_data["alcance"] == "unidades"
    assert individual_data["politica_contado"] == "precio_lista_promocional"
    assert [unidad["id"] for unidad in individual_data["unidades"]] == [bici_oferta_id]
    assert Decimal(individual_data["unidades"][0]["ganancia_estimada"]) == Decimal("8000.00")

    disponibles = client.get(
        "/bicicletas_serializadas/disponibles",
        params={
            "id_variante": seed_venta_basica["variante_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert disponibles.status_code == 200, disponibles.text
    por_id = {item["id"]: item for item in disponibles.json()}
    assert por_id[bici_oferta_id]["oferta_id"] == individual_data["id"]
    assert Decimal(por_id[bici_oferta_id]["precio_oferta"]) == Decimal("18000")
    assert por_id[bici_oferta_id]["oferta_alcance"] == "unidades"
    assert por_id[bici_general_id]["oferta_id"] == general.json()["id"]
    assert Decimal(por_id[bici_general_id]["precio_oferta"]) == Decimal("20000")
    assert por_id[bici_general_id]["oferta_alcance"] == "variante"

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "id_bicicleta_serializada": bici_oferta_id,
                    "cantidad": 1,
                },
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "id_bicicleta_serializada": bici_general_id,
                    "cantidad": 1,
                },
            ],
        },
    )
    assert venta.status_code == 200, venta.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_bicicleta_serializada, precio_lista, id_oferta,
                   oferta_alcance_snapshot, oferta_politica_contado_snapshot
            FROM venta_items
            WHERE id_venta = %s
            ORDER BY id_bicicleta_serializada
            """,
            (venta.json()["venta_id"],),
        )
        items = {row["id_bicicleta_serializada"]: row for row in cur.fetchall()}
        cur.execute(
            """
            SELECT subtotal_base, base_sin_descuento_contado
            FROM ventas
            WHERE id = %s
            """,
            (venta.json()["venta_id"],),
        )
        venta_guardada = cur.fetchone()

    assert items[bici_oferta_id]["precio_lista"] == Decimal("18000.00")
    assert items[bici_oferta_id]["oferta_alcance_snapshot"] == "unidades"
    assert items[bici_oferta_id]["oferta_politica_contado_snapshot"] == "precio_lista_promocional"
    assert items[bici_general_id]["precio_lista"] == Decimal("20000.00")
    assert items[bici_general_id]["oferta_alcance_snapshot"] == "variante"
    assert venta_guardada["subtotal_base"] == Decimal("38000.00")
    assert venta_guardada["base_sin_descuento_contado"] == Decimal("0.00")

    simulacion = client.post(
        "/pagos/ventas/simular-tramo",
        json={
            "venta_id": venta.json()["venta_id"],
            "medio_pago": "transferencia",
            "monto_base": "38000",
        },
    )
    assert simulacion.status_code == 200, simulacion.text
    tramo = simulacion.json()
    assert Decimal(tramo["monto_base_aplicado"]) == Decimal("38000.00")
    assert Decimal(tramo["descuento_aplicado"]) == Decimal("3800.00")
    assert Decimal(tramo["monto_total_cobrado"]) == Decimal("34200.00")


def test_oferta_individual_bloquea_unidad_no_lista_y_solapamiento(
    client,
    db_conn,
    seed_venta_basica,
):
    _preparar_variante_serializable(db_conn, seed_venta_basica)
    bici_id = _crear_bicicleta(client, seed_venta_basica, "CUADRO-BLOQUEO-001")
    primera = _crear_oferta(
        client,
        seed_venta_basica,
        alcance="unidades",
        ids_bicicletas_serializadas=[bici_id],
        precio_oferta="19000",
    )
    assert primera.status_code == 201, primera.text

    solapada = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="OTRA OFERTA INDIVIDUAL",
        alcance="unidades",
        ids_bicicletas_serializadas=[bici_id],
        precio_oferta="18000",
    )
    assert solapada.status_code == 400
    assert "ya está incluido" in solapada.json()["detail"]

    otra_bici_id = _crear_bicicleta(client, seed_venta_basica, "CUADRO-PENDIENTE-002")
    pendiente = client.patch(
        f"/bicicletas_serializadas/{otra_bici_id}/ficha",
        json={
            "estado_tecnico": "pendiente_revision",
            "condicion_comercial": "normal",
            "ubicacion_fisica": "DEPOSITO",
            "observaciones": None,
            "texto_comercial": None,
            "motivo": "Control antes de publicar",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pendiente.status_code == 200, pendiente.text
    invalida = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="OFERTA NO APTA",
        alcance="unidades",
        ids_bicicletas_serializadas=[otra_bici_id],
        precio_oferta="18000",
    )
    assert invalida.status_code == 400
    assert "no está disponible y listo" in invalida.json()["detail"]


def test_oferta_aplica_descuento_contado_en_pago_inicial(
    client,
    db_conn,
    seed_venta_basica,
):
    _preparar_variante_serializable(db_conn, seed_venta_basica)
    bici_id = _crear_bicicleta(client, seed_venta_basica, "CUADRO-FINAL-001")
    oferta = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="OFERTA CON BENEFICIO CONTADO",
        alcance="unidades",
        ids_bicicletas_serializadas=[bici_id],
        precio_oferta="18000",
    )
    assert oferta.status_code == 201, oferta.text

    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200, caja.text

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "id_bicicleta_serializada": bici_id,
                    "cantidad": 1,
                }
            ],
            "pagos": [
                {
                    "medio_pago": "transferencia",
                    "monto_base": "18000",
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text
    assert venta.json()["estado"] == "pagada_total"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT subtotal_base, descuento_total, total_final, saldo_pendiente
            FROM ventas
            WHERE id = %s
            """,
            (venta.json()["venta_id"],),
        )
        venta_guardada = cur.fetchone()
        cur.execute(
            """
            SELECT monto_base_aplicado, monto_descuento_aplicado,
                   monto_total_cobrado
            FROM pagos
            WHERE origen_tipo = 'venta' AND origen_id = %s
            """,
            (venta.json()["venta_id"],),
        )
        pago = cur.fetchone()

    assert venta_guardada["subtotal_base"] == Decimal("18000.00")
    assert venta_guardada["descuento_total"] == Decimal("1800.00")
    assert venta_guardada["total_final"] == Decimal("16200.00")
    assert venta_guardada["saldo_pendiente"] == Decimal("0.00")
    assert pago["monto_base_aplicado"] == Decimal("18000.00")
    assert pago["monto_descuento_aplicado"] == Decimal("1800.00")
    assert pago["monto_total_cobrado"] == Decimal("16200.00")
