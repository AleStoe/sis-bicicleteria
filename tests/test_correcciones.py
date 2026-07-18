from decimal import Decimal

import pytest

from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.modules.usuarios.service import hash_password
from app.shared.constants import (
    AUDITORIA_ACCION_CORRECCION_APLICADA,
    AUDITORIA_ENTIDAD_CORRECCION,
    PERMISO_GESTIONAR_CORRECCIONES,
)
from tests.conftest import asignar_rol_usuario, get_auditoria_by_entidad, get_caja_movimientos
from tests.test_capital_retiros import _crear_movimiento, _crear_participante


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def _asegurar_permiso(db_conn, codigo: str):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO permisos (codigo, descripcion)
            VALUES (%s, %s)
            ON CONFLICT (codigo) DO UPDATE
            SET descripcion = EXCLUDED.descripcion
            RETURNING id
            """,
            (codigo, f"Permiso test {codigo}"),
        )
        return cur.fetchone()["id"]


def _asignar_permiso_rol(db_conn, rol: str, codigo: str):
    permiso_id = _asegurar_permiso(db_conn, codigo)
    with db_conn.cursor() as cur:
        cur.execute("SELECT id FROM roles WHERE nombre = %s", (rol,))
        rol_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO rol_permisos (id_rol, id_permiso)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (rol_id, permiso_id),
        )


def _crear_actor(db_conn, *, username: str, rol: str, permisos=()):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, email, password_hash, activo)
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

    asignar_rol_usuario(db_conn, usuario_id, rol)
    for permiso in permisos:
        _asignar_permiso_rol(db_conn, rol, permiso)
    db_conn.commit()

    token = crear_token_usuario({"id": usuario_id, "username": username, "rol": rol})
    return usuario_id, token


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def _crear_devolucion_prestamo_sin_caja(client, seed_venta_basica, monto=65000):
    participante = _crear_participante(client, "Ale correccion capital", "persona")
    _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "prestamo_socio",
        monto=120000,
        impacta_caja=False,
        medio_pago="transferencia",
    )
    return _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "devolucion_prestamo",
        monto=monto,
        impacta_caja=False,
        medio_pago="transferencia",
    )


def test_lista_movimientos_de_capital_sin_caja(client, seed_venta_basica):
    movimiento = _crear_devolucion_prestamo_sin_caja(client, seed_venta_basica)

    response = client.get("/correcciones/pendientes")

    assert response.status_code == 200, response.text
    ids = [item["id"] for item in response.json()["capital_sin_caja"]]
    assert movimiento["movimiento_id"] in ids


def test_corrige_capital_sin_caja_creando_egreso_vinculado(
    client,
    db_conn,
    seed_venta_basica,
):
    movimiento = _crear_devolucion_prestamo_sin_caja(client, seed_venta_basica)
    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 100000,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/correcciones/capital-sin-caja/{movimiento['movimiento_id']}/registrar-egreso",
        json={
            "motivo": "Se cargo la devolucion sin impactar caja por error",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["movimiento_id"] == movimiento["movimiento_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT impacta_caja, id_caja_movimiento
            FROM capital_movimientos
            WHERE id = %s
            """,
            (movimiento["movimiento_id"],),
        )
        capital = cur.fetchone()

        cur.execute(
            """
            SELECT tipo_evento, detalle, origen_tipo, origen_id
            FROM capital_movimientos_historial
            WHERE id_movimiento = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (movimiento["movimiento_id"],),
        )
        historial = cur.fetchone()

    assert capital["impacta_caja"] is True
    assert capital["id_caja_movimiento"] == data["caja_movimiento_id"]

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    egreso = next(item for item in movimientos_caja if item["id"] == data["caja_movimiento_id"])
    assert egreso["tipo_movimiento"] == "egreso"
    assert egreso["submedio"] == "transferencia"
    assert egreso["origen_tipo"] == "correccion_operativa"
    assert egreso["origen_id"] == movimiento["movimiento_id"]
    assert Decimal(egreso["monto"]) == Decimal("65000.00")

    assert historial["tipo_evento"] == "correccion_caja"
    assert historial["origen_tipo"] == "correccion_operativa"
    assert historial["origen_id"] == data["caja_movimiento_id"]

    eventos = get_auditoria_by_entidad(
        db_conn,
        AUDITORIA_ENTIDAD_CORRECCION,
        movimiento["movimiento_id"],
    )
    assert any(evento["accion"] == AUDITORIA_ACCION_CORRECCION_APLICADA for evento in eventos)


def test_no_corrige_capital_sin_caja_sin_caja_abierta(client, seed_venta_basica):
    movimiento = _crear_devolucion_prestamo_sin_caja(client, seed_venta_basica)

    response = client.post(
        f"/correcciones/capital-sin-caja/{movimiento['movimiento_id']}/registrar-egreso",
        json={
            "motivo": "Intento sin caja abierta",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "caja abierta" in response.json()["detail"].lower()


def test_correcciones_exige_permiso(client, db_conn, clean_db, auth_habilitada):
    _, token_sin_permiso = _crear_actor(
        db_conn,
        username="operador_sin_correcciones",
        rol="operador",
    )
    bloqueado = client.get("/correcciones/pendientes", headers=_headers(token_sin_permiso))
    assert bloqueado.status_code == 403
    assert PERMISO_GESTIONAR_CORRECCIONES in bloqueado.json()["detail"]

    _, token_admin = _crear_actor(
        db_conn,
        username="admin_con_correcciones",
        rol="administrador",
        permisos=(PERMISO_GESTIONAR_CORRECCIONES,),
    )
    autorizado = client.get("/correcciones/pendientes", headers=_headers(token_admin))
    assert autorizado.status_code == 200, autorizado.text
