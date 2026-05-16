import { EstadoDeudaBadge } from "../../../pages/DeudasListPage";
import { formatMoney } from "../../../utils/formatters";

function Info({ label, value, full = false }) {
  return (
    <div
      style={{
        gridColumn: full ? "1 / -1" : "auto",
        background: "#f9fafb",
        border: "1px solid #eaecf0",
        borderRadius: "12px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#667085",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>

      <div style={{ fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

export default function DeudaResumenPanel({ deuda }) {
  return (
    <div style={cardStyle}>
      <h2 style={cardTitleStyle}>Resumen</h2>

      <div style={infoGridStyle}>
        <Info
          label="Estado"
          value={<EstadoDeudaBadge estado={deuda.estado} />}
        />

        <Info
          label="Saldo actual"
          value={formatMoney(deuda.saldo_actual)}
        />

        <Info
          label="Cliente"
          value={
            <div>
              <div>
                {deuda.cliente_nombre || `Cliente #${deuda.id_cliente}`}
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#667085",
                  marginTop: "4px",
                }}
              >
                {deuda.cliente_dni
                  ? `DNI ${deuda.cliente_dni}`
                  : ""}

                {deuda.cliente_telefono
                  ? ` · ${deuda.cliente_telefono}`
                  : ""}
              </div>
            </div>
          }
        />

        <Info
          label="Origen"
          value={`${deuda.origen_tipo} #${deuda.origen_id}`}
        />

        <Info
          label="Genera recargo"
          value={deuda.genera_recargo ? "Sí" : "No"}
        />

        <Info
          label="Tasa recargo"
          value={deuda.tasa_recargo || "-"}
        />

        <Info
          label="Próximo vencimiento"
          value={deuda.proximo_vencimiento || "-"}
        />

        <Info
          label="Observación"
          value={deuda.observacion || "-"}
          full
        />
      </div>
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "16px",
};

const cardTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  fontSize: "20px",
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};