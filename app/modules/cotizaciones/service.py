from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import quote_plus

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.configuracion_negocio.service import obtener_configuracion_negocio
from app.core.text_normalization import clean_text, normalize_text_upper
from app.modules.ventas.schema import VentaCreateInput
from app.modules.ventas.service import crear_venta

from .repository import (
    cambiar_estado_cotizacion,
    delete_cotizacion_item,
    get_bicicleta_cliente_by_id,
    get_cliente_by_id,
    get_cotizacion_by_id,
    get_cotizacion_by_id_for_update,
    get_cotizacion_items,
    get_cotizacion_items_disponibilidad,
    get_serializadas_disponibles_cotizacion,
    get_servicio_taller_by_id,
    get_sucursal_by_id,
    get_usuario_by_id,
    get_variante_cotizable_by_id,
    insert_cotizacion,
    insert_cotizacion_item,
    listar_cotizaciones,
    marcar_cotizacion_convertida,
    recalcular_totales_cotizacion,
    update_cotizacion_item_cantidad,
)


ESTADOS_EDITABLES = {"borrador", "enviada"}
TRANSICIONES_ESTADO = {
    "borrador": {"enviada", "aceptada", "rechazada", "vencida", "cancelada"},
    "enviada": {"borrador", "aceptada", "rechazada", "vencida", "cancelada"},
    "aceptada": {"enviada", "rechazada", "cancelada"},
    "rechazada": {"borrador"},
    "vencida": {"borrador", "enviada"},
    "cancelada": {"borrador"},
    "convertida": set(),
}


def crear_cotizacion(data):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_base(conn, data)
            cliente = get_cliente_by_id(conn, data.id_cliente) if data.id_cliente else None

            cotizacion = insert_cotizacion(
                conn,
                {
                    "tipo": data.tipo,
                    "tipo_precio": data.tipo_precio,
                    "fecha_validez": data.fecha_validez or date.today() + timedelta(days=7),
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": data.id_cliente,
                    "cliente_nombre_snapshot": (
                        normalize_text_upper(data.cliente_nombre_snapshot)
                        if data.cliente_nombre_snapshot
                        else cliente["nombre"]
                        if cliente
                        else None
                    ),
                    "cliente_telefono_snapshot": (
                        clean_text(data.cliente_telefono_snapshot)
                        if data.cliente_telefono_snapshot
                        else cliente.get("telefono")
                        if cliente
                        else None
                    ),
                    "id_bicicleta_cliente": data.id_bicicleta_cliente,
                    "problema_reportado": normalize_text_upper(data.problema_reportado),
                    "observaciones": _limpiar_texto(data.observaciones),
                    "descuento_total": data.descuento_total,
                    "recargo_total": data.recargo_total,
                    "id_usuario_creador": data.id_usuario_creador,
                },
            )

            for item in data.items:
                _insertar_item_normalizado(conn, cotizacion["id"], item, cotizacion.get("tipo_precio"))

            recalcular_totales_cotizacion(conn, cotizacion["id"])
            return obtener_cotizacion(cotizacion["id"], conn=conn)
    finally:
        conn.close()


def obtener_cotizaciones(tipo: str | None = None, estado: str | None = None):
    conn = get_connection()
    try:
        return listar_cotizaciones(conn, tipo=tipo, estado=estado)
    finally:
        conn.close()


def obtener_cotizacion(cotizacion_id: int, *, conn=None):
    own_conn = conn is None
    conn = conn or get_connection()
    try:
        cotizacion = get_cotizacion_by_id(conn, cotizacion_id)
        if cotizacion is None:
            raise HTTPException(status_code=404, detail="No existe la cotizacion")

        cotizacion = dict(cotizacion)
        cotizacion["items"] = get_cotizacion_items(conn, cotizacion_id)
        return cotizacion
    finally:
        if own_conn:
            conn.close()


def agregar_item_cotizacion(cotizacion_id: int, item):
    conn = get_connection()
    try:
        with conn.transaction():
            cotizacion = _get_cotizacion_o_404(conn, cotizacion_id)
            _validar_editable(cotizacion)
            creado = _insertar_item_normalizado(conn, cotizacion_id, item, cotizacion.get("tipo_precio"))
            recalcular_totales_cotizacion(conn, cotizacion_id)
            return creado
    finally:
        conn.close()


def quitar_item_cotizacion(cotizacion_id: int, item_id: int):
    conn = get_connection()
    try:
        with conn.transaction():
            cotizacion = _get_cotizacion_o_404(conn, cotizacion_id)
            _validar_editable(cotizacion)
            item = delete_cotizacion_item(conn, cotizacion_id, item_id)
            if item is None:
                raise HTTPException(status_code=404, detail="No existe el item de cotizacion")
            recalcular_totales_cotizacion(conn, cotizacion_id)
            return item
    finally:
        conn.close()


def actualizar_cantidad_item_cotizacion(cotizacion_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            cotizacion = _get_cotizacion_o_404(conn, cotizacion_id)
            _validar_editable(cotizacion)

            item_actual = next(
                (
                    item
                    for item in get_cotizacion_items(conn, cotizacion_id)
                    if item["id"] == item_id
                ),
                None,
            )
            if item_actual is None:
                raise HTTPException(
                    status_code=404,
                    detail="No existe el item de cotizacion",
                )

            subtotal = (
                Decimal(str(data.cantidad))
                * Decimal(str(item_actual["precio_unitario"]))
                - Decimal(str(item_actual["descuento_monto"]))
            )
            if subtotal < 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "La cantidad deja el descuento por encima del subtotal. "
                        "Revisá el descuento del ítem."
                    ),
                )

            actualizado = update_cotizacion_item_cantidad(
                conn,
                cotizacion_id,
                item_id,
                data.cantidad,
            )
            recalcular_totales_cotizacion(conn, cotizacion_id)
            return actualizado
    finally:
        conn.close()


def obtener_preview_conversion_venta(cotizacion_id: int):
    conn = get_connection()
    try:
        cotizacion = _get_cotizacion_o_404(conn, cotizacion_id)
        return _armar_preview_conversion(conn, cotizacion)
    finally:
        conn.close()


def convertir_cotizacion_a_venta(cotizacion_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            cotizacion = get_cotizacion_by_id_for_update(conn, cotizacion_id)
            if cotizacion is None:
                raise HTTPException(status_code=404, detail="No existe la cotizacion")

            if cotizacion["id_venta_convertida"] is not None:
                return {
                    "ok": True,
                    "cotizacion_id": cotizacion_id,
                    "venta_id": cotizacion["id_venta_convertida"],
                    "estado_cotizacion": "convertida",
                    "ya_convertida": True,
                }

            if cotizacion["tipo"] != "venta":
                raise HTTPException(
                    status_code=400,
                    detail="Sólo las cotizaciones de venta se convierten en venta",
                )
            if cotizacion["estado"] != "aceptada":
                raise HTTPException(
                    status_code=400,
                    detail="La cotización debe estar aceptada antes de convertirla",
                )
            if cotizacion["id_cliente"] is None:
                raise HTTPException(
                    status_code=400,
                    detail="La cotización necesita un cliente seleccionado para convertirse",
                )

            preview = _armar_preview_conversion(conn, cotizacion)
            if not preview["puede_convertir"]:
                detalle = " ".join(preview["advertencias"])
                raise HTTPException(status_code=409, detail=detalle)

            items = get_cotizacion_items_disponibilidad(conn, cotizacion_id)
            selecciones_por_item = {}
            ids_serializados = set()
            for seleccion in data.serializadas:
                if seleccion.id_bicicleta_serializada in ids_serializados:
                    raise HTTPException(
                        status_code=400,
                        detail="La misma bicicleta no puede seleccionarse dos veces",
                    )
                ids_serializados.add(seleccion.id_bicicleta_serializada)
                selecciones_por_item.setdefault(
                    seleccion.id_cotizacion_item,
                    [],
                ).append(seleccion.id_bicicleta_serializada)

            venta_items = []
            factor_global = (
                Decimal(str(cotizacion["total_final"]))
                / Decimal(str(cotizacion["subtotal"]))
                if Decimal(str(cotizacion["subtotal"])) > 0
                else Decimal("1")
            )

            for item in items:
                cantidad = Decimal(str(item["cantidad"]))
                precio_referencia = Decimal(str(item["precio_unitario"]))
                subtotal_item = Decimal(str(item["subtotal"]))
                precio_final_unitario = (
                    (subtotal_item * factor_global) / cantidad
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                if precio_referencia <= 0:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"{item['descripcion_snapshot']} tiene precio cero y "
                            "no puede convertirse automáticamente"
                        ),
                    )

                precio_manual = max(precio_referencia, precio_final_unitario)
                bonificacion_unitaria = max(
                    precio_manual - precio_final_unitario,
                    Decimal("0"),
                )
                base_item = {
                    "tipo_item": item["tipo_item"],
                    "id_variante": item["id_variante"],
                    "id_servicio_taller": item["id_servicio_taller"],
                    "precio_unitario_manual": precio_manual,
                    "motivo_precio_manual": (
                        f"Precio conservado desde cotización {cotizacion['numero']}"
                    ),
                    "bonificado": bonificacion_unitaria > 0,
                    "bonificacion_unitaria_manual": (
                        bonificacion_unitaria
                        if bonificacion_unitaria > 0
                        else None
                    ),
                    "motivo_bonificacion": (
                        f"Descuento cotizado en {cotizacion['numero']}"
                        if bonificacion_unitaria > 0
                        else None
                    ),
                    "descripcion_snapshot": item["descripcion_snapshot"],
                }

                if item["tipo_item"] == "producto" and item["serializable"]:
                    if cantidad != cantidad.to_integral_value():
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"{item['descripcion_snapshot']} requiere una "
                                "cantidad entera"
                            ),
                        )
                    seleccionadas = selecciones_por_item.get(item["id"], [])
                    if len(seleccionadas) != int(cantidad):
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"Seleccioná {int(cantidad)} número(s) de cuadro "
                                f"para {item['descripcion_snapshot']}"
                            ),
                        )
                    for bicicleta_id in seleccionadas:
                        venta_items.append(
                            {
                                **base_item,
                                "cantidad": 1,
                                "id_bicicleta_serializada": bicicleta_id,
                            }
                        )
                else:
                    venta_items.append(
                        {
                            **base_item,
                            "cantidad": cantidad,
                            "id_bicicleta_serializada": None,
                        }
                    )

            venta_data = VentaCreateInput(
                id_cliente=cotizacion["id_cliente"],
                id_sucursal=cotizacion["id_sucursal"],
                id_usuario=data.id_usuario,
                tipo_precio=cotizacion["tipo_precio"],
                items=venta_items,
                pagos=[],
                observaciones=(
                    f"Generada desde cotización {cotizacion['numero']}"
                ),
            )
            resultado_venta = crear_venta(venta_data, conn=conn)
            marcar_cotizacion_convertida(
                conn,
                cotizacion_id=cotizacion_id,
                venta_id=resultado_venta["venta_id"],
                id_usuario=data.id_usuario,
            )

            return {
                "ok": True,
                "cotizacion_id": cotizacion_id,
                "venta_id": resultado_venta["venta_id"],
                "estado_cotizacion": "convertida",
                "ya_convertida": False,
            }
    finally:
        conn.close()


def actualizar_estado_cotizacion(cotizacion_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            cotizacion = _get_cotizacion_o_404(conn, cotizacion_id)
            if get_usuario_by_id(conn, data.id_usuario) is None:
                raise HTTPException(status_code=404, detail="No existe el usuario")

            estado_actual = cotizacion["estado"]
            if data.estado != estado_actual and data.estado not in TRANSICIONES_ESTADO.get(estado_actual, set()):
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede pasar una cotizacion de {estado_actual} a {data.estado}",
                )

            if data.estado == "aceptada" and cotizacion["items_count"] == 0:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede aceptar una cotizacion sin items",
                )

            cambiar_estado_cotizacion(conn, cotizacion_id, data.estado, data.id_usuario)
            return obtener_cotizacion(cotizacion_id, conn=conn)
    finally:
        conn.close()


def generar_mensaje_whatsapp_cotizacion(cotizacion_id: int):
    conn = get_connection()
    try:
        config = obtener_configuracion_negocio()
        cotizacion = obtener_cotizacion(cotizacion_id, conn=conn)
        items = cotizacion["items"]
        cliente = _resolver_nombre_visible_cliente(cotizacion)

        mensaje = _build_mensaje_whatsapp_cotizacion(cotizacion, items, cliente, config)
        telefono = _normalizar_telefono_whatsapp(
            cotizacion.get("cliente_telefono_snapshot")
            or cotizacion.get("cliente_telefono")
        )
        whatsapp_url = (
            f"https://api.whatsapp.com/send?phone={telefono}&text={quote_plus(mensaje)}"
            if telefono
            else None
        )

        return {
            "cotizacion_id": cotizacion_id,
            "numero": cotizacion["numero"],
            "telefono": telefono,
            "mensaje": mensaje,
            "whatsapp_url": whatsapp_url,
        }
    finally:
        conn.close()


def _validar_base(conn, data):
    if get_sucursal_by_id(conn, data.id_sucursal) is None:
        raise HTTPException(status_code=404, detail="No existe la sucursal")

    if get_usuario_by_id(conn, data.id_usuario_creador) is None:
        raise HTTPException(status_code=404, detail="No existe el usuario creador")

    if data.id_cliente and get_cliente_by_id(conn, data.id_cliente) is None:
        raise HTTPException(status_code=404, detail="No existe el cliente")

    if data.id_bicicleta_cliente:
        bicicleta = get_bicicleta_cliente_by_id(conn, data.id_bicicleta_cliente)
        if bicicleta is None:
            raise HTTPException(status_code=404, detail="No existe la bicicleta del cliente")
        if data.id_cliente and bicicleta["id_cliente"] != data.id_cliente:
            raise HTTPException(
                status_code=400,
                detail="La bicicleta no pertenece al cliente de la cotizacion",
            )


def _insertar_item_normalizado(conn, cotizacion_id: int, item, tipo_precio: str | None = "minorista"):
    normalizado = _normalizar_item(conn, item, tipo_precio=tipo_precio)
    normalizado["id_cotizacion"] = cotizacion_id
    return insert_cotizacion_item(conn, normalizado)


def _normalizar_item(conn, item, *, tipo_precio: str | None = "minorista"):
    precio = item.precio_unitario
    descripcion = _limpiar_texto(item.descripcion_snapshot)
    costo = None
    id_variante = item.id_variante
    id_servicio_taller = item.id_servicio_taller

    if item.tipo_item == "producto":
        variante = get_variante_cotizable_by_id(conn, item.id_variante)
        if variante is None:
            raise HTTPException(status_code=404, detail="No existe la variante")
        if not variante["activo"] or not variante["producto_activo"]:
            raise HTTPException(status_code=400, detail="La variante no esta activa")

        precio_catalogo = (
            variante["precio_mayorista"]
            if tipo_precio == "mayorista" and variante.get("precio_mayorista") is not None
            else variante["precio_minorista"]
        )
        precio = precio if precio is not None else precio_catalogo
        descripcion = descripcion or _descripcion_variante(variante)
        costo = variante.get("costo_promedio_vigente")

    if item.tipo_item == "servicio_taller":
        servicio = get_servicio_taller_by_id(conn, item.id_servicio_taller)
        if servicio is None:
            raise HTTPException(status_code=404, detail="No existe el servicio de taller")
        if not servicio["activo"]:
            raise HTTPException(status_code=400, detail="El servicio de taller no esta activo")

        precio = precio if precio is not None else servicio["precio_sugerido"]
        descripcion = descripcion or servicio["nombre"]
        costo = Decimal("0")

    if item.tipo_item == "linea_libre":
        precio = precio if precio is not None else Decimal("0")

    subtotal = (Decimal(item.cantidad) * Decimal(precio)) - Decimal(item.descuento_monto)
    if subtotal < 0:
        raise HTTPException(
            status_code=400,
            detail="El descuento del item no puede superar el subtotal",
        )

    return {
        "tipo_item": item.tipo_item,
        "id_variante": id_variante,
        "id_servicio_taller": id_servicio_taller,
        "descripcion_snapshot": descripcion,
        "cantidad": item.cantidad,
        "precio_unitario": precio,
        "descuento_monto": item.descuento_monto,
        "subtotal": subtotal,
        "costo_unitario_referencia": costo,
        "notas": _limpiar_texto(item.notas),
        "orden": item.orden,
    }


def _get_cotizacion_o_404(conn, cotizacion_id: int):
    cotizacion = get_cotizacion_by_id(conn, cotizacion_id)
    if cotizacion is None:
        raise HTTPException(status_code=404, detail="No existe la cotizacion")
    return cotizacion


def _validar_editable(cotizacion):
    if cotizacion["estado"] not in ESTADOS_EDITABLES:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden editar cotizaciones en borrador o enviadas",
        )


def _armar_preview_conversion(conn, cotizacion):
    items = get_cotizacion_items_disponibilidad(conn, cotizacion["id"])
    salida = []
    advertencias = []
    requiere_serializadas = False

    if cotizacion["tipo"] != "venta":
        advertencias.append("Esta cotización es de reparación, no de venta.")
    if cotizacion["estado"] not in {"aceptada", "convertida"}:
        advertencias.append("Primero marcá la cotización como aceptada.")
    if cotizacion["id_cliente"] is None:
        advertencias.append("Seleccioná un cliente antes de convertir.")

    for item in items:
        cantidad = Decimal(str(item["cantidad"]))
        serializable = bool(item["serializable"])
        stockeable = bool(item["stockeable"])
        disponibles = cantidad
        bloqueo = None
        serializadas = []

        if item["tipo_item"] == "linea_libre":
            disponibles = Decimal("0")
            bloqueo = (
                "Las líneas libres deben reemplazarse por un producto o servicio "
                "antes de convertir."
            )
        elif Decimal(str(item["precio_unitario"])) <= 0:
            disponibles = Decimal("0")
            bloqueo = "El ítem tiene precio cero."
        elif item["tipo_item"] == "producto" and serializable:
            requiere_serializadas = True
            disponibles = Decimal(str(item["serializadas_disponibles_count"]))
            serializadas = get_serializadas_disponibles_cotizacion(
                conn,
                variante_id=item["id_variante"],
                sucursal_id=cotizacion["id_sucursal"],
            )
            if cantidad != cantidad.to_integral_value():
                bloqueo = "Una bicicleta serializada requiere cantidad entera."
        elif item["tipo_item"] == "producto" and stockeable:
            disponibles = Decimal(str(item["stock_disponible"]))

        faltante = max(cantidad - disponibles, Decimal("0"))
        if faltante > 0:
            advertencias.append(
                f"{item['descripcion_snapshot']}: faltan {faltante:g} unidad(es)."
            )
        if bloqueo:
            advertencias.append(f"{item['descripcion_snapshot']}: {bloqueo}")

        salida.append(
            {
                "id_cotizacion_item": item["id"],
                "descripcion": item["descripcion_snapshot"],
                "tipo_item": item["tipo_item"],
                "cantidad": cantidad,
                "serializable": serializable,
                "stockeable": stockeable,
                "disponible": disponibles,
                "faltante": faltante,
                "serializadas_disponibles": serializadas,
                "bloqueo": bloqueo,
            }
        )

    if not items:
        advertencias.append("La cotización no tiene ítems.")

    return {
        "cotizacion_id": cotizacion["id"],
        "puede_convertir": not advertencias,
        "requiere_seleccion_serializadas": requiere_serializadas,
        "items": salida,
        "advertencias": advertencias,
    }


def _descripcion_variante(variante):
    partes = [variante["producto_nombre"], variante.get("nombre_variante")]
    return " - ".join([str(p) for p in partes if p])


def _limpiar_texto(value):
    if value is None:
        return None
    value = value.strip()
    return value or None


def _resolver_nombre_visible_cliente(data) -> str:
    nombre = (
        data.get("cliente_nombre_snapshot")
        or data.get("cliente_nombre")
        or data.get("nombre")
        or ""
    ).strip()
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


def _build_mensaje_whatsapp_cotizacion(cotizacion: dict, items: list[dict], cliente: str, config: dict) -> str:
    detalle_lineas = []
    for item in items:
        cantidad = Decimal(str(item.get("cantidad") or 0))
        detalle_lineas.append(
            f"• {item.get('descripcion_snapshot')} ×{cantidad:g} — {_format_money_whatsapp(item.get('subtotal'))}"
        )

    partes = [
        f"Hola {cliente} 👋",
        "",
        f"Te enviamos la cotización {cotizacion.get('numero')}.",
        "",
        f"Lista aplicada: {_label_tipo_precio(cotizacion.get('tipo_precio'))}",
    ]

    if cotizacion.get("problema_reportado"):
        partes.extend(["", f"Consulta: {cotizacion.get('problema_reportado')}"])

    if detalle_lineas:
        partes.extend(["", "Detalle:", *detalle_lineas])

    partes.extend(["", f"Total estimado: {_format_money_whatsapp(cotizacion.get('total_final'))}"])

    if cotizacion.get("fecha_validez"):
        partes.append(f"Válida hasta: {_format_date_whatsapp(cotizacion.get('fecha_validez'))}")

    partes.extend(
        [
            "",
            "Esta cotización no reserva stock y los precios están sujetos a disponibilidad y vigencia.",
            "",
            f"{config.get('nombre_negocio') or 'Emprendimiento Agus'} 🚲",
        ]
    )

    return "\n".join(partes)


def _label_tipo_precio(tipo_precio: str | None) -> str:
    return "Mayorista" if tipo_precio == "mayorista" else "Minorista"


def _format_money_whatsapp(value) -> str:
    numero = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    formatted = f"{numero:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"${formatted}"


def _format_date_whatsapp(value) -> str:
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    try:
        return datetime.fromisoformat(str(value)).strftime("%d/%m/%Y")
    except ValueError:
        return str(value)


def _normalizar_telefono_whatsapp(telefono: str | None) -> str | None:
    if not telefono:
        return None

    digits = "".join(ch for ch in str(telefono) if ch.isdigit())
    if not digits:
        return None

    if digits.startswith("549"):
        return digits
    if digits.startswith("54"):
        digits = digits[2:]
        if digits.startswith("9"):
            digits = digits[1:]
    if digits.startswith("0"):
        digits = digits[1:]
    if digits.startswith("15"):
        digits = digits[2:]
    else:
        for idx in range(2, min(5, len(digits) - 1)):
            if digits[idx:idx + 2] == "15" and len(digits) > 10:
                digits = digits[:idx] + digits[idx + 2:]
                break
    return f"549{digits}"
