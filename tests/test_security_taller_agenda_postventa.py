from datetime import date, timedelta

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


def _asignar_permiso_rol(db_conn, rol_id: int, codigo: str) -> None:
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
        _asignar_permiso_rol(db_conn, rol_id, permiso)

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


def _payload_orden(seed, id_usuario: int):
    return {
        "id_sucursal": seed["sucursal_id"],
        "id_cliente": seed["cliente_id"],
        "id_bicicleta_cliente": seed["bicicleta_cliente_id"],
        "problema_reportado": "Service de seguridad",
        "prioridad": "normal",
        "id_usuario": id_usuario,
    }


def _habilitar_postventa(db_conn, bicicleta_id: int) -> None:
    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_clientes
            SET plan_postventa = 'service_30_dias',
                fecha_limite_service_gratis = %s,
                service_gratis_usado = FALSE,
                service_gratis_autorizado_fuera_plazo = FALSE
            WHERE id = %s
            """,
            (date.today() + timedelta(days=30), bicicleta_id),
        )
    db_conn.commit()


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def test_usuario_sin_permiso_no_puede_operar_taller(
    client,
    db_conn,
    seed_taller_basico,
    auth_habilitada,
):
    _, token = _crear_actor(
        db_conn,
        username="sin_permiso_taller",
        rol="test_sin_permiso_taller",
    )

    response = client.post(
        "/ordenes_taller/",
        headers=_headers(token),
        json=_payload_orden(
            seed_taller_basico,
            seed_taller_basico["usuario_id"],
        ),
    )

    assert response.status_code == 403
    assert "gestionar_taller" in response.json()["detail"]


def test_mecanico_opera_taller_y_actor_falso_no_altera_trazabilidad(
    client,
    db_conn,
    seed_taller_basico,
    auth_habilitada,
):
    mecanico_id, token = _crear_actor(
        db_conn,
        username="mecanico_seguridad",
        rol="mecanico",
        permisos=("gestionar_taller",),
    )
    crear = client.post(
        "/ordenes_taller/",
        headers=_headers(token),
        json=_payload_orden(
            seed_taller_basico,
            seed_taller_basico["usuario_id"],
        ),
    )
    assert crear.status_code == 201, crear.text
    orden_id = crear.json()["id"]

    estado = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        headers=_headers(token),
        json={
            "nuevo_estado": "presupuestada",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert estado.status_code == 200, estado.text

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT id_usuario FROM ordenes_taller WHERE id = %s",
            (orden_id,),
        )
        orden = cur.fetchone()
        cur.execute(
            """
            SELECT id_usuario
            FROM ordenes_taller_eventos
            WHERE id_orden_taller = %s
            ORDER BY id
            """,
            (orden_id,),
        )
        actores = [row["id_usuario"] for row in cur.fetchall()]

    assert orden["id_usuario"] == mecanico_id
    assert actores == [mecanico_id, mecanico_id]


def test_agenda_requiere_permiso_y_audita_actor_autenticado(
    client,
    db_conn,
    seed_taller_basico,
    auth_habilitada,
):
    _, token_sin_permiso = _crear_actor(
        db_conn,
        username="sin_permiso_agenda",
        rol="test_sin_permiso_agenda",
    )
    encargado_id, token_encargado = _crear_actor(
        db_conn,
        username="encargado_agenda",
        rol="encargado",
        permisos=("gestionar_agenda_taller", "gestionar_taller"),
    )
    payload = {
        "id_sucursal": seed_taller_basico["sucursal_id"],
        "id_cliente": seed_taller_basico["cliente_id"],
        "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
        "cliente_nombre": "Cliente Taller",
        "cliente_telefono": "2912222222",
        "fecha": str(date.today() + timedelta(days=1)),
        "franja": "mañana",
        "hora_inicio": "09:00:00",
        "tipo_turno": "reparacion_comun",
        "tipo_servicio": "Revisión general",
        "id_usuario_creador": seed_taller_basico["usuario_id"],
    }

    rechazado = client.post(
        "/agenda-taller/",
        headers=_headers(token_sin_permiso),
        json=payload,
    )
    assert rechazado.status_code == 403

    crear = client.post(
        "/agenda-taller/",
        headers=_headers(token_encargado),
        json=payload,
    )
    assert crear.status_code == 200, crear.text
    turno_id = crear.json()["id"]

    recordatorio = client.patch(
        f"/agenda-taller/{turno_id}/recordatorio-enviado",
        headers=_headers(token_encargado),
    )
    assert recordatorio.status_code == 200, recordatorio.text

    convertir = client.post(
        f"/agenda-taller/{turno_id}/convertir-orden",
        headers=_headers(token_encargado),
        json={"id_usuario": seed_taller_basico["usuario_id"]},
    )
    assert convertir.status_code == 200, convertir.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_usuario
            FROM agenda_taller_historial
            WHERE id_turno_agenda = %s
            ORDER BY id
            """,
            (turno_id,),
        )
        actores = [row["id_usuario"] for row in cur.fetchall()]

    assert actores == [encargado_id, encargado_id, encargado_id]


def test_postventa_y_garantia_tienen_permisos_separados(
    client,
    db_conn,
    seed_taller_basico,
    auth_habilitada,
):
    _habilitar_postventa(
        db_conn,
        seed_taller_basico["bicicleta_cliente_id"],
    )
    _, token_postventa = _crear_actor(
        db_conn,
        username="postventa_sin_garantia",
        rol="test_postventa_sin_garantia",
        permisos=("gestionar_postventa", "gestionar_taller"),
    )
    encargado_id, token_encargado = _crear_actor(
        db_conn,
        username="encargado_postventa",
        rol="encargado",
        permisos=(
            "gestionar_postventa",
            "gestionar_garantias",
            "gestionar_taller",
        ),
    )
    autorizar_url = (
        f"/clientes/{seed_taller_basico['cliente_id']}/bicicletas/"
        f"{seed_taller_basico['bicicleta_cliente_id']}/autorizar-service-vencido"
    )

    sin_garantia = client.patch(
        autorizar_url,
        headers=_headers(token_postventa),
        json={
            "id_usuario": seed_taller_basico["usuario_id"],
            "motivo": "Excepción comercial",
        },
    )
    assert sin_garantia.status_code == 403
    assert "gestionar_garantias" in sin_garantia.json()["detail"]

    autorizado = client.patch(
        autorizar_url,
        headers=_headers(token_encargado),
        json={
            "id_usuario": seed_taller_basico["usuario_id"],
            "motivo": "Excepción comercial autorizada",
        },
    )
    assert autorizado.status_code == 200, autorizado.text

    crear = client.post(
        (
            f"/clientes/{seed_taller_basico['cliente_id']}/bicicletas/"
            f"{seed_taller_basico['bicicleta_cliente_id']}/crear-service-postventa"
        ),
        headers=_headers(token_encargado),
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_usuario": seed_taller_basico["usuario_id"],
            "prioridad": "normal",
        },
    )
    assert crear.status_code == 200, crear.text
    orden_id = crear.json()["orden_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT id_usuario FROM ordenes_taller WHERE id = %s",
            (orden_id,),
        )
        orden = cur.fetchone()
        cur.execute(
            """
            SELECT id_usuario
            FROM ordenes_taller_eventos
            WHERE id_orden_taller = %s
              AND tipo_evento = 'creada'
            """,
            (orden_id,),
        )
        evento = cur.fetchone()

    assert orden["id_usuario"] == encargado_id
    assert evento["id_usuario"] == encargado_id


def test_cobertura_explicita_requiere_gestionar_garantias(
    client,
    db_conn,
    seed_taller_basico,
    seed_venta_basica,
    auth_habilitada,
):
    _habilitar_postventa(
        db_conn,
        seed_taller_basico["bicicleta_cliente_id"],
    )
    _, token_mecanico = _crear_actor(
        db_conn,
        username="mecanico_sin_garantias",
        rol="mecanico",
        permisos=("gestionar_taller",),
    )
    _, token_encargado = _crear_actor(
        db_conn,
        username="encargado_con_garantias",
        rol="encargado",
        permisos=(
            "gestionar_taller",
            "gestionar_postventa",
            "gestionar_garantias",
        ),
    )
    crear = client.post(
        (
            f"/clientes/{seed_taller_basico['cliente_id']}/bicicletas/"
            f"{seed_taller_basico['bicicleta_cliente_id']}/crear-service-postventa"
        ),
        headers=_headers(token_encargado),
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 200, crear.text
    orden_id = crear.json()["orden_id"]
    payload = {
        "tipo_item": "repuesto",
        "id_variante": seed_venta_basica["variante_id"],
        "cantidad": 1,
        "precio_unitario": 17000,
        "valor_cobertura_unitario": 10000,
        "motivo_cobertura": "Garantía local",
        "id_usuario": seed_taller_basico["usuario_id"],
    }

    bloqueado = client.post(
        f"/ordenes_taller/{orden_id}/items",
        headers=_headers(token_mecanico),
        json=payload,
    )
    assert bloqueado.status_code == 403
    assert "gestionar_garantias" in bloqueado.json()["detail"]

    permitido = client.post(
        f"/ordenes_taller/{orden_id}/items",
        headers=_headers(token_encargado),
        json=payload,
    )
    assert permitido.status_code == 201, permitido.text
    assert float(permitido.json()["valor_cobertura_unitario"]) == 10000


def test_mecanico_no_puede_consumir_service_postventa_sin_permiso(
    client,
    db_conn,
    seed_taller_basico,
    auth_habilitada,
):
    _habilitar_postventa(
        db_conn,
        seed_taller_basico["bicicleta_cliente_id"],
    )
    _, token_encargado = _crear_actor(
        db_conn,
        username="encargado_consumo_postventa",
        rol="encargado",
        permisos=(
            "gestionar_taller",
            "gestionar_postventa",
            "gestionar_garantias",
        ),
    )
    _, token_mecanico = _crear_actor(
        db_conn,
        username="mecanico_solo_taller",
        rol="test_mecanico_solo_taller",
        permisos=("gestionar_taller",),
    )
    crear = client.post(
        (
            f"/clientes/{seed_taller_basico['cliente_id']}/bicicletas/"
            f"{seed_taller_basico['bicicleta_cliente_id']}/crear-service-postventa"
        ),
        headers=_headers(token_encargado),
        json={
            "id_sucursal": seed_taller_basico["sucursal_id"],
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert crear.status_code == 200, crear.text
    orden_id = crear.json()["orden_id"]

    for estado in (
        "presupuestada",
        "en_reparacion",
        "terminada",
        "lista_para_retirar",
    ):
        cambiar = client.post(
            f"/ordenes_taller/{orden_id}/estado",
            headers=_headers(token_mecanico),
            json={
                "nuevo_estado": estado,
                "id_usuario": seed_taller_basico["usuario_id"],
            },
        )
        assert cambiar.status_code == 200, cambiar.text

    bloqueado = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        headers=_headers(token_mecanico),
        json={
            "nuevo_estado": "retirada",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert bloqueado.status_code == 403
    assert "gestionar_postventa" in bloqueado.json()["detail"]

    permitido = client.post(
        f"/ordenes_taller/{orden_id}/estado",
        headers=_headers(token_encargado),
        json={
            "nuevo_estado": "retirada",
            "id_usuario": seed_taller_basico["usuario_id"],
        },
    )
    assert permitido.status_code == 200, permitido.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT service_gratis_usado, id_orden_service_gratis
            FROM bicicletas_clientes
            WHERE id = %s
            """,
            (seed_taller_basico["bicicleta_cliente_id"],),
        )
        bicicleta = cur.fetchone()

    assert bicicleta["service_gratis_usado"] is True
    assert bicicleta["id_orden_service_gratis"] == orden_id


def test_generar_venta_desde_ot_exige_taller_y_crear_venta(
    client,
    db_conn,
    seed_taller_basico,
    auth_habilitada,
):
    _, token_mecanico = _crear_actor(
        db_conn,
        username="mecanico_sin_venta",
        rol="test_taller_sin_crear_venta",
        permisos=("gestionar_taller",),
    )
    _, token_encargado = _crear_actor(
        db_conn,
        username="encargado_taller_venta",
        rol="encargado",
        permisos=("gestionar_taller", "crear_venta"),
    )
    crear = client.post(
        "/ordenes_taller/",
        headers=_headers(token_mecanico),
        json=_payload_orden(
            seed_taller_basico,
            seed_taller_basico["usuario_id"],
        ),
    )
    assert crear.status_code == 201, crear.text
    orden_id = crear.json()["id"]

    bloqueado = client.post(
        f"/ordenes_taller/{orden_id}/generar-venta",
        headers=_headers(token_mecanico),
        json={"id_usuario": seed_taller_basico["usuario_id"]},
    )
    assert bloqueado.status_code == 403
    assert "crear_venta" in bloqueado.json()["detail"]

    autorizado = client.post(
        f"/ordenes_taller/{orden_id}/generar-venta",
        headers=_headers(token_encargado),
        json={"id_usuario": seed_taller_basico["usuario_id"]},
    )
    assert autorizado.status_code == 400
    assert "terminada" in autorizado.json()["detail"].lower()
