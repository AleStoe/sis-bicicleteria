from decimal import Decimal, ROUND_HALF_UP
from psycopg.rows import dict_row

from app.shared.constants import VENTA_ESTADOS_REPORTING


def get_participante_by_id(conn, participante_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, tipo, activo, observaciones, created_at, updated_at
            FROM capital_participantes
            WHERE id = %s
            """,
            (participante_id,),
        )
        return cur.fetchone()


def insert_regla(conn, nombre: str, descripcion: str | None):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO reglas_distribucion_resultado (nombre, descripcion, activa)
            VALUES (%s, %s, TRUE)
            RETURNING id, nombre, descripcion, activa, created_at, updated_at
            """,
            (nombre, descripcion),
        )
        return cur.fetchone()


def insert_regla_item(conn, regla_id: int, participante_id: int, porcentaje):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO reglas_distribucion_resultado_items (
                id_regla, id_participante, porcentaje, activo
            )
            VALUES (%s, %s, %s, TRUE)
            RETURNING id, id_regla, id_participante, porcentaje, activo
            """,
            (regla_id, participante_id, porcentaje),
        )
        return cur.fetchone()


def get_regla_by_id(conn, regla_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, descripcion, activa, created_at, updated_at
            FROM reglas_distribucion_resultado
            WHERE id = %s
            """,
            (regla_id,),
        )
        return cur.fetchone()


def get_reglas(conn, incluir_inactivas: bool = False):
    with conn.cursor(row_factory=dict_row) as cur:
        if incluir_inactivas:
            cur.execute(
                """
                SELECT id, nombre, descripcion, activa, created_at, updated_at
                FROM reglas_distribucion_resultado
                ORDER BY activa DESC, id DESC
                """
            )
        else:
            cur.execute(
                """
                SELECT id, nombre, descripcion, activa, created_at, updated_at
                FROM reglas_distribucion_resultado
                WHERE activa = TRUE
                ORDER BY id DESC
                """
            )
        return cur.fetchall()


def get_regla_activa(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, nombre, descripcion, activa, created_at, updated_at
            FROM reglas_distribucion_resultado
            WHERE activa = TRUE
            ORDER BY id DESC
            LIMIT 1
            """
        )
        return cur.fetchone()


def get_regla_items(conn, regla_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                ri.id,
                ri.id_regla,
                ri.id_participante,
                cp.nombre AS participante_nombre,
                cp.tipo AS participante_tipo,
                ri.porcentaje,
                ri.activo
            FROM reglas_distribucion_resultado_items ri
            INNER JOIN capital_participantes cp ON cp.id = ri.id_participante
            WHERE ri.id_regla = %s
              AND ri.activo = TRUE
            ORDER BY ri.id
            """,
            (regla_id,),
        )
        return cur.fetchall()


def update_regla_estado(conn, regla_id: int, activa: bool):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE reglas_distribucion_resultado
            SET activa = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id, nombre, descripcion, activa, created_at, updated_at
            """,
            (activa, regla_id),
        )
        return cur.fetchone()


def get_ventas_rentabilidad(conn, fecha_desde, fecha_hasta, id_sucursal=None):
    params = [fecha_desde, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = " AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            WITH ventas_filtradas AS (
                SELECT
                    v.id,
                    v.total_final,
                    v.recargo_total,
                    GREATEST(v.total_final - v.recargo_total, 0) AS total_comercial
                FROM ventas v
                WHERE v.fecha::date >= %s
                  AND v.fecha::date <= %s
                  AND v.estado = ANY(%s)
                  {sucursal_sql}
            ),
            items AS (
                SELECT
                    vi.id,
                    vf.id AS id_venta,
                    vi.cantidad,
                    vi.subtotal,
                    vi.costo_unitario_aplicado,
                    COALESCE(SUM(vid.cantidad_devuelta), 0) AS cantidad_devuelta,
                    COALESCE(SUM(vid.monto_credito_generado), 0) AS monto_devuelto,
                    COALESCE(
                        SUM(vid.monto_credito_generado)
                        * CASE
                            WHEN vf.total_final > 0
                                THEN vf.total_comercial / vf.total_final
                            ELSE 1
                          END,
                        0
                    ) AS monto_devuelto_comercial
                FROM ventas_filtradas vf
                INNER JOIN venta_items vi ON vi.id_venta = vf.id
                LEFT JOIN venta_item_devoluciones vid ON vid.id_venta_item = vi.id
                GROUP BY
                    vi.id,
                    vf.id,
                    vf.total_final,
                    vf.total_comercial,
                    vi.cantidad,
                    vi.subtotal,
                    vi.costo_unitario_aplicado
            ),
            ventas AS (
                SELECT
                    COALESCE(SUM(total_comercial), 0)::numeric(14,2) AS ventas_total_comercial,
                    COALESCE(SUM(recargo_total), 0)::numeric(14,2) AS financiacion_total
                FROM ventas_filtradas
            ),
            pagos_financieros AS (
                SELECT
                    COALESCE(SUM(p.monto_recargo_aplicado), 0)::numeric(14,2)
                        AS financiacion_cobrada,
                    COALESCE(SUM(
                        p.monto_costo_financiero
                    ), 0)::numeric(14,2) AS costos_financieros,
                    COALESCE(SUM(
                        p.monto_neto_liquidado
                    ), 0)::numeric(14,2) AS ingreso_real_neto
                FROM pagos p
                INNER JOIN ventas_filtradas vf
                    ON p.origen_tipo = 'venta'
                   AND p.origen_id = vf.id
                WHERE p.estado = 'confirmado'
            ),
            devoluciones AS (
                SELECT
                    COALESCE(SUM(monto_devuelto_comercial), 0)::numeric(14,2) AS devoluciones_total
                FROM items
            ),
            costos AS (
                SELECT
                    COALESCE(SUM(costo_unitario_aplicado * cantidad), 0)::numeric(14,2) AS cmv_bruto,
                    COALESCE(SUM(costo_unitario_aplicado * cantidad_devuelta), 0)::numeric(14,2) AS cmv_devoluciones
                FROM items
            )
            SELECT
                ventas.ventas_total_comercial AS ventas_brutas,
                ventas.financiacion_total,
                pagos_financieros.financiacion_cobrada,
                pagos_financieros.costos_financieros,
                pagos_financieros.ingreso_real_neto,
                devoluciones.devoluciones_total,
                (
                    ventas.ventas_total_comercial
                    - devoluciones.devoluciones_total
                )::numeric(14,2) AS ventas_netas,
                costos.cmv_bruto,
                costos.cmv_devoluciones,
                (costos.cmv_bruto - costos.cmv_devoluciones)::numeric(14,2) AS cmv_neto
            FROM ventas
            CROSS JOIN pagos_financieros
            CROSS JOIN devoluciones
            CROSS JOIN costos
            """,
            (*params[:2], list(VENTA_ESTADOS_REPORTING), *params[2:]),
        )
        return cur.fetchone()


def get_bonificaciones_garantias(conn, fecha_desde, fecha_hasta, id_sucursal=None):
    params = [fecha_desde, fecha_hasta, list(VENTA_ESTADOS_REPORTING)]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            WITH devoluciones AS (
                SELECT
                    id_venta_item,
                    COALESCE(SUM(cantidad_devuelta), 0) AS cantidad_devuelta
                FROM venta_item_devoluciones
                GROUP BY id_venta_item
            ),
            items_bonificados AS (
                SELECT
                    vi.id,
                    vi.id_venta,
                    v.fecha,
                    v.id_orden_taller,
                    v.id_reserva_origen,
                    c.nombre AS cliente_nombre,
                    u.nombre AS usuario_nombre,
                    vi.descripcion_snapshot,
                    vi.tipo_item,
                    GREATEST(
                        vi.cantidad - COALESCE(d.cantidad_devuelta, 0),
                        0
                    ) AS cantidad_neta,
                    vi.motivo_bonificacion,
                    vi.precio_lista,
                    vi.precio_final,
                    vi.bonificacion_unitaria,
                    vi.costo_unitario_aplicado,
                    v.subtotal_base,
                    v.total_final,
                    v.recargo_total
                FROM venta_items vi
                INNER JOIN ventas v ON v.id = vi.id_venta
                INNER JOIN clientes c ON c.id = v.id_cliente
                INNER JOIN usuarios u ON u.id = v.id_usuario_creador
                LEFT JOIN devoluciones d ON d.id_venta_item = vi.id
                WHERE v.fecha::date >= %s
                  AND v.fecha::date <= %s
                  AND v.estado = ANY(%s)
                  AND vi.bonificacion_unitaria > 0
                  {sucursal_sql}
            )
            SELECT
                id AS id_venta_item,
                id_venta,
                fecha,
                id_orden_taller,
                CASE
                    WHEN id_orden_taller IS NOT NULL THEN 'taller'
                    WHEN id_reserva_origen IS NOT NULL THEN 'reserva'
                    ELSE 'venta'
                END AS origen,
                cliente_nombre,
                usuario_nombre,
                descripcion_snapshot,
                tipo_item,
                cantidad_neta,
                COALESCE(motivo_bonificacion, 'Sin motivo informado') AS motivo_bonificacion,
                ROUND(precio_lista * cantidad_neta, 2)::numeric(14,2) AS valor_lista,
                ROUND(bonificacion_unitaria * cantidad_neta, 2)::numeric(14,2) AS valor_bonificado,
                ROUND(precio_final * cantidad_neta, 2)::numeric(14,2) AS importe_post_bonificacion,
                ROUND(costo_unitario_aplicado * cantidad_neta, 2)::numeric(14,2) AS costo_capital,
                ROUND(
                    CASE
                        WHEN subtotal_base > 0
                            THEN (precio_final * cantidad_neta)
                                * (
                                    GREATEST(total_final - recargo_total, 0)
                                    / subtotal_base
                                  )
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS ingreso_neto_asignado,
                ROUND(
                    CASE
                        WHEN subtotal_base > 0
                            THEN (
                                (precio_final * cantidad_neta) * (total_final / subtotal_base)
                                - (
                                    (precio_final * cantidad_neta)
                                    * (recargo_total / subtotal_base)
                                  )
                            ) - (costo_unitario_aplicado * cantidad_neta)
                        ELSE 0 - (costo_unitario_aplicado * cantidad_neta)
                    END,
                    2
                )::numeric(14,2) AS resultado_economico
            FROM items_bonificados
            WHERE cantidad_neta > 0
            ORDER BY fecha DESC, id DESC
            """,
            params,
        )
        return cur.fetchall()


def get_detalle_rentabilidad_diaria(
    conn,
    fecha,
    id_sucursal=None,
):
    params = [fecha, list(VENTA_ESTADOS_REPORTING)]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = "AND v.id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            WITH devoluciones AS (
                SELECT
                    vid.id_venta_item,
                    COALESCE(SUM(vid.cantidad_devuelta), 0) AS cantidad_devuelta,
                    COALESCE(SUM(vid.monto_credito_generado), 0) AS monto_devuelto
                FROM venta_item_devoluciones vid
                GROUP BY vid.id_venta_item
            ),
            pagos_venta AS (
                SELECT
                    p.origen_id AS id_venta,
                    COALESCE(SUM(p.monto_recargo_aplicado), 0)::numeric(14,2)
                        AS financiacion_cobrada,
                    COALESCE(SUM(
                        p.monto_costo_financiero
                    ), 0)::numeric(14,2) AS costo_financiero,
                    COALESCE(SUM(
                        p.monto_neto_liquidado
                    ), 0)::numeric(14,2) AS ingreso_real_neto,
                    STRING_AGG(
                        DISTINCT CASE
                            WHEN p.medio_pago = 'tarjeta' AND ptd.cuotas IS NOT NULL
                                THEN 'Tarjeta ' || ptd.cuotas || ' cuotas'
                            ELSE INITCAP(REPLACE(p.medio_pago, '_', ' '))
                        END,
                        ', '
                    ) AS medios_pago
                FROM pagos p
                LEFT JOIN pagos_tarjeta_detalle ptd ON ptd.id_pago = p.id
                WHERE p.origen_tipo = 'venta'
                  AND p.estado = 'confirmado'
                GROUP BY p.origen_id
            )
            SELECT
                vi.id AS id_venta_item,
                v.id AS id_venta,
                v.fecha,
                c.nombre AS cliente_nombre,
                v.estado AS estado_venta,
                CASE
                    WHEN v.id_orden_taller IS NOT NULL THEN 'taller'
                    WHEN v.id_reserva_origen IS NOT NULL THEN 'reserva'
                    ELSE 'venta'
                END AS origen,
                vi.tipo_item,
                vi.id_variante,
                vi.id_servicio_taller,
                COALESCE(prod.nombre, st.nombre, vi.descripcion_snapshot) AS producto,
                var.nombre_variante AS variante,
                vi.descripcion_snapshot,
                vi.cantidad,
                COALESCE(d.cantidad_devuelta, 0) AS cantidad_devuelta,
                GREATEST(
                    vi.cantidad - COALESCE(d.cantidad_devuelta, 0),
                    0
                ) AS cantidad_neta,
                vi.precio_lista,
                vi.precio_final,
                ROUND(
                    vi.bonificacion_unitaria
                    * GREATEST(
                        vi.cantidad - COALESCE(d.cantidad_devuelta, 0),
                        0
                      ),
                    2
                )::numeric(14,2) AS bonificacion_total,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN vi.subtotal
                                * (v.descuento_total / v.subtotal_base)
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS descuento_comercial_asignado,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN vi.subtotal
                                * (v.recargo_total / v.subtotal_base)
                                - COALESCE(d.monto_devuelto, 0)
                                  * CASE
                                      WHEN v.total_final > 0
                                          THEN v.recargo_total / v.total_final
                                      ELSE 0
                                    END
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS financiacion_excluida,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN vi.subtotal
                                * (
                                    COALESCE(pv.financiacion_cobrada, 0)
                                    / v.subtotal_base
                                  )
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS financiacion_cobrada,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN vi.subtotal
                                * (
                                    COALESCE(pv.costo_financiero, 0)
                                    / v.subtotal_base
                                  )
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS costo_financiero,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN vi.subtotal
                                * (
                                    COALESCE(pv.ingreso_real_neto, 0)
                                    / v.subtotal_base
                                  )
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS ingreso_real_neto,
                ROUND(
                    COALESCE(d.monto_devuelto, 0)
                    * CASE
                        WHEN v.total_final > 0
                            THEN GREATEST(v.total_final - v.recargo_total, 0)
                                / v.total_final
                        ELSE 1
                      END,
                    2
                )::numeric(14,2) AS devolucion_comercial,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN vi.subtotal
                                * (
                                    GREATEST(v.total_final - v.recargo_total, 0)
                                    / v.subtotal_base
                                  )
                                - COALESCE(d.monto_devuelto, 0)
                                  * CASE
                                      WHEN v.total_final > 0
                                          THEN GREATEST(v.total_final - v.recargo_total, 0)
                                              / v.total_final
                                      ELSE 1
                                    END
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS ingreso_comercial,
                ROUND(
                    vi.costo_unitario_aplicado
                    * GREATEST(
                        vi.cantidad - COALESCE(d.cantidad_devuelta, 0),
                        0
                      ),
                    2
                )::numeric(14,2) AS costo_total,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN (
                                vi.subtotal
                                * (
                                    GREATEST(v.total_final - v.recargo_total, 0)
                                    / v.subtotal_base
                                  )
                                - COALESCE(d.monto_devuelto, 0)
                                  * CASE
                                      WHEN v.total_final > 0
                                          THEN GREATEST(v.total_final - v.recargo_total, 0)
                                              / v.total_final
                                      ELSE 1
                                    END
                              )
                              - (
                                  vi.costo_unitario_aplicado
                                  * GREATEST(
                                      vi.cantidad - COALESCE(d.cantidad_devuelta, 0),
                                      0
                                    )
                                )
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS margen_bruto,
                ROUND(
                    CASE
                        WHEN v.subtotal_base > 0
                            THEN (
                                vi.subtotal
                                * (
                                    GREATEST(v.total_final - v.recargo_total, 0)
                                    / v.subtotal_base
                                  )
                                - COALESCE(d.monto_devuelto, 0)
                                  * CASE
                                      WHEN v.total_final > 0
                                          THEN GREATEST(v.total_final - v.recargo_total, 0)
                                              / v.total_final
                                      ELSE 1
                                    END
                              )
                              - (
                                  vi.costo_unitario_aplicado
                                  * GREATEST(
                                      vi.cantidad - COALESCE(d.cantidad_devuelta, 0),
                                      0
                                    )
                                )
                              + vi.subtotal
                                * (
                                    COALESCE(pv.financiacion_cobrada, 0)
                                    / v.subtotal_base
                                  )
                              - vi.subtotal
                                * (
                                    COALESCE(pv.costo_financiero, 0)
                                    / v.subtotal_base
                                  )
                        ELSE 0
                    END,
                    2
                )::numeric(14,2) AS margen_real,
                COALESCE(pv.medios_pago, 'Sin pago confirmado') AS medios_pago
            FROM venta_items vi
            INNER JOIN ventas v ON v.id = vi.id_venta
            INNER JOIN clientes c ON c.id = v.id_cliente
            LEFT JOIN devoluciones d ON d.id_venta_item = vi.id
            LEFT JOIN variantes var ON var.id = vi.id_variante
            LEFT JOIN productos prod ON prod.id = var.id_producto
            LEFT JOIN servicios_taller st ON st.id = vi.id_servicio_taller
            LEFT JOIN pagos_venta pv ON pv.id_venta = v.id
            WHERE v.fecha::date = %s
              AND v.estado = ANY(%s)
              {sucursal_sql}
            ORDER BY vi.tipo_item, producto, variante, v.fecha, v.id
            """,
            params,
        )
        return cur.fetchall()


def get_gastos_periodo(conn, fecha_desde, fecha_hasta, id_sucursal=None):
    params = [fecha_desde, fecha_hasta]
    sucursal_sql = ""
    if id_sucursal is not None:
        sucursal_sql = " AND id_sucursal = %s"
        params.append(id_sucursal)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT COALESCE(SUM(monto), 0)::numeric(14,2) AS gastos_operativos
            FROM gastos_operativos
            WHERE fecha >= %s
              AND fecha <= %s
              AND estado = 'activo'
              {sucursal_sql}
            """,
            params,
        )
        return cur.fetchone()["gastos_operativos"]


def get_cierre_by_periodo(conn, periodo_mes, id_sucursal=None):
    with conn.cursor(row_factory=dict_row) as cur:
        if id_sucursal is None:
            cur.execute(
                """
                SELECT *
                FROM cierres_rentabilidad
                WHERE periodo_mes = %s
                  AND id_sucursal IS NULL
                """,
                (periodo_mes,),
            )
        else:
            cur.execute(
                """
                SELECT *
                FROM cierres_rentabilidad
                WHERE periodo_mes = %s
                  AND id_sucursal = %s
                """,
                (periodo_mes, id_sucursal),
            )
        return cur.fetchone()


def insert_cierre(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO cierres_rentabilidad (
                periodo_mes,
                fecha_desde,
                fecha_hasta,
                id_sucursal,
                id_regla_distribucion,
                regla_nombre_snapshot,
                ventas_brutas,
                devoluciones_total,
                ventas_netas,
                cmv_bruto,
                cmv_devoluciones,
                cmv_neto,
                margen_bruto,
                financiacion_cobrada,
                costos_financieros,
                resultado_financiero,
                margen_real,
                gastos_operativos,
                resultado_distribuible,
                estado,
                id_usuario_cierre,
                observaciones
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                'cerrado', %s, %s
            )
            RETURNING *
            """,
            (
                data["periodo_mes"],
                data["fecha_desde"],
                data["fecha_hasta"],
                data.get("id_sucursal"),
                data.get("id_regla_distribucion"),
                data.get("regla_nombre_snapshot"),
                data["ventas_brutas"],
                data["devoluciones_total"],
                data["ventas_netas"],
                data["cmv_bruto"],
                data["cmv_devoluciones"],
                data["cmv_neto"],
                data["margen_bruto"],
                data["financiacion_cobrada"],
                data["costos_financieros"],
                data["resultado_financiero"],
                data["margen_real"],
                data["gastos_operativos"],
                data["resultado_distribuible"],
                data["id_usuario_cierre"],
                data.get("observaciones"),
            ),
        )
        return cur.fetchone()


def insert_cierre_distribucion(conn, cierre_id: int, item: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO cierres_rentabilidad_distribuciones (
                id_cierre,
                id_participante,
                participante_nombre_snapshot,
                participante_tipo_snapshot,
                porcentaje,
                monto
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                cierre_id,
                item.get("id_participante"),
                item["participante_nombre"],
                item.get("participante_tipo"),
                item["porcentaje"],
                item["monto"],
            ),
        )
        return cur.fetchone()


def get_cierres(conn, limit: int = 100, offset: int = 0):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM cierres_rentabilidad
            ORDER BY periodo_mes DESC, id DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        )
        return cur.fetchall()


def get_cierre_by_id(conn, cierre_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM cierres_rentabilidad
            WHERE id = %s
            """,
            (cierre_id,),
        )
        return cur.fetchone()


def get_cierre_distribuciones(conn, cierre_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM cierres_rentabilidad_distribuciones
            WHERE id_cierre = %s
            ORDER BY id
            """,
            (cierre_id,),
        )
        return cur.fetchall()


def distribuir_monto(resultado, items):
    resultado = Decimal(str(resultado or 0))
    if resultado <= Decimal("0"):
        return [
            {
                "id_participante": i["id_participante"],
                "participante_nombre": i["participante_nombre"],
                "participante_tipo": i["participante_tipo"],
                "porcentaje": i["porcentaje"],
                "monto": Decimal("0.00"),
            }
            for i in items
        ]

    distribuciones = []
    acumulado = Decimal("0.00")
    for idx, item in enumerate(items):
        if idx == len(items) - 1:
            monto = resultado - acumulado
        else:
            monto = (resultado * Decimal(str(item["porcentaje"])) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            acumulado += monto
        distribuciones.append(
            {
                "id_participante": item["id_participante"],
                "participante_nombre": item["participante_nombre"],
                "participante_tipo": item["participante_tipo"],
                "porcentaje": item["porcentaje"],
                "monto": monto,
            }
        )
    return distribuciones
