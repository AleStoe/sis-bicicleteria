from decimal import Decimal


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _get_reglas_comerciales(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM reglas_comerciales
            ORDER BY id
            """
        )
        return cur.fetchall()


def _get_reglas_aplicadas_venta(conn, venta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM venta_reglas_aplicadas
            WHERE id_venta = %s
            ORDER BY id
            """,
            (venta_id,),
        )
        return cur.fetchall()


def test_lista_reglas_comerciales_activas(client, db_conn):
    response = client.get("/reglas-comerciales")

    assert response.status_code == 200, response.text

    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2

    nombres = [r["nombre"] for r in data]
    assert "Descuento contado efectivo 10%" in nombres
    assert "Descuento contado transferencia 10%" in nombres

    reglas_db = _get_reglas_comerciales(db_conn)
    assert len(reglas_db) >= 2


def test_simula_descuento_contado_efectivo(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto": "100000",
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["subtotal_base"]) == Decimal("100000")
    assert _dec(data["descuento_total"]) == Decimal("10000")
    assert _dec(data["recargo_total"]) == Decimal("0")
    assert _dec(data["total_final"]) == Decimal("90000")

    assert len(data["reglas_aplicadas"]) == 1
    assert data["reglas_aplicadas"][0]["tipo"] == "descuento"
    assert data["reglas_aplicadas"][0]["medio_pago"] == "efectivo"
    assert _dec(data["reglas_aplicadas"][0]["monto_aplicado"]) == Decimal("10000")


def test_simula_descuento_contado_transferencia(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "50000",
            "medios_pago": [
                {
                    "medio_pago": "transferencia",
                    "monto": "50000",
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["subtotal_base"]) == Decimal("50000")
    assert _dec(data["descuento_total"]) == Decimal("5000")
    assert _dec(data["recargo_total"]) == Decimal("0")
    assert _dec(data["total_final"]) == Decimal("45000")

    assert len(data["reglas_aplicadas"]) == 1
    assert data["reglas_aplicadas"][0]["medio_pago"] == "transferencia"


def test_pago_parcial_efectivo_aplica_descuento_sobre_monto_pagado(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto": "50000",
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["subtotal_base"]) == Decimal("100000")
    assert _dec(data["descuento_total"]) == Decimal("5000")
    assert _dec(data["recargo_total"]) == Decimal("0")
    assert _dec(data["total_final"]) == Decimal("95000")
    assert len(data["reglas_aplicadas"]) == 1

def test_mercadopago_no_aplica_descuento_contado(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "mercadopago",
                    "monto": "100000",
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["descuento_total"]) == Decimal("0")
    assert _dec(data["recargo_total"]) == Decimal("0")
    assert _dec(data["total_final"]) == Decimal("100000")
    assert len(data["reglas_aplicadas"]) == 0


def test_tarjeta_no_aplica_descuento_contado(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "tarjeta",
                    "monto": "100000",
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["descuento_total"]) == Decimal("0")
    assert _dec(data["recargo_total"]) == Decimal("0")
    assert _dec(data["total_final"]) == Decimal("100000")
    assert len(data["reglas_aplicadas"]) == 0


def test_simular_rechaza_subtotal_cero(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "0",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto": "0",
                }
            ],
        },
    )

    assert response.status_code == 422


def test_simular_rechaza_medio_pago_invalido(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "cheque",
                    "monto": "100000",
                }
            ],
        },
    )

    assert response.status_code == 422

def test_tarjeta_una_cuota_no_aplica_recargo(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "tarjeta",
                    "monto": "100000",
                    "cuotas": 1,
                }
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["descuento_total"]) == Decimal("0")
    assert _dec(data["recargo_total"]) == Decimal("0")
    assert _dec(data["total_final"]) == Decimal("100000")

def test_pago_mixto_efectivo_y_tarjeta(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto": "50000",
                },
                {
                    "medio_pago": "tarjeta",
                    "monto": "50000",
                    "cuotas": 6,
                },
            ],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["descuento_total"]) == Decimal("5000")
    assert _dec(data["recargo_total"]) == Decimal("17500")
    assert _dec(data["total_final"]) == Decimal("112500")

    assert len(data["reglas_aplicadas"]) == 2