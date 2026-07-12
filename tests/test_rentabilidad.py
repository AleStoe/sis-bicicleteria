from decimal import Decimal
from uuid import uuid4


def _dec(value):
    return Decimal(str(value))


def _uniq(prefix):
    return f"{prefix} {uuid4().hex[:8]}"


def _crear_participante(client, nombre, tipo="persona"):
    response = client.post(
        "/capital-retiros/participantes",
        json={"nombre": _uniq(nombre), "tipo": tipo},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _crear_regla(client, ale_id, angel_id, fondo_id, nombre="Regla 3 partes"):
    nombre_unico = _uniq(nombre)

    response = client.post(
        "/rentabilidad/reglas",
        json={
            "nombre": nombre_unico,
            "descripcion": "Regla mensual familiar",
            "items": [
                {"id_participante": ale_id, "porcentaje": "33.33"},
                {"id_participante": angel_id, "porcentaje": "33.33"},
                {"id_participante": fondo_id, "porcentaje": "33.34"},
            ],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_crea_regla_distribucion(client, seed_venta_basica):
    ale = _crear_participante(client, "Ale regla test")
    angel = _crear_participante(client, "Ángel regla test")
    fondo = _crear_participante(client, "Fondo regla test", "fondo")

    regla = _crear_regla(client, ale["id"], angel["id"], fondo["id"], "Regla test crea")

    assert regla["nombre"].startswith("Regla test crea")
    assert regla["activa"] is True
    assert len(regla["items"]) == 3
    assert sum(_dec(item["porcentaje"]) for item in regla["items"]) == Decimal("100.0000")


def test_no_permite_regla_que_no_suma_100(client, seed_venta_basica):
    ale = _crear_participante(client, "Ale regla mala")
    angel = _crear_participante(client, "Ángel regla mala")

    response = client.post(
        "/rentabilidad/reglas",
        json={
            "nombre": _uniq("Regla mala suma"),
            "items": [
                {"id_participante": ale["id"], "porcentaje": "50"},
                {"id_participante": angel["id"], "porcentaje": "40"},
            ],
        },
    )

    assert response.status_code == 422


def test_rentabilidad_mensual_devuelve_estructura(client, seed_venta_basica):
    ale = _crear_participante(client, "Ale mensual")
    angel = _crear_participante(client, "Ángel mensual")
    fondo = _crear_participante(client, "Fondo mensual", "fondo")
    _crear_regla(client, ale["id"], angel["id"], fondo["id"], "Regla mensual estructura")

    response = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-06-01"},
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["periodo_mes"] == "2026-06-01"
    assert data["fecha_desde"] == "2026-06-01"
    assert data["fecha_hasta"] == "2026-06-30"
    assert "ventas_netas" in data
    assert "cmv_neto" in data
    assert "margen_bruto" in data
    assert "gastos_operativos" in data
    assert "resultado_distribuible" in data
    assert len(data["distribuciones_sugeridas"]) == 3


def test_resultado_distribuible_pdf(client, seed_venta_basica):
    ale = _crear_participante(client, "Ale pdf")
    angel = _crear_participante(client, "Angel pdf")
    fondo = _crear_participante(client, "Fondo pdf", "fondo")
    _crear_regla(client, ale["id"], angel["id"], fondo["id"], "Regla pdf")

    response = client.get(
        "/rentabilidad/resultado-distribuible/pdf",
        params={"periodo_mes": "2026-06-01", "incluir_detalle": "true"},
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/pdf")
    assert "Resultado-Distribuible-2026-06.pdf" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_rentabilidad_mensual_usa_total_final_de_ventas(client, db_conn, seed_venta_basica):
    crear = client.post(
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
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-06-10',
                estado = 'pagada_total',
                descuento_total = 2440,
                recargo_total = 0,
                total_final = 22000,
                saldo_pendiente = 0
            WHERE id = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
                monto_costo_financiero,
                monto_neto_liquidado,
                estado,
                id_usuario
            )
            VALUES (
                %s, 'venta', %s, 'efectivo',
                22000, 24440, 2440, 0,
                0, 22000, 'confirmado', %s
            )
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
    db_conn.commit()

    response = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-06-01"},
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert _dec(data["ventas_netas"]) == Decimal("22000.00")
    assert _dec(data["cmv_neto"]) == Decimal("10000.00")
    assert _dec(data["margen_bruto"]) == Decimal("12000.00")


def test_rentabilidad_diaria_detalla_ganancia_por_articulo(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 2,
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-04 10:00:00-03',
                estado = 'pagada_total',
                descuento_total = 4880,
                recargo_total = 0,
                total_final = 44000,
                saldo_pendiente = 0
            WHERE id = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
                monto_costo_financiero,
                monto_neto_liquidado,
                estado,
                id_usuario
            )
            VALUES (
                %s, 'venta', %s, 'efectivo',
                44000, 48880, 4880, 0,
                0, 44000, 'confirmado', %s
            )
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
    db_conn.commit()

    response = client.get(
        "/rentabilidad/diaria",
        params={
            "fecha": "2026-07-04",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["fecha"] == "2026-07-04"
    assert data["cantidad_ventas"] == 1
    assert _dec(data["ventas_netas"]) == Decimal("44000.00")
    assert _dec(data["ventas_cobradas"]) == Decimal("44000.00")
    assert _dec(data["cmv"]) == Decimal("20000.00")
    assert _dec(data["cmv_cobrado"]) == Decimal("20000.00")
    assert _dec(data["margen_bruto"]) == Decimal("24000.00")
    assert _dec(data["margen_cobrado"]) == Decimal("24000.00")
    assert _dec(data["margen_porcentaje"]).quantize(Decimal("0.01")) == Decimal(
        "54.55"
    )

    assert len(data["articulos"]) == 1
    articulo = data["articulos"][0]
    assert articulo["id_variante"] == seed_venta_basica["variante_id"]
    assert _dec(articulo["cantidad_vendida"]) == Decimal("2")
    assert _dec(articulo["venta_total"]) == Decimal("44000.00")
    assert _dec(articulo["venta_cobrada"]) == Decimal("44000.00")
    assert _dec(articulo["costo_total"]) == Decimal("20000.00")
    assert _dec(articulo["costo_cobrado"]) == Decimal("20000.00")
    assert _dec(articulo["margen_bruto"]) == Decimal("24000.00")
    assert _dec(articulo["margen_cobrado"]) == Decimal("24000.00")


def test_rentabilidad_parcial_menor_al_cmv_no_libera_utilidad(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "precio_unitario_manual": 650000,
                    "motivo_precio_manual": "Precio test rentabilidad parcial",
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE venta_items
            SET precio_lista = 650000,
                precio_final = 650000,
                subtotal = 650000,
                costo_unitario_aplicado = 500000
            WHERE id_venta = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-06 10:00:00-03',
                estado = 'pagada_parcial',
                subtotal_base = 650000,
                descuento_total = 0,
                recargo_total = 0,
                total_final = 650000,
                saldo_pendiente = 400000
            WHERE id = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
                monto_costo_financiero,
                monto_neto_liquidado,
                estado,
                id_usuario
            )
            VALUES (
                %s, 'venta', %s, 'transferencia',
                250000, 250000, 0, 0,
                0, 250000, 'confirmado', %s
            )
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
    db_conn.commit()

    mensual = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-07-01"},
    )
    assert mensual.status_code == 200, mensual.text
    mensual_data = mensual.json()

    assert _dec(mensual_data["ventas_netas"]) == Decimal("650000.00")
    assert _dec(mensual_data["ventas_cobradas"]) == Decimal("250000.00")
    assert _dec(mensual_data["cobrado_comercial_reconocido"]) == Decimal("250000.00")
    assert _dec(mensual_data["saldo_pendiente_por_cobrar"]) == Decimal("400000.00")
    assert _dec(mensual_data["cmv_neto"]) == Decimal("500000.00")
    assert _dec(mensual_data["cmv_cobrado"]) == Decimal("192307.69")
    assert _dec(mensual_data["capital_recuperado"]) == Decimal("250000.00")
    assert _dec(mensual_data["capital_inmovilizado"]) == Decimal("250000.00")
    assert _dec(mensual_data["margen_bruto"]) == Decimal("150000.00")
    assert _dec(mensual_data["margen_esperado"]) == Decimal("150000.00")
    # Auditoria tecnica: margen prorrateado, no KPI principal.
    assert _dec(mensual_data["margen_cobrado"]) == Decimal("57692.31")
    assert _dec(mensual_data["margen_pendiente"]) == Decimal("92307.69")
    assert _dec(mensual_data["utilidad_liberada"]) == Decimal("0.00")
    assert _dec(mensual_data["utilidad_pendiente"]) == Decimal("150000.00")
    assert _dec(mensual_data["margen_real"]) == Decimal("0.00")
    assert _dec(mensual_data["resultado_distribuible"]) == Decimal("0.00")

    diaria = client.get(
        "/rentabilidad/diaria",
        params={
            "fecha": "2026-07-06",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert diaria.status_code == 200, diaria.text
    diaria_data = diaria.json()
    assert _dec(diaria_data["ventas_cobradas"]) == Decimal("250000.00")
    assert _dec(diaria_data["cobrado_comercial_reconocido"]) == Decimal("250000.00")
    assert _dec(diaria_data["capital_recuperado"]) == Decimal("250000.00")
    assert _dec(diaria_data["capital_inmovilizado"]) == Decimal("250000.00")
    assert _dec(diaria_data["margen_cobrado"]) == Decimal("57692.31")
    assert _dec(diaria_data["margen_pendiente"]) == Decimal("92307.69")
    assert _dec(diaria_data["utilidad_liberada"]) == Decimal("0.00")
    assert _dec(diaria_data["utilidad_pendiente"]) == Decimal("150000.00")
    assert _dec(diaria_data["margen_real"]) == Decimal("0.00")


def test_rentabilidad_venta_creada_sin_pago_no_reconoce_ganancia_cobrada(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
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
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-07 10:00:00-03',
                estado = 'creada'
            WHERE id = %s
            """,
            (venta_id,),
        )
    db_conn.commit()

    mensual = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-07-01"},
    )
    assert mensual.status_code == 200, mensual.text
    mensual_data = mensual.json()

    assert _dec(mensual_data["ventas_netas"]) == Decimal("24440.00")
    assert _dec(mensual_data["cmv_neto"]) == Decimal("10000.00")
    assert _dec(mensual_data["margen_bruto"]) == Decimal("14440.00")
    assert _dec(mensual_data["ventas_cobradas"]) == Decimal("0.00")
    assert _dec(mensual_data["cmv_cobrado"]) == Decimal("0.00")
    assert _dec(mensual_data["margen_cobrado"]) == Decimal("0.00")
    assert _dec(mensual_data["margen_pendiente"]) == Decimal("14440.00")
    assert _dec(mensual_data["margen_real"]) == Decimal("0.00")


def test_rentabilidad_parcial_mayor_al_cmv_libera_solo_excedente(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "precio_unitario_manual": 650000,
                    "motivo_precio_manual": "Precio test rentabilidad parcial",
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE venta_items
            SET precio_lista = 650000,
                precio_final = 650000,
                subtotal = 650000,
                costo_unitario_aplicado = 420000
            WHERE id_venta = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-08 10:00:00-03',
                estado = 'pagada_parcial',
                subtotal_base = 650000,
                descuento_total = 0,
                recargo_total = 0,
                total_final = 650000,
                saldo_pendiente = 150000
            WHERE id = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
                monto_costo_financiero,
                monto_neto_liquidado,
                estado,
                id_usuario
            )
            VALUES (
                %s, 'venta', %s, 'transferencia',
                500000, 500000, 0, 0,
                0, 500000, 'confirmado', %s
            )
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
    db_conn.commit()

    response = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-07-01"},
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert _dec(data["venta_comercial"]) == Decimal("650000.00")
    assert _dec(data["cmv_comercial"]) == Decimal("420000.00")
    assert _dec(data["margen_esperado"]) == Decimal("230000.00")
    assert _dec(data["cobrado_comercial_reconocido"]) == Decimal("500000.00")
    assert _dec(data["capital_recuperado"]) == Decimal("420000.00")
    assert _dec(data["capital_inmovilizado"]) == Decimal("0.00")
    assert _dec(data["utilidad_liberada"]) == Decimal("80000.00")
    assert _dec(data["utilidad_pendiente"]) == Decimal("150000.00")
    assert _dec(data["margen_real"]) == Decimal("80000.00")


def test_financiacion_tarjeta_no_se_cuenta_como_ganancia(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
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
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-04 11:00:00-03',
                estado = 'pagada_total',
                subtotal_base = 24440,
                descuento_total = 0,
                recargo_total = 10000,
                total_final = 34440,
                saldo_pendiente = 0
            WHERE id = %s
            """,
            (venta_id,),
        )
    db_conn.commit()

    mensual = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-07-01"},
    )
    assert mensual.status_code == 200, mensual.text
    mensual_data = mensual.json()
    assert _dec(mensual_data["ventas_netas"]) == Decimal("24440.00")
    assert _dec(mensual_data["financiacion_excluida"]) == Decimal("10000.00")
    assert _dec(mensual_data["margen_bruto"]) == Decimal("14440.00")

    diaria = client.get(
        "/rentabilidad/diaria",
        params={
            "fecha": "2026-07-04",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert diaria.status_code == 200, diaria.text
    diaria_data = diaria.json()
    assert _dec(diaria_data["ventas_netas"]) == Decimal("24440.00")
    assert _dec(diaria_data["financiacion_excluida"]) == Decimal("10000.00")
    assert _dec(diaria_data["margen_bruto"]) == Decimal("14440.00")
    assert _dec(diaria_data["articulos"][0]["venta_total"]) == Decimal("24440.00")
    assert _dec(diaria_data["articulos"][0]["financiacion_excluida"]) == Decimal(
        "10000.00"
    )
    assert _dec(diaria_data["articulos"][0]["margen_bruto"]) == Decimal("14440.00")

    caja = client.get(
        "/cajas/resumen-diario",
        params={
            "fecha": "2026-07-04",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert caja.status_code == 200, caja.text
    assert _dec(caja.json()["rentabilidad"]["ventas_total"]) == Decimal("24440.00")
    assert _dec(caja.json()["rentabilidad"]["margen_bruto"]) == Decimal("14440.00")

    dashboard = client.get(
        "/dashboard/resumen",
        params={
            "periodo_mes": "2026-07-01",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert dashboard.status_code == 200, dashboard.text
    dashboard_data = dashboard.json()
    assert _dec(dashboard_data["kpis"]["ventas_mes"]) == Decimal("24440.00")
    assert _dec(dashboard_data["kpis"]["margen_bruto_mes"]) == Decimal("14440.00")


def test_rentabilidad_descuenta_comision_y_muestra_margen_real(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
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
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-04 12:00:00-03',
                estado = 'pagada_total',
                subtotal_base = 24440,
                descuento_total = 0,
                recargo_total = 10000,
                total_final = 34440,
                saldo_pendiente = 0
            WHERE id = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
                porcentaje_costo_financiero_aplicado,
                monto_costo_financiero,
                monto_neto_liquidado,
                estado,
                id_usuario
            )
            VALUES (
                %s, 'venta', %s, 'tarjeta',
                34440, 24440, 0, 10000,
                11.6144, 4000, 30440,
                'confirmado', %s
            )
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
    db_conn.commit()

    mensual = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-07-01"},
    )
    assert mensual.status_code == 200, mensual.text
    mensual_data = mensual.json()
    assert _dec(mensual_data["margen_bruto"]) == Decimal("14440.00")
    assert _dec(mensual_data["financiacion_cobrada"]) == Decimal("10000.00")
    assert _dec(mensual_data["costos_financieros"]) == Decimal("4000.00")
    assert _dec(mensual_data["resultado_financiero"]) == Decimal("6000.00")
    assert _dec(mensual_data["margen_real"]) == Decimal("20440.00")

    diaria = client.get(
        "/rentabilidad/diaria",
        params={
            "fecha": "2026-07-04",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert diaria.status_code == 200, diaria.text
    diaria_data = diaria.json()
    assert _dec(diaria_data["financiacion_cobrada"]) == Decimal("10000.00")
    assert _dec(diaria_data["costos_financieros"]) == Decimal("4000.00")
    assert _dec(diaria_data["margen_real"]) == Decimal("20440.00")
    assert _dec(diaria_data["articulos"][0]["margen_real"]) == Decimal("20440.00")


def test_venta_mixta_usa_neto_tarjeta_congelado_para_margen_real(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
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
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE venta_items
            SET precio_lista = 433333.00,
                precio_final = 433333.00,
                subtotal = 433333.00,
                costo_unitario_aplicado = 267500
            WHERE id_venta = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-04 20:23:39-03',
                estado = 'pagada_total',
                subtotal_base = 433333.00,
                descuento_total = 9999.99,
                recargo_total = 64999.95,
                total_final = 488332.96,
                saldo_pendiente = 0
            WHERE id = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente, origen_tipo, origen_id, medio_pago,
                monto_total_cobrado, monto_base_aplicado,
                monto_descuento_aplicado, monto_recargo_aplicado,
                monto_costo_financiero, monto_neto_liquidado,
                estado, id_usuario
            )
            VALUES (
                %s, 'venta', %s, 'efectivo',
                89999.93, 99999.92, 9999.99, 0,
                0, 89999.93, 'confirmado', %s
            )
            RETURNING id
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
        cur.fetchone()
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente, origen_tipo, origen_id, medio_pago,
                monto_total_cobrado, monto_base_aplicado,
                monto_descuento_aplicado, monto_recargo_aplicado,
                monto_costo_financiero, monto_neto_liquidado,
                estado, id_usuario
            )
            VALUES (
                %s, 'venta', %s, 'tarjeta',
                398333.03, 333333.08, 0, 64999.95,
                78981.03, 319352.00, 'confirmado', %s
            )
            RETURNING id
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
        pago_tarjeta_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO pagos_tarjeta_detalle (
                id_pago,
                monto_base,
                monto_recargo_financiero,
                monto_neto_liquidado,
                cuotas,
                entidad
            )
            VALUES (%s, 333333.08, 64999.95, 333333.08, 6, 'Terminal test')
            """,
            (pago_tarjeta_id,),
        )
    db_conn.commit()

    mensual = client.get(
        "/rentabilidad/mensual",
        params={"periodo_mes": "2026-07-01"},
    )
    assert mensual.status_code == 200, mensual.text
    mensual_data = mensual.json()
    assert _dec(mensual_data["ingreso_real_neto"]) == Decimal("409351.93")
    assert _dec(mensual_data["cmv_neto"]) == Decimal("267500.00")
    assert _dec(mensual_data["costos_financieros"]) == Decimal("78981.03")
    assert _dec(mensual_data["resultado_financiero"]) == Decimal("-13981.08")
    assert _dec(mensual_data["margen_real"]) == Decimal("141851.93")

    diaria = client.get(
        "/rentabilidad/diaria",
        params={
            "fecha": "2026-07-04",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert diaria.status_code == 200, diaria.text
    diaria_data = diaria.json()
    assert _dec(diaria_data["ingreso_real_neto"]) == Decimal("409351.93")
    assert _dec(diaria_data["margen_real"]) == Decimal("141851.93")
    assert _dec(diaria_data["articulos"][0]["margen_real"]) == Decimal(
        "141851.93"
    )

    dashboard = client.get(
        "/dashboard/resumen",
        params={
            "periodo_mes": "2026-07-01",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert dashboard.status_code == 200, dashboard.text
    dashboard_data = dashboard.json()
    assert _dec(dashboard_data["kpis"]["margen_bruto_mes"]) == Decimal(
        "155833.01"
    )
    assert _dec(dashboard_data["kpis"]["margen_real_mes"]) == Decimal(
        "141851.93"
    )


def test_rentabilidad_diaria_incluye_mano_de_obra(
    client,
    db_conn,
    seed_venta_basica,
):
    servicio = client.post(
        "/servicios_taller/",
        json={
            "nombre": _uniq("MANO DE OBRA RENTABILIDAD"),
            "descripcion": "Servicio incluido en resumen diario",
            "precio_sugerido": 15000,
            "duracion_estimada_min": 60,
        },
    )
    assert servicio.status_code == 201, servicio.text

    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "tipo_item": "servicio_taller",
                    "id_servicio_taller": servicio.json()["id"],
                    "cantidad": 1,
                    "precio_unitario_manual": 15000,
                    "motivo_precio_manual": "Precio del servicio",
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-07-04 12:00:00-03',
                estado = 'pagada_total',
                saldo_pendiente = 0
            WHERE id = %s
            """,
            (crear.json()["venta_id"],),
        )
    db_conn.commit()

    response = client.get(
        "/rentabilidad/diaria",
        params={
            "fecha": "2026-07-04",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert len(data["articulos"]) == 1
    servicio_resumen = data["articulos"][0]
    assert servicio_resumen["tipo_item"] == "servicio_taller"
    assert servicio_resumen["id_servicio_taller"] == servicio.json()["id"]
    assert _dec(servicio_resumen["venta_total"]) == Decimal("15000.00")
    assert _dec(servicio_resumen["costo_total"]) == Decimal("0.00")
    assert _dec(servicio_resumen["margen_bruto"]) == Decimal("15000.00")
    assert len(servicio_resumen["detalles"]) == 1
    assert servicio_resumen["detalles"][0]["id_venta"] == crear.json()["venta_id"]


def test_reporte_bonificaciones_muestra_capital_y_resultado(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "precio_unitario_manual": 24440,
                    "motivo_precio_manual": "Precio vigente para test",
                    "bonificado": True,
                    "bonificacion_unitaria_manual": 4440,
                    "motivo_bonificacion": "Garantía local",
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET fecha = '2026-06-15',
                estado = 'pagada_total',
                saldo_pendiente = 0
            WHERE id = %s
            """,
            (venta_id,),
        )
    db_conn.commit()

    response = client.get(
        "/rentabilidad/bonificaciones-garantias",
        params={
            "periodo_mes": "2026-06-01",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["cantidad_operaciones"] == 1
    assert data["cantidad_items"] == 1
    assert data["cantidad_productos"] == 1
    assert data["cantidad_servicios"] == 0
    assert _dec(data["valor_lista"]) == Decimal("24440.00")
    assert _dec(data["valor_bonificado"]) == Decimal("4440.00")
    assert _dec(data["importe_post_bonificacion"]) == Decimal("20000.00")
    assert _dec(data["ingreso_neto_asignado"]) == Decimal("20000.00")
    assert _dec(data["costo_capital"]) == Decimal("10000.00")
    assert _dec(data["resultado_economico"]) == Decimal("10000.00")

    item = data["items"][0]
    assert item["id_venta"] == venta_id
    assert item["motivo_bonificacion"] == "Garantía local"
    assert item["origen"] == "venta"


def test_reporte_bonificaciones_excluye_ventas_creadas(
    client,
    db_conn,
    seed_venta_basica,
):
    crear = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "precio_unitario_manual": 24440,
                    "motivo_precio_manual": "Precio vigente para test",
                    "bonificado": True,
                    "bonificacion_unitaria_manual": 4440,
                    "motivo_bonificacion": "Atención comercial",
                }
            ],
        },
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE ventas SET fecha = '2026-06-15' WHERE id = %s",
            (venta_id,),
        )
    db_conn.commit()

    response = client.get(
        "/rentabilidad/bonificaciones-garantias",
        params={
            "periodo_mes": "2026-06-01",
            "id_sucursal": seed_venta_basica["sucursal_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["cantidad_operaciones"] == 0
    assert data["items"] == []


def test_cierre_rentabilidad_guarda_snapshot_y_no_permite_duplicado(client, seed_venta_basica):
    ale = _crear_participante(client, "Ale cierre")
    angel = _crear_participante(client, "Ángel cierre")
    fondo = _crear_participante(client, "Fondo cierre", "fondo")
    regla = _crear_regla(client, ale["id"], angel["id"], fondo["id"], "Regla cierre snapshot")

    crear = client.post(
        "/rentabilidad/cierres",
        json={
            "periodo_mes": "2026-06-01",
            "id_regla_distribucion": regla["id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "observaciones": "Cierre test",
        },
    )
    assert crear.status_code == 200, crear.text
    cierre_id = crear.json()["cierre_id"]

    detalle = client.get(f"/rentabilidad/cierres/{cierre_id}")
    assert detalle.status_code == 200, detalle.text
    data = detalle.json()
    assert data["id"] == cierre_id
    assert data["periodo_mes"] == "2026-06-01"
    assert data["estado"] == "cerrado"
    assert _dec(data["financiacion_cobrada"]) == Decimal("0.00")
    assert _dec(data["costos_financieros"]) == Decimal("0.00")
    assert _dec(data["resultado_financiero"]) == Decimal("0.00")
    assert _dec(data["margen_real"]) == _dec(data["margen_bruto"])
    assert data["regla_nombre_snapshot"].startswith("Regla cierre snapshot")
    assert len(data["distribuciones"]) == 3

    duplicado = client.post(
        "/rentabilidad/cierres",
        json={
            "periodo_mes": "2026-06-01",
            "id_regla_distribucion": regla["id"],
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert duplicado.status_code == 400
    assert "ya existe" in duplicado.json()["detail"].lower()
