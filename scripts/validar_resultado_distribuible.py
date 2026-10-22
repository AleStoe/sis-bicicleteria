from datetime import date
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.rentabilidad.service import calcular_comparacion_rentabilidad
from app.modules.documentos.pdf_resultado_distribuible import generar_resultado_distribuible_pdf


data = calcular_comparacion_rentabilidad(date(2026, 9, 1), 1, None)
print("PERIODOS", data["periodo_anterior"], data["periodo_actual"])
print("VALIDACION ANTERIOR", data["validacion_anterior"])
print("VALIDACION ACTUAL", data["validacion_actual"])
print("METRICAS")
for item in data["metricas"]:
    print(item)
print("RUBROS")
for item in data["rubros"]:
    print(item)
print("CONCILIACION")
for item in data["conciliacion_resultado"]:
    print(item)
print("COBRANZA ACTUAL")
for clave in (
    "cobrado_comercial_reconocido",
    "cobrado_ventas_periodo",
    "cobrado_ventas_anteriores",
    "credito_aplicado",
    "ingreso_real_neto",
    "conciliacion_cobranza_ajuste",
):
    print(clave, data["actual"][clave])

salida = Path("output/pdf/Resultado-Distribuible-2026-09-validado.pdf")
salida.parent.mkdir(parents=True, exist_ok=True)
salida.write_bytes(
    generar_resultado_distribuible_pdf(
        data["actual"],
        periodo_anterior=data["anterior"],
        comparacion=data,
    )
)
print("PDF", salida.resolve())
