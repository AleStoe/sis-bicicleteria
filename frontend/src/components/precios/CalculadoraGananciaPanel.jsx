import { useMemo, useState } from "react";
import { formatMoney } from "../../utils/formatters";

function calcularPrecio({ costo, modo, valor }) {
  const costoNumero = Number(costo || 0);
  const valorNumero = Number(valor || 0);

  if (!Number.isFinite(costoNumero) || costoNumero <= 0) return 0;
  if (!Number.isFinite(valorNumero) || valorNumero < 0) return costoNumero;

  if (modo === "monto") {
    return Math.round(costoNumero + valorNumero);
  }

  return Math.round(costoNumero * (1 + valorNumero / 100));
}

function calcularGanancia({ costo, precio }) {
  const costoNumero = Number(costo || 0);
  const precioNumero = Number(precio || 0);

  if (!Number.isFinite(costoNumero) || costoNumero <= 0) {
    return { ganancia: 0, margen: 0 };
  }

  const ganancia = precioNumero - costoNumero;

  return {
    ganancia,
    margen: (ganancia / costoNumero) * 100,
  };
}

export default function CalculadoraGananciaPanel({
  costo,
  onAplicarMinorista,
  onAplicarMayorista,
  styles,
}) {
  const ui = { ...defaultStyles, ...(styles || {}) };
  const [modo, setModo] = useState("porcentaje");
  const [valor, setValor] = useState("");

  const precioSugerido = useMemo(
    () => calcularPrecio({ costo, modo, valor }),
    [costo, modo, valor]
  );
  const resumen = useMemo(
    () => calcularGanancia({ costo, precio: precioSugerido }),
    [costo, precioSugerido]
  );
  const puedeAplicar = precioSugerido > 0;

  return (
    <section style={ui.gananciaBox}>
      <div>
        <h4 style={ui.gananciaTitle}>Cuanto quiero ganar</h4>
        <p style={ui.gananciaHelp}>
          Calcula precio desde costo por porcentaje o monto fijo.
        </p>
      </div>

      <div style={ui.gananciaControls}>
        <label style={ui.label}>
          Quiero ganar
          <input
            style={ui.input}
            type="number"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={modo === "porcentaje" ? "Ej: 80" : "Ej: 12000"}
          />
        </label>

        <label style={ui.label}>
          Modo
          <select
            style={ui.input}
            value={modo}
            onChange={(e) => setModo(e.target.value)}
          >
            <option value="porcentaje">% sobre costo</option>
            <option value="monto">$ sobre costo</option>
          </select>
        </label>
      </div>

      <div style={ui.gananciaSummaryGrid}>
        <div style={ui.gananciaSummaryCard}>
          <span style={ui.gananciaSummaryLabel}>Costo base</span>
          <strong style={ui.gananciaSummaryValue}>{formatMoney(costo)}</strong>
        </div>
        <div style={ui.gananciaSummaryCard}>
          <span style={ui.gananciaSummaryLabel}>Precio sugerido</span>
          <strong style={ui.gananciaSummaryValue}>{formatMoney(precioSugerido)}</strong>
        </div>
        <div style={ui.gananciaSummaryCard}>
          <span style={ui.gananciaSummaryLabel}>Ganancia estimada</span>
          <strong style={ui.gananciaSummaryValue}>{formatMoney(resumen.ganancia)}</strong>
        </div>
      </div>

      <div style={ui.gananciaActions}>
        <button
          type="button"
          style={ui.secondaryButton}
          disabled={!puedeAplicar}
          onClick={() => onAplicarMinorista?.(String(precioSugerido))}
        >
          Usar como minorista
        </button>
        <button
          type="button"
          style={ui.secondaryButton}
          disabled={!puedeAplicar}
          onClick={() => onAplicarMayorista?.(String(precioSugerido))}
        >
          Usar como mayorista
        </button>
      </div>
    </section>
  );
}

const defaultStyles = {
  gananciaBox: {
    display: "grid",
    gap: 10,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
    background: "#ffffff",
  },
  gananciaTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#172033",
  },
  gananciaHelp: {
    margin: "2px 0 0",
    color: "#5f6f82",
    fontSize: 12,
  },
  gananciaControls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },
  label: {
    display: "grid",
    gap: 5,
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    padding: "8px 10px",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#ffffff",
  },
  gananciaSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 8,
  },
  gananciaSummaryCard: {
    display: "grid",
    gap: 3,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 9,
    background: "#f8fafc",
  },
  gananciaSummaryLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  gananciaSummaryValue: {
    color: "#0f172a",
    fontSize: 16,
  },
  gananciaActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    padding: "8px 10px",
    background: "#fff",
    color: "#111827",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};
