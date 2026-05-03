from decimal import Decimal

from tests.conftest import (
    get_auditoria_by_entidad,
    get_caja_movimientos,
    get_deuda_movimientos,
    get_deudas_by_cliente,
    get_movimientos_by_venta,
    get_stock_row,
    get_venta,
)

from app.shared.constants import AUDITORIA_ENTIDAD_VENTA


def _dec(value) -> Decimal:
    return Decimal(str(value))


def test_circuito_venta_parcial_entrega_deuda_pago_deuda_caja_stock_auditoria(
    client,
    db_conn,
    seed_venta_basica,
):
    # 1. Crear venta
    venta_response = client.post(
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
    assert venta_response.status_code == 200, venta_response.text
    venta_id = venta_response.json()["venta_id"]

    # 2. Verificar stock reservado/pendiente luego de venta
    stock_post_venta = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_venta["stock_fisico"]) == Decimal("6")
    assert _dec(stock_post_venta["stock_vendido_pendiente_entrega"]) == Decimal("1")

    # 3. Abrir caja
    caja_response = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert caja_response.status_code == 200, caja_response.text
    caja_id = caja_response.json()["caja_id"]

    # 4. Pago parcial de venta
    pago_parcial_response = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago parcial circuito e2e",
        },
    )
    assert pago_parcial_response.status_code == 200, pago_parcial_response.text

    venta_post_pago = get_venta(db_conn, venta_id)
    assert venta_post_pago["estado"] == "pagada_parcial"
    assert _dec(venta_post_pago["saldo_pendiente"]) == Decimal("14440")

    # 5. Entregar con deuda autorizada
    entrega_response = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega_response.status_code == 200, entrega_response.text

    venta_entregada = get_venta(db_conn, venta_id)
    assert venta_entregada["estado"] == "entregada"
    assert _dec(venta_entregada["saldo_pendiente"]) == Decimal("14440")

    # 6. Stock físico baja recién en entrega
    stock_post_entrega = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_entrega["stock_fisico"]) == Decimal("5")
    assert _dec(stock_post_entrega["stock_vendido_pendiente_entrega"]) == Decimal("0")

    movimientos_stock = get_movimientos_by_venta(db_conn, venta_id)
    assert [m["tipo_movimiento"] for m in movimientos_stock] == ["venta", "entrega"]

    # 7. Se genera deuda formal
    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(deudas) == 1

    deuda = deudas[0]
    assert deuda["origen_tipo"] == "venta"
    assert deuda["origen_id"] == venta_id
    assert deuda["estado"] == "abierta"
    assert _dec(deuda["saldo_actual"]) == Decimal("14440")

    movimientos_deuda = get_deuda_movimientos(db_conn, deuda["id"])
    assert len(movimientos_deuda) >= 1
    assert movimientos_deuda[0]["tipo_movimiento"] == "cargo"
    assert _dec(movimientos_deuda[0]["monto"]) == Decimal("14440")

    # 8. Pagar deuda completa
    pago_deuda_response = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": 14440,
            "medio_pago": "efectivo",
            "nota": "Cancela deuda circuito e2e",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_deuda_response.status_code == 200, pago_deuda_response.text

    deudas_finales = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda_final = next(d for d in deudas_finales if d["id"] == deuda["id"])

    assert deuda_final["estado"] == "cerrada"
    assert _dec(deuda_final["saldo_actual"]) == Decimal("0")

    # 9. La venta queda histórica: entregada, no se reescribe como pagada_total
    venta_final = get_venta(db_conn, venta_id)
    assert venta_final["estado"] == "entregada"
    assert _dec(venta_final["saldo_pendiente"]) == Decimal("14440")

    # 10. Caja debe tener ingreso por pago de venta y por pago de deuda
    movimientos_caja = get_caja_movimientos(db_conn, caja_id)

    ingresos_efectivo = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "ingreso"
        and m["submedio"] == "efectivo"
    ]

    assert len(ingresos_efectivo) == 2

    montos = sorted(_dec(m["monto"]) for m in ingresos_efectivo)
    assert montos == [Decimal("10000"), Decimal("14440")]

    # 11. Auditoría mínima de venta
    auditorias = get_auditoria_by_entidad(
        db_conn,
        AUDITORIA_ENTIDAD_VENTA,
        venta_id,
    )
    acciones = [a["accion"] for a in auditorias]

    assert "venta_creada" in acciones
    assert any("entrega" in accion for accion in acciones)