import os
from pathlib import Path

import psycopg
import pytest
from psycopg.rows import dict_row
from fastapi.testclient import TestClient

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
        # Orden importante por FKs

        # tablas hijas de pagos
        cur.execute("DELETE FROM pagos_tarjeta_detalle")
        cur.execute("DELETE FROM pagos_reversiones")

        # pagos antes que clientes/ventas
        cur.execute("DELETE FROM pagos")

        # tablas hijas de ventas
        cur.execute("DELETE FROM movimientos_stock")
        cur.execute("DELETE FROM venta_anulaciones")
        cur.execute("DELETE FROM venta_items")
        cur.execute("DELETE FROM ventas")

        # stock y catálogo
        cur.execute("DELETE FROM stock_sucursal")
        cur.execute("DELETE FROM variantes")
        cur.execute("DELETE FROM productos")
        cur.execute("DELETE FROM categorias")

        # maestros
        cur.execute("DELETE FROM sucursales")
        cur.execute("DELETE FROM clientes WHERE nombre <> 'Consumidor final'")
        cur.execute("DELETE FROM usuarios")

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
            INSERT INTO clientes (
                nombre,
                telefono,
                tipo_cliente,
                activo
            )
            VALUES ('Cliente Test', '2910000000', 'minorista', TRUE)
            RETURNING id
            """
        )
        cliente_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO sucursales (
                nombre,
                direccion,
                activa
            )
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
        "variante_id": variante_id,
        "stock_id": stock_id,
    }


def get_stock_row(db_conn, sucursal_id, variante_id):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (sucursal_id, variante_id),
        )
        return cur.fetchone()


def get_venta(db_conn, venta_id):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                estado,
                total_final,
                saldo_pendiente,
                id_cliente,
                id_sucursal
            FROM ventas
            WHERE id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()


def get_movimientos_by_venta(db_conn, venta_id):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_variante,
                tipo_movimiento,
                cantidad,
                origen_tipo,
                origen_id,
                nota
            FROM movimientos_stock
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            ORDER BY id
            """,
            (venta_id,),
        )
        return cur.fetchall()