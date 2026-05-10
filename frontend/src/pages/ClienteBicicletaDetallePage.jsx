import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { obtenerHistorialBicicletaCliente } from "../services/clientesService";

export default function ClienteBicicletaDetallePage() {
  const { clienteId, bicicletaId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarHistorial();
  }, [clienteId, bicicletaId]);

  async function cargarHistorial() {
    try {
      setLoading(true);
      setError("");

      const detalle = await obtenerHistorialBicicletaCliente(clienteId, bicicletaId);
      setData(detalle);
    } catch (err) {
      setError(err.message || "No se pudo cargar el historial de la bicicleta");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando historial de bicicleta...</p>;
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={alertStyle}>Error: {error}</div>
        <button style={secondaryBtnStyle} onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>
    );
  }

  const bicicleta = data?.bicicleta;
  const ventaOrigen = data?.venta_origen;
  const historialTaller = data?.historial_taller || [];

  if (!bicicleta) {
    return <p style={{ padding: "24px" }}>No se encontró la bicicleta.</p>;
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>
            {bicicleta.marca} {bicicleta.modelo}
          </h1>
          <p style={subtitleStyle}>
            Bicicleta #{bicicleta.id} · Cliente #{bicicleta.id_cliente}
          </p>
        </div>

        <div style={actionsStyle}>
          <button type="button" onClick={cargarHistorial} style={secondaryBtnStyle}>
            Refrescar
          </button>

          <Link to={`/clientes/${clienteId}`} style={secondaryLinkStyle}>
            Volver al cliente
          </Link>

          <Link
            to={`/taller/nueva?cliente_id=${clienteId}&bicicleta_id=${bicicletaId}`}
            style={primaryLinkStyle}
          >
            Nueva orden taller
          </Link>
        </div>
      </header>

      <section style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Ficha de bicicleta</h2>

          <div style={infoGridStyle}>
            <Info label="Marca" value={bicicleta.marca || "-"} />
            <Info label="Modelo" value={bicicleta.modelo || "-"} />
            <Info label="Rodado" value={bicicleta.rodado || "-"} />
            <Info label="Color" value={bicicleta.color || "-"} />
            <Info label="Número de cuadro" value={bicicleta.numero_cuadro || "-"} />
            <Info
              label="Serializada"
              value={bicicleta.id_bicicleta_serializada ? `#${bicicleta.id_bicicleta_serializada}` : "-"}
            />
            <Info label="Notas" value={bicicleta.notas || "-"} full />
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Origen</h2>

          {ventaOrigen ? (
            <div style={originBoxStyle}>
              <div>
                <strong>Venta #{ventaOrigen.id}</strong>
                <div style={mutedStyle}>{formatDate(ventaOrigen.fecha)}</div>
              </div>

              <div style={originMetaStyle}>
                <span style={badgeEstado(ventaOrigen.estado)}>{ventaOrigen.estado}</span>
                <strong>{formatMoney(ventaOrigen.total_final)}</strong>
                <span style={mutedStyle}>
                  Saldo: {formatMoney(ventaOrigen.saldo_pendiente)}
                </span>
              </div>

              <Link to={`/ventas/${ventaOrigen.id}`} style={detailLinkStyle}>
                Ver venta origen
              </Link>
            </div>
          ) : (
            <div style={emptyStyle}>
              No hay venta origen vinculada. Puede ser una bicicleta cargada manualmente.
            </div>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={cardTitleStyle}>Historial de taller</h2>
            <span style={mutedStyle}>
              Reparaciones y órdenes asociadas a esta bicicleta.
            </span>
          </div>
        </div>

        {historialTaller.length === 0 ? (
          <div style={emptyStyle}>Todavía no hay órdenes de taller asociadas.</div>
        ) : (
          <div style={timelineStyle}>
            {historialTaller.map((orden) => (
              <div key={orden.id} style={timelineItemStyle}>
                <div style={timelineDotStyle} />

                <div style={timelineCardStyle}>
                  <div style={timelineHeaderStyle}>
                    <div>
                      <strong>Orden #{orden.id}</strong>
                      <div style={mutedStyle}>{formatDate(orden.fecha_ingreso)}</div>
                    </div>

                    <span style={badgeEstado(orden.estado)}>{orden.estado}</span>
                  </div>

                  <div style={problemStyle}>
                    {orden.problema_reportado || "Sin problema reportado"}
                  </div>

                  {orden.observaciones && (
                    <div style={notesStyle}>{orden.observaciones}</div>
                  )}

                  <div style={moneyRowStyle}>
                    <span>Total: <strong>{formatMoney(orden.total_final)}</strong></span>
                    <span>Saldo: <strong>{formatMoney(orden.saldo_pendiente)}</strong></span>
                  </div>

                  <Link to={`/taller/${orden.id}`} style={detailLinkStyle}>
                    Ver orden
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value, full = false }) {
  return (
    <div
      style={{
        ...infoCardStyle,
        gridColumn: full ? "1 / -1" : "auto",
      }}
    >
      <div style={infoLabelStyle}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

function colorEstado(estado) {
  switch (estado) {
    case "ingresada":
    case "creada":
      return "#b26a00";
    case "presupuestada":
    case "esperando_aprobacion":
    case "esperando_repuestos":
    case "pagada_parcial":
      return "#8a6d00";
    case "en_reparacion":
    case "pagada_total":
      return "#1565c0";
    case "terminada":
    case "lista_para_retirar":
    case "retirada":
    case "entregada":
      return "#137333";
    case "cancelada":
    case "anulada":
      return "#b42318";
    default:
      return "#444";
  }
}

function badgeEstado(estado) {
  const color = colorEstado(estado);

  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontWeight: 800,
    fontSize: "12px",
    background: "#f3f4f6",
    color,
    border: `1px solid ${color}33`,
    whiteSpace: "nowrap",
  };
}

const pageStyle = {
  padding: "24px",
  background: "#f6f7fb",
  minHeight: "100vh",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "18px",
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: "30px",
};

const subtitleStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const actionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.4fr) minmax(320px, .9fr)",
  gap: "16px",
  marginBottom: "16px",
};

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  padding: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  marginBottom: "16px",
};

const cardTitleStyle = {
  margin: "0 0 14px",
  fontSize: "20px",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px",
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const infoCardStyle = {
  background: "#f9fafb",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "12px",
};

const infoLabelStyle = {
  fontSize: "13px",
  color: "#667085",
  marginBottom: "6px",
};

const originBoxStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
  display: "grid",
  gap: "12px",
};

const originMetaStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const timelineStyle = {
  display: "grid",
  gap: "12px",
};

const timelineItemStyle = {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  gap: "10px",
};

const timelineDotStyle = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: "#0b5bd3",
  marginTop: "16px",
  justifySelf: "center",
};

const timelineCardStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "14px",
  background: "#fff",
  display: "grid",
  gap: "10px",
};

const timelineHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap",
};

const problemStyle = {
  fontWeight: 800,
};

const notesStyle = {
  background: "#f9fafb",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "10px",
  color: "#475467",
};

const moneyRowStyle = {
  display: "flex",
  gap: "14px",
  flexWrap: "wrap",
  color: "#344054",
};

const mutedStyle = {
  color: "#667085",
  fontSize: "13px",
};

const detailLinkStyle = {
  textDecoration: "none",
  fontWeight: 800,
  color: "#175cd3",
};

const primaryLinkStyle = {
  textDecoration: "none",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
};

const secondaryLinkStyle = {
  textDecoration: "none",
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
};

const secondaryBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
  cursor: "pointer",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "14px",
};

const emptyStyle = {
  color: "#667085",
  padding: "12px 0",
};