import { formatMoney } from "../../utils/formatters";

function money(value) {
  return formatMoney(value || 0);
}

const card = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(15,23,42,.06)",
};

function Metric({ title, value, tone = "default" }) {
  const color = tone === "danger" ? "#b91c1c" : tone === "accent" ? "#f97316" : "#101828";

  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ color: "#667085", fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ color, fontSize: 22, fontWeight: 950, marginTop: 6 }}>{money(value)}</div>
    </div>
  );
}

export default function ParticipantePerfilResumen({ perfil }) {
  const resumen = perfil?.resumen || {};

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
      <Metric title="Saldo préstamo pendiente" value={resumen.saldo_prestamos} tone="accent" />
      <Metric title="Total prestado" value={resumen.total_prestamos} />
      <Metric title="Total devuelto" value={resumen.total_devoluciones_prestamo} />
      <Metric title="Aportes de capital" value={resumen.total_aportes} />
      <Metric title="Retiros personales" value={resumen.total_retiros} tone="danger" />
      <Metric title="Distribuciones" value={resumen.total_distribuciones} />
    </section>
  );
}
