from decimal import Decimal

from app.db.connection import get_connection
from psycopg.rows import dict_row
from app.shared.money import to_decimal

# =========================================================
# CONSULTAS
# =========================================================

TIPO_OPERATIVO_SQL = """
CASE
    WHEN p.serializable = TRUE
      OR POSITION('bicicleta' IN LOWER(COALESCE(c.nombre, ''))) > 0
      OR POSITION('bicicleta' IN LOWER(COALESCE(p.nombre, ''))) > 0
      OR p.rodado IS NOT NULL
      OR p.tipo_bicicleta IS NOT NULL
    THEN 'bicicleta'
    WHEN POSITION('accesorio' IN LOWER(COALESCE(c.nombre, ''))) > 0
      OR POSITION('accesorio' IN LOWER(COALESCE(p.nombre, ''))) > 0
    THEN 'accesorio'
    WHEN POSITION('repuesto' IN LOWER(COALESCE(c.nombre, ''))) > 0
      OR POSITION('repuesto' IN LOWER(COALESCE(p.nombre, ''))) > 0
    THEN 'repuesto'
    ELSE 'producto'
END
"""


def _stock_base_select():
    return f"""
        WITH ultimas_ventas AS (
            SELECT
                vi.id_variante,
                MAX(v.fecha) AS ultima_venta
            FROM venta_items vi
            INNER JOIN ventas v ON v.id = vi.id_venta
            WHERE v.estado NOT IN ('anulada', 'devuelta')
              AND vi.tipo_item = 'producto'
            GROUP BY vi.id_variante
        )
        SELECT
            s.id AS sucursal_id,
            s.nombre AS sucursal_nombre,
            v.id AS variante_id,
            p.id AS producto_id,
            p.nombre AS producto_nombre,
            v.nombre_variante,
            v.sku,
            v.codigo_barras,
            v.codigo_proveedor,
            COALESCE(ss.stock_fisico, 0) AS stock_fisico,
            COALESCE(ss.stock_reservado, 0) AS stock_reservado,
            COALESCE(ss.stock_vendido_pendiente_entrega, 0) AS stock_vendido_pendiente_entrega,
            (
                COALESCE(ss.stock_fisico, 0)
                - COALESCE(ss.stock_reservado, 0)
                - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
            ) AS stock_disponible,
            c.id AS id_categoria,
            c.nombre AS categoria_nombre,
            m.id AS id_marca,
            m.nombre AS marca_nombre,
            pr.id AS id_proveedor,
            pr.nombre AS proveedor_nombre,
            p.tipo_item AS producto_tipo_item,
            p.serializable,
            {TIPO_OPERATIVO_SQL} AS tipo_operativo,
            v.costo_promedio_vigente,
            (COALESCE(ss.stock_fisico, 0) * v.costo_promedio_vigente)::numeric(14,2) AS capital_inmovilizado,
            uv.ultima_venta,
            CASE
                WHEN uv.ultima_venta IS NULL THEN NULL
                ELSE (CURRENT_DATE - uv.ultima_venta::date)::int
            END AS dias_sin_movimiento
        FROM variantes v
        INNER JOIN productos p ON p.id = v.id_producto
        INNER JOIN categorias c ON c.id = p.id_categoria
        CROSS JOIN sucursales s
        LEFT JOIN stock_sucursal ss
            ON ss.id_variante = v.id
           AND ss.id_sucursal = s.id
        LEFT JOIN marcas m ON m.id = p.id_marca
        LEFT JOIN proveedores pr ON pr.id = v.proveedor_preferido_id
        LEFT JOIN ultimas_ventas uv ON uv.id_variante = v.id
    """


def _build_stock_filters(
    *,
    q=None,
    id_sucursal=None,
    id_categoria=None,
    id_marca=None,
    id_proveedor=None,
    tipo_operativo=None,
    estado_stock=None,
    stock_bajo_umbral=2,
    dias_sin_movimiento=None,
):
    where = [
        "p.activo = TRUE",
        "v.activo = TRUE",
        "p.stockeable = TRUE",
        "s.activa = TRUE",
    ]
    params = []

    if q:
        like = f"%{q.strip()}%"
        where.append(
            """
            (
                p.nombre ILIKE %s
                OR v.nombre_variante ILIKE %s
                OR v.sku ILIKE %s
                OR v.codigo_barras ILIKE %s
                OR v.codigo_proveedor ILIKE %s
                OR c.nombre ILIKE %s
                OR COALESCE(m.nombre, '') ILIKE %s
                OR COALESCE(pr.nombre, '') ILIKE %s
                OR CAST(v.id AS TEXT) = %s
            )
            """
        )
        params.extend([like, like, like, like, like, like, like, like, q.strip()])

    if id_sucursal is not None:
        where.append("s.id = %s")
        params.append(id_sucursal)

    if id_categoria is not None:
        where.append("p.id_categoria = %s")
        params.append(id_categoria)

    if id_marca is not None:
        where.append("p.id_marca = %s")
        params.append(id_marca)

    if id_proveedor is not None:
        where.append("v.proveedor_preferido_id = %s")
        params.append(id_proveedor)

    if tipo_operativo and tipo_operativo != "todos":
        if tipo_operativo == "no_bicicletas":
            where.append(f"({TIPO_OPERATIVO_SQL}) <> 'bicicleta'")
        else:
            where.append(f"({TIPO_OPERATIVO_SQL}) = %s")
            params.append(tipo_operativo)

    disponible_sql = """
    (
        COALESCE(ss.stock_fisico, 0)
        - COALESCE(ss.stock_reservado, 0)
        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
    )
    """

    if estado_stock and estado_stock != "todos":
        if estado_stock == "con_stock":
            where.append(f"{disponible_sql} > 0")
        elif estado_stock in {"sin_stock", "sin_disponible"}:
            where.append(f"{disponible_sql} <= 0")
        elif estado_stock in {"stock_bajo", "bajo"}:
            where.append(f"{disponible_sql} > 0 AND {disponible_sql} <= %s")
            params.append(stock_bajo_umbral)
        elif estado_stock == "reservado":
            where.append("COALESCE(ss.stock_reservado, 0) > 0")
        elif estado_stock == "pendiente":
            where.append("COALESCE(ss.stock_vendido_pendiente_entrega, 0) > 0")
        elif estado_stock == "inconsistente":
            where.append(
                f"""(
                    {disponible_sql} < 0
                    OR COALESCE(ss.stock_fisico, 0) < (
                        COALESCE(ss.stock_reservado, 0)
                        + COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    )
                )"""
            )

    if dias_sin_movimiento is not None:
        where.append(
            """
            COALESCE(ss.stock_fisico, 0) > 0
            AND (uv.ultima_venta IS NULL OR uv.ultima_venta::date <= CURRENT_DATE - (%s::int))
            """
        )
        params.append(dias_sin_movimiento)

    return where, params


def get_stock_sucursal(
    conn,
    *,
    q=None,
    id_sucursal=None,
    id_categoria=None,
    id_marca=None,
    id_proveedor=None,
    tipo_operativo=None,
    estado_stock=None,
    stock_bajo_umbral=2,
    dias_sin_movimiento=None,
    ordenar_por="producto",
    orden="asc",
    limit=500,
    offset=0,
):
    order_map = {
        "producto": "p.nombre",
        "variante": "v.nombre_variante",
        "stock": "stock_disponible",
        "fisico": "COALESCE(ss.stock_fisico, 0)",
        "capital": "capital_inmovilizado",
        "ultima_venta": "uv.ultima_venta",
        "categoria": "c.nombre",
        "marca": "m.nombre",
        "proveedor": "pr.nombre",
    }
    order_sql = order_map.get(ordenar_por or "producto", "p.nombre")
    direction = "DESC" if str(orden).lower() == "desc" else "ASC"

    where, params = _build_stock_filters(
        q=q,
        id_sucursal=id_sucursal,
        id_categoria=id_categoria,
        id_marca=id_marca,
        id_proveedor=id_proveedor,
        tipo_operativo=tipo_operativo,
        estado_stock=estado_stock,
        stock_bajo_umbral=stock_bajo_umbral,
        dias_sin_movimiento=dias_sin_movimiento,
    )

    params.extend([limit, offset])

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            {_stock_base_select()}
            WHERE {' AND '.join(where)}
            ORDER BY {order_sql} {direction} NULLS LAST, p.nombre ASC, v.nombre_variante ASC
            LIMIT %s OFFSET %s
            """,
            params,
        )
        return cur.fetchall()


def get_stock_resumen(
    conn,
    *,
    q=None,
    id_sucursal=None,
    id_categoria=None,
    id_marca=None,
    id_proveedor=None,
    tipo_operativo=None,
    estado_stock=None,
    stock_bajo_umbral=2,
    dias_sin_movimiento=None,
):
    where, params = _build_stock_filters(
        q=q,
        id_sucursal=id_sucursal,
        id_categoria=id_categoria,
        id_marca=id_marca,
        id_proveedor=id_proveedor,
        tipo_operativo=tipo_operativo,
        estado_stock=estado_stock,
        stock_bajo_umbral=stock_bajo_umbral,
        dias_sin_movimiento=dias_sin_movimiento,
    )

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                COUNT(*)::int AS total_items,
                COUNT(*) FILTER (
                    WHERE (
                        COALESCE(ss.stock_fisico, 0)
                        - COALESCE(ss.stock_reservado, 0)
                        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    ) > 0
                )::int AS con_stock,
                COUNT(*) FILTER (
                    WHERE (
                        COALESCE(ss.stock_fisico, 0)
                        - COALESCE(ss.stock_reservado, 0)
                        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    ) <= 0
                )::int AS sin_stock,
                COUNT(*) FILTER (
                    WHERE (
                        COALESCE(ss.stock_fisico, 0)
                        - COALESCE(ss.stock_reservado, 0)
                        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    ) > 0
                    AND (
                        COALESCE(ss.stock_fisico, 0)
                        - COALESCE(ss.stock_reservado, 0)
                        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    ) <= %s
                )::int AS stock_bajo,
                COUNT(*) FILTER (
                    WHERE COALESCE(ss.stock_reservado, 0) > 0
                )::int AS reservado,
                COUNT(*) FILTER (
                    WHERE COALESCE(ss.stock_vendido_pendiente_entrega, 0) > 0
                )::int AS pendiente_entrega,
                COUNT(*) FILTER (
                    WHERE (
                        COALESCE(ss.stock_fisico, 0)
                        - COALESCE(ss.stock_reservado, 0)
                        - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    ) < 0
                    OR COALESCE(ss.stock_fisico, 0) < (
                        COALESCE(ss.stock_reservado, 0)
                        + COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                    )
                )::int AS inconsistentes,
                COALESCE(SUM(COALESCE(ss.stock_fisico, 0)), 0)::numeric(14,3) AS stock_fisico_total,
                COALESCE(SUM(
                    COALESCE(ss.stock_fisico, 0)
                    - COALESCE(ss.stock_reservado, 0)
                    - COALESCE(ss.stock_vendido_pendiente_entrega, 0)
                ), 0)::numeric(14,3) AS stock_disponible_total,
                COALESCE(SUM(
                    COALESCE(ss.stock_fisico, 0) * v.costo_promedio_vigente
                ), 0)::numeric(14,2) AS capital_inmovilizado_total
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN categorias c ON c.id = p.id_categoria
            CROSS JOIN sucursales s
            LEFT JOIN stock_sucursal ss
                ON ss.id_variante = v.id
               AND ss.id_sucursal = s.id
            LEFT JOIN marcas m ON m.id = p.id_marca
            LEFT JOIN proveedores pr ON pr.id = v.proveedor_preferido_id
            LEFT JOIN (
                SELECT vi.id_variante, MAX(v2.fecha) AS ultima_venta
                FROM venta_items vi
                INNER JOIN ventas v2 ON v2.id = vi.id_venta
                WHERE v2.estado NOT IN ('anulada', 'devuelta')
                  AND vi.tipo_item = 'producto'
                GROUP BY vi.id_variante
            ) uv ON uv.id_variante = v.id
            WHERE {' AND '.join(where)}
            """,
            [stock_bajo_umbral, *params],
        )
        return cur.fetchone()


def obtener_stock_disponible(conn, id_sucursal: int, id_variante: int) -> Decimal:
    stock = obtener_stock_actual(conn, id_sucursal, id_variante)
    return to_decimal(stock["stock_disponible"])


def obtener_stock_actual(conn, id_sucursal: int, id_variante: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega,
                (
                    stock_fisico
                    - stock_reservado
                    - stock_vendido_pendiente_entrega
                ) AS stock_disponible
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (id_sucursal, id_variante),
        )
        row = cur.fetchone()

    if row:
        return row

    return {
        "id_sucursal": id_sucursal,
        "id_variante": id_variante,
        "stock_fisico": Decimal("0"),
        "stock_reservado": Decimal("0"),
        "stock_vendido_pendiente_entrega": Decimal("0"),
        "stock_disponible": Decimal("0"),
    }


def obtener_stock_actual_para_update(conn, id_sucursal: int, id_variante: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega,
                (
                    stock_fisico
                    - stock_reservado
                    - stock_vendido_pendiente_entrega
                ) AS stock_disponible
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            FOR UPDATE
            """,
            (id_sucursal, id_variante),
        )
        row = cur.fetchone()

    if row:
        return row

    return None


# =========================================================
# VALIDACIONES BASE
# =========================================================

def validar_sucursal_activa(conn, id_sucursal: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM sucursales WHERE id = %s AND activa = TRUE",
            (id_sucursal,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("La sucursal no existe o está inactiva")


def validar_variante_activa(conn, id_variante: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, costo_promedio_vigente
            FROM variantes
            WHERE id = %s AND activo = TRUE
            """,
            (id_variante,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("La variante no existe o está inactiva")

    return row


def validar_proveedor_activo(conn, id_proveedor: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM proveedores WHERE id = %s AND activo = TRUE",
            (id_proveedor,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El proveedor no existe o está inactivo")


def validar_usuario_activo(conn, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM usuarios WHERE id = %s AND activo = TRUE",
            (id_usuario,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El usuario no existe o está inactivo")


# =========================================================
# HELPERS INTERNOS DE STOCK
# =========================================================

def asegurar_stock_sucursal_para_update(conn, id_sucursal: int, id_variante: int):
    """
    Devuelve la fila de stock bloqueada con FOR UPDATE.
    Si no existe, la crea en cero y la vuelve a leer bloqueada.
    """
    row = obtener_stock_actual_para_update(conn, id_sucursal, id_variante)
    if row:
        return row

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 0, 0, 0)
            ON CONFLICT (id_sucursal, id_variante) DO NOTHING
            """,
            (id_sucursal, id_variante),
        )

    row = obtener_stock_actual_para_update(conn, id_sucursal, id_variante)
    if not row:
        raise ValueError("No se pudo inicializar stock_sucursal")

    return row


def actualizar_stock_sucursal(
    conn,
    id_sucursal: int,
    id_variante: int,
    nuevo_stock_fisico: Decimal,
    nuevo_stock_reservado: Decimal,
    nuevo_stock_vendido_pendiente_entrega: Decimal,
):
    if nuevo_stock_fisico < 0:
        raise ValueError("stock_fisico no puede quedar negativo")
    if nuevo_stock_reservado < 0:
        raise ValueError("stock_reservado no puede quedar negativo")
    if nuevo_stock_vendido_pendiente_entrega < 0:
        raise ValueError("stock_vendido_pendiente_entrega no puede quedar negativo")

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET
                stock_fisico = %s,
                stock_reservado = %s,
                stock_vendido_pendiente_entrega = %s,
                updated_at = NOW()
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (
                nuevo_stock_fisico,
                nuevo_stock_reservado,
                nuevo_stock_vendido_pendiente_entrega,
                id_sucursal,
                id_variante,
            ),
        )


def registrar_movimiento_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    tipo_movimiento: str,
    cantidad: Decimal,
    id_usuario: int,
    costo_unitario_aplicado: Decimal | None = None,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    if cantidad <= 0:
        raise ValueError("La cantidad del movimiento debe ser mayor a 0")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO movimientos_stock (
                id_sucursal,
                id_variante,
                id_bicicleta_serializada,
                tipo_movimiento,
                cantidad,
                costo_unitario_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                id_sucursal,
                id_variante,
                id_bicicleta_serializada,
                tipo_movimiento,
                cantidad,
                costo_unitario_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
            ),
        )
        row = cur.fetchone()

    return row["id"]

def registrar_movimiento_serializada_sin_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    id_bicicleta_serializada: int,
    tipo_movimiento: str,
    id_usuario: int,
    origen_tipo: str,
    origen_id: int,
    nota: str | None = None,
):
    tipos_validos = {
        "venta_serializada",
        "entrega_serializada",
        "anulacion_serializada",
        "devolucion_serializada",
    }

    if tipo_movimiento not in tipos_validos:
        raise ValueError("Tipo de movimiento serializado inválido")

    validar_sucursal_activa(conn, id_sucursal)
    validar_variante_activa(conn, id_variante)
    validar_usuario_activo(conn, id_usuario)

    movimiento_id = registrar_movimiento_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        tipo_movimiento=tipo_movimiento,
        cantidad=1,
        costo_unitario_aplicado=None,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,
        nota=nota,
        id_usuario=id_usuario,
    )

    return {
        "ok": True,
        "movimiento_id": movimiento_id,
        "id_sucursal": id_sucursal,
        "id_variante": id_variante,
        "id_bicicleta_serializada": id_bicicleta_serializada,
        "tipo_movimiento": tipo_movimiento,
    }

def _calcular_stock_nuevo(
    *,
    stock_fisico_actual: Decimal,
    stock_reservado_actual: Decimal,
    stock_pendiente_actual: Decimal,
    delta_fisico: Decimal = Decimal("0"),
    delta_reservado: Decimal = Decimal("0"),
    delta_pendiente_entrega: Decimal = Decimal("0"),
):
    stock_fisico_actual = to_decimal(stock_fisico_actual)
    stock_reservado_actual = to_decimal(stock_reservado_actual)
    stock_pendiente_actual = to_decimal(stock_pendiente_actual)

    delta_fisico = to_decimal(delta_fisico)
    delta_reservado = to_decimal(delta_reservado)
    delta_pendiente_entrega = to_decimal(delta_pendiente_entrega)

    nuevo_stock_fisico = stock_fisico_actual + delta_fisico
    nuevo_stock_reservado = stock_reservado_actual + delta_reservado
    nuevo_stock_pendiente = stock_pendiente_actual + delta_pendiente_entrega

    stock_disponible_nuevo = (
        nuevo_stock_fisico - nuevo_stock_reservado - nuevo_stock_pendiente
    )

    return {
        "stock_fisico_nuevo": nuevo_stock_fisico,
        "stock_reservado_nuevo": nuevo_stock_reservado,
        "stock_pendiente_nuevo": nuevo_stock_pendiente,
        "stock_disponible_nuevo": stock_disponible_nuevo,
    }


def _validar_saldos_no_negativos(
    *,
    nuevo_stock_fisico: Decimal,
    nuevo_stock_reservado: Decimal,
    nuevo_stock_pendiente: Decimal,
):
    if nuevo_stock_fisico < 0:
        raise ValueError("No hay stock físico suficiente")

    if nuevo_stock_reservado < 0:
        raise ValueError("No hay stock reservado suficiente")

    if nuevo_stock_pendiente < 0:
        raise ValueError("No hay stock pendiente de entrega suficiente")


def _validar_stock_disponible_no_negativo(*, stock_disponible_nuevo: Decimal):
    if stock_disponible_nuevo < 0:
        raise ValueError("No hay stock disponible suficiente")

def _validar_consistencia_tipo_y_origen_stock(
    *,
    tipo_movimiento: str,
    origen_tipo: str | None,
):
    if tipo_movimiento == "devolucion" and origen_tipo == "venta":
        raise ValueError(
            "No usar 'devolucion' para ventas. Usar 'devolucion_venta'."
        )

    if tipo_movimiento == "devolucion_venta" and origen_tipo != "venta":
        raise ValueError(
            "'devolucion_venta' solo puede usarse con origen_tipo='venta'."
        )

def _aplicar_operacion_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    id_usuario: int,
    tipo_movimiento: str,
    cantidad: Decimal,
    delta_fisico: Decimal = Decimal("0"),
    delta_reservado: Decimal = Decimal("0"),
    delta_pendiente_entrega: Decimal = Decimal("0"),
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
    costo_unitario_aplicado: Decimal | None = None,
    validar_stock_disponible: bool = True,
):
    cantidad = to_decimal(cantidad)
    delta_fisico = to_decimal(delta_fisico)
    delta_reservado = to_decimal(delta_reservado)
    delta_pendiente_entrega = to_decimal(delta_pendiente_entrega)

    if costo_unitario_aplicado is not None:
        costo_unitario_aplicado = to_decimal(costo_unitario_aplicado)

    if cantidad <= Decimal("0"):
        raise ValueError("La cantidad debe ser mayor a 0")
    
    _validar_consistencia_tipo_y_origen_stock(
        tipo_movimiento=tipo_movimiento,
        origen_tipo=origen_tipo,
    )
    validar_sucursal_activa(conn, id_sucursal)
    validar_variante_activa(conn, id_variante)
    validar_usuario_activo(conn, id_usuario)

    actual = asegurar_stock_sucursal_para_update(conn, id_sucursal, id_variante)

    stock_fisico_actual = to_decimal(actual["stock_fisico"])
    stock_reservado_actual = to_decimal(actual["stock_reservado"])
    stock_pendiente_actual = to_decimal(actual["stock_vendido_pendiente_entrega"])

    calculo = _calcular_stock_nuevo(
        stock_fisico_actual=stock_fisico_actual,
        stock_reservado_actual=stock_reservado_actual,
        stock_pendiente_actual=stock_pendiente_actual,
        delta_fisico=delta_fisico,
        delta_reservado=delta_reservado,
        delta_pendiente_entrega=delta_pendiente_entrega,
    )

    nuevo_stock_fisico = calculo["stock_fisico_nuevo"]
    nuevo_stock_reservado = calculo["stock_reservado_nuevo"]
    nuevo_stock_pendiente = calculo["stock_pendiente_nuevo"]
    stock_disponible_nuevo = calculo["stock_disponible_nuevo"]

    _validar_saldos_no_negativos(
        nuevo_stock_fisico=nuevo_stock_fisico,
        nuevo_stock_reservado=nuevo_stock_reservado,
        nuevo_stock_pendiente=nuevo_stock_pendiente,
    )

    if validar_stock_disponible:
        _validar_stock_disponible_no_negativo(
            stock_disponible_nuevo=stock_disponible_nuevo
        )

    actualizar_stock_sucursal(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        nuevo_stock_fisico=nuevo_stock_fisico,
        nuevo_stock_reservado=nuevo_stock_reservado,
        nuevo_stock_vendido_pendiente_entrega=nuevo_stock_pendiente,
    )

    movimiento_id = registrar_movimiento_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        tipo_movimiento=tipo_movimiento,
        cantidad=cantidad,
        costo_unitario_aplicado=costo_unitario_aplicado,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,
        nota=nota,
        id_usuario=id_usuario,
    )

    return {
        "ok": True,
        "movimiento_id": movimiento_id,
        "id_sucursal": id_sucursal,
        "id_variante": id_variante,
        "tipo_movimiento": tipo_movimiento,
        "cantidad": cantidad,
        "stock_fisico_anterior": stock_fisico_actual,
        "stock_reservado_anterior": stock_reservado_actual,
        "stock_vendido_pendiente_entrega_anterior": stock_pendiente_actual,
        "stock_fisico_nuevo": nuevo_stock_fisico,
        "stock_reservado_nuevo": nuevo_stock_reservado,
        "stock_vendido_pendiente_entrega_nuevo": nuevo_stock_pendiente,
        "stock_disponible_nuevo": stock_disponible_nuevo,
    }
# =========================================================
# OPERACIONES CENTRALES DE STOCK
# =========================================================

def reservar_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    nota: str | None = None,
):
    """
    Reserva stock disponible.
    Efecto:
    - stock_reservado += cantidad
    - stock_fisico no cambia
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="reserva",
        cantidad=cantidad,
        delta_reservado=+cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


def liberar_stock_reservado(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    nota: str | None = None,
):
    """
    Libera stock previamente reservado.
    Efecto:
    - stock_reservado -= cantidad
    - stock_fisico no cambia
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="cancelacion_reserva",
        cantidad=cantidad,
        delta_reservado=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


def marcar_stock_pendiente_entrega(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    descontar_de_reservado: bool = False,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Marca stock vendido pendiente de entrega.

    Caso 1: venta desde stock disponible
    - stock_vendido_pendiente_entrega += cantidad

    Caso 2: venta de algo ya reservado
    - stock_reservado -= cantidad
    - stock_vendido_pendiente_entrega += cantidad

    NO baja stock_fisico todavía.
    """
    delta_reservado = -cantidad if descontar_de_reservado else 0

    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="venta",
        cantidad=cantidad,
        delta_reservado=delta_reservado,
        delta_pendiente_entrega=+cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
        id_bicicleta_serializada=id_bicicleta_serializada,
    )


def descontar_stock_por_venta(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    descontar_de_reservado: bool = False,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    nota: str | None = None,
):
    """
    Venta con entrega inmediata.

    Caso 1: venta directa
    - stock_fisico -= cantidad

    Caso 2: venta de algo reservado
    - stock_reservado -= cantidad
    - stock_fisico -= cantidad

    NO usa pendiente_entrega.
    """
    delta_reservado = -cantidad if descontar_de_reservado else 0

    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="venta",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        delta_reservado=delta_reservado,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


def registrar_entrega_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Entrega de stock ya vendido y pendiente de entrega.
    Efecto:
    - stock_vendido_pendiente_entrega -= cantidad
    - stock_fisico -= cantidad
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="entrega",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        delta_pendiente_entrega=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
        validar_stock_disponible=False,
        id_bicicleta_serializada=id_bicicleta_serializada,
    )


def devolver_stock_a_disponible_desde_pendiente(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Revierte una venta pendiente antes de la entrega.
    Efecto:
    - stock_vendido_pendiente_entrega -= cantidad
    - stock_fisico no cambia
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="cancelacion_venta",
        cantidad=cantidad,
        delta_pendiente_entrega=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,
        nota=nota,
    )

def registrar_devolucion_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Devuelve unidades al stock físico por devolución de venta.

    IMPORTANTE:
    - Usa tipo_movimiento='devolucion_venta'
    - NO usar 'devolucion' para ventas (rompe trazabilidad)
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="devolucion_venta",  # ← FIX CLAVE
        cantidad=cantidad,
        delta_fisico=+cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,  # ← IMPORTANTE
        nota=nota,
    )


def registrar_salida_taller(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_id: int,
    origen_tipo: str = "orden_taller",
    nota: str | None = None,
):
    """
    Consume stock físico para uso interno / taller.
    Efecto:
    - stock_fisico -= cantidad
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="uso_taller",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


# =========================================================
# INGRESO DE STOCK
# =========================================================

def crear_ingreso_stock(conn, data: dict):
    """
    Mantiene el comportamiento actual:
    - inserta ingreso_stock
    - sube stock_fisico
    - recalcula costo promedio
    - registra movimiento 'ingreso'
    - registra historial de costo en precios_movimientos si cambia el costo

    NO hace commit.
    """

    validar_sucursal_activa(conn, data["id_sucursal"])
    variante = validar_variante_activa(conn, data["id_variante"])
    validar_proveedor_activo(conn, data["id_proveedor"])
    validar_usuario_activo(conn, data["id_usuario"])

    cantidad_ingresada = to_decimal(data["cantidad_ingresada"])
    costo_productos = to_decimal(data["costo_productos"])
    gastos_adicionales = to_decimal(data.get("gastos_adicionales", 0) or 0)

    if cantidad_ingresada <= 0:
        raise ValueError("La cantidad ingresada debe ser mayor a 0")

    costo_total_lote = costo_productos + gastos_adicionales
    costo_unitario_calculado = costo_total_lote / cantidad_ingresada

    # 1. insertar cabecera de ingreso
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingresos_stock (
                id_sucursal,
                id_variante,
                id_proveedor,
                cantidad_ingresada,
                costo_productos,
                gastos_adicionales,
                costo_total_lote,
                costo_unitario_calculado,
                origen_ingreso,
                observacion,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_sucursal"],
                data["id_variante"],
                data["id_proveedor"],
                cantidad_ingresada,
                costo_productos,
                gastos_adicionales,
                costo_total_lote,
                costo_unitario_calculado,
                data.get("origen_ingreso", "manual"),
                data.get("observacion"),
                data["id_usuario"],
            ),
        )
        ingreso = cur.fetchone()
        ingreso_id = ingreso["id"]

    # 2. bloquear / asegurar fila de stock
    stock = asegurar_stock_sucursal_para_update(
        conn,
        data["id_sucursal"],
        data["id_variante"],
    )

    stock_fisico_anterior = to_decimal(stock["stock_fisico"])
    stock_reservado_actual = to_decimal(stock["stock_reservado"])
    stock_pendiente_actual = to_decimal(stock["stock_vendido_pendiente_entrega"])

    nuevo_stock_fisico = stock_fisico_anterior + cantidad_ingresada

    actualizar_stock_sucursal(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        nuevo_stock_fisico=nuevo_stock_fisico,
        nuevo_stock_reservado=stock_reservado_actual,
        nuevo_stock_vendido_pendiente_entrega=stock_pendiente_actual,
    )

    # 3. recalcular costo promedio vigente
    costo_promedio_anterior = to_decimal(variante["costo_promedio_vigente"] or 0)
    stock_anterior = stock_fisico_anterior

    if stock_anterior <= 0:
        nuevo_costo_promedio = costo_unitario_calculado
    else:
        nuevo_costo_promedio = (
            (stock_anterior * costo_promedio_anterior)
            + (cantidad_ingresada * costo_unitario_calculado)
        ) / (stock_anterior + cantidad_ingresada)

    # 4. actualizar costo promedio en variante
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET costo_promedio_vigente = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_costo_promedio, data["id_variante"]),
        )

    # 5. registrar historial de costo en precios_movimientos
    if costo_promedio_anterior != nuevo_costo_promedio:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO precios_movimientos (
                    id_variante,
                    precio_minorista_anterior,
                    precio_minorista_nuevo,
                    precio_mayorista_anterior,
                    precio_mayorista_nuevo,
                    costo_anterior,
                    costo_nuevo,
                    tipo_movimiento,
                    motivo,
                    origen_tipo,
                    origen_id,
                    id_usuario
                )
                SELECT
                    v.id,
                    v.precio_minorista,
                    v.precio_minorista,
                    v.precio_mayorista,
                    v.precio_mayorista,
                    %s,
                    %s,
                    'actualizacion_por_ingreso_stock',
                    %s,
                    'ingreso_stock',
                    %s,
                    %s
                FROM variantes v
                WHERE v.id = %s
                """,
                (
                    costo_promedio_anterior,
                    nuevo_costo_promedio,
                    f"Actualización de costo promedio por ingreso de stock #{ingreso_id}",
                    ingreso_id,
                    data["id_usuario"],
                    data["id_variante"],
                ),
            )

    # 6. registrar movimiento de stock
    registrar_movimiento_stock(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        tipo_movimiento="ingreso",
        cantidad=cantidad_ingresada,
        costo_unitario_aplicado=costo_unitario_calculado,
        origen_tipo="ingreso_stock",
        origen_id=ingreso_id,
        nota=data.get("observacion"),
        id_usuario=data["id_usuario"],
    )

    return {
        "ok": True,
        "ingreso_id": ingreso_id,
        "id_sucursal": data["id_sucursal"],
        "id_variante": data["id_variante"],
        "cantidad_ingresada": cantidad_ingresada,
        "costo_total_lote": costo_total_lote,
        "costo_unitario_calculado": costo_unitario_calculado,
        "stock_anterior": stock_fisico_anterior,
        "stock_nuevo": nuevo_stock_fisico,
        "costo_promedio_anterior": costo_promedio_anterior,
        "costo_promedio_nuevo": nuevo_costo_promedio,
    }

def registrar_salida_por_serializacion(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="serializacion",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,
        nota=nota,
    )

def registrar_ajuste_manual_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: Decimal,
    id_usuario: int,
    origen_tipo: str | None = "ajuste_manual",
    origen_id: int | None = None,
    nota: str | None = None,
):
    cantidad = to_decimal(cantidad)

    if cantidad == Decimal("0"):
        raise ValueError("La cantidad del ajuste no puede ser 0")

    if origen_id is None:
        origen_id = 0

    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="ajuste",
        cantidad=abs(cantidad),
        delta_fisico=cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
        validar_stock_disponible=True,
    )

def obtener_stock_disponible_variante(conn, *, id_sucursal: int, id_variante: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega,
                (
                    stock_fisico
                    - stock_reservado
                    - stock_vendido_pendiente_entrega
                ) AS stock_disponible
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            FOR UPDATE
            """,
            (id_sucursal, id_variante),
        )
        return cur.fetchone()

def descontar_stock_fisico(conn, *, id_sucursal: int, id_variante: int, cantidad):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = stock_fisico - %s,
                updated_at = NOW()
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (cantidad, id_sucursal, id_variante),
        )

def incrementar_stock_fisico(conn, *, id_sucursal: int, id_variante: int, cantidad):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET stock_fisico = stock_fisico + %s,
                updated_at = NOW()
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (cantidad, id_sucursal, id_variante),
        )
