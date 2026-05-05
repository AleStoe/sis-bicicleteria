from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection

from .repository import (
    get_variante_precio_by_id,
    get_variante_precio_for_update,
    update_variante_precios,
    insert_precio_movimiento,
    get_historial_precios_by_variante,
    get_categoria_by_id,
    get_marca_by_id,
    insert_regla_precio,
    get_reglas_precio,
    get_regla_precio_by_id,
    update_regla_precio_estado,
    get_variante_contexto_precio,
    buscar_regla_precio_aplicable,
)


def _dec(value) -> Decimal:
    return Decimal(str(value))


def obtener_precio_variante(id_variante: int):
    conn = get_connection()

    try:
        variante = get_variante_precio_by_id(conn, id_variante)

        if variante is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante {id_variante}",
            )

        return variante

    finally:
        conn.close()


def actualizar_precio_variante(id_variante: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            variante = get_variante_precio_for_update(conn, id_variante)

            if variante is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la variante {id_variante}",
                )

            if not variante["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"La variante {id_variante} está inactiva",
                )

            precio_minorista_anterior = _dec(variante["precio_minorista"])
            precio_mayorista_anterior = _dec(variante["precio_mayorista"])
            costo_anterior = _dec(variante["costo_promedio_vigente"])

            precio_minorista_nuevo = _dec(data.precio_minorista)
            precio_mayorista_nuevo = _dec(data.precio_mayorista)

            if (
                precio_minorista_anterior == precio_minorista_nuevo
                and precio_mayorista_anterior == precio_mayorista_nuevo
            ):
                raise HTTPException(
                    status_code=400,
                    detail="No hay cambios de precio para registrar",
                )

            movimiento_id = insert_precio_movimiento(
                conn,
                {
                    "id_variante": id_variante,
                    "precio_minorista_anterior": precio_minorista_anterior,
                    "precio_minorista_nuevo": precio_minorista_nuevo,
                    "precio_mayorista_anterior": precio_mayorista_anterior,
                    "precio_mayorista_nuevo": precio_mayorista_nuevo,
                    "costo_anterior": costo_anterior,
                    "costo_nuevo": costo_anterior,
                    "tipo_movimiento": data.tipo_movimiento,
                    "motivo": data.motivo,
                    "origen_tipo": data.origen_tipo,
                    "origen_id": data.origen_id,
                    "id_usuario": data.id_usuario,
                },
            )

            update_variante_precios(
                conn,
                id_variante,
                {
                    "precio_minorista": precio_minorista_nuevo,
                    "precio_mayorista": precio_mayorista_nuevo,
                },
            )

        return {
            "ok": True,
            "id_variante": id_variante,
            "movimiento_id": movimiento_id,
            "precio_minorista_anterior": precio_minorista_anterior,
            "precio_minorista_nuevo": precio_minorista_nuevo,
            "precio_mayorista_anterior": precio_mayorista_anterior,
            "precio_mayorista_nuevo": precio_mayorista_nuevo,
        }

    finally:
        conn.close()


def obtener_historial_precio_variante(id_variante: int):
    conn = get_connection()

    try:
        variante = get_variante_precio_by_id(conn, id_variante)

        if variante is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante {id_variante}",
            )

        movimientos = get_historial_precios_by_variante(conn, id_variante)

        return {
            "variante": variante,
            "movimientos": movimientos,
        }

    finally:
        conn.close()

def _redondear_hacia_arriba(valor: Decimal, base: Decimal) -> Decimal:
    if base <= 0:
        raise HTTPException(
            status_code=400,
            detail="La base de redondeo debe ser mayor a 0",
        )

    if valor <= 0:
        return Decimal("0")

    cociente = valor / base
    entero = cociente.to_integral_value(rounding="ROUND_FLOOR")

    if cociente == entero:
        return valor

    return (entero + 1) * base


def _validar_categoria(conn, id_categoria: int | None):
    if id_categoria is None:
        return None

    categoria = get_categoria_by_id(conn, id_categoria)

    if categoria is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la categoría {id_categoria}",
        )

    if not categoria["activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"La categoría {id_categoria} está inactiva",
        )

    return categoria


def _validar_marca(conn, id_marca: int | None):
    if id_marca is None:
        return None

    marca = get_marca_by_id(conn, id_marca)

    if marca is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la marca {id_marca}",
        )

    if not marca["activa"]:
        raise HTTPException(
            status_code=400,
            detail=f"La marca {id_marca} está inactiva",
        )

    return marca


def crear_regla_precio(data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_categoria(conn, data.id_categoria)
            _validar_marca(conn, data.id_marca)

            regla_id = insert_regla_precio(
                conn,
                {
                    "nombre": data.nombre,
                    "id_categoria": data.id_categoria,
                    "id_marca": data.id_marca,
                    "tipo_cliente": data.tipo_cliente,
                    "margen_porcentaje": data.margen_porcentaje,
                    "redondeo_base": data.redondeo_base,
                },
            )

            regla = get_regla_precio_by_id(conn, regla_id)
            return regla

    finally:
        conn.close()


def listar_reglas_precio(solo_activas: bool = True):
    conn = get_connection()

    try:
        return get_reglas_precio(conn, solo_activas=solo_activas)
    finally:
        conn.close()


def desactivar_regla_precio(regla_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            regla = get_regla_precio_by_id(conn, regla_id)

            if regla is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la regla de precio {regla_id}",
                )

            if not regla["activa"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"La regla de precio {regla_id} ya está inactiva",
                )

            update_regla_precio_estado(conn, regla_id, False)

            regla_actualizada = get_regla_precio_by_id(conn, regla_id)
            return regla_actualizada

    finally:
        conn.close()


def sugerir_precio_variante(id_variante: int, data):
    conn = get_connection()

    try:
        variante = get_variante_contexto_precio(conn, id_variante)

        if variante is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante {id_variante}",
            )

        if not variante["activo"]:
            raise HTTPException(
                status_code=400,
                detail=f"La variante {id_variante} está inactiva",
            )

        regla = buscar_regla_precio_aplicable(
            conn,
            {
                "id_categoria": variante["id_categoria"],
                "id_marca": variante["id_marca"],
                "tipo_cliente": data.tipo_cliente,
            },
        )

        if regla is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No hay regla de precio aplicable para la variante "
                    f"{id_variante} y tipo_cliente={data.tipo_cliente}"
                ),
            )

        costo_base = _dec(variante["costo_promedio_vigente"])
        margen = _dec(regla["margen_porcentaje"])
        redondeo_base = _dec(regla["redondeo_base"])

        precio_sin_redondear = costo_base * (Decimal("1") + margen)
        precio_sugerido = _redondear_hacia_arriba(
            precio_sin_redondear,
            redondeo_base,
        )

        precio_actual = (
            _dec(variante["precio_minorista"])
            if data.tipo_cliente == "minorista"
            else _dec(variante["precio_mayorista"])
        )

        return {
            "id_variante": id_variante,
            "tipo_cliente": data.tipo_cliente,
            "costo_base": costo_base,
            "precio_actual": precio_actual,
            "precio_sugerido": precio_sugerido,
            "margen_porcentaje": margen,
            "redondeo_base": redondeo_base,
            "regla_id": regla["id"],
            "regla_nombre": regla["nombre"],
        }

    finally:
        conn.close()