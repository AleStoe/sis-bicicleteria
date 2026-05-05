from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.caja.repository import (
    get_caja_abierta_hoy_by_sucursal_for_update,
    insert_caja_movimiento,
)

from .repository import (
    get_sucursal_by_id,
    get_categoria_by_id,
    insert_categoria,
    get_categorias,
    insert_gasto_operativo,
    vincular_gasto_a_caja,
    insert_gasto_movimiento,
    get_gastos,
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

TIPO_MOV_CREACION = "creacion"
TIPO_MOV_CORRECCION = "correccion"
TIPO_MOV_ANULACION = "anulacion"

SUBMEDIOS_VALIDOS = {"efectivo", "transferencia", "mercadopago", "tarjeta"}


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


def crear_categoria(data):
    conn = get_connection()

    try:
        with conn.transaction():
            return insert_categoria(conn, data.nombre.strip())
    finally:
        conn.close()


def listar_categorias():
    conn = get_connection()

    try:
        return get_categorias(conn)
    finally:
        conn.close()


def crear_gasto(data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_sucursal(conn, data.id_sucursal)
            _validar_categoria(conn, data.id_categoria_gasto)
            _validar_medio_pago(data.medio_pago)

            gasto_id = insert_gasto_operativo(
                conn,
                {
                    "fecha": data.fecha,
                    "id_sucursal": data.id_sucursal,
                    "id_categoria_gasto": data.id_categoria_gasto,
                    "descripcion": data.descripcion,
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
                    "detalle": f"Gasto creado. descripcion={data.descripcion}",
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
                    nota=f"Gasto operativo #{gasto_id}: {data.descripcion}",
                    id_usuario=data.id_usuario,
                )

                vincular_gasto_a_caja(conn, gasto_id, caja_movimiento_id)

        return {
            "ok": True,
            "gasto_id": gasto_id,
            "movimiento_id": movimiento_id,
            "caja_movimiento_id": caja_movimiento_id,
        }

    finally:
        conn.close()


def listar_gastos():
    conn = get_connection()

    try:
        return get_gastos(conn)
    finally:
        conn.close()


def obtener_gasto(gasto_id: int):
    conn = get_connection()

    try:
        gasto = get_gasto_by_id(conn, gasto_id)

        if gasto is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe el gasto {gasto_id}",
            )

        movimientos = get_gasto_movimientos(conn, gasto_id)

        return {
            "gasto": gasto,
            "movimientos": movimientos,
        }

    finally:
        conn.close()


def anular_gasto(gasto_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            gasto = get_gasto_for_update(conn, gasto_id)

            if gasto is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el gasto {gasto_id}",
                )

            if gasto["estado"] == ESTADO_GASTO_ANULADO:
                raise HTTPException(
                    status_code=400,
                    detail=f"El gasto {gasto_id} ya está anulado",
                )

            caja_movimiento_id = None

            if gasto["impacta_caja"]:
                caja_mov = get_caja_movimiento_with_caja_for_update(
                    conn,
                    gasto["id_caja_movimiento"],
                )

                if caja_mov is None:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "El gasto impacta caja pero no se encontró "
                            "el movimiento de caja asociado"
                        ),
                    )

                if caja_mov["caja_estado"] != "abierta":
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "No se puede anular automáticamente un gasto "
                            "asociado a una caja cerrada"
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
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el gasto {gasto_id}",
                )

            if gasto["estado"] == ESTADO_GASTO_ANULADO:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede corregir un gasto anulado",
                )

            _validar_categoria(conn, data.id_categoria_gasto)
            _validar_medio_pago(data.medio_pago)

            monto_anterior = Decimal(str(gasto["monto"]))
            monto_nuevo = Decimal(str(data.monto))
            diferencia = monto_nuevo - monto_anterior

            caja_movimiento_id = None

            if gasto["impacta_caja"] and diferencia != Decimal("0"):
                caja_mov = get_caja_movimiento_with_caja_for_update(
                    conn,
                    gasto["id_caja_movimiento"],
                )

                if caja_mov is None:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "El gasto impacta caja pero no se encontró "
                            "el movimiento de caja asociado"
                        ),
                    )

                if caja_mov["caja_estado"] != "abierta":
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "No se puede corregir automáticamente un gasto "
                            "asociado a una caja cerrada"
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
                    "descripcion": data.descripcion,
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

        return {
            "ok": True,
            "gasto_id": gasto_id,
            "estado": ESTADO_GASTO_ACTIVO,
            "movimiento_id": movimiento_id,
            "caja_movimiento_id": caja_movimiento_id,
        }

    finally:
        conn.close()