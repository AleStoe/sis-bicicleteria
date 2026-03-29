import pytest

from tests.conftest import get_stock_row, get_venta


def _crear_bici_serializada(client, seed_venta_devolucion_serializada, numero_cuadro="CUADRO-DEV-001"):
    return client.post(
        "/bicicletas_serializadas",
        json={
            "id_variante": seed_venta_devolucion_serializada["variante_id"],
            "id_sucursal_actual": seed_venta_devolucion_serializada["sucursal_id"],
            "numero_cuadro": numero_cuadro,
            "observaciones": "Alta test devolución serializada",
            "id_usuario": seed_venta_devolucion_serializada["usuario_id"],
        },
    )


def _crear_venta_serializada(client, seed_venta_devolucion_serializada, bicicleta_id: int):
    return client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_devolucion_serializada["cliente_id"],
            "id_sucursal": seed_venta_devolucion_serializada["sucursal_id"],
            "id_usuario": seed_venta_devolucion_serializada["usuario_id"],
            "usar_credito": False,
            "items": [
                {
                    "id_variante": seed_venta_devolucion_serializada["variante_id"],
                    "id_bicicleta_serializada": bicicleta_id,
                    "cantidad": 1,
                }
            ],
        },
    )


def _marcar_venta_como_pagada_total(db_conn, venta_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET
                saldo_pendiente = 0,
                estado = 'pagada_total'
            WHERE id = %s
            """,
            (venta_id,),
        )
    db_conn.commit()


def _entregar_venta(client, seed_venta_devolucion_serializada, venta_id: int):
    return client.post(
        f"/ventas/{venta_id}/entregar",
        json={
            "id_usuario": seed_venta_devolucion_serializada["usuario_id"],
        },
    )


def _devolver_serializada(client, seed_venta_devolucion_serializada, venta_id: int, bicicleta_id: int):
    return client.post(
        f"/ventas/{venta_id}/devolver-serializada",
        json={
            "id_bicicleta_serializada": bicicleta_id,
            "motivo": "Devolución de prueba",
            "id_usuario": seed_venta_devolucion_serializada["usuario_id"],
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


def _get_venta_item_by_bicicleta(conn, venta_id: int, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM venta_items
            WHERE id_venta = %s
              AND id_bicicleta_serializada = %s
            """,
            (venta_id, bicicleta_id),
        )
        return cur.fetchone()


def _get_venta_devolucion_by_venta_item(conn, venta_item_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM venta_devoluciones
            WHERE id_venta_item = %s
            """,
            (venta_item_id,),
        )
        return cur.fetchone()


def _contar_movimientos_devolucion_venta(conn, venta_id: int, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS cantidad
            FROM movimientos_stock
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
              AND id_variante = %s
              AND tipo_movimiento = 'devolucion_venta'
            """,
            (venta_id, variante_id),
        )
        return cur.fetchone()["cantidad"]


@pytest.fixture()
def seed_venta_devolucion_serializada(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Devolucion Serializada', 'admin_dev_serializada', 'hash_dummy', TRUE)
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
            VALUES (%s, 'Bicicleta Devolucion Test', 'producto', TRUE, TRUE, TRUE)
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
            VALUES (%s, 'R29 Negra', 'BICI-DEV-R29-NEGRA', 990000, 890000, 720000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Devolucion Serializada', '2915555555', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Devolucion Test', 'Direccion Devolucion Test', TRUE)
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
        "precio_venta": 990000,
    }


def test_devolucion_serializada_exitosa(client, db_conn, seed_venta_devolucion_serializada):
    bici_response = _crear_bici_serializada(client, seed_venta_devolucion_serializada, "CUADRO-DEV-OK-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    venta_response = _crear_venta_serializada(client, seed_venta_devolucion_serializada, bicicleta_id)
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    _marcar_venta_como_pagada_total(db_conn, venta_id)

    entrega_response = _entregar_venta(client, seed_venta_devolucion_serializada, venta_id)
    assert entrega_response.status_code == 200, entrega_response.text

    stock_post_entrega = get_stock_row(
        db_conn,
        seed_venta_devolucion_serializada["sucursal_id"],
        seed_venta_devolucion_serializada["variante_id"],
    )
    assert float(stock_post_entrega["stock_fisico"]) == 0.0
    assert float(stock_post_entrega["stock_reservado"]) == 0.0
    assert float(stock_post_entrega["stock_vendido_pendiente_entrega"]) == 0.0

    devolucion_response = _devolver_serializada(
        client,
        seed_venta_devolucion_serializada,
        venta_id,
        bicicleta_id,
    )
    assert devolucion_response.status_code == 200, devolucion_response.text

    data = devolucion_response.json()
    assert data["venta_id"] == venta_id
    assert data["id_bicicleta_serializada"] == bicicleta_id
    assert data["estado_bicicleta"] == "disponible"

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "disponible"

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"

    venta_item = _get_venta_item_by_bicicleta(db_conn, venta_id, bicicleta_id)
    assert venta_item is not None

    devolucion = _get_venta_devolucion_by_venta_item(db_conn, venta_item["id"])
    assert devolucion is not None
    assert devolucion["id_venta"] == venta_id
    assert devolucion["id_venta_item"] == venta_item["id"]
    assert devolucion["id_bicicleta_serializada"] == bicicleta_id
    assert devolucion["id_sucursal_reingreso"] == seed_venta_devolucion_serializada["sucursal_id"]

    stock = get_stock_row(
        db_conn,
        seed_venta_devolucion_serializada["sucursal_id"],
        seed_venta_devolucion_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    cantidad_movs = _contar_movimientos_devolucion_venta(
        db_conn,
        venta_id,
        seed_venta_devolucion_serializada["variante_id"],
    )
    assert cantidad_movs == 1


def test_no_permite_devolver_venta_no_entregada(client, db_conn, seed_venta_devolucion_serializada):
    bici_response = _crear_bici_serializada(client, seed_venta_devolucion_serializada, "CUADRO-DEV-NOENT-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    venta_response = _crear_venta_serializada(client, seed_venta_devolucion_serializada, bicicleta_id)
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    devolucion_response = _devolver_serializada(
        client,
        seed_venta_devolucion_serializada,
        venta_id,
        bicicleta_id,
    )
    assert devolucion_response.status_code == 400, devolucion_response.text

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "vendida_pendiente_entrega"

    stock = get_stock_row(
        db_conn,
        seed_venta_devolucion_serializada["sucursal_id"],
        seed_venta_devolucion_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0


def test_no_permite_devolver_serializada_que_no_pertenece_a_la_venta(client, db_conn, seed_venta_devolucion_serializada):
    bici_venta_response = _crear_bici_serializada(client, seed_venta_devolucion_serializada, "CUADRO-DEV-PROP-001")
    assert bici_venta_response.status_code == 200, bici_venta_response.text
    bicicleta_venta_id = bici_venta_response.json()["bicicleta_id"]

    bici_otra_response = _crear_bici_serializada(client, seed_venta_devolucion_serializada, "CUADRO-DEV-PROP-002")
    assert bici_otra_response.status_code == 200, bici_otra_response.text
    bicicleta_otra_id = bici_otra_response.json()["bicicleta_id"]

    venta_response = _crear_venta_serializada(client, seed_venta_devolucion_serializada, bicicleta_venta_id)
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    _marcar_venta_como_pagada_total(db_conn, venta_id)

    entrega_response = _entregar_venta(client, seed_venta_devolucion_serializada, venta_id)
    assert entrega_response.status_code == 200, entrega_response.text

    devolucion_response = _devolver_serializada(
        client,
        seed_venta_devolucion_serializada,
        venta_id,
        bicicleta_otra_id,
    )
    assert devolucion_response.status_code == 400, devolucion_response.text

    bicicleta_venta = _get_bicicleta_serializada(db_conn, bicicleta_venta_id)
    assert bicicleta_venta["estado"] == "entregada"

    bicicleta_otra = _get_bicicleta_serializada(db_conn, bicicleta_otra_id)
    assert bicicleta_otra["estado"] == "disponible"

    stock = get_stock_row(
        db_conn,
        seed_venta_devolucion_serializada["sucursal_id"],
        seed_venta_devolucion_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 0.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_no_permite_doble_devolucion_del_mismo_item(client, db_conn, seed_venta_devolucion_serializada):
    bici_response = _crear_bici_serializada(client, seed_venta_devolucion_serializada, "CUADRO-DEV-DOBLE-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    venta_response = _crear_venta_serializada(client, seed_venta_devolucion_serializada, bicicleta_id)
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    _marcar_venta_como_pagada_total(db_conn, venta_id)

    entrega_response = _entregar_venta(client, seed_venta_devolucion_serializada, venta_id)
    assert entrega_response.status_code == 200, entrega_response.text

    primera = _devolver_serializada(
        client,
        seed_venta_devolucion_serializada,
        venta_id,
        bicicleta_id,
    )
    assert primera.status_code == 200, primera.text

    segunda = _devolver_serializada(
        client,
        seed_venta_devolucion_serializada,
        venta_id,
        bicicleta_id,
    )
    assert segunda.status_code == 400, segunda.text

    venta_item = _get_venta_item_by_bicicleta(db_conn, venta_id, bicicleta_id)
    devolucion = _get_venta_devolucion_by_venta_item(db_conn, venta_item["id"])
    assert devolucion is not None

    cantidad_movs = _contar_movimientos_devolucion_venta(
        db_conn,
        venta_id,
        seed_venta_devolucion_serializada["variante_id"],
    )
    assert cantidad_movs == 1

    stock = get_stock_row(
        db_conn,
        seed_venta_devolucion_serializada["sucursal_id"],
        seed_venta_devolucion_serializada["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_deja_fila_en_venta_devoluciones(client, db_conn, seed_venta_devolucion_serializada):
    bici_response = _crear_bici_serializada(client, seed_venta_devolucion_serializada, "CUADRO-DEV-FILA-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    venta_response = _crear_venta_serializada(client, seed_venta_devolucion_serializada, bicicleta_id)
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    _marcar_venta_como_pagada_total(db_conn, venta_id)

    entrega_response = _entregar_venta(client, seed_venta_devolucion_serializada, venta_id)
    assert entrega_response.status_code == 200, entrega_response.text

    devolucion_response = _devolver_serializada(
        client,
        seed_venta_devolucion_serializada,
        venta_id,
        bicicleta_id,
    )
    assert devolucion_response.status_code == 200, devolucion_response.text

    venta_item = _get_venta_item_by_bicicleta(db_conn, venta_id, bicicleta_id)
    assert venta_item is not None

    devolucion = _get_venta_devolucion_by_venta_item(db_conn, venta_item["id"])
    assert devolucion is not None
    assert devolucion["id_venta"] == venta_id
    assert devolucion["id_venta_item"] == venta_item["id"]
    assert devolucion["id_bicicleta_serializada"] == bicicleta_id
    assert devolucion["motivo"] == "Devolución de prueba"
    assert devolucion["id_usuario"] == seed_venta_devolucion_serializada["usuario_id"]