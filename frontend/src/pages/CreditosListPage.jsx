import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { formatDate, formatMoneyPrecise } from "../utils/formatters";
import {
  getCreditoContexto,
  getOrigenFinancieroLabel,
  getPoliticaCreditoGeneral,
} from "../utils/financials";
import {
  listarClientesConSaldoAFavor,
  listarCreditosCliente,
  listarCreditosDisponiblesCliente,
} from "../services/creditosService";
import useMediaQuery from "../hooks/useMediaQuery";

export default function CreditosListPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [clientesConSaldo, setClientesConSaldo] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [query, setQuery] = useState("");
  const [soloDisponibles, setSoloDisponibles] = useState(true);
  const [creditos, setCreditos] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingCreditos, setLoadingCreditos] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarClientesConSaldo(query);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!clienteSeleccionado?.id_cliente) {
      setCreditos([]);
      return;
    }

    cargarCreditos(clienteSeleccionado.id_cliente, soloDisponibles);
  }, [clienteSeleccionado?.id_cliente, soloDisponibles]);

  async function cargarClientesConSaldo(search = "") {
    try {
      setLoadingClientes(true);
      setError("");
      const data = await listarClientesConSaldoAFavor({
        q: search.trim() || undefined,
        limit: 100,
      });
      const listado = data || [];
      setClientesConSaldo(listado);

      if (
        clienteSeleccionado &&
        !listado.some((cliente) => Number(cliente.id_cliente) === Number(clienteSeleccionado.id_cliente))
      ) {
        setClienteSeleccionado(null);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar los saldos a favor");
      setClientesConSaldo([]);
    } finally {
      setLoadingClientes(false);
    }
  }

  async function cargarCreditos(clienteId, disponibles = soloDisponibles) {
    if (!clienteId) return;

    try {
      setLoadingCreditos(true);
      setError("");
      const data = disponibles
        ? await listarCreditosDisponiblesCliente(clienteId)
        : await listarCreditosCliente(clienteId);
      setCreditos(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los créditos del cliente");
      setCreditos([]);
    } finally {
      setLoadingCreditos(false);
    }
  }

  function seleccionarCliente(cliente) {
    setClienteSeleccionado(cliente);
  }

  const resumen = useMemo(() => {
    return clientesConSaldo.reduce(
      (acc, cliente) => {
        acc.clientes += 1;
        acc.creditos += Number(cliente.creditos_disponibles || 0);
        acc.saldo += Number(cliente.saldo_total || 0);
        return acc;
      },
      { clientes: 0, creditos: 0, saldo: 0 }
    );
  }, [clientesConSaldo]);

  const totalSaldoDetalle = creditos.reduce(
    (acc, credito) => acc + Number(credito.saldo_actual || 0),
    0
  );
  const politicaCredito = getPoliticaCreditoGeneral();

  return (
    <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 32 }}>Créditos</h1>
          <p style={mutedStyle}>
            Saldos a favor por cliente, reintegros y créditos comerciales pendientes.
          </p>
        </div>
        <button type="button" onClick={() => cargarClientesConSaldo(query)} style={outlineButtonStyle}>
          Refrescar
        </button>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={operationGuideStyle}>
        <div style={operationRuleStyle}>
          <strong>Efectivo y transferencia</strong>
          <span>
            Cuando el dinero queda a favor del cliente dentro del negocio, se gestiona desde Créditos.
          </span>
        </div>
        <div style={electronicRuleStyle}>
          <strong>Tarjeta y Mercado Pago</strong>
          <span>
            Se cancelan desde su terminal o plataforma. Evitá convertirlos en crédito comercial si el reintegro ocurre afuera.
          </span>
        </div>
      </section>

      <section style={isMobile ? summaryGridMobileStyle : summaryGridStyle}>
        <Metric label="Clientes con saldo" value={resumen.clientes} />
        <Metric label="Créditos disponibles" value={resumen.creditos} />
        <Metric label="Saldo total a favor" value={formatMoneyPrecise(resumen.saldo)} tone="success" />
        <div style={policyStyle}>
          <strong>{politicaCredito.titulo}</strong>
          <span>{politicaCredito.descripcion}</span>
        </div>
      </section>

      <section style={{ ...cardStyle, ...(isMobile ? cardMobileStyle : {}) }}>
        <div style={searchBoxStyle}>
          <Search size={18} color="#64748b" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente, teléfono, DNI/CUIT, venta u origen..."
            style={searchInputStyle}
          />
        </div>
      </section>

      <main style={{ ...layoutStyle, ...(isMobile ? layoutMobileStyle : {}) }}>
        <section style={cardListStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Clientes con saldo a favor</h2>
              <p style={mutedStyle}>
                {loadingClientes ? "Actualizando..." : `${clientesConSaldo.length} resultado(s)`}
              </p>
            </div>
          </div>

          {loadingClientes ? (
            <div style={emptyStyle}>Cargando saldos...</div>
          ) : clientesConSaldo.length === 0 ? (
            <div style={emptyStyle}>No hay clientes con saldo a favor para esta búsqueda.</div>
          ) : (
            <div style={clientListStyle}>
              {clientesConSaldo.map((cliente) => {
                const activo =
                  Number(clienteSeleccionado?.id_cliente) === Number(cliente.id_cliente);

                return (
                  <button
                    type="button"
                    key={cliente.id_cliente}
                    onClick={() => seleccionarCliente(cliente)}
                    style={activo ? clientCardActiveStyle : clientCardStyle}
                  >
                    <div style={clientMainStyle}>
                      <strong>{cliente.cliente_nombre}</strong>
                      <span style={mutedSmallStyle}>
                        #{cliente.id_cliente}
                        {cliente.cliente_dni ? ` · DNI ${cliente.cliente_dni}` : ""}
                        {cliente.cliente_cuit ? ` · CUIT ${cliente.cliente_cuit}` : ""}
                        {cliente.cliente_telefono ? ` · Tel. ${cliente.cliente_telefono}` : ""}
                      </span>
                      <span style={mutedSmallStyle}>
                        Último origen: {getOrigenFinancieroLabel(cliente.ultimo_origen_tipo, cliente.ultimo_origen_id)}
                        {" · "}
                        {formatDate(cliente.ultima_fecha)}
                      </span>
                    </div>
                    <div style={clientAmountStyle}>
                      <span>{cliente.creditos_disponibles} crédito(s)</span>
                      <strong>{formatMoneyPrecise(cliente.saldo_total)}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ ...cardListStyle, ...(isMobile ? detailMobileStyle : {}) }}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                {clienteSeleccionado ? clienteSeleccionado.cliente_nombre : "Detalle"}
              </h2>
              <p style={mutedStyle}>
                {clienteSeleccionado
                  ? `${creditos.length} crédito(s) · ${formatMoneyPrecise(totalSaldoDetalle)}`
                  : "Elegí un cliente para revisar sus créditos."}
              </p>
            </div>

            <label style={checkStyle}>
              <input
                type="checkbox"
                checked={soloDisponibles}
                onChange={(event) => setSoloDisponibles(event.target.checked)}
              />
              Disponibles
            </label>
          </div>

          {!clienteSeleccionado ? (
            <div style={emptyStyle}>Seleccioná un cliente del listado.</div>
          ) : loadingCreditos ? (
            <div style={emptyStyle}>Cargando créditos...</div>
          ) : creditos.length === 0 ? (
            <div style={emptyStyle}>No hay créditos para mostrar con este filtro.</div>
          ) : (
            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Crédito</th>
                    <th style={thStyle}>Origen</th>
                    <th style={thStyle}>Saldo</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Contexto</th>
                    <th style={thStyle}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {creditos.map((credito) => (
                    <tr key={credito.id} style={trStyle}>
                      <td style={tdStyle}>#{credito.id}</td>
                      <td style={tdStyle}>
                        {getOrigenFinancieroLabel(credito.origen_tipo, credito.origen_id)}
                      </td>
                      <td style={tdStyle}>
                        <strong>{formatMoneyPrecise(credito.saldo_actual)}</strong>
                      </td>
                      <td style={tdStyle}>
                        <EstadoCreditoBadge estado={credito.estado} />
                      </td>
                      <td style={tdStyle}>
                        <CreditoContextoInline credito={credito} />
                      </td>
                      <td style={tdStyle}>
                        <Link to={`/creditos/${credito.id}`} style={linkBtnStyle}>
                          Revisar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function CreditoContextoInline({ credito }) {
  const contexto = getCreditoContexto(credito);

  return (
    <div style={{ display: "grid", gap: 4, maxWidth: 360 }}>
      <strong>{contexto.titulo}</strong>
      <span style={mutedSmallStyle}>
        {credito.observacion || contexto.descripcion}
      </span>
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...metricStyle, ...(tone === "success" ? metricSuccessStyle : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function EstadoCreditoBadge({ estado }) {
  const labels = {
    abierto: "Abierto",
    aplicado_parcial: "Aplicado parcial",
    aplicado_total: "Aplicado total",
  };
  const colors = {
    abierto: { bg: "#ecfdf3", color: "#067647" },
    aplicado_parcial: { bg: "#fffaeb", color: "#b54708" },
    aplicado_total: { bg: "#f2f4f7", color: "#475467" },
  };
  const style = colors[estado] || { bg: "#eef4ff", color: "#175cd3" };

  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {labels[estado] || estado}
    </span>
  );
}

const pageStyle = { padding: 24, background: "#f6f7fb", minHeight: "100vh" };
const pageMobileStyle = { padding: 12, overflowX: "hidden" };
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
  gap: 12,
  flexWrap: "wrap",
};
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const mutedSmallStyle = { color: "#667085", fontSize: 13, lineHeight: 1.35 };
const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #f4c7c3",
  marginBottom: 16,
};
const outlineButtonStyle = {
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#0f172a",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 900,
  cursor: "pointer",
};
const operationGuideStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
  marginBottom: 16,
};
const operationRuleStyle = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 5,
  color: "#047857",
};
const electronicRuleStyle = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 5,
  color: "#1d4ed8",
};
const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 16,
};
const summaryGridMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginBottom: 16,
};
const metricStyle = {
  background: "white",
  borderRadius: 14,
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: 16,
  display: "grid",
  gap: 6,
  fontWeight: 800,
};
const metricSuccessStyle = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#047857",
};
const policyStyle = {
  background: "#fff7ed",
  border: "1px solid #fdba74",
  color: "#9a3412",
  borderRadius: 14,
  padding: 16,
  display: "grid",
  gap: 6,
  fontSize: 14,
};
const cardStyle = {
  background: "white",
  borderRadius: 14,
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: 16,
  marginBottom: 16,
};
const cardMobileStyle = { padding: 12 };
const searchBoxStyle = {
  minHeight: 46,
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "0 12px",
  background: "#f8fafc",
};
const searchInputStyle = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  padding: "12px 0",
  fontSize: 15,
  fontWeight: 800,
};
const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 0.85fr) minmax(540px, 1.15fr)",
  gap: 16,
  alignItems: "start",
};
const layoutMobileStyle = { gridTemplateColumns: "1fr" };
const cardListStyle = {
  background: "white",
  borderRadius: 14,
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  overflow: "hidden",
};
const detailMobileStyle = { minWidth: 0 };
const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 16,
  borderBottom: "1px solid #e5e7eb",
};
const sectionTitleStyle = { margin: 0, fontSize: 20 };
const clientListStyle = { display: "grid" };
const clientCardStyle = {
  width: "100%",
  textAlign: "left",
  border: "none",
  borderBottom: "1px solid #eef2f7",
  background: "white",
  padding: 14,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  cursor: "pointer",
};
const clientCardActiveStyle = {
  ...clientCardStyle,
  background: "#fff7ed",
  boxShadow: "inset 4px 0 0 #f97316",
};
const clientMainStyle = { minWidth: 0, display: "grid", gap: 4 };
const clientAmountStyle = {
  textAlign: "right",
  display: "grid",
  gap: 4,
  color: "#047857",
  whiteSpace: "nowrap",
};
const emptyStyle = { padding: 18, color: "#667085", fontWeight: 800 };
const checkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 800,
  color: "#344054",
};
const tableWrapperStyle = { overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: 850 };
const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fafc",
  fontSize: 12,
  color: "#475467",
  textTransform: "uppercase",
};
const tdStyle = { padding: 10, verticalAlign: "top" };
const trStyle = { borderTop: "1px solid #eef2f7" };
const linkBtnStyle = {
  textDecoration: "none",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #d0d5dd",
  color: "#111827",
  background: "white",
  display: "inline-block",
  fontWeight: 900,
};
