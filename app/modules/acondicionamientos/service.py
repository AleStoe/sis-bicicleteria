from decimal import Decimal

from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.stock import repository as stock_repository
from app.shared.money import redondear_monto, to_decimal

from . import repository


ENTIDAD = "bicicleta_acondicionamiento"


def _texto(value):
    return (value or "").strip() or None


def _registrar_evento(
    conn,
    orden,
    *,
    accion: str,
    id_usuario: int | None,
    detalle: str,
    metadata: dict | None = None,
):
    metadata = metadata or {}
    repository.insert_evento(
        conn,
        orden["id"],
        {
            "accion": accion,
            "detalle": detalle,
            "metadata": metadata,
            "id_usuario": id_usuario,
        },
    )
    auditoria_service.registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=orden["id_sucursal"],
        entidad=ENTIDAD,
        entidad_id=orden["id"],
        accion=accion,
        detalle=detalle,
        metadata={
            "id_bicicleta_serializada": orden["id_bicicleta_serializada"],
            **metadata,
        },
        origen_tipo=ENTIDAD,
        origen_id=orden["id"],
    )


def _detalle(conn, acondicionamiento_id: int):
    orden = repository.get_acondicionamiento(conn, acondicionamiento_id)
    if orden is None:
        raise HTTPException(status_code=404, detail="No existe el acondicionamiento")

    items = []
    advertencias = []
    total_componentes = Decimal("0")
    for row in repository.list_items(conn, acondicionamiento_id):
        item = dict(row)
        cantidad = to_decimal(item["cantidad"])
        costo = to_decimal(item["costo_unitario_estimado"])
        disponible = to_decimal(item["stock_disponible_actual"])
        subtotal = redondear_monto(cantidad * costo)
        suficiente = disponible >= cantidad
        item["subtotal_estimado"] = subtotal
        item["disponibilidad_suficiente"] = suficiente
        total_componentes += subtotal
        if not suficiente and orden["estado"] in {"borrador", "confirmado"}:
            advertencias.append(
                f"{item['producto_nombre_snapshot']}: necesita {cantidad:g} y hay {disponible:g}."
            )
        items.append(item)

    costos = []
    total_costos = Decimal("0")
    for row in repository.list_costos(conn, acondicionamiento_id):
        costo = dict(row)
        total = redondear_monto(
            to_decimal(costo["cantidad"]) * to_decimal(costo["costo_unitario"])
        )
        costo["total"] = total
        total_costos += total
        costos.append(costo)

    recuperos = [dict(row) for row in repository.list_recuperos(conn, acondicionamiento_id)]
    total_recuperos = redondear_monto(
        sum((to_decimal(row["monto"]) for row in recuperos), Decimal("0"))
    )
    total_componentes = redondear_monto(total_componentes)
    total_costos = redondear_monto(total_costos)
    total_bruto = redondear_monto(total_componentes + total_costos)
    total_neto = redondear_monto(total_bruto - total_recuperos)
    if total_neto < 0 and orden["estado"] in {"borrador", "confirmado"}:
        advertencias.append("Los recuperos no pueden superar los costos del acondicionamiento.")
    puede_confirmar = bool(items or costos) and not advertencias and orden["estado"] == "borrador"
    puede_aplicar = bool(items or costos) and not advertencias and orden["estado"] == "confirmado"

    return {
        **dict(orden),
        "items": items,
        "costos": costos,
        "recuperos": recuperos,
        "historial": repository.list_eventos(conn, acondicionamiento_id),
        "total_componentes_estimado": total_componentes,
        "total_costos_adicionales": total_costos,
        "total_bruto_estimado": total_bruto,
        "total_recuperos_estimado": total_recuperos,
        "total_estimado": total_neto,
        "puede_confirmar": puede_confirmar,
        "puede_aplicar": puede_aplicar,
        "advertencias": advertencias,
    }


def crear_acondicionamiento(data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            bici = repository.get_bicicleta_for_update(
                conn, payload["id_bicicleta_serializada"]
            )
            if bici is None:
                raise HTTPException(status_code=404, detail="No existe la bicicleta serializada")
            if bici["estado"] != "disponible":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede acondicionar una bicicleta disponible",
                )
            if bici["estado_tecnico"] == "en_acondicionamiento":
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta ya se encuentra en acondicionamiento",
                )

            try:
                orden = repository.insert_acondicionamiento(
                    conn,
                    {
                        **payload,
                        "id_sucursal": bici["id_sucursal_actual"],
                        "estado_tecnico_anterior": bici["estado_tecnico"],
                        "motivo": payload["motivo"].strip(),
                        "observaciones": _texto(payload.get("observaciones")),
                    },
                )
            except Exception as exc:
                if getattr(exc, "sqlstate", None) == "23505":
                    raise HTTPException(
                        status_code=409,
                        detail="La bicicleta ya tiene un acondicionamiento activo",
                    ) from exc
                raise

            _registrar_evento(
                conn,
                orden,
                accion="acondicionamiento_creado",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Se creó {orden['codigo']} para el cuadro {bici['numero_cuadro']}",
                metadata={"motivo": orden["motivo"]},
            )
        return _detalle(conn, orden["id"])
    finally:
        conn.close()


def listar_acondicionamientos_bicicleta(bicicleta_id: int):
    conn = get_connection()
    try:
        return [_detalle(conn, row["id"]) for row in repository.list_acondicionamientos_bicicleta(conn, bicicleta_id)]
    finally:
        conn.close()


def obtener_acondicionamiento(acondicionamiento_id: int):
    conn = get_connection()
    try:
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def agregar_item(acondicionamiento_id: int, data):
    payload = data.model_dump()
    detalle_retirada = _texto(payload.get("detalle_pieza_retirada"))
    destino_retirada = payload.get("destino_pieza_retirada")
    if payload["tipo_intervencion"] == "reemplazo" and bool(detalle_retirada) != bool(destino_retirada):
        raise HTTPException(
            status_code=400,
            detail="Si se retira una pieza, indicá tanto su descripción como su destino",
        )
    if payload["tipo_intervencion"] != "reemplazo" and (detalle_retirada or destino_retirada):
        raise HTTPException(
            status_code=400,
            detail="Las piezas retiradas solo corresponden a intervenciones de reemplazo",
        )
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se puede editar una orden en borrador")

            variante = repository.get_variante_componente(
                conn, payload["id_variante"], orden["id_sucursal"]
            )
            if variante is None:
                raise HTTPException(status_code=404, detail="No existe el componente")
            if variante["serializable"]:
                raise HTTPException(
                    status_code=400,
                    detail="Una bicicleta serializable no puede usarse como componente",
                )

            cantidad = to_decimal(payload["cantidad"])
            item = repository.insert_item(
                conn,
                acondicionamiento_id,
                {
                    **payload,
                    "producto_nombre": variante["producto_nombre"],
                    "nombre_variante": variante["nombre_variante"],
                    "sku": variante["sku"],
                    "costo_unitario_estimado": variante["costo_promedio_vigente"] or 0,
                    "stock_disponible_snapshot": variante["stock_disponible"] or 0,
                    "detalle_pieza_retirada": detalle_retirada,
                    "destino_pieza_retirada": destino_retirada,
                    "estado_pieza_retirada": (
                        "descartada" if destino_retirada == "descarte"
                        else "en_garantia" if destino_retirada == "garantia"
                        else "pendiente" if destino_retirada
                        else None
                    ),
                    "observaciones": _texto(payload.get("observaciones")),
                },
            )
            _registrar_evento(
                conn,
                orden,
                accion="componente_agregado",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Se agregó {cantidad:g} x {variante['producto_nombre']}",
                metadata={
                    "id_item": item["id"],
                    "id_variante": variante["id"],
                    "tipo_intervencion": payload["tipo_intervencion"],
                    "cantidad": str(cantidad),
                    "destino_pieza_retirada": destino_retirada,
                },
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def quitar_item(acondicionamiento_id: int, item_id: int, *, id_usuario: int | None):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se puede editar una orden en borrador")
            item = repository.delete_item(conn, acondicionamiento_id, item_id)
            if item is None:
                raise HTTPException(status_code=404, detail="No existe el componente en la orden")
            _registrar_evento(
                conn,
                orden,
                accion="componente_quitado",
                id_usuario=id_usuario,
                detalle=f"Se quitó {item['producto_nombre_snapshot']}",
                metadata={"id_item": item_id},
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def resolver_pieza_retirada(acondicionamiento_id: int, item_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "aplicado":
                raise HTTPException(
                    status_code=400,
                    detail="La pieza retirada se resuelve después de aplicar el trabajo",
                )
            item = next(
                (row for row in repository.list_items_for_update(conn, acondicionamiento_id) if row["id"] == item_id),
                None,
            )
            if item is None or not item["destino_pieza_retirada"]:
                raise HTTPException(status_code=404, detail="No existe una pieza retirada para ese componente")

            permitidos = {
                "descarte": {"descartada"},
                "garantia": {"en_garantia", "compensada"},
                "recuperable": {"pendiente", "recuperada", "descartada"},
            }
            if payload["estado"] not in permitidos[item["destino_pieza_retirada"]]:
                raise HTTPException(
                    status_code=400,
                    detail="La resolución no corresponde al destino elegido para la pieza",
                )
            resolucion = _texto(payload.get("resolucion"))
            if payload["estado"] in {"compensada", "recuperada", "descartada"} and not resolucion:
                raise HTTPException(status_code=400, detail="Explicá cómo se resolvió la pieza retirada")

            actualizada = repository.update_pieza_retirada(
                conn,
                acondicionamiento_id,
                item_id,
                {
                    "estado": payload["estado"],
                    "resolucion": resolucion,
                    "id_usuario": payload.get("id_usuario"),
                },
            )
            _registrar_evento(
                conn,
                orden,
                accion="pieza_retirada_resuelta",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Pieza retirada: {actualizada['detalle_pieza_retirada']} quedó {payload['estado']}",
                metadata={
                    "id_item": item_id,
                    "destino": actualizada["destino_pieza_retirada"],
                    "estado": payload["estado"],
                    "resolucion": resolucion,
                },
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def agregar_costo(acondicionamiento_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se puede editar una orden en borrador")
            costo = repository.insert_costo(
                conn,
                acondicionamiento_id,
                {
                    **payload,
                    "descripcion": payload["descripcion"].strip(),
                    "observaciones": _texto(payload.get("observaciones")),
                },
            )
            _registrar_evento(
                conn,
                orden,
                accion="costo_agregado",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Se agregó el costo {costo['descripcion']}",
                metadata={"id_costo": costo["id"], "tipo": costo["tipo"]},
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def quitar_costo(acondicionamiento_id: int, costo_id: int, *, id_usuario: int | None):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se puede editar una orden en borrador")
            costo = repository.delete_costo(conn, acondicionamiento_id, costo_id)
            if costo is None:
                raise HTTPException(status_code=404, detail="No existe el costo en la orden")
            _registrar_evento(
                conn,
                orden,
                accion="costo_quitado",
                id_usuario=id_usuario,
                detalle=f"Se quitó el costo {costo['descripcion']}",
                metadata={"id_costo": costo_id},
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def agregar_recupero(acondicionamiento_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se puede editar una orden en borrador")
            recupero = repository.insert_recupero(
                conn,
                acondicionamiento_id,
                {
                    **payload,
                    "descripcion": payload["descripcion"].strip(),
                    "referencia": _texto(payload.get("referencia")),
                    "observaciones": _texto(payload.get("observaciones")),
                },
            )
            _registrar_evento(
                conn,
                orden,
                accion="recupero_agregado",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Se agregó el recupero {recupero['descripcion']}",
                metadata={
                    "id_recupero": recupero["id"],
                    "tipo": recupero["tipo"],
                    "monto": str(recupero["monto"]),
                },
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def quitar_recupero(acondicionamiento_id: int, recupero_id: int, *, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se puede editar una orden en borrador")
            recupero = repository.delete_recupero(conn, acondicionamiento_id, recupero_id)
            if recupero is None:
                raise HTTPException(status_code=404, detail="No existe el recupero en la orden")
            _registrar_evento(
                conn,
                orden,
                accion="recupero_quitado",
                id_usuario=id_usuario,
                detalle=f"Se quitó el recupero {recupero['descripcion']}",
                metadata={"id_recupero": recupero_id},
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def confirmar_acondicionamiento(acondicionamiento_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "borrador":
                raise HTTPException(status_code=400, detail="Solo se puede confirmar una orden en borrador")
            detalle = _detalle(conn, acondicionamiento_id)
            if not detalle["items"] and not detalle["costos"]:
                raise HTTPException(status_code=400, detail="Agregá componentes o costos antes de confirmar")
            if detalle["advertencias"]:
                raise HTTPException(
                    status_code=400,
                    detail="No hay stock suficiente para confirmar todos los componentes",
                )

            repository.update_estado(
                conn,
                acondicionamiento_id,
                {"estado": "confirmado", "id_usuario": payload.get("id_usuario"), "motivo": None},
            )
            repository.update_bicicleta_estado_tecnico(
                conn,
                orden["id_bicicleta_serializada"],
                "en_acondicionamiento",
                payload.get("id_usuario"),
            )
            _registrar_evento(
                conn,
                orden,
                accion="acondicionamiento_confirmado",
                id_usuario=payload.get("id_usuario"),
                detalle="Plan de acondicionamiento confirmado sin consumir stock",
                metadata={"total_estimado": str(detalle["total_estimado"])},
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def aplicar_acondicionamiento(acondicionamiento_id: int, data):
    payload = data.model_dump()
    usuario_id = payload.get("id_usuario")
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] != "confirmado":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede aplicar una orden confirmada",
                )
            bici = repository.get_bicicleta_for_update(
                conn, orden["id_bicicleta_serializada"]
            )
            if bici["estado"] != "disponible":
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta debe seguir disponible para aplicar el acondicionamiento",
                )
            if bici["estado_tecnico"] != "en_acondicionamiento":
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta no está marcada como en acondicionamiento",
                )

            items = [dict(row) for row in repository.list_items_for_update(conn, acondicionamiento_id)]
            costos = [dict(row) for row in repository.list_costos(conn, acondicionamiento_id)]
            recuperos = [dict(row) for row in repository.list_recuperos(conn, acondicionamiento_id)]
            if not items and not costos:
                raise HTTPException(status_code=400, detail="La orden no tiene trabajos para aplicar")

            total_componentes = Decimal("0")
            consumos = []
            for item in items:
                if item["id_movimiento_consumo"] is not None:
                    raise HTTPException(status_code=400, detail="La orden ya tiene componentes consumidos")
                variante = repository.get_variante_componente(
                    conn, item["id_variante"], orden["id_sucursal"]
                )
                if variante is None:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Uno de los componentes ya no está activo o no pertenece "
                            "a la sucursal. Revisá el plan antes de aplicarlo."
                        ),
                    )
                costo_real = to_decimal(variante["costo_promedio_vigente"] or 0)
                if costo_real <= 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{variante['producto_nombre']} no tiene costo real cargado",
                    )
                cantidad = to_decimal(item["cantidad"])
                subtotal = redondear_monto(cantidad * costo_real)
                try:
                    movimiento = stock_repository.registrar_salida_acondicionamiento(
                        conn,
                        id_sucursal=orden["id_sucursal"],
                        id_variante=item["id_variante"],
                        cantidad=cantidad,
                        id_usuario=usuario_id,
                        origen_id=orden["id"],
                        id_bicicleta_serializada=orden["id_bicicleta_serializada"],
                        costo_unitario_aplicado=costo_real,
                        nota=f"Consumo {orden['codigo']} item #{item['id']}",
                    )
                except ValueError as exc:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cambió la disponibilidad de {variante['producto_nombre']}",
                    ) from exc
                repository.update_item_consumido(
                    conn,
                    item["id"],
                    cantidad=cantidad,
                    costo_unitario_real=costo_real,
                    subtotal_real=subtotal,
                    movimiento_id=movimiento["movimiento_id"],
                )
                total_componentes += subtotal
                consumos.append(
                    {
                        "id_item": item["id"],
                        "id_variante": item["id_variante"],
                        "cantidad": str(cantidad),
                        "costo_unitario_real": str(costo_real),
                        "id_movimiento": movimiento["movimiento_id"],
                    }
                )

            total_adicional = redondear_monto(
                sum(
                    (
                        to_decimal(row["cantidad"]) * to_decimal(row["costo_unitario"])
                        for row in costos
                    ),
                    Decimal("0"),
                )
            )
            total_recuperos = redondear_monto(
                sum((to_decimal(row["monto"]) for row in recuperos), Decimal("0"))
            )
            total_componentes = redondear_monto(total_componentes)
            neto = redondear_monto(total_componentes + total_adicional - total_recuperos)
            if neto < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Los recuperos superan el costo total del acondicionamiento",
                )

            costo_anterior = redondear_monto(bici["costo_total_unitario"] or 0)
            acond_anterior = redondear_monto(bici["costo_acondicionamiento"] or 0)
            acond_nuevo = redondear_monto(acond_anterior + neto)
            costo_nuevo = redondear_monto(to_decimal(bici["costo_base_unitario"] or 0) + acond_nuevo)
            actualizar_precio = bool(payload.get("actualizar_precio_venta"))
            precio_personalizado_anterior = bici.get("precio_venta_personalizado")
            precio_personalizado_nuevo = None
            if actualizar_precio:
                if payload.get("precio_venta_nuevo") is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Indicá el nuevo precio de venta de esta bicicleta",
                    )
                precio_personalizado_nuevo = redondear_monto(
                    payload["precio_venta_nuevo"]
                )
                if precio_personalizado_nuevo < costo_nuevo:
                    raise HTTPException(
                        status_code=400,
                        detail="El precio de venta de la unidad no puede quedar debajo de su costo total",
                    )
            repository.aplicar_costos_reales(conn, acondicionamiento_id)
            repository.aplicar_orden(
                conn,
                acondicionamiento_id,
                {
                    "id_usuario": usuario_id,
                    "costo_componentes_real": total_componentes,
                    "costo_adicional_real": total_adicional,
                    "recuperos_total": total_recuperos,
                    "costo_acondicionamiento_aplicado": neto,
                    "costo_total_unidad_anterior": costo_anterior,
                    "costo_total_unidad_nuevo": costo_nuevo,
                    "precio_venta_actualizado": actualizar_precio,
                    "precio_venta_personalizado_anterior": precio_personalizado_anterior,
                    "precio_venta_personalizado_nuevo": precio_personalizado_nuevo,
                },
            )
            repository.update_bicicleta_costos_y_estado(
                conn,
                orden["id_bicicleta_serializada"],
                costo_acondicionamiento=acond_nuevo,
                costo_total_unitario=costo_nuevo,
                estado_tecnico="lista",
                usuario_id=usuario_id,
            )
            if actualizar_precio:
                repository.update_bicicleta_precio_personalizado(
                    conn,
                    orden["id_bicicleta_serializada"],
                    precio=precio_personalizado_nuevo,
                    motivo=f"Actualizado al aplicar {orden['codigo']}",
                    usuario_id=usuario_id,
                )
            _registrar_evento(
                conn,
                orden,
                accion="acondicionamiento_aplicado",
                id_usuario=usuario_id,
                detalle=f"Trabajo aplicado por {neto} y unidad habilitada",
                metadata={
                    "consumos": consumos,
                    "costo_anterior": str(costo_anterior),
                    "costo_nuevo": str(costo_nuevo),
                    "recuperos": str(total_recuperos),
                    "precio_venta_anterior": str(
                        precio_personalizado_anterior
                        if precio_personalizado_anterior is not None
                        else bici["precio_variante"] or 0
                    ),
                    "precio_venta_nuevo": (
                        str(precio_personalizado_nuevo)
                        if precio_personalizado_nuevo is not None
                        else None
                    ),
                },
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()


def revertir_acondicionamiento(acondicionamiento_id: int, data):
    payload = data.model_dump()
    motivo = _texto(payload.get("motivo"))
    if not motivo or len(motivo) < 3:
        raise HTTPException(status_code=400, detail="Indicá el motivo de la reversión")
    conn = get_connection()
    try:
        with conn.transaction():
            orden = repository.get_acondicionamiento(conn, acondicionamiento_id, for_update=True)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe el acondicionamiento")
            if orden["estado"] not in {"borrador", "confirmado", "aplicado"}:
                raise HTTPException(status_code=400, detail="La orden ya está revertida")
            bici = repository.get_bicicleta_for_update(conn, orden["id_bicicleta_serializada"])
            reversiones = []
            if orden["estado"] == "aplicado":
                if bici["estado"] != "disponible":
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede revertir: la bicicleta ya no está disponible",
                    )
                if repository.existe_orden_posterior_no_revertida(conn, orden):
                    raise HTTPException(
                        status_code=400,
                        detail="Revertí primero el acondicionamiento posterior de esta bicicleta",
                    )
                items = [dict(row) for row in repository.list_items_for_update(conn, acondicionamiento_id)]
                for item in items:
                    if item["id_movimiento_consumo"] is None or item["estado"] != "consumido":
                        raise HTTPException(
                            status_code=400,
                            detail="La orden aplicada tiene un componente sin consumo trazable",
                        )
                    if item["id_movimiento_reversion"] is not None:
                        raise HTTPException(status_code=400, detail="El consumo ya fue revertido")
                    movimiento = stock_repository.registrar_reversion_salida_acondicionamiento(
                        conn,
                        id_sucursal=orden["id_sucursal"],
                        id_variante=item["id_variante"],
                        cantidad=to_decimal(item["cantidad_consumida"]),
                        id_usuario=payload.get("id_usuario"),
                        origen_id=orden["id"],
                        id_bicicleta_serializada=orden["id_bicicleta_serializada"],
                        costo_unitario_aplicado=to_decimal(item["costo_unitario_real"]),
                        nota=f"Reversión {orden['codigo']} item #{item['id']}",
                    )
                    repository.update_item_revertido(
                        conn,
                        item["id"],
                        movimiento_id=movimiento["movimiento_id"],
                    )
                    reversiones.append(
                        {
                            "id_item": item["id"],
                            "id_movimiento": movimiento["movimiento_id"],
                        }
                    )

                costo_anterior = redondear_monto(orden["costo_total_unidad_anterior"] or 0)
                acond_anterior = redondear_monto(
                    costo_anterior - to_decimal(bici["costo_base_unitario"] or 0)
                )
                repository.update_bicicleta_costos_y_estado(
                    conn,
                    orden["id_bicicleta_serializada"],
                    costo_acondicionamiento=max(acond_anterior, Decimal("0")),
                    costo_total_unitario=costo_anterior,
                    estado_tecnico=orden["estado_tecnico_anterior"],
                    usuario_id=payload.get("id_usuario"),
                )
                if orden.get("precio_venta_actualizado"):
                    repository.update_bicicleta_precio_personalizado(
                        conn,
                        orden["id_bicicleta_serializada"],
                        precio=orden.get("precio_venta_personalizado_anterior"),
                        motivo=f"Reversión de {orden['codigo']}",
                        usuario_id=payload.get("id_usuario"),
                    )
            repository.update_estado(
                conn,
                acondicionamiento_id,
                {"estado": "revertido", "id_usuario": payload.get("id_usuario"), "motivo": motivo},
            )
            if orden["estado"] == "confirmado":
                repository.update_bicicleta_estado_tecnico(
                    conn,
                    orden["id_bicicleta_serializada"],
                    orden["estado_tecnico_anterior"],
                    payload.get("id_usuario"),
                )
            _registrar_evento(
                conn,
                orden,
                accion="acondicionamiento_revertido",
                id_usuario=payload.get("id_usuario"),
                detalle=f"Acondicionamiento revertido: {motivo}",
                metadata={
                    "estado_anterior": orden["estado"],
                    "reversiones": reversiones,
                },
            )
        return _detalle(conn, acondicionamiento_id)
    finally:
        conn.close()
