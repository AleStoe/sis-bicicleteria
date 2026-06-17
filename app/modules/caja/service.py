from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from app.modules.authz.service import (
    exigir_permiso_cerrar_caja,
    exigir_permiso_ajustar_caja,
)
from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from .schema import CajaAbrirInput, CajaCerrarInput, CajaEgresoInput, CajaAjusteInput
from .repository import (
    close_caja,
    get_caja_abierta_hoy_by_sucursal,
    get_caja_by_id,
    get_caja_by_id_for_update,
    get_caja_movimientos,
    get_efectivo_teorico,
    get_sucursal_by_id,
    get_totales_por_submedio,
    insert_caja,
    insert_caja_movimiento,
    get_cajas_historial,
    get_caja_del_dia,
    get_documentos_disponibles_dia,
    get_resumen_movimientos_caja,
    get_resumen_pagos_caja,
    get_resumen_rentabilidad_dia,
)
from app.shared.business_rules import (
    LIMITE_AJUSTE_CAJA,
    LIMITE_EGRESO_CAJA,
)
from app.shared.constants import (
    AUDITORIA_ENTIDAD_CAJA,
    AUDITORIA_ACCION_CAJA_EGRESO,
    AUDITORIA_ACCION_CAJA_CERRADA,
    AUDITORIA_ACCION_CAJA_AJUSTE,
    CAJA_ESTADO_ABIERTA,
    CAJA_ESTADO_CERRADA,
    CAJA_MOVIMIENTO_EGRESO,
    CAJA_MOVIMIENTO_AJUSTE,
    CAJA_ORIGEN_EGRESO_MANUAL,
    CAJA_ORIGEN_AJUSTE_MANUAL,
)
LIMITE_AJUSTE_CAJA = Decimal("500000")
SUBMEDIOS = ("efectivo", "transferencia", "mercadopago", "tarjeta")


def _validar_sucursal(conn, id_sucursal: int):
    sucursal = get_sucursal_by_id(conn, id_sucursal)

    if sucursal is None:
        raise HTTPException(status_code=400, detail=f"No existe la sucursal {id_sucursal}")

    if not sucursal["activa"]:
        raise HTTPException(status_code=400, detail=f"La sucursal {id_sucursal} está inactiva")

    return sucursal


def _mapear_totales(rows):
    totales = {submedio: Decimal("0") for submedio in SUBMEDIOS}

    for row in rows:
        submedio = row["submedio"]
        if submedio in totales:
            totales[submedio] = row["total"]

    return totales


def abrir_caja(data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_sucursal(conn, data.id_sucursal)

            existente = get_caja_abierta_hoy_by_sucursal(conn, data.id_sucursal)
            if existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Ya hay una caja abierta para la sucursal {data.id_sucursal}. "
                        "Cerrá la caja abierta antes de abrir una nueva."
                    ),
                )

            caja_id = insert_caja(
                conn,
                data.id_sucursal,
                data.monto_apertura,
                data.id_usuario,
            )

        return {"ok": True, "caja_id": caja_id, "estado": CAJA_ESTADO_ABIERTA}
    finally:
        conn.close()


def obtener_caja_abierta(id_sucursal: int):
    conn = get_connection()

    try:
        caja = get_caja_abierta_hoy_by_sucursal(conn, id_sucursal)
        if caja is None:
            raise HTTPException(
                status_code=404,
                detail=f"No hay caja abierta para la sucursal {id_sucursal}",
            )

        efectivo_teorico = get_efectivo_teorico(conn, caja["id"])
        totales = get_totales_por_submedio(conn, caja["id"])

        return {
            "caja": caja,
            "efectivo_teorico": efectivo_teorico,
            "totales_por_submedio": totales,
        }
    finally:
        conn.close()


def obtener_caja_detalle(caja_id: int):
    conn = get_connection()

    try:
        caja = get_caja_by_id(conn, caja_id)
        if caja is None:
            raise HTTPException(status_code=404, detail=f"No existe la caja {caja_id}")

        efectivo_teorico = get_efectivo_teorico(conn, caja_id)
        totales = get_totales_por_submedio(conn, caja["id"])
        movimientos = get_caja_movimientos(conn, caja_id)

        return {
            "caja": caja,
            "efectivo_teorico": efectivo_teorico,
            "totales_por_submedio": totales,
            "movimientos": movimientos,
        }
    finally:
        conn.close()


def registrar_egreso(caja_id: int, data: CajaEgresoInput):
    conn = get_connection()

    try:
        with conn.transaction():
            caja = get_caja_by_id_for_update(conn, caja_id)

            if caja is None:
                raise HTTPException(status_code=404, detail=f"No existe la caja {caja_id}")

            if caja["estado"] != CAJA_ESTADO_ABIERTA:
                raise HTTPException(status_code=400, detail="La caja no está abierta")

            if data.monto > LIMITE_EGRESO_CAJA:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"El egreso supera el límite permitido de "
                        f"{LIMITE_EGRESO_CAJA}"
                    ),
                )

            movimiento_id = insert_caja_movimiento(
                conn,
                id_caja=caja_id,
                tipo_movimiento=CAJA_MOVIMIENTO_EGRESO,
                submedio="efectivo",
                monto=data.monto,
                origen_tipo=CAJA_ORIGEN_EGRESO_MANUAL,
                origen_id=None,
                nota=data.nota,
                id_usuario=data.id_usuario,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=caja["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CAJA,
                entidad_id=caja_id,
                accion=AUDITORIA_ACCION_CAJA_EGRESO,
                detalle=(
                    f"Egreso manual registrado. movimiento_id={movimiento_id}, "
                    f"monto={data.monto}, nota={data.nota}"
                ),
                metadata={
                    "tipo": "caja_egreso",
                    "caja_id": caja_id,
                    "movimiento_id": movimiento_id,
                    "monto": str(data.monto),
                    "submedio": "efectivo",  # hoy está hardcodeado
                    "origen": "manual",
                    "nota": data.nota,
                },
                origen_tipo="caja_movimiento",
                origen_id=movimiento_id,
            )

        return {"ok": True, "movimiento_id": movimiento_id, "caja_id": caja_id}
    finally:
        conn.close()


def cerrar_caja(caja_id: int, data: CajaCerrarInput):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_permiso_cerrar_caja(conn, data.id_usuario)
            caja = get_caja_by_id_for_update(conn, caja_id)

            if caja is None:
                raise HTTPException(status_code=404, detail=f"No existe la caja {caja_id}")

            if caja["estado"] != CAJA_ESTADO_ABIERTA:
                raise HTTPException(status_code=400, detail="La caja ya está cerrada")

            efectivo_teorico = get_efectivo_teorico(conn, caja_id)
            diferencia = data.monto_cierre_real - efectivo_teorico

            close_caja(
                conn,
                caja_id=caja_id,
                monto_cierre_teorico=efectivo_teorico,
                monto_cierre_real=data.monto_cierre_real,
                diferencia=diferencia,
                id_usuario=data.id_usuario,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=caja["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CAJA,
                entidad_id=caja_id,
                accion=AUDITORIA_ACCION_CAJA_CERRADA,
                detalle=(
                    f"Caja cerrada. teorico={efectivo_teorico}, "
                    f"real={data.monto_cierre_real}, diferencia={diferencia}"
                ),
                metadata={
                    "tipo": "caja_cierre",
                    "caja_id": caja_id,
                    "monto_cierre_teorico": str(efectivo_teorico),
                    "monto_cierre_real": str(data.monto_cierre_real),
                    "diferencia": str(diferencia),
                    "estado_final": CAJA_ESTADO_CERRADA,
                },
                origen_tipo="caja",
                origen_id=caja_id,
            )

        return {
            "ok": True,
            "caja_id": caja_id,
            "estado": CAJA_ESTADO_CERRADA,
            "monto_cierre_teorico": efectivo_teorico,
            "monto_cierre_real": data.monto_cierre_real,
            "diferencia": diferencia,
        }
    finally:
        conn.close()


def registrar_ajuste(caja_id: int, data: CajaAjusteInput):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_permiso_ajustar_caja(conn, data.id_usuario)
            caja = get_caja_by_id_for_update(conn, caja_id)

            if caja is None:
                raise HTTPException(status_code=404, detail=f"No existe la caja {caja_id}")

            if caja["estado"] != CAJA_ESTADO_ABIERTA:
                raise HTTPException(status_code=400, detail="La caja no está abierta")

            if data.monto > LIMITE_EGRESO_CAJA:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"El egreso supera el límite permitido de "
                        f"{LIMITE_EGRESO_CAJA}"
                    ),
                )

            movimiento_id = insert_caja_movimiento(
                conn,
                id_caja=caja_id,
                tipo_movimiento=CAJA_MOVIMIENTO_AJUSTE,
                submedio="efectivo",
                monto=data.monto,
                origen_tipo=CAJA_ORIGEN_AJUSTE_MANUAL,
                origen_id=None,
                nota=data.nota,
                id_usuario=data.id_usuario,
                direccion_ajuste=data.direccion,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=caja["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CAJA,
                entidad_id=caja_id,
                accion=AUDITORIA_ACCION_CAJA_AJUSTE,
                detalle=(
                    f"Ajuste de caja registrado. movimiento_id={movimiento_id}, "
                    f"direccion={data.direccion}, monto={data.monto}, nota={data.nota}"
                ),
                metadata={
                    "tipo": "caja_ajuste",
                    "caja_id": caja_id,
                    "movimiento_id": movimiento_id,
                    "direccion": data.direccion,  # "positivo" / "negativo"
                    "monto": str(data.monto),
                    "submedio": "efectivo",
                    "origen": "manual",
                    "nota": data.nota,
                },
                origen_tipo="caja_movimiento",
                origen_id=movimiento_id,
            )

        return {
            "ok": True,
            "movimiento_id": movimiento_id,
            "caja_id": caja_id,
        }
    finally:
        conn.close()

def listar_historial_cajas(
    *,
    id_sucursal: int | None = None,
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    if estado is not None and estado not in {CAJA_ESTADO_ABIERTA, CAJA_ESTADO_CERRADA}:
        raise HTTPException(
            status_code=400,
            detail="estado inválido. Valores permitidos: abierta, cerrada",
        )

    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="limit debe estar entre 1 y 500",
        )

    if offset < 0:
        raise HTTPException(
            status_code=400,
            detail="offset no puede ser negativo",
        )

    conn = get_connection()

    try:
        return get_cajas_historial(
            conn,
            id_sucursal=id_sucursal,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            estado=estado,
            limit=limit,
            offset=offset,
        )
    finally:
        conn.close()


def obtener_resumen_diario_caja(*, fecha: date | None = None, id_sucursal: int | None = None):
    fecha_resumen = fecha or date.today()
    conn = get_connection()

    try:
        caja = get_caja_del_dia(conn, fecha=fecha_resumen, id_sucursal=id_sucursal)
        caja_id = caja["id"] if caja else None
        movimientos = get_resumen_movimientos_caja(conn, caja_id)
        efectivo_teorico = get_efectivo_teorico(conn, caja_id) if caja_id else Decimal("0")
        pagos = get_resumen_pagos_caja(
            conn,
            caja_id,
            fecha=fecha_resumen,
            id_sucursal=id_sucursal,
        )
        rentabilidad = get_resumen_rentabilidad_dia(
            conn,
            fecha=fecha_resumen,
            id_sucursal=id_sucursal,
        )
        documentos = get_documentos_disponibles_dia(
            conn,
            fecha=fecha_resumen,
            id_sucursal=id_sucursal,
        )

        return {
            "fecha": fecha_resumen,
            "id_sucursal": id_sucursal,
            "caja": {
                "caja_id": caja_id,
                "estado": caja["estado"] if caja else None,
                "fecha": caja["fecha"] if caja else None,
                "monto_apertura": caja["monto_apertura"] if caja else Decimal("0"),
                "efectivo_teorico": efectivo_teorico,
                "monto_cierre_real": caja["monto_cierre_real"] if caja else None,
                "diferencia": caja["diferencia"] if caja else None,
                **movimientos,
            },
            "pagos": pagos,
            "rentabilidad": rentabilidad,
            "documentos": documentos,
        }
    finally:
        conn.close()
