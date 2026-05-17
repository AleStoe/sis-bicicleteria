import { formatMoney } from "../../../utils/formatters";
import { Card, Table } from "../../ui";

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "tipo", label: "Tipo" },
  { key: "monto", label: "Monto" },
  { key: "origen", label: "Origen" },
  { key: "nota", label: "Nota" },
  { key: "usuario", label: "Usuario" },
];

export default function DeudaMovimientosTable({ movimientos }) {
  return (
    <Card title="Movimientos" subtitle="Historial de movimientos de la deuda">
      <Table
        columns={COLUMNS}
        data={movimientos}
        emptyMessage="No hay movimientos registrados."
        renderRow={(mov) => (
          <>
            <td style={tdStyle}>#{mov.id}</td>
            <td style={tdStyle}>{mov.tipo_movimiento}</td>
            <td style={{ ...tdStyle, fontWeight: 800 }}>
              {formatMoney(mov.monto)}
            </td>
            <td style={tdStyle}>
              {mov.origen_tipo ? `${mov.origen_tipo} #${mov.origen_id}` : "-"}
            </td>
            <td style={tdStyle}>{mov.nota || "-"}</td>
            <td style={tdStyle}>#{mov.id_usuario}</td>
          </>
        )}
      />
    </Card>
  );
}

const tdStyle = {
  padding: "12px 16px",
  whiteSpace: "nowrap",
};
