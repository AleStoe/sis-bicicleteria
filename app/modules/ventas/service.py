from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.stock import service as stock_service

from .repository import (
    get_cliente_by_id,
    get_sucursal_by_id,
    get_variantes_by_ids,
    insert_venta,
    insert_venta_item,
    get_ventas,
    get_venta_by_id,
    get_venta_items_by_venta_id,
    get_venta_for_update,
    update_venta_estado,
    update_venta_saldo_y_estado,
    insert_venta_anulacion,
)


def _consolidar_items(items):
    consolidados = {}

    for item in items:
        if item.cantidad <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"La cantidad debe ser mayor a 0 para la variante {item.id_variante}",
            )

        if item.id_variante not in consolidados:
            consolidados[item.id_variante] = {
                "id_variante": item.id_variante,
                "cantidad": Decimal(str(item.cantidad)),
            }
        else:
            consolidados[item.id_variante]["cantidad"] += Decimal(str(item.cantidad))

    return list(consolidados.values())


def _validar_cliente(conn, id_cliente: int):
    cliente = get_cliente_by_id(conn, id_cliente)

    if cliente is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe el cliente {id_cliente}",
        )

    if not cliente["activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"El cliente {id_cliente} está inactivo",
        )

    return cliente


def _validar_sucursal(conn, id_sucursal: int):
    sucursal = get_sucursal_by_id(conn, id_sucursal)

    if sucursal is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la sucursal {id_sucursal}",
        )

    if not sucursal["activa"]:
        raise HTTPException(
            status_code=400,
            detail=f"La sucursal {id_sucursal} está inactiva",
        )

    return sucursal


def _obtener_variantes_map(conn, ids_unicos):
    variantes = get_variantes_by_ids(conn, ids_unicos)
    variantes_map = {v["id"]: v for v in variantes}

    if len(variantes_map) != len(ids_unicos):
        raise HTTPException(
            status_code=400,
            detail="Una o más variantes no existen",
        )

    for variante in variantes:
        if not variante["producto_activo"]:
            raise HTTPException(
                status_code=400,
                detail=f"El producto de la variante {variante['id']} está inactivo",
            )

        if not variante["variante_activa"]:
            raise HTTPException(
                status_code=400,
                detail=f"La variante {variante['id']} está inactiva",
            )

    return variantes_map


def _validar_venta_entregable(venta, venta_id: int):
    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {venta_id}",
        )

    if venta["estado"] == "anulada":
        raise HTTPException(
            status_code=400,
            detail=f"La venta {venta_id} está anulada y no se puede entregar",
        )

    if venta["estado"] == "entregada":
        raise HTTPException(
            status_code=400,
            detail=f"La venta {venta_id} ya fue entregada",
        )


def _validar_venta_anulable(venta, venta_id: int):
    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {venta_id}",
        )

    if venta["estado"] != "creada":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La venta {venta_id} no se puede anular porque está en estado "
                f"'{venta['estado']}'"
            ),
        )


def crear_venta(data):
    conn = get_connection()

    try:
        with conn.transaction():
            if not data.items:
                raise HTTPException(
                    status_code=400,
                    detail="La venta debe tener al menos un item",
                )

            _validar_cliente(conn, data.id_cliente)
            _validar_sucursal(conn, data.id_sucursal)

            items_consolidados = _consolidar_items(data.items)
            ids_unicos = [item["id_variante"] for item in items_consolidados]
            variantes_map = _obtener_variantes_map(conn, ids_unicos)

            subtotal_total = Decimal("0")
            venta_items = []

            for item in items_consolidados:
                variante = variantes_map[item["id_variante"]]
                subtotal = Decimal(str(variante["precio_minorista"])) * item["cantidad"]
                subtotal_total += subtotal

                venta_items.append(
                    {
                        "item": item,
                        "variante": variante,
                        "subtotal": subtotal,
                    }
                )

            venta_id = insert_venta(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": data.id_cliente,
                    "estado": "creada",
                    "subtotal_base": float(subtotal_total),
                    "descuento_total": 0,
                    "recargo_total": 0,
                    "total_final": float(subtotal_total),
                    "saldo_pendiente": float(subtotal_total),
                    "id_usuario_creador": data.id_usuario,
                    "observaciones": getattr(data, "observaciones", None),
                    "id_reserva_origen": None,
                },
            )

            for fila in venta_items:
                item = fila["item"]
                variante = fila["variante"]
                subtotal = fila["subtotal"]

                insert_venta_item(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_variante": variante["id"],
                        "id_bicicleta_serializada": None,
                        "descripcion_snapshot": f"{variante['producto_nombre']} - {variante['nombre_variante']}",
                        "cantidad": float(item["cantidad"]),
                        "precio_lista": float(variante["precio_minorista"]),
                        "precio_final": float(variante["precio_minorista"]),
                        "costo_unitario_aplicado": float(variante["costo_promedio_vigente"] or 0),
                        "subtotal": float(subtotal),
                    },
                )

                if variante["stockeable"]:
                    stock_service.marcar_stock_pendiente_entrega(
                        conn,
                        {
                            "id_sucursal": data.id_sucursal,
                            "id_variante": variante["id"],
                            "cantidad": float(item["cantidad"]),
                            "id_usuario": data.id_usuario,
                            "descontar_de_reservado": False,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "nota": f"Venta #{venta_id} pendiente de entrega",
                        },
                    )

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": "creada",
        }

    finally:
        conn.close()


def listar_ventas():
    conn = get_connection()
    try:
        return get_ventas(conn)
    finally:
        conn.close()


def obtener_venta(venta_id: int):
    conn = get_connection()
    try:
        venta = get_venta_by_id(conn, venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {venta_id}",
            )

        items = get_venta_items_by_venta_id(conn, venta_id)

        return {
            "venta": venta,
            "items": items,
        }
    finally:
        conn.close()


def entregar_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_entregable(venta, venta_id)

            if Decimal(str(venta["saldo_pendiente"])) > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} tiene saldo pendiente y no se puede entregar",
                )

            items = get_venta_items_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para entregar",
                )

            for item in items:
                stock_service.registrar_entrega_stock(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": float(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "nota": f"Entrega de venta #{venta_id}",
                    },
                )

            update_venta_estado(conn, venta_id, "entregada")

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": "entregada",
        }

    finally:
        conn.close()


def anular_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_anulable(venta, venta_id)

            items = get_venta_items_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para anular",
                )

            anulacion_id = insert_venta_anulacion(
                conn,
                venta_id,
                data.motivo,
                data.id_usuario,
            )

            for item in items:
                stock_service.devolver_stock_a_disponible_desde_pendiente(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": float(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "nota": f"Liberación por anulación de venta #{venta_id}",
                    },
                )

            update_venta_estado(conn, venta_id, "anulada")

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": "anulada",
            "anulacion_id": anulacion_id,
        }

    finally:
        conn.close()