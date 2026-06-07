import { formatMoney, formatNumber } from "../../utils/formatters";
import { getEstadoStock } from "../../utils/stockUtils";

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
          color: activo ? "#1d4ed8" : "#6b7280",
          font: "inherit",
          fontWeight: activo ? 950 : 900,
          textTransform: "inherit",
          letterSpacing: "inherit",
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
    <table style={styles.table}>
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
          const activo =
            seleccionado?.variante_id === item.variante_id &&
            seleccionado?.sucursal_id === item.sucursal_id;

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
                {item.ultima_venta ? new Date(item.ultima_venta).toLocaleDateString("es-AR") : "Nunca"}
                <div style={styles.mutedSmall}>
                  {item.dias_sin_movimiento !== null && item.dias_sin_movimiento !== undefined
                    ? `${item.dias_sin_movimiento} días`
                    : "Sin dato"}
                </div>
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
                    Ingreso
                  </button>

                  <button
                    type="button"
                    style={styles.dangerOutlineButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      seleccionarItem(item, "ajuste");
                    }}
                  >
                    Ajuste
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
