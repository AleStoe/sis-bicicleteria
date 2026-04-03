from decimal import Decimal

from tests.conftest import (
    get_caja,
    get_caja_movimientos,
    get_auditoria_by_entidad,
)


def _abrir_caja_payload(seed_venta_basica, monto_apertura=0):
    return {
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "monto_apertura": monto_apertura,
    }


def _cerrar_caja_payload(seed_venta_basica, monto_cierre_real):
    return {
        "id_usuario": seed_venta_basica["usuario_id"],
        "monto_cierre_real": monto_cierre_real,
    }


def _egreso_payload(seed_venta_basica, monto, nota="egreso test"):
    return {
        "monto": monto,
        "nota": nota,
        "id_usuario": seed_venta_basica["usuario_id"],
    }


def _ajuste_payload(seed_venta_basica, monto, direccion, nota="ajuste test"):
    return {
        "monto": monto,
        "direccion": direccion,
        "nota": nota,
        "id_usuario": seed_venta_basica["usuario_id"],
    }


def test_abre_caja_correctamente(client, db_conn, seed_venta_basica):
    response = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["estado"] == "abierta"

    caja = get_caja(db_conn, data["caja_id"])
    assert caja["estado"] == "abierta"
    assert float(caja["monto_apertura"]) == 1000.0


def test_no_permite_doble_caja_abierta_mismo_dia(client, seed_venta_basica):
    abrir_1 = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=0),
    )
    assert abrir_1.status_code == 200

    abrir_2 = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=0),
    )

    assert abrir_2.status_code == 400
    assert "ya hay una caja abierta" in abrir_2.json()["detail"].lower()


def test_obtiene_resumen_de_caja_abierta(client, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=500),
    )
    assert abrir.status_code == 200

    response = client.get(
        f"/cajas/abierta?id_sucursal={seed_venta_basica['sucursal_id']}"
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["caja"]["estado"] == "abierta"
    assert float(data["efectivo_teorico"]) == 500.0
    assert float(data["totales_por_submedio"]["efectivo"]) == 0.0


def test_registra_egreso_en_caja_abierta(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/egresos",
        json=_egreso_payload(seed_venta_basica, monto=200, nota="compra de insumos"),
    )

    assert response.status_code == 200, response.text
    data = response.json()

    movimientos = get_caja_movimientos(db_conn, caja_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "egreso"
    assert float(movimientos[0]["monto"]) == 200.0
    assert data["movimiento_id"] == movimientos[0]["id"]


def test_registra_ajuste_positivo(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/ajustes",
        json=_ajuste_payload(
            seed_venta_basica,
            monto=150,
            direccion="positivo",
            nota="sobrante contado",
        ),
    )

    assert response.status_code == 200, response.text

    movimientos = get_caja_movimientos(db_conn, caja_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "ajuste"
    assert movimientos[0]["direccion_ajuste"] == "positivo"
    assert float(movimientos[0]["monto"]) == 150.0


def test_registra_ajuste_negativo(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/ajustes",
        json=_ajuste_payload(
            seed_venta_basica,
            monto=120,
            direccion="negativo",
            nota="faltante contado",
        ),
    )

    assert response.status_code == 200, response.text

    movimientos = get_caja_movimientos(db_conn, caja_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "ajuste"
    assert movimientos[0]["direccion_ajuste"] == "negativo"
    assert float(movimientos[0]["monto"]) == 120.0


def test_cierra_caja_sin_diferencia(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/cerrar",
        json=_cerrar_caja_payload(seed_venta_basica, monto_cierre_real=1000),
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert float(data["monto_cierre_teorico"]) == 1000.0
    assert float(data["monto_cierre_real"]) == 1000.0
    assert float(data["diferencia"]) == 0.0

    caja = get_caja(db_conn, caja_id)
    assert caja["estado"] == "cerrada"


def test_cierra_caja_con_faltante(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/cerrar",
        json=_cerrar_caja_payload(seed_venta_basica, monto_cierre_real=900),
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert float(data["monto_cierre_teorico"]) == 1000.0
    assert float(data["monto_cierre_real"]) == 900.0
    assert float(data["diferencia"]) == -100.0


def test_no_permite_cerrar_caja_ya_cerrada(client, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=500),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    cerrar_1 = client.post(
        f"/cajas/{caja_id}/cerrar",
        json=_cerrar_caja_payload(seed_venta_basica, monto_cierre_real=500),
    )
    assert cerrar_1.status_code == 200

    cerrar_2 = client.post(
        f"/cajas/{caja_id}/cerrar",
        json=_cerrar_caja_payload(seed_venta_basica, monto_cierre_real=500),
    )

    assert cerrar_2.status_code == 400
    assert "ya está cerrada" in cerrar_2.json()["detail"].lower()


def test_egreso_crea_auditoria(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/egresos",
        json=_egreso_payload(seed_venta_basica, monto=100, nota="egreso auditado"),
    )

    assert response.status_code == 200, response.text

    eventos = get_auditoria_by_entidad(db_conn, "caja", caja_id)
    assert len(eventos) == 1
    assert eventos[0]["accion"] == "egreso_caja"


def test_ajuste_crea_auditoria(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/ajustes",
        json=_ajuste_payload(
            seed_venta_basica,
            monto=80,
            direccion="positivo",
            nota="ajuste auditado",
        ),
    )

    assert response.status_code == 200, response.text

    eventos = get_auditoria_by_entidad(db_conn, "caja", caja_id)
    assert len(eventos) == 1
    assert eventos[0]["accion"] == "ajuste_caja"


def test_cierre_crea_auditoria(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/cerrar",
        json=_cerrar_caja_payload(seed_venta_basica, monto_cierre_real=950),
    )

    assert response.status_code == 200, response.text

    eventos = get_auditoria_by_entidad(db_conn, "caja", caja_id)
    assert len(eventos) == 1
    assert eventos[0]["accion"] == "cerrar_caja"

    
def test_rechaza_ajuste_de_caja_demasiado_grande(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/ajustes",
        json=_ajuste_payload(
            seed_venta_basica,
            monto=600000,
            direccion="positivo",
            nota="ajuste exagerado",
        ),
    )

    assert response.status_code == 400
    assert "supera el límite permitido" in response.json()["detail"].lower()

    movimientos = get_caja_movimientos(db_conn, caja_id)
    assert len(movimientos) == 0

def test_rechaza_egreso_de_caja_demasiado_grande(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    response = client.post(
        f"/cajas/{caja_id}/egresos",
        json=_egreso_payload(
            seed_venta_basica,
            monto=600000,
            nota="egreso exagerado",
        ),
    )

    assert response.status_code == 400
    assert "supera el límite permitido" in response.json()["detail"].lower()

    movimientos = get_caja_movimientos(db_conn, caja_id)
    assert len(movimientos) == 0