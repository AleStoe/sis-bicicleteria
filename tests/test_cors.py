def test_cors_preflight_permite_vite_en_puerto_alternativo(client):
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5174"


def test_cors_preflight_permite_frontend_en_lan(client):
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://192.168.0.66:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://192.168.0.66:5173"


def test_cors_preflight_permite_sistema_agus_sin_puerto(client):
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://sistema-agus",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://sistema-agus"
