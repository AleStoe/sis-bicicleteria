from datetime import date, timedelta
from decimal import Decimal


def _crear_oferta(client, seed, **overrides):
    hoy = date.today()
    payload = {
        "id_variante": seed["variante_id"],
        "nombre": "OFERTA CAMPEONES",
        "precio_oferta": "20000",
        "fecha_desde": hoy.isoformat(),
        "fecha_hasta": (hoy + timedelta(days=2)).isoformat(),
        "motivo": "Promocion comercial de prueba",
        "id_usuario": seed["usuario_id"],
    }
    payload.update(overrides)
    return client.post("/ofertas", json=payload)


def test_oferta_vigente_aparece_en_catalogo_pos(client, seed_venta_basica):
    crear = _crear_oferta(client, seed_venta_basica)
    assert crear.status_code == 201, crear.text

    response = client.get(
        "/catalogo/pos",
        params={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "query": "ZEFAL-DRY-120",
        },
    )
    assert response.status_code == 200, response.text

    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["en_oferta"] is True
    assert Decimal(items[0]["precio_oferta"]) == Decimal("20000")
    assert items[0]["oferta_nombre"] == "OFERTA CAMPEONES"


def test_historia_png_se_genera_con_oferta_vigente(client, seed_venta_basica):
    crear = _crear_oferta(client, seed_venta_basica)
    assert crear.status_code == 201, crear.text

    response = client.get(
        f"/documentos/etiquetas/variantes/{seed_venta_basica['variante_id']}/historia"
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_no_permite_ofertas_solapadas(client, seed_venta_basica):
    primera = _crear_oferta(client, seed_venta_basica)
    assert primera.status_code == 201, primera.text

    segunda = _crear_oferta(
        client,
        seed_venta_basica,
        nombre="SEGUNDA OFERTA",
        precio_oferta="19000",
    )
    assert segunda.status_code == 400
    assert "oferta activa" in segunda.json()["detail"].lower()


def test_venta_minorista_aplica_oferta_y_congela_trazabilidad(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = _crear_oferta(client, seed_venta_basica)
    assert crear.status_code == 201, crear.text
    oferta_id = crear.json()["id"]

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.subtotal_base,
                vi.precio_lista,
                vi.precio_final,
                vi.id_oferta,
                vi.precio_catalogo_original,
                vi.descuento_oferta_unitario,
                vi.oferta_nombre_snapshot
            FROM ventas v
            JOIN venta_items vi ON vi.id_venta = v.id
            WHERE v.id = %s
            """,
            (venta_id,),
        )
        fila = cur.fetchone()

    assert Decimal(str(fila["subtotal_base"])) == Decimal("20000.00")
    assert Decimal(str(fila["precio_lista"])) == Decimal("20000.00")
    assert Decimal(str(fila["precio_final"])) == Decimal("20000.00")
    assert fila["id_oferta"] == oferta_id
    assert Decimal(str(fila["precio_catalogo_original"])) == Decimal("24440.00")
    assert Decimal(str(fila["descuento_oferta_unitario"])) == Decimal("4440.00")
    assert fila["oferta_nombre_snapshot"] == "OFERTA CAMPEONES"


def test_oferta_futura_no_modifica_venta(client, db_conn, seed_venta_basica):
    hoy = date.today()
    crear = _crear_oferta(
        client,
        seed_venta_basica,
        fecha_desde=(hoy + timedelta(days=1)).isoformat(),
        fecha_hasta=(hoy + timedelta(days=3)).isoformat(),
    )
    assert crear.status_code == 201, crear.text

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT precio_lista, id_oferta
            FROM venta_items
            WHERE id_venta = %s
            """,
            (venta.json()["venta_id"],),
        )
        item = cur.fetchone()

    assert Decimal(str(item["precio_lista"])) == Decimal("24440.00")
    assert item["id_oferta"] is None
