from fastapi import HTTPException

from app.db.connection import get_connection
from app.modules.auditoria.service import registrar_evento
from app.modules.taller.schemas import OrdenTallerCreate
from app.modules.taller.service import _crear_orden_taller_en_conn

from . import repository
from .schema import (
    PostventaCasoCreateInput,
    PostventaCasoUpdateInput,
    PostventaCerrarInput,
    PostventaCrearOrdenTallerInput,
    PostventaEstadoInput,
    PostventaReabrirInput,
    PostventaVincularOrdenInput,
)


ESTADOS_TERMINALES = {"cerrado", "cancelado"}
TRANSICIONES = {
    "abierto": {"en_evaluacion", "esperando_proveedor", "decision_pendiente", "cancelado"},
    "en_evaluacion": {
        "esperando_proveedor",
        "decision_pendiente",
        "rechazado",
        "aprobado_total",
        "aprobado_parcial",
        "resuelto",
        "cancelado",
    },
    "esperando_proveedor": {"decision_pendiente", "rechazado", "cancelado"},
    "decision_pendiente": {"aprobado_total", "aprobado_parcial", "rechazado", "cancelado"},
    "aprobado_total": {"en_resolucion", "resuelto", "esperando_retiro", "cancelado"},
    "aprobado_parcial": {"en_resolucion", "resuelto", "esperando_retiro", "cancelado"},
    "rechazado": {"esperando_retiro", "cerrado", "cancelado"},
    "en_resolucion": {"resuelto", "esperando_retiro", "cancelado"},
    "esperando_retiro": {"cerrado", "cancelado"},
    "resuelto": {"cerrado", "esperando_retiro"},
    "reabierto": {"en_evaluacion", "esperando_proveedor", "decision_pendiente", "cancelado"},
    "cerrado": set(),
    "cancelado": set(),
}


def _actor_id(data) -> int:
    id_usuario = getattr(data, "id_usuario", None)
    if not id_usuario:
        raise HTTPException(status_code=400, detail="id_usuario es obligatorio")
    return int(id_usuario)


def _auditar(conn, *, id_usuario: int, caso_id: int, accion: str, detalle: str, metadata: dict | None = None):
    registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=None,
        entidad="postventa_caso",
        entidad_id=caso_id,
        accion=accion,
        detalle=detalle,
        metadata=metadata or {},
        origen_tipo="postventa_caso",
        origen_id=caso_id,
    )


def _registrar_evento(conn, *, caso_id: int, tipo_evento: str, detalle: str, id_usuario: int, metadata=None):
    repository.insert_evento(
        conn,
        {
            "id_caso_postventa": caso_id,
            "tipo_evento": tipo_evento,
            "detalle": detalle,
            "metadata": metadata,
            "id_usuario": id_usuario,
        },
    )


def _detalle_caso(conn, caso_id: int):
    caso = repository.get_caso_by_id(conn, caso_id)
    if caso is None:
        raise HTTPException(status_code=404, detail="No existe el caso de postventa")
    caso = dict(caso)
    caso["eventos"] = repository.get_eventos_caso(conn, caso_id)
    return caso


def _validar_referencias(conn, data: dict):
    if not repository.exists_by_id(conn, "clientes", data["id_cliente"]):
        raise HTTPException(status_code=404, detail="No existe el cliente")

    if data.get("id_venta_origen") is not None and not repository.exists_by_id(
        conn, "ventas", data["id_venta_origen"]
    ):
        raise HTTPException(status_code=404, detail="No existe la venta origen")

    if data.get("id_venta_item_origen") is not None:
        item = repository.get_venta_item(conn, data["id_venta_item_origen"])
        if item is None:
            raise HTTPException(status_code=404, detail="No existe el item de venta origen")
        if data.get("id_venta_origen") is not None and item["id_venta"] != data["id_venta_origen"]:
            raise HTTPException(
                status_code=400,
                detail="El item de venta origen no pertenece a la venta indicada",
            )

    if data.get("id_bicicleta_cliente") is not None:
        bicicleta = repository.get_bicicleta_cliente(conn, data["id_bicicleta_cliente"])
        if bicicleta is None:
            raise HTTPException(status_code=404, detail="No existe la bicicleta del cliente")
        if bicicleta["id_cliente"] != data["id_cliente"]:
            raise HTTPException(
                status_code=400,
                detail="La bicicleta no pertenece al cliente indicado",
            )

    if data.get("id_bicicleta_serializada") is not None and not repository.exists_by_id(
        conn, "bicicletas_serializadas", data["id_bicicleta_serializada"]
    ):
        raise HTTPException(status_code=404, detail="No existe la bicicleta serializada")

    if data.get("id_variante") is not None and not repository.exists_by_id(
        conn, "variantes", data["id_variante"]
    ):
        raise HTTPException(status_code=404, detail="No existe la variante")

    if data.get("id_proveedor") is not None and not repository.exists_by_id(
        conn, "proveedores", data["id_proveedor"]
    ):
        raise HTTPException(status_code=404, detail="No existe el proveedor")


def _validar_mutable(caso):
    if caso["estado"] in ESTADOS_TERMINALES:
        raise HTTPException(
            status_code=400,
            detail="El caso cerrado o cancelado no admite modificaciones. Reabrilo para continuar.",
        )


def _validar_transicion(actual: str, nuevo: str):
    if actual == nuevo:
        return
    if nuevo not in TRANSICIONES.get(actual, set()):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cambiar el caso de {actual} a {nuevo}",
        )


def listar_casos(filtros: dict):
    limit = filtros.get("limit") or 100
    if limit <= 0 or limit > 500:
        raise HTTPException(status_code=400, detail="El limit debe estar entre 1 y 500")
    conn = get_connection()
    try:
        return repository.listar_casos(conn, filtros)
    finally:
        conn.close()


def obtener_caso(caso_id: int):
    conn = get_connection()
    try:
        return _detalle_caso(conn, caso_id)
    finally:
        conn.close()


def listar_ordenes_taller_vinculadas(caso_id: int):
    conn = get_connection()
    try:
        caso = repository.get_caso_by_id(conn, caso_id)
        if caso is None:
            raise HTTPException(status_code=404, detail="No existe el caso de postventa")
        return repository.listar_ordenes_taller_caso(conn, caso_id)
    finally:
        conn.close()


def crear_caso(data: PostventaCasoCreateInput):
    payload = data.model_dump()
    id_usuario = _actor_id(data)
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_referencias(conn, payload)
            caso_id = repository.insert_caso(conn, payload)
            _registrar_evento(
                conn,
                caso_id=caso_id,
                tipo_evento="caso_creado",
                detalle="Caso de postventa creado",
                id_usuario=id_usuario,
                metadata={"tipo_caso": data.tipo_caso},
            )
            _auditar(
                conn,
                id_usuario=id_usuario,
                caso_id=caso_id,
                accion="postventa_caso_creado",
                detalle="Caso de postventa creado",
                metadata={"tipo_caso": data.tipo_caso},
            )
        return _detalle_caso(conn, caso_id)
    finally:
        conn.close()


def vincular_orden_taller(caso_id: int, data: PostventaVincularOrdenInput):
    id_usuario = _actor_id(data)
    conn = get_connection()
    try:
        with conn.transaction():
            caso = repository.get_caso_by_id(conn, caso_id, for_update=True)
            if caso is None:
                raise HTTPException(status_code=404, detail="No existe el caso de postventa")
            _validar_mutable(caso)

            orden = repository.get_orden_taller(conn, data.id_orden_taller)
            if orden is None:
                raise HTTPException(status_code=404, detail="No existe la orden de taller")

            if orden["id_cliente"] != caso["id_cliente"]:
                raise HTTPException(
                    status_code=400,
                    detail="La orden de taller no pertenece al cliente del caso",
                )

            if caso.get("id_bicicleta_cliente") is not None and (
                orden["id_bicicleta_cliente"] != caso["id_bicicleta_cliente"]
            ):
                raise HTTPException(
                    status_code=400,
                    detail="La orden de taller no corresponde a la bicicleta del caso",
                )

            vinculo_existente = repository.get_vinculo_orden_taller(conn, data.id_orden_taller)
            if vinculo_existente is not None:
                if vinculo_existente["id_caso_postventa"] == caso_id:
                    raise HTTPException(
                        status_code=400,
                        detail="La orden de taller ya está vinculada a este caso",
                    )
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "La orden de taller ya está vinculada a otro caso de postventa. "
                        "No se mueve automáticamente."
                    ),
                )

            repository.insert_vinculo_orden_taller(
                conn,
                {
                    "id_caso_postventa": caso_id,
                    "id_orden_taller": data.id_orden_taller,
                    "id_usuario": id_usuario,
                    "observaciones": data.observaciones,
                },
            )
            _registrar_evento(
                conn,
                caso_id=caso_id,
                tipo_evento="orden_taller_vinculada",
                detalle=f"Orden de taller #{data.id_orden_taller} vinculada al caso",
                id_usuario=id_usuario,
                metadata={"id_orden_taller": data.id_orden_taller},
            )
            _auditar(
                conn,
                id_usuario=id_usuario,
                caso_id=caso_id,
                accion="postventa_orden_taller_vinculada",
                detalle=f"Orden de taller #{data.id_orden_taller} vinculada al caso",
                metadata={"id_orden_taller": data.id_orden_taller},
            )
        return repository.listar_ordenes_taller_caso(conn, caso_id)
    finally:
        conn.close()


def crear_orden_taller_desde_caso(caso_id: int, data: PostventaCrearOrdenTallerInput):
    id_usuario = _actor_id(data)
    conn = get_connection()
    try:
        with conn.transaction():
            caso = repository.get_caso_by_id(conn, caso_id, for_update=True)
            if caso is None:
                raise HTTPException(status_code=404, detail="No existe el caso de postventa")
            _validar_mutable(caso)

            if not caso.get("id_bicicleta_cliente"):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No se puede crear una OT desde este caso porque no tiene "
                        "bicicleta del cliente asociada. Vinculá una bicicleta o creá "
                        "la OT desde Taller según el flujo normal."
                    ),
                )

            problema = (data.problema_reportado or caso.get("motivo_cliente") or "").strip()
            if not problema:
                raise HTTPException(status_code=400, detail="Informá el problema inicial de la OT")

            orden = _crear_orden_taller_en_conn(
                conn,
                OrdenTallerCreate(
                    id_sucursal=data.id_sucursal,
                    id_cliente=caso["id_cliente"],
                    id_bicicleta_cliente=caso["id_bicicleta_cliente"],
                    problema_reportado=problema,
                    fecha_prometida=data.fecha_prometida,
                    prioridad=data.prioridad,
                    id_usuario=id_usuario,
                ),
            )

            repository.insert_vinculo_orden_taller(
                conn,
                {
                    "id_caso_postventa": caso_id,
                    "id_orden_taller": orden["id"],
                    "id_usuario": id_usuario,
                    "observaciones": data.observaciones_vinculo,
                },
            )
            _registrar_evento(
                conn,
                caso_id=caso_id,
                tipo_evento="orden_taller_creada_vinculada",
                detalle=f"Orden de taller #{orden['id']} creada y vinculada al caso",
                id_usuario=id_usuario,
                metadata={"id_orden_taller": orden["id"]},
            )
            _auditar(
                conn,
                id_usuario=id_usuario,
                caso_id=caso_id,
                accion="postventa_orden_taller_creada_vinculada",
                detalle=f"Orden de taller #{orden['id']} creada y vinculada al caso",
                metadata={"id_orden_taller": orden["id"]},
            )
        return repository.listar_ordenes_taller_caso(conn, caso_id)
    finally:
        conn.close()


def actualizar_caso(caso_id: int, data: PostventaCasoUpdateInput):
    payload = data.model_dump(exclude_unset=True)
    id_usuario = _actor_id(data)
    conn = get_connection()
    try:
        with conn.transaction():
            caso = repository.get_caso_by_id(conn, caso_id, for_update=True)
            if caso is None:
                raise HTTPException(status_code=404, detail="No existe el caso de postventa")
            _validar_mutable(caso)
            if len(payload) > 1:
                repository.update_caso(conn, caso_id, payload)
                _registrar_evento(
                    conn,
                    caso_id=caso_id,
                    tipo_evento="caso_actualizado",
                    detalle="Caso de postventa actualizado",
                    id_usuario=id_usuario,
                    metadata={"campos": sorted(k for k in payload if k != "id_usuario")},
                )
                _auditar(
                    conn,
                    id_usuario=id_usuario,
                    caso_id=caso_id,
                    accion="postventa_caso_actualizado",
                    detalle="Caso de postventa actualizado",
                    metadata={"campos": sorted(k for k in payload if k != "id_usuario")},
                )
        return _detalle_caso(conn, caso_id)
    finally:
        conn.close()


def cambiar_estado(caso_id: int, data: PostventaEstadoInput):
    id_usuario = _actor_id(data)
    conn = get_connection()
    try:
        with conn.transaction():
            caso = repository.get_caso_by_id(conn, caso_id, for_update=True)
            if caso is None:
                raise HTTPException(status_code=404, detail="No existe el caso de postventa")
            if caso["estado"] in ESTADOS_TERMINALES:
                raise HTTPException(
                    status_code=400,
                    detail="El caso cerrado o cancelado no admite cambios de estado",
                )
            _validar_transicion(caso["estado"], data.nuevo_estado)
            if data.nuevo_estado == "cerrado":
                if not caso.get("resultado_final") or not caso.get("resolucion_aplicada"):
                    raise HTTPException(
                        status_code=400,
                        detail="Para cerrar el caso cargá resultado final y resolución aplicada",
                    )
            if data.nuevo_estado == "cancelado" and not data.motivo:
                raise HTTPException(status_code=400, detail="Para cancelar el caso indicá un motivo")
            repository.update_estado(conn, caso_id, estado=data.nuevo_estado, id_usuario=id_usuario)
            tipo_evento = "caso_cancelado" if data.nuevo_estado == "cancelado" else "estado_cambiado"
            detalle = data.motivo or f"Estado cambiado de {caso['estado']} a {data.nuevo_estado}"
            _registrar_evento(
                conn,
                caso_id=caso_id,
                tipo_evento=tipo_evento,
                detalle=detalle,
                id_usuario=id_usuario,
                metadata={"estado_anterior": caso["estado"], "estado_nuevo": data.nuevo_estado},
            )
            _auditar(
                conn,
                id_usuario=id_usuario,
                caso_id=caso_id,
                accion="postventa_estado_cambiado",
                detalle=detalle,
                metadata={"estado_anterior": caso["estado"], "estado_nuevo": data.nuevo_estado},
            )
        return _detalle_caso(conn, caso_id)
    finally:
        conn.close()


def cerrar_caso(caso_id: int, data: PostventaCerrarInput):
    id_usuario = _actor_id(data)
    conn = get_connection()
    try:
        with conn.transaction():
            caso = repository.get_caso_by_id(conn, caso_id, for_update=True)
            if caso is None:
                raise HTTPException(status_code=404, detail="No existe el caso de postventa")
            _validar_mutable(caso)
            _validar_transicion(caso["estado"], "cerrado")
            repository.cerrar_caso(conn, caso_id, data.model_dump())
            _registrar_evento(
                conn,
                caso_id=caso_id,
                tipo_evento="caso_cerrado",
                detalle="Caso de postventa cerrado",
                id_usuario=id_usuario,
            )
            _auditar(
                conn,
                id_usuario=id_usuario,
                caso_id=caso_id,
                accion="postventa_caso_cerrado",
                detalle="Caso de postventa cerrado",
            )
        return _detalle_caso(conn, caso_id)
    finally:
        conn.close()


def reabrir_caso(caso_id: int, data: PostventaReabrirInput):
    id_usuario = _actor_id(data)
    conn = get_connection()
    try:
        with conn.transaction():
            caso = repository.get_caso_by_id(conn, caso_id, for_update=True)
            if caso is None:
                raise HTTPException(status_code=404, detail="No existe el caso de postventa")
            if caso["estado"] != "cerrado":
                raise HTTPException(status_code=400, detail="Solo se pueden reabrir casos cerrados")
            repository.reabrir_caso(conn, caso_id)
            _registrar_evento(
                conn,
                caso_id=caso_id,
                tipo_evento="caso_reabierto",
                detalle=data.motivo,
                id_usuario=id_usuario,
            )
            _auditar(
                conn,
                id_usuario=id_usuario,
                caso_id=caso_id,
                accion="postventa_caso_reabierto",
                detalle=data.motivo,
            )
        return _detalle_caso(conn, caso_id)
    finally:
        conn.close()
