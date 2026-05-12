export default function AltaMercaderiaIngresoFields({
  form,
  setCampo,
  costoRef,
  costoUnitarioConGastos,
  totalProductos,
}) {
  return (
    <>
      <div style={styles.twoCols}>
        <label style={styles.label}>
          Cantidad *
          <input
            style={styles.input}
            type="number"
            value={form.cantidad}
            onChange={(e) => setCampo("cantidad", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          IVA
          <select
            style={styles.input}
            value={form.alicuota_iva}
            onChange={(e) => setCampo("alicuota_iva", e.target.value)}
          >
            <option value="21.00">21%</option>
            <option value="10.50">10.5%</option>
            <option value="27.00">27%</option>
            <option value="0">0%</option>
          </select>
        </label>
      </div>

      <label style={styles.label}>
        Costo unitario real *
        <input
          ref={costoRef}
          style={styles.input}
          type="number"
          value={form.costo_unitario}
          onChange={(e) => setCampo("costo_unitario", e.target.value)}
          placeholder="Costo final por unidad"
        />
      </label>

      <label style={styles.label}>
        Gastos adicionales
        <input
          style={styles.input}
          type="number"
          value={form.gastos_adicionales}
          onChange={(e) => setCampo("gastos_adicionales", e.target.value)}
        />
      </label>

      <div style={styles.calcBox}>
        <span>Total productos</span>
        <strong>{formatMoney(totalProductos)}</strong>
      </div>

      <div style={styles.calcBox}>
        <span>Costo unitario final</span>
        <strong>{formatMoney(costoUnitarioConGastos)}</strong>
      </div>

      <label style={styles.label}>
        Observación
        <textarea
          style={styles.textarea}
          value={form.observacion}
          onChange={(e) => setCampo("observacion", e.target.value)}
          placeholder="Factura, remito, observación..."
        />
      </label>
    </>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

const styles = {
  label: {
    display: "grid",
    gap: "6px",
    fontWeight: 700,
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "70px",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  calcBox: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
  },
};