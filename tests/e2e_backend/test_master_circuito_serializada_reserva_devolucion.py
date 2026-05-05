from decimal import Decimal

from tests.conftest import get_stock_row, get_venta


def _dec(v):
    return Decimal(str(v))


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


def _get_venta_item_serializado(conn, venta_id: int, bicicleta_id: int):
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


def _get_devolucion_by_item(conn, venta_item_id: int):
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


def _get_creditos_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
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


def _contar_movimientos_stock(conn, tipo_movimiento: str, origen_tipo: str, origen_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS cantidad
            FROM movimientos_stock
            WHERE tipo_movimiento = %s
              AND origen_tipo = %s
              AND origen_id = %s
            """,
            (tipo_movimiento, origen_tipo, origen_id),
        )
        return cur.fetchone()["cantidad"]


def test_master_reserva_serializada_venta_entrega_devolucion_credito(
    client,
    db_conn,
    clean_db,
):
    # =====================================================
    # 1. SETUP BASE
    # =====================================================
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Master Serializada', 'admin_master_serializada', 'hash_dummy', TRUE)
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
            VALUES (%s, 'Bicicleta Master Test', 'producto', TRUE, TRUE, TRUE)
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
            VALUES (%s, 'R29 Master', 'BICI-MASTER-R29', 950000, 850000, 700000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Master Serializada', '2910000000', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Master', 'Direccion Master', TRUE)
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

    from tests.conftest import asignar_rol_usuario

    asignar_rol_usuario(db_conn, usuario_id, "administrador")
    db_conn.commit()

    # =====================================================
    # 2. ARMAR / SERIALIZAR BICICLETA
    # =====================================================
    bici_response = client.post(
        "/bicicletas_serializadas",
        json={
            "id_variante": variante_id,
            "id_sucursal_actual": sucursal_id,
            "numero_cuadro": "MASTER-CUADRO-001",
            "observaciones": "Master circuito",
            "id_usuario": usuario_id,
        },
    )
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "disponible"

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("0.000")
    assert _dec(stock["stock_reservado"]) == Decimal("0.000")
    assert _dec(stock["stock_vendido_pendiente_entrega"]) == Decimal("0.000")

    # =====================================================
    # 3. CREAR RESERVA SERIALIZADA
    # =====================================================
    reserva_response = client.post(
        "/reservas/",
        json={
            "id_cliente": cliente_id,
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "nota": "Reserva master serializada",
            "items": [
                {
                    "id_variante": variante_id,
                    "id_bicicleta_serializada": bicicleta_id,
                    "cantidad": 1,
                    "precio_estimado": 950000,
                }
            ],
        },
    )
    assert reserva_response.status_code == 200, reserva_response.text
    reserva_id = reserva_response.json()["reserva_id"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "reservada"

    reserva = _get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "activa"

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("0.000")
    assert _dec(stock["stock_reservado"]) == Decimal("0.000")
    assert _dec(stock["stock_vendido_pendiente_entrega"]) == Decimal("0.000")

    # =====================================================
    # 4. CONVERTIR RESERVA EN VENTA
    # =====================================================
    convertir_response = client.post(
        f"/reservas/{reserva_id}/convertir-a-venta",
        json={
            "id_usuario": usuario_id,
            "observaciones": "Conversión master",
        },
    )
    assert convertir_response.status_code == 200, convertir_response.text
    venta_id = convertir_response.json()["venta_id"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "vendida_pendiente_entrega"

    reserva = _get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "convertida_en_venta"

    venta = get_venta(db_conn, venta_id)
    assert venta["id_reserva_origen"] == reserva_id
    assert venta["id_cliente"] == cliente_id

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("0.000")
    assert _dec(stock["stock_reservado"]) == Decimal("0.000")
    assert _dec(stock["stock_vendido_pendiente_entrega"]) == Decimal("0.000")

    # =====================================================
    # 5. MARCAR VENTA COMO PAGADA PARA PODER ENTREGAR
    # =====================================================
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

    # =====================================================
    # 6. ENTREGAR VENTA SERIALIZADA
    # =====================================================
    entrega_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={
            "id_usuario": usuario_id,
        },
    )
    assert entrega_response.status_code == 200, entrega_response.text

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "entregada"

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"

    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("0.000")
    assert _dec(stock["stock_reservado"]) == Decimal("0.000")
    assert _dec(stock["stock_vendido_pendiente_entrega"]) == Decimal("0.000")

    # =====================================================
    # 7. DEVOLVER SERIALIZADA
    # =====================================================
    devolucion_response = client.post(
        f"/ventas/{venta_id}/devolver-serializada",
        json={
            "id_bicicleta_serializada": bicicleta_id,
            "motivo": "Devolución master",
            "id_usuario": usuario_id,
        },
    )
    assert devolucion_response.status_code == 200, devolucion_response.text

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "disponible"

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"

    venta_item = _get_venta_item_serializado(db_conn, venta_id, bicicleta_id)
    assert venta_item is not None

    devolucion = _get_devolucion_by_item(db_conn, venta_item["id"])
    assert devolucion is not None
    assert devolucion["id_venta"] == venta_id
    assert devolucion["id_venta_item"] == venta_item["id"]
    assert devolucion["id_bicicleta_serializada"] == bicicleta_id

    # Al devolver una serializada, vuelve a stock físico disponible.
    stock = get_stock_row(db_conn, sucursal_id, variante_id)
    assert _dec(stock["stock_fisico"]) == Decimal("1.000")
    assert _dec(stock["stock_reservado"]) == Decimal("0.000")
    assert _dec(stock["stock_vendido_pendiente_entrega"]) == Decimal("0.000")

    movimientos_devolucion = _contar_movimientos_stock(
        db_conn,
        "devolucion_venta",
        "venta",
        venta_id,
    )
    assert movimientos_devolucion == 1

    # =====================================================
    # 8. CRÉDITO GENERADO
    # =====================================================
    creditos = _get_creditos_cliente(db_conn, cliente_id)
    assert len(creditos) >= 1

    credito = creditos[0]
    assert _dec(credito["saldo_actual"]) == Decimal("950000.00")
    assert credito["estado"] in ("activo", "abierto")