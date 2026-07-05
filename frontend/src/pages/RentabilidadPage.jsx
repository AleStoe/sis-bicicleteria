import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Package, Wrench } from "lucide-react";
import {
  crearCierreRentabilidad,
  getBonificacionesGarantias,
  getCierresRentabilidad,
  getReglasRentabilidad,
  getRentabilidadDiaria,
  getRentabilidadMensual,
} from "../services/rentabilidadService";
import { formatMoney, formatPercent } from "../utils/formatters";
import { formatProductoVariante } from "../utils/productPresentation";
import { useSession } from "../context/SessionContext";
import useMediaQuery from "../hooks/useMediaQuery";

const SUCURSAL_ID = 1;

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fechaActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function money(value) {
  return formatMoney(value || 0);
}

function fechaHora(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  padding: "10px 12px",
  background: "#fff",
  color: "#344054",
  fontWeight: 750,
  cursor: "pointer",
};

const detailButton = {
  width: 32,
  height: 32,
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  background: "#fff",
  color: "#344054",
  display: "inline-grid",
  placeItems: "center",
  cursor: "pointer",
};

const itemBadgeBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  borderRadius: 999,
  padding: "4px 7px",
  fontSize: 11,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const productBadge = {
  ...itemBadgeBase,
  background: "#eff6ff",
  color: "#1d4ed8",
};

const serviceBadge = {
  ...itemBadgeBase,
  background: "#fff7ed",
  color: "#c2410c",
};

export default function RentabilidadPage() {
  const { usuarioId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1000px)");
  const [periodoMes, setPeriodoMes] = useState(mesActual());
  const [fechaDiaria, setFechaDiaria] = useState(fechaActual());
  const [idRegla, setIdRegla] = useState("");
  const [rentabilidad, setRentabilidad] = useState(null);
  const [bonificaciones, setBonificaciones] = useState(null);
  const [bonificacionesError, setBonificacionesError] = useState("");
  const [rentabilidadDiaria, setRentabilidadDiaria] = useState(null);
  const [diariaLoading, setDiariaLoading] = useState(false);
  const [diariaError, setDiariaError] = useState("");
  const [articuloAbierto, setArticuloAbierto] = useState("");
  const [reglas, setReglas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
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
        getRentabilidadMensual({
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
      setRentabilidad(data);
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

  useEffect(() => {
    cargarRentabilidadDiaria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDiaria]);

  async function cargarRentabilidadDiaria() {
    setDiariaLoading(true);
    setDiariaError("");
    setArticuloAbierto("");
    try {
      const data = await getRentabilidadDiaria({
        fecha: fechaDiaria,
        id_sucursal: SUCURSAL_ID,
      });
      setRentabilidadDiaria(data);
    } catch (err) {
      setRentabilidadDiaria(null);
      setDiariaError(err.message || "No se pudo calcular el resumen diario");
    } finally {
      setDiariaLoading(false);
    }
  }


  async function cerrarMes() {
    if (!rentabilidad?.regla_distribucion?.id) {
      setError("Necesitás una regla activa para cerrar el mes");
      return;
    }

    if (!window.confirm("¿Cerrar este mes? El cierre guarda una foto histórica.")) return;

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
    } catch (err) {
      setError(err.message || "No se pudo cerrar el mes");
    }
  }

  return (
    <div style={{ padding: isMobile ? 12 : 24, display: "grid", gap: isMobile ? 12 : 18, minWidth: 0 }}>
      <header style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, color: "#101828", fontSize: isMobile ? 26 : 32, lineHeight: 1.1 }}>Rentabilidad mensual</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Margen real vendido menos gastos operativos, con distribución mensual congelable.
          </p>
        </div>
        <button style={{ ...primaryButton, width: isMobile ? "100%" : undefined }} onClick={cerrarMes}>Cerrar mes</button>
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

      <section style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))", gap: isMobile ? 8 : 12, minWidth: 0 }}>
        <Metric title="Ventas netas" value={money(rentabilidad?.ventas_netas)} />
        <Metric title="Ingreso real neto" value={money(rentabilidad?.ingreso_real_neto)} />
        <Metric title="Financiación cobrada" value={money(rentabilidad?.financiacion_cobrada)} />
        <Metric title="Costos financieros" value={money(rentabilidad?.costos_financieros)} />
        <Metric title="CMV neto" value={money(rentabilidad?.cmv_neto)} />
        <Metric title="Margen comercial" value={money(rentabilidad?.margen_bruto)} />
        <Metric title="Resultado financiero" value={money(rentabilidad?.resultado_financiero)} />
        <Metric title="Margen real" value={money(rentabilidad?.margen_real)} strong />
        <Metric title="Gastos" value={money(rentabilidad?.gastos_operativos)} />
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: "grid", gap: 14, minWidth: 0 }}>
        <div
          style={{
            display: isMobile ? "grid" : "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 12,
          }}
        >
          <div>
            <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
              Lectura por día
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Resumen diario por artículo</h2>
            <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
              Ingreso real, costo aplicado y margen de los productos vendidos.
            </p>
          </div>
          <label style={{ display: "grid", gap: 6, minWidth: isMobile ? 0 : 190, fontWeight: 850, color: "#344054" }}>
            Fecha
            <input
              type="date"
              value={fechaDiaria}
              onChange={(e) => setFechaDiaria(e.target.value)}
              style={input}
            />
          </label>
        </div>

        {diariaError && (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b42318", borderRadius: 12, padding: 12, fontWeight: 800 }}>
            {diariaError}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(9, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <BonificacionMetric title="Ventas" value={String(rentabilidadDiaria?.cantidad_ventas || 0)} />
          <BonificacionMetric title="Ventas netas" value={money(rentabilidadDiaria?.ventas_netas)} />
          <BonificacionMetric title="Ingreso real neto" value={money(rentabilidadDiaria?.ingreso_real_neto)} />
          <BonificacionMetric
            title="Financiación cobrada"
            value={money(rentabilidadDiaria?.financiacion_cobrada)}
          />
          <BonificacionMetric title="Costo financiero" value={money(rentabilidadDiaria?.costos_financieros)} tone="warning" />
          <BonificacionMetric title="Costo" value={money(rentabilidadDiaria?.cmv)} tone="cost" />
          <BonificacionMetric
            title="Margen comercial"
            value={money(rentabilidadDiaria?.margen_bruto)}
            tone={Number(rentabilidadDiaria?.margen_bruto || 0) < 0 ? "danger" : "positive"}
          />
          <BonificacionMetric
            title="Margen real"
            value={money(rentabilidadDiaria?.margen_real)}
            tone={Number(rentabilidadDiaria?.margen_real || 0) < 0 ? "danger" : "positive"}
          />
          <BonificacionMetric
            title="Margen"
            value={formatPercent(rentabilidadDiaria?.margen_porcentaje || 0)}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1300, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                <th style={{ padding: 10 }}>Artículo</th>
                <th style={{ padding: 10 }}>Tipo</th>
                <th style={{ padding: 10, textAlign: "right" }}>Ventas</th>
                <th style={{ padding: 10, textAlign: "right" }}>Cantidad</th>
                <th style={{ padding: 10, textAlign: "right" }}>Ingreso comercial</th>
                <th style={{ padding: 10, textAlign: "right" }}>Financiación</th>
                <th style={{ padding: 10, textAlign: "right" }}>Costo financiero</th>
                <th style={{ padding: 10, textAlign: "right" }}>Costo</th>
                <th style={{ padding: 10, textAlign: "right" }}>Margen real</th>
                <th style={{ padding: 10, textAlign: "right" }}>Margen</th>
                <th style={{ width: 46 }} aria-label="Detalle" />
              </tr>
            </thead>
            <tbody>
              {diariaLoading ? (
                <tr>
                  <td colSpan="11" style={{ padding: 20, color: "#667085", textAlign: "center" }}>
                    Calculando resumen diario...
                  </td>
                </tr>
              ) : (rentabilidadDiaria?.articulos || []).length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ padding: 20, color: "#667085", textAlign: "center" }}>
                    No hay productos ni servicios vendidos en esta fecha.
                  </td>
                </tr>
              ) : (
                rentabilidadDiaria.articulos.map((articulo) => {
                  const articuloKey = `${articulo.tipo_item}-${articulo.id_variante || articulo.id_servicio_taller || articulo.producto}`;
                  const abierto = articuloAbierto === articuloKey;
                  return (
                    <Fragment key={articuloKey}>
                      <tr style={{ borderBottom: "1px solid #f2f4f7" }}>
                        <td style={{ padding: 10, fontWeight: 850 }}>
                          {formatProductoVariante(articulo.producto, articulo.variante)}
                        </td>
                        <td style={{ padding: 10 }}>
                          <span style={articulo.tipo_item === "servicio_taller" ? serviceBadge : productBadge}>
                            {articulo.tipo_item === "servicio_taller" ? (
                              <Wrench size={13} />
                            ) : (
                              <Package size={13} />
                            )}
                            {articulo.tipo_item === "servicio_taller" ? "Servicio" : "Producto"}
                          </span>
                        </td>
                        <td style={{ padding: 10, textAlign: "right" }}>{articulo.cantidad_ventas}</td>
                        <td style={{ padding: 10, textAlign: "right" }}>{articulo.cantidad_vendida}</td>
                        <td style={{ padding: 10, textAlign: "right", fontWeight: 850 }}>{money(articulo.venta_total)}</td>
                        <td style={{ padding: 10, textAlign: "right", color: "#b54708" }}>{money(articulo.financiacion_cobrada)}</td>
                        <td style={{ padding: 10, textAlign: "right", color: "#b42318" }}>{money(articulo.costo_financiero)}</td>
                        <td style={{ padding: 10, textAlign: "right" }}>{money(articulo.costo_total)}</td>
                        <td
                          style={{
                            padding: 10,
                            textAlign: "right",
                            fontWeight: 950,
                            color: Number(articulo.margen_real || 0) < 0 ? "#b42318" : "#067647",
                          }}
                        >
                          {money(articulo.margen_real)}
                        </td>
                        <td style={{ padding: 10, textAlign: "right" }}>
                          {formatPercent(articulo.margen_porcentaje || 0)}
                        </td>
                        <td style={{ padding: 6, textAlign: "right" }}>
                          <button
                            type="button"
                            title={abierto ? "Ocultar auditoría" : "Ver auditoría completa"}
                            onClick={() => setArticuloAbierto(abierto ? "" : articuloKey)}
                            style={detailButton}
                          >
                            {abierto ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                          </button>
                        </td>
                      </tr>
                      {abierto ? (
                        <tr>
                          <td colSpan="11" style={{ padding: "0 10px 14px", background: "#f8fafc" }}>
                            <DetalleRentabilidadArticulo articulo={articulo} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ color: "#667085", fontSize: 12, lineHeight: 1.4 }}>
          La financiación de tarjeta se informa por separado y no integra la ganancia.
          Productos y mano de obra pueden desplegarse para auditar cada venta.
        </div>
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: "grid", gap: 14, minWidth: 0 }}>
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

        <div style={{ overflowX: "auto" }}>
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
              {(bonificaciones?.items || []).length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                    No hay bonificaciones ni garantías con valor económico en este mes.
                  </td>
                </tr>
              ) : (
                (bonificaciones?.items || []).map((item) => (
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
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1.2fr) minmax(360px, .8fr)", gap: isMobile ? 12 : 18, alignItems: "start", minWidth: 0 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ ...card, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px" }}>Resultado distribuible</h2>
            {loading ? <p>Cargando...</p> : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 34, fontWeight: 950, color: "#f97316" }}>
                  {money(rentabilidad?.resultado_distribuible)}
                </div>
                <div style={{ color: "#667085" }}>
                  Fórmula: ventas netas - costo mercadería vendida - gastos operativos.
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
                    <th style={{ padding: 10 }}>Margen real</th>
                    <th style={{ padding: 10 }}>Resultado</th>
                    <th style={{ padding: 10 }}>Regla</th>
                    <th style={{ padding: 10 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cierres.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: 18, color: "#667085" }}>Sin cierres todavía</td></tr>
                  ) : cierres.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f2f4f7" }}>
                      <td style={{ padding: 10 }}>{c.periodo_mes}</td>
                      <td style={{ padding: 10, fontWeight: 900 }}>{money(c.margen_real)}</td>
                      <td style={{ padding: 10, fontWeight: 900 }}>{money(c.resultado_distribuible)}</td>
                      <td style={{ padding: 10 }}>{c.regla_nombre_snapshot || "-"}</td>
                      <td style={{ padding: 10 }}>{c.estado}</td>
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

function Metric({ title, value, strong = false }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ color: "#667085", fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ color: strong ? "#f97316" : "#101828", fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function DetalleRentabilidadArticulo({ articulo }) {
  return (
    <div style={{ paddingTop: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "#475467", fontSize: 12 }}>
        <strong style={{ color: "#101828" }}>Auditoría del artículo</strong>
        <span>Lista: {money(articulo.valor_lista)}</span>
        <span>Bonificado: {money(articulo.bonificacion_total)}</span>
        <span>Descuentos: {money(articulo.descuento_comercial)}</span>
        <span>Financiación: {money(articulo.financiacion_cobrada)}</span>
        <span>Costo financiero: {money(articulo.costo_financiero)}</span>
        <span>Devoluciones: {money(articulo.devoluciones_total)}</span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e4e7ec", borderRadius: 10, background: "#fff" }}>
        <table style={{ width: "100%", minWidth: 1580, borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#667085", background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e4e7ec" }}>
              <th style={{ padding: 8 }}>Venta / Fecha</th>
              <th style={{ padding: 8 }}>Cliente</th>
              <th style={{ padding: 8 }}>Origen / Estado</th>
              <th style={{ padding: 8 }}>Medio</th>
              <th style={{ padding: 8, textAlign: "right" }}>Cantidad</th>
              <th style={{ padding: 8, textAlign: "right" }}>Precio lista</th>
              <th style={{ padding: 8, textAlign: "right" }}>Precio aplicado</th>
              <th style={{ padding: 8, textAlign: "right" }}>Bonificación</th>
              <th style={{ padding: 8, textAlign: "right" }}>Descuento</th>
              <th style={{ padding: 8, textAlign: "right" }}>Financiación</th>
              <th style={{ padding: 8, textAlign: "right" }}>Costo financiero</th>
              <th style={{ padding: 8, textAlign: "right" }}>Devolución</th>
              <th style={{ padding: 8, textAlign: "right" }}>Ingreso comercial</th>
              <th style={{ padding: 8, textAlign: "right" }}>Costo</th>
              <th style={{ padding: 8, textAlign: "right" }}>Margen real</th>
            </tr>
          </thead>
          <tbody>
            {(articulo.detalles || []).map((detalle) => (
              <tr key={detalle.id_venta_item} style={{ borderBottom: "1px solid #f2f4f7" }}>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                  <strong>Venta #{detalle.id_venta}</strong>
                  <div style={{ color: "#667085", marginTop: 2 }}>{fechaHora(detalle.fecha)}</div>
                </td>
                <td style={{ padding: 8, minWidth: 150 }}>{detalle.cliente_nombre}</td>
                <td style={{ padding: 8 }}>
                  <strong>{detalle.origen}</strong>
                  <div style={{ color: "#667085", marginTop: 2 }}>{detalle.estado_venta}</div>
                </td>
                <td style={{ padding: 8, minWidth: 130 }}>{detalle.medios_pago}</td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  {detalle.cantidad_neta}
                  {Number(detalle.cantidad_devuelta || 0) > 0 ? (
                    <div style={{ color: "#b42318", marginTop: 2 }}>
                      Dev. {detalle.cantidad_devuelta}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: 8, textAlign: "right" }}>{money(detalle.precio_lista)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{money(detalle.precio_final)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{money(detalle.bonificacion_total)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{money(detalle.descuento_comercial_asignado)}</td>
                <td style={{ padding: 8, textAlign: "right", color: "#b54708" }}>{money(detalle.financiacion_cobrada)}</td>
                <td style={{ padding: 8, textAlign: "right", color: "#b42318" }}>{money(detalle.costo_financiero)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{money(detalle.devolucion_comercial)}</td>
                <td style={{ padding: 8, textAlign: "right", fontWeight: 850 }}>{money(detalle.ingreso_comercial)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{money(detalle.costo_total)}</td>
                <td
                  style={{
                    padding: 8,
                    textAlign: "right",
                    fontWeight: 900,
                    color: Number(detalle.margen_real || 0) < 0 ? "#b42318" : "#067647",
                  }}
                >
                  {money(detalle.margen_real)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
