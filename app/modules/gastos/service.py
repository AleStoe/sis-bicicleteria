from decimal import Decimal
from datetime import date

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)

from .repository import (
    get_sucursal_by_id,
    get_categoria_by_id,
    insert_categoria,
    get_categorias,
    update_categoria,
    update_categoria_estado,
    insert_gasto_operativo,
    vincular_gasto_a_caja,
    insert_gasto_movimiento,
    get_gastos,
    get_gastos_resumen,
    get_gasto_by_id,
    get_gasto_for_update,
    get_gasto_movimientos,
    update_gasto_corregido,
    update_gasto_estado,
    get_caja_movimiento_with_caja_for_update,
)


ORIGEN_GASTO_OPERATIVO = "gasto_operativo"
ORIGEN_GASTO_ANULACION = "gasto_operativo_anulacion"
ORIGEN_GASTO_CORRECCION = "gasto_operativo_correccion"

ESTADO_GASTO_ACTIVO = "activo"
ESTADO_GASTO_ANULADO = "anulado"
ESTADOS_GASTO_VALIDOS = {ESTADO_GASTO_ACTIVO, ESTADO_GASTO_ANULADO}

TIPO_MOV_CREACION = "creacion"
TIPO_MOV_CORRECCION = "correccion"
TIPO_MOV_ANULACION = "anulacion"

SUBMEDIOS_VALIDOS = {"efectivo", "transferencia", "mercadopago", "tarjeta"}

AUDITORIA_ENTIDAD_GASTO = "gasto"
AUDITORIA_ACCION_GASTO_CREADO = "gasto_creado"
AUDITORIA_ACCION_GASTO_ANULADO = "gasto_anulado"
AUDITORIA_ACCION_GASTO_CORREGIDO = "gasto_corregido"


class GastoFiltros:
    def __init__(
        self,
        *,
        id_sucursal: int | None = None,
        id_categoria_gasto: int | None = None,
        estado: str | None = None,
        medio_pago: str | None = None,
        impacta_caja: bool | None = None,
        es_recurrente: bool | None = None,
        fecha_desde: date | None = None,
        fecha_hasta: date | None = None,
        periodo_mes: date | None = None,
        q: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ):
        self.id_sucursal = id_sucursal
        self.id_categoria_gasto = id_categoria_gasto
        self.estado = estado
        self.medio_pago = medio_pago
        self.impacta_caja = impacta_caja
        self.es_recurrente = es_recurrente
        self.fecha_desde = fecha_desde
        self.fecha_hasta = fecha_hasta
        self.periodo_mes = periodo_mes
        self.q = q.strip() if q else None
        self.limit = limit
        self.offset = offset

    def as_dict(self):
        return {
            "id_sucursal": self.id_sucursal,
            "id_categoria_gasto": self.id_categoria_gasto,
            "estado": self.estado,
            "medio_pago": self.medio_pago,
            "impacta_caja": self.impacta_caja,
            "es_recurrente": self.es_recurrente,
            "fecha_desde": self.fecha_desde,
            "fecha_hasta": self.fecha_hasta,
            "periodo_mes": self.periodo_mes,
            "q": self.q,
            "limit": self.limit,
            "offset": self.offset,
        }


def _normalizar_texto(valor: str) -> str:
    return " ".join(valor.strip().split())


def _validar_sucursal(conn, id_sucursal: int):
    sucursal = get_sucursal_by_id(conn, id_sucursal)

    if sucursal is None:
        raise HTTPException(status_code=400, detail=f"No existe la sucursal {id_sucursal}")

    if not sucursal["activa"]:
        raise HTTPException(status_code=400, detail=f"La sucursal {id_sucursal} está inactiva")

    return sucursal


def _validar_categoria(conn, id_categoria_gasto: int | None):
    if id_categoria_gasto is None:
        return None

    categoria = get_categoria_by_id(conn, id_categoria_gasto)

    if categoria is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la categoría de gasto {id_categoria_gasto}",
        )

    if not categoria["activa"]:
        raise HTTPException(
            status_code=400,
            detail=f"La categoría de gasto {id_categoria_gasto} está inactiva",
        )

    return categoria


def _validar_categoria_existe(conn, categoria_id: int):
    categoria = get_categoria_by_id(conn, categoria_id)

    if categoria is None:
        raise HTTPException(status_code=404, detail=f"No existe la categoría {categoria_id}")

    return categoria


def _validar_medio_pago(medio_pago: str | None):
    if medio_pago is None:
        return

    if medio_pago not in SUBMEDIOS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=(
                "medio_pago inválido. Valores permitidos: "
                "efectivo, transferencia, mercadopago, tarjeta"
            ),
        )


def _validar_estado_gasto(estado: str | None):
    if estado is None:
        return

    if estado not in ESTADOS_GASTO_VALIDOS:
        raise HTTPException(status_code=400, detail="estado inválido. Valores: activo, anulado")


def _validar_rango_fechas(fecha_desde: date | None, fecha_hasta: date | None):
    if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
        raise HTTPException(status_code=400, detail="fecha_desde no puede ser mayor que fecha_hasta")


def _validar_paginacion(limit: int, offset: int):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit debe estar entre 1 y 500")

    if offset < 0:
        raise HTTPException(status_code=400, detail="offset no puede ser negativo")


def _obtener_caja_abierta_para_gasto(conn, id_sucursal: int):
    caja = get_caja_abierta_hoy_by_sucursal_for_update(conn, id_sucursal)

    if caja is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No hay caja abierta hoy para la sucursal {id_sucursal}. "
                "No se puede registrar un gasto con impacto en caja."
            ),
        )

    return caja


def _validar_filtros(filtros: GastoFiltros):
    _validar_estado_gasto(filtros.estado)
    _validar_medio_pago(filtros.medio_pago)
    _validar_rango_fechas(filtros.fecha_desde, filtros.fecha_hasta)
    _validar_paginacion(filtros.limit, filtros.offset)


def crear_categoria(data):
    conn = get_connection()

    try:
        with conn.transaction():
            nombre = _normalizar_texto(data.nombre)
            return insert_categoria(conn, nombre)
    finally:
        conn.close()


def listar_categorias(incluir_inactivas: bool = False):
    conn = get_connection()

    try:
        return get_categorias(conn, incluir_inactivas=incluir_inactivas)
    finally:
        conn.close()


def editar_categoria(categoria_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_categoria_existe(conn, categoria_id)
            nombre = _normalizar_texto(data.nombre)
            categoria = update_categoria(conn, categoria_id, nombre, data.activa)

            if categoria is None:
                raise HTTPException(status_code=404, detail=f"No existe la categoría {categoria_id}")

            return categoria
    finally:
        conn.close()


def cambiar_estado_categoria(categoria_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_categoria_existe(conn, categoria_id)
            categoria = update_categoria_estado(conn, categoria_id, data.activa)

            return {
                "ok": True,
                "categoria_id": categoria["id"],
                "activa": categoria["activa"],
            }
    finally:
        conn.close()


def crear_gasto(data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_sucursal(conn, data.id_sucursal)
            _validar_categoria(conn, data.id_categoria_gasto)
            _validar_medio_pago(data.medio_pago)

            descripcion = _normalizar_texto(data.descripcion)

            gasto_id = insert_gasto_operativo(
                conn,
                {
                    "fecha": data.fecha,
                    "id_sucursal": data.id_sucursal,
                    "id_categoria_gasto": data.id_categoria_gasto,
                    "descripcion": descripcion,
                    "monto": data.monto,
                    "medio_pago": data.medio_pago,
                    "periodo_mes": data.periodo_mes,
                    "es_recurrente": data.es_recurrente,
                    "origen_tipo": data.origen_tipo,
                    "origen_id": data.origen_id,
                    "id_usuario": data.id_usuario,
                },
            )

            movimiento_id = insert_gasto_movimiento(
                conn,
                {
                    "id_gasto": gasto_id,
                    "tipo_movimiento": TIPO_MOV_CREACION,
                    "monto": data.monto,
                    "detalle": f"Gasto creado. descripcion={descripcion}",
                    "origen_tipo": ORIGEN_GASTO_OPERATIVO,
                    "origen_id": gasto_id,
                    "id_usuario": data.id_usuario,
                },
            )

            caja_movimiento_id = None

            if data.impacta_caja:
                caja = _obtener_caja_abierta_para_gasto(conn, data.id_sucursal)
                submedio = data.medio_pago or "efectivo"

                caja_movimiento_id = insert_caja_movimiento(
                    conn,
                    id_caja=caja["id"],
                    tipo_movimiento="egreso",
                    submedio=submedio,
                    monto=data.monto,
                    origen_tipo=ORIGEN_GASTO_OPERATIVO,
                    origen_id=gasto_id,
                    nota=f"Gasto operativo #{gasto_id}: {descripcion}",
                    id_usuario=data.id_usuario,
                )

                vincular_gasto_a_caja(conn, gasto_id, caja_movimiento_id)

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=data.id_sucursal,
                entidad=AUDITORIA_ENTIDAD_GASTO,
                entidad_id=gasto_id,
                accion=AUDITORIA_ACCION_GASTO_CREADO,
                detalle=(
                    f"Gasto creado. descripcion={descripcion}, "
                    f"monto={data.monto}, impacta_caja={data.impacta_caja}"
                ),
                metadata={
                    "tipo": "gasto_creado",
                    "gasto_id": gasto_id,
                    "descripcion": descripcion,
                    "monto": str(data.monto),
                    "medio_pago": data.medio_pago,
                    "impacta_caja": data.impacta_caja,
                    "caja_movimiento_id": caja_movimiento_id,
                    "movimiento_id": movimiento_id,
                    "categoria_id": data.id_categoria_gasto,
                    "periodo_mes": str(data.periodo_mes) if data.periodo_mes else None,
                    "es_recurrente": data.es_recurrente,
                },
                origen_tipo=ORIGEN_GASTO_OPERATIVO,
                origen_id=gasto_id,
            )

        return {
            "ok": True,
            "gasto_id": gasto_id,
            "movimiento_id": movimiento_id,
            "caja_movimiento_id": caja_movimiento_id,
        }

    finally:
        conn.close()


def listar_gastos(filtros: GastoFiltros | None = None):
    filtros = filtros or GastoFiltros()
    _validar_filtros(filtros)

    conn = get_connection()

    try:
        return get_gastos(conn, filtros.as_dict())
    finally:
        conn.close()


def obtener_resumen_gastos(filtros: GastoFiltros | None = None):
    filtros = filtros or GastoFiltros()
    _validar_filtros(filtros)

    conn = get_connection()

    try:
        return get_gastos_resumen(conn, filtros.as_dict())
    finally:
        conn.close()


def obtener_gasto(gasto_id: int):
    conn = get_connection()

    try:
        gasto = get_gasto_by_id(conn, gasto_id)

        if gasto is None:
            raise HTTPException(status_code=404, detail=f"No existe el gasto {gasto_id}")

        movimientos = get_gasto_movimientos(conn, gasto_id)

        return {"gasto": gasto, "movimientos": movimientos}

    finally:
        conn.close()


def anular_gasto(gasto_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            gasto = get_gasto_for_update(conn, gasto_id)

            if gasto is None:
                raise HTTPException(status_code=404, detail=f"No existe el gasto {gasto_id}")

            if gasto["estado"] == ESTADO_GASTO_ANULADO:
                raise HTTPException(status_code=400, detail=f"El gasto {gasto_id} ya está anulado")

            caja_movimiento_id = None

            if gasto["impacta_caja"]:
                caja_mov = get_caja_movimiento_with_caja_for_update(conn, gasto["id_caja_movimiento"])

                if caja_mov is None:
                    raise HTTPException(
                        status_code=400,
                        detail="El gasto impacta caja pero no se encontró el movimiento de caja asociado",
                    )

                if caja_mov["caja_estado"] != "abierta":
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "No se puede anular automáticamente un gasto asociado a una caja cerrada. "
                            "Registrá un ajuste manual si necesitás corregir caja."
                        ),
                    )

                caja_movimiento_id = insert_caja_movimiento(
                    conn,
                    id_caja=caja_mov["id_caja"],
                    tipo_movimiento="ingreso",
                    submedio=caja_mov["submedio"],
                    monto=gasto["monto"],
                    origen_tipo=ORIGEN_GASTO_ANULACION,
                    origen_id=gasto_id,
                    nota=f"Anulación de gasto operativo #{gasto_id}. Motivo: {data.motivo}",
                    id_usuario=data.id_usuario,
                )

            update_gasto_estado(conn, gasto_id, ESTADO_GASTO_ANULADO)

            movimiento_id = insert_gasto_movimiento(
                conn,
                {
                    "id_gasto": gasto_id,
                    "tipo_movimiento": TIPO_MOV_ANULACION,
                    "monto": gasto["monto"],
                    "detalle": data.motivo,
                    "origen_tipo": ORIGEN_GASTO_ANULACION,
                    "origen_id": gasto_id,
                    "id_usuario": data.id_usuario,
                },
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=gasto["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_GASTO,
                entidad_id=gasto_id,
                accion=AUDITORIA_ACCION_GASTO_ANULADO,
                detalle=(
                    f"Gasto anulado. gasto_id={gasto_id}, "
                    f"monto={gasto['monto']}, motivo={data.motivo}"
                ),
                metadata={
                    "tipo": "gasto_anulado",
                    "gasto_id": gasto_id,
                    "monto": str(gasto["monto"]),
                    "descripcion": gasto["descripcion"],
                    "motivo": data.motivo,
                    "impacta_caja": gasto["impacta_caja"],
                    "caja_movimiento_id": caja_movimiento_id,
                    "movimiento_id": movimiento_id,
                },
                origen_tipo=ORIGEN_GASTO_ANULACION,
                origen_id=gasto_id,
            )

        return {
            "ok": True,
            "gasto_id": gasto_id,
            "estado": ESTADO_GASTO_ANULADO,
            "movimiento_id": movimiento_id,
            "caja_movimiento_id": caja_movimiento_id,
        }

    finally:
        conn.close()


def corregir_gasto(gasto_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            gasto = get_gasto_for_update(conn, gasto_id)

            if gasto is None:
                raise HTTPException(status_code=404, detail=f"No existe el gasto {gasto_id}")

            if gasto["estado"] == ESTADO_GASTO_ANULADO:
                raise HTTPException(status_code=400, detail="No se puede corregir un gasto anulado")

            _validar_categoria(conn, data.id_categoria_gasto)
            _validar_medio_pago(data.medio_pago)

            descripcion = _normalizar_texto(data.descripcion)
            monto_anterior = Decimal(str(gasto["monto"]))
            monto_nuevo = Decimal(str(data.monto))
            diferencia = monto_nuevo - monto_anterior

            caja_movimiento_id = None

            if gasto["impacta_caja"] and diferencia != Decimal("0"):
                caja_mov = get_caja_movimiento_with_caja_for_update(conn, gasto["id_caja_movimiento"])

                if caja_mov is None:
                    raise HTTPException(
                        status_code=400,
                        detail="El gasto impacta caja pero no se encontró el movimiento de caja asociado",
                    )

                if caja_mov["caja_estado"] != "abierta":
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "No se puede corregir automáticamente un gasto asociado a una caja cerrada. "
                            "Registrá un ajuste manual si necesitás corregir caja."
                        ),
                    )

                if diferencia > 0:
                    tipo_movimiento = "egreso"
                    monto_caja = diferencia
                    nota = (
                        f"Corrección de gasto operativo #{gasto_id}. "
                        f"Aumento de monto. Motivo: {data.motivo}"
                    )
                else:
                    tipo_movimiento = "ingreso"
                    monto_caja = abs(diferencia)
                    nota = (
                        f"Corrección de gasto operativo #{gasto_id}. "
                        f"Reducción de monto. Motivo: {data.motivo}"
                    )

                caja_movimiento_id = insert_caja_movimiento(
                    conn,
                    id_caja=caja_mov["id_caja"],
                    tipo_movimiento=tipo_movimiento,
                    submedio=caja_mov["submedio"],
                    monto=monto_caja,
                    origen_tipo=ORIGEN_GASTO_CORRECCION,
                    origen_id=gasto_id,
                    nota=nota,
                    id_usuario=data.id_usuario,
                )

            update_gasto_corregido(
                conn,
                gasto_id,
                {
                    "descripcion": descripcion,
                    "monto": data.monto,
                    "id_categoria_gasto": data.id_categoria_gasto,
                    "medio_pago": data.medio_pago,
                    "periodo_mes": data.periodo_mes,
                },
            )

            movimiento_id = insert_gasto_movimiento(
                conn,
                {
                    "id_gasto": gasto_id,
                    "tipo_movimiento": TIPO_MOV_CORRECCION,
                    "monto": data.monto,
                    "detalle": (
                        f"{data.motivo}. "
                        f"monto_anterior={monto_anterior}, "
                        f"monto_nuevo={monto_nuevo}"
                    ),
                    "origen_tipo": ORIGEN_GASTO_CORRECCION,
                    "origen_id": gasto_id,
                    "id_usuario": data.id_usuario,
                },
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=gasto["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_GASTO,
                entidad_id=gasto_id,
                accion=AUDITORIA_ACCION_GASTO_CORREGIDO,
                detalle=(
                    f"Gasto corregido. gasto_id={gasto_id}, "
                    f"monto_anterior={monto_anterior}, "
                    f"monto_nuevo={monto_nuevo}, "
                    f"diferencia={diferencia}, motivo={data.motivo}"
                ),
                metadata={
                    "tipo": "gasto_corregido",
                    "gasto_id": gasto_id,
                    "descripcion_anterior": gasto["descripcion"],
                    "descripcion_nueva": descripcion,
                    "monto_anterior": str(monto_anterior),
                    "monto_nuevo": str(monto_nuevo),
                    "diferencia": str(diferencia),
                    "categoria_anterior": gasto["id_categoria_gasto"],
                    "categoria_nueva": data.id_categoria_gasto,
                    "medio_pago_anterior": gasto["medio_pago"],
                    "medio_pago_nuevo": data.medio_pago,
                    "periodo_mes_anterior": str(gasto["periodo_mes"]) if gasto["periodo_mes"] else None,
                    "periodo_mes_nuevo": str(data.periodo_mes) if data.periodo_mes else None,
                    "motivo": data.motivo,
                    "impacta_caja": gasto["impacta_caja"],
                    "caja_movimiento_id": caja_movimiento_id,
                    "movimiento_id": movimiento_id,
                },
                origen_tipo=ORIGEN_GASTO_CORRECCION,
                origen_id=gasto_id,
            )

        return {
            "ok": True,
            "gasto_id": gasto_id,
            "estado": ESTADO_GASTO_ACTIVO,
            "movimiento_id": movimiento_id,
            "caja_movimiento_id": caja_movimiento_id,
        }

    finally:
        conn.close()