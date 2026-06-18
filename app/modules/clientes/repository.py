def get_clientes(conn, q=None, solo_activos=False):
    sql = """
        SELECT
            id,
            nombre,
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
                OR COALESCE(dni, '') ILIKE %s
                OR COALESCE(cuit, '') ILIKE %s
                OR COALESCE(razon_social, '') ILIKE %s
            )
        """
        params.extend([q_like, q_like, q_like, q_like, q_like])

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


def insert_cliente(conn, data):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clientes (
                nombre,
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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id
            """,
            (
                data.nombre,
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
                created_at,
                updated_at,
                service_gratis_autorizado_fuera_plazo,
                motivo_service_gratis_fuera_plazo,
                id_usuario_autoriza_service_gratis,
                fecha_autoriza_service_gratis
            FROM bicicletas_clientes
            WHERE id = %s
              AND id_cliente = %s
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
