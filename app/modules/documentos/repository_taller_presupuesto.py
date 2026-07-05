from psycopg.rows import dict_row


def get_orden_taller_presupuesto_by_id(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.estado,
                ot.problema_reportado,
                ot.observaciones,
                ot.fecha_prometida,
                ot.total_final,
                ot.saldo_pendiente,
                ot.id_venta_generada,

                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                c.dni AS cliente_dni,

                s.nombre AS sucursal_nombre,
                u_creador.nombre AS usuario_creador_nombre,
                u_tecnico.nombre AS tecnico_nombre,

                bc.marca AS bicicleta_marca,
                bc.modelo AS bicicleta_modelo,
                bc.rodado AS bicicleta_rodado,
                bc.color AS bicicleta_color,
                bc.numero_cuadro AS bicicleta_numero_cuadro,
                NULLIF(
                    CONCAT_WS(
                        ' ',
                        NULLIF(bc.marca, ''),
                        NULLIF(bc.modelo, ''),
                        CASE
                            WHEN NULLIF(bc.rodado, '') IS NOT NULL THEN 'R' || bc.rodado
                            ELSE NULL
                        END,
                        NULLIF(bc.color, '')
                    ),
                    ''
                ) AS bicicleta_descripcion
            FROM ordenes_taller ot
            INNER JOIN clientes c ON c.id = ot.id_cliente
            INNER JOIN sucursales s ON s.id = ot.id_sucursal
            LEFT JOIN usuarios u_creador ON u_creador.id = ot.id_usuario
            LEFT JOIN LATERAL (
                SELECT u.nombre
                FROM ordenes_taller_eventos ote
                INNER JOIN usuarios u ON u.id = ote.id_usuario
                WHERE ote.id_orden_taller = ot.id
                  AND ote.tipo_evento = 'item_ejecutado'
                ORDER BY ote.fecha DESC, ote.id DESC
                LIMIT 1
            ) u_tecnico ON TRUE
            INNER JOIN bicicletas_clientes bc ON bc.id = ot.id_bicicleta_cliente
            WHERE ot.id = %s
            """,
            (orden_id,),
        )
        return cur.fetchone()


def get_orden_taller_items_presupuesto_by_orden_id(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                oti.id,
                oti.id_orden_taller,
                oti.id_variante,
                oti.descripcion_snapshot,
                oti.cantidad,
                oti.precio_unitario,
                oti.valor_cobertura_unitario,
                oti.motivo_cobertura,
                oti.observacion_cobertura,
                oti.subtotal,
                oti.etapa,
                oti.aprobado,
                COALESCE(oti.tipo_item, p.tipo_item) AS tipo_item,
                p.stockeable,
                CASE
                    WHEN UPPER(TRIM(COALESCE(v.nombre_variante, ''))) IN ('UNICA', 'ÚNICA')
                        THEN COALESCE(img_prod.url, img_var.url)
                    ELSE COALESCE(img_var.url, img_prod.url)
                END AS imagen_principal
            FROM ordenes_taller_items oti
            LEFT JOIN variantes v ON v.id = oti.id_variante
            LEFT JOIN productos p ON p.id = v.id_producto
            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE ci.id_variante = v.id
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
            WHERE oti.id_orden_taller = %s
              AND oti.etapa <> 'cancelado'
            ORDER BY oti.id
            """,
            (orden_id,),
        )
        return cur.fetchall()


def get_notas_visibles_presupuesto_taller(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT tipo, contenido
            FROM ordenes_taller_notas
            WHERE id_orden_taller = %s
              AND tipo IN ('cliente', 'recomendacion_futura')
              AND estado <> 'archivada'
            ORDER BY created_at ASC, id ASC
            """,
            (orden_id,),
        )
        return cur.fetchall()
