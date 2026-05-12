from pathlib import Path

def test_upload_imagen_catalogo(client):
    contenido = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00"
        b"\x90wS\xde"
        b"\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01"
        b"\xe2!\xbc3"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    response = client.post(
        "/catalogo/imagenes/upload",
        data={
            "id_variante": 1,
            "es_principal": "true",
            "orden": 0,
        },
        files={
            "archivo": (
                "test.png",
                contenido,
                "image/png",
            )
        },
    )

    assert response.status_code == 200, response.text

    body = response.json()

    assert body["id"] > 0
    assert body["url"].startswith("/uploads/catalogo/")
    assert body["id_variante"] == 1

    archivo = Path.cwd() / body["url"].lstrip("/")

    assert archivo.exists()