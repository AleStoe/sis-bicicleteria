from fastapi import HTTPException

from app.db.connection import get_connection
from datetime import date
from app.core.text_normalization import clean_text, normalize_text_upper
from app.modules.auditoria import service as auditoria_service
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
    find_cliente_duplicado_fuerte,
    get_clientes_duplicados_resumen,
    insert_cliente,
    update_cliente,
    desactivar_cliente,
    activar_cliente,
    get_resumen_ventas_cliente,
    get_ventas_cliente,
    get_historial_cliente_enriquecido,
    get_ordenes_taller_cliente,
    get_bicicletas_cliente,
    insert_bicicleta_cliente,
    get_bicicleta_cliente_detalle,
    update_bicicleta_cliente,
    get_historial_taller_bicicleta_cliente,
    get_timeline_bicicleta_cliente,
    get_venta_origen_bicicleta_cliente,
    autorizar_service_vencido_bicicleta_cliente,
)


CLIENTE_CONSUMIDOR_FINAL_ID = 1
TIPOS_CLIENTE_VALIDOS = {"consumidor_final", "minorista", "mayorista"}


def _normalizar_create_input(data):
    data.nombre_persona = normalize_text_upper(data.nombre_persona)
    data.apellido = normalize_text_upper(data.apellido)
    data.nombre = normalize_text_upper(data.nombre)
    data.nombre = _resolver_nombre_display(data)
    data.telefono = clean_text(data.telefono)
    data.dni = clean_text(data.dni)
    data.direccion = clean_text(data.direccion)
    data.notas = clean_text(data.notas)
    data.cuit = clean_text(data.cuit)
    data.razon_social = normalize_text_upper(data.razon_social)
    return data


def _normalizar_update_input(data):
    data.nombre_persona = normalize_text_upper(data.nombre_persona)
    data.apellido = normalize_text_upper(data.apellido)
    data.nombre = normalize_text_upper(data.nombre)
    data.nombre = _resolver_nombre_display(data)
    data.telefono = clean_text(data.telefono)
    data.dni = clean_text(data.dni)
    data.direccion = clean_text(data.direccion)
    data.notas = clean_text(data.notas)
    data.cuit = clean_text(data.cuit)
    data.razon_social = normalize_text_upper(data.razon_social)
    return data


def _validar_tipo_cliente(tipo_cliente: str):
    if tipo_cliente not in TIPOS_CLIENTE_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de cliente inválido: {tipo_cliente}",
        )


def _resolver_nombre_display(data):
    partes = [
        data.nombre_persona,
        data.apellido,
    ]
    nombre_desde_partes = " ".join(parte for parte in partes if parte)

    return normalize_text_upper(nombre_desde_partes or data.nombre)


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


def _validar_cliente_sin_duplicado_fuerte(conn, data, cliente_id_actual: int | None = None):
    duplicado = find_cliente_duplicado_fuerte(
        conn,
        data,
        cliente_id_actual=cliente_id_actual,
    )

    if duplicado is None:
        return

    if data.cuit and _solo_digitos(data.cuit) == _solo_digitos(duplicado.get("cuit")):
        campo = "CUIT"
        valor = data.cuit
    elif data.dni and _solo_digitos(data.dni) == _solo_digitos(duplicado.get("dni")):
        campo = "DNI"
        valor = data.dni
    else:
        campo = "teléfono"
        valor = data.telefono

    raise HTTPException(
        status_code=400,
        detail=(
            f"Posible cliente duplicado: ya existe el cliente "
            f"#{duplicado['id']} ({duplicado['nombre']}) con el mismo {campo} {valor}."
        ),
    )


def _solo_digitos(value: str | None):
    if not value:
        return None
    return "".join(ch for ch in str(value) if ch.isdigit()) or None


def _normalizar_bicicleta_cliente_input(data):
    data.marca = normalize_text_upper(data.marca)
    data.modelo = normalize_text_upper(data.modelo)
    data.rodado = clean_text(data.rodado)
    data.color = normalize_text_upper(data.color)
    data.numero_cuadro = normalize_text_upper(data.numero_cuadro)
    data.notas = clean_text(data.notas)
    return data


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


def obtener_historial_cliente_service(cliente_id: int):
    conn = get_connection()
    try:
        _obtener_cliente_o_404(conn, cliente_id)
        return get_historial_cliente_enriquecido(conn, cliente_id)
    finally:
        conn.close()


def obtener_taller_cliente_service(cliente_id: int):
    conn = get_connection()
    try:
        _obtener_cliente_o_404(conn, cliente_id)
        return get_ordenes_taller_cliente(conn, cliente_id)
    finally:
        conn.close()


def crear_cliente_service(data):
    conn = get_connection()

    try:
        with conn.transaction():
            data = _normalizar_create_input(data)
            _validar_campos_cliente(data)
            _validar_no_crear_otro_consumidor_final(data)
            _validar_cliente_sin_duplicado_fuerte(conn, data)

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

            _validar_cliente_sin_duplicado_fuerte(
                conn,
                data,
                cliente_id_actual=cliente_id,
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

            data = _normalizar_bicicleta_cliente_input(data)

            if not data.marca:
                raise HTTPException(status_code=400, detail="La marca es obligatoria")

            return insert_bicicleta_cliente(conn, cliente_id, data)
    finally:
        conn.close()


def obtener_duplicados_clientes_service():
    conn = get_connection()

    try:
        return get_clientes_duplicados_resumen(conn)
    finally:
        conn.close()


def actualizar_bicicleta_cliente_service(cliente_id: int, bicicleta_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _obtener_cliente_o_404(conn, cliente_id)

            anterior = get_bicicleta_cliente_detalle(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
            )

            if anterior is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            data = _normalizar_bicicleta_cliente_input(data)

            if not data.marca:
                raise HTTPException(status_code=400, detail="La marca es obligatoria")

            actualizada = update_bicicleta_cliente(
                conn,
                cliente_id=cliente_id,
                bicicleta_id=bicicleta_id,
                data=data,
            )

            if actualizada is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No existe la bicicleta {bicicleta_id} para el cliente {cliente_id}",
                )

            if data.id_usuario:
                auditoria_service.registrar_evento(
                    conn,
                    id_usuario=data.id_usuario,
                    id_sucursal=data.id_sucursal,
                    entidad="bicicleta_cliente",
                    entidad_id=bicicleta_id,
                    accion="bicicleta_cliente_actualizada",
                    detalle=(
                        "Bicicleta de cliente actualizada. "
                        f"cliente_id={cliente_id}, bicicleta_id={bicicleta_id}"
                    ),
                    metadata={
                        "cliente_id": cliente_id,
                        "antes": {
                            "marca": anterior.get("marca"),
                            "modelo": anterior.get("modelo"),
                            "rodado": anterior.get("rodado"),
                            "color": anterior.get("color"),
                            "numero_cuadro": anterior.get("numero_cuadro"),
                            "notas": anterior.get("notas"),
                        },
                        "despues": {
                            "marca": actualizada.get("marca"),
                            "modelo": actualizada.get("modelo"),
                            "rodado": actualizada.get("rodado"),
                            "color": actualizada.get("color"),
                            "numero_cuadro": actualizada.get("numero_cuadro"),
                            "notas": actualizada.get("notas"),
                        },
                    },
                )

            return actualizada
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
        timeline = get_timeline_bicicleta_cliente(conn, bicicleta_id)

        return {
            "bicicleta": bicicleta,
            "venta_origen": venta_origen,
            "historial_taller": historial_taller,
            "timeline": timeline,
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

            motivo = clean_text(data.motivo)

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
                    "problema_reportado": "SERVICE BONIFICADO 30 DIAS",
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
