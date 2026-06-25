from psycopg.rows import dict_row

def validar_sucursal_activa(conn, id_sucursal: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM sucursales
            WHERE id = %s
              AND activa = TRUE
            """,
            (id_sucursal,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("La sucursal no existe o está inactiva")

def validar_usuario_activo(conn, id_usuario: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM usuarios
            WHERE id = %s
              AND activo = TRUE
            """,
            (id_usuario,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El usuario no existe o está inactivo")

def validar_cliente_existente(conn, id_cliente: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id
            FROM clientes
            WHERE id = %s
            """,
            (id_cliente,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El cliente no existe")

def get_bicicleta_cliente(conn, id_bicicleta_cliente: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_cliente,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            FROM bicicletas_clientes
            WHERE id = %s
            """,
            (id_bicicleta_cliente,),
        )
        return cur.fetchone()

def get_variante_by_id(conn, id_variante: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.codigo_proveedor,
                p.nombre AS producto_nombre,
                p.descripcion AS producto_descripcion,
                p.tipo_item,
                p.stockeable
            FROM variantes v
            JOIN productos p ON p.id = v.id_producto
            WHERE v.id = %s
            """,
            (id_variante,),
        )
        return cur.fetchone()

def insert_orden_taller(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ordenes_taller (
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                fecha_prometida,
                prioridad,
                es_service_postventa,
                tipo_postventa,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                fecha_ingreso,
                id_sucursal,
                id_cliente,
                id_bicicleta_cliente,
                estado,
                problema_reportado,
                observaciones,
                fecha_prometida,
                fecha_terminada,
                fecha_retirada,
                cliente_avisado_retiro,
                fecha_aviso_retiro,
                prioridad,
                es_service_postventa,
                tipo_postventa,
                total_final,
                saldo_pendiente,
                id_venta_generada,
                id_usuario,
                created_at,
                updated_at
            """,
            (
                data["id_sucursal"],
                data["id_cliente"],
                data["id_bicicleta_cliente"],
                data["estado"],
                data["problema_reportado"],
                data.get("fecha_prometida"),
                data.get("prioridad", "normal"),
                data.get("es_service_postventa", False),
                data.get("tipo_postventa"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()

def _ordenes_taller_select_sql():
    return """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.id_sucursal,
                ot.id_cliente,
                ot.id_bicicleta_cliente,
                c.nombre AS cliente_nombre,
                c.nombre_persona AS cliente_nombre_persona,
                c.apellido AS cliente_apellido,
                c.telefono AS cliente_telefono,
                c.dni AS cliente_dni,
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
                ) AS bicicleta_descripcion,
                ot.estado,
                ot.problema_reportado,
                ot.observaciones,
                ot.fecha_prometida,
                ot.fecha_terminada,
                ot.fecha_retirada,
                ot.cliente_avisado_retiro,
                ot.fecha_aviso_retiro,
                ot.prioridad,
                ot.es_service_postventa,
                ot.tipo_postventa,
                CASE
                    WHEN ot.estado IN ('retirada', 'cancelada') THEN NULL
                    ELSE GREATEST((CURRENT_DATE - ot.fecha_ingreso::date), 0)
                END AS dias_en_taller,
                CASE
                    WHEN ot.fecha_prometida IS NULL THEN 0
                    WHEN ot.estado IN ('retirada', 'cancelada') AND ot.fecha_retirada IS NOT NULL
                        THEN GREATEST((ot.fecha_retirada::date - ot.fecha_prometida::date), 0)
                    WHEN ot.estado NOT IN ('retirada', 'cancelada')
                        THEN GREATEST((CURRENT_DATE - ot.fecha_prometida::date), 0)
                    ELSE 0
                END AS dias_demorados,
                ot.total_final,
                ot.saldo_pendiente,
                ot.id_venta_generada,
                ot.id_usuario,
                ot.created_at,
                ot.updated_at
            FROM ordenes_taller ot
            JOIN clientes c ON c.id = ot.id_cliente
            JOIN bicicletas_clientes bc ON bc.id = ot.id_bicicleta_cliente
            ORDER BY ot.fecha_ingreso DESC, ot.id DESC
            """

def get_ordenes_taller(
    conn,
    vista: str | None = None,
    estado: str | None = None,
    solo_pendientes: bool = True,
):
    sql = _ordenes_taller_select_sql()
    where = []
    params = []

    if solo_pendientes:
        where.append("ot.estado NOT IN ('retirada', 'cancelada')")

    if estado:
        where.append("ot.estado = %s")
        params.append(estado)

    if vista == "para_manana":
        where.append("ot.fecha_prometida::date = CURRENT_DATE + 1")
        where.append("ot.estado NOT IN ('retirada', 'cancelada')")

    if vista == "atrasadas":
        where.append("ot.fecha_prometida IS NOT NULL")
        where.append("ot.fecha_prometida::date < CURRENT_DATE")
        where.append("ot.estado NOT IN ('retirada', 'cancelada')")

    if where:
        sql = sql.replace(
            "ORDER BY ot.fecha_ingreso DESC, ot.id DESC",
            "WHERE " + " AND ".join(where) + "\n            ORDER BY ot.fecha_ingreso DESC, ot.id DESC",
        )

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_dashboard_taller(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE estado NOT IN ('retirada', 'cancelada')) AS pendientes,
                COUNT(*) FILTER (WHERE estado = 'ingresada') AS ingresadas,
                COUNT(*) FILTER (WHERE estado = 'presupuestada') AS presupuestadas,
                COUNT(*) FILTER (WHERE estado = 'esperando_aprobacion') AS esperando_aprobacion,
                COUNT(*) FILTER (WHERE estado = 'esperando_repuestos') AS esperando_repuestos,
                COUNT(*) FILTER (WHERE estado = 'en_reparacion') AS en_reparacion,
                COUNT(*) FILTER (WHERE estado = 'terminada') AS terminadas,
                COUNT(*) FILTER (WHERE estado = 'facturada') AS facturadas,
                COUNT(*) FILTER (WHERE estado = 'lista_para_retirar') AS listas_para_retirar,
                COUNT(*) FILTER (
                    WHERE fecha_prometida IS NOT NULL
                      AND fecha_prometida::date < CURRENT_DATE
                      AND estado NOT IN ('retirada', 'cancelada')
                ) AS atrasadas,
                COUNT(*) FILTER (
                    WHERE fecha_prometida::date = CURRENT_DATE + 1
                      AND estado NOT IN ('retirada', 'cancelada')
                ) AS para_manana,
                COUNT(*) FILTER (
                    WHERE prioridad = 'urgente'
                      AND estado NOT IN ('retirada', 'cancelada')
                ) AS urgentes,
                COALESCE(SUM(total_final) FILTER (WHERE estado NOT IN ('retirada', 'cancelada')), 0) AS total_importe_pendiente
            FROM ordenes_taller
            """
        )
        row = cur.fetchone() or {}

    return {
        "pendientes": row.get("pendientes") or 0,
        "ingresadas": row.get("ingresadas") or 0,
        "presupuestadas": row.get("presupuestadas") or 0,
        "esperando_aprobacion": row.get("esperando_aprobacion") or 0,
        "esperando_repuestos": row.get("esperando_repuestos") or 0,
        "en_reparacion": row.get("en_reparacion") or 0,
        "terminadas": row.get("terminadas") or 0,
        "facturadas": row.get("facturadas") or 0,
        "listas_para_retirar": row.get("listas_para_retirar") or 0,
        "atrasadas": row.get("atrasadas") or 0,
        "para_manana": row.get("para_manana") or 0,
        "urgentes": row.get("urgentes") or 0,
        "total_importe_pendiente": row.get("total_importe_pendiente") or 0,
    }

def get_orden_taller_by_id(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.id_sucursal,
                ot.id_cliente,
                ot.id_bicicleta_cliente,
                c.nombre AS cliente_nombre,
                c.nombre_persona AS cliente_nombre_persona,
                c.apellido AS cliente_apellido,
                c.telefono AS cliente_telefono,
                c.dni AS cliente_dni,
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
                ) AS bicicleta_descripcion,
                ot.estado,
                ot.problema_reportado,
                ot.observaciones,
                ot.fecha_prometida,
                ot.fecha_terminada,
                ot.fecha_retirada,
                ot.cliente_avisado_retiro,
                ot.fecha_aviso_retiro,
                ot.prioridad,
                ot.es_service_postventa,
                ot.tipo_postventa,
                CASE
                    WHEN ot.estado IN ('retirada', 'cancelada') THEN NULL
                    ELSE GREATEST((CURRENT_DATE - ot.fecha_ingreso::date), 0)
                END AS dias_en_taller,
                CASE
                    WHEN ot.fecha_prometida IS NULL THEN 0
                    WHEN ot.estado IN ('retirada', 'cancelada') AND ot.fecha_retirada IS NOT NULL
                        THEN GREATEST((ot.fecha_retirada::date - ot.fecha_prometida::date), 0)
                    WHEN ot.estado NOT IN ('retirada', 'cancelada')
                        THEN GREATEST((CURRENT_DATE - ot.fecha_prometida::date), 0)
                    ELSE 0
                END AS dias_demorados,
                ot.total_final,
                ot.saldo_pendiente,
                ot.id_venta_generada,
                ot.id_usuario,
                ot.created_at,
                ot.updated_at
            FROM ordenes_taller ot
            JOIN clientes c ON c.id = ot.id_cliente
            JOIN bicicletas_clientes bc ON bc.id = ot.id_bicicleta_cliente
            WHERE ot.id = %s
            """,
            (orden_id,),
        )
        return cur.fetchone()

def get_orden_taller_by_id_for_update(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.id_sucursal,
                ot.id_cliente,
                ot.id_bicicleta_cliente,
                c.nombre AS cliente_nombre,
                c.nombre_persona AS cliente_nombre_persona,
                c.apellido AS cliente_apellido,
                c.telefono AS cliente_telefono,
                c.dni AS cliente_dni,
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
                ) AS bicicleta_descripcion,
                ot.estado,
                ot.problema_reportado,
                ot.observaciones,
                ot.fecha_prometida,
                ot.fecha_terminada,
                ot.fecha_retirada,
                ot.cliente_avisado_retiro,
                ot.fecha_aviso_retiro,
                ot.prioridad,
                ot.es_service_postventa,
                ot.tipo_postventa,
                CASE
                    WHEN ot.estado IN ('retirada', 'cancelada') THEN NULL
                    ELSE GREATEST((CURRENT_DATE - ot.fecha_ingreso::date), 0)
                END AS dias_en_taller,
                CASE
                    WHEN ot.fecha_prometida IS NULL THEN 0
                    WHEN ot.estado IN ('retirada', 'cancelada') AND ot.fecha_retirada IS NOT NULL
                        THEN GREATEST((ot.fecha_retirada::date - ot.fecha_prometida::date), 0)
                    WHEN ot.estado NOT IN ('retirada', 'cancelada')
                        THEN GREATEST((CURRENT_DATE - ot.fecha_prometida::date), 0)
                    ELSE 0
                END AS dias_demorados,
                ot.total_final,
                ot.saldo_pendiente,
                ot.id_venta_generada,
                ot.id_usuario,
                ot.created_at,
                ot.updated_at
            FROM ordenes_taller ot
            JOIN clientes c ON c.id = ot.id_cliente
            JOIN bicicletas_clientes bc ON bc.id = ot.id_bicicleta_cliente
            WHERE ot.id = %s
            FOR UPDATE
            """,
            (orden_id,),
        )
        return cur.fetchone()
    
def update_orden_taller_estado(conn, orden_id: int, nuevo_estado: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ordenes_taller
            SET estado = %s,
                fecha_terminada = CASE
                    WHEN %s = 'terminada' AND fecha_terminada IS NULL THEN NOW()
                    ELSE fecha_terminada
                END,
                fecha_retirada = CASE
                    WHEN %s = 'retirada' AND fecha_retirada IS NULL THEN NOW()
                    ELSE fecha_retirada
                END,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_estado, nuevo_estado, nuevo_estado, orden_id),
        )

def update_orden_taller_operativo(conn, orden_id: int, fecha_prometida, prioridad: str):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE ordenes_taller
            SET fecha_prometida = %s,
                prioridad = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (fecha_prometida, prioridad, orden_id),
        )
        return cur.fetchone()

def marcar_aviso_retiro_enviado(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE ordenes_taller
            SET cliente_avisado_retiro = TRUE,
                fecha_aviso_retiro = NOW(),
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (orden_id,),
        )
        return cur.fetchone()

def insert_orden_taller_item(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ordenes_taller_items (
                id_orden_taller,
                tipo_item,
                id_variante,
                id_servicio_taller,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                subtotal
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                id_orden_taller,
                tipo_item,
                id_variante,
                id_servicio_taller,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                subtotal,
                created_at,
                etapa,
                costo_unitario_aplicado,
                aprobado,
                updated_at
            """,
            (
                data["id_orden_taller"],
                data["tipo_item"],
                data.get("id_variante"),
                data.get("id_servicio_taller"),
                data["descripcion_snapshot"],
                data["cantidad"],
                data["precio_unitario"],
                data["subtotal"],
            ),
        )
        return cur.fetchone()

def get_items_orden_taller(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                id_orden_taller,
                tipo_item,
                id_variante,
                id_servicio_taller,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                subtotal,
                created_at,
                etapa,
                costo_unitario_aplicado,
                aprobado,
                updated_at
            FROM ordenes_taller_items
            WHERE id_orden_taller = %s
            ORDER BY id
            """,
            (orden_id,),
        )
        return cur.fetchall()

def recalcular_total_orden_taller(conn, orden_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ordenes_taller
            SET total_final = COALESCE(
                    (
                        SELECT SUM(subtotal)
                        FROM ordenes_taller_items
                        WHERE id_orden_taller = %s
                        AND etapa <> 'cancelado'
                    ),
                    0
                ),
                updated_at = NOW()
            WHERE id = %s
            """,
            (orden_id, orden_id),
        )

def insert_orden_taller_evento(
    conn,
    id_orden_taller: int,
    tipo_evento: str,
    detalle: str | None,
    id_usuario: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO ordenes_taller_eventos (
                id_orden_taller,
                tipo_evento,
                detalle,
                id_usuario
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                id,
                id_orden_taller,
                fecha,
                tipo_evento,
                detalle,
                id_usuario,
                created_at
            """,
            (id_orden_taller, tipo_evento, detalle, id_usuario),
        )
        return cur.fetchone()

def get_eventos_orden_taller(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                ote.id,
                ote.id_orden_taller,
                ote.fecha,
                ote.tipo_evento,
                ote.detalle,
                ote.id_usuario,
                u.nombre AS usuario_nombre,
                u.username AS usuario_username,
                ote.created_at
            FROM ordenes_taller_eventos ote
            LEFT JOIN usuarios u
                ON u.id = ote.id_usuario
            WHERE ote.id_orden_taller = %s
            ORDER BY ote.fecha, ote.id
            """,
            (orden_id,),
        )
        return cur.fetchall()

def get_item_orden_taller_by_id_for_update(conn, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                oti.id,
                oti.id_orden_taller,
                oti.tipo_item,
                oti.id_variante,
                oti.id_servicio_taller,
                oti.etapa,
                oti.descripcion_snapshot,
                oti.cantidad,
                oti.precio_unitario,
                oti.costo_unitario_aplicado,
                oti.aprobado,
                oti.subtotal,
                oti.created_at,
                oti.updated_at,
                COALESCE(oti.tipo_item, p.tipo_item, 'repuesto') AS tipo_item_resuelto,
                p.tipo_item AS producto_tipo_item,
                p.stockeable
            FROM ordenes_taller_items oti
            LEFT JOIN variantes v ON v.id = oti.id_variante
            LEFT JOIN productos p ON p.id = v.id_producto
            WHERE oti.id = %s
            FOR UPDATE OF oti
            """,
            (item_id,),
        )
        return cur.fetchone()

def update_orden_taller_item_aprobacion(conn, item_id: int, aprobado: bool):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE ordenes_taller_items
            SET aprobado = %s,
                etapa = CASE
                    WHEN %s = TRUE THEN 'agregado'
                    ELSE 'presupuestado'
                END,
                updated_at = NOW()
            WHERE id = %s
            RETURNING
                id,
                id_orden_taller,
                tipo_item,
                id_variante,
                id_servicio_taller,
                etapa,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                costo_unitario_aplicado,
                aprobado,
                subtotal,
                created_at,
                updated_at
            """,
            (aprobado, aprobado, item_id),
        )
        return cur.fetchone()

def update_orden_taller_item_ejecutado(conn, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE ordenes_taller_items
            SET etapa = 'ejecutado',
                updated_at = NOW()
            WHERE id = %s
            RETURNING
                id,
                id_orden_taller,
                tipo_item,
                id_variante,
                id_servicio_taller,
                etapa,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                costo_unitario_aplicado,
                aprobado,
                subtotal,
                created_at,
                updated_at
            """,
            (item_id,),
        )
        return cur.fetchone()
    
def update_orden_taller_item_agregado(conn, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE ordenes_taller_items
            SET etapa = 'agregado',
                updated_at = NOW()
            WHERE id = %s
            RETURNING
                id,
                id_orden_taller,
                tipo_item,
                id_variante,
                id_servicio_taller,
                etapa,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                costo_unitario_aplicado,
                aprobado,
                subtotal,
                created_at,
                updated_at
            """,
            (item_id,),
        )
        return cur.fetchone()

    
def update_orden_taller_item_cancelado(conn, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE ordenes_taller_items
            SET etapa = 'cancelado',
                aprobado = FALSE,
                updated_at = NOW()
            WHERE id = %s
            RETURNING
                id,
                id_orden_taller,
                tipo_item,
                id_variante,
                id_servicio_taller,
                etapa,
                descripcion_snapshot,
                cantidad,
                precio_unitario,
                costo_unitario_aplicado,
                aprobado,
                subtotal,
                created_at,
                updated_at
            """,
            (item_id,),
        )
        return cur.fetchone()

def update_orden_taller_venta_generada(conn, orden_id: int, venta_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ordenes_taller
            SET id_venta_generada = %s,
                estado = 'facturada',
                updated_at = NOW()
            WHERE id = %s
            """,
            (venta_id, orden_id),
        )

def get_venta_generada_por_orden_taller(conn, orden_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, estado, total_final, saldo_pendiente
            FROM ventas
            WHERE id_orden_taller = %s
            """,
            (orden_id,),
        )
        return cur.fetchone()

def get_venta_generada_con_deuda_por_id(conn, venta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.estado,
                v.total_final,
                v.saldo_pendiente,
                EXISTS (
                    SELECT 1
                    FROM deudas_cliente d
                    WHERE d.origen_tipo = 'venta'
                      AND d.origen_id = v.id
                ) AS tiene_deuda_formal
            FROM ventas v
            WHERE v.id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()

def get_nombre_cliente_item_taller(
    conn,
    id_variante: int | None,
    id_servicio_taller: int | None,
):
    with conn.cursor(row_factory=dict_row) as cur:
        if id_servicio_taller:
            cur.execute(
                """
                SELECT nombre
                FROM servicios_taller
                WHERE id = %s
                """,
                (id_servicio_taller,),
            )
            row = cur.fetchone()
            return row["nombre"] if row else None

        if id_variante:
            cur.execute(
                """
                SELECT p.nombre
                FROM variantes v
                JOIN productos p
                    ON p.id = v.id_producto
                WHERE v.id = %s
                """,
                (id_variante,),
            )
            row = cur.fetchone()
            return row["nombre"] if row else None

    return None


def get_orden_postventa_abierta_por_bicicleta(
    conn,
    bicicleta_id: int,
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id,
                estado,
                fecha_ingreso
            FROM ordenes_taller
            WHERE id_bicicleta_cliente = %s
              AND es_service_postventa = TRUE
              AND tipo_postventa = 'service_30_dias'
              AND estado NOT IN ('retirada', 'cancelada')
            ORDER BY fecha_ingreso DESC, id DESC
            LIMIT 1
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()
