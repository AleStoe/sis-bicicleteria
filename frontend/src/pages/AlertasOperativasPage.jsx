import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  obtenerAlertasOperativas,
  sincronizarSaldoVentaDesdeDeuda,
} from "../services/alertasOperativasService";
import { obtenerCorreccionesPendientes } from "../services/correccionesService";
import { formatMoney } from "../utils/formatters";
import { useSession } from "../context/SessionContext";
import { formatProductoVariante } from "../utils/productPresentation";

const ALERTA_KEYS = [
  "ventas_cobradas_no_entregadas",
  "ventas_saldo_sin_deuda",
  "ventas_saldo_desincronizado",
  "pagos_revertidos_hoy",
  "cajas_abiertas_anteriores",
  "bicis_listas",
  "reservas_vencidas",
  "deudas_vencidas",
  "taller_atrasado",
  "stock_critico",
  "productos_maestros_incompletos",
  "maestros_inactivos_en_uso",
];

export default function AlertasOperativasPage() {
  const { usuarioId, rolActual } = useSession();
  const [data, setData] = useState(null);
  const [correcciones, setCorrecciones] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [sincronizandoId, setSincronizandoId] = useState(null);
  const [informeIndex, setInformeIndex] = useState(0);
  const puedeVerCorrecciones = rolActual === "administrador";

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      setData(await obtenerAlertasOperativas());
      if (puedeVerCorrecciones) {
        try {
          setCorrecciones(await obtenerCorreccionesPendientes());
        } catch {
          setCorrecciones(null);
        }
      } else {
        setCorrecciones(null);
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar la salud operativa");
    } finally {
      setLoading(false);
    }
  }

  async function sincronizarVenta(item) {
    const confirmar = window.confirm(
      `La venta #${item.id} muestra ${formatMoney(item.saldo_pendiente)} pendiente, ` +
        `pero su deuda formal tiene ${formatMoney(item.deuda_saldo_actual)}. ` +
        "¿Sincronizar el saldo de la venta con la deuda?",
    );
    if (!confirmar) return;

    setSincronizandoId(item.id);
    setError("");
    setMensaje("");
    try {
      await sincronizarSaldoVentaDesdeDeuda(item.id, usuarioId);
      setMensaje(`Venta #${item.id} sincronizada correctamente.`);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo sincronizar la venta");
    } finally {
      setSincronizandoId(null);
    }
  }

  const totalPendientes = useMemo(
    () =>
      ALERTA_KEYS.reduce((total, key) => {
        const items = data?.[key];
        return total + (Array.isArray(items) ? items.length : 0);
      }, 0),
    [data],
  );

  const informeOperativo = useMemo(() => crearInformeOperativo(data, totalPendientes), [data, totalPendientes]);
  const informeActual = informeOperativo[informeIndex % Math.max(informeOperativo.length, 1)];
  const totalCorrecciones = useMemo(() => {
    if (!correcciones) return 0;
    return Object.values(correcciones).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0);
  }, [correcciones]);
  const detalleCorrecciones = useMemo(() => {
    if (!correcciones) return [];
    return [
      ["Capital sin caja", correcciones.capital_sin_caja?.length || 0],
      ["Saldos sin deuda", correcciones.ventas_saldo_sin_deuda?.length || 0],
      ["Creditos a revisar", correcciones.creditos_anulacion_dudosos?.length || 0],
      ["Cajas viejas", correcciones.cajas_abiertas_anteriores?.length || 0],
    ];
  }, [correcciones]);

  useEffect(() => {
    setInformeIndex(0);
  }, [data]);

  useEffect(() => {
    if (informeOperativo.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setInformeIndex((current) => (current + 1) % informeOperativo.length);
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [informeOperativo.length]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Revision del dia</p>
          <h1 style={styles.title}>Salud operativa</h1>
          <p style={styles.subtitle}>Una pasada rapida para arrancar el mostrador tranquilo: cobros, entregas, taller, stock y datos maestros.</p>
        </div>
        <button type="button" onClick={cargar} style={styles.secondary}>
          {loading ? "Mirando..." : "Revisar ahora"}
        </button>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      {data && (
        <>
          <section style={styles.agentCard}>
            <div>
              <p style={styles.agentLabel}>Asistente de mostrador</p>
              <h2 style={styles.agentTitle}>
                {totalPendientes > 0 ? `Hay ${totalPendientes} cosita${totalPendientes === 1 ? "" : "s"} para mirar` : "Todo viene prolijo por ahora"}
              </h2>
              <div style={styles.reportBox}>
                <p style={styles.reportEyebrow}>{informeActual?.titulo || "Informe rapido"}</p>
                <p style={styles.agentText}>{informeActual?.texto || "Estoy esperando datos para armar el parte del dia."}</p>
              </div>
              {informeOperativo.length > 1 && (
                <div style={styles.reportDots} aria-label="Informe operativo rotativo">
                  {informeOperativo.map((item, index) => (
                    <button
                      key={`${item.titulo}-${index}`}
                      type="button"
                      onClick={() => setInformeIndex(index)}
                      aria-label={`Ver informe ${index + 1}`}
                      style={index === informeIndex % informeOperativo.length ? styles.reportDotActive : styles.reportDot}
                    />
                  ))}
                </div>
              )}
            </div>
            <strong style={totalPendientes ? styles.agentCountHot : styles.agentCount}>{totalPendientes}</strong>
          </section>

          {puedeVerCorrecciones && (
            <Link
              to="/correcciones"
              style={{
                ...styles.correccionesLink,
                ...(totalCorrecciones > 0 ? styles.correccionesLinkHot : {}),
              }}
            >
              <div>
                <p style={styles.agentLabel}>Centro de correcciones</p>
                <h2 style={styles.agentTitle}>
                  {totalCorrecciones > 0
                    ? `${totalCorrecciones} correccion${totalCorrecciones === 1 ? "" : "es"} que pueden afectar caja, capital o saldos`
                    : "Sin correcciones operativas pendientes"}
                </h2>
                <p style={styles.agentText}>
                  {totalCorrecciones > 0
                    ? "Conviene revisarlas antes de cerrar el dia: el sistema guia cada caso y deja la correccion auditada."
                    : "No veo movimientos de capital sin caja, saldos raros ni creditos dudosos para corregir ahora."}
                </p>
                {detalleCorrecciones.length > 0 && (
                  <div style={styles.correccionesSummary}>
                    {detalleCorrecciones.map(([label, count]) => (
                      <span key={label} style={count > 0 ? styles.correccionesChipHot : styles.correccionesChip}>
                        {label}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={styles.correccionesAction}>
                <strong style={totalCorrecciones ? styles.agentCountHot : styles.agentCount}>{totalCorrecciones}</strong>
                <span style={styles.correccionesActionText}>Abrir</span>
              </div>
            </Link>
          )}

          <Seccion titulo="Ventas y caja">
            <AlertaCard
              title="Cobradas sin entregar"
              tone="danger"
              items={data.ventas_cobradas_no_entregadas}
              to={(item) => `/ventas/${item.id}`}
              render={(item) => `${item.cliente_nombre || "Cliente"} · ${formatMoney(item.total_final || 0)}`}
            />
            <AlertaCard
              title="Saldo sin deuda formal"
              tone="danger"
              items={data.ventas_saldo_sin_deuda}
              description="Abrí la venta y decidí si corresponde cobrar, entregar con deuda formal o anular."
              to={(item) => `/ventas/${item.id}`}
              render={(item) => `${item.cliente_nombre || "Cliente"} · saldo ${formatMoney(item.saldo_pendiente || 0)}`}
            />
            <AlertaCard
              title="Saldo desactualizado"
              tone="warning"
              items={data.ventas_saldo_desincronizado}
              description="La deuda existe, pero la venta conserva otro saldo. Podés sincronizarla de forma auditada."
              to={(item) => `/ventas/${item.id}`}
              render={(item) =>
                `${item.cliente_nombre || "Cliente"} / venta ${formatMoney(item.saldo_pendiente || 0)} / deuda ${formatMoney(item.deuda_saldo_actual || 0)}`
              }
              action={(item) => ({
                label: sincronizandoId === item.id ? "Sincronizando..." : "Sincronizar saldo",
                disabled: sincronizandoId === item.id,
                onClick: () => sincronizarVenta(item),
              })}
            />
            <AlertaCard
              title="Pagos revertidos hoy"
              tone="warning"
              items={data.pagos_revertidos_hoy}
              to={(item) => (item.origen_tipo === "venta" ? `/ventas/${item.origen_id}` : "/pagos")}
              render={(item) => `Pago #${item.id} · ${medioPagoLabel(item.medio_pago)} · ${formatMoney(item.monto_total_cobrado || 0)}`}
            />
            <AlertaCard
              title="Cajas abiertas anteriores"
              tone="warning"
              items={data.cajas_abiertas_anteriores}
              to={() => "/caja"}
              render={(item) => `${item.sucursal_nombre || "Sucursal"} · caja #${item.id}`}
            />
          </Seccion>

          <Seccion titulo="Clientes y taller">
            <AlertaCard
              title="Bicis listas +7 dias"
              items={data.bicis_listas}
              to={(item) => `/taller/${item.id}`}
              render={(item) => `${item.cliente_nombre || "Cliente"} · ${[item.marca, item.modelo].filter(Boolean).join(" ") || "Bicicleta"}`}
            />
            <AlertaCard
              title="Reservas vencidas"
              items={data.reservas_vencidas}
              to={(item) => `/reservas/${item.id}`}
              render={(item) => `${item.cliente_nombre || "Cliente"} · ${formatMoney(item.saldo_estimado || item.saldo_pendiente || 0)} pendiente`}
            />
            <AlertaCard
              title="Deudas vencidas"
              tone="warning"
              items={data.deudas_vencidas}
              to={(item) => `/deudas/${item.id}`}
              render={(item) => `${item.cliente_nombre || "Cliente"} · ${formatMoney(item.saldo_actual || item.saldo_pendiente || 0)}`}
            />
            <AlertaCard
              title="Taller atrasado"
              items={data.taller_atrasado}
              to={(item) => `/taller/${item.id}`}
              render={(item) => `OT #${item.id} · ${item.cliente_nombre || "Cliente"} · ${item.estado}`}
            />
          </Seccion>

          <Seccion titulo="Stock y maestros">
            <AlertaCard
              title="Stock critico"
              items={data.stock_critico}
              to={() => "/stock?estado_stock=stock_bajo"}
              render={(item) =>
                `${formatProductoVariante(
                  item.producto_nombre || "Producto",
                  item.nombre_variante
                )} · disp. ${item.stock_disponible}`
              }
            />
            <AlertaCard
              title="Productos incompletos"
              tone="warning"
              items={data.productos_maestros_incompletos}
              to={(item) => `/catalogo/productos/${item.id}`}
              render={(item) => `${item.nombre} · ${detalleMaestroIncompleto(item)}`}
            />
            <AlertaCard
              title="Maestros inactivos en uso"
              tone="warning"
              items={data.maestros_inactivos_en_uso}
              to={(item) => `/catalogo/productos/${item.id}`}
              render={(item) => `${item.nombre} · revisar categoria/marca`}
            />
          </Seccion>
        </>
      )}
    </main>
  );
}

function Seccion({ titulo, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{titulo}</h2>
      <div style={styles.grid}>{children}</div>
    </section>
  );
}

function AlertaCard({ title, items = [], to, render, tone = "default", description = "", action = null }) {
  const countStyle = items.length ? (tone === "danger" ? styles.countDanger : styles.countHot) : styles.count;
  const cardStyle = {
    ...styles.card,
    ...(tone === "danger" ? styles.cardDanger : tone === "warning" ? styles.cardWarning : {}),
  };

  return (
    <article style={cardStyle}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{title}</h3>
        <strong style={countStyle}>{items.length}</strong>
      </div>
      {description && <p style={styles.cardDescription}>{description}</p>}
      {items.length === 0 ? (
        <div style={styles.empty}>Sin pendientes.</div>
      ) : (
        <div style={styles.list}>
          {items.slice(0, 12).map((item, index) => {
            const itemAction = action?.(item);
            return (
              <div key={`${title}-${item.id || item.id_variante || index}-${index}`} style={styles.rowWrap}>
                <Link to={to(item)} style={styles.row}>
                  <span>{render(item)}</span>
                  <small>Ver</small>
                </Link>
                {itemAction && (
                  <button
                    type="button"
                    onClick={itemAction.onClick}
                    disabled={itemAction.disabled}
                    style={styles.repairButton}
                  >
                    {itemAction.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function medioPagoLabel(medioPago) {
  const labels = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    mercadopago: "MercadoPago",
    tarjeta: "Tarjeta",
  };
  return labels[medioPago] || medioPago || "Pago";
}

function detalleMaestroIncompleto(item) {
  const faltantes = [];
  if (!item.id_categoria) faltantes.push("sin categoria");
  if (!item.id_marca) faltantes.push("sin marca");
  if (Number(item.variantes_sin_proveedor || 0) > 0) faltantes.push(`${item.variantes_sin_proveedor} variante(s) sin proveedor`);
  return faltantes.length ? faltantes.join(" · ") : "revisar";
}

function crearInformeOperativo(data, totalPendientes) {
  if (!data) {
    return [{ titulo: "Informe rapido", texto: "Estoy esperando datos para armar el parte del dia." }];
  }

  const count = (key) => (Array.isArray(data[key]) ? data[key].length : 0);
  const informes = [];
  const ventasCaja =
    count("ventas_cobradas_no_entregadas") +
    count("ventas_saldo_sin_deuda") +
    count("ventas_saldo_desincronizado") +
    count("pagos_revertidos_hoy") +
    count("cajas_abiertas_anteriores");
  const tallerClientes = count("bicis_listas") + count("reservas_vencidas") + count("deudas_vencidas") + count("taller_atrasado");
  const stockMaestros = count("stock_critico") + count("productos_maestros_incompletos") + count("maestros_inactivos_en_uso");

  if (totalPendientes === 0) {
    return [
      {
        titulo: "Parte del dia",
        texto: "No veo pendientes operativos importantes. Buen momento para vender, atender taller o cargar mercaderia con calma.",
      },
      {
        titulo: "Siguiente paso sugerido",
        texto: "Si el mostrador esta tranquilo, revisa precios, fotos de catalogo o productos sin proveedor antes de que se acumule trabajo.",
      },
    ];
  }

  if (ventasCaja > 0) {
    informes.push({
      titulo: "Primero mostrador",
      texto: `Hay ${ventasCaja} tema${ventasCaja === 1 ? "" : "s"} de ventas o caja. Conviene resolver eso antes de seguir cargando operaciones nuevas.`,
    });
  }

  if (count("ventas_cobradas_no_entregadas") > 0) {
    informes.push({
      titulo: "Entregas pendientes",
      texto: `${count("ventas_cobradas_no_entregadas")} venta${count("ventas_cobradas_no_entregadas") === 1 ? "" : "s"} ya estan cobradas pero no figuran entregadas. Ideal revisar antes de cerrar el dia.`,
    });
  }

  if (count("ventas_saldo_sin_deuda") > 0) {
    informes.push({
      titulo: "Saldos raros",
      texto: `${count("ventas_saldo_sin_deuda")} venta${count("ventas_saldo_sin_deuda") === 1 ? "" : "s"} tienen saldo pendiente sin deuda formal. Eso puede confundir caja, cliente e historial.`,
    });
  }

  if (count("ventas_saldo_desincronizado") > 0) {
    informes.push({
      titulo: "Saldos para sincronizar",
      texto: `${count("ventas_saldo_desincronizado")} venta${count("ventas_saldo_desincronizado") === 1 ? "" : "s"} no coinciden con su deuda formal. Se pueden reparar desde esta misma pantalla.`,
    });
  }

  if (tallerClientes > 0) {
    informes.push({
      titulo: "Clientes y taller",
      texto: `Hay ${tallerClientes} pendiente${tallerClientes === 1 ? "" : "s"} entre bicis listas, reservas, deudas o taller atrasado. Aca suele haber llamados y WhatsApp para mandar.`,
    });
  }

  if (stockMaestros > 0) {
    informes.push({
      titulo: "Orden de catalogo",
      texto: `${stockMaestros} punto${stockMaestros === 1 ? "" : "s"} vienen de stock o datos maestros. No frenan siempre la venta, pero ayudan a evitar errores mas adelante.`,
    });
  }

  informes.push({
    titulo: "Plan corto",
    texto: "Mi recomendacion: ventas y caja primero, taller despues, stock y maestros al final. Asi bajas riesgo sin cortar la atencion.",
  });

  return informes;
}

const styles = {
  page: {
    padding: 20,
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fff7ed 0%, #eef6ff 42%, #f8fafc 100%)",
    color: "#0f172a",
  },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  kicker: { margin: 0, color: "#ea580c", fontWeight: 1000, textTransform: "uppercase", fontSize: 12 },
  title: { margin: "3px 0 0", fontSize: 34 },
  subtitle: { margin: "6px 0 0", color: "#475569", fontWeight: 750, maxWidth: 720 },
  secondary: {
    border: "1px solid #fed7aa",
    background: "#fffbeb",
    color: "#9a3412",
    borderRadius: 999,
    padding: "11px 16px",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(234,88,12,.12)",
  },
  agentCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #14532d 55%, #ea580c 130%)",
    color: "white",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    boxShadow: "0 18px 36px rgba(15,23,42,.18)",
  },
  agentLabel: { margin: 0, color: "#fdba74", fontWeight: 1000, textTransform: "uppercase", fontSize: 12 },
  agentTitle: { margin: "4px 0", fontSize: 24 },
  agentText: { margin: 0, color: "#e2e8f0", fontWeight: 750 },
  reportBox: {
    marginTop: 10,
    maxWidth: 760,
    border: "1px solid rgba(255,255,255,.16)",
    background: "rgba(255,255,255,.08)",
    borderRadius: 12,
    padding: "10px 12px",
  },
  reportEyebrow: { margin: "0 0 4px", color: "#fed7aa", fontWeight: 1000, textTransform: "uppercase", fontSize: 11 },
  reportDots: { display: "flex", gap: 7, marginTop: 10, alignItems: "center" },
  reportDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    border: 0,
    padding: 0,
    background: "rgba(255,255,255,.34)",
    cursor: "pointer",
  },
  reportDotActive: {
    width: 22,
    height: 8,
    borderRadius: 999,
    border: 0,
    padding: 0,
    background: "#fdba74",
    cursor: "pointer",
  },
  agentCount: { background: "#ecfdf5", color: "#047857", borderRadius: 999, padding: "10px 14px", minWidth: 48, textAlign: "center" },
  agentCountHot: { background: "#fff7ed", color: "#c2410c", borderRadius: 999, padding: "10px 14px", minWidth: 48, textAlign: "center", boxShadow: "0 8px 18px rgba(255,247,237,.22)" },
  correccionesLink: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    background: "linear-gradient(135deg, #1e293b 0%, #7c2d12 120%)",
    color: "white",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    textDecoration: "none",
    boxShadow: "0 14px 30px rgba(15,23,42,.14)",
  },
  correccionesLinkHot: {
    background: "linear-gradient(135deg, #7c2d12 0%, #b42318 120%)",
    boxShadow: "0 16px 34px rgba(180,35,24,.18)",
  },
  correccionesSummary: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
  correccionesChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    background: "rgba(255,255,255,.12)",
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: 900,
  },
  correccionesChipHot: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    background: "#fff7ed",
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 1000,
  },
  correccionesAction: { display: "grid", justifyItems: "center", gap: 6, flexShrink: 0 },
  correccionesActionText: {
    color: "#fff7ed",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".02em",
  },
  section: { marginTop: 18 },
  sectionTitle: { margin: "0 0 10px", fontSize: 20, color: "#1e293b" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 },
  card: {
    background: "rgba(255,255,255,.92)",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 12px 28px rgba(15,23,42,.06)",
  },
  cardDanger: { borderColor: "#fecaca", background: "#fffafa" },
  cardWarning: { borderColor: "#fed7aa", background: "#fffaf2" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 },
  cardTitle: { margin: 0, fontSize: 18 },
  cardDescription: { margin: "-3px 0 10px", color: "#64748b", fontSize: 13, fontWeight: 750, lineHeight: 1.35 },
  count: { background: "#ecfdf5", color: "#047857", borderRadius: 999, padding: "5px 9px" },
  countHot: { background: "#fff7ed", color: "#c2410c", borderRadius: 999, padding: "5px 9px" },
  countDanger: { background: "#fff1f0", color: "#b42318", borderRadius: 999, padding: "5px 9px" },
  list: { display: "grid", gap: 8 },
  rowWrap: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "stretch" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    textDecoration: "none",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 10,
    fontWeight: 850,
    background: "white",
  },
  repairButton: {
    border: "1px solid #86efac",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 10,
    padding: "8px 11px",
    fontWeight: 950,
    cursor: "pointer",
  },
  empty: { color: "#64748b", fontWeight: 800, padding: 12, background: "#f8fafc", borderRadius: 8 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 12, fontWeight: 800 },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 12, fontWeight: 800 },
};
