from decimal import Decimal

from tests.conftest import (
    get_auditoria_by_entidad,
    get_caja_movimientos,
    get_deuda,
    get_deudas_by_cliente,
    get_deuda_movimientos,
    get_venta,
)


def _to_decimal(value) -> Decimal:
    return Decimal(str(value))


def _abrir_caja(client, sucursal_id: int, usuario_id: int):
    return client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": sucursal_id,
            "id_usuario": usuario_id,
            "monto_apertura": 0,
        },
    )


def _crear_venta_basica(client, seed_venta_basica):
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


def _crear_deuda_automatica_por_entrega(
    client,
    db_conn,
    seed_venta_basica,
    *,
    pago_previo: Decimal | int | float = Decimal("0"),
):
    """
    Flujo real del sistema:
    venta -> caja -> pago previo opcional -> entrega con saldo -> deuda automática.
    """
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    pago_previo = _to_decimal(pago_previo)
    if pago_previo > Decimal("0"):
        pago = client.post(
            "/pagos/",
            json={
                "origen_tipo": "venta",
                "origen_id": venta_id,
                "medio_pago": "efectivo",
                "monto": float(pago_previo),
                "id_usuario": seed_venta_basica["usuario_id"],
                "nota": "Pago previo antes de entregar con deuda",
            },
        )
        assert pago.status_code == 200, pago.text

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"

    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda = next(
        d for d in deudas
        if d["origen_tipo"] == "venta" and d["origen_id"] == venta_id
    )

    return {
        "venta_id": venta_id,
        "deuda_id": deuda["id"],
        "deuda": deuda,
        "caja_id": caja_id,
    }


def _get_pagos_by_deuda(conn, deuda_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM pagos
            WHERE origen_tipo = 'deuda_cliente'
              AND origen_id = %s
            ORDER BY id
            """,
            (deuda_id,),
        )
        return cur.fetchall()


def test_crear_deuda_desde_entrega_con_saldo_pendiente(client, db_conn, seed_venta_basica):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    venta_id = contexto["venta_id"]
    deuda_id = contexto["deuda_id"]

    deuda = get_deuda(db_conn, deuda_id)
    assert deuda is not None
    assert deuda["id_cliente"] == seed_venta_basica["cliente_id"]
    assert deuda["origen_tipo"] == "venta"
    assert deuda["origen_id"] == venta_id
    assert _to_decimal(deuda["saldo_actual"]) == _to_decimal(seed_venta_basica["precio_venta"])
    assert deuda["estado"] == "abierta"

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "cargo"
    assert _to_decimal(movimientos[0]["monto"]) == _to_decimal(seed_venta_basica["precio_venta"])

    auditoria = get_auditoria_by_entidad(db_conn, "deuda", deuda_id)
    acciones = [a["accion"] for a in auditoria]
    assert "deuda_generada" in acciones


def test_rechaza_crear_deuda_manual_si_venta_no_esta_entregada(
    client,
    db_conn,
    seed_venta_basica,
):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    response = client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "observacion": "Deuda inválida sobre venta no entregada",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "ventas entregadas" in response.json()["detail"]

    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert not any(d["origen_id"] == venta_id for d in deudas)


def test_rechaza_crear_deuda_duplicada_para_misma_venta(client, db_conn, seed_venta_basica):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    venta_id = contexto["venta_id"]

    segunda = client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 3000,
            "observacion": "Segunda deuda duplicada",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert segunda.status_code == 400
    assert "ya tiene una deuda abierta" in segunda.json()["detail"]

    deudas = [
        d for d in get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
        if d["origen_id"] == venta_id
    ]
    assert len(deudas) == 1


def test_registrar_pago_parcial_de_deuda(client, db_conn, seed_venta_basica):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    venta_id = contexto["venta_id"]
    deuda_id = contexto["deuda_id"]
    caja_id = contexto["caja_id"]

    auditoria_antes = get_auditoria_by_entidad(db_conn, "deuda", deuda_id)

    response = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto": 4000,
            "medio_pago": "efectivo",
            "nota": "Pago parcial deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    saldo_esperado = _to_decimal(seed_venta_basica["precio_venta"]) - Decimal("4000")

    assert data["ok"] is True
    assert data["deuda_id"] == deuda_id
    assert _to_decimal(data["saldo_actual"]) == saldo_esperado
    assert data["estado"] == "abierta"

    deuda = get_deuda(db_conn, deuda_id)
    assert _to_decimal(deuda["saldo_actual"]) == saldo_esperado
    assert deuda["estado"] == "abierta"

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert _to_decimal(venta["saldo_pendiente"]) == saldo_esperado

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["cargo", "pago"]
    assert _to_decimal(movimientos[1]["monto"]) == Decimal("4000")

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingresos_deuda = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "ingreso"
        and m["origen_tipo"] == "pago"
        and _to_decimal(m["monto"]) == Decimal("4000")
    ]
    assert len(ingresos_deuda) == 1

    auditoria_despues = get_auditoria_by_entidad(db_conn, "deuda", deuda_id)
    nuevos_eventos = auditoria_despues[len(auditoria_antes):]

    eventos_pago = [
        e for e in nuevos_eventos
        if e["accion"] == "deuda_pago_registrado"
    ]
    assert len(eventos_pago) == 1

    detalle = (eventos_pago[0]["detalle"] or "").lower()
    assert "4000" in detalle


def test_registrar_pago_total_de_deuda_la_cierra(client, db_conn, seed_venta_basica):
    contexto = _crear_deuda_automatica_por_entrega(
        client,
        db_conn,
        seed_venta_basica,
        pago_previo=Decimal("17440"),
    )
    venta_id = contexto["venta_id"]
    deuda_id = contexto["deuda_id"]

    deuda_inicial = get_deuda(db_conn, deuda_id)
    assert _to_decimal(deuda_inicial["saldo_actual"]) == Decimal("7000")

    auditoria_antes = get_auditoria_by_entidad(db_conn, "deuda", deuda_id)

    pago = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto": 7000,
            "medio_pago": "transferencia",
            "nota": "Pago total deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert pago.status_code == 200, pago.text
    data = pago.json()

    assert _to_decimal(data["saldo_actual"]) == Decimal("0")
    assert data["estado"] == "cerrada"

    deuda = get_deuda(db_conn, deuda_id)
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("0")
    assert deuda["estado"] == "cerrada"

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert _to_decimal(venta["saldo_pendiente"]) == Decimal("0")

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["cargo", "pago"]
    assert _to_decimal(movimientos[1]["monto"]) == Decimal("7000")

    auditoria_despues = get_auditoria_by_entidad(db_conn, "deuda", deuda_id)
    nuevos_eventos = auditoria_despues[len(auditoria_antes):]
    assert any(e["accion"] == "deuda_pago_registrado" for e in nuevos_eventos)


def test_pago_deuda_efectivo_con_monto_base_aplica_descuento_y_baja_por_base(
    client,
    db_conn,
    seed_venta_basica,
):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    deuda_id = contexto["deuda_id"]
    caja_id = contexto["caja_id"]
    saldo = _to_decimal(contexto["deuda"]["saldo_actual"])

    response = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto_base": str(saldo),
            "medio_pago": "efectivo",
            "nota": "Pago deuda efectivo con reglas",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert _to_decimal(data["saldo_actual"]) == Decimal("0.00")
    assert _to_decimal(data["monto_base_aplicado"]) == saldo
    assert _to_decimal(data["descuento_aplicado"]) > Decimal("0")
    assert _to_decimal(data["monto_total_cobrado"]) < saldo

    deuda = get_deuda(db_conn, deuda_id)
    assert deuda["estado"] == "cerrada"
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("0.00")

    pago = _get_pagos_by_deuda(db_conn, deuda_id)[0]
    assert _to_decimal(pago["monto_base_aplicado"]) == saldo
    assert _to_decimal(pago["monto_descuento_aplicado"]) == _to_decimal(data["descuento_aplicado"])
    assert _to_decimal(pago["monto_total_cobrado"]) == _to_decimal(data["monto_total_cobrado"])

    movimientos_deuda = get_deuda_movimientos(db_conn, deuda_id)
    assert _to_decimal(movimientos_deuda[-1]["monto"]) == saldo

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingreso = next(
        m for m in movimientos_caja
        if m["origen_tipo"] == "pago" and m["origen_id"] == pago["id"]
    )
    assert ingreso["submedio"] == "efectivo"
    assert _to_decimal(ingreso["monto"]) == _to_decimal(data["monto_total_cobrado"])


def test_pago_deuda_transferencia_con_monto_base_aplica_descuento(
    client,
    db_conn,
    seed_venta_basica,
):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    deuda_id = contexto["deuda_id"]
    saldo = _to_decimal(contexto["deuda"]["saldo_actual"])

    response = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto_base": str(saldo),
            "medio_pago": "transferencia",
            "nota": "Pago deuda transferencia con reglas",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert _to_decimal(data["monto_base_aplicado"]) == saldo
    assert _to_decimal(data["descuento_aplicado"]) > Decimal("0")
    assert _to_decimal(data["monto_total_cobrado"]) < saldo

    pago = _get_pagos_by_deuda(db_conn, deuda_id)[0]
    assert pago["medio_pago"] == "transferencia"
    assert _to_decimal(pago["monto_descuento_aplicado"]) == _to_decimal(data["descuento_aplicado"])


def test_pago_deuda_tarjeta_con_monto_base_aplica_recargo_y_caja_operativa(
    client,
    db_conn,
    seed_venta_basica,
):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    deuda_id = contexto["deuda_id"]
    caja_id = contexto["caja_id"]
    saldo = _to_decimal(contexto["deuda"]["saldo_actual"])

    response = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto_base": str(saldo),
            "medio_pago": "tarjeta",
            "cuotas": 6,
            "nota": "Pago deuda tarjeta con reglas",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert _to_decimal(data["monto_base_aplicado"]) == saldo
    assert _to_decimal(data["recargo_aplicado"]) > Decimal("0")
    assert _to_decimal(data["monto_total_cobrado"]) > saldo

    deuda = get_deuda(db_conn, deuda_id)
    assert deuda["estado"] == "cerrada"
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("0.00")

    pago = _get_pagos_by_deuda(db_conn, deuda_id)[0]
    assert pago["medio_pago"] == "tarjeta"
    assert _to_decimal(pago["monto_recargo_aplicado"]) == _to_decimal(data["recargo_aplicado"])

    movimientos_deuda = get_deuda_movimientos(db_conn, deuda_id)
    assert _to_decimal(movimientos_deuda[-1]["monto"]) == saldo

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingreso = next(
        m for m in movimientos_caja
        if m["origen_tipo"] == "pago" and m["origen_id"] == pago["id"]
    )
    assert ingreso["submedio"] == "tarjeta"
    assert _to_decimal(ingreso["monto"]) == Decimal("32994.00")


def test_preview_pago_deuda_con_monto_cobrado_objetivo_calcula_base_cubierta(
    client,
    db_conn,
    seed_venta_basica,
):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    deuda_id = contexto["deuda_id"]
    saldo = _to_decimal(contexto["deuda"]["saldo_actual"])

    referencia = client.post(
        f"/deudas/{deuda_id}/pagos/preview",
        json={
            "monto_base": str(saldo),
            "medio_pago": "efectivo",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert referencia.status_code == 200, referencia.text
    monto_cliente = referencia.json()["monto_total_cobrado"]

    response = client.post(
        f"/deudas/{deuda_id}/pagos/preview",
        json={
            "monto_cobrado_objetivo": monto_cliente,
            "medio_pago": "efectivo",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert _to_decimal(data["monto_base_aplicado"]) == saldo
    assert _to_decimal(data["descuento_aplicado"]) > Decimal("0")
    assert _to_decimal(data["monto_total_cobrado"]) == _to_decimal(monto_cliente)
    assert _to_decimal(data["saldo_restante_estimado"]) == Decimal("0.00")


def test_rechaza_sobrepago_de_deuda(client, db_conn, seed_venta_basica):
    contexto = _crear_deuda_automatica_por_entrega(
        client,
        db_conn,
        seed_venta_basica,
        pago_previo=Decimal("19440"),
    )
    deuda_id = contexto["deuda_id"]

    deuda_inicial = get_deuda(db_conn, deuda_id)
    assert _to_decimal(deuda_inicial["saldo_actual"]) == Decimal("5000")

    pago = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto": 6000,
            "medio_pago": "efectivo",
            "nota": "Sobrepago deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert pago.status_code == 400
    assert "supera el saldo de la deuda" in pago.json()["detail"]

    deuda = get_deuda(db_conn, deuda_id)
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("5000")
    assert deuda["estado"] == "abierta"

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "cargo"


def test_listar_deudas_sin_filtros(client, db_conn, seed_venta_basica):
    _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)

    response = client.get("/deudas/")
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_listar_deudas_por_cliente(client, db_conn, seed_venta_basica):
    _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)

    response = client.get(f"/deudas?id_cliente={seed_venta_basica['cliente_id']}")
    assert response.status_code == 200

    data = response.json()
    assert len(data) >= 1
    assert all(d["id_cliente"] == seed_venta_basica["cliente_id"] for d in data)


def test_listar_deudas_por_estado(client, db_conn, seed_venta_basica):
    _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)

    response = client.get("/deudas?estado=abierta")
    assert response.status_code == 200

    data = response.json()
    assert len(data) >= 1
    assert all(d["estado"] == "abierta" for d in data)


def test_listar_deudas_por_origen_venta(client, db_conn, seed_venta_basica):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    venta_id = contexto["venta_id"]

    response = client.get(f"/deudas?origen_tipo=venta&origen_id={venta_id}")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["origen_id"] == venta_id


def test_flujo_real_venta_parcial_entrega_con_deuda_y_pago_deuda(
    client, db_conn, seed_venta_basica
):
    contexto = _crear_deuda_automatica_por_entrega(
        client,
        db_conn,
        seed_venta_basica,
        pago_previo=Decimal("10000"),
    )
    venta_id = contexto["venta_id"]
    deuda = contexto["deuda"]

    assert deuda["estado"] == "abierta"
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("14440.00")

    pago_deuda = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": 14440,
            "medio_pago": "efectivo",
            "nota": "Cancela deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago_deuda.status_code == 200, pago_deuda.text

    deuda_final = get_deuda(db_conn, deuda["id"])
    assert deuda_final["estado"] == "cerrada"
    assert _to_decimal(deuda_final["saldo_actual"]) == Decimal("0.00")

    venta_final = get_venta(db_conn, venta_id)
    assert venta_final["estado"] == "entregada"
    assert _to_decimal(venta_final["saldo_pendiente"]) == Decimal("0.00")

    response = client.get(f"/ventas/{venta_id}")
    assert response.status_code == 200
    assert response.json()["venta"]["estado"] == "entregada"
    assert _to_decimal(response.json()["venta"]["saldo_pendiente"]) == Decimal("0.00")


def test_pago_parcial_reversion_y_entrega_generan_saldo_correcto(
    client, db_conn, seed_venta_basica
):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    abrir = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir.status_code == 200

    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Pago parcial",
        },
    )
    assert pago.status_code == 200
    pago_id = pago.json()["pago_id"]

    rev = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Test reversión",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert rev.status_code == 200

    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda = next(d for d in deudas if d["origen_id"] == venta_id)

    total = Decimal(str(seed_venta_basica["precio_venta"]))
    assert Decimal(str(deuda["saldo_actual"])) == total


def test_pago_parcial_de_deuda_no_cierra_deuda(client, db_conn, seed_venta_basica):
    contexto = _crear_deuda_automatica_por_entrega(client, db_conn, seed_venta_basica)
    venta_id = contexto["venta_id"]
    deuda = contexto["deuda"]

    total = Decimal(str(deuda["saldo_actual"]))

    pago = client.post(
        f"/deudas/{deuda['id']}/pagos",
        json={
            "monto": float(total) / 2,
            "medio_pago": "efectivo",
            "nota": "Pago parcial deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert pago.status_code == 200

    deuda_final = get_deuda(db_conn, deuda["id"])
    assert deuda_final["estado"] == "abierta"
    assert Decimal(str(deuda_final["saldo_actual"])) == total / 2

    venta = get_venta(db_conn, venta_id)
    assert venta["estado"] == "entregada"
    assert Decimal(str(venta["saldo_pendiente"])) == total / 2
