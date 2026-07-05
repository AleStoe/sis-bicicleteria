from datetime import date
from decimal import Decimal

from app.core.auth import crear_token_usuario
from app.core.config import settings


def _dec(value):
    return Decimal(str(value))


def _crear_venta_dashboard(client, seed_venta_basica):
    response = client.post(
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
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def test_dashboard_resumen_devuelve_estructura(client, seed_venta_basica):
    response = client.get(
        "/dashboard/resumen",
        params={
            "periodo_mes": "2026-06-01",
            "dias_sin_movimiento": 90,
            "umbral_repuestos_criticos": 2,
            "limit": 5,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["periodo_mes"] == "2026-06-01"
    assert data["fecha_desde"] == "2026-06-01"
    assert data["fecha_hasta"] == "2026-06-30"

    assert "kpis" in data
    assert "caja" in data
    assert "ventas_ultimos_meses" in data
    assert "top_clientes" in data
    assert "top_productos_cantidad" in data
    assert "repuestos_criticos" in data
    assert "productos_sin_movimiento" in data
    assert "capital_inmovilizado" in data
    assert "taller_pendiente" in data
    assert "ventas_pendientes_entrega" in data
    assert "alertas_operativas" in data
    assert "resultado_hoy" in data
    assert "stock_bajo" not in data
    assert "reservas_activas" not in data

    assert len(data["ventas_ultimos_meses"]) == 6

    kpis = data["kpis"]
    for key in [
        "ventas_mes",
        "gastos_mes",
        "resultado_estimado",
        "margen_bruto_mes",
        "margen_bruto_porcentaje",
        "margen_real_mes",
        "margen_real_porcentaje",
        "cantidad_ventas_mes",
        "ticket_promedio_mes",
        "caja_actual",
        "deudas_abiertas",
        "creditos_abiertos",
        "ventas_pendientes_entrega",
        "taller_pendiente",
        "repuestos_criticos",
        "productos_sin_movimiento",
    ]:
        assert key in kpis

    assert isinstance(data["alertas_operativas"], list)

    resultado_hoy = data["resultado_hoy"]
    for key in [
        "fecha",
        "ventas_total",
        "cantidad_ventas",
        "ventas_items_total",
        "cmv",
        "margen_bruto",
        "financiacion_cobrada",
        "costos_financieros",
        "resultado_financiero",
        "margen_real",
        "gastos_operativos",
        "resultado_estimado",
    ]:
        assert key in resultado_hoy


def test_dashboard_parametros_invalidos(client, seed_venta_basica):
    response = client.get(
        "/dashboard/resumen",
        params={"dias_sin_movimiento": 0},
    )

    assert response.status_code == 422


def test_dashboard_excluye_creada_y_usa_total_final_para_resultados(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_id = _crear_venta_dashboard(client, seed_venta_basica)
    periodo = date.today().replace(day=1).isoformat()

    creada = client.get(
        "/dashboard/resumen",
        params={"periodo_mes": periodo},
    )
    assert creada.status_code == 200, creada.text
    assert _dec(creada.json()["kpis"]["ventas_mes"]) == Decimal("0")
    assert _dec(creada.json()["resultado_hoy"]["ventas_total"]) == Decimal("0")

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET estado = 'pagada_total',
                subtotal_base = 24440,
                descuento_total = 2440,
                recargo_total = 0,
                total_final = 22000,
                saldo_pendiente = 0,
                fecha = NOW()
            WHERE id = %s
            """,
            (venta_id,),
        )
    db_conn.commit()

    response = client.get(
        "/dashboard/resumen",
        params={"periodo_mes": periodo},
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert _dec(data["kpis"]["ventas_mes"]) == Decimal("22000.00")
    assert _dec(data["kpis"]["margen_bruto_mes"]) == Decimal("12000.00")
    assert _dec(data["kpis"]["resultado_estimado"]) == Decimal("12000.00")
    assert _dec(data["kpis"]["ticket_promedio_mes"]) == Decimal("22000.00")
    assert data["kpis"]["cantidad_ventas_mes"] == 1

    assert _dec(data["resultado_hoy"]["ventas_total"]) == Decimal("22000.00")
    assert _dec(data["resultado_hoy"]["margen_bruto"]) == Decimal("12000.00")
    assert _dec(data["resultado_hoy"]["resultado_estimado"]) == Decimal("12000.00")
    assert _dec(data["ventas_ultimos_meses"][-1]["ventas_total"]) == Decimal("22000.00")
    assert _dec(data["top_clientes"][0]["total_comprado"]) == Decimal("22000.00")
    assert _dec(data["top_productos_cantidad"][0]["venta_total"]) == Decimal("22000.00")


def test_dashboard_reutiliza_alerta_caja_anterior(
    client,
    db_conn,
    seed_venta_basica,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cajas (
                fecha,
                id_sucursal,
                estado,
                monto_apertura,
                id_usuario_apertura
            )
            VALUES (CURRENT_DATE - 1, %s, 'abierta', 0, %s)
            """,
            (
                seed_venta_basica["sucursal_id"],
                seed_venta_basica["usuario_id"],
            ),
        )
    db_conn.commit()

    response = client.get("/dashboard/resumen")
    assert response.status_code == 200, response.text
    tipos = {alerta["tipo"] for alerta in response.json()["alertas_operativas"]}
    assert "cajas_abiertas_anteriores" in tipos


def test_dashboard_backend_restringe_metricas_a_administrador(
    client,
    db_conn,
    seed_venta_basica,
    monkeypatch,
):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Operador Dashboard', 'operador_dashboard', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        operador_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO usuario_roles (id_usuario, id_rol)
            SELECT %s, id
            FROM roles
            WHERE nombre = 'operador'
            """,
            (operador_id,),
        )
    db_conn.commit()

    admin_token = crear_token_usuario(
        {
            "id": seed_venta_basica["usuario_id"],
            "username": "admin_test",
            "rol": "administrador",
        }
    )
    operador_token = crear_token_usuario(
        {
            "id": operador_id,
            "username": "operador_dashboard",
            "rol": "operador",
        }
    )

    monkeypatch.setattr(settings, "auth_disabled", False)

    admin = client.get(
        "/dashboard/resumen",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin.status_code == 200, admin.text

    operador = client.get(
        "/dashboard/resumen",
        headers={"Authorization": f"Bearer {operador_token}"},
    )
    assert operador.status_code == 403
    assert "ver_rentabilidad" in operador.json()["detail"]
