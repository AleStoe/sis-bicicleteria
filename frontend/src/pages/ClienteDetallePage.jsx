import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { formatMoney, formatDate } from "../utils/formatters";
import {
  obtenerCliente,
  desactivarCliente,
  activarCliente,
  listarBicicletasCliente,
} from "../services/clientesService";
import { listarDeudas } from "../services/deudasService";
import { listarCreditosCliente } from "../services/creditosService";

const TAB_RESUMEN = "resumen";
const TAB_VENTAS = "ventas";
const TAB_DEUDAS = "deudas";
const TAB_CREDITOS = "creditos";
const TAB_BICICLETAS = "bicicletas";
const TAB_DATOS = "datos";

const TABS = [
  { id: TAB_RESUMEN, label: "Resumen" },
  { id: TAB_VENTAS, label: "Ventas" },
  { id: TAB_DEUDAS, label: "Deudas" },
  { id: TAB_CREDITOS, label: "Créditos" },
  { id: TAB_BICICLETAS, label: "Bicicletas" },
  { id: TAB_DATOS, label: "Datos" },
];

export default function ClienteDetallePage() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [bicicletas, setBicicletas] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [creditos, setCreditos] = useState([]);
  const [tabActiva, setTabActiva] = useState(TAB_RESUMEN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmConfig, setConfirmConfig] = useState(null);

  useEffect(() => {
    cargarTodo();
  }, [clienteId]);

  function pedirConfirmacion(config) {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...config,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        },
      });
    });
  }

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");

      const [detalle, bicis, creditosData, deudasData] = await Promise.all([
        obtenerCliente(clienteId),
        listarBicicletasCliente(clienteId),
        listarCreditosCliente(clienteId),
        listarDeudas({ q: String(clienteId), estado: "" }),
      ]);

      const deudasDelCliente = Array.isArray(deudasData)
        ? deudasData.filter((deuda) => String(deuda.id_cliente) === String(clienteId))
        : [];

      setData(detalle);
      setBicicletas(Array.isArray(bicis) ? bicis : []);
      setCreditos(Array.isArray(creditosData) ? creditosData : []);
      setDeudas(deudasDelCliente);
    } catch (err) {
      setError(err.message || "No se pudo cargar el cliente");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivar() {
    const confirmar = await pedirConfirmacion({
      title: "Activar cliente",
      message: "¿Seguro que querés activar este cliente?",
      confirmText: "Activar",
      cancelText: "Cancelar",
      variant: "info",
    });

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
    const confirmar = await pedirConfirmacion({
      title: "Desactivar cliente",
      message: "¿Seguro que querés desactivar este cliente?",
      confirmText: "Desactivar",
      cancelText: "Cancelar",
      variant: "warning",
    });

    if (!confirmar) return;

    try {
      setError("");
      await desactivarCliente(clienteId);
      await cargarTodo();
    } catch (err) {
      setError(err.message || "No se pudo desactivar el cliente");
    }
  }

  const cliente = data?.cliente;
  const resumen = data?.resumen_ventas || {};
  const ventas = data?.ventas_recientes || [];

  const resumenFinanciero = useMemo(() => {
    const deudasAbiertas = deudas.filter((deuda) => deuda.estado === "abierta");
    const saldoDeuda = deudasAbiertas.reduce(
      (acc, deuda) => acc + Number(deuda.saldo_actual || 0),
      0
    );

    const creditosDisponibles = creditos.filter((credito) =>
      ["abierto", "aplicado_parcial"].includes(credito.estado)
    );
    const saldoCredito = creditosDisponibles.reduce(
      (acc, credito) => acc + Number(credito.saldo_actual || 0),
      0
    );

    return {
      deudasAbiertas,
      creditosDisponibles,
      saldoDeuda,
      saldoCredito,
      balance: saldoCredito - saldoDeuda,
    };
  }, [deudas, creditos]);

  if (loading) {
    return <div style={styles.state}>Cargando cuenta del cliente...</div>;
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.alert}>Error: {error}</div>
      </div>
    );
  }

  if (!cliente) {
    return <div style={styles.state}>No se encontró el cliente.</div>;
  }

  const tieneDeuda = Number(resumenFinanciero.saldoDeuda || 0) > 0;
  const tieneCredito = Number(resumenFinanciero.saldoCredito || 0) > 0;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <button type="button" onClick={() => navigate("/clientes")} style={styles.backButton}>
            ← Volver a clientes
          </button>

          <div style={styles.titleRow}>
            <h1 style={styles.title}>{cliente.nombre}</h1>
            <StatusBadge active={cliente.activo} />
            {tieneDeuda && <span style={styles.debtBadge}>Con deuda</span>}
            {tieneCredito && <span style={styles.creditBadge}>Con crédito</span>}
          </div>

          <p style={styles.subtitle}>
            Cliente #{cliente.id} · {cliente.telefono || "Sin teléfono"} · DNI {cliente.dni || "-"}
          </p>
        </div>

        <div style={styles.headerActions}>
          <button type="button" onClick={cargarTodo} style={styles.secondaryButton}>
            Refrescar
          </button>

          {cliente.id !== 1 && (
            <Link to={`/clientes/${cliente.id}/editar`} style={styles.primaryLink}>
              Editar datos
            </Link>
          )}

          <Link to="/ventas/nueva" style={styles.orangeLink}>
            Nueva venta
          </Link>

          <Link to="/taller/nueva" style={styles.secondaryLink}>
            Nueva orden taller
          </Link>
        </div>
      </header>

      <section style={styles.scoreboard}>
        <Metric label="Comprado" value={formatMoney(resumen?.total_comprado ?? 0)} tone="info" />
        <Metric label="Deuda abierta" value={formatMoney(resumenFinanciero.saldoDeuda)} tone={tieneDeuda ? "danger" : "success"} />
        <Metric label="Crédito a favor" value={formatMoney(resumenFinanciero.saldoCredito)} tone={tieneCredito ? "success" : "muted"} />
        <Metric label="Balance" value={formatMoney(resumenFinanciero.balance)} tone={resumenFinanciero.balance >= 0 ? "success" : "danger"} />
        <Metric label="Ventas" value={resumen?.cantidad_ventas ?? 0} tone="dark" />
        <Metric label="Bicicletas" value={bicicletas.length} tone="orange" />
      </section>

      <section style={styles.accountCard}>
        <div>
          <p style={styles.kicker}>Estado de cuenta</p>
          <h2 style={styles.accountTitle}>{getEstadoCuenta(tieneDeuda, tieneCredito)}</h2>
          <p style={styles.accountText}>
            Esta pantalla concentra ventas, deudas, créditos, bicicletas y datos fiscales del cliente.
          </p>
        </div>

        <div style={styles.quickActions}>
          <button type="button" onClick={() => setTabActiva(TAB_DEUDAS)} style={tieneDeuda ? styles.dangerOutlineButton : styles.secondaryButton}>
            Ver deudas
          </button>
          <button type="button" onClick={() => setTabActiva(TAB_CREDITOS)} style={tieneCredito ? styles.successOutlineButton : styles.secondaryButton}>
            Ver créditos
          </button>
          <button type="button" onClick={() => setTabActiva(TAB_VENTAS)} style={styles.secondaryButton}>
            Ver ventas
          </button>
        </div>
      </section>

      <nav style={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTabActiva(tab.id)}
            style={tabActiva === tab.id ? styles.tabActive : styles.tab}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {tabActiva === TAB_RESUMEN && (
        <section style={styles.gridTwo}>
          <Card title="Resumen financiero" subtitle="Lo que importa antes de vender o entregar algo.">
            <div style={styles.infoGrid}>
              <Info label="Deudas abiertas" value={resumenFinanciero.deudasAbiertas.length} />
              <Info label="Saldo deuda" value={formatMoney(resumenFinanciero.saldoDeuda)} strong={tieneDeuda} tone={tieneDeuda ? "danger" : undefined} />
              <Info label="Créditos disponibles" value={resumenFinanciero.creditosDisponibles.length} />
              <Info label="Saldo crédito" value={formatMoney(resumenFinanciero.saldoCredito)} strong={tieneCredito} tone={tieneCredito ? "success" : undefined} />
              <Info label="Última venta" value={resumen?.ultima_venta_fecha ? formatDate(resumen.ultima_venta_fecha) : "-"} />
              <Info label="Total comprado" value={formatMoney(resumen?.total_comprado ?? 0)} />
            </div>
          </Card>

          <Card title="Contacto y perfil" subtitle="Datos para atención rápida.">
            <div style={styles.infoGrid}>
              <Info label="Teléfono" value={cliente.telefono || "-"} />
              <Info label="DNI" value={cliente.dni || "-"} />
              <Info label="Dirección" value={cliente.direccion || "-"} />
              <Info label="Tipo" value={renderTipo(cliente.tipo_cliente)} />
              <Info label="IVA" value={renderCondicionIva(cliente.condicion_iva)} />
              <Info label="CUIT" value={cliente.cuit || "-"} />
            </div>
          </Card>
        </section>
      )}

      {tabActiva === TAB_VENTAS && (
        <Card title="Ventas recientes" subtitle="Últimos movimientos comerciales asociados al cliente.">
          <VentasTable ventas={ventas} navigate={navigate} />
        </Card>
      )}

      {tabActiva === TAB_DEUDAS && (
        <Card title="Deudas del cliente" subtitle="Cuenta corriente, saldos pendientes y cancelaciones.">
          <DeudasTable deudas={deudas} />
        </Card>
      )}

      {tabActiva === TAB_CREDITOS && (
        <Card title="Créditos del cliente" subtitle="Saldos comerciales a favor y créditos ya aplicados.">
          <CreditosTable creditos={creditos} />
        </Card>
      )}

      {tabActiva === TAB_BICICLETAS && (
        <Card title="Bicicletas del cliente" subtitle="Bicicletas registradas y acceso al historial de taller.">
          <BicicletasGrid cliente={cliente} bicicletas={bicicletas} />
        </Card>
      )}

      {tabActiva === TAB_DATOS && (
        <section style={styles.gridTwo}>
          <Card title="Datos personales" subtitle="Identificación y contacto.">
            <div style={styles.infoGrid}>
              <Info label="Nombre" value={cliente.nombre} />
              <Info label="Teléfono" value={cliente.telefono || "-"} />
              <Info label="DNI" value={cliente.dni || "-"} />
              <Info label="Dirección" value={cliente.direccion || "-"} full />
              <Info label="Tipo cliente" value={renderTipo(cliente.tipo_cliente)} />
              <Info label="Condición IVA" value={renderCondicionIva(cliente.condicion_iva)} />
            </div>
          </Card>

          <Card title="Datos fiscales y notas" subtitle="Información administrativa.">
            <div style={styles.infoGrid}>
              <Info label="CUIT" value={cliente.cuit || "-"} />
              <Info label="Razón social" value={cliente.razon_social || "-"} full />
              <Info label="Notas" value={cliente.notas || "-"} full />
            </div>
          </Card>
        </section>
      )}

      {cliente.id !== 1 && cliente.activo && (
        <section style={styles.dangerZone}>
          <div>
            <strong>Acciones administrativas</strong>
            <p>Desactivar evita nuevas operaciones, pero conserva el historial.</p>
          </div>
          <button type="button" onClick={handleDesactivar} style={styles.dangerButton}>
            Desactivar cliente
          </button>
        </section>
      )}

      {cliente.id !== 1 && !cliente.activo && (
        <section style={styles.dangerZone}>
          <div>
            <strong>Cliente inactivo</strong>
            <p>Podés reactivarlo si vuelve a operar.</p>
          </div>
          <button type="button" onClick={handleActivar} style={styles.successButton}>
            Activar cliente
          </button>
        </section>
      )}

      <ConfirmModal
        open={Boolean(confirmConfig)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        cancelText={confirmConfig?.cancelText}
        variant={confirmConfig?.variant}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={confirmConfig?.onCancel}
      />
    </div>
  );
}

function getEstadoCuenta(tieneDeuda, tieneCredito) {
  if (tieneDeuda && tieneCredito) return "Tiene deuda y crédito a revisar";
  if (tieneDeuda) return "Tiene deuda pendiente";
  if (tieneCredito) return "Tiene crédito a favor";
  return "Cuenta sin pendientes";
}

function Card({ title, subtitle, children }) {
  return (
    <section style={styles.card}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.cardTitle}>{title}</h2>
          {subtitle && <p style={styles.muted}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
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

function Info({ label, value, full = false, strong = false, tone }) {
  return (
    <div style={{ ...styles.infoBox, gridColumn: full ? "1 / -1" : "auto" }}>
      <span>{label}</span>
      <strong style={{ ...(strong ? styles.strongValue : {}), ...(tone ? styles.valueTones[tone] : {}) }}>
        {value || "-"}
      </strong>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span style={active ? styles.activeBadge : styles.inactiveBadge}>
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function VentasTable({ ventas, navigate }) {
  if (!ventas.length) {
    return <div style={styles.empty}>No hay ventas asociadas a este cliente.</div>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            <th style={styles.th}>Venta</th>
            <th style={styles.th}>Fecha</th>
            <th style={styles.th}>Estado</th>
            <th style={styles.th}>Total</th>
            <th style={styles.th}>Saldo</th>
            <th style={styles.th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {ventas.map((venta) => (
            <tr key={venta.id} style={styles.row} onDoubleClick={() => navigate(`/ventas/${venta.id}`)}>
              <td style={styles.td}><strong>#{venta.id}</strong></td>
              <td style={styles.td}>{formatDate(venta.fecha)}</td>
              <td style={styles.td}><EstadoOperacionBadge estado={venta.estado} /></td>
              <td style={styles.td}>{formatMoney(venta.total)}</td>
              <td style={styles.td}>{formatMoney(venta.saldo_pendiente)}</td>
              <td style={styles.td}><Link to={`/ventas/${venta.id}`} style={styles.linkAction}>Ver venta</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeudasTable({ deudas }) {
  if (!deudas.length) {
    return <div style={styles.empty}>No hay deudas registradas para este cliente.</div>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            <th style={styles.th}>Deuda</th>
            <th style={styles.th}>Origen</th>
            <th style={styles.th}>Saldo</th>
            <th style={styles.th}>Estado</th>
            <th style={styles.th}>Recargo</th>
            <th style={styles.th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {deudas.map((deuda) => (
            <tr key={deuda.id} style={styles.row}>
              <td style={styles.td}><strong>#{deuda.id}</strong></td>
              <td style={styles.td}>{deuda.origen_tipo || "-"}{deuda.origen_id ? ` #${deuda.origen_id}` : ""}</td>
              <td style={{ ...styles.td, fontWeight: 900, color: Number(deuda.saldo_actual || 0) > 0 ? "#b42318" : "#067647" }}>{formatMoney(deuda.saldo_actual)}</td>
              <td style={styles.td}><EstadoOperacionBadge estado={deuda.estado} /></td>
              <td style={styles.td}>{deuda.genera_recargo ? `${deuda.tasa_recargo || "-"}%` : "No"}</td>
              <td style={styles.td}><Link to={`/deudas/${deuda.id}`} style={styles.linkAction}>Ver deuda</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreditosTable({ creditos }) {
  if (!creditos.length) {
    return <div style={styles.empty}>No hay créditos registrados para este cliente.</div>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            <th style={styles.th}>Crédito</th>
            <th style={styles.th}>Origen</th>
            <th style={styles.th}>Saldo</th>
            <th style={styles.th}>Estado</th>
            <th style={styles.th}>Observación</th>
            <th style={styles.th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {creditos.map((credito) => (
            <tr key={credito.id} style={styles.row}>
              <td style={styles.td}><strong>#{credito.id}</strong></td>
              <td style={styles.td}>{credito.origen_tipo || "-"}{credito.origen_id ? ` #${credito.origen_id}` : ""}</td>
              <td style={{ ...styles.td, fontWeight: 900, color: Number(credito.saldo_actual || 0) > 0 ? "#067647" : "#475467" }}>{formatMoney(credito.saldo_actual)}</td>
              <td style={styles.td}><EstadoOperacionBadge estado={credito.estado} /></td>
              <td style={styles.td}>{credito.observacion || "-"}</td>
              <td style={styles.td}><Link to={`/creditos/${credito.id}`} style={styles.linkAction}>Ver crédito</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BicicletasGrid({ cliente, bicicletas }) {
  if (!bicicletas.length) {
    return <div style={styles.empty}>Este cliente todavía no tiene bicicletas registradas.</div>;
  }

  return (
    <div style={styles.bikeGrid}>
      {bicicletas.map((bici) => (
        <article key={bici.id} style={styles.bikeCard}>
          <div>
            <strong style={styles.bikeTitle}>{[bici.marca, bici.modelo].filter(Boolean).join(" ") || "Bicicleta sin modelo"}</strong>
            <p style={styles.bikeMeta}>Cuadro: {bici.numero_cuadro || "-"}</p>
          </div>

          <div style={styles.bikeSpecs}>
            <Info label="Rodado" value={bici.rodado || "-"} />
            <Info label="Color" value={bici.color || "-"} />
          </div>

          {bici.notas && <div style={styles.bikeNotes}>{bici.notas}</div>}

          <Link to={`/clientes/${cliente.id}/bicicletas/${bici.id}`} style={styles.linkAction}>
            Ver historial
          </Link>
        </article>
      ))}
    </div>
  );
}

function EstadoOperacionBadge({ estado }) {
  const style = getEstadoStyle(estado);
  return <span style={{ ...styles.estadoBadge, ...style }}>{estado || "-"}</span>;
}

function getEstadoStyle(estado) {
  switch (estado) {
    case "abierta":
    case "creada":
    case "pagada_parcial":
    case "aplicado_parcial":
      return { background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" };
    case "cerrada":
    case "entregada":
    case "pagada_total":
    case "abierto":
      return { background: "#ecfdf5", color: "#047857", borderColor: "#bbf7d0" };
    case "cancelada":
    case "anulada":
      return { background: "#fef2f2", color: "#b42318", borderColor: "#fecaca" };
    case "aplicado_total":
      return { background: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" };
    default:
      return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  }
}

function renderTipo(tipo) {
  const map = {
    consumidor_final: "Consumidor final",
    minorista: "Minorista",
    mayorista: "Mayorista",
  };
  return map[tipo] || tipo || "-";
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

const styles = {
  page: {
    minHeight: "100vh",
    padding: 22,
    background: "#f1f5f9",
    color: "#0f172a",
    display: "grid",
    gap: 16,
  },
  state: {
    padding: 24,
    fontWeight: 900,
    color: "#475569",
  },
  alert: {
    background: "#fff1f0",
    color: "#b42318",
    border: "1px solid #fecdca",
    borderRadius: 14,
    padding: 14,
    fontWeight: 800,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
  },
  backButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 0,
    marginBottom: 10,
    fontWeight: 900,
    color: "#0f172a",
  },
  titleRow: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "7px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryLink: {
    textDecoration: "none",
    border: "none",
    background: "#0f172a",
    color: "white",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
  },
  orangeLink: {
    textDecoration: "none",
    border: "none",
    background: "#f97316",
    color: "white",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    boxShadow: "0 10px 20px rgba(249, 115, 22, 0.22)",
  },
  secondaryLink: {
    textDecoration: "none",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  dangerOutlineButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b42318",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  successOutlineButton: {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  activeBadge: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 1000,
  },
  inactiveBadge: {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 1000,
  },
  debtBadge: {
    background: "#fef2f2",
    color: "#b42318",
    border: "1px solid #fecaca",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 1000,
  },
  creditBadge: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 1000,
  },
  scoreboard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  metric: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gap: 5,
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  },
  metricTones: {
    dark: { color: "#0f172a" },
    info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" },
    success: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" },
    danger: { color: "#b42318", background: "#fff1f0", borderColor: "#fecdca" },
    muted: { color: "#475569", background: "#f8fafc" },
    orange: { color: "#c2410c", background: "#fff7ed", borderColor: "#fed7aa" },
  },
  accountCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    background: "#0f172a",
    color: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.16)",
  },
  kicker: {
    margin: 0,
    color: "#fb923c",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  accountTitle: {
    margin: "3px 0 0",
    fontSize: 24,
    lineHeight: 1.15,
  },
  accountText: {
    margin: "7px 0 0",
    color: "#cbd5e1",
    fontWeight: 700,
  },
  quickActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  tabs: {
    display: "flex",
    gap: 9,
    flexWrap: "wrap",
  },
  tab: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#334155",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  tabActive: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "white",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)",
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 16,
  },
  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.02em",
  },
  muted: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  infoBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#ffffff",
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  strongValue: {
    fontWeight: 1000,
  },
  valueTones: {
    danger: { color: "#b42318" },
    success: { color: "#047857" },
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  thead: {
    background: "#f8fafc",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    color: "#475569",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  td: {
    padding: "13px 14px",
    borderTop: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  row: {
    cursor: "default",
  },
  linkAction: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 900,
  },
  empty: {
    color: "#64748b",
    padding: 18,
    borderRadius: 14,
    background: "#f8fafc",
    fontWeight: 900,
  },
  estadoBadge: {
    border: "1px solid",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },
  bikeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  bikeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    background: "#fff",
    display: "grid",
    gap: 12,
  },
  bikeTitle: {
    fontSize: 17,
  },
  bikeMeta: {
    margin: "5px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  bikeSpecs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  bikeNotes: {
    color: "#475569",
    background: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    fontWeight: 700,
  },
  dangerZone: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    background: "#fff",
    border: "1px solid #fecaca",
    borderRadius: 22,
    padding: 16,
  },
  dangerButton: {
    border: "none",
    background: "#b42318",
    color: "white",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  successButton: {
    border: "none",
    background: "#047857",
    color: "white",
    borderRadius: 13,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
  },
};
