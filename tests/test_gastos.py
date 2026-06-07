from decimal import Decimal


def _dec(value) -> Decimal:
    return Decimal(str(value))


def _crear_categoria(client, nombre="Servicios"):
    response = client.post(
        "/gastos/categorias",
        json={"nombre": nombre},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _crear_gasto(
    client,
    seed_venta_basica,
    *,
    categoria_id=None,
    descripcion="Gasto prueba",
    monto=10000,
    medio_pago="transferencia",
    impacta_caja=False,
    fecha=None,
    periodo_mes=None,
    es_recurrente=False,
):
    payload = {
        "id_sucursal": seed_venta_basica["sucursal_id"],
        "id_categoria_gasto": categoria_id,
        "descripcion": descripcion,
        "monto": monto,
        "medio_pago": medio_pago,
        "impacta_caja": impacta_caja,
        "es_recurrente": es_recurrente,
        "id_usuario": seed_venta_basica["usuario_id"],
    }

    if fecha is not None:
        payload["fecha"] = fecha

    if periodo_mes is not None:
        payload["periodo_mes"] = periodo_mes

    response = client.post("/gastos/", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_edita_categoria_de_gasto(client, seed_venta_basica):
    categoria = _crear_categoria(client, "Servicios varios")

    response = client.put(
        f"/gastos/categorias/{categoria['id']}",
        json={
            "nombre": "Servicios del local",
            "activa": True,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == categoria["id"]
    assert data["nombre"] == "Servicios del local"
    assert data["activa"] is True


def test_cambia_estado_categoria_y_lista_inactivas(client, seed_venta_basica):
    categoria = _crear_categoria(client, "Categoria temporal")

    desactivar = client.patch(
        f"/gastos/categorias/{categoria['id']}/estado",
        json={"activa": False},
    )
    assert desactivar.status_code == 200, desactivar.text
    assert desactivar.json()["ok"] is True
    assert desactivar.json()["categoria_id"] == categoria["id"]
    assert desactivar.json()["activa"] is False

    activas = client.get("/gastos/categorias")
    assert activas.status_code == 200, activas.text
    ids_activas = [item["id"] for item in activas.json()]
    assert categoria["id"] not in ids_activas

    todas = client.get("/gastos/categorias", params={"incluir_inactivas": True})
    assert todas.status_code == 200, todas.text
    cat = next(item for item in todas.json() if item["id"] == categoria["id"])
    assert cat["activa"] is False

    activar = client.patch(
        f"/gastos/categorias/{categoria['id']}/estado",
        json={"activa": True},
    )
    assert activar.status_code == 200, activar.text
    assert activar.json()["activa"] is True


def test_no_permite_crear_gasto_con_categoria_inactiva(client, seed_venta_basica):
    categoria = _crear_categoria(client, "Categoria bloqueada")

    desactivar = client.patch(
        f"/gastos/categorias/{categoria['id']}/estado",
        json={"activa": False},
    )
    assert desactivar.status_code == 200, desactivar.text

    response = client.post(
        "/gastos/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_categoria_gasto": categoria["id"],
            "descripcion": "Gasto con categoria inactiva",
            "monto": 10000,
            "medio_pago": "transferencia",
            "impacta_caja": False,
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )

    assert response.status_code == 400
    assert "inactiva" in response.json()["detail"].lower()


def test_listar_gastos_filtra_por_estado_categoria_medio_y_busqueda(
    client,
    seed_venta_basica,
):
    categoria_luz = _crear_categoria(client, "Luz filtros")
    categoria_envios = _crear_categoria(client, "Envios filtros")

    gasto_luz = _crear_gasto(
        client,
        seed_venta_basica,
        categoria_id=categoria_luz["id"],
        descripcion="Pago luz local filtros",
        monto=20000,
        medio_pago="transferencia",
        fecha="2026-06-01",
    )["gasto_id"]

    _crear_gasto(
        client,
        seed_venta_basica,
        categoria_id=categoria_envios["id"],
        descripcion="Envio proveedor filtros",
        monto=15000,
        medio_pago="efectivo",
        fecha="2026-06-02",
    )

    anular = client.post(
        f"/gastos/{gasto_luz}/anular",
        json={
            "motivo": "Carga duplicada para filtro",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    filtrados_categoria = client.get(
        "/gastos/",
        params={"id_categoria_gasto": categoria_envios["id"]},
    )
    assert filtrados_categoria.status_code == 200, filtrados_categoria.text
    assert len(filtrados_categoria.json()) == 1
    assert filtrados_categoria.json()[0]["categoria_nombre"] == "Envios filtros"

    filtrados_estado = client.get("/gastos/", params={"estado": "anulado"})
    assert filtrados_estado.status_code == 200, filtrados_estado.text
    ids_anulados = [item["id"] for item in filtrados_estado.json()]
    assert gasto_luz in ids_anulados

    filtrados_medio = client.get("/gastos/", params={"medio_pago": "efectivo"})
    assert filtrados_medio.status_code == 200, filtrados_medio.text
    assert all(item["medio_pago"] == "efectivo" for item in filtrados_medio.json())

    filtrados_q = client.get("/gastos/", params={"q": "proveedor filtros"})
    assert filtrados_q.status_code == 200, filtrados_q.text
    assert len(filtrados_q.json()) == 1
    assert "Envio proveedor filtros" in filtrados_q.json()[0]["descripcion"]


def test_listar_gastos_filtra_por_fecha_periodo_recurrente_e_impacta_caja(
    client,
    seed_venta_basica,
):
    categoria = _crear_categoria(client, "Filtros fecha")

    _crear_gasto(
        client,
        seed_venta_basica,
        categoria_id=categoria["id"],
        descripcion="Gasto viejo filtros fecha",
        monto=9000,
        medio_pago="transferencia",
        fecha="2026-05-10",
        periodo_mes="2026-05-01",
        es_recurrente=False,
    )

    gasto_junio = _crear_gasto(
        client,
        seed_venta_basica,
        categoria_id=categoria["id"],
        descripcion="Gasto junio recurrente filtros fecha",
        monto=11000,
        medio_pago="transferencia",
        fecha="2026-06-10",
        periodo_mes="2026-06-01",
        es_recurrente=True,
    )["gasto_id"]

    por_fecha = client.get(
        "/gastos/",
        params={
            "fecha_desde": "2026-06-01",
            "fecha_hasta": "2026-06-30",
        },
    )
    assert por_fecha.status_code == 200, por_fecha.text
    ids_fecha = [item["id"] for item in por_fecha.json()]
    assert gasto_junio in ids_fecha

    por_periodo = client.get("/gastos/", params={"periodo_mes": "2026-06-01"})
    assert por_periodo.status_code == 200, por_periodo.text
    ids_periodo = [item["id"] for item in por_periodo.json()]
    assert gasto_junio in ids_periodo

    recurrentes = client.get("/gastos/", params={"es_recurrente": True})
    assert recurrentes.status_code == 200, recurrentes.text
    ids_recurrentes = [item["id"] for item in recurrentes.json()]
    assert gasto_junio in ids_recurrentes

    sin_caja = client.get("/gastos/", params={"impacta_caja": False})
    assert sin_caja.status_code == 200, sin_caja.text
    assert all(item["impacta_caja"] is False for item in sin_caja.json())


def test_resumen_gastos_respeta_filtros_y_separa_activos_anulados(
    client,
    seed_venta_basica,
):
    categoria = _crear_categoria(client, "Resumen filtros")

    gasto_anulado = _crear_gasto(
        client,
        seed_venta_basica,
        categoria_id=categoria["id"],
        descripcion="Resumen gasto anulado",
        monto=10000,
        medio_pago="transferencia",
        fecha="2026-06-05",
    )["gasto_id"]

    _crear_gasto(
        client,
        seed_venta_basica,
        categoria_id=categoria["id"],
        descripcion="Resumen gasto activo",
        monto=25000,
        medio_pago="transferencia",
        fecha="2026-06-06",
    )

    anular = client.post(
        f"/gastos/{gasto_anulado}/anular",
        json={
            "motivo": "Anulado para resumen",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert anular.status_code == 200, anular.text

    response = client.get(
        "/gastos/resumen",
        params={"id_categoria_gasto": categoria["id"]},
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert _dec(data["total"]) == Decimal("35000.00")
    assert data["cantidad"] == 2
    assert _dec(data["total_activos"]) == Decimal("25000.00")
    assert data["cantidad_activos"] == 1
    assert _dec(data["total_anulados"]) == Decimal("10000.00")
    assert data["cantidad_anulados"] == 1


def test_filtros_invalidos_devuelven_400(client, seed_venta_basica):
    estado = client.get("/gastos/", params={"estado": "borrado"})
    assert estado.status_code == 400
    assert "estado" in estado.json()["detail"].lower()

    medio = client.get("/gastos/", params={"medio_pago": "cheque"})
    assert medio.status_code == 400
    assert "medio_pago" in medio.json()["detail"].lower()

    fechas = client.get(
        "/gastos/",
        params={
            "fecha_desde": "2026-07-01",
            "fecha_hasta": "2026-06-01",
        },
    )
    assert fechas.status_code == 400
    assert "fecha_desde" in fechas.json()["detail"].lower()


def test_normaliza_textos_al_crear_y_editar_categoria_y_gasto(
    client,
    seed_venta_basica,
):
    categoria = _crear_categoria(client, "   Categoria    Normalizada   ")
    assert categoria["nombre"] == "Categoria Normalizada"

    editada = client.put(
        f"/gastos/categorias/{categoria['id']}",
        json={"nombre": "   Categoria    Editada   ", "activa": True},
    )
    assert editada.status_code == 200, editada.text
    assert editada.json()["nombre"] == "Categoria Editada"

    gasto_id = _crear_gasto(
        client,
        seed_venta_basica,
        categoria_id=categoria["id"],
        descripcion="   Gasto     con    espacios   ",
        monto=7000,
        medio_pago="transferencia",
    )["gasto_id"]

    detalle = client.get(f"/gastos/{gasto_id}")
    assert detalle.status_code == 200, detalle.text
    assert detalle.json()["gasto"]["descripcion"] == "Gasto con espacios"
