from app.core.auth import verificar_token_usuario
from app.modules.usuarios.service import hash_password
from tests.conftest import asignar_rol_usuario


def _crear_usuario_login(db_conn, username="qa_admin", password="Password123", activo=True):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, email, password_hash, activo)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                "QA Admin",
                username,
                f"{username}@local.test",
                hash_password(password),
                activo,
            ),
        )
        usuario_id = cur.fetchone()["id"]

    asignar_rol_usuario(db_conn, usuario_id, "administrador")
    db_conn.commit()

    return usuario_id


def test_login_exitoso_devuelve_token_verificable(client, db_conn, clean_db):
    usuario_id = _crear_usuario_login(db_conn)

    response = client.post(
        "/auth/login",
        json={"username": "qa_admin", "password": "Password123"},
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["id"] == usuario_id
    assert data["username"] == "qa_admin"
    assert data["rol"] == "administrador"
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0

    payload = verificar_token_usuario(data["token"])
    assert payload["sub"] == usuario_id
    assert payload["username"] == "qa_admin"
    assert payload["rol"] == "administrador"


def test_login_rechaza_password_incorrecta(client, db_conn, clean_db):
    _crear_usuario_login(db_conn)

    response = client.post(
        "/auth/login",
        json={"username": "qa_admin", "password": "Password999"},
    )

    assert response.status_code == 401
    assert response.json()["detail"]


def test_login_rechaza_usuario_inactivo(client, db_conn, clean_db):
    _crear_usuario_login(db_conn, username="qa_inactivo", activo=False)

    response = client.post(
        "/auth/login",
        json={"username": "qa_inactivo", "password": "Password123"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Usuario inactivo"
