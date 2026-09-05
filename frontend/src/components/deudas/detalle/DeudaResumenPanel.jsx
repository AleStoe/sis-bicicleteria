import { formatMoney } from "../../../utils/formatters";
import { Card, MetricCard } from "../../ui";
import { EstadoDeudaBadge } from "../../../pages/DeudasListPage";

export default function DeudaResumenPanel({ deuda }) {
  const saldoPendiente = Number(deuda.saldo_actual || 0);
  const estadoVisual = saldoPendiente > 0 ? deuda.estado : "cerrada";

  return (
    <Card title="Resumen" subtitle="Estado general de la cuenta corriente">
      <div style={infoGridStyle}>
        <MetricCard
          label="Estado"
          value={<EstadoDeudaBadge estado={estadoVisual} />}
        />

        <MetricCard
          label="Saldo pendiente"
          value={formatMoney(deuda.saldo_actual)}
          tone={saldoPendiente > 0 ? "danger" : "success"}
          emphasize
        />

        <MetricCard
          label="Cliente"
          value={deuda.cliente_nombre || `Cliente #${deuda.id_cliente}`}
          footer={[
            deuda.cliente_dni ? `DNI ${deuda.cliente_dni}` : "",
            deuda.cliente_telefono || "",
          ]
            .filter(Boolean)
            .join(" · ")}
        />

        <MetricCard
          label="Origen"
          value={`${deuda.origen_tipo} #${deuda.origen_id}`}
        />

        <MetricCard
          label="Genera recargo"
          value={deuda.genera_recargo ? "Sí" : "No"}
        />

        <MetricCard
          label="Tasa recargo"
          value={deuda.tasa_recargo || "-"}
        />

        <MetricCard
          label="Próximo vencimiento"
          value={deuda.proximo_vencimiento || "-"}
        />

        <div style={observacionStyle}>
          <div style={{ color: "#667085", fontSize: 12, fontWeight: 700 }}>
            Observación
          </div>
          <strong>{deuda.observacion || "-"}</strong>
        </div>
      </div>
    </Card>
  );
}

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "12px",
};

const observacionStyle = {
  gridColumn: "1 / -1",
  background: "#f9fafb",
  border: "1px solid #eaecf0",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 6,
};
