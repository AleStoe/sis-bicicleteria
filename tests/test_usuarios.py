def _payload_usuario(username, email=None, nombre="Usuario Test"):
    return {
        "nombre": nombre,
        "username": username,
        "email": email,
        "password": "Password123",
        "rol": "operador",
    }


def test_no_permite_crear_dos_usuarios_con_mismo_username(client, clean_db):
    primero = client.post(
        "/usuarios/",
        json=_payload_usuario("operador_dup", "operador_dup@test.com"),
    )
    assert primero.status_code == 201, primero.text

    duplicado = client.post(
        "/usuarios/",
        json=_payload_usuario("OPERADOR_DUP", "otro_operador_dup@test.com"),
    )

    assert duplicado.status_code == 400
    assert "username" in duplicado.json()["detail"].lower()


def test_no_permite_crear_dos_usuarios_con_mismo_email(client, clean_db):
    primero = client.post(
        "/usuarios/",
        json=_payload_usuario("operador_email_uno", "usuario.dup@test.com"),
    )
    assert primero.status_code == 201, primero.text

    duplicado = client.post(
        "/usuarios/",
        json=_payload_usuario("operador_email_dos", "USUARIO.DUP@test.com"),
    )

    assert duplicado.status_code == 400
    assert "email" in duplicado.json()["detail"].lower()


def test_resumen_duplicados_usuarios_cuenta_existentes_sin_merge(client, db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, email, password_hash, activo)
            VALUES
                ('USUARIO DUP', 'dup_health_a', 'dup_health@test.com', 'hash', TRUE),
                ('USUARIO DUP', 'dup_health_b', 'DUP_HEALTH@test.com', 'hash', TRUE)
            """
        )
    db_conn.commit()

    response = client.get("/usuarios/duplicados/resumen")

    assert response.status_code == 200, response.text
    assert response.json()["email"] == 1
    assert response.json()["nombre_normalizado"] == 1
