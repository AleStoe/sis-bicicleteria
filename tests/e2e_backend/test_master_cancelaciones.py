from decimal import Decimal
from tests.conftest import get_reserva, get_caja_movimientos


def _dec(v):
    return Decimal(str(v))


def test_cancelar_reserva_con_sena_genera_credito(client, db_conn, seed_venta_basica):
    sucursal_id = seed_venta_basica["sucursal_id"]
    usuario_id = seed_venta_basica["usuario_id"]

    # abrir caja
    caja = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )
    assert caja.status_code == 200
    caja_id = caja.json()["caja_id"]

    # crear reserva con seña
    r = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "pago_inicial": {
                "registrar": True,
                "medio_pago": "efectivo",
                "monto": 5000,
            },
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "precio_estimado": 24440,
                }
            ],
        },
    )
    assert r.status_code == 200
    reserva_id = r.json()["reserva_id"]

    # cancelar reserva
    cancelar = client.patch(
        f"/reservas/{reserva_id}/cancelar",
        json={
            "motivo": "cliente cancela",
            "sena_perdida": False,
            "id_usuario": usuario_id,
        },
    )
    assert cancelar.status_code == 200

    reserva = get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "cancelada"

    # validar que NO haya egreso en caja (no devolviste cash)
    movimientos = get_caja_movimientos(db_conn, caja_id)

    egresos = [m for m in movimientos if m["tipo_movimiento"] == "egreso"]
    assert egresos == []