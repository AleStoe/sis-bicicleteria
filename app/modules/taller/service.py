from decimal import Decimal
from app.modules.stock.repository import registrar_movimiento_stock
from app.shared.constants import TIPO_MOVIMIENTO_USO_TALLER
from fastapi import HTTPException

from app.db.connection import get_connection
from app.shared.constants import (
    ORDEN_TALLER_ESTADO_INGRESADA,
    ORDEN_TALLER_EVENTO_CREADA,
    ORDEN_TALLER_EVENTO_CAMBIO_ESTADO,
    ORDEN_TALLER_EVENTO_AGREGADO_ITEM,
    TIPO_MOVIMIENTO_USO_TALLER,
    TIPO_MOVIMIENTO_REVERSION_USO_TALLER,
    ORDEN_TALLER_EVENTO_ITEM_EJECUCION_REVERTIDA,
    ORDEN_TALLER_EVENTO_ITEM_CANCELADO,
)

TRANSICIONES_VALIDAS_TALLER = {
    "ingresada": {"presupuestada", "cancelada"},
    "presupuestada": {"esperando_aprobacion", "en_reparacion", "cancelada"},
    "esperando_aprobacion": {"en_reparacion", "cancelada"},
    "esperando_repuestos": {"en_reparacion", "cancelada"},
    "en_reparacion": {"esperando_repuestos", "terminada", "cancelada"},
    "terminada": {"lista_para_retirar"},
    "lista_para_retirar": {"retirada"},
    "retirada": set(),
    "cancelada": set(),
}


def _validar_transicion_estado_taller(estado_actual: str, nuevo_estado: str) -> None:
    estados_permitidos = TRANSICIONES_VALIDAS_TALLER.get(estado_actual, set())

    if nuevo_estado not in estados_permitidos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Transición inválida de taller: "
                f"{estado_actual} -> {nuevo_estado}"
            ),
        )

from app.modules.stock.repository import (
    obtener_stock_disponible_variante,
    registrar_movimiento_stock,
    descontar_stock_fisico,
    incrementar_stock_fisico,
)

from .repository import (
    validar_sucursal_activa,
    validar_usuario_activo,
    validar_cliente_existente,
    get_bicicleta_cliente,
    get_variante_by_id,
    insert_orden_taller,
    get_ordenes_taller,
    get_orden_taller_by_id,
    get_orden_taller_by_id_for_update,
    update_orden_taller_estado,
    insert_orden_taller_item,
    get_items_orden_taller,
    recalcular_total_orden_taller,
    insert_orden_taller_evento,
    get_eventos_orden_taller,
    get_item_orden_taller_by_id_for_update,
    update_orden_taller_item_aprobacion,
    update_orden_taller_item_ejecutado, 
    update_orden_taller_item_agregado,
    update_orden_taller_item_cancelado,
)


def _build_descripcion_snapshot(variante: dict) -> str:
    producto_nombre = (variante.get("producto_nombre") or "").strip()
    producto_descripcion = (variante.get("producto_descripcion") or "").strip()
    codigo_proveedor = (variante.get("codigo_proveedor") or "").strip()

    if producto_nombre and producto_descripcion:
        return f"{producto_nombre} - {producto_descripcion}"
    if producto_nombre and codigo_proveedor:
        return f"{producto_nombre} - {codigo_proveedor}"
    if producto_nombre:
        return producto_nombre
    if producto_descripcion:
        return producto_descripcion

    return f"Variante #{variante['id']}"


def crear_orden_taller(data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_sucursal_activa(conn, data.id_sucursal)
                validar_usuario_activo(conn, data.id_usuario)
                validar_cliente_existente(conn, data.id_cliente)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            bicicleta = get_bicicleta_cliente(conn, data.id_bicicleta_cliente)
            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta del cliente {data.id_bicicleta_cliente}",
                )

            if bicicleta["id_cliente"] != data.id_cliente:
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta indicada no pertenece al cliente informado",
                )

            orden = insert_orden_taller(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": data.id_cliente,
                    "id_bicicleta_cliente": data.id_bicicleta_cliente,
                    "estado": ORDEN_TALLER_ESTADO_INGRESADA,
                    "problema_reportado": data.problema_reportado.strip(),
                    "id_usuario": data.id_usuario,
                },
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden["id"],
                tipo_evento=ORDEN_TALLER_EVENTO_CREADA,
                detalle="Orden de taller creada",
                id_usuario=data.id_usuario,
            )

            return orden
    finally:
        conn.close()


def listar_ordenes_taller():
    conn = get_connection()
    try:
        return get_ordenes_taller(conn)
    finally:
        conn.close()


def obtener_orden_taller(orden_id: int):
    conn = get_connection()
    try:
        orden = get_orden_taller_by_id(conn, orden_id)
        if orden is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la orden de taller {orden_id}",
            )

        eventos = get_eventos_orden_taller(conn, orden_id)
        items = get_items_orden_taller(conn, orden_id)

        return {
            **orden,
            "eventos": eventos,
            "items": items,
        }
    finally:
        conn.close()


def cambiar_estado_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] == data.nuevo_estado:
                raise HTTPException(
                    status_code=400,
                    detail=f"La orden {orden_id} ya está en estado {data.nuevo_estado}",
                )

            _validar_transicion_estado_taller(
                estado_actual=orden["estado"],
                nuevo_estado=data.nuevo_estado,
            )

            update_orden_taller_estado(conn, orden_id, data.nuevo_estado)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_CAMBIO_ESTADO,
                detalle=f"Estado cambiado de {orden['estado']} a {data.nuevo_estado}",
                id_usuario=data.id_usuario,
            )

            orden_actualizada = get_orden_taller_by_id(conn, orden_id)
            return orden_actualizada
    finally:
        conn.close()


def agregar_item_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            variante = get_variante_by_id(conn, data.id_variante)
            if variante is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la variante {data.id_variante}",
                )

            descripcion_snapshot = _build_descripcion_snapshot(variante)
            subtotal = Decimal(data.cantidad) * Decimal(data.precio_unitario)

            item = insert_orden_taller_item(
                conn,
                {
                    "id_orden_taller": orden_id,
                    "id_variante": data.id_variante,
                    "descripcion_snapshot": descripcion_snapshot,
                    "cantidad": data.cantidad,
                    "precio_unitario": data.precio_unitario,
                    "subtotal": subtotal,
                },
            )

            recalcular_total_orden_taller(conn, orden_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_AGREGADO_ITEM,
                detalle=f"Item agregado: {descripcion_snapshot}",
                id_usuario=data.id_usuario,
            )

            return item
    finally:
        conn.close()
    

def aprobar_item_orden_taller(orden_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] in {"retirada", "cancelada"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se pueden modificar items de una orden en estado {orden['estado']}",
                )

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el item de taller {item_id}",
                )

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(
                    status_code=400,
                    detail="El item no pertenece a la orden informada",
                )

            if item["etapa"] == "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede cambiar la aprobación de un item ejecutado",
                )

            if item["aprobado"] == data.aprobado:
                raise HTTPException(
                    status_code=400,
                    detail="El item ya tiene ese estado de aprobación",
                )

            item_actualizado = update_orden_taller_item_aprobacion(
                conn,
                item_id=item_id,
                aprobado=data.aprobado,
            )

            detalle_evento = (
                f"Item aprobado: {item['descripcion_snapshot']}"
                if data.aprobado
                else f"Item desaprobado: {item['descripcion_snapshot']}"
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="aprobacion_cliente",
                detalle=detalle_evento,
                id_usuario=data.id_usuario,
            )

            return item_actualizado
    finally:
        conn.close()

def ejecutar_item_orden_taller(orden_id: int, item_id: int, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():

            validar_usuario_activo(conn, id_usuario)

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if not orden:
                raise HTTPException(404, "Orden no existe")

            if orden["estado"] in {"cancelada", "retirada"}:
                raise HTTPException(400, "Orden cerrada")

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if not item:
                raise HTTPException(404, "Item no existe")

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(400, "Item no pertenece a la orden")

            if not item["aprobado"]:
                raise HTTPException(400, "Item no aprobado")

            if item["etapa"] == "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="El item ya fue ejecutado",
                )

            # SOLO si es producto (no servicio)
        
            if item["id_variante"]:

                stock_row = obtener_stock_disponible_variante(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                )

                if stock_row is None:
                    raise HTTPException(
                        status_code=400,
                        detail="No existe stock para la variante en la sucursal",
                    )

                if stock_row["stock_disponible"] < item["cantidad"]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente. Disponible: {stock_row['stock_disponible']}",
                    )

                registrar_movimiento_stock(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    tipo_movimiento="uso_taller",
                    cantidad=item["cantidad"],
                    id_usuario=id_usuario,
                    costo_unitario_aplicado=item["costo_unitario_aplicado"],
                    origen_tipo="orden_taller",
                    origen_id=orden_id,
                    nota=f"Uso en orden de taller #{orden_id}",
                )
                descontar_stock_fisico(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    cantidad=item["cantidad"],
                )

            item_actualizado = update_orden_taller_item_ejecutado(
                conn, item_id
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="item_ejecutado",
                detalle=f"Item ejecutado: {item['descripcion_snapshot']}",
                id_usuario=id_usuario,
            )

            return item_actualizado

    finally:
        conn.close()

def revertir_ejecucion_item_orden_taller(orden_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            motivo = data.motivo.strip()
            if not motivo:
                raise HTTPException(
                    status_code=400,
                    detail="El motivo de reversión es obligatorio",
                )

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] in {"retirada", "cancelada"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede revertir ejecución en una orden {orden['estado']}",
                )

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el item de taller {item_id}",
                )

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(
                    status_code=400,
                    detail="El item no pertenece a la orden informada",
                )

            if item["etapa"] != "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede revertir un item ejecutado",
                )

            if item["id_variante"]:
                registrar_movimiento_stock(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    tipo_movimiento=TIPO_MOVIMIENTO_REVERSION_USO_TALLER,
                    cantidad=item["cantidad"],
                    id_usuario=data.id_usuario,
                    costo_unitario_aplicado=item["costo_unitario_aplicado"],
                    origen_tipo="orden_taller",
                    origen_id=orden_id,
                    nota=f"Reversión de uso en orden de taller #{orden_id}. Motivo: {motivo}",
                )

                incrementar_stock_fisico(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    cantidad=item["cantidad"],
                )

            item_actualizado = update_orden_taller_item_agregado(conn, item_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_ITEM_EJECUCION_REVERTIDA,
                detalle=f"Ejecución revertida: {item['descripcion_snapshot']}. Motivo: {motivo}",
                id_usuario=data.id_usuario,
            )

            return item_actualizado
    finally:
        conn.close()
    
def cancelar_item_orden_taller(orden_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            motivo = data.motivo.strip()
            if not motivo:
                raise HTTPException(
                    status_code=400,
                    detail="El motivo de cancelación es obligatorio",
                )

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] in {"retirada", "cancelada"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se pueden cancelar items de una orden en estado {orden['estado']}",
                )

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el item de taller {item_id}",
                )

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(
                    status_code=400,
                    detail="El item no pertenece a la orden informada",
                )

            if item["etapa"] == "cancelado":
                raise HTTPException(
                    status_code=400,
                    detail="El item ya está cancelado",
                )

            if item["etapa"] == "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede cancelar un item ejecutado; primero debe revertirse la ejecución",
                )

            item_actualizado = update_orden_taller_item_cancelado(conn, item_id)

            recalcular_total_orden_taller(conn, orden_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_ITEM_CANCELADO,
                detalle=f"Item cancelado: {item['descripcion_snapshot']}. Motivo: {motivo}",
                id_usuario=data.id_usuario,
            )

            return item_actualizado
    finally:
        conn.close()