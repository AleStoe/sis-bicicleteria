from app.core.text_normalization import clean_text, normalize_text_upper


def test_normalize_text_upper_limpia_espacios_y_mayusculiza():
    assert normalize_text_upper("  bici   urbana ñandú  ") == "BICI URBANA ÑANDÚ"
    assert normalize_text_upper("   ") is None
    assert normalize_text_upper(None) is None
    assert clean_text("  no   tocar Caso  ") == "no tocar Caso"


def test_cliente_y_bicicleta_cliente_normalizan_campos_operativos(client, db_conn):
    creado = client.post(
        "/clientes/",
        json={
            "nombre": "  juan perez  ",
            "telefono": "291000111",
            "tipo_cliente": "minorista",
            "razon_social": "  juan perez bikes  ",
        },
    )
    assert creado.status_code == 200, creado.text
    cliente_id = creado.json()["cliente_id"]

    bici = client.post(
        f"/clientes/{cliente_id}/bicicletas",
        json={
            "marca": "  trek ",
            "modelo": " marlin 5 ",
            "rodado": "29",
            "color": " rojo mate ",
            "numero_cuadro": "abc123",
            "notas": "Se respeta libre",
        },
    )
    assert bici.status_code == 201, bici.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT nombre, razon_social
            FROM clientes
            WHERE id = %s
            """,
            (cliente_id,),
        )
        cliente = cur.fetchone()

        cur.execute(
            """
            SELECT marca, modelo, color, numero_cuadro, notas
            FROM bicicletas_clientes
            WHERE id_cliente = %s
            """,
            (cliente_id,),
        )
        bicicleta = cur.fetchone()

    assert cliente["nombre"] == "JUAN PEREZ"
    assert cliente["razon_social"] == "JUAN PEREZ BIKES"
    assert bicicleta["marca"] == "TREK"
    assert bicicleta["modelo"] == "MARLIN 5"
    assert bicicleta["color"] == "ROJO MATE"
    assert bicicleta["numero_cuadro"] == "ABC123"
    assert bicicleta["notas"] == "Se respeta libre"


def test_catalogo_proveedor_servicio_usuario_y_taller_normalizan(client, db_conn, seed_venta_basica):
    proveedor = client.post(
        "/proveedores/",
        json={"nombre": "  repuestos del sur  ", "email": "Proveedor@Test.Com"},
    )
    assert proveedor.status_code == 200, proveedor.text

    marca = client.post("/catalogo/marcas", json={"nombre": "  venzo  "})
    assert marca.status_code == 200, marca.text

    with db_conn.cursor() as cur:
        cur.execute("SELECT id FROM categorias LIMIT 1")
        categoria_id = cur.fetchone()["id"]

    producto = client.post(
        "/catalogo/productos",
        json={
            "id_categoria": categoria_id,
            "id_marca": marca.json()["id"],
            "nombre": "  cubierta carrera  ",
            "tipo_item": "producto",
            "stockeable": True,
            "serializable": False,
        },
    )
    assert producto.status_code == 200, producto.text

    variante = client.post(
        "/catalogo/variantes",
        json={
            "id_producto": producto.json()["id"],
            "nombre_variante": "  700x25 negra  ",
            "codigo_proveedor": "  cub-700 ",
            "talle": "  700x25 ",
            "color": " negra ",
            "precio_minorista": "1000",
            "precio_mayorista": "800",
        },
    )
    assert variante.status_code == 200, variante.text

    servicio = client.post(
        "/servicios_taller/",
        json={
            "nombre": "  ajuste de cambios  ",
            "descripcion": "No forzar mayusculas aca",
            "precio_sugerido": "5000",
            "duracion_estimada_min": 30,
        },
    )
    assert servicio.status_code == 201, servicio.text

    usuario = client.post(
        "/usuarios/",
        json={
            "nombre": "  ana taller  ",
            "username": "AnaUser",
            "email": "Ana@Test.Com",
            "password": "secret123",
            "rol": "operador",
        },
    )
    assert usuario.status_code == 201, usuario.text

    bici = client.post(
        f"/clientes/{seed_venta_basica['cliente_id']}/bicicletas",
        json={
            "marca": "giant",
            "modelo": "talon",
            "color": "azul",
        },
    )
    assert bici.status_code == 201, bici.text

    orden = client.post(
        "/ordenes_taller/",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_cliente": seed_venta_basica["cliente_id"],
            "id_bicicleta_cliente": bici.json()["id"],
            "problema_reportado": "  freno trasero roza  ",
            "id_usuario": seed_venta_basica["usuario_id"],
        },
    )
    assert orden.status_code == 201, orden.text

    with db_conn.cursor() as cur:
        cur.execute("SELECT nombre FROM proveedores WHERE id = %s", (proveedor.json()["id"],))
        proveedor_db = cur.fetchone()
        cur.execute("SELECT nombre FROM marcas WHERE id = %s", (marca.json()["id"],))
        marca_db = cur.fetchone()
        cur.execute("SELECT nombre FROM productos WHERE id = %s", (producto.json()["id"],))
        producto_db = cur.fetchone()
        cur.execute(
            "SELECT nombre_variante, codigo_proveedor, talle, color FROM variantes WHERE id = %s",
            (variante.json()["id"],),
        )
        variante_db = cur.fetchone()
        cur.execute("SELECT nombre, descripcion FROM servicios_taller WHERE id = %s", (servicio.json()["id"],))
        servicio_db = cur.fetchone()
        cur.execute("SELECT nombre, username, email FROM usuarios WHERE id = %s", (usuario.json()["usuario_id"],))
        usuario_db = cur.fetchone()
        cur.execute("SELECT problema_reportado FROM ordenes_taller WHERE id = %s", (orden.json()["id"],))
        orden_db = cur.fetchone()

    assert proveedor_db["nombre"] == "REPUESTOS DEL SUR"
    assert marca_db["nombre"] == "VENZO"
    assert producto_db["nombre"] == "CUBIERTA CARRERA"
    assert variante_db["nombre_variante"] == "700X25 NEGRA"
    assert variante_db["codigo_proveedor"] == "CUB-700"
    assert variante_db["talle"] == "700X25"
    assert variante_db["color"] == "NEGRA"
    assert servicio_db["nombre"] == "AJUSTE DE CAMBIOS"
    assert servicio_db["descripcion"] == "No forzar mayusculas aca"
    assert usuario_db["nombre"] == "ANA TALLER"
    assert usuario_db["username"] == "anauser"
    assert usuario_db["email"] == "Ana@test.com"
    assert orden_db["problema_reportado"] == "FRENO TRASERO ROZA"
