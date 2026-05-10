def test_crear_cliente_con_datos_fiscales(client, db_conn, clean_db):
    response = client.post(
        "/clientes/",
        json={
            "nombre": "Bicicleteria Fiscal Test",
            "telefono": "2915555555",
            "dni": "30111222",
            "direccion": "Calle Test 123",
            "tipo_cliente": "mayorista",
            "condicion_iva": "responsable_inscripto",
            "cuit": "30-12345678-9",
            "razon_social": "Bicicleteria Fiscal Test SRL",
            "notas": "Cliente fiscal test",
        },
    )

    assert response.status_code == 200, response.text
    cliente_id = response.json()["cliente_id"]

    detalle = client.get(f"/clientes/{cliente_id}")
    assert detalle.status_code == 200, detalle.text

    cliente = detalle.json()["cliente"]

    assert cliente["nombre"] == "Bicicleteria Fiscal Test"
    assert cliente["tipo_cliente"] == "mayorista"
    assert cliente["condicion_iva"] == "responsable_inscripto"
    assert cliente["cuit"] == "30-12345678-9"
    assert cliente["razon_social"] == "Bicicleteria Fiscal Test SRL"


def test_actualizar_cliente_cambia_datos_fiscales(client, db_conn, clean_db):
    crear = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Fiscal",
            "telefono": "2911111111",
            "tipo_cliente": "minorista",
            "condicion_iva": "monotributo",
            "cuit": "20-11111111-1",
            "razon_social": "Cliente Fiscal Inicial",
        },
    )

    assert crear.status_code == 200, crear.text
    cliente_id = crear.json()["cliente_id"]

    actualizar = client.put(
        f"/clientes/{cliente_id}",
        json={
            "nombre": "Cliente Fiscal Actualizado",
            "telefono": "2912222222",
            "dni": "22222222",
            "direccion": "Nueva direccion 456",
            "tipo_cliente": "mayorista",
            "condicion_iva": "responsable_inscripto",
            "cuit": "30-22222222-2",
            "razon_social": "Cliente Fiscal Actualizado SRL",
            "notas": "Actualizado fiscalmente",
            "activo": True,
        },
    )

    assert actualizar.status_code == 200, actualizar.text

    detalle = client.get(f"/clientes/{cliente_id}")
    assert detalle.status_code == 200, detalle.text

    cliente = detalle.json()["cliente"]

    assert cliente["nombre"] == "Cliente Fiscal Actualizado"
    assert cliente["telefono"] == "2912222222"
    assert cliente["tipo_cliente"] == "mayorista"
    assert cliente["condicion_iva"] == "responsable_inscripto"
    assert cliente["cuit"] == "30-22222222-2"
    assert cliente["razon_social"] == "Cliente Fiscal Actualizado SRL"


def test_buscar_cliente_por_cuit_y_razon_social(client, clean_db):
    crear = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Busqueda Fiscal",
            "telefono": "2913333333",
            "tipo_cliente": "minorista",
            "condicion_iva": "responsable_inscripto",
            "cuit": "30-99999999-9",
            "razon_social": "Razon Social Buscable SA",
        },
    )

    assert crear.status_code == 200, crear.text

    por_cuit = client.get("/clientes/?q=99999999")
    assert por_cuit.status_code == 200, por_cuit.text
    assert any(c["cuit"] == "30-99999999-9" for c in por_cuit.json())

    por_razon_social = client.get("/clientes/?q=Buscable")
    assert por_razon_social.status_code == 200, por_razon_social.text
    assert any(
        c["razon_social"] == "Razon Social Buscable SA"
        for c in por_razon_social.json()
    )


def test_rechaza_condicion_iva_invalida(client, clean_db):
    response = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente IVA Malo",
            "telefono": "2914444444",
            "tipo_cliente": "minorista",
            "condicion_iva": "iva_inventado",
        },
    )

    assert response.status_code == 422