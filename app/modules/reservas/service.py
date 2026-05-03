from decimal import Decimal
from fastapi import HTTPException
from app.shared.money import to_decimal
from app.db.connection import get_connection
from app.modules.stock import service as stock_service
from app.modules.reservas import repository as reserva_repo
from app.modules.pagos import service as pagos_service
from app.modules.ventas import repository as ventas_repo
from app.modules.serializadas.repository import (
    get_bicicleta_serializada_for_update,
    update_bicicleta_serializada_estado,
)


# =========================================================
# HELPERS
# =========================================================

def _validar_estado_cancelable(reserva):
    if reserva["estado"] in ["cancelada", "convertida_en_venta"]:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cancelar una reserva en estado {reserva['estado']}",
        )

def _validar_y_bloquear_bicicleta_serializada_para_reserva(
    conn,
    *,
    id_bicicleta_serializada: int,
    id_variante: int,
    id_sucursal: int,
):
    bicicleta = get_bicicleta_serializada_for_update(conn, id_bicicleta_serializada)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la bicicleta serializada {id_bicicleta_serializada}",
        )

    if bicicleta["id_variante"] != id_variante:
        raise HTTPException(
            status_code=400,
            detail="La bicicleta serializada no corresponde a la variante informada",
        )

    if bicicleta["id_sucursal_actual"] != id_sucursal:
        raise HTTPException(
            status_code=400,
            detail="La bicicleta serializada no pertenece a la sucursal de la reserva",
        )

    if bicicleta["estado"] != "disponible":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {id_bicicleta_serializada} "
                f"no está disponible"
            ),
        )

    return bicicleta


def _validar_y_bloquear_bicicleta_serializada_reservada_para_conversion(
    conn,
    *,
    id_bicicleta_serializada: int,
    id_variante: int,
    id_sucursal: int,
):
    bicicleta = get_bicicleta_serializada_for_update(conn, id_bicicleta_serializada)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la bicicleta serializada {id_bicicleta_serializada}",
        )

    if bicicleta["id_variante"] != id_variante:
        raise HTTPException(
            status_code=400,
            detail="La bicicleta serializada no corresponde a la variante informada",
        )

    if bicicleta["id_sucursal_actual"] != id_sucursal:
        raise HTTPException(
            status_code=400,
            detail="La bicicleta serializada no pertenece a la sucursal de la reserva",
        )

    if bicicleta["estado"] != "reservada":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {id_bicicleta_serializada} "
                f"debe estar en estado reservada para convertir la reserva en venta"
            ),
        )

    return bicicleta
# =========================================================
# CREAR RESERVA
# =========================================================

def crear_reserva(data):
    data = data.model_dump()
    conn = get_connection()

    try:
        with conn.transaction():
            total_estimado = Decimal("0")

            # =====================================================
            # 1. VALIDAR STOCK Y SERIALIZADAS
            # =====================================================
            for item in data["items"]:
                stock = stock_service.obtener_stock_disponible_tx(
                    conn,
                    id_sucursal=data["id_sucursal"],
                    id_variante=item["id_variante"],
                )

                if to_decimal(stock["stock_disponible"]) < to_decimal(item["cantidad"]):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente para variante {item['id_variante']}",
                    )

                bicicleta_id = item.get("id_bicicleta_serializada")
                if bicicleta_id is not None:
                    if to_decimal(item["cantidad"]) != Decimal("1"):
                        raise HTTPException(
                            status_code=400,
                            detail="Un item con bicicleta serializada debe tener cantidad = 1",
                        )

                    _validar_y_bloquear_bicicleta_serializada_para_reserva(
                        conn,
                        id_bicicleta_serializada=bicicleta_id,
                        id_variante=item["id_variante"],
                        id_sucursal=data["id_sucursal"],
                    )

            # =====================================================
            # 2. CREAR RESERVA
            # =====================================================
            reserva_id = reserva_repo.insert_reserva(conn, data)

            # =====================================================
            # 3. ITEMS + SERIALIZADAS + STOCK
            # =====================================================
            for item in data["items"]:
                subtotal = to_decimal(item["cantidad"]) * to_decimal(item["precio_estimado"])
                total_estimado += subtotal

                reserva_repo.insert_reserva_item(
                    conn,
                    {
                        "id_reserva": reserva_id,
                        "id_variante": item["id_variante"],
                        "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                        "cantidad": item["cantidad"],
                        "precio_estimado": item["precio_estimado"],
                        "subtotal_estimado": subtotal,
                    },
                )

                bicicleta_id = item.get("id_bicicleta_serializada")
                if bicicleta_id is not None:
                    update_bicicleta_serializada_estado(conn, bicicleta_id, "reservada")

                stock_service.reservar_stock(
                    conn,
                    {
                        "id_sucursal": data["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": item["cantidad"],
                        "id_usuario": data["id_usuario"],
                        "origen_tipo": "reserva",
                        "origen_id": reserva_id,
                        "nota": "Reserva creada",
                    },
                )

            # =====================================================
            # 4. SEÑA Y SALDO
            # =====================================================
            sena = Decimal("0")
            pago = data.get("pago_inicial")

            if pago and pago.get("registrar"):
                sena = to_decimal(pago["monto"])

            saldo = total_estimado - sena

            reserva_repo.actualizar_totales_reserva(
                conn,
                reserva_id,
                total_estimado,
                sena,
                saldo,
            )

            # =====================================================
            # 5. PAGO (SEÑA)
            # =====================================================
            if pago and pago.get("registrar"):
                pagos_service.registrar_pago(
                    conn,
                    {
                        "id_sucursal": data["id_sucursal"],
                        "id_cliente": data["id_cliente"],
                        "monto": pago["monto"],
                        "medio_pago": pago["medio_pago"],
                        "origen_tipo": "reserva",
                        "origen_id": reserva_id,
                        "nota": pago.get("nota"),
                        "id_usuario": data["id_usuario"],
                    },
                )

            # =====================================================
            # 6. EVENTO
            # =====================================================
            reserva_repo.insert_reserva_evento(
                conn,
                reserva_id,
                "creada",
                "Reserva creada correctamente",
                data["id_usuario"],
            )

        return {
            "ok": True,
            "reserva_id": reserva_id,
            "estado": "activa",
            "total_estimado": total_estimado,
            "sena_total": sena,
            "saldo_estimado": saldo,
        }

    finally:
        conn.close()

# =========================================================
# CANCELAR RESERVA
# =========================================================

def cancelar_reserva(data: dict):
    conn = get_connection()

    try:
        with conn.transaction():
            # =====================================================
            # 1. LOCK RESERVA
            # =====================================================
            reserva = reserva_repo.get_reserva_by_id_for_update(conn, data["id_reserva"])

            if not reserva:
                raise HTTPException(status_code=404, detail="Reserva no encontrada")

            _validar_estado_cancelable(reserva)

            # =====================================================
            # 2. ITEMS
            # =====================================================
            items = reserva_repo.get_reserva_items(conn, data["id_reserva"])

            # =====================================================
            # 3. LIBERAR SERIALIZADAS + STOCK
            # =====================================================
            for item in items:
                bicicleta_id = item.get("id_bicicleta_serializada")

                if bicicleta_id is not None:
                    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

                    if bicicleta is None:
                        raise HTTPException(
                            status_code=400,
                            detail=f"No existe la bicicleta serializada {bicicleta_id}",
                        )

                    if bicicleta["estado"] != "reservada":
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"La bicicleta serializada {bicicleta_id} "
                                f"debe estar en estado reservada para cancelar la reserva"
                            ),
                        )

                    update_bicicleta_serializada_estado(conn, bicicleta_id, "disponible")

                stock_service.liberar_stock_reservado(
                    conn,
                    {
                        "id_sucursal": reserva["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": item["cantidad"],
                        "id_usuario": data["id_usuario"],
                        "origen_tipo": "reserva",
                        "origen_id": data["id_reserva"],
                        "nota": "Cancelación de reserva",
                    },
                )

            # =====================================================
            # 4. UPDATE RESERVA
            # =====================================================
            reserva_repo.update_reserva_cancelacion(
                conn,
                data["id_reserva"],
                sena_perdida=data.get("sena_perdida", False),
            )

            # =====================================================
            # 5. EVENTO
            # =====================================================
            reserva_repo.insert_reserva_evento(
                conn,
                data["id_reserva"],
                "cancelada",
                data.get("motivo", "Cancelación manual"),
                data["id_usuario"],
            )

        return {
            "ok": True,
            "reserva_id": data["id_reserva"],
            "estado": "cancelada",
        }

    finally:
        conn.close()

# =========================================================
# CONSULTAS
# =========================================================

def listar_reservas(**filters):
    conn = get_connection()
    try:
        return reserva_repo.list_reservas(conn, **filters)
    finally:
        conn.close()


def obtener_reserva(reserva_id: int):
    conn = get_connection()
    try:
        reserva = reserva_repo.get_reserva_by_id(conn, reserva_id)

        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        return {
            "reserva": reserva,
            "items": reserva_repo.get_reserva_items(conn, reserva_id),
            "eventos": reserva_repo.get_reserva_eventos(conn, reserva_id),
            "pagos": reserva_repo.get_reserva_pagos(conn, reserva_id),
        }
    finally:
        conn.close()

def marcar_reserva_vencida(reserva_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            reserva = reserva_repo.get_reserva_by_id_for_update(conn, reserva_id)

            if not reserva:
                raise HTTPException(status_code=404, detail="Reserva no encontrada")

            if reserva["estado"] != "activa":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Solo se puede vencer una reserva activa. "
                        f"Estado actual: {reserva['estado']}"
                    ),
                )

            items = reserva_repo.get_reserva_items(conn, reserva_id)

            for item in items:
                bicicleta_id = item.get("id_bicicleta_serializada")

                if bicicleta_id is not None:
                    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

                    if bicicleta is None:
                        raise HTTPException(
                            status_code=400,
                            detail=f"No existe la bicicleta serializada {bicicleta_id}",
                        )

                    if bicicleta["estado"] != "reservada":
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"La bicicleta serializada {bicicleta_id} "
                                f"debe estar en estado reservada para vencer la reserva"
                            ),
                        )

                    update_bicicleta_serializada_estado(conn, bicicleta_id, "disponible")

                stock_service.liberar_stock_reservado(
                    conn,
                    {
                        "id_sucursal": reserva["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": item["cantidad"],
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "reserva",
                        "origen_id": reserva_id,
                        "nota": "Reserva vencida",
                    },
                )

            reserva_repo.update_reserva_estado(conn, reserva_id, "vencida")

            reserva_repo.insert_reserva_evento(
                conn,
                reserva_id,
                "vencida",
                getattr(data, "detalle", None),
                data.id_usuario,
            )

        return {
            "ok": True,
            "reserva_id": reserva_id,
            "estado": "vencida",
        }

    finally:
        conn.close()
    
def convertir_reserva_en_venta(reserva_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            # =====================================================
            # 1. LOCK RESERVA
            # =====================================================
            reserva = reserva_repo.get_reserva_by_id_for_update(conn, reserva_id)

            if not reserva:
                raise HTTPException(status_code=404, detail="Reserva no encontrada")

            if reserva["estado"] != "activa":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Solo se pueden convertir reservas activas. "
                        f"Estado actual: {reserva['estado']}"
                    ),
                )

            # =====================================================
            # 2. ITEMS DE RESERVA
            # =====================================================
            items = reserva_repo.get_reserva_items(conn, reserva_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail="La reserva no tiene items",
                )

            sena = to_decimal(reserva["sena_total"] or 0)
            saldo = to_decimal(reserva["saldo_estimado"] or 0)
            total = sena + saldo

            # =====================================================
            # 3. VALIDAR SERIALIZADAS RESERVADAS
            # =====================================================
            for item in items:
                bicicleta_id = item.get("id_bicicleta_serializada")
                if bicicleta_id is not None:
                    _validar_y_bloquear_bicicleta_serializada_reservada_para_conversion(
                        conn,
                        id_bicicleta_serializada=bicicleta_id,
                        id_variante=item["id_variante"],
                        id_sucursal=reserva["id_sucursal"],
                    )

            # =====================================================
            # 4. CREAR VENTA
            # =====================================================
            estado_venta = "pagada_parcial" if saldo > Decimal("0") else "pagada_total"

            venta_id = ventas_repo.insert_venta(
                conn,
                {
                    "id_sucursal": reserva["id_sucursal"],
                    "id_cliente": reserva["id_cliente"],
                    "estado": estado_venta,
                    "subtotal_base": total,
                    "descuento_total": Decimal("0"),
                    "recargo_total": Decimal("0"),
                    "total_final": total,
                    "saldo_pendiente": saldo,
                    "id_usuario_creador": data.id_usuario,
                    "observaciones": getattr(data, "observaciones", None),
                    "id_reserva_origen": reserva_id,
                },
            )

            # =====================================================
            # 5. ITEMS + SERIALIZADAS + STOCK
            # =====================================================
            for item in items:
                precio_estimado = to_decimal(item["precio_estimado"])
                costo_promedio = to_decimal(item["costo_promedio_vigente"] or 0)
                subtotal_estimado = to_decimal(item["subtotal_estimado"])

                ventas_repo.insert_venta_item(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_variante": item["id_variante"],
                        "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                        "descripcion_snapshot": item.get("descripcion_snapshot"),
                        "cantidad": item["cantidad"],
                        "precio_lista": precio_estimado,
                        "precio_final": precio_estimado,
                        "costo_unitario_aplicado": costo_promedio,
                        "subtotal": subtotal_estimado,
                    },
                )

                bicicleta_id = item.get("id_bicicleta_serializada")
                if bicicleta_id is not None:
                    update_bicicleta_serializada_estado(
                        conn,
                        bicicleta_id,
                        "vendida_pendiente_entrega",
                    )

                stock_service.marcar_stock_pendiente_entrega(
                    conn,
                    {
                        "id_sucursal": reserva["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": item["cantidad"],
                        "id_usuario": data.id_usuario,
                        "descontar_de_reservado": True,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "nota": f"Reserva #{reserva_id} convertida en venta #{venta_id}",
                    },
                )

            # =====================================================
            # 6. ACTUALIZAR RESERVA
            # =====================================================
            reserva_repo.update_reserva_estado(conn, reserva_id, "convertida_en_venta")

            reserva_repo.insert_reserva_evento(
                conn,
                reserva_id,
                "convertida_en_venta",
                f"Convertida en venta #{venta_id}",
                data.id_usuario,
            )

        return {
            "ok": True,
            "reserva_id": reserva_id,
            "venta_id": venta_id,
            "estado_reserva": "convertida_en_venta",
        }

    finally:
        conn.close()