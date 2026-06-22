import { useEffect, useMemo, useState } from "react";
import {
  abrirCaja,
  cerrarCaja,
  obtenerCajaAbierta,
  obtenerCajaDetalle,
  obtenerResumenDiarioCaja,
  registrarEgresoCaja,
  registrarAjusteCaja,
  listarHistorialCajas,
} from "../services/cajaService";
import { formatCurrency } from "../utils/formatters";
import { PageHeader, Button, useBreakpoint } from "../components/ui";
import CajaAlert from "../components/caja/CajaAlert";
import CajaAperturaCard from "../components/caja/CajaAperturaCard";
import CajaResumenCards from "../components/caja/CajaResumenCards";
import CajaTotalesSubmedio from "../components/caja/CajaTotalesSubmedio";
import CajaEgresoCard from "../components/caja/CajaEgresoCard";
import CajaAjusteCard from "../components/caja/CajaAjusteCard";
import CajaCierreCard from "../components/caja/CajaCierreCard";
import CajaMovimientosTable from "../components/caja/CajaMovimientosTable";
import { useSession } from "../context/SessionContext";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import {
  puedeAbrirCaja as puedeAbrirCajaRule,
  puedeCerrarCaja as puedeCerrarCajaRule,
  puedeRegistrarMovimientoCaja,
} from "../rules/cajaActionRules";

export default function CajaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [resumenDiario, setResumenDiario] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [montoApertura, setMontoApertura] = useState("");
  const [montoReal, setMontoReal] = useState("");
  const [egreso, setEgreso] = useState({ monto: "", nota: "" });
  const [procesando, setProcesando] = useState(false);
  const [ajuste, setAjuste] = useState({
    monto: "",
    direccion: "positivo",
    nota: "",
  });
  const [confirmConfig, setConfirmConfig] = useState(null);
  const isMobile = useBreakpoint();
  const { usuarioId, sucursalId } = useSession();

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

  useEffect(() => {
    cargarCaja();
  }, [sucursalId]);

  async function cargarHistorial() {
    const data = await listarHistorialCajas({
      id_sucursal: sucursalId,
      limit: 30,
    });

    setHistorial(Array.isArray(data) ? data : []);
  }

  async function cargarResumenDiario() {
    const data = await obtenerResumenDiarioCaja({
      id_sucursal: sucursalId,
    });

    setResumenDiario(data);
  }

  async function cargarCaja() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      await cargarHistorial();
      await cargarResumenDiario();

      const cajaAbierta = await obtenerCajaAbierta(sucursalId);
      const detalleCaja = await obtenerCajaDetalle(cajaAbierta.caja.id);

      setDetalle(detalleCaja);
      setMontoReal(String(detalleCaja.efectivo_teorico ?? ""));
    } catch (err) {
      const msg = String(err?.message || "");

      if (
        msg.toLowerCase().includes("no hay caja abierta") ||
        msg.toLowerCase().includes("404")
      ) {
        setDetalle(null);
        setError("");
        await cargarResumenDiario();
        return;
      }

      setDetalle(null);

      if (msg.toLowerCase().includes("failed to fetch")) {
        setError(
          "No se pudo conectar con el servidor. Revisá que el backend esté encendido."
        );
        return;
      }

      setError(msg || "No se pudo cargar la caja");
    } finally {
      setLoading(false);
    }
  }

  async function handleAbrirCaja(e) {
    e.preventDefault();
    setError("");
    setMensaje("");

    const apertura = Number(montoApertura || 0);

    if (apertura < 0) {
      setError("El monto de apertura no puede ser negativo");
      return;
    }

    try {
      setProcesando(true);

      await abrirCaja({
        id_sucursal: sucursalId,
        monto_apertura: apertura,
        id_usuario: usuarioId,
      });

      setMensaje("Caja abierta correctamente");
      setMontoApertura("");

      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo abrir la caja");
    } finally {
      setProcesando(false);
    }
  }

  async function handleRegistrarEgreso(e) {
    e.preventDefault();

    if (!detalle?.caja?.id) return;

    setError("");
    setMensaje("");

    const monto = Number(egreso.monto || 0);
    const nota = egreso.nota.trim();

    if (monto <= 0) {
      setError("El monto del egreso debe ser mayor a 0");
      return;
    }

    if (nota.length < 3) {
      setError("La nota debe tener al menos 3 caracteres");
      return;
    }

    const confirmado = await pedirConfirmacion({
      title: "Registrar egreso",
      message: `Vas a registrar un EGRESO de ${formatCurrency(monto)}.\n\nMotivo: ${nota}\n\nEsta operación impacta en caja. ¿Confirmás?`,
      confirmText: "Registrar egreso",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);

      await registrarEgresoCaja(detalle.caja.id, {
        monto,
        nota,
        id_usuario: usuarioId,
      });

      setMensaje(`Egreso registrado: ${formatCurrency(monto)}`);
      setEgreso({ monto: "", nota: "" });

      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo registrar el egreso");
    } finally {
      setProcesando(false);
    }
  }

  async function handleRegistrarAjuste(e) {
    e.preventDefault();

    if (!detalle?.caja?.id) return;

    setError("");
    setMensaje("");

    const monto = Number(ajuste.monto || 0);
    const nota = ajuste.nota.trim();

    if (monto <= 0) {
      setError("El monto del ajuste debe ser mayor a 0");
      return;
    }

    if (nota.length < 3) {
      setError("La nota debe tener al menos 3 caracteres");
      return;
    }

    const direccionTexto = ajuste.direccion === "positivo" ? "POSITIVO" : "NEGATIVO";

    const confirmado = await pedirConfirmacion({
      title: "Registrar ajuste de caja",
      message: `Vas a registrar un AJUSTE ${direccionTexto} de ${formatCurrency(monto)}.\n\nMotivo: ${nota}\n\nLos ajustes deben usarse solo para corregir diferencias reales de caja. ¿Confirmás?`,
      confirmText: "Registrar ajuste",
      cancelText: "Cancelar",
      variant: "warning",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);

      await registrarAjusteCaja(detalle.caja.id, {
        monto,
        direccion: ajuste.direccion,
        nota,
        id_usuario: usuarioId,
      });

      setMensaje(
        `Ajuste ${
          ajuste.direccion === "positivo" ? "positivo" : "negativo"
        } registrado: ${formatCurrency(monto)}`
      );

      setAjuste({ monto: "", direccion: "positivo", nota: "" });

      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo registrar el ajuste");
    } finally {
      setProcesando(false);
    }
  }

  async function handleCerrarCaja(e) {
    e.preventDefault();

    if (!detalle?.caja?.id) return;
    if (!puedeCerrarCajaRule({ procesando, caja: detalle.caja, montoReal })) {
      setError("No se puede cerrar caja: verificá que esté abierta y que el monto contado sea válido.");
      return;
    }

    setError("");
    setMensaje("");

    const cierreReal = Number(montoReal || 0);

    if (cierreReal < 0) {
      setError("El monto real no puede ser negativo");
      return;
    }

    const confirmado = await pedirConfirmacion({
      title: "Cerrar caja",
      message: `¿Seguro que querés cerrar la caja?\n\nEfectivo teórico: ${formatCurrency(detalle.efectivo_teorico)}\nEfectivo contado: ${formatCurrency(cierreReal)}\n\nDespués del cierre no deberías registrar más movimientos en esta caja.`,
      confirmText: "Cerrar caja",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);

      const resp = await cerrarCaja(detalle.caja.id, {
        monto_cierre_real: cierreReal,
        id_usuario: usuarioId,
      });

      setMensaje(`Caja cerrada. Diferencia: ${formatCurrency(resp.diferencia)}`);
      setDetalle(null);
      setMontoReal("");

      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo cerrar la caja");
    } finally {
      setProcesando(false);
    }
  }

  async function verDetalleCaja(cajaId) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const detalleCaja = await obtenerCajaDetalle(cajaId);
      setDetalle(detalleCaja);
      setMontoReal(String(detalleCaja.efectivo_teorico ?? ""));
    } catch (err) {
      setError(err.message || "No se pudo cargar el detalle de la caja");
    } finally {
      setProcesando(false);
    }
  }

  const totales = useMemo(
    () =>
      detalle?.totales_por_submedio ?? {
        efectivo: 0,
        transferencia: 0,
        mercadopago: 0,
        tarjeta: 0,
      },
    [detalle]
  );

  const puedeRegistrarEgreso = puedeRegistrarMovimientoCaja({
    procesando,
    caja: detalle?.caja,
    monto: egreso.monto,
    nota: egreso.nota,
  });

  const puedeRegistrarAjuste = puedeRegistrarMovimientoCaja({
    procesando,
    caja: detalle?.caja,
    monto: ajuste.monto,
    nota: ajuste.nota,
  });

  const puedeAbrirCaja = puedeAbrirCajaRule({
    procesando,
    montoApertura,
    cajaActual: detalle?.caja,
  });

  const puedeCerrarCaja = puedeCerrarCajaRule({
    procesando,
    caja: detalle?.caja,
    montoReal,
  });

  if (loading) {
    return <div style={{ padding: "24px" }}>Cargando caja...</div>;
  }

  return (
    <div style={isMobile ? styles.pageMobile : undefined}>
      <PageHeader
        title="Caja"
        subtitle="Control de apertura, movimientos, cierre e historial"
        actions={
          <Button variant="outline" onClick={cargarCaja} disabled={procesando}>
            Refrescar
          </Button>
        }
      />

      {error ? <CajaAlert type="error" message={error} /> : null}
      {mensaje ? <CajaAlert type="success" message={mensaje} /> : null}

      {!detalle ? (
        <>
          <CajaResumenDiario
            resumen={resumenDiario}
            formatCurrency={formatCurrency}
            isMobile={isMobile}
          />

          <CajaAperturaCard
            montoApertura={montoApertura}
            setMontoApertura={setMontoApertura}
            onSubmit={handleAbrirCaja}
            puedeAbrirCaja={puedeAbrirCaja}
            procesando={procesando}
          />
        </>
      ) : (
        <>
          <CajaResumenCards detalle={detalle} formatCurrency={formatCurrency} />

          <CajaResumenDiario
            resumen={resumenDiario}
            formatCurrency={formatCurrency}
            isMobile={isMobile}
          />

          <CajaTotalesSubmedio totales={totales} formatCurrency={formatCurrency} />

          {detalle.caja?.estado === "abierta" ? (
            <div style={{ ...styles.operacionesGrid, ...(isMobile ? styles.operacionesGridMobile : {}) }}>
              <CajaEgresoCard
                egreso={egreso}
                setEgreso={setEgreso}
                onSubmit={handleRegistrarEgreso}
                puedeRegistrarEgreso={puedeRegistrarEgreso}
                procesando={procesando}
              />

              <CajaAjusteCard
                ajuste={ajuste}
                setAjuste={setAjuste}
                onSubmit={handleRegistrarAjuste}
                puedeRegistrarAjuste={puedeRegistrarAjuste}
                procesando={procesando}
              />

              <CajaCierreCard
                montoReal={montoReal}
                setMontoReal={setMontoReal}
                efectivoTeorico={detalle.efectivo_teorico}
                onSubmit={handleCerrarCaja}
                puedeCerrarCaja={puedeCerrarCaja}
                procesando={procesando}
                formatCurrency={formatCurrency}
              />
            </div>
          ) : null}

          <CajaMovimientosTable
            movimientos={detalle.movimientos ?? []}
            formatCurrency={formatCurrency}
          />
        </>
      )}

      <section style={styles.historialCard}>
        <div style={styles.historialHeader}>
          <div>
            <h2 style={styles.historialTitle}>Historial de cajas</h2>
            <p style={styles.historialSubtitle}>
              Últimas cajas abiertas y cerradas del local.
            </p>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Apertura</th>
                <th style={styles.th}>Teórico</th>
                <th style={styles.th}>Real</th>
                <th style={styles.th}>Diferencia</th>
                <th style={styles.th}>Abrió</th>
                <th style={styles.th}>Cerró</th>
                <th style={styles.th}></th>
              </tr>
            </thead>

            <tbody>
              {historial.length === 0 ? (
                <tr>
                  <td style={styles.emptyCell} colSpan={9}>
                    No hay cajas históricas para mostrar.
                  </td>
                </tr>
              ) : (
                historial.map((caja) => (
                  <tr key={caja.id}>
                    <td style={styles.td}>{caja.fecha}</td>
                    <td style={styles.td}>
                      <span
                        style={
                          caja.estado === "abierta"
                            ? styles.estadoAbierta
                            : styles.estadoCerrada
                        }
                      >
                        {caja.estado === "abierta" ? "Abierta" : "Cerrada"}
                      </span>
                    </td>
                    <td style={styles.td}>{formatCurrency(caja.monto_apertura)}</td>
                    <td style={styles.td}>
                      {caja.monto_cierre_teorico !== null
                        ? formatCurrency(caja.monto_cierre_teorico)
                        : "-"}
                    </td>
                    <td style={styles.td}>
                      {caja.monto_cierre_real !== null
                        ? formatCurrency(caja.monto_cierre_real)
                        : "-"}
                    </td>
                    <td style={styles.td}>
                      {caja.diferencia !== null
                        ? formatCurrency(caja.diferencia)
                        : "-"}
                    </td>
                    <td style={styles.td}>
                      {formatearUsuario(
                        caja.usuario_apertura_nombre,
                        caja.usuario_apertura_username
                      )}
                    </td>
                    <td style={styles.td}>
                      {formatearUsuario(
                        caja.usuario_cierre_nombre,
                        caja.usuario_cierre_username
                      )}
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => verDetalleCaja(caja.id)}
                        style={styles.linkButton}
                        disabled={procesando}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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

function formatearUsuario(nombre, username) {
  if (!nombre && !username) return "-";
  if (nombre && username) return `${nombre} (@${username})`;
  return nombre || `@${username}`;
}

function CajaResumenDiario({ resumen, formatCurrency, isMobile }) {
  if (!resumen) return null;

  const caja = resumen.caja || {};
  const pagos = resumen.pagos || {};
  const operacion = resumen.rentabilidad || {};
  const documentos = resumen.documentos || {};
  const diferencia =
    caja.diferencia ?? calcularDiferencia(caja.monto_cierre_real, caja.efectivo_teorico);
  const cierreReal =
    caja.monto_cierre_real !== null && caja.monto_cierre_real !== undefined
      ? formatCurrency(caja.monto_cierre_real)
      : "Sin cerrar";

  return (
    <section style={styles.resumenDiarioCard}>
      <div style={styles.resumenDiarioHeader}>
        <div>
          <h2 style={styles.resumenDiarioTitle}>Cierre operativo del dia</h2>
          <p style={styles.resumenDiarioSubtitle}>
            Caja, cobros, egresos y documentos disponibles para {resumen.fecha}.
          </p>
        </div>
        <span
          style={
            caja.estado === "abierta"
              ? styles.estadoAbierta
              : caja.estado === "cerrada"
                ? styles.estadoCerrada
                : styles.estadoSinCaja
          }
        >
          {caja.estado === "abierta"
            ? "Caja abierta"
            : caja.estado === "cerrada"
              ? "Caja cerrada"
              : "Sin caja"}
        </span>
      </div>

      <div style={{ ...styles.resumenDiarioGrid, ...(isMobile ? styles.resumenDiarioGridMobile : {}) }}>
        <ResumenDiarioMetric
          label="Efectivo esperado"
          value={formatCurrency(caja.efectivo_teorico)}
          detail={`Real: ${cierreReal}`}
          tone="primary"
        />
        <ResumenDiarioMetric
          label="Diferencia caja"
          value={
            diferencia !== null && diferencia !== undefined
              ? formatCurrency(diferencia)
              : "-"
          }
          detail={`Apertura: ${formatCurrency(caja.monto_apertura)}`}
          tone={Number(diferencia || 0) === 0 ? "neutral" : "warning"}
        />
        <ResumenDiarioMetric
          label="Cobrado caja"
          value={formatCurrency(pagos.total_cobrado)}
          detail={`Ingreso operativo - ${pagos.cantidad_pagos || 0} pagos`}
          tone="success"
        />
        <ResumenDiarioMetric
          label="Desc./rec."
          value={`${formatCurrency(pagos.descuentos_aplicados)} / ${formatCurrency(pagos.recargos_aplicados)}`}
          detail={`Base: ${formatCurrency(pagos.base_aplicada)}`}
        />
        <ResumenDiarioMetric
          label="Egresos"
          value={formatCurrency(caja.egresos)}
          detail={`Ajustes: +${formatCurrency(caja.ajustes_positivos)} / -${formatCurrency(caja.ajustes_negativos)}`}
          tone="danger"
        />
        <ResumenDiarioMetric
          label="Efectivo"
          value={formatCurrency(pagos.efectivo)}
          detail="Ingreso operativo"
          tone="success"
        />
        <ResumenDiarioMetric
          label="Transferencia"
          value={formatCurrency(pagos.transferencia)}
          detail="Ingreso operativo"
          tone="success"
        />
        <ResumenDiarioMetric
          label="Mercado Pago"
          value={formatCurrency(pagos.mercadopago)}
          detail="Ingreso operativo"
          tone="success"
        />
        <ResumenDiarioMetric
          label="Tarjeta"
          value={formatCurrency(pagos.tarjeta)}
          detail="Ingreso operativo"
          tone="success"
        />
        {Number(pagos.total_financiado_tarjeta || 0) > 0 ? (
          <ResumenDiarioMetric
            label="Financiado tarjeta"
            value={formatCurrency(pagos.total_financiado_tarjeta)}
            detail="Total cliente"
            tone="neutral"
          />
        ) : null}
        <ResumenDiarioMetric
          label="Ventas"
          value={formatCurrency(operacion.ventas_total)}
          detail={`${operacion.cantidad_ventas || 0} operaciones`}
        />
        <ResumenDiarioMetric
          label="Documentos"
          value={String(documentos.total_disponibles || 0)}
          detail={`${documentos.comprobantes_x || 0} X, ${documentos.recibos_pago || 0} recibos, ${documentos.cotizaciones || 0} cotiz.`}
        />
      </div>
    </section>
  );
}

function ResumenDiarioMetric({ label, value, detail, tone = "neutral" }) {
  return (
    <div style={{ ...styles.resumenMetric, ...(styles[`resumenMetric_${tone}`] || {}) }}>
      <span style={styles.resumenMetricLabel}>{label}</span>
      <strong style={styles.resumenMetricValue}>{value}</strong>
      <small style={styles.resumenMetricDetail}>{detail}</small>
    </div>
  );
}

function calcularDiferencia(real, teorico) {
  if (real === null || real === undefined || real === "") return null;
  return Number(real || 0) - Number(teorico || 0);
}

const styles = {
  pageMobile: {
    padding: "0 0 12px",
    overflowX: "hidden",
  },
  operacionesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  operacionesGridMobile: {
    gridTemplateColumns: "1fr",
    gap: "12px",
  },
  resumenDiarioCard: {
    marginBottom: 16,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  },
  resumenDiarioHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  resumenDiarioTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
  },
  resumenDiarioSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  resumenDiarioGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  resumenDiarioGridMobile: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  resumenMetric: {
    minHeight: 96,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    background: "#f8fafc",
    display: "grid",
    alignContent: "space-between",
    gap: 6,
  },
  resumenMetric_primary: {
    borderColor: "#fed7aa",
    background: "#fff7ed",
  },
  resumenMetric_success: {
    borderColor: "#bbf7d0",
    background: "#f0fdf4",
  },
  resumenMetric_warning: {
    borderColor: "#fde68a",
    background: "#fffbeb",
  },
  resumenMetric_danger: {
    borderColor: "#fecaca",
    background: "#fef2f2",
  },
  resumenMetricLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
  },
  resumenMetricValue: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 1000,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  resumenMetricDetail: {
    color: "#64748b",
    fontWeight: 750,
    lineHeight: 1.35,
  },
  historialCard: {
    marginTop: 20,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  },
  historialHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  historialTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
  },
  historialSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 920,
  },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },
  td: {
    padding: "11px 8px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  emptyCell: {
    padding: 18,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 800,
  },
  estadoAbierta: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 9px",
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 1000,
    fontSize: 12,
  },
  estadoCerrada: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 9px",
    background: "#f1f5f9",
    color: "#475569",
    fontWeight: 1000,
    fontSize: 12,
  },
  estadoSinCaja: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 9px",
    background: "#fff7ed",
    color: "#c2410c",
    fontWeight: 1000,
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  linkButton: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 1000,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
