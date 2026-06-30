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
                    v.total_final
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
                    COALESCE(SUM(vid.monto_credito_generado), 0) AS monto_devuelto
                FROM ventas_filtradas vf
                INNER JOIN venta_items vi ON vi.id_venta = vf.id
                LEFT JOIN venta_item_devoluciones vid ON vid.id_venta_item = vi.id
                GROUP BY vi.id, vf.id, vi.cantidad, vi.subtotal, vi.costo_unitario_aplicado
            ),
            ventas AS (
                SELECT
                    COALESCE(SUM(total_final), 0)::numeric(14,2) AS ventas_total_final
                FROM ventas_filtradas
            ),
            devoluciones AS (
                SELECT
                    COALESCE(SUM(monto_devuelto), 0)::numeric(14,2) AS devoluciones_total
                FROM items
            ),
            costos AS (
                SELECT
                    COALESCE(SUM(costo_unitario_aplicado * cantidad), 0)::numeric(14,2) AS cmv_bruto,
                    COALESCE(SUM(costo_unitario_aplicado * cantidad_devuelta), 0)::numeric(14,2) AS cmv_devoluciones
                FROM items
            )
            SELECT
                ventas.ventas_total_final AS ventas_brutas,
                devoluciones.devoluciones_total,
                (ventas.ventas_total_final - devoluciones.devoluciones_total)::numeric(14,2) AS ventas_netas,
                costos.cmv_bruto,
                costos.cmv_devoluciones,
                (costos.cmv_bruto - costos.cmv_devoluciones)::numeric(14,2) AS cmv_neto
            FROM ventas
            CROSS JOIN devoluciones
            CROSS JOIN costos
            """,
            (*params[:2], list(VENTA_ESTADOS_REPORTING), *params[2:]),
        )
        return cur.fetchone()


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
                gastos_operativos,
                resultado_distribuible,
                estado,
                id_usuario_cierre,
                observaciones
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
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
