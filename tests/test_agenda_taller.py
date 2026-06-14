def _crear_sucursal_y_usuario(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sucursales (
                nombre,
                activa
            )
            VALUES (
                'Sucursal Agenda Test',
                TRUE
            )
            RETURNING id
            """
        )
        sucursal_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO usuarios (
                nombre,
                email,
                username,
                password_hash,
                activo
            )
            VALUES (
                'Usuario Agenda Test',
                'agenda@test.com',
                'usuario_agenda',
                'hash_test',
                TRUE
            )
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]

    db_conn.commit()

    return sucursal_id, usuario_id


def test_crear_turno_agenda_taller(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    response = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "cliente_nombre": "Cliente Agenda",
            "cliente_telefono": "2915551234",
            "fecha": "2026-06-20",
            "hora_inicio": "09:30:00",
            "hora_fin": "10:00:00",
            "tipo_servicio": "Service transmisión",
            "descripcion": "Revisar cambios y cadena",
            "notas": "Cliente pasa temprano",
            "id_usuario_creador": usuario_id,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["id"] > 0
    assert data["id_sucursal"] == sucursal_id
    assert data["cliente_nombre"] == "Cliente Agenda"
    assert data["cliente_telefono"] == "2915551234"
    assert data["fecha"] == "2026-06-20"
    assert data["hora_inicio"] == "09:30:00"
    assert data["hora_fin"] == "10:00:00"
    assert data["tipo_servicio"] == "Service transmisión"
    assert data["descripcion"] == "Revisar cambios y cadena"
    assert data["notas"] == "Cliente pasa temprano"
    assert data["estado"] == "pendiente"
    assert data["id_usuario_creador"] == usuario_id


def test_listar_turnos_agenda_taller_por_rango_fecha(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "cliente_nombre": "Cliente Dentro",
            "cliente_telefono": "2911111111",
            "fecha": "2026-06-20",
            "hora_inicio": "09:00:00",
            "tipo_servicio": "Centrado rueda",
            "descripcion": "Rueda trasera",
            "id_usuario_creador": usuario_id,
        },
    )

    client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "cliente_nombre": "Cliente Fuera",
            "cliente_telefono": "2912222222",
            "fecha": "2026-07-05",
            "hora_inicio": "11:00:00",
            "tipo_servicio": "Frenos",
            "descripcion": "Regular freno delantero",
            "id_usuario_creador": usuario_id,
        },
    )

    response = client.get(
        "/agenda-taller/?fecha_desde=2026-06-01&fecha_hasta=2026-06-30"
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert len(data) == 1
    assert data[0]["cliente_nombre"] == "Cliente Dentro"
    assert data[0]["fecha"] == "2026-06-20"


def test_obtener_y_editar_turno_agenda_taller(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    crear = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "cliente_nombre": "Cliente Original",
            "cliente_telefono": "2913333333",
            "fecha": "2026-06-21",
            "hora_inicio": "10:00:00",
            "tipo_servicio": "Service básico",
            "descripcion": "Ajuste general",
            "id_usuario_creador": usuario_id,
        },
    )

    assert crear.status_code == 200, crear.text
    turno_id = crear.json()["id"]

    detalle = client.get(f"/agenda-taller/{turno_id}")
    assert detalle.status_code == 200, detalle.text
    assert detalle.json()["cliente_nombre"] == "Cliente Original"

    actualizar = client.put(
        f"/agenda-taller/{turno_id}",
        json={
            "id_cliente": None,
            "cliente_nombre": "Cliente Editado",
            "cliente_telefono": "2914444444",
            "fecha": "2026-06-22",
            "hora_inicio": "15:30:00",
            "hora_fin": "16:00:00",
            "tipo_servicio": "Service completo",
            "descripcion": "Cambiar cables y ajustar frenos",
            "notas": "Trae la bici a la tarde",
        },
    )

    assert actualizar.status_code == 200, actualizar.text

    data = actualizar.json()

    assert data["id"] == turno_id
    assert data["cliente_nombre"] == "Cliente Editado"
    assert data["cliente_telefono"] == "2914444444"
    assert data["fecha"] == "2026-06-22"
    assert data["hora_inicio"] == "15:30:00"
    assert data["hora_fin"] == "16:00:00"
    assert data["tipo_servicio"] == "Service completo"


def test_cambiar_estado_turno_agenda_taller(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    crear = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "cliente_nombre": "Cliente Estado",
            "cliente_telefono": "2915555555",
            "fecha": "2026-06-23",
            "hora_inicio": "12:00:00",
            "tipo_servicio": "Pinchadura",
            "descripcion": "Cambiar cámara",
            "id_usuario_creador": usuario_id,
        },
    )

    assert crear.status_code == 200, crear.text
    turno_id = crear.json()["id"]

    confirmado = client.patch(
        f"/agenda-taller/{turno_id}/estado",
        json={"estado": "confirmado"},
    )

    assert confirmado.status_code == 200, confirmado.text
    assert confirmado.json()["estado"] == "confirmado"

    cancelado = client.patch(
        f"/agenda-taller/{turno_id}/estado",
        json={"estado": "cancelado"},
    )

    assert cancelado.status_code == 200, cancelado.text
    assert cancelado.json()["estado"] == "cancelado"


def test_rechaza_estado_turno_agenda_invalido(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    crear = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "cliente_nombre": "Cliente Estado Malo",
            "cliente_telefono": "2916666666",
            "fecha": "2026-06-24",
            "hora_inicio": "13:00:00",
            "tipo_servicio": "Ajuste frenos",
            "descripcion": "Freno trasero",
            "id_usuario_creador": usuario_id,
        },
    )

    assert crear.status_code == 200, crear.text
    turno_id = crear.json()["id"]

    response = client.patch(
        f"/agenda-taller/{turno_id}/estado",
        json={"estado": "estado_inventado"},
    )

    assert response.status_code == 422


def test_agenda_taller_turno_no_encontrado(client, clean_db):
    response = client.get("/agenda-taller/999999")
    assert response.status_code == 404

def test_crear_turno_agenda_con_bicicleta_cliente(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    crear_cliente = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Agenda Bici",
            "telefono": "2917777777",
            "tipo_cliente": "minorista",
            "condicion_iva": "consumidor_final",
        },
    )
    assert crear_cliente.status_code == 200, crear_cliente.text
    cliente_id = crear_cliente.json()["cliente_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            )
            VALUES (
                %s,
                'Venzo',
                'Raptor',
                '29',
                'Negra',
                'AG123',
                'Bici para agenda'
            )
            RETURNING id
            """,
            (cliente_id,),
        )
        bicicleta_id = cur.fetchone()["id"]

    db_conn.commit()

    response = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": bicicleta_id,
            "cliente_nombre": "Cliente Agenda Bici",
            "cliente_telefono": "2917777777",
            "fecha": "2026-06-25",
            "hora_inicio": "09:30:00",
            "hora_fin": "10:00:00",
            "tipo_servicio": "Service completo",
            "descripcion": "Revisar transmisión completa",
            "notas": "Trae la bici temprano",
            "id_usuario_creador": usuario_id,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["id_cliente"] == cliente_id
    assert data["id_bicicleta_cliente"] == bicicleta_id
    assert data["id_orden_taller"] is None
    assert data["cliente_nombre"] == "Cliente Agenda Bici"
    assert data["estado"] == "pendiente"


def test_editar_turno_agenda_cambia_bicicleta_cliente(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    crear_cliente = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Agenda Edit Bici",
            "telefono": "2918888888",
            "tipo_cliente": "minorista",
            "condicion_iva": "consumidor_final",
        },
    )
    assert crear_cliente.status_code == 200, crear_cliente.text
    cliente_id = crear_cliente.json()["cliente_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            )
            VALUES (
                %s,
                'Topmega',
                'Thor',
                '29',
                'Roja',
                'THOR123',
                'Primera bici'
            )
            RETURNING id
            """,
            (cliente_id,),
        )
        bici_1 = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            )
            VALUES (
                %s,
                'Volta',
                'Zilant',
                '29',
                'Carbono',
                'ZILANT123',
                'Segunda bici'
            )
            RETURNING id
            """,
            (cliente_id,),
        )
        bici_2 = cur.fetchone()["id"]

    db_conn.commit()

    crear = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": bici_1,
            "cliente_nombre": "Cliente Agenda Edit Bici",
            "cliente_telefono": "2918888888",
            "fecha": "2026-06-26",
            "hora_inicio": "11:00:00",
            "tipo_servicio": "Ajuste inicial",
            "descripcion": "Revisar frenos",
            "id_usuario_creador": usuario_id,
        },
    )

    assert crear.status_code == 200, crear.text
    turno_id = crear.json()["id"]

    actualizar = client.put(
        f"/agenda-taller/{turno_id}",
        json={
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": bici_2,
            "cliente_nombre": "Cliente Agenda Edit Bici",
            "cliente_telefono": "2918888888",
            "fecha": "2026-06-27",
            "hora_inicio": "15:30:00",
            "hora_fin": "16:00:00",
            "tipo_servicio": "Service completo",
            "descripcion": "Cambiar a segunda bicicleta",
            "notas": "Ahora trabaja sobre Zilant",
        },
    )

    assert actualizar.status_code == 200, actualizar.text

    data = actualizar.json()

    assert data["id"] == turno_id
    assert data["id_cliente"] == cliente_id
    assert data["id_bicicleta_cliente"] == bici_2
    assert data["tipo_servicio"] == "Service completo"

def test_convertir_turno_agenda_a_orden_taller(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    crear_cliente = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Conversión Agenda",
            "telefono": "2919999999",
            "tipo_cliente": "minorista",
            "condicion_iva": "consumidor_final",
        },
    )

    assert crear_cliente.status_code == 200, crear_cliente.text
    cliente_id = crear_cliente.json()["cliente_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro
            )
            VALUES (
                %s,
                'Venzo',
                'Raptor',
                '29',
                'Negra',
                'CONVERT123'
            )
            RETURNING id
            """,
            (cliente_id,),
        )
        bicicleta_id = cur.fetchone()["id"]

    db_conn.commit()

    crear_turno = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": bicicleta_id,
            "cliente_nombre": "Cliente Conversión Agenda",
            "cliente_telefono": "2919999999",
            "fecha": "2026-07-01",
            "hora_inicio": "09:00:00",
            "tipo_servicio": "Service completo",
            "descripcion": "Revisar transmisión",
            "id_usuario_creador": usuario_id,
        },
    )

    assert crear_turno.status_code == 200, crear_turno.text

    turno_id = crear_turno.json()["id"]

    convertir = client.post(
        f"/agenda-taller/{turno_id}/convertir-orden",
        json={
            "id_usuario": usuario_id,
        },
    )

    assert convertir.status_code == 200, convertir.text

    data = convertir.json()

    assert data["ok"] is True
    assert data["turno_id"] == turno_id
    assert data["orden_id"] > 0
    assert data["estado_turno"] == "convertido_orden"

    detalle_turno = client.get(f"/agenda-taller/{turno_id}")

    assert detalle_turno.status_code == 200, detalle_turno.text

    turno = detalle_turno.json()

    assert turno["estado"] == "convertido_orden"
    assert turno["id_orden_taller"] == data["orden_id"]

def test_no_permite_convertir_turno_dos_veces(client, db_conn, clean_db):
    sucursal_id, usuario_id = _crear_sucursal_y_usuario(db_conn)

    crear_cliente = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Doble Conversión",
            "telefono": "2911231231",
            "tipo_cliente": "minorista",
            "condicion_iva": "consumidor_final",
        },
    )

    cliente_id = crear_cliente.json()["cliente_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro
            )
            VALUES (
                %s,
                'Topmega',
                'Thor',
                '29',
                'Roja',
                'DOBLE123'
            )
            RETURNING id
            """,
            (cliente_id,),
        )
        bicicleta_id = cur.fetchone()["id"]

    db_conn.commit()

    crear_turno = client.post(
        "/agenda-taller/",
        json={
            "id_sucursal": sucursal_id,
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": bicicleta_id,
            "cliente_nombre": "Cliente Doble Conversión",
            "cliente_telefono": "2911231231",
            "fecha": "2026-07-02",
            "hora_inicio": "10:00:00",
            "tipo_servicio": "Service",
            "descripcion": "Test doble conversión",
            "id_usuario_creador": usuario_id,
        },
    )

    turno_id = crear_turno.json()["id"]

    primera = client.post(
        f"/agenda-taller/{turno_id}/convertir-orden",
        json={
            "id_usuario": usuario_id,
        },
    )

    assert primera.status_code == 200, primera.text

    segunda = client.post(
        f"/agenda-taller/{turno_id}/convertir-orden",
        json={
            "id_usuario": usuario_id,
        },
    )

    assert segunda.status_code == 400