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


def test_obtiene_precio_de_variante(client, seed_venta_basica):
    variante_id = seed_venta_basica["variante_id"]

    response = client.get(f"/precios/variantes/{variante_id}")

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["id"] == variante_id
    assert data["precio_minorista"] is not None
    assert data["precio_mayorista"] is not None
    assert data["costo_promedio_vigente"] is not None


def test_actualiza_precio_y_registra_movimiento(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    variante_antes = _get_variante(db_conn, variante_id)

    response = client.post(
        f"/precios/variantes/{variante_id}/actualizar",
        json={
            "precio_minorista": "35000.00",
            "precio_mayorista": "28000.00",
            "motivo": "Actualización manual de prueba",
            "id_usuario": usuario_id,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["id_variante"] == variante_id
    assert data["movimiento_id"] is not None

    variante_despues = _get_variante(db_conn, variante_id)
    assert _dec(variante_despues["precio_minorista"]) == Decimal("35000.00")
    assert _dec(variante_despues["precio_mayorista"]) == Decimal("28000.00")

    movimientos = _get_precios_movimientos(db_conn, variante_id)
    assert len(movimientos) == 1

    mov = movimientos[0]
    assert mov["tipo_movimiento"] == "actualizacion_manual"
    assert mov["motivo"] == "Actualización manual de prueba"
    assert _dec(mov["precio_minorista_anterior"]) == _dec(variante_antes["precio_minorista"])
    assert _dec(mov["precio_minorista_nuevo"]) == Decimal("35000.00")
    assert _dec(mov["precio_mayorista_anterior"]) == _dec(variante_antes["precio_mayorista"])
    assert _dec(mov["precio_mayorista_nuevo"]) == Decimal("28000.00")
    assert _dec(mov["costo_anterior"]) == _dec(variante_antes["costo_promedio_vigente"])
    assert _dec(mov["costo_nuevo"]) == _dec(variante_antes["costo_promedio_vigente"])


def test_no_permite_actualizar_precio_sin_cambios(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_venta_basica["usuario_id"]
    variante = _get_variante(db_conn, variante_id)

    response = client.post(
        f"/precios/variantes/{variante_id}/actualizar",
        json={
            "precio_minorista": str(variante["precio_minorista"]),
            "precio_mayorista": str(variante["precio_mayorista"]),
            "motivo": "No debería registrar nada",
            "id_usuario": usuario_id,
        },
    )

    assert response.status_code == 400
    assert "no hay cambios" in response.json()["detail"].lower()

    movimientos = _get_precios_movimientos(db_conn, variante_id)
    assert movimientos == []


def test_historial_de_precios(
    client,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    actualizar = client.post(
        f"/precios/variantes/{variante_id}/actualizar",
        json={
            "precio_minorista": "41000.00",
            "precio_mayorista": "33000.00",
            "motivo": "Actualización para historial",
            "id_usuario": usuario_id,
        },
    )
    assert actualizar.status_code == 200, actualizar.text

    response = client.get(f"/precios/variantes/{variante_id}/historial")

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["variante"]["id"] == variante_id
    assert len(data["movimientos"]) == 1
    assert data["movimientos"][0]["tipo_movimiento"] == "actualizacion_manual"
    assert data["movimientos"][0]["motivo"] == "Actualización para historial"


def test_no_permite_actualizar_variante_inexistente(client, seed_venta_basica):
    usuario_id = seed_venta_basica["usuario_id"]

    response = client.post(
        "/precios/variantes/999999/actualizar",
        json={
            "precio_minorista": "1000.00",
            "precio_mayorista": "800.00",
            "motivo": "Variante inexistente",
            "id_usuario": usuario_id,
        },
    )

    assert response.status_code == 404
    assert "no existe" in response.json()["detail"].lower()