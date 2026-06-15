from decimal import Decimal
from psycopg.rows import dict_row
from datetime import date, timedelta
from app.modules.pagos import service as pagos_service
from app.shared.money import to_decimal
from fastapi import HTTPException
from app.modules.servicios_taller.repository import get_servicio_taller_by_id
from app.modules.authz.service import (
    exigir_permiso_anular_venta,
    exigir_permiso_entregar_con_deuda,
)
from app.modules.reglas_comerciales.service import (
    simular_reglas_comerciales,
)
from app.db.connection import get_connection
from app.modules.stock import service as stock_service
from app.modules.creditos import service as creditos_service
from app.modules.auditoria import service as auditoria_service
from app.modules.pagos.repository import (
    get_total_pagado_confirmado_por_venta,
    get_pagos_confirmados_por_venta,
    update_pago_estado,
)
from app.modules.serializadas.repository import (
    get_bicicleta_serializada_for_update,
    update_bicicleta_serializada_estado,
    insert_bicicleta_cliente,
)
from app.modules.creditos.service import crear_credito_por_devolucion_venta
from app.modules.deudas import service as deudas_service
from app.modules.deudas import repository as deudas_repository
from app.modules.creditos import repository as creditos_repository
from app.shared.money import redondear_monto
from .repository import (
    get_cliente_by_id,
    get_sucursal_by_id,
    get_variantes_by_ids,
    insert_venta,
    insert_venta_item,
    get_ventas,
    get_venta_by_id,
    get_venta_items_by_venta_id,
    get_venta_items_detallados_by_venta_id,
    get_venta_for_update,
    update_venta_estado,
    update_venta_saldo_y_estado,
    insert_venta_anulacion,
    insert_venta_devolucion,
    get_venta_devolucion_by_venta_item_id,
    insert_venta_item_devolucion,
    get_total_devuelto_by_venta_item_id,
    insert_venta_regla_aplicada,
)
from app.shared.constants import (
    AUDITORIA_ENTIDAD_VENTA,
    AUDITORIA_ACCION_VENTA_CREADA,
    AUDITORIA_ACCION_VENTA_ENTREGADA,
    AUDITORIA_ACCION_VENTA_ANULADA,
    VENTA_ESTADO_ANULADA,
    VENTA_ESTADO_ENTREGADA,
    AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA,
    AUDITORIA_ACCION_VENTA_DEVOLUCION_CREADA,
    ORIGEN_VENTA,
    MODOS_DEVOLUCION_VALIDOS,
    MODO_DEVOLUCION_CREDITO_COMERCIAL,
    MODO_DEVOLUCION_REVERSION_PAGO_EXTERNO,
    PAGO_ESTADO_DEVUELTO_EXTERNO
)
from app.modules.deudas import service as deudas_service

def _consolidar_items(items):
    consolidados = {}

    for item in items:
        tipo_item = item.get("tipo_item", "producto")
        cantidad = Decimal(str(item["cantidad"]))
        id_bicicleta_serializada = item.get("id_bicicleta_serializada")

        if cantidad <= 0:
            raise HTTPException(
                status_code=400,
                detail="La cantidad debe ser mayor a 0",
            )

        if tipo_item == "servicio_taller":
            id_servicio_taller = item.get("id_servicio_taller")

            if not id_servicio_taller:
                raise HTTPException(
                    status_code=400,
                    detail="Un servicio de taller requiere id_servicio_taller",
                )

            if item.get("id_variante") is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Un servicio de taller no debe tener id_variante",
                )

            if id_bicicleta_serializada is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Un servicio de taller no debe tener bicicleta serializada",
                )

            clave = (
                "servicio_taller",
                id_servicio_taller,
                item.get("precio_unitario_manual"),
                bool(item.get("bonificado", False)),
                item.get("motivo_precio_manual"),
                item.get("motivo_bonificacion"),
                item.get("id_orden_taller_item"),
                item.get("descripcion_snapshot"),
            )

            if clave not in consolidados:
                consolidados[clave] = {
                    "tipo_item": "servicio_taller",
                    "id_variante": None,
                    "id_servicio_taller": id_servicio_taller,
                    "cantidad": cantidad,
                    "id_bicicleta_serializada": None,
                    "precio_unitario_manual": item.get("precio_unitario_manual"),
                    "bonificado": bool(item.get("bonificado", False)),
                    "motivo_precio_manual": item.get("motivo_precio_manual"),
                    "motivo_bonificacion": item.get("motivo_bonificacion"),
                    "id_orden_taller_item": item.get("id_orden_taller_item"),
                    "descripcion_snapshot": item.get("descripcion_snapshot"),
                }
            else:
                consolidados[clave]["cantidad"] += cantidad

            continue

        if tipo_item != "producto":
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de item de venta inválido: {tipo_item}",
            )

        id_variante = item.get("id_variante")

        if not id_variante:
            raise HTTPException(
                status_code=400,
                detail="Un producto requiere id_variante",
            )

        if id_bicicleta_serializada:
            if cantidad != Decimal("1"):
                raise HTTPException(
                    status_code=400,
                    detail="Un item con bicicleta serializada debe tener cantidad = 1",
                )

            clave = ("producto", id_variante, id_bicicleta_serializada)

            if clave in consolidados:
                raise HTTPException(
                    status_code=400,
                    detail="La misma bicicleta serializada no puede repetirse en la venta",
                )

            consolidados[clave] = {
                "tipo_item": "producto",
                "id_variante": id_variante,
                "id_servicio_taller": None,
                "cantidad": cantidad,
                "id_bicicleta_serializada": id_bicicleta_serializada,
            }
            continue

        clave = (
            "producto",
            id_variante,
            None,
            item.get("precio_unitario_manual"),
            bool(item.get("bonificado", False)),
            item.get("motivo_precio_manual"),
            item.get("motivo_bonificacion"),
            item.get("id_orden_taller_item"),
        )

        if clave not in consolidados:
            consolidados[clave] = {
                "tipo_item": "producto",
                "id_variante": id_variante,
                "id_servicio_taller": None,
                "cantidad": cantidad,
                "id_bicicleta_serializada": None,
                "precio_unitario_manual": item.get("precio_unitario_manual"),
                "bonificado": bool(item.get("bonificado", False)),
                "motivo_precio_manual": item.get("motivo_precio_manual"),
                "motivo_bonificacion": item.get("motivo_bonificacion"),
                "id_orden_taller_item": item.get("id_orden_taller_item"),
            }
        else:
            consolidados[clave]["cantidad"] += cantidad

    return list(consolidados.values())

def _obtener_modo_devolucion(data) -> str:
    modo = getattr(data, "modo_devolucion", MODO_DEVOLUCION_CREDITO_COMERCIAL)

    if modo not in MODOS_DEVOLUCION_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Modo de devolución inválido: {modo}",
        )

    return modo
def _registrar_reversion_pago_externo_por_devolucion(
    conn,
    *,
    venta_id: int,
    id_usuario: int,
):
    pagos = get_pagos_confirmados_por_venta(conn, venta_id)

    pagos_externos = [
        pago for pago in pagos
        if pago["medio_pago"] in {"tarjeta", "mercadopago"}
    ]

    if not pagos_externos:
        raise HTTPException(
            status_code=400,
            detail="La venta no tiene pagos externos confirmados para marcar como devueltos",
        )

    for pago in pagos_externos:
        update_pago_estado(
            conn,
            pago["id"],
            PAGO_ESTADO_DEVUELTO_EXTERNO,
        )

def _resolver_credito_por_devolucion(
    conn,
    *,
    venta,
    venta_id: int,
    monto_credito: Decimal,
    id_usuario: int,
    modo_devolucion: str,
):
    if monto_credito <= Decimal("0"):
        return None

    if modo_devolucion == MODO_DEVOLUCION_CREDITO_COMERCIAL:
        return creditos_service.crear_credito_por_devolucion_venta(
            conn,
            id_cliente=venta["id_cliente"],
            id_venta=venta_id,
            monto_credito=monto_credito,
            id_usuario=id_usuario,
        )

    if modo_devolucion == MODO_DEVOLUCION_REVERSION_PAGO_EXTERNO:
        _registrar_reversion_pago_externo_por_devolucion(
            conn,
            venta_id=venta_id,
            id_usuario=id_usuario,
        )
        return None

    raise HTTPException(
        status_code=400,
        detail=f"Modo de devolución inválido: {modo_devolucion}",
    )

def _validar_cliente(conn, id_cliente: int):
    cliente = get_cliente_by_id(conn, id_cliente)

    if cliente is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe el cliente {id_cliente}",
        )

    if not cliente["activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"El cliente {id_cliente} está inactivo",
        )

    return cliente


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


def _obtener_variantes_map(conn, ids_unicos):
    variantes = get_variantes_by_ids(conn, ids_unicos)
    variantes_map = {v["id"]: v for v in variantes}

    if len(variantes_map) != len(ids_unicos):
        raise HTTPException(
            status_code=400,
            detail="Una o más variantes no existen",
        )

    for variante in variantes:
        if not variante["producto_activo"]:
            raise HTTPException(
                status_code=400,
                detail=f"El producto de la variante {variante['id']} está inactivo",
            )

        if not variante["variante_activa"]:
            raise HTTPException(
                status_code=400,
                detail=f"La variante {variante['id']} está inactiva",
            )

    return variantes_map


def _validar_venta_entregable(venta, venta_id: int):
    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {venta_id}",
        )

    if venta["estado"] == "anulada":
        raise HTTPException(
            status_code=400,
            detail=f"La venta {venta_id} está anulada y no se puede entregar",
        )

    if venta["estado"] == "entregada":
        raise HTTPException(
            status_code=400,
            detail=f"La venta {venta_id} ya fue entregada",
        )


def _validar_venta_anulable(venta, venta_id: int):
    if venta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe la venta {venta_id}",
        )

    estados_anulables = {"creada", "pagada_parcial", "pagada_total"}

    if venta["estado"] not in estados_anulables:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La venta {venta_id} no se puede anular porque está en estado "
                f"'{venta['estado']}'"
            ),
        )


def _validar_y_bloquear_bicicleta_serializada_para_venta(
    conn,
    *,
    id_bicicleta_serializada: int,
    id_variante: int,
    id_sucursal: int,
):
    bicicleta = get_bicicleta_serializada_for_update(conn, id_bicicleta_serializada)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No existe la bicicleta serializada {id_bicicleta_serializada}"
            ),
        )

    if bicicleta["id_variante"] != id_variante:
        raise HTTPException(
            status_code=400,
            detail=(
                "La bicicleta serializada no corresponde a la variante informada"
            ),
        )

    if bicicleta["id_sucursal_actual"] != id_sucursal:
        raise HTTPException(
            status_code=400,
            detail=(
                "La bicicleta serializada no pertenece a la sucursal de la venta"
            ),
        )

    if bicicleta["estado"] != "disponible":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {id_bicicleta_serializada} "
                f"no está disponible"
            ),
        )

    return bicicleta


def _validar_y_bloquear_bicicleta_serializada_para_entrega(
    conn,
    *,
    item: dict,
    venta_id: int,
):
    bicicleta_id = item.get("id_bicicleta_serializada")
    if not bicicleta_id:
        return None

    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No existe la bicicleta serializada {bicicleta_id}"
            ),
        )

    if bicicleta["id_variante"] != item["id_variante"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no coincide con la variante del item de la venta {venta_id}"
            ),
        )

    if bicicleta["estado"] != "vendida_pendiente_entrega":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no está en estado vendida_pendiente_entrega"
            ),
        )

    return bicicleta


def _validar_y_bloquear_bicicleta_serializada_para_anulacion(
    conn,
    *,
    item: dict,
    venta_id: int,
):
    bicicleta_id = item.get("id_bicicleta_serializada")
    if not bicicleta_id:
        return None

    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No existe la bicicleta serializada {bicicleta_id}"
            ),
        )

    if bicicleta["id_variante"] != item["id_variante"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no coincide con la variante del item de la venta {venta_id}"
            ),
        )

    if bicicleta["estado"] != "vendida_pendiente_entrega":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no está en estado vendida_pendiente_entrega"
            ),
        )

    return bicicleta



def _validar_y_bloquear_bicicleta_serializada_para_devolucion(
    conn,
    *,
    item: dict,
    venta_id: int,
):
    bicicleta_id = item.get("id_bicicleta_serializada")
    if not bicicleta_id:
        raise HTTPException(
            status_code=400,
            detail="El item indicado no tiene bicicleta serializada",
        )

    bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

    if bicicleta is None:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la bicicleta serializada {bicicleta_id}",
        )

    if bicicleta["id_variante"] != item["id_variante"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no coincide con la variante del item de la venta {venta_id}"
            ),
        )

    if bicicleta["estado"] != "entregada":
        raise HTTPException(
            status_code=400,
            detail=(
                f"La bicicleta serializada {bicicleta_id} "
                f"no está en estado entregada"
            ),
        )

    return bicicleta

def crear_venta(data):
    conn = get_connection()

    try:
        with conn.transaction():
            if not data.items:
                raise HTTPException(
                    status_code=400,
                    detail="La venta debe tener al menos un item",
                )

            _validar_cliente(conn, data.id_cliente)
            _validar_sucursal(conn, data.id_sucursal)

            items_input = [
                {
                    "tipo_item": item.tipo_item,
                    "id_variante": item.id_variante,
                    "id_servicio_taller": item.id_servicio_taller,
                    "cantidad": item.cantidad,
                    "id_bicicleta_serializada": item.id_bicicleta_serializada,
                    "precio_unitario_manual": item.precio_unitario_manual,
                    "bonificado": item.bonificado,
                    "motivo_precio_manual": item.motivo_precio_manual,
                    "motivo_bonificacion": item.motivo_bonificacion,
                    "id_orden_taller_item": item.id_orden_taller_item,
                    "descripcion_snapshot": item.descripcion_snapshot,
                }
                for item in data.items
            ]

            items_consolidados = _consolidar_items(items_input)
            ids_unicos = list({
                item["id_variante"]
                for item in items_consolidados
                if item.get("tipo_item", "producto") == "producto"
            })

            variantes_map = (
                _obtener_variantes_map(conn, ids_unicos)
                if ids_unicos
                else {}
            )

            subtotal_total = Decimal("0")
            venta_items = []

            for item in items_consolidados:
                cantidad = to_decimal(item["cantidad"])
                bonificado = item.get("bonificado", False)
                precio_manual = item.get("precio_unitario_manual")

                if item.get("tipo_item", "producto") == "servicio_taller":
                    servicio = get_servicio_taller_by_id(conn, item["id_servicio_taller"])

                    if servicio is None:
                        raise HTTPException(
                            status_code=400,
                            detail=f"No existe el servicio de taller {item['id_servicio_taller']}",
                        )

                    if servicio["activo"] is not True:
                        raise HTTPException(
                            status_code=400,
                            detail="No se puede vender un servicio de taller inactivo",
                        )

                    precio_lista = redondear_monto(precio_manual)

                    precio_final = Decimal("0") if bonificado else precio_lista
                    subtotal = redondear_monto(precio_final * cantidad)
                    subtotal_total = redondear_monto(subtotal_total + subtotal)

                    venta_items.append(
                        {
                            "tipo_item": "servicio_taller",
                            "item": item,
                            "servicio": servicio,
                            "variante": None,
                            "cantidad": cantidad,
                            "subtotal": subtotal,
                            "precio_final": precio_final,
                            "precio_lista": precio_lista,
                            "bonificado": bonificado,
                            "motivo_precio_manual": item.get("motivo_precio_manual"),
                            "motivo_bonificacion": item.get("motivo_bonificacion"),
                        }
                    )
                    continue

                variante = variantes_map[item["id_variante"]]
                campo_precio = (
                    "precio_mayorista"
                    if data.tipo_precio == "mayorista"
                    else "precio_minorista"
                )

                precio_lista = redondear_monto(variante[campo_precio])

                if precio_lista <= Decimal("0"):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"La variante {item['id_variante']} no tiene precio "
                            f"{data.tipo_precio} configurado"
                        ),
                    )

                if bonificado:
                    precio_final = Decimal("0")
                else:
                    precio_final = (
                        redondear_monto(to_decimal(precio_manual))
                        if precio_manual is not None
                        else precio_lista
                    )

                subtotal = redondear_monto(precio_final * cantidad)
                subtotal_total = redondear_monto(subtotal_total + subtotal)

                if item["id_bicicleta_serializada"] is not None:
                    _validar_y_bloquear_bicicleta_serializada_para_venta(
                        conn,
                        id_bicicleta_serializada=item["id_bicicleta_serializada"],
                        id_variante=item["id_variante"],
                        id_sucursal=data.id_sucursal,
                    )

                venta_items.append(
                    {
                        "tipo_item": "producto",
                        "item": item,
                        "variante": variante,
                        "cantidad": cantidad,
                        "subtotal": subtotal,
                        "precio_final": precio_final,
                        "precio_lista": precio_lista,
                        "bonificado": bonificado,
                        "motivo_precio_manual": item.get("motivo_precio_manual"),
                        "motivo_bonificacion": item.get("motivo_bonificacion"),
                    }
                )
            pagos = getattr(data, "pagos", []) or []
            resultado_reglas = simular_reglas_comerciales(
                type(
                    "TmpSimulacion",
                    (),
                    {
                        "subtotal_base": subtotal_total,
                        "medios_pago": pagos,
                        "sugerir_saldo_con_medio_pago": None,
                    },
                )()
            )

            descuento_total = redondear_monto(
                resultado_reglas["descuento_total"]
            )

            recargo_total = redondear_monto(
                resultado_reglas["recargo_total"]
            )

            total_final = redondear_monto(
                resultado_reglas["total_final"]
            )

            reglas_aplicadas = resultado_reglas["reglas_aplicadas"]
            tramos_pago = resultado_reglas.get("tramos_pago", [])

            if len(tramos_pago) != len(pagos):
                raise HTTPException(
                    status_code=500,
                    detail="Inconsistencia interna: la cantidad de tramos no coincide con la cantidad de pagos",
                )

            credito_aplicado = Decimal("0")

            venta_id = insert_venta(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": data.id_cliente,
                    "estado": "creada",
                    "tipo_precio": data.tipo_precio,
                    "subtotal_base": subtotal_total,
                    "descuento_total": descuento_total,
                    "recargo_total": recargo_total,
                    "total_final": total_final,
                    "saldo_pendiente": total_final,
                    "id_usuario_creador": data.id_usuario,
                    "observaciones": getattr(data, "observaciones", None),
                    "id_reserva_origen": None,
                    "id_orden_taller": getattr(data, "id_orden_taller", None),
                },
            )
            for regla in reglas_aplicadas:
                insert_venta_regla_aplicada(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_regla_comercial": regla["id_regla_comercial"],
                        "tipo": regla["tipo"],
                        "descripcion_snapshot": regla["descripcion"],
                        "monto_aplicado": regla["monto_aplicado"],
                        "porcentaje_aplicado": regla["porcentaje_aplicado"],
                    },
                )
            for fila in venta_items:
                item = fila["item"]
                cantidad = fila["cantidad"]
                subtotal = fila["subtotal"]

                if fila.get("tipo_item") == "servicio_taller":
                    servicio = fila["servicio"]

                    insert_venta_item(
                        conn,
                        {
                            "id_venta": venta_id,
                            "tipo_item": "servicio_taller",
                            "id_variante": None,
                            "id_servicio_taller": item["id_servicio_taller"],
                            "id_bicicleta_serializada": None,
                            "id_orden_taller_item": item.get("id_orden_taller_item"),
                            "descripcion_snapshot": (
                                item.get("descripcion_snapshot")
                                or servicio["nombre"]
                            ),
                            "cantidad": cantidad,
                            "precio_lista": fila["precio_lista"],
                            "precio_final": fila["precio_final"],
                            "precio_unitario_original": fila["precio_lista"],
                            "precio_unitario_final": fila["precio_final"],
                            "bonificado": fila.get("bonificado", False),
                            "motivo_bonificacion": fila.get("motivo_bonificacion"),
                            "motivo_precio_manual": fila.get("motivo_precio_manual"),
                            "costo_unitario_aplicado": Decimal("0"),
                            "subtotal": subtotal,
                        },
                    )
                    continue

                variante = fila["variante"]
                precio_minorista = redondear_monto(variante["precio_minorista"])
                costo_promedio = redondear_monto(variante["costo_promedio_vigente"] or 0)

                insert_venta_item(
                    conn,
                    {
                        "id_venta": venta_id,
                        "tipo_item": "producto",
                        "id_variante": variante["id"],
                        "id_servicio_taller": None,
                        "id_bicicleta_serializada": item["id_bicicleta_serializada"],
                        "id_orden_taller_item": item.get("id_orden_taller_item"),
                        "descripcion_snapshot": (
                            f"{variante['producto_nombre']} - "
                            f"{variante['nombre_variante']}"
                        ),
                        "cantidad": cantidad,
                        "precio_lista": fila["precio_lista"],
                        "precio_final": fila["precio_final"],
                        "precio_unitario_original": fila.get("precio_lista") or fila.get("precio_final"),
                        "precio_unitario_final": fila.get("precio_final") or fila.get("precio_lista"),
                        "bonificado": fila.get("bonificado", False),
                        "motivo_bonificacion": fila.get("motivo_bonificacion"),
                        "motivo_precio_manual": fila.get("motivo_precio_manual"),
                        "costo_unitario_aplicado": costo_promedio,
                        "subtotal": subtotal,
                    },
                )

                if item["id_bicicleta_serializada"] is not None:
                    update_bicicleta_serializada_estado(
                        conn,
                        item["id_bicicleta_serializada"],
                        "vendida_pendiente_entrega",
                    )

                    stock_service.registrar_movimiento_serializada_sin_stock(
                        conn,
                        {
                            "id_sucursal": data.id_sucursal,
                            "id_variante": variante["id"],
                            "id_bicicleta_serializada": item["id_bicicleta_serializada"],
                            "tipo_movimiento": "venta_serializada",
                            "id_usuario": data.id_usuario,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "nota": f"Venta serializada #{venta_id}",
                        },
                    )

            items_stock = sorted(
                [
                    fila
                    for fila in venta_items
                    if fila.get("tipo_item") == "producto"
                    and fila["variante"] is not None
                    and fila["variante"]["stockeable"]
                ],
                key=lambda fila: fila["variante"]["id"],
            )

            for fila in items_stock:
                item = fila["item"]
                variante = fila["variante"]
                if item.get("id_bicicleta_serializada") is not None:
                    continue
                if item.get("id_orden_taller_item") is not None:
                    continue
                try:
                    stock_service.marcar_stock_pendiente_entrega(
                        conn,
                        {
                            "id_sucursal": data.id_sucursal,
                            "id_variante": variante["id"],
                            "cantidad": to_decimal(item["cantidad"]),
                            "id_usuario": data.id_usuario,
                            "descontar_de_reservado": False,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                            "nota": f"Venta #{venta_id} pendiente de entrega",
                        },
                    )
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))

            usar_credito = getattr(data, "usar_credito", False)
            monto_credito_a_aplicar = getattr(data, "monto_credito_a_aplicar", None)

            if usar_credito:
                resultado_credito = creditos_service.aplicar_credito_a_venta(
                    conn,
                    id_cliente=data.id_cliente,
                    id_venta=venta_id,
                    total_venta=redondear_monto(resultado_reglas["saldo_estimado"]),
                    usar_credito=usar_credito,
                    monto_credito_a_aplicar=monto_credito_a_aplicar,
                    id_usuario=data.id_usuario,
                )
                credito_aplicado = redondear_monto(resultado_credito["credito_aplicado_total"])
                saldo_despues_credito = redondear_monto(total_final - credito_aplicado)

                if saldo_despues_credito == Decimal("0"):
                    estado_venta = "pagada_total"
                elif credito_aplicado > Decimal("0"):
                    estado_venta = "pagada_parcial"
                else:
                    estado_venta = "creada"

                update_venta_saldo_y_estado(
                    conn,
                    venta_id,
                    saldo_despues_credito,
                    estado_venta,
                )
            for pago, tramo in zip(pagos, tramos_pago):
                monto_total_cobrado = redondear_monto(tramo["monto_total_cobrado"])
                monto_base_aplicado = redondear_monto(tramo["monto_base_aplicado"])
                recargo_aplicado = redondear_monto(tramo["recargo_aplicado"])

                payload_pago = {
                    "id_cliente": data.id_cliente,
                    "origen_tipo": "venta",
                    "origen_id": venta_id,
                    "medio_pago": tramo["medio_pago"],
                    "monto": monto_total_cobrado,
                    "cuotas": tramo.get("cuotas"),
                    "entidad": tramo.get("entidad"),
                    "nota": getattr(pago, "nota", None),
                    "id_usuario": data.id_usuario,
                }

                if tramo["medio_pago"] == "tarjeta":
                    payload_pago.update(
                        {
                            "id_tarjeta_plan": tramo.get("id_tarjeta_plan"),
                            "monto_base": monto_base_aplicado,
                            "monto_recargo_financiero": recargo_aplicado,
                            "porcentaje_recargo_aplicado": tramo.get("porcentaje_recargo_aplicado"),
                            "monto_neto_liquidado": monto_total_cobrado,
                        }
                    )

                pagos_service.registrar_pago(conn, payload_pago)


            total_pagado_confirmado = redondear_monto(
                get_total_pagado_confirmado_por_venta(conn, venta_id)
            )

            saldo_pendiente = redondear_monto(
                total_final - total_pagado_confirmado - credito_aplicado
            )

            if saldo_pendiente < Decimal("0"):
                saldo_pendiente = Decimal("0")

            if saldo_pendiente == Decimal("0"):
                estado_venta = "pagada_total"
            elif saldo_pendiente < total_final:
                estado_venta = "pagada_parcial"
            else:
                estado_venta = "creada"

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                saldo_pendiente,
                estado_venta,
            )

            saldo_pendiente = redondear_monto(
                total_final - total_pagado_confirmado - credito_aplicado
            )

            if saldo_pendiente < Decimal("0"):
                saldo_pendiente = Decimal("0")

            if saldo_pendiente == Decimal("0"):
                estado_venta = "pagada_total"
            elif saldo_pendiente < total_final:
                estado_venta = "pagada_parcial"
            else:
                estado_venta = "creada"

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                saldo_pendiente,
                estado_venta,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=data.id_sucursal,
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_CREADA,
                detalle=(
                    f"Venta creada. cliente={data.id_cliente}, "
                    f"total_final={total_final}, "
                    f"credito_aplicado={credito_aplicado}, "
                    f"saldo_pendiente={saldo_pendiente}, "
                    f"estado={estado_venta}"
                ),
                metadata={
                    "tipo": "venta_creada",
                    "venta_id": venta_id,
                    "cliente_id": data.id_cliente,
                    "sucursal_id": data.id_sucursal,
                    "total_final": str(total_final),
                    "credito_aplicado": str(credito_aplicado),
                    "saldo_pendiente": str(saldo_pendiente),
                    "estado": estado_venta,
                },
                origen_tipo="venta",
                origen_id=venta_id,
            )
                        

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": estado_venta,
            "credito_aplicado": credito_aplicado,
            "saldo_pendiente": saldo_pendiente,
        }

    finally:
        conn.close()

def listar_ventas():
    conn = get_connection()
    try:
        return get_ventas(conn)
    finally:
        conn.close()

def obtener_venta(venta_id: int):
    conn = get_connection()
    try:
        venta = get_venta_by_id(conn, venta_id)

        if venta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la venta {venta_id}",
            )

        items = get_venta_items_by_venta_id(conn, venta_id)

        deuda_asociada = deudas_repository.get_deuda_por_origen(
            conn,
            origen_tipo=ORIGEN_VENTA,
            origen_id=venta_id,
        )

        total_final = redondear_monto(venta["total_final"])

        total_pagado_directo_venta = redondear_monto(
            get_total_pagado_confirmado_por_venta(conn, venta_id)
        )

        pagos_deuda = (
            deudas_repository.get_pagos_confirmados_deuda(
                conn,
                deuda_asociada["id"],
            )
            if deuda_asociada is not None
            else []
        )

        total_pagado_deuda_cobrado = redondear_monto(
            sum(
                redondear_monto(pago["monto_total_cobrado"] or 0)
                for pago in pagos_deuda
            )
        )

        total_base_cancelada_deuda = redondear_monto(
            sum(
                redondear_monto(pago["monto_base_aplicado"] or 0)
                for pago in pagos_deuda
            )
        )

        cobertura_no_cobrada_deuda = redondear_monto(
            total_base_cancelada_deuda - total_pagado_deuda_cobrado
        )

        if cobertura_no_cobrada_deuda < Decimal("0"):
            cobertura_no_cobrada_deuda = Decimal("0.00")

        total_pagado_confirmado = redondear_monto(
            total_pagado_directo_venta + total_pagado_deuda_cobrado
        )

        if deuda_asociada is not None:
            saldo_pendiente = redondear_monto(deuda_asociada["saldo_actual"])
        else:
            saldo_pendiente = redondear_monto(venta["saldo_pendiente"])

        credito_aplicado_real = redondear_monto(
            creditos_repository.get_total_credito_aplicado_a_venta(
                conn,
                venta_id,
            )
        )

        credito_generado_devolucion = redondear_monto(
            creditos_repository.get_total_credito_generado_por_venta(
                conn,
                venta_id,
            )
        )

        deuda_cancelada_por_devolucion = redondear_monto(
            deudas_repository.get_total_deuda_cancelada_por_devolucion_venta(
                conn,
                venta_id,
            )
        )

        monto_cubierto_sin_pago_real = redondear_monto(
            total_final
            - total_pagado_confirmado
            - saldo_pendiente
            - credito_aplicado_real
        )

        if monto_cubierto_sin_pago_real < Decimal("0"):
            monto_cubierto_sin_pago_real = Decimal("0.00")

        if abs(monto_cubierto_sin_pago_real) <= Decimal("0.01"):
            monto_cubierto_sin_pago_real = Decimal("0.00")

        tiene_deuda = (
            deuda_asociada is not None
            and redondear_monto(deuda_asociada["saldo_actual"]) > Decimal("0")
        )

        deuda_payload = (
            {
                "id": deuda_asociada["id"],
                "saldo_actual": deuda_asociada["saldo_actual"],
                "estado": deuda_asociada["estado"],
                "origen_tipo": deuda_asociada["origen_tipo"],
                "origen_id": deuda_asociada["origen_id"],
            }
            if deuda_asociada is not None
            else None
        )

        venta_response = {
            **venta,
            "saldo_pendiente": saldo_pendiente,
        }

        situacion_financiera = {
            "tiene_deuda": tiene_deuda,
            "deuda_abierta": deuda_payload if tiene_deuda else None,
            "deuda_asociada": deuda_payload,
            "total_final": total_final,
            "total_pagado_confirmado": total_pagado_confirmado,
            "saldo_pendiente": saldo_pendiente,
            "monto_cubierto_sin_pago_real": monto_cubierto_sin_pago_real,
            "resumen": {
                "credito_aplicado_real": credito_aplicado_real,
                "credito_generado_devolucion": credito_generado_devolucion,
                "deuda_cancelada_por_devolucion": deuda_cancelada_por_devolucion,
                "cobertura_no_cobrada": monto_cubierto_sin_pago_real,
                "pagos_directos_venta": total_pagado_directo_venta,
                "pagos_deuda_cobrado": total_pagado_deuda_cobrado,
                "base_cancelada_por_pagos_deuda": total_base_cancelada_deuda,
            },
        }

        return {
            "venta": venta_response,
            "items": items,
            "situacion_financiera": situacion_financiera,
        }

    finally:
        conn.close()

def entregar_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_entregable(venta, venta_id)

            saldo_pendiente = Decimal(str(venta["saldo_pendiente"]))
            entrega_con_deuda = saldo_pendiente > 0

            if entrega_con_deuda:
                exigir_permiso_entregar_con_deuda(conn, data.id_usuario)

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para entregar",
                )

            fecha_compra = date.today()

            for item in items:
                if item.get("id_bicicleta_serializada") is not None:
                    bicicleta = _validar_y_bloquear_bicicleta_serializada_para_entrega(
                        conn,
                        item=item,
                        venta_id=venta_id,
                    )

                    update_bicicleta_serializada_estado(
                        conn,
                        bicicleta["id"],
                        "entregada",
                    )

                    stock_service.registrar_movimiento_serializada_sin_stock(
                        conn,
                        {
                            "id_sucursal": venta["id_sucursal"],
                            "id_variante": item["id_variante"],
                            "id_bicicleta_serializada": bicicleta["id"],
                            "tipo_movimiento": "entrega_serializada",
                            "id_usuario": data.id_usuario,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "nota": f"Entrega de bicicleta serializada en venta #{venta_id}",
                        },
                    )

                    condicion_entrega = data.condicion_entrega_bicicleta

                    plan_postventa = _resolver_postventa_bicicleta(
                        condicion_entrega,
                        data.plan_postventa_bicicleta,
                    )

                    fecha_limite_service_gratis = (
                        fecha_compra + timedelta(days=30)
                        if plan_postventa == "service_30_dias"
                        else None
                    )

                    insert_bicicleta_cliente(
                        conn,
                        {
                            "id_cliente": venta["id_cliente"],
                            "id_bicicleta_serializada": bicicleta["id"],
                            "id_venta_origen": venta_id,
                            "marca": "Bicicleta",
                            "modelo": item["descripcion_snapshot"],
                            "rodado": None,
                            "color": None,
                            "numero_cuadro": bicicleta["numero_cuadro"],
                            "notas": f"Generada desde venta #{venta_id}",
                            "fecha_compra": fecha_compra,
                            "condicion_entrega": condicion_entrega,
                            "plan_postventa": plan_postventa,
                            "fecha_limite_service_gratis": fecha_limite_service_gratis,
                            "service_gratis_usado": False,
                            "id_orden_service_gratis": None,
                        },
                    )

            items_stock = _ordenar_items_stockeables_por_variante(items)

            for item in items_stock:
                if item.get("id_bicicleta_serializada") is not None:
                    continue

                if item.get("id_orden_taller_item") is not None:
                    continue

                stock_service.registrar_entrega_stock(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": to_decimal(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "id_bicicleta_serializada": None,
                        "nota": f"Entrega de venta #{venta_id}",
                    },
                )

            update_venta_estado(conn, venta_id, VENTA_ESTADO_ENTREGADA)

            if entrega_con_deuda:
                deudas_service.crear_deuda_desde_venta_entregada(
                    conn,
                    id_cliente=venta["id_cliente"],
                    id_venta=venta_id,
                    monto_inicial=saldo_pendiente,
                    id_usuario=data.id_usuario,
                    observacion=f"Deuda creada automáticamente al entregar venta #{venta_id}",
                )

            accion_auditoria = (
                AUDITORIA_ACCION_VENTA_ENTREGA_CON_DEUDA
                if entrega_con_deuda
                else AUDITORIA_ACCION_VENTA_ENTREGADA
            )

            detalle_auditoria = (
                f"Venta entregada con deuda. saldo_pendiente={saldo_pendiente}"
                if entrega_con_deuda
                else "Venta entregada. estado_final=entregada"
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=accion_auditoria,
                detalle=detalle_auditoria,
                metadata={
                    "tipo": "venta_entregada",
                    "venta_id": venta_id,
                    "entrega_con_deuda": entrega_con_deuda,
                    "saldo_pendiente": str(saldo_pendiente),
                    "estado_final": VENTA_ESTADO_ENTREGADA,
                },
                origen_tipo="venta",
                origen_id=venta_id,
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": VENTA_ESTADO_ENTREGADA,
        }

    finally:
        conn.close()


def anular_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            exigir_permiso_anular_venta(conn, data.id_usuario)
            venta = get_venta_for_update(conn, venta_id)
            _validar_venta_anulable(venta, venta_id)

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items para anular",
                )

            for item in items:
                if item.get("id_bicicleta_serializada") is not None:
                    bicicleta = _validar_y_bloquear_bicicleta_serializada_para_anulacion(
                        conn,
                        item=item,
                        venta_id=venta_id,
                    )
                    update_bicicleta_serializada_estado(
                        conn,
                        bicicleta["id"],
                        "disponible",
                    )
                    stock_service.registrar_movimiento_serializada_sin_stock(
                        conn,
                        {
                            "id_sucursal": venta["id_sucursal"],
                            "id_variante": item["id_variante"],
                            "id_bicicleta_serializada": bicicleta["id"],
                            "tipo_movimiento": "anulacion_serializada",
                            "id_usuario": data.id_usuario,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "nota": f"Anulación de bicicleta serializada en venta #{venta_id}",
                        },
                    )

            anulacion_id = insert_venta_anulacion(
                conn,
                venta_id,
                data.motivo,
                data.id_usuario,
            )

            items_stock = _ordenar_items_stockeables_por_variante(items)

            for item in items_stock:
                if item.get("id_bicicleta_serializada") is not None:
                    continue
                stock_service.devolver_stock_a_disponible_desde_pendiente(
                    conn,
                    {
                        "id_sucursal": venta["id_sucursal"],
                        "id_variante": item["id_variante"],
                        "cantidad": to_decimal(item["cantidad"]),
                        "id_usuario": data.id_usuario,
                        "origen_tipo": "venta",
                        "origen_id": venta_id,
                        "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                        "nota": f"Liberación por anulación de venta #{venta_id}",
                    },
                )

            pagos_confirmados = get_pagos_confirmados_por_venta(conn, venta_id)

            medios_no_credito_automatico = {"tarjeta", "mercadopago"}
            pagos_requieren_reversion = [
                pago for pago in pagos_confirmados
                if pago["medio_pago"] in medios_no_credito_automatico
            ]

            if pagos_requieren_reversion:
                medios = ", ".join(
                    sorted({pago["medio_pago"] for pago in pagos_requieren_reversion})
                )

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "La venta tiene pagos confirmados por "
                        f"{medios}. Primero revertí/cancelá esos pagos antes de anular, "
                        "para evitar generar crédito comercial incorrecto."
                    ),
                )

            total_pagado = get_total_pagado_confirmado_por_venta(conn, venta_id)

            if total_pagado > 0:
                creditos_service.crear_credito_por_anulacion_venta(
                    conn,
                    id_cliente=venta["id_cliente"],
                    id_venta=venta_id,
                    monto_credito=total_pagado,
                    id_usuario=data.id_usuario,
                )

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                Decimal("0"),
                VENTA_ESTADO_ANULADA,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_ANULADA,
                detalle=(
                    f"Venta anulada. anulacion_id={anulacion_id}, "
                    f"motivo={data.motivo}, "
                    f"total_pagado={total_pagado}, "
                    f"credito_generado={'si' if total_pagado > 0 else 'no'}"
                ),
                metadata={
                    "tipo": "venta_anulada",
                    "venta_id": venta_id,
                    "anulacion_id": anulacion_id,
                    "motivo": data.motivo,
                    "total_pagado": str(total_pagado),
                    "credito_generado": total_pagado > 0,
                    # si lo tenés en scope:
                    "credito_monto": str(total_pagado) if total_pagado > 0 else "0.00",
                },
                origen_tipo="venta",
                origen_id=venta_id,
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "estado": VENTA_ESTADO_ANULADA,
            "anulacion_id": anulacion_id,
            "credito_generado": total_pagado > 0,
            "monto_credito": total_pagado,
        }

    finally:
        conn.close()


def _ordenar_items_stockeables_por_variante(items: list[dict]) -> list[dict]:
    return sorted(
        [
            item
            for item in items
            if item.get("tipo_item", "producto") == "producto"
            and item.get("id_variante") is not None
            and item.get("stockeable", True)
        ],
        key=lambda item: item["id_variante"],
    )



def devolver_item_serializado_entregado(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)

            if venta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la venta {venta_id}",
                )

            if venta["estado"] != VENTA_ESTADO_ENTREGADA:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"La venta {venta_id} no está entregada. "
                        f"Estado actual: {venta['estado']}"
                    ),
                )

            modo_devolucion = _obtener_modo_devolucion(data)

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail=f"La venta {venta_id} no tiene items",
                )

            item_objetivo = None
            for item in items:
                if item.get("id_bicicleta_serializada") == data.id_bicicleta_serializada:
                    item_objetivo = item
                    break

            if item_objetivo is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"La bicicleta serializada {data.id_bicicleta_serializada} "
                        f"no pertenece a la venta {venta_id}"
                    ),
                )

            devolucion_existente = get_venta_devolucion_by_venta_item_id(
                conn,
                item_objetivo["id"],
            )
            if devolucion_existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"El item {item_objetivo['id']} de la venta {venta_id} "
                        f"ya fue devuelto"
                    ),
                )

            bicicleta = _validar_y_bloquear_bicicleta_serializada_para_devolucion(
                conn,
                item=item_objetivo,
                venta_id=venta_id,
            )

            devolucion_id = insert_venta_devolucion(
                conn,
                {
                    "id_venta": venta_id,
                    "id_venta_item": item_objetivo["id"],
                    "id_bicicleta_serializada": bicicleta["id"],
                    "id_sucursal_reingreso": venta["id_sucursal"],
                    "motivo": data.motivo,
                    "id_usuario": data.id_usuario,
                },
            )

            update_bicicleta_serializada_estado(
                conn,
                bicicleta["id"],
                "disponible",
            )

            stock_service.registrar_devolucion_stock(
                conn,
                {
                    "id_sucursal": venta["id_sucursal"],
                    "id_variante": item_objetivo["id_variante"],
                    "cantidad": 1,
                    "id_usuario": data.id_usuario,
                    "origen_tipo": "venta",
                    "origen_id": venta_id,
                    "id_bicicleta_serializada": bicicleta["id"],  # ← AGREGAR
                    "nota": (
                        f"Devolución de bicicleta serializada "
                        f"desde venta #{venta_id}. "
                        f"devolucion_id={devolucion_id}. "
                        f"motivo={data.motivo}"
                    ),
                },
            )
            _resolver_credito_por_devolucion(
                conn,
                venta=venta,
                venta_id=venta_id,
                monto_credito=_calcular_monto_credito_devolucion_item(
                    venta,
                    item_objetivo,
                    Decimal("1"),
                ),
                id_usuario=data.id_usuario,
                modo_devolucion=modo_devolucion,
            )
            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_DEVOLUCION_CREADA,
                detalle=(
                    f"Devolución de bicicleta serializada. "
                    f"venta_id={venta_id}, "
                    f"devolucion_id={devolucion_id}, "
                    f"venta_item_id={item_objetivo['id']}, "
                    f"id_bicicleta_serializada={bicicleta['id']}, "
                    f"numero_cuadro={bicicleta['numero_cuadro']}, "
                    f"motivo={data.motivo}"
                ),
                metadata={
                    "tipo": "venta_devolucion_serializada",
                    "venta_id": venta_id,
                    "devolucion_id": devolucion_id,
                    "venta_item_id": item_objetivo["id"],
                    "id_variante": item_objetivo["id_variante"],
                    "id_bicicleta_serializada": bicicleta["id"],
                    "numero_cuadro": bicicleta["numero_cuadro"],
                    "motivo": data.motivo,
                    "estado_bicicleta_final": "disponible",
                },
                origen_tipo="venta",
                origen_id=venta_id,
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "devolucion_id": devolucion_id,
            "id_bicicleta_serializada": bicicleta["id"],
            "estado_bicicleta": "disponible",
        }

    finally:
        conn.close()

def devolver_venta(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)

            if not venta:
                raise HTTPException(status_code=404, detail="Venta no encontrada")

            if venta["estado"] != "entregada":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden devolver ventas entregadas",
                )

            modo_devolucion = _obtener_modo_devolucion(data)

            items = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items:
                raise HTTPException(
                    status_code=400,
                    detail="La venta no tiene items",
                )

            total_devolucion = Decimal("0")

            for item in items:
                cantidad = to_decimal(item["cantidad"])

                monto_item = _calcular_monto_credito_devolucion_item(
                    venta,
                    item,
                    cantidad,
                )

                devolucion_item_id = insert_venta_item_devolucion(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_venta_item": item["id"],
                        "id_variante": item["id_variante"],
                        "cantidad_devuelta": cantidad,
                        "monto_credito_generado": monto_item,
                        "motivo": data.motivo,
                        "id_usuario": data.id_usuario,
                    },
                )

                if item["id_bicicleta_serializada"]:
                    update_bicicleta_serializada_estado(
                        conn,
                        item["id_bicicleta_serializada"],
                        "disponible",
                    )

                    insert_venta_devolucion(
                        conn,
                        {
                            "id_venta": venta_id,
                            "id_venta_item": item["id"],
                            "id_bicicleta_serializada": item["id_bicicleta_serializada"],
                            "id_sucursal_reingreso": venta["id_sucursal"],
                            "motivo": data.motivo,
                            "id_usuario": data.id_usuario,
                        },
                    )

                if item["stockeable"]:
                    stock_service.registrar_devolucion_stock(
                        conn,
                        {
                            "id_sucursal": venta["id_sucursal"],
                            "id_variante": item["id_variante"],
                            "cantidad": cantidad,
                            "id_usuario": data.id_usuario,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                            "nota": (
                                f"Devolución total venta #{venta_id}. "
                                f"venta_item_id={item['id']}. "
                                f"devolucion_item_id={devolucion_item_id}. "
                                f"motivo={data.motivo}"
                            ),
                        },
                    )

                total_devolucion = redondear_monto(total_devolucion + monto_item)
            # generar crédito
            resultado_deuda = deudas_service.cancelar_deuda_por_devolucion_venta(
                conn,
                id_venta=venta_id,
                id_usuario=data.id_usuario,
            )

            monto_credito = _calcular_credito_neto_por_devolucion(
                total_devolucion,
                resultado_deuda["monto_cancelado"],
            )

            _resolver_credito_por_devolucion(
                conn,
                venta=venta,
                venta_id=venta_id,
                monto_credito=monto_credito,
                id_usuario=data.id_usuario,
                modo_devolucion=modo_devolucion,
            )

            # actualizar estado
            update_venta_saldo_y_estado(
                conn,
                venta_id,
                Decimal("0"),
                "devuelta",
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion="devolucion_venta",
                detalle=f"Venta devuelta total. monto={total_devolucion}",
                metadata={
                    "tipo": "venta_devolucion_total",
                    "venta_id": venta_id,
                    "monto_total_devuelto": str(total_devolucion),
                    "estado_final": "devuelta",
                    "motivo": data.motivo,
                },
                origen_tipo="venta",
                origen_id=venta_id,
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "credito_generado": total_devolucion,
        }

    finally:
        conn.close()

def devolver_items(venta_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            venta = get_venta_for_update(conn, venta_id)

            if not venta:
                raise HTTPException(status_code=404, detail="Venta no encontrada")

            if venta["estado"] != VENTA_ESTADO_ENTREGADA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden devolver items de ventas entregadas",
                )

            modo_devolucion = _obtener_modo_devolucion(data)

            if modo_devolucion == MODO_DEVOLUCION_REVERSION_PAGO_EXTERNO:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "La reversión de pago externo no está habilitada para devoluciones parciales. "
                        "Usá devolución total o crédito comercial."
                    ),
                )

            if not data.items:
                raise HTTPException(
                    status_code=400,
                    detail="Debe informar al menos un item a devolver",
                )

            items_db = get_venta_items_detallados_by_venta_id(conn, venta_id)

            if not items_db:
                raise HTTPException(
                    status_code=400,
                    detail="La venta no tiene items",
                )

            items_map = {item["id"]: item for item in items_db}
            total_devolucion = Decimal("0")
            devoluciones_ids = []

            for item_input in data.items:
                item = items_map.get(item_input.id_venta_item)

                if not item:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El item {item_input.id_venta_item} no pertenece a la venta {venta_id}",
                    )

                cantidad_devuelta = to_decimal(item_input.cantidad)
                cantidad_original = to_decimal(item["cantidad"])
                cantidad_ya_devuelta = to_decimal(
                    get_total_devuelto_by_venta_item_id(conn, item["id"])
                )

                cantidad_disponible_para_devolver = cantidad_original - cantidad_ya_devuelta

                if cantidad_devuelta <= Decimal("0"):
                    raise HTTPException(
                        status_code=400,
                        detail="La cantidad a devolver debe ser mayor a 0",
                    )

                if cantidad_devuelta > cantidad_disponible_para_devolver:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"La cantidad a devolver del item {item['id']} supera "
                            f"lo disponible. vendido={cantidad_original}, "
                            f"ya_devuelto={cantidad_ya_devuelta}, "
                            f"disponible={cantidad_disponible_para_devolver}"
                        ),
                    )

                if item.get("id_bicicleta_serializada") is not None:
                    if cantidad_devuelta != Decimal("1"):
                        raise HTTPException(
                            status_code=400,
                            detail="Un item serializado solo puede devolverse con cantidad 1",
                        )

                    bicicleta = _validar_y_bloquear_bicicleta_serializada_para_devolucion(
                        conn,
                        item=item,
                        venta_id=venta_id,
                    )

                    update_bicicleta_serializada_estado(
                        conn,
                        bicicleta["id"],
                        "disponible",
                    )

                    # Mantiene trazabilidad serializada existente.
                    insert_venta_devolucion(
                        conn,
                        {
                            "id_venta": venta_id,
                            "id_venta_item": item["id"],
                            "id_bicicleta_serializada": bicicleta["id"],
                            "id_sucursal_reingreso": venta["id_sucursal"],
                            "motivo": data.motivo,
                            "id_usuario": data.id_usuario,
                        },
                    )

                monto_item = _calcular_monto_credito_devolucion_item(
                    venta,
                    item,
                    cantidad_devuelta,
                )

                devolucion_id = insert_venta_item_devolucion(
                    conn,
                    {
                        "id_venta": venta_id,
                        "id_venta_item": item["id"],
                        "id_variante": item["id_variante"],
                        "cantidad_devuelta": cantidad_devuelta,
                        "monto_credito_generado": monto_item,
                        "motivo": data.motivo,
                        "id_usuario": data.id_usuario,
                    },
                )
                devoluciones_ids.append(devolucion_id)

                if item["stockeable"]:
                    stock_service.registrar_devolucion_stock(
                        conn,
                        {
                            "id_sucursal": venta["id_sucursal"],
                            "id_variante": item["id_variante"],
                            "cantidad": cantidad_devuelta,
                            "id_usuario": data.id_usuario,
                            "origen_tipo": "venta",
                            "origen_id": venta_id,
                            "id_bicicleta_serializada": item.get("id_bicicleta_serializada"),
                            "nota": (
                                f"Devolución parcial venta #{venta_id}. "
                                f"venta_item_id={item['id']}. "
                                f"devolucion_item_id={devolucion_id}. "
                                f"motivo={data.motivo}"
                            ),
                        },
                    )

                total_devolucion = redondear_monto(total_devolucion + monto_item)

            _resolver_credito_por_devolucion(
                conn,
                venta=venta,
                venta_id=venta_id,
                monto_credito=total_devolucion,
                id_usuario=data.id_usuario,
                modo_devolucion=modo_devolucion,
            )

            items_actualizados = get_venta_items_detallados_by_venta_id(conn, venta_id)

            venta_totalmente_devuelta = True
            for item in items_actualizados:
                cantidad_original = to_decimal(item["cantidad"])
                cantidad_devuelta_total = to_decimal(
                    get_total_devuelto_by_venta_item_id(conn, item["id"])
                )

                if cantidad_devuelta_total < cantidad_original:
                    venta_totalmente_devuelta = False
                    break

            nuevo_estado = (
                "devuelta"
                if venta_totalmente_devuelta
                else "devuelta_parcial"
            )

            update_venta_saldo_y_estado(
                conn,
                venta_id,
                Decimal("0"),
                nuevo_estado,
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=venta["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_VENTA,
                entidad_id=venta_id,
                accion=AUDITORIA_ACCION_VENTA_DEVOLUCION_CREADA,
                detalle=(
                    f"Devolución parcial registrada. "
                    f"venta_id={venta_id}, "
                    f"devoluciones_ids={devoluciones_ids}, "
                    f"monto={total_devolucion}, "
                    f"estado_final={nuevo_estado}, "
                    f"motivo={data.motivo}"
                ),
                metadata={
                    "tipo": "venta_devolucion_parcial",
                    "venta_id": venta_id,
                    "devoluciones_ids": devoluciones_ids,
                    "monto_total_devuelto": str(total_devolucion),
                    "estado_final": nuevo_estado,
                    "motivo": data.motivo,
                    # 🔴 clave para análisis futuro
                    "cantidad_items_afectados": len(devoluciones_ids),
                },
                origen_tipo="venta",
                origen_id=venta_id,
            )

        return {
            "ok": True,
            "venta_id": venta_id,
            "credito_generado": total_devolucion,
        }

    finally:
        conn.close()

def simular_venta(data):
    conn = get_connection()

    try:
        if not data.items:
            raise HTTPException(
                status_code=400,
                detail="La venta debe tener al menos un item",
            )

        items_input = [
            {
                "tipo_item": item.tipo_item,
                "id_variante": item.id_variante,
                "id_servicio_taller": item.id_servicio_taller,
                "cantidad": item.cantidad,
                "id_bicicleta_serializada": item.id_bicicleta_serializada,
                "precio_unitario_manual": item.precio_unitario_manual,
                "bonificado": item.bonificado,
                "motivo_precio_manual": item.motivo_precio_manual,
                "motivo_bonificacion": item.motivo_bonificacion,
                "id_orden_taller_item": item.id_orden_taller_item,
                "descripcion_snapshot": item.descripcion_snapshot,
            }
            for item in data.items
        ]

        items_consolidados = _consolidar_items(items_input)
        ids_unicos = list({
            item["id_variante"]
            for item in items_consolidados
            if item.get("tipo_item", "producto") == "producto"
        })

        variantes_map = (
            _obtener_variantes_map(conn, ids_unicos)
            if ids_unicos
            else {}
        )

        subtotal_total = Decimal("0")

        for item in items_consolidados:
            cantidad = to_decimal(item["cantidad"])
            bonificado = item.get("bonificado", False)
            precio_manual = item.get("precio_unitario_manual")

            if item.get("tipo_item", "producto") == "servicio_taller":
                servicio = get_servicio_taller_by_id(conn, item["id_servicio_taller"])

                if servicio is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"No existe el servicio de taller {item['id_servicio_taller']}",
                    )

                if servicio["activo"] is not True:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede vender un servicio de taller inactivo",
                    )

                precio_lista = redondear_monto(precio_manual)

                precio_final = Decimal("0") if bonificado else precio_lista

                subtotal_total = redondear_monto(
                    subtotal_total + redondear_monto(precio_final * cantidad)
                )

                continue

            variante = variantes_map[item["id_variante"]]

            campo_precio = (
                "precio_mayorista"
                if data.tipo_precio == "mayorista"
                else "precio_minorista"
            )

            precio_lista = redondear_monto(variante[campo_precio])

            if precio_lista <= Decimal("0"):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"La variante {item['id_variante']} no tiene precio "
                        f"{data.tipo_precio} configurado"
                    ),
                )

            if bonificado:
                precio_final = Decimal("0")
            else:
                precio_final = (
                    redondear_monto(to_decimal(precio_manual))
                    if precio_manual is not None
                    else precio_lista
                )

            subtotal_total = redondear_monto(
                subtotal_total + redondear_monto(precio_final * cantidad)
            )

        pagos = getattr(data, "pagos", []) or []

        resultado_reglas = simular_reglas_comerciales(
            type(
                "TmpSimulacion",
                (),
                {
                    "subtotal_base": subtotal_total,
                    "medios_pago": pagos,
                    "sugerir_saldo_con_medio_pago": getattr(
                        data,
                        "sugerir_saldo_con_medio_pago",
                        None,
                    ),
                },
            )()
        )

        saldo_estimado = redondear_monto(resultado_reglas["saldo_estimado"])

        credito_disponible = Decimal("0")
        credito_aplicado = Decimal("0")
        total_a_cobrar = saldo_estimado
        saldo_credito_restante = Decimal("0")

        usar_credito = getattr(data, "usar_credito", False)
        id_cliente = getattr(data, "id_cliente", None)
        monto_credito_a_aplicar = getattr(data, "monto_credito_a_aplicar", None)

        if usar_credito and id_cliente is not None and saldo_estimado > Decimal("0"):
            resultado_credito = creditos_service.simular_aplicacion_credito_a_venta(
                conn,
                id_cliente=id_cliente,
                total_a_cubrir=saldo_estimado,
                usar_credito=usar_credito,
                monto_credito_a_aplicar=monto_credito_a_aplicar,
            )

            credito_disponible = redondear_monto(
                resultado_credito["credito_disponible"]
            )
            credito_aplicado = redondear_monto(
                resultado_credito["credito_aplicado"]
            )
            total_a_cobrar = redondear_monto(
                resultado_credito["total_a_cobrar"]
            )
            saldo_credito_restante = redondear_monto(
                resultado_credito["saldo_credito_restante"]
            )

        return {
            "subtotal_base": redondear_monto(resultado_reglas["subtotal_base"]),
            "descuento_total": redondear_monto(resultado_reglas["descuento_total"]),
            "recargo_total": redondear_monto(resultado_reglas["recargo_total"]),
            "total_final": redondear_monto(resultado_reglas["total_final"]),

            "total_base_asignada": redondear_monto(
                resultado_reglas["total_base_asignada"]
            ),
            "total_pagos_cargados": redondear_monto(
                resultado_reglas["total_pagos_cargados"]
            ),
            "saldo_base_estimado": redondear_monto(
                resultado_reglas["saldo_base_estimado"]
            ),
            "saldo_estimado": saldo_estimado,

            "credito_disponible": credito_disponible,
            "credito_aplicado": credito_aplicado,
            "total_a_cobrar": total_a_cobrar,
            "saldo_credito_restante": saldo_credito_restante,

            "monto_base_sugerido_para_saldar": resultado_reglas.get(
                "monto_base_sugerido_para_saldar"
            ),
            "monto_sugerido_para_saldar": resultado_reglas.get(
                "monto_sugerido_para_saldar"
            ),
            "reglas_aplicadas": resultado_reglas["reglas_aplicadas"],
            "tramos_pago": resultado_reglas.get("tramos_pago", []),
        }

    finally:
        conn.close()
    

def _calcular_monto_credito_devolucion_item(venta: dict, item: dict, cantidad_devuelta) -> Decimal:
    subtotal_base = redondear_monto(to_decimal(venta.get("subtotal_base") or 0))
    total_final = redondear_monto(to_decimal(venta.get("total_final") or 0))

    if subtotal_base <= Decimal("0"):
        return Decimal("0")

    factor = total_final / subtotal_base

    precio_unitario = to_decimal(
        item.get("precio_unitario_final")
        or item.get("precio_final")
        or 0
    )

    monto = precio_unitario * to_decimal(cantidad_devuelta) * factor

    return redondear_monto(monto)

def _calcular_credito_neto_por_devolucion(
    monto_devolucion: Decimal,
    monto_deuda_cancelada: Decimal,
) -> Decimal:
    monto_devolucion = redondear_monto(to_decimal(monto_devolucion))
    monto_deuda_cancelada = redondear_monto(to_decimal(monto_deuda_cancelada))

    credito_neto = monto_devolucion - monto_deuda_cancelada

    if credito_neto <= Decimal("0"):
        return Decimal("0")

    return redondear_monto(credito_neto)

def _resolver_postventa_bicicleta(condicion_entrega: str, plan_postventa: str | None) -> str:
    if condicion_entrega == "en_caja":
        if plan_postventa == "service_30_dias":
            raise HTTPException(
                status_code=400,
                detail="Una bicicleta entregada en caja no puede tener service 30 días",
            )
        return "garantia_fabrica"

    if condicion_entrega == "armada":
        if plan_postventa in {None, ""}:
            return "service_30_dias"

        if plan_postventa not in {"service_30_dias", "sin_service"}:
            raise HTTPException(
                status_code=400,
                detail="Plan postventa inválido para bicicleta armada",
            )

        return plan_postventa

    raise HTTPException(
        status_code=400,
        detail="Condición de entrega inválida",
    )