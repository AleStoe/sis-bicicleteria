from psycopg.rows import dict_row


def get_bicicleta_serializada_for_update(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado,
                observaciones
            FROM bicicletas_serializadas
            WHERE id = %s
            FOR UPDATE
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()


def insert_bicicleta_serializada(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO bicicletas_serializadas (
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado,
                observaciones
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_variante"],
                data["id_sucursal_actual"],
                data["numero_cuadro"],
                data.get("estado", "disponible"),
                data.get("observaciones"),
            ),
        )
        return cur.fetchone()["id"]


def update_bicicleta_serializada_estado(conn, bicicleta_id: int, nuevo_estado: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET
                estado = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_estado, bicicleta_id),
        )


def insert_bicicleta_cliente(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
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
                notas,
                fecha_compra,
                condicion_entrega,
                plan_postventa,
                fecha_limite_service_gratis,
                service_gratis_usado,
                id_orden_service_gratis
            )
            VALUES (
                %(id_cliente)s,
                %(id_bicicleta_serializada)s,
                %(id_venta_origen)s,
                %(marca)s,
                %(modelo)s,
                %(rodado)s,
                %(color)s,
                %(numero_cuadro)s,
                %(notas)s,
                %(fecha_compra)s,
                %(condicion_entrega)s,
                %(plan_postventa)s,
                %(fecha_limite_service_gratis)s,
                %(service_gratis_usado)s,
                %(id_orden_service_gratis)s
            )
            RETURNING id
            """,
            {
                "id_cliente": data["id_cliente"],
                "id_bicicleta_serializada": data.get("id_bicicleta_serializada"),
                "id_venta_origen": data.get("id_venta_origen"),
                "marca": data.get("marca"),
                "modelo": data.get("modelo"),
                "rodado": data.get("rodado"),
                "color": data.get("color"),
                "numero_cuadro": data.get("numero_cuadro"),
                "notas": data.get("notas"),
                "fecha_compra": data.get("fecha_compra"),
                "condicion_entrega": data.get("condicion_entrega"),
                "plan_postventa": data.get("plan_postventa"),
                "fecha_limite_service_gratis": data.get("fecha_limite_service_gratis"),
                "service_gratis_usado": data.get("service_gratis_usado", False),
                "id_orden_service_gratis": data.get("id_orden_service_gratis"),
            },
        )

        return cur.fetchone()["id"]

def get_bicicletas_serializadas(conn, *, id_variante=None, id_sucursal=None, estado=None):
    filtros = []
    params = {}

    if id_variante is not None:
        filtros.append("bs.id_variante = %(id_variante)s")
        params["id_variante"] = id_variante

    if id_sucursal is not None:
        filtros.append("bs.id_sucursal_actual = %(id_sucursal)s")
        params["id_sucursal"] = id_sucursal

    if estado is not None:
        filtros.append("bs.estado = %(estado)s")
        params["estado"] = estado

    where_sql = ""
    if filtros:
        where_sql = "WHERE " + " AND ".join(filtros)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                bs.id,
                bs.id_variante,
                bs.id_sucursal_actual,
                s.nombre AS sucursal_nombre,
                bs.numero_cuadro,
                bs.estado,
                bs.observaciones,
                bs.fecha_alta,
                v.id_producto,
                v.nombre_variante,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                p.nombre AS producto_nombre,
                img.url AS imagen_principal,
                op.cliente_actual_id,
                op.cliente_actual_nombre,
                op.cliente_actual_telefono,
                op.operacion_tipo,
                op.operacion_id,
                op.venta_id,
                op.reserva_id
            FROM bicicletas_serializadas bs
            INNER JOIN variantes v ON v.id = bs.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN sucursales s ON s.id = bs.id_sucursal_actual
            LEFT JOIN LATERAL (
                SELECT ci.url
                FROM catalogo_imagenes ci
                WHERE
                    ci.activo = TRUE
                    AND (
                        ci.id_variante = v.id
                        OR ci.id_producto = p.id
                )
                ORDER BY
                    CASE
                        WHEN UPPER(TRIM(COALESCE(v.nombre_variante, ''))) IN ('UNICA', 'ÚNICA')
                             AND ci.id_producto = p.id THEN 0
                        WHEN UPPER(TRIM(COALESCE(v.nombre_variante, ''))) IN ('UNICA', 'ÚNICA')
                            THEN 1
                        WHEN ci.id_variante = v.id THEN 0
                        ELSE 1
                    END,
                    ci.es_principal DESC,
                    ci.orden ASC,
                    ci.id ASC
                LIMIT 1
            ) img ON TRUE
            LEFT JOIN LATERAL (
                SELECT *
                FROM (
                    (SELECT
                        c.id AS cliente_actual_id,
                        c.nombre AS cliente_actual_nombre,
                        c.telefono AS cliente_actual_telefono,
                        'venta_pendiente_entrega'::text AS operacion_tipo,
                        ve.id AS operacion_id,
                        ve.id AS venta_id,
                        NULL::bigint AS reserva_id,
                        ve.fecha AS fecha_operacion
                    FROM venta_items vi
                    INNER JOIN ventas ve ON ve.id = vi.id_venta
                    INNER JOIN clientes c ON c.id = ve.id_cliente
                    WHERE
                        vi.id_bicicleta_serializada = bs.id
                        AND ve.estado IN ('creada', 'pagada_parcial', 'pagada_total', 'entregada')
                    ORDER BY ve.fecha DESC, ve.id DESC
                    LIMIT 1)

                    UNION ALL

                    (SELECT
                        c.id AS cliente_actual_id,
                        c.nombre AS cliente_actual_nombre,
                        c.telefono AS cliente_actual_telefono,
                        'entregada'::text AS operacion_tipo,
                        bc.id_venta_origen AS operacion_id,
                        bc.id_venta_origen AS venta_id,
                        NULL::bigint AS reserva_id,
                        bc.created_at AS fecha_operacion
                    FROM bicicletas_clientes bc
                    INNER JOIN clientes c ON c.id = bc.id_cliente
                    WHERE
                        bs.estado = 'entregada'
                        AND bc.id_bicicleta_serializada = bs.id
                    ORDER BY bc.created_at DESC, bc.id DESC
                    LIMIT 1)

                    UNION ALL

                    (SELECT
                        c.id AS cliente_actual_id,
                        c.nombre AS cliente_actual_nombre,
                        c.telefono AS cliente_actual_telefono,
                        'reserva'::text AS operacion_tipo,
                        r.id AS operacion_id,
                        NULL::bigint AS venta_id,
                        r.id AS reserva_id,
                        r.fecha_reserva AS fecha_operacion
                    FROM reserva_items ri
                    INNER JOIN reservas r ON r.id = ri.id_reserva
                    INNER JOIN clientes c ON c.id = r.id_cliente
                    WHERE
                        ri.id_bicicleta_serializada = bs.id
                        AND r.estado = 'activa'
                    ORDER BY r.fecha_reserva DESC, r.id DESC
                    LIMIT 1)
                ) op_candidates
                ORDER BY fecha_operacion DESC NULLS LAST
                LIMIT 1
            ) op ON TRUE
            {where_sql}
            ORDER BY bs.id DESC
            """,
            params,
        )
        return cur.fetchall()
