from app.db.connection import get_connection


def get_stock_sucursal(conn):
    

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                s.id AS sucursal_id,
                s.nombre AS sucursal_nombre,
                v.id AS variante_id,
                p.nombre AS producto_nombre,
                v.nombre_variante,
                v.sku,
                ss.stock_fisico,
                ss.stock_reservado,
                ss.stock_vendido_pendiente_entrega,
                (
                    ss.stock_fisico
                    - ss.stock_reservado
                    - ss.stock_vendido_pendiente_entrega
                ) AS stock_disponible
            FROM stock_sucursal ss
            INNER JOIN sucursales s
                ON s.id = ss.id_sucursal
            INNER JOIN variantes v
                ON v.id = ss.id_variante
            INNER JOIN productos p
                ON p.id = v.id_producto
            ORDER BY s.nombre, p.nombre, v.nombre_variante
        """)
        result = cur.fetchall()

    
    return result


def crear_ingreso_stock(data: dict):
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            # 1. validar sucursal
            cur.execute(
                "SELECT id FROM sucursales WHERE id = %s AND activa = TRUE",
                (data["id_sucursal"],),
            )
            sucursal = cur.fetchone()
            if not sucursal:
                raise ValueError("La sucursal no existe o esta inactiva")

            # 2. validar variante
            cur.execute(
                """
                SELECT id, costo_promedio_vigente
                FROM variantes
                WHERE id = %s AND activo = TRUE
                """,
                (data["id_variante"],),
            )
            variante = cur.fetchone()
            if not variante:
                raise ValueError("La variante no existe o esta inactiva")

            # 3. validar proveedor
            cur.execute(
                "SELECT id FROM proveedores WHERE id = %s AND activo = TRUE",
                (data["id_proveedor"],),
            )
            proveedor = cur.fetchone()
            if not proveedor:
                raise ValueError("El proveedor no existe o esta inactivo")

            # 4. validar usuario
            cur.execute(
                "SELECT id FROM usuarios WHERE id = %s AND activo = TRUE",
                (data["id_usuario"],),
            )
            usuario = cur.fetchone()
            if not usuario:
                raise ValueError("El usuario no existe o esta inactivo")

            cantidad_ingresada = float(data["cantidad_ingresada"])
            costo_productos = float(data["costo_productos"])
            gastos_adicionales = float(data.get("gastos_adicionales", 0) or 0)

            costo_total_lote = costo_productos + gastos_adicionales
            costo_unitario_calculado = costo_total_lote / cantidad_ingresada

            # 5. insertar ingreso_stock
            cur.execute(
                """
                INSERT INTO ingresos_stock (
                    id_sucursal,
                    id_variante,
                    id_proveedor,
                    cantidad_ingresada,
                    costo_productos,
                    gastos_adicionales,
                    costo_total_lote,
                    costo_unitario_calculado,
                    origen_ingreso,
                    observacion,
                    id_usuario
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    data["id_sucursal"],
                    data["id_variante"],
                    data["id_proveedor"],
                    cantidad_ingresada,
                    costo_productos,
                    gastos_adicionales,
                    costo_total_lote,
                    costo_unitario_calculado,
                    data.get("origen_ingreso", "manual"),
                    data.get("observacion"),
                    data["id_usuario"],
                ),
            )
            ingreso = cur.fetchone()
            ingreso_id = ingreso["id"]

            # 6. leer stock actual
            cur.execute(
                """
                SELECT stock_fisico
                FROM stock_sucursal
                WHERE id_sucursal = %s AND id_variante = %s
                """,
                (data["id_sucursal"], data["id_variante"]),
            )
            stock_actual = cur.fetchone()

            if stock_actual:
                stock_fisico_anterior = float(stock_actual["stock_fisico"])
                nuevo_stock_fisico = stock_fisico_anterior + cantidad_ingresada

                cur.execute(
                    """
                    UPDATE stock_sucursal
                    SET stock_fisico = %s,
                        updated_at = NOW()
                    WHERE id_sucursal = %s AND id_variante = %s
                    """,
                    (
                        nuevo_stock_fisico,
                        data["id_sucursal"],
                        data["id_variante"],
                    ),
                )
            else:
                stock_fisico_anterior = 0.0
                nuevo_stock_fisico = cantidad_ingresada

                cur.execute(
                    """
                    INSERT INTO stock_sucursal (
                        id_sucursal,
                        id_variante,
                        stock_fisico,
                        stock_reservado,
                        stock_vendido_pendiente_entrega
                    )
                    VALUES (%s, %s, %s, 0, 0)
                    """,
                    (
                        data["id_sucursal"],
                        data["id_variante"],
                        nuevo_stock_fisico,
                    ),
                )

            # 7. recalcular costo promedio vigente
            costo_promedio_anterior = float(variante["costo_promedio_vigente"])
            stock_anterior = stock_fisico_anterior

            if stock_anterior <= 0:
                nuevo_costo_promedio = costo_unitario_calculado
            else:
                nuevo_costo_promedio = (
                    (stock_anterior * costo_promedio_anterior)
                    + (cantidad_ingresada * costo_unitario_calculado)
                ) / (stock_anterior + cantidad_ingresada)

            cur.execute(
                """
                UPDATE variantes
                SET costo_promedio_vigente = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (nuevo_costo_promedio, data["id_variante"]),
            )

            # 8. movimiento de stock
            cur.execute(
                """
                INSERT INTO movimientos_stock (
                    id_sucursal,
                    id_variante,
                    tipo_movimiento,
                    cantidad,
                    costo_unitario_aplicado,
                    origen_tipo,
                    origen_id,
                    nota,
                    id_usuario
                )
                VALUES (%s, %s, 'ingreso', %s, %s, 'ingreso_stock', %s, %s, %s)
                """,
                (
                    data["id_sucursal"],
                    data["id_variante"],
                    cantidad_ingresada,
                    costo_unitario_calculado,
                    ingreso_id,
                    data.get("observacion"),
                    data["id_usuario"],
                ),
            )

        conn.commit()

        return {
            "ok": True,
            "ingreso_id": ingreso_id,
            "id_sucursal": data["id_sucursal"],
            "id_variante": data["id_variante"],
            "cantidad_ingresada": round(cantidad_ingresada, 3),
            "costo_total_lote": round(costo_total_lote, 2),
            "costo_unitario_calculado": round(costo_unitario_calculado, 4),
            "stock_anterior": round(stock_fisico_anterior, 3),
            "stock_nuevo": round(nuevo_stock_fisico, 3),
            "costo_promedio_anterior": round(costo_promedio_anterior, 4),
            "costo_promedio_nuevo": round(nuevo_costo_promedio, 4),
        }

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()