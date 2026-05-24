import { formatMoney, formatPercent } from "../../utils/formatters";

export default function ReglasPrecioPanel({
  reglaForm,
  setReglaForm,
  reglas,
  crearRegla,
  desactivarRegla,
  cargarInicial,
  procesando,
  styles,
}) {
  return (
    <div style={styles.rulesGrid}>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Crear regla global</h2>

        <form onSubmit={crearRegla} style={styles.form}>
          <label style={styles.label}>
            Nombre
            <input
              style={styles.input}
              value={reglaForm.nombre}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  nombre: e.target.value,
                }))
              }
              placeholder="Ej: Minorista general 120%"
            />
          </label>

          <label style={styles.label}>
            Tipo cliente
            <select
              style={styles.input}
              value={reglaForm.tipo_cliente}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  tipo_cliente: e.target.value,
                }))
              }
            >
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>

          <label style={styles.label}>
            Margen porcentaje
            <input
              style={styles.input}
              type="number"
              step="0.01"
              value={reglaForm.margen_porcentaje}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  margen_porcentaje: e.target.value,
                }))
              }
            />
          </label>

          <label style={styles.label}>
            Redondeo base
            <input
              style={styles.input}
              type="number"
              value={reglaForm.redondeo_base}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  redondeo_base: e.target.value,
                }))
              }
            />
          </label>

          <button
            type="submit"
            style={styles.primaryButton}
            disabled={procesando}
          >
            Crear regla
          </button>
        </form>

        <div style={styles.note}>
          Esta alta crea reglas globales. Las reglas por categoría/marca
          conviene hacerlas después con selector dedicado.
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <h2 style={styles.cardTitle}>Reglas</h2>

          <button
            type="button"
            onClick={cargarInicial}
            style={styles.secondaryButton}
          >
            Refrescar
          </button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Margen</th>
                <th style={styles.th}>Redondeo</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {reglas.map((regla) => (
                <tr key={regla.id}>
                  <td style={styles.tdStrong}>{regla.nombre}</td>
                  <td style={styles.td}>{regla.tipo_cliente}</td>
                  <td style={styles.td}>
                    {formatPercent(regla.margen_porcentaje)}
                  </td>

                  <td style={styles.td}>
                    {formatMoney(regla.redondeo_base)}
                  </td>

                  <td style={styles.td}>
                    {regla.activa ? (
                      <span
                        style={{
                          ...styles.badge,
                          ...styles.badgeOk,
                        }}
                      >
                        Activa
                      </span>
                    ) : (
                      <span
                        style={{
                          ...styles.badge,
                          ...styles.badgeOff,
                        }}
                      >
                        Inactiva
                      </span>
                    )}
                  </td>

                  <td style={styles.td}>
                    {regla.activa ? (
                      <button
                        type="button"
                        onClick={() => desactivarRegla(regla.id)}
                        disabled={procesando}
                      >
                        Desactivar
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {reglas.length === 0 && (
                <tr>
                  <td style={styles.empty} colSpan={6}>
                    No hay reglas cargadas.
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