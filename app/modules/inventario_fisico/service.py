from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.stock import repository as stock_repository
from app.modules.stock.service import exigir_permiso_ajustar_stock, to_decimal

from .repository import (
    cancelar_inventario,
    cerrar_inventario,
    get_historial_diferencias,
    get_inventario_by_id,
    get_inventarios,
    get_item_inventario_for_update,
    get_items_con_movimientos_fisicos_posteriores,
    get_items_inventario,
    insert_inventario,
    set_movimiento_item,
    snapshot_stock_inventario,
    upsert_conteo_item,
)


def _detalle(inventario: dict, items: list[dict] | None = None):
    data = dict(inventario)
    if items is not None:
        data["items"] = items
    return data


def listar_inventarios():
    conn = get_connection()
    try:
        return get_inventarios(conn)
    finally:
        conn.close()


def listar_diferencias_inventario(id_sucursal: int | None = None, limit: int = 100):
    conn = get_connection()
    try:
        if limit < 1 or limit > 500:
            raise HTTPException(status_code=400, detail="limit debe estar entre 1 y 500")
        return get_historial_diferencias(conn, id_sucursal=id_sucursal, limit=limit)
    finally:
        conn.close()


def crear_inventario(data):
    conn = get_connection()
    try:
        with conn.transaction():
            exigir_permiso_ajustar_stock(conn, data.id_usuario)
            inventario = insert_inventario(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "descripcion": data.descripcion,
                    "id_usuario": data.id_usuario,
                },
            )
            snapshot_stock_inventario(
                conn,
                inventario["id"],
                data.id_sucursal,
                id_categoria=data.id_categoria,
                tipo_operativo=data.tipo_operativo,
            )

            detalle = obtener_inventario(inventario["id"], conn=conn)
            if detalle["total_items"] == 0:
                raise HTTPException(
                    status_code=400,
                    detail="El filtro elegido no tiene productos stockeables para contar",
                )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=data.id_sucursal,
                entidad="inventario_fisico",
                entidad_id=inventario["id"],
                accion="inventario_fisico_creado",
                detalle=f"Inventario físico #{inventario['id']} creado",
                metadata={"tipo": "inventario_fisico_creado"},
            )

            return detalle
    finally:
        conn.close()


def obtener_inventario(inventario_id: int, *, conn=None):
    own_conn = conn is None
    conn = conn or get_connection()
    try:
        inventario = get_inventario_by_id(conn, inventario_id)
        if inventario is None:
            raise HTTPException(status_code=404, detail="Inventario no encontrado")
        return _detalle(inventario, get_items_inventario(conn, inventario_id))
    finally:
        if own_conn:
            conn.close()


def cargar_conteo(inventario_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            exigir_permiso_ajustar_stock(conn, data.id_usuario)
            inventario = get_inventario_by_id(conn, inventario_id, for_update=True)
            if inventario is None:
                raise HTTPException(status_code=404, detail="Inventario no encontrado")
            if inventario["estado"] != "abierto":
                raise HTTPException(status_code=400, detail="Solo se puede contar un inventario abierto")

            item = get_item_inventario_for_update(conn, inventario_id, data.id_variante)
            if item is None:
                raise HTTPException(status_code=404, detail="La variante no pertenece al inventario")

            stock_actual = stock_repository.obtener_stock_disponible_variante(
                conn,
                id_sucursal=inventario["id_sucursal"],
                id_variante=data.id_variante,
            )
            if stock_actual is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"No existe stock para la variante {data.id_variante}",
                )

            return upsert_conteo_item(
                conn,
                inventario_id,
                {
                    "id_variante": data.id_variante,
                    "stock_contado": data.stock_contado,
                    "id_usuario": data.id_usuario,
                    "nota": data.nota,
                },
            )
    finally:
        conn.close()


def cancelar_inventario_abierto(inventario_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            exigir_permiso_ajustar_stock(conn, data.id_usuario)
            inventario = get_inventario_by_id(conn, inventario_id, for_update=True)
            if inventario is None:
                raise HTTPException(status_code=404, detail="Inventario no encontrado")
            if inventario["estado"] != "abierto":
                raise HTTPException(status_code=400, detail="Solo se puede cancelar un inventario abierto")

            cancelado = cancelar_inventario(conn, inventario_id, data.id_usuario)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=inventario["id_sucursal"],
                entidad="inventario_fisico",
                entidad_id=inventario_id,
                accion="inventario_fisico_cancelado",
                detalle=f"Inventario físico #{inventario_id} cancelado sin movimientos de stock",
                metadata={"tipo": "inventario_fisico_cancelado"},
            )

            return obtener_inventario(cancelado["id"], conn=conn)
    finally:
        conn.close()


def _descripcion_item_reconteo(item: dict) -> str:
    descripcion = str(item.get("producto_nombre") or f"Variante #{item['id_variante']}")
    variante = str(item.get("nombre_variante") or "").strip()
    if variante:
        descripcion = f"{descripcion} - {variante}"
    if item.get("sku"):
        descripcion = f"{descripcion} [{item['sku']}]"
    return descripcion


def cerrar_y_ajustar_inventario(inventario_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            exigir_permiso_ajustar_stock(conn, data.id_usuario)
            inventario = get_inventario_by_id(conn, inventario_id, for_update=True)
            if inventario is None:
                raise HTTPException(status_code=404, detail="Inventario no encontrado")
            if inventario["estado"] != "abierto":
                raise HTTPException(status_code=400, detail="Solo se puede cerrar un inventario abierto")

            items = get_items_inventario(conn, inventario_id)
            sin_contar = [item for item in items if item["stock_contado"] is None]
            if sin_contar:
                raise HTTPException(
                    status_code=400,
                    detail=f"Faltan contar {len(sin_contar)} item(s)",
                )

            stock_actual_por_variante = {}
            for item in sorted(items, key=lambda row: row["id_variante"]):
                stock_actual = stock_repository.obtener_stock_disponible_variante(
                    conn,
                    id_sucursal=inventario["id_sucursal"],
                    id_variante=item["id_variante"],
                )
                if stock_actual is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"No existe stock para la variante {item['id_variante']}",
                    )
                stock_actual_por_variante[item["id_variante"]] = stock_actual

            items_reconteo = get_items_con_movimientos_fisicos_posteriores(
                conn,
                inventario_id,
            )
            if items_reconteo:
                descripciones = ", ".join(
                    _descripcion_item_reconteo(item) for item in items_reconteo
                )
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "No se puede cerrar el inventario: hubo movimientos de stock "
                        "físico después del conteo. Recontá estas variantes y volvé a "
                        f"cerrar: {descripciones}."
                    ),
                )

            movimientos = []
            for item in items:
                stock_actual = stock_actual_por_variante[item["id_variante"]]

                ajuste_a_aplicar = (
                    to_decimal(item["stock_contado"])
                    - to_decimal(stock_actual["stock_fisico"])
                )
                if ajuste_a_aplicar == Decimal("0"):
                    continue

                resultado = stock_repository.registrar_ajuste_manual_stock(
                    conn,
                    id_sucursal=inventario["id_sucursal"],
                    id_variante=item["id_variante"],
                    cantidad=ajuste_a_aplicar,
                    id_usuario=data.id_usuario,
                    origen_tipo="inventario_fisico",
                    origen_id=inventario_id,
                    nota=f"Inventario físico #{inventario_id}. Conteo: {item['stock_contado']}. Sistema: {item['stock_sistema']}.",
                )
                set_movimiento_item(conn, item["id"], resultado["movimiento_id"])
                movimientos.append(resultado["movimiento_id"])

            cerrado = cerrar_inventario(conn, inventario_id, data.id_usuario)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=inventario["id_sucursal"],
                entidad="inventario_fisico",
                entidad_id=inventario_id,
                accion="inventario_fisico_cerrado",
                detalle=f"Inventario físico #{inventario_id} cerrado con {len(movimientos)} ajuste(s)",
                metadata={
                    "tipo": "inventario_fisico_cerrado",
                    "movimientos_stock": movimientos,
                },
            )

            return obtener_inventario(cerrado["id"], conn=conn)
    finally:
        conn.close()
