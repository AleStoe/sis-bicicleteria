from decimal import Decimal
from tests.conftest import get_caja_movimientos, get_deuda_movimientos, get_auditoria_by_entidad

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


def test_no_permite_pagar_mas_que_saldo_de_deuda(
    client,
    db_conn,
    seed_venta_basica,
):
    usuario_id = seed_venta_basica["usuario_id"]

    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
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
            "id_sucursal": seed_venta_basica["sucursal_id"],
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

    deuda = _get_deuda_por_venta(db_conn, venta_id)
    assert deuda is not None
    assert _dec(deuda["saldo_actual"]) == Decimal("24440")

    deuda_antes = _get_deuda_por_venta(db_conn, venta_id)
    movimientos_deuda_antes = get_deuda_movimientos(db_conn, deuda["id"])
    movimientos_caja_antes = get_caja_movimientos(db_conn, caja_id)
    auditoria_antes = get_auditoria_by_entidad(db_conn, "deuda", deuda["id"])

    pago = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": 999999,
            "medio_pago": "efectivo",
            "nota": "Pago excedido deuda",
            "id_usuario": usuario_id,
        },
    )

    assert pago.status_code == 400

    deuda_despues = _get_deuda_por_venta(db_conn, venta_id)
    movimientos_deuda_despues = get_deuda_movimientos(db_conn, deuda["id"])
    movimientos_caja_despues = get_caja_movimientos(db_conn, caja_id)
    auditoria_despues = get_auditoria_by_entidad(db_conn, "deuda", deuda["id"])

    assert deuda_despues["estado"] == deuda_antes["estado"]
    assert deuda_despues["saldo_actual"] == deuda_antes["saldo_actual"]

    assert movimientos_deuda_despues == movimientos_deuda_antes
    assert movimientos_caja_despues == movimientos_caja_antes
    assert auditoria_despues == auditoria_antes


def test_no_permite_pagar_deuda_cerrada(
    client,
    db_conn,
    seed_venta_basica,
):
    usuario_id = seed_venta_basica["usuario_id"]

    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
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
            "id_sucursal": seed_venta_basica["sucursal_id"],
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

    deuda = _get_deuda_por_venta(db_conn, venta_id)

    pago_total = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": str(deuda["saldo_actual"]),
            "medio_pago": "efectivo",
            "nota": "Cierra deuda",
            "id_usuario": usuario_id,
        },
    )
    assert pago_total.status_code == 200, pago_total.text

    deuda_antes = _get_deuda_por_venta(db_conn, venta_id)
    movimientos_deuda_antes = get_deuda_movimientos(db_conn, deuda["id"])
    movimientos_caja_antes = get_caja_movimientos(db_conn, caja_id)
    auditoria_antes = get_auditoria_by_entidad(db_conn, "deuda", deuda["id"])

    assert deuda_antes["estado"] == "cerrada"
    assert _dec(deuda_antes["saldo_actual"]) == Decimal("0")

    pago_extra = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": 1,
            "medio_pago": "efectivo",
            "nota": "Pago extra indebido",
            "id_usuario": usuario_id,
        },
    )

    assert pago_extra.status_code == 400

    deuda_despues = _get_deuda_por_venta(db_conn, venta_id)
    movimientos_deuda_despues = get_deuda_movimientos(db_conn, deuda["id"])
    movimientos_caja_despues = get_caja_movimientos(db_conn, caja_id)
    auditoria_despues = get_auditoria_by_entidad(db_conn, "deuda", deuda["id"])

    assert deuda_despues["estado"] == deuda_antes["estado"]
    assert deuda_despues["saldo_actual"] == deuda_antes["saldo_actual"]

    assert movimientos_deuda_despues == movimientos_deuda_antes
    assert movimientos_caja_despues == movimientos_caja_antes
    assert auditoria_despues == auditoria_antes