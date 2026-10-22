from datetime import date, timedelta
from decimal import Decimal

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
            VALUES (%s, %s, 2, 0, 0)
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
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_reserva_serializada_ignora_precio_enviado_por_cliente(
    client,
    db_conn,
    seed_reserva_serializada,
):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-PRECIO-001")
    assert bici_response.status_code == 200, bici_response.text

    response = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_reserva_serializada["cliente_id"],
            "id_sucursal": seed_reserva_serializada["sucursal_id"],
            "id_usuario": seed_reserva_serializada["usuario_id"],
            "items": [
                {
                    "id_variante": seed_reserva_serializada["variante_id"],
                    "id_bicicleta_serializada": bici_response.json()["bicicleta_id"],
                    "cantidad": 1,
                    "precio_estimado": 1,
                }
            ],
        },
    )
    assert response.status_code == 200, response.text

    reserva = _get_reserva(db_conn, response.json()["reserva_id"])
    item = _get_reserva_items(db_conn, response.json()["reserva_id"])[0]
    assert Decimal(str(item["precio_estimado"])) == Decimal("950000.00")
    assert Decimal(str(reserva["saldo_estimado"])) == Decimal("950000.00")


def test_reserva_con_oferta_individual_congela_precio_y_lo_pasa_a_venta(
    client,
    db_conn,
    seed_reserva_serializada,
):
    bici_response = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-OFERTA-001")
    assert bici_response.status_code == 200, bici_response.text
    bicicleta_id = bici_response.json()["bicicleta_id"]
    hoy = date.today()

    oferta_response = client.post(
        "/ofertas",
        json={
            "id_variante": seed_reserva_serializada["variante_id"],
            "alcance": "unidades",
            "ids_bicicletas_serializadas": [bicicleta_id],
            "politica_contado": "precio_final_contado",
            "nombre": "OFERTA RESERVA POR CUADRO",
            "precio_oferta": "800000",
            "fecha_desde": hoy.isoformat(),
            "fecha_hasta": (hoy + timedelta(days=2)).isoformat(),
            "motivo": "Prueba de snapshot en reserva",
            "id_usuario": seed_reserva_serializada["usuario_id"],
        },
    )
    assert oferta_response.status_code == 201, oferta_response.text
    oferta_id = oferta_response.json()["id"]

    reserva_response = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_reserva_serializada["cliente_id"],
            "id_sucursal": seed_reserva_serializada["sucursal_id"],
            "id_usuario": seed_reserva_serializada["usuario_id"],
            "items": [
                {
                    "id_variante": seed_reserva_serializada["variante_id"],
                    "id_bicicleta_serializada": bicicleta_id,
                    "cantidad": 1,
                    "precio_estimado": 1,
                }
            ],
        },
    )
    assert reserva_response.status_code == 200, reserva_response.text
    reserva_id = reserva_response.json()["reserva_id"]

    reserva = _get_reserva(db_conn, reserva_id)
    item_reserva = _get_reserva_items(db_conn, reserva_id)[0]
    assert Decimal(str(item_reserva["precio_estimado"])) == Decimal("800000.00")
    assert item_reserva["id_oferta"] == oferta_id
    assert item_reserva["oferta_alcance_snapshot"] == "unidades"
    assert item_reserva["oferta_politica_contado_snapshot"] == "precio_final_contado"
    assert Decimal(str(reserva["base_sin_descuento_contado"])) == Decimal("800000.00")

    with db_conn.cursor() as cur:
        cur.execute("UPDATE ofertas SET activa = FALSE WHERE id = %s", (oferta_id,))
    db_conn.commit()

    convertir_response = client.post(
        f"/reservas/{reserva_id}/convertir-a-venta",
        json={
            "id_usuario": seed_reserva_serializada["usuario_id"],
            "observaciones": "Conversion con oferta congelada",
        },
    )
    assert convertir_response.status_code == 200, convertir_response.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.subtotal_base,
                v.base_sin_descuento_contado,
                vi.precio_lista,
                vi.id_oferta,
                vi.oferta_alcance_snapshot,
                vi.oferta_politica_contado_snapshot
            FROM ventas v
            JOIN venta_items vi ON vi.id_venta = v.id
            WHERE v.id = %s
            """,
            (convertir_response.json()["venta_id"],),
        )
        venta = cur.fetchone()

    assert Decimal(str(venta["subtotal_base"])) == Decimal("800000.00")
    assert Decimal(str(venta["base_sin_descuento_contado"])) == Decimal("800000.00")
    assert Decimal(str(venta["precio_lista"])) == Decimal("800000.00")
    assert venta["id_oferta"] == oferta_id
    assert venta["oferta_alcance_snapshot"] == "unidades"
    assert venta["oferta_politica_contado_snapshot"] == "precio_final_contado"

    listado = client.get(
        "/bicicletas_serializadas/",
        params={"query": "CUADRO-RES-OFERTA-001"},
    )
    assert listado.status_code == 200, listado.text
    unidad_vendida = listado.json()[0]
    assert Decimal(unidad_vendida["venta_precio_final"]) == Decimal("800000.00")
    assert Decimal(unidad_vendida["venta_costo_aplicado"]) == Decimal("700000.00")
    assert Decimal(unidad_vendida["venta_ganancia"]) == Decimal("100000.00")
    assert unidad_vendida["venta_oferta_alcance"] == "unidades"


def test_reserva_bicicleta_correcta_aunque_numero_cuadro_este_repetido(
    client,
    db_conn,
    seed_reserva_serializada,
):
    bici_1 = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-DUP-001")
    bici_2 = _crear_bici_serializada(client, seed_reserva_serializada, "CUADRO-RES-DUP-001")
    assert bici_1.status_code == 200, bici_1.text
    assert bici_2.status_code == 200, bici_2.text
    bicicleta_1_id = bici_1.json()["bicicleta_id"]
    bicicleta_2_id = bici_2.json()["bicicleta_id"]

    reserva_response = _crear_reserva_serializada(
        client,
        seed_reserva_serializada,
        bicicleta_2_id,
    )
    assert reserva_response.status_code == 200, reserva_response.text
    reserva_id = reserva_response.json()["reserva_id"]

    bici_reservada = _get_bicicleta_serializada(db_conn, bicicleta_2_id)
    bici_libre = _get_bicicleta_serializada(db_conn, bicicleta_1_id)
    assert bici_reservada["estado"] == "reservada"
    assert bici_libre["estado"] == "disponible"

    items = _get_reserva_items(db_conn, reserva_id)
    assert len(items) == 1
    assert items[0]["id_bicicleta_serializada"] == bicicleta_2_id


def test_busqueda_directa_encuentra_bicicleta_por_numero_de_cuadro(
    client,
    seed_reserva_serializada,
):
    encontrada = _crear_bici_serializada(
        client,
        seed_reserva_serializada,
        "CUADRO-SCAN-FASE5-001",
    )
    otra = _crear_bici_serializada(
        client,
        seed_reserva_serializada,
        "CUADRO-SCAN-OTRA-002",
    )
    assert encontrada.status_code == 200, encontrada.text
    assert otra.status_code == 200, otra.text

    response = client.get(
        "/bicicletas_serializadas/disponibles",
        params={
            "id_sucursal": seed_reserva_serializada["sucursal_id"],
            "query": "scan-fase5-001",
        },
    )
    assert response.status_code == 200, response.text
    unidades = response.json()
    assert [unidad["id"] for unidad in unidades] == [encontrada.json()["bicicleta_id"]]
    assert unidades[0]["numero_cuadro"] == "CUADRO-SCAN-FASE5-001"


def test_listado_filtra_ficha_operativa_y_expone_resultado_estimado(
    client,
    seed_reserva_serializada,
):
    creada = _crear_bici_serializada(
        client,
        seed_reserva_serializada,
        "CUADRO-FASE6-FILTRO",
    )
    assert creada.status_code == 200, creada.text
    bicicleta_id = creada.json()["bicicleta_id"]

    actualizada = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/ficha",
        json={
            "estado_tecnico": "lista",
            "condicion_comercial": "reacondicionada",
            "ubicacion_fisica": "SALON NORTE",
            "observaciones": None,
            "texto_comercial": "Unidad revisada",
            "motivo": "Clasificación operativa fase 6",
            "id_usuario": seed_reserva_serializada["usuario_id"],
        },
    )
    assert actualizada.status_code == 200, actualizada.text

    response = client.get(
        "/bicicletas_serializadas/",
        params={
            "estado_tecnico": "lista",
            "condicion_comercial": "reacondicionada",
            "ubicacion_fisica": "norte",
            "query": "fase6-filtro",
        },
    )
    assert response.status_code == 200, response.text
    unidades = response.json()
    assert [unidad["id"] for unidad in unidades] == [bicicleta_id]
    assert Decimal(unidades[0]["precio_venta_actual"]) == Decimal("950000.00")
    assert Decimal(unidades[0]["ganancia_estimada"]) == Decimal("250000.00")
    assert Decimal(unidades[0]["margen_estimado"]) == Decimal("26.32")

    sin_resultados = client.get(
        "/bicicletas_serializadas/",
        params={"condicion_comercial": "oferta", "query": "fase6-filtro"},
    )
    assert sin_resultados.status_code == 200, sin_resultados.text
    assert sin_resultados.json() == []


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
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0
