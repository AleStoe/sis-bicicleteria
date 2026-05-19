const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "tarjeta", label: "Tarjeta" },
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
            {form.modo === "cobrado"
              ? "Ingresá lo que entra a caja. El sistema calcula la base."
              : "Ingresá la base comercial. El sistema calcula el cobrado real."}
          </div>
        </div>

        <div style={styles.modeSwitch}>
          <button
            type="button"
            disabled={!puedePagar || guardando}
            onClick={() => setForm({ modo: "cobrado" })}
            style={form.modo === "cobrado" ? styles.modeActive : styles.mode}
          >
            Cobrado
          </button>

          <button
            type="button"
            disabled={!puedePagar || guardando}
            onClick={() => setForm({ modo: "base" })}
            style={form.modo === "base" ? styles.modeActive : styles.mode}
          >
            Base
          </button>
        </div>
      </div>

      <div style={styles.mediosRow}>
        {MEDIOS_PAGO.map((medio) => (
          <button
            key={medio.value}
            type="button"
            disabled={!puedePagar || guardando}
            onClick={() => setForm({ medio_pago: medio.value })}
            style={form.medio_pago === medio.value ? styles.medioActive : styles.medio}
          >
            {medio.label}
          </button>
        ))}
      </div>

      {form.medio_pago === "tarjeta" && (
        <div style={styles.tarjetaBox}>
          <label style={styles.field}>
            <span style={styles.label}>Cuotas</span>
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
                    <option
                        key={plan.id}
                        value={`${plan.cuotas}__${plan.entidad || ""}`}
                    >
                        {plan.entidad ? `${plan.entidad} · ` : ""}
                        {plan.cuotas} cuota(s) · {Number(plan.porcentaje_recargo_cliente || 0).toFixed(2)}%
                    </option>
                    ))
                )}
                </select>
          </label>

            <div style={styles.field}>
                <span style={styles.label}>Entidad</span>

                <div style={styles.readonlyBox}>
                    {form.entidad || "Sin especificar"}
                </div>
            </div>
        </div>
      )}

      <div style={styles.mainRow}>
        <label style={styles.field}>
          <span style={styles.label}>
            {form.modo === "cobrado" ? "Monto cobrado real" : "Monto base"}
          </span>

          <input
            ref={montoRef}
            type="text"
            inputMode="decimal"
            value={
                form.monto === "0" ||
                form.monto === "0.00" ||
                form.monto === 0
                ? ""
                : form.monto
            }
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
                const value = e.target.value
                .replace(",", ".")
                .replace(/[^0-9.]/g, "");

                setForm({ monto: value });
            }}
            style={styles.amountInput}
            disabled={!puedePagar || guardando}
            placeholder=""
            />
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

        <button
          type="submit"
          disabled={!puedePagar || guardando || simulando}
          style={styles.primaryButton}
        >
          {guardando ? "Registrando..." : "Registrar"}
        </button>
      </div>

      <div style={styles.quickRow}>
        <button type="button" disabled={!puedePagar || guardando || simulando} onClick={onSaldar} style={styles.quickBtn}>
          Saldar
        </button>

        <button type="button" disabled={!puedePagar || guardando} onClick={onMitad} style={styles.quickBtn}>
          Mitad
        </button>

        <button type="button" disabled={!puedePagar || guardando} onClick={onLimpiar} style={styles.quickBtn}>
          Limpiar
        </button>
      </div>
    </form>
  );
}

const styles = {
  card: {
    border: "1px solid #eaecf0",
    borderRadius: 14,
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

  modeSwitch: {
    display: "inline-flex",
    border: "1px solid #d0d5dd",
    borderRadius: 999,
    padding: 3,
    background: "#f9fafb",
  },

  mode: {
    border: "none",
    background: "transparent",
    borderRadius: 999,
    padding: "7px 13px",
    fontWeight: 800,
    cursor: "pointer",
    color: "#344054",
  },

  modeActive: {
    border: "none",
    background: "#1f6feb",
    color: "white",
    borderRadius: 999,
    padding: "7px 13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  mediosRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  medio: {
    border: "1px solid #d0d5dd",
    background: "white",
    color: "#344054",
    borderRadius: 999,
    padding: "8px 13px",
    fontWeight: 800,
    cursor: "pointer",
  },

  medioActive: {
    border: "1px solid #1f6feb",
    background: "#eff6ff",
    color: "#1f6feb",
    borderRadius: 999,
    padding: "8px 13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  tarjetaBox: {
    display: "grid",
    gridTemplateColumns: "160px minmax(220px, 1fr)",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    background: "#f9fafb",
    border: "1px solid #eaecf0",
  },

  mainRow: {
    display: "grid",
    gridTemplateColumns: "180px minmax(260px, 1fr) 140px",
    gap: 12,
    alignItems: "end",
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
  border: "2px solid #d0d5dd",
  borderRadius: 14,
  fontSize: 28,
  fontWeight: 900,
  background: "white",
  textAlign: "center",
  letterSpacing: "-0.02em",
  color: "#111827",
},

  primaryButton: {
    border: "none",
    background: "#12a15f",
    color: "white",
    borderRadius: 10,
    padding: "11px 14px",
    fontWeight: 900,
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