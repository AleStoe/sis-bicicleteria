import { formatNumber } from "../../utils/formatters";
import { getEstadoStock } from "../../utils/stockUtils";

export default function StockTable({
  stockFiltrado,
  seleccionado,
  seleccionarItem,
  styles,
  EstadoBadge,
}) {
  return (
    <table style={styles.table}>
      <thead style={{ background: "#f9fafb" }}>
        <tr>
          <th style={styles.th}>Producto</th>
          <th style={styles.th}>Sucursal</th>
          <th style={styles.th}>Físico</th>
          <th style={styles.th}>Reservado</th>
          <th style={styles.th}>Pendiente</th>
          <th style={styles.th}>Disponible</th>
          <th style={styles.th}>Estado</th>
          <th style={styles.th}>Acciones</th>
        </tr>
      </thead>

      <tbody>
        {stockFiltrado.map((item) => {
          const estado = getEstadoStock(item);

          return (
            <tr
              key={`${item.sucursal_id}-${item.variante_id}`}
              onClick={() => seleccionarItem(item, "detalle")}
              style={{
                borderTop: "1px solid #eee",
                cursor: "pointer",
                background:
                  seleccionado?.variante_id === item.variante_id &&
                  seleccionado?.sucursal_id === item.sucursal_id
                    ? "#f8fbff"
                    : "white",
              }}
            >
              <td style={styles.td}>
                <strong>{item.producto_nombre}</strong>

                <div>{item.nombre_variante}</div>

                <div style={styles.mutedSmall}>
                  SKU: {item.sku || "-"} · Variante #{item.variante_id}
                </div>
              </td>

              <td style={styles.td}>{item.sucursal_nombre}</td>

              <td style={styles.td}>
                {formatNumber(item.stock_fisico)}
              </td>

              <td style={styles.td}>
                {formatNumber(item.stock_reservado)}
              </td>

              <td style={styles.td}>
                {formatNumber(item.stock_vendido_pendiente_entrega)}
              </td>

              <td style={styles.td}>
                <strong>
                  {formatNumber(item.stock_disponible)}
                </strong>
              </td>

              <td style={styles.td}>
                <EstadoBadge estado={estado} />
              </td>

              <td style={styles.td}>
                <div style={styles.rowActions}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      seleccionarItem(item, "ingreso");
                    }}
                  >
                    Ingreso
                  </button>

                  <button
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