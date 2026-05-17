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
                vi.descripcion_snapshot,
                vi.cantidad,
                vi.precio_final,
                vi.subtotal,

                COALESCE(img_var.url, img_prod.url) AS imagen_principal

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
                p.monto_total_cobrado,
                p.estado,

                d.id_tarjeta_plan,
                tp.nombre AS tarjeta_plan_nombre,
                d.cuotas,
                d.entidad,
                d.monto_base,
                d.monto_recargo_financiero,
                d.porcentaje_recargo_aplicado,
                d.monto_neto_liquidado

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