def get_clientes(conn, q=None, solo_activos=False):
    sql = """
        SELECT
            id,
            nombre,
            nombre_persona,
            apellido,
            telefono,
            dni,
            direccion,
            tipo_cliente,
            condicion_iva,
            cuit,
            razon_social,
            notas,
            activo
        FROM clientes
        WHERE 1=1
    """
    params = []

    if solo_activos:
        sql += " AND activo = true"

    if q and q.strip():
        q_like = f"%{q.strip()}%"
        sql += """
            AND (
                nombre ILIKE %s
                OR telefono ILIKE %s
                OR COALESCE(nombre_persona, '') ILIKE %s
                OR COALESCE(apellido, '') ILIKE %s
                OR CONCAT_WS(' ', nombre_persona, apellido) ILIKE %s
                OR COALESCE(dni, '') ILIKE %s
                OR COALESCE(cuit, '') ILIKE %s
                OR COALESCE(razon_social, '') ILIKE %s
            )
        """
        params.extend([
            q_like,
            q_like,
            q_like,
            q_like,
            q_like,
            q_like,
            q_like,
            q_like,
        ])

    sql += " ORDER BY activo DESC, nombre ASC, id ASC"

    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_cliente_by_id(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                nombre,
                nombre_persona,
                apellido,
                telefono,
                dni,
                direccion,
                tipo_cliente,
                condicion_iva,
                cuit,
                razon_social,
                notas,
                activo
            FROM clientes
            WHERE id = %s
            """,
            (cliente_id,),
        )
        return cur.fetchone()


def find_cliente_duplicado_fuerte(conn, data, cliente_id_actual: int | None = None):
    condiciones = []
    params = []

    if data.telefono:
        condiciones.append(
            "regexp_replace(COALESCE(telefono, ''), '\\D', '', 'g') = %s"
        )
        params.append(_solo_digitos(data.telefono))

    if data.dni:
        condiciones.append(
            "regexp_replace(COALESCE(dni, ''), '\\D', '', 'g') = %s"
        )
        params.append(_solo_digitos(data.dni))

    if data.cuit:
        condiciones.append(
            "regexp_replace(COALESCE(cuit, ''), '\\D', '', 'g') = %s"
        )
        params.append(_solo_digitos(data.cuit))

    condiciones = [
        condicion
        for condicion, valor in zip(condiciones, params)
        if valor
    ]
    params = [valor for valor in params if valor]

    if not condiciones:
        return None

    sql = f"""
        SELECT id, nombre, telefono, dni, cuit, activo
        FROM clientes
        WHERE ({' OR '.join(condiciones)})
    """

    if cliente_id_actual is not None:
        sql += " AND id <> %s"
        params.append(cliente_id_actual)

    sql += " ORDER BY activo DESC, id ASC LIMIT 1"

    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def get_clientes_duplicados_resumen(conn):
    with conn.cursor() as cur:
        cur.execute(
            r"""
            WITH base AS (
                SELECT
                    id,
                    nombre,
                    regexp_replace(COALESCE(telefono, ''), '\D', '', 'g') AS telefono_norm,
                    regexp_replace(COALESCE(dni, ''), '\D', '', 'g') AS dni_norm,
                    regexp_replace(COALESCE(cuit, ''), '\D', '', 'g') AS cuit_norm
                FROM clientes
                WHERE id <> 1
            ),
            telefono AS (
                SELECT COUNT(*)::int AS grupos
                FROM (
                    SELECT telefono_norm
                    FROM base
                    WHERE telefono_norm <> ''
                    GROUP BY telefono_norm
                    HAVING COUNT(*) > 1
                ) d
            ),
            dni AS (
                SELECT COUNT(*)::int AS grupos
                FROM (
                    SELECT dni_norm
                    FROM base
                    WHERE dni_norm <> ''
                    GROUP BY dni_norm
                    HAVING COUNT(*) > 1
                ) d
            ),
            cuit AS (
                SELECT COUNT(*)::int AS grupos
                FROM (
                    SELECT cuit_norm
                    FROM base
                    WHERE cuit_norm <> ''
                    GROUP BY cuit_norm
                    HAVING COUNT(*) > 1
                ) d
            ),
            nombre AS (
                SELECT COUNT(*)::int AS grupos
                FROM (
                    SELECT upper(trim(regexp_replace(nombre, '\s+', ' ', 'g'))) AS nombre_norm
                    FROM base
                    WHERE COALESCE(nombre, '') <> ''
                    GROUP BY nombre_norm
                    HAVING COUNT(*) > 1
                ) d
            )
            SELECT
                telefono.grupos AS telefono,
                dni.grupos AS dni,
                cuit.grupos AS cuit,
                nombre.grupos AS nombre_normalizado
            FROM telefono, dni, cuit, nombre
            """
        )
        return cur.fetchone()


def _solo_digitos(value: str | None):
    if not value:
        return None
    return "".join(ch for ch in str(value) if ch.isdigit()) or None


def insert_cliente(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clientes (
                nombre,
                nombre_persona,
                apellido,
                telefono,
                dni,
                direccion,
                tipo_cliente,
                condicion_iva,
                cuit,
                razon_social,
                notas,
                activo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id
            """,
            (
                data.nombre,
                data.nombre_persona,
                data.apellido,
                data.telefono,
                data.dni,
                data.direccion,
                data.tipo_cliente,
                data.condicion_iva,
                data.cuit,
                data.razon_social,
                data.notas,
            ),
        )
        row = cur.fetchone()
        return row["id"]


def update_cliente(conn, cliente_id: int, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clientes
            SET
                nombre = %s,
                nombre_persona = %s,
                apellido = %s,
                telefono = %s,
                dni = %s,
                direccion = %s,
                tipo_cliente = %s,
                condicion_iva = %s,
                cuit = %s,
                razon_social = %s,
                notas = %s,
                activo = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (
                data.nombre,
                data.nombre_persona,
                data.apellido,
                data.telefono,
                data.dni,
                data.direccion,
                data.tipo_cliente,
                data.condicion_iva,
                data.cuit,
                data.razon_social,
                data.notas,
                data.activo,
                cliente_id,
            ),
        )


def desactivar_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clientes
            SET
                activo = false,
                updated_at = now()
            WHERE id = %s
            """,
            (cliente_id,),
        )


def get_ventas_cliente(conn, cliente_id: int, limit=20):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                estado,
                total_final AS total,
                saldo_pendiente
            FROM ventas
            WHERE id_cliente = %s
            ORDER BY fecha DESC, id DESC
            LIMIT %s
            """,
            (cliente_id, limit),
        )
        return cur.fetchall()


def get_historial_cliente_enriquecido(conn, cliente_id: int, limit: int = 50):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                v.id,
                v.fecha,
                v.estado,
                v.total_final AS total,
                v.saldo_pendiente,
                COALESCE(items.cantidad_items, 0)::int AS cantidad_items,
                items.productos_resumen,
                CASE
                    WHEN v.id_orden_taller IS NOT NULL THEN 'taller'
                    WHEN v.id_reserva_origen IS NOT NULL THEN 'reserva'
                    ELSE 'venta'
                END AS origen
            FROM ventas v
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::int AS cantidad_items,
                    (
                        SELECT STRING_AGG(principales.descripcion_snapshot, ' · ')
                        FROM (
                            SELECT vi.descripcion_snapshot
                            FROM venta_items vi
                            WHERE vi.id_venta = v.id
                            ORDER BY vi.id
                            LIMIT 3
                        ) principales
                    ) AS productos_resumen
                FROM venta_items vi_count
                WHERE vi_count.id_venta = v.id
            ) items ON TRUE
            WHERE v.id_cliente = %s
            ORDER BY v.fecha DESC, v.id DESC
            LIMIT %s
            """,
            (cliente_id, limit),
        )
        ventas = cur.fetchall()

        cur.execute(
            """
            SELECT
                p.id,
                p.fecha,
                p.origen_tipo,
                p.origen_id,
                p.medio_pago,
                p.monto_total_cobrado,
                p.monto_base_aplicado,
                p.monto_descuento_aplicado,
                p.monto_recargo_aplicado,
                p.estado,
                p.nota,
                td.cuotas,
                tp.nombre AS tarjeta_plan_nombre,
                CASE
                    WHEN p.origen_tipo = 'venta' THEN p.origen_id
                    WHEN p.origen_tipo = 'deuda_cliente'
                         AND deuda.origen_tipo = 'venta' THEN deuda.origen_id
                    ELSE NULL
                END AS venta_asociada_id
            FROM pagos p
            LEFT JOIN deudas_cliente deuda
                ON p.origen_tipo = 'deuda_cliente'
               AND deuda.id = p.origen_id
            LEFT JOIN pagos_tarjeta_detalle td
                ON td.id_pago = p.id
            LEFT JOIN tarjeta_planes tp
                ON tp.id = td.id_tarjeta_plan
            WHERE p.id_cliente = %s
            ORDER BY p.fecha DESC, p.id DESC
            LIMIT %s
            """,
            (cliente_id, limit),
        )
        pagos = cur.fetchall()

        cur.execute(
            """
            SELECT
                r.id,
                r.fecha_reserva,
                r.fecha_vencimiento,
                r.estado,
                r.sena_total,
                r.saldo_estimado,
                COALESCE(items.cantidad_items, 0)::int AS cantidad_items,
                items.producto_principal
            FROM reservas r
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::int AS cantidad_items,
                    (
                        SELECT CONCAT(p.nombre, ' - ', v.nombre_variante)
                        FROM reserva_items ri_principal
                        JOIN variantes v ON v.id = ri_principal.id_variante
                        JOIN productos p ON p.id = v.id_producto
                        WHERE ri_principal.id_reserva = r.id
                        ORDER BY ri_principal.id
                        LIMIT 1
                    ) AS producto_principal
                FROM reserva_items ri_count
                WHERE ri_count.id_reserva = r.id
            ) items ON TRUE
            WHERE r.id_cliente = %s
            ORDER BY r.fecha_reserva DESC, r.id DESC
            LIMIT %s
            """,
            (cliente_id, limit),
        )
        reservas = cur.fetchall()

        cur.execute(
            """
            SELECT
                d.id,
                d.fecha_origen,
                d.estado,
                d.saldo_actual,
                d.proximo_vencimiento,
                d.origen_tipo,
                d.origen_id,
                CASE
                    WHEN d.origen_tipo = 'venta' THEN d.origen_id
                    ELSE NULL
                END AS venta_asociada_id
            FROM deudas_cliente d
            WHERE d.id_cliente = %s
            ORDER BY d.fecha_origen DESC, d.id DESC
            LIMIT %s
            """,
            (cliente_id, limit),
        )
        deudas = cur.fetchall()

        cur.execute(
            """
            SELECT
                credito.id,
                credito.created_at,
                credito.estado,
                credito.saldo_actual,
                credito.origen_tipo,
                credito.origen_id,
                credito.observacion,
                COALESCE(movimientos.monto_generado, 0) AS monto_generado,
                COALESCE(movimientos.monto_usado, 0) AS monto_usado,
                COALESCE(movimientos.monto_reintegrado, 0) AS monto_reintegrado,
                CASE
                    WHEN credito.origen_tipo = 'venta' THEN credito.origen_id
                    ELSE NULL
                END AS venta_asociada_id
            FROM creditos_cliente credito
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(SUM(monto) FILTER (
                        WHERE tipo_movimiento = 'credito_generado'
                    ), 0) AS monto_generado,
                    COALESCE(SUM(monto) FILTER (
                        WHERE tipo_movimiento = 'aplicacion_a_venta'
                    ), 0) AS monto_usado,
                    COALESCE(SUM(monto) FILTER (
                        WHERE tipo_movimiento = 'reintegro'
                    ), 0) AS monto_reintegrado
                FROM credito_movimientos
                WHERE id_credito = credito.id
            ) movimientos ON TRUE
            WHERE credito.id_cliente = %s
            ORDER BY credito.created_at DESC, credito.id DESC
            LIMIT %s
            """,
            (cliente_id, limit),
        )
        creditos = cur.fetchall()

    return {
        "ventas": ventas,
        "pagos": pagos,
        "reservas": reservas,
        "deudas": deudas,
        "creditos": creditos,
    }


def get_ordenes_taller_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.fecha_terminada,
                ot.fecha_retirada,
                ot.estado,
                ot.problema_reportado,
                ot.observaciones,
                ot.cliente_avisado_retiro,
                ot.fecha_aviso_retiro,
                ot.total_final,
                ot.saldo_pendiente,
                ot.id_venta_generada,
                ot.es_service_postventa,
                ot.tipo_postventa,
                bc.id AS bicicleta_id,
                bc.marca AS bicicleta_marca,
                bc.modelo AS bicicleta_modelo,
                bc.rodado AS bicicleta_rodado,
                bc.color AS bicicleta_color,
                NULLIF(
                    CONCAT_WS(
                        ' ',
                        NULLIF(bc.marca, ''),
                        NULLIF(bc.modelo, ''),
                        CASE
                            WHEN NULLIF(bc.rodado, '') IS NOT NULL
                                THEN 'R' || bc.rodado
                            ELSE NULL
                        END,
                        NULLIF(bc.color, '')
                    ),
                    ''
                ) AS bicicleta_descripcion,
                NULL::text AS diagnostico,
                COALESCE(items.items, '[]'::jsonb) AS items,
                venta.estado AS venta_estado,
                venta.total_final AS venta_total
            FROM ordenes_taller ot
            JOIN bicicletas_clientes bc
                ON bc.id = ot.id_bicicleta_cliente
            LEFT JOIN ventas venta
                ON venta.id = ot.id_venta_generada
            LEFT JOIN LATERAL (
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'id', item.id,
                        'tipo_item', item.tipo_item,
                        'descripcion', item.descripcion_snapshot,
                        'cantidad', item.cantidad,
                        'etapa', item.etapa,
                        'aprobado', item.aprobado,
                        'subtotal', item.subtotal
                    )
                    ORDER BY item.id
                ) FILTER (WHERE item.id IS NOT NULL) AS items
                FROM ordenes_taller_items item
                WHERE item.id_orden_taller = ot.id
                  AND item.etapa <> 'cancelado'
            ) items ON TRUE
            WHERE ot.id_cliente = %s
            ORDER BY ot.fecha_ingreso DESC, ot.id DESC
            """,
            (cliente_id,),
        )
        return cur.fetchall()


def get_resumen_ventas_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE estado IN ('entregada', 'pagada_parcial')
                )::int AS cantidad_ventas,

                COALESCE(
                    SUM(total_final) FILTER (
                        WHERE estado IN ('entregada', 'pagada_parcial')
                    ),
                    0
                )::numeric(14,2) AS total_comprado,

                COALESCE(
                    SUM(saldo_pendiente) FILTER (
                        WHERE estado IN ('entregada', 'pagada_parcial')
                          AND saldo_pendiente > 0
                    ),
                    0
                )::numeric(14,2) AS saldo_pendiente_total,

                MAX(fecha) FILTER (
                    WHERE estado IN ('entregada', 'pagada_parcial')
                ) AS ultima_venta_fecha
            FROM ventas
            WHERE id_cliente = %s
            """,
            (cliente_id,),
        )
        return cur.fetchone()


def activar_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clientes
            SET
                activo = true,
                updated_at = now()
            WHERE id = %s
            """,
            (cliente_id,),
        )


def get_bicicletas_cliente(conn, cliente_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
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
                id_orden_service_gratis,
                service_gratis_autorizado_fuera_plazo,
                motivo_service_gratis_fuera_plazo,
                id_usuario_autoriza_service_gratis,
                fecha_autoriza_service_gratis
            FROM bicicletas_clientes
            WHERE id_cliente = %s
            ORDER BY id DESC
            """,
            (cliente_id,),
        )
        return cur.fetchall()


def insert_bicicleta_cliente(conn, cliente_id: int, data):
    with conn.cursor() as cur:
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
                notas
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                id_cliente,
                id_bicicleta_serializada,
                id_venta_origen,
                marca,
                modelo,
                rodado,
                color,
                numero_cuadro,
                notas
            """,
            (
                cliente_id,
                getattr(data, "id_bicicleta_serializada", None),
                getattr(data, "id_venta_origen", None),
                data.marca,
                data.modelo,
                data.rodado,
                data.color,
                data.numero_cuadro,
                data.notas,
            ),
        )
        return cur.fetchone()


def update_bicicleta_cliente(conn, cliente_id: int, bicicleta_id: int, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_clientes
            SET
                marca = %s,
                modelo = %s,
                rodado = %s,
                color = %s,
                numero_cuadro = %s,
                notas = %s,
                updated_at = now()
            WHERE id = %s
              AND id_cliente = %s
            RETURNING
                id,
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
                id_orden_service_gratis,
                service_gratis_autorizado_fuera_plazo,
                motivo_service_gratis_fuera_plazo,
                id_usuario_autoriza_service_gratis,
                fecha_autoriza_service_gratis
            """,
            (
                data.marca,
                data.modelo,
                data.rodado,
                data.color,
                data.numero_cuadro,
                data.notas,
                bicicleta_id,
                cliente_id,
            ),
        )
        return cur.fetchone()
    
def get_bicicleta_cliente_detalle(conn, cliente_id: int, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                bc.id,
                bc.id_cliente,
                bc.id_bicicleta_serializada,
                bc.id_venta_origen,
                bc.marca,
                bc.modelo,
                bc.rodado,
                bc.color,
                bc.numero_cuadro,
                bc.notas,
                bc.fecha_compra,
                bc.condicion_entrega,
                bc.plan_postventa,
                bc.fecha_limite_service_gratis,
                bc.service_gratis_usado,
                bc.id_orden_service_gratis,
                bc.created_at,
                bc.updated_at,
                bc.service_gratis_autorizado_fuera_plazo,
                bc.motivo_service_gratis_fuera_plazo,
                bc.id_usuario_autoriza_service_gratis,
                bc.fecha_autoriza_service_gratis,
                bs.id_orden_armado_origen,
                bs.costo_fabricacion_final,
                ao.codigo AS codigo_orden_armado
            FROM bicicletas_clientes bc
            LEFT JOIN bicicletas_serializadas bs
                ON bs.id = bc.id_bicicleta_serializada
            LEFT JOIN armado_ordenes ao
                ON ao.id = bs.id_orden_armado_origen
            WHERE bc.id = %s
              AND bc.id_cliente = %s
            """,
            (bicicleta_id, cliente_id),
        )
        return cur.fetchone()


def get_historial_taller_bicicleta_cliente(conn, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha_ingreso,
                estado,
                problema_reportado,
                observaciones,
                fecha_prometida,
                total_final,
                saldo_pendiente
            FROM ordenes_taller
            WHERE id_bicicleta_cliente = %s
            ORDER BY fecha_ingreso DESC, id DESC
            """,
            (bicicleta_id,),
        )
        return cur.fetchall()


def get_notas_tecnicas_bicicleta_cliente(conn, bicicleta_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                n.id,
                n.id_orden_taller,
                n.tipo,
                n.contenido,
                n.estado,
                n.fecha_resolucion,
                n.created_at,
                n.updated_at,
                u.nombre AS usuario_nombre
            FROM ordenes_taller_notas n
            LEFT JOIN usuarios u ON u.id = n.id_usuario_creador
            WHERE n.id_bicicleta_cliente = %s
              AND n.tipo IN ('recomendacion_futura', 'alerta_tecnica')
              AND n.estado <> 'archivada'
            ORDER BY
                CASE n.estado WHEN 'activa' THEN 0 ELSE 1 END,
                n.created_at DESC,
                n.id DESC
            """,
            (bicicleta_id,),
        )
        return cur.fetchall()


def get_venta_origen_bicicleta_cliente(conn, venta_id: int | None):
    if venta_id is None:
        return None

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                fecha,
                estado,
                total_final,
                saldo_pendiente
            FROM ventas
            WHERE id = %s
            """,
            (venta_id,),
        )
        return cur.fetchone()


def get_timeline_bicicleta_cliente(conn, bicicleta_id: int):
    eventos = []

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                bc.created_at AS fecha,
                bc.id,
                bc.marca,
                bc.modelo,
                bc.color,
                bc.numero_cuadro
            FROM bicicletas_clientes bc
            WHERE bc.id = %s
            """,
            (bicicleta_id,),
        )
        bici = cur.fetchone()
        if bici:
            eventos.append(
                {
                    "fecha": bici["fecha"],
                    "tipo": "bicicleta_alta",
                    "titulo": "Bicicleta registrada",
                    "descripcion": " ".join(
                        str(v)
                        for v in [
                            bici.get("marca"),
                            bici.get("modelo"),
                            bici.get("color"),
                            bici.get("numero_cuadro"),
                        ]
                        if v
                    ),
                    "referencia_tipo": "bicicleta_cliente",
                    "referencia_id": bici["id"],
                }
            )

        cur.execute(
            """
            SELECT
                v.fecha,
                v.id,
                v.estado,
                v.total_final,
                v.saldo_pendiente
            FROM ventas v
            JOIN bicicletas_clientes bc ON bc.id_venta_origen = v.id
            WHERE bc.id = %s
            """,
            (bicicleta_id,),
        )
        for venta in cur.fetchall():
            eventos.append(
                {
                    "fecha": venta["fecha"],
                    "tipo": "venta_origen",
                    "titulo": f"Venta #{venta['id']}",
                    "descripcion": f"Estado {venta['estado']}. Total {venta['total_final']}. Saldo {venta['saldo_pendiente']}.",
                    "referencia_tipo": "venta",
                    "referencia_id": venta["id"],
                }
            )

        cur.execute(
            """
            SELECT
                at.id,
                at.created_at,
                at.fecha,
                at.estado,
                at.tipo_turno,
                at.tipo_servicio,
                at.id_orden_taller,
                at.id_venta_origen
            FROM agenda_taller at
            WHERE at.id_bicicleta_cliente = %s
            ORDER BY at.fecha ASC, at.hora_inicio ASC, at.id ASC
            """,
            (bicicleta_id,),
        )
        for turno in cur.fetchall():
            es_postventa = turno["tipo_turno"] == "service_postventa_30_dias"
            descripcion = (
                f"Turno {turno['estado']} para {turno['fecha']}."
                f" Venta origen #{turno['id_venta_origen']}."
                if es_postventa
                else f"Turno {turno['estado']} para {turno['fecha']}."
            )
            if turno["id_orden_taller"]:
                descripcion += f" OT #{turno['id_orden_taller']} generada."

            eventos.append(
                {
                    "fecha": turno["created_at"],
                    "tipo": "service_postventa_agendado" if es_postventa else "turno_taller",
                    "titulo": (
                        "Service postventa agendado"
                        if es_postventa
                        else f"Turno de taller #{turno['id']}"
                    ),
                    "descripcion": descripcion,
                    "referencia_tipo": "turno_agenda",
                    "referencia_id": turno["id"],
                }
            )

        cur.execute(
            """
            SELECT
                ot.id,
                ot.fecha_ingreso,
                ot.estado,
                ot.problema_reportado,
                ot.total_final,
                ot.saldo_pendiente,
                ot.es_service_postventa
            FROM ordenes_taller ot
            WHERE ot.id_bicicleta_cliente = %s
            ORDER BY ot.fecha_ingreso ASC, ot.id ASC
            """,
            (bicicleta_id,),
        )
        ordenes = cur.fetchall()

        for orden in ordenes:
            eventos.append(
                {
                    "fecha": orden["fecha_ingreso"],
                    "tipo": "service_postventa" if orden["es_service_postventa"] else "orden_taller",
                    "titulo": f"OT #{orden['id']} - {orden['estado']}",
                    "descripcion": orden["problema_reportado"],
                    "referencia_tipo": "orden_taller",
                    "referencia_id": orden["id"],
                    "importe": orden["total_final"],
                    "saldo": orden["saldo_pendiente"],
                }
            )

        cur.execute(
            """
            SELECT
                oti.id,
                oti.id_orden_taller,
                ot.fecha_ingreso,
                oti.tipo_item,
                oti.descripcion_snapshot,
                oti.cantidad,
                oti.precio_unitario,
                oti.subtotal,
                oti.etapa
            FROM ordenes_taller_items oti
            JOIN ordenes_taller ot ON ot.id = oti.id_orden_taller
            WHERE ot.id_bicicleta_cliente = %s
              AND oti.etapa <> 'cancelado'
            ORDER BY ot.fecha_ingreso ASC, oti.id ASC
            """,
            (bicicleta_id,),
        )
        for item in cur.fetchall():
            eventos.append(
                {
                    "fecha": item["fecha_ingreso"],
                    "tipo": "repuesto_usado" if item["tipo_item"] == "repuesto" else "servicio_taller",
                    "titulo": item["descripcion_snapshot"],
                    "descripcion": f"OT #{item['id_orden_taller']} · {item['cantidad']} x {item['precio_unitario']} · {item['etapa']}",
                    "referencia_tipo": "orden_taller",
                    "referencia_id": item["id_orden_taller"],
                    "importe": item["subtotal"],
                }
            )

    return sorted(
        eventos,
        key=lambda evento: (evento["fecha"] is None, evento["fecha"] or ""),
        reverse=True,
    )

def autorizar_service_vencido_bicicleta_cliente(
    conn,
    cliente_id: int,
    bicicleta_id: int,
    id_usuario: int,
    motivo: str,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_clientes
            SET
                service_gratis_autorizado_fuera_plazo = true,
                motivo_service_gratis_fuera_plazo = %s,
                id_usuario_autoriza_service_gratis = %s,
                fecha_autoriza_service_gratis = now(),
                updated_at = now()
            WHERE id = %s
              AND id_cliente = %s
            RETURNING
                id,
                id_cliente,
                service_gratis_autorizado_fuera_plazo,
                motivo_service_gratis_fuera_plazo,
                id_usuario_autoriza_service_gratis,
                fecha_autoriza_service_gratis
            """,
            (
                motivo,
                id_usuario,
                bicicleta_id,
                cliente_id,
            ),
        )
        return cur.fetchone()
    
def marcar_service_gratis_utilizado(
    conn,
    bicicleta_id: int,
    orden_id: int,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bicicletas_clientes
            SET
                service_gratis_usado = true,
                id_orden_service_gratis = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (
                orden_id,
                bicicleta_id,
            ),
        )
