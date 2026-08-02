from app.db.connection import get_connection
from app.modules.stock import repository
from app.modules.auditoria import service as auditoria_service
from app.modules.authz.service import exigir_permiso_ajustar_stock
from app.shared.money import to_decimal
from calendar import monthrange
from datetime import date
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

def listar_stock(filtros: dict | None = None):
    filtros = filtros or {}
    conn = get_connection()
    try:
        return repository.get_stock_sucursal(conn, **filtros)
    finally:
        conn.close()


def obtener_resumen_stock(filtros: dict | None = None):
    filtros = filtros or {}
    filtros = {k: v for k, v in filtros.items() if k not in {"ordenar_por", "orden", "limit", "offset"}}
    conn = get_connection()
    try:
        return repository.get_stock_resumen(conn, **filtros)
    finally:
        conn.close()


def obtener_pedido_compra_sugerido(filtros: dict | None = None):
    filtros = filtros or {}
    stock_bajo_umbral = int(filtros.get("stock_bajo_umbral") or 2)
    params = {
        "q": filtros.get("q"),
        "id_sucursal": filtros.get("id_sucursal"),
        "id_categoria": filtros.get("id_categoria"),
        "id_marca": filtros.get("id_marca"),
        "id_proveedor": filtros.get("id_proveedor"),
        "tipo_operativo": filtros.get("tipo_operativo"),
        "estado_stock": "stock_bajo",
        "reponer_stock": True,
        "stock_bajo_umbral": stock_bajo_umbral,
        "ordenar_por": "proveedor",
        "orden": "asc",
        "limit": int(filtros.get("limit") or 2000),
        "offset": 0,
    }

    conn = get_connection()
    try:
        items = repository.get_stock_sucursal(conn, **params)
    finally:
        conn.close()

    proveedores = {}
    objetivo_stock = max(stock_bajo_umbral * 2, stock_bajo_umbral + 1, 1)

    for item in items:
        disponible = to_decimal(item.get("stock_disponible") or 0)
        sugerida = max(to_decimal(objetivo_stock) - disponible, to_decimal(1))
        proveedor_id = item.get("id_proveedor")
        proveedor_nombre = item.get("proveedor_nombre") or "Sin proveedor asignado"
        clave = proveedor_id if proveedor_id is not None else "sin_proveedor"
        vendidas = to_decimal(item.get("unidades_vendidas_total") or 0)
        ventas = int(item.get("ventas_distintas_total") or 0)

        if vendidas > 0:
            motivo = (
                f"Disponible {disponible:g} <= umbral {stock_bajo_umbral}. "
                f"Vendidas {vendidas:g} en {ventas} venta(s)."
            )
        else:
            motivo = (
                f"Disponible {disponible:g} <= umbral {stock_bajo_umbral}. "
                "Sin ventas registradas en el sistema."
            )

        grupo = proveedores.setdefault(
            clave,
            {
                "id_proveedor": proveedor_id,
                "proveedor_nombre": proveedor_nombre,
                "total_items": 0,
                "cantidad_total_sugerida": to_decimal(0),
                "items": [],
            },
        )

        grupo["items"].append(
            {
                "sucursal_id": item["sucursal_id"],
                "sucursal_nombre": item["sucursal_nombre"],
                "variante_id": item["variante_id"],
                "producto_id": item.get("producto_id"),
                "producto_nombre": item["producto_nombre"],
                "nombre_variante": item["nombre_variante"],
                "sku": item.get("sku"),
                "codigo_barras": item.get("codigo_barras"),
                "codigo_proveedor": item.get("codigo_proveedor"),
                "id_proveedor": proveedor_id,
                "proveedor_nombre": proveedor_nombre,
                "serializable": item.get("serializable"),
                "tipo_operativo": item.get("tipo_operativo"),
                "marca_nombre": item.get("marca_nombre"),
                "categoria_nombre": item.get("categoria_nombre"),
                "stock_fisico": item["stock_fisico"],
                "stock_disponible": item["stock_disponible"],
                "stock_bajo_umbral": stock_bajo_umbral,
                "cantidad_sugerida": sugerida,
                "unidades_vendidas_total": item.get("unidades_vendidas_total") or to_decimal(0),
                "ventas_distintas_total": ventas,
                "ultima_venta": item.get("ultima_venta"),
                "primer_movimiento_stock": item.get("primer_movimiento_stock"),
                "motivo": motivo,
            }
        )
        grupo["total_items"] += 1
        grupo["cantidad_total_sugerida"] += sugerida

    proveedores_ordenados = sorted(
        proveedores.values(),
        key=lambda grupo: (
            grupo["id_proveedor"] is None,
            str(grupo["proveedor_nombre"]).upper(),
        ),
    )

    return {
        "stock_bajo_umbral": stock_bajo_umbral,
        "total_proveedores": len(proveedores_ordenados),
        "total_items": sum(grupo["total_items"] for grupo in proveedores_ordenados),
        "proveedores": proveedores_ordenados,
    }


def _primer_dia_mes(value: date) -> date:
    return date(value.year, value.month, 1)


def _sumar_meses(value: date, delta: int) -> date:
    month = value.month - 1 + delta
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def obtener_analisis_demanda(filtros: dict | None = None, *, puede_ver_costos: bool = False):
    filtros = filtros or {}
    meses = int(filtros.get("meses") or 12)
    fecha_hasta_base = filtros.get("fecha_hasta") or date.today()
    fecha_hasta_mes = _primer_dia_mes(fecha_hasta_base)
    fecha_desde = _sumar_meses(fecha_hasta_mes, -(meses - 1))
    ultimo_dia = monthrange(fecha_hasta_mes.year, fecha_hasta_mes.month)[1]
    fecha_hasta = date(fecha_hasta_mes.year, fecha_hasta_mes.month, ultimo_dia)

    conn = get_connection()
    try:
        items = repository.get_analisis_demanda(
            conn,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            q=filtros.get("q"),
            id_sucursal=filtros.get("id_sucursal"),
            tipo_operativo=filtros.get("tipo_operativo"),
            limit=int(filtros.get("limit") or 80),
        )
    finally:
        conn.close()

    total_unidades = sum((to_decimal(item.get("unidades_vendidas") or 0) for item in items), to_decimal(0))
    venta_neta = sum((to_decimal(item.get("venta_neta") or 0) for item in items), to_decimal(0))
    margen_bruto = sum((to_decimal(item.get("margen_bruto") or 0) for item in items), to_decimal(0))

    salida_items = []
    for item in items:
        item_dict = dict(item)
        if not puede_ver_costos:
            item_dict["costo_total"] = None
            item_dict["margen_bruto"] = None
            item_dict["meses"] = [
                {**mes, "margen_bruto": None}
                for mes in (item_dict.get("meses") or [])
            ]
        salida_items.append(item_dict)

    return {
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta,
        "meses": meses,
        "total_items": len(salida_items),
        "unidades_vendidas": total_unidades,
        "venta_neta": venta_neta,
        "margen_bruto": margen_bruto if puede_ver_costos else None,
        "items": salida_items,
    }


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
            exigir_permiso_ajustar_stock(conn, data["id_usuario"])
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
