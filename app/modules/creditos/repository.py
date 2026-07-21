from psycopg.rows import dict_row
from decimal import Decimal

def insert_credito_cliente(
    conn,
    *,
    id_cliente: int,
    origen_tipo: str,
    origen_id: int,
    saldo_actual: Decimal,
    observacion: str | None = None,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO creditos_cliente (
                id_cliente,
                origen_tipo,
                origen_id,
                saldo_actual,
                estado,
                observacion
            )
            VALUES (%s, %s, %s, %s, 'abierto', %s)
            RETURNING *
            """,
            (
                id_cliente,
                origen_tipo,
                origen_id,
                saldo_actual,
                observacion,
            ),
        )
        return cur.fetchone()



def insert_credito_movimiento(
    conn,
    *,
    id_credito: int,
    tipo_movimiento: str,
    monto: Decimal,
    monto_base_aplicado: Decimal | None = None,
    monto_descuento_aplicado: Decimal | None = None,
    origen_tipo: str | None,
    origen_id: int | None,
    nota: str | None,
    id_usuario: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO credito_movimientos (
                id_credito,
                tipo_movimiento,
                monto,
                monto_base_aplicado,
                monto_descuento_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                id_credito,
                tipo_movimiento,
                monto,
                monto_base_aplicado,
                monto_descuento_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
            ),
        )
        return cur.fetchone()


def get_credito_by_id(conn, credito_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id = %s
            """,
            (credito_id,),
        )
        return cur.fetchone()


def get_creditos_cliente(conn, id_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
            ORDER BY id DESC
            """,
            (id_cliente,),
        )
        return cur.fetchall()


def get_clientes_con_credito_disponible(conn, q: str | None = None, limit: int = 100):
    params: dict[str, object] = {"limit": limit}
    filtro_busqueda = ""

    if q and q.strip():
        params["query"] = f"%{q.strip()}%"
        filtro_busqueda = """
            AND (
                c.nombre ILIKE %(query)s
                OR COALESCE(c.telefono, '') ILIKE %(query)s
                OR COALESCE(c.dni, '') ILIKE %(query)s
                OR COALESCE(c.cuit, '') ILIKE %(query)s
                OR COALESCE(cr.origen_tipo, '') ILIKE %(query)s
                OR CAST(cr.origen_id AS TEXT) ILIKE %(query)s
            )
        """

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            WITH creditos_filtrados AS (
                SELECT
                    cr.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY cr.id_cliente
                        ORDER BY cr.created_at DESC, cr.id DESC
                    ) AS rn
                FROM creditos_cliente cr
                INNER JOIN clientes c
                    ON c.id = cr.id_cliente
                WHERE cr.estado IN ('abierto', 'aplicado_parcial')
                  AND cr.saldo_actual > 0
                  {filtro_busqueda}
            )
            SELECT
                c.id AS id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                c.dni AS cliente_dni,
                c.cuit AS cliente_cuit,
                COUNT(cf.id)::int AS creditos_disponibles,
                COALESCE(SUM(cf.saldo_actual), 0) AS saldo_total,
                MAX(cf.created_at) AS ultima_fecha,
                MAX(CASE WHEN cf.rn = 1 THEN cf.origen_tipo END) AS ultimo_origen_tipo,
                MAX(CASE WHEN cf.rn = 1 THEN cf.origen_id END) AS ultimo_origen_id
            FROM creditos_filtrados cf
            INNER JOIN clientes c
                ON c.id = cf.id_cliente
            GROUP BY c.id, c.nombre, c.telefono, c.dni, c.cuit
            ORDER BY saldo_total DESC, c.nombre ASC
            LIMIT %(limit)s
            """,
            params,
        )
        return cur.fetchall()


def get_credito_movimientos(conn, credito_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                cm.id,
                cm.id_credito,
                cm.tipo_movimiento,
                cm.monto,
                cm.monto_base_aplicado,
                cm.monto_descuento_aplicado,
                cm.origen_tipo,
                cm.origen_id,
                cm.nota,
                cm.id_usuario,
                u.nombre AS usuario_nombre,
                u.username AS usuario_username
            FROM credito_movimientos cm
            LEFT JOIN usuarios u
                ON u.id = cm.id_usuario
            WHERE cm.id_credito = %s
            ORDER BY cm.id ASC
            """,
            (credito_id,),
        )
        return cur.fetchall()

def get_credito_abierto_by_origen(conn, *, origen_tipo: str, origen_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE origen_tipo = %s
              AND origen_id = %s
              AND estado IN ('abierto', 'aplicado_parcial')
            ORDER BY id DESC
            LIMIT 1
            """,
            (origen_tipo, origen_id),
        )
        return cur.fetchone()


def get_credito_abierto_by_origen_for_update(
    conn,
    *,
    origen_tipo: str,
    origen_id: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE origen_tipo = %s
              AND origen_id = %s
              AND estado IN ('abierto', 'aplicado_parcial')
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (origen_tipo, origen_id),
        )
        return cur.fetchone()

def get_creditos_disponibles_cliente(conn, id_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
              AND estado IN ('abierto', 'aplicado_parcial')
              AND saldo_actual > 0
            ORDER BY id ASC
            """,
            (id_cliente,),
        )
        return cur.fetchall()


def update_credito_saldo_y_estado(
    conn,
    *,
    credito_id: int,
    saldo_actual: Decimal,
    estado: str,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE creditos_cliente
            SET saldo_actual = %s,
                estado = %s
            WHERE id = %s
            RETURNING *
            """,
            (
                saldo_actual,
                estado,
                credito_id,
            ),
        )
        return cur.fetchone()


def get_creditos_disponibles_cliente_for_update(conn, id_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id_cliente = %s
              AND estado IN ('abierto', 'aplicado_parcial')
              AND saldo_actual > 0
            ORDER BY id ASC
            FOR UPDATE
            """,
            (id_cliente,),
        )
        return cur.fetchall()

def get_credito_by_id_for_update(conn, credito_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM creditos_cliente
            WHERE id = %s
            FOR UPDATE
            """,
            (credito_id,),
        )
        return cur.fetchone()

def get_total_credito_aplicado_a_venta(conn, venta_id: int) -> Decimal:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(monto), 0) AS total
            FROM credito_movimientos
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
              AND tipo_movimiento = 'aplicacion_a_venta'
            """,
            (venta_id,),
        )
        row = cur.fetchone()
        return Decimal(str(row["total"] or 0))


def get_aplicaciones_credito_venta(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                aplicacion.*,
                COALESCE(
                    (
                        SELECT SUM(restauracion.monto)
                        FROM credito_movimientos restauracion
                        WHERE restauracion.tipo_movimiento = 'ajuste'
                          AND restauracion.origen_tipo = 'credito_aplicacion_restaurada'
                          AND restauracion.origen_id = aplicacion.id
                    ),
                    0
                ) AS monto_restaurado
            FROM credito_movimientos aplicacion
            WHERE aplicacion.origen_tipo = 'venta'
              AND aplicacion.origen_id = %s
              AND aplicacion.tipo_movimiento = 'aplicacion_a_venta'
            ORDER BY aplicacion.id
            """,
            (venta_id,),
        )
        return cur.fetchall()

def get_total_credito_generado_por_venta(conn, venta_id: int) -> Decimal:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(monto), 0) AS total
            FROM credito_movimientos
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
              AND tipo_movimiento = 'credito_generado'
            """,
            (venta_id,),
        )
        row = cur.fetchone()
        return Decimal(str(row["total"] or 0))
