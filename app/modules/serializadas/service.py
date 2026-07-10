from fastapi import HTTPException

from app.core.text_normalization import normalize_text_upper
from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.stock import service as stock_service
from app.modules.ventas.repository import get_variantes_by_ids, get_sucursal_by_id
from .repository import (
    get_bicicleta_serializada_for_update,
    insert_bicicleta_serializada,
    get_bicicletas_serializadas,
    get_correcciones_numero_cuadro,
    get_primer_usuario_activo_id,
    update_bicicleta_serializada_numero_cuadro,
    update_bicicletas_cliente_numero_cuadro_by_serializada,
)


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


def _validar_variante(conn, id_variante: int):
    variantes = get_variantes_by_ids(conn, [id_variante])

    if not variantes:
        raise HTTPException(
            status_code=400,
            detail=f"No existe la variante {id_variante}",
        )

    variante = variantes[0]

    if not variante["producto_activo"]:
        raise HTTPException(
            status_code=400,
            detail=f"El producto de la variante {id_variante} está inactivo",
        )

    if not variante["variante_activa"]:
        raise HTTPException(
            status_code=400,
            detail=f"La variante {id_variante} está inactiva",
        )

    if not variante["stockeable"]:
        raise HTTPException(
            status_code=400,
            detail="La variante no es stockeable",
        )

    if not variante["serializable"]:
        raise HTTPException(
            status_code=400,
            detail="La variante no es serializable",
        )

    return variante


def armar_bicicleta_serializada(data):
    conn = get_connection()

    try:
        with conn.transaction():
            _validar_variante(conn, data.id_variante)
            _validar_sucursal(conn, data.id_sucursal_actual)

            numero_cuadro = normalize_text_upper(data.numero_cuadro)

            bicicleta_id = insert_bicicleta_serializada(
                conn,
                {
                    "id_variante": data.id_variante,
                    "id_sucursal_actual": data.id_sucursal_actual,
                    "numero_cuadro": numero_cuadro,
                    "estado": "disponible",
                    "observaciones": data.observaciones,
                },
            )

            stock_service.registrar_salida_por_serializacion(
                conn,
                {
                    "id_sucursal": data.id_sucursal_actual,
                    "id_variante": data.id_variante,
                    "cantidad": 1,
                    "id_usuario": data.id_usuario,
                    "origen_id": bicicleta_id,
                    "id_bicicleta_serializada": bicicleta_id,
                    "nota": (
                        f"Salida de stock por armado de bicicleta serializada "
                        f"#{bicicleta_id}. Número de cuadro: {numero_cuadro}"
                    ),
                },
            )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=data.id_sucursal_actual,
                entidad="bicicleta_serializada",
                entidad_id=bicicleta_id,
                accion="bicicleta_serializada_armada",
                detalle=(
                    f"Bicicleta serializada armada. "
                    f"id_variante={data.id_variante}, "
                    f"numero_cuadro={numero_cuadro}, "
                    f"estado=disponible"
                ),
                metadata={
                    "tipo": "bicicleta_serializada_armada",
                    "bicicleta_id": bicicleta_id,
                    "id_variante": data.id_variante,
                    "numero_cuadro": numero_cuadro,
                    "id_sucursal": data.id_sucursal_actual,
                    "estado_final": "disponible",
                },
                origen_tipo="bicicleta_serializada",
                origen_id=bicicleta_id,
            )

        return {
            "ok": True,
            "bicicleta_id": bicicleta_id,
            "estado": "disponible",
        }

    finally:
        conn.close()


def corregir_numero_cuadro_bicicleta_serializada(
    bicicleta_id: int,
    data,
    *,
    id_usuario: int,
    origen_accion: str = "serializadas",
):
    conn = get_connection()

    try:
        with conn.transaction():
            bicicleta = get_bicicleta_serializada_for_update(conn, bicicleta_id)

            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta serializada {bicicleta_id}",
                )

            numero_nuevo = normalize_text_upper(data.numero_cuadro)
            motivo = (data.motivo or "").strip()

            if not numero_nuevo:
                raise HTTPException(
                    status_code=400,
                    detail="El nuevo número de cuadro es obligatorio",
                )

            if not motivo:
                raise HTTPException(
                    status_code=400,
                    detail="El motivo de corrección es obligatorio",
                )

            numero_anterior = bicicleta["numero_cuadro"]
            numero_anterior_normalizado = normalize_text_upper(numero_anterior)

            if numero_nuevo == numero_anterior_normalizado:
                raise HTTPException(
                    status_code=400,
                    detail="El nuevo número de cuadro coincide con el actual",
                )

            update_bicicleta_serializada_numero_cuadro(
                conn,
                bicicleta_id,
                numero_nuevo,
            )

            # bicicletas_clientes es la ficha operativa actual del cliente.
            # Se sincroniza para que la unidad corregida mantenga el mismo id,
            # venta, cliente e historial, pero muestre el dato vigente.
            bicis_cliente_actualizadas = update_bicicletas_cliente_numero_cuadro_by_serializada(
                conn,
                bicicleta_id,
                numero_nuevo,
            )

            id_usuario_auditoria = id_usuario
            if id_usuario_auditoria == 0:
                id_usuario_auditoria = get_primer_usuario_activo_id(conn)

            if not id_usuario_auditoria:
                raise HTTPException(
                    status_code=400,
                    detail="No hay usuario activo para registrar la auditoría",
                )

            auditoria_service.registrar_evento(
                conn,
                id_usuario=id_usuario_auditoria,
                id_sucursal=bicicleta["id_sucursal_actual"],
                entidad="bicicleta_serializada",
                entidad_id=bicicleta_id,
                accion="numero_cuadro_corregido",
                detalle=(
                    f"Corrección de número de cuadro de bicicleta serializada "
                    f"#{bicicleta_id}: {numero_anterior} -> {numero_nuevo}. "
                    f"Motivo: {motivo}"
                ),
                metadata={
                    "tipo": "numero_cuadro_corregido",
                    "bicicleta_id": bicicleta_id,
                    "id_variante": bicicleta["id_variante"],
                    "numero_cuadro_anterior": numero_anterior,
                    "numero_cuadro_nuevo": numero_nuevo,
                    "motivo": motivo,
                    "origen_accion": origen_accion,
                    "bicicletas_cliente_actualizadas": [
                        row["id"] for row in bicis_cliente_actualizadas
                    ],
                },
                origen_tipo="bicicleta_serializada",
                origen_id=bicicleta_id,
            )

        return {
            "ok": True,
            "bicicleta_id": bicicleta_id,
            "numero_cuadro_anterior": numero_anterior,
            "numero_cuadro_nuevo": numero_nuevo,
            "bicicletas_cliente_actualizadas": len(bicis_cliente_actualizadas),
        }

    finally:
        conn.close()


def listar_correcciones_numero_cuadro(bicicleta_id: int):
    conn = get_connection()

    try:
        rows = get_correcciones_numero_cuadro(conn, bicicleta_id)
        correcciones = []

        for row in rows:
            metadata = row.get("metadata") or {}
            correcciones.append(
                {
                    "id": row["id"],
                    "fecha": row["fecha"],
                    "usuario_nombre": row.get("usuario_nombre"),
                    "usuario_username": row.get("usuario_username"),
                    "numero_cuadro_anterior": metadata.get("numero_cuadro_anterior"),
                    "numero_cuadro_nuevo": metadata.get("numero_cuadro_nuevo"),
                    "motivo": metadata.get("motivo"),
                    "origen_accion": metadata.get("origen_accion"),
                }
            )

        return correcciones
    finally:
        conn.close()
    
def listar_bicicletas_serializadas(
    *,
    id_variante: int | None = None,
    id_sucursal: int | None = None,
    estado: str | None = None,
):
    conn = get_connection()

    try:
        return get_bicicletas_serializadas(
            conn,
            id_variante=id_variante,
            id_sucursal=id_sucursal,
            estado=estado,
        )
    finally:
        conn.close()


def listar_bicicletas_serializadas_disponibles(
    *,
    id_variante: int | None = None,
    id_sucursal: int | None = None,
):
    return listar_bicicletas_serializadas(
        id_variante=id_variante,
        id_sucursal=id_sucursal,
        estado="disponible",
    )
