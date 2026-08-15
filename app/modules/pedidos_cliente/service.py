from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.shared.money import to_decimal

from . import repository
from .schema import ESTADOS_PEDIDO_CLIENTE

ENTIDAD_PEDIDO_CLIENTE = "pedido_cliente"


def _detalle_pedido(conn, pedido_id: int):
    pedido = repository.get_pedido(conn, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail=f"No existe el pedido {pedido_id}")

    return {
        **dict(pedido),
        "items": repository.list_items(conn, pedido_id, pedido["id_sucursal"]),
        "historial": repository.list_historial(conn, pedido_id),
    }


def _registrar_historial(
    conn,
    *,
    pedido_id: int,
    accion: str,
    id_usuario: int | None,
    estado_anterior: str | None = None,
    estado_nuevo: str | None = None,
    detalle: str | None = None,
    metadata: dict | None = None,
):
    metadata = metadata or {}
    repository.insert_historial(
        conn,
        pedido_id,
        {
            "accion": accion,
            "estado_anterior": estado_anterior,
            "estado_nuevo": estado_nuevo,
            "detalle": detalle,
            "metadata": metadata,
            "id_usuario": id_usuario,
        },
    )
    if id_usuario is not None:
        auditoria_service.registrar_evento(
            conn,
            id_usuario=id_usuario,
            id_sucursal=None,
            entidad=ENTIDAD_PEDIDO_CLIENTE,
            entidad_id=pedido_id,
            accion=accion,
            detalle=detalle,
            metadata=metadata,
            origen_tipo=ENTIDAD_PEDIDO_CLIENTE,
            origen_id=pedido_id,
        )


def _validar_pedido_borrador(pedido):
    if pedido is None:
        raise HTTPException(status_code=404, detail="No existe el pedido")
    if pedido["estado"] != "borrador":
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden modificar pedidos en borrador",
        )


def crear_pedido_cliente(data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            cliente = repository.get_cliente(conn, payload["id_cliente"])
            if cliente is None or not cliente["activo"]:
                raise HTTPException(status_code=400, detail="El cliente no existe o no estÃ¡ activo")

            sucursal = repository.get_sucursal(conn, payload["id_sucursal"])
            if sucursal is None or not sucursal["activa"]:
                raise HTTPException(status_code=400, detail="La sucursal no existe o no estÃ¡ activa")

            pedido = repository.insert_pedido(conn, payload)
            _registrar_historial(
                conn,
                pedido_id=pedido["id"],
                accion="pedido_cliente_creado",
                id_usuario=payload.get("id_usuario"),
                estado_nuevo="borrador",
                detalle=f"Pedido creado para {cliente['nombre']}",
                metadata={
                    "id_cliente": payload["id_cliente"],
                    "id_sucursal": payload["id_sucursal"],
                    "tipo_precio": payload.get("tipo_precio") or "minorista",
                },
            )

        return _detalle_pedido(conn, pedido["id"])
    finally:
        conn.close()


def listar_pedidos_cliente(estado: str | None = None, q: str | None = None, limit: int = 100):
    if estado and estado not in ESTADOS_PEDIDO_CLIENTE:
        raise HTTPException(status_code=400, detail="Estado de pedido invÃ¡lido")

    conn = get_connection()
    try:
        return repository.list_pedidos(conn, estado=estado, q=q, limit=limit)
    finally:
        conn.close()


def obtener_pedido_cliente(pedido_id: int):
    conn = get_connection()
    try:
        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()


def agregar_item_pedido(pedido_id: int, data):
    payload = data.model_dump()
    cantidad = to_decimal(payload["cantidad"])
    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.get_pedido_for_update(conn, pedido_id)
            _validar_pedido_borrador(pedido)

            variante = repository.get_variante_para_pedido(conn, payload["id_variante"])
            if variante is None:
                raise HTTPException(status_code=404, detail="No existe la variante")
            if not variante["producto_activo"] or not variante["variante_activa"]:
                raise HTTPException(status_code=400, detail="La variante no estÃ¡ activa")

            item = repository.upsert_item(conn, pedido_id, variante, cantidad)
            _registrar_historial(
                conn,
                pedido_id=pedido_id,
                accion="pedido_cliente_item_agregado",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Item agregado al pedido #{pedido_id}",
                metadata={
                    "id_variante": payload["id_variante"],
                    "cantidad": str(cantidad),
                    "id_item": item["id"],
                },
            )

        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()


def actualizar_item_pedido(pedido_id: int, item_id: int, data):
    payload = data.model_dump()
    cantidad = to_decimal(payload["cantidad"])
    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.get_pedido_for_update(conn, pedido_id)
            _validar_pedido_borrador(pedido)

            item = repository.get_item_for_update(conn, pedido_id, item_id)
            if item is None:
                raise HTTPException(status_code=404, detail="No existe el Ã­tem en este pedido")

            repository.update_item_cantidad(conn, item_id, cantidad)
            _registrar_historial(
                conn,
                pedido_id=pedido_id,
                accion="pedido_cliente_item_actualizado",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Cantidad actualizada en pedido #{pedido_id}",
                metadata={
                    "id_item": item_id,
                    "cantidad_anterior": str(item["cantidad"]),
                    "cantidad_nueva": str(cantidad),
                },
            )

        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()


def quitar_item_pedido(pedido_id: int, item_id: int, id_usuario: int | None = None):
    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.get_pedido_for_update(conn, pedido_id)
            _validar_pedido_borrador(pedido)

            item = repository.get_item_for_update(conn, pedido_id, item_id)
            if item is None:
                raise HTTPException(status_code=404, detail="No existe el Ã­tem en este pedido")

            repository.delete_item(conn, item_id)
            _registrar_historial(
                conn,
                pedido_id=pedido_id,
                accion="pedido_cliente_item_quitado",
                id_usuario=id_usuario,
                detalle=f"Item quitado del pedido #{pedido_id}",
                metadata={
                    "id_item": item_id,
                    "id_variante": item["id_variante"],
                    "cantidad": str(item["cantidad"]),
                },
            )

        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()


def cancelar_pedido_cliente(pedido_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.get_pedido_for_update(conn, pedido_id)
            _validar_pedido_borrador(pedido)

            repository.update_estado_cancelado(conn, pedido_id, payload.get("motivo"))
            _registrar_historial(
                conn,
                pedido_id=pedido_id,
                accion="pedido_cliente_cancelado",
                id_usuario=payload.get("id_usuario"),
                estado_anterior=pedido["estado"],
                estado_nuevo="cancelado",
                detalle=payload.get("motivo") or f"Pedido #{pedido_id} cancelado",
                metadata={"motivo": payload.get("motivo")},
            )

        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()


def convertir_pedido_cliente(pedido_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.get_pedido_for_update(conn, pedido_id)
            _validar_pedido_borrador(pedido)

            venta = repository.get_venta(conn, payload["id_venta"])
            if venta is None:
                raise HTTPException(status_code=404, detail="No existe la venta indicada")
            if int(venta["id_cliente"]) != int(pedido["id_cliente"]):
                raise HTTPException(status_code=400, detail="La venta no corresponde al cliente del pedido")

            repository.update_estado_convertido(conn, pedido_id, payload["id_venta"])
            _registrar_historial(
                conn,
                pedido_id=pedido_id,
                accion="pedido_cliente_convertido_a_venta",
                id_usuario=payload.get("id_usuario"),
                estado_anterior=pedido["estado"],
                estado_nuevo="convertido_a_venta",
                detalle=f"Pedido #{pedido_id} convertido en venta #{payload['id_venta']}",
                metadata={"id_venta": payload["id_venta"]},
            )

        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()
