from datetime import date, timedelta
from decimal import Decimal
from urllib.parse import quote_plus

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.configuracion_negocio.service import obtener_configuracion_negocio
from app.modules.configuracion_negocio.template import render_template
from app.core.text_normalization import clean_text, normalize_text_upper

from .repository import (
    cambiar_estado_cotizacion,
    delete_cotizacion_item,
    get_bicicleta_cliente_by_id,
    get_cliente_by_id,
    get_cotizacion_by_id,
    get_cotizacion_items,
    get_servicio_taller_by_id,
    get_sucursal_by_id,
    get_usuario_by_id,
    get_variante_cotizable_by_id,
    insert_cotizacion,
    insert_cotizacion_item,
    listar_cotizaciones,
    recalcular_totales_cotizacion,
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
                _insertar_item_normalizado(conn, cotizacion["id"], item)

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
            creado = _insertar_item_normalizado(conn, cotizacion_id, item)
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

        consulta_bloque = ""
        if cotizacion.get("problema_reportado"):
            consulta_bloque = f"Consulta: {cotizacion['problema_reportado']}\n"

        detalle_bloque = ""
        if items:
            detalle_lineas = ["Detalle:"]
            for item in items:
                detalle_lineas.append(
                    f"- {item['descripcion_snapshot']} x {item['cantidad']}: ${item['subtotal']}"
                )
            detalle_bloque = "\n".join(detalle_lineas) + "\n"

        validez_bloque = ""
        if cotizacion.get("fecha_validez"):
            validez_bloque = f"Valida hasta: {cotizacion['fecha_validez']}\n"

        mensaje = render_template(
            config.get("plantilla_cotizacion_whatsapp"),
            {
                **config,
                "cliente_nombre": cliente,
                "numero_cotizacion": cotizacion["numero"],
                "tipo_cotizacion": "reparacion" if cotizacion["tipo"] == "reparacion" else "bicicleta/productos",
                "consulta_bloque": consulta_bloque,
                "detalle_bloque": detalle_bloque,
                "total": f"${cotizacion['total_final']}",
                "validez_bloque": validez_bloque,
            },
        )
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


def _insertar_item_normalizado(conn, cotizacion_id: int, item):
    normalizado = _normalizar_item(conn, item)
    normalizado["id_cotizacion"] = cotizacion_id
    return insert_cotizacion_item(conn, normalizado)


def _normalizar_item(conn, item):
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

        precio = precio if precio is not None else variante["precio_minorista"]
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
