from psycopg.rows import dict_row


# =========================================================
# LOOKUPS / VALIDACIONES
# =========================================================

def get_cliente_by_id(conn, cliente_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                activo
            FROM clientes
            WHERE id = %s
            """,
            (cliente_id,),
        )
        return cur.fetchone()


def get_sucursal_by_id(conn, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                activa
            FROM sucursales
            WHERE id = %s
            """,
            (sucursal_id,),
        )
        return cur.fetchone()


def get_variantes_by_ids(conn, ids):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.nombre_variante,
                v.precio_minorista,
                 v.precio_mayorista,
                v.costo_promedio_vigente,
                v.id_producto,
                v.activo AS variante_activa,
                p.nombre AS producto_nombre,
                p.stockeable,
                p.serializable,
                p.tipo_item,
                p.activo AS producto_activo
            FROM variantes v
            INNER JOIN productos p
                ON p.id = v.id_producto
            WHERE v.id = ANY(%s)
            """,
            (ids,),
        )
        return cur.fetchall()


# =========================================================
# ESCRITURA
# =========================================================

def insert_venta(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ventas (
                id_sucursal,
                id_cliente,
                estado,
                tipo_precio,
                subtotal_base,
                descuento_total,
                recargo_total,
                total_final,
                saldo_pendiente,
                id_usuario_creador,
                observaciones,
                id_reserva_origen,
                id_orden_taller
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_sucursal"],
                data["id_cliente"],
                data.get("estado", "creada"),
                data.get("tipo_precio", "minorista"),
                data.get("subtotal_base", 0),
                data.get("descuento_total", 0),
                data.get("recargo_total", 0),
                data.get("total_final", 0),
                data.get("saldo_pendiente", 0),
                data["id_usuario_creador"],
                data.get("observaciones"),
                data.get("id_reserva_origen"),
                data.get("id_orden_taller"),
            ),
        )
        return cur.fetchone()["id"]


def insert_venta_item(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO venta_items (
            id_venta,
            tipo_item,
            id_variante,
            id_servicio_taller,
            id_bicicleta_serializada,
            id_orden_taller_item,
            descripcion_snapshot,
            cantidad,
            precio_lista,
            precio_final,
            precio_unitario_original,
            precio_unitario_final,
            bonificado,
            bonificacion_unitaria,
            motivo_bonificacion,
            motivo_precio_manual,
            id_oferta,
            precio_catalogo_original,
            descuento_oferta_unitario,
            oferta_nombre_snapshot,
            costo_unitario_aplicado,
            subtotal
        )
        VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s
        )
            RETURNING id
            """,
            (
                data["id_venta"],
                data.get("tipo_item", "producto"),
                data.get("id_variante"),
                data.get("id_servicio_taller"),
                data.get("id_bicicleta_serializada"),
                data.get("id_orden_taller_item"),
                data["descripcion_snapshot"],
                data["cantidad"],
                data["precio_lista"],
                data["precio_final"],
                data["precio_unitario_original"],
                data["precio_unitario_final"],
                data.get("bonificado", False),
                data.get("bonificacion_unitaria", 0),
                data.get("motivo_bonificacion"),
                data.get("motivo_precio_manual"),
                data.get("id_oferta"),
                data.get("precio_catalogo_original"),
                data.get("descuento_oferta_unitario", 0),
                data.get("oferta_nombre_snapshot"),
                data["costo_unitario_aplicado"],
                data["subtotal"],
            ),
        )

        return cur.fetchone()["id"]

def update_venta_estado(conn, venta_id: int, nuevo_estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_estado, venta_id),
        )


def update_venta_cliente(conn, venta_id: int, cliente_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET id_cliente = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (cliente_id, venta_id),
        )
        return cur.rowcount


def update_pagos_cliente_por_venta(conn, venta_id: int, cliente_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE pagos
            SET id_cliente = %s,
                updated_at = NOW()
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            """,
            (cliente_id, venta_id),
        )
        return cur.rowcount


def update_deudas_cliente_por_venta(conn, venta_id: int, cliente_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE deudas_cliente
            SET id_cliente = %s,
                updated_at = NOW()
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            """,
            (cliente_id, venta_id),
        )
        return cur.rowcount


def update_creditos_cliente_por_venta(conn, venta_id: int, cliente_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE creditos_cliente
            SET id_cliente = %s
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            """,
            (cliente_id, venta_id),
        )
        return cur.rowcount


def update_bicicletas_cliente_por_venta(conn, venta_id: int, cliente_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_clientes
            SET id_cliente = %s,
                updated_at = NOW()
            WHERE id_venta_origen = %s
            """,
            (cliente_id, venta_id),
        )
        return cur.rowcount


def update_venta_item_bicicleta_serializada(
    conn,
    venta_item_id: int,
    bicicleta_id: int,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE venta_items
            SET id_bicicleta_serializada = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (bicicleta_id, venta_item_id),
        )
        return cur.rowcount


def update_venta_saldo_y_estado(conn, venta_id: int, saldo_pendiente, estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ventas
            SET saldo_pendiente = %s,
                estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (saldo_pendiente, estado, venta_id),
        )


def insert_venta_anulacion(conn, venta_id: int, motivo: str, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO venta_anulaciones (
                id_venta,
                motivo,
                id_usuario
            )
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (venta_id, motivo, id_usuario),
        )
        return cur.fetchone()["id"]


def reset_orden_taller_por_venta_anulada(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE ordenes_taller
            SET id_venta_generada = NULL,
                estado = 'terminada',
                updated_at = NOW()
            WHERE id_venta_generada = %s
              AND estado = 'facturada'
            RETURNING id
            """,
            (venta_id,),
        )
        orden = cur.fetchone()

        if orden is not None:
            # Libera la restricción de una venta activa por OT. La venta anulada
            # conserva trazabilidad mediante sus items, observación y auditoría.
            cur.execute(
                """
                UPDATE ventas
                SET id_orden_taller = NULL,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (venta_id,),
            )

        return orden


# =========================================================
# LECTURAS
# =========================================================

def get_ventas(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                v.id_sucursal,
                s.nombre AS sucursal_nombre,
                v.estado,
                v.tipo_precio,
                v.total_final,
                v.saldo_pendiente,
                v.id_reserva_origen,
                COALESCE(items.cantidad_items, 0) AS cantidad_items,
                COALESCE(items.tiene_serializadas, FALSE) AS tiene_serializadas,
                CASE
                    WHEN v.id_reserva_origen IS NOT NULL THEN 'reserva'
                    WHEN COALESCE(items.tiene_items_taller, FALSE) THEN 'taller'
                    ELSE 'venta'
                END AS origen_venta
            FROM ventas v
            INNER JOIN clientes c
                ON c.id = v.id_cliente
            INNER JOIN sucursales s
                ON s.id = v.id_sucursal
            LEFT JOIN (
                SELECT
                    id_venta,
                    SUM(cantidad) AS cantidad_items,
                    BOOL_OR(id_bicicleta_serializada IS NOT NULL) AS tiene_serializadas,
                    BOOL_OR(id_orden_taller_item IS NOT NULL) AS tiene_items_taller
                FROM venta_items
                GROUP BY id_venta
            ) items
                ON items.id_venta = v.id
            ORDER BY v.id DESC
            """
        )
        return cur.fetchall()


def get_venta_by_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.id_cliente,
                c.nombre AS cliente_nombre,
                v.id_sucursal,
                s.nombre AS sucursal_nombre,
                v.estado,
                v.tipo_precio,
                v.subtotal_base,
                v.descuento_total,
                v.recargo_total,
                v.total_final,
                v.saldo_pendiente,
                v.observaciones,
                v.id_reserva_origen
            FROM ventas v
            INNER JOIN clientes c
                ON c.id = v.id_cliente
            INNER JOIN sucursales s
                ON s.id = v.id_sucursal
            WHERE v.id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()


def get_venta_items_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                vi.id,
                vi.id_venta,
                vi.id_variante,
                vi.tipo_item,
                vi.id_servicio_taller,
                vi.id_bicicleta_serializada,
                bs.numero_cuadro AS bicicleta_numero_cuadro,
                p.serializable,
                vi.id_orden_taller_item,
                vi.descripcion_snapshot,
                vi.cantidad,
                vi.precio_lista,
                vi.precio_final,
                vi.costo_unitario_aplicado,
                vi.subtotal,
                vi.bonificado,
                vi.bonificacion_unitaria,
                vi.motivo_bonificacion,
                vi.motivo_precio_manual,
                vi.precio_unitario_original,
                vi.precio_unitario_final,
                vi.id_oferta,
                vi.precio_catalogo_original,
                vi.descuento_oferta_unitario,
                vi.oferta_nombre_snapshot,
                CASE
                    WHEN bs.id_orden_armado_origen IS NOT NULL
                        THEN 'fabricacion_propia'
                    ELSE 'costo_promedio_variante'
                END AS origen_costo,
                bs.id_orden_armado_origen,
                ao.codigo AS codigo_orden_armado,
                COALESCE(dev.cantidad_devuelta, 0) AS cantidad_devuelta,
                CASE
                    WHEN COALESCE(dev.cantidad_devuelta, 0) >= vi.cantidad
                        THEN TRUE
                    ELSE FALSE
                END AS devuelto_total
            FROM venta_items vi
            LEFT JOIN variantes v
                ON v.id = vi.id_variante
            LEFT JOIN productos p
                ON p.id = v.id_producto
            LEFT JOIN bicicletas_serializadas bs
                ON bs.id = vi.id_bicicleta_serializada
            LEFT JOIN armado_ordenes ao
                ON ao.id = bs.id_orden_armado_origen
            LEFT JOIN (
                SELECT
                    id_venta_item,
                    SUM(cantidad_devuelta) AS cantidad_devuelta
                FROM venta_item_devoluciones
                GROUP BY id_venta_item
            ) dev
                ON dev.id_venta_item = vi.id
            WHERE vi.id_venta = %s
            ORDER BY vi.id
            """,
            (venta_id,),
        )
        return cur.fetchall()

def get_venta_items_detallados_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                vi.id,
                vi.id_venta,
                vi.tipo_item,
                vi.id_variante,
                vi.id_servicio_taller,
                vi.id_bicicleta_serializada,
                bs.numero_cuadro AS bicicleta_numero_cuadro,
                vi.id_orden_taller_item,
                vi.descripcion_snapshot,
                vi.cantidad,
                vi.precio_lista,
                vi.precio_final,
                vi.costo_unitario_aplicado,
                vi.subtotal,
                v.id_producto,
                v.activo AS variante_activa,
                p.nombre AS producto_nombre,
                p.tipo_item AS producto_tipo_item,
                p.stockeable,
                p.serializable,
                p.activo AS producto_activo,
                vi.bonificado,
                vi.bonificacion_unitaria,
                vi.motivo_bonificacion,
                vi.motivo_precio_manual,
                vi.precio_unitario_original,
                vi.precio_unitario_final,
                vi.id_oferta,
                vi.precio_catalogo_original,
                vi.descuento_oferta_unitario,
                vi.oferta_nombre_snapshot,
                CASE
                    WHEN bs.id_orden_armado_origen IS NOT NULL
                        THEN 'fabricacion_propia'
                    ELSE 'costo_promedio_variante'
                END AS origen_costo,
                bs.id_orden_armado_origen,
                ao.codigo AS codigo_orden_armado
            FROM venta_items vi
            LEFT JOIN variantes v
                ON v.id = vi.id_variante
            LEFT JOIN productos p
                ON p.id = v.id_producto
            LEFT JOIN bicicletas_serializadas bs
                ON bs.id = vi.id_bicicleta_serializada
            LEFT JOIN armado_ordenes ao
                ON ao.id = bs.id_orden_armado_origen
            WHERE vi.id_venta = %s
            ORDER BY vi.id
            """,
            (venta_id,),
        )
        return cur.fetchall()

def get_venta_for_update(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                id_sucursal,
                estado,
                tipo_precio,
                subtotal_base,
                descuento_total,
                recargo_total,
                total_final,
                saldo_pendiente,
                id_reserva_origen,
                id_orden_taller
            FROM ventas
            WHERE id = %s
            FOR UPDATE
            """,
            (venta_id,),
        )
        return cur.fetchone()

def get_venta_item_detallado_for_update(conn, venta_id: int, venta_item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                vi.id,
                vi.id_venta,
                vi.tipo_item,
                vi.id_variante,
                vi.id_servicio_taller,
                vi.id_bicicleta_serializada,
                vi.descripcion_snapshot,
                vi.cantidad,
                vi.precio_lista,
                vi.precio_final,
                vi.costo_unitario_aplicado,
                vi.subtotal,
                p.stockeable,
                p.serializable,
                p.activo AS producto_activo,
                v.activo AS variante_activa,
                COALESCE(dev.cantidad_devuelta, 0) AS cantidad_devuelta
            FROM venta_items vi
            LEFT JOIN variantes v
                ON v.id = vi.id_variante
            LEFT JOIN productos p
                ON p.id = v.id_producto
            LEFT JOIN (
                SELECT
                    id_venta_item,
                    SUM(cantidad_devuelta) AS cantidad_devuelta
                FROM venta_item_devoluciones
                GROUP BY id_venta_item
            ) dev
                ON dev.id_venta_item = vi.id
            WHERE vi.id_venta = %s
              AND vi.id = %s
            FOR UPDATE OF vi
            """,
            (venta_id, venta_item_id),
        )
        return cur.fetchone()


def existe_movimiento_venta_generico(conn, venta_id: int, id_variante: int) -> bool:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT 1
            FROM movimientos_stock
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
              AND id_variante = %s
              AND tipo_movimiento = 'venta'
              AND id_bicicleta_serializada IS NULL
            LIMIT 1
            """,
            (venta_id, id_variante),
        )
        return cur.fetchone() is not None


def insert_venta_devolucion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO venta_devoluciones (
                id_venta,
                id_venta_item,
                id_bicicleta_serializada,
                id_sucursal_reingreso,
                motivo,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_venta"],
                data["id_venta_item"],
                data["id_bicicleta_serializada"],
                data["id_sucursal_reingreso"],
                data["motivo"],
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]

def get_venta_devolucion_by_venta_item_id(conn, id_venta_item: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_venta,
                id_venta_item,
                id_bicicleta_serializada,
                id_sucursal_reingreso,
                fecha,
                motivo,
                id_usuario
            FROM venta_devoluciones
            WHERE id_venta_item = %s
            """,
            (id_venta_item,),
        )
        return cur.fetchone()

def insert_venta_item_devolucion(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO venta_item_devoluciones (
                id_venta,
                id_venta_item,
                tipo_item,
                id_variante,
                id_servicio_taller,
                cantidad_devuelta,
                monto_credito_generado,
                motivo,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_venta"],
                data["id_venta_item"],
                data.get("tipo_item", "producto"),
                data.get("id_variante"),
                data.get("id_servicio_taller"),
                data["cantidad_devuelta"],
                data["monto_credito_generado"],
                data["motivo"],
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]

def get_total_devuelto_by_venta_item_id(conn, id_venta_item: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(cantidad_devuelta), 0) AS cantidad_devuelta
            FROM venta_item_devoluciones
            WHERE id_venta_item = %s
            """,
            (id_venta_item,),
        )
        return cur.fetchone()["cantidad_devuelta"]

def insert_venta_regla_aplicada(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO venta_reglas_aplicadas (
                id_venta,
                id_regla_comercial,
                tipo,
                descripcion_snapshot,
                monto_aplicado,
                porcentaje_aplicado
            )
            VALUES (
                %(id_venta)s,
                %(id_regla_comercial)s,
                %(tipo)s,
                %(descripcion_snapshot)s,
                %(monto_aplicado)s,
                %(porcentaje_aplicado)s
            )
            RETURNING id
            """,
            data,
        )

        return cur.fetchone()["id"]
