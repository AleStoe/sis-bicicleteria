from fastapi import HTTPException
from decimal import Decimal

from app.db.connection import get_connection
from app.modules.reglas_comerciales.repository import (
    get_reglas_activas_por_medios,
    get_tarjeta_planes,
)

from .repository import (
    get_venta_comprobante_by_id,
    get_venta_items_comprobante_by_venta_id,
    get_pagos_comprobante_by_venta_id,
    get_creditos_comprobante_by_venta_id,
    get_pago_recibo_by_id,
    get_resumen_cobros_venta_by_id,
    get_resumen_cobros_pagos_by_venta_id,
    get_resumen_cobros_creditos_by_venta_id,
    get_resumen_cobros_items_preview_by_venta_id,
    get_cliente_estado_deuda_by_id,
    get_deudas_estado_cuenta_by_cliente_id,
    get_deuda_movimientos_estado_cuenta_by_cliente_id,
    get_venta_items_estado_deuda_by_cliente_id,
)
from .repository_taller_presupuesto import (
    get_orden_taller_presupuesto_by_id,
    get_orden_taller_items_presupuesto_by_orden_id,
    get_notas_hoja_reparacion_taller,
    get_notas_visibles_presupuesto_taller,
)
from app.modules.cotizaciones.repository import (
    get_cotizacion_by_id,
    get_cotizacion_items,
)
from app.modules.pedidos_cliente import repository as pedidos_cliente_repository
from app.modules.pagos.repository import sincronizar_venta_financiera_desde_pagos
from .repository_etiquetas import (
    get_bicicleta_etiqueta_by_id,
    get_variante_etiqueta_by_id,
)


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def _resumen_paquete_taller(ordenes: list[dict]) -> dict:
    resumen = {
        "ordenes": len(ordenes),
        "items": 0,
        "servicios": 0,
        "repuestos": 0,
        "items_sin_costo": 0,
        "mano_obra": Decimal("0"),
        "repuestos_venta": Decimal("0"),
        "costo_repuestos": Decimal("0"),
        "margen_repuestos": Decimal("0"),
        "total_cliente": Decimal("0"),
        "ganancia_estimada": Decimal("0"),
    }

    for orden in ordenes:
        items = orden.get("items") or []
        for item in items:
            if item.get("etapa") == "cancelado":
                continue

            cantidad = _dec(item.get("cantidad"))
            subtotal = _dec(item.get("subtotal"))
            es_servicio = item.get("tipo_item") == "servicio"

            resumen["items"] += 1
            if es_servicio:
                resumen["servicios"] += 1
                resumen["mano_obra"] += subtotal
                continue

            resumen["repuestos"] += 1
            resumen["repuestos_venta"] += subtotal
            if item.get("costo_unitario_aplicado") is None:
                resumen["items_sin_costo"] += 1
            resumen["costo_repuestos"] += _dec(item.get("costo_unitario_aplicado")) * cantidad

    resumen["margen_repuestos"] = resumen["repuestos_venta"] - resumen["costo_repuestos"]
    resumen["total_cliente"] = resumen["mano_obra"] + resumen["repuestos_venta"]
    resumen["ganancia_estimada"] = resumen["mano_obra"] + resumen["margen_repuestos"]
    return resumen


def _opciones_pago_etiquetas(conn):
    reglas = get_reglas_activas_por_medios(conn, ["efectivo", "transferencia"])
    planes = get_tarjeta_planes(conn, solo_activos=True)

    opciones_contado = []
    for medio in ["efectivo", "transferencia"]:
        descuento = sum(
            _dec(regla.get("porcentaje"))
            for regla in reglas
            if regla.get("tipo") == "descuento"
            and regla.get("porcentaje") is not None
            and regla.get("medio_pago") in {None, medio}
        )

        opciones_contado.append(
            {
                "medio_pago": medio,
                "label": "Efectivo" if medio == "efectivo" else "Transferencia",
                "porcentaje_descuento": descuento,
            }
        )

    opciones_tarjeta = [
        {
            "label": plan["nombre"],
            "cuotas": int(plan["cuotas"]),
            "porcentaje_recargo": _dec(plan["porcentaje_recargo_cliente"]),
        }
        for plan in planes
        if plan.get("medio_pago") == "tarjeta"
    ]

    return {
        "contado": opciones_contado,
        "tarjeta": opciones_tarjeta,
    }


def obtener_datos_comprobante_x_venta(venta_id: int):
    conn = get_connection()

    try:
        sincronizar_venta_financiera_desde_pagos(conn, venta_id)
        conn.commit()
        venta = get_venta_comprobante_by_id(conn, venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {venta_id}",
            )

        items = get_venta_items_comprobante_by_venta_id(
            conn,
            venta_id,
        )

        if not items:
            raise HTTPException(
                status_code=400,
                detail="La venta no tiene items para imprimir",
            )
        pagos = get_pagos_comprobante_by_venta_id(
            conn,
            venta_id,
        )
        creditos = get_creditos_comprobante_by_venta_id(
            conn,
            venta_id,
        )
        return {
            "venta": venta,
            "items": items,
            "pagos": [*pagos, *creditos],
        }

    finally:
        conn.close()
    
def obtener_datos_recibo_pago(pago_id: int):
    conn = get_connection()

    try:
        pago = get_pago_recibo_by_id(conn, pago_id)

        if pago is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el pago {pago_id}",
            )

        return {
            "pago": pago,
        }

    finally:
        conn.close()

def obtener_datos_resumen_cobros_venta(venta_id: int):
    conn = get_connection()

    try:
        venta = get_resumen_cobros_venta_by_id(conn, venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {venta_id}",
            )

        pagos = get_resumen_cobros_pagos_by_venta_id(conn, venta_id)
        creditos = get_resumen_cobros_creditos_by_venta_id(conn, venta_id)
        items_preview = get_resumen_cobros_items_preview_by_venta_id(conn, venta_id)

        return {
            "venta": venta,
            "pagos": [*pagos, *creditos],
            "items_preview": items_preview,
        }

    finally:
        conn.close()


def obtener_datos_presupuesto_taller(orden_id: int):
    conn = get_connection()

    try:
        orden = get_orden_taller_presupuesto_by_id(conn, orden_id)

        if orden is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la orden de taller {orden_id}",
            )

        items = get_orden_taller_items_presupuesto_by_orden_id(conn, orden_id)
        notas = get_notas_visibles_presupuesto_taller(conn, orden_id)

        if not items:
            raise HTTPException(
                status_code=400,
                detail="La orden de taller no tiene items para presupuestar",
            )

        return {
            "orden": orden,
            "items": items,
            "notas": notas,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()


def obtener_datos_hoja_reparacion_taller(orden_id: int):
    conn = get_connection()

    try:
        orden = get_orden_taller_presupuesto_by_id(conn, orden_id)

        if orden is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la orden de taller {orden_id}",
            )

        return {
            "orden": orden,
            "items": get_orden_taller_items_presupuesto_by_orden_id(conn, orden_id),
            "notas": get_notas_hoja_reparacion_taller(conn, orden_id),
        }

    finally:
        conn.close()


def obtener_datos_paquete_trabajo_taller(orden_ids: list[int]):
    ids_limpios = []
    for orden_id in orden_ids:
        if orden_id > 0 and orden_id not in ids_limpios:
            ids_limpios.append(orden_id)

    if not ids_limpios:
        raise HTTPException(
            status_code=400,
            detail="Seleccioná al menos una orden de taller",
        )

    conn = get_connection()

    try:
        ordenes = []
        for orden_id in ids_limpios:
            orden = get_orden_taller_presupuesto_by_id(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            ordenes.append({
                **dict(orden),
                "items": get_orden_taller_items_presupuesto_by_orden_id(conn, orden_id),
                "notas": get_notas_hoja_reparacion_taller(conn, orden_id),
            })

        return {
            "ordenes": ordenes,
            "resumen": _resumen_paquete_taller(ordenes),
        }

    finally:
        conn.close()


def obtener_datos_cotizacion_pdf(cotizacion_id: int):
    conn = get_connection()

    try:
        cotizacion = get_cotizacion_by_id(conn, cotizacion_id)

        if cotizacion is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la cotizacion {cotizacion_id}",
            )

        items = get_cotizacion_items(conn, cotizacion_id)

        return {
            "cotizacion": cotizacion,
            "items": items,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()


def obtener_datos_pedido_cliente_pdf(pedido_id: int):
    conn = get_connection()

    try:
        pedido = pedidos_cliente_repository.get_pedido(conn, pedido_id)

        if pedido is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el pedido {pedido_id}",
            )

        return {
            **dict(pedido),
            "items": pedidos_cliente_repository.list_items(
                conn,
                pedido_id,
                pedido["id_sucursal"],
            ),
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()


def obtener_datos_estado_deuda_cliente_pdf(cliente_id: int):
    conn = get_connection()

    try:
        cliente = get_cliente_estado_deuda_by_id(conn, cliente_id)

        if cliente is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el cliente {cliente_id}",
            )

        deudas = get_deudas_estado_cuenta_by_cliente_id(conn, cliente_id)
        movimientos = get_deuda_movimientos_estado_cuenta_by_cliente_id(conn, cliente_id)
        items = get_venta_items_estado_deuda_by_cliente_id(conn, cliente_id)

        movimientos_por_deuda = {}
        for movimiento in movimientos:
            movimientos_por_deuda.setdefault(movimiento["id_deuda"], []).append(movimiento)

        items_por_deuda = {}
        for item in items:
            items_por_deuda.setdefault(item["deuda_id"], []).append(item)

        return {
            "cliente": cliente,
            "deudas": deudas,
            "movimientos_por_deuda": movimientos_por_deuda,
            "items_por_deuda": items_por_deuda,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()


def obtener_datos_etiqueta_variante(variante_id: int):
    conn = get_connection()

    try:
        item = get_variante_etiqueta_by_id(conn, variante_id)

        if item is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante {variante_id}",
            )

        return {
            "tipo": "variante",
            "item": item,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()


def obtener_datos_etiqueta_bicicleta(bicicleta_id: int):
    conn = get_connection()

    try:
        item = get_bicicleta_etiqueta_by_id(conn, bicicleta_id)

        if item is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la bicicleta serializada {bicicleta_id}",
            )

        return {
            "tipo": "bicicleta",
            "item": item,
            "opciones_pago": _opciones_pago_etiquetas(conn),
        }

    finally:
        conn.close()
