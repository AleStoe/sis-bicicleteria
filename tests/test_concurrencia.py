from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import get_stock_row, get_test_conn, get_venta


def _crear_venta_payload(seed_venta_basica, cantidad=1):
    return {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": cantidad,
            }
        ],
    }


def _abrir_caja(client, seed_venta_basica):
    return client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )


def _payload_pago(venta_id: int, medio_pago: str, monto: float, id_usuario: int, nota: str = ""):
    return {
        "origen_tipo": "venta",
        "origen_id": venta_id,
        "medio_pago": medio_pago,
        "monto": monto,
        "id_usuario": id_usuario,
        "nota": nota,
    }


def _contar_pagos(conn, venta_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS cantidad
            FROM pagos
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
              AND estado = 'confirmado'
            """,
            (venta_id,),
        )
        row = cur.fetchone()
        return int(row["cantidad"])


def _contar_ventas(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS cantidad FROM ventas")
        row = cur.fetchone()
        return int(row["cantidad"])


def _contar_creditos_por_origen(conn, origen_tipo: str, origen_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS cantidad
            FROM creditos_cliente
            WHERE origen_tipo = %s
              AND origen_id = %s
            """,
            (origen_tipo, origen_id),
        )
        row = cur.fetchone()
        return int(row["cantidad"])


def _obtener_credito_por_origen(conn, origen_tipo: str, origen_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE origen_tipo = %s
              AND origen_id = %s
            """,
            (origen_tipo, origen_id),
        )
        return cur.fetchone()


def _contar_movimientos_stock_por_venta(conn, venta_id: int, tipo_movimiento: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS cantidad
            FROM movimientos_stock
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
              AND tipo_movimiento = %s
            """,
            (venta_id, tipo_movimiento),
        )
        row = cur.fetchone()
        return int(row["cantidad"])


def test_concurrencia_dos_pagos_que_juntos_exceden_saldo(seed_venta_basica):
    # setup secuencial
    with TestClient(app) as client:
        crear = client.post("/ventas/", json=_crear_venta_payload(seed_venta_basica))
        assert crear.status_code == 200
        venta_id = crear.json()["venta_id"]

        abrir = _abrir_caja(client, seed_venta_basica)
        assert abrir.status_code == 200

    barrier = Barrier(2)

    def pagar_worker(nota: str):
        with TestClient(app) as local_client:
            barrier.wait()
            return local_client.post(
                "/pagos/",
                json=_payload_pago(
                    venta_id=venta_id,
                    medio_pago="efectivo",
                    monto=15000,
                    id_usuario=seed_venta_basica["usuario_id"],
                    nota=nota,
                ),
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(pagar_worker, "pago concurrente 1")
        f2 = executor.submit(pagar_worker, "pago concurrente 2")
        r1 = f1.result()
        r2 = f2.result()

    codigos = sorted([r1.status_code, r2.status_code])
    assert codigos == [200, 400], [r1.text, r2.text]

    with get_test_conn() as conn:
        venta = get_venta(conn, venta_id)
        pagos_confirmados = _contar_pagos(conn, venta_id)

    assert pagos_confirmados == 1
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 9440.0


def test_concurrencia_doble_entrega_misma_venta(seed_venta_basica):
    # setup secuencial
    with TestClient(app) as client:
        crear = client.post("/ventas/", json=_crear_venta_payload(seed_venta_basica))
        assert crear.status_code == 200
        venta_id = crear.json()["venta_id"]

        abrir = _abrir_caja(client, seed_venta_basica)
        assert abrir.status_code == 200

        pago = client.post(
            "/pagos/",
            json=_payload_pago(
                venta_id=venta_id,
                medio_pago="efectivo",
                monto=seed_venta_basica["precio_venta"],
                id_usuario=seed_venta_basica["usuario_id"],
                nota="pago total previo a entrega concurrente",
            ),
        )
        assert pago.status_code == 200

    barrier = Barrier(2)

    def entregar_worker():
        with TestClient(app) as local_client:
            barrier.wait()
            return local_client.post(
                f"/ventas/{venta_id}/entregar",
                json={"id_usuario": seed_venta_basica["usuario_id"]},
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(entregar_worker)
        f2 = executor.submit(entregar_worker)
        r1 = f1.result()
        r2 = f2.result()

    codigos = sorted([r1.status_code, r2.status_code])
    assert codigos == [200, 400], [r1.text, r2.text]

    with get_test_conn() as conn:
        venta = get_venta(conn, venta_id)
        stock = get_stock_row(
            conn,
            seed_venta_basica["sucursal_id"],
            seed_venta_basica["variante_id"],
        )
        entregas = _contar_movimientos_stock_por_venta(conn, venta_id, "entrega")

    assert venta["estado"] == "entregada"
    assert float(venta["saldo_pendiente"]) == 0.0
    assert float(stock["stock_fisico"]) == 5.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0
    assert entregas == 1


def test_concurrencia_dos_ventas_compiten_por_ultimo_stock(seed_venta_basica):
    # bajo el stock físico a 1 para volverlo una carrera real
    with get_test_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE stock_sucursal
                SET stock_fisico = 1,
                    stock_reservado = 0,
                    stock_vendido_pendiente_entrega = 0
                WHERE id_sucursal = %s
                  AND id_variante = %s
                """,
                (
                    seed_venta_basica["sucursal_id"],
                    seed_venta_basica["variante_id"],
                ),
            )
        conn.commit()

    barrier = Barrier(2)

    def crear_worker():
        with TestClient(app) as local_client:
            barrier.wait()
            return local_client.post(
                "/ventas/",
                json=_crear_venta_payload(seed_venta_basica, cantidad=1),
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(crear_worker)
        f2 = executor.submit(crear_worker)
        r1 = f1.result()
        r2 = f2.result()

    codigos = sorted([r1.status_code, r2.status_code])
    assert codigos == [200, 400], [r1.text, r2.text]

    with get_test_conn() as conn:
        stock = get_stock_row(
            conn,
            seed_venta_basica["sucursal_id"],
            seed_venta_basica["variante_id"],
        )
        total_ventas = _contar_ventas(conn)

    # Como la venta todavía no se entrega, el físico sigue en 1 y el pendiente pasa a 1
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0
    assert total_ventas == 1


def test_concurrencia_pago_mientras_otra_request_anula(seed_venta_basica):
    # setup secuencial
    with TestClient(app) as client:
        crear = client.post("/ventas/", json=_crear_venta_payload(seed_venta_basica))
        assert crear.status_code == 200
        venta_id = crear.json()["venta_id"]

        abrir = _abrir_caja(client, seed_venta_basica)
        assert abrir.status_code == 200

    barrier = Barrier(2)

    def pago_worker():
        with TestClient(app) as local_client:
            barrier.wait()
            return local_client.post(
                "/pagos/",
                json=_payload_pago(
                    venta_id=venta_id,
                    medio_pago="efectivo",
                    monto=10000,
                    id_usuario=seed_venta_basica["usuario_id"],
                    nota="pago concurrente contra anulacion",
                ),
            )

    def anular_worker():
        with TestClient(app) as local_client:
            barrier.wait()
            return local_client.post(
                f"/ventas/{venta_id}/anular",
                json={
                    "motivo": "anulacion concurrente",
                    "id_usuario": seed_venta_basica["usuario_id"],
                },
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f_pago = executor.submit(pago_worker)
        f_anular = executor.submit(anular_worker)
        r_pago = f_pago.result()
        r_anular = f_anular.result()

    with get_test_conn() as conn:
        venta = get_venta(conn, venta_id)
        pagos_confirmados = _contar_pagos(conn, venta_id)
        creditos = _contar_creditos_por_origen(conn, "venta", venta_id)
        credito = _obtener_credito_por_origen(conn, "venta", venta_id)
        stock = get_stock_row(
            conn,
            seed_venta_basica["sucursal_id"],
            seed_venta_basica["variante_id"],
        )

    # Estado final obligatorio: anulada y sin deuda
    assert venta["estado"] == "anulada"
    assert float(venta["saldo_pendiente"]) == 0.0

    # La anulación debe haber liberado el pendiente, sin tocar físico
    assert float(stock["stock_fisico"]) == 6.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    # Dos estados válidos:
    # A) anulación ganó primero -> pago falla -> 0 pagos, 0 créditos
    # B) pago confirmó primero -> anulación genera crédito -> 1 pago, 1 crédito por 10000
    assert pagos_confirmados in (0, 1)

    if pagos_confirmados == 0:
        assert r_pago.status_code == 400, r_pago.text
        assert creditos == 0
    else:
        assert r_pago.status_code == 200, r_pago.text
        assert r_anular.status_code == 200, r_anular.text
        assert creditos == 1
        assert credito is not None
        assert Decimal(str(credito["saldo_actual"])) == Decimal("10000")

def test_stress_ventas_concurrencia(seed_venta_basica):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from fastapi.testclient import TestClient

    # dejar stock en 3
    with get_test_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE stock_sucursal
                SET stock_fisico = 3,
                    stock_reservado = 0,
                    stock_vendido_pendiente_entrega = 0
                WHERE id_sucursal = %s
                  AND id_variante = %s
            """, (
                seed_venta_basica["sucursal_id"],
                seed_venta_basica["variante_id"],
            ))
        conn.commit()

    barrier = Barrier(10)

    def worker():
        with TestClient(app) as client:
            barrier.wait()
            return client.post(
                "/ventas/",
                json={
                    "id_cliente": seed_venta_basica["cliente_id"],
                    "id_sucursal": seed_venta_basica["sucursal_id"],
                    "id_usuario": seed_venta_basica["usuario_id"],
                    "items": [
                        {
                            "id_variante": seed_venta_basica["variante_id"],
                            "cantidad": 1,
                        }
                    ],
                },
            )

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(lambda _: worker(), range(10)))

    exitos = sum(1 for r in results if r.status_code == 200)
    errores = sum(1 for r in results if r.status_code != 200)

    assert exitos == 3
    assert errores == 7

    with get_test_conn() as conn:
        stock = get_stock_row(
            conn,
            seed_venta_basica["sucursal_id"],
            seed_venta_basica["variante_id"],
        )

    assert float(stock["stock_vendido_pendiente_entrega"]) == 3.0
    assert float(stock["stock_fisico"]) == 3.0