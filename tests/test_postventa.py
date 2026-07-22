from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.modules.usuarios.service import hash_password


def _crear_actor(db_conn, *, username: str, rol: str, permisos=()):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO roles (nombre, descripcion)
            VALUES (%s, %s)
            ON CONFLICT (nombre) DO UPDATE
            SET descripcion = EXCLUDED.descripcion
            RETURNING id
            """,
            (rol, f"Rol de prueba {rol}"),
        )
        rol_id = cur.fetchone()["id"]
        for permiso in permisos:
            cur.execute(
                """
                INSERT INTO permisos (codigo, descripcion)
                VALUES (%s, %s)
                ON CONFLICT (codigo) DO UPDATE
                SET descripcion = EXCLUDED.descripcion
                RETURNING id
                """,
                (permiso, f"Permiso de prueba {permiso}"),
            )
            permiso_id = cur.fetchone()["id"]
            cur.execute(
                """
                INSERT INTO rol_permisos (id_rol, id_permiso)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (rol_id, permiso_id),
            )
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, email, password_hash, activo)
            VALUES (%s, %s, %s, %s, TRUE)
            RETURNING id
            """,
            (
                username.upper(),
                username,
                f"{username}@example.com",
                hash_password("Password123"),
            ),
        )
        usuario_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO usuario_roles (id_usuario, id_rol)
            VALUES (%s, %s)
            """,
            (usuario_id, rol_id),
        )
    db_conn.commit()
    token = crear_token_usuario({"id": usuario_id, "username": username, "rol": rol})
    return usuario_id, token


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def _seed_postventa(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Postventa', 'admin_postventa', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO clientes (nombre, tipo_cliente, activo, telefono)
            VALUES ('Cliente Postventa', 'minorista', TRUE, '2911111111')
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]
        cur.execute("INSERT INTO categorias (nombre) VALUES ('Bicicletas') RETURNING id")
        categoria_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO proveedores (nombre, activo)
            VALUES ('Proveedor Postventa', TRUE)
            RETURNING id
            """
        )
        proveedor_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO productos (id_categoria, nombre, tipo_item, stockeable, serializable, activo)
            VALUES (%s, 'BICICLETA TEST POSTVENTA', 'producto', TRUE, TRUE, TRUE)
            RETURNING id
            """,
            (categoria_id,),
        )
        producto_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO variantes (
                id_producto,
                nombre_variante,
                sku,
                precio_minorista,
                precio_mayorista,
                costo_promedio_vigente,
                activo
            )
            VALUES (%s, 'R29 M', 'POSTVENTA-R29-M', 100000, 90000, 60000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Postventa', 'Direccion', TRUE)
            RETURNING id
            """
        )
        sucursal_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado
            )
            VALUES (%s, %s, 'CUADRO-PV-001', 'entregada')
            RETURNING id
            """,
            (variante_id, sucursal_id),
        )
        serializada_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                id_bicicleta_serializada
            )
            VALUES (%s, 'TEST', 'POSTVENTA', '29', 'NEGRO', 'CUADRO-PV-001', %s)
            RETURNING id
            """,
            (cliente_id, serializada_id),
        )
        bicicleta_cliente_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO ventas (
                id_sucursal,
                id_cliente,
                estado,
                subtotal_base,
                total_final,
                saldo_pendiente,
                id_usuario_creador
            )
            VALUES (%s, %s, 'entregada', 100000, 100000, 0, %s)
            RETURNING id
            """,
            (sucursal_id, cliente_id, usuario_id),
        )
        venta_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO venta_items (
                id_venta,
                id_variante,
                id_bicicleta_serializada,
                descripcion_snapshot,
                cantidad,
                precio_lista,
                precio_final,
                costo_unitario_aplicado,
                subtotal
            )
            VALUES (%s, %s, %s, 'BICICLETA TEST POSTVENTA - R29 M', 1, 100000, 100000, 60000, 100000)
            RETURNING id
            """,
            (venta_id, variante_id, serializada_id),
        )
        venta_item_id = cur.fetchone()["id"]
    db_conn.commit()
    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "proveedor_id": proveedor_id,
        "variante_id": variante_id,
        "bicicleta_cliente_id": bicicleta_cliente_id,
        "serializada_id": serializada_id,
        "venta_id": venta_id,
        "venta_item_id": venta_item_id,
    }


def _payload(seed):
    return {
        "tipo_caso": "garantia_fabrica",
        "id_cliente": seed["cliente_id"],
        "id_venta_origen": seed["venta_id"],
        "id_venta_item_origen": seed["venta_item_id"],
        "id_bicicleta_cliente": seed["bicicleta_cliente_id"],
        "id_bicicleta_serializada": seed["serializada_id"],
        "id_variante": seed["variante_id"],
        "id_proveedor": seed["proveedor_id"],
        "motivo_cliente": "Cliente informa ruido en transmision",
        "prioridad": "normal",
        "id_usuario": seed["usuario_id"],
    }


def test_crea_lista_y_detalla_caso_postventa(client, db_conn, clean_db):
    seed = _seed_postventa(db_conn, clean_db)

    crear = client.post("/postventa/casos", json=_payload(seed))

    assert crear.status_code == 201, crear.text
    data = crear.json()
    assert data["codigo"].startswith("PV-")
    assert data["estado"] == "abierto"
    assert data["cliente_nombre"] == "Cliente Postventa"
    assert data["bicicleta_numero_cuadro"] == "CUADRO-PV-001"
    assert data["eventos"][0]["tipo_evento"] == "caso_creado"

    listado = client.get("/postventa/casos", params={"id_cliente": seed["cliente_id"]})
    assert listado.status_code == 200
    assert len(listado.json()) == 1

    detalle = client.get(f"/postventa/casos/{data['id']}")
    assert detalle.status_code == 200
    assert detalle.json()["id"] == data["id"]


def test_actualiza_decisiones_cierra_y_reabre_con_motivo(client, db_conn, clean_db):
    seed = _seed_postventa(db_conn, clean_db)
    caso_id = client.post("/postventa/casos", json=_payload(seed)).json()["id"]

    actualizado = client.patch(
        f"/postventa/casos/{caso_id}",
        json={
            "evaluacion_tecnica": "Se detecta juego en caja pedalera",
            "causa_determinada": "Falla prematura de componente",
            "decision_proveedor": "rechazado",
            "decision_local": "cubre_cortesia",
            "cobertura_tipo": "cobertura_total_local",
            "responsable_economico": "local",
            "monto_cubierto_local": "12000",
            "id_usuario": seed["usuario_id"],
        },
    )
    assert actualizado.status_code == 200, actualizado.text
    assert actualizado.json()["decision_proveedor"] == "rechazado"

    cerrar_sin_resolucion = client.post(
        f"/postventa/casos/{caso_id}/estado",
        json={"nuevo_estado": "cerrado", "id_usuario": seed["usuario_id"]},
    )
    assert cerrar_sin_resolucion.status_code == 400

    for estado in ("en_evaluacion", "resuelto"):
        avance = client.post(
            f"/postventa/casos/{caso_id}/estado",
            json={"nuevo_estado": estado, "id_usuario": seed["usuario_id"]},
        )
        assert avance.status_code == 200, avance.text

    cerrado = client.post(
        f"/postventa/casos/{caso_id}/cerrar",
        json={
            "resultado_final": "Caso resuelto con cobertura del local",
            "resolucion_aplicada": "Se reemplazo caja pedalera sin cargo",
            "id_usuario": seed["usuario_id"],
        },
    )
    assert cerrado.status_code == 200, cerrado.text
    assert cerrado.json()["estado"] == "cerrado"

    modificar_cerrado = client.patch(
        f"/postventa/casos/{caso_id}",
        json={"observaciones": "No deberia permitir", "id_usuario": seed["usuario_id"]},
    )
    assert modificar_cerrado.status_code == 400

    reabrir_sin_motivo = client.post(
        f"/postventa/casos/{caso_id}/reabrir",
        json={"motivo": "", "id_usuario": seed["usuario_id"]},
    )
    assert reabrir_sin_motivo.status_code == 422

    reabierto = client.post(
        f"/postventa/casos/{caso_id}/reabrir",
        json={"motivo": "Cliente vuelve con el mismo sintoma", "id_usuario": seed["usuario_id"]},
    )
    assert reabierto.status_code == 200, reabierto.text
    assert reabierto.json()["estado"] == "reabierto"
    assert any(e["tipo_evento"] == "caso_reabierto" for e in reabierto.json()["eventos"])


def test_rechaza_referencias_invalidas_y_transicion_invalida(client, db_conn, clean_db):
    seed = _seed_postventa(db_conn, clean_db)
    payload = _payload(seed)
    payload["id_venta_item_origen"] = 999999

    invalido = client.post("/postventa/casos", json=payload)
    assert invalido.status_code == 404

    caso_id = client.post("/postventa/casos", json=_payload(seed)).json()["id"]
    transicion = client.post(
        f"/postventa/casos/{caso_id}/estado",
        json={"nuevo_estado": "cerrado", "id_usuario": seed["usuario_id"]},
    )
    assert transicion.status_code == 400

    cancelar_sin_motivo = client.post(
        f"/postventa/casos/{caso_id}/estado",
        json={"nuevo_estado": "cancelado", "id_usuario": seed["usuario_id"]},
    )
    assert cancelar_sin_motivo.status_code == 400


def test_postventa_exige_permiso_y_audita_actor_autenticado(
    client,
    db_conn,
    clean_db,
    monkeypatch,
):
    monkeypatch.setattr(settings, "auth_disabled", False)
    seed = _seed_postventa(db_conn, clean_db)
    _, token_sin_permiso = _crear_actor(
        db_conn,
        username="sin_postventa",
        rol="sin_postventa",
    )
    actor_id, token_postventa = _crear_actor(
        db_conn,
        username="encargado_postventa",
        rol="encargado_postventa",
        permisos=("gestionar_postventa",),
    )

    bloqueado = client.post(
        "/postventa/casos",
        headers=_headers(token_sin_permiso),
        json=_payload(seed),
    )
    assert bloqueado.status_code == 403

    autorizado = client.post(
        "/postventa/casos",
        headers=_headers(token_postventa),
        json=_payload(seed),
    )
    assert autorizado.status_code == 201, autorizado.text
    caso_id = autorizado.json()["id"]

    with db_conn.cursor() as cur:
        cur.execute("SELECT id_usuario_creador FROM postventa_casos WHERE id = %s", (caso_id,))
        caso = cur.fetchone()
        cur.execute(
            """
            SELECT id_usuario, accion
            FROM auditoria_eventos
            WHERE entidad = 'postventa_caso'
              AND entidad_id = %s
            ORDER BY id
            """,
            (caso_id,),
        )
        auditoria = cur.fetchall()
        cur.execute(
            """
            SELECT id_usuario
            FROM postventa_eventos
            WHERE id_caso_postventa = %s
            ORDER BY id
            """,
            (caso_id,),
        )
        eventos = cur.fetchall()

    assert caso["id_usuario_creador"] == actor_id
    assert auditoria[0]["id_usuario"] == actor_id
    assert auditoria[0]["accion"] == "postventa_caso_creado"
    assert eventos[0]["id_usuario"] == actor_id
