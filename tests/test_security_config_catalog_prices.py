from decimal import Decimal

import pytest

from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.modules.usuarios.service import hash_password


def _asegurar_rol(db_conn, nombre: str) -> int:
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO roles (nombre, descripcion)
            VALUES (%s, %s)
            ON CONFLICT (nombre) DO UPDATE
            SET descripcion = EXCLUDED.descripcion
            RETURNING id
            """,
            (nombre, f"Rol de prueba {nombre}"),
        )
        return cur.fetchone()["id"]


def _asignar_permiso(db_conn, rol_id: int, codigo: str) -> None:
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO permisos (codigo, descripcion)
            VALUES (%s, %s)
            ON CONFLICT (codigo) DO UPDATE
            SET descripcion = EXCLUDED.descripcion
            RETURNING id
            """,
            (codigo, f"Permiso de prueba {codigo}"),
        )
        permiso_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO rol_permisos (id_rol, id_permiso)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (rol_id, permiso_id),
        )


def _crear_actor(db_conn, *, username: str, rol: str, permisos=()):
    rol_id = _asegurar_rol(db_conn, rol)
    for permiso in permisos:
        _asignar_permiso(db_conn, rol_id, permiso)

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (
                nombre,
                username,
                email,
                password_hash,
                activo
            )
            VALUES (%s, %s, %s, %s, TRUE)
            RETURNING id
            """,
            (
                username.upper(),
                username,
                f"{username}@example.com",
                hash_password("Password123"),
            ),
        )
        usuario_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO usuario_roles (id_usuario, id_rol)
            VALUES (%s, %s)
            """,
            (usuario_id, rol_id),
        )

    db_conn.commit()
    token = crear_token_usuario(
        {"id": usuario_id, "username": username, "rol": rol}
    )
    return usuario_id, token


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def test_configuracion_global_requiere_permiso(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _, token_operador = _crear_actor(
        db_conn,
        username="operador_sin_config_1e",
        rol="test_operador_sin_config_1e",
    )
    _, token_admin = _crear_actor(
        db_conn,
        username="admin_config_1e",
        rol="test_admin_config_1e",
        permisos=("configuracion_comercial",),
    )
    actual = client.get(
        "/configuracion-negocio",
        headers=_headers(token_operador),
    )
    assert actual.status_code == 200, actual.text
    payload = actual.json()
    payload.pop("id", None)

    bloqueado = client.put(
        "/configuracion-negocio",
        headers=_headers(token_operador),
        json=payload,
    )
    assert bloqueado.status_code == 403
    assert "configuracion_comercial" in bloqueado.json()["detail"]

    permitido = client.put(
        "/configuracion-negocio",
        headers=_headers(token_admin),
        json=payload,
    )
    assert permitido.status_code == 200, permitido.text


def test_planes_activos_ocultan_costo_financiero_al_operador(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    request,
):
    def limpiar_plan_test():
        db_conn.rollback()
        with db_conn.cursor() as cur:
            cur.execute(
                "DELETE FROM tarjeta_planes WHERE nombre = %s",
                ("PLAN SEGURIDAD 1E",),
            )
        db_conn.commit()

    limpiar_plan_test()
    request.addfinalizer(limpiar_plan_test)

    _, token_operador = _crear_actor(
        db_conn,
        username="operador_planes_1e",
        rol="test_operador_planes_1e",
    )
    _, token_admin = _crear_actor(
        db_conn,
        username="admin_planes_1e",
        rol="test_admin_planes_1e",
        permisos=("configuracion_comercial",),
    )
    crear = client.post(
        "/reglas-comerciales/tarjeta-planes",
        headers=_headers(token_admin),
        json={
            "nombre": "PLAN SEGURIDAD 1E",
            "medio_pago": "tarjeta",
            "cuotas": 11,
            "porcentaje_recargo_cliente": "15",
            "porcentaje_costo_financiero": "7",
            "activa": True,
        },
    )
    assert crear.status_code == 200, crear.text
    plan_id = crear.json()["id"]

    vista_operador = client.get(
        "/reglas-comerciales/tarjeta-planes?solo_activos=true",
        headers=_headers(token_operador),
    )
    assert vista_operador.status_code == 200, vista_operador.text
    plan_operador = next(
        plan for plan in vista_operador.json() if plan["id"] == plan_id
    )
    assert Decimal(plan_operador["porcentaje_recargo_cliente"]) == Decimal("15")
    assert plan_operador["porcentaje_costo_financiero"] is None

    vista_admin = client.get(
        "/reglas-comerciales/tarjeta-planes?solo_activos=true",
        headers=_headers(token_admin),
    )
    plan_admin = next(
        plan for plan in vista_admin.json() if plan["id"] == plan_id
    )
    assert Decimal(plan_admin["porcentaje_costo_financiero"]) == Decimal("7")


def test_editar_regla_comercial_requiere_permiso(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    request,
):
    nombre = "REGLA SEGURIDAD EDICION 1E"

    def limpiar_regla():
        db_conn.rollback()
        with db_conn.cursor() as cur:
            cur.execute(
                "DELETE FROM reglas_comerciales WHERE nombre = %s",
                (nombre,),
            )
        db_conn.commit()

    limpiar_regla()
    request.addfinalizer(limpiar_regla)

    _, token_operador = _crear_actor(
        db_conn,
        username="operador_reglas_1e",
        rol="test_operador_reglas_1e",
    )
    _, token_admin = _crear_actor(
        db_conn,
        username="admin_reglas_1e",
        rol="test_admin_reglas_1e",
        permisos=("configuracion_comercial",),
    )

    creada = client.post(
        "/reglas-comerciales",
        headers=_headers(token_admin),
        json={
            "nombre": nombre,
            "tipo": "descuento",
            "medio_pago": "efectivo",
            "porcentaje": "4",
        },
    )
    assert creada.status_code == 200, creada.text
    regla_id = creada.json()["id"]

    bloqueada = client.patch(
        f"/reglas-comerciales/{regla_id}",
        headers=_headers(token_operador),
        json={"prioridad": 20},
    )
    assert bloqueada.status_code == 403
    assert "configuracion_comercial" in bloqueada.json()["detail"]

    permitida = client.patch(
        f"/reglas-comerciales/{regla_id}",
        headers=_headers(token_admin),
        json={"prioridad": 20},
    )
    assert permitida.status_code == 200, permitida.text
    assert permitida.json()["prioridad"] == 20


def test_operador_no_modifica_precios_y_actor_real_queda_en_historial(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    _, token_operador = _crear_actor(
        db_conn,
        username="operador_sin_precios_1e",
        rol="test_operador_sin_precios_1e",
    )
    encargado_id, token_encargado = _crear_actor(
        db_conn,
        username="encargado_precios_1e",
        rol="test_encargado_precios_1e",
        permisos=("gestionar_precios",),
    )

    bloqueado = client.get(
        "/precios/desfasados",
        headers=_headers(token_operador),
    )
    assert bloqueado.status_code == 403
    assert "gestionar_precios" in bloqueado.json()["detail"]

    stock_operador = client.get(
        f"/stock/?id_sucursal={seed_venta_basica['sucursal_id']}",
        headers=_headers(token_operador),
    )
    assert stock_operador.status_code == 200, stock_operador.text
    assert stock_operador.json()[0]["costo_promedio_vigente"] is None
    assert stock_operador.json()[0]["capital_inmovilizado"] is None

    stock_encargado = client.get(
        f"/stock/?id_sucursal={seed_venta_basica['sucursal_id']}",
        headers=_headers(token_encargado),
    )
    assert stock_encargado.status_code == 200, stock_encargado.text
    assert stock_encargado.json()[0]["costo_promedio_vigente"] is not None

    precio_nuevo = Decimal(str(seed_venta_basica["precio_venta"])) + Decimal("100")
    actualizar = client.post(
        f"/precios/variantes/{seed_venta_basica['variante_id']}/actualizar",
        headers=_headers(token_encargado),
        json={
            "precio_minorista": str(precio_nuevo),
            "precio_mayorista": str(precio_nuevo - Decimal("1000")),
            "motivo": "Prueba actor autenticado",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert actualizar.status_code == 200, actualizar.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_usuario
            FROM precios_movimientos
            WHERE id = %s
            """,
            (actualizar.json()["movimiento_id"],),
        )
        movimiento = cur.fetchone()

    assert movimiento["id_usuario"] == encargado_id


def test_catalogo_y_maestros_requieren_permiso(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _, token_operador = _crear_actor(
        db_conn,
        username="operador_sin_catalogo_1e",
        rol="test_operador_sin_catalogo_1e",
    )
    _, token_encargado = _crear_actor(
        db_conn,
        username="encargado_catalogo_1e",
        rol="test_encargado_catalogo_1e",
        permisos=("gestionar_catalogo",),
    )

    categoria_bloqueada = client.post(
        "/catalogo/categorias",
        headers=_headers(token_operador),
        json={"nombre": "SEGURIDAD 1E"},
    )
    assert categoria_bloqueada.status_code == 403

    categoria = client.post(
        "/catalogo/categorias",
        headers=_headers(token_encargado),
        json={"nombre": "SEGURIDAD 1E"},
    )
    assert categoria.status_code == 200, categoria.text

    proveedor_bloqueado = client.post(
        "/proveedores/",
        headers=_headers(token_operador),
        json={"nombre": "PROVEEDOR BLOQUEADO"},
    )
    assert proveedor_bloqueado.status_code == 403

    proveedor = client.post(
        "/proveedores/",
        headers=_headers(token_encargado),
        json={"nombre": "PROVEEDOR AUTORIZADO"},
    )
    assert proveedor.status_code == 200, proveedor.text

    servicio_bloqueado = client.post(
        "/servicios_taller/",
        headers=_headers(token_operador),
        json={"nombre": "SERVICE", "precio_sugerido": "1000"},
    )
    assert servicio_bloqueado.status_code == 403


def test_catalogo_permite_consulta_operativa_sin_habilitar_edicion(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    _, token_operador = _crear_actor(
        db_conn,
        username="operador_consulta_catalogo_1e",
        rol="test_operador_consulta_catalogo_1e",
    )
    producto_id = seed_venta_basica["producto_id"]

    detalle = client.get(
        f"/catalogo/productos/{producto_id}",
        headers=_headers(token_operador),
    )
    assert detalle.status_code == 200, detalle.text

    edicion = client.put(
        f"/catalogo/productos/{producto_id}",
        headers=_headers(token_operador),
        json={"nombre": "INTENTO SIN PERMISO"},
    )
    assert edicion.status_code == 403
    assert "gestionar_catalogo" in edicion.json()["detail"]

    variantes_con_costos = client.get(
        "/catalogo/variantes",
        headers=_headers(token_operador),
    )
    assert variantes_con_costos.status_code == 403


def test_crear_variante_con_precios_exige_ambos_permisos(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    _, token_catalogo = _crear_actor(
        db_conn,
        username="catalogo_sin_precios_1e",
        rol="test_catalogo_sin_precios_1e",
        permisos=("gestionar_catalogo",),
    )
    _, token_completo = _crear_actor(
        db_conn,
        username="catalogo_precios_1e",
        rol="test_catalogo_precios_1e",
        permisos=("gestionar_catalogo", "gestionar_precios"),
    )
    payload = {
        "id_producto": seed_venta_basica["producto_id"],
        "nombre_variante": "VARIANTE SEGURIDAD 1E",
        "precio_minorista": "20000",
        "precio_mayorista": "18000",
    }

    bloqueado = client.post(
        "/catalogo/variantes",
        headers=_headers(token_catalogo),
        json=payload,
    )
    assert bloqueado.status_code == 403
    assert "gestionar_precios" in bloqueado.json()["detail"]
    lectura_bloqueada = client.get(
        "/catalogo/variantes",
        headers=_headers(token_catalogo),
    )
    assert lectura_bloqueada.status_code == 403
    assert "gestionar_precios" in lectura_bloqueada.json()["detail"]

    permitido = client.post(
        "/catalogo/variantes",
        headers=_headers(token_completo),
        json=payload,
    )
    assert permitido.status_code == 200, permitido.text
    lectura_permitida = client.get(
        f"/catalogo/variantes/{permitido.json()['id']}",
        headers=_headers(token_completo),
    )
    assert lectura_permitida.status_code == 200, lectura_permitida.text


def test_auditoria_rentabilidad_y_capital_tienen_accesos_separados(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _, token_operador = _crear_actor(
        db_conn,
        username="operador_control_1e",
        rol="test_operador_control_1e",
    )
    _, token_auditoria = _crear_actor(
        db_conn,
        username="auditor_1e",
        rol="test_auditor_1e",
        permisos=("ver_auditoria",),
    )
    _, token_rentabilidad = _crear_actor(
        db_conn,
        username="rentabilidad_1e",
        rol="test_rentabilidad_1e",
        permisos=("ver_rentabilidad",),
    )
    _, token_capital = _crear_actor(
        db_conn,
        username="capital_1e",
        rol="test_capital_1e",
        permisos=("gestionar_capital_retiros",),
    )

    assert client.get(
        "/auditoria/",
        headers=_headers(token_operador),
    ).status_code == 403
    assert client.get(
        "/auditoria/",
        headers=_headers(token_auditoria),
    ).status_code == 200

    rentabilidad_bloqueada = client.get(
        "/rentabilidad/mensual?periodo_mes=2026-06-01",
        headers=_headers(token_operador),
    )
    assert rentabilidad_bloqueada.status_code == 403
    assert "ver_rentabilidad" in rentabilidad_bloqueada.json()["detail"]
    assert client.get(
        "/rentabilidad/mensual?periodo_mes=2026-06-01",
        headers=_headers(token_rentabilidad),
    ).status_code == 200
    assert client.get(
        "/dashboard/resumen",
        headers=_headers(token_rentabilidad),
    ).status_code == 200

    caja_operador = client.get(
        "/cajas/resumen-diario",
        headers=_headers(token_operador),
    )
    assert caja_operador.status_code == 200, caja_operador.text
    assert caja_operador.json()["rentabilidad"]["costo_mercaderia_vendida"] is None
    assert caja_operador.json()["rentabilidad"]["margen_bruto"] is None
    assert caja_operador.json()["rentabilidad"]["ganancia_dia"] is None

    caja_admin = client.get(
        "/cajas/resumen-diario",
        headers=_headers(token_rentabilidad),
    )
    assert caja_admin.status_code == 200, caja_admin.text
    assert caja_admin.json()["rentabilidad"]["margen_bruto"] is not None

    assert client.get(
        "/capital-retiros/resumen",
        headers=_headers(token_operador),
    ).status_code == 403
    assert client.get(
        "/capital-retiros/resumen",
        headers=_headers(token_capital),
    ).status_code == 200
