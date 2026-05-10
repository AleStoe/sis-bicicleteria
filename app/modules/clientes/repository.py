def get_clientes(conn, q=None, solo_activos=False):
    sql = """
        SELECT
            id,
            nombre,
            telefono,
            dni,
            direccion,
            tipo_cliente,
            condicion_iva,
            cuit,
            razon_social,
            notas,
            activo
        FROM clientes
        WHERE 1=1
    """
    params = []

    if solo_activos:
        sql += " AND activo = true"

    if q and q.strip():
        q_like = f"%{q.strip()}%"
        sql += """
            AND (
                nombre ILIKE %s
                OR telefono ILIKE %s
                OR COALESCE(dni, '') ILIKE %s
                OR COALESCE(cuit, '') ILIKE %s
                OR COALESCE(razon_social, '') ILIKE %s
            )
        """
        params.extend([q_like, q_like, q_like, q_like, q_like])

    sql += " ORDER BY activo DESC, nombre ASC, id ASC"

    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_cliente_by_id(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                telefono,
                dni,
                direccion,
                tipo_cliente,
                condicion_iva,
                cuit,
                razon_social,
                notas,
                activo
            FROM clientes
            WHERE id = %s
            """,
            (cliente_id,),
        )
        return cur.fetchone()


def insert_cliente(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clientes (
                nombre,
                telefono,
                dni,
                direccion,
                tipo_cliente,
                condicion_iva,
                cuit,
                razon_social,
                notas,
                activo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id
            """,
            (
                data.nombre,
                data.telefono,
                data.dni,
                data.direccion,
                data.tipo_cliente,
                data.condicion_iva,
                data.cuit,
                data.razon_social,
                data.notas,
            ),
        )
        row = cur.fetchone()
        return row["id"]


def update_cliente(conn, cliente_id: int, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clientes
            SET
                nombre = %s,
                telefono = %s,
                dni = %s,
                direccion = %s,
                tipo_cliente = %s,
                condicion_iva = %s,
                cuit = %s,
                razon_social = %s,
                notas = %s,
                activo = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (
                data.nombre,
                data.telefono,
                data.dni,
                data.direccion,
                data.tipo_cliente,
                data.condicion_iva,
                data.cuit,
                data.razon_social,
                data.notas,
                data.activo,
                cliente_id,
            ),
        )


def desactivar_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clientes
            SET
                activo = false,
                updated_at = now()
            WHERE id = %s
            """,
            (cliente_id,),
        )


def get_ventas_cliente(conn, cliente_id: int, limit=20):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                estado,
                total_final AS total,
                saldo_pendiente
            FROM ventas
            WHERE id_cliente = %s
            ORDER BY fecha DESC, id DESC
            LIMIT %s
            """,
            (cliente_id, limit),
        )
        return cur.fetchall()


def get_resumen_ventas_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE estado IN ('entregada', 'pagada_parcial')
                )::int AS cantidad_ventas,

                COALESCE(
                    SUM(total_final) FILTER (
                        WHERE estado IN ('entregada', 'pagada_parcial')
                    ),
                    0
                )::numeric(14,2) AS total_comprado,

                COALESCE(
                    SUM(saldo_pendiente) FILTER (
                        WHERE estado IN ('entregada', 'pagada_parcial')
                          AND saldo_pendiente > 0
                    ),
                    0
                )::numeric(14,2) AS saldo_pendiente_total,

                MAX(fecha) FILTER (
                    WHERE estado IN ('entregada', 'pagada_parcial')
                ) AS ultima_venta_fecha
            FROM ventas
            WHERE id_cliente = %s
            """,
            (cliente_id,),
        )
        return cur.fetchone()


def activar_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clientes
            SET
                activo = true,
                updated_at = now()
            WHERE id = %s
            """,
            (cliente_id,),
        )


def get_bicicletas_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                id_bicicleta_serializada,
                id_venta_origen,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            FROM bicicletas_clientes
            WHERE id_cliente = %s
            ORDER BY id DESC
            """,
            (cliente_id,),
        )
        return cur.fetchall()


def insert_bicicleta_cliente(conn, cliente_id: int, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_clientes (
                id_cliente,
                id_bicicleta_serializada,
                id_venta_origen,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                id_cliente,
                id_bicicleta_serializada,
                id_venta_origen,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            """,
            (
                cliente_id,
                getattr(data, "id_bicicleta_serializada", None),
                getattr(data, "id_venta_origen", None),
                data.marca,
                data.modelo,
                data.rodado,
                data.color,
                data.numero_cuadro,
                data.notas,
            ),
        )
        return cur.fetchone()
    
def get_bicicleta_cliente_detalle(conn, cliente_id: int, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                id_bicicleta_serializada,
                id_venta_origen,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas,
                created_at,
                updated_at
            FROM bicicletas_clientes
            WHERE id = %s
              AND id_cliente = %s
            """,
            (bicicleta_id, cliente_id),
        )
        return cur.fetchone()


def get_historial_taller_bicicleta_cliente(conn, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha_ingreso,
                estado,
                problema_reportado,
                observaciones,
                fecha_prometida,
                total_final,
                saldo_pendiente
            FROM ordenes_taller
            WHERE id_bicicleta_cliente = %s
            ORDER BY fecha_ingreso DESC, id DESC
            """,
            (bicicleta_id,),
        )
        return cur.fetchall()


def get_venta_origen_bicicleta_cliente(conn, venta_id: int | None):
    if venta_id is None:
        return None

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                estado,
                total_final,
                saldo_pendiente
            FROM ventas
            WHERE id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()