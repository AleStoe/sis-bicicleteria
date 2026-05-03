from decimal import Decimal

from tests.conftest import get_reserva, get_stock_row


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _crear_reserva(client, seed_venta_basica, cantidad=1):
    response = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": cantidad,
                    "precio_estimado": 24440,
                }
            ],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["reserva_id"]


def test_cancelar_reserva_libera_stock_reservado(
    client,
    db_conn,
    seed_venta_basica,
):
    reserva_id = _crear_reserva(client, seed_venta_basica)

    stock_post_reserva = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_reserva["stock_reservado"]) == Decimal("1")

    cancelar = client.patch(
        f"/reservas/{reserva_id}/cancelar",
        json={
            "motivo": "Cliente cancela reserva",
            "sena_perdida": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert cancelar.status_code == 200, cancelar.text

    reserva = get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "cancelada"

    stock_post_cancelacion = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock_post_cancelacion["stock_reservado"]) == Decimal("0")
    assert _dec(stock_post_cancelacion["stock_fisico"]) == Decimal("6")


def test_no_permite_convertir_reserva_cancelada_en_venta(
    client,
    db_conn,
    seed_venta_basica,
):
    reserva_id = _crear_reserva(client, seed_venta_basica)

    cancelar = client.patch(
        f"/reservas/{reserva_id}/cancelar",
        json={
            "motivo": "Cliente cancela reserva",
            "sena_perdida": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert cancelar.status_code == 200, cancelar.text

    convertir = client.post(
        f"/reservas/{reserva_id}/convertir-a-venta",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert convertir.status_code == 400

    reserva = get_reserva(db_conn, reserva_id)
    assert reserva["estado"] == "cancelada"


def test_no_permite_reservar_mas_stock_del_disponible(
    client,
    db_conn,
    seed_venta_basica,
):
    response = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 999,
                    "precio_estimado": 24440,
                }
            ],
        },
    )

    assert response.status_code == 400

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert _dec(stock["stock_fisico"]) == Decimal("6")
    assert _dec(stock["stock_reservado"]) == Decimal("0")