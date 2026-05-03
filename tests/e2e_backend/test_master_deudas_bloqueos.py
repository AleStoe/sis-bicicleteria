from decimal import Decimal


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

    deuda_final = _get_deuda_por_venta(db_conn, venta_id)
    assert deuda_final["estado"] == "abierta"
    assert _dec(deuda_final["saldo_actual"]) == Decimal("24440")


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