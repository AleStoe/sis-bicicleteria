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

    assert cliente["nombre"] == "BICICLETERIA FISCAL TEST"
    assert cliente["tipo_cliente"] == "mayorista"
    assert cliente["condicion_iva"] == "responsable_inscripto"
    assert cliente["cuit"] == "30-12345678-9"
    assert cliente["razon_social"] == "BICICLETERIA FISCAL TEST SRL"


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

    assert cliente["nombre"] == "CLIENTE FISCAL ACTUALIZADO"
    assert cliente["telefono"] == "2912222222"
    assert cliente["tipo_cliente"] == "mayorista"
    assert cliente["condicion_iva"] == "responsable_inscripto"
    assert cliente["cuit"] == "30-22222222-2"
    assert cliente["razon_social"] == "CLIENTE FISCAL ACTUALIZADO SRL"


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
        c["razon_social"] == "RAZON SOCIAL BUSCABLE SA"
        for c in por_razon_social.json()
    )


def test_crear_bicicleta_cliente_permite_datos_minimos(client, clean_db):
    crear_cliente = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Bici Minima",
            "telefono": "2915551111",
            "tipo_cliente": "minorista",
        },
    )
    assert crear_cliente.status_code == 200, crear_cliente.text
    cliente_id = crear_cliente.json()["cliente_id"]

    crear_bici = client.post(
        f"/clientes/{cliente_id}/bicicletas",
        json={
            "marca": "venzo",
        },
    )

    assert crear_bici.status_code == 201, crear_bici.text
    bicicleta = crear_bici.json()
    assert bicicleta["marca"] == "VENZO"
    assert bicicleta["modelo"] is None

    listado = client.get(f"/clientes/{cliente_id}/bicicletas")
    assert listado.status_code == 200, listado.text
    assert any(item["id"] == bicicleta["id"] for item in listado.json())


def test_actualizar_bicicleta_cliente_normaliza_y_valida_pertenencia(client, clean_db):
    cliente_a = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Bici Update A",
            "telefono": "2915552222",
            "tipo_cliente": "minorista",
        },
    )
    assert cliente_a.status_code == 200, cliente_a.text
    cliente_a_id = cliente_a.json()["cliente_id"]

    cliente_b = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Bici Update B",
            "telefono": "2915553333",
            "tipo_cliente": "minorista",
        },
    )
    assert cliente_b.status_code == 200, cliente_b.text
    cliente_b_id = cliente_b.json()["cliente_id"]

    crear_bici = client.post(
        f"/clientes/{cliente_a_id}/bicicletas",
        json={
            "marca": "venzo",
            "modelo": "raptor",
            "color": "negra",
        },
    )
    assert crear_bici.status_code == 201, crear_bici.text
    bicicleta_id = crear_bici.json()["id"]

    editar = client.patch(
        f"/clientes/{cliente_a_id}/bicicletas/{bicicleta_id}",
        json={
            "marca": "  trek ",
            "modelo": " marlin 5 ",
            "rodado": "29",
            "color": " rojo mate ",
            "numero_cuadro": "abc123",
            "notas": "Se respeta libre",
        },
    )
    assert editar.status_code == 200, editar.text
    bicicleta = editar.json()
    assert bicicleta["marca"] == "TREK"
    assert bicicleta["modelo"] == "MARLIN 5"
    assert bicicleta["color"] == "ROJO MATE"
    assert bicicleta["numero_cuadro"] == "ABC123"
    assert bicicleta["notas"] == "Se respeta libre"

    no_pertenece = client.patch(
        f"/clientes/{cliente_b_id}/bicicletas/{bicicleta_id}",
        json={
            "marca": "otra",
        },
    )
    assert no_pertenece.status_code == 404


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

def test_historial_bicicleta_cliente_devuelve_taller_y_venta_origen(client, db_conn, clean_db):
    crear_cliente = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Bici Historial",
            "telefono": "2915550000",
            "tipo_cliente": "minorista",
            "condicion_iva": "consumidor_final",
        },
    )
    assert crear_cliente.status_code == 200, crear_cliente.text
    cliente_id = crear_cliente.json()["cliente_id"]

    with db_conn.cursor() as cur:
        cur.execute("""
            INSERT INTO sucursales (
                nombre,
                activa
            )
            VALUES (
                'Sucursal Test Historial',
                TRUE
            )
            RETURNING id
        """)
        sucursal_id = cur.fetchone()["id"]

        cur.execute("""
            INSERT INTO usuarios (
                nombre,
                email,
                username,
                password_hash,
                activo
            )
            VALUES (
                'Usuario Test Historial',
                'historial@test.com',
                'usuario_historial',
                'hash_test',
                TRUE
            )
            RETURNING id
        """)
        usuario_id = cur.fetchone()["id"]

        cur.execute("""
            INSERT INTO ventas (
                id_sucursal,
                id_cliente,
                estado,
                subtotal_base,
                descuento_total,
                recargo_total,
                total_final,
                saldo_pendiente,
                id_usuario_creador
            )
            VALUES (
                %s,
                %s,
                'entregada',
                100000,
                0,
                0,
                100000,
                0,
                %s
            )
            RETURNING id
        """, (
            sucursal_id,
            cliente_id,
            usuario_id,
        ))
        venta_id = cur.fetchone()["id"]

        cur.execute("""
            INSERT INTO bicicletas_clientes (
                id_cliente,
                id_venta_origen,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            )
            VALUES (
                %s,
                %s,
                'Venzo',
                'Raptor',
                '29',
                'Negra',
                'ABC123',
                'Bici de prueba historial'
            )
            RETURNING id
        """, (
            cliente_id,
            venta_id,
        ))
        bicicleta_id = cur.fetchone()["id"]

        cur.execute("""
            INSERT INTO ordenes_taller (
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                observaciones,
                total_final,
                saldo_pendiente,
                id_usuario
            )
            VALUES (
                %s,
                %s,
                %s,
                'ingresada',
                'Hace ruido la transmisión',
                'Revisar cadena y piñón',
                15000,
                15000,
                %s
            )
            RETURNING id
        """, (
            sucursal_id,
            cliente_id,
            bicicleta_id,
            usuario_id,
        ))
        orden_id = cur.fetchone()["id"]

    db_conn.commit()

    response = client.get(
        f"/clientes/{cliente_id}/bicicletas/{bicicleta_id}/historial"
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["bicicleta"]["id"] == bicicleta_id
    assert data["bicicleta"]["id_venta_origen"] == venta_id

    assert data["venta_origen"]["id"] == venta_id
    assert data["venta_origen"]["estado"] == "entregada"

    assert len(data["historial_taller"]) == 1

    assert data["historial_taller"][0]["id"] == orden_id

    assert (
        data["historial_taller"][0]["problema_reportado"]
        == "Hace ruido la transmisión"
    )
