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


def test_regla_comercial_rechaza_porcentaje_y_monto_fijo_juntos(client):
    response = client.post(
        "/reglas-comerciales",
        json={
            "nombre": "Regla ambigua test",
            "tipo": "descuento",
            "medio_pago": "efectivo",
            "porcentaje": "10",
            "monto_fijo": "1000",
        },
    )

    assert response.status_code == 422


def test_regla_comercial_rechaza_valor_cero(client):
    response = client.post(
        "/reglas-comerciales",
        json={
            "nombre": "Regla cero test",
            "tipo": "descuento",
            "medio_pago": "efectivo",
            "porcentaje": "0",
        },
    )

    assert response.status_code == 422


def test_edita_regla_y_cambia_porcentaje_por_monto_fijo(
    client,
    db_conn,
    request,
):
    nombre = "Regla edición ABM test"

    def limpiar():
        db_conn.rollback()
        with db_conn.cursor() as cur:
            cur.execute(
                "DELETE FROM reglas_comerciales WHERE nombre = %s",
                (nombre,),
            )
        db_conn.commit()

    limpiar()
    request.addfinalizer(limpiar)

    creada = client.post(
        "/reglas-comerciales",
        json={
            "nombre": nombre,
            "tipo": "descuento",
            "medio_pago": "efectivo",
            "porcentaje": "10",
            "requiere_pago_total": False,
            "combinable": False,
            "prioridad": 50,
            "activa": True,
        },
    )
    assert creada.status_code == 200, creada.text
    regla_id = creada.json()["id"]

    editada = client.patch(
        f"/reglas-comerciales/{regla_id}",
        json={
            "tipo": "recargo",
            "medio_pago": "transferencia",
            "porcentaje": None,
            "monto_fijo": "1500",
            "requiere_pago_total": True,
            "combinable": True,
            "prioridad": 15,
        },
    )

    assert editada.status_code == 200, editada.text
    data = editada.json()
    assert data["tipo"] == "recargo"
    assert data["medio_pago"] == "transferencia"
    assert data["porcentaje"] is None
    assert _dec(data["monto_fijo"]) == Decimal("1500")
    assert data["requiere_pago_total"] is True
    assert data["combinable"] is True
    assert data["prioridad"] == 15


def test_activa_y_desactiva_regla_comercial(client, db_conn, request):
    nombre = "Regla estado ABM test"

    def limpiar():
        db_conn.rollback()
        with db_conn.cursor() as cur:
            cur.execute(
                "DELETE FROM reglas_comerciales WHERE nombre = %s",
                (nombre,),
            )
        db_conn.commit()

    limpiar()
    request.addfinalizer(limpiar)

    creada = client.post(
        "/reglas-comerciales",
        json={
            "nombre": nombre,
            "tipo": "descuento",
            "medio_pago": "mercadopago",
            "porcentaje": "3",
        },
    )
    regla_id = creada.json()["id"]

    desactivada = client.patch(
        f"/reglas-comerciales/{regla_id}",
        json={"activa": False},
    )
    assert desactivada.status_code == 200, desactivada.text
    assert desactivada.json()["activa"] is False

    activada = client.patch(
        f"/reglas-comerciales/{regla_id}",
        json={"activa": True},
    )
    assert activada.status_code == 200, activada.text
    assert activada.json()["activa"] is True


def test_no_permite_nombre_duplicado_normalizado(client, db_conn, request):
    nombre = "Regla nombre único ABM"

    def limpiar():
        db_conn.rollback()
        with db_conn.cursor() as cur:
            cur.execute(
                "DELETE FROM reglas_comerciales WHERE LOWER(nombre) = LOWER(%s)",
                (nombre,),
            )
        db_conn.commit()

    limpiar()
    request.addfinalizer(limpiar)

    primera = client.post(
        "/reglas-comerciales",
        json={
            "nombre": nombre,
            "tipo": "descuento",
            "medio_pago": "efectivo",
            "porcentaje": "5",
        },
    )
    assert primera.status_code == 200, primera.text

    duplicada = client.post(
        "/reglas-comerciales",
        json={
            "nombre": f"  {nombre.upper()}  ",
            "tipo": "recargo",
            "medio_pago": "transferencia",
            "porcentaje": "7",
        },
    )

    assert duplicada.status_code == 400
    assert "nombre" in duplicada.json()["detail"].lower()


def test_pago_total_y_combinabilidad_conservan_semantica_actual(
    client,
    db_conn,
    request,
):
    nombres = (
        "Regla pago total ABM test",
        "Regla combinable uno ABM test",
        "Regla combinable dos ABM test",
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, activa
            FROM reglas_comerciales
            WHERE activa = TRUE
              AND (medio_pago IS NULL OR medio_pago = 'mercadopago')
            """
        )
        estados_originales = {
            row["id"]: row["activa"]
            for row in cur.fetchall()
        }
        cur.execute(
            """
            UPDATE reglas_comerciales
            SET activa = FALSE
            WHERE activa = TRUE
              AND (medio_pago IS NULL OR medio_pago = 'mercadopago')
            """
        )
        cur.execute(
            "DELETE FROM reglas_comerciales WHERE nombre = ANY(%s)",
            (list(nombres),),
        )
    db_conn.commit()

    def restaurar():
        db_conn.rollback()
        with db_conn.cursor() as cur:
            cur.execute(
                "DELETE FROM reglas_comerciales WHERE nombre = ANY(%s)",
                (list(nombres),),
            )
            for regla_id, activa in estados_originales.items():
                cur.execute(
                    "UPDATE reglas_comerciales SET activa = %s WHERE id = %s",
                    (activa, regla_id),
                )
        db_conn.commit()

    request.addfinalizer(restaurar)

    pago_total = client.post(
        "/reglas-comerciales",
        json={
            "nombre": nombres[0],
            "tipo": "descuento",
            "medio_pago": "mercadopago",
            "porcentaje": "10",
            "requiere_pago_total": True,
            "combinable": False,
            "prioridad": 1,
        },
    )
    assert pago_total.status_code == 200, pago_total.text

    parcial = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [{"medio_pago": "mercadopago", "monto_base": "500"}],
        },
    )
    assert _dec(parcial.json()["descuento_total"]) == Decimal("0")

    total = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [{"medio_pago": "mercadopago", "monto_base": "1000"}],
        },
    )
    assert _dec(total.json()["descuento_total"]) == Decimal("100")

    client.patch(
        f"/reglas-comerciales/{pago_total.json()['id']}",
        json={"activa": False},
    )

    primera = client.post(
        "/reglas-comerciales",
        json={
            "nombre": nombres[1],
            "tipo": "descuento",
            "medio_pago": "mercadopago",
            "porcentaje": "10",
            "combinable": True,
            "prioridad": 1,
        },
    )
    segunda = client.post(
        "/reglas-comerciales",
        json={
            "nombre": nombres[2],
            "tipo": "descuento",
            "medio_pago": "mercadopago",
            "porcentaje": "5",
            "combinable": False,
            "prioridad": 2,
        },
    )
    assert primera.status_code == 200, primera.text
    assert segunda.status_code == 200, segunda.text

    combinadas = client.post(
        "/reglas-comerciales/simular",
        json={
            "subtotal_base": "1000",
            "medios_pago": [{"medio_pago": "mercadopago", "monto_base": "1000"}],
        },
    )
    assert _dec(combinadas.json()["descuento_total"]) == Decimal("150")


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
