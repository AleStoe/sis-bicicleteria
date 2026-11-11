from datetime import date, timedelta
from decimal import Decimal

from app.modules.clientes.service import obtener_analisis_cliente_service
from app.modules.clientes.crm_service import _borrador_comunicacion_crm


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


def test_crear_cliente_legacy_con_nombre_sigue_funcionando(client, clean_db):
    response = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Legacy Nombre",
            "telefono": "2915557001",
            "tipo_cliente": "minorista",
        },
    )

    assert response.status_code == 200, response.text
    detalle = client.get(f"/clientes/{response.json()['cliente_id']}").json()["cliente"]

    assert detalle["nombre"] == "CLIENTE LEGACY NOMBRE"
    assert detalle["nombre_persona"] is None
    assert detalle["apellido"] is None


def test_crear_cliente_con_nombre_persona_apellido_genera_nombre(client, clean_db):
    response = client.post(
        "/clientes/",
        json={
            "nombre_persona": "Ana",
            "apellido": "Gomez",
            "telefono": "2915557002",
            "tipo_cliente": "minorista",
        },
    )

    assert response.status_code == 200, response.text
    detalle = client.get(f"/clientes/{response.json()['cliente_id']}").json()["cliente"]

    assert detalle["nombre_persona"] == "ANA"
    assert detalle["apellido"] == "GOMEZ"
    assert detalle["nombre"] == "ANA GOMEZ"


def test_editar_nombre_persona_apellido_actualiza_nombre_display(client, clean_db):
    crear = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Para Editar",
            "telefono": "2915557003",
            "tipo_cliente": "minorista",
        },
    )
    assert crear.status_code == 200, crear.text
    cliente_id = crear.json()["cliente_id"]

    actualizar = client.put(
        f"/clientes/{cliente_id}",
        json={
            "nombre": "Cliente Para Editar",
            "nombre_persona": "Marina",
            "apellido": "Lopez",
            "telefono": "2915557003",
            "dni": None,
            "direccion": None,
            "tipo_cliente": "minorista",
            "condicion_iva": "consumidor_final",
            "cuit": None,
            "razon_social": None,
            "notas": None,
            "activo": True,
        },
    )

    assert actualizar.status_code == 200, actualizar.text
    detalle = client.get(f"/clientes/{cliente_id}").json()["cliente"]

    assert detalle["nombre_persona"] == "MARINA"
    assert detalle["apellido"] == "LOPEZ"
    assert detalle["nombre"] == "MARINA LOPEZ"


def test_buscar_cliente_por_apellido_y_nombre_completo_generado(client, clean_db):
    crear = client.post(
        "/clientes/",
        json={
            "nombre_persona": "Lucia",
            "apellido": "Fernandez",
            "telefono": "2915557004",
            "tipo_cliente": "minorista",
        },
    )
    assert crear.status_code == 200, crear.text
    cliente_id = crear.json()["cliente_id"]

    por_apellido = client.get("/clientes/?q=Fernandez")
    assert por_apellido.status_code == 200, por_apellido.text
    assert any(cliente["id"] == cliente_id for cliente in por_apellido.json())

    por_completo = client.get("/clientes/?q=Lucia Fernandez")
    assert por_completo.status_code == 200, por_completo.text
    assert any(cliente["id"] == cliente_id for cliente in por_completo.json())


def test_listar_clientes_por_ultimos_dados_de_alta(client, clean_db):
    primero = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Primero",
            "telefono": "2915557101",
            "tipo_cliente": "minorista",
        },
    )
    segundo = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Segundo",
            "telefono": "2915557102",
            "tipo_cliente": "minorista",
        },
    )
    assert primero.status_code == 200, primero.text
    assert segundo.status_code == 200, segundo.text

    response = client.get("/clientes/?orden=recientes")
    assert response.status_code == 200, response.text
    clientes = response.json()

    assert clientes[0]["id"] == segundo.json()["cliente_id"]
    assert clientes[1]["id"] == primero.json()["cliente_id"]
    assert clientes[0]["created_at"] is not None


def test_ventas_taller_reservas_siguen_devolviendo_cliente_nombre(
    client,
    seed_venta_basica,
):
    crear_cliente = client.post(
        "/clientes/",
        json={
            "nombre_persona": "Martin",
            "apellido": "Ruiz",
            "telefono": "2915557005",
            "tipo_cliente": "minorista",
        },
    )
    assert crear_cliente.status_code == 200, crear_cliente.text
    cliente_id = crear_cliente.json()["cliente_id"]

    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": cliente_id,
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
    assert venta.status_code == 200, venta.text
    venta_detalle = client.get(f"/ventas/{venta.json()['venta_id']}")
    assert venta_detalle.status_code == 200, venta_detalle.text
    assert venta_detalle.json()["venta"]["cliente_nombre"] == "MARTIN RUIZ"

    reserva = client.post(
        "/reservas/",
        json={
            "id_cliente": cliente_id,
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [
                {
                    "id_variante": seed_venta_basica["variante_id"],
                    "cantidad": 1,
                    "precio_estimado": seed_venta_basica["precio_venta"],
                }
            ],
        },
    )
    assert reserva.status_code == 200, reserva.text
    reserva_detalle = client.get(f"/reservas/{reserva.json()['reserva_id']}")
    assert reserva_detalle.status_code == 200, reserva_detalle.text
    assert reserva_detalle.json()["reserva"]["cliente_nombre"] == "MARTIN RUIZ"

    bici = client.post(
        f"/clientes/{cliente_id}/bicicletas",
        json={
            "marca": "Raleigh",
            "modelo": "R29",
        },
    )
    assert bici.status_code == 201, bici.text

    orden = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": cliente_id,
            "id_bicicleta_cliente": bici.json()["id"],
            "problema_reportado": "Control nombre cliente",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert orden.status_code == 201, orden.text
    orden_detalle = client.get(f"/ordenes_taller/{orden.json()['id']}")
    assert orden_detalle.status_code == 200, orden_detalle.text
    assert orden_detalle.json()["cliente_nombre"] == "MARTIN RUIZ"


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


def test_no_permite_crear_dos_clientes_con_mismo_telefono_normalizado(client, clean_db):
    primero = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Telefono Uno",
            "telefono": "291-555-0000",
            "tipo_cliente": "minorista",
        },
    )
    assert primero.status_code == 200, primero.text

    duplicado = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Telefono Dos",
            "telefono": "(291) 555 0000",
            "tipo_cliente": "minorista",
        },
    )

    assert duplicado.status_code == 400
    assert "duplicado" in duplicado.json()["detail"].lower()
    assert "tel" in duplicado.json()["detail"].lower()


def test_no_permite_crear_dos_clientes_con_mismo_dni_o_cuit(client, clean_db):
    primero = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Documento Uno",
            "telefono": "2915550101",
            "dni": "30.111.222",
            "cuit": "20-11111111-1",
            "tipo_cliente": "minorista",
        },
    )
    assert primero.status_code == 200, primero.text

    duplicado_dni = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Documento Dos",
            "telefono": "2915550102",
            "dni": "30111222",
            "tipo_cliente": "minorista",
        },
    )
    assert duplicado_dni.status_code == 400
    assert "dni" in duplicado_dni.json()["detail"].lower()

    duplicado_cuit = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Documento Tres",
            "telefono": "2915550103",
            "cuit": "20111111111",
            "tipo_cliente": "minorista",
        },
    )
    assert duplicado_cuit.status_code == 400
    assert "cuit" in duplicado_cuit.json()["detail"].lower()


def test_permite_nombres_parecidos_si_no_coinciden_datos_fuertes(client, clean_db):
    primero = client.post(
        "/clientes/",
        json={
            "nombre": "Juan Perez",
            "telefono": "2915550201",
            "dni": "40111222",
            "tipo_cliente": "minorista",
        },
    )
    assert primero.status_code == 200, primero.text

    segundo = client.post(
        "/clientes/",
        json={
            "nombre": "Juan Pérez",
            "telefono": "2915550202",
            "dni": "40111223",
            "tipo_cliente": "minorista",
        },
    )
    assert segundo.status_code == 200, segundo.text


def test_resumen_duplicados_clientes_cuenta_existentes_sin_merge(client, db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, dni, tipo_cliente, activo)
            VALUES
                ('DUP UNO', '291-555-0300', '50111222', 'minorista', TRUE),
                ('DUP DOS', '(291) 555 0300', '50111223', 'minorista', TRUE)
            """
        )
    db_conn.commit()

    response = client.get("/clientes/duplicados/resumen")

    assert response.status_code == 200, response.text
    assert response.json()["telefono"] == 1


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

def test_historial_y_taller_cliente_sin_movimientos(client, clean_db):
    crear = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Sin Historial",
            "telefono": "2915558080",
            "tipo_cliente": "minorista",
        },
    )
    assert crear.status_code == 200, crear.text
    cliente_id = crear.json()["cliente_id"]

    historial = client.get(f"/clientes/{cliente_id}/historial")
    taller = client.get(f"/clientes/{cliente_id}/taller")

    assert historial.status_code == 200, historial.text
    assert historial.json() == {
        "ventas": [],
        "pagos": [],
        "reservas": [],
        "deudas": [],
        "creditos": [],
        "seguimiento_eventos": [],
    }
    assert taller.status_code == 200, taller.text
    assert taller.json() == []


def test_historial_cliente_devuelve_contexto_comercial_enriquecido(
    client,
    db_conn,
    seed_venta_basica,
):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [{
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
            }],
        },
    )
    assert venta.status_code == 200, venta.text
    venta_id = venta.json()["venta_id"]

    reserva = client.post(
        "/reservas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [{
                "id_variante": seed_venta_basica["variante_id"],
                "cantidad": 1,
                "precio_estimado": seed_venta_basica["precio_venta"],
            }],
        },
    )
    assert reserva.status_code == 200, reserva.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO pagos (
                id_cliente, origen_tipo, origen_id, medio_pago,
                monto_total_cobrado, monto_base_aplicado,
                monto_descuento_aplicado, monto_recargo_aplicado,
                estado, id_usuario
            )
            VALUES (%s, 'venta', %s, 'efectivo', 21996, 24440, 2444, 0, 'confirmado', %s)
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
            INSERT INTO deudas_cliente (
                id_cliente, origen_tipo, origen_id, saldo_actual, estado
            )
            VALUES (%s, 'venta', %s, 12000, 'abierta')
            RETURNING id
            """,
            (seed_venta_basica["cliente_id"], venta_id),
        )
        deuda_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO creditos_cliente (
                id_cliente, origen_tipo, origen_id, saldo_actual, estado
            )
            VALUES (%s, 'venta', %s, 5000, 'aplicado_parcial')
            RETURNING id
            """,
            (seed_venta_basica["cliente_id"], venta_id),
        )
        credito_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO credito_movimientos (
                id_credito, tipo_movimiento, monto,
                origen_tipo, origen_id, id_usuario
            )
            VALUES
                (%s, 'credito_generado', 8000, 'venta', %s, %s),
                (%s, 'aplicacion_a_venta', 3000, 'venta', %s, %s)
            """,
            (
                credito_id, venta_id, seed_venta_basica["usuario_id"],
                credito_id, venta_id, seed_venta_basica["usuario_id"],
            ),
        )
    db_conn.commit()

    response = client.get(
        f"/clientes/{seed_venta_basica['cliente_id']}/historial"
    )
    assert response.status_code == 200, response.text
    data = response.json()

    venta_historial = next(item for item in data["ventas"] if item["id"] == venta_id)
    assert venta_historial["cantidad_items"] == 1
    assert "Aceite lubricante Zefal Pro" in venta_historial["productos_resumen"]
    assert venta_historial["origen"] == "venta"

    pago_historial = next(item for item in data["pagos"] if item["id"] == pago_id)
    assert pago_historial["venta_asociada_id"] == venta_id
    assert float(pago_historial["monto_descuento_aplicado"]) == 2444

    reserva_historial = next(
        item for item in data["reservas"]
        if item["id"] == reserva.json()["reserva_id"]
    )
    assert reserva_historial["cantidad_items"] == 1
    assert "Aceite lubricante Zefal Pro" in reserva_historial["producto_principal"]

    deuda_historial = next(item for item in data["deudas"] if item["id"] == deuda_id)
    assert deuda_historial["venta_asociada_id"] == venta_id

    credito_historial = next(
        item for item in data["creditos"] if item["id"] == credito_id
    )
    assert credito_historial["venta_asociada_id"] == venta_id
    assert float(credito_historial["monto_generado"]) == 8000
    assert float(credito_historial["monto_usado"]) == 3000


def test_taller_cliente_devuelve_ordenes_con_y_sin_venta(
    client,
    db_conn,
    seed_taller_basico,
):
    def crear_orden(problema):
        return client.post(
            "/ordenes_taller/",
            json={
                "id_sucursal": seed_taller_basico["sucursal_id"],
                "id_cliente": seed_taller_basico["cliente_id"],
                "id_bicicleta_cliente": seed_taller_basico["bicicleta_cliente_id"],
                "problema_reportado": problema,
                "id_usuario": seed_taller_basico["usuario_id"],
            },
        )

    orden_con_venta = crear_orden("No entraban bien los cambios")
    orden_sin_venta = crear_orden("Control general")
    assert orden_con_venta.status_code == 201, orden_con_venta.text
    assert orden_sin_venta.status_code == 201, orden_sin_venta.text
    orden_id = orden_con_venta.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ventas (
                id_sucursal, id_cliente, estado, subtotal_base,
                descuento_total, recargo_total, total_final,
                saldo_pendiente, id_usuario_creador, id_orden_taller
            )
            VALUES (%s, %s, 'entregada', 18500, 0, 0, 18500, 0, %s, %s)
            RETURNING id
            """,
            (
                seed_taller_basico["sucursal_id"],
                seed_taller_basico["cliente_id"],
                seed_taller_basico["usuario_id"],
                orden_id,
            ),
        )
        venta_id = cur.fetchone()["id"]

        cur.execute(
            """
            UPDATE ordenes_taller
            SET estado = 'retirada',
                fecha_terminada = NOW() - INTERVAL '1 day',
                fecha_retirada = NOW(),
                cliente_avisado_retiro = TRUE,
                fecha_aviso_retiro = NOW() - INTERVAL '12 hours',
                total_final = 18500,
                saldo_pendiente = 0,
                id_venta_generada = %s
            WHERE id = %s
            """,
            (venta_id, orden_id),
        )

        cur.execute(
            """
            INSERT INTO ordenes_taller_items (
                id_orden_taller, etapa, descripcion_snapshot, cantidad,
                precio_unitario, aprobado, subtotal, tipo_item
            )
            VALUES
                (%s, 'ejecutado', 'Regulación de transmisión', 1, 12000, TRUE, 12000, 'servicio'),
                (%s, 'ejecutado', 'Cable cambio Shimano', 1, 6500, TRUE, 6500, 'repuesto')
            """,
            (orden_id, orden_id),
        )

    db_conn.commit()

    response = client.get(
        f"/clientes/{seed_taller_basico['cliente_id']}/taller"
    )
    assert response.status_code == 200, response.text
    ordenes = response.json()
    assert len(ordenes) == 2

    completa = next(item for item in ordenes if item["id"] == orden_id)
    assert completa["estado"] == "retirada"
    assert completa["id_venta_generada"] == venta_id
    assert completa["venta_estado"] == "entregada"
    assert completa["fecha_retirada"] is not None
    assert completa["cliente_avisado_retiro"] is True
    assert "Venzo" in completa["bicicleta_descripcion"]
    assert completa["diagnostico"] is None
    assert {item["tipo_item"] for item in completa["items"]} == {
        "servicio",
        "repuesto",
    }

    pendiente = next(
        item for item in ordenes if item["id"] == orden_sin_venta.json()["id"]
    )
    assert pendiente["id_venta_generada"] is None
    assert pendiente["items"] == []


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


def test_analisis_cliente_concilia_venta_costo_y_ganancia(
    client,
    seed_venta_basica,
):
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
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text

    response = client.get(
        f"/clientes/{seed_venta_basica['cliente_id']}/analisis?periodo=365d"
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["puede_ver_rentabilidad"] is True
    assert data["resumen"]["cantidad_operaciones"] == 1
    assert Decimal(data["resumen"]["ventas_netas"]) == Decimal("24440.00")
    assert Decimal(data["resumen"]["costo_mercaderia"]) == Decimal("10000.00")
    assert Decimal(data["resumen"]["ganancia_comercial"]) == Decimal("14440.00")
    assert Decimal(data["resumen"]["ticket_promedio"]) == Decimal("24440.00")
    assert data["calidad_datos"]["valida"] is True
    assert sum(Decimal(rubro["ventas_netas"]) for rubro in data["rubros"]) == Decimal("24440.00")
    assert data["actividad"]["dias_desde_ultima_actividad"] == 0


def test_analisis_cliente_sin_actividad_devuelve_estado_vacio(client, clean_db):
    crear = client.post(
        "/clientes/",
        json={
            "nombre": "Cliente Sin Actividad",
            "telefono": "2915557999",
            "tipo_cliente": "minorista",
        },
    )
    assert crear.status_code == 200, crear.text

    response = client.get(
        f"/clientes/{crear.json()['cliente_id']}/analisis?periodo=90d"
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["resumen"]["cantidad_operaciones"] == 0
    assert Decimal(data["resumen"]["ventas_netas"]) == Decimal("0.00")
    assert data["actividad"]["ultima_actividad_fecha"] is None
    assert data["rubros"] == []
    assert data["productos_principales"] == []


def test_analisis_cliente_oculta_costos_sin_permiso(client, seed_venta_basica):
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
                }
            ],
        },
    )
    assert venta.status_code == 200, venta.text

    data = obtener_analisis_cliente_service(
        seed_venta_basica["cliente_id"],
        periodo="365d",
        puede_ver_rentabilidad=False,
    )

    assert data["resumen"]["ventas_netas"] == Decimal("24440.00")
    assert data["resumen"]["costo_mercaderia"] is None
    assert data["resumen"]["ganancia_comercial"] is None
    assert data["resumen"]["margen_porcentaje"] is None
    assert data["rubros"][0]["costo_mercaderia"] is None
    assert data["calidad_datos"] is None


def test_panel_crm_concilia_con_analisis_individual(client, seed_venta_basica):
    venta = client.post(
        "/ventas/",
        json={
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "items": [{"id_variante": seed_venta_basica["variante_id"], "cantidad": 1}],
        },
    )
    assert venta.status_code == 200, venta.text

    individual = client.get(
        f"/clientes/{seed_venta_basica['cliente_id']}/analisis?periodo=365d"
    )
    panel = client.get(
        f"/clientes/crm/panel?q=Cliente%20Test&limit=10"
    )
    assert individual.status_code == 200, individual.text
    assert panel.status_code == 200, panel.text

    individual_data = individual.json()
    panel_data = panel.json()
    assert panel_data["total"] == 1
    cliente = panel_data["items"][0]
    assert cliente["id"] == seed_venta_basica["cliente_id"]
    assert Decimal(cliente["ventas_365"]) == Decimal(individual_data["resumen"]["ventas_netas"])
    assert Decimal(cliente["ganancia_365"]) == Decimal(individual_data["resumen"]["ganancia_comercial"])
    assert cliente["operaciones_365"] == individual_data["resumen"]["cantidad_operaciones"]


def test_panel_crm_filtra_recurrente_y_busca_por_bicicleta(client, seed_venta_basica):
    for _ in range(2):
        venta = client.post(
            "/ventas/",
            json={
                "id_cliente": seed_venta_basica["cliente_id"],
                "id_sucursal": seed_venta_basica["sucursal_id"],
                "id_usuario": seed_venta_basica["usuario_id"],
                "items": [{"id_variante": seed_venta_basica["variante_id"], "cantidad": 1}],
            },
        )
        assert venta.status_code == 200, venta.text

    bicicleta = client.post(
        f"/clientes/{seed_venta_basica['cliente_id']}/bicicletas",
        json={
            "marca": "Topmega",
            "modelo": "R29",
            "numero_cuadro": "CRM-CUADRO-001",
        },
    )
    assert bicicleta.status_code == 201, bicicleta.text

    response = client.get(
        "/clientes/crm/panel?"
        "vista=recurrentes&q=CRM-CUADRO-001&orden=actividad"
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["operaciones_365"] == 2
    assert "recurrente" in {
        segmento["clave"] for segmento in data["items"][0]["segmentos"]
    }


def test_seguimiento_crm_ciclo_completo_conserva_historial(client, seed_venta_basica):
    cliente_id = seed_venta_basica["cliente_id"]
    usuario_id = seed_venta_basica["usuario_id"]
    fecha_inicial = date.today() + timedelta(days=1)

    crear = client.post(
        f"/clientes/{cliente_id}/seguimientos",
        json={
            "tipo": "whatsapp",
            "motivo": "Consultar si necesita service de la bicicleta",
            "fecha_objetivo": fecha_inicial.isoformat(),
            "prioridad": "alta",
            "id_usuario_responsable": usuario_id,
            "id_usuario_actor": usuario_id,
        },
    )
    assert crear.status_code == 201, crear.text
    seguimiento_id = crear.json()["id"]
    assert crear.json()["estado"] == "pendiente"

    nueva_fecha = fecha_inicial + timedelta(days=2)
    reprogramar = client.patch(
        f"/clientes/{cliente_id}/seguimientos/{seguimiento_id}/reprogramar",
        json={
            "fecha_objetivo": nueva_fecha.isoformat(),
            "prioridad": "normal",
            "id_usuario_responsable": usuario_id,
            "nota": "El cliente pidio que lo contactemos mas adelante",
            "id_usuario_actor": usuario_id,
        },
    )
    assert reprogramar.status_code == 200, reprogramar.text
    assert reprogramar.json()["fecha_objetivo"] == nueva_fecha.isoformat()

    cerrar = client.patch(
        f"/clientes/{cliente_id}/seguimientos/{seguimiento_id}/cerrar",
        json={
            "estado": "realizada",
            "resultado": "Respondio y coordinara el ingreso la proxima semana",
            "id_usuario_actor": usuario_id,
        },
    )
    assert cerrar.status_code == 200, cerrar.text
    assert cerrar.json()["estado"] == "realizada"
    assert cerrar.json()["fecha_resolucion"] is not None

    eventos = client.get(
        f"/clientes/{cliente_id}/seguimientos/{seguimiento_id}/eventos"
    )
    assert eventos.status_code == 200, eventos.text
    assert [evento["tipo_evento"] for evento in reversed(eventos.json())] == [
        "creado",
        "reprogramado",
        "realizado",
    ]

    historial_cliente = client.get(f"/clientes/{cliente_id}/historial")
    assert historial_cliente.status_code == 200, historial_cliente.text
    assert [
        evento["tipo_evento"]
        for evento in reversed(historial_cliente.json()["seguimiento_eventos"])
    ] == ["creado", "reprogramado", "realizado"]

    segundo_cierre = client.patch(
        f"/clientes/{cliente_id}/seguimientos/{seguimiento_id}/cerrar",
        json={
            "estado": "cancelada",
            "resultado": "No corresponde",
            "id_usuario_actor": usuario_id,
        },
    )
    assert segundo_cierre.status_code == 409


def test_agenda_crm_separa_vencidos_hoy_y_proximos(client, seed_venta_basica):
    cliente_id = seed_venta_basica["cliente_id"]
    usuario_id = seed_venta_basica["usuario_id"]
    hoy = date.today()

    for indice, fecha_objetivo in enumerate(
        [hoy - timedelta(days=1), hoy, hoy + timedelta(days=1)],
        start=1,
    ):
        response = client.post(
            f"/clientes/{cliente_id}/seguimientos",
            json={
                "tipo": "llamada",
                "motivo": f"Seguimiento agenda {indice}",
                "fecha_objetivo": fecha_objetivo.isoformat(),
                "prioridad": "normal",
                "id_usuario_responsable": usuario_id,
                "id_usuario_actor": usuario_id,
            },
        )
        assert response.status_code == 201, response.text

    vencidos = client.get("/clientes/crm/seguimientos?bandeja=vencidos")
    agenda_hoy = client.get("/clientes/crm/seguimientos?bandeja=hoy")
    proximos = client.get("/clientes/crm/seguimientos?bandeja=proximos")

    assert vencidos.status_code == 200, vencidos.text
    assert agenda_hoy.status_code == 200, agenda_hoy.text
    assert proximos.status_code == 200, proximos.text
    assert vencidos.json()["total"] == 1
    assert agenda_hoy.json()["total"] == 1
    assert proximos.json()["total"] == 1
    assert agenda_hoy.json()["resumen"] == {
        "vencidos": 1,
        "hoy": 1,
        "proximos": 1,
    }

    panel = client.get(f"/clientes/crm/panel?q=Cliente%20Test&limit=10")
    assert panel.status_code == 200, panel.text
    cliente = panel.json()["items"][0]
    assert cliente["seguimiento_pendiente"]["fecha_objetivo"] == (hoy - timedelta(days=1)).isoformat()
    assert cliente["accion_sugerida"]["clave"] == "seguimiento_vencido"
    assert "seguimiento_vencido" in {
        segmento["clave"] for segmento in cliente["segmentos"]
    }


def test_oportunidad_service_se_confirma_y_no_se_duplica(
    client,
    db_conn,
    seed_venta_basica,
):
    cliente_id = seed_venta_basica["cliente_id"]
    usuario_id = seed_venta_basica["usuario_id"]
    fecha_limite = date.today() + timedelta(days=5)
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente, marca, modelo, numero_cuadro,
                plan_postventa, fecha_limite_service_gratis,
                service_gratis_usado
            )
            VALUES (%s, 'VENZO', 'RAPTOR', 'CRM-SERVICE-001',
                    'service_30_dias', %s, FALSE)
            RETURNING id
            """,
            (cliente_id, fecha_limite),
        )
        bicicleta_id = cur.fetchone()["id"]
    db_conn.commit()

    response = client.get(
        f"/clientes/{cliente_id}/oportunidades?tipo=service"
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 1
    oportunidad = data["items"][0]
    assert oportunidad["referencia_id"] == bicicleta_id
    assert oportunidad["fecha_evidencia"] == fecha_limite.isoformat()
    assert oportunidad["referencias"] == {
        "id_bicicleta_cliente": bicicleta_id,
    }

    crear = client.post(
        f"/clientes/{cliente_id}/seguimientos",
        json={
            "tipo": oportunidad["tipo_seguimiento"],
            "motivo": oportunidad["motivo_sugerido"],
            "fecha_objetivo": oportunidad["fecha_sugerida"],
            "prioridad": oportunidad["prioridad"],
            "id_usuario_responsable": usuario_id,
            "id_usuario_actor": usuario_id,
            **oportunidad["referencias"],
        },
    )
    assert crear.status_code == 201, crear.text
    assert crear.json()["id_bicicleta_cliente"] == bicicleta_id

    despues = client.get(
        f"/clientes/{cliente_id}/oportunidades?tipo=service"
    )
    assert despues.status_code == 200, despues.text
    assert despues.json()["total"] == 0


def test_comunicaciones_crm_registra_resultado_y_mide_conversion(client, seed_venta_basica):
    cliente_id = seed_venta_basica["cliente_id"]
    candidatos = client.get("/clientes/crm/comunicaciones?vista=todos&limit=20")
    assert candidatos.status_code == 200, candidatos.text
    item = next(item for item in candidatos.json()["items"] if item["id"] == cliente_id)
    assert item["puede_contactar"] is True
    assert item["borrador_mensaje"]
    assert "registramos actividad" not in item["borrador_mensaje"].lower()

    creado = client.post(
        f"/clientes/{cliente_id}/comunicaciones",
        json={
            "canal": "whatsapp",
            "resultado": "convertido",
            "mensaje": item["borrador_mensaje"],
            "nota": "Confirmó una nueva visita",
            "id_usuario_actor": seed_venta_basica["usuario_id"],
        },
    )
    assert creado.status_code == 200, creado.text

    historial = client.get(f"/clientes/{cliente_id}/comunicaciones")
    assert historial.status_code == 200, historial.text
    assert historial.json()["total"] == 1
    assert historial.json()["items"][0]["resultado"] == "convertido"

    actualizado = client.get("/clientes/crm/comunicaciones?vista=todos&limit=20")
    resumen = actualizado.json()["resumen_comunicaciones"]
    assert resumen["contactos"] == 1
    assert resumen["convertidos"] == 1
    assert resumen["clientes_contactados"] == 1


def test_preferencia_no_contactar_exige_motivo_y_bloquea_contactos(client, seed_venta_basica):
    cliente_id = seed_venta_basica["cliente_id"]
    sin_motivo = client.patch(
        f"/clientes/{cliente_id}/preferencia-contacto",
        json={
            "estado": "no_contactar",
            "id_usuario_actor": seed_venta_basica["usuario_id"],
        },
    )
    assert sin_motivo.status_code == 422

    excluir = client.patch(
        f"/clientes/{cliente_id}/preferencia-contacto",
        json={
            "estado": "no_contactar",
            "motivo_exclusion": "Pidió no recibir mensajes",
            "id_usuario_actor": seed_venta_basica["usuario_id"],
        },
    )
    assert excluir.status_code == 200, excluir.text

    bloqueado = client.post(
        f"/clientes/{cliente_id}/comunicaciones",
        json={
            "canal": "whatsapp",
            "resultado": "contactado",
            "id_usuario_actor": seed_venta_basica["usuario_id"],
        },
    )
    assert bloqueado.status_code == 400
    assert "no contactar" in bloqueado.json()["detail"].lower()

    candidatos = client.get("/clientes/crm/comunicaciones?vista=todos&limit=20")
    item = next(item for item in candidatos.json()["items"] if item["id"] == cliente_id)
    assert item["puede_contactar"] is False
    assert item["borrador_mensaje"] is None
    assert item["preferencia_contacto"]["motivo_exclusion"] == "Pidió no recibir mensajes"


def test_borrador_inactivo_es_humano_y_no_expone_dias_del_crm():
    mensaje = _borrador_comunicacion_crm({
        "nombre": "JUAN PEREZ",
        "dias_desde_ultima_actividad": 120,
        "bicicletas_registradas": 1,
        "segmentos": [{"clave": "inactivo"}],
    })
    assert "120" not in mensaje
    assert "registramos actividad" not in mensaje.lower()
    assert "cómo viene la bici" in mensaje.lower()


def test_borrador_no_menciona_bici_si_cliente_no_tiene_una_registrada():
    mensaje = _borrador_comunicacion_crm({
        "nombre": "MARIA LOPEZ",
        "bicicletas_registradas": 0,
        "segmentos": [{"clave": "inactivo"}],
    })
    assert "bici" not in mensaje.lower()
    assert "repuesto" not in mensaje.lower()
    assert "service" not in mensaje.lower()
    assert "quería saber si viene todo bien" in mensaje.lower()


def test_borrador_cliente_activo_no_inventa_que_hace_tiempo_no_hablan():
    mensaje = _borrador_comunicacion_crm({
        "nombre": "LUCAS GOMEZ",
        "bicicletas_registradas": 1,
        "segmentos": [{"clave": "recurrente"}],
    })
    assert "hace un tiempo" not in mensaje.lower()
    assert "cómo viene la bici" in mensaje.lower()
