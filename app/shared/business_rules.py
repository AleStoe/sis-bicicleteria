from decimal import Decimal

LIMITE_AJUSTE_CAJA = Decimal("500000")
LIMITE_EGRESO_CAJA = Decimal("500000")


def excede_limite_ajuste_caja(monto: Decimal) -> bool:
    return abs(monto) > LIMITE_AJUSTE_CAJA


def excede_limite_egreso_caja(monto: Decimal) -> bool:
    return abs(monto) > LIMITE_EGRESO_CAJA