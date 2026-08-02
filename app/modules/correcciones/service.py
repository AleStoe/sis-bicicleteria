from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)
from app.modules.capital_retiros.repository import insert_historial
from app.shared.constants import (
    AUDITORIA_ACCION_CORRECCION_APLICADA,
    AUDITORIA_ENTIDAD_CORRECCION,
)

from .repository import (
    get_cajas_abiertas_anteriores,
    get_capital_sin_caja,
    get_creditos_anulacion_dudosos,
    get_movimiento_capital_correccion_for_update,
    get_ventas_items_costos_sospechosos,
    get_ventas_saldo_sin_deuda,
    vincular_capital_a_caja,
)


TIPOS_CAPITAL_SALIDA_CAJA = {
    "devolucion_prestamo",
    "retiro_personal",
    "distribucion_ganancia",
}
ORIGEN_CORRECCION = "correccion_operativa"


def obtener_correcciones_pendientes():
    conn = get_connection()
    try:
        return {
            "capital_sin_caja": get_capital_sin_caja(conn),
            "ventas_saldo_sin_deuda": get_ventas_saldo_sin_deuda(conn),
            "creditos_anulacion_dudosos": get_creditos_anulacion_dudosos(conn),
            "cajas_abiertas_anteriores": get_cajas_abiertas_anteriores(conn),
            "costos_sospechosos": get_ventas_items_costos_sospechosos(conn),
        }
    finally:
        conn.close()


def corregir_capital_sin_caja(movimiento_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            movimiento = get_movimiento_capital_correccion_for_update(conn, movimiento_id)
            if movimiento is None:
                raise HTTPException(status_code=404, detail=f"No existe el movimiento {movimiento_id}")
            if movimiento["estado"] != "activo":
                raise HTTPException(status_code=400, detail="El movimiento de capital no está activo")
            if movimiento["tipo_movimiento"] not in TIPOS_CAPITAL_SALIDA_CAJA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se corrigen salidas de capital que debieron impactar caja",
                )
            if movimiento["impacta_caja"] or movimiento["id_caja_movimiento"]:
                raise HTTPException(
                    status_code=400,
                    detail="El movimiento ya está vinculado a caja",
                )
            if movimiento["id_sucursal"] is None:
                raise HTTPException(
                    status_code=400,
                    detail="El movimiento no tiene sucursal para buscar caja abierta",
                )

            caja = get_caja_abierta_hoy_by_sucursal_for_update(conn, movimiento["id_sucursal"])
            if caja is None:
                raise HTTPException(
                    status_code=400,
                    detail="No hay caja abierta para registrar la corrección",
                )

            submedio = movimiento["medio_pago"] or "efectivo"
            nota = (
                f"Corrección Capital y Retiros #{movimiento_id}: "
                f"{movimiento['descripcion']}. Motivo: {data.motivo}"
            )
            caja_movimiento_id = insert_caja_movimiento(
                conn,
                id_caja=caja["id"],
                tipo_movimiento="egreso",
                submedio=submedio,
                monto=movimiento["monto"],
                origen_tipo=ORIGEN_CORRECCION,
                origen_id=movimiento_id,
                nota=nota,
                id_usuario=data.id_usuario,
            )

            vincular_capital_a_caja(conn, movimiento_id, caja_movimiento_id)
            insert_historial(
                conn,
                {
                    "id_movimiento": movimiento_id,
                    "tipo_evento": "correccion_caja",
                    "monto": movimiento["monto"],
                    "detalle": data.motivo,
                    "origen_tipo": ORIGEN_CORRECCION,
                    "origen_id": caja_movimiento_id,
                    "id_usuario": data.id_usuario,
                },
            )
            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=movimiento["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CORRECCION,
                entidad_id=movimiento_id,
                accion=AUDITORIA_ACCION_CORRECCION_APLICADA,
                detalle=(
                    f"Corrección aplicada a Capital/Retiros #{movimiento_id}. "
                    f"Se generó movimiento de caja #{caja_movimiento_id}."
                ),
                metadata={
                    "tipo": "capital_sin_caja",
                    "movimiento_id": movimiento_id,
                    "caja_id": caja["id"],
                    "caja_movimiento_id": caja_movimiento_id,
                    "monto": str(movimiento["monto"]),
                    "medio_pago": submedio,
                    "motivo": data.motivo,
                },
                origen_tipo=ORIGEN_CORRECCION,
                origen_id=caja_movimiento_id,
            )

        return {
            "ok": True,
            "movimiento_id": movimiento_id,
            "caja_movimiento_id": caja_movimiento_id,
        }
    finally:
        conn.close()


def validar_capital_sin_caja(movimiento_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            movimiento = get_movimiento_capital_correccion_for_update(conn, movimiento_id)
            if movimiento is None:
                raise HTTPException(status_code=404, detail=f"No existe el movimiento {movimiento_id}")
            if movimiento["estado"] != "activo":
                raise HTTPException(status_code=400, detail="El movimiento de capital no estÃ¡ activo")
            if movimiento["tipo_movimiento"] not in TIPOS_CAPITAL_SALIDA_CAJA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se validan salidas de capital registradas sin caja",
                )
            if movimiento["impacta_caja"] or movimiento["id_caja_movimiento"]:
                raise HTTPException(
                    status_code=400,
                    detail="El movimiento ya estÃ¡ vinculado a caja",
                )

            historial_id = insert_historial(
                conn,
                {
                    "id_movimiento": movimiento_id,
                    "tipo_evento": "validacion_sin_caja",
                    "monto": movimiento["monto"],
                    "detalle": data.motivo,
                    "origen_tipo": ORIGEN_CORRECCION,
                    "origen_id": movimiento_id,
                    "id_usuario": data.id_usuario,
                },
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=movimiento["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CORRECCION,
                entidad_id=movimiento_id,
                accion=AUDITORIA_ACCION_CORRECCION_APLICADA,
                detalle=(
                    f"Capital/Retiros #{movimiento_id} validado como salida fuera de caja. "
                    f"No se generÃ³ movimiento de caja."
                ),
                metadata={
                    "tipo": "capital_sin_caja_validado",
                    "movimiento_id": movimiento_id,
                    "monto": str(movimiento["monto"]),
                    "medio_pago": movimiento["medio_pago"],
                    "motivo": data.motivo,
                },
                origen_tipo=ORIGEN_CORRECCION,
                origen_id=movimiento_id,
            )

        return {
            "ok": True,
            "movimiento_id": movimiento_id,
            "historial_id": historial_id,
        }
    finally:
        conn.close()
