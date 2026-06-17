import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarPagos, revertirPago } from "../services/pagosService";
import { formatMoney, formatDate } from "../utils/formatters";
import { PromptModal } from "../components/ui/PromptModal";
import { getReciboPagoUrl } from "../services/documentosService";
import { OperationalStatusBadge } from "../components/ui";

import { useSession } from "../context/SessionContext";
import useMediaQuery from "../hooks/useMediaQuery";

const ESTADOS = ["todos", "confirmado", "revertido", "devuelto_externo"];
const ORIGENES = ["todos", "venta", "deuda_cliente"];
const MEDIOS = ["todos", "efectivo", "transferencia", "mercadopago", "tarjeta"];

export default function PagosPage() {
  const { usuarioId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1120px)");
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [filtro, setFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [origenFiltro, setOrigenFiltro] = useState("todos");
  const [medioFiltro, setMedioFiltro] = useState("todos");
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  const [promptConfig, setPromptConfig] = useState(null);

  function pedirPrompt(config) {
    return new Promise((resolve) => {
      setPromptConfig({
        ...config,
        onConfirm: (value) => {
          setPromptConfig(null);
          resolve(value);
        },
        onCancel: () => {
          setPromptConfig(null);
          resolve(null);
        },
      });
    });
  }

  useEffect(() => {
    cargarPagos();
  }, []);

  async function cargarPagos() {
    try {
      setLoading(true);
      setError("");
      const data = await listarPagos();
      const lista = data || [];
      setPagos(lista);
      setPagoSeleccionado((actual) => {
        if (!actual) return lista[0] || null;
        return lista.find((pago) => pago.id === actual.id) || lista[0] || null;
      });
    } catch (err) {
      setError(err.message || "No se pudieron cargar los pagos");
    } finally {
      setLoading(false);
    }
  }

  const pagosFiltrados = useMemo(() => {
    const q = normalizarTexto(filtro);
    const base = pagos || [];

    return base.filter((pago) => {
      if (estadoFiltro !== "todos" && pago.estado !== estadoFiltro) return false;
      if (origenFiltro !== "todos" && pago.origen_tipo !== origenFiltro) return false;
      if (medioFiltro !== "todos" && pago.medio_pago !== medioFiltro) return false;

      if (!q) return true;

      const texto = normalizarTexto([
        pago.id,
        pago.origen_tipo,
        pago.origen_id,
        pago.medio_pago,
        pago.estado,
        pago.nota,
        pago.id_cliente,
        pago.id_usuario,
      ].filter(Boolean).join(" "));

      return texto.includes(q);
    });
  }, [pagos, filtro, estadoFiltro, origenFiltro, medioFiltro]);

  const resumen = useMemo(() => {
    return pagosFiltrados.reduce(
      (acc, pago) => {
        const confirmado = pago.estado === "confirmado";
        const montoCobrado = Number(pago.monto_total_cobrado || 0);
        const montoBase = Number(pago.monto_base_aplicado || 0);
        const recargo = Number(pago.monto_recargo_aplicado || 0);

        acc.total += 1;

        if (confirmado) {
          acc.confirmados += 1;
          acc.cobradoReal += montoCobrado;
          acc.baseAplicada += montoBase;
          acc.recargos += recargo;
        }

        if (pago.estado === "revertido") acc.revertidos += 1;
        if (pago.estado === "devuelto_externo") acc.devueltosExternos += 1;
        if (pago.origen_tipo === "venta") acc.pagosVenta += 1;
        if (pago.origen_tipo === "deuda_cliente") acc.pagosDeuda += 1;

        return acc;
      },
      {
        total: 0,
        confirmados: 0,
        revertidos: 0,
        devueltosExternos: 0,
        pagosVenta: 0,
        pagosDeuda: 0,
        cobradoReal: 0,
        baseAplicada: 0,
        recargos: 0,
      }
    );
  }, [pagosFiltrados]);

  async function handleRevertirPago(pago) {
    const motivo = await pedirPrompt({
      title: "Revertir pago",
      message: `Vas a revertir el pago #${pago.id}. Esta acción debe quedar justificada.`,
      label: "Motivo de reversión",
      required: true,
      minLength: 3,
      confirmText: "Revertir pago",
    });

    if (!motivo || !motivo.trim()) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await revertirPago(pago.id, {
        motivo: motivo.trim(),
        id_usuario: usuarioId,
      });

      await cargarPagos();
      setMensaje(`Pago #${pago.id} revertido correctamente`);
    } catch (err) {
      setError(err.message || "No se pudo revertir el pago");
    } finally {
      setGuardando(false);
    }
  }

  function limpiarFiltros() {
    setFiltro("");
    setEstadoFiltro("todos");
    setOrigenFiltro("todos");
    setMedioFiltro("todos");
  }

  const detalle = pagoSeleccionado || pagosFiltrados[0] || null;

  if (loading) return <div style={styles.state}>Cargando pagos...</div>;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Pagos</p>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Control de pagos</h1>
          <p style={styles.subtitle}>
            Revisión global de cobros, pagos de deuda, medios de pago y reversión.
          </p>
        </div>

        <div style={isMobile ? styles.heroActionsMobile : styles.heroActions}>
          <button type="button" onClick={cargarPagos} disabled={guardando} style={{ ...styles.secondaryHeroButton, ...(isMobile ? styles.fullWidth : {}) }}>
            ↻ Refrescar
          </button>
        </div>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      <section style={isMobile ? styles.metricsGridMobile : styles.metricsGrid}>
        <Metric label="Cobrado real" value={formatMoney(resumen.cobradoReal)} tone="ok" />
        <Metric label="Base aplicada" value={formatMoney(resumen.baseAplicada)} tone="info" />
        <Metric label="Recargos" value={formatMoney(resumen.recargos)} tone="orange" />
        <Metric label="Confirmados" value={resumen.confirmados} tone="ok" />
        <Metric label="Revertidos" value={resumen.revertidos} tone={resumen.revertidos > 0 ? "danger" : "muted"} />
        <Metric label="Pagos deuda" value={resumen.pagosDeuda} tone="warning" />
      </section>

      <main style={isNarrow ? styles.layoutMobile : styles.layout}>
        <section style={styles.mainColumn}>
          <section style={styles.card}>
            <div style={isMobile ? styles.toolbarHeaderMobile : styles.toolbarHeader}>
              <div>
                <p style={styles.eyebrow}>Búsqueda y filtros</p>
                <h2 style={styles.cardTitle}>Pagos registrados</h2>
              </div>
              <div style={styles.counterBadge}>{pagosFiltrados.length} de {pagos.length}</div>
            </div>

            <div style={isMobile ? styles.filtersGridMobile : styles.filtersGrid}>
              <label style={styles.fieldWide}>
                <span style={styles.label}>Buscar</span>
                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="ID, origen, medio, estado, cliente, nota..."
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Estado</span>
                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={styles.input}>
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>{estado === "todos" ? "Todos" : labelEstadoPago(estado)}</option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Origen</span>
                <select value={origenFiltro} onChange={(e) => setOrigenFiltro(e.target.value)} style={styles.input}>
                  {ORIGENES.map((origen) => (
                    <option key={origen} value={origen}>{origen === "todos" ? "Todos" : labelOrigen(origen)}</option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Medio</span>
                <select value={medioFiltro} onChange={(e) => setMedioFiltro(e.target.value)} style={styles.input}>
                  {MEDIOS.map((medio) => (
                    <option key={medio} value={medio}>{medio === "todos" ? "Todos" : labelMedioPago(medio)}</option>
                  ))}
                </select>
              </label>

              <button type="button" onClick={limpiarFiltros} style={{ ...styles.secondaryButton, ...(isMobile ? styles.fullWidth : {}) }}>
                Limpiar
              </button>
            </div>
          </section>

          <section style={styles.cardNoPadding}>
            {pagosFiltrados.length === 0 ? (
              <div style={styles.empty}>No hay pagos para mostrar con esos filtros.</div>
            ) : (
              <div style={styles.paymentsList}>
                {pagosFiltrados.map((pago) => (
                  <PagoCard
                    key={pago.id}
                    pago={pago}
                    selected={detalle?.id === pago.id}
                    guardando={guardando}
                    onSelect={() => setPagoSeleccionado(pago)}
                    onRevertir={() => handleRevertirPago(pago)}
                  />
                ))}
              </div>
            )}
          </section>
        </section>

        <aside style={isNarrow ? styles.sidePanelMobile : styles.sidePanel}>
          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Detalle del pago</h2>
            {detalle ? (
              <PagoDetalle pago={detalle} guardando={guardando} onRevertir={() => handleRevertirPago(detalle)} />
            ) : (
              <div style={styles.emptySmall}>Seleccioná un pago para ver el detalle.</div>
            )}
          </section>

          <section style={styles.card}>
            <h2 style={styles.sideTitle}>Lectura operativa</h2>
            <div style={styles.tipsBox}>
              <p>
                <strong>Cobrado real</strong> es la plata que entró a caja o medio externo.
              </p>
              <p>
                <strong>Base aplicada</strong> es cuánto saldo comercial cubrió el pago.
              </p>
              <p>
                En pagos de deuda puede pasar que la base aplicada sea mayor al efectivo cobrado.
              </p>
            </div>
          </section>
        </aside>
      </main>

      <PromptModal
        open={Boolean(promptConfig)}
        title={promptConfig?.title}
        message={promptConfig?.message}
        label={promptConfig?.label}
        defaultValue={promptConfig?.defaultValue}
        placeholder={promptConfig?.placeholder}
        inputType={promptConfig?.inputType}
        confirmText={promptConfig?.confirmText}
        cancelText={promptConfig?.cancelText}
        required={promptConfig?.required}
        minLength={promptConfig?.minLength}
        validate={promptConfig?.validate}
        onConfirm={promptConfig?.onConfirm}
        onCancel={promptConfig?.onCancel}
      />
    </div>
  );
}

function PagoCard({ pago, selected, guardando, onSelect, onRevertir }) {
  const confirmado = pago.estado === "confirmado";
  const montoReal = Number(pago.monto_total_cobrado || 0);
  const montoBase = Number(pago.monto_base_aplicado || 0);
  const diferencia = Math.max(montoBase - montoReal, 0);

  return (
    <article style={selected ? styles.paymentCardSelected : styles.paymentCard} onClick={onSelect}>
      <div style={styles.paymentTop}>
        <div>
          <div style={styles.paymentTitleLine}>
            <strong>Pago #{pago.id}</strong>
            <OrigenBadge origen={pago.origen_tipo} />
            <EstadoPagoBadge estado={pago.estado} />
          </div>
          <p style={styles.muted}>
            {formatDate(pago.fecha)} · {renderOrigen(pago)} · {labelMedioPago(pago.medio_pago)}
          </p>
        </div>

        <strong style={styles.paymentAmount}>{formatMoney(montoReal)}</strong>
      </div>

      <div style={styles.paymentMetaGrid}>
        <InfoCompact label="Cliente" value={pago.id_cliente ? `#${pago.id_cliente}` : "-"} />
        <InfoCompact label="Base aplicada" value={formatMoney(montoBase)} />
        <InfoCompact label="Recargo" value={formatMoney(pago.monto_recargo_aplicado || 0)} />
        <InfoCompact label="Diferencia" value={formatMoney(diferencia)} />
      </div>

      <div style={styles.paymentBottom}>
        <span style={styles.noteText}>{pago.nota || "Sin nota"}</span>

        {confirmado && pago.origen_tipo === "venta" ? (
          <div style={styles.inlineActions}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.open(getReciboPagoUrl(pago.id), "_blank", "noopener,noreferrer");
              }}
              style={styles.smallSecondary}
            >
              Recibo
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={(e) => {
                e.stopPropagation();
                onRevertir();
              }}
              style={styles.smallDanger}
            >
              Revertir
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(getReciboPagoUrl(pago.id), "_blank", "noopener,noreferrer");
            }}
            style={styles.smallSecondary}
          >
            Recibo
          </button>
        )}
      </div>
    </article>
  );
}

function PagoDetalle({ pago, guardando, onRevertir }) {
  const montoReal = Number(pago.monto_total_cobrado || 0);
  const montoBase = Number(pago.monto_base_aplicado || 0);
  const recargo = Number(pago.monto_recargo_aplicado || 0);
  const diferencia = Math.max(montoBase - montoReal, 0);

  return (
    <div style={styles.detailBox}>
      <div style={styles.detailHeader}>
        <div>
          <span style={styles.label}>Pago</span>
          <h3 style={styles.detailTitle}>#{pago.id}</h3>
        </div>
        <EstadoPagoBadge estado={pago.estado} />
      </div>

      <div style={styles.detailMoney}>
        <span>Cobrado real</span>
        <strong>{formatMoney(montoReal)}</strong>
      </div>

      <div style={styles.infoStack}>
        <Info label="Origen" value={renderOrigen(pago)} />
        <Info label="Medio" value={labelMedioPago(pago.medio_pago)} />
        <Info label="Cliente" value={pago.id_cliente ? `#${pago.id_cliente}` : "-"} />
        <Info label="Base aplicada" value={formatMoney(montoBase)} />
        <Info label="Recargo aplicado" value={formatMoney(recargo)} />
        <Info label="Diferencia no cobrada" value={formatMoney(diferencia)} />
        <Info label="Usuario" value={formatUsuario(pago)} />
        <Info label="Fecha" value={formatDate(pago.fecha)} />
      </div>

      {pago.nota && (
        <div style={styles.noteBox}>
          <span style={styles.label}>Nota</span>
          <p>{pago.nota}</p>
        </div>
      )}

      {pago.estado === "confirmado" && pago.origen_tipo === "venta" ? (
        <div style={styles.actionStack}>
          <button type="button" onClick={() => window.open(getReciboPagoUrl(pago.id), "_blank", "noopener,noreferrer")} style={styles.secondaryButtonFull}>
            Ver recibo PDF
          </button>
          <button type="button" disabled={guardando} onClick={onRevertir} style={styles.dangerButtonFull}>
            Revertir pago
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => window.open(getReciboPagoUrl(pago.id), "_blank", "noopener,noreferrer")} style={styles.secondaryButtonFull}>
          Ver recibo PDF
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function InfoCompact({ label, value }) {
  return (
    <div style={styles.infoCompact}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatUsuario(item) {
  if (item.usuario_nombre) {
    return item.usuario_username
      ? `${item.usuario_nombre} (@${item.usuario_username})`
      : item.usuario_nombre;
  }

  return item.id_usuario ? `Usuario #${item.id_usuario}` : "-";
}

function EstadoPagoBadge({ estado }) {
  return <OperationalStatusBadge domain="pago" status={estado} />;
}

function OrigenBadge({ origen }) {
  const tone = origen === "venta" ? "info" : origen === "deuda_cliente" ? "warning" : "muted";
  return <span style={{ ...styles.badge, ...(styles.badgeTones[tone] || {}) }}>{labelOrigen(origen)}</span>;
}

function renderOrigen(pago) {
  if (pago.origen_tipo === "venta") {
    return <Link to={`/ventas/${pago.origen_id}`} style={styles.inlineLink}>Venta #{pago.origen_id}</Link>;
  }

  if (pago.origen_tipo === "deuda_cliente") {
    return <Link to={`/deudas/${pago.origen_id}`} style={styles.inlineLink}>Deuda #{pago.origen_id}</Link>;
  }

  return `${pago.origen_tipo || "Origen"} #${pago.origen_id || "-"}`;
}

function labelEstadoPago(estado) {
  const labels = {
    confirmado: "Confirmado",
    revertido: "Revertido",
    devuelto_externo: "Devuelto externo",
  };
  return labels[estado] || estado || "-";
}

function labelOrigen(origen) {
  const labels = {
    venta: "Venta",
    deuda_cliente: "Deuda",
  };
  return labels[origen] || origen || "-";
}

function labelMedioPago(medio) {
  const labels = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    mercadopago: "Mercado Pago",
    tarjeta: "Tarjeta",
  };
  return labels[medio] || medio || "-";
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  pageMobile: { padding: 12, overflowX: "hidden" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", boxShadow: "0 18px 40px rgba(15,23,42,.18)", marginBottom: 16 },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", padding: 16, borderRadius: 18 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000, letterSpacing: "-.03em" },
  titleMobile: { fontSize: 26 },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  heroActionsMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  secondaryHeroButton: { textDecoration: "none", border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12, marginBottom: 16 },
  metricsGridMobile: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 14 },
  metric: { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, display: "grid", gap: 5, boxShadow: "0 10px 22px rgba(15,23,42,.06)" },
  metricTones: { ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" }, info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }, warning: { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" }, danger: { color: "#b42318", background: "#fff1f0", borderColor: "#fecaca" }, muted: { color: "#475569", background: "#f8fafc" }, orange: { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" } },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16, alignItems: "start" },
  layoutMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start" },
  mainColumn: { display: "grid", gap: 16 },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  cardNoPadding: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, overflow: "hidden", boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  toolbarHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 14 },
  toolbarHeaderMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "start", marginBottom: 14 },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  cardTitle: { margin: "3px 0 0", fontSize: 22, letterSpacing: "-.02em" },
  counterBadge: { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", borderRadius: 999, padding: "8px 10px", fontWeight: 900 },
  filtersGrid: { display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 150px 150px 150px auto", gap: 12, alignItems: "end" },
  filtersGridMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "stretch" },
  field: { display: "grid", gap: 7, fontSize: 14, fontWeight: 900 },
  fieldWide: { display: "grid", gap: 7, fontSize: 14, fontWeight: 900 },
  label: { color: "#334155", fontSize: 13, fontWeight: 900 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 13, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 14px", fontWeight: 1000, cursor: "pointer" },
  paymentsList: { display: "grid", gap: 10, padding: 16 },
  paymentCard: { border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, display: "grid", gap: 12, cursor: "pointer", background: "white" },
  paymentCardSelected: { border: "1px solid #f97316", borderRadius: 18, padding: 14, display: "grid", gap: 12, cursor: "pointer", background: "#fff7ed", boxShadow: "0 10px 22px rgba(249,115,22,.12)" },
  paymentTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  paymentTitleLine: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  paymentAmount: { fontSize: 18, whiteSpace: "nowrap" },
  paymentMetaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))", gap: 8 },
  paymentBottom: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10 },
  inlineActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  badge: { borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 1000, border: "1px solid transparent", whiteSpace: "nowrap" },
  badgeTones: { ok: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }, info: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }, warning: { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }, danger: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }, muted: { background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" } },
  muted: { color: "#64748b", margin: "4px 0 0", fontWeight: 700 },
  noteText: { color: "#64748b", fontWeight: 800 },
  smallDanger: { border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallSecondary: { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallMuted: { color: "#64748b", fontWeight: 800 },
  sidePanel: { display: "grid", gap: 16, position: "sticky", top: 16 },
  sidePanelMobile: { display: "grid", gap: 14, position: "static" },
  sideTitle: { margin: "0 0 12px", fontSize: 20 },
  detailBox: { display: "grid", gap: 12 },
  detailHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  detailTitle: { margin: "3px 0 0", fontSize: 30 },
  detailMoney: { background: "#ecfdf5", color: "#047857", border: "1px solid #bbf7d0", borderRadius: 18, padding: 14, display: "grid", gap: 5 },
  infoStack: { display: "grid", gap: 9 },
  infoBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, display: "grid", gap: 5, color: "#64748b" },
  infoCompact: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 9, display: "grid", gap: 3, color: "#64748b" },
  noteBox: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 14, padding: 12 },
  actionStack: { display: "grid", gap: 10 },
  dangerButtonFull: { width: "100%", border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  secondaryButtonFull: { width: "100%", border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  tipsBox: { display: "grid", gap: 10, color: "#475569", fontWeight: 700 },
  inlineLink: { color: "#1d4ed8", fontWeight: 900, textDecoration: "none" },
  empty: { padding: 22, color: "#64748b", fontWeight: 900 },
  emptySmall: { color: "#64748b", fontWeight: 900, background: "#f8fafc", borderRadius: 14, padding: 12 },
  state: { padding: 24, fontWeight: 900 },
  fullWidth: { width: "100%" },
};
