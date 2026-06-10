import { Card, ResponsiveTableCards } from "../ui";
import MovimientoCajaBadge, {
  getMovimientoMontoColor,
} from "./MovimientoCajaBadge";

const MOVIMIENTOS_COLUMNS = [
  { key: "fecha", label: "Fecha" },
  { key: "tipo", label: "Tipo" },
  { key: "submedio", label: "Submedio" },
  { key: "monto", label: "Monto" },
  { key: "origen", label: "Origen" },
  { key: "usuario", label: "Usuario" },
  { key: "nota", label: "Nota" },
];

export default function CajaMovimientosTable({ movimientos, formatCurrency }) {
  return (
    <Card title="Movimientos" subtitle="Historial completo de movimientos de caja">
      <ResponsiveTableCards
        columns={MOVIMIENTOS_COLUMNS}
        data={movimientos}
        emptyMessage="Sin movimientos registrados."
        cardKey={(mov, index) => mov.id || `${mov.fecha}-${index}`}
        renderRow={(mov) => (
          <>
            <td style={tdStyle}>{formatFecha(mov.fecha)}</td>
            <td style={tdStyle}>
              <MovimientoCajaBadge movimiento={mov} />
            </td>
            <td style={tdStyle}>{mov.submedio || "-"}</td>
            <td
              style={{
                ...tdStyle,
                color: getMovimientoMontoColor(mov),
                fontWeight: 700,
              }}
            >
              {formatCurrency(mov.monto)}
            </td>
            <td style={tdStyle}>{formatOrigen(mov)}</td>
            <td style={tdStyle}>{formatUsuario(mov)}</td>
            <td style={tdStyle}>{mov.nota || "-"}</td>
          </>
        )}
        renderCard={(mov) => (
          <div style={styles.mobileCardContent}>
            <div style={styles.mobileHeader}>
              <div>
                <MovimientoCajaBadge movimiento={mov} />
                <div style={styles.mobileDate}>{formatFecha(mov.fecha)}</div>
              </div>

              <strong
                style={{
                  ...styles.mobileAmount,
                  color: getMovimientoMontoColor(mov),
                }}
              >
                {formatCurrency(mov.monto)}
              </strong>
            </div>

            <div style={styles.mobileGrid}>
              <MobileField label="Submedio" value={mov.submedio || "-"} />
              <MobileField label="Origen" value={formatOrigen(mov)} />
              <MobileField
                label="Usuario"
                value={formatUsuario(mov)}
              />
              <MobileField label="Nota" value={mov.nota || "-"} full />
            </div>
          </div>
        )}
      />
    </Card>
  );
}

function MobileField({ label, value, full = false }) {
  return (
    <div style={{ ...styles.mobileField, ...(full ? styles.mobileFieldFull : {}) }}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatUsuario(mov) {
  if (mov.usuario_nombre) {
    return mov.usuario_username
      ? `${mov.usuario_nombre} (@${mov.usuario_username})`
      : mov.usuario_nombre;
  }

  return mov.id_usuario ? `Usuario #${mov.id_usuario}` : "-";
}

function formatFecha(fecha) {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString("es-AR");
}

function formatOrigen(movimiento) {
  if (!movimiento.origen_tipo) return "-";

  return `${movimiento.origen_tipo}${
    movimiento.origen_id ? ` #${movimiento.origen_id}` : ""
  }`;
}

const tdStyle = {
  padding: "12px 16px",
  whiteSpace: "nowrap",
};

const styles = {
  mobileCardContent: {
    display: "grid",
    gap: "12px",
  },
  mobileHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  mobileDate: {
    marginTop: "6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },
  mobileAmount: {
    fontSize: "17px",
    whiteSpace: "nowrap",
  },
  mobileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  mobileField: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "10px",
    background: "#f8fafc",
    display: "grid",
    gap: "3px",
    minWidth: 0,
  },
  mobileFieldFull: {
    gridColumn: "1 / -1",
  },
};
