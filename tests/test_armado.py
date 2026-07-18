from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest

from app.core.auth import crear_token_usuario
from app.core.config import settings
from tests.conftest import asignar_rol_usuario, get_auditoria_by_entidad


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def _crear_usuario(db_conn, *, username: str, rol: str):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, email, password_hash, activo)
            VALUES (%s, %s, %s, 'hash_dummy', TRUE)
            RETURNING id
            """,
            (username.upper(), username, f"{username}@test.local"),
        )
        usuario_id = cur.fetchone()["id"]

    asignar_rol_usuario(db_conn, usuario_id, rol)
    db_conn.commit()
    token = crear_token_usuario(
        {
            "id": usuario_id,
            "username": username,
            "rol": rol,
        }
    )
    return usuario_id, token


def _asegurar_permiso_armado(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO permisos (codigo, descripcion)
            VALUES (
                'gestionar_armado',
                'Administrar modelos, versiones y configuraciones de armado de bicicletas'
            )
            ON CONFLICT (codigo) DO NOTHING
            """
        )
        cur.execute(
            """
            INSERT INTO rol_permisos (id_rol, id_permiso)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN permisos p
            WHERE r.nombre IN ('administrador', 'encargado')
              AND p.codigo = 'gestionar_armado'
            ON CONFLICT (id_rol, id_permiso) DO NOTHING
            """
        )
    db_conn.commit()


@pytest.fixture()
def seed_armado(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, email, password_hash, activo)
            VALUES ('Admin Armado', 'admin_armado_seed', 'admin_armado@test.local', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]

        cur.execute("INSERT INTO categorias (nombre) VALUES ('Bicicletas') RETURNING id")
        categoria_bici_id = cur.fetchone()["id"]
        cur.execute("INSERT INTO categorias (nombre) VALUES ('Componentes') RETURNING id")
        categoria_comp_id = cur.fetchone()["id"]

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
            VALUES (%s, 'BICICLETA AGUS R29', 'producto', TRUE, TRUE, TRUE)
            RETURNING id
            """,
            (categoria_bici_id,),
        )
        producto_final_id = cur.fetchone()["id"]

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
            VALUES (%s, 'TALLE M', 'BIC-AGUS-R29-M', 650000, 580000, 0, TRUE)
            RETURNING id
            """,
            (producto_final_id,),
        )
        variante_final_id = cur.fetchone()["id"]

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
            VALUES (%s, 'BICICLETA NO SERIALIZADA', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_bici_id,),
        )
        producto_no_serial_id = cur.fetchone()["id"]

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
            VALUES (%s, 'UNICA', 'BIC-NO-SERIAL', 100000, 90000, 50000, TRUE)
            RETURNING id
            """,
            (producto_no_serial_id,),
        )
        variante_no_serial_id = cur.fetchone()["id"]

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
            VALUES (%s, 'CUADRO R29', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_comp_id,),
        )
        producto_cuadro_id = cur.fetchone()["id"]

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
            VALUES (%s, 'M', 'CUADRO-R29-M', 180000, 160000, 100000, TRUE)
            RETURNING id
            """,
            (producto_cuadro_id,),
        )
        variante_cuadro_id = cur.fetchone()["id"]

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
            VALUES (%s, 'RUEDA R29', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_comp_id,),
        )
        producto_rueda_id = cur.fetchone()["id"]

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
            VALUES (%s, 'DEL/TRAS', 'RUEDA-R29', 90000, 80000, 35000, TRUE)
            RETURNING id
            """,
            (producto_rueda_id,),
        )
        variante_rueda_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Local Test', 'Direccion Test', TRUE)
            RETURNING id
            """
        )
        sucursal_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Armado', '111', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 4, 0, 0)
            """,
            (sucursal_id, variante_cuadro_id),
        )
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 6, 2, 0)
            """,
            (sucursal_id, variante_rueda_id),
        )

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
            VALUES (%s, 'TAPON COSTO CERO', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_comp_id,),
        )
        producto_cero_id = cur.fetchone()["id"]
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
            VALUES (%s, 'UNICA', 'TAPON-CERO', 1000, 800, 0, TRUE)
            RETURNING id
            """,
            (producto_cero_id,),
        )
        variante_costo_cero_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 5, 0, 0)
            """,
            (sucursal_id, variante_costo_cero_id),
        )

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
            VALUES (%s, 'COMPONENTE SIN COSTO', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_comp_id,),
        )
        producto_sin_costo_id = cur.fetchone()["id"]
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
            VALUES (%s, 'UNICA', 'SIN-COSTO', 1000, 800, NULL, TRUE)
            RETURNING id
            """,
            (producto_sin_costo_id,),
        )
        variante_sin_costo_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 5, 0, 0)
            """,
            (sucursal_id, variante_sin_costo_id),
        )

    asignar_rol_usuario(db_conn, usuario_id, "administrador")
    _asegurar_permiso_armado(db_conn)
    db_conn.commit()
    token = crear_token_usuario(
        {
            "id": usuario_id,
            "username": "admin_armado_seed",
            "rol": "administrador",
        }
    )
    return {
        "usuario_id": usuario_id,
        "token": token,
        "headers": _headers(token),
        "variante_final_id": variante_final_id,
        "variante_no_serial_id": variante_no_serial_id,
        "variante_cuadro_id": variante_cuadro_id,
        "variante_rueda_id": variante_rueda_id,
        "variante_costo_cero_id": variante_costo_cero_id,
        "variante_sin_costo_id": variante_sin_costo_id,
        "sucursal_id": sucursal_id,
        "cliente_id": cliente_id,
    }


def _crear_modelo(client, seed_armado, nombre="Agus R29"):
    response = client.post(
        "/armado/modelos",
        headers=seed_armado["headers"],
        json={"nombre": nombre, "id_usuario": 9999},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _crear_version(client, seed_armado, modelo_id, nombre="Economica"):
    response = client.post(
        "/armado/versiones",
        headers=seed_armado["headers"],
        json={
            "id_modelo": modelo_id,
            "nombre": nombre,
            "id_variante_final": seed_armado["variante_final_id"],
            "id_usuario": 9999,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _crear_configuracion_con_items(client, seed_armado, version_id, nombre="Config base"):
    crear = client.post(
        "/armado/configuraciones",
        headers=seed_armado["headers"],
        json={"id_version": version_id, "nombre": nombre, "id_usuario": 9999},
    )
    assert crear.status_code == 201, crear.text
    config = crear.json()

    item_1 = client.post(
        f"/armado/configuraciones/{config['id']}/items",
        headers=seed_armado["headers"],
        json={
            "id_variante_componente": seed_armado["variante_cuadro_id"],
            "cantidad": "1",
            "orden": 1,
            "id_usuario": 9999,
        },
    )
    assert item_1.status_code == 200, item_1.text
    item_2 = client.post(
        f"/armado/configuraciones/{config['id']}/items",
        headers=seed_armado["headers"],
        json={
            "id_variante_componente": seed_armado["variante_rueda_id"],
            "cantidad": "2",
            "orden": 2,
            "id_usuario": 9999,
        },
    )
    assert item_2.status_code == 200, item_2.text
    return item_2.json()


def _crear_orden_lista_para_armar(client, seed_armado):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])
    activar = client.post(
        f"/armado/configuraciones/{config['id']}/activar",
        headers=seed_armado["headers"],
    )
    assert activar.status_code == 200, activar.text
    orden = client.post(
        "/armado/ordenes",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "talle": "M",
            "color": "NEGRO",
            "numero_cuadro": "ARMADO-CONSUMO",
            "descripcion_final": "Agus R29 lista",
            "precio_objetivo": "300000",
        },
    )
    assert orden.status_code == 201, orden.text
    lista = client.patch(
        f"/armado/ordenes/{orden.json()['id']}/estado",
        headers=seed_armado["headers"],
        json={"estado": "lista_para_armar"},
    )
    assert lista.status_code == 200, lista.text
    return lista.json()


def _crear_orden_en_armado(client, seed_armado):
    orden = _crear_orden_lista_para_armar(client, seed_armado)
    iniciar = client.post(
        f"/armado/ordenes/{orden['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert iniciar.status_code == 200, iniciar.text
    return iniciar.json()


def _finalizar_orden_armado(client, seed_armado):
    orden = _crear_orden_en_armado(client, seed_armado)
    control = client.post(
        f"/armado/ordenes/{orden['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert control.status_code == 200, control.text
    _aprobar_controles_finales(client, seed_armado, orden["id"])
    finalizar = client.post(
        f"/armado/ordenes/{orden['id']}/finalizar",
        headers=seed_armado["headers"],
        json={},
    )
    assert finalizar.status_code == 200, finalizar.text
    return finalizar.json()


def _crear_venta_serializada_armado(client, seed_armado, bicicleta_id):
    response = client.post(
        "/ventas/",
        headers=seed_armado["headers"],
        json={
            "id_cliente": seed_armado["cliente_id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "id_usuario": 9999,
            "items": [
                {
                    "id_variante": seed_armado["variante_final_id"],
                    "cantidad": "1",
                    "id_bicicleta_serializada": bicicleta_id,
                }
            ],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def _aprobar_controles_finales(client, seed_armado, orden_id):
    controles = [
        "direccion_ajustada",
        "frenos_ajustados",
        "transmision_regulada",
        "ruedas_revisadas",
        "torque_general_verificado",
        "presion_cubiertas_verificada",
        "prueba_funcional_realizada",
        "limpieza_final_realizada",
        "numero_cuadro_verificado",
    ]
    for codigo in controles:
        response = client.put(
            f"/armado/ordenes/{orden_id}/controles",
            headers=seed_armado["headers"],
            json={
                "codigo_control": codigo,
                "aprobado": True,
                "observaciones": "OK",
            },
        )
        assert response.status_code == 200, response.text


def test_modelo_versiones_y_validacion_variante_final_serializable(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)

    duplicado = client.post(
        "/armado/modelos",
        headers=seed_armado["headers"],
        json={"nombre": "agus r29", "id_usuario": seed_armado["usuario_id"]},
    )
    assert duplicado.status_code == 400
    assert "Ya existe" in duplicado.json()["detail"]

    for nombre in ("Economica", "Intermedia", "Pro"):
        version = _crear_version(client, seed_armado, modelo["id"], nombre)
        assert version["id_variante_final"] == seed_armado["variante_final_id"]

    no_serial = client.post(
        "/armado/versiones",
        headers=seed_armado["headers"],
        json={
            "id_modelo": modelo["id"],
            "nombre": "No serial",
            "id_variante_final": seed_armado["variante_no_serial_id"],
            "id_usuario": seed_armado["usuario_id"],
        },
    )
    assert no_serial.status_code == 400
    assert "serializable" in no_serial.json()["detail"]


def test_configuracion_items_estimacion_costos_activacion_y_unica_activa(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])

    assert len(config["items"]) == 2
    assert Decimal(config["costo_estimado_total"]) == Decimal("170000.0000")
    assert config["items"][0]["origen_costo"] == "costo_promedio_vigente"

    mismo_final = client.post(
        f"/armado/configuraciones/{config['id']}/items",
        headers=seed_armado["headers"],
        json={
            "id_variante_componente": seed_armado["variante_final_id"],
            "cantidad": "1",
            "id_usuario": seed_armado["usuario_id"],
        },
    )
    assert mismo_final.status_code == 400
    assert "misma variante final" in mismo_final.json()["detail"]

    activar = client.post(
        f"/armado/configuraciones/{config['id']}/activar",
        headers=seed_armado["headers"],
    )
    assert activar.status_code == 200, activar.text
    assert activar.json()["estado"] == "activa"

    editar_activa = client.post(
        f"/armado/configuraciones/{config['id']}/items",
        headers=seed_armado["headers"],
        json={
            "id_variante_componente": seed_armado["variante_cuadro_id"],
            "cantidad": "1",
            "id_usuario": seed_armado["usuario_id"],
        },
    )
    assert editar_activa.status_code == 400
    assert "borrador" in editar_activa.json()["detail"]

    duplicar = client.post(
        f"/armado/configuraciones/{config['id']}/duplicar",
        headers=seed_armado["headers"],
        json={"nombre": "Config mejorada", "id_usuario": seed_armado["usuario_id"]},
    )
    assert duplicar.status_code == 200, duplicar.text
    config_2 = duplicar.json()
    assert config_2["estado"] == "borrador"
    assert len(config_2["items"]) == 2

    activar_2 = client.post(
        f"/armado/configuraciones/{config_2['id']}/activar",
        headers=seed_armado["headers"],
    )
    assert activar_2.status_code == 200, activar_2.text

    activa = client.get(
        f"/armado/versiones/{version['id']}/configuracion-activa",
        headers=seed_armado["headers"],
    )
    assert activa.status_code == 200
    assert activa.json()["id"] == config_2["id"]

    anterior = client.get(
        f"/armado/configuraciones/{config['id']}",
        headers=seed_armado["headers"],
    )
    assert anterior.status_code == 200
    assert anterior.json()["estado"] == "archivada"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM armado_configuraciones
            WHERE id_version = %s
              AND estado = 'activa'
            """,
            (version["id"],),
        )
        assert cur.fetchone()["total"] == 1


def test_armado_no_toca_stock_ni_movimientos(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        movimientos_antes = cur.fetchone()["total"]
        cur.execute(
            """
            SELECT stock_fisico, stock_reservado, stock_vendido_pendiente_entrega
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_cuadro_id"]),
        )
        stock_antes = cur.fetchone()

    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])
    activar = client.post(
        f"/armado/configuraciones/{config['id']}/activar",
        headers=seed_armado["headers"],
    )
    assert activar.status_code == 200

    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        assert cur.fetchone()["total"] == movimientos_antes
        cur.execute(
            """
            SELECT stock_fisico, stock_reservado, stock_vendido_pendiente_entrega
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_cuadro_id"]),
        )
        stock_despues = cur.fetchone()

    assert stock_despues == stock_antes


def test_modelo_y_version_con_asociaciones_se_pueden_desactivar_sin_borrar(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    _crear_configuracion_con_items(client, seed_armado, version["id"])

    desactivar_modelo = client.patch(
        f"/armado/modelos/{modelo['id']}/estado",
        headers=seed_armado["headers"],
        json={"activo": False, "id_usuario": seed_armado["usuario_id"]},
    )
    assert desactivar_modelo.status_code == 200
    assert desactivar_modelo.json()["activo"] is False

    desactivar_version = client.patch(
        f"/armado/versiones/{version['id']}/estado",
        headers=seed_armado["headers"],
        json={"activo": False, "id_usuario": seed_armado["usuario_id"]},
    )
    assert desactivar_version.status_code == 200
    assert desactivar_version.json()["activo"] is False

    eliminar_modelo = client.delete(
        f"/armado/modelos/{modelo['id']}",
        headers=seed_armado["headers"],
    )
    eliminar_version = client.delete(
        f"/armado/versiones/{version['id']}",
        headers=seed_armado["headers"],
    )
    assert eliminar_modelo.status_code == 405
    assert eliminar_version.status_code == 405


def test_permiso_y_auditoria_usan_usuario_autenticado(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _asegurar_permiso_armado(db_conn)
    operador_id, operador_token = _crear_usuario(
        db_conn,
        username="operador_armado",
        rol="operador",
    )
    admin_id, admin_token = _crear_usuario(
        db_conn,
        username="admin_armado_permiso",
        rol="administrador",
    )

    bloqueado = client.post(
        "/armado/modelos",
        headers=_headers(operador_token),
        json={"nombre": "Bloqueado", "id_usuario": admin_id},
    )
    assert bloqueado.status_code == 403
    assert "gestionar_armado" in bloqueado.json()["detail"]

    creado = client.post(
        "/armado/modelos",
        headers=_headers(admin_token),
        json={"nombre": "Modelo auditado", "id_usuario": operador_id},
    )
    assert creado.status_code == 201, creado.text
    modelo_id = creado.json()["id"]

    eventos = get_auditoria_by_entidad(db_conn, "armado_modelo", modelo_id)
    assert eventos
    assert eventos[-1]["id_usuario"] == admin_id
    assert eventos[-1]["accion"] == "armado_modelo_creado"


def test_simulador_calcula_costos_stock_fabricable_y_margenes(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])

    response = client.post(
        "/armado/simulador/calcular",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "costo_mano_obra": "25000",
            "costo_consumibles_no_inventariados": "5000.50",
            "costo_trabajos_externos": "1000.25",
            "otros_costos": "3000.25",
            "precio_comercial": "300000",
            "margen_objetivo": "35",
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["calculo_completo"] is True
    assert Decimal(data["costo_componentes"]) == Decimal("170000.00")
    assert Decimal(data["costo_total"]) == Decimal("204001.00")
    assert Decimal(data["cantidad_fabricable"]) == Decimal("2")
    assert data["componente_limitante"]["id_variante"] == seed_armado["variante_rueda_id"]
    assert Decimal(data["utilidad_estimada"]) == Decimal("95999.00")
    assert Decimal(data["margen_sobre_venta"]) == Decimal("32.00")
    assert len(data["escenarios"]) == 4
    assert Decimal(data["precio_sugerido"]) > Decimal("300000")


def test_simulador_distingue_costo_faltante_y_costo_cero(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])

    response = client.post(
        "/armado/simulador/calcular",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "componentes": [
                {
                    "id_variante": seed_armado["variante_costo_cero_id"],
                    "cantidad": "1",
                },
                {
                    "id_variante": seed_armado["variante_sin_costo_id"],
                    "cantidad": "1",
                },
            ],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["calculo_completo"] is False
    por_id = {item["id_variante"]: item for item in data["componentes"]}
    cero = por_id[seed_armado["variante_costo_cero_id"]]
    faltante = por_id[seed_armado["variante_sin_costo_id"]]
    assert cero["costo_disponible"] is True
    assert cero["costo_cero"] is True
    assert cero["estado_costo"] == "Costo cero"
    assert faltante["costo_disponible"] is False
    assert faltante["estado_costo"] == "Costo faltante"
    assert faltante["subtotal_estimado"] is None


def test_simulador_stock_cero_componente_limitante_y_opcional_excluido(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = 0
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_costo_cero_id"]),
        )
    db_conn.commit()

    response = client.post(
        "/armado/simulador/calcular",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "componentes": [
                {"id_variante": seed_armado["variante_cuadro_id"], "cantidad": "1"},
                {
                    "id_variante": seed_armado["variante_costo_cero_id"],
                    "cantidad": "1",
                    "opcional": True,
                },
            ],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert Decimal(data["cantidad_fabricable"]) == Decimal("4")
    opcional = next(
        item for item in data["componentes"]
        if item["id_variante"] == seed_armado["variante_costo_cero_id"]
    )
    assert opcional["opcional"] is True
    assert opcional["cantidad_fabricable_por_componente"] == "0"
    assert opcional["estado_disponibilidad"] == "Sin stock disponible"


def test_simulador_no_persiste_ni_mueve_stock_y_rechaza_variante_final(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])
    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        movimientos_antes = cur.fetchone()["total"]
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM armado_configuracion_items
            WHERE id_configuracion = %s
            """,
            (config["id"],),
        )
        items_antes = cur.fetchone()["total"]

    response = client.post(
        "/armado/simulador/calcular",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "componentes": [
                {"id_variante": seed_armado["variante_cuadro_id"], "cantidad": "1.5"},
                {"id_variante": seed_armado["variante_rueda_id"], "cantidad": "2"},
            ],
        },
    )
    assert response.status_code == 200, response.text

    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        assert cur.fetchone()["total"] == movimientos_antes
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM armado_configuracion_items
            WHERE id_configuracion = %s
            """,
            (config["id"],),
        )
        assert cur.fetchone()["total"] == items_antes

    final = client.post(
        "/armado/simulador/calcular",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "componentes": [
                {"id_variante": seed_armado["variante_final_id"], "cantidad": "1"},
            ],
        },
    )
    assert final.status_code == 400
    assert "variante final" in final.json()["detail"]


def test_simulador_valida_permisos_y_parametros_invalidos(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    _asegurar_permiso_armado(db_conn)
    _operador_id, operador_token = _crear_usuario(
        db_conn,
        username="operador_simulador",
        rol="operador",
    )
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])

    bloqueado = client.post(
        "/armado/simulador/calcular",
        headers=_headers(operador_token),
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
        },
    )
    assert bloqueado.status_code == 403

    margen_invalido = client.post(
        "/armado/simulador/calcular",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "margen_objetivo": "100",
        },
    )
    assert margen_invalido.status_code == 422

    costo_negativo = client.post(
        "/armado/simulador/calcular",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "costo_mano_obra": "-1",
        },
    )
    assert costo_negativo.status_code == 422


def test_revision_configuracion_es_automatica_independiente_y_no_reutiliza(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version_1 = _crear_version(client, seed_armado, modelo["id"], "Economica")
    version_2 = _crear_version(client, seed_armado, modelo["id"], "Intermedia")

    c1 = client.post(
        "/armado/configuraciones",
        headers=seed_armado["headers"],
        json={"id_version": version_1["id"], "nombre": "Base"},
    )
    c2 = client.post(
        "/armado/configuraciones",
        headers=seed_armado["headers"],
        json={"id_version": version_1["id"], "nombre": "Base 2"},
    )
    c3 = client.post(
        "/armado/configuraciones",
        headers=seed_armado["headers"],
        json={"id_version": version_2["id"], "nombre": "Intermedia base"},
    )
    assert c1.status_code == 201, c1.text
    assert c2.status_code == 201, c2.text
    assert c3.status_code == 201, c3.text
    assert c1.json()["numero_revision"] == 1
    assert c2.json()["numero_revision"] == 2
    assert c3.json()["numero_revision"] == 1

    duplicar = client.post(
        f"/armado/configuraciones/{c1.json()['id']}/duplicar",
        headers=seed_armado["headers"],
        json={"nombre": "Duplicada"},
    )
    assert duplicar.status_code == 200, duplicar.text
    assert duplicar.json()["numero_revision"] == 3

    archivar = client.post(
        f"/armado/configuraciones/{c2.json()['id']}/archivar",
        headers=seed_armado["headers"],
    )
    assert archivar.status_code == 200
    c4 = client.post(
        "/armado/configuraciones",
        headers=seed_armado["headers"],
        json={"id_version": version_1["id"], "nombre": "Base 4", "numero_revision": 2},
    )
    assert c4.status_code == 201, c4.text
    assert c4.json()["numero_revision"] == 4

    editar_numero = client.put(
        f"/armado/configuraciones/{c4.json()['id']}",
        headers=seed_armado["headers"],
        json={"nombre": "Editada", "descripcion": "No acepta numero", "numero_revision": 99},
    )
    assert editar_numero.status_code == 200
    assert editar_numero.json()["numero_revision"] == 4


def test_revision_configuracion_concurrente_no_repite_numero(
    client,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"], "Concurrente")

    def crear_config(indice):
        response = client.post(
            "/armado/configuraciones",
            headers=seed_armado["headers"],
            json={"id_version": version["id"], "nombre": f"Config concurrente {indice}"},
        )
        assert response.status_code == 201, response.text
        return response.json()["numero_revision"]

    with ThreadPoolExecutor(max_workers=2) as executor:
        revisiones = list(executor.map(crear_config, [1, 2]))

    assert sorted(revisiones) == [1, 2]


def test_crear_orden_desde_configuracion_activa_copia_snapshot_y_no_mueve_stock(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])

    borrador = client.post(
        "/armado/ordenes",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "talle": "M",
            "color": "NEGRO",
            "descripcion_final": "Agus R29 test",
        },
    )
    assert borrador.status_code == 400
    assert "activa" in borrador.json()["detail"]

    activar = client.post(
        f"/armado/configuraciones/{config['id']}/activar",
        headers=seed_armado["headers"],
    )
    assert activar.status_code == 200

    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        movimientos_antes = cur.fetchone()["total"]
        cur.execute("SELECT COUNT(*) AS total FROM bicicletas_serializadas")
        serializadas_antes = cur.fetchone()["total"]
        cur.execute("SELECT COUNT(*) AS total FROM ventas")
        ventas_antes = cur.fetchone()["total"]

    orden = client.post(
        "/armado/ordenes",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "talle": "M",
            "color": "NEGRO",
            "numero_cuadro": "REPETIDO-OK",
            "descripcion_final": "Agus R29 test",
            "precio_objetivo": "300000",
        },
    )
    assert orden.status_code == 201, orden.text
    data = orden.json()
    assert data["codigo"] == "OA-000001"
    assert data["estado"] == "borrador"
    assert len(data["items"]) == 2
    assert Decimal(data["costo_componentes_previsto"]) == Decimal("170000.00")

    client.post(
        f"/armado/configuraciones/{config['id']}/duplicar",
        headers=seed_armado["headers"],
        json={"nombre": "Cambia config"},
    )
    detalle = client.get(f"/armado/ordenes/{data['id']}", headers=seed_armado["headers"])
    assert detalle.status_code == 200
    assert len(detalle.json()["items"]) == 2

    with db_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        assert cur.fetchone()["total"] == movimientos_antes
        cur.execute("SELECT COUNT(*) AS total FROM bicicletas_serializadas")
        assert cur.fetchone()["total"] == serializadas_antes
        cur.execute("SELECT COUNT(*) AS total FROM ventas")
        assert cur.fetchone()["total"] == ventas_antes


def test_orden_sustitucion_costos_disponibilidad_estados_y_cancelacion(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])
    client.post(f"/armado/configuraciones/{config['id']}/activar", headers=seed_armado["headers"])

    orden = client.post(
        "/armado/ordenes",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "talle": "M",
            "color": "NEGRO",
            "numero_cuadro": "CUADRO-1",
            "descripcion_final": "Agus R29 lista",
            "precio_objetivo": "300000",
        },
    ).json()
    item = orden["items"][0]

    costo = client.post(
        f"/armado/ordenes/{orden['id']}/costos",
        headers=seed_armado["headers"],
        json={
            "tipo": "mano_obra",
            "descripcion": "Armado completo",
            "cantidad": "1",
            "costo_unitario": "25000",
        },
    )
    assert costo.status_code == 200, costo.text
    assert Decimal(costo.json()["costo_adicional_previsto"]) == Decimal("25000.00")

    sustituir = client.post(
        f"/armado/ordenes/{orden['id']}/items/{item['id']}/sustituir",
        headers=seed_armado["headers"],
        json={
            "id_variante_utilizada": seed_armado["variante_costo_cero_id"],
            "cantidad_utilizada": "1",
            "motivo_sustitucion": "Prueba de sustitucion",
        },
    )
    assert sustituir.status_code == 200, sustituir.text
    item_sustituido = next(i for i in sustituir.json()["items"] if i["id"] == item["id"])
    assert item_sustituido["es_sustitucion"] is True
    assert item_sustituido["id_variante_prevista"] == seed_armado["variante_cuadro_id"]
    assert item_sustituido["id_variante_utilizada"] == seed_armado["variante_costo_cero_id"]

    lista = client.patch(
        f"/armado/ordenes/{orden['id']}/estado",
        headers=seed_armado["headers"],
        json={"estado": "lista_para_armar"},
    )
    assert lista.status_code == 200, lista.text
    assert lista.json()["estado"] == "lista_para_armar"

    vuelta = client.patch(
        f"/armado/ordenes/{orden['id']}/estado",
        headers=seed_armado["headers"],
        json={"estado": "borrador"},
    )
    assert vuelta.status_code == 200
    assert vuelta.json()["estado"] == "borrador"

    cancelar = client.patch(
        f"/armado/ordenes/{orden['id']}/estado",
        headers=seed_armado["headers"],
        json={"estado": "cancelada"},
    )
    assert cancelar.status_code == 200
    assert cancelar.json()["estado"] == "cancelada"

    inmutable = client.post(
        f"/armado/ordenes/{orden['id']}/costos",
        headers=seed_armado["headers"],
        json={
            "tipo": "otro",
            "descripcion": "No debe",
            "cantidad": "1",
            "costo_unitario": "1",
        },
    )
    assert inmutable.status_code == 400
    assert "cancelada" in inmutable.json()["detail"]


def test_orden_no_pasa_a_lista_si_falta_stock_o_costo_y_permiso(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    _asegurar_permiso_armado(db_conn)
    _operador_id, operador_token = _crear_usuario(
        db_conn,
        username="operador_orden_armado",
        rol="operador",
    )
    modelo = _crear_modelo(client, seed_armado)
    version = _crear_version(client, seed_armado, modelo["id"])
    config = _crear_configuracion_con_items(client, seed_armado, version["id"])
    client.post(f"/armado/configuraciones/{config['id']}/activar", headers=seed_armado["headers"])
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = 0
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_cuadro_id"]),
        )
    db_conn.commit()

    bloqueado = client.post(
        "/armado/ordenes",
        headers=_headers(operador_token),
        json={"id_configuracion": config["id"], "id_sucursal": seed_armado["sucursal_id"]},
    )
    assert bloqueado.status_code == 403

    orden = client.post(
        "/armado/ordenes",
        headers=seed_armado["headers"],
        json={
            "id_configuracion": config["id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "talle": "M",
            "color": "NEGRO",
            "numero_cuadro": "CUADRO-2",
            "descripcion_final": "Agus R29 sin stock",
        },
    ).json()
    lista = client.patch(
        f"/armado/ordenes/{orden['id']}/estado",
        headers=seed_armado["headers"],
        json={"estado": "lista_para_armar"},
    )
    assert lista.status_code == 400
    assert "faltan componentes" in lista.json()["detail"]


def test_iniciar_orden_consume_componentes_y_congela_costo_real(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_lista_para_armar(client, seed_armado)

    iniciar = client.post(
        f"/armado/ordenes/{orden['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert iniciar.status_code == 200, iniciar.text
    data = iniciar.json()
    assert data["estado"] == "en_armado"
    assert data["fecha_inicio"] is not None
    assert Decimal(data["costo_componentes_real"]) == Decimal("170000.0000")
    assert Decimal(data["desvio_componentes"]) == Decimal("0.0000")
    assert all(item["estado"] == "consumido" for item in data["items"])
    assert {Decimal(item["cantidad_consumida"]) for item in data["items"]} == {
        Decimal("1.000"),
        Decimal("2.000"),
    }
    assert all(item["id_movimiento_consumo"] for item in data["items"])

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_variante, stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante IN (%s, %s)
            ORDER BY id_variante
            """,
            (
                seed_armado["sucursal_id"],
                seed_armado["variante_cuadro_id"],
                seed_armado["variante_rueda_id"],
            ),
        )
        stock = {row["id_variante"]: row["stock_fisico"] for row in cur.fetchall()}
        assert stock[seed_armado["variante_cuadro_id"]] == Decimal("3.000")
        assert stock[seed_armado["variante_rueda_id"]] == Decimal("4.000")

        cur.execute(
            """
            SELECT tipo_movimiento, origen_tipo, origen_id, cantidad
            FROM movimientos_stock
            WHERE origen_tipo = 'orden_armado'
              AND origen_id = %s
            ORDER BY id
            """,
            (orden["id"],),
        )
        movimientos = cur.fetchall()
        assert [m["tipo_movimiento"] for m in movimientos] == [
            "uso_armado",
            "uso_armado",
        ]
        assert {m["cantidad"] for m in movimientos} == {Decimal("1.000"), Decimal("2.000")}

        cur.execute("SELECT COUNT(*) AS total FROM ventas")
        assert cur.fetchone()["total"] == 0
        cur.execute("SELECT COUNT(*) AS total FROM bicicletas_serializadas")
        assert cur.fetchone()["total"] == 0

    repetir = client.post(
        f"/armado/ordenes/{orden['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert repetir.status_code == 400
    assert "ya esta en armado" in repetir.json()["detail"]


def test_iniciar_orden_rollback_si_falla_un_componente(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_lista_para_armar(client, seed_armado)
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = 1
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_rueda_id"]),
        )
        cur.execute(
            """
            SELECT stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_cuadro_id"]),
        )
        cuadro_antes = cur.fetchone()["stock_fisico"]
    db_conn.commit()

    iniciar = client.post(
        f"/armado/ordenes/{orden['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert iniciar.status_code == 400
    assert "disponibilidad" in iniciar.json()["detail"]

    detalle = client.get(f"/armado/ordenes/{orden['id']}", headers=seed_armado["headers"])
    assert detalle.status_code == 200
    assert detalle.json()["estado"] == "lista_para_armar"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_cuadro_id"]),
        )
        assert cur.fetchone()["stock_fisico"] == cuadro_antes
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM movimientos_stock
            WHERE origen_tipo = 'orden_armado'
              AND origen_id = %s
            """,
            (orden["id"],),
        )
        assert cur.fetchone()["total"] == 0


def test_cancelar_orden_en_armado_revierte_componentes(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_lista_para_armar(client, seed_armado)
    iniciar = client.post(
        f"/armado/ordenes/{orden['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert iniciar.status_code == 200, iniciar.text

    cancelar = client.post(
        f"/armado/ordenes/{orden['id']}/cancelar",
        headers=seed_armado["headers"],
        json={"motivo_cancelacion": "Prueba de reversion"},
    )
    assert cancelar.status_code == 200, cancelar.text
    data = cancelar.json()
    assert data["estado"] == "cancelada"
    assert data["motivo_cancelacion"] == "Prueba de reversion"
    assert all(item["estado"] == "revertido" for item in data["items"])
    assert all(item["id_movimiento_reversion"] for item in data["items"])

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_variante, stock_fisico
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante IN (%s, %s)
            ORDER BY id_variante
            """,
            (
                seed_armado["sucursal_id"],
                seed_armado["variante_cuadro_id"],
                seed_armado["variante_rueda_id"],
            ),
        )
        stock = {row["id_variante"]: row["stock_fisico"] for row in cur.fetchall()}
        assert stock[seed_armado["variante_cuadro_id"]] == Decimal("4.000")
        assert stock[seed_armado["variante_rueda_id"]] == Decimal("6.000")

        cur.execute(
            """
            SELECT tipo_movimiento
            FROM movimientos_stock
            WHERE origen_tipo = 'orden_armado'
              AND origen_id = %s
            ORDER BY id
            """,
            (orden["id"],),
        )
        assert [row["tipo_movimiento"] for row in cur.fetchall()] == [
            "uso_armado",
            "uso_armado",
            "reversion_uso_armado",
            "reversion_uso_armado",
        ]

    repetir = client.post(
        f"/armado/ordenes/{orden['id']}/cancelar",
        headers=seed_armado["headers"],
        json={"motivo_cancelacion": "Doble click"},
    )
    assert repetir.status_code == 400
    assert "ya esta cancelada" in repetir.json()["detail"]


def test_cancelar_orden_antes_de_iniciar_no_mueve_stock(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_lista_para_armar(client, seed_armado)
    cancelar = client.post(
        f"/armado/ordenes/{orden['id']}/cancelar",
        headers=seed_armado["headers"],
        json={"motivo_cancelacion": "No se fabrica"},
    )
    assert cancelar.status_code == 200, cancelar.text
    assert cancelar.json()["estado"] == "cancelada"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM movimientos_stock
            WHERE origen_tipo = 'orden_armado'
              AND origen_id = %s
            """,
            (orden["id"],),
        )
        assert cur.fetchone()["total"] == 0


def test_sustitucion_en_lista_vuelve_a_pendiente_y_en_armado_bloquea(
    client,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_lista_para_armar(client, seed_armado)
    item = orden["items"][0]

    sustituir = client.post(
        f"/armado/ordenes/{orden['id']}/items/{item['id']}/sustituir",
        headers=seed_armado["headers"],
        json={
            "id_variante_utilizada": seed_armado["variante_costo_cero_id"],
            "cantidad_utilizada": "1",
            "motivo_sustitucion": "Cambio antes de iniciar",
        },
    )
    assert sustituir.status_code == 200, sustituir.text
    assert sustituir.json()["estado"] == "pendiente_componentes"

    lista = client.patch(
        f"/armado/ordenes/{orden['id']}/estado",
        headers=seed_armado["headers"],
        json={"estado": "lista_para_armar"},
    )
    assert lista.status_code == 200, lista.text
    iniciar = client.post(
        f"/armado/ordenes/{orden['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert iniciar.status_code == 200, iniciar.text
    item_iniciado = iniciar.json()["items"][0]

    bloqueada = client.post(
        f"/armado/ordenes/{orden['id']}/items/{item_iniciado['id']}/sustituir",
        headers=seed_armado["headers"],
        json={
            "id_variante_utilizada": seed_armado["variante_rueda_id"],
            "cantidad_utilizada": "1",
            "motivo_sustitucion": "No corresponde",
        },
    )
    assert bloqueada.status_code == 400
    assert "en armado" in bloqueada.json()["detail"]


def test_inventario_fisico_reconoce_movimientos_de_armado():
    from app.modules.inventario_fisico.repository import TIPOS_MOVIMIENTO_STOCK_FISICO

    assert "uso_armado" in TIPOS_MOVIMIENTO_STOCK_FISICO
    assert "reversion_uso_armado" in TIPOS_MOVIMIENTO_STOCK_FISICO


def test_control_final_requiere_componentes_consumidos_y_checklist(
    client,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden_lista = _crear_orden_lista_para_armar(client, seed_armado)
    bloqueada = client.post(
        f"/armado/ordenes/{orden_lista['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert bloqueada.status_code == 400
    assert "en armado" in bloqueada.json()["detail"]

    iniciar = client.post(
        f"/armado/ordenes/{orden_lista['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert iniciar.status_code == 200, iniciar.text
    orden = iniciar.json()
    control = client.post(
        f"/armado/ordenes/{orden['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert control.status_code == 200, control.text
    assert control.json()["estado"] == "control_final"
    assert len(control.json()["controles"]) == 9
    assert all(control["aprobado"] is False for control in control.json()["controles"])

    finalizar = client.post(
        f"/armado/ordenes/{orden['id']}/finalizar",
        headers=seed_armado["headers"],
        json={},
    )
    assert finalizar.status_code == 400
    assert "controles finales" in finalizar.json()["detail"]


def test_control_final_puede_volver_a_armado_con_motivo(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_en_armado(client, seed_armado)
    control = client.post(
        f"/armado/ordenes/{orden['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert control.status_code == 200

    volver = client.post(
        f"/armado/ordenes/{orden['id']}/volver-armado",
        headers=seed_armado["headers"],
        json={"motivo": "Ajuste de frenos observado"},
    )
    assert volver.status_code == 200, volver.text
    assert volver.json()["estado"] == "en_armado"

    eventos = get_auditoria_by_entidad(db_conn, "armado_orden", orden["id"])
    assert any(evento["accion"] == "armado_orden_reabierta_desde_control" for evento in eventos)


def test_finalizar_crea_serializada_disponible_sin_stock_final_ni_movimiento_final(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_en_armado(client, seed_armado)
    control = client.post(
        f"/armado/ordenes/{orden['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert control.status_code == 200, control.text
    _aprobar_controles_finales(client, seed_armado, orden["id"])

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(stock_fisico, 0) AS stock
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_final_id"]),
        )
        row = cur.fetchone()
        stock_final_antes = row["stock"] if row else Decimal("0")
        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        movimientos_antes = cur.fetchone()["total"]

    finalizar = client.post(
        f"/armado/ordenes/{orden['id']}/finalizar",
        headers=seed_armado["headers"],
        json={},
    )
    assert finalizar.status_code == 200, finalizar.text
    data = finalizar.json()
    assert data["estado"] == "terminada"
    assert data["id_bicicleta_serializada_resultante"] is not None
    assert Decimal(data["costo_componentes_final"]) == Decimal("170000.0000")
    assert Decimal(data["costo_fabricacion_final"]) == Decimal("170000.0000")

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                estado,
                numero_cuadro,
                id_orden_armado_origen,
                costo_fabricacion_final
            FROM bicicletas_serializadas
            WHERE id = %s
            """,
            (data["id_bicicleta_serializada_resultante"],),
        )
        bici = cur.fetchone()
        assert bici["estado"] == "disponible"
        assert bici["numero_cuadro"] == "ARMADO-CONSUMO"
        assert bici["id_orden_armado_origen"] == orden["id"]
        assert bici["costo_fabricacion_final"] == Decimal("170000.0000")

        cur.execute(
            """
            SELECT COALESCE(stock_fisico, 0) AS stock
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (seed_armado["sucursal_id"], seed_armado["variante_final_id"]),
        )
        row = cur.fetchone()
        stock_final_despues = row["stock"] if row else Decimal("0")
        assert stock_final_despues == stock_final_antes

        cur.execute("SELECT COUNT(*) AS total FROM movimientos_stock")
        assert cur.fetchone()["total"] == movimientos_antes

    repetir = client.post(
        f"/armado/ordenes/{orden['id']}/finalizar",
        headers=seed_armado["headers"],
        json={},
    )
    assert repetir.status_code == 400
    assert "ya esta terminada" in repetir.json()["detail"]


def test_finalizar_concurrente_crea_una_sola_serializada(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_en_armado(client, seed_armado)
    control = client.post(
        f"/armado/ordenes/{orden['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert control.status_code == 200
    _aprobar_controles_finales(client, seed_armado, orden["id"])

    def finalizar():
        return client.post(
            f"/armado/ordenes/{orden['id']}/finalizar",
            headers=seed_armado["headers"],
            json={},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        respuestas = list(executor.map(lambda _: finalizar(), range(2)))

    exitosas = [response for response in respuestas if response.status_code == 200]
    rechazadas = [response for response in respuestas if response.status_code == 400]
    assert len(exitosas) == 1
    assert len(rechazadas) == 1

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM bicicletas_serializadas
            WHERE id_orden_armado_origen = %s
            """,
            (orden["id"],),
        )
        assert cur.fetchone()["total"] == 1


def test_costo_final_adicional_se_congela_y_alimenta_costo_fabricacion(
    client,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden_lista = _crear_orden_lista_para_armar(client, seed_armado)
    costo = client.post(
        f"/armado/ordenes/{orden_lista['id']}/costos",
        headers=seed_armado["headers"],
        json={
            "tipo": "mano_obra",
            "descripcion": "Mano de obra armado",
            "cantidad": "1",
            "costo_unitario": "10000",
        },
    )
    assert costo.status_code == 200, costo.text
    iniciar = client.post(
        f"/armado/ordenes/{orden_lista['id']}/iniciar",
        headers=seed_armado["headers"],
        json={},
    )
    assert iniciar.status_code == 200
    costo_id = iniciar.json()["costos"][0]["id"]
    ajustar = client.patch(
        f"/armado/ordenes/{orden_lista['id']}/costos/{costo_id}/final",
        headers=seed_armado["headers"],
        json={"costo_unitario_final": "12500"},
    )
    assert ajustar.status_code == 200, ajustar.text
    assert Decimal(ajustar.json()["costo_adicional_final"]) == Decimal("12500.0000")

    control = client.post(
        f"/armado/ordenes/{orden_lista['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert control.status_code == 200
    _aprobar_controles_finales(client, seed_armado, orden_lista["id"])
    finalizar = client.post(
        f"/armado/ordenes/{orden_lista['id']}/finalizar",
        headers=seed_armado["headers"],
        json={},
    )
    assert finalizar.status_code == 200, finalizar.text
    assert Decimal(finalizar.json()["costo_fabricacion_final"]) == Decimal("182500.0000")


def test_ficha_tecnica_usa_componentes_utilizados_y_snapshot_de_orden(
    client,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_en_armado(client, seed_armado)
    control = client.post(
        f"/armado/ordenes/{orden['id']}/control-final",
        headers=seed_armado["headers"],
        json={},
    )
    assert control.status_code == 200
    _aprobar_controles_finales(client, seed_armado, orden["id"])
    finalizar = client.post(
        f"/armado/ordenes/{orden['id']}/finalizar",
        headers=seed_armado["headers"],
        json={},
    )
    assert finalizar.status_code == 200

    ficha = client.get(
        f"/armado/ordenes/{orden['id']}/ficha-tecnica",
        headers=seed_armado["headers"],
    )
    assert ficha.status_code == 200, ficha.text
    data = ficha.json()
    assert data["codigo"] == orden["codigo"]
    assert data["id_bicicleta_serializada"] == finalizar.json()["id_bicicleta_serializada_resultante"]
    assert data["numero_cuadro"] == "ARMADO-CONSUMO"
    assert len(data["componentes"]) == 2
    assert {item["id_variante_utilizada"] for item in data["componentes"]} == {
        seed_armado["variante_cuadro_id"],
        seed_armado["variante_rueda_id"],
    }


def test_venta_de_bicicleta_fabricada_congela_costo_fabricacion_final(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    fabricada = _finalizar_orden_armado(client, seed_armado)

    venta_id = _crear_venta_serializada_armado(
        client,
        seed_armado,
        fabricada["id_bicicleta_serializada_resultante"],
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT costo_unitario_aplicado
            FROM venta_items
            WHERE id_venta = %s
            """,
            (venta_id,),
        )
        assert cur.fetchone()["costo_unitario_aplicado"] == Decimal("170000.00")

    detalle = client.get(f"/ventas/{venta_id}", headers=seed_armado["headers"])
    assert detalle.status_code == 200, detalle.text
    item = detalle.json()["items"][0]
    assert item["origen_costo"] == "fabricacion_propia"
    assert item["id_orden_armado_origen"] == fabricada["id"]
    assert Decimal(str(item["costo_unitario_aplicado"])) == Decimal("170000.00")


def test_venta_serializadas_misma_variante_respeta_costo_individual_o_promedio(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    fabricada = _finalizar_orden_armado(client, seed_armado)
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET costo_promedio_vigente = 50000
            WHERE id = %s
            """,
            (seed_armado["variante_final_id"],),
        )
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado
            )
            VALUES (%s, %s, 'EXTERNA-MISMA-VAR', 'disponible')
            RETURNING id
            """,
            (seed_armado["variante_final_id"], seed_armado["sucursal_id"]),
        )
        externa_id = cur.fetchone()["id"]
    db_conn.commit()

    response = client.post(
        "/ventas/",
        headers=seed_armado["headers"],
        json={
            "id_cliente": seed_armado["cliente_id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "id_usuario": 9999,
            "items": [
                {
                    "id_variante": seed_armado["variante_final_id"],
                    "cantidad": "1",
                    "id_bicicleta_serializada": fabricada["id_bicicleta_serializada_resultante"],
                },
                {
                    "id_variante": seed_armado["variante_final_id"],
                    "cantidad": "1",
                    "id_bicicleta_serializada": externa_id,
                },
            ],
        },
    )
    assert response.status_code == 200, response.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_bicicleta_serializada, costo_unitario_aplicado
            FROM venta_items
            WHERE id_venta = %s
            ORDER BY id
            """,
            (response.json()["venta_id"],),
        )
        items = cur.fetchall()

    assert [item["id_bicicleta_serializada"] for item in items] == [
        fabricada["id_bicicleta_serializada_resultante"],
        externa_id,
    ]
    assert items[0]["costo_unitario_aplicado"] == Decimal("170000.00")
    assert items[1]["costo_unitario_aplicado"] == Decimal("50000.00")


def test_venta_bicicleta_fabricada_acepta_costo_cero(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    fabricada = _finalizar_orden_armado(client, seed_armado)
    bicicleta_id = fabricada["id_bicicleta_serializada_resultante"]
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET costo_fabricacion_final = 0
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
    db_conn.commit()

    venta_id = _crear_venta_serializada_armado(client, seed_armado, bicicleta_id)

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT costo_unitario_aplicado FROM venta_items WHERE id_venta = %s",
            (venta_id,),
        )
        assert cur.fetchone()["costo_unitario_aplicado"] == Decimal("0.00")


def test_venta_bicicleta_fabricada_sin_costo_final_bloquea(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    fabricada = _finalizar_orden_armado(client, seed_armado)
    bicicleta_id = fabricada["id_bicicleta_serializada_resultante"]
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET costo_fabricacion_final = NULL
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
    db_conn.commit()

    response = client.post(
        "/ventas/",
        headers=seed_armado["headers"],
        json={
            "id_cliente": seed_armado["cliente_id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "id_usuario": 9999,
            "items": [
                {
                    "id_variante": seed_armado["variante_final_id"],
                    "cantidad": "1",
                    "id_bicicleta_serializada": bicicleta_id,
                }
            ],
        },
    )

    assert response.status_code == 400
    assert "costo de fabricacion final" in response.json()["detail"]


def test_venta_bicicleta_fabricada_con_orden_inconsistente_bloquea(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    orden = _crear_orden_en_armado(client, seed_armado)
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado,
                id_orden_armado_origen,
                costo_fabricacion_final
            )
            VALUES (%s, %s, 'INCONSISTENTE-ARMADO', 'disponible', %s, 100000)
            RETURNING id
            """,
            (
                seed_armado["variante_final_id"],
                seed_armado["sucursal_id"],
                orden["id"],
            ),
        )
        bicicleta_id = cur.fetchone()["id"]
    db_conn.commit()

    response = client.post(
        "/ventas/",
        headers=seed_armado["headers"],
        json={
            "id_cliente": seed_armado["cliente_id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "id_usuario": 9999,
            "items": [
                {
                    "id_variante": seed_armado["variante_final_id"],
                    "cantidad": "1",
                    "id_bicicleta_serializada": bicicleta_id,
                }
            ],
        },
    )

    assert response.status_code == 400
    assert "orden de armado" in response.json()["detail"]


def test_reserva_convertida_en_venta_usa_costo_fabricacion_serializada(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    seed_armado,
):
    fabricada = _finalizar_orden_armado(client, seed_armado)
    bicicleta_id = fabricada["id_bicicleta_serializada_resultante"]

    reserva = client.post(
        "/reservas/",
        headers=seed_armado["headers"],
        json={
            "id_cliente": seed_armado["cliente_id"],
            "id_sucursal": seed_armado["sucursal_id"],
            "id_usuario": 9999,
            "fecha_vencimiento": "2026-12-31",
            "nota": "Reserva fabricada",
            "items": [
                {
                    "id_variante": seed_armado["variante_final_id"],
                    "cantidad": "1",
                    "id_bicicleta_serializada": bicicleta_id,
                    "precio_estimado": "650000",
                }
            ],
        },
    )
    assert reserva.status_code == 200, reserva.text

    convertir = client.post(
        f"/reservas/{reserva.json()['reserva_id']}/convertir-a-venta",
        headers=seed_armado["headers"],
        json={"id_usuario": 9999},
    )
    assert convertir.status_code == 200, convertir.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT costo_unitario_aplicado
            FROM venta_items
            WHERE id_venta = %s
            """,
            (convertir.json()["venta_id"],),
        )
        assert cur.fetchone()["costo_unitario_aplicado"] == Decimal("170000.00")
