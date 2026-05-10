import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  obtenerCliente,
  desactivarCliente,
  activarCliente,
  listarBicicletasCliente,
} from "../services/clientesService";

export default function ClienteDetallePage() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [bicicletas, setBicicletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarTodo();
  }, [clienteId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");

      const [detalle, bicis] = await Promise.all([
        obtenerCliente(clienteId),
        listarBicicletasCliente(clienteId),
      ]);

      setData(detalle);
      setBicicletas(Array.isArray(bicis) ? bicis : []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el cliente");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivar() {
    const confirmar = window.confirm(
      "¿Seguro que querés activar este cliente?"
    );

    if (!confirmar) return;

    try {
      setError("");
      await activarCliente(clienteId);
      await cargarTodo();
    } catch (err) {
      setError(err.message || "No se pudo activar el cliente");
    }
  }

  async function handleDesactivar() {
    const confirmar = window.confirm(
      "¿Seguro que querés desactivar este cliente?"
    );

    if (!confirmar) return;

    try {
      setError("");
      await desactivarCliente(clienteId);
      await cargarTodo();
    } catch (err) {
      setError(err.message || "No se pudo desactivar el cliente");
    }
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando cliente...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={alertStyle}>Error: {error}</div>
      </div>
    );
  }

  const cliente = data?.cliente;
  const resumen = data?.resumen_ventas;
  const ventas = data?.ventas_recientes || [];

  if (!cliente) {
    return <p style={{ padding: "24px" }}>No se encontró el cliente.</p>;
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={titleRowStyle}>
            <h1 style={titleStyle}>{cliente.nombre}</h1>

            <span style={cliente.activo ? activeBadgeStyle : inactiveBadgeStyle}>
              {cliente.activo ? "Activo" : "Inactivo"}
            </span>
          </div>

          <p style={subtitleStyle}>
            Cliente #{cliente.id}
          </p>
        </div>

        <div style={headerActionsStyle}>
          <button onClick={cargarTodo} style={secondaryBtnStyle}>
            Refrescar
          </button>

          <Link to="/clientes" style={secondaryLinkStyle}>
            Volver
          </Link>

          {cliente.id !== 1 && (
            <Link
              to={`/clientes/${cliente.id}/editar`}
              style={primaryLinkStyle}
            >
              Editar
            </Link>
          )}

          {cliente.id !== 1 && cliente.activo && (
            <button onClick={handleDesactivar} style={dangerBtnStyle}>
              Desactivar
            </button>
          )}

          {cliente.id !== 1 && !cliente.activo && (
            <button onClick={handleActivar} style={successBtnStyle}>
              Activar
            </button>
          )}
        </div>
      </header>

      <section style={summaryGridStyle}>
        <SummaryCard
          label="Ventas"
          value={resumen?.cantidad_ventas ?? 0}
        />

        <SummaryCard
          label="Total comprado"
          value={formatMoney(resumen?.total_comprado ?? 0)}
        />

        <SummaryCard
          label="Saldo pendiente"
          value={formatMoney(resumen?.saldo_pendiente_total ?? 0)}
        />

        <SummaryCard
          label="Última venta"
          value={
            resumen?.ultima_venta_fecha
              ? formatDate(resumen.ultima_venta_fecha)
              : "-"
          }
        />
      </section>

      <div style={mainGridStyle}>
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={cardTitleStyle}>Datos personales</h2>
          </div>

          <div style={infoGridStyle}>
            <Info label="Nombre" value={cliente.nombre} />
            <Info label="Teléfono" value={cliente.telefono || "-"} />
            <Info label="DNI" value={cliente.dni || "-"} />
            <Info label="Dirección" value={cliente.direccion || "-"} />

            <Info
              label="Tipo cliente"
              value={
                <span style={badgeTipo(cliente.tipo_cliente)}>
                  {renderTipo(cliente.tipo_cliente)}
                </span>
              }
            />

            <Info
              label="Condición IVA"
              value={renderCondicionIva(cliente.condicion_iva)}
            />
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={cardTitleStyle}>Datos fiscales</h2>
          </div>

          <div style={infoGridStyle}>
            <Info label="CUIT" value={cliente.cuit || "-"} />

            <Info
              label="Razón social"
              value={cliente.razon_social || "-"}
              full
            />

            <Info
              label="Notas"
              value={cliente.notas || "-"}
              full
            />
          </div>
        </section>
      </div>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={cardTitleStyle}>Bicicletas del cliente</h2>
            <span style={mutedStyle}>
              Historial registrado de bicicletas.
            </span>
          </div>
        </div>

        {bicicletas.length === 0 ? (
          <div style={emptyStyle}>
            Este cliente todavía no tiene bicicletas registradas.
          </div>
        ) : (
          <div style={bikeGridStyle}>
            {bicicletas.map((bici) => (
              <div key={bici.id} style={bikeCardStyle}>
                <strong>
                  {bici.marca} {bici.modelo}
                </strong>

                <div style={bikeMetaStyle}>
                  Rodado: {bici.rodado || "-"}
                </div>

                <div style={bikeMetaStyle}>
                  Color: {bici.color || "-"}
                </div>

                <div style={bikeMetaStyle}>
                  Cuadro: {bici.numero_cuadro || "-"}
                </div>

                {bici.notas && (
                  <div style={bikeNotesStyle}>
                    {bici.notas}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={cardTitleStyle}>Ventas recientes</h2>
            <span style={mutedStyle}>
              Últimos movimientos comerciales del cliente.
            </span>
          </div>
        </div>

        {ventas.length === 0 ? (
          <div style={emptyStyle}>
            No hay ventas asociadas a este cliente.
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Venta</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Saldo</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {ventas.map((venta) => (
                  <tr
                    key={venta.id}
                    style={rowStyle}
                    onDoubleClick={() => navigate(`/ventas/${venta.id}`)}
                  >
                    <td style={tdStyle}>
                      <strong>#{venta.id}</strong>
                    </td>

                    <td style={tdStyle}>
                      {formatDate(venta.fecha)}
                    </td>

                    <td style={tdStyle}>
                      <span style={badgeEstado(venta.estado)}>
                        {venta.estado}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      {formatMoney(venta.total)}
                    </td>

                    <td style={tdStyle}>
                      {formatMoney(venta.saldo_pendiente)}
                    </td>

                    <td style={tdStyle}>
                      <Link
                        to={`/ventas/${venta.id}`}
                        style={detailLinkStyle}
                      >
                        Ver venta
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={summaryCardStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
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

function renderTipo(tipo) {
  const map = {
    consumidor_final: "Consumidor final",
    minorista: "Minorista",
    mayorista: "Mayorista",
  };

  return map[tipo] || tipo;
}

function renderCondicionIva(condicion) {
  const map = {
    consumidor_final: "Consumidor final",
    responsable_inscripto: "Responsable inscripto",
    monotributo: "Monotributo",
    exento: "Exento",
  };

  return map[condicion] || condicion || "-";
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("es-AR");
}

function colorEstado(estado) {
  switch (estado) {
    case "creada":
      return "#b26a00";
    case "pagada_parcial":
      return "#8a6d00";
    case "pagada_total":
      return "#1565c0";
    case "entregada":
      return "#137333";
    case "anulada":
      return "#b42318";
    default:
      return "#444";
  }
}

function badgeEstado(estado) {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontWeight: "bold",
    fontSize: "12px",
    background: "#f3f4f6",
    color: colorEstado(estado),
    border: `1px solid ${colorEstado(estado)}33`,
  };
}

function colorTipo(tipo) {
  switch (tipo) {
    case "consumidor_final":
      return "#555";
    case "minorista":
      return "#1565c0";
    case "mayorista":
      return "#137333";
    default:
      return "#444";
  }
}

function badgeTipo(tipo) {
  const color = colorTipo(tipo);

  return {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "999px",
    fontWeight: 800,
    fontSize: "12px",
    background: "#f3f4f6",
    color,
    border: `1px solid ${color}33`,
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

const titleRowStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
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

const headerActionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const summaryCardStyle = {
  background: "white",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "16px",
  display: "grid",
  gap: "6px",
};

const mainGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: "16px",
};

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  padding: "16px",
  marginBottom: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px",
};

const cardTitleStyle = {
  margin: 0,
  fontSize: "20px",
};

const mutedStyle = {
  color: "#667085",
  fontSize: "13px",
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

const bikeGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
};

const bikeCardStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
  display: "grid",
  gap: "6px",
};

const bikeMetaStyle = {
  color: "#667085",
  fontSize: "14px",
};

const bikeNotesStyle = {
  marginTop: "6px",
  fontSize: "14px",
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "760px",
};

const theadStyle = {
  background: "#f9fafb",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "12px 10px",
  borderTop: "1px solid #f2f4f7",
};

const rowStyle = {
  cursor: "pointer",
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

const dangerBtnStyle = {
  border: "none",
  background: "#b42318",
  color: "white",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const successBtnStyle = {
  border: "none",
  background: "#067647",
  color: "white",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const activeBadgeStyle = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: 800,
  fontSize: "12px",
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
};

const inactiveBadgeStyle = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "999px",
  fontWeight: 800,
  fontSize: "12px",
  background: "#fff1f0",
  color: "#b42318",
  border: "1px solid #fecdca",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
};

const emptyStyle = {
  color: "#667085",
  padding: "12px 0",
};