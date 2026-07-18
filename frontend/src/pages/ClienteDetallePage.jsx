import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
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
  crearBicicletaCliente,
  obtenerHistorialCliente,
  obtenerTallerCliente,
} from "../services/clientesService";
import { normalizeTextUpper } from "../utils/textNormalization";

const TAB_RESUMEN = "resumen";
const TAB_HISTORIAL = "historial";
const TAB_TALLER = "taller";
const TAB_VENTAS = "ventas";
const TAB_DEUDAS = "deudas";
const TAB_CREDITOS = "creditos";
const TAB_RESERVAS = "reservas";
const TAB_PAGOS = "pagos";
const TAB_BICICLETAS = "bicicletas";
const TAB_DATOS = "datos";

const TABS = [
  { id: TAB_RESUMEN, label: "Resumen" },
  { id: TAB_HISTORIAL, label: "Historial" },
  { id: TAB_TALLER, label: "Taller" },
  { id: TAB_VENTAS, label: "Ventas" },
  { id: TAB_DEUDAS, label: "Deudas" },
  { id: TAB_CREDITOS, label: "Créditos" },
  { id: TAB_RESERVAS, label: "Reservas" },
  { id: TAB_PAGOS, label: "Pagos" },
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
  const [reservas, setReservas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [ordenesTaller, setOrdenesTaller] = useState([]);
  const [tabActiva, setTabActiva] = useState(TAB_RESUMEN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [mostrarAltaBici, setMostrarAltaBici] = useState(false);
  const [guardandoBici, setGuardandoBici] = useState(false);
  const [nuevaBici, setNuevaBici] = useState({ marca: "", modelo: "", rodado: "", color: "", numero_cuadro: "", notas: "" });
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

      const [detalle, bicis, historialData, tallerData] = await Promise.all([
        obtenerCliente(clienteId),
        listarBicicletasCliente(clienteId),
        obtenerHistorialCliente(clienteId),
        obtenerTallerCliente(clienteId),
      ]);

      setData({
        ...detalle,
        ventas_recientes: Array.isArray(historialData?.ventas)
          ? historialData.ventas
          : detalle?.ventas_recientes || [],
      });
      setBicicletas(Array.isArray(bicis) ? bicis : []);
      setCreditos(Array.isArray(historialData?.creditos) ? historialData.creditos : []);
      setDeudas(Array.isArray(historialData?.deudas) ? historialData.deudas : []);
      setReservas(Array.isArray(historialData?.reservas) ? historialData.reservas : []);
      setPagos(Array.isArray(historialData?.pagos) ? historialData.pagos : []);
      setOrdenesTaller(Array.isArray(tallerData) ? tallerData : []);
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

  function abrirAltaBicicleta() {
    setTabActiva(TAB_BICICLETAS);
    setMostrarAltaBici(true);
    setError("");
  }

  function cerrarAltaBicicleta() {
    setMostrarAltaBici(false);
    setNuevaBici({ marca: "", modelo: "", rodado: "", color: "", numero_cuadro: "", notas: "" });
  }

  function cambiarNuevaBici(campo, valor) {
    const upper = ["marca", "modelo", "color", "numero_cuadro"].includes(campo);
    setNuevaBici((prev) => ({
      ...prev,
      [campo]: upper ? normalizeTextUpper(valor) : valor,
    }));
  }

  async function guardarBicicletaCliente(e) {
    e.preventDefault();

    if (!nuevaBici.marca.trim() || !nuevaBici.modelo.trim()) {
      setError("Marca y modelo son obligatorios para cargar la bicicleta.");
      return;
    }

    try {
      setGuardandoBici(true);
      setError("");
      await crearBicicletaCliente(clienteId, limpiarObjeto(nuevaBici));
      const bicisActualizadas = await listarBicicletasCliente(clienteId);
      setBicicletas(Array.isArray(bicisActualizadas) ? bicisActualizadas : []);
      cerrarAltaBicicleta();
      setTabActiva(TAB_BICICLETAS);
    } catch (err) {
      setError(err.message || "No se pudo cargar la bicicleta del cliente");
    } finally {
      setGuardandoBici(false);
    }
  }

  const cliente = data?.cliente;
  const resumen = data?.resumen_ventas || {};
  const ventas = data?.ventas_recientes || [];
  const historialCliente = useMemo(
    () => buildHistorialCliente({ ventas, deudas, creditos, reservas, pagos, bicicletas }),
    [ventas, deudas, creditos, reservas, pagos, bicicletas]
  );

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
    return <ResponsivePage><EmptyState title="Cargando cuenta del cliente..." description="Actualizando historial y situación financiera." /></ResponsivePage>;
  }

  if (error) {
    return (
      <ResponsivePage>
        <div style={styles.alert}>Error: {error}</div>
      </ResponsivePage>
    );
  }

  if (!cliente) {
    return <ResponsivePage><EmptyState title="No se encontró el cliente" description="Volvé al listado e intentá nuevamente." /></ResponsivePage>;
  }

  const tieneDeuda = Number(resumenFinanciero.saldoDeuda || 0) > 0;
  const tieneCredito = Number(resumenFinanciero.saldoCredito || 0) > 0;
  const ultimaInteraccion = historialCliente[0] || null;
  const accionRecomendada = getAccionRecomendadaCliente({
    cliente,
    tieneDeuda,
    deudasAbiertas: resumenFinanciero.deudasAbiertas,
    bicicletas,
  });

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
              <ActionButton type="button" variant="outline" onClick={cargarTodo} fullWidth={isMobile}>
                Refrescar
              </ActionButton>

              {Number(cliente.id) !== 1 && (
                <ActionLink to={`/clientes/${cliente.id}/editar`} variant="secondary">
                  Editar datos
                </ActionLink>
              )}

              <ActionLink to={`/ventas/nueva?cliente_id=${cliente.id}`} variant="primary">
                Nueva venta
              </ActionLink>

              <ActionLink to={`/taller/nueva?cliente_id=${cliente.id}`} variant="outline">
                Nueva orden taller
              </ActionLink>

              {Number(cliente.id) !== 1 && (
                <ActionButton type="button" variant="outline" onClick={abrirAltaBicicleta} fullWidth={isMobile}>
                  Agregar bicicleta
                </ActionButton>
              )}
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
        <MetricCard label="Reservas" value={reservas.length} emphasize />
        <MetricCard label="Pagos" value={pagos.length} tone="success" emphasize />
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

      <Card bodyStyle={{ padding: isMobile ? 14 : 18 }}>
        <div style={isMobile ? styles.relationFocusMobile : styles.relationFocus}>
          <div>
            <p style={styles.kicker}>Centro de relacion</p>
            <h2 style={styles.accountTitle}>
              {ultimaInteraccion ? ultimaInteraccion.titulo : "Sin interacciones recientes"}
            </h2>
            <p style={styles.accountText}>
              {ultimaInteraccion
                ? `${ultimaInteraccion.tipo} - ${formatDate(ultimaInteraccion.fecha)} - ${ultimaInteraccion.detalle}`
                : "Todavia no hay movimientos para este cliente."}
            </p>
          </div>

          <div style={styles.recommendedActionBox}>
            <span style={styles.recommendedLabel}>Accion recomendada</span>
            <strong>{accionRecomendada.title}</strong>
            <p>{accionRecomendada.description}</p>
            <ActionLink to={accionRecomendada.to} variant={accionRecomendada.variant}>
              {accionRecomendada.label}
            </ActionLink>
          </div>
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

      {tabActiva === TAB_HISTORIAL && (
        <Card title="Historial del cliente" subtitle="Movimientos recientes con el contexto necesario para entenderlos sin abrir cada detalle.">
          <HistorialCliente items={historialCliente} />
        </Card>
      )}

      {tabActiva === TAB_TALLER && (
        <Card title="Historial de taller" subtitle="Qué se revisó, qué se hizo y qué repuestos se usaron en cada visita.">
          <TallerClienteList ordenes={ordenesTaller} />
        </Card>
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

      {tabActiva === TAB_RESERVAS && (
        <Card title="Reservas del cliente" subtitle="Reservas activas, vencidas, canceladas o convertidas en venta.">
          <ReservasList reservas={reservas} />
        </Card>
      )}

      {tabActiva === TAB_PAGOS && (
        <Card title="Pagos recientes" subtitle="Cobros asociados al cliente, con descuentos y financiacion aplicada.">
          <PagosList pagos={pagos} />
        </Card>
      )}

      {tabActiva === TAB_BICICLETAS && (
        <Card title="Bicicletas del cliente" subtitle="Bicicletas registradas y acceso al historial de taller.">
          {Number(cliente.id) !== 1 && (
            <div style={styles.sectionToolbar}>
              <Button type="button" variant="primary" onClick={abrirAltaBicicleta}>
                Agregar bicicleta
              </Button>
            </div>
          )}
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

      {Number(cliente.id) !== 1 && cliente.activo && (
        <AdministrativeAction
          title="Acciones administrativas"
          text="Desactivar evita nuevas operaciones, pero conserva el historial."
          action={<Button type="button" variant="danger" onClick={handleDesactivar}>Desactivar cliente</Button>}
        />
      )}

      {Number(cliente.id) !== 1 && !cliente.activo && (
        <AdministrativeAction
          title="Cliente inactivo"
          text="Podés reactivarlo si vuelve a operar."
          action={<Button type="button" variant="primary" onClick={handleActivar}>Activar cliente</Button>}
        />
      )}

      {mostrarAltaBici && (
        <BicicletaClienteModal
          cliente={cliente}
          values={nuevaBici}
          guardando={guardandoBici}
          isMobile={isMobile}
          onChange={cambiarNuevaBici}
          onSubmit={guardarBicicletaCliente}
          onClose={cerrarAltaBicicleta}
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

function getAccionRecomendadaCliente({ cliente, tieneDeuda, deudasAbiertas, bicicletas }) {
  const primeraDeuda = deudasAbiertas?.[0];
  const clienteId = cliente?.id;

  if (tieneDeuda && primeraDeuda) {
    return {
      title: "Cobrar deuda",
      description: "Tiene saldo pendiente. Conviene revisar la deuda antes de vender o entregar.",
      label: "Cobrar deuda",
      to: `/deudas/${primeraDeuda.id}`,
      variant: "primary",
    };
  }

  if ((bicicletas || []).length > 0) {
    return {
      title: "Crear OT",
      description: "Tiene bicicleta registrada. Podes iniciar taller sin perder trazabilidad.",
      label: "Crear OT",
      to: clienteId ? `/taller/nueva?cliente_id=${clienteId}` : "/taller/nueva",
      variant: "secondary",
    };
  }

  return {
    title: "Nueva venta",
    description: "Cuenta sin deuda abierta. Podes iniciar una venta normal.",
    label: "Nueva venta",
    to: clienteId ? `/ventas/nueva?cliente_id=${clienteId}` : "/ventas/nueva",
    variant: "primary",
  };
}

function buildHistorialCliente({ ventas, deudas, creditos, reservas, pagos, bicicletas }) {
  const items = [
    ...ventas.map((venta) => ({
      tipo: "Venta",
      fecha: venta.fecha,
      titulo: `Venta #${venta.id}`,
      lineas: [
        `Total: ${formatMoney(venta.total)} · Saldo: ${formatMoney(venta.saldo_pendiente)}`,
        venta.productos_resumen
          ? `${formatCantidadItems(venta.cantidad_items)}: ${venta.productos_resumen}`
          : formatCantidadItems(venta.cantidad_items),
        `Origen: ${renderOrigenVenta(venta.origen)}`,
      ],
      estado: venta.estado,
      to: `/ventas/${venta.id}`,
    })),
    ...deudas.map((deuda) => ({
      tipo: "Deuda",
      fecha: deuda.fecha_origen || deuda.fecha_creacion || deuda.fecha || deuda.created_at,
      titulo: `Deuda #${deuda.id}`,
      lineas: [
        `Saldo pendiente: ${formatMoney(deuda.saldo_actual)}`,
        deuda.venta_asociada_id ? `Asociada a Venta #${deuda.venta_asociada_id}` : renderOrigen(deuda),
        deuda.proximo_vencimiento ? `Próximo vencimiento: ${formatDate(deuda.proximo_vencimiento)}` : null,
      ],
      estado: deuda.estado,
      to: `/deudas/${deuda.id}`,
    })),
    ...creditos.map((credito) => ({
      tipo: "Crédito",
      fecha: credito.fecha_creacion || credito.fecha || credito.created_at,
      titulo: `Crédito #${credito.id}`,
      lineas: [
        `Disponible: ${formatMoney(credito.saldo_actual)} · Usado: ${formatMoney(credito.monto_usado)}`,
        credito.venta_asociada_id ? `Asociado a Venta #${credito.venta_asociada_id}` : renderOrigen(credito),
      ],
      estado: credito.estado,
      to: `/creditos/${credito.id}`,
    })),
    ...reservas.map((reserva) => ({
      tipo: "Reserva",
      fecha: reserva.fecha_reserva,
      titulo: `Reserva #${reserva.id}`,
      lineas: [
        `Seña: ${formatMoney(reserva.sena_total)} · Saldo: ${formatMoney(reserva.saldo_estimado)}`,
        reserva.producto_principal
          ? `${formatCantidadItems(reserva.cantidad_items)}: ${reserva.producto_principal}`
          : formatCantidadItems(reserva.cantidad_items),
      ],
      estado: reserva.estado,
      to: `/reservas/${reserva.id}`,
    })),
    ...pagos.map((pago) => ({
      tipo: "Pago",
      fecha: pago.fecha,
      titulo: `Pago #${pago.id}`,
      lineas: [
        `${renderMedioPago(pago.medio_pago)} · ${formatMoney(pago.monto_total_cobrado)}`,
        pago.venta_asociada_id
          ? `Aplicado a Venta #${pago.venta_asociada_id}`
          : renderOrigen(pago),
        Number(pago.monto_descuento_aplicado || 0) > 0
          ? `Bonificación aplicada: ${formatMoney(pago.monto_descuento_aplicado)}`
          : null,
        Number(pago.monto_recargo_aplicado || 0) > 0
          ? `Financiación: ${formatMoney(pago.monto_recargo_aplicado)}${pago.tarjeta_plan_nombre ? ` · ${pago.tarjeta_plan_nombre}` : ""}`
          : null,
      ],
      estado: pago.estado,
      to: getPagoOrigenUrl(pago),
    })),
    ...bicicletas.map((bici) => ({
      tipo: "Bicicleta",
      fecha: bici.fecha_compra || bici.created_at || bici.fecha_alta,
      titulo: [bici.marca, bici.modelo].filter(Boolean).join(" ") || `Bicicleta #${bici.id}`,
      lineas: [
        `Cuadro: ${bici.numero_cuadro || "-"}`,
        `Postventa: ${calcularEstadoPostventa(bici)}`,
      ],
      estado: bici.plan_postventa,
      to: `/clientes/${bici.id_cliente}/bicicletas/${bici.id}`,
    })),
  ];

  return items
    .filter((item) => item.fecha)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 30);
}

function HistorialCliente({ items }) {
  if (!items.length) {
    return <div style={styles.empty}>Todavia no hay historial para mostrar.</div>;
  }

  return (
    <div style={styles.relationshipTimeline}>
      {items.map((item, index) => (
        <div key={`${item.tipo}-${item.titulo}-${index}`} style={styles.relationshipItem}>
          <div style={styles.relationshipDot} />
          <div style={styles.relationshipCard}>
            <div style={styles.relationshipHeader}>
              <div>
                <span style={styles.recordEyebrow}>{item.tipo}</span>
                <strong>{item.titulo}</strong>
                <div style={styles.relationshipDate}>{formatDate(item.fecha)}</div>
              </div>
              {item.estado && <EstadoOperacionBadge estado={item.estado} />}
            </div>
            <div style={styles.relationshipLines}>
              {(item.lineas || [item.detalle])
                .filter(Boolean)
                .map((linea) => (
                  <p key={linea} style={styles.relationshipDetail}>{linea}</p>
                ))}
            </div>
            {item.to && <Link to={item.to} style={styles.linkAction}>Abrir</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TallerClienteList({ ordenes }) {
  if (!ordenes.length) {
    return <div style={styles.empty}>Este cliente todavía no tiene órdenes de taller.</div>;
  }

  return (
    <div style={styles.tallerList}>
      {ordenes.map((orden) => {
        const items = Array.isArray(orden.items) ? orden.items : [];
        const ejecutados = items.filter((item) => item.etapa === "ejecutado");
        const itemsVisibles = ejecutados.length ? ejecutados : items;
        const trabajos = itemsVisibles.filter((item) => item.tipo_item === "servicio");
        const repuestos = itemsVisibles.filter((item) => item.tipo_item === "repuesto");

        return (
          <article key={orden.id} style={styles.tallerCard}>
            <div style={styles.tallerHeader}>
              <div>
                <span style={styles.recordEyebrow}>Orden de taller</span>
                <strong style={styles.tallerTitle}>OT #{orden.id}</strong>
              </div>
              <EstadoOperacionBadge estado={orden.estado} />
            </div>

            <div style={styles.tallerMeta}>
              <strong>{orden.bicicleta_descripcion || `Bicicleta #${orden.bicicleta_id}`}</strong>
              <span>
                Ingreso: {formatDate(orden.fecha_ingreso)}
                {orden.fecha_retirada ? ` · Retiro: ${formatDate(orden.fecha_retirada)}` : ""}
              </span>
            </div>

            <TallerResumen title="Problema" text={orden.problema_reportado} />
            <TallerResumen title="Diagnóstico" text={orden.diagnostico} />
            <TallerItems title="Trabajos" items={trabajos} />
            <TallerItems title="Repuestos" items={repuestos} />
            <TallerResumen title="Notas" text={orden.observaciones} />

            {orden.cliente_avisado_retiro && (
              <div style={styles.tallerNotice}>
                Cliente avisado por WhatsApp
                {orden.fecha_aviso_retiro ? ` el ${formatDate(orden.fecha_aviso_retiro)}` : ""}.
              </div>
            )}

            <div style={styles.tallerFooter}>
              <div style={styles.tallerFinancial}>
                {Number(orden.total_final || 0) > 0 && (
                  <strong>Total OT: {formatMoney(orden.total_final)}</strong>
                )}
                {orden.id_venta_generada ? (
                  <Link to={`/ventas/${orden.id_venta_generada}`} style={styles.linkAction}>
                    Venta #{orden.id_venta_generada}
                  </Link>
                ) : (
                  <span style={styles.mutedText}>Sin venta generada</span>
                )}
              </div>
              <Link to={`/taller/${orden.id}`} style={styles.mobilePrimaryAction}>Ver OT</Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TallerResumen({ title, text }) {
  if (!text) return null;

  return (
    <section style={styles.tallerSection}>
      <strong style={styles.tallerSectionTitle}>{title}</strong>
      <p style={styles.tallerSectionText}>{text}</p>
    </section>
  );
}

function TallerItems({ title, items }) {
  if (!items.length) return null;

  return (
    <section style={styles.tallerSection}>
      <strong style={styles.tallerSectionTitle}>{title}</strong>
      <ul style={styles.tallerItems}>
        {items.map((item) => (
          <li key={item.id}>
            {item.descripcion}
            {Number(item.cantidad || 0) !== 1 ? ` × ${Number(item.cantidad)}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReservasList({ reservas }) {
  if (!reservas.length) {
    return <div style={styles.empty}>No hay reservas asociadas a este cliente.</div>;
  }

  const reservasRecientes = reservas
    .slice()
    .sort((a, b) => new Date(b.fecha_reserva).getTime() - new Date(a.fecha_reserva).getTime())
    .slice(0, 10);

  return (
    <div style={styles.simpleList}>
      {reservasRecientes.map((reserva) => (
        <RecordCard
          key={reserva.id}
          eyebrow="Reserva"
          title={`#${reserva.id}`}
          badge={<EstadoOperacionBadge estado={reserva.estado} />}
          fields={[
            { label: "Fecha", value: formatDate(reserva.fecha_reserva) },
            { label: "Vence", value: reserva.fecha_vencimiento ? formatDate(reserva.fecha_vencimiento) : "-" },
            { label: "Sena", value: formatMoney(reserva.sena_total), strong: true },
            { label: "Saldo", value: formatMoney(reserva.saldo_estimado) },
          ]}
          action={<Link to={`/reservas/${reserva.id}`} style={styles.mobilePrimaryAction}>Ver reserva</Link>}
        />
      ))}
    </div>
  );
}

function PagosList({ pagos }) {
  if (!pagos.length) {
    return <div style={styles.empty}>No hay pagos asociados a este cliente.</div>;
  }

  return (
    <div style={styles.simpleList}>
      {pagos.slice(0, 30).map((pago) => (
        <RecordCard
          key={pago.id}
          eyebrow={renderMedioPago(pago.medio_pago)}
          title={`Pago #${pago.id}`}
          badge={<EstadoOperacionBadge estado={pago.estado} />}
          fields={[
            { label: "Fecha", value: formatDate(pago.fecha) },
            { label: "Origen", value: renderOrigen(pago) },
            { label: "Cubre venta", value: formatMoney(pago.monto_base_aplicado ?? pago.monto_base ?? pago.monto_total_cobrado) },
            { label: "Descuento", value: formatMoney(pago.monto_descuento_aplicado ?? 0), tone: Number(pago.monto_descuento_aplicado || 0) > 0 ? "success" : undefined },
            { label: "Financiacion", value: formatMoney(pago.monto_recargo_aplicado ?? pago.monto_recargo_financiero ?? 0), tone: Number(pago.monto_recargo_aplicado || pago.monto_recargo_financiero || 0) > 0 ? "danger" : undefined },
            { label: "Cobrado", value: formatMoney(pago.monto_total_cobrado), strong: true },
          ]}
          action={
            getPagoOrigenUrl(pago) ? (
              <Link to={getPagoOrigenUrl(pago)} style={styles.mobilePrimaryAction}>Ver origen</Link>
            ) : null
          }
        />
      ))}
    </div>
  );
}

function ActionLink({ to, children, variant = "outline" }) {
  const variantStyle = getActionVariantStyle(variant);

  return (
    <Link to={to} style={{ ...styles.actionLink, ...variantStyle }}>
      {children}
    </Link>
  );
}

function ActionButton({ children, variant = "outline", fullWidth = false, style, ...props }) {
  const variantStyle = getActionVariantStyle(variant);

  return (
    <button
      style={{
        ...styles.actionLink,
        ...styles.actionButtonReset,
        width: fullWidth ? "100%" : undefined,
        ...variantStyle,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function getActionVariantStyle(variant) {
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

  return stylesByVariant[variant] || stylesByVariant.outline;
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

function BicicletaClienteModal({ cliente, values, guardando, isMobile, onChange, onSubmit, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <form onSubmit={onSubmit} style={{ ...styles.modalCard, ...(isMobile ? styles.modalCardMobile : {}) }}>
        <div style={styles.modalHeader}>
          <div>
            <p style={styles.kicker}>Bicicleta del cliente</p>
            <h2 style={styles.modalTitle}>Agregar bicicleta</h2>
            <p style={styles.accountText}>Se va a asociar a {cliente?.nombre || "este cliente"}.</p>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton} aria-label="Cerrar">
            x
          </button>
        </div>

        <div style={styles.clientTarget}>
          <span>Cliente destino</span>
          <strong>#{cliente?.id} - {cliente?.nombre}</strong>
        </div>

        <div style={{ ...styles.modalFormGrid, ...(isMobile ? styles.modalFormGridMobile : {}) }}>
          <ModalField label="Marca" value={values.marca} onChange={(value) => onChange("marca", value)} required />
          <ModalField label="Modelo" value={values.modelo} onChange={(value) => onChange("modelo", value)} required />
          <ModalField label="Rodado" value={values.rodado} onChange={(value) => onChange("rodado", value)} />
          <ModalField label="Color" value={values.color} onChange={(value) => onChange("color", value)} />
          <ModalField label="Numero de cuadro" value={values.numero_cuadro} onChange={(value) => onChange("numero_cuadro", value)} />
          <ModalField label="Notas" value={values.notas} onChange={(value) => onChange("notas", value)} full />
        </div>

        <div style={styles.modalActions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar bicicleta"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ModalField({ label, value, onChange, required = false, full = false }) {
  return (
    <label style={{ ...styles.modalField, ...(full ? styles.modalFieldFull : {}) }}>
      <span style={styles.infoLabel}>{label}{required ? " *" : ""}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={styles.modalInput}
      />
    </label>
  );
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
          <div style={styles.bikeSpecs}>
            <Info label="Entrega" value={renderEntrega(bici.condicion_entrega)} />
            <Info label="Postventa" value={renderPostventa(bici.plan_postventa)} />
          </div>

          <div style={styles.bikeSpecs}>
            <Info
              label="Estado service"
              value={calcularEstadoPostventa(bici)}
            />
            <Info
              label="Vence"
              value={
                bici.fecha_limite_service_gratis
                  ? formatDate(bici.fecha_limite_service_gratis)
                  : "-"
              }
            />
          </div>
          {bici.notas && <div style={styles.bikeNotes}>{bici.notas}</div>}

          <div style={styles.bikeActions}>
            <Link to={`/clientes/${cliente.id}/bicicletas/${bici.id}`} style={styles.linkAction}>
              Ver historial
            </Link>
            {Number(cliente.id) !== 1 && (
              <Link to={`/taller/nueva?cliente_id=${cliente.id}&bicicleta_id=${bici.id}`} style={styles.linkAction}>
                Nueva OT
              </Link>
            )}
          </div>
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

function renderMedioPago(medio) {
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
    tarjeta: "Tarjeta",
  };

  return map[medio] || medio || "-";
}

function renderOrigenVenta(origen) {
  const map = {
    venta: "Venta normal",
    taller: "Taller",
    reserva: "Reserva",
    postventa: "Postventa",
  };

  return map[origen] || "Venta normal";
}

function formatCantidadItems(cantidad) {
  const total = Number(cantidad || 0);
  return `${total} ${total === 1 ? "ítem" : "ítems"}`;
}

function getPagoOrigenUrl(pago) {
  if (!pago?.origen_tipo || !pago?.origen_id) return null;

  if (pago.origen_tipo === "venta") return `/ventas/${pago.origen_id}`;
  if (pago.origen_tipo === "deuda_cliente") return `/deudas/${pago.origen_id}`;
  if (pago.origen_tipo === "reserva") return `/reservas/${pago.origen_id}`;

  return null;
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

function limpiarObjeto(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? null : value,
    ])
  );
}

function renderEntrega(valor) {
  const map = {
    armada: "Armada",
    en_caja: "En caja",
  };

  return map[valor] || "-";
}

function renderPostventa(valor) {
  const map = {
    garantia_fabrica: "Garantía fábrica",
    service_30_dias: "Service 30 días",
    sin_service: "Sin service",
  };

  return map[valor] || "-";
}

function calcularEstadoPostventa(bici) {
  if (bici.plan_postventa !== "service_30_dias") {
    return "No aplica";
  }

  if (bici.service_gratis_usado) {
    return "Usado";
  }

  if (bici.service_gratis_autorizado_fuera_plazo) {
    return "Autorizado";
  }

  if (bici.fecha_limite_service_gratis) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const limite = new Date(bici.fecha_limite_service_gratis);
    limite.setHours(0, 0, 0, 0);

    if (limite < hoy) {
      return "Vencido";
    }
  }

  return "Disponible";
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
    padding: "11px 16px",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.2,
    minHeight: 44,
    minWidth: 92,
    boxSizing: "border-box",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 3px rgba(16, 24, 40, 0.08)",
  },
  actionButtonReset: {
    fontFamily: "inherit",
    cursor: "pointer",
  },
  sectionToolbar: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    background: "rgba(15, 23, 42, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "min(720px, 100%)",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.26)",
    padding: 20,
    display: "grid",
    gap: 16,
  },
  modalCardMobile: {
    padding: 14,
    borderRadius: 16,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  modalTitle: {
    margin: "3px 0 0",
    fontSize: 24,
    lineHeight: 1.15,
  },
  closeButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    borderRadius: 12,
    width: 40,
    height: 40,
    cursor: "pointer",
    fontWeight: 1000,
    fontSize: 18,
  },
  clientTarget: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 4,
    color: "#1e3a8a",
    fontWeight: 800,
  },
  modalFormGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  modalFormGridMobile: {
    gridTemplateColumns: "1fr",
  },
  modalField: {
    display: "grid",
    gap: 6,
  },
  modalFieldFull: {
    gridColumn: "1 / -1",
  },
  modalInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "11px 12px",
    minHeight: 42,
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
    boxSizing: "border-box",
    width: "100%",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
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
  relationFocus: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 360px)",
    gap: 16,
    alignItems: "center",
  },
  relationFocusMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
  },
  recommendedActionBox: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 8,
    minWidth: 0,
  },
  recommendedLabel: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
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
  simpleList: {
    display: "grid",
    gap: 12,
  },
  relationshipTimeline: {
    display: "grid",
    gap: 12,
  },
  relationshipItem: {
    display: "grid",
    gridTemplateColumns: "18px minmax(0, 1fr)",
    gap: 10,
  },
  relationshipDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#2563eb",
    marginTop: 18,
    justifySelf: "center",
  },
  relationshipCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#ffffff",
    display: "grid",
    gap: 8,
    minWidth: 0,
  },
  relationshipHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  relationshipDate: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  relationshipDetail: {
    margin: 0,
    color: "#475569",
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  relationshipLines: {
    display: "grid",
    gap: 3,
  },
  tallerList: {
    display: "grid",
    gap: 14,
  },
  tallerCard: {
    border: "1px solid #dbe3ee",
    borderRadius: 14,
    padding: 16,
    background: "#ffffff",
    display: "grid",
    gap: 12,
    minWidth: 0,
  },
  tallerHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  tallerTitle: {
    display: "block",
    marginTop: 2,
    fontSize: 20,
  },
  tallerMeta: {
    display: "grid",
    gap: 3,
    color: "#475569",
  },
  tallerSection: {
    display: "grid",
    gap: 4,
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
  },
  tallerSectionTitle: {
    color: "#334155",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  tallerSectionText: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  tallerItems: {
    margin: 0,
    paddingLeft: 20,
    color: "#334155",
    lineHeight: 1.55,
  },
  tallerNotice: {
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "9px 11px",
    background: "#f0fdf4",
    color: "#166534",
    fontWeight: 800,
  },
  tallerFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
  },
  tallerFinancial: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  mutedText: {
    color: "#64748b",
    fontWeight: 700,
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
  bikeActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
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
