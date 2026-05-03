import { useEffect, useMemo, useState } from "react";
import { listarAuditoriaEventos, obtenerAuditoriaEvento } from "../services/auditoriaService";

const LIMITS = [50, 100, 200, 500];

export default function AuditoriaPage() {
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [limit, setLimit] = useState(100);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarEventos();
  }, [limit]);

  async function cargarEventos() {
    try {
      setLoading(true);
      setError("");

      const data = await listarAuditoriaEventos(limit);
      setEventos(data || []);

      if ((data || []).length > 0) {
        setEventoSeleccionado(data[0]);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar los eventos de auditoría");
    } finally {
      setLoading(false);
    }
  }

  async function seleccionarEvento(evento) {
    try {
      setLoadingDetalle(true);
      setError("");

      const detalle = await obtenerAuditoriaEvento(evento.id);
      setEventoSeleccionado(detalle);
    } catch (err) {
      setError(err.message || "No se pudo cargar el detalle del evento");
      setEventoSeleccionado(evento);
    } finally {
      setLoadingDetalle(false);
    }
  }

  const eventosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return eventos;

    return eventos.filter((evento) => {
      const texto = [
        evento.id,
        evento.id_usuario,
        evento.id_sucursal,
        evento.entidad,
        evento.entidad_id,
        evento.accion,
        evento.detalle,
        evento.origen_tipo,
        evento.origen_id,
        JSON.stringify(evento.metadata || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [eventos, query]);

  const resumen = useMemo(() => {
    const entidades = new Set();
    const acciones = new Set();
    const usuarios = new Set();

    eventos.forEach((evento) => {
      if (evento.entidad) entidades.add(evento.entidad);
      if (evento.accion) acciones.add(evento.accion);
      if (evento.id_usuario) usuarios.add(evento.id_usuario);
    });

    return {
      total: eventos.length,
      entidades: entidades.size,
      acciones: acciones.size,
      usuarios: usuarios.size,
    };
  }, [eventos]);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Auditoría</h1>
          <p style={mutedStyle}>Timeline online de acciones críticas del sistema.</p>
        </div>

        <div style={actionsStyle}>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={selectStyle}>
            {LIMITS.map((item) => (
              <option key={item} value={item}>Últimos {item}</option>
            ))}
          </select>

          <button onClick={cargarEventos}>Refrescar</button>
        </div>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={metricsGridStyle}>
        <Metric label="Eventos cargados" value={resumen.total} />
        <Metric label="Entidades" value={resumen.entidades} />
        <Metric label="Acciones" value={resumen.acciones} />
        <Metric label="Usuarios" value={resumen.usuarios} />
      </section>

      <div style={layoutStyle}>
        <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={toolbarStyle}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por entidad, acción, usuario, detalle, origen..."
              style={inputStyle}
            />

            <span style={mutedStyle}>Mostrando {eventosFiltrados.length} de {eventos.length}</span>
          </div>

          {loading ? (
            <div style={{ padding: "18px" }}>Cargando auditoría...</div>
          ) : eventosFiltrados.length === 0 ? (
            <div style={{ padding: "18px" }}>No hay eventos para mostrar.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Entidad</th>
                    <th style={thStyle}>Acción</th>
                    <th style={thStyle}>Origen</th>
                    <th style={thStyle}>Detalle</th>
                  </tr>
                </thead>

                <tbody>
                  {eventosFiltrados.map((evento) => {
                    const selected = eventoSeleccionado?.id === evento.id;

                    return (
                      <tr
                        key={evento.id}
                        onClick={() => seleccionarEvento(evento)}
                        style={{ ...rowStyle, background: selected ? "#eef4ff" : "white" }}
                      >
                        <td style={tdStyle}>#{evento.id}</td>
                        <td style={tdStyle}>{formatDate(evento.fecha)}</td>
                        <td style={tdStyle}>#{evento.id_usuario}</td>
                        <td style={tdStyle}>
                          <EntidadBadge entidad={evento.entidad} />
                          <div style={mutedSmallStyle}>ID #{evento.entidad_id}</div>
                        </td>
                        <td style={tdStyle}><AccionBadge accion={evento.accion} /></td>
                        <td style={tdStyle}>
                          {evento.origen_tipo ? (
                            <>
                              {evento.origen_tipo}
                              <div style={mutedSmallStyle}>#{evento.origen_id}</div>
                            </>
                          ) : "-"}
                        </td>
                        <td style={tdStyle}>
                          <div style={detailTextStyle}>{evento.detalle || "-"}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Detalle</h2>

          {loadingDetalle ? (
            <div>Cargando detalle...</div>
          ) : !eventoSeleccionado ? (
            <div style={mutedStyle}>Seleccioná un evento.</div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              <Info label="Evento" value={`#${eventoSeleccionado.id}`} />
              <Info label="Fecha" value={formatDate(eventoSeleccionado.fecha)} />
              <Info label="Usuario" value={`#${eventoSeleccionado.id_usuario}`} />
              <Info label="Sucursal" value={eventoSeleccionado.id_sucursal ? `#${eventoSeleccionado.id_sucursal}` : "-"} />
              <Info label="Entidad" value={`${eventoSeleccionado.entidad} #${eventoSeleccionado.entidad_id}`} />
              <Info label="Acción" value={eventoSeleccionado.accion} />
              <Info
                label="Origen"
                value={eventoSeleccionado.origen_tipo ? `${eventoSeleccionado.origen_tipo} #${eventoSeleccionado.origen_id}` : "-"}
              />

              <div style={boxStyle}>
                <div style={boxLabelStyle}>Detalle</div>
                <div>{eventoSeleccionado.detalle || "-"}</div>
              </div>

              <div style={boxStyle}>
                <div style={boxLabelStyle}>Metadata</div>
                <pre style={preStyle}>
                  {eventoSeleccionado.metadata ? JSON.stringify(eventoSeleccionado.metadata, null, 2) : "Sin metadata"}
                </pre>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={metricStyle}>
      <span style={mutedStyle}>{label}</span>
      <strong style={metricValueStyle}>{value}</strong>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoStyle}>
      <span style={boxLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EntidadBadge({ entidad }) {
  return <span style={{ ...pillStyle, background: "#eef4ff", color: "#175cd3" }}>{entidad}</span>;
}

function AccionBadge({ accion }) {
  const esCritica =
    accion?.includes("anul") ||
    accion?.includes("revert") ||
    accion?.includes("cancel") ||
    accion?.includes("ajuste") ||
    accion?.includes("reintegr");

  return (
    <span
      style={{
        ...pillStyle,
        background: esCritica ? "#fff1f0" : "#ecfdf3",
        color: esCritica ? "#b42318" : "#067647",
      }}
    >
      {accion}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" };
const actionsStyle = { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" };
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const mutedSmallStyle = { color: "#667085", fontSize: "12px", marginTop: "4px" };
const selectStyle = { padding: "9px 10px", borderRadius: "10px", border: "1px solid #d0d5dd", background: "white" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const metricsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "16px" };
const metricStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "14px", display: "grid", gap: "6px" };
const metricValueStyle = { fontSize: "24px" };
const layoutStyle = { display: "grid", gridTemplateColumns: "minmax(680px, 1fr) 390px", gap: "16px", alignItems: "start" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", marginBottom: "16px" };
const toolbarStyle = { display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", padding: "16px", borderBottom: "1px solid #eee", alignItems: "center" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "980px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "14px" };
const tdStyle = { padding: "10px", verticalAlign: "top", borderBottom: "1px solid #f2f4f7" };
const rowStyle = { cursor: "pointer" };
const pillStyle = { borderRadius: "999px", padding: "4px 8px", fontWeight: "bold", fontSize: "12px", display: "inline-block" };
const detailTextStyle = { maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const infoStyle = { background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px", display: "grid", gap: "6px" };
const boxStyle = { background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px" };
const boxLabelStyle = { color: "#667085", fontSize: "13px", marginBottom: "6px" };
const preStyle = { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "12px", maxHeight: "240px", overflow: "auto" };
