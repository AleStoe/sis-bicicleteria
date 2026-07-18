from decimal import Decimal, ROUND_FLOOR

from fastapi import HTTPException

from app.core.text_normalization import clean_text, normalize_text_upper
from app.db.connection import get_connection
from app.modules.auditoria.service import registrar_evento
from app.modules.stock import repository as stock_repository
from app.shared.money import redondear_monto

from . import repository
from .schema import (
    ArmadoOrdenOutput,
    ArmadoOrdenFichaTecnicaOutput,
    ArmadoPrecioEscenarioOutput,
    ArmadoSimulacionComponenteInput,
    ArmadoSimulacionComponenteOutput,
    ArmadoSimulacionOutput,
)


ESTADO_CONFIG_BORRADOR = "borrador"
ESTADO_CONFIG_ACTIVA = "activa"
ESTADO_CONFIG_ARCHIVADA = "archivada"
ESTADO_ORDEN_BORRADOR = "borrador"
ESTADO_ORDEN_PENDIENTE = "pendiente_componentes"
ESTADO_ORDEN_LISTA = "lista_para_armar"
ESTADO_ORDEN_EN_ARMADO = "en_armado"
ESTADO_ORDEN_CONTROL_FINAL = "control_final"
ESTADO_ORDEN_TERMINADA = "terminada"
ESTADO_ORDEN_CANCELADA = "cancelada"
MARGENES_ESCENARIO = (Decimal("25"), Decimal("30"), Decimal("35"), Decimal("40"))
CONTROLES_FINALES_REQUERIDOS = (
    "direccion_ajustada",
    "frenos_ajustados",
    "transmision_regulada",
    "ruedas_revisadas",
    "torque_general_verificado",
    "presion_cubiertas_verificada",
    "prueba_funcional_realizada",
    "limpieza_final_realizada",
    "numero_cuadro_verificado",
)


def _dec(value, default: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _grupo_tecnico(*, categoria_nombre: str | None, producto_nombre: str | None) -> str:
    texto = f"{categoria_nombre or ''} {producto_nombre or ''}".lower()
    reglas = [
        ("cuadro", ("cuadro", "frame")),
        ("ruedas", ("rueda", "llanta", "cubierta", "camara", "maza", "aro")),
        ("transmision", ("transmision", "cadena", "piñon", "pinon", "plato", "cambio", "descarrilador")),
        ("frenos", ("freno", "pastilla", "disco", "caliper", "manija")),
        ("direccion", ("direccion", "horquilla", "stem", "manubrio", "puño", "punio")),
        ("asiento", ("asiento", "sillin", "sillín", "vela")),
    ]
    for grupo, palabras in reglas:
        if any(palabra in texto for palabra in palabras):
            return grupo
    return "componentes"


def _enriquecer_items_configuracion(items):
    enriquecidos = []
    for item in items:
        row = dict(item)
        row["grupo_tecnico"] = _grupo_tecnico(
            categoria_nombre=row.get("categoria_nombre"),
            producto_nombre=row.get("producto_nombre"),
        )
        row["costo_unitario_estimado"] = row.get("costo_unitario_estimado") or Decimal("0")
        row["subtotal_estimado"] = row.get("subtotal_estimado") or Decimal("0")
        enriquecidos.append(row)
    return enriquecidos


def _precio_para_margen(costo_total: Decimal, margen: Decimal) -> Decimal | None:
    if costo_total <= 0 or margen >= 100:
        return None
    return redondear_monto(costo_total / (Decimal("1") - margen / Decimal("100")))


def _actor_id(data) -> int:
    id_usuario = getattr(data, "id_usuario", None)
    if not id_usuario:
        raise HTTPException(status_code=400, detail="id_usuario es obligatorio")
    return id_usuario


def _normalizar_nombre(nombre: str) -> str:
    nombre_normalizado = normalize_text_upper(nombre)
    if not nombre_normalizado:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    return nombre_normalizado


def _auditar(conn, *, id_usuario: int, entidad: str, entidad_id: int, accion: str, detalle: str, metadata=None):
    registrar_evento(
        conn,
        id_usuario=id_usuario,
        id_sucursal=None,
        entidad=entidad,
        entidad_id=entidad_id,
        accion=accion,
        detalle=detalle,
        metadata=metadata or {},
        origen_tipo=entidad,
        origen_id=entidad_id,
    )


def _validar_modelo_existente(modelo):
    if modelo is None:
        raise HTTPException(status_code=404, detail="No existe el modelo de armado")
    return modelo


def _validar_version_existente(version):
    if version is None:
        raise HTTPException(status_code=404, detail="No existe la version de armado")
    return version


def _validar_configuracion_existente(config):
    if config is None:
        raise HTTPException(status_code=404, detail="No existe la configuracion de armado")
    return config


def _validar_configuracion_editable(config):
    if config["estado"] != ESTADO_CONFIG_BORRADOR:
        raise HTTPException(
            status_code=400,
            detail="Solo se puede editar una configuracion en borrador",
        )


def _validar_orden_existente(orden):
    if orden is None:
        raise HTTPException(status_code=404, detail="No existe la orden de armado")
    return orden


def _validar_orden_mutable(orden):
    if orden["estado"] == ESTADO_ORDEN_CANCELADA:
        raise HTTPException(
            status_code=400,
            detail="La orden cancelada no admite modificaciones",
        )
    if orden["estado"] == ESTADO_ORDEN_TERMINADA:
        raise HTTPException(
            status_code=400,
            detail="La orden terminada no admite modificaciones",
        )
    if orden["estado"] in (ESTADO_ORDEN_EN_ARMADO, ESTADO_ORDEN_CONTROL_FINAL):
        raise HTTPException(
            status_code=400,
            detail="La orden en armado o control final no admite modificaciones de componentes",
        )


def _validar_variante_final_serializable(conn, variante_id: int):
    variante = repository.get_variante_detalle(conn, variante_id)
    if variante is None:
        raise HTTPException(status_code=404, detail="No existe la variante final")
    if not variante["producto_activo"] or not variante["variante_activa"]:
        raise HTTPException(
            status_code=400,
            detail="La variante final debe estar activa",
        )
    if not variante["stockeable"] or not variante["serializable"]:
        raise HTTPException(
            status_code=400,
            detail="La variante final debe ser vendible, stockeable y serializable",
        )
    return variante


def _validar_variante_componente(conn, *, id_variante_componente: int, id_variante_final: int):
    variante = repository.get_variante_detalle(conn, id_variante_componente)
    if variante is None:
        raise HTTPException(status_code=404, detail="No existe la variante componente")
    if not variante["producto_activo"] or not variante["variante_activa"]:
        raise HTTPException(
            status_code=400,
            detail="El componente debe estar activo",
        )
    if id_variante_componente == id_variante_final:
        raise HTTPException(
            status_code=400,
            detail="No se puede usar la misma variante final como componente",
        )
    return variante


def _detalle_configuracion(conn, configuracion_id: int):
    config = _validar_configuracion_existente(
        repository.get_configuracion_by_id(conn, configuracion_id)
    )
    items = _enriquecer_items_configuracion(
        repository.get_items_configuracion(conn, configuracion_id)
    )
    config = dict(config)
    config["items"] = items
    config["costo_estimado_total"] = config.get("costo_estimado_total") or Decimal("0")
    return config


def _componentes_desde_configuracion(conn, configuracion_id: int):
    items = _enriquecer_items_configuracion(
        repository.get_items_configuracion(conn, configuracion_id)
    )
    return [
        ArmadoSimulacionComponenteInput(
            id_variante=item["id_variante_componente"],
            cantidad=item["cantidad"],
            grupo_tecnico=item["grupo_tecnico"],
            opcional=False,
        )
        for item in items
    ]


def _validar_sucursal(conn, sucursal_id: int):
    sucursal = repository.get_sucursal_by_id(conn, sucursal_id)
    if sucursal is None:
        raise HTTPException(status_code=404, detail="No existe la sucursal")
    if not sucursal["activa"]:
        raise HTTPException(status_code=400, detail="La sucursal no esta activa")
    return sucursal


def _estado_costo(costo_disponible: bool, costo_cero: bool) -> str:
    if not costo_disponible:
        return "Costo faltante"
    if costo_cero:
        return "Costo cero"
    return "Costo disponible"


def _estado_disponibilidad(row, stock_disponible: Decimal, cantidad: Decimal) -> str:
    if not row["producto_activo"]:
        return "Producto inactivo"
    if not row["variante_activa"]:
        return "Variante inactiva"
    if not row["stock_calculable"]:
        return "Sin registro de stock"
    if stock_disponible <= 0:
        return "Sin stock disponible"
    if stock_disponible < cantidad:
        return "Stock insuficiente"
    return "Disponible"


def _detalle_orden(conn, orden_id: int) -> ArmadoOrdenOutput:
    orden = _validar_orden_existente(repository.get_orden_by_id(conn, orden_id))
    items = [dict(item) for item in repository.get_orden_items(conn, orden_id)]
    costos = repository.get_orden_costos(conn, orden_id)
    variante_ids = [item["id_variante_utilizada"] for item in items]
    stock = repository.get_componentes_detalle(
        conn,
        variante_ids=variante_ids,
        id_sucursal=orden["id_sucursal"],
    )
    advertencias = []
    fabricables = []
    calculo_completo = True

    for item in items:
        if item["estado"] in ("consumido", "revertido", "omitido"):
            item["estado_disponibilidad"] = item["estado"]
            continue
        row = stock.get(item["id_variante_utilizada"])
        cantidad = _dec(item["cantidad_utilizada"])
        if item["costo_unitario_previsto"] is None:
            calculo_completo = False
            item["estado_disponibilidad"] = "costo_faltante"
            advertencias.append(f"{item['producto_utilizado_nombre']} no tiene costo previsto")
        elif row is None:
            calculo_completo = False
            item["estado_disponibilidad"] = "sin_stock"
            advertencias.append(f"{item['producto_utilizado_nombre']} no tiene stock cargado")
        else:
            stock_disponible = _dec(row["stock_disponible"])
            item["stock_fisico"] = row["stock_fisico"]
            item["stock_reservado"] = row["stock_reservado"]
            item["stock_vendido_pendiente"] = row["stock_vendido_pendiente"]
            item["stock_disponible"] = row["stock_disponible"]
            if not row["producto_activo"] or not row["variante_activa"]:
                calculo_completo = False
                item["estado_disponibilidad"] = "variante_inactiva"
            elif stock_disponible <= 0:
                item["estado_disponibilidad"] = "sin_stock"
            elif stock_disponible < cantidad:
                item["estado_disponibilidad"] = "stock_insuficiente"
            else:
                item["estado_disponibilidad"] = "disponible"
            if row["stock_calculable"] and cantidad > 0:
                fabricables.append((stock_disponible / cantidad).to_integral_value(rounding=ROUND_FLOOR))

    utilidad = None
    margen = None
    markup = None
    precio = orden.get("precio_objetivo")
    costo_total = orden["costo_total_previsto"]
    if precio is not None:
        utilidad = redondear_monto(precio - costo_total)
        if precio > 0:
            margen = redondear_monto(utilidad / precio * Decimal("100"))
        if costo_total > 0:
            markup = redondear_monto(utilidad / costo_total * Decimal("100"))

    data = dict(orden)
    data["items"] = items
    data["costos"] = costos
    controles = {row["codigo_control"]: dict(row) for row in repository.get_orden_controles(conn, orden_id)}
    data["controles"] = [
        controles.get(
            codigo,
            {
                "id": None,
                "id_orden": orden_id,
                "codigo_control": codigo,
                "aprobado": False,
                "observaciones": None,
                "id_usuario": None,
                "fecha_control": None,
            },
        )
        for codigo in CONTROLES_FINALES_REQUERIDOS
    ]
    data["utilidad_prevista"] = utilidad
    data["margen_previsto"] = margen
    data["markup_previsto"] = markup
    data["calculo_completo"] = calculo_completo
    data["cantidad_fabricable"] = min(fabricables) if fabricables else None
    data["advertencias"] = advertencias
    return ArmadoOrdenOutput(**data)


def _actualizar_estado_items_por_disponibilidad(conn, orden_id: int):
    detalle = _detalle_orden(conn, orden_id)
    todos_ok = True
    for item in detalle.items:
        if item.estado in ("consumido", "revertido", "omitido"):
            continue
        if item.estado_disponibilidad == "disponible":
            nuevo_estado = "disponible" if item.estado != "sustituido" else "sustituido"
        else:
            nuevo_estado = "faltante"
            todos_ok = False
        repository.update_orden_item_estado(conn, item.id, nuevo_estado)
    return todos_ok, detalle


def _validar_datos_minimos_orden(orden):
    faltantes = []
    for campo, label in (
        ("talle", "talle"),
        ("color", "color"),
        ("numero_cuadro", "numero de cuadro"),
        ("descripcion_final", "descripcion final"),
    ):
        if not orden.get(campo):
            faltantes.append(label)
    if faltantes:
        raise HTTPException(
            status_code=400,
            detail="Faltan datos de la bicicleta: " + ", ".join(faltantes),
        )


def listar_modelos(*, incluir_inactivos: bool = False):
    conn = get_connection()
    try:
        return repository.listar_modelos(conn, incluir_inactivos=incluir_inactivos)
    finally:
        conn.close()


def crear_modelo(data):
    conn = get_connection()
    try:
        with conn.transaction():
            nombre = _normalizar_nombre(data.nombre)
            if repository.get_modelo_by_nombre(conn, nombre):
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe un modelo de armado con ese nombre",
                )
            modelo_id = repository.insert_modelo(
                conn,
                {
                    "nombre": nombre,
                    "descripcion": clean_text(data.descripcion),
                    "id_usuario": _actor_id(data),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_modelo",
                entidad_id=modelo_id,
                accion="armado_modelo_creado",
                detalle=f"Modelo de armado creado: {nombre}",
            )
            return repository.get_modelo_by_id(conn, modelo_id)
    finally:
        conn.close()


def editar_modelo(modelo_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_modelo_existente(repository.get_modelo_by_id(conn, modelo_id, for_update=True))
            nombre = _normalizar_nombre(data.nombre)
            if repository.get_modelo_by_nombre(conn, nombre, excluir_id=modelo_id):
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe otro modelo de armado con ese nombre",
                )
            repository.update_modelo(
                conn,
                modelo_id,
                {
                    "nombre": nombre,
                    "descripcion": clean_text(data.descripcion),
                    "id_usuario": _actor_id(data),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_modelo",
                entidad_id=modelo_id,
                accion="armado_modelo_editado",
                detalle=f"Modelo de armado editado: {nombre}",
            )
            return repository.get_modelo_by_id(conn, modelo_id)
    finally:
        conn.close()


def cambiar_estado_modelo(modelo_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_modelo_existente(
                repository.get_modelo_by_id(conn, modelo_id, for_update=True)
            )
            repository.update_modelo_estado(
                conn,
                modelo_id,
                activo=data.activo,
                id_usuario=_actor_id(data),
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_modelo",
                entidad_id=modelo_id,
                accion="armado_modelo_activado" if data.activo else "armado_modelo_desactivado",
                detalle="Estado de modelo de armado actualizado",
            )
            return repository.get_modelo_by_id(conn, modelo_id)
    finally:
        conn.close()


def listar_versiones(*, id_modelo: int | None = None, incluir_inactivas: bool = False):
    conn = get_connection()
    try:
        return repository.listar_versiones(
            conn,
            id_modelo=id_modelo,
            incluir_inactivas=incluir_inactivas,
        )
    finally:
        conn.close()


def crear_version(data):
    conn = get_connection()
    try:
        with conn.transaction():
            modelo = _validar_modelo_existente(
                repository.get_modelo_by_id(conn, data.id_modelo)
            )
            if not modelo["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail="El modelo debe estar activo",
                )
            nombre = _normalizar_nombre(data.nombre)
            if repository.get_version_by_nombre(conn, data.id_modelo, nombre):
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe una version con ese nombre para el modelo",
                )
            _validar_variante_final_serializable(conn, data.id_variante_final)
            version_id = repository.insert_version(
                conn,
                {
                    "id_modelo": data.id_modelo,
                    "nombre": nombre,
                    "descripcion": clean_text(data.descripcion),
                    "id_variante_final": data.id_variante_final,
                    "id_usuario": _actor_id(data),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_version",
                entidad_id=version_id,
                accion="armado_version_creada",
                detalle=f"Version de armado creada: {nombre}",
            )
            return repository.get_version_by_id(conn, version_id)
    finally:
        conn.close()


def editar_version(version_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            version = _validar_version_existente(
                repository.get_version_by_id(conn, version_id, for_update=True)
            )
            nombre = _normalizar_nombre(data.nombre)
            if repository.get_version_by_nombre(
                conn,
                version["id_modelo"],
                nombre,
                excluir_id=version_id,
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe otra version con ese nombre para el modelo",
                )
            _validar_variante_final_serializable(conn, data.id_variante_final)
            repository.update_version(
                conn,
                version_id,
                {
                    "nombre": nombre,
                    "descripcion": clean_text(data.descripcion),
                    "id_variante_final": data.id_variante_final,
                    "id_usuario": _actor_id(data),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_version",
                entidad_id=version_id,
                accion="armado_version_editada",
                detalle=f"Version de armado editada: {nombre}",
            )
            return repository.get_version_by_id(conn, version_id)
    finally:
        conn.close()


def cambiar_estado_version(version_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_version_existente(
                repository.get_version_by_id(conn, version_id, for_update=True)
            )
            repository.update_version_estado(
                conn,
                version_id,
                activo=data.activo,
                id_usuario=_actor_id(data),
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_version",
                entidad_id=version_id,
                accion="armado_version_activada" if data.activo else "armado_version_desactivada",
                detalle="Estado de version de armado actualizado",
            )
            return repository.get_version_by_id(conn, version_id)
    finally:
        conn.close()


def crear_configuracion(data):
    conn = get_connection()
    try:
        with conn.transaction():
            version = _validar_version_existente(
                repository.get_version_by_id(conn, data.id_version, for_update=True)
            )
            if not version["activo"]:
                raise HTTPException(
                    status_code=400,
                    detail="La version debe estar activa",
                )
            numero = repository.siguiente_numero_configuracion(conn, data.id_version)
            configuracion_id = repository.insert_configuracion(
                conn,
                {
                    "id_version": data.id_version,
                    "nombre": _normalizar_nombre(data.nombre),
                    "descripcion": clean_text(data.descripcion),
                    "numero_revision": numero,
                    "id_usuario": _actor_id(data),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_configuracion",
                entidad_id=configuracion_id,
                accion="armado_configuracion_creada",
                detalle=f"Configuracion de armado creada para version #{data.id_version}",
            )
            return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def obtener_configuracion(configuracion_id: int):
    conn = get_connection()
    try:
        return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def obtener_configuracion_activa(version_id: int):
    conn = get_connection()
    try:
        config_id = repository.get_configuracion_activa_by_version(conn, version_id)
        if config_id is None:
            raise HTTPException(
                status_code=404,
                detail="La version no tiene configuracion activa",
            )
        return _detalle_configuracion(conn, config_id)
    finally:
        conn.close()


def editar_configuracion(configuracion_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            config = _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, configuracion_id, for_update=True)
            )
            _validar_configuracion_editable(config)
            repository.update_configuracion(
                conn,
                configuracion_id,
                {
                    "nombre": _normalizar_nombre(data.nombre),
                    "descripcion": clean_text(data.descripcion),
                    "id_usuario": _actor_id(data),
                },
            )
            return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def agregar_item_configuracion(configuracion_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            config = _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, configuracion_id, for_update=True)
            )
            _validar_configuracion_editable(config)
            version = _validar_version_existente(
                repository.get_version_by_id(conn, config["id_version"])
            )
            _validar_variante_componente(
                conn,
                id_variante_componente=data.id_variante_componente,
                id_variante_final=version["id_variante_final"],
            )
            item_id = repository.insert_item_configuracion(
                conn,
                {
                    "id_configuracion": configuracion_id,
                    "id_variante_componente": data.id_variante_componente,
                    "cantidad": data.cantidad,
                    "orden": data.orden,
                    "nota": clean_text(data.nota),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_configuracion",
                entidad_id=configuracion_id,
                accion="armado_configuracion_item_agregado",
                detalle=f"Item #{item_id} agregado a configuracion de armado",
            )
            return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def editar_item_configuracion(configuracion_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            config = _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, configuracion_id, for_update=True)
            )
            _validar_configuracion_editable(config)
            item = repository.get_item_configuracion_by_id(conn, item_id, for_update=True)
            if item is None or item["id_configuracion"] != configuracion_id:
                raise HTTPException(status_code=404, detail="No existe el item de configuracion")
            version = _validar_version_existente(
                repository.get_version_by_id(conn, config["id_version"])
            )
            _validar_variante_componente(
                conn,
                id_variante_componente=data.id_variante_componente,
                id_variante_final=version["id_variante_final"],
            )
            repository.update_item_configuracion(
                conn,
                item_id,
                {
                    "id_variante_componente": data.id_variante_componente,
                    "cantidad": data.cantidad,
                    "orden": data.orden,
                    "nota": clean_text(data.nota),
                },
            )
            return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def eliminar_item_configuracion(configuracion_id: int, item_id: int, *, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():
            config = _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, configuracion_id, for_update=True)
            )
            _validar_configuracion_editable(config)
            item = repository.get_item_configuracion_by_id(conn, item_id, for_update=True)
            if item is None or item["id_configuracion"] != configuracion_id:
                raise HTTPException(status_code=404, detail="No existe el item de configuracion")
            repository.delete_item_configuracion(conn, item_id)
            _auditar(
                conn,
                id_usuario=id_usuario,
                entidad="armado_configuracion",
                entidad_id=configuracion_id,
                accion="armado_configuracion_item_eliminado",
                detalle=f"Item #{item_id} eliminado de configuracion en borrador",
            )
            return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def duplicar_configuracion(configuracion_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            config = _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, configuracion_id, for_update=True)
            )
            _validar_version_existente(
                repository.get_version_by_id(conn, config["id_version"], for_update=True)
            )
            numero = repository.siguiente_numero_configuracion(conn, config["id_version"])
            nuevo_id = repository.insert_configuracion(
                conn,
                {
                    "id_version": config["id_version"],
                    "nombre": _normalizar_nombre(data.nombre or f"{config['nombre']} COPIA"),
                    "descripcion": clean_text(data.descripcion) or config.get("descripcion"),
                    "numero_revision": numero,
                    "id_configuracion_origen": configuracion_id,
                    "id_usuario": _actor_id(data),
                },
            )
            repository.copiar_items_configuracion(
                conn,
                origen_id=configuracion_id,
                destino_id=nuevo_id,
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_configuracion",
                entidad_id=nuevo_id,
                accion="armado_configuracion_duplicada",
                detalle=f"Configuracion #{configuracion_id} duplicada como #{nuevo_id}",
                metadata={"origen_id": configuracion_id},
            )
            return _detalle_configuracion(conn, nuevo_id)
    finally:
        conn.close()


def activar_configuracion(configuracion_id: int, *, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():
            config = _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, configuracion_id, for_update=True)
            )
            items = repository.get_items_configuracion(conn, configuracion_id)
            if not items:
                raise HTTPException(
                    status_code=400,
                    detail="La configuracion debe tener componentes para activarse",
                )
            archivadas = repository.archivar_configuraciones_activas_version(
                conn,
                version_id=config["id_version"],
                excluir_id=configuracion_id,
                id_usuario=id_usuario,
            )
            repository.update_configuracion_estado(
                conn,
                configuracion_id,
                estado=ESTADO_CONFIG_ACTIVA,
                id_usuario=id_usuario,
            )
            for row in archivadas:
                _auditar(
                    conn,
                    id_usuario=id_usuario,
                    entidad="armado_configuracion",
                    entidad_id=row["id"],
                    accion="armado_configuracion_archivada",
                    detalle="Configuracion archivada por activacion de una nueva",
                )
            _auditar(
                conn,
                id_usuario=id_usuario,
                entidad="armado_configuracion",
                entidad_id=configuracion_id,
                accion="armado_configuracion_activada",
                detalle="Configuracion de armado activada",
            )
            return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def archivar_configuracion(configuracion_id: int, *, id_usuario: int):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, configuracion_id, for_update=True)
            )
            repository.update_configuracion_estado(
                conn,
                configuracion_id,
                estado=ESTADO_CONFIG_ARCHIVADA,
                id_usuario=id_usuario,
            )
            _auditar(
                conn,
                id_usuario=id_usuario,
                entidad="armado_configuracion",
                entidad_id=configuracion_id,
                accion="armado_configuracion_archivada",
                detalle="Configuracion de armado archivada",
            )
            return _detalle_configuracion(conn, configuracion_id)
    finally:
        conn.close()


def listar_sucursales():
    conn = get_connection()
    try:
        return repository.listar_sucursales(conn)
    finally:
        conn.close()


def obtener_modelo_detalle(modelo_id: int, *, id_sucursal: int | None = None):
    conn = get_connection()
    try:
        modelo = _validar_modelo_existente(repository.get_modelo_by_id(conn, modelo_id))
        versiones = repository.listar_versiones(
            conn,
            id_modelo=modelo_id,
            incluir_inactivas=True,
        )
        versiones_resultado = []
        for version in versiones:
            version_row = dict(version)
            if id_sucursal and version_row.get("configuracion_activa_id"):
                sim = _simular_configuracion_conn(
                    conn,
                    id_configuracion=version_row["configuracion_activa_id"],
                    id_sucursal=id_sucursal,
                    componentes=None,
                    costo_mano_obra=Decimal("0"),
                    costo_consumibles_no_inventariados=Decimal("0"),
                    costo_trabajos_externos=Decimal("0"),
                    otros_costos=Decimal("0"),
                    precio_comercial=version_row.get("precio_objetivo"),
                    margen_objetivo=None,
                    permitir_componentes_historicos=True,
                )
                version_row["cantidad_fabricable_estimada"] = sim.cantidad_fabricable
            versiones_resultado.append(version_row)
        return {"modelo": modelo, "versiones": versiones_resultado}
    finally:
        conn.close()


def simular_configuracion(data):
    if data.id_configuracion is None:
        raise HTTPException(
            status_code=400,
            detail="La simulacion requiere una configuracion de armado",
        )
    conn = get_connection()
    try:
        return _simular_configuracion_conn(
            conn,
            id_configuracion=data.id_configuracion,
            id_sucursal=data.id_sucursal,
            componentes=data.componentes,
            costo_mano_obra=data.costo_mano_obra,
            costo_consumibles_no_inventariados=data.costo_consumibles_no_inventariados,
            costo_trabajos_externos=data.costo_trabajos_externos,
            otros_costos=data.otros_costos,
            precio_comercial=data.precio_comercial,
            margen_objetivo=data.margen_objetivo,
            permitir_componentes_historicos=True,
        )
    finally:
        conn.close()


def _simular_configuracion_conn(
    conn,
    *,
    id_configuracion: int,
    id_sucursal: int,
    componentes,
    costo_mano_obra: Decimal,
    costo_consumibles_no_inventariados: Decimal,
    costo_trabajos_externos: Decimal,
    otros_costos: Decimal,
    precio_comercial: Decimal | None,
    margen_objetivo: Decimal | None,
    permitir_componentes_historicos: bool,
) -> ArmadoSimulacionOutput:
    config = _validar_configuracion_existente(
        repository.get_configuracion_by_id(conn, id_configuracion)
    )
    version = _validar_version_existente(
        repository.get_version_by_id(conn, config["id_version"])
    )
    sucursal = _validar_sucursal(conn, id_sucursal)

    items_config = repository.get_items_configuracion(conn, id_configuracion)
    ids_persistidos = {item["id_variante_componente"] for item in items_config}
    componentes_a_calcular = list(componentes) if componentes is not None else _componentes_desde_configuracion(conn, id_configuracion)
    if not componentes_a_calcular:
        raise HTTPException(
            status_code=400,
            detail="La configuracion no tiene componentes para simular",
        )

    ids = [componente.id_variante for componente in componentes_a_calcular]
    if len(ids) != len(set(ids)):
        raise HTTPException(
            status_code=400,
            detail="La simulacion no permite componentes duplicados",
        )
    if version["id_variante_final"] in set(ids):
        raise HTTPException(
            status_code=400,
            detail="No se puede usar la variante final como componente",
        )

    detalles = repository.get_componentes_detalle(
        conn,
        variante_ids=ids,
        id_sucursal=id_sucursal,
    )

    componentes_resultado: list[ArmadoSimulacionComponenteOutput] = []
    advertencias: list[str] = []
    costo_componentes = Decimal("0")
    calculo_completo = True
    fabricables_obligatorios: list[tuple[Decimal, ArmadoSimulacionComponenteOutput]] = []

    for componente in componentes_a_calcular:
        row = detalles.get(componente.id_variante)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"No existe la variante componente #{componente.id_variante}",
            )

        es_historico = permitir_componentes_historicos and componente.id_variante in ids_persistidos
        if (not row["producto_activo"] or not row["variante_activa"]) and not es_historico:
            raise HTTPException(
                status_code=400,
                detail=f"El componente #{componente.id_variante} debe estar activo",
            )

        cantidad = _dec(componente.cantidad)
        costo = row["costo_promedio_vigente"]
        costo_disponible = costo is not None
        costo_cero = costo == Decimal("0") if costo is not None else False
        subtotal = redondear_monto(_dec(costo) * cantidad) if costo_disponible else None
        stock_disponible = _dec(row["stock_disponible"])
        fabricable = None

        if not costo_disponible:
            calculo_completo = False
            advertencias.append(
                f"{row['producto_nombre']} no tiene costo promedio vigente cargado"
            )
        elif subtotal is not None:
            costo_componentes += subtotal

        if not row["stock_calculable"]:
            calculo_completo = False
            advertencias.append(
                f"{row['producto_nombre']} no tiene stock cargado para {sucursal['nombre']}"
            )
        elif cantidad > 0:
            fabricable = (stock_disponible / cantidad).to_integral_value(
                rounding=ROUND_FLOOR
            )

        if not row["producto_activo"] or not row["variante_activa"]:
            advertencias.append(
                f"{row['producto_nombre']} esta inactivo y se conserva solo por trazabilidad historica"
            )

        salida = ArmadoSimulacionComponenteOutput(
            id_variante=componente.id_variante,
            producto_nombre=row["producto_nombre"],
            nombre_variante=row["nombre_variante"],
            sku=row.get("sku"),
            categoria_nombre=row.get("categoria_nombre"),
            grupo_tecnico=componente.grupo_tecnico
            or _grupo_tecnico(
                categoria_nombre=row.get("categoria_nombre"),
                producto_nombre=row.get("producto_nombre"),
            ),
            cantidad=cantidad,
            opcional=componente.opcional,
            costo_unitario_estimado=costo,
            subtotal_estimado=subtotal,
            origen_costo="costo_promedio_vigente",
            costo_disponible=costo_disponible,
            costo_cero=costo_cero,
            stock_fisico=row["stock_fisico"],
            stock_reservado=row["stock_reservado"],
            stock_vendido_pendiente=row["stock_vendido_pendiente"],
            stock_disponible=row["stock_disponible"],
            stock_calculable=row["stock_calculable"],
            cantidad_fabricable_por_componente=fabricable,
            estado_costo=_estado_costo(costo_disponible, costo_cero),
            estado_disponibilidad=_estado_disponibilidad(row, stock_disponible, cantidad),
            producto_activo=row["producto_activo"],
            variante_activa=row["variante_activa"],
            advertencias=[],
        )
        if not costo_disponible:
            salida.advertencias.append("Costo faltante")
        if costo_cero:
            salida.advertencias.append("Costo cero")
        if fabricable is not None and fabricable <= 0 and not componente.opcional:
            salida.advertencias.append("No alcanza para fabricar una unidad")

        componentes_resultado.append(salida)
        if not componente.opcional and fabricable is not None:
            fabricables_obligatorios.append((fabricable, salida))

    costo_total_parcial = redondear_monto(
        costo_componentes
        + _dec(costo_mano_obra)
        + _dec(costo_consumibles_no_inventariados)
        + _dec(costo_trabajos_externos)
        + _dec(otros_costos)
    )

    precio_sugerido = _precio_para_margen(costo_total_parcial, margen_objetivo) if margen_objetivo is not None else None
    escenarios = [
        ArmadoPrecioEscenarioOutput(
            margen_objetivo=margen,
            precio_matematico=_precio_para_margen(costo_total_parcial, margen),
            precio_redondeado_sugerido=_precio_para_margen(costo_total_parcial, margen),
        )
        for margen in MARGENES_ESCENARIO
    ]

    utilidad = None
    margen_sobre_venta = None
    markup_sobre_costo = None
    diferencia = None
    if precio_comercial is not None and calculo_completo:
        utilidad = redondear_monto(precio_comercial - costo_total_parcial)
        margen_sobre_venta = redondear_monto(
            utilidad / precio_comercial * Decimal("100")
        )
        if costo_total_parcial > 0:
            markup_sobre_costo = redondear_monto(
                utilidad / costo_total_parcial * Decimal("100")
            )
    if precio_comercial is not None and precio_sugerido is not None:
        diferencia = redondear_monto(precio_comercial - precio_sugerido)

    cantidad_fabricable = None
    componente_limitante = None
    if fabricables_obligatorios:
        cantidad_fabricable, componente_limitante = min(
            fabricables_obligatorios,
            key=lambda item: item[0],
        )
        limitantes = [
            salida.producto_nombre
            for valor, salida in fabricables_obligatorios
            if valor == cantidad_fabricable
        ]
        if len(limitantes) > 1:
            advertencias.append(
                "Hay multiples componentes limitantes: " + ", ".join(limitantes)
            )

    return ArmadoSimulacionOutput(
        id_configuracion=id_configuracion,
        id_sucursal=id_sucursal,
        sucursal_nombre=sucursal["nombre"],
        componentes=componentes_resultado,
        costo_componentes=redondear_monto(costo_componentes),
        costo_mano_obra=redondear_monto(costo_mano_obra),
        costo_consumibles_no_inventariados=redondear_monto(
            costo_consumibles_no_inventariados
        ),
        costo_trabajos_externos=redondear_monto(costo_trabajos_externos),
        otros_costos=redondear_monto(otros_costos),
        costo_total=costo_total_parcial,
        costo_total_parcial=costo_total_parcial,
        calculo_completo=calculo_completo,
        precio_comercial=precio_comercial,
        margen_objetivo=margen_objetivo,
        precio_sugerido=precio_sugerido,
        utilidad_estimada=utilidad,
        margen_sobre_venta=margen_sobre_venta,
        markup_sobre_costo=markup_sobre_costo,
        diferencia_precio_comercial_vs_sugerido=diferencia,
        escenarios=escenarios,
        cantidad_fabricable=cantidad_fabricable,
        componente_limitante=componente_limitante,
        advertencias=advertencias,
    )


def listar_ordenes(filtros: dict):
    conn = get_connection()
    try:
        return [
            ArmadoOrdenOutput(
                **{
                    **dict(row),
                    "items": [],
                    "costos": [],
                    "controles": [],
                    "advertencias": [],
                }
            )
            for row in repository.listar_ordenes(conn, filtros)
        ]
    finally:
        conn.close()


def obtener_orden(orden_id: int):
    conn = get_connection()
    try:
        return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def crear_orden(data):
    conn = get_connection()
    try:
        with conn.transaction():
            config = _validar_configuracion_existente(
                repository.get_configuracion_by_id(conn, data.id_configuracion, for_update=True)
            )
            if config["estado"] != ESTADO_CONFIG_ACTIVA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede crear una orden desde una configuracion activa",
                )
            version = _validar_version_existente(
                repository.get_version_by_id(conn, config["id_version"], for_update=True)
            )
            modelo = _validar_modelo_existente(
                repository.get_modelo_by_id(conn, version["id_modelo"], for_update=True)
            )
            if not modelo["activo"] or not version["activo"]:
                raise HTTPException(status_code=400, detail="Modelo y version deben estar activos")
            _validar_variante_final_serializable(conn, version["id_variante_final"])
            _validar_sucursal(conn, data.id_sucursal)
            items = repository.get_items_configuracion(conn, config["id"])
            if not items:
                raise HTTPException(
                    status_code=400,
                    detail="La configuracion activa no tiene componentes",
                )
            orden_id = repository.insert_orden(
                conn,
                {
                    "id_modelo": modelo["id"],
                    "id_version": version["id"],
                    "id_configuracion": config["id"],
                    "id_sucursal": data.id_sucursal,
                    "talle": clean_text(data.talle),
                    "color": clean_text(data.color),
                    "numero_cuadro": clean_text(data.numero_cuadro),
                    "descripcion_final": clean_text(data.descripcion_final),
                    "id_usuario_responsable": data.id_usuario_responsable,
                    "id_usuario": _actor_id(data),
                    "precio_objetivo": data.precio_objetivo,
                    "margen_objetivo": data.margen_objetivo,
                    "observaciones": clean_text(data.observaciones),
                },
            )
            repository.copiar_items_a_orden(conn, orden_id=orden_id, configuracion_id=config["id"])
            repository.recalcular_totales_orden(conn, orden_id)
            _actualizar_estado_items_por_disponibilidad(conn, orden_id)
            repository.recalcular_totales_orden(conn, orden_id)
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_creada",
                detalle=f"Orden de armado creada desde configuracion #{config['id']}",
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def editar_orden(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(repository.get_orden_by_id(conn, orden_id, for_update=True))
            _validar_orden_mutable(orden)
            repository.update_orden_datos(
                conn,
                orden_id,
                {
                    "talle": clean_text(data.talle),
                    "color": clean_text(data.color),
                    "numero_cuadro": clean_text(data.numero_cuadro),
                    "descripcion_final": clean_text(data.descripcion_final),
                    "id_usuario_responsable": data.id_usuario_responsable,
                    "precio_objetivo": data.precio_objetivo,
                    "margen_objetivo": data.margen_objetivo,
                    "observaciones": clean_text(data.observaciones),
                },
            )
            repository.recalcular_totales_orden(conn, orden_id)
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_editada",
                detalle="Datos de orden de armado actualizados",
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def agregar_costo_orden(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(repository.get_orden_by_id(conn, orden_id, for_update=True))
            _validar_orden_mutable(orden)
            repository.insert_orden_costo(
                conn,
                {
                    "id_orden": orden_id,
                    "tipo": data.tipo,
                    "descripcion": clean_text(data.descripcion),
                    "cantidad": data.cantidad,
                    "costo_unitario": data.costo_unitario,
                    "observaciones": clean_text(data.observaciones),
                },
            )
            repository.recalcular_totales_orden(conn, orden_id)
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_costo_agregado",
                detalle=f"Costo previsto agregado: {data.tipo}",
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def sustituir_item_orden(orden_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(repository.get_orden_by_id(conn, orden_id, for_update=True))
            _validar_orden_mutable(orden)
            if orden["estado"] not in (ESTADO_ORDEN_BORRADOR, ESTADO_ORDEN_PENDIENTE, ESTADO_ORDEN_LISTA):
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede sustituir antes de iniciar el armado",
                )
            item = repository.get_orden_item_by_id(conn, item_id, for_update=True)
            if item is None or item["id_orden"] != orden_id:
                raise HTTPException(status_code=404, detail="No existe el item de la orden")
            variante = _validar_variante_componente(
                conn,
                id_variante_componente=data.id_variante_utilizada,
                id_variante_final=repository.get_version_by_id(conn, orden["id_version"])["id_variante_final"],
            )
            costo = variante["costo_promedio_vigente"]
            subtotal = redondear_monto(costo * data.cantidad_utilizada) if costo is not None else None
            repository.update_orden_item_sustitucion(
                conn,
                item_id,
                {
                    "id_variante_utilizada": data.id_variante_utilizada,
                    "cantidad_utilizada": data.cantidad_utilizada,
                    "costo_unitario_previsto": costo,
                    "subtotal_previsto": subtotal,
                    "motivo_sustitucion": clean_text(data.motivo_sustitucion),
                    "id_usuario": _actor_id(data),
                    "observaciones": clean_text(data.observaciones),
                },
            )
            repository.recalcular_totales_orden(conn, orden_id)
            _actualizar_estado_items_por_disponibilidad(conn, orden_id)
            if orden["estado"] == ESTADO_ORDEN_LISTA:
                repository.update_orden_estado(conn, orden_id, ESTADO_ORDEN_PENDIENTE)
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_item_sustituido",
                detalle=f"Item #{item_id} sustituido",
                metadata={
                    "id_variante_prevista": item["id_variante_prevista"],
                    "id_variante_utilizada": data.id_variante_utilizada,
                },
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def iniciar_orden(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(
                repository.get_orden_by_id(conn, orden_id, for_update=True)
            )
            if orden["estado"] == ESTADO_ORDEN_EN_ARMADO:
                raise HTTPException(
                    status_code=400,
                    detail="La orden ya esta en armado; no se puede iniciar nuevamente",
                )
            if orden["estado"] != ESTADO_ORDEN_LISTA:
                raise HTTPException(
                    status_code=400,
                    detail="Solo se puede iniciar una orden lista para armar",
                )

            items = [dict(item) for item in repository.get_orden_items_for_update(conn, orden_id)]
            items_a_consumir = [item for item in items if item["estado"] != "omitido"]
            if not items_a_consumir:
                raise HTTPException(
                    status_code=400,
                    detail="La orden no tiene componentes para consumir",
                )

            total_real = Decimal("0")
            consumidos = []
            for item in sorted(items_a_consumir, key=lambda row: (row["id_variante_utilizada"], row["id"])):
                if item["id_movimiento_consumo"] is not None:
                    raise HTTPException(
                        status_code=400,
                        detail="La orden ya tiene componentes consumidos",
                    )
                cantidad = _dec(item["cantidad_utilizada"])
                variante = _validar_variante_componente(
                    conn,
                    id_variante_componente=item["id_variante_utilizada"],
                    id_variante_final=repository.get_version_by_id(conn, orden["id_version"])["id_variante_final"],
                )
                costo_real = variante["costo_promedio_vigente"]
                if costo_real is None:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede iniciar el armado porque hay componentes sin costo real",
                    )
                subtotal_real = costo_real * cantidad
                try:
                    movimiento = stock_repository.registrar_salida_armado(
                        conn,
                        id_sucursal=orden["id_sucursal"],
                        id_variante=item["id_variante_utilizada"],
                        cantidad=cantidad,
                        id_usuario=_actor_id(data),
                        origen_id=orden_id,
                        costo_unitario_aplicado=costo_real,
                        nota=f"Consumo orden de armado {orden['codigo']} item #{item['id']}",
                    )
                except ValueError as exc:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede iniciar el armado porque cambio la disponibilidad de componentes.",
                    ) from exc

                repository.update_orden_item_consumido(
                    conn,
                    item["id"],
                    cantidad_consumida=cantidad,
                    costo_unitario_real=costo_real,
                    subtotal_real=subtotal_real,
                    movimiento_id=movimiento["movimiento_id"],
                )
                total_real += subtotal_real
                consumidos.append(
                    {
                        "id_item": item["id"],
                        "id_variante": item["id_variante_utilizada"],
                        "cantidad": str(cantidad),
                        "costo_unitario_real": str(costo_real),
                        "subtotal_real": str(subtotal_real),
                    }
                )

            repository.recalcular_totales_reales_orden(conn, orden_id)
            repository.update_orden_inicio(conn, orden_id, id_usuario=_actor_id(data))
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_iniciada",
                detalle=f"Orden de armado iniciada con consumo de componentes por {redondear_monto(total_real)}",
                metadata={"componentes": consumidos},
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def cancelar_orden(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(
                repository.get_orden_by_id(conn, orden_id, for_update=True)
            )
            if orden["estado"] == ESTADO_ORDEN_CANCELADA:
                raise HTTPException(status_code=400, detail="La orden ya esta cancelada")
            if orden["estado"] == ESTADO_ORDEN_TERMINADA:
                raise HTTPException(status_code=400, detail="La orden terminada no se puede cancelar")

            motivo = clean_text(data.motivo_cancelacion)
            if orden["estado"] in (
                ESTADO_ORDEN_BORRADOR,
                ESTADO_ORDEN_PENDIENTE,
                ESTADO_ORDEN_LISTA,
            ):
                repository.update_orden_cancelacion(
                    conn,
                    orden_id,
                    motivo_cancelacion=motivo,
                    id_usuario=_actor_id(data),
                )
                _auditar(
                    conn,
                    id_usuario=_actor_id(data),
                    entidad="armado_orden",
                    entidad_id=orden_id,
                    accion="armado_orden_cancelada",
                    detalle="Orden de armado cancelada antes del consumo",
                    metadata={"motivo": motivo},
                )
                return _detalle_orden(conn, orden_id)

            if orden["estado"] != ESTADO_ORDEN_EN_ARMADO:
                raise HTTPException(status_code=400, detail="Estado no permitido para cancelar")

            items = [dict(item) for item in repository.get_orden_items_for_update(conn, orden_id)]
            items_consumidos = [
                item for item in items
                if item["id_movimiento_consumo"] is not None and item["estado"] == "consumido"
            ]
            if not items_consumidos:
                raise HTTPException(
                    status_code=400,
                    detail="La orden en armado no tiene consumos para revertir",
                )

            reversiones = []
            for item in sorted(items_consumidos, key=lambda row: (row["id_variante_utilizada"], row["id"])):
                if item["id_movimiento_reversion"] is not None:
                    raise HTTPException(
                        status_code=400,
                        detail="La orden ya tiene componentes revertidos",
                    )
                cantidad = _dec(item["cantidad_consumida"])
                try:
                    movimiento = stock_repository.registrar_reversion_salida_armado(
                        conn,
                        id_sucursal=orden["id_sucursal"],
                        id_variante=item["id_variante_utilizada"],
                        cantidad=cantidad,
                        id_usuario=_actor_id(data),
                        origen_id=orden_id,
                        costo_unitario_aplicado=item["costo_unitario_real"],
                        nota=f"Reversion consumo orden de armado {orden['codigo']} item #{item['id']}",
                    )
                except ValueError as exc:
                    raise HTTPException(
                        status_code=400,
                        detail="No se pudo revertir el consumo de componentes de la orden",
                    ) from exc

                repository.update_orden_item_revertido(
                    conn,
                    item["id"],
                    movimiento_id=movimiento["movimiento_id"],
                )
                reversiones.append(
                    {
                        "id_item": item["id"],
                        "id_variante": item["id_variante_utilizada"],
                        "cantidad": str(cantidad),
                        "movimiento_reversion": movimiento["movimiento_id"],
                    }
                )

            repository.update_orden_cancelacion(
                conn,
                orden_id,
                motivo_cancelacion=motivo,
                id_usuario=_actor_id(data),
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_cancelada_con_reversion",
                detalle="Orden de armado cancelada y componentes devueltos a stock",
                metadata={"motivo": motivo, "reversiones": reversiones},
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def pasar_a_control_final(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(
                repository.get_orden_by_id(conn, orden_id, for_update=True)
            )
            if orden["estado"] != ESTADO_ORDEN_EN_ARMADO:
                raise HTTPException(
                    status_code=400,
                    detail="Solo una orden en armado puede pasar a control final",
                )
            items = [dict(item) for item in repository.get_orden_items_for_update(conn, orden_id)]
            consumidos = [item for item in items if item["estado"] == "consumido"]
            if not consumidos:
                raise HTTPException(
                    status_code=400,
                    detail="No se puede pasar a control final sin componentes consumidos",
                )
            pendientes = [
                item for item in items
                if item["estado"] != "omitido" and item["estado"] != "consumido"
            ]
            if pendientes:
                raise HTTPException(
                    status_code=400,
                    detail="Todos los componentes deben estar consumidos antes del control final",
                )
            for codigo in CONTROLES_FINALES_REQUERIDOS:
                repository.upsert_orden_control(
                    conn,
                    orden_id,
                    {
                        "codigo_control": codigo,
                        "aprobado": False,
                        "observaciones": None,
                        "id_usuario": _actor_id(data),
                    },
                )
            repository.recalcular_totales_finales_orden(conn, orden_id)
            repository.update_orden_control_final(conn, orden_id, id_usuario=_actor_id(data))
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_control_final",
                detalle="Orden de armado enviada a control final",
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def volver_a_en_armado(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(
                repository.get_orden_by_id(conn, orden_id, for_update=True)
            )
            if orden["estado"] != ESTADO_ORDEN_CONTROL_FINAL:
                raise HTTPException(
                    status_code=400,
                    detail="Solo una orden en control final puede volver a armado",
                )
            motivo = clean_text(data.motivo)
            repository.update_orden_volver_en_armado(conn, orden_id)
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_reabierta_desde_control",
                detalle="Orden vuelta a armado desde control final",
                metadata={"motivo": motivo},
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def actualizar_control_final(orden_id: int, data):
    if data.codigo_control not in CONTROLES_FINALES_REQUERIDOS:
        raise HTTPException(status_code=400, detail="Control final no reconocido")
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(
                repository.get_orden_by_id(conn, orden_id, for_update=True)
            )
            if orden["estado"] != ESTADO_ORDEN_CONTROL_FINAL:
                raise HTTPException(
                    status_code=400,
                    detail="Los controles solo se editan en control final",
                )
            repository.upsert_orden_control(
                conn,
                orden_id,
                {
                    "codigo_control": data.codigo_control,
                    "aprobado": data.aprobado,
                    "observaciones": clean_text(data.observaciones),
                    "id_usuario": _actor_id(data),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_control_final_actualizado",
                detalle=f"Control {data.codigo_control} actualizado",
                metadata={"aprobado": data.aprobado},
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def actualizar_costo_final_orden(orden_id: int, costo_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(
                repository.get_orden_by_id(conn, orden_id, for_update=True)
            )
            if orden["estado"] not in (ESTADO_ORDEN_EN_ARMADO, ESTADO_ORDEN_CONTROL_FINAL):
                raise HTTPException(
                    status_code=400,
                    detail="Los costos finales solo se ajustan en armado o control final",
                )
            costo = next(
                (row for row in repository.get_orden_costos(conn, orden_id) if row["id"] == costo_id),
                None,
            )
            if costo is None:
                raise HTTPException(status_code=404, detail="No existe el costo adicional")
            updated_orden_id = repository.update_orden_costo_final(
                conn,
                costo_id,
                costo_unitario_final=data.costo_unitario_final,
                id_usuario=_actor_id(data),
            )
            if updated_orden_id != orden_id:
                raise HTTPException(status_code=404, detail="No existe el costo adicional")
            repository.recalcular_totales_finales_orden(conn, orden_id)
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_costo_final_actualizado",
                detalle=f"Costo final adicional #{costo_id} actualizado",
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def finalizar_orden(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(
                repository.get_orden_by_id(conn, orden_id, for_update=True)
            )
            if orden["estado"] == ESTADO_ORDEN_TERMINADA:
                raise HTTPException(status_code=400, detail="La orden ya esta terminada")
            if orden["estado"] != ESTADO_ORDEN_CONTROL_FINAL:
                raise HTTPException(
                    status_code=400,
                    detail="Solo una orden en control final puede finalizarse",
                )
            if orden.get("id_bicicleta_serializada_resultante"):
                raise HTTPException(
                    status_code=400,
                    detail="La orden ya tiene bicicleta serializada resultante",
                )
            if repository.get_bicicleta_serializada_by_orden(conn, orden_id):
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe una bicicleta serializada para esta orden",
                )
            _validar_datos_minimos_orden(orden)
            version = _validar_version_existente(repository.get_version_by_id(conn, orden["id_version"]))
            _validar_variante_final_serializable(conn, version["id_variante_final"])

            items = [dict(item) for item in repository.get_orden_items_for_update(conn, orden_id)]
            if any(item["estado"] != "omitido" and item["estado"] != "consumido" for item in items):
                raise HTTPException(
                    status_code=400,
                    detail="Todos los componentes deben estar consumidos para finalizar",
                )
            if any(item["estado"] == "consumido" and item["subtotal_real"] is None for item in items):
                raise HTTPException(
                    status_code=400,
                    detail="Hay componentes consumidos sin costo real congelado",
                )

            controles = repository.get_orden_controles(conn, orden_id, for_update=True)
            aprobados = {row["codigo_control"]: row["aprobado"] for row in controles}
            faltantes = [
                codigo for codigo in CONTROLES_FINALES_REQUERIDOS
                if not aprobados.get(codigo)
            ]
            if faltantes:
                raise HTTPException(
                    status_code=400,
                    detail="Faltan controles finales aprobados: " + ", ".join(faltantes),
                )

            totales = repository.recalcular_totales_finales_orden(conn, orden_id)
            numero_cuadro = normalize_text_upper(orden["numero_cuadro"])
            bicicleta_id = repository.insert_bicicleta_serializada_desde_armado(
                conn,
                {
                    "id_variante": version["id_variante_final"],
                    "id_sucursal_actual": orden["id_sucursal"],
                    "numero_cuadro": numero_cuadro,
                    "observaciones": f"Fabricada desde {orden['codigo']}",
                    "id_orden_armado_origen": orden_id,
                    "costo_fabricacion_final": totales["total_final"],
                    "id_usuario_fabricacion": _actor_id(data),
                },
            )
            repository.update_orden_finalizada(
                conn,
                orden_id,
                bicicleta_id=bicicleta_id,
                costo_componentes_final=totales["componentes_final"],
                costo_adicional_final=totales["adicional_final"],
                costo_fabricacion_final=totales["total_final"],
                desvio_total=totales["desvio_total"],
                id_usuario=_actor_id(data),
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_finalizada",
                detalle=f"Orden finalizada. Bicicleta serializada #{bicicleta_id}",
                metadata={
                    "id_bicicleta_serializada": bicicleta_id,
                    "costo_fabricacion_final": str(totales["total_final"]),
                },
            )
            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="bicicleta_serializada",
                entidad_id=bicicleta_id,
                accion="bicicleta_serializada_fabricada",
                detalle=f"Bicicleta fabricada desde orden {orden['codigo']}",
                metadata={"id_orden_armado": orden_id},
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def obtener_ficha_tecnica_orden(orden_id: int):
    conn = get_connection()
    try:
        ficha = repository.get_ficha_tecnica_orden(conn, orden_id)
        if ficha is None:
            raise HTTPException(
                status_code=404,
                detail="La orden no tiene bicicleta fabricada",
            )
        return ArmadoOrdenFichaTecnicaOutput(**ficha)
    finally:
        conn.close()


def recalcular_disponibilidad_orden(orden_id: int):
    conn = get_connection()
    try:
        with conn.transaction():
            _validar_orden_existente(repository.get_orden_by_id(conn, orden_id, for_update=True))
            _actualizar_estado_items_por_disponibilidad(conn, orden_id)
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()


def cambiar_estado_orden(orden_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            orden = _validar_orden_existente(repository.get_orden_by_id(conn, orden_id, for_update=True))
            if orden["estado"] == ESTADO_ORDEN_CANCELADA:
                raise HTTPException(status_code=400, detail="La orden cancelada es inmutable")
            if orden["estado"] == ESTADO_ORDEN_TERMINADA:
                raise HTTPException(status_code=400, detail="La orden terminada es inmutable")
            destino = data.estado
            if destino == ESTADO_ORDEN_CANCELADA:
                if orden["estado"] == ESTADO_ORDEN_EN_ARMADO:
                    raise HTTPException(
                        status_code=400,
                        detail="Para cancelar una orden en armado usa la accion cancelar con reversion",
                    )
                repository.update_orden_estado(conn, orden_id, destino)
            elif destino == ESTADO_ORDEN_BORRADOR:
                if orden["estado"] != ESTADO_ORDEN_LISTA:
                    raise HTTPException(status_code=400, detail="Solo lista para armar puede volver a borrador")
                repository.update_orden_estado(conn, orden_id, destino)
            elif destino == ESTADO_ORDEN_PENDIENTE:
                if orden["estado"] not in (ESTADO_ORDEN_BORRADOR, ESTADO_ORDEN_PENDIENTE):
                    raise HTTPException(status_code=400, detail="Transicion no permitida")
                repository.update_orden_estado(conn, orden_id, destino)
            elif destino == ESTADO_ORDEN_LISTA:
                if orden["estado"] not in (ESTADO_ORDEN_BORRADOR, ESTADO_ORDEN_PENDIENTE):
                    raise HTTPException(status_code=400, detail="Transicion no permitida")
                _validar_datos_minimos_orden(orden)
                _validar_variante_final_serializable(
                    conn,
                    repository.get_version_by_id(conn, orden["id_version"])["id_variante_final"],
                )
                _actualizar_estado_items_por_disponibilidad(conn, orden_id)
                detalle = _detalle_orden(conn, orden_id)
                if not detalle.calculo_completo:
                    raise HTTPException(status_code=400, detail="No se puede marcar lista: faltan costos previstos")
                faltantes = [
                    item.producto_utilizado_nombre
                    for item in detalle.items
                    if item.estado_disponibilidad != "disponible"
                ]
                if faltantes:
                    raise HTTPException(
                        status_code=400,
                        detail="No se puede marcar lista: faltan componentes disponibles",
                    )
                repository.update_orden_estado(conn, orden_id, destino)
            else:
                raise HTTPException(status_code=400, detail="Estado no permitido")

            _auditar(
                conn,
                id_usuario=_actor_id(data),
                entidad="armado_orden",
                entidad_id=orden_id,
                accion="armado_orden_estado_actualizado",
                detalle=f"Estado actualizado a {destino}",
            )
            return _detalle_orden(conn, orden_id)
    finally:
        conn.close()
