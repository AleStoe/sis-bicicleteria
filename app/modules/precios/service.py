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
    get_variantes_contexto_precio,
    get_variantes_contexto_precio_by_proveedor,
    get_proveedor_by_id,
    get_familia_precio_by_id,
    get_familias_precio,
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

def _calcular_precio_desde_regla(costo_base: Decimal, regla: dict):
    margen_pct = _dec(regla["margen_porcentaje"])
    descuento_pct = _dec(regla.get("descuento_base_porcentaje") or 0)
    margen_minimo_pct = _dec(regla.get("margen_minimo_porcentaje") or 0)
    redondeo_base = _dec(regla["redondeo_base"])

    precio_objetivo = costo_base * (
        Decimal("1") + (margen_pct / Decimal("100"))
    )

    if descuento_pct > 0:
        precio_lista_sin_redondear = precio_objetivo / (
            Decimal("1") - (descuento_pct / Decimal("100"))
        )
    else:
        precio_lista_sin_redondear = precio_objetivo

    precio_lista = _redondear_hacia_arriba(
        precio_lista_sin_redondear,
        redondeo_base,
    )

    precio_final_estimado = precio_lista * (
        Decimal("1") - (descuento_pct / Decimal("100"))
    )

    precio_minimo = costo_base * (
        Decimal("1") + (margen_minimo_pct / Decimal("100"))
    )

    return {
        "precio_objetivo": precio_objetivo,
        "precio_lista": precio_lista,
        "precio_final_estimado": precio_final_estimado,
        "precio_minimo": precio_minimo,
        "margen_porcentaje": margen_pct,
        "descuento_base_porcentaje": descuento_pct,
        "margen_minimo_porcentaje": margen_minimo_pct,
        "redondeo_base": redondeo_base,
    }

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
            _validar_familia_precio(conn, data.id_familia_precio)
            _validar_proveedor(conn, data.id_proveedor)

            regla_id = insert_regla_precio(
                conn,
                {
                    "nombre": data.nombre,
                    "id_categoria": data.id_categoria,
                    "id_marca": data.id_marca,
                    "id_familia_precio": data.id_familia_precio,
                    "id_proveedor": data.id_proveedor,
                    "tipo_cliente": data.tipo_cliente,
                    "margen_porcentaje": data.margen_porcentaje,
                    "redondeo_base": data.redondeo_base,
                    "descuento_base_porcentaje": data.descuento_base_porcentaje,
                    "margen_minimo_porcentaje": data.margen_minimo_porcentaje,
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
                "id_familia_precio": variante["id_familia_precio"],
                "id_proveedor": variante["proveedor_preferido_id"],
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
        calculo = _calcular_precio_desde_regla(costo_base, regla)

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
            "precio_sugerido": calculo["precio_lista"],
            "margen_porcentaje": calculo["margen_porcentaje"],
            "redondeo_base": calculo["redondeo_base"],
            "regla_id": regla["id"],
            "regla_nombre": regla["nombre"],
            "precio_objetivo": calculo["precio_objetivo"],
            "precio_lista": calculo["precio_lista"],
            "precio_final_estimado": calculo["precio_final_estimado"],
            "precio_minimo": calculo["precio_minimo"],
            "descuento_base_porcentaje": calculo["descuento_base_porcentaje"],
            "margen_minimo_porcentaje": calculo["margen_minimo_porcentaje"],
        }

    finally:
        conn.close()

def listar_precios_desfasados(
    *,
    tipo_cliente: str,
    id_proveedor: int | None = None,
    id_categoria: int | None = None,
    id_marca: int | None = None,
):
    conn = get_connection()

    try:
        variantes = get_variantes_contexto_precio(
            conn,
            {
                "id_proveedor": id_proveedor,
                "id_categoria": id_categoria,
                "id_marca": id_marca,
            },
        )

        items = []

        for variante in variantes:
            regla = buscar_regla_precio_aplicable(
                conn,
                {
                    "id_categoria": variante["id_categoria"],
                    "id_marca": variante["id_marca"],
                    "id_familia_precio": variante["id_familia_precio"],
                    "id_proveedor": variante["proveedor_preferido_id"],
                    "tipo_cliente": tipo_cliente,
                },
            )

            if regla is None:
                continue

            costo_base = _dec(variante["costo_promedio_vigente"])
            calculo = _calcular_precio_desde_regla(costo_base, regla)

            precio_sugerido = calculo["precio_lista"]
            margen_esperado = calculo["margen_porcentaje"]

            precio_actual = (
                _dec(variante["precio_minorista"])
                if tipo_cliente == "minorista"
                else _dec(variante["precio_mayorista"])
            )

            if precio_actual == precio_sugerido:
                continue

            margen_real = (
                ((precio_actual / costo_base) - Decimal("1")) * Decimal("100")
                if costo_base > 0
                else Decimal("0")
            )

            diferencia = precio_sugerido - precio_actual

            items.append(
                {
                    "id_variante": variante["id"],
                    "producto_nombre": variante["producto_nombre"],
                    "nombre_variante": variante["nombre_variante"],
                    "tipo_cliente": tipo_cliente,
                    "costo_base": costo_base,
                    "precio_actual": precio_actual,
                    "precio_sugerido": precio_sugerido,
                    "diferencia": diferencia,
                    "margen_real": margen_real,
                    "margen_esperado": margen_esperado,
                    "regla_id": regla["id"],
                    "regla_nombre": regla["nombre"],
                }
            )

        return {
            "total": len(items),
            "items": items,
        }

    finally:
        conn.close()
    
def recalcular_precios_por_proveedor(data):
    conn = get_connection()

    try:
        with conn.transaction():
            proveedor = get_proveedor_by_id(conn, data.id_proveedor)

            if proveedor is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el proveedor {data.id_proveedor}",
                )

            if not proveedor["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"El proveedor {data.id_proveedor} está inactivo",
                )

            if data.aplicar and data.id_usuario is None:
                raise HTTPException(
                    status_code=400,
                    detail="id_usuario es obligatorio cuando aplicar=true",
                )

            variantes = get_variantes_contexto_precio_by_proveedor(
                conn,
                data.id_proveedor,
            )

            items = []
            total_aplicados = 0

            for variante in variantes:
                if variante["permite_precio_libre"]:
                    continue

                regla = buscar_regla_precio_aplicable(
                    conn,
                    {
                        "id_categoria": variante["id_categoria"],
                        "id_marca": variante["id_marca"],
                        "id_familia_precio": variante["id_familia_precio"],
                        "id_proveedor": variante["proveedor_preferido_id"],
                        "tipo_cliente": data.tipo_cliente,
                    },
                )

                if regla is None:
                    continue

                costo_base = _dec(variante["costo_promedio_vigente"])
                calculo = _calcular_precio_desde_regla(costo_base, regla)

                precio_sugerido = calculo["precio_lista"]
                margen_esperado = calculo["margen_porcentaje"]

                precio_minorista_actual = _dec(variante["precio_minorista"])
                precio_mayorista_actual = _dec(variante["precio_mayorista"])

                precio_actual = (
                    precio_minorista_actual
                    if data.tipo_cliente == "minorista"
                    else precio_mayorista_actual
                )

                if precio_actual == precio_sugerido:
                    continue

                margen_real = (
                    ((precio_actual / costo_base) - Decimal("1")) * Decimal("100")
                    if costo_base > 0
                    else Decimal("0")
                )

                diferencia = precio_sugerido - precio_actual
                movimiento_id = None
                aplicado = False

                if data.aplicar:
                    if data.tipo_cliente == "minorista":
                        precio_minorista_nuevo = precio_sugerido
                        precio_mayorista_nuevo = precio_mayorista_actual
                    else:
                        precio_minorista_nuevo = precio_minorista_actual
                        precio_mayorista_nuevo = precio_sugerido

                    movimiento_id = insert_precio_movimiento(
                        conn,
                        {
                            "id_variante": variante["id"],
                            "precio_minorista_anterior": precio_minorista_actual,
                            "precio_minorista_nuevo": precio_minorista_nuevo,
                            "precio_mayorista_anterior": precio_mayorista_actual,
                            "precio_mayorista_nuevo": precio_mayorista_nuevo,
                            "costo_anterior": costo_base,
                            "costo_nuevo": costo_base,
                            "tipo_movimiento": "cambio_margen",
                            "motivo": data.motivo
                            or (
                                f"Recalculo masivo por proveedor "
                                f"{data.id_proveedor}. tipo_cliente={data.tipo_cliente}"
                            ),
                            "origen_tipo": "proveedor",
                            "origen_id": data.id_proveedor,
                            "id_usuario": data.id_usuario,
                        },
                    )

                    update_variante_precios(
                        conn,
                        variante["id"],
                        {
                            "precio_minorista": precio_minorista_nuevo,
                            "precio_mayorista": precio_mayorista_nuevo,
                        },
                    )

                    aplicado = True
                    total_aplicados += 1

                items.append(
                    {
                        "id_variante": variante["id"],
                        "producto_nombre": variante["producto_nombre"],
                        "nombre_variante": variante["nombre_variante"],
                        "tipo_cliente": data.tipo_cliente,
                        "costo_base": costo_base,
                        "precio_actual": precio_actual,
                        "precio_sugerido": precio_sugerido,
                        "diferencia": diferencia,
                        "margen_real": margen_real,
                        "margen_esperado": margen_esperado,
                        "regla_id": regla["id"],
                        "regla_nombre": regla["nombre"],
                        "aplicado": aplicado,
                        "movimiento_id": movimiento_id,
                    }
                )

            return {
                "ok": True,
                "aplicado": data.aplicar,
                "id_proveedor": data.id_proveedor,
                "tipo_cliente": data.tipo_cliente,
                "total_detectados": len(items),
                "total_aplicados": total_aplicados,
                "items": items,
            }

    finally:
        conn.close()

def _validar_familia_precio(conn, id_familia_precio: int | None):
    if id_familia_precio is None:
        return None

    familia = get_familia_precio_by_id(
        conn,
        id_familia_precio,
    )

    if familia is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No existe la familia de precio "
                f"{id_familia_precio}"
            ),
        )

    if not familia["activa"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La familia de precio "
                f"{id_familia_precio} está inactiva"
            ),
        )

    return familia

def _validar_proveedor(conn, id_proveedor: int | None):
    if id_proveedor is None:
        return None

    proveedor = get_proveedor_by_id(conn, id_proveedor)

    if proveedor is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe el proveedor {id_proveedor}",
        )

    if not proveedor["activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"El proveedor {id_proveedor} está inactivo",
        )

    return proveedor

def listar_familias_precio():
    conn = get_connection()

    try:
        return get_familias_precio(conn)
    finally:
        conn.close()