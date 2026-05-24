import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { crearAjusteStock, crearIngresoStock, listarStock } from "../services/stockService";
import { listarProveedores } from "../services/proveedoresService";
import { CURRENT_USER_ID, CURRENT_SUCURSAL_ID } from "../config/appConfig";
import { formatMoney, formatNumber } from "../utils/formatters";
const ID_USUARIO = CURRENT_USER_ID || 1;
const ID_SUCURSAL_DEFAULT = CURRENT_SUCURSAL_ID || 1;

export default function StockPage() {
  const navigate = useNavigate();

  const [stock, setStock] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ultimoIngreso, setUltimoIngreso] = useState(null);

  const [seleccionado, setSeleccionado] = useState(null);
  const [modoPanel, setModoPanel] = useState("detalle");

  const [ingresoForm, setIngresoForm] = useState({
    id_sucursal: ID_SUCURSAL_DEFAULT,
    id_variante: "",
    id_proveedor: "",
    cantidad_ingresada: "",
    costo_productos: "",
    gastos_adicionales: "0",
    origen_ingreso: "manual",
    observacion: "",
    id_usuario: ID_USUARIO,
  });

  const [ajusteForm, setAjusteForm] = useState({
    id_sucursal: ID_SUCURSAL_DEFAULT,
    id_variante: "",
    cantidad: "",
    nota: "",
    id_usuario: ID_USUARIO,
    origen_tipo: "ajuste_manual",
    origen_id: null,
  });

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    await Promise.all([cargarStock(), cargarProveedores()]);
  }

  async function cargarStock() {
    try {
      setLoading(true);
      setError("");
      const data = await listarStock();
      setStock(data || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el stock");
    } finally {
      setLoading(false);
    }
  }

  async function cargarProveedores() {
    try {
      const data = await listarProveedores({ solo_activos: true });
      setProveedores(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar proveedores");
    }
  }

  function seleccionarItem(item, modo = "detalle") {
    setSeleccionado(item);
    setModoPanel(modo);

    setIngresoForm((p) => ({
      ...p,
      id_sucursal: item.sucursal_id,
      id_variante: item.variante_id,
    }));

    setAjusteForm((p) => ({
      ...p,
      id_sucursal: item.sucursal_id,
      id_variante: item.variante_id,
    }));
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setModoPanel("detalle");
  }

  function estadoStock(item) {
    const disponible = Number(item.stock_disponible || 0);
    const fisico = Number(item.stock_fisico || 0);
    const reservado = Number(item.stock_reservado || 0);
    const pendiente = Number(item.stock_vendido_pendiente_entrega || 0);

    if (fisico < reservado + pendiente) return "inconsistente";
    if (disponible <= 0) return "sin_disponible";
    if (pendiente > 0) return "pendiente";
    if (reservado > 0) return "reservado";
    return "ok";
  }

  const stockFiltrado = useMemo(() => {
    const q = query.trim().toLowerCase();

    return stock.filter((item) => {
      const texto = [
        item.sucursal_nombre,
        item.producto_nombre,
        item.nombre_variante,
        item.sku,
        item.variante_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const coincideTexto = !q || texto.includes(q);
      const estado = estadoStock(item);
      const coincideEstado = filtroEstado === "todos" || filtroEstado === estado;

      return coincideTexto && coincideEstado;
    });
  }, [stock, query, filtroEstado]);

  const resumen = useMemo(() => {
    return stock.reduce(
      (acc, item) => {
        const estado = estadoStock(item);

        acc.variantes += 1;
        acc.stockFisico += Number(item.stock_fisico || 0);
        acc.stockReservado += Number(item.stock_reservado || 0);
        acc.stockPendiente += Number(item.stock_vendido_pendiente_entrega || 0);
        acc.stockDisponible += Number(item.stock_disponible || 0);

        if (estado === "sin_disponible") acc.sinDisponible += 1;
        if (estado === "reservado") acc.reservados += 1;
        if (estado === "pendiente") acc.pendientes += 1;
        if (estado === "inconsistente") acc.inconsistentes += 1;

        return acc;
      },
      {
        variantes: 0,
        stockFisico: 0,
        stockReservado: 0,
        stockPendiente: 0,
        stockDisponible: 0,
        sinDisponible: 0,
        reservados: 0,
        pendientes: 0,
        inconsistentes: 0,
      }
    );
  }, [stock]);

  async function handleIngreso(e) {
    e.preventDefault();

    if (!ingresoForm.id_variante || !ingresoForm.id_proveedor) {
      setError("Ingreso: variante y proveedor son obligatorios");
      return;
    }

    if (!ingresoForm.cantidad_ingresada || Number(ingresoForm.cantidad_ingresada) <= 0) {
      setError("Ingreso: la cantidad debe ser mayor a 0");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      setUltimoIngreso(null);

      const payload = {
        ...ingresoForm,
        id_sucursal: Number(ingresoForm.id_sucursal),
        id_variante: Number(ingresoForm.id_variante),
        id_proveedor: Number(ingresoForm.id_proveedor),
        cantidad_ingresada: Number(ingresoForm.cantidad_ingresada),
        costo_productos: Number(ingresoForm.costo_productos || 0),
        gastos_adicionales: Number(ingresoForm.gastos_adicionales || 0),
        observacion: ingresoForm.observacion.trim() || null,
        id_usuario: ID_USUARIO,
      };

      const res = await crearIngresoStock(payload);

      setUltimoIngreso({
        ...res,
        id_proveedor: payload.id_proveedor,
      });

      setMensaje(
        `Ingreso registrado. Stock: ${formatNumber(res.stock_anterior)} → ${formatNumber(
          res.stock_nuevo
        )}. Costo promedio: ${formatMoney(res.costo_promedio_nuevo)}`
      );

      setIngresoForm((p) => ({
        ...p,
        cantidad_ingresada: "",
        costo_productos: "",
        gastos_adicionales: "0",
        observacion: "",
      }));

      await cargarStock();
    } catch (err) {
      setError(err.message || "No se pudo registrar el ingreso");
    } finally {
      setProcesando(false);
    }
  }

  async function handleAjuste(e) {
    e.preventDefault();

    if (!ajusteForm.id_variante) {
      setError("Ajuste: seleccioná una variante");
      return;
    }

    if (!ajusteForm.cantidad || Number(ajusteForm.cantidad) === 0) {
      setError("Ajuste: la cantidad no puede ser 0");
      return;
    }

    if (!ajusteForm.nota.trim()) {
      setError("Ajuste: el motivo es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      setUltimoIngreso(null);

      const payload = {
        ...ajusteForm,
        id_sucursal: Number(ajusteForm.id_sucursal),
        id_variante: Number(ajusteForm.id_variante),
        cantidad: Number(ajusteForm.cantidad),
        nota: ajusteForm.nota.trim(),
        id_usuario: ID_USUARIO,
        origen_id: ajusteForm.origen_id || null,
      };

      const res = await crearAjusteStock(payload);

      setMensaje(`Ajuste registrado. Disponible nuevo: ${formatNumber(res.stock_disponible_nuevo)}`);

      setAjusteForm((p) => ({
        ...p,
        cantidad: "",
        nota: "",
      }));

      await cargarStock();
    } catch (err) {
      setError(err.message || "No se pudo registrar el ajuste");
    } finally {
      setProcesando(false);
    }
  }

  const costoCambio =
    ultimoIngreso &&
    Number(ultimoIngreso.costo_promedio_anterior) !== Number(ultimoIngreso.costo_promedio_nuevo);

  if (loading) return <p style={{ padding: "24px" }}>Cargando stock...</p>;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Stock</h1>
          <p style={mutedStyle}>
            Inventario físico, reservado, vendido pendiente de entrega y disponible.
          </p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarTodo}>Refrescar</button>
          <button onClick={() => navigate("/mercaderia/alta")}>Alta mercadería</button>
        </div>
      </header>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      {costoCambio && (
        <div style={priceWarningStyle}>
          <div>
            <strong>El costo promedio cambió.</strong>
            <div>
              Anterior: {formatMoney(ultimoIngreso.costo_promedio_anterior)} · Nuevo:{" "}
              {formatMoney(ultimoIngreso.costo_promedio_nuevo)}
            </div>
            <div style={mutedSmallStyle}>Conviene revisar precios desfasados.</div>
          </div>

          <button type="button" onClick={() => navigate("/precios")} style={warningButtonStyle}>
            Ir a precios
          </button>
        </div>
      )}

      <section style={metricGridStyle}>
        <Metric label="Variantes" value={resumen.variantes} />
        <Metric label="Físico" value={formatNumber(resumen.stockFisico)} />
        <Metric label="Reservado" value={formatNumber(resumen.stockReservado)} />
        <Metric label="Pendiente entrega" value={formatNumber(resumen.stockPendiente)} />
        <Metric label="Disponible" value={formatNumber(resumen.stockDisponible)} />
        <Metric label="Sin disponible" value={resumen.sinDisponible} danger={resumen.sinDisponible > 0} />
        <Metric label="Inconsistencias" value={resumen.inconsistentes} danger={resumen.inconsistentes > 0} />
      </section>

      <section style={cardStyle}>
        <div style={toolbarStyle}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto, variante, SKU, sucursal o ID..."
            style={inputStyle}
          />

          <div style={filterButtonsStyle}>
            <FilterButton label="Todos" value="todos" current={filtroEstado} onClick={setFiltroEstado} />
            <FilterButton label="Sin stock" value="sin_disponible" current={filtroEstado} onClick={setFiltroEstado} />
            <FilterButton label="Reservado" value="reservado" current={filtroEstado} onClick={setFiltroEstado} />
            <FilterButton label="Pendiente" value="pendiente" current={filtroEstado} onClick={setFiltroEstado} />
            <FilterButton label="Inconsistente" value="inconsistente" current={filtroEstado} onClick={setFiltroEstado} />
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={tableHeaderStyle}>
          <div>
            <h2 style={cardTitleStyle}>Inventario</h2>
            <p style={mutedSmallStyle}>
              {stockFiltrado.length} resultado(s). Click para detalle, acciones para operar.
            </p>
          </div>
        </div>

        {stockFiltrado.length === 0 ? (
          <div style={{ padding: "18px" }}>No hay stock para mostrar.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Sucursal</th>
                  <th style={thStyle}>Físico</th>
                  <th style={thStyle}>Reservado</th>
                  <th style={thStyle}>Pendiente</th>
                  <th style={thStyle}>Disponible</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {stockFiltrado.map((item) => {
                  const estado = estadoStock(item);

                  return (
                    <tr
                      key={`${item.sucursal_id}-${item.variante_id}`}
                      onClick={() => seleccionarItem(item, "detalle")}
                      style={{
                        borderTop: "1px solid #eee",
                        cursor: "pointer",
                        background:
                          seleccionado?.variante_id === item.variante_id &&
                          seleccionado?.sucursal_id === item.sucursal_id
                            ? "#f8fbff"
                            : "white",
                      }}
                    >
                      <td style={tdStyle}>
                        <strong>{item.producto_nombre}</strong>
                        <div>{item.nombre_variante}</div>
                        <div style={mutedSmallStyle}>
                          SKU: {item.sku || "-"} · Variante #{item.variante_id}
                        </div>
                      </td>

                      <td style={tdStyle}>{item.sucursal_nombre}</td>
                      <td style={tdStyle}>{formatNumber(item.stock_fisico)}</td>
                      <td style={tdStyle}>{formatNumber(item.stock_reservado)}</td>
                      <td style={tdStyle}>{formatNumber(item.stock_vendido_pendiente_entrega)}</td>
                      <td style={tdStyle}>
                        <strong>{formatNumber(item.stock_disponible)}</strong>
                      </td>
                      <td style={tdStyle}>
                        <EstadoBadge estado={estado} />
                      </td>
                      <td style={tdStyle}>
                        <div style={rowActionsStyle}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              seleccionarItem(item, "ingreso");
                            }}
                          >
                            Ingreso
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              seleccionarItem(item, "ajuste");
                            }}
                          >
                            Ajuste
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {seleccionado && (
        <aside style={drawerOverlayStyle} onClick={cerrarPanel}>
          <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
            <div style={drawerHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>{seleccionado.producto_nombre}</h2>
                <p style={mutedStyle}>{seleccionado.nombre_variante}</p>
              </div>

              <button onClick={cerrarPanel}>×</button>
            </div>

            <div style={drawerTabsStyle}>
              <button
                style={modoPanel === "detalle" ? activeTabStyle : tabStyle}
                onClick={() => setModoPanel("detalle")}
              >
                Detalle
              </button>
              <button
                style={modoPanel === "ingreso" ? activeTabStyle : tabStyle}
                onClick={() => setModoPanel("ingreso")}
              >
                Ingreso
              </button>
              <button
                style={modoPanel === "ajuste" ? activeTabStyle : tabStyle}
                onClick={() => setModoPanel("ajuste")}
              >
                Ajuste
              </button>
            </div>

            {modoPanel === "detalle" && (
              <div style={drawerContentStyle}>
                <InfoRow label="Sucursal" value={seleccionado.sucursal_nombre} />
                <InfoRow label="SKU" value={seleccionado.sku || "-"} />
                <InfoRow label="Variante ID" value={`#${seleccionado.variante_id}`} />
                <InfoRow label="Stock físico" value={formatNumber(seleccionado.stock_fisico)} />
                <InfoRow label="Reservado" value={formatNumber(seleccionado.stock_reservado)} />
                <InfoRow
                  label="Pendiente entrega"
                  value={formatNumber(seleccionado.stock_vendido_pendiente_entrega)}
                />
                <InfoRow label="Disponible" value={formatNumber(seleccionado.stock_disponible)} />

                <div style={drawerActionsStyle}>
                  <button onClick={() => setModoPanel("ingreso")}>Registrar ingreso</button>
                  <button onClick={() => setModoPanel("ajuste")}>Ajustar stock</button>
                </div>

                <div style={noteStyle}>
                  El stock disponible se calcula como físico - reservado - pendiente de entrega.
                </div>
              </div>
            )}

            {modoPanel === "ingreso" && (
              <form onSubmit={handleIngreso} style={drawerContentStyle}>
                <TextInput
                  label="Sucursal"
                  value={ingresoForm.id_sucursal}
                  onChange={(v) => setIngresoForm((p) => ({ ...p, id_sucursal: v }))}
                />

                <TextInput
                  label="Variante"
                  value={ingresoForm.id_variante}
                  onChange={(v) => setIngresoForm((p) => ({ ...p, id_variante: v }))}
                />

                <label style={fieldStyle}>
                  <span style={labelStyle}>Proveedor</span>
                  <select
                    value={ingresoForm.id_proveedor}
                    onChange={(e) =>
                      setIngresoForm((p) => ({ ...p, id_proveedor: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} - {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <TextInput
                  label="Cantidad ingresada"
                  type="number"
                  value={ingresoForm.cantidad_ingresada}
                  onChange={(v) =>
                    setIngresoForm((p) => ({ ...p, cantidad_ingresada: v }))
                  }
                />

                <TextInput
                  label="Costo productos total"
                  type="number"
                  value={ingresoForm.costo_productos}
                  onChange={(v) =>
                    setIngresoForm((p) => ({ ...p, costo_productos: v }))
                  }
                />

                <TextInput
                  label="Gastos adicionales"
                  type="number"
                  value={ingresoForm.gastos_adicionales}
                  onChange={(v) =>
                    setIngresoForm((p) => ({ ...p, gastos_adicionales: v }))
                  }
                />

                <label style={fieldStyle}>
                  <span style={labelStyle}>Observación</span>
                  <textarea
                    value={ingresoForm.observacion}
                    onChange={(e) =>
                      setIngresoForm((p) => ({ ...p, observacion: e.target.value }))
                    }
                    style={textareaStyle}
                    placeholder="Factura, remito, reposición..."
                  />
                </label>

                <button type="submit" disabled={procesando}>
                  {procesando ? "Guardando..." : "Registrar ingreso"}
                </button>
              </form>
            )}

            {modoPanel === "ajuste" && (
              <form onSubmit={handleAjuste} style={drawerContentStyle}>
                <TextInput
                  label="Sucursal"
                  value={ajusteForm.id_sucursal}
                  onChange={(v) => setAjusteForm((p) => ({ ...p, id_sucursal: v }))}
                />

                <TextInput
                  label="Variante"
                  value={ajusteForm.id_variante}
                  onChange={(v) => setAjusteForm((p) => ({ ...p, id_variante: v }))}
                />

                <TextInput
                  label="Cantidad (+ suma / - resta)"
                  type="number"
                  value={ajusteForm.cantidad}
                  onChange={(v) => setAjusteForm((p) => ({ ...p, cantidad: v }))}
                />

                <label style={fieldStyle}>
                  <span style={labelStyle}>Motivo obligatorio</span>
                  <textarea
                    value={ajusteForm.nota}
                    onChange={(e) =>
                      setAjusteForm((p) => ({ ...p, nota: e.target.value }))
                    }
                    style={textareaStyle}
                    placeholder="Conteo físico, diferencia detectada..."
                  />
                </label>

                <button type="submit" disabled={procesando}>
                  {procesando ? "Guardando..." : "Registrar ajuste"}
                </button>

                <div style={noteStyle}>
                  Usá ajuste solo para diferencias reales de inventario. Ventas, reservas,
                  entregas y taller tienen sus propios movimientos.
                </div>
              </form>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function Metric({ label, value, danger = false }) {
  return (
    <div style={metricStyle}>
      <span style={mutedSmallStyle}>{label}</span>
      <strong style={{ ...metricValueStyle, color: danger ? "#b42318" : "#111827" }}>
        {value}
      </strong>
    </div>
  );
}

function FilterButton({ label, value, current, onClick }) {
  return (
    <button
      type="button"
      style={current === value ? activeFilterStyle : filterStyle}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}

function EstadoBadge({ estado }) {
  if (estado === "ok") return <span style={okPillStyle}>OK</span>;
  if (estado === "sin_disponible") return <span style={dangerPillStyle}>Sin disponible</span>;
  if (estado === "reservado") return <span style={bluePillStyle}>Reservado</span>;
  if (estado === "pendiente") return <span style={warningPillStyle}>Pendiente</span>;
  if (estado === "inconsistente") return <span style={dangerPillStyle}>Inconsistente</span>;
  return <span style={warningPillStyle}>Revisar</span>;
}

function InfoRow({ label, value }) {
  return (
    <div style={infoRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "16px",
  flexWrap: "wrap",
};
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const mutedSmallStyle = { color: "#667085", fontSize: "13px", marginTop: "4px" };
const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "16px",
};
const successStyle = {
  background: "#e8fff0",
  color: "#146c2e",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #b7ebc6",
  marginBottom: "16px",
};
const priceWarningStyle = {
  background: "#fffaeb",
  color: "#92400e",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #facc15",
  marginBottom: "16px",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
};
const warningButtonStyle = {
  border: "1px solid #d97706",
  background: "#fff",
  color: "#92400e",
  borderRadius: "8px",
  padding: "10px 12px",
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};
const metricStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: "14px",
  display: "grid",
  gap: "6px",
};
const metricValueStyle = { fontSize: "22px" };
const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: "16px",
  marginBottom: "16px",
};
const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr)",
  gap: "12px",
};
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  fontSize: "15px",
  boxSizing: "border-box",
};
const filterButtonsStyle = { display: "flex", gap: "8px", flexWrap: "wrap" };
const filterStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};
const activeFilterStyle = {
  ...filterStyle,
  background: "#1f6feb",
  borderColor: "#1f6feb",
  color: "white",
};
const tableHeaderStyle = {
  padding: "16px 18px",
  borderBottom: "1px solid #eee",
};
const cardTitleStyle = { margin: 0, fontSize: "20px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1000px" };
const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
};
const tdStyle = { padding: "10px", verticalAlign: "top" };
const rowActionsStyle = { display: "flex", gap: "6px", flexWrap: "wrap" };
const okPillStyle = {
  background: "#ecfdf3",
  color: "#067647",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const warningPillStyle = {
  background: "#fffaeb",
  color: "#b54708",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const dangerPillStyle = {
  background: "#fff1f0",
  color: "#b42318",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const bluePillStyle = {
  background: "#eef4ff",
  color: "#175cd3",
  borderRadius: "999px",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const drawerOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.35)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "flex-end",
};
const drawerStyle = {
  width: "min(460px, 100%)",
  background: "white",
  height: "100%",
  boxShadow: "-8px 0 30px rgba(0,0,0,.22)",
  overflowY: "auto",
};
const drawerHeaderStyle = {
  padding: "18px",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
};
const drawerTabsStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  borderBottom: "1px solid #eee",
};
const tabStyle = {
  border: "none",
  background: "white",
  padding: "12px",
  fontWeight: 700,
  cursor: "pointer",
};
const activeTabStyle = {
  ...tabStyle,
  background: "#eef4ff",
  color: "#175cd3",
};
const drawerContentStyle = {
  padding: "18px",
  display: "grid",
  gap: "12px",
};
const drawerActionsStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  marginTop: "8px",
};
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const textareaStyle = { ...inputStyle, minHeight: "76px", resize: "vertical" };
const noteStyle = {
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "10px",
  borderRadius: "8px",
  color: "#344054",
  marginTop: "8px",
};
const infoRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  borderBottom: "1px solid #f2f4f7",
  paddingBottom: "10px",
  color: "#344054",
};