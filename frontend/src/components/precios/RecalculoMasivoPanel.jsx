import { formatMoney, formatPercent } from "../../utils/formatters";

export default function RecalculoMasivoPanel({
  proveedores,
  idProveedor,
  setIdProveedor,
  tipoCliente,
  setTipoCliente,
  motivoMasivo,
  setMotivoMasivo,
  loading,
  procesando,
  buscarDesfasados,
  generarPreview,
  aplicarCambios,
  resumenMasivo,
  preview,
  desfasados,
  setPreview,
  setDesfasados,
  styles,
  InfoBox,
}) {
  return (
    <>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Recalculo por proveedor</h2>

        <div style={styles.filters}>
          <label style={styles.label}>
            Proveedor
            <select
              style={styles.input}
              value={idProveedor}
              onChange={(e) => {
                setIdProveedor(e.target.value);
                setPreview(null);
                setDesfasados([]);
              }}
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
            Tipo cliente
            <select
              style={styles.input}
              value={tipoCliente}
              onChange={(e) => setTipoCliente(e.target.value)}
            >
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>

          <label style={styles.label}>
            Motivo
            <input
              style={styles.input}
              value={motivoMasivo}
              onChange={(e) => setMotivoMasivo(e.target.value)}
            />
          </label>
        </div>

        <div style={styles.actions}>
          <button
            style={styles.secondaryButton}
            type="button"
            onClick={buscarDesfasados}
            disabled={loading || procesando}
          >
            {loading ? "Buscando..." : "Ver desfasados"}
          </button>

          <button
            style={styles.secondaryButton}
            type="button"
            onClick={generarPreview}
            disabled={procesando}
          >
            {procesando ? "Procesando..." : "Preview recalculo"}
          </button>

          <button
            style={styles.primaryButton}
            type="button"
            onClick={aplicarCambios}
            disabled={procesando || !preview || preview.total_detectados === 0}
          >
            Aplicar cambios
          </button>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <InfoBox label="Desfasados" value={resumenMasivo.cantidad} />
        <InfoBox label="Subas acumuladas" value={formatMoney(resumenMasivo.subas)} />
        <InfoBox label="Bajas acumuladas" value={formatMoney(resumenMasivo.bajas)} />
        <InfoBox
          label="Modo"
          value={preview?.aplicado ? "Aplicado" : preview ? "Preview" : "-"}
        />
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <h2 style={styles.cardTitle}>Resultado</h2>
          <span style={styles.counter}>{desfasados.length} item(s)</span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.tableMedium}>
            <thead>
              <tr>
                <th style={styles.th}>Producto</th>
                <th style={styles.th}>Variante</th>
                <th style={styles.th}>Costo</th>
                <th style={styles.th}>Actual</th>
                <th style={styles.th}>Sugerido</th>
                <th style={styles.th}>Dif.</th>
                <th style={styles.th}>Margen real</th>
                <th style={styles.th}>Regla</th>
                <th style={styles.th}>Estado</th>
              </tr>
            </thead>

            <tbody>
              {desfasados.map((item) => (
                <tr key={`${item.id_variante}-${item.tipo_cliente}`}>
                  <td style={styles.tdProduct}>{item.producto_nombre}</td>
                  <td style={styles.td}>{item.nombre_variante}</td>
                  <td style={styles.td}>{formatMoney(item.costo_base)}</td>
                  <td style={styles.td}>{formatMoney(item.precio_actual)}</td>
                  <td style={styles.tdStrong}>{formatMoney(item.precio_sugerido)}</td>
                  <td
                    style={{
                      ...styles.tdStrong,
                      color: Number(item.diferencia) >= 0 ? "#137333" : "#b42318",
                    }}
                  >
                    {formatMoney(item.diferencia)}
                  </td>
                  <td style={styles.td}>{formatPercent(item.margen_real)}</td>
                  <td style={styles.td}>{item.regla_nombre}</td>
                  <td style={styles.td}>
                    {item.aplicado ? (
                      <span style={{ ...styles.badge, ...styles.badgeOk }}>
                        Aplicado
                      </span>
                    ) : (
                      <span style={{ ...styles.badge, ...styles.badgePreview }}>
                        Preview
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {!loading && desfasados.length === 0 && (
                <tr>
                  <td style={styles.empty} colSpan={9}>
                    No hay resultados para mostrar.
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
