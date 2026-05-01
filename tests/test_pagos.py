from decimal import Decimal
from tests.conftest import (
    get_auditoria_by_entidad,
    get_caja_movimientos,
    get_deudas_by_cliente,
    get_venta,
    asignar_rol_usuario,
)
def _abrir_caja(client, sucursal_id: int, usuario_id: int):
    return client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )


def _payload_pago(venta_id: int, medio_pago: str, monto: int | float, id_usuario: int, nota: str = ""):
    return {
        "origen_tipo": "venta",
        "origen_id": venta_id,
        "medio_pago": medio_pago,
        "monto": monto,
        "id_usuario": id_usuario,
        "nota": nota,
    }


def crear_venta_base(client, seed_venta_basica):
    payload = {
        "id_cliente": seed_venta_basica["cliente_id"],
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_usuario": seed_venta_basica["usuario_id"],
        "items": [
            {
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }
        ],
    }

    response = client.post("/ventas/", json=payload)
    assert response.status_code == 200
    return response.json()["venta_id"]


def test_registra_pago_total_efectivo(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total efectivo",
        ),
    )

    assert response.status_code == 200

    data = response.json()
    assert data["ok"] is True
    assert data["venta_id"] == venta_id
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_total_transferencia(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total transferencia",
        ),
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_total_mercadopago(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "mercadopago",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total mercadopago",
        ),
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_total_tarjeta(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "tarjeta",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total tarjeta",
        ),
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_total"
    assert float(data["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_registra_pago_parcial(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial",
        ),
    )

    assert response.status_code == 200

    data = response.json()
    assert data["estado_venta"] == "pagada_parcial"
    assert float(data["saldo_restante"]) == 14440.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 14440.0


def test_rechaza_sobrepago(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            30000,
            seed_venta_basica["usuario_id"],
            "Sobrepago",
        ),
    )

    assert response.status_code == 400
    assert "supera el saldo pendiente" in response.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"
    assert float(venta["saldo_pendiente"]) == 24440.0


def test_rechaza_pago_de_venta_anulada(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    anular_response = client.post(
        f"/ventas/{venta_id}/anular",
        json={
            "motivo": "anulacion de prueba",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular_response.status_code == 200

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            1000,
            seed_venta_basica["usuario_id"],
            "Pago inválido venta anulada",
        ),
    )

    assert pago_response.status_code == 400
    assert "está anulada" in pago_response.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "anulada"


def test_rechaza_medio_pago_invalido(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "cheque",
            1000,
            seed_venta_basica["usuario_id"],
            "Medio inválido",
        ),
    )

    # si el schema valida enum en request puede ser 422; si lo valida service puede ser 400
    assert response.status_code in (400, 422)


def test_rechaza_pago_sin_saldo_pendiente(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    primer_pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago completo",
        ),
    )
    assert primer_pago.status_code == 200

    segundo_pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            1,
            seed_venta_basica["usuario_id"],
            "Pago sobrante",
        ),
    )

    assert segundo_pago.status_code == 400
    assert "no tiene saldo pendiente" in segundo_pago.json()["detail"]


def test_permite_dos_pagos_hasta_cancelar_total(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Primer pago",
        ),
    )
    assert pago_1.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 14440.0

    pago_2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            14440,
            seed_venta_basica["usuario_id"],
            "Segundo pago",
        ),
    )
    assert pago_2.status_code == 200

    data_2 = pago_2.json()
    assert data_2["estado_venta"] == "pagada_total"
    assert float(data_2["saldo_restante"]) == 0.0

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_rechaza_sobrepago_acumulado_en_segundo_pago(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            20000,
            seed_venta_basica["usuario_id"],
            "Primer pago grande",
        ),
    )
    assert pago_1.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 4440.0

    pago_2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            5000,
            seed_venta_basica["usuario_id"],
            "Segundo pago excedido",
        ),
    )
    assert pago_2.status_code == 400
    assert "supera el saldo pendiente" in pago_2.json()["detail"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert float(venta["saldo_pendiente"]) == 4440.0


def test_lista_pagos_de_una_venta_con_dos_medios(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Primer pago lista",
        ),
    )
    assert pago_1.status_code == 200

    pago_2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            14440,
            seed_venta_basica["usuario_id"],
            "Segundo pago lista",
        ),
    )
    assert pago_2.status_code == 200

    response = client.get(f"/pagos/ventas/{venta_id}/pagos")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    assert data[0]["origen_id"] == venta_id
    assert data[1]["origen_id"] == venta_id

    medios = [p["medio_pago"] for p in data]
    assert medios == ["efectivo", "transferencia"]


def test_permite_entregar_venta_con_saldo_pendiente_si_usuario_tiene_permiso(
    client, db_conn, seed_venta_basica
):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_parcial = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial entrega permitida",
        ),
    )
    assert pago_parcial.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    assert entrega.status_code == 200, entrega.text


def test_flujo_completo_venta_pago_y_entrega(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Flujo completo",
        ),
    )

    assert pago.status_code == 200
    data_pago = pago.json()

    assert data_pago["estado_venta"] == "pagada_total"
    assert float(data_pago["saldo_restante"]) == 0.0

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    assert entrega.status_code == 200

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert float(venta["saldo_pendiente"]) == 0.0


def test_no_permite_pago_en_venta_totalmente_pagada(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total inicial",
        ),
    )

    assert pago.status_code == 200

    segundo_pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            100,
            seed_venta_basica["usuario_id"],
            "Pago sobrante final",
        ),
    )

    assert segundo_pago.status_code == 400

def test_pago_crea_auditoria(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )

    response = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            1000,
            seed_venta_basica["usuario_id"],
            "Test auditoria",
        ),
    )

    assert response.status_code == 200
    pago_id = response.json()["pago_id"]

    eventos = get_auditoria_by_entidad(db_conn, "pago", pago_id)

    assert len(eventos) == 1
    assert eventos[0]["accion"] == "pago_registrado"

def test_rechaza_pago_directo_a_venta_entregada_con_deuda(client, db_conn, seed_venta_basica):
    crear = client.post(
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
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_parcial = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial antes de entregar",
        ),
    )
    assert pago_parcial.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    pago_despues = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            2000,
            seed_venta_basica["usuario_id"],
            "Intento de pago directo a venta ya entregada",
        ),
    )

    assert pago_despues.status_code == 400
    assert "registrá el pago sobre la deuda correspondiente" in pago_despues.json()["detail"]

def test_pago_de_deuda_no_modifica_saldo_de_venta(client, db_conn, seed_venta_basica):
    # crear venta
    crear = client.post(
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
    assert crear.status_code == 200
    venta_id = crear.json()["venta_id"]

    # abrir caja
    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    # pago parcial
    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial",
        ),
    )
    assert pago.status_code == 200

    # entregar → genera deuda
    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    venta_antes = get_venta(db_conn, venta_id)

    # obtener deuda
    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda_id = deudas[0]["id"]

    # pagar deuda
    pago_deuda = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto": 2000,
            "medio_pago": "efectivo",
            "nota": "Pago deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_deuda.status_code == 200

    venta_despues = get_venta(db_conn, venta_id)

    # 🔴 ESTA ES LA VALIDACIÓN IMPORTANTE
    assert venta_antes["saldo_pendiente"] == venta_despues["saldo_pendiente"]


def _crear_usuario_sin_permiso(db_conn, username: str = "operador_sin_permiso_pago"):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES (%s, %s, %s, TRUE)
            RETURNING id
            """,
            ("Operador Pago", username, "hash_dummy"),
        )
        usuario_id = cur.fetchone()["id"]

    asignar_rol_usuario(db_conn, usuario_id, "operador")
    db_conn.commit()
    return usuario_id


def test_rechaza_reversion_pago_sin_permiso(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago test reversion",
        ),
    )
    assert pago.status_code == 200
    pago_id = pago.json()["pago_id"]

    usuario_sin_permiso_id = _crear_usuario_sin_permiso(
        db_conn,
        "operador_reversion_pago",
    )

    response = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Intento sin permiso",
            "id_usuario": usuario_sin_permiso_id,
        },
    )

    assert response.status_code == 403, response.text

def test_pagos_acumulados_cierran_saldo_exacto(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            333.33,
            seed_venta_basica["usuario_id"],
            "Pago acumulado 1",
        ),
    )
    assert pago_1.status_code == 200

    pago_2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            333.33,
            seed_venta_basica["usuario_id"],
            "Pago acumulado 2",
        ),
    )
    assert pago_2.status_code == 200

    pago_3 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "mercadopago",
            23773.34,
            seed_venta_basica["usuario_id"],
            "Pago acumulado final",
        ),
    )
    assert pago_3.status_code == 200

    data = pago_3.json()
    assert Decimal(str(data["saldo_restante"])) == Decimal("0.00")

    venta = get_venta(db_conn, venta_id)
    assert Decimal(str(venta["saldo_pendiente"])) == Decimal("0.00")

def test_flujo_pago_reversion_nuevo_pago_y_entrega(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago_parcial = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial antes de reversión",
        ),
    )
    assert pago_parcial.status_code == 200
    pago_id = pago_parcial.json()["pago_id"]

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_parcial"
    assert Decimal(str(venta["saldo_pendiente"])) == Decimal("14440.00")

    reversion = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Reversión test flujo completo",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert reversion.status_code == 200, reversion.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "creada"
    assert Decimal(str(venta["saldo_pendiente"])) == Decimal("24440.00")

    nuevo_pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total después de reversión",
        ),
    )
    assert nuevo_pago.status_code == 200, nuevo_pago.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "pagada_total"
    assert Decimal(str(venta["saldo_pendiente"])) == Decimal("0.00")

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert Decimal(str(venta["saldo_pendiente"])) == Decimal("0.00")

def test_no_permite_revertir_pago_de_venta_entregada(client, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            24440,
            seed_venta_basica["usuario_id"],
            "Pago total antes de entrega",
        ),
    )
    assert pago.status_code == 200
    pago_id = pago.json()["pago_id"]

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text
    
    reversion = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Intento de revertir venta entregada",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    reversion = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Intento de revertir venta entregada",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert reversion.status_code == 400
    assert "venta ya entregada" in reversion.json()["detail"]

def test_pago_y_caja_siempre_consistentes(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Test consistencia",
        ),
    )

    assert pago.status_code == 200
    pago_id = pago.json()["pago_id"]

    movimientos = get_caja_movimientos(db_conn, caja_id)

    assert any(
    m["origen_tipo"] == "pago"
    and m["origen_id"] == pago_id
    and m["monto"] == Decimal("10000")
    and m["tipo_movimiento"] == "ingreso"
    for m in movimientos
)

def test_reversion_pago_genera_egreso_en_caja(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200
    caja_id = abrir.json()["caja_id"]

    # 1. Pago
    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago para revertir",
        ),
    )
    assert pago.status_code == 200
    pago_id = pago.json()["pago_id"]

    # 2. Reversión
    reversion = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Test reversión caja",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert reversion.status_code == 200

    # 3. Movimientos de caja
    movimientos = get_caja_movimientos(db_conn, caja_id)

    # 4. Validación fuerte
    egresos = [
    m for m in movimientos
    if m["origen_tipo"] == "pago_reversion"
    and m["tipo_movimiento"] == "egreso"
]

    assert len(egresos) == 1
    assert egresos[0]["monto"] == Decimal("10000")

def test_reversion_de_pago_parcial_restaura_saldo_correcto(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    # 1. Pago parcial
    pago = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago parcial",
        ),
    )
    assert pago.status_code == 200
    pago_id = pago.json()["pago_id"]

    # Validar saldo después del pago
    venta = get_venta(db_conn, venta_id)
    saldo_despues_pago = Decimal(str(venta["saldo_pendiente"]))
    assert saldo_despues_pago == Decimal(str(venta["total_final"])) - Decimal("10000")

    # 2. Reversión
    reversion = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Reversión parcial",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert reversion.status_code == 200

    # 3. Validar saldo restaurado
    venta_final = get_venta(db_conn, venta_id)

    assert Decimal(str(venta_final["saldo_pendiente"])) == Decimal(str(venta_final["total_final"]))
    assert venta_final["estado"] == "creada"

def test_reversion_de_un_pago_en_escenario_multiples_pagos(client, db_conn, seed_venta_basica):
    venta_id = crear_venta_base(client, seed_venta_basica)

    _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )

    # Pago 1
    pago1 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "efectivo",
            10000,
            seed_venta_basica["usuario_id"],
            "Pago 1",
        ),
    )
    assert pago1.status_code == 200
    pago1_id = pago1.json()["pago_id"]

    # Pago 2
    pago2 = client.post(
        "/pagos/",
        json=_payload_pago(
            venta_id,
            "transferencia",
            5000,
            seed_venta_basica["usuario_id"],
            "Pago 2",
        ),
    )
    assert pago2.status_code == 200

    # Revertir solo pago 1
    reversion = client.post(
        f"/pagos/{pago1_id}/revertir",
        json={
            "motivo": "Reversión selectiva",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert reversion.status_code == 200

    venta_final = get_venta(db_conn, venta_id)

    total = Decimal(str(venta_final["total_final"]))
    saldo = Decimal(str(venta_final["saldo_pendiente"]))

    assert saldo == total - Decimal("5000")
    assert venta_final["estado"] == "pagada_parcial"