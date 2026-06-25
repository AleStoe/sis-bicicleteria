from psycopg.rows import dict_row


def _cotizacion_select_sql():
    return """
        SELECT
            c.*,
            s.nombre AS sucursal_nombre,
            cli.nombre AS cliente_nombre,
            cli.nombre_persona AS cliente_nombre_persona,
            cli.apellido AS cliente_apellido,
            cli.telefono AS cliente_telefono,
            COUNT(ci.id)::int AS items_count
        FROM cotizaciones c
        INNER JOIN sucursales s ON s.id = c.id_sucursal
        LEFT JOIN clientes cli ON cli.id = c.id_cliente
        LEFT JOIN cotizacion_items ci ON ci.id_cotizacion = c.id
    """


def insert_cotizacion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO cotizaciones (
                tipo,
                estado,
                fecha_validez,
                id_sucursal,
                id_cliente,
                cliente_nombre_snapshot,
                cliente_telefono_snapshot,
                id_bicicleta_cliente,
                problema_reportado,
                observaciones,
                descuento_total,
                recargo_total,
                id_usuario_creador
            )
            VALUES (
                %(tipo)s,
                'borrador',
                %(fecha_validez)s,
                %(id_sucursal)s,
                %(id_cliente)s,
                %(cliente_nombre_snapshot)s,
                %(cliente_telefono_snapshot)s,
                %(id_bicicleta_cliente)s,
                %(problema_reportado)s,
                %(observaciones)s,
                %(descuento_total)s,
                %(recargo_total)s,
                %(id_usuario_creador)s
            )
            RETURNING *
            """,
            data,
        )
        return cur.fetchone()


def listar_cotizaciones(conn, *, tipo: str | None = None, estado: str | None = None):
    params = {}
    where = ["1=1"]

    if tipo:
        where.append("c.tipo = %(tipo)s")
        params["tipo"] = tipo

    if estado:
        where.append("c.estado = %(estado)s")
        params["estado"] = estado

    sql = f"""
        {_cotizacion_select_sql()}
        WHERE {" AND ".join(where)}
        GROUP BY c.id, s.nombre, cli.nombre, cli.nombre_persona, cli.apellido, cli.telefono
        ORDER BY c.fecha DESC, c.id DESC
    """

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_cotizacion_by_id(conn, cotizacion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            {_cotizacion_select_sql()}
            WHERE c.id = %s
            GROUP BY c.id, s.nombre, cli.nombre, cli.nombre_persona, cli.apellido, cli.telefono
            """,
            (cotizacion_id,),
        )
        return cur.fetchone()


def get_cotizacion_items(conn, cotizacion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM cotizacion_items
            WHERE id_cotizacion = %s
            ORDER BY orden ASC, id ASC
            """,
            (cotizacion_id,),
        )
        return cur.fetchall()


def insert_cotizacion_item(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO cotizacion_items (
                id_cotizacion,
                tipo_item,
                id_variante,
                id_servicio_taller,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                descuento_monto,
                subtotal,
                costo_unitario_referencia,
                notas,
                orden
            )
            VALUES (
                %(id_cotizacion)s,
                %(tipo_item)s,
                %(id_variante)s,
                %(id_servicio_taller)s,
                %(descripcion_snapshot)s,
                %(cantidad)s,
                %(precio_unitario)s,
                %(descuento_monto)s,
                %(subtotal)s,
                %(costo_unitario_referencia)s,
                %(notas)s,
                %(orden)s
            )
            RETURNING *
            """,
            data,
        )
        return cur.fetchone()


def delete_cotizacion_item(conn, cotizacion_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            DELETE FROM cotizacion_items
            WHERE id = %s
              AND id_cotizacion = %s
            RETURNING *
            """,
            (item_id, cotizacion_id),
        )
        return cur.fetchone()


def recalcular_totales_cotizacion(conn, cotizacion_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE cotizaciones c
            SET subtotal = COALESCE(t.subtotal_items, 0),
                total_final = GREATEST(
                    COALESCE(t.subtotal_items, 0) - c.descuento_total + c.recargo_total,
                    0
                ),
                updated_at = NOW()
            FROM (
                SELECT COALESCE(SUM(subtotal), 0)::numeric(14,2) AS subtotal_items
                FROM cotizacion_items
                WHERE id_cotizacion = %s
            ) t
            WHERE c.id = %s
            RETURNING c.*
            """,
            (cotizacion_id, cotizacion_id),
        )
        return cur.fetchone()


def cambiar_estado_cotizacion(conn, cotizacion_id: int, estado: str, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE cotizaciones
            SET estado = %s,
                id_usuario_actualiza = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (estado, id_usuario, cotizacion_id),
        )
        return cur.fetchone()


def get_sucursal_by_id(conn, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM sucursales WHERE id = %s", (sucursal_id,))
        return cur.fetchone()


def get_cliente_by_id(conn, cliente_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM clientes WHERE id = %s", (cliente_id,))
        return cur.fetchone()


def get_usuario_by_id(conn, usuario_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM usuarios WHERE id = %s", (usuario_id,))
        return cur.fetchone()


def get_bicicleta_cliente_by_id(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicletas_clientes
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()


def get_variante_cotizable_by_id(conn, variante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.*,
                p.nombre AS producto_nombre,
                p.activo AS producto_activo
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            """,
            (variante_id,),
        )
        return cur.fetchone()


def get_servicio_taller_by_id(conn, servicio_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM servicios_taller
            WHERE id = %s
            """,
            (servicio_id,),
        )
        return cur.fetchone()
