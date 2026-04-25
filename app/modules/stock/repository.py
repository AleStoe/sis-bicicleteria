from app.db.connection import get_connection


# =========================================================
# CONSULTAS
# =========================================================

def get_stock_sucursal(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
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
            """
        )
        return cur.fetchall()


def obtener_stock_disponible(conn, id_sucursal: int, id_variante: int) -> float:
    stock = obtener_stock_actual(conn, id_sucursal, id_variante)
    return float(stock["stock_disponible"])


def obtener_stock_actual(conn, id_sucursal: int, id_variante: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega,
                (
                    stock_fisico
                    - stock_reservado
                    - stock_vendido_pendiente_entrega
                ) AS stock_disponible
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (id_sucursal, id_variante),
        )
        row = cur.fetchone()

    if row:
        return row

    return {
        "id_sucursal": id_sucursal,
        "id_variante": id_variante,
        "stock_fisico": 0.0,
        "stock_reservado": 0.0,
        "stock_vendido_pendiente_entrega": 0.0,
        "stock_disponible": 0.0,
    }


def obtener_stock_actual_para_update(conn, id_sucursal: int, id_variante: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega,
                (
                    stock_fisico
                    - stock_reservado
                    - stock_vendido_pendiente_entrega
                ) AS stock_disponible
            FROM stock_sucursal
            WHERE id_sucursal = %s
              AND id_variante = %s
            FOR UPDATE
            """,
            (id_sucursal, id_variante),
        )
        row = cur.fetchone()

    if row:
        return row

    return None


# =========================================================
# VALIDACIONES BASE
# =========================================================

def validar_sucursal_activa(conn, id_sucursal: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM sucursales WHERE id = %s AND activa = TRUE",
            (id_sucursal,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("La sucursal no existe o está inactiva")


def validar_variante_activa(conn, id_variante: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, costo_promedio_vigente
            FROM variantes
            WHERE id = %s AND activo = TRUE
            """,
            (id_variante,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("La variante no existe o está inactiva")

    return row


def validar_proveedor_activo(conn, id_proveedor: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM proveedores WHERE id = %s AND activo = TRUE",
            (id_proveedor,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El proveedor no existe o está inactivo")


def validar_usuario_activo(conn, id_usuario: int):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM usuarios WHERE id = %s AND activo = TRUE",
            (id_usuario,),
        )
        row = cur.fetchone()

    if not row:
        raise ValueError("El usuario no existe o está inactivo")


# =========================================================
# HELPERS INTERNOS DE STOCK
# =========================================================

def asegurar_stock_sucursal_para_update(conn, id_sucursal: int, id_variante: int):
    """
    Devuelve la fila de stock bloqueada con FOR UPDATE.
    Si no existe, la crea en cero y la vuelve a leer bloqueada.
    """
    row = obtener_stock_actual_para_update(conn, id_sucursal, id_variante)
    if row:
        return row

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO stock_sucursal (
                id_sucursal,
                id_variante,
                stock_fisico,
                stock_reservado,
                stock_vendido_pendiente_entrega
            )
            VALUES (%s, %s, 0, 0, 0)
            ON CONFLICT (id_sucursal, id_variante) DO NOTHING
            """,
            (id_sucursal, id_variante),
        )

    row = obtener_stock_actual_para_update(conn, id_sucursal, id_variante)
    if not row:
        raise ValueError("No se pudo inicializar stock_sucursal")

    return row


def actualizar_stock_sucursal(
    conn,
    id_sucursal: int,
    id_variante: int,
    nuevo_stock_fisico: float,
    nuevo_stock_reservado: float,
    nuevo_stock_vendido_pendiente_entrega: float,
):
    if nuevo_stock_fisico < 0:
        raise ValueError("stock_fisico no puede quedar negativo")
    if nuevo_stock_reservado < 0:
        raise ValueError("stock_reservado no puede quedar negativo")
    if nuevo_stock_vendido_pendiente_entrega < 0:
        raise ValueError("stock_vendido_pendiente_entrega no puede quedar negativo")

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stock_sucursal
            SET
                stock_fisico = %s,
                stock_reservado = %s,
                stock_vendido_pendiente_entrega = %s,
                updated_at = NOW()
            WHERE id_sucursal = %s
              AND id_variante = %s
            """,
            (
                nuevo_stock_fisico,
                nuevo_stock_reservado,
                nuevo_stock_vendido_pendiente_entrega,
                id_sucursal,
                id_variante,
            ),
        )


def registrar_movimiento_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    tipo_movimiento: str,
    cantidad: float,
    id_usuario: int,
    costo_unitario_aplicado: float | None = None,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    if cantidad <= 0:
        raise ValueError("La cantidad del movimiento debe ser mayor a 0")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO movimientos_stock (
                id_sucursal,
                id_variante,
                id_bicicleta_serializada,
                tipo_movimiento,
                cantidad,
                costo_unitario_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                id_sucursal,
                id_variante,
                id_bicicleta_serializada,
                tipo_movimiento,
                cantidad,
                costo_unitario_aplicado,
                origen_tipo,
                origen_id,
                nota,
                id_usuario,
            ),
        )
        row = cur.fetchone()

    return row["id"]

def _calcular_stock_nuevo(
    *,
    stock_fisico_actual: float,
    stock_reservado_actual: float,
    stock_pendiente_actual: float,
    delta_fisico: float = 0,
    delta_reservado: float = 0,
    delta_pendiente_entrega: float = 0,
):
    nuevo_stock_fisico = stock_fisico_actual + float(delta_fisico)
    nuevo_stock_reservado = stock_reservado_actual + float(delta_reservado)
    nuevo_stock_pendiente = stock_pendiente_actual + float(delta_pendiente_entrega)

    stock_disponible_nuevo = (
        nuevo_stock_fisico - nuevo_stock_reservado - nuevo_stock_pendiente
    )

    return {
        "stock_fisico_nuevo": nuevo_stock_fisico,
        "stock_reservado_nuevo": nuevo_stock_reservado,
        "stock_pendiente_nuevo": nuevo_stock_pendiente,
        "stock_disponible_nuevo": stock_disponible_nuevo,
    }


def _validar_saldos_no_negativos(
    *,
    nuevo_stock_fisico: float,
    nuevo_stock_reservado: float,
    nuevo_stock_pendiente: float,
):
    if nuevo_stock_fisico < 0:
        raise ValueError("No hay stock físico suficiente")

    if nuevo_stock_reservado < 0:
        raise ValueError("No hay stock reservado suficiente")

    if nuevo_stock_pendiente < 0:
        raise ValueError("No hay stock pendiente de entrega suficiente")


def _validar_stock_disponible_no_negativo(*, stock_disponible_nuevo: float):
    if stock_disponible_nuevo < 0:
        raise ValueError("No hay stock disponible suficiente")

def _validar_consistencia_tipo_y_origen_stock(
    *,
    tipo_movimiento: str,
    origen_tipo: str | None,
):
    if tipo_movimiento == "devolucion" and origen_tipo == "venta":
        raise ValueError(
            "No usar 'devolucion' para ventas. Usar 'devolucion_venta'."
        )

    if tipo_movimiento == "devolucion_venta" and origen_tipo != "venta":
        raise ValueError(
            "'devolucion_venta' solo puede usarse con origen_tipo='venta'."
        )

def _aplicar_operacion_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    id_usuario: int,
    tipo_movimiento: str,
    cantidad: float,
    delta_fisico: float = 0,
    delta_reservado: float = 0,
    delta_pendiente_entrega: float = 0,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
    costo_unitario_aplicado: float | None = None,
    validar_stock_disponible: bool = True,
):
    if cantidad <= 0:
        raise ValueError("La cantidad debe ser mayor a 0")
    
    _validar_consistencia_tipo_y_origen_stock(
        tipo_movimiento=tipo_movimiento,
        origen_tipo=origen_tipo,
    )
    validar_sucursal_activa(conn, id_sucursal)
    validar_variante_activa(conn, id_variante)
    validar_usuario_activo(conn, id_usuario)

    actual = asegurar_stock_sucursal_para_update(conn, id_sucursal, id_variante)

    stock_fisico_actual = float(actual["stock_fisico"])
    stock_reservado_actual = float(actual["stock_reservado"])
    stock_pendiente_actual = float(actual["stock_vendido_pendiente_entrega"])

    calculo = _calcular_stock_nuevo(
        stock_fisico_actual=stock_fisico_actual,
        stock_reservado_actual=stock_reservado_actual,
        stock_pendiente_actual=stock_pendiente_actual,
        delta_fisico=delta_fisico,
        delta_reservado=delta_reservado,
        delta_pendiente_entrega=delta_pendiente_entrega,
    )

    nuevo_stock_fisico = calculo["stock_fisico_nuevo"]
    nuevo_stock_reservado = calculo["stock_reservado_nuevo"]
    nuevo_stock_pendiente = calculo["stock_pendiente_nuevo"]
    stock_disponible_nuevo = calculo["stock_disponible_nuevo"]

    _validar_saldos_no_negativos(
        nuevo_stock_fisico=nuevo_stock_fisico,
        nuevo_stock_reservado=nuevo_stock_reservado,
        nuevo_stock_pendiente=nuevo_stock_pendiente,
    )

    if validar_stock_disponible:
        _validar_stock_disponible_no_negativo(
            stock_disponible_nuevo=stock_disponible_nuevo
        )

    actualizar_stock_sucursal(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        nuevo_stock_fisico=nuevo_stock_fisico,
        nuevo_stock_reservado=nuevo_stock_reservado,
        nuevo_stock_vendido_pendiente_entrega=nuevo_stock_pendiente,
    )

    movimiento_id = registrar_movimiento_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        tipo_movimiento=tipo_movimiento,
        cantidad=cantidad,
        costo_unitario_aplicado=costo_unitario_aplicado,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,
        nota=nota,
        id_usuario=id_usuario,
    )

    return {
        "ok": True,
        "movimiento_id": movimiento_id,
        "id_sucursal": id_sucursal,
        "id_variante": id_variante,
        "tipo_movimiento": tipo_movimiento,
        "cantidad": round(float(cantidad), 3),
        "stock_fisico_anterior": round(stock_fisico_actual, 3),
        "stock_reservado_anterior": round(stock_reservado_actual, 3),
        "stock_vendido_pendiente_entrega_anterior": round(stock_pendiente_actual, 3),
        "stock_fisico_nuevo": round(nuevo_stock_fisico, 3),
        "stock_reservado_nuevo": round(nuevo_stock_reservado, 3),
        "stock_vendido_pendiente_entrega_nuevo": round(nuevo_stock_pendiente, 3),
        "stock_disponible_nuevo": round(stock_disponible_nuevo, 3),
    }
# =========================================================
# OPERACIONES CENTRALES DE STOCK
# =========================================================

def reservar_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    nota: str | None = None,
):
    """
    Reserva stock disponible.
    Efecto:
    - stock_reservado += cantidad
    - stock_fisico no cambia
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="reserva",
        cantidad=cantidad,
        delta_reservado=+cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


def liberar_stock_reservado(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    nota: str | None = None,
):
    """
    Libera stock previamente reservado.
    Efecto:
    - stock_reservado -= cantidad
    - stock_fisico no cambia
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="cancelacion_reserva",
        cantidad=cantidad,
        delta_reservado=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


def marcar_stock_pendiente_entrega(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    descontar_de_reservado: bool = False,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Marca stock vendido pendiente de entrega.

    Caso 1: venta desde stock disponible
    - stock_vendido_pendiente_entrega += cantidad

    Caso 2: venta de algo ya reservado
    - stock_reservado -= cantidad
    - stock_vendido_pendiente_entrega += cantidad

    NO baja stock_fisico todavía.
    """
    delta_reservado = -cantidad if descontar_de_reservado else 0

    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="venta",
        cantidad=cantidad,
        delta_reservado=delta_reservado,
        delta_pendiente_entrega=+cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
        id_bicicleta_serializada=id_bicicleta_serializada,
    )


def descontar_stock_por_venta(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    descontar_de_reservado: bool = False,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    nota: str | None = None,
):
    """
    Venta con entrega inmediata.

    Caso 1: venta directa
    - stock_fisico -= cantidad

    Caso 2: venta de algo reservado
    - stock_reservado -= cantidad
    - stock_fisico -= cantidad

    NO usa pendiente_entrega.
    """
    delta_reservado = -cantidad if descontar_de_reservado else 0

    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="venta",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        delta_reservado=delta_reservado,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


def registrar_entrega_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Entrega de stock ya vendido y pendiente de entrega.
    Efecto:
    - stock_vendido_pendiente_entrega -= cantidad
    - stock_fisico -= cantidad
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="entrega",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        delta_pendiente_entrega=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
        validar_stock_disponible=False,
        id_bicicleta_serializada=id_bicicleta_serializada,
    )


def devolver_stock_a_disponible_desde_pendiente(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Revierte una venta pendiente antes de la entrega.
    Efecto:
    - stock_vendido_pendiente_entrega -= cantidad
    - stock_fisico no cambia
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="cancelacion_venta",
        cantidad=cantidad,
        delta_pendiente_entrega=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,
        nota=nota,
    )

def registrar_devolucion_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    """
    Devuelve unidades al stock físico por devolución de venta.

    IMPORTANTE:
    - Usa tipo_movimiento='devolucion_venta'
    - NO usar 'devolucion' para ventas (rompe trazabilidad)
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="devolucion_venta",  # ← FIX CLAVE
        cantidad=cantidad,
        delta_fisico=+cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,  # ← IMPORTANTE
        nota=nota,
    )


def registrar_salida_taller(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_id: int,
    origen_tipo: str = "orden_taller",
    nota: str | None = None,
):
    """
    Consume stock físico para uso interno / taller.
    Efecto:
    - stock_fisico -= cantidad
    """
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="uso_taller",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
    )


# =========================================================
# INGRESO DE STOCK
# =========================================================

def crear_ingreso_stock(conn, data: dict):
    """
    Mantiene el comportamiento actual:
    - inserta ingreso_stock
    - sube stock_fisico
    - recalcula costo promedio
    - registra movimiento 'ingreso'

    NO hace commit.
    """

    validar_sucursal_activa(conn, data["id_sucursal"])
    variante = validar_variante_activa(conn, data["id_variante"])
    validar_proveedor_activo(conn, data["id_proveedor"])
    validar_usuario_activo(conn, data["id_usuario"])

    cantidad_ingresada = float(data["cantidad_ingresada"])
    costo_productos = float(data["costo_productos"])
    gastos_adicionales = float(data.get("gastos_adicionales", 0) or 0)

    if cantidad_ingresada <= 0:
        raise ValueError("La cantidad ingresada debe ser mayor a 0")

    costo_total_lote = costo_productos + gastos_adicionales
    costo_unitario_calculado = costo_total_lote / cantidad_ingresada

    with conn.cursor() as cur:
        # 1. insertar cabecera de ingreso
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

    # 2. bloquear / asegurar fila de stock
    stock = asegurar_stock_sucursal_para_update(
        conn,
        data["id_sucursal"],
        data["id_variante"],
    )

    stock_fisico_anterior = float(stock["stock_fisico"])
    stock_reservado_actual = float(stock["stock_reservado"])
    stock_pendiente_actual = float(stock["stock_vendido_pendiente_entrega"])

    nuevo_stock_fisico = stock_fisico_anterior + cantidad_ingresada

    actualizar_stock_sucursal(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        nuevo_stock_fisico=nuevo_stock_fisico,
        nuevo_stock_reservado=stock_reservado_actual,
        nuevo_stock_vendido_pendiente_entrega=stock_pendiente_actual,
    )

    # 3. recalcular costo promedio vigente
    costo_promedio_anterior = float(variante["costo_promedio_vigente"] or 0)
    stock_anterior = stock_fisico_anterior

    if stock_anterior <= 0:
        nuevo_costo_promedio = costo_unitario_calculado
    else:
        nuevo_costo_promedio = (
            (stock_anterior * costo_promedio_anterior)
            + (cantidad_ingresada * costo_unitario_calculado)
        ) / (stock_anterior + cantidad_ingresada)

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE variantes
            SET costo_promedio_vigente = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (nuevo_costo_promedio, data["id_variante"]),
        )

    # 4. movimiento
    registrar_movimiento_stock(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        tipo_movimiento="ingreso",
        cantidad=cantidad_ingresada,
        costo_unitario_aplicado=costo_unitario_calculado,
        origen_tipo="ingreso_stock",
        origen_id=ingreso_id,
        nota=data.get("observacion"),
        id_usuario=data["id_usuario"],
    )

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

def registrar_salida_por_serializacion(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_tipo: str | None = None,
    origen_id: int | None = None,
    id_bicicleta_serializada: int | None = None,
    nota: str | None = None,
):
    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="serializacion",
        cantidad=cantidad,
        delta_fisico=-cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        id_bicicleta_serializada=id_bicicleta_serializada,
        nota=nota,
    )

def registrar_ajuste_manual_stock(
    conn,
    *,
    id_sucursal: int,
    id_variante: int,
    cantidad: float,
    id_usuario: int,
    origen_tipo: str | None = "ajuste_manual",
    origen_id: int | None = None,
    nota: str | None = None,
):
    if cantidad == 0:
        raise ValueError("La cantidad del ajuste no puede ser 0")

    if origen_id is None:
        origen_id = 0

    return _aplicar_operacion_stock(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
        id_usuario=id_usuario,
        tipo_movimiento="ajuste",
        cantidad=abs(cantidad),
        delta_fisico=cantidad,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        nota=nota,
        validar_stock_disponible=True,
    )