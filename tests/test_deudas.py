from decimal import Decimal

from tests.conftest import (
    get_auditoria_by_entidad,
    get_caja_movimientos,
    get_deuda,
    get_deudas_by_cliente,
    get_deuda_movimientos,
    get_venta,  # 👈 agregar esto
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


def test_crear_deuda_desde_venta(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    response = client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "observacion": "Deuda inicial de prueba",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["ok"] is True
    deuda_id = data["deuda_id"]

    deuda = get_deuda(db_conn, deuda_id)
    assert deuda is not None
    assert deuda["id_cliente"] == seed_venta_basica["cliente_id"]
    assert deuda["origen_tipo"] == "venta"
    assert deuda["origen_id"] == venta_id
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("5000")
    assert deuda["estado"] == "abierta"

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "cargo"
    assert _to_decimal(movimientos[0]["monto"]) == Decimal("5000")

    auditoria = get_auditoria_by_entidad(db_conn, "deuda", deuda_id)
    acciones = [a["accion"] for a in auditoria]
    assert "deuda_generada" in acciones


def test_rechaza_crear_deuda_duplicada_para_misma_venta(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    primera = client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "observacion": "Primera deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert primera.status_code == 200

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

    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    assert len(deudas) == 1


def test_registrar_pago_parcial_de_deuda(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    crear_deuda = client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 10000,
            "observacion": "Deuda para pago parcial",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear_deuda.status_code == 200
    deuda_id = crear_deuda.json()["deuda_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200
    caja_id = abrir_caja.json()["caja_id"]

    response = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto": 4000,
            "medio_pago": "efectivo",
            "nota": "Pago parcial deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["ok"] is True
    assert data["deuda_id"] == deuda_id
    assert _to_decimal(data["saldo_actual"]) == Decimal("6000")
    assert data["estado"] == "abierta"

    deuda = get_deuda(db_conn, deuda_id)
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("6000")
    assert deuda["estado"] == "abierta"

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["cargo", "pago"]
    assert _to_decimal(movimientos[1]["monto"]) == Decimal("4000")

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    assert len(movimientos_caja) == 1
    assert movimientos_caja[0]["tipo_movimiento"] == "ingreso"
    assert _to_decimal(movimientos_caja[0]["monto"]) == Decimal("4000")

    auditoria = get_auditoria_by_entidad(db_conn, "deuda", deuda_id)
    acciones = [a["accion"] for a in auditoria]
    assert "deuda_generada" in acciones
    assert "deuda_pago_registrado" in acciones


def test_registrar_pago_total_de_deuda_la_cierra(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    crear_deuda = client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 7000,
            "observacion": "Deuda para cancelacion total",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear_deuda.status_code == 200
    deuda_id = crear_deuda.json()["deuda_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

    pago = client.post(
        f"/deudas/{deuda_id}/pagos",
        json={
            "monto": 7000,
            "medio_pago": "transferencia",
            "nota": "Pago total deuda",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert pago.status_code == 200
    data = pago.json()

    assert _to_decimal(data["saldo_actual"]) == Decimal("0")
    assert data["estado"] == "cerrada"

    deuda = get_deuda(db_conn, deuda_id)
    assert _to_decimal(deuda["saldo_actual"]) == Decimal("0")
    assert deuda["estado"] == "cerrada"

    movimientos = get_deuda_movimientos(db_conn, deuda_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]
    assert tipos == ["cargo", "pago"]


def test_rechaza_sobrepago_de_deuda(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    crear_deuda = client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "observacion": "Deuda para sobrepago",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear_deuda.status_code == 200
    deuda_id = crear_deuda.json()["deuda_id"]

    abrir_caja = _abrir_caja(
        client,
        seed_venta_basica["sucursal_id"],
        seed_venta_basica["usuario_id"],
    )
    assert abrir_caja.status_code == 200

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
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    response = client.get("/deudas/")
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_listar_deudas_por_cliente(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    response = client.get(f"/deudas?id_cliente={seed_venta_basica['cliente_id']}")
    assert response.status_code == 200

    data = response.json()
    assert all(d["id_cliente"] == seed_venta_basica["cliente_id"] for d in data)

def test_listar_deudas_por_estado(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    response = client.get("/deudas?estado=abierta")
    assert response.status_code == 200

    data = response.json()
    assert all(d["estado"] == "abierta" for d in data)

def test_listar_deudas_por_origen_venta(client, db_conn, seed_venta_basica):
    venta_id = _crear_venta_basica(client, seed_venta_basica)

    client.post(
        "/deudas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_venta": venta_id,
            "monto_inicial": 5000,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    response = client.get(f"/deudas?origen_tipo=venta&origen_id={venta_id}")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["origen_id"] == venta_id

def test_flujo_real_venta_parcial_entrega_con_deuda_y_pago_deuda(
    client, db_conn, seed_venta_basica
):
    # 1. Crear venta
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    # 2. Abrir caja
    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert abrir.status_code == 200, abrir.text

    # 3. Pago parcial
    pago = client.post(
        "/pagos/",
        json={
            "origen_tipo": "venta",
            "origen_id": venta_id,
            "medio_pago": "efectivo",
            "monto": 10000,
            "id_usuario": seed_venta_basica["usuario_id"],
            "nota": "Seña inicial",
        },
    )
    assert pago.status_code == 200, pago.text

    # 4. Entregar con deuda
    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200, entrega.text

    venta_db = get_venta(db_conn, venta_id)
    assert venta_db["estado"] == "entregada"

    # 5. Buscar deuda generada
    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda = next(d for d in deudas if d["origen_tipo"] == "venta" and d["origen_id"] == venta_id)

    assert deuda["estado"] == "abierta"
    assert Decimal(str(deuda["saldo_actual"])) == Decimal("14440.00")

    # 6. Pagar deuda completa
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

    deudas_despues = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda_final = next(d for d in deudas_despues if d["id"] == deuda["id"])

    assert deuda_final["estado"] == "cerrada"
    assert Decimal(str(deuda_final["saldo_actual"])) == Decimal("0.00")
    # 7. La venta sigue entregada (validación DB)
    venta_final = get_venta(db_conn, venta_id)
    assert venta_final["estado"] == "entregada"

    # 8. Validación por API (no confiar solo en DB)
    response = client.get(f"/ventas/{venta_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["venta"]["estado"] == "entregada"

def test_pago_parcial_reversion_y_entrega_generan_saldo_correcto(
    client, db_conn, seed_venta_basica
):
    # Crear venta (1 unidad)
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    assert venta.status_code == 200
    venta_id = venta.json()["venta_id"]

    # Abrir caja
    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert abrir.status_code == 200

    # Pago parcial
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

    # Revertir pago
    rev = client.post(
        f"/pagos/{pago_id}/revertir",
        json={
            "motivo": "Test reversión",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert rev.status_code == 200

    # Entregar
    entrega = client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )
    assert entrega.status_code == 200

    # Validar deuda completa
    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda = next(d for d in deudas if d["origen_id"] == venta_id)

    total = Decimal(str(seed_venta_basica["precio_venta"]))

    assert Decimal(str(deuda["saldo_actual"])) == total

def test_pago_parcial_de_deuda_no_cierra_deuda(
    client, db_conn, seed_venta_basica
):
    # Crear venta
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "id_bicicleta_serializada": None,
                }
            ],
        },
    )
    venta_id = venta.json()["venta_id"]

    # Abrir caja
    client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )

    # Entregar SIN pagar → genera deuda completa
    client.post(
        f"/ventas/{venta_id}/entregar",
        json={"id_usuario": seed_venta_basica["usuario_id"]},
    )

    # Buscar deuda
    deudas = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda = next(d for d in deudas if d["origen_id"] == venta_id)

    total = Decimal(str(deuda["saldo_actual"]))

    # Pago parcial
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

    # Validar que NO cerró
    deudas_despues = get_deudas_by_cliente(db_conn, seed_venta_basica["cliente_id"])
    deuda_final = next(d for d in deudas_despues if d["id"] == deuda["id"])

    assert deuda_final["estado"] == "abierta"
    assert Decimal(str(deuda_final["saldo_actual"])) == total / 2