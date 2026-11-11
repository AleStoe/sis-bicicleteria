from psycopg.rows import dict_row


BASE_SEGUIMIENTO_DETAIL = """
    SELECT
        s.*,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono,
        ur.nombre AS responsable_nombre,
        uc.nombre AS creador_nombre,
        ux.nombre AS resolutor_nombre
    FROM cliente_seguimientos s
    JOIN clientes c ON c.id = s.id_cliente
    JOIN usuarios ur ON ur.id = s.id_usuario_responsable
    JOIN usuarios uc ON uc.id = s.id_usuario_creador
    LEFT JOIN usuarios ux ON ux.id = s.id_usuario_resolucion
"""

BASE_SEGUIMIENTO_SELECT = BASE_SEGUIMIENTO_DETAIL.replace(
    "ux.nombre AS resolutor_nombre",
    "ux.nombre AS resolutor_nombre, COUNT(*) OVER()::int AS total_resultados",
)


def get_responsables_crm(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT u.id, u.nombre, u.username, r.nombre AS rol
            FROM usuarios u
            LEFT JOIN usuario_roles ur ON ur.id_usuario = u.id
            LEFT JOIN roles r ON r.id = ur.id_rol
            WHERE u.activo = TRUE
            ORDER BY u.nombre, u.id
            """
        )
        return cur.fetchall()


def get_usuario_activo_crm(conn, usuario_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, nombre, activo FROM usuarios WHERE id = %s AND activo = TRUE",
            (usuario_id,),
        )
        return cur.fetchone()


def referencia_seguimiento_pertenece_cliente(conn, *, campo, referencia_id, cliente_id):
    referencias = {
        "id_venta": ("ventas", "id_cliente"),
        "id_deuda": ("deudas_cliente", "id_cliente"),
        "id_reserva": ("reservas", "id_cliente"),
        "id_orden_taller": ("ordenes_taller", "id_cliente"),
        "id_bicicleta_cliente": ("bicicletas_clientes", "id_cliente"),
        "id_cotizacion": ("cotizaciones", "id_cliente"),
        "id_caso_postventa": ("postventa_casos", "id_cliente"),
    }
    tabla, campo_cliente = referencias[campo]
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT EXISTS(SELECT 1 FROM {tabla} WHERE id = %s AND {campo_cliente} = %s) AS existe",
            (referencia_id, cliente_id),
        )
        return bool(cur.fetchone()["existe"])


def get_seguimientos_crm(
    conn,
    *,
    hoy,
    bandeja="pendientes",
    id_cliente=None,
    id_usuario_responsable=None,
    q=None,
    limit=50,
    offset=0,
):
    sql = BASE_SEGUIMIENTO_SELECT + " WHERE 1=1"
    params = []

    if id_cliente:
        sql += " AND s.id_cliente = %s"
        params.append(id_cliente)
    if id_usuario_responsable:
        sql += " AND s.id_usuario_responsable = %s"
        params.append(id_usuario_responsable)

    if bandeja == "hoy":
        sql += " AND s.estado = 'pendiente' AND s.fecha_objetivo = %s"
        params.append(hoy)
    elif bandeja == "vencidos":
        sql += " AND s.estado = 'pendiente' AND s.fecha_objetivo < %s"
        params.append(hoy)
    elif bandeja == "proximos":
        sql += " AND s.estado = 'pendiente' AND s.fecha_objetivo > %s"
        params.append(hoy)
    elif bandeja == "cerrados":
        sql += " AND s.estado IN ('realizada', 'cancelada')"
    elif bandeja == "pendientes":
        sql += " AND s.estado = 'pendiente'"

    if q and q.strip():
        termino = f"%{q.strip()}%"
        sql += """
            AND (
                c.nombre ILIKE %s
                OR COALESCE(c.telefono, '') ILIKE %s
                OR s.motivo ILIKE %s
                OR ur.nombre ILIKE %s
            )
        """
        params.extend([termino, termino, termino, termino])

    sql += """
        ORDER BY
            CASE WHEN s.estado = 'pendiente' THEN 0 ELSE 1 END,
            s.fecha_objetivo ASC,
            CASE s.prioridad
                WHEN 'urgente' THEN 0
                WHEN 'alta' THEN 1
                WHEN 'normal' THEN 2
                ELSE 3
            END,
            s.id ASC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_resumen_agenda_crm(conn, *, hoy, id_usuario_responsable=None):
    params = []
    filtro = ""
    if id_usuario_responsable:
        filtro = " AND id_usuario_responsable = %s"
    for _ in range(3):
        params.append(hoy)
        if id_usuario_responsable:
            params.append(id_usuario_responsable)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT
                (SELECT COUNT(*) FROM cliente_seguimientos
                 WHERE estado = 'pendiente' AND fecha_objetivo < %s{filtro})::int AS vencidos,
                (SELECT COUNT(*) FROM cliente_seguimientos
                 WHERE estado = 'pendiente' AND fecha_objetivo = %s{filtro})::int AS hoy,
                (SELECT COUNT(*) FROM cliente_seguimientos
                 WHERE estado = 'pendiente' AND fecha_objetivo > %s{filtro})::int AS proximos
            """,
            params,
        )
        return cur.fetchone()


def get_seguimiento_crm_by_id(conn, seguimiento_id, *, id_cliente=None, for_update=False):
    sql = BASE_SEGUIMIENTO_DETAIL + " WHERE s.id = %s"
    params = [seguimiento_id]
    if id_cliente:
        sql += " AND s.id_cliente = %s"
        params.append(id_cliente)
    if for_update:
        sql += " FOR UPDATE OF s"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def insert_seguimiento_crm(conn, *, cliente_id, data, actor_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO cliente_seguimientos (
                id_cliente, tipo, motivo, fecha_objetivo, prioridad,
                id_usuario_responsable, id_usuario_creador,
                id_venta, id_deuda, id_reserva, id_orden_taller,
                id_bicicleta_cliente, id_cotizacion, id_caso_postventa
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (
                cliente_id,
                data.tipo,
                data.motivo,
                data.fecha_objetivo,
                data.prioridad,
                data.id_usuario_responsable,
                actor_id,
                data.id_venta,
                data.id_deuda,
                data.id_reserva,
                data.id_orden_taller,
                data.id_bicicleta_cliente,
                data.id_cotizacion,
                data.id_caso_postventa,
            ),
        )
        return cur.fetchone()["id"]


def update_seguimiento_crm(conn, seguimiento_id, *, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE cliente_seguimientos
            SET fecha_objetivo = %s,
                id_usuario_responsable = %s,
                prioridad = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                data.fecha_objetivo,
                data.id_usuario_responsable,
                data.prioridad,
                seguimiento_id,
            ),
        )


def close_seguimiento_crm(conn, seguimiento_id, *, data, actor_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE cliente_seguimientos
            SET estado = %s,
                resultado = %s,
                id_usuario_resolucion = %s,
                fecha_resolucion = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (data.estado, data.resultado, actor_id, seguimiento_id),
        )


def insert_evento_seguimiento_crm(
    conn,
    *,
    seguimiento_id,
    tipo_evento,
    actor_id,
    detalle=None,
    anterior=None,
    nuevo=None,
):
    anterior = anterior or {}
    nuevo = nuevo or {}
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cliente_seguimiento_eventos (
                id_seguimiento, tipo_evento, detalle,
                fecha_objetivo_anterior, fecha_objetivo_nueva,
                estado_anterior, estado_nuevo,
                id_usuario_responsable_anterior, id_usuario_responsable_nuevo,
                prioridad_anterior, prioridad_nueva, id_usuario
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                seguimiento_id,
                tipo_evento,
                detalle,
                anterior.get("fecha_objetivo"),
                nuevo.get("fecha_objetivo"),
                anterior.get("estado"),
                nuevo.get("estado"),
                anterior.get("id_usuario_responsable"),
                nuevo.get("id_usuario_responsable"),
                anterior.get("prioridad"),
                nuevo.get("prioridad"),
                actor_id,
            ),
        )


def get_eventos_seguimiento_crm(conn, seguimiento_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT e.*, u.nombre AS usuario_nombre,
                   ua.nombre AS responsable_anterior_nombre,
                   un.nombre AS responsable_nuevo_nombre
            FROM cliente_seguimiento_eventos e
            JOIN usuarios u ON u.id = e.id_usuario
            LEFT JOIN usuarios ua ON ua.id = e.id_usuario_responsable_anterior
            LEFT JOIN usuarios un ON un.id = e.id_usuario_responsable_nuevo
            WHERE e.id_seguimiento = %s
            ORDER BY e.created_at DESC, e.id DESC
            """,
            (seguimiento_id,),
        )
        return cur.fetchall()


def get_oportunidades_crm(
    conn,
    *,
    hoy,
    id_cliente=None,
    tipo=None,
    q=None,
    limit=50,
    offset=0,
):
    sql = """
        WITH oportunidades AS (
            SELECT
                'service'::text AS tipo_oportunidad,
                bc.id_cliente,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                'bicicleta'::text AS referencia_tipo,
                bc.id AS referencia_id,
                COALESCE(NULLIF(bc.numero_cuadro, ''), bc.id::text) AS referencia_codigo,
                bc.fecha_limite_service_gratis::date AS fecha_evidencia,
                CASE WHEN bc.fecha_limite_service_gratis::date < %s THEN 'urgente' ELSE 'alta' END AS prioridad,
                'Service de postventa pendiente'::text AS titulo,
                CONCAT_WS(' · ',
                    NULLIF(TRIM(CONCAT_WS(' ', bc.marca, bc.modelo)), ''),
                    CASE WHEN NULLIF(bc.numero_cuadro, '') IS NOT NULL THEN 'Cuadro ' || bc.numero_cuadro END,
                    'Vence ' || TO_CHAR(bc.fecha_limite_service_gratis, 'DD/MM/YYYY')
                ) AS evidencia,
                'service'::text AS tipo_seguimiento,
                CASE
                    WHEN bc.fecha_limite_service_gratis::date <= %s THEN %s
                    ELSE bc.fecha_limite_service_gratis::date
                END AS fecha_sugerida,
                bc.id AS id_bicicleta_cliente,
                NULL::bigint AS id_reserva,
                NULL::bigint AS id_cotizacion,
                NULL::bigint AS id_caso_postventa
            FROM bicicletas_clientes bc
            JOIN clientes c ON c.id = bc.id_cliente
            WHERE bc.plan_postventa = 'service_30_dias'
              AND bc.service_gratis_usado = FALSE
              AND bc.fecha_limite_service_gratis IS NOT NULL
              AND bc.fecha_limite_service_gratis::date <= %s + 14
              AND NOT EXISTS (
                  SELECT 1 FROM cliente_seguimientos s
                  WHERE s.estado = 'pendiente'
                    AND s.id_bicicleta_cliente = bc.id
                    AND s.tipo IN ('service', 'postventa')
              )
              AND NOT EXISTS (
                  SELECT 1 FROM ordenes_taller ot
                  WHERE ot.id_bicicleta_cliente = bc.id
                    AND ot.es_service_postventa = TRUE
                    AND ot.estado NOT IN ('retirada', 'cancelada')
              )

            UNION ALL

            SELECT
                'cotizacion'::text,
                co.id_cliente,
                c.nombre,
                c.telefono,
                'cotizacion'::text,
                co.id,
                co.numero,
                COALESCE(co.fecha_validez, co.fecha::date),
                CASE
                    WHEN co.estado = 'aceptada' OR (co.fecha_validez IS NOT NULL AND co.fecha_validez < %s) THEN 'alta'
                    ELSE 'normal'
                END,
                CASE WHEN co.tipo = 'reparacion' THEN 'Presupuesto de taller pendiente' ELSE 'Cotizacion pendiente' END,
                CONCAT_WS(' · ',
                    co.numero,
                    'Estado ' || co.estado,
                    CASE WHEN co.fecha_validez IS NOT NULL THEN 'Validez ' || TO_CHAR(co.fecha_validez, 'DD/MM/YYYY') END,
                    'Total $ ' || TO_CHAR(co.total_final, 'FM999G999G999G990D00')
                ),
                'presupuesto'::text,
                %s,
                NULL::bigint,
                NULL::bigint,
                co.id,
                NULL::bigint
            FROM cotizaciones co
            JOIN clientes c ON c.id = co.id_cliente
            WHERE co.id_cliente IS NOT NULL
              AND co.estado IN ('enviada', 'aceptada')
              AND NOT EXISTS (
                  SELECT 1 FROM cliente_seguimientos s
                  WHERE s.estado = 'pendiente' AND s.id_cotizacion = co.id
              )

            UNION ALL

            SELECT
                'reserva'::text,
                r.id_cliente,
                c.nombre,
                c.telefono,
                'reserva'::text,
                r.id,
                r.id::text,
                r.fecha_vencimiento::date,
                CASE WHEN r.fecha_vencimiento::date < %s THEN 'urgente' ELSE 'alta' END,
                'Reserva proxima a vencer'::text,
                CONCAT_WS(' · ',
                    'Reserva #' || r.id,
                    'Vence ' || TO_CHAR(r.fecha_vencimiento, 'DD/MM/YYYY'),
                    'Saldo $ ' || TO_CHAR(r.saldo_estimado, 'FM999G999G999G990D00')
                ),
                'reserva'::text,
                %s,
                NULL::bigint,
                r.id,
                NULL::bigint,
                NULL::bigint
            FROM reservas r
            JOIN clientes c ON c.id = r.id_cliente
            WHERE r.estado = 'activa'
              AND r.fecha_vencimiento IS NOT NULL
              AND r.fecha_vencimiento::date <= %s + 3
              AND NOT EXISTS (
                  SELECT 1 FROM cliente_seguimientos s
                  WHERE s.estado = 'pendiente' AND s.id_reserva = r.id
              )

            UNION ALL

            SELECT
                'postventa'::text,
                pc.id_cliente,
                c.nombre,
                c.telefono,
                'postventa'::text,
                pc.id,
                pc.codigo,
                pc.fecha_apertura::date,
                CASE WHEN pc.prioridad IN ('alta', 'urgente') THEN pc.prioridad ELSE 'normal' END,
                'Caso de postventa abierto'::text,
                CONCAT_WS(' · ', pc.codigo, REPLACE(pc.tipo_caso, '_', ' '), 'Estado ' || pc.estado, pc.motivo_cliente),
                'postventa'::text,
                %s,
                NULL::bigint,
                NULL::bigint,
                NULL::bigint,
                pc.id
            FROM postventa_casos pc
            JOIN clientes c ON c.id = pc.id_cliente
            WHERE pc.estado NOT IN ('cerrado', 'cancelado')
              AND NOT EXISTS (
                  SELECT 1 FROM cliente_seguimientos s
                  WHERE s.estado = 'pendiente' AND s.id_caso_postventa = pc.id
              )
        )
        SELECT *, COUNT(*) OVER()::int AS total_resultados
        FROM oportunidades o
        WHERE (%s::bigint IS NULL OR o.id_cliente = %s)
          AND (%s::text IS NULL OR o.tipo_oportunidad = %s)
          AND (
              %s::text IS NULL
              OR o.cliente_nombre ILIKE %s
              OR COALESCE(o.cliente_telefono, '') ILIKE %s
              OR o.evidencia ILIKE %s
          )
        ORDER BY
            CASE o.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END,
            o.fecha_evidencia,
            o.referencia_id
        LIMIT %s OFFSET %s
    """
    termino = f"%{q.strip()}%" if q and q.strip() else None
    params = [
        hoy, hoy, hoy, hoy,
        hoy, hoy,
        hoy, hoy, hoy,
        hoy,
        id_cliente, id_cliente,
        tipo, tipo,
        termino, termino, termino, termino,
        limit, offset,
    ]
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_contexto_comunicaciones_clientes(conn, cliente_ids):
    if not cliente_ids:
        return {}
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT c.id AS id_cliente,
                   COALESCE(p.estado, 'habilitado') AS preferencia_estado,
                   p.canal_preferido,
                   p.motivo_exclusion,
                   ultima.id AS ultima_comunicacion_id,
                   ultima.canal AS ultimo_canal,
                   ultima.resultado AS ultimo_resultado,
                   ultima.fecha_contacto AS ultima_fecha_contacto
            FROM clientes c
            LEFT JOIN cliente_preferencias_contacto p ON p.id_cliente = c.id
            LEFT JOIN LATERAL (
                SELECT cc.id, cc.canal, cc.resultado, cc.fecha_contacto
                FROM cliente_comunicaciones cc
                WHERE cc.id_cliente = c.id
                ORDER BY cc.fecha_contacto DESC, cc.id DESC
                LIMIT 1
            ) ultima ON TRUE
            WHERE c.id = ANY(%s)
            """,
            (list(cliente_ids),),
        )
        return {int(row["id_cliente"]): row for row in cur.fetchall()}


def get_comunicaciones_cliente(conn, cliente_id, limit=50, offset=0):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT cc.*, u.nombre AS usuario_nombre, u.username AS usuario_username,
                   COUNT(*) OVER()::int AS total_resultados
            FROM cliente_comunicaciones cc
            JOIN usuarios u ON u.id = cc.id_usuario
            WHERE cc.id_cliente = %s
            ORDER BY cc.fecha_contacto DESC, cc.id DESC
            LIMIT %s OFFSET %s
            """,
            (cliente_id, limit, offset),
        )
        return cur.fetchall()


def create_comunicacion_cliente(conn, *, cliente_id, data, actor_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO cliente_comunicaciones (
                id_cliente, id_seguimiento, canal, resultado, mensaje, nota, id_usuario
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                cliente_id,
                data.id_seguimiento,
                data.canal,
                data.resultado,
                data.mensaje,
                data.nota,
                actor_id,
            ),
        )
        return cur.fetchone()


def upsert_preferencia_contacto(conn, *, cliente_id, data, actor_id):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO cliente_preferencias_contacto (
                id_cliente, estado, canal_preferido, motivo_exclusion,
                id_usuario_actualizacion, updated_at
            ) VALUES (%s, %s, %s, %s, %s, now())
            ON CONFLICT (id_cliente) DO UPDATE SET
                estado = EXCLUDED.estado,
                canal_preferido = EXCLUDED.canal_preferido,
                motivo_exclusion = EXCLUDED.motivo_exclusion,
                id_usuario_actualizacion = EXCLUDED.id_usuario_actualizacion,
                updated_at = now()
            RETURNING *
            """,
            (
                cliente_id,
                data.estado,
                data.canal_preferido,
                data.motivo_exclusion if data.estado == "no_contactar" else None,
                actor_id,
            ),
        )
        return cur.fetchone()


def get_resumen_comunicaciones(conn, *, fecha_desde):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                COUNT(*)::int AS contactos,
                COUNT(*) FILTER (WHERE resultado IN ('respondio', 'interesado', 'no_interesado', 'convertido'))::int AS respuestas,
                COUNT(*) FILTER (WHERE resultado = 'interesado')::int AS interesados,
                COUNT(*) FILTER (WHERE resultado = 'convertido')::int AS convertidos,
                COUNT(DISTINCT id_cliente)::int AS clientes_contactados
            FROM cliente_comunicaciones
            WHERE fecha_contacto::date >= %s
            """,
            (fecha_desde,),
        )
        resumen = dict(cur.fetchone())
        cur.execute(
            """
            SELECT COUNT(*)::int AS excluidos
            FROM cliente_preferencias_contacto
            WHERE estado = 'no_contactar'
            """
        )
        resumen["excluidos"] = cur.fetchone()["excluidos"]
        return resumen
