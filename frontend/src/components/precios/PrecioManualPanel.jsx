import { formatMoney, formatPercent, formatDate } from "../../utils/formatters";

export default function PrecioManualPanel({
  buscarRef,
  query,
  setQuery,
  loading,
  procesando,
  resultados,
  seleccionarVariante,
  buscarVariantes,
  varianteSeleccionada,
  margenMinorista,
  margenMayorista,
  formPrecio,
  setFormPrecio,
  guardarPrecioManual,
  tipoSugerencia,
  setTipoSugerencia,
  calcularSugerencia,
  usarSugerencia,
  sugerencia,
  historial,
  styles,
  InfoBox,
}) {
  return (
    <div style={styles.manualGrid}>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Buscar variante</h2>

        <form onSubmit={buscarVariantes} style={styles.searchRow}>
          <input
            ref={buscarRef}
            style={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Producto, SKU, EAN o código proveedor"
          />
          <button type="submit" style={styles.primaryButton} disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        <div style={styles.results}>
          {resultados.map((item) => (
            <button
              key={item.id_variante}
              type="button"
              style={styles.resultItem}
              onClick={() => seleccionarVariante(item)}
            >
              <strong>
                {item.producto_nombre} - {item.nombre_variante}
              </strong>
              <span>
                SKU: {item.sku || "-"} · EAN: {item.codigo_barras || "-"} · Prov:{" "}
                {item.codigo_proveedor || "-"}
              </span>
              <span>
                Minorista: {formatMoney(item.precio_minorista)} · Mayorista:{" "}
                {formatMoney(item.precio_mayorista)}
              </span>
            </button>
          ))}

          {!loading && resultados.length === 0 && (
            <div style={styles.empty}>Buscá una variante para editar precio.</div>
          )}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Precio actual</h2>

        {!varianteSeleccionada ? (
          <div style={styles.empty}>Seleccioná una variante para editar precios.</div>
        ) : (
          <>
            <div style={styles.selectedBox}>
              <strong>
                {varianteSeleccionada.producto_nombre} -{" "}
                {varianteSeleccionada.nombre_variante}
              </strong>
              <span>SKU: {varianteSeleccionada.sku || "-"}</span>
            </div>

            <div style={styles.summaryGrid}>
              <InfoBox
                label="Costo promedio"
                value={formatMoney(varianteSeleccionada.costo_promedio_vigente)}
              />
              <InfoBox
                label="Minorista actual"
                value={formatMoney(varianteSeleccionada.precio_minorista)}
              />
              <InfoBox
                label="Mayorista actual"
                value={formatMoney(varianteSeleccionada.precio_mayorista)}
              />
              <InfoBox label="Margen minorista" value={formatPercent(margenMinorista)} />
              <InfoBox label="Margen mayorista" value={formatPercent(margenMayorista)} />
            </div>

            <form onSubmit={guardarPrecioManual} style={styles.form}>
              <label style={styles.label}>
                Precio minorista
                <input
                  style={styles.input}
                  type="number"
                  value={formPrecio.precio_minorista}
                  onChange={(e) =>
                    setFormPrecio((p) => ({ ...p, precio_minorista: e.target.value }))
                  }
                />
              </label>

              <label style={styles.label}>
                Precio mayorista
                <input
                  style={styles.input}
                  type="number"
                  value={formPrecio.precio_mayorista}
                  onChange={(e) =>
                    setFormPrecio((p) => ({ ...p, precio_mayorista: e.target.value }))
                  }
                />
              </label>

              <label style={styles.label}>
                Motivo
                <input
                  style={styles.input}
                  value={formPrecio.motivo}
                  onChange={(e) =>
                    setFormPrecio((p) => ({ ...p, motivo: e.target.value }))
                  }
                />
              </label>

              <button type="submit" style={styles.primaryButton} disabled={procesando}>
                Guardar precio
              </button>
            </form>

            <div style={styles.suggestionBox}>
              <h3 style={styles.cardTitle}>Sugerencia</h3>

              <div style={styles.searchRow}>
                <select
                  style={styles.input}
                  value={tipoSugerencia}
                  onChange={(e) => setTipoSugerencia(e.target.value)}
                >
                  <option value="minorista">Minorista</option>
                  <option value="mayorista">Mayorista</option>
                </select>

                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={calcularSugerencia}
                  disabled={procesando}
                >
                  Calcular
                </button>
              </div>

              {sugerencia && (
                <div style={styles.suggestionResult}>
                  <div>
                    <strong>{formatMoney(sugerencia.precio_sugerido)}</strong>
                    <span>
                      Regla: {sugerencia.regla_nombre || "-"} · Margen:{" "}
                      {formatPercent(sugerencia.margen_porcentaje)}
                    </span>
                  </div>

                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={usarSugerencia}
                  >
                    Usar sugerido
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section style={styles.cardWide}>
        <div style={styles.tableHeader}>
          <h2 style={styles.cardTitle}>Historial</h2>
          <span style={styles.counter}>{historial.length} movimiento(s)</span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Minorista</th>
                <th style={styles.th}>Mayorista</th>
                <th style={styles.th}>Costo</th>
                <th style={styles.th}>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((mov) => (
                <tr key={mov.id}>
                  <td style={styles.td}>{formatDate(mov.created_at)}</td>
                  <td style={styles.td}>{mov.tipo_movimiento}</td>
                  <td style={styles.td}>
                    {formatMoney(mov.precio_minorista_anterior)} →{" "}
                    <strong>{formatMoney(mov.precio_minorista_nuevo)}</strong>
                  </td>
                  <td style={styles.td}>
                    {formatMoney(mov.precio_mayorista_anterior)} →{" "}
                    <strong>{formatMoney(mov.precio_mayorista_nuevo)}</strong>
                  </td>
                  <td style={styles.td}>
                    {formatMoney(mov.costo_anterior)} → {formatMoney(mov.costo_nuevo)}
                  </td>
                  <td style={styles.td}>{mov.motivo || "-"}</td>
                </tr>
              ))}

              {historial.length === 0 && (
                <tr>
                  <td style={styles.empty} colSpan={6}>
                    Sin historial para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}