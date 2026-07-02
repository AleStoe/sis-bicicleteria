export default function CheckoutResumenPago({
  total,
  totalOriginal,
  pagado,
  pendiente,

  usarCredito,
  setUsarCredito,
  montoCreditoAAplicar,
  setMontoCreditoAAplicar,
  creditoDisponible,
  creditoAplicado,
  saldoCreditoRestante,
  creditoCubreSaldo = false,
  saldoAntesCredito = 0,

  cantidadItems,
  formatMoney,
  montoCobroSugerido,
  medioPago,
}) {
  const estaSaldada = Number(pendiente || 0) <= 0;
  const tieneSugerencia = montoCobroSugerido != null && !estaSaldada;
  const totalLista = Number(totalOriginal ?? total ?? 0);
  const totalConReglas = Number(total ?? 0);
  const hayAjusteReglas = Math.abs(totalLista - totalConReglas) > 0.01;
  return (
    <div style={styles.box}>
      <div style={styles.header}>
        <div>
          <span style={styles.kicker}>Resumen de cobro</span>
          <h3 style={styles.title}>
            {estaSaldada ? "Venta cubierta" : "Saldo pendiente"}
          </h3>
          <p style={styles.sub}>
            {cantidadItems} item{cantidadItems === 1 ? "" : "s"} en la venta.
          </p>
        </div>

        <div style={estaSaldada ? styles.pillOk : styles.pillPending}>
          {estaSaldada ? "Cubierta" : "Pendiente"}
        </div>
      </div>

      <div style={styles.totalLine}>
        <span>Total venta</span>
        <strong>{formatMoney(totalLista)}</strong>
      </div>

      {hayAjusteReglas && (
        <div style={styles.totalLineMuted}>
          <span>Total final de venta</span>
          <strong>{formatMoney(totalConReglas)}</strong>
        </div>
      )}
      {creditoDisponible > 0 && (
        <div style={styles.creditBox}>
          <div style={styles.creditHeader}>
            <span>Crédito disponible</span>

            <label style={styles.creditToggle}>
              <input
                type="checkbox"
                checked={usarCredito}
                onChange={(e) => setUsarCredito(e.target.checked)}
              />
              <span>Usar</span>
            </label>
          </div>

          <strong style={styles.creditAvailable}>
            {formatMoney(creditoDisponible)}
          </strong>

          {usarCredito && (
            <>
              {creditoCubreSaldo && (
                <div style={styles.creditCoverageNotice}>
                  <strong>El crédito cubre completamente la venta.</strong>
                  <span>
                    {estaSaldada
                      ? "No necesitás cargar otro medio de pago. Podés finalizar la venta."
                      : `Alcanza para cubrir los ${formatMoney(saldoAntesCredito)} pendientes. Tocá “Aplicar crédito y completar saldo” para continuar.`}
                  </span>
                </div>
              )}

              <div style={styles.creditApplied}>
                <span>Aplicado</span>
                <strong>- {formatMoney(creditoAplicado)}</strong>
              </div>

              <label style={styles.creditManualBox}>
                <span>Aplicar manualmente</span>

                <input
                  type="text"
                  inputMode="decimal"
                  value={montoCreditoAAplicar}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(",", ".")
                      .replace(/[^0-9.]/g, "");

                    setMontoCreditoAAplicar(value);
                  }}
                  placeholder="Automático"
                  style={styles.creditInput}
                />
              </label>

              {saldoCreditoRestante > 0 && (
                <small style={styles.creditRemaining}>
                  Quedan {formatMoney(saldoCreditoRestante)} disponibles.
                </small>
              )}
            </>
          )}
        </div>
      )}
      <div style={styles.totalLine}>
        <span>Pagos cargados</span>
        <strong>{formatMoney(pagado)}</strong>
      </div>

      <div style={estaSaldada ? styles.amountOk : styles.amountPending}>
        <span>{estaSaldada ? "Listo para finalizar" : "Saldo de venta pendiente"}</span>
        <strong>{formatMoney(Math.max(Number(pendiente || 0), 0))}</strong>
      </div>

      {tieneSugerencia && (
        <div style={styles.cashHint}>
          <span>{getSugerenciaTitulo(medioPago)}</span>
          <strong>{formatMoney(montoCobroSugerido)}</strong>
          <small>{getSugerenciaDetalle(medioPago)}</small>
        </div>
      )}
    </div>
  );
}

function getMedioLabel(medio) {
  const labels = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    mercadopago: "MercadoPago",
  };

  return labels[medio] || "el medio seleccionado";
}

function getSugerenciaTitulo(medio) {
  if (medio === "tarjeta") return "Total necesario en tarjeta para cancelar la venta";
  return "Total a cobrar para cancelar la venta";
}

function getSugerenciaDetalle(medio) {
  const label = getMedioLabel(medio);

  if (medio === "tarjeta") {
    return "Si abona el saldo restante con tarjeta, este es el monto final.";
  }

  return `Si abona el saldo restante en ${label}, este es el monto a cobrar.`;
}

const styles = {
  box: {
    border: "1px solid #dbe2ea",
    borderRadius: 16,
    padding: 14,
    background: "white",
    marginBottom: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  kicker: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 2,
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  sub: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  pillPending: {
    borderRadius: 999,
    padding: "6px 9px",
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fdba74",
    fontSize: 11,
    fontWeight: 1000,
  },
  pillOk: {
    borderRadius: 999,
    padding: "6px 9px",
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #86efac",
    fontSize: 11,
    fontWeight: 1000,
  },
  totalLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "7px 0",
    borderTop: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },
  amountPending: {
    marginTop: 8,
    borderRadius: 14,
    padding: "12px 14px",
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  amountOk: {
    marginTop: 8,
    borderRadius: 14,
    padding: "12px 14px",
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#166534",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  cashHint: {
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    display: "grid",
    gap: 2,
    textAlign: "center",
    fontSize: 13,
    fontWeight: 800,
  },
  creditBox: {
  marginTop: 10,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 10,
},

creditHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  fontWeight: 900,
  color: "#1e3a8a",
},

creditToggle: {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  color: "#1d4ed8",
},

creditAvailable: {
  fontSize: 22,
  fontWeight: 1000,
  color: "#0f172a",
},

creditApplied: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  fontWeight: 900,
  color: "#047857",
},

creditCoverageNotice: {
  display: "grid",
  gap: 4,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #86efac",
  background: "#ecfdf5",
  color: "#166534",
  fontSize: 13,
  lineHeight: 1.4,
},

creditManualBox: {
  display: "grid",
  gap: 6,
},

creditInput: {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  background: "white",
},

creditRemaining: {
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
},
totalLineMuted: {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 0",
  borderTop: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
},
};
