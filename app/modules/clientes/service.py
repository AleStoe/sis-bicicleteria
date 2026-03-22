from fastapi import HTTPException

from app.db.connection import get_connection
from .repository import (
    get_clientes,
    get_cliente_by_id,
    insert_cliente,
    update_cliente,
    desactivar_cliente,
    activar_cliente,
    get_resumen_ventas_cliente,
    get_ventas_cliente,
)


CLIENTE_CONSUMIDOR_FINAL_ID = 1
TIPOS_CLIENTE_VALIDOS = {"consumidor_final", "minorista", "mayorista"}


def _limpiar_texto(valor):
    if valor is None:
        return None

    valor = str(valor).strip()
    return valor if valor else None


def _normalizar_create_input(data):
    data.nombre = _limpiar_texto(data.nombre)
    data.telefono = _limpiar_texto(data.telefono)
    data.dni = _limpiar_texto(data.dni)
    data.direccion = _limpiar_texto(data.direccion)
    data.notas = _limpiar_texto(data.notas)
    return data


def _normalizar_update_input(data):
    data.nombre = _limpiar_texto(data.nombre)
    data.telefono = _limpiar_texto(data.telefono)
    data.dni = _limpiar_texto(data.dni)
    data.direccion = _limpiar_texto(data.direccion)
    data.notas = _limpiar_texto(data.notas)
    return data


def _validar_tipo_cliente(tipo_cliente: str):
    if tipo_cliente not in TIPOS_CLIENTE_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de cliente inválido: {tipo_cliente}",
        )


def _validar_campos_cliente(data):
    if not data.nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    if not data.telefono:
        raise HTTPException(status_code=400, detail="El teléfono es obligatorio")

    _validar_tipo_cliente(data.tipo_cliente)


def _obtener_cliente_o_404(conn, cliente_id: int):
    cliente = get_cliente_by_id(conn, cliente_id)

    if cliente is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe el cliente {cliente_id}",
        )

    return cliente


def _validar_no_editar_consumidor_final(cliente_id: int):
    if cliente_id == CLIENTE_CONSUMIDOR_FINAL_ID:
        raise HTTPException(
            status_code=400,
            detail="El cliente 'Consumidor final' no se puede modificar desde este módulo",
        )


def _validar_no_desactivar_consumidor_final(cliente_id: int):
    if cliente_id == CLIENTE_CONSUMIDOR_FINAL_ID:
        raise HTTPException(
            status_code=400,
            detail="El cliente 'Consumidor final' no se puede desactivar",
        )


def _validar_no_crear_otro_consumidor_final(data):
    if data.tipo_cliente == "consumidor_final":
        raise HTTPException(
            status_code=400,
            detail="No se puede crear manualmente otro cliente de tipo consumidor_final",
        )

    if data.nombre and data.nombre.strip().lower() == "consumidor final":
        raise HTTPException(
            status_code=400,
            detail="Ese nombre está reservado para el cliente genérico del sistema",
        )


def listar_clientes_service(q=None, solo_activos=False):
    conn = get_connection()

    try:
        return get_clientes(conn, q=q, solo_activos=solo_activos)
    finally:
        conn.close()


def obtener_cliente_service(cliente_id: int):
    conn = get_connection()

    try:
        cliente = _obtener_cliente_o_404(conn, cliente_id)
        resumen = get_resumen_ventas_cliente(conn, cliente_id)
        ventas = get_ventas_cliente(conn, cliente_id, limit=20)

        return {
            "cliente": cliente,
            "resumen_ventas": resumen,
            "ventas_recientes": ventas,
        }
    finally:
        conn.close()


def crear_cliente_service(data):
    conn = get_connection()

    try:
        with conn.transaction():
            data = _normalizar_create_input(data)
            _validar_campos_cliente(data)
            _validar_no_crear_otro_consumidor_final(data)

            cliente_id = insert_cliente(conn, data)

        return {
            "ok": True,
            "cliente_id": cliente_id,
        }
    finally:
        conn.close()


def actualizar_cliente_service(cliente_id: int, data):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)
            _validar_no_editar_consumidor_final(cliente_id)

            data = _normalizar_update_input(data)
            _validar_campos_cliente(data)

            if data.tipo_cliente == "consumidor_final":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede cambiar un cliente manual a tipo consumidor_final",
                )

            update_cliente(conn, cliente_id, data)

        return {
            "ok": True,
            "cliente_id": cliente_id,
        }
    finally:
        conn.close()


def desactivar_cliente_service(cliente_id: int):
    conn = get_connection()

    try:
        with conn.transaction():
            cliente = _obtener_cliente_o_404(conn, cliente_id)
            _validar_no_desactivar_consumidor_final(cliente_id)

            if not cliente["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"El cliente {cliente_id} ya está inactivo",
                )

            desactivar_cliente(conn, cliente_id)

        return {
            "ok": True,
            "cliente_id": cliente_id,
            "activo": False,
        }
    finally:
        conn.close()
    
def activar_cliente_service(cliente_id: int):
    conn = get_connection()

    try:
        with conn.transaction():
            cliente = _obtener_cliente_o_404(conn, cliente_id)

            if cliente_id == CLIENTE_CONSUMIDOR_FINAL_ID:
                raise HTTPException(
                    status_code=400,
                    detail="El cliente 'Consumidor final' no requiere activación",
                )

            if cliente["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"El cliente {cliente_id} ya está activo",
                )

            activar_cliente(conn, cliente_id)

        return {
            "ok": True,
            "cliente_id": cliente_id,
            "activo": True,
        }
    finally:
        conn.close()