from decimal import Decimal
from urllib.parse import quote_plus
from fastapi import HTTPException
from pydantic import ValidationError
from app.core.text_normalization import normalize_text_upper
from app.modules.clientes.repository import marcar_service_gratis_utilizado
from app.db.connection import get_connection
from app.shared.constants import (
    ORDEN_TALLER_ESTADO_INGRESADA,
    ORDEN_TALLER_EVENTO_CREADA,
    ORDEN_TALLER_EVENTO_CAMBIO_ESTADO,
    ORDEN_TALLER_EVENTO_AGREGADO_ITEM,
    ORDEN_TALLER_EVENTO_ITEM_QUITADO_BORRADOR,
    TIPO_MOVIMIENTO_USO_TALLER,
    TIPO_MOVIMIENTO_REVERSION_USO_TALLER,
    ORDEN_TALLER_EVENTO_ITEM_EJECUCION_REVERTIDA,
    ORDEN_TALLER_EVENTO_ITEM_CANCELADO,
)

TRANSICIONES_VALIDAS_TALLER = {
    "ingresada": {"presupuestada", "cancelada"},
    "presupuestada": {"esperando_aprobacion", "en_reparacion", "cancelada"},
    "esperando_aprobacion": {"en_reparacion", "cancelada"},
    "esperando_repuestos": {"en_reparacion", "cancelada"},
    "en_reparacion": {"esperando_repuestos", "terminada", "cancelada"},
    "terminada": {"facturada", "lista_para_retirar"},
    "facturada": {"lista_para_retirar"},
    "lista_para_retirar": {"retirada"},
    "retirada": set(),
    "cancelada": set(),
}

def _validar_transicion_estado_taller(estado_actual: str, nuevo_estado: str) -> None:
    estados_permitidos = TRANSICIONES_VALIDAS_TALLER.get(estado_actual, set())

    if nuevo_estado not in estados_permitidos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Transición inválida de taller: "
                f"{estado_actual} -> {nuevo_estado}"
            ),
        )

from app.modules.stock.repository import (
    obtener_stock_disponible_variante,
    registrar_movimiento_stock,
    descontar_stock_fisico,
    incrementar_stock_fisico,
)

from app.modules.ventas.schema import VentaCreateInput
from app.modules.ventas.service import crear_venta

from .repository import (
    validar_sucursal_activa,
    validar_usuario_activo,
    validar_cliente_existente,
    get_bicicleta_cliente,
    get_variante_by_id,
    insert_orden_taller,
    get_ordenes_taller,
    get_dashboard_taller,
    get_orden_taller_by_id,
    get_orden_taller_by_id_for_update,
    update_orden_taller_estado,
    insert_orden_taller_item,
    get_items_orden_taller,
    recalcular_total_orden_taller,
    insert_orden_taller_evento,
    get_eventos_orden_taller,
    insert_nota_orden_taller,
    get_notas_orden_taller,
    get_alertas_activas_bicicleta,
    get_nota_orden_taller_by_id,
    update_nota_orden_taller,
    get_notas_cliente_orden_taller,
    get_item_orden_taller_by_id_for_update,
    update_orden_taller_item_aprobacion,
    update_orden_taller_item_ejecutado, 
    update_orden_taller_item_agregado,
    update_orden_taller_item_cancelado,
    existe_venta_item_por_orden_taller_item,
    delete_orden_taller_item,
    update_orden_taller_venta_generada,
    get_venta_generada_por_orden_taller,
    get_venta_generada_con_deuda_por_id,
    update_orden_taller_operativo,
    marcar_aviso_retiro_enviado,
    get_nombre_cliente_item_taller,
)

from app.modules.servicios_taller.repository import get_servicio_taller_by_id
from app.modules.configuracion_negocio.service import obtener_configuracion_negocio
from app.modules.configuracion_negocio.template import render_template

def _validar_venta_taller_habilitada_para_retiro(conn, orden: dict) -> None:
    venta_id = orden.get("id_venta_generada")

    if not venta_id:
        raise HTTPException(
            status_code=400,
            detail="Primero generá la venta antes de marcar la orden como lista para retirar",
        )

    venta = get_venta_generada_con_deuda_por_id(conn, venta_id)
    if venta is None:
        raise HTTPException(
            status_code=400,
            detail="No se puede marcar lista para retirar: la venta generada no existe.",
        )

    saldo_pendiente = Decimal(str(venta.get("saldo_pendiente") or 0))
    venta_sin_saldo = (
        venta.get("estado") in {"pagada_total", "entregada"}
        and saldo_pendiente == 0
    )
    venta_entregada_con_deuda = (
        venta.get("estado") == "entregada"
        and saldo_pendiente > 0
        and venta.get("tiene_deuda_formal") is True
    )

    if venta_sin_saldo or venta_entregada_con_deuda:
        return

    raise HTTPException(
        status_code=400,
        detail=(
            "No se puede marcar lista para retirar: la venta generada no está "
            "pagada ni entregada con deuda formal."
        ),
    )

def _total_cobrable_items_taller(items: list[dict]) -> Decimal:
    return sum(
        Decimal(str(item.get("subtotal") or 0))
        for item in items
        if item.get("etapa") != "cancelado"
    )

def _tiene_trabajo_sin_cargo_ejecutado(items: list[dict]) -> bool:
    return any(
        item.get("etapa") == "ejecutado"
        and item.get("aprobado") is True
        for item in items
    )

def _build_descripcion_snapshot(variante: dict) -> str:
    producto_nombre = (variante.get("producto_nombre") or "").strip()
    producto_descripcion = (variante.get("producto_descripcion") or "").strip()
    codigo_proveedor = (variante.get("codigo_proveedor") or "").strip()

    if producto_nombre and producto_descripcion:
        return f"{producto_nombre} - {producto_descripcion}"
    if producto_nombre and codigo_proveedor:
        return f"{producto_nombre} - {codigo_proveedor}"
    if producto_nombre:
        return producto_nombre
    if producto_descripcion:
        return producto_descripcion

    return f"Variante #{variante['id']}"

def crear_orden_taller(data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_sucursal_activa(conn, data.id_sucursal)
                validar_usuario_activo(conn, data.id_usuario)
                validar_cliente_existente(conn, data.id_cliente)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            bicicleta = get_bicicleta_cliente(conn, data.id_bicicleta_cliente)
            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta del cliente {data.id_bicicleta_cliente}",
                )

            if bicicleta["id_cliente"] != data.id_cliente:
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta indicada no pertenece al cliente informado",
                )

            orden = insert_orden_taller(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": data.id_cliente,
                    "id_bicicleta_cliente": data.id_bicicleta_cliente,
                    "estado": ORDEN_TALLER_ESTADO_INGRESADA,
                    "problema_reportado": normalize_text_upper(data.problema_reportado),
                    "fecha_prometida": data.fecha_prometida,
                    "prioridad": data.prioridad,
                    "id_usuario": data.id_usuario,
                },
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden["id"],
                tipo_evento=ORDEN_TALLER_EVENTO_CREADA,
                detalle="Orden de taller creada",
                id_usuario=data.id_usuario,
            )

            return get_orden_taller_by_id(conn, orden["id"])
    finally:
        conn.close()

def listar_ordenes_taller(
    vista: str | None = None,
    estado: str | None = None,
    solo_pendientes: bool = True,
):
    conn = get_connection()
    try:
        return get_ordenes_taller(
            conn,
            vista=vista,
            estado=estado,
            solo_pendientes=solo_pendientes,
        )
    finally:
        conn.close()


def obtener_dashboard_taller():
    conn = get_connection()
    try:
        return get_dashboard_taller(conn)
    finally:
        conn.close()

def obtener_orden_taller(orden_id: int):
    conn = get_connection()
    try:
        orden = get_orden_taller_by_id(conn, orden_id)
        if orden is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la orden de taller {orden_id}",
            )

        eventos = get_eventos_orden_taller(conn, orden_id)
        items = get_items_orden_taller(conn, orden_id)
        notas = get_notas_orden_taller(conn, orden_id)
        alertas_bicicleta = get_alertas_activas_bicicleta(
            conn,
            orden["id_bicicleta_cliente"],
            excluir_orden_id=orden_id,
        )

        return {
            **orden,
            "eventos": eventos,
            "items": items,
            "notas": notas,
            "alertas_bicicleta": alertas_bicicleta,
        }
    finally:
        conn.close()


def crear_nota_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            contenido = data.contenido.strip()
            nota = insert_nota_orden_taller(
                conn,
                orden_id=orden_id,
                bicicleta_id=orden["id_bicicleta_cliente"],
                tipo=data.tipo,
                contenido=contenido,
                id_usuario=data.id_usuario,
            )
            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="nota_tecnica_creada",
                detalle=f"Nota {data.tipo} #{nota['id']} creada",
                id_usuario=data.id_usuario,
            )
            return nota
    finally:
        conn.close()


def actualizar_nota_orden_taller(orden_id: int, nota_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            nota_anterior = get_nota_orden_taller_by_id(conn, orden_id, nota_id)
            if nota_anterior is None:
                raise HTTPException(status_code=404, detail="La nota no existe en esta OT")

            contenido = data.contenido.strip() if data.contenido is not None else None
            nota = update_nota_orden_taller(
                conn,
                orden_id=orden_id,
                nota_id=nota_id,
                contenido=contenido,
                estado=data.estado,
                id_usuario=data.id_usuario,
            )

            cambios = []
            if contenido is not None and contenido != nota_anterior["contenido"]:
                cambios.append("contenido editado")
            if data.estado is not None and data.estado != nota_anterior["estado"]:
                cambios.append(
                    f"estado {nota_anterior['estado']} -> {data.estado}"
                )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="nota_tecnica_actualizada",
                detalle=f"Nota #{nota_id}: {', '.join(cambios) or 'actualizada'}",
                id_usuario=data.id_usuario,
            )
            return nota
    finally:
        conn.close()


def cambiar_estado_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] == data.nuevo_estado:
                raise HTTPException(
                    status_code=400,
                    detail=f"La orden {orden_id} ya está en estado {data.nuevo_estado}",
                )

            _validar_transicion_estado_taller(
                estado_actual=orden["estado"],
                nuevo_estado=data.nuevo_estado,
            )

            es_service_postventa = orden.get("es_service_postventa") is True
            items_para_retiro = None
            total_cobrable_retiro = Decimal(str(orden.get("total_final") or 0))
            if data.nuevo_estado in {"lista_para_retirar", "retirada"}:
                items_para_retiro = get_items_orden_taller(conn, orden_id)
                if items_para_retiro:
                    total_cobrable_retiro = _total_cobrable_items_taller(items_para_retiro)

            if (
                orden["estado"] == "en_reparacion"
                and data.nuevo_estado == "terminada"
            ):
                items = get_items_orden_taller(conn, orden_id)

                items_activos = [
                    item for item in items
                    if item["etapa"] != "cancelado"
                ]

                if not items_activos and not es_service_postventa:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede marcar como terminada una orden sin items activos",
                    )

                items_pendientes = [
                    item for item in items_activos
                    if item["etapa"] != "ejecutado"
                ]

                if items_pendientes:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede marcar como terminada: hay items aprobados o pendientes sin ejecutar",
                    )

            if (
                data.nuevo_estado == "lista_para_retirar"
                and total_cobrable_retiro > 0
            ):
                _validar_venta_taller_habilitada_para_retiro(conn, orden)
            elif (
                data.nuevo_estado == "lista_para_retirar"
                and not es_service_postventa
            ):
                items_sin_cargo = items_para_retiro or get_items_orden_taller(conn, orden_id)
                tiene_trabajo_sin_cargo = _tiene_trabajo_sin_cargo_ejecutado(items_sin_cargo)
                if not tiene_trabajo_sin_cargo:
                    _validar_venta_taller_habilitada_para_retiro(conn, orden)

            if (
                orden["estado"] == "lista_para_retirar"
                and data.nuevo_estado == "retirada"
                and total_cobrable_retiro > 0
            ):
                _validar_venta_taller_habilitada_para_retiro(conn, orden)

            update_orden_taller_estado(conn, orden_id, data.nuevo_estado)

            if (
                data.nuevo_estado == "retirada"
                and es_service_postventa
                and orden.get("tipo_postventa") == "service_30_dias"
            ):
                marcar_service_gratis_utilizado(
                    conn,
                    bicicleta_id=orden["id_bicicleta_cliente"],
                    orden_id=orden_id,
                )

                insert_orden_taller_evento(
                    conn,
                    id_orden_taller=orden_id,
                    tipo_evento="service_postventa_utilizado",
                    detalle="Service bonificado 30 días marcado como utilizado",
                    id_usuario=data.id_usuario,
                )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_CAMBIO_ESTADO,
                detalle=f"Estado cambiado de {orden['estado']} a {data.nuevo_estado}",
                id_usuario=data.id_usuario,
            )

            orden_actualizada = get_orden_taller_by_id(conn, orden_id)
            return orden_actualizada
    finally:
        conn.close()

def agregar_item_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if data.tipo_item == "repuesto":
                variante = get_variante_by_id(conn, data.id_variante)
                if variante is None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"No existe la variante {data.id_variante}",
                    )

                descripcion_snapshot = _build_descripcion_snapshot(variante)
                id_variante = data.id_variante
                id_servicio_taller = None

            elif data.tipo_item == "servicio":
                servicio = get_servicio_taller_by_id(conn, data.id_servicio_taller)
                if servicio is None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"No existe el servicio de taller {data.id_servicio_taller}",
                    )

                if servicio["activo"] is not True:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede agregar un servicio de taller inactivo",
                    )

                descripcion_snapshot = servicio["nombre"]
                id_variante = None
                id_servicio_taller = data.id_servicio_taller

            else:
                raise HTTPException(
                    status_code=400,
                    detail="Tipo de item de taller inválido",
                )

            precio_unitario = Decimal(data.precio_unitario)
            cobertura_unitaria = Decimal(data.valor_cobertura_unitario or 0)
            motivo_cobertura = (
                data.motivo_cobertura.strip()
                if data.motivo_cobertura
                else None
            )
            observacion_cobertura = (
                data.observacion_cobertura.strip()
                if data.observacion_cobertura
                else None
            )

            if orden.get("es_service_postventa") is True and data.tipo_item == "servicio":
                cobertura_unitaria = precio_unitario
                motivo_cobertura = "Service postventa"
            elif (
                cobertura_unitaria > 0
                and orden.get("es_service_postventa") is not True
                and data.tipo_item == "repuesto"
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "La cobertura por garantía sólo puede cargarse "
                        "en una OT postventa."
                    ),
                )

            if cobertura_unitaria > precio_unitario:
                raise HTTPException(
                    status_code=400,
                    detail="La cobertura no puede superar el precio del ítem.",
                )

            if cobertura_unitaria > 0 and not motivo_cobertura:
                raise HTTPException(
                    status_code=400,
                    detail="Indicá el motivo de la cobertura por garantía.",
                )

            subtotal = (
                Decimal(data.cantidad)
                * (precio_unitario - cobertura_unitaria)
            )

            item = insert_orden_taller_item(
                conn,
                {
                    "id_orden_taller": orden_id,
                    "tipo_item": data.tipo_item,
                    "id_variante": id_variante,
                    "id_servicio_taller": id_servicio_taller,
                    "descripcion_snapshot": descripcion_snapshot,
                    "cantidad": data.cantidad,
                    "precio_unitario": precio_unitario,
                    "valor_cobertura_unitario": cobertura_unitaria,
                    "motivo_cobertura": motivo_cobertura,
                    "observacion_cobertura": observacion_cobertura,
                    "subtotal": subtotal,
                },
            )

            recalcular_total_orden_taller(conn, orden_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_AGREGADO_ITEM,
                detalle=(
                    f"Item agregado: {descripcion_snapshot}. "
                    f"Cobertura: {cobertura_unitaria}. "
                    f"Diferencia: {precio_unitario - cobertura_unitaria}."
                ),
                id_usuario=data.id_usuario,
            )

            return item
    finally:
        conn.close()

def aprobar_item_orden_taller(orden_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] in {"retirada", "cancelada"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se pueden modificar items de una orden en estado {orden['estado']}",
                )

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el item de taller {item_id}",
                )

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(
                    status_code=400,
                    detail="El item no pertenece a la orden informada",
                )

            if item["etapa"] == "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede cambiar la aprobación de un item ejecutado",
                )

            if item["aprobado"] == data.aprobado:
                raise HTTPException(
                    status_code=400,
                    detail="El item ya tiene ese estado de aprobación",
                )

            item_actualizado = update_orden_taller_item_aprobacion(
                conn,
                item_id=item_id,
                aprobado=data.aprobado,
            )

            detalle_evento = (
                f"Item aprobado: {item['descripcion_snapshot']}"
                if data.aprobado
                else f"Item desaprobado: {item['descripcion_snapshot']}"
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="aprobacion_cliente",
                detalle=detalle_evento,
                id_usuario=data.id_usuario,
            )

            return item_actualizado
    finally:
        conn.close()

def ejecutar_item_orden_taller(orden_id: int, item_id: int, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():

            validar_usuario_activo(conn, id_usuario)

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if not orden:
                raise HTTPException(404, "Orden no existe")

            if orden["estado"] in {"cancelada", "retirada"}:
                raise HTTPException(400, "Orden cerrada")

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if not item:
                raise HTTPException(404, "Item no existe")

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(400, "Item no pertenece a la orden")

            if not item["aprobado"]:
                raise HTTPException(400, "Item no aprobado")

            if item["etapa"] == "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="El item ya fue ejecutado",
                )

            es_servicio = item.get("tipo_item") == "servicio"
            es_stockeable = bool(item.get("stockeable"))

            if item["id_variante"] and es_stockeable and not es_servicio:

                stock_row = obtener_stock_disponible_variante(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                )

                if stock_row is None:
                    raise HTTPException(
                        status_code=400,
                        detail="No existe stock para la variante en la sucursal",
                    )

                if stock_row["stock_disponible"] < item["cantidad"]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente. Disponible: {stock_row['stock_disponible']}",
                    )

                registrar_movimiento_stock(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    tipo_movimiento="uso_taller",
                    cantidad=item["cantidad"],
                    id_usuario=id_usuario,
                    costo_unitario_aplicado=item["costo_unitario_aplicado"],
                    origen_tipo="orden_taller",
                    origen_id=orden_id,
                    nota=f"Uso en orden de taller #{orden_id}",
                )
                descontar_stock_fisico(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    cantidad=item["cantidad"],
                )

            item_actualizado = update_orden_taller_item_ejecutado(
                conn, item_id
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="item_ejecutado",
                detalle=f"Item ejecutado: {item['descripcion_snapshot']}",
                id_usuario=id_usuario,
            )

            return item_actualizado

    finally:
        conn.close()

def revertir_ejecucion_item_orden_taller(orden_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            motivo = data.motivo.strip()
            if not motivo:
                raise HTTPException(
                    status_code=400,
                    detail="El motivo de reversión es obligatorio",
                )

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] in {"retirada", "cancelada"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede revertir ejecución en una orden {orden['estado']}",
                )

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el item de taller {item_id}",
                )

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(
                    status_code=400,
                    detail="El item no pertenece a la orden informada",
                )

            if item["etapa"] != "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede revertir un item ejecutado",
                )

            es_servicio = item.get("tipo_item") == "servicio"
            es_stockeable = bool(item.get("stockeable"))

            if item["id_variante"] and es_stockeable and not es_servicio:
                registrar_movimiento_stock(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    tipo_movimiento=TIPO_MOVIMIENTO_REVERSION_USO_TALLER,
                    cantidad=item["cantidad"],
                    id_usuario=data.id_usuario,
                    costo_unitario_aplicado=item["costo_unitario_aplicado"],
                    origen_tipo="orden_taller",
                    origen_id=orden_id,
                    nota=f"Reversión de uso en orden de taller #{orden_id}. Motivo: {motivo}",
                )

                incrementar_stock_fisico(
                    conn,
                    id_sucursal=orden["id_sucursal"],
                    id_variante=item["id_variante"],
                    cantidad=item["cantidad"],
                )

            item_actualizado = update_orden_taller_item_agregado(conn, item_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_ITEM_EJECUCION_REVERTIDA,
                detalle=f"Ejecución revertida: {item['descripcion_snapshot']}. Motivo: {motivo}",
                id_usuario=data.id_usuario,
            )

            return item_actualizado
    finally:
        conn.close()
    
def cancelar_item_orden_taller(orden_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            motivo = data.motivo.strip()
            if not motivo:
                raise HTTPException(
                    status_code=400,
                    detail="El motivo de cancelación es obligatorio",
                )

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] in {"retirada", "cancelada"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se pueden cancelar items de una orden en estado {orden['estado']}",
                )

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el item de taller {item_id}",
                )

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(
                    status_code=400,
                    detail="El item no pertenece a la orden informada",
                )

            if item["etapa"] == "cancelado":
                raise HTTPException(
                    status_code=400,
                    detail="El item ya está cancelado",
                )

            if item["etapa"] == "ejecutado":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede cancelar un item ejecutado; primero debe revertirse la ejecución",
                )

            item_actualizado = update_orden_taller_item_cancelado(conn, item_id)

            recalcular_total_orden_taller(conn, orden_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_ITEM_CANCELADO,
                detalle=f"Item cancelado: {item['descripcion_snapshot']}. Motivo: {motivo}",
                id_usuario=data.id_usuario,
            )

            return item_actualizado
    finally:
        conn.close()

def quitar_item_borrador_orden_taller(orden_id: int, item_id: int, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la orden de taller {orden_id}",
                )

            if orden["estado"] != "ingresada":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden quitar items mientras la orden está en borrador.",
                )

            if orden.get("id_venta_generada"):
                raise HTTPException(
                    status_code=400,
                    detail="No se puede quitar un item de una orden con venta generada.",
                )

            item = get_item_orden_taller_by_id_for_update(conn, item_id)
            if item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe el item de taller {item_id}",
                )

            if item["id_orden_taller"] != orden_id:
                raise HTTPException(
                    status_code=400,
                    detail="El item no pertenece a la orden informada",
                )

            if item["etapa"] != "presupuestado" or item["aprobado"] is True:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden quitar items no aprobados del borrador.",
                )

            if existe_venta_item_por_orden_taller_item(conn, item_id):
                raise HTTPException(
                    status_code=400,
                    detail="No se puede quitar un item vinculado a una venta.",
                )

            descripcion = item["descripcion_snapshot"]
            delete_orden_taller_item(conn, item_id)
            recalcular_total_orden_taller(conn, orden_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento=ORDEN_TALLER_EVENTO_ITEM_QUITADO_BORRADOR,
                detalle=f"Item quitado del borrador: {descripcion}",
                id_usuario=id_usuario,
            )

            return {"ok": True}
    finally:
        conn.close()

def generar_venta_desde_orden_taller(orden_id: int, data):
    """Genera una venta cobrable desde una orden terminada.

    Importante: los repuestos ejecutados en taller ya consumieron stock.
    Por eso cada venta_item queda vinculado a id_orden_taller_item para que
    ventas no vuelva a reservar/descontar stock al cobrar/entregar.
    """
    conn = get_connection()
    venta_existente_recuperada_id = None
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(status_code=404, detail=f"No existe la orden de taller {orden_id}")

            if orden.get("id_venta_generada"):
                raise HTTPException(
                    status_code=400,
                    detail=f"La orden ya tiene una venta generada: #{orden['id_venta_generada']}",
                )

            venta_existente = get_venta_generada_por_orden_taller(conn, orden_id)
            if venta_existente:
                update_orden_taller_venta_generada(conn, orden_id, venta_existente["id"])
                venta_existente_recuperada_id = venta_existente["id"]
                insert_orden_taller_evento(
                    conn,
                    id_orden_taller=orden_id,
                    tipo_evento="venta_generada",
                    detalle=(
                        f"Venta #{venta_existente_recuperada_id} ya existía para la orden "
                        f"de taller #{orden_id}; se re-vinculó para evitar duplicado"
                    ),
                    id_usuario=data.id_usuario,
                )
            else:
                if orden["estado"] != "terminada":
                    raise HTTPException(
                        status_code=400,
                        detail="Solo se puede generar venta desde una orden terminada",
                    )

                items = get_items_orden_taller(conn, orden_id)
                items_ejecutados = [
                    item for item in items
                    if item["etapa"] == "ejecutado" and item.get("aprobado") is True
                ]

                if not items_ejecutados:
                    raise HTTPException(
                        status_code=400,
                        detail="La orden no tiene items ejecutados para facturar",
                    )

                total_facturable = sum(
                    Decimal(str(item.get("subtotal") or 0))
                    for item in items_ejecutados
                )
                if total_facturable <= 0:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "La OT no tiene diferencia a cobrar. "
                            "No hace falta generar una venta."
                        ),
                    )

                payload_items = []
                for item in items_ejecutados:
                    cobertura = Decimal(
                        str(item.get("valor_cobertura_unitario") or 0)
                    )
                    precio_unitario = Decimal(
                        str(item.get("precio_unitario") or 0)
                    )
                    tiene_cobertura = cobertura > 0
                    motivo_cobertura = item.get("motivo_cobertura")
                    if item.get("observacion_cobertura"):
                        motivo_cobertura = (
                            f"{motivo_cobertura}. "
                            f"{item['observacion_cobertura']}"
                        )

                    if item.get("tipo_item") == "servicio":
                        # Compatibilidad con OT anteriores donde "gratis" se
                        # representó cargando precio 0. Venta exige conservar
                        # el precio de referencia y registrar la bonificación.
                        if precio_unitario <= 0:
                            servicio = get_servicio_taller_by_id(
                                conn,
                                item["id_servicio_taller"],
                            )
                            precio_referencia = Decimal(
                                str(
                                    (servicio or {}).get("precio_sugerido")
                                    or 0
                                )
                            )
                            if precio_referencia <= 0:
                                raise HTTPException(
                                    status_code=400,
                                    detail=(
                                        f'El servicio "{item["descripcion_snapshot"]}" '
                                        "no tiene un precio de referencia. "
                                        "Asignale un precio mayor a cero y "
                                        "bonificalo antes de generar la venta."
                                    ),
                                )
                            precio_unitario = precio_referencia
                            cobertura = precio_referencia
                            tiene_cobertura = True
                            motivo_cobertura = (
                                motivo_cobertura
                                or "Atención comercial - servicio bonificado"
                            )

                        payload_items.append({
                            "tipo_item": "servicio_taller",
                            "id_servicio_taller": item["id_servicio_taller"],
                            "descripcion_snapshot": item["descripcion_snapshot"],
                            "cantidad": item["cantidad"],
                            "precio_unitario_manual": precio_unitario,
                            "motivo_precio_manual": f"Precio de taller OT #{orden_id}",
                            "bonificado": tiene_cobertura,
                            "bonificacion_unitaria_manual": cobertura if tiene_cobertura else None,
                            "motivo_bonificacion": motivo_cobertura,
                            "id_orden_taller_item": item["id"],
                        })
                        continue

                    payload_items.append({
                        "tipo_item": "producto",
                        "id_variante": item["id_variante"],
                        "cantidad": item["cantidad"],
                        "precio_unitario_manual": item["precio_unitario"],
                        "motivo_precio_manual": f"Precio de taller OT #{orden_id}",
                        "bonificado": tiene_cobertura,
                        "bonificacion_unitaria_manual": cobertura if tiene_cobertura else None,
                        "motivo_bonificacion": motivo_cobertura,
                        "id_orden_taller_item": item["id"],
                    })

                try:
                    venta_payload = VentaCreateInput.model_validate({
                        "id_cliente": orden["id_cliente"],
                        "id_sucursal": orden["id_sucursal"],
                        "id_usuario": data.id_usuario,
                        "tipo_precio": "minorista",
                        "items": payload_items,
                        "pagos": [],
                        "observaciones": f"Generada desde orden de taller #{orden_id}",
                        "id_orden_taller": orden_id,
                    })
                except ValidationError as e:
                    raise HTTPException(status_code=400, detail=str(e))

        if venta_existente_recuperada_id:
            raise HTTPException(
                status_code=400,
                detail=f"La orden ya tiene una venta generada: #{venta_existente_recuperada_id}",
            )

        # crear_venta maneja su propia transacción/conexión. No la llamamos dentro
        # de la transacción anterior para evitar transacciones anidadas entre conexiones.
        venta_creada = crear_venta(venta_payload)
        venta_id = venta_creada["venta_id"]

        with conn.transaction():
            update_orden_taller_venta_generada(conn, orden_id, venta_id)
            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="venta_generada",
                detalle=f"Venta #{venta_id} generada desde orden de taller #{orden_id}",
                id_usuario=data.id_usuario,
            )

        return {
            "ok": True,
            "orden_id": orden_id,
            "venta_id": venta_id,
            "estado_orden": "facturada",
        }
    finally:
        conn.close()

def _capitalizar_texto_cliente(texto: str | None) -> str | None:
    if not texto:
        return None

    palabras_mayusculas = {
        "R29",
        "R28",
        "R27.5",
        "R26",
        "R24",
        "R20",
        "MTB",
        "BMX",
    }

    partes = []

    for palabra in str(texto).strip().split():
        palabra_limpia = palabra.strip()

        if not palabra_limpia:
            continue

        upper = palabra_limpia.upper()

        if upper in palabras_mayusculas:
            partes.append(upper)
        elif palabra_limpia.isupper() and len(palabra_limpia) <= 4:
            partes.append(palabra_limpia)
        else:
            partes.append(
                palabra_limpia[:1].upper() + palabra_limpia[1:].lower()
            )

    return " ".join(partes) or None

def _format_bicicleta_mensaje(orden: dict) -> str:
    marca = _capitalizar_texto_cliente(orden.get("bicicleta_marca"))
    modelo = _capitalizar_texto_cliente(orden.get("bicicleta_modelo"))
    rodado = _capitalizar_texto_cliente(
        f"R{orden.get('bicicleta_rodado')}"
        if orden.get("bicicleta_rodado")
        else None
    )
    color = _capitalizar_texto_cliente(orden.get("bicicleta_color"))

    partes = [
        marca,
        modelo,
        rodado,
        color,
    ]

    texto = " ".join(parte for parte in partes if parte)

    if texto:
        return texto

    descripcion = _capitalizar_texto_cliente(
        orden.get("bicicleta_descripcion")
    )

    return descripcion or f"Bicicleta #{orden.get('id_bicicleta_cliente')}"

def _normalizar_telefono_whatsapp(telefono: str | None) -> str | None:
    if not telefono:
        return None

    digitos = "".join(ch for ch in str(telefono) if ch.isdigit())
    if not digitos:
        return None

    if digitos.startswith("549"):
        return digitos
    if digitos.startswith("54"):
        digitos = digitos[2:]
        if digitos.startswith("9"):
            digitos = digitos[1:]
    if digitos.startswith("0"):
        digitos = digitos[1:]
    if digitos.startswith("15"):
        digitos = digitos[2:]
    else:
        for idx in range(2, min(5, len(digitos) - 1)):
            if digitos[idx:idx + 2] == "15" and len(digitos) > 10:
                digitos = digitos[:idx] + digitos[idx + 2:]
                break

    return "549" + digitos

def _resolver_nombre_visible_cliente(data) -> str:
    nombre = (data.get("cliente_nombre") or data.get("nombre") or "").strip()
    if nombre:
        return nombre

    nombre_partes = " ".join(
        parte.strip()
        for parte in [
            data.get("nombre_persona") or data.get("cliente_nombre_persona"),
            data.get("apellido") or data.get("cliente_apellido"),
        ]
        if parte and str(parte).strip()
    )

    return nombre_partes or "cliente"

def _limpiar_descripcion_item_mensaje(descripcion: str | None) -> str:
    texto = (descripcion or "").strip()

    if not texto:
        return "Trabajo realizado"

    partes = [
        parte.strip()
        for parte in texto.split(" - ")
        if parte and parte.strip()
    ]

    if len(partes) >= 2 and partes[0].lower() == partes[1].lower():
        return partes[0]

    if len(partes) >= 2 and partes[1].lower() in partes[0].lower():
        return partes[0]

    if len(partes) >= 2 and partes[0].lower() in partes[1].lower():
        return partes[1]

    return texto

def _format_money_mensaje(value) -> str:
    try:
        monto = int(round(float(value or 0)))
    except (TypeError, ValueError):
        monto = 0

    return f"${monto:,.0f}".replace(",", ".")

def _build_mensaje_lista_retiro(orden, conn, items, notas_cliente):
    config = obtener_configuracion_negocio()
    cliente = _resolver_nombre_visible_cliente(orden)
    bicicleta = _format_bicicleta_mensaje(orden)

    items_ejecutados = [
        item for item in items
        if item.get("etapa") == "ejecutado"
        and item.get("aprobado") is True
    ]

    trabajos_lineas = []
    if config.get("whatsapp_retiro_mostrar_trabajos"):
        trabajos_lineas.extend(["*Trabajos realizados:*", ""])
        if not items_ejecutados:
            trabajos_lineas.append("• Service/reparación realizada")

        for item in items_ejecutados:
            descripcion = get_nombre_cliente_item_taller(
                conn,
                item.get("id_variante"),
                item.get("id_servicio_taller"),
            )

            if not descripcion:
                descripcion = _limpiar_descripcion_item_mensaje(
                    item.get("descripcion_snapshot")
                )

            subtotal = _format_money_mensaje(item.get("subtotal"))
            trabajos_lineas.append(f"• {descripcion}: {subtotal}")

        if notas_cliente:
            trabajos_lineas.extend(["", "*Notas y recomendaciones:*", ""])
            for nota in notas_cliente:
                trabajos_lineas.append(f"• {nota['contenido']}")
        trabajos_lineas.extend(["", "--------------------", ""])

    total_bloque = ""
    if config.get("whatsapp_retiro_mostrar_total"):
        total_bloque = f"*Total:* {_format_money_mensaje(orden.get('total_final'))}\n\n"

    variables = {
        **config,
        "cliente_nombre": cliente,
        "bicicleta": bicicleta,
        "trabajos_bloque": "\n".join(trabajos_lineas),
        "total_bloque": total_bloque,
    }

    return render_template(config.get("plantilla_retiro_taller"), variables)

def actualizar_datos_operativos_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(status_code=404, detail=f"No existe la orden de taller {orden_id}")

            if orden["estado"] in {"retirada", "cancelada"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se pueden cambiar datos operativos de una orden {orden['estado']}",
                )

            update_orden_taller_operativo(
                conn,
                orden_id=orden_id,
                fecha_prometida=data.fecha_prometida,
                prioridad=data.prioridad,
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="datos_operativos_actualizados",
                detalle=(
                    f"Fecha prometida: {data.fecha_prometida or 'sin fecha'}. "
                    f"Prioridad: {data.prioridad}."
                ),
                id_usuario=data.id_usuario,
            )

            return get_orden_taller_by_id(conn, orden_id)
    finally:
        conn.close()

def generar_mensaje_lista_retiro_orden_taller(orden_id: int):
    conn = get_connection()
    try:
        orden = get_orden_taller_by_id(conn, orden_id)

        if orden is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la orden de taller {orden_id}",
            )

        if orden["estado"] not in {"terminada", "facturada", "lista_para_retirar"}:
            raise HTTPException(
                status_code=400,
                detail="El mensaje de retiro solo se genera cuando la orden esta terminada o lista para retirar",
            )

        items = get_items_orden_taller(conn, orden_id)
        notas_cliente = get_notas_cliente_orden_taller(conn, orden_id)

        mensaje = _build_mensaje_lista_retiro(
            orden,
            conn,
            items,
            notas_cliente,
        )

        telefono = _normalizar_telefono_whatsapp(
            orden.get("cliente_telefono")
        )

        whatsapp_url = None

        if telefono:
            whatsapp_url = (
                f"https://api.whatsapp.com/send?phone={telefono}&text={quote_plus(mensaje)}"
            )

        return {
            "orden_id": orden_id,
            "cliente_nombre": _resolver_nombre_visible_cliente(orden),
            "cliente_telefono": orden.get("cliente_telefono"),
            "bicicleta_descripcion": _format_bicicleta_mensaje(orden),
            "mensaje": mensaje,
            "whatsapp_url": whatsapp_url,
        }

    finally:
        conn.close()

def registrar_aviso_retiro_orden_taller(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            try:
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            orden = get_orden_taller_by_id_for_update(conn, orden_id)
            if orden is None:
                raise HTTPException(status_code=404, detail=f"No existe la orden de taller {orden_id}")

            if orden["estado"] not in {"terminada", "facturada", "lista_para_retirar"}:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede avisar retiro cuando la orden esta terminada o lista para retirar",
                )

            marcar_aviso_retiro_enviado(conn, orden_id)

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden_id,
                tipo_evento="cliente_avisado_retiro",
                detalle="Se enviÃ³ aviso de bicicleta lista para retirar por WhatsApp",
                id_usuario=data.id_usuario,
            )

            return get_orden_taller_by_id(conn, orden_id)
    finally:
        conn.close()
