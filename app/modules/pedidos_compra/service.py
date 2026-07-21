from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.stock.service import registrar_ingreso_stock
from app.shared.money import to_decimal

from . import repository
from .schema import ESTADOS_PEDIDO_COMPRA

ENTIDAD_PEDIDO_COMPRA = "pedido_compra"


def _detalle_pedido(conn, pedido_id: int):
    pedido = repository.get_pedido(conn, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail=f"No existe el pedido de compra {pedido_id}")

    return {
        **dict(pedido),
        "items": repository.list_items(conn, pedido_id),
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
    repository.insert_historial(
        conn,
        pedido_id,
        {
            "accion": accion,
            "estado_anterior": estado_anterior,
            "estado_nuevo": estado_nuevo,
            "detalle": detalle,
            "metadata": metadata or {},
            "id_usuario": id_usuario,
        },
    )

    auditoria_service.registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=None,
        entidad=ENTIDAD_PEDIDO_COMPRA,
        entidad_id=pedido_id,
        accion=accion,
        detalle=detalle,
        metadata=metadata or {},
        origen_tipo=ENTIDAD_PEDIDO_COMPRA,
        origen_id=pedido_id,
    )


def crear_pedido_compra(data):
    payload = data.model_dump()
    items = payload.pop("items")
    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.insert_pedido(conn, payload)
            for item in items:
                repository.insert_pedido_item(conn, pedido["id"], item)

            _registrar_historial(
                conn,
                pedido_id=pedido["id"],
                accion="pedido_compra_creado",
                id_usuario=payload.get("id_usuario"),
                estado_nuevo="borrador",
                detalle=f"Pedido de compra creado para {pedido['proveedor_nombre_snapshot']}",
                metadata={
                    "id_proveedor": pedido.get("id_proveedor"),
                    "total_items": len(items),
                },
            )

        return _detalle_pedido(conn, pedido["id"])
    finally:
        conn.close()


def listar_pedidos_compra(estado: str | None = None, id_proveedor: int | None = None, limit: int = 100):
    if estado and estado not in ESTADOS_PEDIDO_COMPRA:
        raise HTTPException(status_code=400, detail="Estado de pedido inválido")

    conn = get_connection()
    try:
        return repository.list_pedidos(conn, estado=estado, id_proveedor=id_proveedor, limit=limit)
    finally:
        conn.close()


def obtener_pedido_compra(pedido_id: int):
    conn = get_connection()
    try:
        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()


def cambiar_estado_pedido_compra(pedido_id: int, data):
    payload = data.model_dump()
    estado_nuevo = payload["estado"]

    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.get_pedido_for_update(conn, pedido_id)
            if pedido is None:
                raise HTTPException(status_code=404, detail=f"No existe el pedido de compra {pedido_id}")

            estado_anterior = pedido["estado"]
            if estado_anterior == estado_nuevo and not payload.get("observaciones"):
                return _detalle_pedido(conn, pedido_id)

            actualizado = repository.update_estado(
                conn,
                pedido_id,
                estado_nuevo,
                payload.get("observaciones"),
            )
            _registrar_historial(
                conn,
                pedido_id=pedido_id,
                accion="pedido_compra_estado_actualizado",
                id_usuario=payload.get("id_usuario"),
                estado_anterior=estado_anterior,
                estado_nuevo=estado_nuevo,
                detalle=f"Pedido de compra {pedido_id}: {estado_anterior} -> {estado_nuevo}",
                metadata={
                    "observaciones": payload.get("observaciones"),
                },
            )

        return _detalle_pedido(conn, actualizado["id"])
    finally:
        conn.close()


def recibir_pedido_compra(pedido_id: int, data):
    payload = data.model_dump()
    usuario_id = payload.get("id_usuario")
    conn = get_connection()
    try:
        with conn.transaction():
            pedido = repository.get_pedido_for_update(conn, pedido_id)
            if pedido is None:
                raise HTTPException(status_code=404, detail=f"No existe el pedido de compra {pedido_id}")

            if pedido["estado"] not in {"enviado", "recibido_parcial"}:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden recibir pedidos enviados o recibidos parcialmente",
                )

            if not pedido.get("id_proveedor"):
                raise HTTPException(
                    status_code=400,
                    detail="El pedido no tiene proveedor asignado. Asigná un proveedor antes de recibir mercadería.",
                )

            ingresos = []
            for item_payload in payload["items"]:
                item = repository.get_item_for_update(conn, pedido_id, item_payload["id_item"])
                if item is None:
                    raise HTTPException(status_code=404, detail=f"No existe el ítem {item_payload['id_item']} en este pedido")

                if item.get("id_variante") is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El ítem {item['id']} no tiene variante asociada y no puede recibirse como stock.",
                    )

                cantidad = to_decimal(item_payload["cantidad_recibida"])
                pendiente = to_decimal(item["cantidad_pedida"]) - to_decimal(item["cantidad_recibida"])
                if cantidad > pendiente:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"La cantidad recibida del ítem {item['id']} supera lo pendiente. "
                            f"Pendiente: {pendiente:g}."
                        ),
                    )

                costo_unitario = to_decimal(item_payload["costo_unitario"])
                costo_productos = cantidad * costo_unitario
                gastos_adicionales = to_decimal(item_payload.get("gastos_adicionales") or 0)
                observacion_item = item_payload.get("observacion")
                observacion = "Recepción pedido de compra #{}".format(pedido_id)
                if observacion_item:
                    observacion = f"{observacion}. {observacion_item}"

                ingreso = registrar_ingreso_stock(
                    conn,
                    {
                        "id_sucursal": item_payload["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "id_proveedor": pedido["id_proveedor"],
                        "cantidad_ingresada": cantidad,
                        "costo_productos": costo_productos,
                        "gastos_adicionales": gastos_adicionales,
                        "origen_ingreso": "pedido_compra",
                        "observacion": observacion,
                        "id_usuario": usuario_id,
                    },
                )
                repository.sumar_cantidad_recibida_item(conn, item["id"], cantidad)
                ingresos.append(
                    {
                        "id_item": item["id"],
                        "id_variante": item["id_variante"],
                        "cantidad_recibida": str(cantidad),
                        "costo_unitario": str(costo_unitario),
                        "gastos_adicionales": str(gastos_adicionales),
                        "ingreso_id": ingreso["ingreso_id"],
                    }
                )

            estado_anterior = pedido["estado"]
            estado_nuevo = "cerrado" if repository.pedido_totalmente_recibido(conn, pedido_id) else "recibido_parcial"
            repository.update_estado(conn, pedido_id, estado_nuevo, payload.get("observaciones"))

            _registrar_historial(
                conn,
                pedido_id=pedido_id,
                accion="pedido_compra_recepcion_registrada",
                id_usuario=usuario_id,
                estado_anterior=estado_anterior,
                estado_nuevo=estado_nuevo,
                detalle=f"Recepción registrada para pedido de compra {pedido_id}",
                metadata={
                    "observaciones": payload.get("observaciones"),
                    "ingresos": ingresos,
                },
            )

        return _detalle_pedido(conn, pedido_id)
    finally:
        conn.close()
