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
