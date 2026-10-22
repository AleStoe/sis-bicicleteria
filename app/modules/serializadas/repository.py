from psycopg.rows import dict_row


def get_bicicleta_serializada(conn, bicicleta_id: int, *, for_update: bool = False):
    with conn.cursor(row_factory=dict_row) as cur:
        bloqueo = " FOR UPDATE" if for_update else ""
        cur.execute(
            f"""
            SELECT
                id,
                id_variante,
                id_sucursal_actual,
                numero_cuadro,
                estado,
                estado_tecnico,
                condicion_comercial,
                ubicacion_fisica,
                observaciones,
                texto_comercial,
                costo_base_unitario,
                costo_base_origen,
                costo_acondicionamiento,
                costo_total_unitario,
                precio_venta_personalizado
            FROM bicicletas_serializadas
            WHERE id = %s
            {bloqueo}
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()


def get_bicicleta_serializada_for_update(conn, bicicleta_id: int):
    return get_bicicleta_serializada(conn, bicicleta_id, for_update=True)


def get_bicicleta_serializada_costo_venta_for_update(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                bs.id,
                bs.id_variante,
                bs.id_sucursal_actual,
                bs.numero_cuadro,
                bs.estado,
                bs.id_orden_armado_origen,
                bs.costo_fabricacion_final,
                bs.costo_base_unitario,
                bs.costo_base_origen,
                bs.costo_acondicionamiento,
                bs.costo_total_unitario,
                ao.estado AS orden_armado_estado,
                ao.id_bicicleta_serializada_resultante,
                av.id_variante_final,
                ao.codigo AS orden_armado_codigo
            FROM bicicletas_serializadas bs
            LEFT JOIN armado_ordenes ao
                ON ao.id = bs.id_orden_armado_origen
            LEFT JOIN armado_versiones av
                ON av.id = ao.id_version
            WHERE bs.id = %s
            FOR UPDATE OF bs
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
                observaciones,
                estado_tecnico,
                condicion_comercial,
                costo_base_unitario,
                costo_base_origen,
                costo_total_unitario
            )
            VALUES (%s, %s, %s, %s, %s, 'lista', 'normal', %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_variante"],
                data["id_sucursal_actual"],
                data["numero_cuadro"],
                data.get("estado", "disponible"),
                data.get("observaciones"),
                data.get("costo_base_unitario", 0),
                data.get("costo_base_origen", "costo_promedio_serializacion"),
                data.get("costo_base_unitario", 0),
            ),
        )
        return cur.fetchone()["id"]


def update_bicicleta_serializada_ficha(conn, bicicleta_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET
                estado_tecnico = %(estado_tecnico)s,
                condicion_comercial = %(condicion_comercial)s,
                ubicacion_fisica = %(ubicacion_fisica)s,
                observaciones = %(observaciones)s,
                texto_comercial = %(texto_comercial)s,
                fecha_revision_tecnica = NOW(),
                id_usuario_revision_tecnica = %(id_usuario)s,
                updated_at = NOW()
            WHERE id = %(bicicleta_id)s
            RETURNING *
            """,
            {**data, "bicicleta_id": bicicleta_id},
        )
        return cur.fetchone()


def update_bicicleta_serializada_precio(conn, bicicleta_id: int, data: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET precio_venta_personalizado = %(precio)s,
                motivo_precio_venta = %(motivo)s,
                fecha_precio_venta = NOW(),
                id_usuario_precio_venta = %(id_usuario)s,
                updated_at = NOW()
            WHERE id = %(bicicleta_id)s
            """,
            {**data, "bicicleta_id": bicicleta_id},
        )


def tiene_acondicionamiento_confirmado(conn, bicicleta_id: int) -> bool:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM bicicleta_acondicionamientos
                WHERE id_bicicleta_serializada = %s
                  AND estado = 'confirmado'
            ) AS existe
            """,
            (bicicleta_id,),
        )
        return bool(cur.fetchone()["existe"])


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


def update_bicicleta_serializada_numero_cuadro(conn, bicicleta_id: int, numero_cuadro: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_serializadas
            SET
                numero_cuadro = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (numero_cuadro, bicicleta_id),
        )


def update_bicicletas_cliente_numero_cuadro_by_serializada(
    conn,
    bicicleta_id: int,
    numero_cuadro: str,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE bicicletas_clientes
            SET
                numero_cuadro = %s,
                updated_at = NOW()
            WHERE id_bicicleta_serializada = %s
            RETURNING id
            """,
            (numero_cuadro, bicicleta_id),
        )
        return cur.fetchall()


def get_correcciones_numero_cuadro(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                ae.id,
                ae.created_at AS fecha,
                ae.metadata,
                u.nombre AS usuario_nombre,
                u.username AS usuario_username
            FROM auditoria_eventos ae
            LEFT JOIN usuarios u
                ON u.id = ae.id_usuario
            WHERE ae.entidad = 'bicicleta_serializada'
              AND ae.entidad_id = %s
              AND ae.accion = 'numero_cuadro_corregido'
            ORDER BY ae.id DESC
            """,
            (bicicleta_id,),
        )
        return cur.fetchall()


def get_primer_usuario_activo_id(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id
            FROM usuarios
            WHERE activo = TRUE
            ORDER BY id
            LIMIT 1
            """
        )
        row = cur.fetchone()
        return row["id"] if row else None


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

def get_bicicletas_serializadas(
    conn,
    *,
    bicicleta_id=None,
    id_variante=None,
    id_sucursal=None,
    estado=None,
    estado_tecnico=None,
    condicion_comercial=None,
    ubicacion_fisica=None,
    query=None,
):
    filtros = []
    params = {}

    if bicicleta_id is not None:
        filtros.append("bs.id = %(bicicleta_id)s")
        params["bicicleta_id"] = bicicleta_id

    if id_variante is not None:
        filtros.append("bs.id_variante = %(id_variante)s")
        params["id_variante"] = id_variante

    if id_sucursal is not None:
        filtros.append("bs.id_sucursal_actual = %(id_sucursal)s")
        params["id_sucursal"] = id_sucursal

    if estado is not None:
        filtros.append("bs.estado = %(estado)s")
        params["estado"] = estado

    if estado_tecnico is not None:
        filtros.append("bs.estado_tecnico = %(estado_tecnico)s")
        params["estado_tecnico"] = estado_tecnico

    if condicion_comercial is not None:
        filtros.append("bs.condicion_comercial = %(condicion_comercial)s")
        params["condicion_comercial"] = condicion_comercial

    if ubicacion_fisica:
        filtros.append("bs.ubicacion_fisica ILIKE %(ubicacion_fisica)s")
        params["ubicacion_fisica"] = f"%{ubicacion_fisica.strip()}%"

    if query:
        filtros.append(
            "(bs.numero_cuadro ILIKE %(query)s OR v.sku ILIKE %(query)s "
            "OR p.nombre ILIKE %(query)s)"
        )
        params["query"] = f"%{query.strip()}%"

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
                bs.estado_tecnico,
                bs.condicion_comercial,
                bs.ubicacion_fisica,
                bs.observaciones,
                bs.texto_comercial,
                bs.costo_base_unitario,
                bs.costo_base_origen,
                bs.costo_acondicionamiento,
                bs.costo_total_unitario,
                bs.precio_venta_personalizado,
                bs.fecha_revision_tecnica,
                bs.id_usuario_revision_tecnica,
                bs.fecha_alta,
                v.id_producto,
                v.nombre_variante,
                v.sku,
                v.codigo_barras,
                v.codigo_proveedor,
                v.precio_minorista,
                p.nombre AS producto_nombre,
                img.url AS imagen_principal,
                op.cliente_actual_id,
                op.cliente_actual_nombre,
                op.cliente_actual_telefono,
                op.operacion_tipo,
                op.operacion_id,
                op.venta_id,
                op.reserva_id,
                bs.id_orden_armado_origen,
                bs.costo_fabricacion_final,
                ao.codigo AS codigo_orden_armado,
                oferta.id AS oferta_id,
                oferta.nombre AS oferta_nombre,
                oferta.precio_oferta,
                oferta.alcance AS oferta_alcance,
                oferta.politica_contado AS oferta_politica_contado,
                oferta.fecha_hasta AS oferta_fecha_hasta,
                COALESCE(oferta.precio_oferta, bs.precio_venta_personalizado, v.precio_minorista, 0) AS precio_venta_actual,
                (
                    COALESCE(oferta.precio_oferta, bs.precio_venta_personalizado, v.precio_minorista, 0)
                    - COALESCE(bs.costo_total_unitario, 0)
                )::numeric(14,2) AS ganancia_estimada,
                CASE
                    WHEN COALESCE(oferta.precio_oferta, bs.precio_venta_personalizado, v.precio_minorista, 0) > 0
                    THEN ROUND(
                        (
                            COALESCE(oferta.precio_oferta, bs.precio_venta_personalizado, v.precio_minorista, 0)
                            - COALESCE(bs.costo_total_unitario, 0)
                        ) / COALESCE(oferta.precio_oferta, bs.precio_venta_personalizado, v.precio_minorista, 0) * 100,
                        2
                    )
                    ELSE NULL
                END AS margen_estimado,
                venta.venta_fecha,
                venta.venta_precio_final,
                venta.venta_costo_aplicado,
                venta.venta_ganancia,
                venta.venta_oferta_id,
                venta.venta_oferta_nombre,
                venta.venta_oferta_alcance
            FROM bicicletas_serializadas bs
            INNER JOIN variantes v ON v.id = bs.id_variante
            INNER JOIN productos p ON p.id = v.id_producto
            INNER JOIN sucursales s ON s.id = bs.id_sucursal_actual
            LEFT JOIN armado_ordenes ao
                ON ao.id = bs.id_orden_armado_origen
            LEFT JOIN LATERAL (
                SELECT
                    ve.fecha AS venta_fecha,
                    vi.precio_final AS venta_precio_final,
                    COALESCE(vi.costo_unitario_aplicado, 0) AS venta_costo_aplicado,
                    (
                        COALESCE(vi.precio_final, 0)
                        - COALESCE(vi.costo_unitario_aplicado, 0)
                    )::numeric(14,2) AS venta_ganancia,
                    vi.id_oferta AS venta_oferta_id,
                    vi.oferta_nombre_snapshot AS venta_oferta_nombre,
                    vi.oferta_alcance_snapshot AS venta_oferta_alcance
                FROM venta_items vi
                INNER JOIN ventas ve ON ve.id = vi.id_venta
                WHERE vi.id_bicicleta_serializada = bs.id
                  AND ve.estado NOT IN ('anulada', 'cancelada')
                ORDER BY ve.fecha DESC, ve.id DESC, vi.id DESC
                LIMIT 1
            ) venta ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    o.id,
                    o.nombre,
                    o.precio_oferta,
                    o.alcance,
                    o.politica_contado,
                    o.fecha_hasta
                FROM ofertas o
                LEFT JOIN oferta_bicicletas_serializadas obs
                    ON obs.id_oferta = o.id
                   AND obs.id_bicicleta_serializada = bs.id
                WHERE o.id_variante = bs.id_variante
                  AND o.activa = TRUE
                  AND CURRENT_DATE BETWEEN o.fecha_desde AND o.fecha_hasta
                  AND (
                        (o.alcance = 'unidades' AND obs.id IS NOT NULL)
                        OR o.alcance = 'variante'
                  )
                ORDER BY
                    CASE WHEN o.alcance = 'unidades' THEN 0 ELSE 1 END,
                    o.fecha_desde DESC,
                    o.id DESC
                LIMIT 1
            ) oferta ON TRUE
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
