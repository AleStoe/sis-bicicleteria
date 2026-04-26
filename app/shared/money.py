from decimal import Decimal, ROUND_HALF_UP
from typing import Any

CENTAVOS = Decimal("0.01")

def to_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        raise ValueError("El monto no puede ser None")
    return Decimal(str(value))

def redondear_monto(value: Any) -> Decimal:
    return to_decimal(value).quantize(CENTAVOS, rounding=ROUND_HALF_UP)