from decimal import Decimal

from fastapi import HTTPException

from app.core.text_normalization import clean_text, normalize_text_upper
from app.db.connection import get_connection
from app.modules.auditoria.service import registrar_evento

from .repository import (
    existe_oferta_superpuesta,
    get_oferta_by_id,
    get_variante_para_oferta,
    insert_oferta,
    listar_ofertas as listar_ofertas_repo,
    update_oferta,
    update_oferta_estado,
)


def _validar_precio_oferta(precio_oferta, precio_regular):
    precio_oferta = Decimal(str(precio_oferta))
    precio_regular = Decimal(str(precio_regular))
    if precio_regular <= 0:
        raise HTTPException(
            status_code=400,
            detail="La variante no tiene precio minorista configurado",
        )
    if precio_oferta >= precio_regular:
        raise HTTPException(
            status_code=400,
            detail="El precio de oferta debe ser menor al precio minorista vigente",
        )
    return precio_oferta


def _validar_superposicion(conn, *, id_variante, fecha_desde, fecha_hasta, excluir_id=None):
    if existe_oferta_superpuesta(
        conn,
        id_variante=id_variante,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        excluir_id=excluir_id,
    ):
        raise HTTPException(
            status_code=400,
            detail="Ya existe una oferta activa para esta variante en ese período",
        )


def listar_ofertas(*, incluir_inactivas: bool = True, id_variante: int | None = None):
    conn = get_connection()
    try:
        return listar_ofertas_repo(
            conn,
            incluir_inactivas=incluir_inactivas,
            id_variante=id_variante,
        )
    finally:
        conn.close()


def crear_oferta(data):
    conn = get_connection()
    try:
        with conn.transaction():
            variante = get_variante_para_oferta(conn, data.id_variante, for_update=True)
            if variante is None:
                raise HTTPException(status_code=404, detail="No existe la variante")
            if not variante["activo"] or not variante["producto_activo"]:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede ofrecer un producto o variante inactiva",
                )

            precio_regular = Decimal(str(variante["precio_minorista"] or 0))
            precio_oferta = _validar_precio_oferta(data.precio_oferta, precio_regular)
            _validar_superposicion(
                conn,
                id_variante=data.id_variante,
                fecha_desde=data.fecha_desde,
                fecha_hasta=data.fecha_hasta,
            )

            oferta_id = insert_oferta(
                conn,
                {
                    "id_variante": data.id_variante,
                    "nombre": normalize_text_upper(data.nombre),
                    "precio_regular_referencia": precio_regular,
                    "precio_oferta": precio_oferta,
                    "fecha_desde": data.fecha_desde,
                    "fecha_hasta": data.fecha_hasta,
                    "motivo": clean_text(data.motivo),
                    "id_usuario": data.id_usuario,
                },
            )
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="oferta",
                entidad_id=oferta_id,
                accion="oferta_creada",
                detalle=f"Oferta creada para variante #{data.id_variante}",
                metadata={
                    "precio_regular": str(precio_regular),
                    "precio_oferta": str(precio_oferta),
                },
            )
            return get_oferta_by_id(conn, oferta_id)
    finally:
        conn.close()


def editar_oferta(oferta_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            oferta = get_oferta_by_id(conn, oferta_id, for_update=True)
            if oferta is None:
                raise HTTPException(status_code=404, detail="No existe la oferta")

            precio_oferta = _validar_precio_oferta(
                data.precio_oferta,
                oferta["precio_regular_referencia"],
            )
            if oferta["activa"]:
                _validar_superposicion(
                    conn,
                    id_variante=oferta["id_variante"],
                    fecha_desde=data.fecha_desde,
                    fecha_hasta=data.fecha_hasta,
                    excluir_id=oferta_id,
                )

            update_oferta(
                conn,
                oferta_id,
                {
                    "nombre": normalize_text_upper(data.nombre),
                    "precio_oferta": precio_oferta,
                    "fecha_desde": data.fecha_desde,
                    "fecha_hasta": data.fecha_hasta,
                    "motivo": clean_text(data.motivo),
                    "id_usuario": data.id_usuario,
                },
            )
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="oferta",
                entidad_id=oferta_id,
                accion="oferta_editada",
                detalle="Oferta actualizada",
            )
            return get_oferta_by_id(conn, oferta_id)
    finally:
        conn.close()


def cambiar_estado_oferta(oferta_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            oferta = get_oferta_by_id(conn, oferta_id, for_update=True)
            if oferta is None:
                raise HTTPException(status_code=404, detail="No existe la oferta")

            if data.activa:
                _validar_superposicion(
                    conn,
                    id_variante=oferta["id_variante"],
                    fecha_desde=oferta["fecha_desde"],
                    fecha_hasta=oferta["fecha_hasta"],
                    excluir_id=oferta_id,
                )

            update_oferta_estado(
                conn,
                oferta_id,
                activa=data.activa,
                id_usuario=data.id_usuario,
            )
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="oferta",
                entidad_id=oferta_id,
                accion="oferta_activada" if data.activa else "oferta_desactivada",
                detalle="Estado de oferta actualizado",
            )
            return get_oferta_by_id(conn, oferta_id)
    finally:
        conn.close()
