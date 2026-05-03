import { useEffect, useMemo, useState } from "react";
import { crearAjusteStock, crearIngresoStock, listarStock } from "../services/stockService";

const ID_USUARIO = 1;
const ID_SUCURSAL_DEFAULT = 1;

export default function StockPage() {
  const [stock, setStock] = useState([]);
  const [query, setQuery] = useState("");
  const [soloProblemas, setSoloProblemas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [ingresoForm, setIngresoForm] = useState({
    id_sucursal: ID_SUCURSAL_DEFAULT,
    id_variante: "",
    id_proveedor: "",
    cantidad_ingresada: "",
    costo_productos: "",
    gastos_adicionales: 0,
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
    cargarStock();
  }, []);

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

      const coincide = !q || texto.includes(q);
      const stockDisponible = Number(item.stock_disponible || 0);
      const stockFisico = Number(item.stock_fisico || 0);
      const reservado = Number(item.stock_reservado || 0);
      const pendiente = Number(item.stock_vendido_pendiente_entrega || 0);

      const problema =
        stockDisponible <= 0 ||
        reservado > 0 ||
        pendiente > 0 ||
        stockFisico < reservado + pendiente;

      return coincide && (!soloProblemas || problema);
    });
  }, [stock, query, soloProblemas]);

  const resumen = useMemo(() => {
    return stock.reduce(
      (acc, item) => {
        acc.variantes += 1;
        acc.stockFisico += Number(item.stock_fisico || 0);
        acc.stockReservado += Number(item.stock_reservado || 0);
        acc.stockPendiente += Number(item.stock_vendido_pendiente_entrega || 0);
        acc.stockDisponible += Number(item.stock_disponible || 0);

        if (Number(item.stock_disponible || 0) <= 0) acc.sinDisponible += 1;
        if (Number(item.stock_reservado || 0) > 0) acc.conReservado += 1;
        if (Number(item.stock_vendido_pendiente_entrega || 0) > 0) acc.conPendiente += 1;

        return acc;
      },
      {
        variantes: 0,
        stockFisico: 0,
        stockReservado: 0,
        stockPendiente: 0,
        stockDisponible: 0,
        sinDisponible: 0,
        conReservado: 0,
        conPendiente: 0,
      }
    );
  }, [stock]);

  function seleccionarVariante(item) {
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

  async function handleIngreso(e) {
    e.preventDefault();

    if (!ingresoForm.id_variante || !ingresoForm.id_proveedor) {
      setError("Ingreso: variante y proveedor son obligatorios");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const payload = {
        ...ingresoForm,
        id_sucursal: Number(ingresoForm.id_sucursal),
        id_variante: Number(ingresoForm.id_variante),
        id_proveedor: Number(ingresoForm.id_proveedor),
        cantidad_ingresada: Number(ingresoForm.cantidad_ingresada),
        costo_productos: Number(ingresoForm.costo_productos),
        gastos_adicionales: Number(ingresoForm.gastos_adicionales || 0),
        observacion: ingresoForm.observacion.trim() || null,
        id_usuario: ID_USUARIO,
      };

      const res = await crearIngresoStock(payload);

      setMensaje(
        `Ingreso registrado. Stock anterior: ${res.stock_anterior}, nuevo: ${res.stock_nuevo}. Costo promedio nuevo: ${formatNumber(res.costo_promedio_nuevo)}`
      );

      setIngresoForm((p) => ({
        ...p,
        cantidad_ingresada: "",
        costo_productos: "",
        gastos_adicionales: 0,
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

    if (!ajusteForm.nota.trim()) {
      setError("Ajuste: el motivo es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

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

      setMensaje(
        `Ajuste registrado. Disponible nuevo: ${formatNumber(res.stock_disponible_nuevo)}`
      );

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

  if (loading) return <p style={{ padding: "24px" }}>Cargando stock...</p>;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Stock</h1>
          <p style={mutedStyle}>
            Control de stock físico, reservado, vendido pendiente de entrega y disponible.
          </p>
        </div>

        <button onClick={cargarStock}>Refrescar</button>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={metricGridStyle}>
        <Metric label="Variantes con stock" value={resumen.variantes} />
        <Metric label="Stock físico" value={formatNumber(resumen.stockFisico)} />
        <Metric label="Reservado" value={formatNumber(resumen.stockReservado)} />
        <Metric label="Pendiente entrega" value={formatNumber(resumen.stockPendiente)} />
        <Metric label="Disponible" value={formatNumber(resumen.stockDisponible)} />
        <Metric label="Sin disponible" value={resumen.sinDisponible} danger={resumen.sinDisponible > 0} />
      </section>

      <div style={gridStyle}>
        <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={toolbarStyle}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto, variante, SKU o sucursal"
              style={inputStyle}
            />

            <label style={checkStyle}>
              <input
                type="checkbox"
                checked={soloProblemas}
                onChange={(e) => setSoloProblemas(e.target.checked)}
              />
              Solo alertas
            </label>
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
                    <th style={thStyle}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {stockFiltrado.map((item) => {
                    const disponible = Number(item.stock_disponible || 0);
                    const reservado = Number(item.stock_reservado || 0);
                    const pendiente = Number(item.stock_vendido_pendiente_entrega || 0);
                    const alerta = disponible <= 0 || reservado > 0 || pendiente > 0;

                    return (
                      <tr key={`${item.sucursal_id}-${item.variante_id}`} style={{ borderTop: "1px solid #eee" }}>
                        <td style={tdStyle}>
                          <strong>{item.producto_nombre} - {item.nombre_variante}</strong>
                          <div style={mutedSmallStyle}>SKU: {item.sku || "-"} · Variante #{item.variante_id}</div>
                        </td>
                        <td style={tdStyle}>{item.sucursal_nombre}</td>
                        <td style={tdStyle}>{formatNumber(item.stock_fisico)}</td>
                        <td style={tdStyle}>{formatNumber(item.stock_reservado)}</td>
                        <td style={tdStyle}>{formatNumber(item.stock_vendido_pendiente_entrega)}</td>
                        <td style={tdStyle}><strong>{formatNumber(item.stock_disponible)}</strong></td>
                        <td style={tdStyle}>
                          {alerta ? (
                            <span style={warningPillStyle}>Revisar</span>
                          ) : (
                            <span style={okPillStyle}>OK</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => seleccionarVariante(item)}>Usar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside style={sideStyle}>
          <section style={cardStyle}>
            <h2 style={cardTitleStyle}>Ingreso de stock</h2>
            <form onSubmit={handleIngreso} style={formStyle}>
              <TextInput label="Sucursal" value={ingresoForm.id_sucursal} onChange={(v) => setIngresoForm((p) => ({ ...p, id_sucursal: v }))} />
              <TextInput label="Variante" value={ingresoForm.id_variante} onChange={(v) => setIngresoForm((p) => ({ ...p, id_variante: v }))} />
              <TextInput label="Proveedor ID" value={ingresoForm.id_proveedor} onChange={(v) => setIngresoForm((p) => ({ ...p, id_proveedor: v }))} />
              <TextInput label="Cantidad ingresada" value={ingresoForm.cantidad_ingresada} onChange={(v) => setIngresoForm((p) => ({ ...p, cantidad_ingresada: v }))} type="number" />
              <TextInput label="Costo productos total" value={ingresoForm.costo_productos} onChange={(v) => setIngresoForm((p) => ({ ...p, costo_productos: v }))} type="number" />
              <TextInput label="Gastos adicionales" value={ingresoForm.gastos_adicionales} onChange={(v) => setIngresoForm((p) => ({ ...p, gastos_adicionales: v }))} type="number" />

              <label style={fieldStyle}>
                <span style={labelStyle}>Observación</span>
                <textarea
                  value={ingresoForm.observacion}
                  onChange={(e) => setIngresoForm((p) => ({ ...p, observacion: e.target.value }))}
                  style={textareaStyle}
                />
              </label>

              <button type="submit" disabled={procesando}>
                {procesando ? "Guardando..." : "Registrar ingreso"}
              </button>
            </form>
          </section>

          <section style={cardStyle}>
            <h2 style={cardTitleStyle}>Ajuste manual</h2>
            <form onSubmit={handleAjuste} style={formStyle}>
              <TextInput label="Sucursal" value={ajusteForm.id_sucursal} onChange={(v) => setAjusteForm((p) => ({ ...p, id_sucursal: v }))} />
              <TextInput label="Variante" value={ajusteForm.id_variante} onChange={(v) => setAjusteForm((p) => ({ ...p, id_variante: v }))} />
              <TextInput label="Cantidad (+ suma / - resta)" value={ajusteForm.cantidad} onChange={(v) => setAjusteForm((p) => ({ ...p, cantidad: v }))} type="number" />

              <label style={fieldStyle}>
                <span style={labelStyle}>Motivo obligatorio</span>
                <textarea
                  value={ajusteForm.nota}
                  onChange={(e) => setAjusteForm((p) => ({ ...p, nota: e.target.value }))}
                  style={textareaStyle}
                  placeholder="Ej: conteo físico, diferencia detectada..."
                />
              </label>

              <button type="submit" disabled={procesando}>
                {procesando ? "Guardando..." : "Registrar ajuste"}
              </button>
            </form>

            <div style={noteStyle}>
              El ajuste manual queda auditado y no debe usarse para ventas, reservas o taller.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, danger = false }) {
  return (
    <div style={metricStyle}>
      <span style={mutedStyle}>{label}</span>
      <strong style={{ ...metricValueStyle, color: danger ? "#b42318" : "#111827" }}>{value}</strong>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "number" }) {
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: 3,
  });
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" };
const mutedStyle = { color: "#667085", margin: "6px 0 0" };
const mutedSmallStyle = { color: "#667085", fontSize: "13px", marginTop: "4px" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const metricGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" };
const metricStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "14px", display: "grid", gap: "6px" };
const metricValueStyle = { fontSize: "22px" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(620px,1fr) 360px", gap: "16px", alignItems: "start" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.08)", padding: "16px", marginBottom: "16px" };
const toolbarStyle = { display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", padding: "16px", borderBottom: "1px solid #eee", alignItems: "center" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box" };
const checkStyle = { display: "flex", gap: "8px", alignItems: "center", whiteSpace: "nowrap" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "980px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const okPillStyle = { background: "#ecfdf3", color: "#067647", borderRadius: "999px", padding: "4px 8px", fontWeight: "bold", fontSize: "13px" };
const warningPillStyle = { background: "#fffaeb", color: "#b54708", borderRadius: "999px", padding: "4px 8px", fontWeight: "bold", fontSize: "13px" };
const sideStyle = { display: "grid", gap: "0" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const formStyle = { display: "grid", gap: "10px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const textareaStyle = { ...inputStyle, minHeight: "68px", resize: "vertical" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "10px", borderRadius: "8px", color: "#344054", marginTop: "12px" };
