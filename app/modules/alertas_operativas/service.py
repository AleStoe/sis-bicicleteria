from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.authz.service import exigir_rol_admin
from app.shared.money import redondear_monto

from .repository import (
    get_bicis_listas_hace_dias,
    get_cajas_abiertas_anteriores,
    get_deudas_vencidas,
    get_maestros_inactivos_en_uso,
    get_pagos_revertidos_hoy,
    get_productos_maestros_incompletos,
    get_reservas_vencidas,
    get_stock_critico,
    get_taller_atrasado,
    get_venta_y_deuda_formal_for_update,
    get_ventas_cobradas_no_entregadas,
    get_ventas_saldo_desincronizado_con_deuda,
    get_ventas_saldo_sin_deuda_formal,
    update_venta_saldo_pendiente,
)


def _separar_alertas_stock(items):
    reponer_ahora = []
    stock_bajo = []
    for row in items:
        item = dict(row)
        unidades = Decimal(str(item["unidades_90d"]))
        disponible = Decimal(str(item["stock_disponible"]))
        ventas = int(item["ventas_90d"])
        demanda_mensual = unidades / Decimal(3)
        es_recurrente = unidades >= 3 and ventas >= 2
        if not item["es_bicicleta"] and es_recurrente and disponible < demanda_mensual:
            item["motivo_reposicion"] = "Demanda repetida; menos de un mes de cobertura"
            reponer_ahora.append(item)
        else:
            item["motivo_reposicion"] = (
                "Bicicleta: revisar reposicion manualmente"
                if item["es_bicicleta"] else "Sin demanda recurrente o con cobertura suficiente"
            )
            stock_bajo.append(item)
    reponer_ahora.sort(key=lambda item: (
        Decimal(str(item["stock_disponible"])) > 0,
        -Decimal(str(item["unidades_90d"])),
        item["producto_nombre"],
    ))
    stock_bajo.sort(key=lambda item: (
        Decimal(str(item["stock_disponible"])),
        item["producto_nombre"],
    ))
    return reponer_ahora, stock_bajo


def obtener_alertas_operativas(dias_lista_retiro: int = 7, stock_umbral: int = 2):
    conn = get_connection()
    try:
        stock_critico = get_stock_critico(conn, umbral=stock_umbral)
        reponer_ahora, stock_bajo = _separar_alertas_stock(stock_critico)
        data = {
            "bicis_listas": get_bicis_listas_hace_dias(conn, dias=dias_lista_retiro),
            "reservas_vencidas": get_reservas_vencidas(conn),
            "deudas_vencidas": get_deudas_vencidas(conn),
            "taller_atrasado": get_taller_atrasado(conn),
            "reponer_ahora": reponer_ahora,
            "stock_bajo": stock_bajo,
            "stock_critico": stock_critico,
            "ventas_cobradas_no_entregadas": get_ventas_cobradas_no_entregadas(conn),
            "ventas_saldo_sin_deuda": get_ventas_saldo_sin_deuda_formal(conn),
            "ventas_saldo_desincronizado": get_ventas_saldo_desincronizado_con_deuda(conn),
            "pagos_revertidos_hoy": get_pagos_revertidos_hoy(conn),
            "cajas_abiertas_anteriores": get_cajas_abiertas_anteriores(conn),
            "productos_maestros_incompletos": get_productos_maestros_incompletos(conn),
            "maestros_inactivos_en_uso": get_maestros_inactivos_en_uso(conn),
        }
        data["resumen"] = {key: len(value) for key, value in data.items()}
        return data
    finally:
        conn.close()


def sincronizar_saldo_venta_desde_deuda(venta_id: int, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():
            exigir_rol_admin(conn, id_usuario)
            relacion = get_venta_y_deuda_formal_for_update(conn, venta_id)

            if relacion is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "La venta no tiene una deuda formal asociada. "
                        "Revisá la venta antes de corregir el saldo."
                    ),
                )

            if relacion["estado"] in {"anulada", "devuelta"}:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede sincronizar una venta anulada o devuelta.",
                )

            saldo_anterior = redondear_monto(relacion["saldo_pendiente"])
            saldo_deuda = redondear_monto(relacion["deuda_saldo_actual"])
            venta = update_venta_saldo_pendiente(conn, venta_id, saldo_deuda)

            auditoria_service.registrar_evento(
                conn,
                id_usuario=id_usuario,
                id_sucursal=relacion["id_sucursal"],
                entidad="venta",
                entidad_id=venta_id,
                accion="sincronizar_saldo_venta_desde_deuda",
                detalle=(
                    f"Saldo de venta sincronizado desde deuda #{relacion['deuda_id']}. "
                    f"saldo_anterior={saldo_anterior}, saldo_nuevo={saldo_deuda}"
                ),
                metadata={
                    "tipo": "reparacion_salud_operativa",
                    "venta_id": venta_id,
                    "deuda_id": relacion["deuda_id"],
                    "saldo_anterior": str(saldo_anterior),
                    "saldo_nuevo": str(saldo_deuda),
                },
                origen_tipo="deuda",
                origen_id=relacion["deuda_id"],
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "deuda_id": relacion["deuda_id"],
            "saldo_anterior": saldo_anterior,
            "saldo_pendiente": venta["saldo_pendiente"],
        }
    finally:
        conn.close()
