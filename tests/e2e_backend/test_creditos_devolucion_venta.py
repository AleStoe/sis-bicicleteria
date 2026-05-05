from decimal import Decimal

from tests.conftest import get_venta, asignar_rol_usuario


def _dec(v):
    return Decimal(str(v))


def _crear_seed(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Credito Devolucion', 'admin_credito_dev', 'hash_dummy', TRUE)
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
            VALUES (%s, 'Bicicleta Credito Dev Test', 'producto', TRUE, TRUE, TRUE)
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
            VALUES (%s, 'R29 Credito', 'BICI-CRED-DEV-R29', 990000, 890000, 720000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Credito Dev', '2915555555', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Credito Dev', 'Direccion Credito Dev', TRUE)
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
            """,
            (sucursal_id, variante_id),
        )

    asignar_rol_usuario(db_conn, usuario_id, "administrador")
    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "sucursal_id": sucursal_id,
        "producto_id": producto_id,
        "variante_id": variante_id,
        "precio_venta": 990000,
    }


def _crear_bici_serializada(client, seed, numero_cuadro="CUADRO-CRED-DEV-001"):
    return client.post(
        "/bicicletas_serializadas",
        json={
            "id_variante": seed["variante_id"],
            "id_sucursal_actual": seed["sucursal_id"],
            "numero_cuadro": numero_cuadro,
            "observaciones": "Alta test crédito por devolución",
            "id_usuario": seed["usuario_id"],
        },
    )


def _crear_venta_serializada(client, seed, bicicleta_id: int):
    return client.post(
        "/ventas/",
        json={
            "id_cliente": seed["cliente_id"],
            "id_sucursal": seed["sucursal_id"],
            "id_usuario": seed["usuario_id"],
            "usar_credito": False,
            "items": [
                {
                    "id_variante": seed["variante_id"],
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
            SET saldo_pendiente = 0,
                estado = 'pagada_total'
            WHERE id = %s
            """,
            (venta_id,),
        )
    db_conn.commit()


def _entregar_venta(client, seed, venta_id: int):
    return client.post(
        f"/ventas/{venta_id}/entregar",
        json={
            "id_usuario": seed["usuario_id"],
        },
    )


def _devolver_serializada(client, seed, venta_id: int, bicicleta_id: int):
    return client.post(
        f"/ventas/{venta_id}/devolver-serializada",
        json={
            "id_bicicleta_serializada": bicicleta_id,
            "motivo": "Devolución con crédito",
            "id_usuario": seed["usuario_id"],
        },
    )


def _get_creditos_cliente(db_conn, cliente_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
            ORDER BY id DESC
            """,
            (cliente_id,),
        )
        return cur.fetchall()


def _get_credito_movimientos(db_conn, credito_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM credito_movimientos
            WHERE id_credito = %s
            ORDER BY id ASC
            """,
            (credito_id,),
        )
        return cur.fetchall()


def test_devolucion_serializada_genera_credito(client, db_conn, clean_db):
    seed = _crear_seed(db_conn, clean_db)

    bici_response = _crear_bici_serializada(
        client,
        seed,
        "CUADRO-CRED-DEV-001",
    )
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    venta_response = _crear_venta_serializada(
        client,
        seed,
        bicicleta_id,
    )
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    _marcar_venta_como_pagada_total(db_conn, venta_id)

    entrega_response = _entregar_venta(
        client,
        seed,
        venta_id,
    )
    assert entrega_response.status_code == 200, entrega_response.text

    devolucion_response = _devolver_serializada(
        client,
        seed,
        venta_id,
        bicicleta_id,
    )
    assert devolucion_response.status_code == 200, devolucion_response.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"

    creditos = _get_creditos_cliente(db_conn, seed["cliente_id"])

    assert len(creditos) == 1

    credito = creditos[0]
    assert credito["id_cliente"] == seed["cliente_id"]
    assert credito["origen_tipo"] == "venta"
    assert credito["origen_id"] == venta_id
    assert credito["estado"] == "abierto"
    assert _dec(credito["saldo_actual"]) == Decimal("990000.00")

    movimientos = _get_credito_movimientos(db_conn, credito["id"])
    assert len(movimientos) == 1

    movimiento = movimientos[0]
    assert movimiento["tipo_movimiento"] == "credito_generado"
    assert _dec(movimiento["monto"]) == Decimal("990000.00")
    assert movimiento["origen_tipo"] == "venta"
    assert movimiento["origen_id"] == venta_id
    assert movimiento["id_usuario"] == seed["usuario_id"]