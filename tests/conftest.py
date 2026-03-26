import os

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

# Forzar .env.test antes de importar la app/config
os.environ["DB_HOST"] = "localhost"
os.environ["DB_PORT"] = "5432"
os.environ["DB_NAME"] = "bicicleteria_test"
os.environ["DB_USER"] = "postgres"
os.environ["DB_PASSWORD"] = "1460"

from app.main import app  # noqa: E402


def get_test_conn():
    return psycopg.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        row_factory=dict_row,
    )


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture()
def db_conn():
    conn = get_test_conn()
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture()
def clean_db(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            TRUNCATE TABLE
                pagos_tarjeta_detalle,
                pagos_reversiones,
                pagos,
                credito_movimientos,
                creditos_cliente,
                movimientos_stock,
                venta_anulaciones,
                venta_items,
                ventas,
                reserva_eventos,
                reserva_items,
                reservas,
                bicicletas_serializadas,
                ingresos_stock,
                stock_sucursal,
                variantes,
                productos,
                categorias,
                proveedores,
                marcas,
                sucursales,
                ordenes_taller_eventos,
                ordenes_taller,
                bicicletas_clientes,
                clientes,
                usuarios
            RESTART IDENTITY CASCADE
            """
        )

        cur.execute(
            """
            INSERT INTO clientes (nombre, tipo_cliente, activo, notas)
            VALUES (
                'Consumidor final',
                'consumidor_final',
                TRUE,
                'Cliente genérico para ventas rápidas'
            )
            """
        )

    db_conn.commit()


@pytest.fixture()
def seed_venta_basica(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Test', 'admin_test', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO categorias (nombre)
            VALUES ('Lubricantes')
            RETURNING id
            """
        )
        categoria_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO productos (
                id_categoria,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                activo
            )
            VALUES (%s, 'Aceite lubricante Zefal Pro', 'producto', TRUE, FALSE, TRUE)
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
            VALUES (%s, 'Dry Lube 120ML', 'ZEFAL-DRY-120', 24440, 20000, 10000, TRUE)
            RETURNING id
            """,
            (producto_id,),
        )
        variante_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Test', '2910000000', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Test', 'Direccion Test', TRUE)
            RETURNING id
            """
        )
        sucursal_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 6, 0, 0)
            RETURNING id
            """,
            (sucursal_id, variante_id),
        )
        stock_id = cur.fetchone()["id"]

    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "sucursal_id": sucursal_id,
        "producto_id": producto_id,
        "variante_id": variante_id,
        "stock_id": stock_id,
        "precio_venta": 24440,
    }


@pytest.fixture()
def seed_venta_mixta(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Test', 'admin_test_mixta', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO categorias (nombre)
            VALUES ('Accesorios')
            RETURNING id
            """
        )
        categoria_producto_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO categorias (nombre)
            VALUES ('Servicios')
            RETURNING id
            """
        )
        categoria_servicio_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO productos (
                id_categoria,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                activo
            )
            VALUES (%s, 'Casco Test', 'producto', TRUE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_producto_id,),
        )
        producto_stockeable_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO productos (
                id_categoria,
                nombre,
                tipo_item,
                stockeable,
                serializable,
                activo
            )
            VALUES (%s, 'Armado Test', 'servicio', FALSE, FALSE, TRUE)
            RETURNING id
            """,
            (categoria_servicio_id,),
        )
        producto_servicio_id = cur.fetchone()["id"]

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
            VALUES (%s, 'Casco único', 'CASCO-TEST', 30000, 25000, 15000, TRUE)
            RETURNING id
            """,
            (producto_stockeable_id,),
        )
        variante_stockeable_id = cur.fetchone()["id"]

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
            VALUES (%s, 'Armado único', 'SERV-TEST', 10000, 10000, 0, TRUE)
            RETURNING id
            """,
            (producto_servicio_id,),
        )
        variante_servicio_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Mixto', '2911111111', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Mixta', 'Direccion Mixta', TRUE)
            RETURNING id
            """
        )
        sucursal_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 6, 0, 0)
            RETURNING id
            """,
            (sucursal_id, variante_stockeable_id),
        )
        stock_id = cur.fetchone()["id"]

    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "sucursal_id": sucursal_id,
        "producto_stockeable_id": producto_stockeable_id,
        "producto_servicio_id": producto_servicio_id,
        "variante_stockeable_id": variante_stockeable_id,
        "variante_servicio_id": variante_servicio_id,
        "stock_id": stock_id,
        "precio_stockeable": 30000,
        "precio_servicio": 10000,
        "total_venta": 40000,
    }


def get_stock_row(conn, id_sucursal: int, id_variante: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (id_sucursal, id_variante),
        )
        return cur.fetchone()


def get_venta(conn, venta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM ventas
            WHERE id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()


def get_movimientos_by_venta(conn, venta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM movimientos_stock
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY id
            """,
            (venta_id,),
        )
        return cur.fetchall()


@pytest.fixture()
def caja_abierta_basica(client, seed_venta_basica):
    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_basica["sucursal_id"],
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert abrir.status_code == 200
    data = abrir.json()

    yield data

    cerrar = client.post(
        f"/cajas/{data['caja_id']}/cerrar",
        json={
            "id_usuario": seed_venta_basica["usuario_id"],
            "monto_cierre_real": 0,
        },
    )
    assert cerrar.status_code == 200


@pytest.fixture()
def caja_abierta_mixta(client, seed_venta_mixta):
    abrir = client.post(
        "/cajas/abrir",
        json={
            "id_sucursal": seed_venta_mixta["sucursal_id"],
            "id_usuario": seed_venta_mixta["usuario_id"],
            "monto_apertura": 0,
        },
    )
    assert abrir.status_code == 200
    data = abrir.json()

    yield data

    cerrar = client.post(
        f"/cajas/{data['caja_id']}/cerrar",
        json={
            "id_usuario": seed_venta_mixta["usuario_id"],
            "monto_cierre_real": 0,
        },
    )
    assert cerrar.status_code == 200


def get_creditos_by_cliente(conn, id_cliente: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
            ORDER BY id
            """,
            (id_cliente,),
        )
        return cur.fetchall()


def get_credito_movimientos(conn, id_credito: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM credito_movimientos
            WHERE id_credito = %s
            ORDER BY id
            """,
            (id_credito,),
        )
        return cur.fetchall()

def get_caja(conn, caja_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM cajas
            WHERE id = %s
            """,
            (caja_id,),
        )
        return cur.fetchone()


def get_caja_movimientos(conn, caja_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM caja_movimientos
            WHERE id_caja = %s
            ORDER BY id
            """,
            (caja_id,),
        )
        return cur.fetchall()

@pytest.fixture()
def seed_taller_basico(db_conn, clean_db):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, username, password_hash, activo)
            VALUES ('Admin Taller', 'admin_taller', 'hash_dummy', TRUE)
            RETURNING id
            """
        )
        usuario_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Cliente Taller', '2912222222', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO clientes (nombre, telefono, tipo_cliente, activo)
            VALUES ('Otro Cliente', '2919999999', 'minorista', TRUE)
            RETURNING id
            """
        )
        otro_cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (nombre, direccion, activa)
            VALUES ('Sucursal Taller', 'Direccion Taller', TRUE)
            RETURNING id
            """
        )
        sucursal_id = cur.fetchone()["id"]

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
            VALUES (%s, 'Venzo', 'R29 Test', '29', 'Negra', 'CUADRO-TALLER-001', 'Bici para test')
            RETURNING id
            """,
            (cliente_id,),
        )
        bicicleta_cliente_id = cur.fetchone()["id"]

    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "otro_cliente_id": otro_cliente_id,
        "sucursal_id": sucursal_id,
        "bicicleta_cliente_id": bicicleta_cliente_id,
    }