from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.text_normalization import clean_text
from app.db.connection import get_connection

from .crm_repository import (
    close_seguimiento_crm,
    get_eventos_seguimiento_crm,
    get_responsables_crm,
    get_resumen_agenda_crm,
    get_seguimiento_crm_by_id,
    get_seguimientos_crm,
    get_usuario_activo_crm,
    insert_evento_seguimiento_crm,
    insert_seguimiento_crm,
    get_oportunidades_crm,
    get_contexto_comunicaciones_clientes,
    get_comunicaciones_cliente,
    get_resumen_comunicaciones,
    create_comunicacion_cliente,
    upsert_preferencia_contacto,
    referencia_seguimiento_pertenece_cliente,
    update_seguimiento_crm,
)
from .repository import get_cliente_by_id
from .crm_messages import borrador_apertura_conversacion


def _hoy_argentina():
    return datetime.now(timezone(timedelta(hours=-3))).date()


def _cliente_o_404(conn, cliente_id):
    cliente = get_cliente_by_id(conn, cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail=f"No existe el cliente {cliente_id}")
    if cliente_id == 1:
        raise HTTPException(status_code=400, detail="Consumidor final no admite seguimientos CRM")
    return cliente


def _usuario_activo_o_400(conn, usuario_id, campo):
    if not usuario_id or not get_usuario_activo_crm(conn, usuario_id):
        raise HTTPException(status_code=400, detail=f"{campo} debe ser un usuario activo")


def _seguimiento_o_404(conn, seguimiento_id, cliente_id=None, for_update=False):
    seguimiento = get_seguimiento_crm_by_id(
        conn,
        seguimiento_id,
        id_cliente=cliente_id,
        for_update=for_update,
    )
    if seguimiento is None:
        raise HTTPException(status_code=404, detail="No existe el seguimiento solicitado")
    return seguimiento


def listar_responsables_crm_service():
    conn = get_connection()
    try:
        return get_responsables_crm(conn)
    finally:
        conn.close()


def listar_seguimientos_crm_service(
    *,
    bandeja="pendientes",
    id_cliente=None,
    id_usuario_responsable=None,
    q=None,
    limit=50,
    offset=0,
):
    conn = get_connection()
    try:
        hoy = _hoy_argentina()
        filas = get_seguimientos_crm(
            conn,
            hoy=hoy,
            bandeja=bandeja,
            id_cliente=id_cliente,
            id_usuario_responsable=id_usuario_responsable,
            q=q,
            limit=limit,
            offset=offset,
        )
        total = filas[0]["total_resultados"] if filas else 0
        for fila in filas:
            fila.pop("total_resultados", None)
            fila["vencido"] = fila["estado"] == "pendiente" and fila["fecha_objetivo"] < hoy
            fila["es_hoy"] = fila["estado"] == "pendiente" and fila["fecha_objetivo"] == hoy
        return {
            "hoy": hoy,
            "bandeja": bandeja,
            "total": total,
            "limit": limit,
            "offset": offset,
            "resumen": get_resumen_agenda_crm(
                conn,
                hoy=hoy,
                id_usuario_responsable=id_usuario_responsable,
            ),
            "items": filas,
        }
    finally:
        conn.close()


def crear_seguimiento_crm_service(cliente_id, data, *, actor_id):
    conn = get_connection()
    try:
        _cliente_o_404(conn, cliente_id)
        _usuario_activo_o_400(conn, actor_id, "El usuario creador")
        _usuario_activo_o_400(conn, data.id_usuario_responsable, "El responsable")
        for campo in (
            "id_venta",
            "id_deuda",
            "id_reserva",
            "id_orden_taller",
            "id_bicicleta_cliente",
            "id_cotizacion",
            "id_caso_postventa",
        ):
            referencia_id = getattr(data, campo)
            if referencia_id and not referencia_seguimiento_pertenece_cliente(
                conn,
                campo=campo,
                referencia_id=referencia_id,
                cliente_id=cliente_id,
            ):
                raise HTTPException(
                    status_code=400,
                    detail="La referencia seleccionada no pertenece al cliente",
                )
        data.motivo = clean_text(data.motivo)
        seguimiento_id = insert_seguimiento_crm(
            conn,
            cliente_id=cliente_id,
            data=data,
            actor_id=actor_id,
        )
        nuevo = {
            "fecha_objetivo": data.fecha_objetivo,
            "estado": "pendiente",
            "id_usuario_responsable": data.id_usuario_responsable,
            "prioridad": data.prioridad,
        }
        insert_evento_seguimiento_crm(
            conn,
            seguimiento_id=seguimiento_id,
            tipo_evento="creado",
            actor_id=actor_id,
            detalle=data.motivo,
            nuevo=nuevo,
        )
        conn.commit()
        return get_seguimiento_crm_by_id(conn, seguimiento_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def reprogramar_seguimiento_crm_service(cliente_id, seguimiento_id, data, *, actor_id):
    conn = get_connection()
    try:
        _usuario_activo_o_400(conn, actor_id, "El usuario que reprograma")
        _usuario_activo_o_400(conn, data.id_usuario_responsable, "El responsable")
        actual = _seguimiento_o_404(conn, seguimiento_id, cliente_id, for_update=True)
        if actual["estado"] != "pendiente":
            raise HTTPException(status_code=409, detail="Solo se puede reprogramar un seguimiento pendiente")
        update_seguimiento_crm(conn, seguimiento_id, data=data)
        nuevo = {
            "fecha_objetivo": data.fecha_objetivo,
            "estado": actual["estado"],
            "id_usuario_responsable": data.id_usuario_responsable,
            "prioridad": data.prioridad,
        }
        insert_evento_seguimiento_crm(
            conn,
            seguimiento_id=seguimiento_id,
            tipo_evento="reprogramado",
            actor_id=actor_id,
            detalle=clean_text(data.nota),
            anterior=actual,
            nuevo=nuevo,
        )
        conn.commit()
        return get_seguimiento_crm_by_id(conn, seguimiento_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def cerrar_seguimiento_crm_service(cliente_id, seguimiento_id, data, *, actor_id):
    conn = get_connection()
    try:
        _usuario_activo_o_400(conn, actor_id, "El usuario que cierra")
        actual = _seguimiento_o_404(conn, seguimiento_id, cliente_id, for_update=True)
        if actual["estado"] != "pendiente":
            raise HTTPException(status_code=409, detail="El seguimiento ya fue cerrado")
        data.resultado = clean_text(data.resultado)
        close_seguimiento_crm(conn, seguimiento_id, data=data, actor_id=actor_id)
        nuevo = dict(actual)
        nuevo["estado"] = data.estado
        insert_evento_seguimiento_crm(
            conn,
            seguimiento_id=seguimiento_id,
            tipo_evento="realizado" if data.estado == "realizada" else "cancelado",
            actor_id=actor_id,
            detalle=data.resultado,
            anterior=actual,
            nuevo=nuevo,
        )
        conn.commit()
        return get_seguimiento_crm_by_id(conn, seguimiento_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def listar_eventos_seguimiento_crm_service(cliente_id, seguimiento_id):
    conn = get_connection()
    try:
        _seguimiento_o_404(conn, seguimiento_id, cliente_id)
        return get_eventos_seguimiento_crm(conn, seguimiento_id)
    finally:
        conn.close()


def listar_oportunidades_crm_service(
    *,
    id_cliente=None,
    tipo=None,
    q=None,
    limit=50,
    offset=0,
):
    conn = get_connection()
    try:
        if id_cliente:
            _cliente_o_404(conn, id_cliente)
        filas = get_oportunidades_crm(
            conn,
            hoy=_hoy_argentina(),
            id_cliente=id_cliente,
            tipo=tipo,
            q=q,
            limit=5000,
            offset=0,
        )
        for fila in filas:
            fila.pop("total_resultados", None)
            motivo = f"{fila['titulo']}. {fila['evidencia']}"
            fila["motivo_sugerido"] = motivo[:500]
            fila["referencias"] = {
                campo: fila.get(campo)
                for campo in (
                    "id_bicicleta_cliente",
                    "id_reserva",
                    "id_cotizacion",
                    "id_caso_postventa",
                )
                if fila.get(campo)
            }
        resumen = {
            clave: sum(1 for fila in filas if fila["tipo_oportunidad"] == clave)
            for clave in ("service", "cotizacion", "reserva", "postventa")
        }
        return {
            "hoy": _hoy_argentina(),
            "total": len(filas),
            "limit": limit,
            "offset": offset,
            "resumen": resumen,
            "items": filas[offset:offset + limit],
        }
    finally:
        conn.close()


def listar_candidatos_comunicacion_crm_service(
    *,
    q=None,
    vista="inactivos",
    tipo_cliente=None,
    orden="inactividad",
    limit=20,
    offset=0,
):
    from .service import listar_clientes_crm_service

    panel = listar_clientes_crm_service(
        q=q,
        vista=vista,
        tipo_cliente=tipo_cliente,
        orden=orden,
        solo_activos=True,
        limit=limit,
        offset=offset,
        puede_ver_rentabilidad=False,
    )
    cliente_ids = [item["id"] for item in panel["items"]]
    conn = get_connection()
    try:
        contextos = get_contexto_comunicaciones_clientes(conn, cliente_ids)
        resumen = get_resumen_comunicaciones(
            conn,
            fecha_desde=_hoy_argentina() - timedelta(days=29),
        )
    finally:
        conn.close()

    for item in panel["items"]:
        contexto = contextos.get(item["id"], {})
        item["preferencia_contacto"] = {
            "estado": contexto.get("preferencia_estado") or "habilitado",
            "canal_preferido": contexto.get("canal_preferido"),
            "motivo_exclusion": contexto.get("motivo_exclusion"),
        }
        item["ultima_comunicacion"] = (
            {
                "id": contexto.get("ultima_comunicacion_id"),
                "canal": contexto.get("ultimo_canal"),
                "resultado": contexto.get("ultimo_resultado"),
                "fecha_contacto": contexto.get("ultima_fecha_contacto"),
            }
            if contexto.get("ultima_comunicacion_id")
            else None
        )
        item["puede_contactar"] = bool(
            item.get("telefono")
            and item["preferencia_contacto"]["estado"] != "no_contactar"
        )
        item["borrador_mensaje"] = (
            _borrador_comunicacion_crm(item) if item["puede_contactar"] else None
        )

    contactos = int(resumen["contactos"] or 0)
    respuestas = int(resumen["respuestas"] or 0)
    resumen["tasa_respuesta"] = round((respuestas / contactos * 100), 1) if contactos else None
    return {**panel, "resumen_comunicaciones": resumen, "dias_medicion": 30}


def listar_comunicaciones_cliente_service(cliente_id, *, limit=50, offset=0):
    conn = get_connection()
    try:
        _cliente_o_404(conn, cliente_id)
        filas = get_comunicaciones_cliente(conn, cliente_id, limit=limit, offset=offset)
        total = filas[0]["total_resultados"] if filas else 0
        for fila in filas:
            fila.pop("total_resultados", None)
        preferencias = get_contexto_comunicaciones_clientes(conn, [cliente_id]).get(cliente_id, {})
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "preferencia_contacto": {
                "estado": preferencias.get("preferencia_estado") or "habilitado",
                "canal_preferido": preferencias.get("canal_preferido"),
                "motivo_exclusion": preferencias.get("motivo_exclusion"),
            },
            "items": filas,
        }
    finally:
        conn.close()


def registrar_comunicacion_cliente_service(cliente_id, data, *, actor_id):
    conn = get_connection()
    try:
        _cliente_o_404(conn, cliente_id)
        _usuario_activo_o_400(conn, actor_id, "El usuario que registra el contacto")
        contexto = get_contexto_comunicaciones_clientes(conn, [cliente_id]).get(cliente_id, {})
        if contexto.get("preferencia_estado") == "no_contactar":
            raise HTTPException(status_code=400, detail="El cliente está marcado como no contactar")
        if data.id_seguimiento:
            seguimiento = _seguimiento_o_404(conn, data.id_seguimiento, cliente_id=cliente_id)
            if seguimiento["id_cliente"] != cliente_id:
                raise HTTPException(status_code=400, detail="El seguimiento no pertenece al cliente")
        creado = create_comunicacion_cliente(
            conn,
            cliente_id=cliente_id,
            data=data,
            actor_id=actor_id,
        )
        conn.commit()
        return creado
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def actualizar_preferencia_contacto_service(cliente_id, data, *, actor_id):
    conn = get_connection()
    try:
        _cliente_o_404(conn, cliente_id)
        _usuario_activo_o_400(conn, actor_id, "El usuario que actualiza la preferencia")
        actualizado = upsert_preferencia_contacto(
            conn,
            cliente_id=cliente_id,
            data=data,
            actor_id=actor_id,
        )
        conn.commit()
        return actualizado
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _borrador_comunicacion_crm(item):
    return borrador_apertura_conversacion(
        nombre=item.get("nombre"),
        tiene_bicicleta=int(item.get("bicicletas_registradas") or 0) > 0,
        retomar_contacto="inactivo" in {
            segmento["clave"] for segmento in item.get("segmentos") or []
        },
    )
