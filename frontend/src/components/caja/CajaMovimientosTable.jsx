import { Card, Table } from "../ui";
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
      <Table
        columns={MOVIMIENTOS_COLUMNS}
        data={movimientos}
        emptyMessage="Sin movimientos registrados."
        renderRow={(mov) => (
          <>
            <td style={tdStyle}>{new Date(mov.fecha).toLocaleString("es-AR")}</td>
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
            <td style={tdStyle}>{mov.id_usuario ? `Usuario #${mov.id_usuario}` : "-"}</td>
            <td style={tdStyle}>{mov.nota || "-"}</td>
          </>
        )}
      />
    </Card>
  );
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
