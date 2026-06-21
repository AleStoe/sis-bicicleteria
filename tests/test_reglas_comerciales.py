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


def test_crea_regla_comercial(client, db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM reglas_comerciales
            WHERE nombre LIKE 'Recargo test alta%'
            """
        )
    db_conn.commit()

    response = client.post(
        "/reglas-comerciales",
        json={
            "nombre": "Recargo test alta",
            "tipo": "recargo",
            "medio_pago": "mercadopago",
            "porcentaje": "5",
            "requiere_pago_total": False,
            "combinable": False,
            "prioridad": 25,
            "activa": False,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["nombre"] == "Recargo test alta"
    assert data["tipo"] == "recargo"
    assert data["medio_pago"] == "mercadopago"
    assert _dec(data["porcentaje"]) == Decimal("5")
    assert data["activa"] is False


def test_crear_regla_comercial_requiere_porcentaje_o_monto(client):
    response = client.post(
        "/reglas-comerciales",
        json={
            "nombre": "Regla sin valor",
            "tipo": "descuento",
            "medio_pago": "efectivo",
        },
    )

    assert response.status_code == 422


def test_simula_descuento_efectivo_sobre_monto_pagado(client):
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


def test_simula_descuento_transferencia_sobre_monto_pagado(client):
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


def test_pago_parcial_efectivo_aplica_descuento_sobre_base(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto_base": "50000",
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

    assert _dec(data["total_base_asignada"]) == Decimal("50000")
    assert _dec(data["total_pagos_cargados"]) == Decimal("45000")
    assert _dec(data["saldo_base_estimado"]) == Decimal("50000")

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
            "medios_pago": [],
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


def test_pago_mixto_efectivo_y_tarjeta_aplica_descuento_y_recargo(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "100000",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto_base": "50000",
                },
                {
                    "medio_pago": "tarjeta",
                    "monto_base": "50000",
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

    assert _dec(data["total_base_asignada"]) == Decimal("100000")
    assert _dec(data["total_pagos_cargados"]) == Decimal("112500")
    assert _dec(data["saldo_base_estimado"]) == Decimal("0")

    assert len(data["tramos_pago"]) == 2

def test_sugerir_monto_para_saldar_efectivo(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [],
            "sugerir_saldo_con_medio_pago": {
                "medio_pago": "efectivo",
            },
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["monto_base_sugerido_para_saldar"]) == Decimal("1000")
    assert _dec(data["monto_sugerido_para_saldar"]) == Decimal("900")


def test_sugerir_monto_para_saldar_transferencia_con_pago_previo(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto": "500",
                }
            ],
            "sugerir_saldo_con_medio_pago": {
                "medio_pago": "transferencia",
            },
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    sugerido = _dec(data["monto_sugerido_para_saldar"])

    assert sugerido == Decimal("450.00")


def test_sugerir_monto_para_saldar_tarjeta_con_recargo(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [],
            "sugerir_saldo_con_medio_pago": {
                "medio_pago": "tarjeta",
                "cuotas": 6,
            },
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    sugerido = _dec(data["monto_sugerido_para_saldar"])

    assert sugerido > Decimal("1000")


def test_sugerir_monto_para_saldar_medio_sin_descuento_ni_recargo(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [],
            "sugerir_saldo_con_medio_pago": {
                "medio_pago": "mercadopago",
            },
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["monto_sugerido_para_saldar"]) == Decimal("1000.00")


def test_sugerir_monto_para_saldar_cuando_ya_esta_saldado(client):
    response = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [
                {
                    "medio_pago": "efectivo",
                    "monto": "1000",
                }
            ],
            "sugerir_saldo_con_medio_pago": {
                "medio_pago": "efectivo",
            },
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["monto_sugerido_para_saldar"]) == Decimal("0")
