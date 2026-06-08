import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import {
  Badge,
  Button,
  Card,
  MetricCard,
  ResponsiveActions,
  ResponsiveHeader,
  ResponsiveMetricsGrid,
  ResponsivePage,
  ResponsiveTableCards,
  ResponsiveTabs,
  useBreakpoint,
} from "../components/ui";
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

const ventaColumns = [
  { key: "venta", label: "Venta" },
  { key: "fecha", label: "Fecha" },
  { key: "estado", label: "Estado" },
  { key: "total", label: "Total" },
  { key: "saldo", label: "Saldo" },
  { key: "accion", label: "Acción" },
];

const deudaColumns = [
  { key: "deuda", label: "Deuda" },
  { key: "origen", label: "Origen" },
  { key: "saldo", label: "Saldo" },
  { key: "estado", label: "Estado" },
  { key: "recargo", label: "Recargo" },
  { key: "accion", label: "Acción" },
];

const creditoColumns = [
  { key: "credito", label: "Crédito" },
  { key: "origen", label: "Origen" },
  { key: "saldo", label: "Saldo" },
  { key: "estado", label: "Estado" },
  { key: "observacion", label: "Observación" },
  { key: "accion", label: "Acción" },
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
  const isMobile = useBreakpoint();

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return <ResponsivePage><div style={styles.state}>Cargando cuenta del cliente...</div></ResponsivePage>;
  }

  if (error) {
    return (
      <ResponsivePage>
        <div style={styles.alert}>Error: {error}</div>
      </ResponsivePage>
    );
  }

  if (!cliente) {
    return <ResponsivePage><div style={styles.state}>No se encontró el cliente.</div></ResponsivePage>;
  }

  const tieneDeuda = Number(resumenFinanciero.saldoDeuda || 0) > 0;
  const tieneCredito = Number(resumenFinanciero.saldoCredito || 0) > 0;

  return (
    <ResponsivePage>
      <Card bodyStyle={{ padding: isMobile ? 14 : 20 }}>
        <ResponsiveHeader
          title={cliente.nombre}
          subtitle={`Cliente #${cliente.id} · ${cliente.telefono || "Sin teléfono"} · DNI ${cliente.dni || "-"}`}
          beforeTitle={
            <button type="button" onClick={() => navigate("/clientes")} style={styles.backButton}>
              ← Volver a clientes
            </button>
          }
          badges={
            <>
              <StatusBadge active={cliente.activo} />
              {tieneDeuda && <Badge variant="danger">Con deuda</Badge>}
              {tieneCredito && <Badge variant="success">Con crédito</Badge>}
            </>
          }
          actions={
            <>
              <Button type="button" variant="outline" onClick={cargarTodo} fullWidth={isMobile}>
                Refrescar
              </Button>

              {cliente.id !== 1 && (
                <ActionLink to={`/clientes/${cliente.id}/editar`} variant="secondary">
                  Editar datos
                </ActionLink>
              )}

              <ActionLink to="/ventas/nueva" variant="primary">
                Nueva venta
              </ActionLink>

              <ActionLink to="/taller/nueva" variant="outline">
                Nueva orden taller
              </ActionLink>
            </>
          }
          actionsColumns={2}
        />
      </Card>

      <ResponsiveMetricsGrid mobileColumns={2}>
        <MetricCard label="Comprado" value={formatMoney(resumen?.total_comprado ?? 0)} tone="primary" emphasize />
        <MetricCard label="Deuda abierta" value={formatMoney(resumenFinanciero.saldoDeuda)} tone={tieneDeuda ? "danger" : "success"} emphasize />
        <MetricCard label="Crédito a favor" value={formatMoney(resumenFinanciero.saldoCredito)} tone={tieneCredito ? "success" : "default"} emphasize />
        <MetricCard label="Balance" value={formatMoney(resumenFinanciero.balance)} tone={resumenFinanciero.balance >= 0 ? "success" : "danger"} emphasize />
        <MetricCard label="Ventas" value={resumen?.cantidad_ventas ?? 0} emphasize />
        <MetricCard label="Bicicletas" value={bicicletas.length} tone="primary" emphasize />
      </ResponsiveMetricsGrid>

      <Card bodyStyle={{ padding: isMobile ? 14 : 18 }}>
        <div style={isMobile ? styles.accountMobile : styles.accountDesktop}>
          <div>
            <p style={styles.kicker}>Estado de cuenta</p>
            <h2 style={styles.accountTitle}>{getEstadoCuenta(tieneDeuda, tieneCredito)}</h2>
            <p style={styles.accountText}>
              Esta pantalla concentra ventas, deudas, créditos, bicicletas y datos fiscales del cliente.
            </p>
          </div>

          <ResponsiveActions columns={3}>
            <Button type="button" variant={tieneDeuda ? "danger" : "outline"} onClick={() => setTabActiva(TAB_DEUDAS)} fullWidth={isMobile}>
              Ver deudas
            </Button>
            <Button type="button" variant={tieneCredito ? "primary" : "outline"} onClick={() => setTabActiva(TAB_CREDITOS)} fullWidth={isMobile}>
              Ver créditos
            </Button>
            <Button type="button" variant="outline" onClick={() => setTabActiva(TAB_VENTAS)} fullWidth={isMobile}>
              Ver ventas
            </Button>
          </ResponsiveActions>
        </div>
      </Card>

      <ResponsiveTabs tabs={TABS} activeTab={tabActiva} onChange={setTabActiva} />

      {tabActiva === TAB_RESUMEN && (
        <TwoColumnGrid>
          <Card title="Resumen financiero" subtitle="Lo que importa antes de vender o entregar algo.">
            <InfoGrid>
              <Info label="Deudas abiertas" value={resumenFinanciero.deudasAbiertas.length} />
              <Info label="Saldo deuda" value={formatMoney(resumenFinanciero.saldoDeuda)} strong={tieneDeuda} tone={tieneDeuda ? "danger" : undefined} />
              <Info label="Créditos disponibles" value={resumenFinanciero.creditosDisponibles.length} />
              <Info label="Saldo crédito" value={formatMoney(resumenFinanciero.saldoCredito)} strong={tieneCredito} tone={tieneCredito ? "success" : undefined} />
              <Info label="Última venta" value={resumen?.ultima_venta_fecha ? formatDate(resumen.ultima_venta_fecha) : "-"} />
              <Info label="Total comprado" value={formatMoney(resumen?.total_comprado ?? 0)} />
            </InfoGrid>
          </Card>

          <Card title="Contacto y perfil" subtitle="Datos para atención rápida.">
            <InfoGrid>
              <Info label="Teléfono" value={cliente.telefono || "-"} />
              <Info label="DNI" value={cliente.dni || "-"} />
              <Info label="Dirección" value={cliente.direccion || "-"} />
              <Info label="Tipo" value={renderTipo(cliente.tipo_cliente)} />
              <Info label="IVA" value={renderCondicionIva(cliente.condicion_iva)} />
              <Info label="CUIT" value={cliente.cuit || "-"} />
            </InfoGrid>
          </Card>
        </TwoColumnGrid>
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
        <TwoColumnGrid>
          <Card title="Datos personales" subtitle="Identificación y contacto.">
            <InfoGrid>
              <Info label="Nombre" value={cliente.nombre} />
              <Info label="Teléfono" value={cliente.telefono || "-"} />
              <Info label="DNI" value={cliente.dni || "-"} />
              <Info label="Dirección" value={cliente.direccion || "-"} full />
              <Info label="Tipo cliente" value={renderTipo(cliente.tipo_cliente)} />
              <Info label="Condición IVA" value={renderCondicionIva(cliente.condicion_iva)} />
            </InfoGrid>
          </Card>

          <Card title="Datos fiscales y notas" subtitle="Información administrativa.">
            <InfoGrid>
              <Info label="CUIT" value={cliente.cuit || "-"} />
              <Info label="Razón social" value={cliente.razon_social || "-"} full />
              <Info label="Notas" value={cliente.notas || "-"} full />
            </InfoGrid>
          </Card>
        </TwoColumnGrid>
      )}

      {cliente.id !== 1 && cliente.activo && (
        <AdministrativeAction
          title="Acciones administrativas"
          text="Desactivar evita nuevas operaciones, pero conserva el historial."
          action={<Button type="button" variant="danger" onClick={handleDesactivar}>Desactivar cliente</Button>}
        />
      )}

      {cliente.id !== 1 && !cliente.activo && (
        <AdministrativeAction
          title="Cliente inactivo"
          text="Podés reactivarlo si vuelve a operar."
          action={<Button type="button" variant="primary" onClick={handleActivar}>Activar cliente</Button>}
        />
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
    </ResponsivePage>
  );
}

function getEstadoCuenta(tieneDeuda, tieneCredito) {
  if (tieneDeuda && tieneCredito) return "Tiene deuda y crédito a revisar";
  if (tieneDeuda) return "Tiene deuda pendiente";
  if (tieneCredito) return "Tiene crédito a favor";
  return "Cuenta sin pendientes";
}

function ActionLink({ to, children, variant = "outline" }) {
  const stylesByVariant = {
    primary: {
      background: "#ff6a00",
      border: "1px solid #ff6a00",
      color: "white",
    },
    secondary: {
      background: "#0f172a",
      border: "1px solid #0f172a",
      color: "white",
    },
    outline: {
      background: "white",
      border: "1px solid #cbd5e1",
      color: "#0f172a",
    },
  };

  return (
    <Link to={to} style={{ ...styles.actionLink, ...(stylesByVariant[variant] || stylesByVariant.outline) }}>
      {children}
    </Link>
  );
}

function TwoColumnGrid({ children }) {
  const isMobile = useBreakpoint();
  return <section style={{ ...styles.twoColumnGrid, ...(isMobile ? styles.oneColumnGrid : {}) }}>{children}</section>;
}

function InfoGrid({ children }) {
  return <div style={styles.infoGrid}>{children}</div>;
}

function Info({ label, value, full = false, strong = false, tone }) {
  return (
    <div style={{ ...styles.infoBox, gridColumn: full ? "1 / -1" : "auto" }}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={{ ...styles.infoValue, ...(strong ? styles.strongValue : {}), ...(tone ? styles.valueTones[tone] : {}) }}>
        {value || "-"}
      </strong>
    </div>
  );
}

function StatusBadge({ active }) {
  return <Badge variant={active ? "success" : "default"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

function VentasTable({ ventas, navigate }) {
  return (
    <ResponsiveTableCards
      columns={ventaColumns}
      data={ventas}
      emptyMessage="No hay ventas asociadas a este cliente."
      renderRow={(venta) => (
        <>
          <td style={styles.td}><strong>#{venta.id}</strong></td>
          <td style={styles.td}>{formatDate(venta.fecha)}</td>
          <td style={styles.td}><EstadoOperacionBadge estado={venta.estado} /></td>
          <td style={styles.td}>{formatMoney(venta.total)}</td>
          <td style={styles.td}>{formatMoney(venta.saldo_pendiente)}</td>
          <td style={styles.td}><Link to={`/ventas/${venta.id}`} style={styles.linkAction}>Ver venta</Link></td>
        </>
      )}
      renderCard={(venta) => (
        <RecordCard
          eyebrow="Venta"
          title={`#${venta.id}`}
          badge={<EstadoOperacionBadge estado={venta.estado} />}
          fields={[
            { label: "Fecha", value: formatDate(venta.fecha) },
            { label: "Total", value: formatMoney(venta.total), strong: true },
            { label: "Saldo", value: formatMoney(venta.saldo_pendiente) },
          ]}
          action={<Link to={`/ventas/${venta.id}`} style={styles.mobilePrimaryAction}>Ver venta</Link>}
        />
      )}
    />
  );
}

function DeudasTable({ deudas }) {
  return (
    <ResponsiveTableCards
      columns={deudaColumns}
      data={deudas}
      emptyMessage="No hay deudas registradas para este cliente."
      renderRow={(deuda) => (
        <>
          <td style={styles.td}><strong>#{deuda.id}</strong></td>
          <td style={styles.td}>{renderOrigen(deuda)}</td>
          <td style={{ ...styles.td, ...styles.amountDangerIf(Number(deuda.saldo_actual || 0) > 0) }}>{formatMoney(deuda.saldo_actual)}</td>
          <td style={styles.td}><EstadoOperacionBadge estado={deuda.estado} /></td>
          <td style={styles.td}>{deuda.genera_recargo ? `${deuda.tasa_recargo || "-"}%` : "No"}</td>
          <td style={styles.td}><Link to={`/deudas/${deuda.id}`} style={styles.linkAction}>Ver deuda</Link></td>
        </>
      )}
      renderCard={(deuda) => (
        <RecordCard
          eyebrow="Deuda"
          title={`#${deuda.id}`}
          badge={<EstadoOperacionBadge estado={deuda.estado} />}
          fields={[
            { label: "Origen", value: renderOrigen(deuda) },
            {
              label: "Saldo",
              value: formatMoney(deuda.saldo_actual),
              strong: true,
              tone: Number(deuda.saldo_actual || 0) > 0 ? "danger" : "success",
            },
            { label: "Recargo", value: deuda.genera_recargo ? `${deuda.tasa_recargo || "-"}%` : "No" },
          ]}
          action={<Link to={`/deudas/${deuda.id}`} style={styles.mobilePrimaryAction}>Ver deuda</Link>}
        />
      )}
    />
  );
}

function CreditosTable({ creditos }) {
  return (
    <ResponsiveTableCards
      columns={creditoColumns}
      data={creditos}
      emptyMessage="No hay créditos registrados para este cliente."
      renderRow={(credito) => (
        <>
          <td style={styles.td}><strong>#{credito.id}</strong></td>
          <td style={styles.td}>{renderOrigen(credito)}</td>
          <td style={{ ...styles.td, ...styles.amountSuccessIf(Number(credito.saldo_actual || 0) > 0) }}>{formatMoney(credito.saldo_actual)}</td>
          <td style={styles.td}><EstadoOperacionBadge estado={credito.estado} /></td>
          <td style={styles.td}>{credito.observacion || "-"}</td>
          <td style={styles.td}><Link to={`/creditos/${credito.id}`} style={styles.linkAction}>Ver crédito</Link></td>
        </>
      )}
      renderCard={(credito) => (
        <RecordCard
          eyebrow="Crédito"
          title={`#${credito.id}`}
          badge={<EstadoOperacionBadge estado={credito.estado} />}
          fields={[
            { label: "Origen", value: renderOrigen(credito) },
            {
              label: "Saldo",
              value: formatMoney(credito.saldo_actual),
              strong: true,
              tone: Number(credito.saldo_actual || 0) > 0 ? "success" : undefined,
            },
            { label: "Observación", value: credito.observacion || "-", full: true },
          ]}
          action={<Link to={`/creditos/${credito.id}`} style={styles.mobilePrimaryAction}>Ver crédito</Link>}
        />
      )}
    />
  );
}

function RecordCard({ eyebrow, title, badge, fields, action }) {
  return (
    <div style={styles.recordCardInner}>
      <div style={styles.recordHeader}>
        <div>
          <span style={styles.recordEyebrow}>{eyebrow}</span>
          <strong style={styles.recordTitle}>{title}</strong>
        </div>
        {badge}
      </div>

      <div style={styles.recordGrid}>
        {fields.map((field) => (
          <MobileField key={`${field.label}-${field.value}`} {...field} />
        ))}
      </div>

      {action}
    </div>
  );
}

function MobileField({ label, value, strong = false, tone, full = false }) {
  return (
    <div style={{ ...styles.mobileField, ...(full ? styles.mobileFieldFull : {}) }}>
      <span style={styles.mobileFieldLabel}>{label}</span>
      <strong style={{ ...(strong ? styles.strongValue : {}), ...(tone ? styles.valueTones[tone] : {}) }}>
        {value || "-"}
      </strong>
    </div>
  );
}

function BicicletasGrid({ cliente, bicicletas }) {
  const isMobile = useBreakpoint();

  if (!bicicletas.length) {
    return <div style={styles.empty}>Este cliente todavía no tiene bicicletas registradas.</div>;
  }

  return (
    <div style={{ ...styles.bikeGrid, ...(isMobile ? styles.bikeGridMobile : {}) }}>
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

function AdministrativeAction({ title, text, action }) {
  const isMobile = useBreakpoint();

  return (
    <Card bodyStyle={{ padding: 16 }} style={styles.dangerZoneCard}>
      <div style={{ ...styles.adminAction, ...(isMobile ? styles.adminActionMobile : {}) }}>
        <div>
          <strong>{title}</strong>
          <p style={styles.adminText}>{text}</p>
        </div>
        {action}
      </div>
    </Card>
  );
}

function EstadoOperacionBadge({ estado }) {
  const variant = getEstadoVariant(estado);
  return <Badge variant={variant} style={styles.estadoBadge}>{estado || "-"}</Badge>;
}

function getEstadoVariant(estado) {
  switch (estado) {
    case "abierta":
    case "creada":
    case "pagada_parcial":
    case "aplicado_parcial":
      return "warning";
    case "cerrada":
    case "entregada":
    case "pagada_total":
    case "abierto":
      return "success";
    case "cancelada":
    case "anulada":
      return "danger";
    case "aplicado_total":
      return "default";
    default:
      return "default";
  }
}

function renderOrigen(item) {
  return `${item.origen_tipo || "-"}${item.origen_id ? ` #${item.origen_id}` : ""}`;
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
  backButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 0,
    marginBottom: 10,
    fontWeight: 900,
    color: "#0f172a",
  },
  actionLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    textDecoration: "none",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    minHeight: 40,
    boxSizing: "border-box",
  },
  accountDesktop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  accountMobile: {
    display: "grid",
    gap: 14,
  },
  kicker: {
    margin: 0,
    color: "#ff6a00",
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
    color: "#64748b",
    fontWeight: 700,
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 16,
  },
  oneColumnGrid: {
    gridTemplateColumns: "1fr",
    gap: 12,
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
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  infoValue: {
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  strongValue: {
    fontWeight: 1000,
  },
  valueTones: {
    danger: { color: "#b42318" },
    success: { color: "#047857" },
  },
  td: {
    padding: "13px 14px",
    borderTop: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    fontWeight: 700,
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
    whiteSpace: "nowrap",
  },
  recordCardInner: {
    display: "grid",
    gap: 12,
  },
  recordHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  recordEyebrow: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  recordTitle: {
    display: "block",
    marginTop: 2,
    fontSize: 18,
  },
  recordGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  mobileField: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 10,
    background: "#f8fafc",
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  mobileFieldFull: {
    gridColumn: "1 / -1",
  },
  mobileFieldLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  mobilePrimaryAction: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    borderRadius: 12,
    padding: "11px 12px",
    background: "#2563eb",
    color: "white",
    fontWeight: 1000,
  },
  bikeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  bikeGridMobile: {
    gridTemplateColumns: "1fr",
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
  dangerZoneCard: {
    border: "1px solid #fecaca",
  },
  adminAction: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
  },
  adminActionMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    alignItems: "stretch",
  },
  adminText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  amountDangerIf: (active) => ({
    fontWeight: 900,
    color: active ? "#b42318" : "#067647",
  }),
  amountSuccessIf: (active) => ({
    fontWeight: 900,
    color: active ? "#067647" : "#475467",
  }),
};
