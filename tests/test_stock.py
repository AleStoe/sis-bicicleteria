from decimal import Decimal
from datetime import date

from tests.conftest import get_stock_row, get_auditoria_by_entidad, get_movimientos_by_venta


def _sumar_meses_test(value: date, delta: int) -> date:
    month = value.month - 1 + delta
    year = value.year + month // 12
    month = month % 12 + 1
    return date(year, month, 10)


def _payload_ajuste(
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    nota: str,
):
    return {
        "id_sucursal": id_sucursal,
        "id_variante": id_variante,
        "cantidad": cantidad,
        "nota": nota,
        "id_usuario": id_usuario,
    }


def test_ajuste_stock_positivo_suma_fisico(client, db_conn, seed_venta_basica):
    response = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=3,
            id_usuario=seed_venta_basica["usuario_id"],
            nota="ajuste positivo por conteo",
        ),
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["tipo_movimiento"] == "ajuste"
    assert float(data["cantidad"]) == 3.0
    assert float(data["stock_fisico_anterior"]) == 6.0
    assert float(data["stock_fisico_nuevo"]) == 9.0

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 9.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_analisis_demanda_devuelve_historial_mensual_y_stock(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_1 = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [{"id_variante": seed_venta_basica["variante_id"], "cantidad": 2}],
        },
    )
    assert venta_1.status_code == 200, venta_1.text
    venta_2 = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [{"id_variante": seed_venta_basica["variante_id"], "cantidad": 1}],
        },
    )
    assert venta_2.status_code == 200, venta_2.text
    mes_actual = date.today().replace(day=10)
    mes_anterior = _sumar_meses_test(mes_actual, -1)
    mes_actual_label = mes_actual.strftime("%Y-%m")
    mes_anterior_label = mes_anterior.strftime("%Y-%m")

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET estado = 'pagada_total',
                saldo_pendiente = 0,
                fecha = CASE
                    WHEN id = %s THEN %s::timestamp
                    ELSE %s::timestamp
                END
            WHERE id = ANY(%s)
            """,
            (
                venta_1.json()["venta_id"],
                f"{mes_anterior.isoformat()} 10:00:00",
                f"{mes_actual.isoformat()} 10:00:00",
                [venta_1.json()["venta_id"], venta_2.json()["venta_id"]],
            ),
        )
    db_conn.commit()

    response = client.get(
        "/stock/demanda",
        params={
            "q": "zefal",
            "meses": 3,
            "limit": 10,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["total_items"] == 1
    item = data["items"][0]
    assert item["variante_id"] == seed_venta_basica["variante_id"]
    assert Decimal(str(item["unidades_vendidas"])) == Decimal("3.000")
    assert Decimal(str(item["stock_fisico"])) == Decimal("6.000")
    assert len(item["meses"]) == 3

    ventas_por_mes = {
        mes["etiqueta"]: Decimal(str(mes["unidades_vendidas"]))
        for mes in item["meses"]
    }
    assert ventas_por_mes[mes_anterior_label] == Decimal("2.000")
    assert ventas_por_mes[mes_actual_label] == Decimal("1.000")


def test_ajuste_stock_negativo_resta_fisico(client, db_conn, seed_venta_basica):
    response = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=-2,
            id_usuario=seed_venta_basica["usuario_id"],
            nota="faltante detectado",
        ),
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["tipo_movimiento"] == "ajuste"
    assert float(data["cantidad"]) == 2.0
    assert float(data["stock_fisico_anterior"]) == 6.0
    assert float(data["stock_fisico_nuevo"]) == 4.0

    stock = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock["stock_fisico"]) == 4.0
    assert float(stock["stock_reservado"]) == 0.0
    assert float(stock["stock_vendido_pendiente_entrega"]) == 0.0


def test_ajuste_stock_no_permite_dejar_fisico_negativo(client, db_conn, seed_venta_basica):
    stock_antes = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    response = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=-7,
            id_usuario=seed_venta_basica["usuario_id"],
            nota="ajuste invalido",
        ),
    )

    assert response.status_code == 400
    assert "stock físico" in response.json()["detail"].lower()

    stock_despues = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    assert float(stock_antes["stock_fisico"]) == float(stock_despues["stock_fisico"])
    assert float(stock_despues["stock_fisico"]) == 6.0


def test_ajuste_stock_requiere_motivo(client, seed_venta_basica):
    response = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=1,
            id_usuario=seed_venta_basica["usuario_id"],
            nota="",
        ),
    )

    assert response.status_code == 400
    assert "requiere motivo" in response.json()["detail"].lower()


def test_ajuste_stock_no_permite_cantidad_cero(client, seed_venta_basica):
    response = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=0,
            id_usuario=seed_venta_basica["usuario_id"],
            nota="cantidad cero",
        ),
    )

    assert response.status_code in (400, 422)

def test_ajuste_stock_crea_auditoria(client, db_conn, seed_venta_basica):
    response = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=2,
            id_usuario=seed_venta_basica["usuario_id"],
            nota="ajuste con auditoria",
        ),
    )

    assert response.status_code == 200, response.text

    eventos = get_auditoria_by_entidad(
        db_conn,
        "stock",
        seed_venta_basica["variante_id"],
    )

    assert len(eventos) == 1
    assert eventos[0]["accion"] == "ajuste_stock"
    assert eventos[0]["id_usuario"] == seed_venta_basica["usuario_id"]
    assert eventos[0]["id_sucursal"] == seed_venta_basica["sucursal_id"]
    assert "ajuste con auditoria" in eventos[0]["detalle"]

def test_no_permite_venta_con_stock_insuficiente(client, db_conn, seed_venta_basica):
    # Ajustar stock a 10 usando el sistema real
    response = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=4,  # 6 → 10
            id_usuario=seed_venta_basica["usuario_id"],
            nota="ajuste inicial test",
        ),
    )
    assert response.status_code == 200

    # Primera venta (8 unidades)
    response1 = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["producto_id"],
                    "cantidad": 8,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert response1.status_code == 200

    # Segunda venta (5 unidades → debería fallar)
    response2 = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["producto_id"],
                    "cantidad": 5,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )

    assert response2.status_code == 400

def test_anulacion_venta_libera_stock_pendiente_y_perm_mite_nueva_venta(client, db_conn, seed_venta_basica):
    # Ajustar stock a 10 usando el sistema real
    ajuste = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=4,  # 6 → 10
            id_usuario=seed_venta_basica["usuario_id"],
            nota="ajuste inicial test anulacion",
        ),
    )
    assert ajuste.status_code == 200, ajuste.text

    # Venta de 8 unidades: deja 8 pendientes de entrega
    venta_1 = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 8,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta_1.status_code == 200, venta_1.text
    venta_id = venta_1.json()["venta_id"]

    stock_despues_venta = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock_despues_venta["stock_fisico"]) == 10.0
    assert float(stock_despues_venta["stock_vendido_pendiente_entrega"]) == 8.0

    # Anular venta: libera pendiente
    anulacion = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "Anulación test stock",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anulacion.status_code == 200, anulacion.text

    stock_despues_anulacion = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )
    assert float(stock_despues_anulacion["stock_fisico"]) == 10.0
    assert float(stock_despues_anulacion["stock_vendido_pendiente_entrega"]) == 0.0

    # Nueva venta de 10 debería pasar porque el pendiente fue liberado
    venta_2 = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 10,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta_2.status_code == 200, venta_2.text

def test_venta_crea_movimiento_stock_tipo_venta(client, db_conn, seed_venta_basica):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 2,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    movimientos = get_movimientos_by_venta(db_conn, venta_id)

    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "venta"
    assert movimientos[0]["origen_tipo"] == "venta"
    assert movimientos[0]["origen_id"] == venta_id
    assert float(movimientos[0]["cantidad"]) == 2.0

def test_anulacion_crea_movimiento_stock_cancelacion_venta(client, db_conn, seed_venta_basica):
    # Venta
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 3,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    # Anulación
    anulacion = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "test cancelacion stock",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anulacion.status_code == 200, anulacion.text

    movimientos = get_movimientos_by_venta(db_conn, venta_id)

    tipos = {m["tipo_movimiento"] for m in movimientos}

    assert "venta" in tipos
    assert "cancelacion_venta" in tipos

    cancelaciones = [m for m in movimientos if m["tipo_movimiento"] == "cancelacion_venta"]
    assert len(cancelaciones) == 1
    assert float(cancelaciones[0]["cantidad"]) == 3.0

def test_entrega_venta_mueve_stock_de_pendiente_a_fisico(client, db_conn, seed_venta_basica):
    # Ajustar stock a 10
    ajuste = client.post(
        "/stock/ajustes",
        json=_payload_ajuste(
            id_sucursal=seed_venta_basica["sucursal_id"],
            id_variante=seed_venta_basica["variante_id"],
            cantidad=4,  # 6 → 10
            id_usuario=seed_venta_basica["usuario_id"],
            nota="ajuste inicial test entrega",
        ),
    )
    assert ajuste.status_code == 200

    # Crear venta (queda pendiente entrega)
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 5,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200
    venta_id = venta.json()["venta_id"]

    stock_post_venta = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    assert float(stock_post_venta["stock_fisico"]) == 10.0
    assert float(stock_post_venta["stock_vendido_pendiente_entrega"]) == 5.0

    # 👉 ENTREGA
    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert entrega.status_code == 200, entrega.text

    stock_post_entrega = get_stock_row(
        db_conn,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["variante_id"],
    )

    assert float(stock_post_entrega["stock_fisico"]) == 5.0
    assert float(stock_post_entrega["stock_vendido_pendiente_entrega"]) == 0.0

def test_entrega_crea_movimiento_stock_tipo_entrega(client, db_conn, seed_venta_basica):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 4,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200
    venta_id = venta.json()["venta_id"]

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    movimientos = get_movimientos_by_venta(db_conn, venta_id)

    tipos = {m["tipo_movimiento"] for m in movimientos}

    assert "venta" in tipos
    assert "entrega" in tipos

    entregas = [m for m in movimientos if m["tipo_movimiento"] == "entrega"]
    assert len(entregas) == 1
    assert float(entregas[0]["cantidad"]) == 4.0
