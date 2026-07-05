const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo", helper: "Contado" },
  { value: "transferencia", label: "Transferencia", helper: "Banco" },
  { value: "mercadopago", label: "MercadoPago", helper: "QR" },
  { value: "tarjeta", label: "Tarjeta", helper: "Plan" },
];

export default function PagoVentaFormulario({
  form,
  setForm,
  puedePagar,
  guardando,
  simulando,
  montoRef,
  onSubmit,
  onSaldar,
  onMitad,
  onLimpiar,
  planesTarjeta = [],
}) {
  return (
    <form onSubmit={onSubmit} style={styles.card}>
      <div style={styles.topRow}>
        <div>
          <div style={styles.sectionTitle}>Nuevo tramo de pago</div>
          <div style={styles.sectionHint}>
            Cargá cuánto paga el cliente. El sistema calcula cuánto cubre de la venta.
          </div>
        </div>
      </div>

      <div style={styles.paymentGrid}>
        {MEDIOS_PAGO.map((medio) => {
          const activo = form.medio_pago === medio.value;

          return (
            <button
              key={medio.value}
              type="button"
              disabled={!puedePagar || guardando}
              onClick={() => setForm({ medio_pago: medio.value })}
              style={{
                ...styles.methodCard,
                ...(activo ? styles.methodCardActive : {}),
              }}
            >
              <span style={styles.methodText}>{medio.label}</span>
              <small style={activo ? styles.methodHelperActive : styles.methodHelper}>
                {medio.helper}
              </small>
            </button>
          );
        })}
      </div>

      {["tarjeta", "mercadopago"].includes(form.medio_pago) && (
        <div style={styles.tarjetaBox}>
          <label style={styles.field}>
            <span style={styles.label}>
              {form.medio_pago === "mercadopago" ? "Plan QR aplicado" : "Cuotas"}
            </span>
            <select
              value={`${form.cuotas || ""}__${form.entidad || ""}`}
              onChange={(e) => {
                const plan = planesTarjeta.find(
                  (p) => `${p.cuotas}__${p.entidad || ""}` === e.target.value
                );

                if (!plan) return;

                setForm({
                  cuotas: plan.cuotas,
                  entidad: plan.entidad || "",
                });
              }}
              style={styles.input}
              disabled={!puedePagar || guardando || planesTarjeta.length === 0}
            >
              {planesTarjeta.length === 0 ? (
                <option value="">Sin planes activos</option>
              ) : (
                planesTarjeta.map((plan) => (
                  <option key={plan.id} value={`${plan.cuotas}__${plan.entidad || ""}`}>
                    {plan.nombre || (plan.entidad ? `${plan.entidad} - ` : "")}
                    {" · "}
                    {Number(plan.porcentaje_recargo_cliente || 0).toFixed(2)}%
                    {" al cliente"}
                  </option>
                ))
              )}
            </select>
          </label>

          <div style={styles.field}>
            <span style={styles.label}>
              {form.medio_pago === "mercadopago" ? "Medio" : "Entidad"}
            </span>

            <div style={styles.readonlyBox}>{form.entidad || "Sin especificar"}</div>
          </div>
        </div>
      )}

      <div style={styles.mainRow}>
        <label style={styles.field}>
          <span style={styles.label}>
            {form.medio_pago === "tarjeta"
              ? "Monto final en tarjeta"
              : form.medio_pago === "mercadopago"
                ? "Monto por MercadoPago QR"
                : "Cliente paga"}
          </span>

          <input
            ref={montoRef}
            type="text"
            inputMode="numeric"
            value={
              form.monto === "0" || form.monto === "0.00" || form.monto === 0
                ? ""
                : form.monto
            }
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, "");

              setForm({ monto: value });
            }}
            style={styles.amountInput}
            disabled={!puedePagar || guardando}
            placeholder="Ej: 20000"
          />
          <small style={styles.inputHelp}>
            El detalle muestra cuánto cubre de la venta.
          </small>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Nota</span>

          <input
            value={form.nota}
            onChange={(e) => setForm({ nota: e.target.value })}
            placeholder="Opcional"
            style={styles.input}
            disabled={!puedePagar || guardando}
          />
        </label>

        <div style={styles.actionsColumn}>
          <button
            type="button"
            disabled={!puedePagar || guardando || simulando}
            onClick={onSaldar}
            style={styles.saldarButton}
          >
            {simulando ? "Calculando..." : "Saldar"}
          </button>

          <button
            type="submit"
            disabled={!puedePagar || guardando || simulando}
            style={styles.primaryButton}
          >
            {guardando ? "Registrando..." : `Agregar pago ${MEDIOS_PAGO.find((m) => m.value === form.medio_pago)?.label || ""}`}
          </button>
        </div>
      </div>

      <div style={styles.quickRow}>
        <button
          type="button"
          disabled={!puedePagar || guardando}
          onClick={onMitad}
          style={styles.quickBtn}
        >
          Mitad
        </button>

        <button
          type="button"
          disabled={!puedePagar || guardando}
          onClick={onLimpiar}
          style={styles.quickBtn}
        >
          Limpiar
        </button>
      </div>
    </form>
  );
}

const styles = {
  card: {
    border: "1px solid #dbe7fb",
    borderRadius: 18,
    padding: 14,
    background: "#ffffff",
    display: "grid",
    gap: 12,
    marginTop: 14,
    marginBottom: 12,
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#111827",
  },

  sectionHint: {
    fontSize: 13,
    color: "#667085",
    marginTop: 3,
  },

  paymentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 8,
  },

  methodCard: {
    border: "1px solid #dbe7fb",
    background: "#f8fbff",
    borderRadius: 14,
    padding: "12px 10px",
    display: "grid",
    justifyItems: "center",
    gap: 4,
    cursor: "pointer",
    color: "#334155",
  },

  methodCardActive: {
    borderColor: "#f97316",
    background: "#fff7ed",
    boxShadow: "0 0 0 2px rgba(249, 115, 22, 0.14)",
    color: "#9a3412",
  },

  methodText: {
    fontWeight: 950,
    fontSize: 13,
  },

  methodHelper: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 11,
  },

  methodHelperActive: {
    color: "#c2410c",
    fontWeight: 900,
    fontSize: 11,
  },

  tarjetaBox: {
    display: "grid",
    gridTemplateColumns: "160px minmax(220px, 1fr)",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #dbe7fb",
  },

  mainRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "end",
  },

  actionsColumn: {
    display: "grid",
    gap: 8,
  },

  quickRow: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-start",
  },

  field: {
    display: "grid",
    gap: 5,
  },

  label: {
    fontWeight: 800,
    fontSize: 13,
    color: "#344054",
  },

  inputHelp: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.35,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: 10,
    fontSize: 14,
    background: "white",
  },

  amountInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    border: "2px solid #cbd5e1",
    borderRadius: 14,
    fontSize: 28,
    fontWeight: 900,
    background: "white",
    textAlign: "center",
    color: "#111827",
  },

  primaryButton: {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
  },

  saldarButton: {
    border: "none",
    borderRadius: 14,
    background: "#0f172a",
    color: "white",
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
  },

  quickBtn: {
    border: "1px solid #d0d5dd",
    background: "white",
    color: "#344054",
    borderRadius: 9,
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },

  readonlyBox: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #eaecf0",
    borderRadius: 10,
    fontSize: 14,
    background: "#f9fafb",
    color: "#667085",
  },
};
