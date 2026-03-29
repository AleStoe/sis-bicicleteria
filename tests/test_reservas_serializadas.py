import pytest

from tests.conftest import get_stock_row, get_venta


def _crear_bici_serializada(client, seed_reserva_serializada, numero_cuadro="CUADRO-RES-001"):
    return client.post(
        "/bicicletas_serializadas",
        json={
            "id_variante": seed_reserva_serializada["variante_id"],
            "id_sucursal_actual": seed_reserva_serializada["sucursal_id"],
            "numero_cuadro": numero_cuadro,
            "observaciones": "Alta test reserva serializada",
            "id_usuario": seed_reserva_serializada["usuario_id"],
        },
    )


def _crear_reserva_serializada(client, seed_reserva_serializada, bicicleta_id: int):
    return client.post(
        "/reservas/",
        json={
            "id_cliente": seed_reserva_serializada["cliente_id"],
            "id_sucursal": seed_reserva_serializada["sucursal_id"],
            "id_usuario": seed_reserva_serializada["usuario_id"],
            "nota": "Reserva serializada test",
            "items": [
                {
                    "id_variante": seed_reserva_serializada["variante_id"],
                    "id_bicicleta_serializada": bicicleta_id,
                    "cantidad": 1,
                    "precio_estimado": seed_reserva_serializada["precio_venta"],
                }
            ],
        },
    )


def _get_bicicleta_serializada(conn, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicletas_serializadas
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()


def _get_reserva(conn, reserva_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM reservas
            WHERE id = %s
            """,
            (reserva_id,),
        )
        return cur.fetchone()


def _get_reserva_items(conn, reserva_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM reserva_items
            WHERE id_reserva = %s
            ORDER BY id
            """,
            (reserva_id,),
        )
        return cur.fetchall()


@pytest.fixture()
def seed_reserva_serializada(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Reserva Serializada', 'admin_reserva_serializada', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO categorias (nombre)
            VALUES ('Bicicletas')
            RETURNING id
            """
        )
        categoria_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO productos (
                id_categoria,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                activo
            )
            VALUES (%s, 'Bicicleta Reserva Test', 'producto', TRUE, TRUE, TRUE)
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
                activo
            )
            VALUES (%s, 'R29 Azul', 'BICI-RES-R29-AZUL', 950000, 850000, 700000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Reserva Serializada', '2911234567', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Reserva Test', 'Direccion Reserva Test', TRUE)
            RETURNING id
            """
        )
        sucursal_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 1, 0, 0)
            RETURNING id
            """,
            (sucursal_id, variante_id),
        )
        stock_id = cur.fetchone()["id"]

    from tests.conftest import asignar_rol_usuario

    asignar_rol_usuario(db_conn, usuario_id, "administrador")
    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "sucursal_id": sucursal_id,
        "producto_id": producto_id,
        "variante_id": variante_id,
        "stock_id": stock_id,
        "precio_venta": 950000,
    }


def test_crear_reserva_con_serializada_la_pasa_a_reservada(client, db_conn, seed_reserva_serializada):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-OK-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    reserva_response = _crear_reserva_serializada(client, seed_reserva_serializada, bicicleta_id)
    assert reserva_response.status_code == 200, reserva_response.text

    reserva_id = reserva_response.json()["reserva_id"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "reservada"

    reserva = _get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "activa"

    items = _get_reserva_items(db_conn, reserva_id)
    assert len(items) == 1
    assert items[0]["id_bicicleta_serializada"] == bicicleta_id

    stock = get_stock_row(
        db_conn,
        seed_reserva_serializada["sucursal_id"],
        seed_reserva_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_reservado"]) == 1.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_no_permite_reservar_serializada_con_cantidad_distinta_de_1(client, seed_reserva_serializada):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-CANT-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    response = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_reserva_serializada["cliente_id"],
            "id_sucursal": seed_reserva_serializada["sucursal_id"],
            "id_usuario": seed_reserva_serializada["usuario_id"],
            "items": [
                {
                    "id_variante": seed_reserva_serializada["variante_id"],
                    "id_bicicleta_serializada": bicicleta_id,
                    "cantidad": 2,
                    "precio_estimado": seed_reserva_serializada["precio_venta"],
                }
            ],
        },
    )

    assert response.status_code == 422


def test_no_permite_reservar_serializada_no_disponible(client, seed_reserva_serializada):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-NODISP-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    r1 = _crear_reserva_serializada(client, seed_reserva_serializada, bicicleta_id)
    assert r1.status_code == 200, r1.text

    r2 = _crear_reserva_serializada(client, seed_reserva_serializada, bicicleta_id)
    assert r2.status_code == 400, r2.text


def test_cancelar_reserva_devuelve_serializada_a_disponible(client, db_conn, seed_reserva_serializada):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-CANCEL-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    reserva_response = _crear_reserva_serializada(client, seed_reserva_serializada, bicicleta_id)
    assert reserva_response.status_code == 200, reserva_response.text
    reserva_id = reserva_response.json()["reserva_id"]

    cancel_response = client.patch(
        f"/reservas/{reserva_id}/cancelar",
        json={
            "motivo": "cancelacion de prueba",
            "sena_perdida": False,
            "id_usuario": seed_reserva_serializada["usuario_id"],
        },
    )
    assert cancel_response.status_code == 200, cancel_response.text

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "disponible"

    reserva = _get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "cancelada"

    stock = get_stock_row(
        db_conn,
        seed_reserva_serializada["sucursal_id"],
        seed_reserva_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_vencer_reserva_devuelve_serializada_a_disponible(client, db_conn, seed_reserva_serializada):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-VENC-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    reserva_response = _crear_reserva_serializada(client, seed_reserva_serializada, bicicleta_id)
    assert reserva_response.status_code == 200, reserva_response.text
    reserva_id = reserva_response.json()["reserva_id"]

    vencer_response = client.patch(
        f"/reservas/{reserva_id}/vencer",
        json={
            "detalle": "vencimiento de prueba",
            "id_usuario": seed_reserva_serializada["usuario_id"],
        },
    )
    assert vencer_response.status_code == 200, vencer_response.text

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "disponible"

    reserva = _get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "vencida"

    stock = get_stock_row(
        db_conn,
        seed_reserva_serializada["sucursal_id"],
        seed_reserva_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_convertir_reserva_en_venta_pasa_serializada_a_vendida_pendiente(client, db_conn, seed_reserva_serializada):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-CONV-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    reserva_response = _crear_reserva_serializada(client, seed_reserva_serializada, bicicleta_id)
    assert reserva_response.status_code == 200, reserva_response.text
    reserva_id = reserva_response.json()["reserva_id"]

    convertir_response = client.post(
        f"/reservas/{reserva_id}/convertir-a-venta",
        json={
            "id_usuario": seed_reserva_serializada["usuario_id"],
            "observaciones": "conversion test",
        },
    )
    assert convertir_response.status_code == 200, convertir_response.text

    data = convertir_response.json()
    venta_id = data["venta_id"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "vendida_pendiente_entrega"

    reserva = _get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "convertida_en_venta"

    venta = get_venta(db_conn, venta_id)
    assert venta["id_reserva_origen"] == reserva_id

    stock = get_stock_row(
        db_conn,
        seed_reserva_serializada["sucursal_id"],
        seed_reserva_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0