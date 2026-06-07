import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPerfilParticipanteCapital } from "../services/capitalRetirosService";
import { formatDate, formatMoney } from "../utils/formatters";
import ParticipantePerfilResumen from "../components/capitalRetiros/ParticipantePerfilResumen";

const tiposMovimiento = {
  aporte_capital: "Aporte de capital",
  prestamo_socio: "Préstamo al negocio",
  devolucion_prestamo: "Devolución de préstamo",
  retiro_personal: "Retiro personal",
  distribucion_ganancia: "Distribución de ganancia",
};

const card = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(15,23,42,.06)",
};

const secondaryButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  color: "#344054",
  fontWeight: 750,
  cursor: "pointer",
  textDecoration: "none",
};

function tipoLabel(value) {
  return tiposMovimiento[value] || value;
}

function money(value) {
  return formatMoney(value || 0);
}

export default function CapitalRetirosParticipantePerfilPage() {
  const { participanteId } = useParams();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarPerfil() {
      setLoading(true);
      setError("");

      try {
        const data = await getPerfilParticipanteCapital(participanteId);
        setPerfil(data);
      } catch (err) {
        setError(err.message || "No se pudo cargar el perfil del participante");
      } finally {
        setLoading(false);
      }
    }

    cargarPerfil();
  }, [participanteId]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ ...card, padding: 18 }}>Cargando perfil...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, display: "grid", gap: 14 }}>
        <Link to="/capital-retiros" style={secondaryButton}>← Volver</Link>
        <div style={{ ...card, padding: 18, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>{error}</div>
      </div>
    );
  }

  const participante = perfil?.participante;
  const movimientos = perfil?.movimientos || [];

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <Link to="/capital-retiros" style={{ ...secondaryButton, marginBottom: 12 }}>← Volver a Capital y Retiros</Link>
          <h1 style={{ margin: 0, color: "#101828" }}>{participante?.nombre || "Participante"}</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            {participante?.tipo} · {participante?.activo ? "Activo" : "Inactivo"}
          </p>
          {participante?.observaciones ? (
            <p style={{ margin: "8px 0 0", color: "#475467" }}>{participante.observaciones}</p>
          ) : null}
        </div>
      </header>

      <ParticipantePerfilResumen perfil={perfil} />

      <section style={{ ...card, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Historial del participante</h2>
            <p style={{ margin: "4px 0 0", color: "#667085" }}>Lectura de movimientos cargados desde Capital y Retiros.</p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                <th style={{ padding: 10 }}>Fecha</th>
                <th style={{ padding: 10 }}>Tipo</th>
                <th style={{ padding: 10 }}>Descripción</th>
                <th style={{ padding: 10 }}>Medio</th>
                <th style={{ padding: 10 }}>Caja</th>
                <th style={{ padding: 10 }}>Estado</th>
                <th style={{ padding: 10, textAlign: "right" }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: 18, color: "#667085" }}>Sin movimientos para este participante.</td>
                </tr>
              ) : movimientos.map((mov) => (
                <tr key={mov.id} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={{ padding: 10 }}>{formatDate(mov.fecha)}</td>
                  <td style={{ padding: 10 }}>{tipoLabel(mov.tipo_movimiento)}</td>
                  <td style={{ padding: 10, color: "#475467" }}>{mov.descripcion}</td>
                  <td style={{ padding: 10 }}>{mov.medio_pago || "-"}</td>
                  <td style={{ padding: 10 }}>{mov.impacta_caja ? `Sí #${mov.id_caja_movimiento || "-"}` : "No"}</td>
                  <td style={{ padding: 10 }}>{mov.estado}</td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: 900 }}>{money(mov.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
