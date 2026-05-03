from decimal import Decimal

from tests.conftest import get_venta, get_caja_movimientos


def _dec(v):
    return Decimal(str(v))


def _get_deuda_por_venta(conn, venta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM deudas_cliente
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (venta_id,),
        )
        return cur.fetchone()


def _get_deuda_movimientos(conn, deuda_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM deuda_movimientos
            WHERE id_deuda = %s
            ORDER BY id
            """,
            (deuda_id,),
        )
        return cur.fetchall()


def test_deuda_pago_parcial_y_pago_total_cierra_deuda_y_mueve_caja(
    client,
    db_conn,
    seed_venta_basica,
):
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200, caja.text
    caja_id = caja.json()["caja_id"]

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
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

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": usuario_id},
    )
    assert entrega.status_code == 200, entrega.text

    venta_entregada = get_venta(db_conn, venta_id)
    assert venta_entregada["estado"] == "entregada"

    deuda = _get_deuda_por_venta(db_conn, venta_id)
    assert deuda is not None
    assert deuda["estado"] == "abierta"
    assert _dec(deuda["saldo_actual"]) == Decimal("24440")

    pago_parcial = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": 10000,
            "medio_pago": "efectivo",
            "nota": "Pago parcial deuda master",
            "id_usuario": usuario_id,
        },
    )
    assert pago_parcial.status_code == 200, pago_parcial.text

    deuda_parcial = _get_deuda_por_venta(db_conn, venta_id)
    assert deuda_parcial["estado"] == "abierta"
    assert _dec(deuda_parcial["saldo_actual"]) == Decimal("14440")

    pago_total = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": 14440,
            "medio_pago": "efectivo",
            "nota": "Cancela deuda master",
            "id_usuario": usuario_id,
        },
    )
    assert pago_total.status_code == 200, pago_total.text

    deuda_final = _get_deuda_por_venta(db_conn, venta_id)
    assert deuda_final["estado"] == "cerrada"
    assert _dec(deuda_final["saldo_actual"]) == Decimal("0")

    movimientos_deuda = _get_deuda_movimientos(db_conn, deuda["id"])
    tipos = [m["tipo_movimiento"] for m in movimientos_deuda]

    assert tipos == ["cargo", "pago", "pago"]

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "ingreso"
        and m["submedio"] == "efectivo"
    ]

    montos = sorted(_dec(m["monto"]) for m in ingresos)
    assert montos == [Decimal("10000"), Decimal("14440")]