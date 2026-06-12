from decimal import Decimal


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _get_variante(conn, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM variantes
            WHERE id = %s
            """,
            (variante_id,),
        )
        return cur.fetchone()


def _get_producto(conn, producto_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM productos
            WHERE id = %s
            """,
            (producto_id,),
        )
        return cur.fetchone()


def test_crea_regla_precio_global(client, seed_venta_basica):
    response = client.post(
        "/precios/reglas",
        json={
            "nombre": "Repuestos minorista global",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["nombre"] == "Repuestos minorista global"
    assert data["tipo_cliente"] == "minorista"
    assert _dec(data["margen_porcentaje"]) == Decimal("120")
    assert _dec(data["redondeo_base"]) == Decimal("100.00")
    assert data["activa"] is True


def test_lista_reglas_precio(client, seed_venta_basica):
    crear = client.post(
        "/precios/reglas",
        json={
            "nombre": "Mayorista global",
            "tipo_cliente": "mayorista",
            "margen_porcentaje": "55",
            "redondeo_base": "100.00",
        },
    )
    assert crear.status_code == 200, crear.text

    response = client.get("/precios/reglas")

    assert response.status_code == 200, response.text

    data = response.json()
    assert len(data) >= 1
    assert any(r["nombre"] == "Mayorista global" for r in data)


def test_sugiere_precio_con_regla_global_minorista(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    variante = _get_variante(db_conn, variante_id)
    costo = _dec(variante["costo_promedio_vigente"])

    crear = client.post(
        "/precios/reglas",
        json={
            "nombre": "Minorista global +120",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )
    assert crear.status_code == 200, crear.text

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    esperado_sin_redondear = costo * Decimal("2.2000")
    esperado = (
        (esperado_sin_redondear / Decimal("100.00"))
        .to_integral_value(rounding="ROUND_CEILING")
        * Decimal("100.00")
    )

    assert data["id_variante"] == variante_id
    assert data["tipo_cliente"] == "minorista"
    assert _dec(data["precio_sugerido"]) == esperado
    assert data["regla_nombre"] == "Minorista global +120"


def test_sugerencia_no_modifica_precio_actual(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    variante_antes = _get_variante(db_conn, variante_id)

    crear = client.post(
        "/precios/reglas",
        json={
            "nombre": "Global no aplica directo",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )
    assert crear.status_code == 200, crear.text

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    variante_despues = _get_variante(db_conn, variante_id)

    assert _dec(variante_despues["precio_minorista"]) == _dec(
        variante_antes["precio_minorista"]
    )
    assert _dec(variante_despues["precio_mayorista"]) == _dec(
        variante_antes["precio_mayorista"]
    )


def test_desactiva_regla_precio(client, seed_venta_basica):
    crear = client.post(
        "/precios/reglas",
        json={
            "nombre": "Regla para desactivar",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "100",
            "redondeo_base": "100.00",
        },
    )
    assert crear.status_code == 200, crear.text

    regla_id = crear.json()["id"]

    response = client.post(
        f"/precios/reglas/{regla_id}/desactivar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["id"] == regla_id
    assert data["activa"] is False


def test_no_sugiere_si_no_hay_regla_activa(
    client,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "mayorista"},
    )

    assert response.status_code == 404
    assert "no hay regla" in response.json()["detail"].lower()


def test_prioriza_regla_mas_especifica_por_categoria(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    producto = _get_producto(db_conn, seed_venta_basica["producto_id"])
    categoria_id = producto["id_categoria"]

    global_rule = client.post(
        "/precios/reglas",
        json={
            "nombre": "Global minorista",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "50",
            "redondeo_base": "100.00",
        },
    )
    assert global_rule.status_code == 200, global_rule.text

    categoria_rule = client.post(
        "/precios/reglas",
        json={
            "nombre": "Categoria minorista",
            "id_categoria": categoria_id,
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )
    assert categoria_rule.status_code == 200, categoria_rule.text

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["regla_nombre"] == "Categoria minorista"
    assert _dec(data["margen_porcentaje"]) == Decimal("120")


def test_no_permite_crear_regla_con_categoria_inexistente(
    client,
    seed_venta_basica,
):
    response = client.post(
        "/precios/reglas",
        json={
            "nombre": "Categoria inexistente",
            "id_categoria": 999999,
            "tipo_cliente": "minorista",
            "margen_porcentaje": "120",
            "redondeo_base": "100.00",
        },
    )

    assert response.status_code == 400
    assert "no existe la categoría" in response.json()["detail"].lower()