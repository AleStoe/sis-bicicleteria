import pytest

from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.modules.usuarios.service import hash_password
from tests.conftest import asignar_rol_usuario


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

    asignar_rol_usuario(db_conn, usuario_id, rol)
    for permiso in permisos:
        _asignar_permiso_rol(db_conn, rol, permiso)
    db_conn.commit()

    token = crear_token_usuario(
        {
            "id": usuario_id,
            "username": username,
            "rol": rol,
        }
    )
    return usuario_id, token


def _crear_sucursal(db_conn, nombre: str):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES (%s, 'Dirección test', TRUE)
            RETURNING id
            """,
            (nombre,),
        )
        sucursal_id = cur.fetchone()["id"]
    db_conn.commit()
    return sucursal_id


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def test_operador_sin_permiso_no_puede_ajustar_ni_cerrar_caja(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    sucursal_id = _crear_sucursal(db_conn, "CAJA OPERADOR")
    _, token = _crear_actor(
        db_conn,
        username="operador_caja_seguridad",
        rol="operador",
        permisos=("abrir_caja",),
    )

    abrir = client.post(
        "/cajas/abrir",
        headers=_headers(token),
        json={"id_sucursal": sucursal_id, "monto_apertura": 0},
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    ajustar = client.post(
        f"/cajas/{caja_id}/ajustes",
        headers=_headers(token),
        json={"monto": 100, "direccion": "positivo", "nota": "Ajuste test"},
    )
    egreso = client.post(
        f"/cajas/{caja_id}/egresos",
        headers=_headers(token),
        json={"monto": 100, "nota": "Egreso sin permiso"},
    )
    cerrar = client.post(
        f"/cajas/{caja_id}/cerrar",
        headers=_headers(token),
        json={"monto_cierre_real": 0},
    )

    assert ajustar.status_code == 403
    assert "ajustar_caja" in ajustar.json()["detail"]
    assert egreso.status_code == 403
    assert "registrar_egreso" in egreso.json()["detail"]
    assert cerrar.status_code == 403
    assert "cerrar_caja" in cerrar.json()["detail"]


@pytest.mark.parametrize("rol", ["encargado", "administrador"])
def test_encargado_y_admin_pueden_ajustar_y_cerrar_caja(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    rol,
):
    sucursal_id = _crear_sucursal(db_conn, f"CAJA {rol}")
    _, token = _crear_actor(
        db_conn,
        username=f"{rol}_caja_seguridad",
        rol=rol,
        permisos=("abrir_caja", "ajustar_caja", "cerrar_caja"),
    )

    abrir = client.post(
        "/cajas/abrir",
        headers=_headers(token),
        json={"id_sucursal": sucursal_id, "monto_apertura": 0},
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    ajustar = client.post(
        f"/cajas/{caja_id}/ajustes",
        headers=_headers(token),
        json={"monto": 100, "direccion": "positivo", "nota": "Ajuste autorizado"},
    )
    assert ajustar.status_code == 200, ajustar.text

    cerrar = client.post(
        f"/cajas/{caja_id}/cerrar",
        headers=_headers(token),
        json={"monto_cierre_real": 100},
    )
    assert cerrar.status_code == 200, cerrar.text


def test_reversion_pago_exige_permiso(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _, token_sin_permiso = _crear_actor(
        db_conn,
        username="mecanico_sin_reversion",
        rol="mecanico",
    )

    bloqueado = client.post(
        "/pagos/999999/revertir",
        headers=_headers(token_sin_permiso),
        json={"motivo": "Intento sin permiso"},
    )
    assert bloqueado.status_code == 403
    assert "revertir_pago" in bloqueado.json()["detail"]

    _, token_autorizado = _crear_actor(
        db_conn,
        username="encargado_con_reversion",
        rol="encargado",
        permisos=("revertir_pago",),
    )
    autorizado = client.post(
        "/pagos/999999/revertir",
        headers=_headers(token_autorizado),
        json={"motivo": "Prueba autorizada"},
    )
    assert autorizado.status_code == 404


def test_registrar_pago_exige_permiso(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    payload = {
        "origen_tipo": "venta",
        "origen_id": 999999,
        "medio_pago": "efectivo",
        "monto_base": 1000,
    }
    _, token_sin_permiso = _crear_actor(
        db_conn,
        username="mecanico_sin_cobro",
        rol="mecanico",
    )
    bloqueado = client.post(
        "/pagos/",
        headers=_headers(token_sin_permiso),
        json=payload,
    )
    assert bloqueado.status_code == 403
    assert "registrar_pago" in bloqueado.json()["detail"]

    _, token_autorizado = _crear_actor(
        db_conn,
        username="operador_con_cobro",
        rol="operador",
        permisos=("registrar_pago",),
    )
    autorizado = client.post(
        "/pagos/",
        headers=_headers(token_autorizado),
        json=payload,
    )
    assert autorizado.status_code == 404


def test_egreso_y_gasto_requieren_permiso_y_auditan_actor_real(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    sucursal_id = _crear_sucursal(db_conn, "CAJA EGRESOS")
    actor_id, token = _crear_actor(
        db_conn,
        username="encargado_egresos",
        rol="encargado",
        permisos=("abrir_caja", "registrar_egreso", "gestionar_gastos"),
    )
    actor_falso_id, _ = _crear_actor(
        db_conn,
        username="actor_falso_finanzas",
        rol="mecanico",
    )

    abrir = client.post(
        "/cajas/abrir",
        headers=_headers(token),
        json={
            "id_sucursal": sucursal_id,
            "monto_apertura": 10000,
            "id_usuario": actor_falso_id,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    egreso = client.post(
        f"/cajas/{caja_id}/egresos",
        headers=_headers(token),
        json={
            "monto": 1000,
            "nota": "Compra operativa",
            "id_usuario": actor_falso_id,
        },
    )
    assert egreso.status_code == 200, egreso.text

    gasto = client.post(
        "/gastos/",
        headers=_headers(token),
        json={
            "id_sucursal": sucursal_id,
            "descripcion": "Gasto de prueba",
            "monto": 500,
            "medio_pago": "efectivo",
            "impacta_caja": False,
            "id_usuario": actor_falso_id,
        },
    )
    assert gasto.status_code == 200, gasto.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_usuario
            FROM auditoria_eventos
            WHERE (
                entidad = 'caja'
                AND entidad_id = %s
            ) OR (
                entidad = 'gasto'
                AND entidad_id = %s
            )
            """,
            (caja_id, gasto.json()["gasto_id"]),
        )
        eventos = cur.fetchall()

    assert eventos
    assert {evento["id_usuario"] for evento in eventos} == {actor_id}


def test_gasto_y_capital_bloquean_usuario_sin_permiso(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    sucursal_id = _crear_sucursal(db_conn, "BLOQUEOS FINANCIEROS")
    _, token = _crear_actor(
        db_conn,
        username="operador_sin_finanzas",
        rol="operador",
    )

    gasto = client.post(
        "/gastos/",
        headers=_headers(token),
        json={
            "id_sucursal": sucursal_id,
            "descripcion": "No autorizado",
            "monto": 100,
            "impacta_caja": False,
        },
    )
    capital = client.post(
        "/capital-retiros/participantes",
        headers=_headers(token),
        json={"nombre": "No autorizado", "tipo": "persona"},
    )

    assert gasto.status_code == 403
    assert "gestionar_gastos" in gasto.json()["detail"]
    assert capital.status_code == 403
    assert "gestionar_capital_retiros" in capital.json()["detail"]


def test_movimiento_capital_autorizado_audita_actor_real(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    actor_id, token = _crear_actor(
        db_conn,
        username="admin_capital",
        rol="administrador",
        permisos=("gestionar_capital_retiros",),
    )
    actor_falso_id, _ = _crear_actor(
        db_conn,
        username="actor_falso_capital",
        rol="mecanico",
    )

    participante = client.post(
        "/capital-retiros/participantes",
        headers=_headers(token),
        json={"nombre": "SOCIO TEST", "tipo": "persona"},
    )
    assert participante.status_code == 200, participante.text

    movimiento = client.post(
        "/capital-retiros/movimientos",
        headers=_headers(token),
        json={
            "id_participante": participante.json()["id"],
            "tipo_movimiento": "aporte_capital",
            "descripcion": "Aporte sin caja",
            "monto": 25000,
            "impacta_caja": False,
            "id_usuario": actor_falso_id,
        },
    )
    assert movimiento.status_code == 200, movimiento.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_usuario
            FROM auditoria_eventos
            WHERE entidad = 'capital_retiro'
              AND entidad_id = %s
              AND accion = 'capital_movimiento_creado'
            """,
            (movimiento.json()["movimiento_id"],),
        )
        evento = cur.fetchone()

    assert evento is not None
    assert evento["id_usuario"] == actor_id
