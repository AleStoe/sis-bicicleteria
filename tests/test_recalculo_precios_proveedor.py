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


def _get_precios_movimientos(conn, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM precios_movimientos
            WHERE id_variante = %s
            ORDER BY id
            """,
            (variante_id,),
        )
        return cur.fetchall()


def _asignar_proveedor_a_variante(db_conn, variante_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor Test Pricing', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]

        cur.execute(
            """
            UPDATE variantes
            SET proveedor_preferido_id = %s
            WHERE id = %s
            """,
            (proveedor_id, variante_id),
        )

    db_conn.commit()
    return proveedor_id


def test_preview_recalculo_por_proveedor_no_modifica_precio(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    proveedor_id = _asignar_proveedor_a_variante(db_conn, variante_id)

    variante_antes = _get_variante(db_conn, variante_id)

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Minorista proveedor +120",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "1.2000",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    response = client.post(
        "/precios/recalcular-proveedor",
        json={
            "id_proveedor": proveedor_id,
            "tipo_cliente": "minorista",
            "aplicar": False,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["aplicado"] is False
    assert data["total_detectados"] == 1
    assert data["total_aplicados"] == 0

    item = data["items"][0]
    assert item["id_variante"] == variante_id
    assert item["aplicado"] is False
    assert item["movimiento_id"] is None
    assert _dec(item["precio_actual"]) == _dec(variante_antes["precio_minorista"])
    assert _dec(item["precio_sugerido"]) == Decimal("22000.00")

    variante_despues = _get_variante(db_conn, variante_id)
    assert _dec(variante_despues["precio_minorista"]) == _dec(
        variante_antes["precio_minorista"]
    )

    movimientos = _get_precios_movimientos(db_conn, variante_id)
    assert movimientos == []


def test_aplica_recalculo_por_proveedor_y_registra_movimiento(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_venta_basica["usuario_id"]
    proveedor_id = _asignar_proveedor_a_variante(db_conn, variante_id)

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Minorista proveedor aplicar",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "1.2000",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    response = client.post(
        "/precios/recalcular-proveedor",
        json={
            "id_proveedor": proveedor_id,
            "tipo_cliente": "minorista",
            "aplicar": True,
            "id_usuario": usuario_id,
            "motivo": "Ajuste por aumento proveedor",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["aplicado"] is True
    assert data["total_detectados"] == 1
    assert data["total_aplicados"] == 1

    item = data["items"][0]
    assert item["aplicado"] is True
    assert item["movimiento_id"] is not None
    assert _dec(item["precio_sugerido"]) == Decimal("22000.00")

    variante = _get_variante(db_conn, variante_id)
    assert _dec(variante["precio_minorista"]) == Decimal("22000.00")

    movimientos = _get_precios_movimientos(db_conn, variante_id)
    assert len(movimientos) == 1

    mov = movimientos[0]
    assert mov["tipo_movimiento"] == "cambio_margen"
    assert mov["motivo"] == "Ajuste por aumento proveedor"
    assert mov["origen_tipo"] == "proveedor"
    assert mov["origen_id"] == proveedor_id
    assert _dec(mov["precio_minorista_nuevo"]) == Decimal("22000.00")


def test_no_permite_aplicar_recalculo_sin_usuario(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    proveedor_id = _asignar_proveedor_a_variante(db_conn, variante_id)

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Minorista requiere usuario",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "1.2000",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    response = client.post(
        "/precios/recalcular-proveedor",
        json={
            "id_proveedor": proveedor_id,
            "tipo_cliente": "minorista",
            "aplicar": True,
        },
    )

    assert response.status_code == 400
    assert "id_usuario" in response.json()["detail"]


def test_no_toca_variantes_con_precio_libre(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    proveedor_id = _asignar_proveedor_a_variante(db_conn, variante_id)

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET permite_precio_libre = TRUE
            WHERE id = %s
            """,
            (variante_id,),
        )
    db_conn.commit()

    regla = client.post(
        "/precios/reglas",
        json={
            "nombre": "Minorista precio libre ignorado",
            "tipo_cliente": "minorista",
            "margen_porcentaje": "1.2000",
            "redondeo_base": "100.00",
        },
    )
    assert regla.status_code == 200, regla.text

    response = client.post(
        "/precios/recalcular-proveedor",
        json={
            "id_proveedor": proveedor_id,
            "tipo_cliente": "minorista",
            "aplicar": True,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["total_detectados"] == 0
    assert data["total_aplicados"] == 0

    movimientos = _get_precios_movimientos(db_conn, variante_id)
    assert movimientos == []


def test_recalculo_proveedor_inexistente_devuelve_404(
    client,
    seed_venta_basica,
):
    response = client.post(
        "/precios/recalcular-proveedor",
        json={
            "id_proveedor": 999999,
            "tipo_cliente": "minorista",
            "aplicar": False,
        },
    )

    assert response.status_code == 404
    assert "no existe" in response.json()["detail"].lower()