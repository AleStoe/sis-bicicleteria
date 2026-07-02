import { formatMoney, formatNumber } from "../../utils/formatters";
import { getEstadoStock } from "../../utils/stockUtils";
import { colors } from "../../theme";

export default function StockTable({
  stockFiltrado,
  seleccionado,
  seleccionarItem,
  styles,
  EstadoBadge,
  ordenarPor,
  orden,
  onOrdenar,
}) {
  function SortHeader({ campo, align = "left", children }) {
    const activo = ordenarPor === campo;
    const flecha = activo ? (orden === "asc" ? "▲" : "▼") : "↕";

    return (
      <button
        type="button"
        onClick={() => onOrdenar?.(campo)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          width: "100%",
          display: "inline-flex",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          alignItems: "center",
          gap: 6,
          color: activo ? colors.primary : colors.textMuted,
          font: "inherit",
          fontWeight: activo ? 950 : 900,
          textTransform: "inherit",
          letterSpacing: "inherit",
          whiteSpace: "nowrap",
          wordBreak: "normal",
          cursor: "pointer",
        }}
        title={`Ordenar por ${String(children).toLowerCase()}`}
      >
        <span>{children}</span>
        <span style={{ fontSize: 10, opacity: activo ? 1 : 0.55 }}>{flecha}</span>
      </button>
    );
  }

  return (
    <>
      <style>{responsiveCss}</style>

      <div className="stock-desktop-table">
        <table style={styles.table}>
          <colgroup>
            <col style={{ width: 290 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 118 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 180 }} />
          </colgroup>
          <thead style={styles.thead}>
            <tr>
              <th style={styles.th}><SortHeader campo="producto">Producto</SortHeader></th>
              <th style={styles.th}><SortHeader campo="categoria">Tipo</SortHeader></th>
              <th style={styles.th}><SortHeader campo="marca">Marca / proveedor</SortHeader></th>
              <th style={styles.thNumber}><SortHeader campo="fisico" align="right">Físico</SortHeader></th>
              <th style={styles.thNumber}>Reservado</th>
              <th style={styles.thNumber}>Pendiente</th>
              <th style={styles.thNumber}><SortHeader campo="stock" align="right">Disponible</SortHeader></th>
              <th style={styles.thNumber}><SortHeader campo="capital" align="right">Capital</SortHeader></th>
              <th style={styles.th}><SortHeader campo="ultima_venta">Última venta</SortHeader></th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {stockFiltrado.map((item) => {
              const estado = getEstadoStock(item);
              const activo = esSeleccionado(seleccionado, item);

              return (
                <tr
                  key={`${item.sucursal_id}-${item.variante_id}`}
                  onClick={() => seleccionarItem(item, "detalle")}
                  style={activo ? styles.trActive : styles.tr}
                >
                  <td style={styles.tdProduct}>
                    <strong style={styles.productName}>{item.producto_nombre}</strong>
                    <div style={styles.variantName}>{item.nombre_variante}</div>
                    <div style={styles.mutedSmall}>
                      SKU: {item.sku || "-"} · Proveedor: {item.codigo_proveedor || "-"} · Variante #{item.variante_id}
                    </div>
                  </td>

                  <td style={styles.td}>
                    <strong>{item.tipo_operativo || "producto"}</strong>
                    <div style={styles.mutedSmall}>{item.categoria_nombre || "Sin categoría"}</div>
                  </td>

                  <td style={styles.td}>
                    <strong>{item.marca_nombre || "Sin marca"}</strong>
                    <div style={styles.mutedSmall}>{item.proveedor_nombre || "Sin proveedor"}</div>
                  </td>

                  <td style={styles.tdNumber}>{formatNumber(item.stock_fisico)}</td>
                  <td style={styles.tdNumber}>{formatNumber(item.stock_reservado)}</td>
                  <td style={styles.tdNumber}>{formatNumber(item.stock_vendido_pendiente_entrega)}</td>
                  <td style={styles.tdNumberStrong}>{formatNumber(item.stock_disponible)}</td>
                  <td style={styles.tdNumber}>{formatMoney(item.capital_inmovilizado || 0)}</td>

                  <td style={styles.td}>
                    {formatFechaUltimaVenta(item.ultima_venta)}
                    <div style={styles.mutedSmall}>{formatDiasSinMovimiento(item)}</div>
                  </td>

                  <td style={styles.td}>
                    <EstadoBadge estado={estado} />
                  </td>

                  <td style={styles.td}>
                    <div style={styles.rowActions}>
                      <button
                        type="button"
                        style={styles.actionButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          seleccionarItem(item, "ingreso");
                        }}
                      >
                        Cargar ingreso
                      </button>

                      <button
                        type="button"
                        style={styles.dangerOutlineButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          seleccionarItem(item, "ajuste");
                        }}
                      >
                        Ajustar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="stock-mobile-cards">
        {stockFiltrado.map((item) => {
          const estado = getEstadoStock(item);
          const activo = esSeleccionado(seleccionado, item);

          return (
            <article
              key={`mobile-${item.sucursal_id}-${item.variante_id}`}
              className={activo ? "stock-mobile-card stock-mobile-card-active" : "stock-mobile-card"}
              onClick={() => seleccionarItem(item, "detalle")}
            >
              <div className="stock-card-top">
                <div>
                  <strong className="stock-card-title">{item.producto_nombre}</strong>
                  <div className="stock-card-variant">{item.nombre_variante || `Variante #${item.variante_id}`}</div>
                </div>
                <EstadoBadge estado={estado} />
              </div>

              <div className="stock-card-codes">
                <span>SKU: {item.sku || "-"}</span>
                <span>Proveedor: {item.codigo_proveedor || "-"}</span>
                <span>Variante #{item.variante_id}</span>
              </div>

              <div className="stock-card-main-number">
                <span>Disponible</span>
                <strong>{formatNumber(item.stock_disponible)}</strong>
              </div>

              <div className="stock-card-grid">
                <MiniDato label="Físico" value={formatNumber(item.stock_fisico)} />
                <MiniDato label="Reservado" value={formatNumber(item.stock_reservado)} />
                <MiniDato label="Pendiente" value={formatNumber(item.stock_vendido_pendiente_entrega)} />
                <MiniDato label="Capital" value={formatMoney(item.capital_inmovilizado || 0)} />
              </div>

              <div className="stock-card-meta">
                <div>
                  <span>Tipo</span>
                  <strong>{item.tipo_operativo || "producto"}</strong>
                  <small>{item.categoria_nombre || "Sin categoría"}</small>
                </div>
                <div>
                  <span>Marca / proveedor</span>
                  <strong>{item.marca_nombre || "Sin marca"}</strong>
                  <small>{item.proveedor_nombre || "Sin proveedor"}</small>
                </div>
                <div>
                  <span>Última venta</span>
                  <strong>{formatFechaUltimaVenta(item.ultima_venta)}</strong>
                  <small>{formatDiasSinMovimiento(item)}</small>
                </div>
              </div>

              <div className="stock-card-actions">
                <button
                  type="button"
                  style={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    seleccionarItem(item, "ingreso");
                  }}
                >
                  Cargar ingreso
                </button>

                <button
                  type="button"
                  style={styles.dangerOutlineButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    seleccionarItem(item, "ajuste");
                  }}
                >
                  Ajustar
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function MiniDato({ label, value }) {
  return (
    <div className="stock-card-mini-dato">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function esSeleccionado(seleccionado, item) {
  return (
    seleccionado?.variante_id === item.variante_id &&
    seleccionado?.sucursal_id === item.sucursal_id
  );
}

function formatFechaUltimaVenta(fecha) {
  return fecha ? new Date(fecha).toLocaleDateString("es-AR") : "Nunca";
}

function formatDiasSinMovimiento(item) {
  return item.dias_sin_movimiento !== null && item.dias_sin_movimiento !== undefined
    ? `${item.dias_sin_movimiento} días`
    : "Sin dato";
}

const responsiveCss = `
  .stock-mobile-cards {
    display: none;
  }

  @media (max-width: 768px) {
    .stock-desktop-table {
      display: none;
    }

    .stock-mobile-cards {
      display: grid;
      gap: 12px;
      padding: 12px;
      background: #f9fafb;
    }

    .stock-mobile-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 14px;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
      display: grid;
      gap: 12px;
      cursor: pointer;
    }

    .stock-mobile-card-active {
      border-color: #93c5fd;
      background: #eff6ff;
    }

    .stock-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .stock-card-title {
      display: block;
      color: #111827;
      font-size: 15px;
      line-height: 1.25;
    }

    .stock-card-variant {
      color: #374151;
      font-size: 13px;
      margin-top: 3px;
    }

    .stock-card-codes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: #6b7280;
      font-size: 12px;
    }

    .stock-card-codes span {
      background: #f3f4f6;
      border-radius: 999px;
      padding: 4px 8px;
    }

    .stock-card-main-number {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      border-radius: 14px;
      padding: 12px;
    }

    .stock-card-main-number span {
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .stock-card-main-number strong {
      color: #1d4ed8;
      font-size: 26px;
      line-height: 1;
    }

    .stock-card-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .stock-card-mini-dato {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 9px;
      background: #ffffff;
      display: grid;
      gap: 3px;
    }

    .stock-card-mini-dato span,
    .stock-card-meta span {
      color: #6b7280;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .stock-card-mini-dato strong {
      color: #111827;
      font-size: 15px;
    }

    .stock-card-meta {
      display: grid;
      gap: 8px;
    }

    .stock-card-meta > div {
      display: grid;
      gap: 2px;
      border-top: 1px solid #f3f4f6;
      padding-top: 8px;
    }

    .stock-card-meta strong {
      color: #111827;
      font-size: 13px;
    }

    .stock-card-meta small {
      color: #6b7280;
      font-size: 12px;
    }

    .stock-card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .stock-card-actions button {
      width: 100%;
      min-height: 42px;
    }
  }
`;
