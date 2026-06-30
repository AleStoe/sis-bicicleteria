from decimal import Decimal
from datetime import date

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)
from app.shared.constants import (
    AUDITORIA_ACCION_CAPITAL_MOVIMIENTO_ANULADO,
    AUDITORIA_ACCION_CAPITAL_MOVIMIENTO_CREADO,
    AUDITORIA_ENTIDAD_CAPITAL_RETIRO,
)

from .repository import (
    get_sucursal_by_id,
    get_participante_by_id,
    insert_participante,
    update_participante,
    update_participante_estado,
    get_participantes,
    get_saldo_prestamo_participante,
    insert_movimiento_capital,
    vincular_movimiento_a_caja,
    insert_historial,
    get_movimientos,
    get_movimiento_by_id,
    get_movimiento_for_update,
    get_historial,
    update_movimiento_estado,
    get_caja_movimiento_with_caja_for_update,
    get_resumen,
)


ORIGEN_CAPITAL_RETIROS = "capital_retiros"
ORIGEN_CAPITAL_RETIROS_ANULACION = "capital_retiros_anulacion"

ESTADO_ACTIVO = "activo"
ESTADO_ANULADO = "anulado"
ESTADOS_VALIDOS = {ESTADO_ACTIVO, ESTADO_ANULADO}

TIPOS_MOVIMIENTO_VALIDOS = {
    "aporte_capital",
    "prestamo_socio",
    "devolucion_prestamo",
    "retiro_personal",
    "distribucion_ganancia",
}

TIPOS_ENTRADA_CAJA = {"aporte_capital", "prestamo_socio"}
TIPOS_SALIDA_CAJA = {"devolucion_prestamo", "retiro_personal", "distribucion_ganancia"}
SUBMEDIOS_VALIDOS = {"efectivo", "transferencia", "mercadopago", "tarjeta"}


class CapitalFiltros:
    def __init__(
        self,
        *,
        id_participante: int | None = None,
        id_sucursal: int | None = None,
        tipo_movimiento: str | None = None,
        estado: str | None = None,
        medio_pago: str | None = None,
        impacta_caja: bool | None = None,
        fecha_desde: date | None = None,
        fecha_hasta: date | None = None,
        q: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ):
        self.id_participante = id_participante
        self.id_sucursal = id_sucursal
        self.tipo_movimiento = tipo_movimiento
        self.estado = estado
        self.medio_pago = medio_pago
        self.impacta_caja = impacta_caja
        self.fecha_desde = fecha_desde
        self.fecha_hasta = fecha_hasta
        self.q = q.strip() if q else None
        self.limit = limit
        self.offset = offset

    def as_dict(self):
        return {
            "id_participante": self.id_participante,
            "id_sucursal": self.id_sucursal,
            "tipo_movimiento": self.tipo_movimiento,
            "estado": self.estado,
            "medio_pago": self.medio_pago,
            "impacta_caja": self.impacta_caja,
            "fecha_desde": self.fecha_desde,
            "fecha_hasta": self.fecha_hasta,
            "q": self.q,
            "limit": self.limit,
            "offset": self.offset,
        }


def _normalizar_texto(valor: str) -> str:
    return " ".join(valor.strip().split())


def _validar_sucursal(conn, id_sucursal: int | None):
    if id_sucursal is None:
        return None

    sucursal = get_sucursal_by_id(conn, id_sucursal)
    if sucursal is None:
        raise HTTPException(status_code=400, detail=f"No existe la sucursal {id_sucursal}")
    if not sucursal["activa"]:
        raise HTTPException(status_code=400, detail=f"La sucursal {id_sucursal} está inactiva")
    return sucursal


def _validar_participante(conn, participante_id: int):
    participante = get_participante_by_id(conn, participante_id)
    if participante is None:
        raise HTTPException(status_code=400, detail=f"No existe el participante {participante_id}")
    if not participante["activo"]:
        raise HTTPException(status_code=400, detail=f"El participante {participante_id} está inactivo")
    return participante


def _validar_participante_existe(conn, participante_id: int):
    participante = get_participante_by_id(conn, participante_id)
    if participante is None:
        raise HTTPException(status_code=404, detail=f"No existe el participante {participante_id}")
    return participante


def _validar_medio_pago(medio_pago: str | None):
    if medio_pago is None:
        return
    if medio_pago not in SUBMEDIOS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail="medio_pago inválido. Valores: efectivo, transferencia, mercadopago, tarjeta",
        )


def _validar_tipo_movimiento(tipo_movimiento: str | None):
    if tipo_movimiento is None:
        return
    if tipo_movimiento not in TIPOS_MOVIMIENTO_VALIDOS:
        raise HTTPException(status_code=400, detail="tipo_movimiento inválido")


def _validar_estado(estado: str | None):
    if estado is None:
        return
    if estado not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=400, detail="estado inválido. Valores: activo, anulado")


def _validar_fechas(fecha_desde: date | None, fecha_hasta: date | None):
    if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
        raise HTTPException(status_code=400, detail="fecha_desde no puede ser mayor que fecha_hasta")


def _validar_paginacion(limit: int, offset: int):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit debe estar entre 1 y 500")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset no puede ser negativo")


def _validar_filtros(filtros: CapitalFiltros):
    _validar_tipo_movimiento(filtros.tipo_movimiento)
    _validar_estado(filtros.estado)
    _validar_medio_pago(filtros.medio_pago)
    _validar_fechas(filtros.fecha_desde, filtros.fecha_hasta)
    _validar_paginacion(filtros.limit, filtros.offset)


def _tipo_caja_para_movimiento(tipo_movimiento: str):
    if tipo_movimiento in TIPOS_ENTRADA_CAJA:
        return "ingreso"
    if tipo_movimiento in TIPOS_SALIDA_CAJA:
        return "egreso"
    raise HTTPException(status_code=400, detail="tipo_movimiento inválido para caja")


def _obtener_caja_abierta(conn, id_sucursal: int | None):
    if id_sucursal is None:
        raise HTTPException(
            status_code=400,
            detail="id_sucursal es obligatorio cuando el movimiento impacta caja",
        )

    caja = get_caja_abierta_hoy_by_sucursal_for_update(conn, id_sucursal)
    if caja is None:
        raise HTTPException(
            status_code=400,
            detail=f"No hay caja abierta hoy para la sucursal {id_sucursal}",
        )
    return caja


def _validar_devolucion_prestamo(conn, participante_id: int, monto: Decimal):
    saldo = Decimal(str(get_saldo_prestamo_participante(conn, participante_id)))
    if monto > saldo:
        raise HTTPException(
            status_code=400,
            detail=f"La devolución supera el saldo de préstamo pendiente. Saldo actual: {saldo}",
        )


def crear_participante(data):
    conn = get_connection()
    try:
        with conn.transaction():
            return insert_participante(
                conn,
                {
                    "nombre": _normalizar_texto(data.nombre),
                    "tipo": data.tipo,
                    "observaciones": _normalizar_texto(data.observaciones) if data.observaciones else None,
                },
            )
    finally:
        conn.close()


def listar_participantes(incluir_inactivos: bool = False):
    conn = get_connection()
    try:
        return get_participantes(conn, incluir_inactivos=incluir_inactivos)
    finally:
        conn.close()


def editar_participante(participante_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_participante_existe(conn, participante_id)
            participante = update_participante(
                conn,
                participante_id,
                {
                    "nombre": _normalizar_texto(data.nombre),
                    "tipo": data.tipo,
                    "activo": data.activo,
                    "observaciones": _normalizar_texto(data.observaciones) if data.observaciones else None,
                },
            )
            return participante
    finally:
        conn.close()


def cambiar_estado_participante(participante_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_participante_existe(conn, participante_id)
            participante = update_participante_estado(conn, participante_id, data.activo)
            return {"ok": True, "participante_id": participante["id"], "activo": participante["activo"]}
    finally:
        conn.close()


def crear_movimiento(data):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_sucursal(conn, data.id_sucursal)
            _validar_participante(conn, data.id_participante)
            _validar_tipo_movimiento(data.tipo_movimiento)
            _validar_medio_pago(data.medio_pago)

            if data.tipo_movimiento == "devolucion_prestamo":
                _validar_devolucion_prestamo(conn, data.id_participante, Decimal(str(data.monto)))

            descripcion = _normalizar_texto(data.descripcion)

            movimiento_id = insert_movimiento_capital(
                conn,
                {
                    "fecha": data.fecha,
                    "id_sucursal": data.id_sucursal,
                    "id_participante": data.id_participante,
                    "tipo_movimiento": data.tipo_movimiento,
                    "descripcion": descripcion,
                    "monto": data.monto,
                    "medio_pago": data.medio_pago,
                    "origen_tipo": data.origen_tipo,
                    "origen_id": data.origen_id,
                    "id_usuario": data.id_usuario,
                },
            )

            historial_id = insert_historial(
                conn,
                {
                    "id_movimiento": movimiento_id,
                    "tipo_evento": "creacion",
                    "monto": data.monto,
                    "detalle": f"Movimiento creado. tipo={data.tipo_movimiento}. descripcion={descripcion}",
                    "origen_tipo": ORIGEN_CAPITAL_RETIROS,
                    "origen_id": movimiento_id,
                    "id_usuario": data.id_usuario,
                },
            )

            caja_movimiento_id = None
            if data.impacta_caja:
                caja = _obtener_caja_abierta(conn, data.id_sucursal)
                submedio = data.medio_pago or "efectivo"
                tipo_caja = _tipo_caja_para_movimiento(data.tipo_movimiento)

                caja_movimiento_id = insert_caja_movimiento(
                    conn,
                    id_caja=caja["id"],
                    tipo_movimiento=tipo_caja,
                    submedio=submedio,
                    monto=data.monto,
                    origen_tipo=ORIGEN_CAPITAL_RETIROS,
                    origen_id=movimiento_id,
                    nota=f"Capital y Retiros #{movimiento_id}: {descripcion}",
                    id_usuario=data.id_usuario,
                )

                vincular_movimiento_a_caja(conn, movimiento_id, caja_movimiento_id)

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=data.id_sucursal,
                entidad=AUDITORIA_ENTIDAD_CAPITAL_RETIRO,
                entidad_id=movimiento_id,
                accion=AUDITORIA_ACCION_CAPITAL_MOVIMIENTO_CREADO,
                detalle=(
                    f"Movimiento de capital creado. tipo={data.tipo_movimiento}, "
                    f"monto={data.monto}, impacta_caja={data.impacta_caja}"
                ),
                metadata={
                    "tipo_movimiento": data.tipo_movimiento,
                    "monto": str(data.monto),
                    "participante_id": data.id_participante,
                    "impacta_caja": data.impacta_caja,
                    "caja_movimiento_id": caja_movimiento_id,
                },
                origen_tipo=ORIGEN_CAPITAL_RETIROS,
                origen_id=movimiento_id,
            )

        return {
            "ok": True,
            "movimiento_id": movimiento_id,
            "historial_id": historial_id,
            "caja_movimiento_id": caja_movimiento_id,
        }
    finally:
        conn.close()


def listar_movimientos(filtros: CapitalFiltros | None = None):
    filtros = filtros or CapitalFiltros()
    _validar_filtros(filtros)
    conn = get_connection()
    try:
        return get_movimientos(conn, filtros.as_dict())
    finally:
        conn.close()


def obtener_movimiento(movimiento_id: int):
    conn = get_connection()
    try:
        movimiento = get_movimiento_by_id(conn, movimiento_id)
        if movimiento is None:
            raise HTTPException(status_code=404, detail=f"No existe el movimiento {movimiento_id}")
        historial = get_historial(conn, movimiento_id)
        return {"movimiento": movimiento, "historial": historial}
    finally:
        conn.close()


def anular_movimiento(movimiento_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            movimiento = get_movimiento_for_update(conn, movimiento_id)
            if movimiento is None:
                raise HTTPException(status_code=404, detail=f"No existe el movimiento {movimiento_id}")
            if movimiento["estado"] == ESTADO_ANULADO:
                raise HTTPException(status_code=400, detail=f"El movimiento {movimiento_id} ya está anulado")

            caja_movimiento_id = None
            if movimiento["impacta_caja"]:
                caja_mov = get_caja_movimiento_with_caja_for_update(conn, movimiento["id_caja_movimiento"])
                if caja_mov is None:
                    raise HTTPException(
                        status_code=400,
                        detail="El movimiento impacta caja pero no se encontró el movimiento de caja asociado",
                    )
                if caja_mov["caja_estado"] != "abierta":
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "No se puede anular automáticamente un movimiento asociado a una caja cerrada. "
                            "Registrá un ajuste manual si necesitás corregir caja."
                        ),
                    )

                tipo_caja_compensatorio = "egreso" if caja_mov["origen_tipo"] == ORIGEN_CAPITAL_RETIROS and movimiento["tipo_movimiento"] in TIPOS_ENTRADA_CAJA else "ingreso"

                caja_movimiento_id = insert_caja_movimiento(
                    conn,
                    id_caja=caja_mov["id_caja"],
                    tipo_movimiento=tipo_caja_compensatorio,
                    submedio=caja_mov["submedio"],
                    monto=movimiento["monto"],
                    origen_tipo=ORIGEN_CAPITAL_RETIROS_ANULACION,
                    origen_id=movimiento_id,
                    nota=f"Anulación Capital y Retiros #{movimiento_id}. Motivo: {data.motivo}",
                    id_usuario=data.id_usuario,
                )

            update_movimiento_estado(conn, movimiento_id, ESTADO_ANULADO)

            historial_id = insert_historial(
                conn,
                {
                    "id_movimiento": movimiento_id,
                    "tipo_evento": "anulacion",
                    "monto": movimiento["monto"],
                    "detalle": data.motivo,
                    "origen_tipo": ORIGEN_CAPITAL_RETIROS_ANULACION,
                    "origen_id": movimiento_id,
                    "id_usuario": data.id_usuario,
                },
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=movimiento["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CAPITAL_RETIRO,
                entidad_id=movimiento_id,
                accion=AUDITORIA_ACCION_CAPITAL_MOVIMIENTO_ANULADO,
                detalle=(
                    f"Movimiento de capital anulado. "
                    f"monto={movimiento['monto']}, motivo={data.motivo}"
                ),
                metadata={
                    "tipo_movimiento": movimiento["tipo_movimiento"],
                    "monto": str(movimiento["monto"]),
                    "motivo": data.motivo,
                    "caja_movimiento_id": caja_movimiento_id,
                },
                origen_tipo=ORIGEN_CAPITAL_RETIROS_ANULACION,
                origen_id=movimiento_id,
            )

        return {
            "ok": True,
            "movimiento_id": movimiento_id,
            "estado": ESTADO_ANULADO,
            "historial_id": historial_id,
            "caja_movimiento_id": caja_movimiento_id,
        }
    finally:
        conn.close()


def _resumen_cero_participante(participante):
    cero = Decimal("0")
    return {
        "id_participante": participante["id"],
        "participante_nombre": participante["nombre"],
        "participante_tipo": participante["tipo"],
        "total_aportes": cero,
        "total_prestamos": cero,
        "total_devoluciones_prestamo": cero,
        "saldo_prestamo": cero,
        "total_retiros": cero,
        "total_distribuciones": cero,
        "saldo_neto_capital": cero,
    }


def obtener_perfil_participante(participante_id: int):
    conn = get_connection()
    try:
        participante = get_participante_by_id(conn, participante_id)
        if participante is None:
            raise HTTPException(status_code=404, detail=f"No existe el participante {participante_id}")

        filtros = CapitalFiltros(
            id_participante=participante_id,
            estado=ESTADO_ACTIVO,
            limit=500,
            offset=0,
        )

        resumen_rows = get_resumen(conn, filtros.as_dict())
        if resumen_rows:
            row = resumen_rows[0]
            aportes = Decimal(str(row["total_aportes"]))
            prestamos = Decimal(str(row["total_prestamos"]))
            devoluciones = Decimal(str(row["total_devoluciones_prestamo"]))
            retiros = Decimal(str(row["total_retiros"]))
            distribuciones = Decimal(str(row["total_distribuciones"]))
            resumen = {
                "id_participante": row["id_participante"],
                "participante_nombre": row["participante_nombre"],
                "participante_tipo": row["participante_tipo"],
                "total_aportes": aportes,
                "total_prestamos": prestamos,
                "total_devoluciones_prestamo": devoluciones,
                "saldo_prestamo": prestamos - devoluciones,
                "total_retiros": retiros,
                "total_distribuciones": distribuciones,
                "saldo_neto_capital": aportes + prestamos - devoluciones - retiros - distribuciones,
            }
        else:
            resumen = _resumen_cero_participante(participante)

        movimientos = get_movimientos(conn, filtros.as_dict())

        return {
            "participante": participante,
            "resumen": resumen,
            "movimientos": movimientos,
        }
    finally:
        conn.close()


def obtener_resumen(filtros: CapitalFiltros | None = None):
    filtros = filtros or CapitalFiltros()
    _validar_filtros(filtros)
    conn = get_connection()
    try:
        rows = get_resumen(conn, filtros.as_dict())
        participantes = []
        total_aportes = Decimal("0")
        total_prestamos = Decimal("0")
        total_devoluciones = Decimal("0")
        total_retiros = Decimal("0")
        total_distribuciones = Decimal("0")

        for row in rows:
            aportes = Decimal(str(row["total_aportes"]))
            prestamos = Decimal(str(row["total_prestamos"]))
            devoluciones = Decimal(str(row["total_devoluciones_prestamo"]))
            retiros = Decimal(str(row["total_retiros"]))
            distribuciones = Decimal(str(row["total_distribuciones"]))
            saldo_prestamo = prestamos - devoluciones
            saldo_neto_capital = aportes + prestamos - devoluciones - retiros - distribuciones

            participantes.append(
                {
                    "id_participante": row["id_participante"],
                    "participante_nombre": row["participante_nombre"],
                    "participante_tipo": row["participante_tipo"],
                    "total_aportes": aportes,
                    "total_prestamos": prestamos,
                    "total_devoluciones_prestamo": devoluciones,
                    "saldo_prestamo": saldo_prestamo,
                    "total_retiros": retiros,
                    "total_distribuciones": distribuciones,
                    "saldo_neto_capital": saldo_neto_capital,
                }
            )

            total_aportes += aportes
            total_prestamos += prestamos
            total_devoluciones += devoluciones
            total_retiros += retiros
            total_distribuciones += distribuciones

        return {
            "total_aportes": total_aportes,
            "total_prestamos": total_prestamos,
            "total_devoluciones_prestamo": total_devoluciones,
            "saldo_prestamos": total_prestamos - total_devoluciones,
            "total_retiros": total_retiros,
            "total_distribuciones": total_distribuciones,
            "participantes": participantes,
        }
    finally:
        conn.close()
