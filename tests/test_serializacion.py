from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import (
    get_auditoria_by_entidad,
    get_movimientos_by_venta,
    get_stock_row,
    get_test_conn,
    get_venta,
)


def _abrir_caja(client, sucursal_id: int, usuario_id: int):
    return client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )


def _crear_bici_serializada(client, seed_serializacion, numero_cuadro="CUADRO-001"):
    return client.post(
        "/bicicletas_serializadas",
        json={
            "id_variante": seed_serializacion["variante_id"],
            "id_sucursal_actual": seed_serializacion["sucursal_id"],
            "numero_cuadro": numero_cuadro,
            "observaciones": "Alta test serialización",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )


def _crear_venta_serializada(client, seed_serializacion, bicicleta_id: int):
    return client.post(
        "/ventas/",
        json={
            "id_cliente": seed_serializacion["cliente_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
            "id_usuario": seed_serializacion["usuario_id"],
            "items": [
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": bicicleta_id,
                }
            ],
        },
    )


def _crear_venta_sin_serie(client, seed_serializacion):
    return client.post(
        "/ventas/",
        json={
            "id_cliente": seed_serializacion["cliente_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
            "id_usuario": seed_serializacion["usuario_id"],
            "items": [
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )


def _pagar_venta_total(client, venta_id: int, seed_serializacion):
    return client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": seed_serializacion["precio_venta"],
            "id_usuario": seed_serializacion["usuario_id"],
            "nota": "Pago total test serialización",
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


def _get_bicicletas_cliente_por_numero_cuadro(conn, numero_cuadro: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicletas_clientes
            WHERE numero_cuadro = %s
            ORDER BY id
            """,
            (numero_cuadro,),
        )
        return cur.fetchall()


def _get_movimientos_serializacion(conn, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM movimientos_stock
            WHERE id_bicicleta_serializada = %s
              AND tipo_movimiento = 'serializacion'
            ORDER BY id
            """,
            (bicicleta_id,),
        )
        return cur.fetchall()


@pytest.fixture()
def seed_serializacion(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Serializacion', 'admin_serializacion', 'hash_dummy', TRUE)
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
            VALUES (%s, 'Bicicleta Test', 'producto', TRUE, TRUE, TRUE)
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
            VALUES (%s, 'R29 Negra', 'BICI-TEST-R29-NEGRA', 1000000, 850000, 700000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Serializacion', '2911111111', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Serializacion', 'Direccion Test', TRUE)
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
        "precio_venta": 1000000,
    }


def test_crear_bicicleta_serializada_ok(client, db_conn, seed_serializacion):
    response = _crear_bici_serializada(client, seed_serializacion, "CUADRO-OK-001")
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    bicicleta_id = data["bicicleta_id"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta is not None
    assert bicicleta["id_variante"] == seed_serializacion["variante_id"]
    assert bicicleta["id_sucursal_actual"] == seed_serializacion["sucursal_id"]
    assert bicicleta["numero_cuadro"] == "CUADRO-OK-001"
    assert bicicleta["estado"] == "disponible"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = _get_movimientos_serializacion(db_conn, bicicleta_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "serializacion"
    assert movimientos[0]["origen_tipo"] == "bicicleta_serializada"
    assert movimientos[0]["origen_id"] == bicicleta_id


def test_crear_bicicleta_serializada_duplicada_falla(client, seed_serializacion):
    r1 = _crear_bici_serializada(client, seed_serializacion, "CUADRO-DUP-001")
    assert r1.status_code == 200, r1.text

    r2 = _crear_bici_serializada(client, seed_serializacion, "CUADRO-DUP-001")
    assert r2.status_code == 400, r2.text


def test_venta_sin_serie_sigue_funcionando_para_bici_en_caja(client, db_conn, seed_serializacion):
    response = _crear_venta_sin_serie(client, seed_serializacion)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["estado"] == "creada"

    venta_id = data["venta_id"]
    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "venta"
    assert movimientos[0]["id_bicicleta_serializada"] is None


def test_venta_con_bici_serializada_ok_si_esta_disponible(client, db_conn, seed_serializacion):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-VTA-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    response = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["estado"] == "creada"

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "vendida_pendiente_entrega"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, data["venta_id"])
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta_serializada"]


def test_venta_con_bici_serializada_falla_si_ya_esta_comprometida(client, seed_serializacion):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-YA-USADO-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    r1 = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert r1.status_code == 200, r1.text

    r2 = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert r2.status_code == 400, r2.text


def test_venta_con_bici_serializada_falla_si_no_coincide_con_la_variante(client, db_conn, seed_serializacion):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO categorias (nombre)
            VALUES ('Bicicletas Extra')
            RETURNING id
            """
        )
        categoria_2_id = cur.fetchone()["id"]

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
            VALUES (%s, 'Bicicleta Otra', 'producto', TRUE, TRUE, TRUE)
            RETURNING id
            """,
            (categoria_2_id,),
        )
        producto_2_id = cur.fetchone()["id"]

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
            VALUES (%s, 'R29 Roja', 'BICI-OTRA-R29-ROJA', 999999, 800000, 650000, TRUE)
            RETURNING id
            """,
            (producto_2_id,),
        )
        otra_variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado
            )
            VALUES (%s, %s, 'CUADRO-NO-COINCIDE-001', 'disponible')
            RETURNING id
            """,
            (otra_variante_id, seed_serializacion["sucursal_id"]),
        )
        bicicleta_id = cur.fetchone()["id"]

    db_conn.commit()

    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_serializacion["cliente_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
            "id_usuario": seed_serializacion["usuario_id"],
            "items": [
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": bicicleta_id,
                }
            ],
        },
    )
    assert response.status_code == 400, response.text


def test_venta_con_bici_serializada_falla_si_cantidad_distinta_de_uno(client, seed_serializacion):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-CANT-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    response = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_serializacion["cliente_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
            "id_usuario": seed_serializacion["usuario_id"],
            "items": [
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 2,
                    "id_bicicleta_serializada": bicicleta_id,
                }
            ],
        },
    )
    assert response.status_code == 400, response.text


def test_entregar_venta_serializada_la_pasa_a_entregada_y_crea_bicicleta_cliente(
    client,
    db_conn,
    seed_serializacion,
):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-ENT-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    crear_venta = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert crear_venta.status_code == 200, crear_venta.text
    venta_id = crear_venta.json()["venta_id"]

    abrir = _abrir_caja(
        client,
        seed_serializacion["sucursal_id"],
        seed_serializacion["usuario_id"],
    )
    assert abrir.status_code == 200, abrir.text

    pago = _pagar_venta_total(client, venta_id, seed_serializacion)
    assert pago.status_code == 200, pago.text

    entregar = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_serializacion["usuario_id"]},
    )
    assert entregar.status_code == 200, entregar.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert float(venta["saldo_pendiente"]) == 0.0

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "entregada"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta_serializada", "entrega_serializada"]

    bicis_cliente = _get_bicicletas_cliente_por_numero_cuadro(db_conn, "CUADRO-ENT-001")
    assert len(bicis_cliente) == 1
    assert bicis_cliente[0]["id_cliente"] == seed_serializacion["cliente_id"]


def test_anular_venta_serializada_devuelve_bici_a_disponible(client, db_conn, seed_serializacion):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-ANU-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    crear_venta = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert crear_venta.status_code == 200, crear_venta.text
    venta_id = crear_venta.json()["venta_id"]

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "anulacion test serializada",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"
    assert float(venta["saldo_pendiente"]) == 0.0

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "disponible"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta_serializada", "anulacion_serializada"]


def test_concurrencia_dos_ventas_intentan_usar_la_misma_serie(seed_serializacion):
    with TestClient(app) as client:
        crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-RACE-001")
        assert crear_bici.status_code == 200, crear_bici.text
        bicicleta_id = crear_bici.json()["bicicleta_id"]

    barrier = Barrier(2)

    def vender_worker():
        with TestClient(app) as local_client:
            barrier.wait()
            return _crear_venta_serializada(local_client, seed_serializacion, bicicleta_id)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(vender_worker)
        f2 = executor.submit(vender_worker)
        r1 = f1.result()
        r2 = f2.result()

    codigos = sorted([r1.status_code, r2.status_code])
    assert codigos == [200, 400], [r1.text, r2.text]

    with get_test_conn() as conn:
        bicicleta = _get_bicicleta_serializada(conn, bicicleta_id)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM movimientos_stock
                WHERE id_bicicleta_serializada = %s
                  AND origen_tipo = 'venta'
                ORDER BY id
                """,
                (bicicleta_id,),
            )
            movimientos = cur.fetchall()

    assert bicicleta["estado"] == "vendida_pendiente_entrega"
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["venta_serializada"]


def test_auditoria_en_entrega_y_anulacion_serializada(client, db_conn, seed_serializacion):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-AUD-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    crear_venta = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert crear_venta.status_code == 200, crear_venta.text
    venta_id = crear_venta.json()["venta_id"]

    anular = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "auditoria anulacion serializada",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    auditoria = get_auditoria_by_entidad(db_conn, "venta", venta_id)
    acciones = [a["accion"] for a in auditoria]

    assert "venta_creada" in acciones
    assert "anular_venta" in acciones