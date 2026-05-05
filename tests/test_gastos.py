from decimal import Decimal

from tests.conftest import get_caja_movimientos


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _crear_categoria(client, nombre="Luz"):
    response = client.post(
        "/gastos/categorias",
        json={"nombre": nombre},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _get_gasto(conn, gasto_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM gastos_operativos
            WHERE id = %s
            """,
            (gasto_id,),
        )
        return cur.fetchone()


def _get_gasto_movimientos(conn, gasto_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM gastos_movimientos
            WHERE id_gasto = %s
            ORDER BY id
            """,
            (gasto_id,),
        )
        return cur.fetchall()


def test_crea_categoria_de_gasto(client, db_conn, seed_venta_basica):
    response = client.post(
        "/gastos/categorias",
        json={"nombre": "Internet"},
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["nombre"] == "Internet"
    assert data["activa"] is True


def test_crea_gasto_sin_impactar_caja(client, db_conn, seed_venta_basica):
    categoria = _crear_categoria(client, "Internet")

    response = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Pago internet local",
            "monto": 30000,
            "medio_pago": "transferencia",
            "impacta_caja": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["caja_movimiento_id"] is None

    gasto = _get_gasto(db_conn, data["gasto_id"])
    assert gasto is not None
    assert gasto["descripcion"] == "Pago internet local"
    assert _dec(gasto["monto"]) == Decimal("30000.00")
    assert gasto["impacta_caja"] is False
    assert gasto["id_caja_movimiento"] is None
    assert gasto["estado"] == "activo"

    movimientos = _get_gasto_movimientos(db_conn, data["gasto_id"])
    assert len(movimientos) == 1
    assert movimientos[0]["tipo_movimiento"] == "creacion"
    assert _dec(movimientos[0]["monto"]) == Decimal("30000.00")


def test_crea_gasto_con_impacto_en_caja(client, db_conn, seed_venta_basica):
    categoria = _crear_categoria(client, "Herramientas")

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

    response = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Compra llave pedalera",
            "monto": 15000,
            "medio_pago": "efectivo",
            "impacta_caja": True,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["ok"] is True
    assert data["caja_movimiento_id"] is not None

    gasto = _get_gasto(db_conn, data["gasto_id"])
    assert gasto["impacta_caja"] is True
    assert gasto["id_caja_movimiento"] == data["caja_movimiento_id"]

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)
    egresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "egreso"
        and m["origen_tipo"] == "gasto_operativo"
        and m["origen_id"] == data["gasto_id"]
    ]

    assert len(egresos) == 1
    assert _dec(egresos[0]["monto"]) == Decimal("15000.00")
    assert egresos[0]["submedio"] == "efectivo"


def test_no_permite_gasto_con_impacto_caja_si_no_hay_caja_abierta(
    client,
    seed_venta_basica,
):
    categoria = _crear_categoria(client, "Combustible")

    response = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Nafta para reparto",
            "monto": 10000,
            "medio_pago": "efectivo",
            "impacta_caja": True,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "no hay caja abierta" in response.json()["detail"].lower()


def test_anula_gasto_sin_caja(client, db_conn, seed_venta_basica):
    categoria = _crear_categoria(client, "Marketing")

    crear = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Publicidad Instagram",
            "monto": 12000,
            "medio_pago": "transferencia",
            "impacta_caja": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear.status_code == 200, crear.text
    gasto_id = crear.json()["gasto_id"]

    anular = client.post(
        f"/gastos/{gasto_id}/anular",
        json={
            "motivo": "Carga duplicada",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert anular.status_code == 200, anular.text

    gasto = _get_gasto(db_conn, gasto_id)
    assert gasto["estado"] == "anulado"

    movimientos = _get_gasto_movimientos(db_conn, gasto_id)
    tipos = [m["tipo_movimiento"] for m in movimientos]

    assert tipos == ["creacion", "anulacion"]


def test_anula_gasto_con_caja_y_genera_ingreso_compensatorio(
    client,
    db_conn,
    seed_venta_basica,
):
    categoria = _crear_categoria(client, "Luz")

    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 50000,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    crear = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Pago luz local",
            "monto": 20000,
            "medio_pago": "efectivo",
            "impacta_caja": True,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear.status_code == 200, crear.text
    gasto_id = crear.json()["gasto_id"]

    anular = client.post(
        f"/gastos/{gasto_id}/anular",
        json={
            "motivo": "Factura cargada por error",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    gasto = _get_gasto(db_conn, gasto_id)
    assert gasto["estado"] == "anulado"

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)

    egresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "egreso"
        and m["origen_tipo"] == "gasto_operativo"
        and m["origen_id"] == gasto_id
    ]

    ingresos_compensatorios = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "ingreso"
        and m["origen_tipo"] == "gasto_operativo_anulacion"
        and m["origen_id"] == gasto_id
    ]

    assert len(egresos) == 1
    assert len(ingresos_compensatorios) == 1
    assert _dec(egresos[0]["monto"]) == Decimal("20000.00")
    assert _dec(ingresos_compensatorios[0]["monto"]) == Decimal("20000.00")


def test_corrige_gasto_sin_caja(client, db_conn, seed_venta_basica):
    categoria = _crear_categoria(client, "Impuestos")

    crear = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Impuesto municipal",
            "monto": 18000,
            "medio_pago": "transferencia",
            "impacta_caja": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear.status_code == 200, crear.text
    gasto_id = crear.json()["gasto_id"]

    corregir = client.post(
        f"/gastos/{gasto_id}/corregir",
        json={
            "descripcion": "Impuesto municipal corregido",
            "monto": 19000,
            "id_categoria_gasto": categoria["id"],
            "medio_pago": "transferencia",
            "motivo": "Monto real de factura",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert corregir.status_code == 200, corregir.text

    gasto = _get_gasto(db_conn, gasto_id)
    assert gasto["descripcion"] == "Impuesto municipal corregido"
    assert _dec(gasto["monto"]) == Decimal("19000.00")

    movimientos = _get_gasto_movimientos(db_conn, gasto_id)
    assert len(movimientos) == 2
    assert movimientos[1]["tipo_movimiento"] == "correccion"


def test_corrige_gasto_con_caja_y_genera_movimiento_por_diferencia(
    client,
    db_conn,
    seed_venta_basica,
):
    categoria = _crear_categoria(client, "Envios")

    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 80000,
        },
    )
    assert abrir.status_code == 200, abrir.text
    caja_id = abrir.json()["caja_id"]

    crear = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Envío proveedor",
            "monto": 10000,
            "medio_pago": "efectivo",
            "impacta_caja": True,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear.status_code == 200, crear.text
    gasto_id = crear.json()["gasto_id"]

    corregir = client.post(
        f"/gastos/{gasto_id}/corregir",
        json={
            "descripcion": "Envío proveedor corregido",
            "monto": 13000,
            "id_categoria_gasto": categoria["id"],
            "medio_pago": "efectivo",
            "motivo": "Se agregó seguro de envío",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert corregir.status_code == 200, corregir.text

    movimientos_caja = get_caja_movimientos(db_conn, caja_id)

    egresos = [
        m for m in movimientos_caja
        if m["tipo_movimiento"] == "egreso"
        and m["origen_id"] == gasto_id
    ]

    assert len(egresos) == 2
    assert _dec(egresos[0]["monto"]) == Decimal("10000.00")
    assert _dec(egresos[1]["monto"]) == Decimal("3000.00")
    assert egresos[1]["origen_tipo"] == "gasto_operativo_correccion"


def test_no_permite_corregir_gasto_anulado(client, seed_venta_basica):
    categoria = _crear_categoria(client, "Otros")

    crear = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Gasto mal cargado",
            "monto": 5000,
            "medio_pago": "transferencia",
            "impacta_caja": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert crear.status_code == 200, crear.text
    gasto_id = crear.json()["gasto_id"]

    anular = client.post(
        f"/gastos/{gasto_id}/anular",
        json={
            "motivo": "No correspondía",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    corregir = client.post(
        f"/gastos/{gasto_id}/corregir",
        json={
            "descripcion": "Intento corregir anulado",
            "monto": 6000,
            "id_categoria_gasto": categoria["id"],
            "medio_pago": "transferencia",
            "motivo": "No debería dejar",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert corregir.status_code == 400
    assert "gasto anulado" in corregir.json()["detail"].lower()