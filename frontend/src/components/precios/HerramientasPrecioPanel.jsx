import CalculadoraPrecioPagoPreview from "./CalculadoraPrecioPagoPreview";
import CalculadoraGananciaPanel from "./CalculadoraGananciaPanel";

export default function HerramientasPrecioPanel({
  costo,
  porcentajeDescuentoContado,
  onAplicarMinorista,
  onAplicarMayorista,
  mostrarGanancia = false,
  mostrarContadoLista = true,
  mostrarAccionesContado = true,
  textoAyuda = "Calculá precio lista desde lo que querés recibir contado. Solo completa campos; no guarda cambios.",
  styles,
}) {
  const tieneCosto = Number(costo || 0) > 0;

  if (!mostrarContadoLista && (!mostrarGanancia || !tieneCosto)) {
    return null;
  }

  return (
    <section style={styles?.priceToolsBox || localStyles.box}>
      <div style={styles?.priceToolsHeader || localStyles.header}>
        <div>
          <h3 style={styles?.priceToolsTitle || localStyles.title}>
            Herramienta de precio
          </h3>
          <p style={styles?.priceToolsHelp || localStyles.help}>
            {textoAyuda}
          </p>
        </div>
      </div>

      <div style={styles?.priceToolsGrid || localStyles.grid}>
        {mostrarContadoLista && (
          <CalculadoraPrecioPagoPreview
            porcentajeDescuentoContado={porcentajeDescuentoContado}
            onAplicarMinorista={onAplicarMinorista}
            onAplicarMayorista={onAplicarMayorista}
            mostrarAcciones={mostrarAccionesContado}
          />
        )}

        {mostrarGanancia && tieneCosto && (
          <details style={localStyles.advancedBox}>
            <summary style={localStyles.advancedSummary}>
              Herramienta avanzada: calcular por ganancia
            </summary>
            <div style={localStyles.advancedContent}>
              <CalculadoraGananciaPanel
                costo={costo}
                onAplicarMinorista={onAplicarMinorista}
                onAplicarMayorista={onAplicarMayorista}
                styles={styles}
              />
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

const localStyles = {
  box: {
    display: "grid",
    gap: 12,
    border: "1px solid #dbeafe",
    borderRadius: 14,
    padding: 12,
    background: "#f8fbff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "start",
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
  },
  help: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gap: 10,
  },
  advancedBox: {
    borderTop: "1px solid #dbeafe",
    paddingTop: 10,
  },
  advancedSummary: {
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    color: "#475467",
  },
  advancedContent: {
    marginTop: 10,
  },
};
