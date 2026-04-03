from tests.conftest import get_stock_row, get_auditoria_by_entidad


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