import { useEffect, useState } from "react";
import { Link, useParams,useSearchParams } from "react-router-dom";
import PagoVentaPanel from "../components/pagos/PagoVentaPanel";
import {
  obtenerVenta,
  anularVenta,
  entregarVenta,
  devolverVentaSerializada,
} from "../services/ventasService";
import { EstadoVentaBadge, formatDate, formatMoney } from "./VentasListPage";

export default function VentaDetallePage() {
  const { ventaId } = useParams();
  const [searchParams] = useSearchParams();
  const enfocarPagos = searchParams.get("pagar") === "1";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarVenta();
  }, [ventaId]);

  async function cargarVenta() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const res = await obtenerVenta(ventaId);
      setData(res);
    } catch (err) {
      setError(err.message || "No se pudo cargar la venta");
    } finally {
      setLoading(false);
    }
  }

  async function handleEntregarVenta() {
    const confirmar = window.confirm(
      "¿Confirmás la entrega de esta venta? Si tiene saldo pendiente, el backend exigirá permiso y creará deuda."
    );
    if (!confirmar) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      await entregarVenta(ventaId, { id_usuario: 1 });
      await cargarVenta();
      setMensaje("Venta entregada correctamente");
    } catch (err) {
      setError(err.message || "No se pudo entregar la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleAnularVenta() {
    const motivo = window.prompt("Motivo de anulación de la venta:");
    if (!motivo || motivo.trim().length < 3) {
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      const result = await anularVenta(ventaId, {
        motivo: motivo.trim(),
        id_usuario: 1,
      });
      await cargarVenta();
      setMensaje(
        result.credito_generado
          ? `Venta anulada. Crédito generado: ${formatMoney(result.monto_credito)}`
          : "Venta anulada correctamente"
      );
    } catch (err) {
      setError(err.message || "No se pudo anular la venta");
    } finally {
      setProcesando(false);
    }
  }

  async function handleDevolverSerializada(item) {
    if (!item.id_bicicleta_serializada) return;

    const motivo = window.prompt("Motivo de devolución de bicicleta serializada:");
    if (!motivo || motivo.trim().length < 3) {
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      const result = await devolverVentaSerializada(ventaId, {
        id_bicicleta_serializada: Number(item.id_bicicleta_serializada),
        motivo: motivo.trim(),
        id_usuario: 1,
      });
      await cargarVenta();
      setMensaje(`Devolución registrada. ID devolución: ${result.devolucion_id}`);
    } catch (err) {
      setError(err.message || "No se pudo registrar la devolución serializada");
    } finally {
      setProcesando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando detalle de venta...</p>;
  if (!data) return <p style={{ padding: "24px" }}>No se encontró la venta.</p>;

  const { venta, items = [], situacion_financiera } = data;
  const puedeAnular = ["creada", "pagada_parcial", "pagada_total"].includes(venta.estado);
  const puedeEntregar = !["entregada", "anulada"].includes(venta.estado);
  const tieneDeuda = situacion_financiera?.tiene_deuda;
  const deuda = situacion_financiera?.deuda_abierta;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Venta #{venta.id}</h1>
          <p style={mutedStyle}>Fecha: {formatDate(venta.fecha)}</p>
        </div>

        <div style={actionsStyle}>
          <button onClick={cargarVenta}>Refrescar</button>
          <Link to="/ventas" style={linkBtnStyle}>Volver</Link>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Resumen</h2>
          <div style={infoGridStyle}>
            <Info label="Estado" value={<EstadoVentaBadge estado={venta.estado} />} />
            <Info label="Cliente" value={`${venta.cliente_nombre} (#${venta.id_cliente})`} />
            <Info label="Sucursal" value={`${venta.sucursal_nombre} (#${venta.id_sucursal})`} />
            <Info label="Subtotal" value={formatMoney(venta.subtotal_base)} />
            <Info label="Descuento" value={formatMoney(venta.descuento_total)} />
            <Info label="Recargo" value={formatMoney(venta.recargo_total)} />
            <Info label="Total final" value={formatMoney(venta.total_final)} />
            <Info label="Saldo pendiente" value={formatMoney(venta.saldo_pendiente)} />
          </div>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Acciones</h2>
          <div style={{ display: "grid", gap: "10px" }}>
            {puedeEntregar && (
              <button onClick={handleEntregarVenta} disabled={procesando}>
                Entregar venta
              </button>
            )}

            {puedeAnular && (
              <button onClick={handleAnularVenta} disabled={procesando}>
                Anular venta
              </button>
            )}

            {!puedeEntregar && !puedeAnular && (
              <span style={mutedStyle}>Sin acciones principales disponibles.</span>
            )}
          </div>

          <div style={noteStyle}>
            La entrega con saldo pendiente no se fuerza desde UI. El backend decide según permisos y genera deuda si corresponde.
          </div>
        </aside>
      </div>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Situación financiera</h2>
        {tieneDeuda ? (
          <div style={warningStyle}>
            <strong>Venta con deuda abierta.</strong>
            <div>ID deuda: #{deuda.id}</div>
            <div>Saldo actual: {formatMoney(deuda.saldo_actual)}</div>
            <div>Estado: {deuda.estado}</div>
            <Link to={`/deudas/${deuda.id}`} style={{ fontWeight: "bold" }}>Ver deuda</Link>
          </div>
        ) : (
          <div style={successSoftStyle}>No hay deuda abierta asociada a esta venta.</div>
        )}
      </section>
      <PagoVentaPanel
        ventaId={venta.id}
        saldoPendiente={venta.saldo_pendiente}
        estadoVenta={venta.estado}
        autoFocusPago={enfocarPagos}
      />
      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Items</h2>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: "18px" }}>La venta no tiene items.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table cellPadding="10" style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Variante</th>
                  <th style={thStyle}>Serializada</th>
                  <th style={thStyle}>Descripción</th>
                  <th style={thStyle}>Cantidad</th>
                  <th style={thStyle}>Precio lista</th>
                  <th style={thStyle}>Precio final</th>
                  <th style={thStyle}>Costo</th>
                  <th style={thStyle}>Subtotal</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={tdStyle}>#{item.id}</td>
                    <td style={tdStyle}>#{item.id_variante}</td>
                    <td style={tdStyle}>{item.id_bicicleta_serializada ? `#${item.id_bicicleta_serializada}` : "-"}</td>
                    <td style={tdStyle}>{item.descripcion_snapshot}</td>
                    <td style={tdStyle}>{Number(item.cantidad).toLocaleString("es-AR")}</td>
                    <td style={tdStyle}>{formatMoney(item.precio_lista)}</td>
                    <td style={tdStyle}>{formatMoney(item.precio_final)}</td>
                    <td style={tdStyle}>{formatMoney(item.costo_unitario_aplicado)}</td>
                    <td style={tdStyle}>{formatMoney(item.subtotal)}</td>
                    <td style={tdStyle}>
                      {venta.estado === "entregada" && item.id_bicicleta_serializada ? (
                        <button onClick={() => handleDevolverSerializada(item)} disabled={procesando}>
                          Devolver serializada
                        </button>
                      ) : (
                        <span style={mutedStyle}>-</span>
                      )}
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

function Info({ label, value }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #eaecf0", borderRadius: "12px", padding: "12px" }}>
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
const successSoftStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6" };
const warningStyle = { background: "#fff8e1", color: "#8a6d00", padding: "12px", borderRadius: "10px", border: "1px solid #f3dc97", display: "grid", gap: "6px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "12px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "1180px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
