import { formatNumber, formatMoney } from "../../utils/formatters";
import { esVarianteUnica } from "../../utils/productPresentation";

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
  ReadOnlyField,
  TextInput,
}) {
  const resumenIngreso = calcularResumenIngreso(ingresoForm);

  return (
    <aside className="erp-responsive-drawer-overlay" style={styles.overlay} onClick={cerrarPanel}>
      <div className="erp-responsive-drawer" style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Detalle de stock</p>
            <h2 style={styles.title}>{seleccionado.producto_nombre}</h2>
            {!esVarianteUnica(seleccionado.nombre_variante) && (
              <p style={styles.muted}>{seleccionado.nombre_variante}</p>
            )}
          </div>

          <button type="button" onClick={cerrarPanel} style={styles.closeButton}>
            ×
          </button>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            style={modoPanel === "detalle" ? styles.activeTab : styles.tab}
            onClick={() => setModoPanel("detalle")}
          >
            Detalle
          </button>

          <button
            type="button"
            style={modoPanel === "ingreso" ? styles.activeTab : styles.tab}
            onClick={() => setModoPanel("ingreso")}
          >
            Ingreso
          </button>

          <button
            type="button"
            style={modoPanel === "ajuste" ? styles.activeTab : styles.tab}
            onClick={() => setModoPanel("ajuste")}
          >
            Ajuste
          </button>
        </div>

        {modoPanel === "detalle" && (
          <div style={styles.content}>
            <section style={styles.stockHero}>
              <span>Disponible</span>
              <strong>{formatNumber(seleccionado.stock_disponible)}</strong>
            </section>

            <InfoRow label="Sucursal" value={seleccionado.sucursal_nombre} />
            <InfoRow label="SKU" value={seleccionado.sku || "-"} />
            <InfoRow label="Variante ID" value={`#${seleccionado.variante_id}`} />
            <InfoRow label="Stock físico" value={formatNumber(seleccionado.stock_fisico)} />
            <InfoRow label="Reservado" value={formatNumber(seleccionado.stock_reservado)} />
            <InfoRow
              label="Pendiente entrega"
              value={formatNumber(seleccionado.stock_vendido_pendiente_entrega)}
            />
            <InfoRow label="Disponible" value={formatNumber(seleccionado.stock_disponible)} />

            <div className="erp-drawer-actions-mobile" style={styles.actions}>
              <button type="button" style={styles.primaryButton} onClick={() => setModoPanel("ingreso")}>
                Registrar ingreso
              </button>

              <button type="button" style={styles.dangerButton} onClick={() => setModoPanel("ajuste")}>
                Ajustar stock
              </button>
            </div>

            <div style={styles.note}>
              El disponible se calcula como físico menos reservado menos pendiente de entrega.
            </div>
          </div>
        )}

        {modoPanel === "ingreso" && (
          <form onSubmit={handleIngreso} style={styles.content}>
            <ReadOnlyField label="Sucursal" value={seleccionado.sucursal_nombre} />
            <ReadOnlyField label="Variante" value={`#${seleccionado.variante_id}`} />

            <label style={styles.field}>
              <span style={styles.label}>Modo de carga</span>
              <select
                value={ingresoForm.modo_costo || "unitario"}
                onChange={(e) =>
                  setIngresoForm((p) => ({
                    ...p,
                    modo_costo: e.target.value,
                  }))
                }
                style={styles.input}
              >
                <option value="unitario">Por costo unitario</option>
                <option value="total">Por costo total</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Proveedor</span>
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
                <option value="">Seleccionar proveedor...</option>
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

            {(ingresoForm.modo_costo || "unitario") === "unitario" ? (
              <TextInput
                label="Costo unitario"
                type="number"
                value={ingresoForm.costo_unitario}
                onChange={(v) =>
                  setIngresoForm((p) => ({
                    ...p,
                    costo_unitario: v,
                  }))
                }
              />
            ) : (
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
            )}

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

            <div style={styles.previewBox}>
              <span>Costo productos total</span>
              <strong>{formatMoney(resumenIngreso.costoProductosTotal)}</strong>
            </div>

            <div style={styles.previewBox}>
              <span>Costo final estimado por unidad</span>
              <strong>{formatMoney(resumenIngreso.costoFinalUnitario)}</strong>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Observación</span>
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

            <button type="submit" disabled={procesando} style={styles.primaryButton}>
              {procesando ? "Guardando..." : "Registrar ingreso"}
            </button>
          </form>
        )}

        {modoPanel === "ajuste" && (
          <form onSubmit={handleAjuste} style={styles.content}>
            <ReadOnlyField label="Sucursal" value={seleccionado.sucursal_nombre} />
            <ReadOnlyField label="Variante" value={`#${seleccionado.variante_id}`} />

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
              <span style={styles.label}>Motivo obligatorio</span>
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

            <button type="submit" disabled={procesando} style={styles.dangerButton}>
              {procesando ? "Guardando..." : "Registrar ajuste"}
            </button>

            <div style={styles.warningNote}>
              Usá ajuste solo para diferencias reales de inventario. Ventas, reservas,
              entregas y taller tienen sus propios movimientos.
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}

function calcularResumenIngreso(form) {
  const cantidad = Number(form.cantidad_ingresada || 0);
  const costoProductos =
    (form.modo_costo || "unitario") === "unitario"
      ? cantidad * Number(form.costo_unitario || 0)
      : Number(form.costo_productos || 0);
  const gastos = Number(form.gastos_adicionales || 0);

  if (cantidad <= 0) {
    return {
      costoProductosTotal: costoProductos,
      costoFinalUnitario: 0,
    };
  }

  return {
    costoProductosTotal: costoProductos,
    costoFinalUnitario: (costoProductos + gastos) / cantidad,
  };
}
