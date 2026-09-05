from calendar import monthrange
from datetime import date
from decimal import Decimal
import unicodedata

from fastapi import HTTPException
from psycopg import errors

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.shared.constants import (
    AUDITORIA_ACCION_CIERRE_RENTABILIDAD_ANULADO,
    AUDITORIA_ENTIDAD_CIERRE_RENTABILIDAD,
)
from .repository import (
    anular_cierre,
    distribuir_monto,
    get_cierre_by_id,
    get_cierre_by_periodo,
    get_cierre_distribuciones,
    get_cierres,
    get_cobros_rentabilidad_periodo_por_venta,
    get_detalle_rentabilidad_diaria,
    get_gastos_periodo,
    get_bonificaciones_garantias,
    get_participante_by_id,
    get_regla_activa,
    get_regla_by_id,
    get_regla_items,
    get_reglas,
    get_recuperacion_caja_periodo,
    get_ventas_rentabilidad,
    insert_cierre,
    insert_cierre_distribucion,
    insert_regla,
    insert_regla_item,
    update_regla_estado,
)


def _normalizar_texto(valor: str) -> str:
    return " ".join(valor.strip().split())


def _periodo_bounds(periodo_mes: date):
    inicio = date(periodo_mes.year, periodo_mes.month, 1)
    ultimo_dia = monthrange(periodo_mes.year, periodo_mes.month)[1]
    fin = date(periodo_mes.year, periodo_mes.month, ultimo_dia)
    return inicio, fin


def _normalizar_clasificacion(valor) -> str:
    texto = str(valor or "")
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    return texto.lower()


def _clasificar_rubro_detalle(detalle):
    tipo_precio = _normalizar_clasificacion(detalle.get("tipo_precio"))
    tipo_item = _normalizar_clasificacion(detalle.get("tipo_item"))
    rubro = _normalizar_clasificacion(detalle.get("producto_rubro"))
    categoria = _normalizar_clasificacion(detalle.get("categoria_nombre"))
    nombre = _normalizar_clasificacion(
        f"{detalle.get('producto') or ''} {detalle.get('descripcion_snapshot') or ''}"
    )

    if tipo_precio == "mayorista":
        return {
            "clave": "mayorista",
            "nombre": "Mayorista",
            "detalle": "Ventas con lista mayorista",
        }
    if tipo_item == "servicio_taller" or detalle.get("id_servicio_taller"):
        return {
            "clave": "taller",
            "nombre": "Taller / servicios",
            "detalle": "Mano de obra y servicios cargados",
        }
    if "bicicleta" in rubro or "bicicleta" in categoria or "bicicleta" in nombre:
        return {
            "clave": "bicicletas",
            "nombre": "Bicicletas",
            "detalle": "Bicicletas vendidas por mostrador, reserva o taller",
        }
    if "triciclo" in rubro or "triciclo" in categoria or "triciclo" in nombre:
        return {
            "clave": "triciclos",
            "nombre": "Triciclos",
            "detalle": "Triciclos vendidos por mostrador o pedido",
        }
    if "cuatriciclo" in rubro or "cuatriciclo" in categoria or "cuatriciclo" in nombre:
        return {
            "clave": "cuatriciclos",
            "nombre": "Cuatriciclos",
            "detalle": "Cuatriciclos vendidos por mostrador o pedido",
        }
    if "accesorio" in rubro or "accesorio" in categoria:
        return {
            "clave": "accesorios",
            "nombre": "Accesorios",
            "detalle": "Accesorios y complementos",
        }
    if "repuesto" in rubro or "repuesto" in categoria:
        return {
            "clave": "repuestos",
            "nombre": "Repuestos",
            "detalle": "Repuestos y componentes",
        }
    return {
        "clave": "otros",
        "nombre": "Otros",
        "detalle": "Ítems sin rubro comercial específico",
    }


def _resumen_por_rubro(detalles):
    grupos = {}
    for detalle in detalles:
        rubro = _clasificar_rubro_detalle(detalle)
        clave = rubro["clave"]
        if clave not in grupos:
            grupos[clave] = {
                **rubro,
                "cantidad_ventas": 0,
                "cantidad_items": 0,
                "cantidad_unidades": Decimal("0"),
                "venta_comercial": Decimal("0"),
                "cmv_comercial": Decimal("0"),
                "margen_esperado": Decimal("0"),
                "cobrado_comercial_reconocido": Decimal("0"),
                "capital_recuperado": Decimal("0"),
                "capital_inmovilizado": Decimal("0"),
                "utilidad_liberada": Decimal("0"),
                "utilidad_pendiente": Decimal("0"),
                "_ventas": set(),
            }

        grupo = grupos[clave]
        grupo["cantidad_items"] += 1
        grupo["_ventas"].add(detalle["id_venta"])
        grupo["cantidad_unidades"] += Decimal(str(detalle["cantidad_neta"] or 0))
        grupo["venta_comercial"] += Decimal(str(detalle["ingreso_comercial"] or 0))
        grupo["cmv_comercial"] += Decimal(str(detalle["costo_total"] or 0))
        grupo["margen_esperado"] += Decimal(str(detalle["margen_bruto"] or 0))
        grupo["cobrado_comercial_reconocido"] += Decimal(
            str(detalle["cobrado_comercial_reconocido"] or 0)
        )
        grupo["capital_recuperado"] += Decimal(str(detalle["capital_recuperado"] or 0))
        grupo["capital_inmovilizado"] += Decimal(str(detalle["capital_inmovilizado"] or 0))
        grupo["utilidad_liberada"] += Decimal(str(detalle["utilidad_liberada"] or 0))
        grupo["utilidad_pendiente"] += Decimal(str(detalle["utilidad_pendiente"] or 0))

    orden = ["taller", "bicicletas", "triciclos", "cuatriciclos", "accesorios", "repuestos", "mayorista", "otros"]
    salida = []
    for grupo in grupos.values():
        grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
        salida.append(grupo)
    salida.sort(
        key=lambda item: (
            orden.index(item["clave"]) if item["clave"] in orden else 99,
            item["nombre"],
        )
    )
    return salida


def _nombre_producto_detalle(detalle) -> str:
    producto = detalle.get("producto") or detalle.get("descripcion_snapshot") or "Sin producto"
    variante = str(detalle.get("variante") or "").strip()
    if variante and _normalizar_clasificacion(variante) not in {"unica"}:
        return f"{producto} - {variante}"
    return producto


def _top_clientes(detalles, limit: int = 5):
    grupos = {}
    for detalle in detalles:
        cliente = detalle.get("cliente_nombre") or "Sin cliente"
        if cliente not in grupos:
            grupos[cliente] = {
                "cliente_nombre": cliente,
                "cantidad_ventas": 0,
                "cantidad_items": 0,
                "cantidad_unidades": Decimal("0"),
                "venta_comercial": Decimal("0"),
                "cobrado_comercial_reconocido": Decimal("0"),
                "utilidad_liberada": Decimal("0"),
                "_ventas": set(),
            }

        grupo = grupos[cliente]
        grupo["cantidad_items"] += 1
        grupo["_ventas"].add(detalle["id_venta"])
        grupo["cantidad_unidades"] += Decimal(str(detalle.get("cantidad_neta") or 0))
        grupo["venta_comercial"] += Decimal(str(detalle.get("ingreso_comercial") or 0))
        grupo["cobrado_comercial_reconocido"] += Decimal(
            str(detalle.get("cobrado_comercial_reconocido") or 0)
        )
        grupo["utilidad_liberada"] += Decimal(str(detalle.get("utilidad_liberada") or 0))

    salida = []
    for grupo in grupos.values():
        grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
        salida.append(grupo)
    salida.sort(
        key=lambda item: (
            item["venta_comercial"],
            item["utilidad_liberada"],
            item["cantidad_unidades"],
        ),
        reverse=True,
    )
    return salida[:limit]


def _productos_estrella_por_rubro(detalles):
    grupos = {}
    for detalle in detalles:
        rubro = _clasificar_rubro_detalle(detalle)
        producto = _nombre_producto_detalle(detalle)
        clave_producto = (
            rubro["clave"],
            detalle.get("tipo_item"),
            detalle.get("id_variante"),
            detalle.get("id_servicio_taller"),
            producto,
        )
        if clave_producto not in grupos:
            grupos[clave_producto] = {
                "rubro_clave": rubro["clave"],
                "rubro_nombre": rubro["nombre"],
                "producto": producto,
                "cantidad_ventas": 0,
                "cantidad_unidades": Decimal("0"),
                "venta_comercial": Decimal("0"),
                "margen_esperado": Decimal("0"),
                "utilidad_liberada": Decimal("0"),
                "_ventas": set(),
            }

        grupo = grupos[clave_producto]
        grupo["_ventas"].add(detalle["id_venta"])
        grupo["cantidad_unidades"] += Decimal(str(detalle.get("cantidad_neta") or 0))
        grupo["venta_comercial"] += Decimal(str(detalle.get("ingreso_comercial") or 0))
        grupo["margen_esperado"] += Decimal(str(detalle.get("margen_bruto") or 0))
        grupo["utilidad_liberada"] += Decimal(str(detalle.get("utilidad_liberada") or 0))

    mejores_por_rubro = {}
    for grupo in grupos.values():
        grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
        clave = grupo["rubro_clave"]
        actual = mejores_por_rubro.get(clave)
        ranking = (
            grupo["utilidad_liberada"],
            grupo["venta_comercial"],
            grupo["cantidad_unidades"],
        )
        ranking_actual = (
            actual["utilidad_liberada"],
            actual["venta_comercial"],
            actual["cantidad_unidades"],
        ) if actual else None
        if actual is None or ranking > ranking_actual:
            mejores_por_rubro[clave] = grupo

    orden = ["taller", "bicicletas", "triciclos", "cuatriciclos", "accesorios", "repuestos", "mayorista", "otros"]
    salida = list(mejores_por_rubro.values())
    salida.sort(
        key=lambda item: (
            orden.index(item["rubro_clave"]) if item["rubro_clave"] in orden else 99,
            item["rubro_nombre"],
        )
    )
    return salida


def _armar_regla(regla, items):
    if regla is None:
        return None
    return {
        **regla,
        "items": items,
    }


def _obtener_regla_para_calculo(conn, regla_id: int | None = None):
    regla = get_regla_by_id(conn, regla_id) if regla_id else get_regla_activa(conn)
    if regla is None:
        return None, []
    if not regla["activa"]:
        raise HTTPException(status_code=400, detail="La regla de distribución está inactiva")

    items = get_regla_items(conn, regla["id"])
    if not items:
        raise HTTPException(status_code=400, detail="La regla de distribución no tiene participantes activos")

    total = sum((Decimal(str(i["porcentaje"])) for i in items), Decimal("0"))
    if total != Decimal("100.0000") and total != Decimal("100"):
        raise HTTPException(status_code=400, detail="La regla de distribución no suma 100%")

    return regla, items


def crear_regla_distribucion(data):
    conn = get_connection()
    try:
        with conn.transaction():
            nombres_ids = set()
            for item in data.items:
                if item.id_participante in nombres_ids:
                    raise HTTPException(status_code=400, detail="No se puede repetir participante en la regla")
                nombres_ids.add(item.id_participante)

                participante = get_participante_by_id(conn, item.id_participante)
                if participante is None:
                    raise HTTPException(status_code=400, detail=f"No existe el participante {item.id_participante}")
                if not participante["activo"]:
                    raise HTTPException(status_code=400, detail=f"El participante {participante['nombre']} está inactivo")

            try:
                regla = insert_regla(conn, _normalizar_texto(data.nombre), data.descripcion)
            except errors.UniqueViolation:
                raise HTTPException(status_code=400, detail="Ya existe una regla de distribución con ese nombre")

            for item in data.items:
                insert_regla_item(conn, regla["id"], item.id_participante, item.porcentaje)

            items = get_regla_items(conn, regla["id"])
            return _armar_regla(regla, items)
    finally:
        conn.close()


def listar_reglas(incluir_inactivas: bool = False):
    conn = get_connection()
    try:
        reglas = get_reglas(conn, incluir_inactivas=incluir_inactivas)
        salida = []
        for regla in reglas:
            salida.append(_armar_regla(regla, get_regla_items(conn, regla["id"])))
        return salida
    finally:
        conn.close()


def cambiar_estado_regla(regla_id: int, activa: bool):
    conn = get_connection()
    try:
        with conn.transaction():
            regla = update_regla_estado(conn, regla_id, activa)
            if regla is None:
                raise HTTPException(status_code=404, detail=f"No existe la regla {regla_id}")
            return {"ok": True, "regla_id": regla["id"], "activa": regla["activa"]}
    finally:
        conn.close()


def calcular_rentabilidad_mensual(periodo_mes: date, id_sucursal: int | None = None, id_regla_distribucion: int | None = None):
    fecha_desde, fecha_hasta = _periodo_bounds(periodo_mes)
    conn = get_connection()
    try:
        ventas = get_ventas_rentabilidad(conn, fecha_desde, fecha_hasta, id_sucursal=id_sucursal)
        gastos = get_gastos_periodo(conn, fecha_desde, fecha_hasta, id_sucursal=id_sucursal)
        detalles_periodo = get_detalle_rentabilidad_diaria(
            conn,
            fecha_desde,
            fecha_hasta=fecha_hasta,
            id_sucursal=id_sucursal,
        )

        cantidad_ventas = int(ventas["cantidad_ventas"] or 0)
        ventas_brutas = Decimal(str(ventas["ventas_brutas"] or 0))
        devoluciones_total = Decimal(str(ventas["devoluciones_total"] or 0))
        ventas_netas = Decimal(str(ventas["ventas_netas"] or 0))
        ventas_cobradas = Decimal(str(ventas["ventas_cobradas"] or 0))
        saldo_pendiente_por_cobrar = Decimal(
            str(ventas["saldo_pendiente_por_cobrar"] or 0)
        )
        financiacion_excluida = Decimal(
            str(ventas["financiacion_total"] or 0)
        )
        financiacion_cobrada = Decimal(
            str(ventas["financiacion_cobrada"] or 0)
        )
        costos_financieros = Decimal(
            str(ventas["costos_financieros"] or 0)
        )
        ingreso_real_neto = Decimal(
            str(ventas["ingreso_real_neto"] or 0)
        )
        resultado_financiero = financiacion_cobrada - costos_financieros
        cmv_bruto = Decimal(str(ventas["cmv_bruto"] or 0))
        cmv_devoluciones = Decimal(str(ventas["cmv_devoluciones"] or 0))
        cmv_neto = Decimal(str(ventas["cmv_neto"] or 0))
        cmv_cobrado = Decimal(str(ventas["cmv_cobrado"] or 0))
        cobrado_comercial_reconocido = Decimal(
            str(ventas["cobrado_comercial_reconocido"] or 0)
        )
        capital_recuperado = Decimal(str(ventas["capital_recuperado"] or 0))
        capital_inmovilizado = Decimal(str(ventas["capital_inmovilizado"] or 0))
        utilidad_liberada = Decimal(str(ventas["utilidad_liberada"] or 0))
        utilidad_pendiente = Decimal(str(ventas["utilidad_pendiente"] or 0))
        margen_cobrado = Decimal(str(ventas["margen_cobrado"] or 0))
        margen_pendiente = Decimal(str(ventas["margen_pendiente"] or 0))
        gastos_operativos = Decimal(str(gastos or 0))
        margen_bruto = ventas_netas - cmv_neto
        margen_real = utilidad_liberada + resultado_financiero
        resultado_distribuible = (
            utilidad_liberada + resultado_financiero - gastos_operativos
        )

        regla, items = _obtener_regla_para_calculo(conn, id_regla_distribucion)
        distribuciones = distribuir_monto(resultado_distribuible, items) if regla else []

        return {
            "periodo_mes": fecha_desde,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "id_sucursal": id_sucursal,
            "cantidad_ventas": cantidad_ventas,
            "ventas_brutas": ventas_brutas,
            "devoluciones_total": devoluciones_total,
            "ventas_netas": ventas_netas,
            "venta_comercial": ventas_netas,
            "ventas_cobradas": ventas_cobradas,
            "cobrado_comercial_reconocido": cobrado_comercial_reconocido,
            "saldo_pendiente_por_cobrar": saldo_pendiente_por_cobrar,
            "financiacion_excluida": financiacion_excluida,
            "financiacion_cobrada": financiacion_cobrada,
            "costos_financieros": costos_financieros,
            "ingreso_real_neto": ingreso_real_neto,
            "resultado_financiero": resultado_financiero,
            "cmv_bruto": cmv_bruto,
            "cmv_devoluciones": cmv_devoluciones,
            "cmv_neto": cmv_neto,
            "cmv_comercial": cmv_neto,
            "cmv_cobrado": cmv_cobrado,
            "capital_recuperado": capital_recuperado,
            "capital_inmovilizado": capital_inmovilizado,
            "margen_bruto": margen_bruto,
            "margen_esperado": margen_bruto,
            "margen_cobrado": margen_cobrado,
            "margen_pendiente": margen_pendiente,
            "utilidad_liberada": utilidad_liberada,
            "utilidad_pendiente": utilidad_pendiente,
            "margen_real": margen_real,
            "gastos_operativos": gastos_operativos,
            "resultado_distribuible": resultado_distribuible,
            "regla_distribucion": _armar_regla(regla, items) if regla else None,
            "distribuciones_sugeridas": distribuciones,
            "resumen_por_rubro": _resumen_por_rubro(detalles_periodo),
            "top_clientes": _top_clientes(detalles_periodo),
            "productos_estrella_por_rubro": _productos_estrella_por_rubro(detalles_periodo),
        }
    finally:
        conn.close()


def calcular_bonificaciones_garantias(
    periodo_mes: date,
    id_sucursal: int | None = None,
):
    fecha_desde, fecha_hasta = _periodo_bounds(periodo_mes)
    conn = get_connection()
    try:
        items = get_bonificaciones_garantias(
            conn,
            fecha_desde,
            fecha_hasta,
            id_sucursal=id_sucursal,
        )

        def sumar(campo):
            return sum(
                (Decimal(str(item[campo] or 0)) for item in items),
                Decimal("0"),
            )

        return {
            "periodo_mes": fecha_desde,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "id_sucursal": id_sucursal,
            "cantidad_operaciones": len({item["id_venta"] for item in items}),
            "cantidad_items": len(items),
            "cantidad_productos": sum(
                1 for item in items if item["tipo_item"] == "producto"
            ),
            "cantidad_servicios": sum(
                1 for item in items if item["tipo_item"] == "servicio_taller"
            ),
            "valor_lista": sumar("valor_lista"),
            "valor_bonificado": sumar("valor_bonificado"),
            "importe_post_bonificacion": sumar("importe_post_bonificacion"),
            "costo_capital": sumar("costo_capital"),
            "ingreso_neto_asignado": sumar("ingreso_neto_asignado"),
            "resultado_economico": sumar("resultado_economico"),
            "items": items,
        }
    finally:
        conn.close()


def calcular_rentabilidad_diaria(
    fecha: date,
    id_sucursal: int | None = None,
):
    conn = get_connection()
    try:
        detalles = get_detalle_rentabilidad_diaria(
            conn,
            fecha,
            id_sucursal=id_sucursal,
        )
        caja_dia = get_recuperacion_caja_periodo(
            conn,
            fecha,
            fecha,
            id_sucursal=id_sucursal,
        )
        cobros_ventas = get_cobros_rentabilidad_periodo_por_venta(
            conn,
            fecha,
            fecha,
            id_sucursal=id_sucursal,
        )

        grupos = {}
        for detalle in detalles:
            clave_id = (
                detalle["id_variante"]
                or detalle["id_servicio_taller"]
                or detalle["descripcion_snapshot"]
            )
            clave = (detalle["tipo_item"], clave_id)
            if clave not in grupos:
                grupos[clave] = {
                    "tipo_item": detalle["tipo_item"],
                    "id_variante": detalle["id_variante"],
                    "id_servicio_taller": detalle["id_servicio_taller"],
                    "producto": detalle["producto"],
                    "variante": detalle["variante"],
                    "cantidad_vendida": Decimal("0"),
                    "cantidad_ventas": 0,
                    "valor_lista": Decimal("0"),
                    "bonificacion_total": Decimal("0"),
                    "descuento_comercial": Decimal("0"),
                    "financiacion_excluida": Decimal("0"),
                    "financiacion_cobrada": Decimal("0"),
                    "costo_financiero": Decimal("0"),
                    "ingreso_real_neto": Decimal("0"),
                    "cobrado_comercial_reconocido": Decimal("0"),
                    "devoluciones_total": Decimal("0"),
                    "venta_total": Decimal("0"),
                    "venta_cobrada": Decimal("0"),
                    "costo_total": Decimal("0"),
                    "costo_cobrado": Decimal("0"),
                    "capital_recuperado": Decimal("0"),
                    "capital_inmovilizado": Decimal("0"),
                    "utilidad_liberada": Decimal("0"),
                    "margen_bruto": Decimal("0"),
                    "margen_cobrado": Decimal("0"),
                    "margen_pendiente": Decimal("0"),
                    "utilidad_pendiente": Decimal("0"),
                    "margen_real": Decimal("0"),
                    "_ventas": set(),
                    "detalles": [],
                }

            grupo = grupos[clave]
            grupo["cantidad_vendida"] += Decimal(
                str(detalle["cantidad_neta"] or 0)
            )
            grupo["valor_lista"] += (
                Decimal(str(detalle["precio_lista"] or 0))
                * Decimal(str(detalle["cantidad_neta"] or 0))
            )
            grupo["bonificacion_total"] += Decimal(
                str(detalle["bonificacion_total"] or 0)
            )
            grupo["descuento_comercial"] += Decimal(
                str(detalle["descuento_comercial_asignado"] or 0)
            )
            grupo["financiacion_excluida"] += Decimal(
                str(detalle["financiacion_excluida"] or 0)
            )
            grupo["financiacion_cobrada"] += Decimal(
                str(detalle["financiacion_cobrada"] or 0)
            )
            grupo["costo_financiero"] += Decimal(
                str(detalle["costo_financiero"] or 0)
            )
            grupo["ingreso_real_neto"] += Decimal(
                str(detalle["ingreso_real_neto"] or 0)
            )
            grupo["cobrado_comercial_reconocido"] += Decimal(
                str(detalle["cobrado_comercial_reconocido"] or 0)
            )
            grupo["devoluciones_total"] += Decimal(
                str(detalle["devolucion_comercial"] or 0)
            )
            grupo["venta_total"] += Decimal(
                str(detalle["ingreso_comercial"] or 0)
            )
            grupo["venta_cobrada"] += Decimal(
                str(detalle["venta_cobrada"] or 0)
            )
            grupo["costo_total"] += Decimal(
                str(detalle["costo_total"] or 0)
            )
            grupo["costo_cobrado"] += Decimal(
                str(detalle["costo_cobrado"] or 0)
            )
            grupo["capital_recuperado"] += Decimal(
                str(detalle["capital_recuperado"] or 0)
            )
            grupo["capital_inmovilizado"] += Decimal(
                str(detalle["capital_inmovilizado"] or 0)
            )
            grupo["utilidad_liberada"] += Decimal(
                str(detalle["utilidad_liberada"] or 0)
            )
            grupo["margen_bruto"] += Decimal(
                str(detalle["margen_bruto"] or 0)
            )
            grupo["margen_cobrado"] += Decimal(
                str(detalle["margen_cobrado"] or 0)
            )
            grupo["margen_pendiente"] += Decimal(
                str(detalle["margen_pendiente"] or 0)
            )
            grupo["utilidad_pendiente"] += Decimal(
                str(detalle["utilidad_pendiente"] or 0)
            )
            grupo["margen_real"] += Decimal(
                str(detalle["margen_real"] or 0)
            )
            grupo["_ventas"].add(detalle["id_venta"])
            grupo["detalles"].append(detalle)

        salida_articulos = []
        for grupo in grupos.values():
            grupo["cantidad_ventas"] = len(grupo.pop("_ventas"))
            venta_total = grupo["venta_cobrada"] or grupo["venta_total"]
            grupo["margen_porcentaje"] = (
                grupo["margen_real"] / venta_total * Decimal("100")
                if venta_total > 0
                else Decimal("0")
            )
            salida_articulos.append(grupo)

        salida_articulos.sort(
            key=lambda articulo: articulo["venta_total"],
            reverse=True,
        )

        ventas_netas = sum(
            (Decimal(str(item["ingreso_comercial"] or 0)) for item in detalles),
            Decimal("0"),
        )
        financiacion_excluida = sum(
            (
                Decimal(str(item["financiacion_excluida"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        financiacion_cobrada = sum(
            (
                Decimal(str(item["financiacion_cobrada"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        costos_financieros = sum(
            (
                Decimal(str(item["costo_financiero"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        ingreso_real_neto = sum(
            (
                Decimal(str(item["ingreso_real_neto"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        devoluciones_total = sum(
            (
                Decimal(str(item["devolucion_comercial"] or 0))
                for item in detalles
            ),
            Decimal("0"),
        )
        cmv = sum(
            (Decimal(str(item["costo_total"] or 0)) for item in detalles),
            Decimal("0"),
        )
        ventas_cobradas_items = sum(
            (Decimal(str(item["venta_cobrada"] or 0)) for item in detalles),
            Decimal("0"),
        )
        saldo_pendiente_por_cobrar = ventas_netas - ventas_cobradas_items
        ventas_cobradas = Decimal(
            str(caja_dia["cobrado_comercial_reconocido"] or 0)
        )
        cobrado_comercial_reconocido = ventas_cobradas
        financiacion_cobrada = Decimal(str(caja_dia["financiacion_cobrada"] or 0))
        costos_financieros = Decimal(str(caja_dia["costos_financieros"] or 0))
        ingreso_real_neto = Decimal(str(caja_dia["ingreso_real_neto"] or 0))
        cmv_cobrado = Decimal(str(caja_dia["capital_recuperado"] or 0))
        capital_recuperado = cmv_cobrado
        capital_inmovilizado = Decimal(str(caja_dia["capital_inmovilizado"] or 0))
        utilidad_liberada = Decimal(str(caja_dia["utilidad_liberada"] or 0))
        margen_cobrado = sum(
            (Decimal(str(item["margen_cobrado"] or 0)) for item in detalles),
            Decimal("0"),
        )
        margen_pendiente = sum(
            (Decimal(str(item["margen_pendiente"] or 0)) for item in detalles),
            Decimal("0"),
        )
        utilidad_pendiente = sum(
            (Decimal(str(item["utilidad_pendiente"] or 0)) for item in detalles),
            Decimal("0"),
        )
        margen_bruto = ventas_netas - cmv
        resultado_financiero = financiacion_cobrada - costos_financieros
        margen_real = utilidad_liberada + resultado_financiero

        return {
            "fecha": fecha,
            "id_sucursal": id_sucursal,
            "cantidad_ventas": len(
                {detalle["id_venta"] for detalle in detalles}
            ),
            "ventas_netas": ventas_netas,
            "venta_comercial": ventas_netas,
            "ventas_cobradas": ventas_cobradas,
            "cobrado_comercial_reconocido": cobrado_comercial_reconocido,
            "saldo_pendiente_por_cobrar": saldo_pendiente_por_cobrar,
            "financiacion_excluida": financiacion_excluida,
            "financiacion_cobrada": financiacion_cobrada,
            "costos_financieros": costos_financieros,
            "ingreso_real_neto": ingreso_real_neto,
            "resultado_financiero": resultado_financiero,
            "devoluciones_total": devoluciones_total,
            "cmv": cmv,
            "cmv_comercial": cmv,
            "cmv_cobrado": cmv_cobrado,
            "capital_recuperado": capital_recuperado,
            "capital_inmovilizado": capital_inmovilizado,
            "margen_bruto": margen_bruto,
            "margen_esperado": margen_bruto,
            "margen_cobrado": margen_cobrado,
            "margen_pendiente": margen_pendiente,
            "utilidad_liberada": utilidad_liberada,
            "utilidad_pendiente": utilidad_pendiente,
            "margen_real": margen_real,
            "margen_porcentaje": (
                margen_real / ventas_cobradas * Decimal("100")
                if ventas_cobradas > 0
                else Decimal("0")
            ),
            "cobros_ventas": cobros_ventas,
            "articulos": salida_articulos,
        }
    finally:
        conn.close()


def crear_cierre_rentabilidad(data):
    fecha_desde, fecha_hasta = _periodo_bounds(data.periodo_mes)
    if fecha_hasta >= date.today():
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden cerrar meses ya terminados. Elegí el primer día del mes que querés cerrar.",
        )

    conn = get_connection()
    try:
        with conn.transaction():
            existente = get_cierre_by_periodo(conn, fecha_desde, id_sucursal=data.id_sucursal)
            if existente is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Ya existe un cierre de rentabilidad para ese período y sucursal",
                )

            ventas = get_ventas_rentabilidad(conn, fecha_desde, fecha_hasta, id_sucursal=data.id_sucursal)
            gastos = get_gastos_periodo(conn, fecha_desde, fecha_hasta, id_sucursal=data.id_sucursal)

            ventas_brutas = Decimal(str(ventas["ventas_brutas"] or 0))
            devoluciones_total = Decimal(str(ventas["devoluciones_total"] or 0))
            ventas_netas = Decimal(str(ventas["ventas_netas"] or 0))
            utilidad_liberada = Decimal(str(ventas["utilidad_liberada"] or 0))
            cmv_bruto = Decimal(str(ventas["cmv_bruto"] or 0))
            cmv_devoluciones = Decimal(str(ventas["cmv_devoluciones"] or 0))
            cmv_neto = Decimal(str(ventas["cmv_neto"] or 0))
            financiacion_cobrada = Decimal(
                str(ventas["financiacion_cobrada"] or 0)
            )
            costos_financieros = Decimal(
                str(ventas["costos_financieros"] or 0)
            )
            resultado_financiero = (
                financiacion_cobrada - costos_financieros
            )
            gastos_operativos = Decimal(str(gastos or 0))
            margen_bruto = ventas_netas - cmv_neto
            margen_real = utilidad_liberada + resultado_financiero
            resultado_distribuible = (
                utilidad_liberada + resultado_financiero - gastos_operativos
            )

            regla, items = _obtener_regla_para_calculo(conn, data.id_regla_distribucion)
            if regla is None:
                raise HTTPException(status_code=400, detail="No hay regla de distribución activa para cerrar el mes")

            cierre = insert_cierre(
                conn,
                {
                    "periodo_mes": fecha_desde,
                    "fecha_desde": fecha_desde,
                    "fecha_hasta": fecha_hasta,
                    "id_sucursal": data.id_sucursal,
                    "id_regla_distribucion": regla["id"],
                    "regla_nombre_snapshot": regla["nombre"],
                    "ventas_brutas": ventas_brutas,
                    "devoluciones_total": devoluciones_total,
                    "ventas_netas": ventas_netas,
                    "cmv_bruto": cmv_bruto,
                    "cmv_devoluciones": cmv_devoluciones,
                    "cmv_neto": cmv_neto,
                    "margen_bruto": margen_bruto,
                    "financiacion_cobrada": financiacion_cobrada,
                    "costos_financieros": costos_financieros,
                    "resultado_financiero": resultado_financiero,
                    "margen_real": margen_real,
                    "gastos_operativos": gastos_operativos,
                    "resultado_distribuible": resultado_distribuible,
                    "id_usuario_cierre": data.id_usuario,
                    "observaciones": data.observaciones,
                },
            )

            distribuciones = distribuir_monto(resultado_distribuible, items)
            for dist in distribuciones:
                insert_cierre_distribucion(conn, cierre["id"], dist)

            return {"ok": True, "cierre_id": cierre["id"]}
    finally:
        conn.close()


def anular_cierre_rentabilidad(cierre_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            cierre_actual = get_cierre_by_id(conn, cierre_id)
            if cierre_actual is None:
                raise HTTPException(status_code=404, detail=f"No existe el cierre {cierre_id}")

            if cierre_actual["estado"] != "cerrado":
                raise HTTPException(status_code=400, detail="El cierre ya está anulado")

            cierre = anular_cierre(conn, cierre_id, motivo=data.motivo)
            if cierre is None:
                raise HTTPException(status_code=400, detail="No se pudo anular el cierre")

            auditoria_service.registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=cierre["id_sucursal"],
                entidad=AUDITORIA_ENTIDAD_CIERRE_RENTABILIDAD,
                entidad_id=cierre["id"],
                accion=AUDITORIA_ACCION_CIERRE_RENTABILIDAD_ANULADO,
                detalle=f"Cierre de rentabilidad {cierre['periodo_mes']} anulado",
                metadata={
                    "periodo_mes": str(cierre["periodo_mes"]),
                    "motivo": data.motivo,
                    "resultado_distribuible": str(cierre["resultado_distribuible"]),
                },
            )

            return {**cierre, "distribuciones": get_cierre_distribuciones(conn, cierre_id)}
    finally:
        conn.close()


def listar_cierres(limit: int = 100, offset: int = 0):
    conn = get_connection()
    try:
        cierres = get_cierres(conn, limit=limit, offset=offset)
        salida = []
        for cierre in cierres:
            salida.append({**cierre, "distribuciones": get_cierre_distribuciones(conn, cierre["id"])})
        return salida
    finally:
        conn.close()


def obtener_cierre(cierre_id: int):
    conn = get_connection()
    try:
        cierre = get_cierre_by_id(conn, cierre_id)
        if cierre is None:
            raise HTTPException(status_code=404, detail=f"No existe el cierre {cierre_id}")
        return {**cierre, "distribuciones": get_cierre_distribuciones(conn, cierre_id)}
    finally:
        conn.close()
