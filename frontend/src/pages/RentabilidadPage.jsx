import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, ClipboardCheck, FileDown, Layers3, WalletCards } from "lucide-react";
import {
  anularCierreRentabilidad,
  crearCierreRentabilidad,
  descargarResultadoDistribuiblePdf,
  getBonificacionesGarantias,
  getCierresRentabilidad,
  getReglasRentabilidad,
  getRentabilidadComparacion,
} from "../services/rentabilidadService";
import { formatMoney, formatPercent } from "../utils/formatters";
import { useSession } from "../context/SessionContext";
import useMediaQuery from "../hooks/useMediaQuery";

const SUCURSAL_ID = 1;

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function periodoLabel(periodo) {
  const [year, month] = String(periodo || "").split("-").map(Number);
  if (!year || !month) return "mes seleccionado";
  const fecha = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function periodoTerminado(periodo) {
  const [year, month] = String(periodo || "").split("-").map(Number);
  if (!year || !month) return false;
  const hoy = new Date();
  const primerDiaSiguienteMes = new Date(year, month, 1);
  return primerDiaSiguienteMes <= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
}

function confirmacionPeriodo(periodo) {
  return periodoLabel(periodo).toUpperCase();
}


function money(value) {
  return formatMoney(value || 0);
}


const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(15,23,42,.06)",
};

const input = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

const primaryButton = {
  border: "none",
  borderRadius: 12,
  padding: "11px 14px",
  background: "#f97316",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "11px 14px",
  background: "#fff",
  color: "#101828",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButton = {
  border: "1px solid #fecaca",
  borderRadius: 10,
  padding: "8px 10px",
  background: "#fff1f2",
  color: "#b91c1c",
  fontWeight: 900,
  cursor: "pointer",
};

const badgeSuccess = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "4px 9px",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  fontSize: 12,
};

const badgeNeutral = {
  ...badgeSuccess,
  background: "#f1f5f9",
  color: "#475569",
};

const metricHelp = {
  ventaComercial: "Total vendido en el periodo seleccionado, sin depender de si ya se cobro o no.",
  cmvComercial: "Costo de mercaderia vendida asociado a las ventas del periodo.",
  margenEsperado: "Venta comercial menos CMV comercial. Es la utilidad esperada del negocio vendido.",
  cobradoComercial: "Parte comercial de las ventas que ya fue cobrada o reconocida por pagos confirmados.",
  saldoPorCobrar: "Importe comercial que todavia queda pendiente de cobro.",
  financiacionCobrada: "Financiacion o recargos cobrados al cliente por medios de pago.",
  costosFinancieros: "Comisiones o costos del medio de pago, congelados al registrar el cobro.",
  capitalRecuperado: "Parte del costo de la mercaderia que ya se recupero con cobros reconocidos.",
  capitalInmovilizado: "Costo de mercaderia que todavia no se recupero con cobros.",
  utilidadLiberada: "Utilidad disponible por caja. Aparece cuando lo cobrado supera el CMV.",
  utilidadPendiente: "Margen esperado que todavia no quedo liberado porque falta cobrar o recuperar capital.",
  resultadoFinanciero: "Financiacion cobrada menos costos financieros.",
  resultadoDistribuible: "Utilidad liberada mas resultado financiero menos gastos operativos.",
  gastos: "Gastos operativos registrados en el periodo.",
  baseProrrateada: "Dato tecnico: base comercial reconocida proporcionalmente por cobros.",
  cmvProrrateado: "Dato tecnico: CMV reconocido proporcionalmente por cobros.",
  margenProrrateado: "Dato tecnico: margen calculado por prorrateo. No es el KPI principal.",
  ingresoNetoLiquidado: "Dato tecnico: neto liquidado de pagos despues de costos financieros.",
};




export default function RentabilidadPage() {
  const { usuarioId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1000px)");
  const [periodoMes, setPeriodoMes] = useState(mesActual());
  const [idRegla, setIdRegla] = useState("");
  const [rentabilidad, setRentabilidad] = useState(null);
  const [comparacion, setComparacion] = useState(null);
  const [vista, setVista] = useState("resumen");
  const [modoRubros, setModoRubros] = useState("actual");
  const [bonificaciones, setBonificaciones] = useState(null);
  const [bonificacionesError, setBonificacionesError] = useState("");
  const [mostrarDetalleBonificaciones, setMostrarDetalleBonificaciones] = useState(false);
  const [reglas, setReglas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [procesandoCierreId, setProcesandoCierreId] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function cargarBase() {
    setError("");

    try {
      const [reglasData, cierresData] = await Promise.all([
        getReglasRentabilidad({ incluir_inactivas: true }),
        getCierresRentabilidad({ limit: 20, offset: 0 }),
      ]);

      setReglas(reglasData || []);
      setCierres(cierresData || []);

      const activa = (reglasData || []).find((r) => r.activa);

      if (activa && !idRegla) {
        setIdRegla(String(activa.id));
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar base de rentabilidad");
    }
  }
  async function cargarRentabilidad() {
    setLoading(true);
    setError("");
    setBonificacionesError("");
    try {
      const params = {
        periodo_mes: periodoMes,
        id_sucursal: SUCURSAL_ID,
      };
      const [data, bonificacionesResultado] = await Promise.all([
        getRentabilidadComparacion({
          ...params,
          id_regla_distribucion: idRegla,
        }),
        getBonificacionesGarantias(params)
          .then((dataBonificaciones) => ({ data: dataBonificaciones, error: "" }))
          .catch((err) => ({
            data: null,
            error: err.message || "No se pudo cargar el informe de bonificaciones",
          })),
      ]);
      setComparacion(data);
      setRentabilidad(data?.actual || null);
      setBonificaciones(bonificacionesResultado.data);
      setBonificacionesError(bonificacionesResultado.error);
    } catch (err) {
      setError(err.message || "No se pudo calcular la rentabilidad mensual");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarRentabilidad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoMes, idRegla]);


  async function cerrarMes() {
    if (!rentabilidad?.regla_distribucion?.id) {
      setError("Necesitás una regla activa para cerrar el mes");
      return;
    }

    if (!periodoTerminado(periodoMes)) {
      setError(`Todavía no se puede cerrar ${periodoLabel(periodoMes)}. El cierre sólo se habilita cuando el mes terminó.`);
      return;
    }

    const textoConfirmacion = confirmacionPeriodo(periodoMes);
    const respuesta = window.prompt(
      `Vas a cerrar ${periodoLabel(periodoMes)}.\n\nEl cierre guarda una foto histórica y distribuye el resultado.\n\nPara confirmar, escribí: ${textoConfirmacion}`,
    );
    if (respuesta?.trim().toUpperCase() !== textoConfirmacion) {
      setError("Cierre cancelado: el texto de confirmación no coincidió con el mes.");
      return;
    }

    setError("");
    setOk("");
    try {
      await crearCierreRentabilidad({
        periodo_mes: periodoMes,
        id_sucursal: SUCURSAL_ID,
        id_regla_distribucion: rentabilidad.regla_distribucion.id,
        id_usuario: usuarioId,
        observaciones: "Cierre mensual desde Rentabilidad",
      });
      setOk("Mes cerrado correctamente");
      await cargarBase();
      await cargarRentabilidad();
    } catch (err) {
      setError(err.message || "No se pudo cerrar el mes");
    }
  }

  async function anularCierre(cierre) {
    if (procesandoCierreId) return;

    const confirmado = window.confirm(
      `Vas a anular el cierre #${cierre.id} de ${periodoLabel(cierre.periodo_mes)}.\n\n` +
      "Va a quedar como ANULADO en el historial y vas a poder volver a cerrar ese mes correctamente.\n\n" +
      "¿Confirmás la anulación?",
    );
    if (!confirmado) {
      setError("Anulación cancelada.");
      return;
    }

    setError("");
    setOk("");
    setProcesandoCierreId(cierre.id);
    try {
      const cierreAnulado = await anularCierreRentabilidad(cierre.id, {
        id_usuario: usuarioId,
        motivo: "Cierre anulado desde Rentabilidad por corrección operativa",
      });
      setCierres((prev) =>
        prev.map((item) => (item.id === cierre.id ? { ...item, ...cierreAnulado } : item))
      );
      setOk(`Cierre de ${periodoLabel(cierre.periodo_mes)} anulado correctamente`);
      await cargarBase();
      await cargarRentabilidad();
    } catch (err) {
      setError(err.message || "No se pudo anular el cierre");
    } finally {
      setProcesandoCierreId(null);
    }
  }

  async function descargarInforme() {
    setError("");
    setOk("");
    setDescargandoPdf(true);
    try {
      await descargarResultadoDistribuiblePdf({
        periodo_mes: periodoMes,
        id_sucursal: SUCURSAL_ID,
        id_regla_distribucion: idRegla,
        incluir_detalle: true,
      });
    } catch (err) {
      setError(err.message || "No se pudo descargar el informe");
    } finally {
      setDescargandoPdf(false);
    }
  }

  const bonificacionesItems = bonificaciones?.items || [];
  const bonificacionesVisibles = mostrarDetalleBonificaciones
    ? bonificacionesItems
    : bonificacionesItems.slice(0, 5);
  const hayMasBonificaciones = bonificacionesItems.length > bonificacionesVisibles.length;
  const rubrosPeriodo = [...(rentabilidad?.resumen_por_rubro || [])].sort(
    (a, b) => Number(b.margen_esperado || 0) - Number(a.margen_esperado || 0)
  );
  const unidadesVendidasPeriodo = rubrosPeriodo.reduce(
    (total, rubro) => total + Number(rubro.cantidad_unidades || 0),
    0
  );

  return (
    <div style={{ padding: isMobile ? 12 : 24, display: "grid", gap: isMobile ? 12 : 18, minWidth: 0 }}>
      <header style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, color: "#101828", fontSize: isMobile ? 26 : 32, lineHeight: 1.1 }}>Rentabilidad mensual</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Separá venta comercial, capital recuperado y utilidad liberada.
          </p>
        </div>
        <div style={{ display: isMobile ? "grid" : "flex", gap: 10, width: isMobile ? "100%" : undefined }}>
          <button
            style={{ ...secondaryButton, width: isMobile ? "100%" : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onClick={descargarInforme}
            disabled={descargandoPdf}
          >
            <FileDown size={18} />
            {descargandoPdf ? "Generando..." : "Informe PDF"}
          </button>
          <button style={{ ...primaryButton, width: isMobile ? "100%" : undefined }} onClick={cerrarMes}>Cerrar mes</button>
        </div>
      </header>

      {error && <div style={{ ...card, padding: 14, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>{error}</div>}
      {ok && <div style={{ ...card, padding: 14, borderColor: "#bbf7d0", color: "#166534", background: "#f0fdf4" }}>{ok}</div>}

      <section style={{ ...card, padding: isMobile ? 12 : 16, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "220px 1fr", gap: 12, minWidth: 0 }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Mes
          <input style={input} type="date" value={periodoMes} onChange={(e) => setPeriodoMes(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Regla de distribución
          <select style={input} value={idRegla} onChange={(e) => setIdRegla(e.target.value)}>
            <option value="">Sin regla</option>
            {reglas.map((r) => <option key={r.id} value={r.id}>{r.nombre} {r.activa ? "" : "(inactiva)"}</option>)}
          </select>
        </label>
      </section>

      <nav
        aria-label="Vistas de rentabilidad"
        style={{
          ...card,
          padding: 6,
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
          gap: 6,
          position: "sticky",
          top: 8,
          zIndex: 5,
        }}
      >
        {[
          { id: "resumen", label: "Resumen", Icon: BarChart3 },
          { id: "rubros", label: "Rubros", Icon: Layers3 },
          { id: "cobranza", label: "Cobranza", Icon: WalletCards },
          { id: "control", label: "Control", Icon: ClipboardCheck },
        ].map(({ id, label, Icon }) => {
          const activa = vista === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={activa ? "page" : undefined}
              onClick={() => setVista(id)}
              style={{
                border: activa ? "1px solid #f97316" : "1px solid transparent",
                borderRadius: 8,
                minHeight: 42,
                padding: "8px 10px",
                background: activa ? "#fff7ed" : "transparent",
                color: activa ? "#c2410c" : "#475467",
                fontWeight: 900,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          );
        })}
      </nav>

      <section style={{ display: vista === "resumen" ? "grid" : "none", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))", gap: isMobile ? 8 : 12, minWidth: 0 }}>
        <Metric title="Venta comercial" value={money(rentabilidad?.venta_comercial ?? rentabilidad?.ventas_netas)} help={metricHelp.ventaComercial} />
        <Metric title="Margen esperado" value={money(rentabilidad?.margen_esperado ?? rentabilidad?.margen_bruto)} help={metricHelp.margenEsperado} />
        <Metric title="Utilidad liberada" value={money(rentabilidad?.utilidad_liberada)} help={metricHelp.utilidadLiberada} strong />
        <Metric title="Gastos operativos" value={money(rentabilidad?.gastos_operativos)} help={metricHelp.gastos} />
        <Metric title="Resultado distribuible" value={money(rentabilidad?.resultado_distribuible)} help={metricHelp.resultadoDistribuible} strong />
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: vista === "resumen" ? "grid" : "none", gap: 16, minWidth: 0 }}>
        <div>
          <p style={{ margin: 0, color: "#f97316", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
            Comparacion mensual
          </p>
          <h2 style={{ margin: "4px 0 0", color: "#101828" }}>
            {periodoLabel(comparacion?.periodo_anterior)} vs. {periodoLabel(comparacion?.periodo_actual)}
          </h2>
          <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
            Ventas y costos corresponden al mes de la venta. La utilidad liberada corresponde al mes en que se cobro.
          </p>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #eaecf0", borderRadius: 10 }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475467", textAlign: "left" }}>
                <th style={tableTh}>Indicador</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Mes anterior</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Mes actual</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Diferencia</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Variacion</th>
              </tr>
            </thead>
            <tbody>
              {(comparacion?.metricas || []).map((item) => {
                const esMargen = item.clave === "margen";
                const variacion = esMargen ? item.diferencia_puntos_porcentuales : item.variacion_porcentual;
                const valor = (numero) => esMargen ? formatPercent(numero) : money(numero);
                return (
                  <tr key={item.clave} style={{ borderTop: "1px solid #f2f4f7" }}>
                    <td style={{ ...tableTd, fontWeight: 850 }}>{item.nombre}</td>
                    <td style={{ ...tableTd, textAlign: "right" }}>{valor(item.anterior)}</td>
                    <td style={{ ...tableTd, textAlign: "right", fontWeight: 900 }}>{valor(item.actual)}</td>
                    <td style={{ ...tableTd, textAlign: "right", color: Number(item.diferencia) < 0 ? "#b42318" : "#067647", fontWeight: 900 }}>
                      {esMargen ? `${Number(item.diferencia).toFixed(2)} pp` : money(item.diferencia)}
                    </td>
                    <td style={{ ...tableTd, textAlign: "right" }}>
                      {variacion === null || variacion === undefined
                        ? <span style={{ color: "#98a2b3" }}>Sin base anterior</span>
                        : `${Number(variacion).toFixed(2)}${esMargen ? " pp" : "%"}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.05fr .95fr", gap: 12 }}>
          <div style={{ border: "1px solid #d0d5dd", borderRadius: 10, padding: 14 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>De donde sale la diferencia</h3>
            {(comparacion?.conciliacion_resultado || []).map((item, index, lista) => (
              <div key={item.clave} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: index ? "1px solid #f2f4f7" : "none", fontWeight: index === 0 || index === lista.length - 1 ? 950 : 750 }}>
                <span>{item.nombre}</span>
                <span style={{ whiteSpace: "nowrap", color: Number(item.importe) < 0 ? "#b42318" : "#067647" }}>{money(item.importe)}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: 10, background: "#f8fafc", borderRadius: 8, color: "#475467", lineHeight: 1.45 }}>
              Cambio comercial: {money(comparacion?.efecto_ventas)} por vender mas o menos y {money(comparacion?.efecto_margen)} por cambio de margen. Ambos suman la variacion comercial sin duplicarla.
            </div>
          </div>

          <div style={{ border: "1px solid #d0d5dd", borderRadius: 10, padding: 14 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Lectura automatica</h3>
            {(comparacion?.explicaciones || []).map((texto) => (
              <p key={texto} style={{ margin: "0 0 9px", color: "#344054", lineHeight: 1.5 }}>{texto}</p>
            ))}
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: comparacion?.validacion_actual?.valida ? "#ecfdf3" : "#fff7ed", color: comparacion?.validacion_actual?.valida ? "#067647" : "#b54708", fontWeight: 850 }}>
              {comparacion?.validacion_actual?.valida ? "Totales por rubro conciliados con el resumen general." : "Hay diferencias entre rubros y resumen general. Revisar ajustes."}
            </div>
            {(comparacion?.validacion_actual?.notas || []).map((nota) => (
              <p key={nota} style={{ margin: "8px 0 0", color: "#667085", fontSize: 13 }}>{nota}</p>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: vista === "rubros" ? "grid" : "none", gap: 14, minWidth: 0 }}>
        <div style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "#f97316", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
              Origen de ingresos
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Ganancia comercial por rubro</h2>
            <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
              {modoRubros === "actual"
                ? `Lectura operativa de ${periodoLabel(periodoMes)}.`
                : "Análisis mensual para entender qué rubros explican el cambio de ganancia."}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, border: "1px solid #d0d5dd", borderRadius: 10, background: "#f8fafc", width: isMobile ? "100%" : 330 }}>
            {[
              ["actual", "Período actual"],
              ["comparacion", "Comparar meses"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModoRubros(id)}
                style={{
                  border: modoRubros === id ? "1px solid #fdba74" : "1px solid transparent",
                  borderRadius: 7,
                  padding: "8px 10px",
                  background: modoRubros === id ? "#fff7ed" : "transparent",
                  color: modoRubros === id ? "#c2410c" : "#475467",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {modoRubros === "actual" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <Metric title="Unidades vendidas" value={String(unidadesVendidasPeriodo)} />
              <Metric title="Ventas realizadas" value={String(rentabilidad?.cantidad_ventas || 0)} />
              <Metric title="Venta comercial" value={money(rentabilidad?.venta_comercial)} />
              <Metric title="Ganancia comercial" value={money(rentabilidad?.margen_esperado)} strong />
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #eaecf0", borderRadius: 14 }}>
              <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "#475467", textAlign: "left", borderBottom: "1px solid #eaecf0", background: "#f8fafc" }}>
                    <th style={tableTh}>Rubro</th>
                    <th style={{ ...tableTh, textAlign: "right" }}>Unidades</th>
                    <th style={{ ...tableTh, textAlign: "right" }}>Ventas</th>
                    <th style={{ ...tableTh, textAlign: "right" }}>Venta neta</th>
                    <th style={{ ...tableTh, textAlign: "right" }}>Costo</th>
                    <th style={{ ...tableTh, textAlign: "right" }}>Ganancia</th>
                    <th style={{ ...tableTh, textAlign: "right" }}>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="7" style={emptyTd}>Calculando rubros...</td></tr>
                  ) : rubrosPeriodo.length === 0 ? (
                    <tr><td colSpan="7" style={emptyTd}>Sin ventas para agrupar en este período.</td></tr>
                  ) : (
                    rubrosPeriodo.map((grupo) => {
                      const margen = Number(grupo.venta_comercial || 0) > 0
                        ? Number(grupo.margen_esperado || 0) / Number(grupo.venta_comercial) * 100
                        : null;
                      return (
                        <tr key={grupo.clave} style={{ borderBottom: "1px solid #f2f4f7" }}>
                          <td style={{ ...tableTd, minWidth: 220 }}>
                            <strong style={{ color: "#101828" }}>{grupo.nombre}</strong>
                            <div style={{ marginTop: 3, color: "#667085", fontSize: 12 }}>{grupo.detalle}</div>
                          </td>
                          <td style={{ ...tableTd, textAlign: "right", fontWeight: 900 }}>{Number(grupo.cantidad_unidades || 0)}</td>
                          <td style={{ ...tableTd, textAlign: "right" }}>{grupo.cantidad_ventas || 0}</td>
                          <td style={{ ...tableTd, textAlign: "right" }}>{money(grupo.venta_comercial)}</td>
                          <td style={{ ...tableTd, textAlign: "right" }}>{money(grupo.cmv_comercial)}</td>
                          <td style={{ ...tableTd, textAlign: "right", fontWeight: 950, color: Number(grupo.margen_esperado) < 0 ? "#b42318" : "#067647" }}>{money(grupo.margen_esperado)}</td>
                          <td style={{ ...tableTd, textAlign: "right" }}>{margen === null ? "-" : formatPercent(margen)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {modoRubros === "comparacion" && (
          <div style={{ overflowX: "auto", border: "1px solid #eaecf0", borderRadius: 14 }}>
            <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#475467", textAlign: "left", borderBottom: "1px solid #eaecf0", background: "#f8fafc" }}>
                <th style={tableTh}>Rubro</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Ventas anterior</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Ventas actual</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Costos anterior</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Costos actual</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Ganancia anterior</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Ganancia actual</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Margen ant./act.</th>
                <th style={{ ...tableTh, textAlign: "right" }}>Impacto</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={emptyTd}>Calculando rubros...</td>
                </tr>
              ) : (comparacion?.rubros || []).length === 0 ? (
                <tr>
                  <td colSpan="9" style={emptyTd}>Sin ventas para agrupar en estos meses.</td>
                </tr>
              ) : (
                (comparacion?.rubros || []).map((grupo) => (
                  <tr key={grupo.clave} style={{ borderBottom: "1px solid #f2f4f7" }}>
                    <td style={{ ...tableTd, minWidth: 220 }}>
                      <strong style={{ color: "#101828" }}>{grupo.nombre}</strong>
                    </td>
                    <td style={{ ...tableTd, textAlign: "right" }}>{money(grupo.ventas_anterior)}</td>
                    <td style={{ ...tableTd, textAlign: "right", fontWeight: 900 }}>{money(grupo.ventas_actual)}</td>
                    <td style={{ ...tableTd, textAlign: "right" }}>{money(grupo.costos_anterior)}</td>
                    <td style={{ ...tableTd, textAlign: "right" }}>{money(grupo.costos_actual)}</td>
                    <td style={{ ...tableTd, textAlign: "right" }}>{money(grupo.ganancia_anterior)}</td>
                    <td style={{ ...tableTd, textAlign: "right", fontWeight: 900 }}>{money(grupo.ganancia_actual)}</td>
                    <td style={{ ...tableTd, textAlign: "right", whiteSpace: "nowrap" }}>
                      {grupo.margen_anterior === null ? "-" : formatPercent(grupo.margen_anterior)} / {grupo.margen_actual === null ? "-" : formatPercent(grupo.margen_actual)}
                    </td>
                    <td style={{ ...tableTd, textAlign: "right", fontWeight: 950, color: Number(grupo.variacion_ganancia) < 0 ? "#b42318" : "#067647" }}>{money(grupo.variacion_ganancia)}</td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: vista === "cobranza" ? "grid" : "none", gap: 14, minWidth: 0 }}>
        <div>
          <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>Ventas y cobranza</p>
          <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Que se vendio y que dinero entro</h2>
          <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
            Cobrado comercial incluye credito a favor aplicado. Efectivamente cobrado muestra dinero nuevo neto que ingreso por pagos.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #dbeafe", borderRadius: 10, padding: 14, background: "#eff6ff" }}>
            <strong>Origen de lo cobrado comercial</strong>
            <MiniMoneyLine label="Ventas de este mes" value={rentabilidad?.cobrado_ventas_periodo} />
            <MiniMoneyLine label="Ventas anteriores" value={rentabilidad?.cobrado_ventas_anteriores} />
            <MiniMoneyLine label="Total comercial" value={rentabilidad?.cobrado_comercial_reconocido} strong color="#1d4ed8" />
          </div>
          <div style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 14, background: "#f0fdf4" }}>
            <strong>Que libero la cobranza</strong>
            <MiniMoneyLine label="Capital recuperado" value={rentabilidad?.capital_recuperado} />
            <MiniMoneyLine label="Utilidad de ventas del mes" value={rentabilidad?.utilidad_liberada_ventas_periodo} />
            <MiniMoneyLine label="Utilidad de ventas anteriores" value={rentabilidad?.utilidad_liberada_ventas_anteriores} strong color="#067647" />
          </div>
          <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 14, background: "#fff7ed" }}>
            <strong>Conciliacion con dinero ingresado</strong>
            <MiniMoneyLine label="Cobrado comercial" value={rentabilidad?.cobrado_comercial_reconocido} />
            <MiniMoneyLine label="Credito aplicado" value={-Number(rentabilidad?.credito_aplicado || 0)} />
            <MiniMoneyLine label="Resultado financiero" value={rentabilidad?.resultado_financiero} />
            {Number(rentabilidad?.conciliacion_cobranza_ajuste || 0) !== 0 && <MiniMoneyLine label="Otros ajustes" value={rentabilidad?.conciliacion_cobranza_ajuste} />}
            <MiniMoneyLine label="Efectivamente cobrado" value={rentabilidad?.ingreso_real_neto} strong color="#c2410c" />
          </div>
        </div>
        <div style={{ color: "#667085", fontSize: 13, lineHeight: 1.45 }}>
          Los servicios con costo directo cero muestran margen antes de gastos operativos. La mercaderia sin costo cargado se marca como advertencia. El resultado distribuible es contable y no confirma por si solo caja disponible ni obligaciones pendientes.
        </div>
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 16, display: vista === "control" ? "grid" : "none", gap: 12, minWidth: 0 }}>
        <div>
          <p style={{ margin: 0, color: "#667085", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
            Auditoría técnica
          </p>
          <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.45 }}>
            Valores prorrateados para revisar cálculos. No son el KPI principal de utilidad.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <Metric title="Base prorrateada" value={money(rentabilidad?.ventas_cobradas)} help={metricHelp.baseProrrateada} />
          <Metric title="CMV prorrateado" value={money(rentabilidad?.cmv_cobrado)} help={metricHelp.cmvProrrateado} />
          <Metric title="Margen prorrateado" value={money(rentabilidad?.margen_cobrado)} help={metricHelp.margenProrrateado} />
          <Metric title="Ingreso neto liquidado" value={money(rentabilidad?.ingreso_real_neto)} help={metricHelp.ingresoNetoLiquidado} />
        </div>
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: vista === "control" ? (isMobile ? "grid" : "flex") : "none", justifyContent: "space-between", alignItems: "center", gap: 14, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
            Lectura por día
          </p>
          <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Detalle diario completo</h2>
          <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
            La lectura diaria se separó en una pantalla propia para ver venta por venta e ítem por ítem.
          </p>
        </div>
        <a
          href="/rentabilidad/diaria"
          style={{
            ...primaryButton,
            width: isMobile ? "100%" : undefined,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <CalendarDays size={18} />
          Ver lectura diaria completa
        </a>
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: vista === "control" ? "grid" : "none", gap: 14, minWidth: 0 }}>
        <div style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "#f97316", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
              Control administrativo
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Bonificaciones y garantías</h2>
            <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
              Muestra lo que se dejó de cobrar, el capital entregado y el resultado real de cada ítem.
            </p>
          </div>
          <div style={{ color: "#475467", fontWeight: 800, alignSelf: "center" }}>
            {bonificaciones?.cantidad_operaciones || 0} operación(es)
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(5, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <BonificacionMetric
            title="Valor bonificado"
            value={money(bonificaciones?.valor_bonificado)}
            tone="warning"
          />
          <BonificacionMetric
            title="Ingreso neto asignado"
            value={money(bonificaciones?.ingreso_neto_asignado)}
          />
          <BonificacionMetric
            title="Capital entregado"
            value={money(bonificaciones?.costo_capital)}
            tone="cost"
          />
          <BonificacionMetric
            title="Resultado económico"
            value={money(bonificaciones?.resultado_economico)}
            tone={Number(bonificaciones?.resultado_economico || 0) < 0 ? "danger" : "positive"}
          />
          <BonificacionMetric
            title="Ítems alcanzados"
            value={String(bonificaciones?.cantidad_items || 0)}
          />
        </div>

        {bonificacionesError && (
          <div
            style={{
              border: "1px solid #fecaca",
              borderRadius: 12,
              background: "#fef2f2",
              color: "#b42318",
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            No se pudo cargar este informe auxiliar. Reiniciá el backend para activar
            la nueva ruta. El cálculo principal de rentabilidad sigue disponible.
          </div>
        )}

        <div
          style={{
            border: "1px solid #fed7aa",
            borderRadius: 12,
            background: "#fff7ed",
            color: "#9a3412",
            padding: "10px 12px",
            fontSize: 13,
            lineHeight: 1.45,
            fontWeight: 750,
          }}
        >
          El ingreso neto se distribuye proporcionalmente según el total final de la venta.
          Los services gratuitos sin venta asociada no se valúan acá porque el sistema no registra un costo de mano de obra.
        </div>

        <div style={{ border: "1px solid #eaecf0", borderRadius: 14, overflow: "hidden", background: "#ffffff" }}>
          <div style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc", borderBottom: "1px solid #eaecf0" }}>
            <div>
              <strong style={{ color: "#101828" }}>Detalle de operaciones</strong>
              <div style={{ color: "#667085", fontSize: 13, marginTop: 2 }}>
                {bonificacionesItems.length === 0
                  ? "Sin movimientos para revisar."
                  : mostrarDetalleBonificaciones
                    ? `${bonificacionesItems.length} item(s) visibles`
                    : `Mostrando ${bonificacionesVisibles.length} de ${bonificacionesItems.length}`}
              </div>
            </div>

            {bonificacionesItems.length > 0 && (
              <button
                type="button"
                onClick={() => setMostrarDetalleBonificaciones((value) => !value)}
                style={{ ...secondaryButton, padding: "9px 12px", width: isMobile ? "100%" : undefined }}
              >
                {mostrarDetalleBonificaciones ? "Ocultar detalle" : "Ver detalle completo"}
              </button>
            )}
          </div>

          <div style={{ overflowX: "auto", maxHeight: mostrarDetalleBonificaciones ? 520 : 260 }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                <th style={{ padding: 10 }}>Fecha</th>
                <th style={{ padding: 10 }}>Origen</th>
                <th style={{ padding: 10 }}>Cliente / ítem</th>
                <th style={{ padding: 10 }}>Motivo</th>
                <th style={{ padding: 10, textAlign: "right" }}>Bonificado</th>
                <th style={{ padding: 10, textAlign: "right" }}>Ingreso neto</th>
                <th style={{ padding: 10, textAlign: "right" }}>Capital</th>
                <th style={{ padding: 10, textAlign: "right" }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {bonificacionesItems.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                    No hay bonificaciones ni garantías con valor económico en este mes.
                  </td>
                </tr>
              ) : (
                bonificacionesVisibles.map((item) => (
                  <tr key={item.id_venta_item} style={{ borderBottom: "1px solid #f2f4f7" }}>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {new Date(item.fecha).toLocaleDateString("es-AR")}
                    </td>
                    <td style={{ padding: 10 }}>
                      <strong>Venta #{item.id_venta}</strong>
                      <div style={{ color: "#667085", marginTop: 3 }}>
                        {item.origen === "taller" && item.id_orden_taller
                          ? `OT #${item.id_orden_taller}`
                          : item.origen}
                      </div>
                    </td>
                    <td style={{ padding: 10, minWidth: 230 }}>
                      <strong>{item.cliente_nombre}</strong>
                      <div style={{ color: "#667085", marginTop: 3 }}>
                        {item.descripcion_snapshot}
                      </div>
                    </td>
                    <td style={{ padding: 10, minWidth: 170 }}>{item.motivo_bonificacion}</td>
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 850, color: "#b45309" }}>
                      {money(item.valor_bonificado)}
                    </td>
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 850 }}>
                      {money(item.ingreso_neto_asignado)}
                    </td>
                    <td style={{ padding: 10, textAlign: "right" }}>{money(item.costo_capital)}</td>
                    <td
                      style={{
                        padding: 10,
                        textAlign: "right",
                        fontWeight: 950,
                        color: Number(item.resultado_economico || 0) < 0 ? "#b42318" : "#067647",
                      }}
                    >
                      {money(item.resultado_economico)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          {hayMasBonificaciones && (
            <div style={{ padding: "10px 14px", color: "#667085", background: "#f8fafc", borderTop: "1px solid #eaecf0", fontSize: 13, fontWeight: 800 }}>
              Hay {bonificacionesItems.length - bonificacionesVisibles.length} item(s) mas. Abrí el detalle completo para auditar todo.
            </div>
          )}
        </div>
      </section>

      <section style={{ display: vista === "control" ? "grid" : "none", gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1.2fr) minmax(360px, .8fr)", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ ...card, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px" }}>Resultado distribuible</h2>
            {loading ? <p>Cargando...</p> : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 34, fontWeight: 950, color: "#f97316" }}>
                  {money(rentabilidad?.resultado_distribuible)}
                </div>
                <div style={{ color: "#667085" }}>
                  Fórmula: utilidad liberada + resultado financiero - gastos operativos.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                        <th style={{ padding: 10 }}>Destino</th>
                        <th style={{ padding: 10 }}>Porcentaje</th>
                        <th style={{ padding: 10 }}>Monto sugerido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rentabilidad?.distribuciones_sugeridas || []).map((d) => (
                        <tr key={d.id_participante} style={{ borderBottom: "1px solid #f2f4f7" }}>
                          <td style={{ padding: 10, fontWeight: 800 }}>{d.participante_nombre}</td>
                          <td style={{ padding: 10 }}>{formatPercent(d.porcentaje)}</td>
                          <td style={{ padding: 10, fontWeight: 900 }}>{money(d.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px" }}>Cierres históricos</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                    <th style={{ padding: 10 }}>Mes</th>
                    <th style={{ padding: 10 }}>Utilidad + financiero</th>
                    <th style={{ padding: 10 }}>Resultado</th>
                    <th style={{ padding: 10 }}>Regla</th>
                    <th style={{ padding: 10 }}>Estado</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cierres.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: 18, color: "#667085" }}>Sin cierres todavía</td></tr>
                  ) : cierres.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f2f4f7" }}>
                      <td style={{ padding: 10 }}>{periodoLabel(c.periodo_mes)}</td>
                      <td style={{ padding: 10, fontWeight: 900 }}>{money(c.margen_real)}</td>
                      <td style={{ padding: 10, fontWeight: 900 }}>{money(c.resultado_distribuible)}</td>
                      <td style={{ padding: 10 }}>{c.regla_nombre_snapshot || "-"}</td>
                      <td style={{ padding: 10 }}>
                        <span style={c.estado === "anulado" ? badgeNeutral : badgeSuccess}>
                          {c.estado === "anulado" ? "Anulado" : "Cerrado"}
                        </span>
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {c.estado === "cerrado" ? (
                          <button
                            type="button"
                            style={dangerButton}
                            onClick={() => anularCierre(c)}
                            disabled={procesandoCierreId === c.id}
                          >
                            {procesandoCierreId === c.id ? "Anulando..." : "Anular"}
                          </button>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside style={{ ...card, padding: 16 }}>
          <h2 style={{ margin: "0 0 12px" }}>
            Distribución vigente
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            {(rentabilidad?.distribuciones_sugeridas || []).map((d) => (
              <div
                key={d.id_participante}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid #f2f4f7",
                }}
              >
                <strong>{d.participante_nombre}</strong>
                <span>{formatPercent(d.porcentaje)}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid #eaecf0",
              color: "#667085",
              fontSize: 14,
            }}
          >
            La configuración se administra desde
            Configuración Comercial.
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ title, value, strong = false, help = "" }) {
  return (
    <div style={{ ...card, padding: 16 }} title={help || title}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <div style={{ color: "#667085", fontSize: 13, fontWeight: 800 }}>{title}</div>
        {help && (
          <span
            aria-label={help}
            title={help}
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#eff6ff",
              color: "#2563eb",
              fontSize: 12,
              fontWeight: 950,
              cursor: "help",
              flexShrink: 0,
            }}
          >
            ?
          </span>
        )}
      </div>
      <div style={{ color: strong ? "#f97316" : "#101828", fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const tableTh = {
  padding: "10px 8px",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
  whiteSpace: "nowrap",
  verticalAlign: "bottom",
};

const tableTd = {
  padding: "10px 8px",
  verticalAlign: "top",
};

const emptyTd = {
  padding: 18,
  color: "#667085",
  textAlign: "center",
};

function MiniMoneyLine({ label, value, strong = false, color = "#101828" }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        alignItems: "baseline",
        whiteSpace: "nowrap",
        lineHeight: 1.45,
        fontWeight: strong ? 900 : 650,
        color,
      }}
    >
      <span style={{ color: "#667085", fontSize: 11, fontWeight: 800 }}>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function BonificacionMetric({ title, value, tone = "default" }) {
  const tones = {
    default: { background: "#f8fafc", border: "#e2e8f0", color: "#101828" },
    warning: { background: "#fff7ed", border: "#fed7aa", color: "#b45309" },
    cost: { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    danger: { background: "#fef2f2", border: "#fecaca", color: "#b42318" },
    positive: { background: "#ecfdf3", border: "#abefc6", color: "#067647" },
  };
  const selected = tones[tone] || tones.default;

  return (
    <div
      style={{
        border: `1px solid ${selected.border}`,
        borderRadius: 12,
        padding: 12,
        background: selected.background,
        minWidth: 0,
      }}
    >
      <div style={{ color: "#667085", fontSize: 12, fontWeight: 850 }}>{title}</div>
      <div style={{ color: selected.color, fontSize: 19, fontWeight: 950, marginTop: 5 }}>
        {value}
      </div>
    </div>
  );
}
