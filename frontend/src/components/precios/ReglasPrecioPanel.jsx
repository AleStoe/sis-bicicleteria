import { formatMoney, formatPercent } from "../../utils/formatters";

function labelScope(regla) {
  const partes = [];

  if (regla.familia_precio_nombre) {
    partes.push(`Familia: ${regla.familia_precio_nombre}`);
  }

  if (regla.proveedor_nombre) {
    partes.push(`Proveedor: ${regla.proveedor_nombre}`);
  }

  if (regla.categoria_nombre) {
    partes.push(`Categoría: ${regla.categoria_nombre}`);
  }

  if (regla.marca_nombre) {
    partes.push(`Marca: ${regla.marca_nombre}`);
  }

  return partes.length ? partes.join(" · ") : "Global";
}

export default function ReglasPrecioPanel({
  reglaForm,
  setReglaForm,
  reglas,
  familias = [],
  proveedores = [],
  crearRegla,
  desactivarRegla,
  cargarInicial,
  procesando,
  styles,
}) {
  return (
    <div style={styles.rulesGrid}>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Crear regla de precio</h2>

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
              placeholder="Ej: Transmisión Topmega 130%"
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
            Familia de precio
            <select
              style={styles.input}
              value={reglaForm.id_familia_precio}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  id_familia_precio: e.target.value,
                }))
              }
            >
              <option value="">Todas</option>
              {familias.map((familia) => (
                <option key={familia.id} value={familia.id}>
                  {familia.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Proveedor
            <select
              style={styles.input}
              value={reglaForm.id_proveedor}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  id_proveedor: e.target.value,
                }))
              }
            >
              <option value="">Todos</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Margen objetivo %
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={reglaForm.margen_porcentaje}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  margen_porcentaje: e.target.value,
                }))
              }
              placeholder="Ej: 130"
            />
          </label>

          <label style={styles.label}>
            Descuento base %
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0"
              max="99.99"
              value={reglaForm.descuento_base_porcentaje}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  descuento_base_porcentaje: e.target.value,
                }))
              }
              placeholder="Ej: 10"
            />
          </label>

          <label style={styles.label}>
            Margen mínimo %
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={reglaForm.margen_minimo_porcentaje}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  margen_minimo_porcentaje: e.target.value,
                }))
              }
              placeholder="Ej: 100"
            />
          </label>

          <label style={styles.label}>
            Redondeo base
            <input
              style={styles.input}
              type="number"
              min="1"
              value={reglaForm.redondeo_base}
              onChange={(e) =>
                setReglaForm((p) => ({
                  ...p,
                  redondeo_base: e.target.value,
                }))
              }
              placeholder="Ej: 500"
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
          Si elegís familia + proveedor, esa regla pisa a la regla general de
          familia. Si no elegís nada, queda como regla global.
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
          <table style={styles.tableMedium}>
            <thead>
              <tr>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Alcance</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Margen objetivo</th>
                <th style={styles.th}>Desc. base</th>
                <th style={styles.th}>Margen mínimo</th>
                <th style={styles.th}>Redondeo</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {reglas.map((regla) => (
                <tr key={regla.id}>
                  <td style={styles.tdProduct}>{regla.nombre}</td>
                  <td style={styles.td}>{labelScope(regla)}</td>
                  <td style={styles.td}>{regla.tipo_cliente}</td>
                  <td style={styles.td}>
                    {formatPercent(regla.margen_porcentaje)}
                  </td>
                  <td style={styles.td}>
                    {formatPercent(regla.descuento_base_porcentaje || 0)}
                  </td>
                  <td style={styles.td}>
                    {formatPercent(regla.margen_minimo_porcentaje || 0)}
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
                  <td style={styles.empty} colSpan={9}>
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
