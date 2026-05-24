import { formatNumber } from "../../utils/formatters";

export default function StockDrawer({
  seleccionado,
  cerrarPanel,
  modoPanel,
  setModoPanel,
  handleIngreso,
  handleAjuste,
  ingresoForm,
  setIngresoForm,
  ajusteForm,
  setAjusteForm,
  proveedores,
  procesando,
  styles,
  InfoRow,
  TextInput,
}) {
  return (
    <aside style={styles.overlay} onClick={cerrarPanel}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0 }}>
              {seleccionado.producto_nombre}
            </h2>

            <p style={styles.muted}>
              {seleccionado.nombre_variante}
            </p>
          </div>

          <button onClick={cerrarPanel}>×</button>
        </div>

        <div style={styles.tabs}>
          <button
            style={
              modoPanel === "detalle"
                ? styles.activeTab
                : styles.tab
            }
            onClick={() => setModoPanel("detalle")}
          >
            Detalle
          </button>

          <button
            style={
              modoPanel === "ingreso"
                ? styles.activeTab
                : styles.tab
            }
            onClick={() => setModoPanel("ingreso")}
          >
            Ingreso
          </button>

          <button
            style={
              modoPanel === "ajuste"
                ? styles.activeTab
                : styles.tab
            }
            onClick={() => setModoPanel("ajuste")}
          >
            Ajuste
          </button>
        </div>

        {modoPanel === "detalle" && (
          <div style={styles.content}>
            <InfoRow
              label="Sucursal"
              value={seleccionado.sucursal_nombre}
            />

            <InfoRow
              label="SKU"
              value={seleccionado.sku || "-"}
            />

            <InfoRow
              label="Variante ID"
              value={`#${seleccionado.variante_id}`}
            />

            <InfoRow
              label="Stock físico"
              value={formatNumber(seleccionado.stock_fisico)}
            />

            <InfoRow
              label="Reservado"
              value={formatNumber(seleccionado.stock_reservado)}
            />

            <InfoRow
              label="Pendiente entrega"
              value={formatNumber(
                seleccionado.stock_vendido_pendiente_entrega
              )}
            />

            <InfoRow
              label="Disponible"
              value={formatNumber(seleccionado.stock_disponible)}
            />

            <div style={styles.actions}>
              <button onClick={() => setModoPanel("ingreso")}>
                Registrar ingreso
              </button>

              <button onClick={() => setModoPanel("ajuste")}>
                Ajustar stock
              </button>
            </div>

            <div style={styles.note}>
              El stock disponible se calcula como físico -
              reservado - pendiente de entrega.
            </div>
          </div>
        )}

        {modoPanel === "ingreso" && (
          <form onSubmit={handleIngreso} style={styles.content}>
            <TextInput
              label="Sucursal"
              value={ingresoForm.id_sucursal}
              onChange={(v) =>
                setIngresoForm((p) => ({
                  ...p,
                  id_sucursal: v,
                }))
              }
            />

            <TextInput
              label="Variante"
              value={ingresoForm.id_variante}
              onChange={(v) =>
                setIngresoForm((p) => ({
                  ...p,
                  id_variante: v,
                }))
              }
            />

            <label style={styles.field}>
              <span style={styles.label}>
                Proveedor
              </span>

              <select
                value={ingresoForm.id_proveedor}
                onChange={(e) =>
                  setIngresoForm((p) => ({
                    ...p,
                    id_proveedor: e.target.value,
                  }))
                }
                style={styles.input}
              >
                <option value="">
                  Seleccionar proveedor...
                </option>

                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} - {p.nombre}
                  </option>
                ))}
              </select>
            </label>

            <TextInput
              label="Cantidad ingresada"
              type="number"
              value={ingresoForm.cantidad_ingresada}
              onChange={(v) =>
                setIngresoForm((p) => ({
                  ...p,
                  cantidad_ingresada: v,
                }))
              }
            />

            <TextInput
              label="Costo productos total"
              type="number"
              value={ingresoForm.costo_productos}
              onChange={(v) =>
                setIngresoForm((p) => ({
                  ...p,
                  costo_productos: v,
                }))
              }
            />

            <TextInput
              label="Gastos adicionales"
              type="number"
              value={ingresoForm.gastos_adicionales}
              onChange={(v) =>
                setIngresoForm((p) => ({
                  ...p,
                  gastos_adicionales: v,
                }))
              }
            />

            <label style={styles.field}>
              <span style={styles.label}>
                Observación
              </span>

              <textarea
                value={ingresoForm.observacion}
                onChange={(e) =>
                  setIngresoForm((p) => ({
                    ...p,
                    observacion: e.target.value,
                  }))
                }
                style={styles.textarea}
                placeholder="Factura, remito, reposición..."
              />
            </label>

            <button type="submit" disabled={procesando}>
              {procesando
                ? "Guardando..."
                : "Registrar ingreso"}
            </button>
          </form>
        )}

        {modoPanel === "ajuste" && (
          <form onSubmit={handleAjuste} style={styles.content}>
            <TextInput
              label="Sucursal"
              value={ajusteForm.id_sucursal}
              onChange={(v) =>
                setAjusteForm((p) => ({
                  ...p,
                  id_sucursal: v,
                }))
              }
            />

            <TextInput
              label="Variante"
              value={ajusteForm.id_variante}
              onChange={(v) =>
                setAjusteForm((p) => ({
                  ...p,
                  id_variante: v,
                }))
              }
            />

            <TextInput
              label="Cantidad (+ suma / - resta)"
              type="number"
              value={ajusteForm.cantidad}
              onChange={(v) =>
                setAjusteForm((p) => ({
                  ...p,
                  cantidad: v,
                }))
              }
            />

            <label style={styles.field}>
              <span style={styles.label}>
                Motivo obligatorio
              </span>

              <textarea
                value={ajusteForm.nota}
                onChange={(e) =>
                  setAjusteForm((p) => ({
                    ...p,
                    nota: e.target.value,
                  }))
                }
                style={styles.textarea}
                placeholder="Conteo físico, diferencia detectada..."
              />
            </label>

            <button type="submit" disabled={procesando}>
              {procesando
                ? "Guardando..."
                : "Registrar ajuste"}
            </button>

            <div style={styles.note}>
              Usá ajuste solo para diferencias reales de
              inventario. Ventas, reservas, entregas y taller
              tienen sus propios movimientos.
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}