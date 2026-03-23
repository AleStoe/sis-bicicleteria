from decimal import Decimal
from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.stock import service as stock_service
from app.modules.reservas import repository as reserva_repo
from app.modules.pagos import service as pagos_service
from app.modules.ventas import repository as ventas_repo



# =========================================================
# HELPERS
# =========================================================

def _validar_estado_cancelable(reserva):
    if reserva["estado"] in ["cancelada", "convertida_en_venta"]:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cancelar una reserva en estado {reserva['estado']}",
        )


# =========================================================
# CREAR RESERVA
# =========================================================

def crear_reserva(data):
    data = data.model_dump()
    conn = get_connection()
    try:
        total_estimado = Decimal("0")

        # =====================================================
        # 1. VALIDAR STOCK (ANTES)
        # =====================================================
        for item in data["items"]:
            stock = stock_service.obtener_stock_disponible_tx(
                conn,
                id_sucursal=data["id_sucursal"],
                id_variante=item["id_variante"],
            )

            if Decimal(str(stock["stock_disponible"])) < Decimal(str(item["cantidad"])):
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para variante {item['id_variante']}",
                )

        # =====================================================
        # 2. CREAR RESERVA
        # =====================================================
        reserva_id = reserva_repo.insert_reserva(conn, data)

        # =====================================================
        # 3. ITEMS + STOCK
        # =====================================================
        for item in data["items"]:
            subtotal = Decimal(str(item["cantidad"])) * Decimal(str(item["precio_estimado"]))
            total_estimado += subtotal

            reserva_repo.insert_reserva_item(
                conn,
                {
                    "id_reserva": reserva_id,
                    "id_variante": item["id_variante"],
                    "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                    "cantidad": item["cantidad"],
                    "precio_estimado": item["precio_estimado"],
                    "subtotal_estimado": float(subtotal),
                },
            )

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
            sena = Decimal(str(pago["monto"]))

        saldo = total_estimado - sena

        reserva_repo.actualizar_totales_reserva(
            conn,
            reserva_id,
            float(total_estimado),
            float(sena),
            float(saldo),
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
                    "monto": float(pago["monto"]),
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

        conn.commit()

        return {
            "ok": True,
            "reserva_id": reserva_id,
            "estado": "activa",
            "total_estimado": float(total_estimado),
            "sena_total": float(sena),
            "saldo_estimado": float(saldo),
        }

    except Exception as e:
        conn.rollback()
        raise e

    finally:
        conn.close()


# =========================================================
# CANCELAR RESERVA
# =========================================================

def cancelar_reserva(data: dict):
    conn = get_connection()

    try:
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
        # 3. LIBERAR STOCK
        # =====================================================
        for item in items:
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

        conn.commit()

        return {
            "ok": True,
            "reserva_id": data["id_reserva"],
            "estado": "cancelada",
        }

    except Exception as e:
        conn.rollback()
        raise e

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
        reserva = reserva_repo.get_reserva_by_id_for_update(conn, reserva_id)

        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        if reserva["estado"] != "activa":
            raise HTTPException(
                status_code=400,
                detail=f"Solo se puede vencer una reserva activa. Estado actual: {reserva['estado']}",
            )

        reserva_repo.update_reserva_estado(conn, reserva_id, "vencida")

        reserva_repo.insert_reserva_evento(
            conn,
            reserva_id,
            "vencida",
            getattr(data, "detalle", None),
            data.id_usuario,
        )

        conn.commit()

        return {
                "ok": True,
                "reserva_id": reserva_id,
                "estado": "vencida",
            }

    except Exception as e:
        conn.rollback()
        raise e

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
                    detail=f"Solo se pueden convertir reservas activas. Estado actual: {reserva['estado']}",
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

            sena = Decimal(str(reserva["sena_total"] or 0))
            saldo = Decimal(str(reserva["saldo_estimado"] or 0))
            total = sena + saldo

            # =====================================================
            # 3. CREAR VENTA
            # =====================================================
            venta_id = ventas_repo.insert_venta(
                conn,
                {
                    "id_sucursal": reserva["id_sucursal"],
                    "id_cliente": reserva["id_cliente"],
                    "estado": "pagada_parcial" if saldo > 0 else "pagada_total",
                    "subtotal_base": float(total),
                    "descuento_total": 0,
                    "recargo_total": 0,
                    "total_final": float(total),
                    "saldo_pendiente": float(saldo),
                    "id_usuario_creador": data.id_usuario,
                    "observaciones": getattr(data, "observaciones", None),
                    "id_reserva_origen": reserva_id,
                },
            )

            # =====================================================
            # 4. ITEMS + STOCK
            # =====================================================
            for item in items:

                ventas_repo.insert_venta_item(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_variante": item["id_variante"],
                        "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                        "descripcion_snapshot": item.get("descripcion_snapshot"),
                        "cantidad": float(item["cantidad"]),
                        "precio_lista": float(item["precio_estimado"]),
                        "precio_final": float(item["precio_estimado"]),
                        "costo_unitario_aplicado": float(item["costo_promedio_vigente"] or 0),
                        "subtotal": float(item["subtotal_estimado"]),
                    },
                )

                # 🔥 CLAVE: mover stock reservado → vendido pendiente
                stock_service.marcar_stock_pendiente_entrega(
                    conn,
                    {
                        "id_sucursal": reserva["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": float(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "descontar_de_reservado": True,  # 👈 esto es CLAVE
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "nota": f"Reserva #{reserva_id} convertida en venta #{venta_id}",
                    },
                )

            # =====================================================
            # 5. ACTUALIZAR RESERVA
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