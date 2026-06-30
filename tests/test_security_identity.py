import pytest

from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.modules.usuarios.service import hash_password
from tests.conftest import asignar_rol_usuario


def _crear_actor(
    db_conn,
    *,
    username: str,
    rol: str,
    activo: bool = True,
):
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
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                username.upper(),
                username,
                f"{username}@test.local",
                hash_password("Password123"),
                activo,
            ),
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


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def test_endpoint_protegido_rechaza_sin_token(
    client,
    clean_db,
    auth_habilitada,
):
    response = client.get("/usuarios/")

    assert response.status_code == 401
    assert response.json()["detail"] == "Sesión requerida"


def test_endpoint_protegido_rechaza_token_invalido(
    client,
    clean_db,
    auth_habilitada,
):
    response = client.get(
        "/usuarios/",
        headers=_headers("token-invalido"),
    )

    assert response.status_code == 401
    assert "Token" in response.json()["detail"]


def test_token_de_usuario_desactivado_es_rechazado(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _, token = _crear_actor(
        db_conn,
        username="usuario_inactivo",
        rol="administrador",
        activo=False,
    )

    response = client.get("/usuarios/", headers=_headers(token))

    assert response.status_code == 403
    assert response.json()["detail"] == "Usuario inactivo"


def test_usuario_sin_permiso_no_puede_administrar_usuarios(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _, token = _crear_actor(
        db_conn,
        username="operador_sin_gestion",
        rol="operador",
    )

    response = client.post(
        "/usuarios/",
        headers=_headers(token),
        json={
            "nombre": "USUARIO BLOQUEADO",
            "username": "usuario_bloqueado",
            "email": "usuario_bloqueado@test.local",
            "password": "Password123",
            "rol": "operador",
        },
    )

    assert response.status_code == 403
    assert "gestionar_usuarios" in response.json()["detail"]


@pytest.mark.parametrize("payload", [{}, {"id_usuario": 999999}])
def test_actor_del_token_se_inyecta_y_sobrescribe_payload(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    payload,
):
    _, token = _crear_actor(
        db_conn,
        username=f"admin_actor_{len(payload)}",
        rol="administrador",
    )

    response = client.post(
        "/alertas-operativas/ventas/999999/sincronizar-deuda",
        headers=_headers(token),
        json=payload,
    )

    assert response.status_code == 400, response.text
    assert "deuda formal" in response.json()["detail"]


def test_usuario_con_permiso_administra_y_audita_con_actor_autenticado(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    admin_id, token = _crear_actor(
        db_conn,
        username="admin_seguridad",
        rol="administrador",
    )
    otro_id, _ = _crear_actor(
        db_conn,
        username="actor_falso",
        rol="operador",
    )

    crear = client.post(
        "/usuarios/",
        headers=_headers(token),
        json={
            "nombre": "USUARIO GESTIONADO",
            "username": "usuario_gestionado",
            "email": "usuario_gestionado@example.com",
            "password": "Password123",
            "rol": "operador",
            "id_usuario": otro_id,
        },
    )
    assert crear.status_code == 201, crear.text
    usuario_id = crear.json()["usuario_id"]

    editar = client.put(
        f"/usuarios/{usuario_id}",
        headers=_headers(token),
        json={
            "nombre": "USUARIO GESTIONADO EDITADO",
            "username": "usuario_gestionado",
            "email": "usuario_gestionado@example.com",
            "rol": "mecanico",
            "activo": True,
        },
    )
    assert editar.status_code == 200, editar.text

    desactivar = client.patch(
        f"/usuarios/{usuario_id}/desactivar",
        headers=_headers(token),
    )
    assert desactivar.status_code == 200, desactivar.text

    activar = client.patch(
        f"/usuarios/{usuario_id}/activar",
        headers=_headers(token),
    )
    assert activar.status_code == 200, activar.text

    resetear = client.patch(
        f"/usuarios/{usuario_id}/password",
        headers=_headers(token),
        json={"password": "Password456"},
    )
    assert resetear.status_code == 200, resetear.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT accion, id_usuario
            FROM auditoria_eventos
            WHERE entidad = 'usuario'
              AND entidad_id = %s
            ORDER BY id
            """,
            (usuario_id,),
        )
        eventos = cur.fetchall()

    assert [evento["accion"] for evento in eventos] == [
        "usuario_creado",
        "usuario_editado",
        "usuario_desactivado",
        "usuario_activado",
        "usuario_password_reseteado",
    ]
    assert {evento["id_usuario"] for evento in eventos} == {admin_id}
    assert otro_id not in {evento["id_usuario"] for evento in eventos}


def test_cambio_password_propia_usa_usuario_del_token(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    usuario_id, token = _crear_actor(
        db_conn,
        username="usuario_password",
        rol="operador",
    )
    otro_id, _ = _crear_actor(
        db_conn,
        username="otro_password",
        rol="operador",
    )

    response = client.patch(
        f"/usuarios/{otro_id}/password-propia",
        headers=_headers(token),
        json={
            "password_actual": "Password123",
            "password_nueva": "Password456",
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["usuario_id"] == usuario_id
