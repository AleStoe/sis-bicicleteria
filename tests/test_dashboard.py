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
