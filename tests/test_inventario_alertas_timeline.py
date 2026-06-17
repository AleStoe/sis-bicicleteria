from decimal import Decimal


def _crear_inventario(client, seed_venta_basica, descripcion="Conteo test"):
    response = client.post(
        "/inventarios-fisicos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "descripcion": descripcion,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _contar_item(client, inventario, item, seed_venta_basica, stock_contado):
    return client.post(
        f"/inventarios-fisicos/{inventario['id']}/conteos",
        json={
            "id_variante": item["id_variante"],
            "stock_contado": str(stock_contado),
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )


def test_inventario_fisico_cierra_y_aplica_diferencia(client, db_conn, seed_venta_basica):
    inventario = _crear_inventario(client, seed_venta_basica)
    assert inventario["estado"] == "abierto"
    assert inventario["total_items"] == 1

    item = inventario["items"][0]
    assert item["categoria_nombre"] == "Lubricantes"
    assert item["tipo_operativo"] == "producto"
    conteo = _contar_item(client, inventario, item, seed_venta_basica, "4")
    assert conteo.status_code == 200, conteo.text
    assert Decimal(conteo.json()["diferencia"]) == Decimal("-2.000")

    cerrar = client.post(
        f"/inventarios-fisicos/{inventario['id']}/cerrar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert cerrar.status_code == 200, cerrar.text
    assert cerrar.json()["estado"] == "cerrado"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s AND id_variante = %s
            """,
            (seed_venta_basica["sucursal_id"], item["id_variante"]),
        )
        stock = cur.fetchone()

        cur.execute(
            """
            SELECT tipo_movimiento, origen_tipo, origen_id
            FROM movimientos_stock
            WHERE origen_tipo = 'inventario_fisico'
            """
        )
        movimiento = cur.fetchone()

    assert stock["stock_fisico"] == Decimal("4.000")
    assert movimiento["tipo_movimiento"] == "ajuste"
    assert movimiento["origen_id"] == inventario["id"]

    diferencias = client.get(
        "/inventarios-fisicos/diferencias",
        params={"id_sucursal": seed_venta_basica["sucursal_id"]},
    )
    assert diferencias.status_code == 200, diferencias.text
    data = diferencias.json()
    assert len(data) == 1
    assert data[0]["inventario_id"] == inventario["id"]
    assert data[0]["categoria_nombre"] == "Lubricantes"
    assert data[0]["tipo_operativo"] == "producto"
    assert Decimal(data[0]["diferencia"]) == Decimal("-2.000")


def test_inventario_fisico_cancelar_abierto_no_genera_movimientos_y_audita(
    client,
    db_conn,
    seed_venta_basica,
):
    inventario = _crear_inventario(client, seed_venta_basica, "Cancelar abierto")
    item = inventario["items"][0]

    conteo = _contar_item(client, inventario, item, seed_venta_basica, "5")
    assert conteo.status_code == 200, conteo.text

    cancelar = client.post(
        f"/inventarios-fisicos/{inventario['id']}/cancelar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    assert cancelar.status_code == 200, cancelar.text
    assert cancelar.json()["estado"] == "cancelado"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM movimientos_stock
            WHERE origen_tipo = 'inventario_fisico'
              AND origen_id = %s
            """,
            (inventario["id"],),
        )
        movimientos = cur.fetchone()

        cur.execute(
            """
            SELECT accion, detalle
            FROM auditoria_eventos
            WHERE entidad = 'inventario_fisico'
              AND entidad_id = %s
              AND accion = 'inventario_fisico_cancelado'
            """,
            (inventario["id"],),
        )
        auditoria = cur.fetchone()

    assert movimientos["total"] == 0
    assert auditoria is not None
    assert "cancelado" in auditoria["detalle"]


def test_inventario_fisico_no_permite_cancelar_cerrado(client, seed_venta_basica):
    inventario = _crear_inventario(client, seed_venta_basica, "Cerrar y no cancelar")
    item = inventario["items"][0]

    conteo = _contar_item(client, inventario, item, seed_venta_basica, "6")
    assert conteo.status_code == 200, conteo.text

    cerrar = client.post(
        f"/inventarios-fisicos/{inventario['id']}/cerrar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert cerrar.status_code == 200, cerrar.text

    cancelar = client.post(
        f"/inventarios-fisicos/{inventario['id']}/cancelar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    assert cancelar.status_code == 400
    assert "inventario abierto" in cancelar.json()["detail"]


def test_inventario_fisico_no_permite_contar_ni_cerrar_cancelado(
    client,
    seed_venta_basica,
):
    inventario = _crear_inventario(client, seed_venta_basica, "Cancelar bloquea")
    item = inventario["items"][0]

    cancelar = client.post(
        f"/inventarios-fisicos/{inventario['id']}/cancelar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert cancelar.status_code == 200, cancelar.text

    conteo = _contar_item(client, inventario, item, seed_venta_basica, "4")
    assert conteo.status_code == 400
    assert "inventario abierto" in conteo.json()["detail"]

    cerrar = client.post(
        f"/inventarios-fisicos/{inventario['id']}/cerrar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert cerrar.status_code == 400
    assert "inventario abierto" in cerrar.json()["detail"]


def test_inventario_fisico_stock_sistema_permanece_congelado(
    client,
    db_conn,
    seed_venta_basica,
):
    inventario = _crear_inventario(client, seed_venta_basica, "Snapshot congelado")
    item = inventario["items"][0]

    assert Decimal(item["stock_sistema"]) == Decimal("6.000")

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = 10
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_venta_basica["sucursal_id"], item["id_variante"]),
        )
    db_conn.commit()

    conteo = _contar_item(client, inventario, item, seed_venta_basica, "4")

    assert conteo.status_code == 200, conteo.text
    data = conteo.json()
    assert Decimal(data["stock_sistema"]) == Decimal("6.000")
    assert Decimal(data["stock_contado"]) == Decimal("4.000")
    assert Decimal(data["diferencia"]) == Decimal("-2.000")


def test_inventario_fisico_permite_conteo_por_categoria(
    client,
    seed_venta_basica,
):
    crear = client.post(
        "/inventarios-fisicos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "descripcion": "Conteo por categoria",
            "id_categoria": seed_venta_basica["categoria_id"],
            "tipo_operativo": "producto",
        },
    )

    assert crear.status_code == 201, crear.text
    inventario = crear.json()
    assert inventario["total_items"] == 1
    assert inventario["items"][0]["id_variante"] == seed_venta_basica["variante_id"]


def test_alertas_operativas_devuelve_stock_critico(client, seed_venta_basica):
    response = client.get("/alertas-operativas/?stock_umbral=10")

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["resumen"]["stock_critico"] >= 1
    assert any(
        item["id_variante"] == seed_venta_basica["variante_id"]
        for item in data["stock_critico"]
    )


def test_ficha_bicicleta_incluye_timeline(client, seed_taller_basico):
    response = client.get(
        f"/clientes/{seed_taller_basico['cliente_id']}/bicicletas/{seed_taller_basico['bicicleta_cliente_id']}/historial"
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "timeline" in data
    assert any(evento["tipo"] == "bicicleta_alta" for evento in data["timeline"])
