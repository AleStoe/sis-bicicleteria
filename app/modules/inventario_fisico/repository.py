from decimal import Decimal

from app.modules.stock.repository import TIPO_OPERATIVO_SQL


def insert_inventario(conn, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO inventarios_fisicos (
                id_sucursal,
                descripcion,
                id_usuario_creador
            )
            VALUES (%s, %s, %s)
            RETURNING *
            """,
            (
                data["id_sucursal"],
                data.get("descripcion"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()


def _filtros_snapshot_stock(*, id_categoria=None, tipo_operativo=None):
    where = [
        "ss.id_sucursal = %s",
        "v.activo = TRUE",
        "p.activo = TRUE",
        "p.stockeable = TRUE",
    ]
    params = []

    if id_categoria is not None:
        where.append("p.id_categoria = %s")
        params.append(id_categoria)

    if tipo_operativo:
        if tipo_operativo == "no_bicicletas":
            where.append(f"({TIPO_OPERATIVO_SQL}) <> 'bicicleta'")
        else:
            where.append(f"({TIPO_OPERATIVO_SQL}) = %s")
            params.append(tipo_operativo)

    return where, params


def snapshot_stock_inventario(
    conn,
    inventario_id: int,
    id_sucursal: int,
    *,
    id_categoria=None,
    tipo_operativo=None,
):
    where, filter_params = _filtros_snapshot_stock(
        id_categoria=id_categoria,
        tipo_operativo=tipo_operativo,
    )

    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO inventario_fisico_items (
                id_inventario,
                id_variante,
                stock_sistema,
                diferencia
            )
            SELECT
                %s,
                ss.id_variante,
                ss.stock_fisico,
                0
            FROM stock_sucursal ss
            JOIN variantes v ON v.id = ss.id_variante
            JOIN productos p ON p.id = v.id_producto
            JOIN categorias c ON c.id = p.id_categoria
            WHERE {" AND ".join(where)}
            ON CONFLICT (id_inventario, id_variante) DO NOTHING
            """,
            (inventario_id, id_sucursal, *filter_params),
        )


def get_inventarios(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                i.*,
                s.nombre AS sucursal_nombre,
                COUNT(ii.id) AS total_items,
                COUNT(ii.id) FILTER (WHERE ii.stock_contado IS NOT NULL) AS items_contados,
                COUNT(ii.id) FILTER (WHERE ii.stock_contado IS NOT NULL AND ii.diferencia <> 0) AS items_con_diferencia
            FROM inventarios_fisicos i
            JOIN sucursales s ON s.id = i.id_sucursal
            LEFT JOIN inventario_fisico_items ii ON ii.id_inventario = i.id
            GROUP BY i.id, s.nombre
            ORDER BY i.fecha_inicio DESC, i.id DESC
            """
        )
        return cur.fetchall()


def get_inventario_by_id(conn, inventario_id: int, *, for_update=False):
    if for_update:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM inventarios_fisicos
                WHERE id = %s
                FOR UPDATE
                """,
                (inventario_id,),
            )
            if cur.fetchone() is None:
                return None

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                i.*,
                s.nombre AS sucursal_nombre,
                COUNT(ii.id) AS total_items,
                COUNT(ii.id) FILTER (WHERE ii.stock_contado IS NOT NULL) AS items_contados,
                COUNT(ii.id) FILTER (WHERE ii.stock_contado IS NOT NULL AND ii.diferencia <> 0) AS items_con_diferencia
            FROM inventarios_fisicos i
            JOIN sucursales s ON s.id = i.id_sucursal
            LEFT JOIN inventario_fisico_items ii ON ii.id_inventario = i.id
            WHERE i.id = %s
            GROUP BY i.id, s.nombre
            """,
            (inventario_id,),
        )
        return cur.fetchone()


def get_items_inventario(conn, inventario_id: int):
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                ii.*,
                p.nombre AS producto_nombre,
                c.nombre AS categoria_nombre,
                {TIPO_OPERATIVO_SQL} AS tipo_operativo,
                v.nombre_variante,
                v.sku,
                v.codigo_proveedor,
                (ii.diferencia * v.costo_promedio_vigente)::numeric(14,2) AS valor_diferencia
            FROM inventario_fisico_items ii
            JOIN variantes v ON v.id = ii.id_variante
            JOIN productos p ON p.id = v.id_producto
            JOIN categorias c ON c.id = p.id_categoria
            WHERE ii.id_inventario = %s
            ORDER BY c.nombre, p.nombre, v.nombre_variante
            """,
            (inventario_id,),
        )
        return cur.fetchall()


def get_item_inventario_for_update(conn, inventario_id: int, variante_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM inventario_fisico_items
            WHERE id_inventario = %s
              AND id_variante = %s
            FOR UPDATE
            """,
            (inventario_id, variante_id),
        )
        return cur.fetchone()


def get_historial_diferencias(conn, *, id_sucursal: int | None = None, limit: int = 100):
    params = []
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND i.id_sucursal = %s"
        params.append(id_sucursal)

    params.append(limit)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                i.id AS inventario_id,
                i.fecha_cierre,
                i.id_sucursal,
                s.nombre AS sucursal_nombre,
                i.descripcion,
                ii.id_variante,
                p.nombre AS producto_nombre,
                c.nombre AS categoria_nombre,
                {TIPO_OPERATIVO_SQL} AS tipo_operativo,
                v.nombre_variante,
                v.sku,
                v.codigo_proveedor,
                ii.stock_sistema,
                ii.stock_contado,
                ii.diferencia,
                (ii.diferencia * v.costo_promedio_vigente)::numeric(14,2) AS valor_diferencia,
                ii.movimiento_stock_id
            FROM inventario_fisico_items ii
            INNER JOIN inventarios_fisicos i ON i.id = ii.id_inventario
            INNER JOIN sucursales s ON s.id = i.id_sucursal
            INNER JOIN variantes v ON v.id = ii.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN categorias c ON c.id = p.id_categoria
            WHERE i.estado = 'cerrado'
              AND ii.stock_contado IS NOT NULL
              AND ii.diferencia <> 0
              {sucursal_sql}
            ORDER BY i.fecha_cierre DESC, ABS(ii.diferencia) DESC, ii.id DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def upsert_conteo_item(conn, inventario_id: int, data: dict):
    stock_contado = Decimal(str(data["stock_contado"]))

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE inventario_fisico_items
            SET
                stock_contado = %s,
                diferencia = %s - stock_sistema,
                nota = %s,
                contado_at = NOW(),
                id_usuario_conteo = %s,
                updated_at = NOW()
            WHERE id_inventario = %s
              AND id_variante = %s
            RETURNING *
            """,
            (
                stock_contado,
                stock_contado,
                data.get("nota"),
                data["id_usuario"],
                inventario_id,
                data["id_variante"],
            ),
        )
        return cur.fetchone()


def set_movimiento_item(conn, item_id: int, movimiento_id: int | None):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE inventario_fisico_items
            SET movimiento_stock_id = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (movimiento_id, item_id),
        )


def cerrar_inventario(conn, inventario_id: int, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE inventarios_fisicos
            SET
                estado = 'cerrado',
                id_usuario_cierre = %s,
                fecha_cierre = NOW(),
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (id_usuario, inventario_id),
        )
        return cur.fetchone()


def cancelar_inventario(conn, inventario_id: int, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE inventarios_fisicos
            SET
                estado = 'cancelado',
                id_usuario_cierre = %s,
                fecha_cierre = NOW(),
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (id_usuario, inventario_id),
        )
        return cur.fetchone()
