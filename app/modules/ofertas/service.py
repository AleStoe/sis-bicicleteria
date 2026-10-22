from decimal import Decimal

from fastapi import HTTPException

from app.core.text_normalization import clean_text, normalize_text_upper
from app.db.connection import get_connection
from app.modules.auditoria.service import registrar_evento

from .repository import (
    existe_oferta_unidad_superpuesta,
    existe_oferta_superpuesta,
    get_bicicletas_para_oferta,
    get_oferta_by_id,
    get_variante_para_oferta,
    desactivar_ofertas_vencidas,
    insert_oferta,
    listar_ofertas as listar_ofertas_repo,
    reemplazar_unidades_oferta,
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


def _validar_unidades(
    conn,
    *,
    alcance: str,
    id_variante: int,
    ids_bicicletas: list[int],
    fecha_desde,
    fecha_hasta,
    excluir_id: int | None = None,
):
    if alcance == "variante":
        _validar_superposicion(
            conn,
            id_variante=id_variante,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            excluir_id=excluir_id,
        )
        return []

    ids_unicos = list(dict.fromkeys(ids_bicicletas))
    bicicletas = get_bicicletas_para_oferta(conn, ids_unicos, for_update=True)
    if len(bicicletas) != len(ids_unicos):
        raise HTTPException(status_code=400, detail="Uno de los números de cuadro no existe")

    for bicicleta in bicicletas:
        if bicicleta["id_variante"] != id_variante:
            raise HTTPException(
                status_code=400,
                detail=f"El cuadro {bicicleta['numero_cuadro']} pertenece a otra variante",
            )
        if bicicleta["estado"] != "disponible" or bicicleta["estado_tecnico"] != "lista":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El cuadro {bicicleta['numero_cuadro']} no está disponible y listo "
                    "para incluirlo en una oferta"
                ),
            )

    superpuesta = existe_oferta_unidad_superpuesta(
        conn,
        ids_bicicletas=ids_unicos,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        excluir_id=excluir_id,
    )
    if superpuesta:
        raise HTTPException(
            status_code=400,
            detail=(
                f"El cuadro {superpuesta['numero_cuadro']} ya está incluido en "
                f"la oferta {superpuesta['nombre']} durante ese período"
            ),
        )
    return ids_unicos


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
            ids_unidades = _validar_unidades(
                conn,
                alcance=data.alcance,
                id_variante=data.id_variante,
                ids_bicicletas=data.ids_bicicletas_serializadas,
                fecha_desde=data.fecha_desde,
                fecha_hasta=data.fecha_hasta,
            )

            oferta_id = insert_oferta(
                conn,
                {
                    "id_variante": data.id_variante,
                    "alcance": data.alcance,
                    "politica_contado": data.politica_contado,
                    "nombre": normalize_text_upper(data.nombre),
                    "precio_regular_referencia": precio_regular,
                    "precio_oferta": precio_oferta,
                    "fecha_desde": data.fecha_desde,
                    "fecha_hasta": data.fecha_hasta,
                    "motivo": clean_text(data.motivo),
                    "id_usuario": data.id_usuario,
                },
            )
            reemplazar_unidades_oferta(conn, oferta_id, ids_unidades)
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="oferta",
                entidad_id=oferta_id,
                accion="oferta_creada",
                detalle=(
                    f"Oferta creada para variante #{data.id_variante} "
                    f"con alcance {data.alcance}"
                ),
                metadata={
                    "precio_regular": str(precio_regular),
                    "precio_oferta": str(precio_oferta),
                    "alcance": data.alcance,
                    "politica_contado": data.politica_contado,
                    "ids_bicicletas_serializadas": ids_unidades,
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
            ids_unidades = []
            if oferta["activa"]:
                ids_unidades = _validar_unidades(
                    conn,
                    alcance=data.alcance,
                    id_variante=oferta["id_variante"],
                    ids_bicicletas=data.ids_bicicletas_serializadas,
                    fecha_desde=data.fecha_desde,
                    fecha_hasta=data.fecha_hasta,
                    excluir_id=oferta_id,
                )
            elif data.alcance == "unidades":
                ids_unidades = list(dict.fromkeys(data.ids_bicicletas_serializadas))

            update_oferta(
                conn,
                oferta_id,
                {
                    "alcance": data.alcance,
                    "politica_contado": data.politica_contado,
                    "nombre": normalize_text_upper(data.nombre),
                    "precio_oferta": precio_oferta,
                    "fecha_desde": data.fecha_desde,
                    "fecha_hasta": data.fecha_hasta,
                    "motivo": clean_text(data.motivo),
                    "id_usuario": data.id_usuario,
                },
            )
            reemplazar_unidades_oferta(conn, oferta_id, ids_unidades)
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
                ids_unidades = [unidad["id"] for unidad in oferta["unidades"]]
                _validar_unidades(
                    conn,
                    alcance=oferta["alcance"],
                    id_variante=oferta["id_variante"],
                    ids_bicicletas=ids_unidades,
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


def cerrar_ofertas_vencidas(data):
    conn = get_connection()
    try:
        with conn.transaction():
            ids_ofertas = desactivar_ofertas_vencidas(
                conn,
                id_usuario=data.id_usuario,
            )
            for oferta_id in ids_ofertas:
                registrar_evento(
                    conn,
                    id_usuario=data.id_usuario,
                    id_sucursal=None,
                    entidad="oferta",
                    entidad_id=oferta_id,
                    accion="oferta_desactivada_por_vencimiento",
                    detalle="Oferta vencida cerrada desde la acción masiva",
                )
            return {
                "ok": True,
                "cantidad": len(ids_ofertas),
                "ids_ofertas": ids_ofertas,
            }
    finally:
        conn.close()
