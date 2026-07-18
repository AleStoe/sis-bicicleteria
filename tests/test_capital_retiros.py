from decimal import Decimal

from tests.conftest import get_caja_movimientos


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _crear_participante(client, nombre="Ale", tipo="persona"):
    response = client.post(
        "/capital-retiros/participantes",
        json={"nombre": nombre, "tipo": tipo},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _crear_movimiento(client, seed_venta_basica, participante_id, tipo_movimiento, monto=10000, impacta_caja=False, medio_pago="efectivo"):
    payload = {
        "id_participante": participante_id,
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "tipo_movimiento": tipo_movimiento,
        "descripcion": f"Movimiento {tipo_movimiento}",
        "monto": monto,
        "medio_pago": medio_pago,
        "impacta_caja": impacta_caja,
        "id_usuario": seed_venta_basica["usuario_id"],
    }
    response = client.post("/capital-retiros/movimientos", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def _get_movimiento(conn, movimiento_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM capital_movimientos
            WHERE id = %s
            """,
            (movimiento_id,),
        )
        return cur.fetchone()


def test_crea_participante_capital(client, seed_venta_basica):
    participante = _crear_participante(client, "Ángel", "persona")

    assert participante["nombre"] == "Ángel"
    assert participante["tipo"] == "persona"
    assert participante["activo"] is True


def test_edita_y_desactiva_participante(client, seed_venta_basica):
    participante = _crear_participante(client, "Fondo familiar", "fondo")
    nuevo_nombre = f"Fondo Bicicletería Test {participante['id']}"

    editar = client.put(
        f"/capital-retiros/participantes/{participante['id']}",
        json={
            "nombre": nuevo_nombre,
            "tipo": "fondo",
            "activo": True,
            "observaciones": "Reinversión del negocio",
        },
    )

    assert editar.status_code == 200, editar.text
    assert editar.json()["nombre"] == nuevo_nombre

    desactivar = client.patch(
        f"/capital-retiros/participantes/{participante['id']}/estado",
        json={"activo": False},
    )

    assert desactivar.status_code == 200, desactivar.text
    assert desactivar.json()["activo"] is False

    listar_activos = client.get("/capital-retiros/participantes")
    ids_activos = [p["id"] for p in listar_activos.json()]
    assert participante["id"] not in ids_activos

    listar_todos = client.get(
        "/capital-retiros/participantes",
        params={"incluir_inactivos": True},
    )
    ids_todos = [p["id"] for p in listar_todos.json()]
    assert participante["id"] in ids_todos

def test_no_permite_movimiento_con_participante_inactivo(client, seed_venta_basica):
    participante = _crear_participante(client, "Participante inactivo", "persona")

    desactivar = client.patch(
        f"/capital-retiros/participantes/{participante['id']}/estado",
        json={"activo": False},
    )
    assert desactivar.status_code == 200, desactivar.text

    response = client.post(
        "/capital-retiros/movimientos",
        json={
            "id_participante": participante["id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "tipo_movimiento": "prestamo_socio",
            "descripcion": "Préstamo para compra volumen",
            "monto": 50000,
            "medio_pago": "transferencia",
            "impacta_caja": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "inactivo" in response.json()["detail"].lower()


def test_crea_prestamo_socio_sin_caja(client, db_conn, seed_venta_basica):
    participante = _crear_participante(client, "Ale préstamo", "persona")

    data = _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "prestamo_socio",
        monto=100000,
        impacta_caja=False,
        medio_pago="transferencia",
    )

    movimiento = _get_movimiento(db_conn, data["movimiento_id"])
    assert movimiento is not None
    assert movimiento["tipo_movimiento"] == "prestamo_socio"
    assert _dec(movimiento["monto"]) == Decimal("100000.00")
    assert movimiento["impacta_caja"] is False
    assert movimiento["id_caja_movimiento"] is None
    assert movimiento["estado"] == "activo"


def test_prestamo_socio_con_impacto_en_caja_genera_ingreso(client, db_conn, seed_venta_basica):
    participante = _crear_participante(client, "Ángel préstamo", "persona")

    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 100000,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    data = _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "prestamo_socio",
        monto=500000,
        impacta_caja=True,
        medio_pago="efectivo",
    )

    movimiento = _get_movimiento(db_conn, data["movimiento_id"])
    assert movimiento["impacta_caja"] is True
    assert movimiento["id_caja_movimiento"] == data["caja_movimiento_id"]

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "ingreso"
        and m["origen_tipo"] == "capital_retiros"
        and m["origen_id"] == data["movimiento_id"]
    ]

    assert len(ingresos) == 1
    assert _dec(ingresos[0]["monto"]) == Decimal("500000.00")
    assert ingresos[0]["submedio"] == "efectivo"


def test_retiro_personal_con_impacto_en_caja_genera_egreso(client, db_conn, seed_venta_basica):
    participante = _crear_participante(client, "Ale retiro", "persona")

    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 300000,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    data = _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "retiro_personal",
        monto=70000,
        impacta_caja=True,
        medio_pago="efectivo",
    )

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    egresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "egreso"
        and m["origen_tipo"] == "capital_retiros"
        and m["origen_id"] == data["movimiento_id"]
    ]

    assert len(egresos) == 1
    assert _dec(egresos[0]["monto"]) == Decimal("70000.00")


def test_devolucion_prestamo_con_impacto_en_caja_genera_egreso(client, db_conn, seed_venta_basica):
    participante = _crear_participante(client, "Ale devolucion caja", "persona")

    _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "prestamo_socio",
        monto=120000,
        impacta_caja=False,
        medio_pago="transferencia",
    )

    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 150000,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    data = _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "devolucion_prestamo",
        monto=65000,
        impacta_caja=True,
        medio_pago="transferencia",
    )

    movimiento = _get_movimiento(db_conn, data["movimiento_id"])
    assert movimiento["impacta_caja"] is True
    assert movimiento["id_caja_movimiento"] == data["caja_movimiento_id"]

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    egresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "egreso"
        and m["origen_tipo"] == "capital_retiros"
        and m["origen_id"] == data["movimiento_id"]
    ]

    assert len(egresos) == 1
    assert _dec(egresos[0]["monto"]) == Decimal("65000.00")
    assert egresos[0]["submedio"] == "transferencia"


def test_no_permite_devolver_mas_prestamo_que_saldo(client, seed_venta_basica):
    participante = _crear_participante(client, "Ale saldo préstamo", "persona")

    _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "prestamo_socio",
        monto=100000,
        impacta_caja=False,
        medio_pago="transferencia",
    )

    response = client.post(
        "/capital-retiros/movimientos",
        json={
            "id_participante": participante["id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "tipo_movimiento": "devolucion_prestamo",
            "descripcion": "Devolución excesiva",
            "monto": 150000,
            "medio_pago": "transferencia",
            "impacta_caja": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "supera el saldo" in response.json()["detail"].lower()


def test_resumen_capital_retiros(client, seed_venta_basica):
    participante = _crear_participante(client, "Ángel resumen", "persona")

    _crear_movimiento(client, seed_venta_basica, participante["id"], "aporte_capital", monto=200000, impacta_caja=False)
    _crear_movimiento(client, seed_venta_basica, participante["id"], "prestamo_socio", monto=300000, impacta_caja=False)
    _crear_movimiento(client, seed_venta_basica, participante["id"], "devolucion_prestamo", monto=100000, impacta_caja=False)
    _crear_movimiento(client, seed_venta_basica, participante["id"], "retiro_personal", monto=50000, impacta_caja=False)

    response = client.get("/capital-retiros/resumen", params={"id_participante": participante["id"]})
    assert response.status_code == 200, response.text

    resumen = response.json()
    assert Decimal(resumen["total_aportes"]) == Decimal("200000.00")
    assert Decimal(resumen["total_prestamos"]) == Decimal("300000.00")
    assert Decimal(resumen["total_devoluciones_prestamo"]) == Decimal("100000.00")
    assert Decimal(resumen["saldo_prestamos"]) == Decimal("200000.00")
    assert Decimal(resumen["total_retiros"]) == Decimal("50000.00")


def test_anula_movimiento_con_caja_genera_compensatorio(client, db_conn, seed_venta_basica):
    participante = _crear_participante(client, "Ale anulación", "persona")

    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 100000,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    creado = _crear_movimiento(
        client,
        seed_venta_basica,
        participante["id"],
        "prestamo_socio",
        monto=90000,
        impacta_caja=True,
        medio_pago="efectivo",
    )

    anular = client.post(
        f"/capital-retiros/movimientos/{creado['movimiento_id']}/anular",
        json={
            "motivo": "Carga duplicada",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    movimiento = _get_movimiento(db_conn, creado["movimiento_id"])
    assert movimiento["estado"] == "anulado"

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    ingresos = [m for m in movimientos_caja if m["tipo_movimiento"] == "ingreso" and m["origen_tipo"] == "capital_retiros"]
    egresos_comp = [m for m in movimientos_caja if m["tipo_movimiento"] == "egreso" and m["origen_tipo"] == "capital_retiros_anulacion"]

    assert len(ingresos) == 1
    assert len(egresos_comp) == 1
    assert _dec(egresos_comp[0]["monto"]) == Decimal("90000.00")


def test_perfil_participante_capital_retiros(client, seed_venta_basica):
    participante = _crear_participante(client, "Ángel perfil", "persona")

    _crear_movimiento(client, seed_venta_basica, participante["id"], "aporte_capital", monto=100000, impacta_caja=False)
    _crear_movimiento(client, seed_venta_basica, participante["id"], "prestamo_socio", monto=300000, impacta_caja=False)
    _crear_movimiento(client, seed_venta_basica, participante["id"], "devolucion_prestamo", monto=80000, impacta_caja=False)
    _crear_movimiento(client, seed_venta_basica, participante["id"], "retiro_personal", monto=50000, impacta_caja=False)

    response = client.get(f"/capital-retiros/participantes/{participante['id']}/perfil")
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["participante"]["id"] == participante["id"]
    assert data["participante"]["nombre"] == "Ángel perfil"

    resumen = data["resumen"]
    assert Decimal(resumen["total_aportes"]) == Decimal("100000.00")
    assert Decimal(resumen["total_prestamos"]) == Decimal("300000.00")
    assert Decimal(resumen["total_devoluciones_prestamo"]) == Decimal("80000.00")
    assert Decimal(resumen["saldo_prestamo"]) == Decimal("220000.00")
    assert Decimal(resumen["total_retiros"]) == Decimal("50000.00")

    movimientos = data["movimientos"]
    assert len(movimientos) == 4
    assert all(m["id_participante"] == participante["id"] for m in movimientos)


def test_perfil_participante_sin_movimientos_devuelve_ceros(client, seed_venta_basica):
    participante = _crear_participante(client, "Fondo perfil sin movimientos", "fondo")

    response = client.get(f"/capital-retiros/participantes/{participante['id']}/perfil")
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["participante"]["id"] == participante["id"]
    assert Decimal(data["resumen"]["saldo_prestamo"]) == Decimal("0")
    assert Decimal(data["resumen"]["total_aportes"]) == Decimal("0")
    assert data["movimientos"] == []
