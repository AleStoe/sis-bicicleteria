const MEDIOS_PAGO = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta",
];

export default function DeudaPagoPanel({
  deuda,
  pagoForm,
  setPagoForm,
  registrarPago,
  guardando,
}) {
  const deudaAbierta = deuda.estado === "abierta";

  return (
    <aside style={cardStyle}>
      <h2 style={cardTitleStyle}>Registrar pago</h2>

      {!deudaAbierta ? (
        <div style={noteStyle}>
          La deuda no está abierta. No se pueden registrar pagos.
        </div>
      ) : (
        <form
          onSubmit={registrarPago}
          style={{ display: "grid", gap: "12px" }}
        >
          <label style={fieldStyle}>
            <span style={labelStyle}>Monto</span>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={pagoForm.monto}
              onChange={(e) =>
                setPagoForm((p) => ({
                  ...p,
                  monto: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </label>

          <button
            type="button"
            disabled={guardando}
            onClick={() =>
              setPagoForm((p) => ({
                ...p,
                monto: String(deuda.saldo_actual),
              }))
            }
          >
            Usar saldo total
          </button>

          <label style={fieldStyle}>
            <span style={labelStyle}>Medio de pago</span>

            <select
              value={pagoForm.medio_pago}
              onChange={(e) =>
                setPagoForm((p) => ({
                  ...p,
                  medio_pago: e.target.value,
                }))
              }
              style={inputStyle}
            >
              {MEDIOS_PAGO.map((medio) => (
                <option key={medio} value={medio}>
                  {medio}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Nota</span>

            <textarea
              value={pagoForm.nota}
              onChange={(e) =>
                setPagoForm((p) => ({
                  ...p,
                  nota: e.target.value,
                }))
              }
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
              placeholder="Opcional"
            />
          </label>

          <button type="submit" disabled={guardando}>
            Registrar pago
          </button>

          <div style={noteStyle}>
            Si no hay caja abierta, el backend va a rechazar el pago.
          </div>
        </form>
      )}
    </aside>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
};

const cardTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  fontSize: "20px",
};

const noteStyle = {
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "12px",
  borderRadius: "8px",
  color: "#344054",
  marginTop: "4px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  fontSize: "15px",
  boxSizing: "border-box",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};

const labelStyle = {
  fontWeight: "bold",
  fontSize: "14px",
};