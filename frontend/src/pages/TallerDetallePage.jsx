import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listarVariantes } from "../services/catalogoService";
import {
  agregarItemOrdenTaller,
  aprobarItemOrdenTaller,
  cambiarEstadoOrdenTaller,
  ejecutarItemOrdenTaller,
  obtenerOrdenTaller,
  revertirEjecucionItemOrdenTaller,
} from "../services/tallerService";
import { EstadoBadge, formatDate, formatMoney } from "./TallerListPage";

const ESTADOS = [
  "ingresada",
  "presupuestada",
  "esperando_aprobacion",
  "esperando_repuestos",
  "en_reparacion",
  "terminada",
  "lista_para_retirar",
  "retirada",
  "cancelada",
];

export default function TallerDetallePage() {
  const { ordenId } = useParams();
  const [orden, setOrden] = useState(null);
  const [variantes, setVariantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [busquedaVariante, setBusquedaVariante] = useState("");
  const [itemForm, setItemForm] = useState({ id_variante: "", cantidad: "1", precio_unitario: "" });

  useEffect(() => {
    cargarTodo();
  }, [ordenId]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      const [ordenData, variantesData] = await Promise.all([
        obtenerOrdenTaller(ordenId),
        listarVariantes(),
      ]);
      setOrden(ordenData);
      setNuevoEstado(ordenData.estado);
      setVariantes(variantesData || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar la orden de taller");
    } finally {
      setLoading(false);
    }
  }

  async function refrescarOrden() {
    const data = await obtenerOrdenTaller(ordenId);
    setOrden(data);
    setNuevoEstado(data.estado);
  }

  const variantesFiltradas = useMemo(() => {
    const q = busquedaVariante.trim().toLowerCase();
    const base = variantes || [];
    if (!q) return base.slice(0, 80);

    return base
      .filter((v) => [v.id, v.producto_nombre, v.nombre_variante, v.sku].filter(Boolean).join(" ").toLowerCase().includes(q))
      .slice(0, 80);
  }, [variantes, busquedaVariante]);

  function seleccionarVariante(id) {
    const variante = variantes.find((v) => String(v.id) === String(id));
    setItemForm({
      id_variante: id,
      cantidad: itemForm.cantidad || "1",
      precio_unitario: variante?.precio_minorista != null ? String(variante.precio_minorista) : "0",
    });
  }

  async function cambiarEstado(e) {
    e.preventDefault();
    if (!nuevoEstado || nuevoEstado === orden.estado) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await cambiarEstadoOrdenTaller(ordenId, { nuevo_estado: nuevoEstado, id_usuario: 1 });
      await refrescarOrden();
      setMensaje("Estado actualizado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado");
    } finally {
      setGuardando(false);
    }
  }

  async function agregarItem(e) {
    e.preventDefault();

    if (!itemForm.id_variante) {
      setError("Seleccioná una variante para agregar al trabajo");
      return;
    }

    if (Number(itemForm.cantidad) <= 0) {
      setError("La cantidad debe ser mayor a cero");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await agregarItemOrdenTaller(ordenId, {
        id_variante: Number(itemForm.id_variante),
        cantidad: Number(itemForm.cantidad),
        precio_unitario: Number(itemForm.precio_unitario || 0),
        id_usuario: 1,
      });
      setItemForm({ id_variante: "", cantidad: "1", precio_unitario: "" });
      setBusquedaVariante("");
      await refrescarOrden();
      setMensaje("Item agregado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo agregar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function aprobarItem(item, aprobado) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await aprobarItemOrdenTaller(ordenId, item.id, { aprobado, id_usuario: 1 });
      await refrescarOrden();
      setMensaje(aprobado ? "Item aprobado" : "Item marcado como no aprobado");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la aprobación del item");
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarItem(item) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await ejecutarItemOrdenTaller(ordenId, item.id, 1);
      await refrescarOrden();
      setMensaje("Item ejecutado correctamente");
    } catch (err) {
      setError(err.message || "No se pudo ejecutar el item");
    } finally {
      setGuardando(false);
    }
  }

  async function revertirItem(item) {
    const motivo = window.prompt("Motivo de la reversión");
    if (!motivo || !motivo.trim()) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await revertirEjecucionItemOrdenTaller(ordenId, item.id, { id_usuario: 1, motivo: motivo.trim() });
      await refrescarOrden();
      setMensaje("Ejecución revertida correctamente");
    } catch (err) {
      setError(err.message || "No se pudo revertir la ejecución");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando orden...</p>;
  if (!orden) return <p style={{ padding: "24px" }}>No se encontró la orden.</p>;

  const items = orden.items || [];
  const eventos = orden.eventos || [];

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Orden de taller #{orden.id}</h1>
          <p style={mutedStyle}>Ingresada: {formatDate(orden.fecha_ingreso)}</p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarTodo}>Refrescar</button>
          <Link to="/taller" style={linkBtnStyle}>Volver</Link>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Resumen</h2>
          <div style={infoGridStyle}>
            <Info label="Estado" value={<EstadoBadge estado={orden.estado} />} />
            <Info label="Cliente" value={`#${orden.id_cliente}`} />
            <Info label="Bicicleta" value={`#${orden.id_bicicleta_cliente}`} />
            <Info label="Total" value={formatMoney(orden.total_final)} />
            <Info label="Saldo pendiente" value={formatMoney(orden.saldo_pendiente)} />
            <Info label="Sucursal" value={`#${orden.id_sucursal}`} />
            <Info label="Problema reportado" value={orden.problema_reportado} full />
            <Info label="Observaciones" value={orden.observaciones || "-"} full />
          </div>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Cambiar estado</h2>
          <form onSubmit={cambiarEstado} style={{ display: "grid", gap: "10px" }}>
            <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} style={inputStyle}>
              {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
            </select>
            <button type="submit" disabled={guardando || nuevoEstado === orden.estado}>Actualizar estado</button>
          </form>
          <div style={noteStyle}>
            La UI no debe forzar estados inválidos. Si el backend rechaza una transición, respetá esa regla y no la “parchees” en frontend.
          </div>
        </aside>
      </div>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Agregar repuesto / item</h2>
        <form onSubmit={agregarItem} style={itemGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Buscar variante</span>
            <input value={busquedaVariante} onChange={(e) => setBusquedaVariante(e.target.value)} placeholder="Buscar por producto, variante o SKU" style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Variante</span>
            <select value={itemForm.id_variante} onChange={(e) => seleccionarVariante(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar variante</option>
              {variantesFiltradas.map((v) => (
                <option key={v.id} value={v.id}>
                  #{v.id} - {v.producto_nombre} / {v.nombre_variante} {v.sku ? `(${v.sku})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Cantidad</span>
            <input type="number" min="0.01" step="0.01" value={itemForm.cantidad} onChange={(e) => setItemForm((p) => ({ ...p, cantidad: e.target.value }))} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Precio unitario</span>
            <input type="number" min="0" step="0.01" value={itemForm.precio_unitario} onChange={(e) => setItemForm((p) => ({ ...p, precio_unitario: e.target.value }))} style={inputStyle} />
          </label>

          <button type="submit" disabled={guardando} style={{ alignSelf: "end" }}>Agregar item</button>
        </form>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Items de la orden</h2>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: "18px" }}>Todavía no hay items cargados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Descripción</th>
                  <th style={thStyle}>Cant.</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>Subtotal</th>
                  <th style={thStyle}>Aprobado</th>
                  <th style={thStyle}>Etapa</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{item.id}</td>
                    <td style={tdStyle}>{item.descripcion_snapshot}</td>
                    <td style={tdStyle}>{Number(item.cantidad).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>{formatMoney(item.precio_unitario)}</td>
                    <td style={tdStyle}>{formatMoney(item.subtotal)}</td>
                    <td style={tdStyle}>{item.aprobado ? "Sí" : "No"}</td>
                    <td style={tdStyle}>{item.etapa}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {!item.aprobado && <button disabled={guardando} onClick={() => aprobarItem(item, true)}>Aprobar</button>}
                        {item.aprobado && <button disabled={guardando} onClick={() => aprobarItem(item, false)}>Desaprobar</button>}
                        <button disabled={guardando || !item.aprobado} onClick={() => ejecutarItem(item)}>Ejecutar</button>
                        <button disabled={guardando} onClick={() => revertirItem(item)}>Revertir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Eventos</h2>
        {eventos.length === 0 ? (
          <div>No hay eventos registrados.</div>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {eventos.map((evento) => (
              <div key={evento.id} style={eventStyle}>
                <strong>{evento.tipo_evento}</strong>
                <span style={mutedStyle}>{formatDate(evento.fecha)} · Usuario #{evento.id_usuario}</span>
                {evento.detalle && <div>{evento.detalle}</div>}
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
    <div style={{ gridColumn: full ? "1 / -1" : "auto", background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px" }}>
      <div style={{ fontSize: "13px", color: "#667085", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(360px, 1.4fr) minmax(280px, 0.8fr)", gap: "16px", alignItems: "start" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const infoGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "12px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const itemGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", alignItems: "end" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1050px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const eventStyle = { background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px", display: "grid", gap: "5px" };
