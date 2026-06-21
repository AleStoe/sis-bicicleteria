from decimal import Decimal


def _dec(value):
    return Decimal(str(value))


def _seed_ajuste_proveedor(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Precios', 'admin_precios', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Topmega Test', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO categorias (nombre, activo)
            VALUES ('Accesorios Test', TRUE)
            RETURNING id
            """
        )
        categoria_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO productos (id_categoria, nombre, tipo_item, stockeable, serializable, activo)
            VALUES (%s, 'Producto proveedor test', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_id,),
        )
        producto_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO variantes (
                id_producto,
                nombre_variante,
                sku,
                precio_minorista,
                precio_mayorista,
                costo_promedio_vigente,
                proveedor_preferido_id,
                activo
            )
            VALUES
                (%s, 'VAR A', 'TOP-A', 10000, 8000, 5000, %s, TRUE),
                (%s, 'VAR B', 'TOP-B', 15555, 12000, 7000, %s, TRUE)
            RETURNING id
            """,
            (producto_id, proveedor_id, producto_id, proveedor_id),
        )
        variante_ids = [row["id"] for row in cur.fetchall()]

    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "proveedor_id": proveedor_id,
        "producto_id": producto_id,
        "variante_ids": variante_ids,
    }


def test_preview_ajuste_proveedor_porcentaje_no_modifica_precios(client, db_conn, clean_db):
    seed = _seed_ajuste_proveedor(db_conn, clean_db)

    response = client.post(
        "/precios/ajuste-proveedor",
        json={
            "id_proveedor": seed["proveedor_id"],
            "aplicar_sobre": "ambos",
            "tipo_ajuste": "porcentaje",
            "valor": "15",
            "aplicar": False,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["aplicado"] is False
    assert data["total_detectados"] == 2
    assert data["total_aplicados"] == 0

    first = data["items"][0]
    assert _dec(first["precio_minorista_actual"]) == Decimal("10000")
    assert _dec(first["precio_minorista_nuevo"]) == Decimal("11500")
    assert _dec(first["precio_mayorista_actual"]) == Decimal("8000")
    assert _dec(first["precio_mayorista_nuevo"]) == Decimal("9200")

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT precio_minorista, precio_mayorista
            FROM variantes
            WHERE id = %s
            """,
            (first["id_variante"],),
        )
        row = cur.fetchone()

    assert _dec(row["precio_minorista"]) == Decimal("10000")
    assert _dec(row["precio_mayorista"]) == Decimal("8000")


def test_aplica_ajuste_proveedor_y_registra_historial(client, db_conn, clean_db):
    seed = _seed_ajuste_proveedor(db_conn, clean_db)

    response = client.post(
        "/precios/ajuste-proveedor",
        json={
            "id_proveedor": seed["proveedor_id"],
            "aplicar_sobre": "minorista",
            "tipo_ajuste": "monto_fijo",
            "valor": "1000",
            "aplicar": True,
            "id_usuario": seed["usuario_id"],
            "motivo": "Aumento lista proveedor",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["aplicado"] is True
    assert data["total_detectados"] == 2
    assert data["total_aplicados"] == 2

    first = data["items"][0]
    assert _dec(first["precio_minorista_nuevo"]) == Decimal("11000")
    assert _dec(first["precio_mayorista_nuevo"]) == Decimal("8000")
    assert first["movimiento_id"] is not None

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT precio_minorista, precio_mayorista
            FROM variantes
            WHERE id = %s
            """,
            (first["id_variante"],),
        )
        variante = cur.fetchone()

        cur.execute(
            """
            SELECT *
            FROM precios_movimientos
            WHERE id_variante = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (first["id_variante"],),
        )
        movimiento = cur.fetchone()

    assert _dec(variante["precio_minorista"]) == Decimal("11000")
    assert _dec(variante["precio_mayorista"]) == Decimal("8000")
    assert movimiento["tipo_movimiento"] == "actualizacion_por_lista_proveedor"
    assert movimiento["origen_tipo"] == "proveedor"
    assert movimiento["origen_id"] == seed["proveedor_id"]
    assert movimiento["id_usuario"] == seed["usuario_id"]
