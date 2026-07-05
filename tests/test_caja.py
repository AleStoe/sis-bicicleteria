from decimal import Decimal

from tests.conftest import (
    asignar_rol_usuario,
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


def _crear_usuario_sin_permiso(db_conn, username: str):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES (%s, %s, %s, TRUE)
            RETURNING id
            """,
            ("Operador Caja Test", username, "hash_dummy"),
        )
        usuario_id = cur.fetchone()["id"]

    asignar_rol_usuario(db_conn, usuario_id, "operador")
    db_conn.commit()
    return usuario_id


def _crear_venta_base(client, seed_venta_basica):
    response = client.post(
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
    assert response.status_code == 200, response.text
    return response.json()["venta_id"]


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


def test_resumen_diario_consolida_caja_pagos_rentabilidad_y_documentos(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_id = _crear_venta_base(client, seed_venta_basica)

    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 24440,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago caja diaria",
        },
    )
    assert pago.status_code == 200, pago.text
    pago_id = pago.json()["pago_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE pagos
            SET monto_base_aplicado = 24540,
                monto_descuento_aplicado = 100,
                monto_recargo_aplicado = 0
            WHERE id = %s
            """,
            (pago_id,),
        )
        cur.execute(
            """
            UPDATE ventas
            SET descuento_total = 100,
                recargo_total = 0,
                total_final = 24340,
                saldo_pendiente = 0,
                estado = 'pagada_total'
            WHERE id = %s
            """,
            (venta_id,),
        )
        cur.execute(
            """
            INSERT INTO gastos_operativos (
                fecha,
                id_sucursal,
                descripcion,
                monto,
                medio_pago,
                impacta_caja,
                estado,
                id_usuario
            )
            VALUES (CURRENT_DATE, %s, 'Gasto diario test', 500, 'efectivo', FALSE, 'activo', %s)
            """,
            (seed_venta_basica["sucursal_id"], seed_venta_basica["usuario_id"]),
        )
    db_conn.commit()

    egreso = client.post(
        f"/cajas/{caja_id}/egresos",
        json=_egreso_payload(seed_venta_basica, monto=200, nota="egreso cierre"),
    )
    assert egreso.status_code == 200, egreso.text

    response = client.get(
        "/cajas/resumen-diario",
        params={"id_sucursal": seed_venta_basica["sucursal_id"]},
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["caja"]["caja_id"] == caja_id
    assert float(data["caja"]["monto_apertura"]) == 1000.0
    assert float(data["caja"]["efectivo_teorico"]) == 25240.0
    assert float(data["caja"]["egresos"]) == 200.0

    assert data["pagos"]["cantidad_pagos"] == 1
    assert float(data["pagos"]["total_cobrado"]) == 24440.0
    assert float(data["pagos"]["base_aplicada"]) == 24540.0
    assert float(data["pagos"]["descuentos_aplicados"]) == 100.0
    assert float(data["pagos"]["efectivo"]) == 24440.0

    assert data["rentabilidad"]["cantidad_ventas"] == 1
    assert float(data["rentabilidad"]["ventas_total"]) == 24340.0
    assert float(data["rentabilidad"]["ventas_items_total"]) == 24440.0
    assert float(data["rentabilidad"]["costo_mercaderia_vendida"]) == 10000.0
    assert float(data["rentabilidad"]["margen_bruto"]) == 14340.0
    assert float(data["rentabilidad"]["gastos_operativos"]) == 500.0
    assert float(data["rentabilidad"]["ganancia_dia"]) == 13840.0

    assert data["documentos"]["comprobantes_x"] == 1
    assert data["documentos"]["recibos_pago"] == 1
    assert data["documentos"]["resumenes_cobro"] == 1
    assert data["documentos"]["total_disponibles"] >= 3


def test_resumen_diario_tarjeta_muestra_movimiento_operativo_no_total_financiado(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_id = _crear_venta_base(client, seed_venta_basica)

    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=0),
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente,
                origen_tipo,
                origen_id,
                medio_pago,
                monto_total_cobrado,
                monto_base_aplicado,
                monto_descuento_aplicado,
                monto_recargo_aplicado,
                monto_costo_financiero,
                monto_neto_liquidado,
                estado,
                nota,
                id_usuario
            )
            VALUES (%s, 'venta', %s, 'tarjeta', 311666.66, 183333.33, 0, 128333.33,
                    128333.33, 183333.33,
                    'confirmado', 'Pago tarjeta con recargo financiero', %s)
            RETURNING id
            """,
            (
                seed_venta_basica["cliente_id"],
                venta_id,
                seed_venta_basica["usuario_id"],
            ),
        )
        pago_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO caja_movimientos (
                id_caja,
                tipo_movimiento,
                submedio,
                monto,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, 'ingreso', 'tarjeta', 183333.33, 'pago', %s,
                    'tarjeta neto_caja=183333.33 recargo_financiero=128333.33 total_cliente=311666.66',
                    %s)
            """,
            (caja_id, pago_id, seed_venta_basica["usuario_id"]),
        )
    db_conn.commit()

    response = client.get(
        "/cajas/resumen-diario",
        params={"id_sucursal": seed_venta_basica["sucursal_id"]},
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["pagos"]["cantidad_pagos"] == 1
    assert float(data["pagos"]["tarjeta"]) == 183333.33
    assert float(data["pagos"]["total_cobrado"]) == 183333.33
    assert float(data["pagos"]["total_bruto_cobrado"]) == 311666.66
    assert float(data["pagos"]["costos_financieros"]) == 128333.33
    assert float(data["pagos"]["total_neto_esperado"]) == 183333.33
    assert float(data["pagos"]["total_financiado_tarjeta"]) == 311666.66
    assert float(data["pagos"]["recargos_aplicados"]) == 128333.33


def test_resumen_diario_no_cuenta_venta_creada_sin_pagos(client, seed_venta_basica):
    _crear_venta_base(client, seed_venta_basica)

    response = client.get(
        "/cajas/resumen-diario",
        params={"id_sucursal": seed_venta_basica["sucursal_id"]},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["rentabilidad"]["cantidad_ventas"] == 0
    assert float(data["rentabilidad"]["ventas_total"]) == 0.0
    assert float(data["rentabilidad"]["ganancia_dia"]) == 0.0
    assert data["documentos"]["comprobantes_x"] == 0


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


def test_cerrar_caja_sin_permiso_devuelve_403(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    usuario_sin_permiso = _crear_usuario_sin_permiso(
        db_conn,
        "operador_caja_cierre_sin_permiso",
    )

    response = client.post(
        f"/cajas/{caja_id}/cerrar",
        json={
            "id_usuario": usuario_sin_permiso,
            "monto_cierre_real": 1000,
        },
    )

    assert response.status_code == 403, response.text
    caja = get_caja(db_conn, caja_id)
    assert caja["estado"] == "abierta"


def test_ajustar_caja_sin_permiso_devuelve_403(client, db_conn, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json=_abrir_caja_payload(seed_venta_basica, monto_apertura=1000),
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    usuario_sin_permiso = _crear_usuario_sin_permiso(
        db_conn,
        "operador_caja_ajuste_sin_permiso",
    )

    movimientos_antes = get_caja_movimientos(db_conn, caja_id)

    response = client.post(
        f"/cajas/{caja_id}/ajustes",
        json={
            "id_usuario": usuario_sin_permiso,
            "monto": 100,
            "direccion": "positivo",
            "nota": "Intento sin permiso",
        },
    )

    assert response.status_code == 403, response.text
    assert get_caja_movimientos(db_conn, caja_id) == movimientos_antes


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
    acciones = [evento["accion"] for evento in eventos]
    assert acciones.count("abrir_caja") == 1
    assert acciones.count("egreso_caja") == 1


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
    acciones = [evento["accion"] for evento in eventos]
    assert acciones.count("abrir_caja") == 1
    assert acciones.count("ajuste_caja") == 1


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
    acciones = [evento["accion"] for evento in eventos]
    assert acciones.count("abrir_caja") == 1
    assert acciones.count("cerrar_caja") == 1

    
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
