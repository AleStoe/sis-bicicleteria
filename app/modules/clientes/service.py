from fastapi import HTTPException

from app.db.connection import get_connection
from datetime import date
from app.modules.taller.repository import (
    validar_sucursal_activa,
    validar_usuario_activo,
    insert_orden_taller,
    insert_orden_taller_evento,
    get_orden_taller_by_id,
    get_orden_postventa_abierta_por_bicicleta,
)
from .repository import (
    get_clientes,
    get_cliente_by_id,
    insert_cliente,
    update_cliente,
    desactivar_cliente,
    activar_cliente,
    get_resumen_ventas_cliente,
    get_ventas_cliente,
    get_bicicletas_cliente,
    insert_bicicleta_cliente,
    get_bicicleta_cliente_detalle,
    get_historial_taller_bicicleta_cliente,
    get_venta_origen_bicicleta_cliente,
    autorizar_service_vencido_bicicleta_cliente,
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
    data.cuit = _limpiar_texto(data.cuit)
    data.razon_social = _limpiar_texto(data.razon_social)
    return data


def _normalizar_update_input(data):
    data.nombre = _limpiar_texto(data.nombre)
    data.telefono = _limpiar_texto(data.telefono)
    data.dni = _limpiar_texto(data.dni)
    data.direccion = _limpiar_texto(data.direccion)
    data.notas = _limpiar_texto(data.notas)
    data.cuit = _limpiar_texto(data.cuit)
    data.razon_social = _limpiar_texto(data.razon_social)
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

def listar_bicicletas_cliente_service(cliente_id: int):
    conn = get_connection()
    try:
        _obtener_cliente_o_404(conn, cliente_id)
        return get_bicicletas_cliente(conn, cliente_id)
    finally:
        conn.close()


def crear_bicicleta_cliente_service(cliente_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            data.marca = _limpiar_texto(data.marca)
            data.modelo = _limpiar_texto(data.modelo)
            data.rodado = _limpiar_texto(data.rodado)
            data.color = _limpiar_texto(data.color)
            data.numero_cuadro = _limpiar_texto(data.numero_cuadro)
            data.notas = _limpiar_texto(data.notas)

            if not data.marca:
                raise HTTPException(status_code=400, detail="La marca es obligatoria")

            if not data.modelo:
                raise HTTPException(status_code=400, detail="El modelo es obligatorio")

            return insert_bicicleta_cliente(conn, cliente_id, data)
    finally:
        conn.close()

def obtener_historial_bicicleta_cliente_service(cliente_id: int, bicicleta_id: int):
    conn = get_connection()

    try:
        _obtener_cliente_o_404(conn, cliente_id)

        bicicleta = get_bicicleta_cliente_detalle(
            conn,
            cliente_id=cliente_id,
            bicicleta_id=bicicleta_id,
        )

        if bicicleta is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
            )

        venta_origen = get_venta_origen_bicicleta_cliente(
            conn,
            bicicleta.get("id_venta_origen"),
        )

        historial_taller = get_historial_taller_bicicleta_cliente(
            conn,
            bicicleta_id=bicicleta_id,
        )

        return {
            "bicicleta": bicicleta,
            "venta_origen": venta_origen,
            "historial_taller": historial_taller,
        }
    finally:
        conn.close()
    
def autorizar_service_vencido_bicicleta_cliente_service(
    cliente_id: int,
    bicicleta_id: int,
    data,
):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            bicicleta = get_bicicleta_cliente_detalle(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
            )

            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            if bicicleta.get("plan_postventa") != "service_30_dias":
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta no tiene plan de service 30 días",
                )

            if bicicleta.get("service_gratis_usado"):
                raise HTTPException(
                    status_code=400,
                    detail="El service bonificado ya fue usado",
                )

            motivo = _limpiar_texto(data.motivo)

            if not motivo:
                raise HTTPException(
                    status_code=400,
                    detail="El motivo es obligatorio",
                )

            resultado = autorizar_service_vencido_bicicleta_cliente(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
                id_usuario=data.id_usuario,
                motivo=motivo,
            )

            if resultado is None:
                raise HTTPException(
                    status_code=404,
                    detail="No se pudo autorizar el service vencido",
                )

            return {
                "ok": True,
                "cliente_id": cliente_id,
                "bicicleta_id": bicicleta_id,
                "autorizacion": resultado,
            }
    finally:
        conn.close()

def crear_orden_service_postventa_bicicleta_cliente_service(
    cliente_id: int,
    bicicleta_id: int,
    data,
):
    conn = get_connection()

    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            try:
                validar_sucursal_activa(conn, data.id_sucursal)
                validar_usuario_activo(conn, data.id_usuario)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            bicicleta = get_bicicleta_cliente_detalle(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
            )

            if bicicleta is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            if bicicleta.get("plan_postventa") != "service_30_dias":
                raise HTTPException(
                    status_code=400,
                    detail="La bicicleta no tiene plan de service 30 días",
                )

            if bicicleta.get("service_gratis_usado"):
                raise HTTPException(
                    status_code=400,
                    detail="El service bonificado ya fue usado",
                )

            fecha_limite = bicicleta.get("fecha_limite_service_gratis")
            autorizado_fuera_plazo = bool(
                bicicleta.get("service_gratis_autorizado_fuera_plazo")
            )
            orden_postventa_abierta = get_orden_postventa_abierta_por_bicicleta(
                conn,
                bicicleta_id=bicicleta_id,
            )

            if orden_postventa_abierta is not None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Ya existe una orden de service postventa pendiente "
                        f"para esta bicicleta: #{orden_postventa_abierta['id']}"
                    ),
                )
            if fecha_limite and fecha_limite < date.today() and not autorizado_fuera_plazo:
                raise HTTPException(
                    status_code=400,
                    detail="El service bonificado está vencido. Primero autorizá la excepción fuera de plazo.",
                )

            orden = insert_orden_taller(
                conn,
                {
                    "id_sucursal": data.id_sucursal,
                    "id_cliente": cliente_id,
                    "id_bicicleta_cliente": bicicleta_id,
                    "estado": "ingresada",
                    "problema_reportado": "Service bonificado 30 días",
                    "fecha_prometida": data.fecha_prometida,
                    "prioridad": data.prioridad,
                    "es_service_postventa": True,
                    "tipo_postventa": "service_30_dias",
                    "id_usuario": data.id_usuario,
                },
            )

            insert_orden_taller_evento(
                conn,
                id_orden_taller=orden["id"],
                tipo_evento="creada",
                detalle="Orden de service postventa 30 días creada desde ficha de bicicleta",
                id_usuario=data.id_usuario,
            )

            return {
                "ok": True,
                "cliente_id": cliente_id,
                "bicicleta_id": bicicleta_id,
                "orden_id": orden["id"],
                "orden": get_orden_taller_by_id(conn, orden["id"]),
            }
    finally:
        conn.close()