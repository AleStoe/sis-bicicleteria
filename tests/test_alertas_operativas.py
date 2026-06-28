from decimal import Decimal

from tests.test_deudas import (
    _crear_deuda_automatica_por_entrega,
    _crear_venta_basica,
)


def test_alertas_operativas_expone_salud_operativa(client, clean_db):
    response = client.get("/alertas-operativas/")

    assert response.status_code == 200, response.text
    data = response.json()
    expected_keys = {
        "bicis_listas",
        "reservas_vencidas",
        "deudas_vencidas",
        "taller_atrasado",
        "stock_critico",
        "ventas_cobradas_no_entregadas",
        "ventas_saldo_sin_deuda",
        "ventas_saldo_desincronizado",
        "pagos_revertidos_hoy",
        "cajas_abiertas_anteriores",
        "productos_maestros_incompletos",
        "maestros_inactivos_en_uso",
    }

    for key in expected_keys:
        assert key in data
        assert isinstance(data[key], list)
        assert key in data["resumen"]
        assert data["resumen"][key] == len(data[key])


def test_salud_operativa_sincroniza_venta_con_deuda_formal(
    client,
    db_conn,
    seed_venta_basica,
):
    contexto = _crear_deuda_automatica_por_entrega(
        client,
        db_conn,
        seed_venta_basica,
    )
    venta_id = contexto["venta_id"]
    deuda_id = contexto["deuda_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE deudas_cliente
            SET saldo_actual = 0,
                estado = 'cerrada'
            WHERE id = %s
            """,
            (deuda_id,),
        )
    db_conn.commit()

    alertas = client.get("/alertas-operativas/")
    assert alertas.status_code == 200, alertas.text
    data = alertas.json()
    desincronizadas = data["ventas_saldo_desincronizado"]
    assert any(item["id"] == venta_id for item in desincronizadas)
    assert all(item["id"] != venta_id for item in data["ventas_saldo_sin_deuda"])

    sincronizar = client.post(
        f"/alertas-operativas/ventas/{venta_id}/sincronizar-deuda",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert sincronizar.status_code == 200, sincronizar.text
    assert Decimal(str(sincronizar.json()["saldo_pendiente"])) == Decimal("0")

    venta = db_conn.execute(
        "SELECT saldo_pendiente FROM ventas WHERE id = %s",
        (venta_id,),
    ).fetchone()
    assert Decimal(str(venta["saldo_pendiente"])) == Decimal("0")

    alertas_finales = client.get("/alertas-operativas/").json()
    assert all(
        item["id"] != venta_id
        for item in alertas_finales["ventas_saldo_desincronizado"]
    )


def test_venta_creada_con_saldo_no_es_alerta_sin_deuda(
    client,
    seed_venta_basica,
):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    data = client.get("/alertas-operativas/").json()

    assert all(
        item["id"] != venta_id
        for item in data["ventas_saldo_sin_deuda"]
    )
