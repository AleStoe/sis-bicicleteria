from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP

from app.modules.precios import repository as precios_repository
from app.modules.precios.service import _calcular_precio_desde_regla


def _decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _money(value) -> Decimal:
    return _decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _round_up(value: Decimal, base: Decimal) -> Decimal:
    if value <= 0:
        return Decimal("0.00")
    return ((value / base).to_integral_value(rounding=ROUND_CEILING) * base).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def _variation(previous: Decimal, current: Decimal) -> Decimal | None:
    if previous <= 0:
        return None
    return ((current - previous) / previous * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def _effective_margin(cost: Decimal, list_price: Decimal, discount: Decimal) -> Decimal | None:
    if cost <= 0:
        return None
    effective = list_price * (Decimal("1") - discount / Decimal("100"))
    return (((effective / cost) - Decimal("1")) * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def _rule_snapshot(rule: dict | None) -> dict | None:
    if not rule:
        return None
    return {
        "id": rule["id"],
        "nombre": rule["nombre"],
        "margen_porcentaje": str(rule["margen_porcentaje"]),
        "descuento_base_porcentaje": str(rule.get("descuento_base_porcentaje") or 0),
        "margen_minimo_porcentaje": str(rule.get("margen_minimo_porcentaje") or 0),
        "redondeo_base": str(rule["redondeo_base"]),
    }


def _offer_snapshot(offer) -> dict | None:
    if not offer:
        return None
    return {
        key: (str(value) if value is not None else None)
        for key, value in dict(offer).items()
    }


def _find_rule(conn, context: dict, provider_id: int, channel: str):
    return precios_repository.buscar_regla_precio_aplicable(
        conn,
        {
            "id_categoria": context.get("id_categoria"),
            "id_marca": context.get("id_marca"),
            "id_familia_precio": context.get("id_familia_precio"),
            "id_proveedor": provider_id,
            "rubro": context.get("rubro"),
            "tipo_cliente": channel,
        },
    )


def _channel_preview(
    conn,
    *,
    context: dict,
    provider_id: int,
    channel: str,
    strategy: str,
    old_cost: Decimal,
    new_cost: Decimal,
    current_price: Decimal,
    default_discount: Decimal,
    default_rounding: Decimal,
    manual_price: Decimal | None,
):
    alerts = []
    rule = _find_rule(conn, context, provider_id, channel)
    discount = default_discount
    rounding = default_rounding

    if strategy == "ignorar":
        return current_price, discount, rounding, rule, alerts, "ignorar"
    if strategy == "mantener_precio":
        return current_price, discount, rounding, rule, alerts, "precio vigente sin cambios"
    if strategy == "manual":
        if manual_price is None or manual_price <= 0:
            alerts.append({"tipo": "bloqueo", "codigo": "precio_manual_faltante", "mensaje": f"Falta el precio manual {channel}."})
            return current_price, discount, rounding, rule, alerts, "manual incompleto"
        return _money(manual_price), discount, rounding, rule, alerts, "precio definido por el operador"
    if strategy == "usar_regla":
        if rule is None:
            alerts.append({"tipo": "bloqueo", "codigo": "regla_faltante", "mensaje": f"No hay regla {channel} aplicable."})
            return current_price, discount, rounding, rule, alerts, "sin regla aplicable"
        calculation = _calcular_precio_desde_regla(new_cost, rule)
        discount = _decimal(calculation["descuento_base_porcentaje"])
        rounding = _decimal(calculation["redondeo_base"])
        proposed = _money(calculation["precio_lista"])
        formula = f"regla {rule['nombre']}"
    else:
        if old_cost <= 0 or current_price <= 0:
            alerts.append({"tipo": "bloqueo", "codigo": "margen_sin_base", "mensaje": f"No se puede conservar el margen {channel} sin costo y precio anteriores."})
            return current_price, discount, rounding, rule, alerts, "margen sin base anterior"
        current_effective = current_price * (Decimal("1") - discount / Decimal("100"))
        margin = current_effective / old_cost - Decimal("1")
        new_effective = new_cost * (Decimal("1") + margin)
        proposed = _round_up(
            new_effective / (Decimal("1") - discount / Decimal("100")),
            rounding,
        )
        formula = f"margen efectivo conservado {margin * Decimal('100'):.2f}%"

    if new_cost < old_cost and proposed < current_price:
        alerts.append({"tipo": "advertencia", "codigo": "baja_sin_bajar_precio", "mensaje": "Bajó el costo; el precio vigente se mantiene hasta decisión manual."})
        proposed = current_price

    if rule is not None:
        minimum = new_cost * (
            Decimal("1")
            + _decimal(rule.get("margen_minimo_porcentaje")) / Decimal("100")
        )
        effective = proposed * (Decimal("1") - discount / Decimal("100"))
        if effective < minimum:
            alerts.append({"tipo": "advertencia", "codigo": "margen_bajo", "mensaje": f"El precio {channel} queda debajo del mínimo de la regla."})
    return proposed, discount, rounding, rule, alerts, formula


def calcular_vista_previa_precios(
    conn,
    *,
    context: dict,
    provider_id: int,
    old_cost,
    new_cost,
    current_minor,
    current_wholesale,
    strategy_minor: str,
    strategy_wholesale: str,
    discount_minor,
    discount_wholesale,
    rounding_minor,
    rounding_wholesale,
    alert_pct,
    manual_minor=None,
    manual_wholesale=None,
    selected: bool = True,
    confirm_free_price: bool = False,
    offer=None,
    free_price: bool = False,
):
    old_cost = _decimal(old_cost)
    new_cost = _decimal(new_cost)
    old_minor = _money(current_minor)
    old_wholesale = _money(current_wholesale)
    discount_minor = _decimal(discount_minor)
    discount_wholesale = _decimal(discount_wholesale)
    rounding_minor = _decimal(rounding_minor)
    rounding_wholesale = _decimal(rounding_wholesale)
    alert_pct = _decimal(alert_pct)
    manual_minor = None if manual_minor is None else _decimal(manual_minor)
    manual_wholesale = None if manual_wholesale is None else _decimal(manual_wholesale)
    alerts = []

    if new_cost <= 0:
        alerts.append({"tipo": "bloqueo", "codigo": "costo_invalido", "mensaje": "El costo leído es cero, negativo o ilegible."})
        new_cost = Decimal("0")

    minor, used_discount_minor, used_rounding_minor, rule_minor, alerts_minor, formula_minor = _channel_preview(
        conn, context=context, provider_id=provider_id, channel="minorista",
        strategy=strategy_minor, old_cost=old_cost, new_cost=new_cost,
        current_price=old_minor, default_discount=discount_minor,
        default_rounding=rounding_minor, manual_price=manual_minor,
    )
    wholesale, used_discount_wholesale, used_rounding_wholesale, rule_wholesale, alerts_wholesale, formula_wholesale = _channel_preview(
        conn, context=context, provider_id=provider_id, channel="mayorista",
        strategy=strategy_wholesale, old_cost=old_cost, new_cost=new_cost,
        current_price=old_wholesale, default_discount=discount_wholesale,
        default_rounding=rounding_wholesale, manual_price=manual_wholesale,
    )
    alerts.extend(alerts_minor)
    alerts.extend(alerts_wholesale)
    cost_variation = _variation(old_cost, new_cost)
    if cost_variation is not None and abs(cost_variation) >= alert_pct:
        alerts.append({"tipo": "advertencia", "codigo": "variacion_costo", "mensaje": f"El costo varía {cost_variation:+.2f}%."})
    if old_cost <= 0:
        alerts.append({"tipo": "advertencia", "codigo": "sin_costo_anterior", "mensaje": "No existe costo anterior confirmado."})
    offer_snapshot = _offer_snapshot(offer)
    if offer_snapshot:
        alerts.append({"tipo": "informativa", "codigo": "oferta_vigente", "mensaje": f"Tiene oferta vigente: {offer_snapshot.get('nombre')}."})
    if free_price and not confirm_free_price:
        alerts.append({"tipo": "bloqueo", "codigo": "precio_libre", "mensaje": "El producto permite precio libre y requiere confirmación explícita."})

    ignored = strategy_minor == "ignorar" and strategy_wholesale == "ignorar"
    if ignored:
        selected = False
    valid = ignored or not any(alert["tipo"] == "bloqueo" for alert in alerts)
    return {
        "costo_anterior": old_cost,
        "costo_nuevo": new_cost,
        "costo_variacion_pct": cost_variation,
        "precio_minorista_anterior": old_minor,
        "precio_mayorista_anterior": old_wholesale,
        "precio_minorista_nuevo": minor,
        "precio_mayorista_nuevo": wholesale,
        "margen_minorista_anterior": _effective_margin(old_cost, old_minor, used_discount_minor),
        "margen_mayorista_anterior": _effective_margin(old_cost, old_wholesale, used_discount_wholesale),
        "margen_minorista_nuevo": _effective_margin(new_cost, minor, used_discount_minor),
        "margen_mayorista_nuevo": _effective_margin(new_cost, wholesale, used_discount_wholesale),
        "estrategia_minorista": strategy_minor,
        "estrategia_mayorista": strategy_wholesale,
        "descuento_minorista": used_discount_minor,
        "descuento_mayorista": used_discount_wholesale,
        "redondeo_minorista": used_rounding_minor,
        "redondeo_mayorista": used_rounding_wholesale,
        "regla_minorista": _rule_snapshot(rule_minor),
        "regla_mayorista": _rule_snapshot(rule_wholesale),
        "oferta": offer_snapshot,
        "permite_precio_libre": bool(free_price),
        "precio_libre_confirmado": bool(confirm_free_price),
        "alertas": alerts,
        "explicacion": {
            "minorista": formula_minor,
            "mayorista": formula_wholesale,
            "costo_base_anterior": str(old_cost),
            "costo_nuevo_leido": str(new_cost),
        },
        "seleccionado": selected,
        "valido": valid,
    }
