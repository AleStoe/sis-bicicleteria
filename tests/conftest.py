import os

import psycopg
import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from psycopg.rows import dict_row


# Cargar configuración de pruebas sin reutilizar accidentalmente la base operativa.
TEST_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.test")
if os.path.exists(TEST_ENV_PATH):
    load_dotenv(TEST_ENV_PATH, override=False)

os.environ.setdefault("APP_AUTH_DISABLED", "true")

required_test_settings = (
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
)
missing_test_settings = [
    key for key in required_test_settings if not os.environ.get(key)
]
if missing_test_settings:
    raise RuntimeError(
        "Falta configuración de pruebas. Definí estas variables o creá "
        f".env.test: {', '.join(missing_test_settings)}"
    )

if "test" not in os.environ["DB_NAME"].lower():
    raise RuntimeError(
        "DB_NAME de pytest debe identificar explícitamente una base de test."
    )

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
                inventario_fisico_items,
                inventarios_fisicos,
                cotizacion_items,
                cotizaciones,
                gastos_movimientos,
                gastos_operativos,
                gasto_categorias,
                caja_movimientos,
                cajas,
                deuda_movimientos,
                deudas_cliente,
                auditoria_eventos,
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
                ordenes_taller_notas,
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

        cur.execute("SELECT setval('cotizaciones_numero_seq', 1, false)")

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

    asignar_rol_usuario(db_conn, usuario_id, "administrador")

    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "sucursal_id": sucursal_id,
        "categoria_id": categoria_id,
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

    asignar_rol_usuario(db_conn, usuario_id, "administrador")

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

    asignar_rol_usuario(db_conn, usuario_id, "administrador")

    db_conn.commit()

    return {
        "usuario_id": usuario_id,
        "cliente_id": cliente_id,
        "otro_cliente_id": otro_cliente_id,
        "sucursal_id": sucursal_id,
        "bicicleta_cliente_id": bicicleta_cliente_id,
    }

def get_auditoria_by_entidad(conn, entidad: str, entidad_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM auditoria_eventos
            WHERE entidad = %s
              AND entidad_id = %s
            ORDER BY id
            """,
            (entidad, entidad_id),
        )
        return cur.fetchall()

def get_auditoria(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM auditoria_eventos
            ORDER BY id
            """
        )
        return cur.fetchall()   

def get_deuda(conn, deuda_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM deudas_cliente
            WHERE id = %s
            """,
            (deuda_id,),
        )
        return cur.fetchone()


def get_deudas_by_cliente(conn, id_cliente: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM deudas_cliente
            WHERE id_cliente = %s
            ORDER BY id
            """,
            (id_cliente,),
        )
        return cur.fetchall()


def get_deuda_movimientos(conn, deuda_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM deuda_movimientos
            WHERE id_deuda = %s
            ORDER BY id
            """,
            (deuda_id,),
        )
        return cur.fetchall()

def ensure_rol(db_conn, nombre: str):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO roles (nombre)
            VALUES (%s)
            ON CONFLICT (nombre) DO UPDATE
            SET nombre = EXCLUDED.nombre
            RETURNING id
            """,
            (nombre,),
        )
        return cur.fetchone()["id"]


def asignar_rol_usuario(db_conn, id_usuario: int, nombre_rol: str):
    rol_id = ensure_rol(db_conn, nombre_rol)

    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuario_roles (id_usuario, id_rol)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (id_usuario, rol_id),
        )

def get_reserva(conn, reserva_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM reservas
            WHERE id = %s
            """,
            (reserva_id,),
        )
        return cur.fetchone()

def get_pago_tarjeta_detalle_by_pago_id(conn, pago_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id_pago,
                monto_base,
                monto_recargo_financiero,
                monto_neto_liquidado,
                cuotas,
                entidad
            FROM pagos_tarjeta_detalle
            WHERE id_pago = %s
            """,
            (pago_id,),
        )

        return cur.fetchone()

def get_venta_items(conn, venta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM venta_items
            WHERE id_venta = %s
            ORDER BY id
            """,
            (venta_id,),
        )
        return cur.fetchall()

def get_pagos_by_venta(conn, venta_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM pagos
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY id
            """,
            (venta_id,),
        )
        return cur.fetchall()
