from decimal import Decimal


def _dec(value) -> Decimal:
    return Decimal(str(value))


def test_lista_precio_desfasado_minorista(
    client,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Minorista global +120",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    response = client.get("/precios/desfasados?tipo_cliente=minorista")

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total"] == 1

    item = data["items"][0]
    assert item["id_variante"] == variante_id
    assert item["tipo_cliente"] == "minorista"
    assert _dec(item["costo_base"]) == Decimal("10000.0000")
    assert _dec(item["precio_actual"]) == Decimal("24440.00")
    assert _dec(item["precio_sugerido"]) == Decimal("22000.00")
    assert _dec(item["diferencia"]) == Decimal("-2440.00")
    assert item["regla_nombre"] == "Minorista global +120"


def test_no_lista_si_precio_ya_coincide_con_sugerido(
    client,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Minorista global exacta",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    actualizar = client.post(
        f"/precios/variantes/{variante_id}/actualizar",
        json={
            "precio_minorista": "22000.00",
            "precio_mayorista": "20000.00",
            "motivo": "Ajustar a precio sugerido",
            "id_usuario": usuario_id,
        },
    )
    assert actualizar.status_code == 200, actualizar.text

    response = client.get("/precios/desfasados?tipo_cliente=minorista")

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_lista_precio_desfasado_mayorista(
    client,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Mayorista global +55",
            "tipo_cliente": "mayorista",
            "margen_porcentaje": "55",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    response = client.get("/precios/desfasados?tipo_cliente=mayorista")

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total"] == 1

    item = data["items"][0]
    assert item["id_variante"] == variante_id
    assert item["tipo_cliente"] == "mayorista"
    assert _dec(item["precio_actual"]) == Decimal("20000.00")
    assert _dec(item["precio_sugerido"]) == Decimal("15500.00")
    assert _dec(item["diferencia"]) == Decimal("-4500.00")
    assert item["regla_nombre"] == "Mayorista global +55"


def test_desfasados_filtra_por_categoria(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_categoria
            FROM productos
            WHERE id = %s
            """,
            (seed_venta_basica["producto_id"],),
        )
        categoria_id = cur.fetchone()["id_categoria"]

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Categoria minorista +120",
            "id_categoria": categoria_id,
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    response = client.get(
        f"/precios/desfasados?tipo_cliente=minorista&id_categoria={categoria_id}"
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["id_variante"] == variante_id

    response_sin_resultado = client.get(
        "/precios/desfasados?tipo_cliente=minorista&id_categoria=999999"
    )

    assert response_sin_resultado.status_code == 200
    assert response_sin_resultado.json()["total"] == 0


def test_desfasados_no_devuelve_items_si_no_hay_regla(
    client,
    seed_venta_basica,
):
    response = client.get("/precios/desfasados?tipo_cliente=minorista")

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []