from app.db.connection import get_connection
from app.modules.stock import repository
from app.modules.auditoria import service as auditoria_service

from app.shared.money import to_decimal
# =========================================================
# HELPERS
# =========================================================

def _manejar_error_transaccional(conn, exc: Exception):
    if conn:
        conn.rollback()
    raise exc


# =========================================================
# CONSULTAS (READ ONLY)
# =========================================================

def listar_stock():
    conn = get_connection()
    try:
        return repository.get_stock_sucursal(conn)
    finally:
        conn.close()


def obtener_stock_disponible(id_sucursal: int, id_variante: int):
    conn = get_connection()
    try:
        stock_disponible = repository.obtener_stock_disponible(
            conn,
            id_sucursal=id_sucursal,
            id_variante=id_variante,
        )

        return {
            "id_sucursal": id_sucursal,
            "id_variante": id_variante,
            "stock_disponible": to_decimal(stock_disponible),
        }
    finally:
        conn.close()

def obtener_stock_disponible_tx(conn, id_sucursal: int, id_variante: int):
    stock = repository.obtener_stock_actual(
        conn,
        id_sucursal=id_sucursal,
        id_variante=id_variante,
    )

    return {
        "id_sucursal": id_sucursal,
        "id_variante": id_variante,
        "stock_disponible": to_decimal(stock["stock_disponible"]),
    }

def obtener_stock_actual(id_sucursal: int, id_variante: int):
    conn = get_connection()
    try:
        stock = repository.obtener_stock_actual(
            conn,
            id_sucursal=id_sucursal,
            id_variante=id_variante,
        )

        return {
            "id_sucursal": stock["id_sucursal"],
            "id_variante": stock["id_variante"],
            "stock_fisico": to_decimal(stock["stock_fisico"]),
            "stock_reservado": to_decimal(stock["stock_reservado"]),
            "stock_vendido_pendiente_entrega": to_decimal(
                stock["stock_vendido_pendiente_entrega"]
            ),
            "stock_disponible": to_decimal(stock["stock_disponible"]),
        }
    finally:
        conn.close()


# =========================================================
# INGRESOS (TRANSACCIONAL EXTERNO)
# =========================================================

def registrar_ingreso_stock(conn, data: dict):
    """
    NO maneja commit.
    Debe usarse dentro de una transacción externa.
    """
    return repository.crear_ingreso_stock(conn, data)


# =========================================================
# OPERACIONES CENTRALES DE STOCK (SIN COMMIT)
# =========================================================

def reservar_stock(conn, data: dict):
    return repository.reservar_stock(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        origen_tipo=data.get("origen_tipo"),
        origen_id=data.get("origen_id"),
        nota=data.get("nota"),
    )


def liberar_stock_reservado(conn, data: dict):
    return repository.liberar_stock_reservado(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        origen_tipo=data.get("origen_tipo"),
        origen_id=data.get("origen_id"),
        nota=data.get("nota"),
    )


def marcar_stock_pendiente_entrega(conn, data: dict):
    return repository.marcar_stock_pendiente_entrega(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        descontar_de_reservado=data.get("descontar_de_reservado", False),
        origen_tipo=data.get("origen_tipo"),
        origen_id=data.get("origen_id"),
        id_bicicleta_serializada=data.get("id_bicicleta_serializada"),
        nota=data.get("nota"),
    )



def descontar_stock_por_venta(conn, data: dict):
    return repository.descontar_stock_por_venta(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        descontar_de_reservado=data.get("descontar_de_reservado", False),
        origen_tipo=data.get("origen_tipo"),
        origen_id=data.get("origen_id"),
        nota=data.get("nota"),
    )


def registrar_entrega_stock(conn, data: dict):
    return repository.registrar_entrega_stock(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        origen_tipo=data.get("origen_tipo"),
        origen_id=data.get("origen_id"),
        id_bicicleta_serializada=data.get("id_bicicleta_serializada"),
        nota=data.get("nota"),
    )


def devolver_stock_a_disponible_desde_pendiente(conn, data: dict):
    return repository.devolver_stock_a_disponible_desde_pendiente(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        origen_tipo=data.get("origen_tipo"),
        origen_id=data.get("origen_id"),
        id_bicicleta_serializada=data.get("id_bicicleta_serializada"),
        nota=data.get("nota"),
    )


def registrar_devolucion_stock(conn, data: dict):
    return repository.registrar_devolucion_stock(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        origen_tipo=data.get("origen_tipo"),
        origen_id=data.get("origen_id"),
        nota=data.get("nota"),
    )


def registrar_salida_taller(conn, data: dict):
    if "origen_id" not in data or data["origen_id"] is None:
        raise ValueError("origen_id es obligatorio para salida de taller")

    return repository.registrar_salida_taller(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        origen_tipo="orden_taller",
        origen_id=data["origen_id"],
        nota=data.get("nota"),
    )

def registrar_salida_por_serializacion(conn, data: dict):
    if "origen_id" not in data or data["origen_id"] is None:
        raise ValueError("origen_id es obligatorio para salida por serialización")

    return repository.registrar_salida_por_serializacion(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        cantidad=data["cantidad"],
        id_usuario=data["id_usuario"],
        origen_tipo="bicicleta_serializada",
        origen_id=data["origen_id"],
        id_bicicleta_serializada=data.get("id_bicicleta_serializada"),
        nota=data.get("nota"),
    )
def crear_ingreso_stock(data: dict):
    conn = get_connection()
    try:
        with conn.transaction():
            return repository.crear_ingreso_stock(conn, data)
    finally:
        conn.close()


def crear_ajuste_stock(data: dict):
    conn = get_connection()
    try:
        with conn.transaction():
            cantidad = to_decimal(data["cantidad"])

            if cantidad == 0:
                raise ValueError("La cantidad del ajuste no puede ser 0")

            nota = data.get("nota")
            if not nota or not str(nota).strip():
                raise ValueError("El ajuste manual requiere motivo")

            origen_id = data.get("origen_id")
            if origen_id is None:
                origen_id = 0

            resultado = repository.registrar_ajuste_manual_stock(
                conn,
                id_sucursal=data["id_sucursal"],
                id_variante=data["id_variante"],
                cantidad=cantidad,
                id_usuario=data["id_usuario"],
                origen_tipo=data.get("origen_tipo", "ajuste_manual"),
                origen_id=origen_id,
                nota=nota,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data["id_usuario"],
                id_sucursal=data["id_sucursal"],
                entidad="stock",
                entidad_id=data["id_variante"],
                accion="ajuste_stock",
                detalle=(
                    f"Ajuste manual de stock. "
                    f"movimiento_id={resultado['movimiento_id']}, "
                    f"cantidad={cantidad}, "
                    f"motivo={nota}"
                ),
                metadata={
                    "tipo": "stock_ajuste",
                    "movimiento_id": resultado["movimiento_id"],
                    "id_variante": data["id_variante"],
                    "id_sucursal": data["id_sucursal"],
                    "cantidad": str(cantidad),
                    "motivo": nota,
                    "origen_tipo": data.get("origen_tipo", "ajuste_manual"),
                    "origen_id": data.get("origen_id") or 0,
                },
                origen_tipo="movimiento_stock",
                origen_id=resultado["movimiento_id"],
            )

            return resultado
    finally:
        conn.close()

def registrar_movimiento_serializada_sin_stock(conn, data: dict):
    return repository.registrar_movimiento_serializada_sin_stock(
        conn,
        id_sucursal=data["id_sucursal"],
        id_variante=data["id_variante"],
        id_bicicleta_serializada=data["id_bicicleta_serializada"],
        tipo_movimiento=data["tipo_movimiento"],
        id_usuario=data["id_usuario"],
        origen_tipo=data["origen_tipo"],
        origen_id=data["origen_id"],
        nota=data.get("nota"),
    )