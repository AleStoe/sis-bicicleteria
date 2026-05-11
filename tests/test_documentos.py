def _crear_venta_basica(client, seed_venta_basica):
    return client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )


def test_comprobante_x_venta_devuelve_pdf(client, seed_venta_basica):
    crear = _crear_venta_basica(client, seed_venta_basica)
    assert crear.status_code == 200

    venta_id = crear.json()["venta_id"]

    response = client.get(f"/documentos/ventas/{venta_id}/comprobante-x")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_comprobante_x_venta_inexistente_devuelve_404(client):
    response = client.get("/documentos/ventas/999999/comprobante-x")

    assert response.status_code == 404