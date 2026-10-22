from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
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


def _crear_reserva_serializada(client, seed_serializacion, bicicleta_id: int):
    return client.post(
        "/reservas/",
        json={
            "id_cliente": seed_serializacion["cliente_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
            "id_usuario": seed_serializacion["usuario_id"],
            "fecha_vencimiento": "2026-12-31",
            "nota": "Reserva serializada test",
            "items": [
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": bicicleta_id,
                    "precio_estimado": seed_serializacion["precio_venta"],
                }
            ],
        },
    )


def _crear_reserva_sin_serie(client, seed_serializacion):
    return client.post(
        "/reservas/",
        json={
            "id_cliente": seed_serializacion["cliente_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
            "id_usuario": seed_serializacion["usuario_id"],
            "fecha_vencimiento": "2026-12-31",
            "nota": "Reserva sin unidad serializada test",
            "items": [
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 1,
                    "precio_estimado": seed_serializacion["precio_venta"],
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


def _get_bicicletas_cliente_por_serializada(conn, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicletas_clientes
            WHERE id_bicicleta_serializada = %s
            ORDER BY id
            """,
            (bicicleta_id,),
        )
        return cur.fetchall()


def _forzar_descripcion_larga_venta(conn, venta_id: int):
    descripcion_larga = (
        "BICICLETA MTB TOPMEGA SUNSHINE R29 ALUMINIO 21V SHIMANO TOURNEY "
        "FRENO A DISCO MECANICO - TALLE L - NEGRO/ROJO/BLANCO CON DETALLE "
        "ESPECIAL DE FABRICA"
    )

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE venta_items
            SET descripcion_snapshot = %s
            WHERE id_venta = %s
            """,
            (descripcion_larga, venta_id),
        )

    conn.commit()
    return descripcion_larga


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


def test_ficha_operativa_congela_costo_y_bloquea_venta_reserva(
    client,
    db_conn,
    seed_serializacion,
):
    creada = _crear_bici_serializada(client, seed_serializacion, "CUADRO-FICHA-001")
    assert creada.status_code == 200, creada.text
    bicicleta_id = creada.json()["bicicleta_id"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado_tecnico"] == "lista"
    assert bicicleta["condicion_comercial"] == "normal"
    assert bicicleta["costo_base_unitario"] == 700000
    assert bicicleta["costo_total_unitario"] == 700000
    assert bicicleta["costo_base_origen"] == "costo_promedio_serializacion"

    actualizada = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/ficha",
        json={
            "estado_tecnico": "pendiente_revision",
            "condicion_comercial": "oferta",
            "ubicacion_fisica": "MESA DE ARMADO",
            "observaciones": "Revisar cubiertas",
            "texto_comercial": None,
            "motivo": "Revision inicial del lote",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert actualizada.status_code == 200, actualizada.text
    assert actualizada.json()["estado_tecnico"] == "pendiente_revision"
    assert actualizada.json()["ubicacion_fisica"] == "MESA DE ARMADO"

    disponibles = client.get(
        "/bicicletas_serializadas/disponibles",
        params={
            "id_variante": seed_serializacion["variante_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
        },
    )
    assert disponibles.status_code == 200, disponibles.text
    assert disponibles.json() == []

    venta = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert venta.status_code == 400
    assert "no esta lista para vender" in venta.json()["detail"]

    reserva = _crear_reserva_serializada(client, seed_serializacion, bicicleta_id)
    assert reserva.status_code == 400
    assert "no esta lista para reservar" in reserva.json()["detail"]

    eventos = get_auditoria_by_entidad(db_conn, "bicicleta_serializada", bicicleta_id)
    assert any(evento["accion"] == "ficha_operativa_actualizada" for evento in eventos)


def test_ficha_operativa_permite_definir_y_quitar_precio_propio(
    client,
    db_conn,
    seed_serializacion,
):
    creada = _crear_bici_serializada(client, seed_serializacion, "CUADRO-PRECIO-FICHA")
    assert creada.status_code == 200, creada.text
    bicicleta_id = creada.json()["bicicleta_id"]

    actualizado = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/ficha",
        json={
            "estado_tecnico": "lista",
            "condicion_comercial": "reacondicionada",
            "ubicacion_fisica": "SALON",
            "observaciones": None,
            "texto_comercial": "Unidad acondicionada",
            "usar_precio_personalizado": True,
            "precio_venta_personalizado": 1035000,
            "motivo": "Ajuste de precio por acondicionamiento",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert actualizado.status_code == 200, actualizado.text
    assert actualizado.json()["precio_venta_personalizado"] == "1035000.00"
    assert actualizado.json()["precio_venta_actual"] == "1035000.00"

    quitado = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/ficha",
        json={
            "estado_tecnico": "lista",
            "condicion_comercial": "reacondicionada",
            "ubicacion_fisica": "SALON",
            "observaciones": None,
            "texto_comercial": "Unidad acondicionada",
            "usar_precio_personalizado": False,
            "precio_venta_personalizado": None,
            "motivo": "Volver al precio general del modelo",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert quitado.status_code == 200, quitado.text
    assert quitado.json()["precio_venta_personalizado"] is None
    assert quitado.json()["precio_venta_actual"] == quitado.json()["precio_minorista"]


def test_acondicionamiento_aplica_stock_costos_recupero_y_revierte(
    client,
    db_conn,
    seed_serializacion,
):
    creada = _crear_bici_serializada(client, seed_serializacion, "ZOOM-FASE-2")
    assert creada.status_code == 200, creada.text
    bicicleta_id = creada.json()["bicicleta_id"]

    pendiente = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/ficha",
        json={
            "estado_tecnico": "pendiente_revision",
            "condicion_comercial": "normal",
            "ubicacion_fisica": "DEPOSITO",
            "observaciones": "Cubiertas a reemplazar",
            "texto_comercial": None,
            "motivo": "Revision del lote Zoom",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert pendiente.status_code == 200, pendiente.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO productos (
                id_categoria, nombre, tipo_item, stockeable, serializable, activo
            )
            VALUES (
                (SELECT id FROM categorias LIMIT 1),
                'Cubierta reemplazo', 'producto', TRUE, FALSE, TRUE
            )
            RETURNING id
            """
        )
        producto_componente_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO variantes (
                id_producto, nombre_variante, sku, precio_minorista,
                precio_mayorista, costo_promedio_vigente, activo
            )
            VALUES (%s, 'R29', 'CUB-REEMPLAZO-R29', 50000, 40000, 18000, TRUE)
            RETURNING id
            """,
            (producto_componente_id,),
        )
        componente_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal, id_variante, stock_fisico, stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 5, 0, 0)
            """,
            (seed_serializacion["sucursal_id"], componente_id),
        )
    db_conn.commit()

    orden = client.post(
        "/acondicionamientos/",
        json={
            "id_bicicleta_serializada": bicicleta_id,
            "motivo": "Cambiar cubiertas defectuosas",
            "observaciones": "Plan de prueba",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert orden.status_code == 201, orden.text
    orden_id = orden.json()["id"]
    assert orden.json()["codigo"] == "ACOND-000001"

    componente = client.post(
        f"/acondicionamientos/{orden_id}/items",
        json={
            "tipo_intervencion": "reemplazo",
            "id_variante": componente_id,
            "cantidad": 2,
            "detalle_pieza_retirada": "Dos cubiertas originales defectuosas",
            "destino_pieza_retirada": "garantia",
            "observaciones": None,
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert componente.status_code == 200, componente.text
    assert componente.json()["items"][0]["cantidad"] == "2.000"
    assert componente.json()["items"][0]["stock_disponible_actual"] == "5.000"
    assert componente.json()["items"][0]["disponibilidad_suficiente"] is True
    assert componente.json()["items"][0]["destino_pieza_retirada"] == "garantia"
    assert componente.json()["items"][0]["estado_pieza_retirada"] == "en_garantia"
    assert componente.json()["total_componentes_estimado"] == "36000.00"

    faltante = client.post(
        f"/acondicionamientos/{orden_id}/items",
        json={
            "tipo_intervencion": "mejora",
            "id_variante": componente_id,
            "cantidad": 10,
            "detalle_pieza_retirada": None,
            "destino_pieza_retirada": None,
            "observaciones": "Valida stock insuficiente",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert faltante.status_code == 200, faltante.text
    item_faltante_id = faltante.json()["items"][1]["id"]
    confirmar_sin_stock = client.post(
        f"/acondicionamientos/{orden_id}/confirmar",
        json={"id_usuario": seed_serializacion["usuario_id"]},
    )
    assert confirmar_sin_stock.status_code == 400
    quitar_faltante = client.delete(
        f"/acondicionamientos/{orden_id}/items/{item_faltante_id}",
        params={"id_usuario": seed_serializacion["usuario_id"]},
    )
    assert quitar_faltante.status_code == 200, quitar_faltante.text
    assert len(quitar_faltante.json()["items"]) == 1

    costo = client.post(
        f"/acondicionamientos/{orden_id}/costos",
        json={
            "tipo": "mano_obra",
            "descripcion": "Cambio de cubiertas",
            "cantidad": 1,
            "costo_unitario": 5000,
            "observaciones": None,
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert costo.status_code == 200, costo.text
    assert costo.json()["total_estimado"] == "41000.00"
    assert costo.json()["puede_confirmar"] is True

    recupero = client.post(
        f"/acondicionamientos/{orden_id}/recuperos",
        json={
            "tipo": "nota_credito",
            "descripcion": "Reconocimiento por cubiertas falladas",
            "monto": 1000,
            "referencia": "NC-PRUEBA-001",
            "observaciones": None,
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert recupero.status_code == 200, recupero.text
    assert recupero.json()["total_recuperos_estimado"] == "1000.00"
    assert recupero.json()["total_estimado"] == "40000.00"

    confirmar = client.post(
        f"/acondicionamientos/{orden_id}/confirmar",
        json={"id_usuario": seed_serializacion["usuario_id"]},
    )
    assert confirmar.status_code == 200, confirmar.text
    assert confirmar.json()["estado"] == "confirmado"

    habilitar_manualmente = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/ficha",
        json={
            "estado_tecnico": "lista",
            "condicion_comercial": "normal",
            "ubicacion_fisica": "SALON",
            "observaciones": None,
            "texto_comercial": None,
            "motivo": "Intento de habilitacion manual",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert habilitar_manualmente.status_code == 400
    assert "acondicionamiento confirmado" in habilitar_manualmente.json()["detail"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT estado_tecnico, costo_base_unitario, costo_total_unitario
            FROM bicicletas_serializadas
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
        bici_antes = cur.fetchone()
        assert bici_antes["estado_tecnico"] == "en_acondicionamiento"
        cur.execute(
            "SELECT stock_fisico FROM stock_sucursal WHERE id_variante = %s",
            (componente_id,),
        )
        assert cur.fetchone()["stock_fisico"] == 5

    aplicar = client.post(
        f"/acondicionamientos/{orden_id}/aplicar",
        json={
            "id_usuario": seed_serializacion["usuario_id"],
            "actualizar_precio_venta": True,
            "precio_venta_nuevo": 1060000,
        },
    )
    assert aplicar.status_code == 200, aplicar.text
    aplicado = aplicar.json()
    assert aplicado["estado"] == "aplicado"
    assert aplicado["costo_componentes_real"] == "36000.00"
    assert aplicado["costo_adicional_real"] == "5000.00"
    assert aplicado["recuperos_total"] == "1000.00"
    assert aplicado["costo_acondicionamiento_aplicado"] == "40000.00"
    assert aplicado["precio_venta_actualizado"] is True
    assert aplicado["precio_venta_actual"] == "1060000.00"
    assert aplicado["items"][0]["estado"] == "consumido"
    assert aplicado["items"][0]["cantidad_consumida"] == "2.000"
    assert aplicado["items"][0]["costo_unitario_real"] == "18000.00"
    assert aplicado["items"][0]["id_movimiento_consumo"] is not None

    compensar = client.patch(
        f"/acondicionamientos/{orden_id}/items/{aplicado['items'][0]['id']}/pieza-retirada",
        json={
            "estado": "compensada",
            "resolucion": "Proveedor reconoció NC-PRUEBA-001",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert compensar.status_code == 200, compensar.text
    pieza_retirada = compensar.json()["items"][0]
    assert pieza_retirada["estado_pieza_retirada"] == "compensada"
    assert pieza_retirada["resolucion_pieza_retirada"] == "Proveedor reconoció NC-PRUEBA-001"

    aplicar_dos_veces = client.post(
        f"/acondicionamientos/{orden_id}/aplicar",
        json={"id_usuario": seed_serializacion["usuario_id"]},
    )
    assert aplicar_dos_veces.status_code == 400

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT estado_tecnico, costo_acondicionamiento, costo_total_unitario,
                   precio_venta_personalizado
            FROM bicicletas_serializadas
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
        bici_aplicada = cur.fetchone()
        assert bici_aplicada["estado_tecnico"] == "lista"
        assert bici_aplicada["costo_acondicionamiento"] == Decimal("40000.00")
        assert bici_aplicada["costo_total_unitario"] == (
            bici_antes["costo_base_unitario"] + Decimal("40000.00")
        )
        assert bici_aplicada["precio_venta_personalizado"] == Decimal("1060000.00")
        cur.execute(
            "SELECT stock_fisico FROM stock_sucursal WHERE id_variante = %s",
            (componente_id,),
        )
        assert cur.fetchone()["stock_fisico"] == 3
        cur.execute(
            """
            SELECT tipo_movimiento, origen_tipo, origen_id,
                   id_bicicleta_serializada, cantidad, costo_unitario_aplicado
            FROM movimientos_stock
            WHERE tipo_movimiento = 'uso_acondicionamiento'
              AND origen_id = %s
            """,
            (orden_id,),
        )
        movimiento = cur.fetchone()
        assert movimiento["origen_tipo"] == "bicicleta_acondicionamiento"
        assert movimiento["id_bicicleta_serializada"] == bicicleta_id
        assert movimiento["cantidad"] == Decimal("2.000")
        assert movimiento["costo_unitario_aplicado"] == Decimal("18000.00")

    revertir = client.post(
        f"/acondicionamientos/{orden_id}/revertir",
        json={
            "motivo": "Se revierte el trabajo aplicado para validar trazabilidad",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert revertir.status_code == 200, revertir.text
    assert revertir.json()["estado"] == "revertido"
    assert revertir.json()["items"][0]["estado"] == "revertido"
    assert revertir.json()["items"][0]["estado_pieza_retirada"] == "revertida"
    assert revertir.json()["items"][0]["id_movimiento_reversion"] is not None
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT estado_tecnico, costo_acondicionamiento, costo_total_unitario,
                   precio_venta_personalizado
            FROM bicicletas_serializadas
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
        bici_revertida = cur.fetchone()
        assert bici_revertida["estado_tecnico"] == "pendiente_revision"
        assert bici_revertida["costo_acondicionamiento"] == Decimal("0.00")
        assert bici_revertida["costo_total_unitario"] == bici_antes["costo_total_unitario"]
        assert bici_revertida["precio_venta_personalizado"] is None
        cur.execute(
            "SELECT stock_fisico FROM stock_sucursal WHERE id_variante = %s",
            (componente_id,),
        )
        assert cur.fetchone()["stock_fisico"] == 5
        cur.execute(
            """
            SELECT COUNT(*) AS cantidad
            FROM movimientos_stock
            WHERE tipo_movimiento = 'reversion_uso_acondicionamiento'
              AND origen_id = %s
            """,
            (orden_id,),
        )
        assert cur.fetchone()["cantidad"] == 1


def test_venta_serializada_usa_precio_personalizado_de_la_unidad(
    client,
    db_conn,
    seed_serializacion,
):
    creada = _crear_bici_serializada(client, seed_serializacion, "CUADRO-PRECIO-PROPIO")
    assert creada.status_code == 200, creada.text
    bicicleta_id = creada.json()["bicicleta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET precio_venta_personalizado = 1123000
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
    db_conn.commit()

    simulacion = client.post(
        "/ventas/simular",
        json={
            "id_cliente": seed_serializacion["cliente_id"],
            "id_sucursal": seed_serializacion["sucursal_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": bicicleta_id,
                }
            ],
            "pagos": [],
        },
    )
    assert simulacion.status_code == 200, simulacion.text
    assert simulacion.json()["subtotal_base"] == "1123000.00"
    assert simulacion.json()["total_final"] == "1123000.00"

    venta = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT precio_lista, precio_final FROM venta_items WHERE id_venta = %s",
            (venta_id,),
        )
        item = cur.fetchone()
    assert item["precio_lista"] == Decimal("1123000.00")
    assert item["precio_final"] == Decimal("1123000.00")


def test_reserva_serializada_usa_precio_personalizado_de_la_unidad(
    client,
    db_conn,
    seed_serializacion,
):
    creada = _crear_bici_serializada(client, seed_serializacion, "CUADRO-RES-PRECIO-PROPIO")
    assert creada.status_code == 200, creada.text
    bicicleta_id = creada.json()["bicicleta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET precio_venta_personalizado = 1099000
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
    db_conn.commit()

    reserva = _crear_reserva_serializada(client, seed_serializacion, bicicleta_id)
    assert reserva.status_code == 200, reserva.text
    reserva_id = reserva.json()["reserva_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT precio_estimado FROM reserva_items WHERE id_reserva = %s",
            (reserva_id,),
        )
        item = cur.fetchone()
    assert item["precio_estimado"] == Decimal("1099000.00")

def test_crear_bicicleta_serializada_normaliza_numero_cuadro(
    client,
    db_conn,
    seed_serializacion,
):
    response = _crear_bici_serializada(client, seed_serializacion, "  abc-123  ")

    assert response.status_code == 200, response.text

    bicicleta_id = response.json()["bicicleta_id"]
    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)

    assert bicicleta["numero_cuadro"] == "ABC-123"

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


def _preparar_stock_serializable(db_conn, seed_serializacion, cantidad: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = %s
            WHERE id_sucursal = %s AND id_variante = %s
            """,
            (
                cantidad,
                seed_serializacion["sucursal_id"],
                seed_serializacion["variante_id"],
            ),
        )
    db_conn.commit()


def _crear_otra_variante_serializable(db_conn, seed_serializacion):
    with db_conn.cursor() as cur:
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
            VALUES (
                (SELECT id_categoria FROM productos WHERE id = %s),
                'Bicicleta Test Otra Variante',
                'producto',
                TRUE,
                TRUE,
                TRUE
            )
            RETURNING id
            """,
            (seed_serializacion["producto_id"],),
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
            VALUES (%s, 'R29 Tigris M Azul', 'BICI-TEST-R29-TIGRIS-M-AZUL', 1000000, 850000, 700000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

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
            (seed_serializacion["sucursal_id"], variante_id),
        )

    db_conn.commit()
    return variante_id


def test_crear_bicicletas_serializadas_permite_numero_cuadro_repetido_misma_variante(
    client,
    db_conn,
    seed_serializacion,
):
    _preparar_stock_serializable(db_conn, seed_serializacion, 2)

    r1 = _crear_bici_serializada(client, seed_serializacion, "CUADRO-DUP-001")
    assert r1.status_code == 200, r1.text

    r2 = _crear_bici_serializada(client, seed_serializacion, "CUADRO-DUP-001")
    assert r2.status_code == 200, r2.text

    ids = {r1.json()["bicicleta_id"], r2.json()["bicicleta_id"]}
    assert len(ids) == 2

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, id_variante, numero_cuadro
            FROM bicicletas_serializadas
            WHERE numero_cuadro = 'CUADRO-DUP-001'
            ORDER BY id
            """
        )
        bicis = cur.fetchall()

    assert len(bicis) == 2
    assert {bici["id"] for bici in bicis} == ids
    assert {bici["id_variante"] for bici in bicis} == {
        seed_serializacion["variante_id"]
    }


def test_crear_bicicletas_serializadas_permite_numero_cuadro_repetido_distinta_variante(
    client,
    db_conn,
    seed_serializacion,
):
    otra_variante_id = _crear_otra_variante_serializable(db_conn, seed_serializacion)

    r1 = _crear_bici_serializada(client, seed_serializacion, "TIGRIS-DUP-001")
    assert r1.status_code == 200, r1.text

    payload_otra = {
        "id_variante": otra_variante_id,
        "id_sucursal_actual": seed_serializacion["sucursal_id"],
        "numero_cuadro": "TIGRIS-DUP-001",
        "observaciones": "Mismo cuadro de fabrica en otra variante",
        "id_usuario": seed_serializacion["usuario_id"],
    }
    r2 = client.post("/bicicletas_serializadas", json=payload_otra)
    assert r2.status_code == 200, r2.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, id_variante
            FROM bicicletas_serializadas
            WHERE numero_cuadro = 'TIGRIS-DUP-001'
            ORDER BY id
            """
        )
        bicis = cur.fetchall()

    assert len(bicis) == 2
    assert {bici["id_variante"] for bici in bicis} == {
        seed_serializacion["variante_id"],
        otra_variante_id,
    }


def test_corregir_numero_cuadro_serializada_normaliza_y_audita(
    client,
    db_conn,
    seed_serializacion,
):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-OLD-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    response = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/numero-cuadro",
        json={
            "numero_cuadro": "  nuevo-123  ",
            "motivo": "Error de carga inicial",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["ok"] is True
    assert data["bicicleta_id"] == bicicleta_id
    assert data["numero_cuadro_anterior"] == "CUADRO-OLD-001"
    assert data["numero_cuadro_nuevo"] == "NUEVO-123"

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["id"] == bicicleta_id
    assert bicicleta["numero_cuadro"] == "NUEVO-123"

    auditoria = get_auditoria_by_entidad(db_conn, "bicicleta_serializada", bicicleta_id)
    correcciones = [
        evento for evento in auditoria if evento["accion"] == "numero_cuadro_corregido"
    ]
    assert len(correcciones) == 1
    assert correcciones[0]["metadata"]["numero_cuadro_anterior"] == "CUADRO-OLD-001"
    assert correcciones[0]["metadata"]["numero_cuadro_nuevo"] == "NUEVO-123"
    assert correcciones[0]["metadata"]["motivo"] == "Error de carga inicial"


def test_corregir_numero_cuadro_rechaza_motivo_vacio_y_mismo_numero(
    client,
    seed_serializacion,
):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-MISMO-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    sin_motivo = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/numero-cuadro",
        json={
            "numero_cuadro": "CUADRO-NUEVO-001",
            "motivo": "   ",
        },
    )
    assert sin_motivo.status_code == 400
    assert "motivo" in sin_motivo.json()["detail"].lower()

    mismo = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/numero-cuadro",
        json={
            "numero_cuadro": " cuadro-mismo-001 ",
            "motivo": "Verificado",
        },
    )
    assert mismo.status_code == 400
    assert "coincide" in mismo.json()["detail"].lower()


def test_corregir_numero_cuadro_permite_numero_repetido(
    client,
    db_conn,
    seed_serializacion,
):
    _preparar_stock_serializable(db_conn, seed_serializacion, 2)

    bici_1 = _crear_bici_serializada(client, seed_serializacion, "CUADRO-REP-001")
    bici_2 = _crear_bici_serializada(client, seed_serializacion, "CUADRO-REP-002")
    assert bici_1.status_code == 200, bici_1.text
    assert bici_2.status_code == 200, bici_2.text

    bicicleta_2_id = bici_2.json()["bicicleta_id"]
    response = client.patch(
        f"/bicicletas_serializadas/{bicicleta_2_id}/numero-cuadro",
        json={
            "numero_cuadro": "CUADRO-REP-001",
            "motivo": "Cuadro repetido de fábrica",
        },
    )

    assert response.status_code == 200, response.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM bicicletas_serializadas
            WHERE numero_cuadro = 'CUADRO-REP-001'
            ORDER BY id
            """
        )
        rows = cur.fetchall()

    assert len(rows) == 2


def test_corregir_numero_cuadro_entregada_actualiza_ficha_cliente_sin_cambiar_id(
    client,
    db_conn,
    seed_serializacion,
):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-CLI-001")
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
        json={
            "id_usuario": seed_serializacion["usuario_id"],
            "condicion_entrega_bicicleta": "en_caja",
            "plan_postventa_bicicleta": "garantia_fabrica",
        },
    )
    assert entregar.status_code == 200, entregar.text

    response = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/numero-cuadro",
        json={
            "numero_cuadro": "CUADRO-CLI-CORREGIDO",
            "motivo": "Corrección posterior a entrega",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["bicicletas_cliente_actualizadas"] == 1

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["id"] == bicicleta_id
    assert bicicleta["numero_cuadro"] == "CUADRO-CLI-CORREGIDO"

    bicis_cliente = _get_bicicletas_cliente_por_serializada(db_conn, bicicleta_id)
    assert len(bicis_cliente) == 1
    assert bicis_cliente[0]["id_bicicleta_serializada"] == bicicleta_id
    assert bicis_cliente[0]["id_venta_origen"] == venta_id
    assert bicis_cliente[0]["numero_cuadro"] == "CUADRO-CLI-CORREGIDO"
    assert bicis_cliente[0]["condicion_entrega"] == "en_caja"
    assert bicis_cliente[0]["plan_postventa"] == "garantia_fabrica"


def test_detalle_reserva_serializada_muestra_numero_actual_y_conserva_id(
    client,
    seed_serializacion,
):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-RES-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    crear_reserva = _crear_reserva_serializada(client, seed_serializacion, bicicleta_id)
    assert crear_reserva.status_code == 200, crear_reserva.text
    reserva_id = crear_reserva.json()["reserva_id"]

    detalle = client.get(f"/reservas/{reserva_id}")
    assert detalle.status_code == 200, detalle.text
    item = detalle.json()["items"][0]

    assert item["id_bicicleta_serializada"] == bicicleta_id
    assert item["serializada_numero_cuadro"] == "CUADRO-RES-001"
    assert item["serializada_estado"] == "reservada"
    assert item["producto_nombre"] == "Bicicleta Test"
    assert item["nombre_variante"] == "R29 Negra"


def test_detalle_reserva_refleja_correccion_numero_cuadro_sin_perder_asociacion(
    client,
    seed_serializacion,
):
    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-RES-OLD")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    crear_reserva = _crear_reserva_serializada(client, seed_serializacion, bicicleta_id)
    assert crear_reserva.status_code == 200, crear_reserva.text
    reserva_id = crear_reserva.json()["reserva_id"]

    correccion = client.patch(
        f"/bicicletas_serializadas/{bicicleta_id}/numero-cuadro",
        json={
            "numero_cuadro": "CUADRO-RES-NUEVO",
            "motivo": "Correccion de cuadro en reserva",
        },
    )
    assert correccion.status_code == 200, correccion.text

    detalle = client.get(f"/reservas/{reserva_id}")
    assert detalle.status_code == 200, detalle.text
    item = detalle.json()["items"][0]

    assert item["id_bicicleta_serializada"] == bicicleta_id
    assert item["serializada_numero_cuadro"] == "CUADRO-RES-NUEVO"
    assert item["serializada_estado"] == "reservada"


def test_detalle_reserva_sin_unidad_serializada_expone_estado_sin_asignacion(
    client,
    seed_serializacion,
):
    crear_reserva = _crear_reserva_sin_serie(client, seed_serializacion)
    assert crear_reserva.status_code == 200, crear_reserva.text
    reserva_id = crear_reserva.json()["reserva_id"]

    detalle = client.get(f"/reservas/{reserva_id}")
    assert detalle.status_code == 200, detalle.text
    item = detalle.json()["items"][0]

    assert item["id_bicicleta_serializada"] is None
    assert item["serializada_numero_cuadro"] is None
    assert item["serializada_estado"] is None


def test_reserva_items_no_guarda_snapshot_duplicado_de_numero_cuadro(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'reserva_items'
              AND column_name IN ('numero_cuadro', 'serializada_numero_cuadro')
            """
        )
        columnas = cur.fetchall()

    assert columnas == []


def test_venta_sin_serie_entrega_en_caja_desde_stock_fisico(
    client,
    db_conn,
    seed_serializacion,
):
    response = _crear_venta_sin_serie(client, seed_serializacion)
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["estado"] == "creada"

    venta_id = data["venta_id"]
    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"

    detalle = client.get(f"/ventas/{venta_id}")
    assert detalle.status_code == 200, detalle.text
    detalle_item = detalle.json()["items"][0]
    assert detalle_item["serializable"] is True
    assert detalle_item["id_bicicleta_serializada"] is None

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
        json={
            "id_usuario": seed_serializacion["usuario_id"],
            "condicion_entrega_bicicleta": "en_caja",
        },
    )
    assert entregar.status_code == 200, entregar.text

    venta_entregada = get_venta(db_conn, venta_id)
    assert venta_entregada["estado"] == "entregada"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [mov["tipo_movimiento"] for mov in movimientos]
    assert tipos == ["venta", "entrega"]
    assert all(mov["id_bicicleta_serializada"] is None for mov in movimientos)


def test_venta_sin_serie_sigue_bloqueando_entrega_armada(
    client,
    db_conn,
    seed_serializacion,
):
    response = _crear_venta_sin_serie(client, seed_serializacion)
    assert response.status_code == 200, response.text
    venta_id = response.json()["venta_id"]

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
        json={
            "id_usuario": seed_serializacion["usuario_id"],
            "condicion_entrega_bicicleta": "armada",
        },
    )
    assert entregar.status_code == 400
    assert "numero de cuadro" in entregar.json()["detail"].lower()


def test_asignar_numero_cuadro_a_venta_en_caja_entregada_sin_mover_stock(
    client,
    db_conn,
    seed_serializacion,
):
    response = _crear_venta_sin_serie(client, seed_serializacion)
    assert response.status_code == 200, response.text
    venta_id = response.json()["venta_id"]

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
        json={
            "id_usuario": seed_serializacion["usuario_id"],
            "condicion_entrega_bicicleta": "en_caja",
        },
    )
    assert entregar.status_code == 200, entregar.text

    detalle = client.get(f"/ventas/{venta_id}")
    assert detalle.status_code == 200, detalle.text
    item_id = detalle.json()["items"][0]["id"]
    descripcion_larga = _forzar_descripcion_larga_venta(db_conn, venta_id)

    asignar = client.post(
        f"/ventas/{venta_id}/asignar-bicicleta-serializada",
        json={
            "id_venta_item": item_id,
            "numero_cuadro": "cuadro-post-venta-001",
            "motivo": "Correccion de venta cargada en caja",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert asignar.status_code == 200, asignar.text
    data = asignar.json()
    bicicleta_id = data["id_bicicleta_serializada"]
    assert data["estado_bicicleta"] == "entregada"
    assert data["bicicleta_cliente_creada"] is True

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "entregada"
    assert bicicleta["numero_cuadro"] == "CUADRO-POST-VENTA-001"

    detalle_actualizado = client.get(f"/ventas/{venta_id}")
    assert detalle_actualizado.status_code == 200, detalle_actualizado.text
    item = detalle_actualizado.json()["items"][0]
    assert item["id_bicicleta_serializada"] == bicicleta_id
    assert item["bicicleta_numero_cuadro"] == "CUADRO-POST-VENTA-001"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0

    movimientos = get_movimientos_by_venta(db_conn, venta_id)
    tipos = [mov["tipo_movimiento"] for mov in movimientos]
    assert tipos == ["venta", "entrega", "entrega_serializada"]
    assert movimientos[-1]["id_bicicleta_serializada"] == bicicleta_id

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id_cliente,
                id_bicicleta_serializada,
                id_venta_origen,
                modelo,
                numero_cuadro
            FROM bicicletas_clientes
            WHERE id_venta_origen = %s
            """,
            (venta_id,),
        )
        ficha = cur.fetchone()

    assert ficha["id_cliente"] == seed_serializacion["cliente_id"]
    assert ficha["id_bicicleta_serializada"] == bicicleta_id
    assert ficha["numero_cuadro"] == "CUADRO-POST-VENTA-001"
    assert len(ficha["modelo"]) <= 100
    assert ficha["modelo"].endswith("...")
    assert descripcion_larga.startswith(ficha["modelo"].removesuffix("..."))

    eventos = get_auditoria_by_entidad(db_conn, "venta", venta_id)
    assert any(
        evento["accion"] == "venta_bicicleta_serializada_asignada"
        for evento in eventos
    )


def test_asignar_numero_cuadro_antes_de_entregar_cierra_pendiente_al_entregar(
    client,
    db_conn,
    seed_serializacion,
):
    response = _crear_venta_sin_serie(client, seed_serializacion)
    assert response.status_code == 200, response.text
    venta_id = response.json()["venta_id"]

    detalle = client.get(f"/ventas/{venta_id}")
    assert detalle.status_code == 200, detalle.text
    item_id = detalle.json()["items"][0]["id"]

    asignar = client.post(
        f"/ventas/{venta_id}/asignar-bicicleta-serializada",
        json={
            "id_venta_item": item_id,
            "numero_cuadro": "cuadro-pendiente-001",
            "motivo": "Cliente pago por partes y se aparta la unidad",
            "id_usuario": seed_serializacion["usuario_id"],
        },
    )
    assert asignar.status_code == 200, asignar.text
    bicicleta_id = asignar.json()["id_bicicleta_serializada"]

    bicicleta = _get_bicicleta_serializada(db_conn, bicicleta_id)
    assert bicicleta["estado"] == "vendida_pendiente_entrega"

    stock = get_stock_row(
        db_conn,
        seed_serializacion["sucursal_id"],
        seed_serializacion["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 1.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 1.0

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
        json={
            "id_usuario": seed_serializacion["usuario_id"],
            "condicion_entrega_bicicleta": "armada",
        },
    )
    assert entregar.status_code == 200, entregar.text

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
    tipos = [mov["tipo_movimiento"] for mov in movimientos]
    assert tipos == ["venta", "entrega"]
    assert movimientos[-1]["id_bicicleta_serializada"] == bicicleta_id


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


def test_venta_con_bicis_de_mismo_numero_cuadro_traza_por_id_serializada(
    client,
    db_conn,
    seed_serializacion,
):
    _preparar_stock_serializable(db_conn, seed_serializacion, 2)

    crear_bici_1 = _crear_bici_serializada(client, seed_serializacion, "TIGRIS-MISMO-001")
    crear_bici_2 = _crear_bici_serializada(client, seed_serializacion, "TIGRIS-MISMO-001")
    assert crear_bici_1.status_code == 200, crear_bici_1.text
    assert crear_bici_2.status_code == 200, crear_bici_2.text
    bicicleta_1_id = crear_bici_1.json()["bicicleta_id"]
    bicicleta_2_id = crear_bici_2.json()["bicicleta_id"]

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
                    "id_bicicleta_serializada": bicicleta_1_id,
                },
                {
                    "id_variante": seed_serializacion["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": bicicleta_2_id,
                },
            ],
        },
    )
    assert response.status_code == 200, response.text
    venta_id = response.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_bicicleta_serializada
            FROM venta_items
            WHERE id_venta = %s
            ORDER BY id
            """,
            (venta_id,),
        )
        items = cur.fetchall()

    assert [item["id_bicicleta_serializada"] for item in items] == [
        bicicleta_1_id,
        bicicleta_2_id,
    ]

    bicicleta_1 = _get_bicicleta_serializada(db_conn, bicicleta_1_id)
    bicicleta_2 = _get_bicicleta_serializada(db_conn, bicicleta_2_id)
    assert bicicleta_1["estado"] == "vendida_pendiente_entrega"
    assert bicicleta_2["estado"] == "vendida_pendiente_entrega"


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
    _preparar_stock_serializable(db_conn, seed_serializacion, 2)

    crear_bici = _crear_bici_serializada(client, seed_serializacion, "CUADRO-ENT-001")
    assert crear_bici.status_code == 200, crear_bici.text
    bicicleta_id = crear_bici.json()["bicicleta_id"]

    otra_bici_mismo_cuadro = _crear_bici_serializada(
        client,
        seed_serializacion,
        "CUADRO-ENT-001",
    )
    assert otra_bici_mismo_cuadro.status_code == 200, otra_bici_mismo_cuadro.text

    crear_venta = _crear_venta_serializada(client, seed_serializacion, bicicleta_id)
    assert crear_venta.status_code == 200, crear_venta.text
    venta_id = crear_venta.json()["venta_id"]
    descripcion_larga = _forzar_descripcion_larga_venta(db_conn, venta_id)

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
    assert bicis_cliente[0]["id_bicicleta_serializada"] == bicicleta_id
    assert len(bicis_cliente[0]["modelo"]) <= 100
    assert bicis_cliente[0]["modelo"].endswith("...")
    assert descripcion_larga.startswith(
        bicis_cliente[0]["modelo"].removesuffix("...")
    )


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
