from decimal import Decimal
import uuid

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


def _preparar_variante_para_precios(
    db_conn,
    *,
    variante_id: int,
    costo: str = "10000",
    precio_minorista: str = "20000",
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor test precios', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]

        cur.execute(
            """
            UPDATE variantes
            SET proveedor_preferido_id = %s,
                costo_promedio_vigente = %s,
                precio_minorista = %s
            WHERE id = %s
            """,
            (proveedor_id, costo, precio_minorista, variante_id),
        )

    db_conn.commit()
    return proveedor_id


def _crear_regla_minorista_130(client, nombre: str):
    response = client.post(
        "/precios/reglas",
        json={
            "nombre": nombre,
            "tipo_cliente": "minorista",
            "margen_porcentaje": "130",
            "descuento_base_porcentaje": "10",
            "margen_minimo_porcentaje": "100",
            "redondeo_base": "500",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


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


def test_crea_regla_precio_con_descuento_base_y_margen_minimo(
    client,
    seed_venta_basica,
):
    data = _crear_regla_minorista_130(
        client,
        "Regla minorista con descuento base",
    )

    assert data["nombre"] == "Regla minorista con descuento base"
    assert _dec(data["margen_porcentaje"]) == Decimal("130")
    assert _dec(data["descuento_base_porcentaje"]) == Decimal("10")
    assert _dec(data["margen_minimo_porcentaje"]) == Decimal("100")
    assert _dec(data["redondeo_base"]) == Decimal("500")


def test_sugiere_precio_lista_con_margen_descuento_y_redondeo(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )

    _crear_regla_minorista_130(
        client,
        "Global minorista 130 con descuento",
    )

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["costo_base"]) == Decimal("10000")
    assert _dec(data["precio_objetivo"]) == Decimal("23000")
    assert _dec(data["precio_lista"]) == Decimal("26000")
    assert _dec(data["precio_sugerido"]) == Decimal("26000")
    assert _dec(data["precio_final_estimado"]) == Decimal("23400.0")
    assert _dec(data["precio_minimo"]) == Decimal("20000")
    assert _dec(data["margen_porcentaje"]) == Decimal("130")
    assert _dec(data["descuento_base_porcentaje"]) == Decimal("10")
    assert _dec(data["margen_minimo_porcentaje"]) == Decimal("100")


def test_lista_precios_desfasados_usando_precio_lista(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )

    _crear_regla_minorista_130(
        client,
        "Global minorista desfasados",
    )

    response = client.get("/precios/desfasados?tipo_cliente=minorista")

    assert response.status_code == 200, response.text

    data = response.json()
    item = next(
        x for x in data["items"]
        if x["id_variante"] == variante_id
    )

    assert _dec(item["costo_base"]) == Decimal("10000")
    assert _dec(item["precio_actual"]) == Decimal("20000")
    assert _dec(item["precio_sugerido"]) == Decimal("26000")
    assert _dec(item["diferencia"]) == Decimal("6000")
    assert _dec(item["margen_esperado"]) == Decimal("130")
    assert _dec(item["margen_real"]) == Decimal("100")


def test_recalcula_precios_por_proveedor_sin_aplicar(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    proveedor_id = _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )

    _crear_regla_minorista_130(
        client,
        "Global minorista proveedor",
    )

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
    item = next(
        x for x in data["items"]
        if x["id_variante"] == variante_id
    )

    assert data["aplicado"] is False
    assert _dec(item["precio_actual"]) == Decimal("20000")
    assert _dec(item["precio_sugerido"]) == Decimal("26000")
    assert item["aplicado"] is False

    variante_despues = _get_variante(db_conn, variante_id)
    assert _dec(variante_despues["precio_minorista"]) == Decimal("20000")


def test_recalcula_precios_por_proveedor_aplicando_y_registra_movimiento(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    proveedor_id = _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )

    _crear_regla_minorista_130(
        client,
        "Global minorista aplicar",
    )

    response = client.post(
        "/precios/recalcular-proveedor",
        json={
            "id_proveedor": proveedor_id,
            "tipo_cliente": "minorista",
            "aplicar": True,
            "id_usuario": usuario_id,
            "motivo": "Recalculo test con precio lista",
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    item = next(
        x for x in data["items"]
        if x["id_variante"] == variante_id
    )

    assert data["aplicado"] is True
    assert item["aplicado"] is True
    assert _dec(item["precio_sugerido"]) == Decimal("26000")
    assert item["movimiento_id"] is not None

    variante_despues = _get_variante(db_conn, variante_id)
    assert _dec(variante_despues["precio_minorista"]) == Decimal("26000")

    movimientos = _get_precios_movimientos(db_conn, variante_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "cambio_margen"
    assert movimientos[0]["motivo"] == "Recalculo test con precio lista"



def _crear_familia_precio(db_conn, nombre="Familia test precios"):
    nombre = f"{nombre}-{uuid.uuid4().hex[:8]}"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO familias_precio (
                nombre,
                descripcion,
                activa
            )
            VALUES (
                %s,
                'Familia para tests de precios',
                TRUE
            )
            RETURNING id
            """,
            (nombre,),
        )

        familia_id = cur.fetchone()["id"]

    db_conn.commit()

    return familia_id


def _asignar_familia_a_variante(db_conn, variante_id: int, familia_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE productos p
            SET id_familia_precio = %s
            FROM variantes v
            WHERE v.id_producto = p.id
              AND v.id = %s
            """,
            (familia_id, variante_id),
        )

    db_conn.commit()


def _crear_regla_precio(
    client,
    *,
    nombre: str,
    tipo_cliente: str = "minorista",
    margen: str = "130",
    descuento: str = "0",
    margen_minimo: str = "0",
    redondeo: str = "500",
    id_categoria=None,
    id_marca=None,
    id_familia_precio=None,
    id_proveedor=None,
):
    payload = {
        "nombre": nombre,
        "tipo_cliente": tipo_cliente,
        "margen_porcentaje": margen,
        "descuento_base_porcentaje": descuento,
        "margen_minimo_porcentaje": margen_minimo,
        "redondeo_base": redondeo,
    }

    if id_categoria is not None:
        payload["id_categoria"] = id_categoria

    if id_marca is not None:
        payload["id_marca"] = id_marca

    if id_familia_precio is not None:
        payload["id_familia_precio"] = id_familia_precio

    if id_proveedor is not None:
        payload["id_proveedor"] = id_proveedor

    response = client.post("/precios/reglas", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def _get_contexto_producto_variante(db_conn, variante_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id AS id_variante,
                v.proveedor_preferido_id,
                p.id AS id_producto,
                p.id_categoria,
                p.id_marca,
                p.id_familia_precio
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            """,
            (variante_id,),
        )
        return cur.fetchone()


def test_crea_regla_precio_con_familia_y_proveedor(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    proveedor_id = _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )
    familia_id = _crear_familia_precio(db_conn, "Familia regla proveedor")
    _asignar_familia_a_variante(db_conn, variante_id, familia_id)

    data = _crear_regla_precio(
        client,
        nombre="Regla proveedor familia",
        margen="80",
        id_familia_precio=familia_id,
        id_proveedor=proveedor_id,
    )

    assert data["nombre"] == "Regla proveedor familia"
    assert data["id_familia_precio"] == familia_id
    assert data["id_proveedor"] == proveedor_id
    assert data["familia_precio_nombre"].startswith("Familia regla proveedor")
    assert data["proveedor_nombre"] is not None
    assert _dec(data["margen_porcentaje"]) == Decimal("80")


def test_prioridad_proveedor_familia_gana_sobre_familia_general(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    proveedor_id = _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )
    familia_id = _crear_familia_precio(db_conn, "Familia prioridad proveedor")
    _asignar_familia_a_variante(db_conn, variante_id, familia_id)

    _crear_regla_precio(
        client,
        nombre="Familia general 150",
        margen="150",
        id_familia_precio=familia_id,
    )

    _crear_regla_precio(
        client,
        nombre="Proveedor familia 80",
        margen="80",
        id_familia_precio=familia_id,
        id_proveedor=proveedor_id,
    )

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["regla_nombre"] == "Proveedor familia 80"
    assert _dec(data["precio_sugerido"]) == Decimal("18000")


def test_prioridad_familia_gana_sobre_categoria_marca(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )
    familia_id = _crear_familia_precio(db_conn, "Familia sobre categoria")
    _asignar_familia_a_variante(db_conn, variante_id, familia_id)

    contexto = _get_contexto_producto_variante(db_conn, variante_id)

    _crear_regla_precio(
        client,
        nombre="Categoria marca 100",
        margen="100",
        id_categoria=contexto["id_categoria"],
        id_marca=contexto["id_marca"],
    )

    _crear_regla_precio(
        client,
        nombre="Familia 150",
        margen="150",
        id_familia_precio=familia_id,
    )

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["regla_nombre"] == "Familia 150"
    assert _dec(data["precio_sugerido"]) == Decimal("25000")


def test_fallback_categoria_sin_familia_ni_proveedor(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE productos p
            SET id_familia_precio = NULL
            FROM variantes v
            WHERE v.id_producto = p.id
              AND v.id = %s
            """,
            (variante_id,),
        )

        cur.execute(
            """
            UPDATE variantes
            SET proveedor_preferido_id = NULL
            WHERE id = %s
            """,
            (variante_id,),
        )

    db_conn.commit()

    contexto = _get_contexto_producto_variante(db_conn, variante_id)

    _crear_regla_precio(
        client,
        nombre="Categoria fallback 100",
        margen="100",
        id_categoria=contexto["id_categoria"],
    )

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["regla_nombre"] == "Categoria fallback 100"
    assert _dec(data["precio_sugerido"]) == Decimal("20000")


def test_fallback_global_sin_reglas_especificas(
    client,
    db_conn,
    seed_venta_basica,
):
    variante_id = seed_venta_basica["variante_id"]

    _preparar_variante_para_precios(
        db_conn,
        variante_id=variante_id,
    )

    with db_conn.cursor() as cur:
        cur.execute("DELETE FROM reglas_precio")
        cur.execute(
            """
            UPDATE productos p
            SET id_familia_precio = NULL,
                id_marca = NULL
            FROM variantes v
            WHERE v.id_producto = p.id
              AND v.id = %s
            """,
            (variante_id,),
        )

        cur.execute(
            """
            UPDATE variantes
            SET proveedor_preferido_id = NULL
            WHERE id = %s
            """,
            (variante_id,),
        )

    db_conn.commit()

    _crear_regla_precio(
        client,
        nombre="Global fallback 130",
        margen="130",
        descuento="10",
        margen_minimo="100",
        redondeo="500",
    )

    response = client.post(
        f"/precios/variantes/{variante_id}/sugerir",
        json={"tipo_cliente": "minorista"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["regla_nombre"] == "Global fallback 130"
    assert _dec(data["precio_sugerido"]) == Decimal("26000")