from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def get_bicicleta_for_update(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT bs.*, p.nombre AS producto_nombre, v.nombre_variante, v.sku,
                   v.precio_minorista AS precio_variante
            FROM bicicletas_serializadas bs
            INNER JOIN variantes v ON v.id = bs.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            WHERE bs.id = %s
            FOR UPDATE OF bs
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()


def insert_acondicionamiento(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicleta_acondicionamientos (
                id_bicicleta_serializada,
                id_sucursal,
                estado_tecnico_anterior,
                motivo,
                observaciones,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["id_bicicleta_serializada"],
                data["id_sucursal"],
                data["estado_tecnico_anterior"],
                data["motivo"],
                data.get("observaciones"),
                data.get("id_usuario"),
            ),
        )
        row = cur.fetchone()
        codigo = f"ACOND-{row['id']:06d}"
        cur.execute(
            "UPDATE bicicleta_acondicionamientos SET codigo = %s WHERE id = %s RETURNING *",
            (codigo, row["id"]),
        )
        return cur.fetchone()


def get_acondicionamiento(conn, acondicionamiento_id: int, *, for_update=False):
    lock_sql = "FOR UPDATE OF a" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                a.*,
                bs.numero_cuadro,
                bs.estado AS estado_inventario,
                bs.estado_tecnico,
                p.nombre AS producto_nombre,
                v.nombre_variante AS variante_nombre,
                v.sku,
                v.precio_minorista AS precio_variante,
                bs.precio_venta_personalizado,
                COALESCE(bs.precio_venta_personalizado, v.precio_minorista, 0)
                    AS precio_venta_actual,
                s.nombre AS sucursal_nombre
            FROM bicicleta_acondicionamientos a
            INNER JOIN bicicletas_serializadas bs ON bs.id = a.id_bicicleta_serializada
            INNER JOIN variantes v ON v.id = bs.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN sucursales s ON s.id = a.id_sucursal
            WHERE a.id = %s
            {lock_sql}
            """,
            (acondicionamiento_id,),
        )
        return cur.fetchone()


def list_acondicionamientos_bicicleta(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                a.*,
                bs.numero_cuadro,
                bs.estado AS estado_inventario,
                bs.estado_tecnico,
                p.nombre AS producto_nombre,
                v.nombre_variante AS variante_nombre,
                v.sku,
                v.precio_minorista AS precio_variante,
                bs.precio_venta_personalizado,
                COALESCE(bs.precio_venta_personalizado, v.precio_minorista, 0)
                    AS precio_venta_actual,
                s.nombre AS sucursal_nombre
            FROM bicicleta_acondicionamientos a
            INNER JOIN bicicletas_serializadas bs ON bs.id = a.id_bicicleta_serializada
            INNER JOIN variantes v ON v.id = bs.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN sucursales s ON s.id = a.id_sucursal
            WHERE a.id_bicicleta_serializada = %s
            ORDER BY a.fecha_creacion DESC, a.id DESC
            """,
            (bicicleta_id,),
        )
        return cur.fetchall()


def get_variante_componente(conn, variante_id: int, sucursal_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.nombre_variante,
                v.sku,
                v.costo_promedio_vigente,
                p.nombre AS producto_nombre,
                COALESCE(p.serializable, FALSE) AS serializable,
                GREATEST(
                    COALESCE(ss.stock_fisico, 0)
                    - COALESCE(ss.stock_reservado, 0)
                    - COALESCE(ss.stock_vendido_pendiente_entrega, 0),
                    0
                ) AS stock_disponible
            FROM variantes v
            INNER JOIN productos p ON p.id = v.id_producto
            LEFT JOIN stock_sucursal ss
                ON ss.id_variante = v.id
               AND ss.id_sucursal = %s
            WHERE v.id = %s
              AND COALESCE(v.activo, TRUE) = TRUE
              AND COALESCE(p.activo, TRUE) = TRUE
            """,
            (sucursal_id, variante_id),
        )
        return cur.fetchone()


def insert_item(conn, acondicionamiento_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicleta_acondicionamiento_items (
                id_acondicionamiento,
                tipo_intervencion,
                id_variante,
                producto_nombre_snapshot,
                variante_nombre_snapshot,
                sku_snapshot,
                cantidad,
                costo_unitario_estimado,
                stock_disponible_snapshot,
                detalle_pieza_retirada,
                destino_pieza_retirada,
                estado_pieza_retirada,
                observaciones
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                acondicionamiento_id,
                data["tipo_intervencion"],
                data["id_variante"],
                data["producto_nombre"],
                data.get("nombre_variante"),
                data.get("sku"),
                data["cantidad"],
                data["costo_unitario_estimado"],
                data["stock_disponible_snapshot"],
                data.get("detalle_pieza_retirada"),
                data.get("destino_pieza_retirada"),
                data.get("estado_pieza_retirada"),
                data.get("observaciones"),
            ),
        )
        return cur.fetchone()


def list_items(conn, acondicionamiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                i.*,
                GREATEST(
                    COALESCE(ss.stock_fisico, 0)
                    - COALESCE(ss.stock_reservado, 0)
                    - COALESCE(ss.stock_vendido_pendiente_entrega, 0),
                    0
                ) AS stock_disponible_actual
            FROM bicicleta_acondicionamiento_items i
            INNER JOIN bicicleta_acondicionamientos a ON a.id = i.id_acondicionamiento
            LEFT JOIN stock_sucursal ss
                ON ss.id_variante = i.id_variante
               AND ss.id_sucursal = a.id_sucursal
            WHERE i.id_acondicionamiento = %s
            ORDER BY i.id ASC
            """,
            (acondicionamiento_id,),
        )
        return cur.fetchall()


def list_items_for_update(conn, acondicionamiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicleta_acondicionamiento_items
            WHERE id_acondicionamiento = %s
            ORDER BY id_variante, id
            FOR UPDATE
            """,
            (acondicionamiento_id,),
        )
        return cur.fetchall()


def delete_item(conn, acondicionamiento_id: int, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            DELETE FROM bicicleta_acondicionamiento_items
            WHERE id_acondicionamiento = %s AND id = %s
            RETURNING *
            """,
            (acondicionamiento_id, item_id),
        )
        return cur.fetchone()


def insert_costo(conn, acondicionamiento_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicleta_acondicionamiento_costos (
                id_acondicionamiento, tipo, descripcion, cantidad,
                costo_unitario, observaciones
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                acondicionamiento_id,
                data["tipo"],
                data["descripcion"],
                data["cantidad"],
                data["costo_unitario"],
                data.get("observaciones"),
            ),
        )
        return cur.fetchone()


def list_costos(conn, acondicionamiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicleta_acondicionamiento_costos
            WHERE id_acondicionamiento = %s
            ORDER BY id ASC
            """,
            (acondicionamiento_id,),
        )
        return cur.fetchall()


def delete_costo(conn, acondicionamiento_id: int, costo_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            DELETE FROM bicicleta_acondicionamiento_costos
            WHERE id_acondicionamiento = %s AND id = %s
            RETURNING *
            """,
            (acondicionamiento_id, costo_id),
        )
        return cur.fetchone()


def insert_recupero(conn, acondicionamiento_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicleta_acondicionamiento_recuperos (
                id_acondicionamiento, tipo, descripcion, monto,
                referencia, observaciones, id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                acondicionamiento_id,
                data["tipo"],
                data["descripcion"],
                data["monto"],
                data.get("referencia"),
                data.get("observaciones"),
                data.get("id_usuario"),
            ),
        )
        return cur.fetchone()


def list_recuperos(conn, acondicionamiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM bicicleta_acondicionamiento_recuperos
            WHERE id_acondicionamiento = %s
            ORDER BY id ASC
            """,
            (acondicionamiento_id,),
        )
        return cur.fetchall()


def delete_recupero(conn, acondicionamiento_id: int, recupero_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            DELETE FROM bicicleta_acondicionamiento_recuperos
            WHERE id_acondicionamiento = %s AND id = %s
            RETURNING *
            """,
            (acondicionamiento_id, recupero_id),
        )
        return cur.fetchone()


def update_item_consumido(
    conn,
    item_id: int,
    *,
    cantidad,
    costo_unitario_real,
    subtotal_real,
    movimiento_id: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicleta_acondicionamiento_items
            SET estado = 'consumido',
                cantidad_consumida = %s,
                costo_unitario_real = %s,
                subtotal_real = %s,
                id_movimiento_consumo = %s,
                fecha_consumo = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (cantidad, costo_unitario_real, subtotal_real, movimiento_id, item_id),
        )


def update_item_revertido(conn, item_id: int, *, movimiento_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicleta_acondicionamiento_items
            SET estado = 'revertido',
                estado_pieza_retirada = CASE
                    WHEN destino_pieza_retirada IS NOT NULL THEN 'revertida'
                    ELSE estado_pieza_retirada
                END,
                id_movimiento_reversion = %s,
                fecha_reversion = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (movimiento_id, item_id),
        )


def update_pieza_retirada(conn, acondicionamiento_id: int, item_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE bicicleta_acondicionamiento_items
            SET estado_pieza_retirada = %(estado)s,
                resolucion_pieza_retirada = %(resolucion)s,
                fecha_resolucion_pieza_retirada = NOW(),
                id_usuario_resolucion_pieza_retirada = %(id_usuario)s,
                updated_at = NOW()
            WHERE id_acondicionamiento = %(id_acondicionamiento)s
              AND id = %(item_id)s
              AND destino_pieza_retirada IS NOT NULL
            RETURNING *
            """,
            {
                **data,
                "id_acondicionamiento": acondicionamiento_id,
                "item_id": item_id,
            },
        )
        return cur.fetchone()


def aplicar_costos_reales(conn, acondicionamiento_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicleta_acondicionamiento_costos
            SET costo_unitario_real = costo_unitario,
                total_real = ROUND(cantidad * costo_unitario, 2),
                fecha_aplicacion = NOW(),
                updated_at = NOW()
            WHERE id_acondicionamiento = %s
            """,
            (acondicionamiento_id,),
        )


def aplicar_orden(conn, acondicionamiento_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE bicicleta_acondicionamientos
            SET estado = 'aplicado',
                fecha_aplicacion = NOW(),
                id_usuario_aplicacion = %(id_usuario)s,
                costo_componentes_real = %(costo_componentes_real)s,
                costo_adicional_real = %(costo_adicional_real)s,
                recuperos_total = %(recuperos_total)s,
                costo_acondicionamiento_aplicado = %(costo_acondicionamiento_aplicado)s,
                costo_total_unidad_anterior = %(costo_total_unidad_anterior)s,
                costo_total_unidad_nuevo = %(costo_total_unidad_nuevo)s,
                precio_venta_actualizado = %(precio_venta_actualizado)s,
                precio_venta_personalizado_anterior = %(precio_venta_personalizado_anterior)s,
                precio_venta_personalizado_nuevo = %(precio_venta_personalizado_nuevo)s,
                updated_at = NOW()
            WHERE id = %(id)s
            RETURNING *
            """,
            {**data, "id": acondicionamiento_id},
        )
        return cur.fetchone()


def update_bicicleta_costos_y_estado(
    conn,
    bicicleta_id: int,
    *,
    costo_acondicionamiento,
    costo_total_unitario,
    estado_tecnico: str,
    usuario_id: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET costo_acondicionamiento = %s,
                costo_total_unitario = %s,
                estado_tecnico = %s,
                fecha_revision_tecnica = NOW(),
                id_usuario_revision_tecnica = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                costo_acondicionamiento,
                costo_total_unitario,
                estado_tecnico,
                usuario_id,
                bicicleta_id,
            ),
        )


def update_bicicleta_precio_personalizado(
    conn,
    bicicleta_id: int,
    *,
    precio,
    motivo: str | None,
    usuario_id: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET precio_venta_personalizado = %s,
                motivo_precio_venta = %s,
                fecha_precio_venta = NOW(),
                id_usuario_precio_venta = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (precio, motivo, usuario_id, bicicleta_id),
        )


def existe_orden_posterior_no_revertida(conn, orden: dict) -> bool:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM bicicleta_acondicionamientos
                WHERE id_bicicleta_serializada = %s
                  AND id > %s
                  AND estado <> 'revertido'
            ) AS existe
            """,
            (orden["id_bicicleta_serializada"], orden["id"]),
        )
        return bool(cur.fetchone()["existe"])


def update_estado(conn, acondicionamiento_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE bicicleta_acondicionamientos
            SET
                estado = %(estado)s::varchar,
                fecha_confirmacion = CASE WHEN %(estado)s::text = 'confirmado' THEN NOW() ELSE fecha_confirmacion END,
                id_usuario_confirmacion = CASE WHEN %(estado)s::text = 'confirmado' THEN %(id_usuario)s ELSE id_usuario_confirmacion END,
                fecha_reversion = CASE WHEN %(estado)s::text = 'revertido' THEN NOW() ELSE fecha_reversion END,
                id_usuario_reversion = CASE WHEN %(estado)s::text = 'revertido' THEN %(id_usuario)s ELSE id_usuario_reversion END,
                motivo_reversion = CASE WHEN %(estado)s::text = 'revertido' THEN %(motivo)s ELSE motivo_reversion END,
                updated_at = NOW()
            WHERE id = %(id)s
            RETURNING *
            """,
            {**data, "id": acondicionamiento_id},
        )
        return cur.fetchone()


def update_bicicleta_estado_tecnico(conn, bicicleta_id: int, estado_tecnico: str, usuario_id: int | None):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET estado_tecnico = %s,
                fecha_revision_tecnica = NOW(),
                id_usuario_revision_tecnica = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (estado_tecnico, usuario_id, bicicleta_id),
        )


def insert_evento(conn, acondicionamiento_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicleta_acondicionamiento_eventos (
                id_acondicionamiento, accion, detalle, metadata, id_usuario
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                acondicionamiento_id,
                data["accion"],
                data.get("detalle"),
                Jsonb(data.get("metadata") or {}),
                data.get("id_usuario"),
            ),
        )
        return cur.fetchone()


def list_eventos(conn, acondicionamiento_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT e.*, u.nombre AS usuario_nombre
            FROM bicicleta_acondicionamiento_eventos e
            LEFT JOIN usuarios u ON u.id = e.id_usuario
            WHERE e.id_acondicionamiento = %s
            ORDER BY e.fecha DESC, e.id DESC
            """,
            (acondicionamiento_id,),
        )
        return cur.fetchall()
