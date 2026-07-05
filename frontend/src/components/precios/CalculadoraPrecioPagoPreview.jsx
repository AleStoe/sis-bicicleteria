import { useMemo, useState } from "react";
import { formatMoney } from "../../utils/formatters";

const DESCUENTO_CONTADO_DEFAULT = 10;

function normalizarPorcentajeDescuento(value) {
  const numero = Number(value ?? DESCUENTO_CONTADO_DEFAULT);
  if (!Number.isFinite(numero) || numero < 0 || numero >= 100) {
    return DESCUENTO_CONTADO_DEFAULT;
  }
  return numero;
}

function calcularPrecioLista(montoContado, porcentajeDescuentoContado) {
  const contado = Number(montoContado || 0);
  const descuento = normalizarPorcentajeDescuento(porcentajeDescuentoContado);
  const factorContado = 1 - descuento / 100;

  if (!Number.isFinite(contado) || contado <= 0) {
    return {
      contado: 0,
      precioLista: 0,
    };
  }

  const exacto = contado / factorContado;

  return {
    contado,
    precioLista: Math.round(exacto),
  };
}

function CalculadoraLinea({
  label,
  value,
  onChange,
  onApply,
  buttonLabel,
  porcentajeDescuentoContado,
  mostrarAccion,
}) {
  const calculo = useMemo(
    () => calcularPrecioLista(value, porcentajeDescuentoContado),
    [porcentajeDescuentoContado, value]
  );
  const puedeAplicar = calculo.precioLista > 0;
  const mostrarAdvertenciaPrecio = Number(value || 0) > 1000000;

  function aplicarPrecioLista() {
    if (!puedeAplicar || typeof onApply !== "function") return;
    onApply(String(calculo.precioLista));
  }

  return (
    <div style={styles.lineCard}>
      <label style={styles.label}>
        {label}
        <input
          style={styles.input}
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: 20000"
        />
      </label>

      <div style={styles.resultRow}>
        <span style={styles.secondaryResult}>
          Contado deseado <strong>{formatMoney(calculo.contado)}</strong>
        </span>
        <div style={styles.primaryResult}>
          <span style={styles.primaryResultLabel}>Precio lista a cargar</span>
          <strong style={styles.primaryResultValue}>
            {formatMoney(calculo.precioLista)}
          </strong>
        </div>
      </div>

      {mostrarAdvertenciaPrecio && (
        <div style={styles.warning}>
          Revisá este precio. ¿Seguro que quisiste cargar este importe?
        </div>
      )}

      {mostrarAccion && (
        <button
          type="button"
          style={{
            ...styles.actionButton,
            ...(!puedeAplicar ? styles.actionButtonDisabled : {}),
          }}
          onClick={aplicarPrecioLista}
          disabled={!puedeAplicar}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}

export default function CalculadoraPrecioPagoPreview({
  porcentajeDescuentoContado = DESCUENTO_CONTADO_DEFAULT,
  onAplicarMinorista,
  onAplicarMayorista,
  onUsarComoMinorista,
  onUsarComoMayorista,
  mostrarMinorista = true,
  mostrarMayorista = true,
  minoristaLabel = "Quiero recibir minorista en efectivo/transferencia",
  mayoristaLabel = "Quiero recibir mayorista en efectivo/transferencia",
  minoristaButtonLabel = "Usar como precio minorista/lista",
  mayoristaButtonLabel = "Usar como precio mayorista/lista",
  mostrarAcciones = true,
}) {
  const [contadoMinorista, setContadoMinorista] = useState("");
  const [contadoMayorista, setContadoMayorista] = useState("");
  const aplicarMinorista = onAplicarMinorista || onUsarComoMinorista;
  const aplicarMayorista = onAplicarMayorista || onUsarComoMayorista;
  const descuento = normalizarPorcentajeDescuento(porcentajeDescuentoContado);

  return (
    <section style={styles.box}>
      <div>
        <h4 style={styles.title}>Calculadora contado a precio lista</h4>
        <p style={styles.help}>
          El monto contado deseado no se guarda. Solo completa el precio lista
          calculado con {descuento}% de descuento contado.
        </p>
      </div>

      <div style={styles.grid}>
        {mostrarMinorista && (
          <CalculadoraLinea
            label={minoristaLabel}
            value={contadoMinorista}
            onChange={setContadoMinorista}
            onApply={aplicarMinorista}
            buttonLabel={minoristaButtonLabel}
            porcentajeDescuentoContado={descuento}
            mostrarAccion={mostrarAcciones}
          />
        )}

        {mostrarMayorista && (
          <CalculadoraLinea
            label={mayoristaLabel}
            value={contadoMayorista}
            onChange={setContadoMayorista}
            onApply={aplicarMayorista}
            buttonLabel={mayoristaButtonLabel}
            porcentajeDescuentoContado={descuento}
            mostrarAccion={mostrarAcciones}
          />
        )}
      </div>
    </section>
  );
}

const styles = {
  box: {
    display: "grid",
    gap: "10px",
    border: "1px solid #d9e2ec",
    borderRadius: "8px",
    padding: "10px 12px",
    background: "#fbfdff",
  },
  title: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 900,
    color: "#172033",
  },
  help: {
    margin: "2px 0 0",
    color: "#5f6f82",
    fontSize: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
    gap: "10px",
  },
  lineCard: {
    display: "grid",
    gap: "8px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "10px",
    background: "#ffffff",
  },
  label: {
    display: "grid",
    gap: "5px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "8px 10px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff",
  },
  resultRow: {
    display: "grid",
    gap: "8px",
  },
  secondaryResult: {
    color: "#475569",
    fontSize: "12px",
  },
  primaryResult: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 12px",
    border: "1px solid #fb923c",
    borderRadius: "8px",
    background: "#fff7ed",
  },
  primaryResultLabel: {
    color: "#9a3412",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
  },
  primaryResultValue: {
    color: "#c2410c",
    fontSize: "20px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  warning: {
    border: "1px solid #facc15",
    borderRadius: "7px",
    padding: "7px 9px",
    background: "#fefce8",
    color: "#854d0e",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1.35,
  },
  actionButton: {
    justifySelf: "start",
    border: "1px solid #86efac",
    borderRadius: "7px",
    padding: "8px 10px",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  actionButtonDisabled: {
    borderColor: "#cbd5e1",
    background: "#f1f5f9",
    color: "#94a3b8",
    cursor: "not-allowed",
  },
};
