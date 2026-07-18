from psycopg.rows import dict_row


def get_venta_comprobante_by_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.estado,
                v.subtotal_base,
                v.descuento_total,
                v.recargo_total,
                v.total_final,
                v.saldo_pendiente,
                v.observaciones,

                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                c.dni AS cliente_dni,
                c.cuit AS cliente_cuit,
                c.condicion_iva AS cliente_condicion_iva,

                s.nombre AS sucursal_nombre

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


def get_venta_items_comprobante_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                vi.id,
                vi.id_variante,
                vi.id_bicicleta_serializada,
                vi.tipo_item,
                vi.id_servicio_taller,
                p.tipo_item AS producto_tipo_item,
                vi.descripcion_snapshot,
                vi.cantidad,
                vi.precio_lista,
                vi.precio_final,
                vi.precio_unitario_original,
                vi.precio_unitario_final,
                vi.id_oferta,
                vi.precio_catalogo_original,
                vi.descuento_oferta_unitario,
                vi.oferta_nombre_snapshot,
                vi.bonificado,
                vi.bonificacion_unitaria,
                vi.motivo_bonificacion,
                vi.motivo_precio_manual,
                vi.subtotal,
                bs.numero_cuadro,

                CASE
                    WHEN UPPER(TRIM(COALESCE(var.nombre_variante, ''))) IN ('UNICA', 'ÚNICA')
                        THEN COALESCE(img_prod.url, img_var.url)
                    ELSE COALESCE(img_var.url, img_prod.url)
                END AS imagen_principal

            FROM venta_items vi

            LEFT JOIN variantes var
                ON var.id = vi.id_variante

            LEFT JOIN productos p
                ON p.id = var.id_producto

            LEFT JOIN bicicletas_serializadas bs
                ON bs.id = vi.id_bicicleta_serializada

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_variante = var.id
                    AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.id ASC
                LIMIT 1
            ) img_var ON TRUE

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_producto = p.id
                    AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.id ASC
                LIMIT 1
            ) img_prod ON TRUE

            WHERE vi.id_venta = %s

            ORDER BY vi.id
            """,
            (venta_id,),
        )

        return cur.fetchall()


def get_pagos_comprobante_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                p.id,
                p.medio_pago,
                p.monto_base_aplicado,
                p.monto_descuento_aplicado,
                p.monto_recargo_aplicado,
                p.monto_total_cobrado,
                p.estado,

                d.id_tarjeta_plan,
                tp.nombre AS tarjeta_plan_nombre,
                d.cuotas,
                d.entidad,
                d.monto_base,
                d.monto_recargo_financiero,
                d.porcentaje_recargo_aplicado,
                p.monto_costo_financiero,
                p.monto_neto_liquidado

            FROM pagos p

            LEFT JOIN pagos_tarjeta_detalle d
                ON d.id_pago = p.id

            LEFT JOIN tarjeta_planes tp
                ON tp.id = d.id_tarjeta_plan

            WHERE p.origen_tipo = 'venta'
              AND p.origen_id = %s
              AND p.estado = 'confirmado'

            ORDER BY p.id
            """,
            (venta_id,),
        )

        return cur.fetchall()

def get_pago_recibo_by_id(conn, pago_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            WITH pagos_venta AS (
                SELECT
                    p.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY p.origen_id
                        ORDER BY p.fecha, p.id
                    ) AS numero_pago,
                    COUNT(*) OVER (
                        PARTITION BY p.origen_id
                    ) AS cantidad_pagos,
                    SUM(p.monto_total_cobrado) OVER (
                        PARTITION BY p.origen_id
                        ORDER BY p.fecha, p.id
                    ) AS pagado_acumulado
                FROM pagos p
                WHERE p.origen_tipo = 'venta'
                  AND p.estado = 'confirmado'
            )
            SELECT
                p.id,
                p.fecha,
                p.medio_pago,
                p.monto_total_cobrado,
                p.monto_base_aplicado,
                p.monto_descuento_aplicado,
                p.monto_recargo_aplicado,
                p.estado,
                p.nota,
                p.numero_pago,
                p.cantidad_pagos,
                p.pagado_acumulado,

                v.id AS venta_id,
                v.total_final,
                v.saldo_pendiente,

                c.nombre AS cliente_nombre,
                s.nombre AS sucursal_nombre,

                d.id_tarjeta_plan,
                tp.nombre AS tarjeta_plan_nombre,
                d.cuotas,
                d.entidad,
                d.monto_base,
                d.monto_recargo_financiero,
                d.porcentaje_recargo_aplicado,
                p.monto_costo_financiero,
                p.monto_neto_liquidado

            FROM pagos_venta p

            INNER JOIN ventas v
                ON v.id = p.origen_id

            INNER JOIN clientes c
                ON c.id = v.id_cliente

            INNER JOIN sucursales s
                ON s.id = v.id_sucursal

            LEFT JOIN pagos_tarjeta_detalle d
                ON d.id_pago = p.id

            LEFT JOIN tarjeta_planes tp
                ON tp.id = d.id_tarjeta_plan

            WHERE p.id = %s
            """,
            (pago_id,),
        )

        return cur.fetchone()
def get_resumen_cobros_venta_by_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.estado,
                v.total_final,
                v.saldo_pendiente,
                v.subtotal_base,
                v.descuento_total,
                v.recargo_total,
                c.nombre AS cliente_nombre,
                s.nombre AS sucursal_nombre
            FROM ventas v
            INNER JOIN clientes c ON c.id = v.id_cliente
            INNER JOIN sucursales s ON s.id = v.id_sucursal
            WHERE v.id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()


def get_resumen_cobros_pagos_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                p.id,
                p.fecha,
                p.medio_pago,
                p.monto_base_aplicado,
                p.monto_descuento_aplicado,
                p.monto_recargo_aplicado,
                p.monto_total_cobrado,
                p.estado,
                p.nota,

                d.cuotas,
                d.entidad,
                tp.nombre AS tarjeta_plan_nombre,
                d.porcentaje_recargo_aplicado

            FROM pagos p

            LEFT JOIN pagos_tarjeta_detalle d
                ON d.id_pago = p.id

            LEFT JOIN tarjeta_planes tp
                ON tp.id = d.id_tarjeta_plan

            WHERE p.origen_tipo = 'venta'
              AND p.origen_id = %s
              AND p.estado = 'confirmado'

            ORDER BY p.fecha, p.id
            """,
            (venta_id,),
        )
        return cur.fetchall()


def get_resumen_cobros_items_preview_by_venta_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                vi.descripcion_snapshot,
                vi.cantidad,
                CASE
                    WHEN UPPER(TRIM(COALESCE(var.nombre_variante, ''))) IN ('UNICA', 'ÚNICA')
                        THEN COALESCE(img_prod.url, img_var.url)
                    ELSE COALESCE(img_var.url, img_prod.url)
                END AS imagen_principal
            FROM venta_items vi

            INNER JOIN variantes var
                ON var.id = vi.id_variante

            INNER JOIN productos p
                ON p.id = var.id_producto

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_variante = var.id
                  AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.id ASC
                LIMIT 1
            ) img_var ON TRUE

            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_producto = p.id
                  AND ci.activo = TRUE
                ORDER BY ci.es_principal DESC, ci.id ASC
                LIMIT 1
            ) img_prod ON TRUE

            WHERE vi.id_venta = %s
            ORDER BY vi.id
            LIMIT 3
            """,
            (venta_id,),
        )
        return cur.fetchall()
