from decimal import Decimal

from tests.conftest import get_caja_movimientos, get_venta


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _abrir_caja(client, seed_venta_basica):
    response = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["caja_id"]


def _get_pago(db_conn, venta_id: int):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM pagos
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (venta_id,),
        )
        return cur.fetchone()


def _get_reglas_aplicadas(db_conn, venta_id: int):
    with db_conn.cursor() as cur:
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


def _crear_venta_tarjeta_3_cuotas(client, seed_venta_basica):
    response = client.post(
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
            "pagos": [
                {
                    "medio_pago": "tarjeta",
                    "monto_base": "24440.00",
                    "cuotas": 3,
                    "entidad": None,
                    "nota": "Pago tarjeta 3 cuotas",
                }
            ],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


def test_venta_tarjeta_3_cuotas_registra_recargo_pago_y_caja(
    client,
    db_conn,
    seed_venta_basica,
):
    caja_id = _abrir_caja(client, seed_venta_basica)

    venta_id = _crear_venta_tarjeta_3_cuotas(client, seed_venta_basica)

    venta = get_venta(db_conn, venta_id)

    assert _dec(venta["subtotal_base"]) == Decimal("24440.00")
    assert _dec(venta["descuento_total"]) == Decimal("0.00")
    assert _dec(venta["recargo_total"]) == Decimal("3666.00")
    assert _dec(venta["total_final"]) == Decimal("28106.00")
    assert _dec(venta["saldo_pendiente"]) == Decimal("0.00")
    assert venta["estado"] == "pagada_total"

    pago = _get_pago(db_conn, venta_id)

    assert pago is not None
    assert pago["medio_pago"] == "tarjeta"
    assert _dec(pago["monto_total_cobrado"]) == Decimal("28106.00")
    assert pago["estado"] == "confirmado"

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)

    ingresos_tarjeta = [
        movimiento
        for movimiento in movimientos_caja
        if movimiento["tipo_movimiento"] == "ingreso"
        and movimiento["submedio"] == "tarjeta"
        and movimiento["origen_tipo"] == "pago"
        and movimiento["origen_id"] == pago["id"]
    ]

    assert len(ingresos_tarjeta) == 1
    assert _dec(ingresos_tarjeta[0]["monto"]) == Decimal("28106.00")

    reglas = _get_reglas_aplicadas(db_conn, venta_id)

    recargos = [regla for regla in reglas if regla["tipo"] == "recargo"]

    assert len(recargos) == 1
    assert recargos[0]["descripcion_snapshot"] == "Tarjeta 3 cuotas"
    assert _dec(recargos[0]["monto_aplicado"]) == Decimal("3666.00")
    assert _dec(recargos[0]["porcentaje_aplicado"]) == Decimal("15.0000")


def test_simular_venta_tarjeta_3_cuotas_usa_plan_activo(
    client,
    seed_venta_basica,
):
    response = client.post(
        "/ventas/simular",
        json={
            "tipo_precio": "minorista",
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                }
            ],
            "pagos": [],
            "sugerir_saldo_con_medio_pago": {
                "medio_pago": "tarjeta",
                "cuotas": 3,
                "entidad": None,
            },
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert _dec(data["subtotal_base"]) == Decimal("24440.00")
    assert _dec(data["monto_sugerido_para_saldar"]) == Decimal("28106.00")