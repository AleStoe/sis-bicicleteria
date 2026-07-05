import { formatMoney } from "../../utils/formatters";

export default function AjusteRapidoProveedorPanel({
  proveedores,
  form,
  setForm,
  resultado,
  loading,
  procesando,
  onPreview,
  onAplicar,
  styles,
}) {
  const items = resultado?.items || [];

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  return (
    <>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Ajuste rápido por proveedor</h2>
        <p style={styles.mutedText}>
          Para listas nuevas de proveedor. No usa reglas de precio.
        </p>

        <div style={styles.quickGrid}>
          <label style={styles.label}>
            Proveedor
            <select
              style={styles.input}
              value={form.id_proveedor}
              onChange={(e) => updateField("id_proveedor", e.target.value)}
            >
              <option value="">Seleccionar proveedor...</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} - {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Aplicar sobre
            <select
              style={styles.input}
              value={form.aplicar_sobre}
              onChange={(e) => updateField("aplicar_sobre", e.target.value)}
            >
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
              <option value="ambos">Ambos</option>
            </select>
          </label>

          <label style={styles.label}>
            Tipo ajuste
            <select
              style={styles.input}
              value={form.tipo_ajuste}
              onChange={(e) => updateField("tipo_ajuste", e.target.value)}
            >
              <option value="porcentaje">Porcentaje</option>
              <option value="monto_fijo">Monto fijo</option>
            </select>
          </label>

          <label style={styles.label}>
            Valor ajuste
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={form.valor}
              onChange={(e) => updateField("valor", e.target.value)}
              placeholder={form.tipo_ajuste === "porcentaje" ? "15" : "1000"}
            />
          </label>
        </div>

        <div style={styles.checkboxGrid}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.solo_productos_activos}
              onChange={(e) => updateField("solo_productos_activos", e.target.checked)}
            />
            Solo productos activos
          </label>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.solo_variantes_activas}
              onChange={(e) => updateField("solo_variantes_activas", e.target.checked)}
            />
            Solo variantes activas
          </label>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.solo_con_stock}
              onChange={(e) => updateField("solo_con_stock", e.target.checked)}
            />
            Solo con stock
          </label>
        </div>

        <label style={styles.label}>
          Motivo
          <input
            style={styles.input}
            value={form.motivo}
            onChange={(e) => updateField("motivo", e.target.value)}
            placeholder="Aumento lista proveedor"
          />
        </label>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onPreview}
            disabled={loading || procesando}
          >
            {procesando ? "Procesando..." : "Previsualizar"}
          </button>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={onAplicar}
            disabled={procesando || !resultado || items.length === 0 || resultado.aplicado}
          >
            Aplicar cambios
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <h2 style={styles.cardTitle}>Preview ajuste rápido</h2>
          <span style={styles.counter}>
            {items.length} item(s) {resultado?.aplicado ? "aplicado(s)" : ""}
          </span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.tableWide}>
            <thead>
              <tr>
                <th style={styles.th}>Producto</th>
                <th style={styles.th}>Variante</th>
                <th style={styles.th}>Minorista actual</th>
                <th style={styles.th}>Minorista nuevo</th>
                <th style={styles.th}>Dif. minorista</th>
                <th style={styles.th}>Mayorista actual</th>
                <th style={styles.th}>Mayorista nuevo</th>
                <th style={styles.th}>Dif. mayorista</th>
                <th style={styles.th}>Estado</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id_variante}>
                  <td style={styles.tdProduct}>{item.producto_nombre}</td>
                  <td style={styles.td}>{item.nombre_variante}</td>
                  <td style={styles.td}>{formatMoney(item.precio_minorista_actual)}</td>
                  <td style={styles.tdStrong}>{formatMoney(item.precio_minorista_nuevo)}</td>
                  <td style={styles.tdStrong}>{formatMoney(item.diferencia_minorista)}</td>
                  <td style={styles.td}>{formatMoney(item.precio_mayorista_actual)}</td>
                  <td style={styles.tdStrong}>{formatMoney(item.precio_mayorista_nuevo)}</td>
                  <td style={styles.tdStrong}>{formatMoney(item.diferencia_mayorista)}</td>
                  <td style={styles.td}>
                    {item.aplicado ? (
                      <span style={{ ...styles.badge, ...styles.badgeOk }}>Aplicado</span>
                    ) : (
                      <span style={{ ...styles.badge, ...styles.badgePreview }}>Preview</span>
                    )}
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td style={styles.empty} colSpan={9}>
                    No hay cambios para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
