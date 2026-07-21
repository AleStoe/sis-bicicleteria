import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Package, Wrench, X } from "lucide-react";
import { getRentabilidadDiaria } from "../services/rentabilidadService";
import { formatMoney } from "../utils/formatters";
import { formatProductoVariante } from "../utils/productPresentation";
import useMediaQuery from "../hooks/useMediaQuery";

const SUCURSAL_ID = 1;

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

function numero(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function sumar(items, campo) {
  return items.reduce((total, item) => total + numero(item[campo]), 0);
}

function normalizar(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clasificarRubro(detalle) {
  const tipoPrecio = normalizar(detalle.tipo_precio);
  const tipoItem = normalizar(detalle.tipo_item_grupo || detalle.tipo_item);
  const rubro = normalizar(detalle.producto_rubro);
  const categoria = normalizar(detalle.categoria_nombre);
  const nombre = normalizar(`${detalle.articulo_nombre || ""} ${detalle.descripcion_snapshot || ""}`);

  if (tipoPrecio === "mayorista") {
    return { clave: "mayorista", nombre: "Mayorista", detalle: "Ventas con lista mayorista" };
  }

  if (tipoItem === "servicio_taller" || detalle.id_servicio_taller) {
    return { clave: "taller", nombre: "Taller / servicios", detalle: "Mano de obra y servicios cargados" };
  }

  if (rubro.includes("bicicleta") || categoria.includes("bicicleta") || nombre.includes("bicicleta")) {
    return { clave: "bicicletas", nombre: "Bicicletas", detalle: "Bicicletas vendidas por mostrador, reserva o taller" };
  }

  if (rubro.includes("accesorio") || categoria.includes("accesorio")) {
    return { clave: "accesorios", nombre: "Accesorios", detalle: "Accesorios y complementos" };
  }

  if (rubro.includes("repuesto") || categoria.includes("repuesto")) {
    return { clave: "repuestos", nombre: "Repuestos", detalle: "Repuestos y componentes" };
  }

  return { clave: "otros", nombre: "Otros", detalle: "Ítems sin rubro comercial específico" };
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

const secondaryButton = {
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  color: "#344054",
  fontWeight: 750,
  cursor: "pointer",
};

const primaryTinyButton = {
  border: "1px solid #ff6b00",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#ff6b00",
  color: "#fff",
  fontWeight: 850,
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

export default function RentabilidadDiariaPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [fecha, setFecha] = useState(fechaActual());
  const [rentabilidadDiaria, setRentabilidadDiaria] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detalleAuditoria, setDetalleAuditoria] = useState(null);
  const [vista, setVista] = useState("venta");
  const [ventasAbiertas, setVentasAbiertas] = useState(() => new Set());

  async function cargarRentabilidadDiaria() {
    setLoading(true);
    setError("");
    try {
      const data = await getRentabilidadDiaria({
        fecha,
        id_sucursal: SUCURSAL_ID,
      });
      setRentabilidadDiaria(data);
    } catch (err) {
      setRentabilidadDiaria(null);
      setError(err.message || "No se pudo calcular la lectura diaria");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarRentabilidadDiaria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const detalles = useMemo(() => {
    return (rentabilidadDiaria?.articulos || []).flatMap((articulo) =>
      (articulo.detalles || []).map((detalle) => ({
        ...detalle,
        articulo_nombre: formatProductoVariante(articulo.producto, articulo.variante),
        tipo_item_grupo: articulo.tipo_item,
      }))
    );
  }, [rentabilidadDiaria]);

  const ventasAgrupadas = useMemo(() => {
    const grupos = new Map();

    detalles.forEach((detalle) => {
      const id = detalle.id_venta;
      if (!grupos.has(id)) {
        grupos.set(id, {
          id_venta: id,
          fecha: detalle.fecha,
          cliente_nombre: detalle.cliente_nombre,
          estado_venta: detalle.estado_venta,
          origen: detalle.origen,
          medios_pago: new Set(),
          items: [],
        });
      }

      const venta = grupos.get(id);
      if (detalle.medios_pago) {
        venta.medios_pago.add(detalle.medios_pago);
      }
      venta.items.push(detalle);
    });

    return Array.from(grupos.values())
      .map((venta) => {
        const items = venta.items;
        const ventaComercial = sumar(items, "ingreso_comercial");
        const cmvComercial = sumar(items, "costo_total");
        const ventaCobrada = sumar(items, "venta_cobrada");
        const financiacionCobrada = sumar(items, "financiacion_cobrada");
        const costoFinanciero = sumar(items, "costo_financiero");
        const resultadoFinanciero = financiacionCobrada - costoFinanciero;
        return {
          ...venta,
          medios_pago_texto: Array.from(venta.medios_pago).filter(Boolean).join(", ") || "Sin pago confirmado",
          cantidad_items: items.length,
          cantidad_unidades: items.reduce((total, item) => total + numero(item.cantidad_neta), 0),
          venta_comercial: ventaComercial,
          cmv_comercial: cmvComercial,
          margen_esperado: ventaComercial - cmvComercial,
          cobrado_comercial_reconocido: sumar(items, "cobrado_comercial_reconocido"),
          saldo_pendiente: Math.max(ventaComercial - ventaCobrada, 0),
          capital_recuperado: sumar(items, "capital_recuperado"),
          capital_inmovilizado: sumar(items, "capital_inmovilizado"),
          utilidad_liberada: sumar(items, "utilidad_liberada"),
          utilidad_pendiente: sumar(items, "utilidad_pendiente"),
          resultado_financiero: resultadoFinanciero,
          utilidad_mas_financiero: sumar(items, "utilidad_liberada") + resultadoFinanciero,
        };
      })
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  }, [detalles]);

  const resumenRubros = useMemo(() => {
    const grupos = new Map();

    detalles.forEach((detalle) => {
      const rubro = clasificarRubro(detalle);
      if (!grupos.has(rubro.clave)) {
        grupos.set(rubro.clave, {
          ...rubro,
          items: 0,
          unidades: 0,
          ventas: new Set(),
          venta_comercial: 0,
          cmv_comercial: 0,
          margen_esperado: 0,
          cobrado_comercial_reconocido: 0,
          capital_recuperado: 0,
          capital_inmovilizado: 0,
          utilidad_liberada: 0,
          utilidad_pendiente: 0,
        });
      }

      const grupo = grupos.get(rubro.clave);
      grupo.items += 1;
      grupo.unidades += numero(detalle.cantidad_neta);
      grupo.ventas.add(detalle.id_venta);
      grupo.venta_comercial += numero(detalle.ingreso_comercial);
      grupo.cmv_comercial += numero(detalle.costo_total);
      grupo.margen_esperado += numero(detalle.margen_bruto);
      grupo.cobrado_comercial_reconocido += numero(detalle.cobrado_comercial_reconocido);
      grupo.capital_recuperado += numero(detalle.capital_recuperado);
      grupo.capital_inmovilizado += numero(detalle.capital_inmovilizado);
      grupo.utilidad_liberada += numero(detalle.utilidad_liberada);
      grupo.utilidad_pendiente += numero(detalle.utilidad_pendiente);
    });

    const orden = ["taller", "bicicletas", "accesorios", "repuestos", "mayorista", "otros"];
    return Array.from(grupos.values())
      .map((grupo) => ({
        ...grupo,
        ventas_cantidad: grupo.ventas.size,
      }))
      .sort((a, b) => {
        const posA = orden.indexOf(a.clave);
        const posB = orden.indexOf(b.clave);
        return (posA === -1 ? 99 : posA) - (posB === -1 ? 99 : posB);
      });
  }, [detalles]);

  function toggleVenta(idVenta) {
    setVentasAbiertas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(idVenta)) {
        siguiente.delete(idVenta);
      } else {
        siguiente.add(idVenta);
      }
      return siguiente;
    });
  }

  return (
    <div style={{ padding: isMobile ? 12 : 24, display: "grid", gap: isMobile ? 12 : 18, minWidth: 0 }}>
      <header
        style={{
          display: isMobile ? "grid" : "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <a
            href="/rentabilidad"
            style={{
              ...secondaryButton,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <ArrowLeft size={16} />
            Volver a rentabilidad mensual
          </a>
          <h1 style={{ margin: 0, color: "#101828", fontSize: isMobile ? 26 : 32, lineHeight: 1.1 }}>
            Lectura diaria de rentabilidad
          </h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Vista completa del día: separa negocio vendido, cobro real y margen pendiente.
          </p>
        </div>
        <label style={{ display: "grid", gap: 6, minWidth: isMobile ? 0 : 210, fontWeight: 850, color: "#344054" }}>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} />
        </label>
      </header>

      {error && (
        <div style={{ ...card, padding: 14, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>
          {error}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(10, minmax(0, 1fr))",
          gap: isMobile ? 8 : 12,
          minWidth: 0,
        }}
      >
        <Metric title="Ventas" value={String(rentabilidadDiaria?.cantidad_ventas || 0)} />
        <Metric title="Ítems" value={String(detalles.length)} />
        <Metric title="Venta comercial" value={money(rentabilidadDiaria?.venta_comercial ?? rentabilidadDiaria?.ventas_netas)} />
        <Metric title="CMV comercial" value={money(rentabilidadDiaria?.cmv_comercial ?? rentabilidadDiaria?.cmv)} tone="cost" />
        <Metric title="Margen esperado" value={money(rentabilidadDiaria?.margen_esperado ?? rentabilidadDiaria?.margen_bruto)} />
        <Metric title="Cobrado comercial" value={money(rentabilidadDiaria?.cobrado_comercial_reconocido)} />
        <Metric title="Saldo por cobrar" value={money(rentabilidadDiaria?.saldo_pendiente_por_cobrar)} />
        <Metric title="Financiación cobrada" value={money(rentabilidadDiaria?.financiacion_cobrada)} />
        <Metric title="Costo financiero" value={money(rentabilidadDiaria?.costos_financieros)} tone="danger" />
        <Metric title="Capital recuperado" value={money(rentabilidadDiaria?.capital_recuperado)} />
        <Metric title="Capital inmovilizado" value={money(rentabilidadDiaria?.capital_inmovilizado)} tone="danger" />
        <Metric title="Utilidad liberada" value={money(rentabilidadDiaria?.utilidad_liberada)} tone="positive" />
        <Metric title="Utilidad pendiente" value={money(rentabilidadDiaria?.utilidad_pendiente)} />
        <Metric
          title="Resultado financiero"
          value={money(rentabilidadDiaria?.resultado_financiero)}
          tone={Number(rentabilidadDiaria?.resultado_financiero || 0) < 0 ? "danger" : "positive"}
        />
        <Metric
          title="Utilidad + financiero"
          value={money(rentabilidadDiaria?.margen_real)}
          tone={Number(rentabilidadDiaria?.margen_real || 0) < 0 ? "danger" : "positive"}
        />
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: "grid", gap: 14, minWidth: 0 }}>
        <div>
          <p style={{ margin: 0, color: "#f97316", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
            De dónde viene la venta
          </p>
          <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Resumen por rubro</h2>
          <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
            Agrupa los mismos ítems del día para ver rápido cuánto aportó taller, bicicletas, accesorios, repuestos y mayorista.
          </p>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #eaecf0", borderRadius: 14 }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#475467", textAlign: "left", borderBottom: "1px solid #eaecf0", background: "#f8fafc" }}>
                <th style={th}>Rubro</th>
                <th style={{ ...th, textAlign: "right" }}>Ventas</th>
                <th style={{ ...th, textAlign: "right" }}>Vendido</th>
                <th style={{ ...th, textAlign: "right" }}>Costo</th>
                <th style={{ ...th, textAlign: "right" }}>Margen esperado</th>
                <th style={{ ...th, textAlign: "right" }}>Cobrado</th>
                <th style={{ ...th, textAlign: "right" }}>Capital</th>
                <th style={{ ...th, textAlign: "right" }}>Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: 18, color: "#667085", textAlign: "center" }}>
                    Calculando resumen...
                  </td>
                </tr>
              ) : resumenRubros.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: 18, color: "#667085", textAlign: "center" }}>
                    Sin ventas para agrupar en esta fecha.
                  </td>
                </tr>
              ) : (
                resumenRubros.map((grupo) => (
                  <tr key={grupo.clave} style={{ borderBottom: "1px solid #f2f4f7" }}>
                    <td style={{ ...td, minWidth: 220 }}>
                      <strong style={{ color: "#101828" }}>{grupo.nombre}</strong>
                      <div style={{ color: "#667085", marginTop: 2, lineHeight: 1.35 }}>{grupo.detalle}</div>
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <strong>{grupo.ventas_cantidad}</strong>
                      <div style={{ color: "#667085", marginTop: 2 }}>{grupo.items} ítem(s)</div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{money(grupo.venta_comercial)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(grupo.cmv_comercial)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{money(grupo.margen_esperado)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#2563eb", fontWeight: 900 }}>
                      {money(grupo.cobrado_comercial_reconocido)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <MoneyLine label="Recuperado" value={grupo.capital_recuperado} />
                      <MoneyLine label="Inmov." value={grupo.capital_inmovilizado} color="#b42318" />
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <MoneyLine label="Liberada" value={grupo.utilidad_liberada} strong color="#067647" />
                      <MoneyLine label="Pendiente" value={grupo.utilidad_pendiente} color="#b54708" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: "grid", gap: 14, minWidth: 0 }}>
        <div style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", gap: 12, alignItems: "end" }}>
          <div>
            <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
              Detalle completo del día
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Ventas e ítems</h2>
            <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
              Vista principal por venta. Abrí una operación para ver todos los productos y servicios incluidos.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: isMobile ? "stretch" : "flex-end" }}>
            <button
              type="button"
              onClick={() => setVista("venta")}
              style={{ ...(vista === "venta" ? primaryTinyButton : secondaryButton), width: isMobile ? "100%" : undefined }}
            >
              Por venta
            </button>
            <button
              type="button"
              onClick={() => setVista("item")}
              style={{ ...(vista === "item" ? primaryTinyButton : secondaryButton), width: isMobile ? "100%" : undefined }}
            >
              Por ítem
            </button>
            <button type="button" onClick={cargarRentabilidadDiaria} style={{ ...secondaryButton, width: isMobile ? "100%" : undefined }}>
              Actualizar
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #eaecf0", borderRadius: 14 }}>
          {vista === "venta" ? (
            <table style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#475467", textAlign: "left", borderBottom: "1px solid #eaecf0", background: "#f8fafc" }}>
                  <th style={th}>Venta</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Origen</th>
                  <th style={{ ...th, textAlign: "right" }}>Vendido</th>
                  <th style={{ ...th, textAlign: "right" }}>Costo</th>
                  <th style={{ ...th, textAlign: "right" }}>Margen</th>
                  <th style={th}>Cobro</th>
                  <th style={{ ...th, textAlign: "right" }}>Capital</th>
                  <th style={{ ...th, textAlign: "right" }}>Utilidad</th>
                  <th style={{ ...th, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                      Calculando lectura diaria...
                    </td>
                  </tr>
                ) : ventasAgrupadas.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                      No hay ventas para analizar en esta fecha.
                    </td>
                  </tr>
                ) : (
                  ventasAgrupadas.map((venta) => {
                    const abierta = ventasAbiertas.has(venta.id_venta);
                    return (
                      <Fragment key={venta.id_venta}>
                        <tr key={`venta-${venta.id_venta}`} style={{ borderBottom: abierta ? "0" : "1px solid #f2f4f7" }}>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>
                            <button type="button" onClick={() => toggleVenta(venta.id_venta)} style={expandButton}>
                              {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <strong>Venta #{venta.id_venta}</strong>
                            </button>
                            <div style={{ color: "#667085", marginTop: 2 }}>{fechaHora(venta.fecha)}</div>
                            <div style={{ color: "#667085", marginTop: 2 }}>
                              {venta.cantidad_items} ítem(s) · {venta.cantidad_unidades} unidad(es)
                            </div>
                          </td>
                          <td style={{ ...td, minWidth: 160, fontWeight: 750 }}>{venta.cliente_nombre}</td>
                          <td style={{ ...td, minWidth: 120 }}>
                            <strong style={{ textTransform: "capitalize" }}>{venta.origen}</strong>
                            <div style={{ color: "#667085", marginTop: 2 }}>{venta.estado_venta}</div>
                          </td>
                          <td style={{ ...td, textAlign: "right", minWidth: 110 }}>
                            <MoneyLine label="Venta" value={venta.venta_comercial} strong />
                          </td>
                          <td style={{ ...td, textAlign: "right", minWidth: 110 }}>
                            <MoneyLine label="CMV" value={venta.cmv_comercial} />
                          </td>
                          <td style={{ ...td, textAlign: "right", minWidth: 110 }}>
                            <MoneyLine label="Esperado" value={venta.margen_esperado} strong />
                          </td>
                          <td style={{ ...td, minWidth: 150 }}>
                            <div style={{ fontWeight: 850 }}>{venta.medios_pago_texto}</div>
                            <MoneyLine label="Cobrado" value={venta.cobrado_comercial_reconocido} strong color="#2563eb" />
                            <MoneyLine label="Pendiente" value={venta.saldo_pendiente} color="#b54708" />
                          </td>
                          <td style={{ ...td, textAlign: "right", minWidth: 125 }}>
                            <MoneyLine label="Recuperado" value={venta.capital_recuperado} />
                            <MoneyLine label="Inmov." value={venta.capital_inmovilizado} color="#b42318" />
                          </td>
                          <td style={{ ...td, textAlign: "right", minWidth: 125 }}>
                            <MoneyLine label="Liberada" value={venta.utilidad_liberada} strong color="#067647" />
                            <MoneyLine label="Pendiente" value={venta.utilidad_pendiente} color="#b54708" />
                            <MoneyLine label="+ financiero" value={venta.utilidad_mas_financiero} color={venta.utilidad_mas_financiero < 0 ? "#b42318" : "#067647"} />
                          </td>
                          <td style={{ ...td, textAlign: "right", minWidth: 130 }}>
                            <a href={`/ventas/${venta.id_venta}`} style={openSaleButton}>
                              Abrir venta <ExternalLink size={14} />
                            </a>
                          </td>
                        </tr>
                        {abierta ? (
                          <tr key={`detalle-${venta.id_venta}`} style={{ borderBottom: "1px solid #f2f4f7", background: "#fbfcfe" }}>
                            <td colSpan="10" style={{ padding: 12 }}>
                              <VentaItemsDetalle items={venta.items} onAudit={setDetalleAuditoria} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
          <table style={{ width: "100%", minWidth: 1480, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#475467", textAlign: "left", borderBottom: "1px solid #eaecf0", background: "#f8fafc" }}>
                <th style={th}>Venta</th>
                <th style={th}>Cliente</th>
                <th style={th}>Producto</th>
                <th style={th}>Medio</th>
                <th style={{ ...th, textAlign: "right" }}>Cant.</th>
                <th style={{ ...th, textAlign: "right" }}>Precio</th>
                <th style={{ ...th, textAlign: "right" }}>Ajustes</th>
                <th style={{ ...th, textAlign: "right" }}>Financiación</th>
                <th style={{ ...th, textAlign: "right" }}>Comercial</th>
                <th style={{ ...th, textAlign: "right" }}>Caja / capital</th>
                <th style={{ ...th, textAlign: "right" }}>Utilidad</th>
                <th style={{ ...th, textAlign: "right" }}>Utilidad + financiero</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                    Calculando lectura diaria...
                  </td>
                </tr>
              ) : detalles.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                    No hay productos ni servicios vendidos en esta fecha.
                  </td>
                </tr>
              ) : (
                detalles.map((detalle) => (
                  <tr
                    key={detalle.id_venta_item}
                    title="Doble click para ver auditoría completa"
                    onDoubleClick={() => setDetalleAuditoria(detalle)}
                    style={{
                      borderBottom: "1px solid #f2f4f7",
                      cursor: "zoom-in",
                    }}
                  >
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <strong>Venta #{detalle.id_venta}</strong>
                      <div style={{ color: "#667085", marginTop: 2 }}>{fechaHora(detalle.fecha)}</div>
                      <div style={{ color: "#667085", marginTop: 2 }}>{detalle.origen} · {detalle.estado_venta}</div>
                    </td>
                    <td style={{ ...td, minWidth: 150 }}>{detalle.cliente_nombre}</td>
                    <td style={{ ...td, minWidth: 300 }}>
                      <span style={detalle.tipo_item_grupo === "servicio_taller" ? serviceBadge : productBadge}>
                        {detalle.tipo_item_grupo === "servicio_taller" ? <Wrench size={13} /> : <Package size={13} />}
                        {detalle.tipo_item_grupo === "servicio_taller" ? "Servicio" : "Producto"}
                      </span>
                      <div style={{ marginTop: 6, fontWeight: 850, lineHeight: 1.25 }}>
                        {detalle.articulo_nombre || detalle.descripcion_snapshot}
                      </div>
                      {detalle.descripcion_snapshot && detalle.descripcion_snapshot !== detalle.articulo_nombre ? (
                        <div style={{ color: "#667085", marginTop: 2, fontWeight: 500 }}>{detalle.descripcion_snapshot}</div>
                      ) : null}
                    </td>
                    <td style={{ ...td, minWidth: 120 }}>{detalle.medios_pago}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {detalle.cantidad_neta}
                      {Number(detalle.cantidad_devuelta || 0) > 0 ? (
                        <div style={{ color: "#b42318", marginTop: 2 }}>Dev. {detalle.cantidad_devuelta}</div>
                      ) : null}
                    </td>
                    <td style={{ ...td, textAlign: "right", minWidth: 110 }}>
                      <MoneyLine label="Lista" value={detalle.precio_lista} />
                      <MoneyLine label="Aplicado" value={detalle.precio_final} strong />
                    </td>
                    <td style={{ ...td, textAlign: "right", minWidth: 110 }}>
                      <MoneyLine label="Bonif." value={detalle.bonificacion_total} />
                      <MoneyLine label="Desc." value={detalle.descuento_comercial_asignado} />
                      <MoneyLine label="Dev." value={detalle.devolucion_comercial} />
                    </td>
                    <td style={{ ...td, textAlign: "right", minWidth: 120 }}>
                      <MoneyLine label="Cobrada" value={detalle.financiacion_cobrada} color="#b54708" />
                      <MoneyLine label="Costo" value={detalle.costo_financiero} color="#b42318" />
                    </td>
                    <td style={{ ...td, textAlign: "right", minWidth: 120 }}>
                      <MoneyLine label="Ingreso" value={detalle.ingreso_comercial} strong />
                      <MoneyLine label="CMV" value={detalle.costo_total} />
                    </td>
                    <td style={{ ...td, textAlign: "right", minWidth: 120 }}>
                      <MoneyLine label="Cobrado" value={detalle.cobrado_comercial_reconocido} strong color="#2563eb" />
                      <MoneyLine label="Recuperado" value={detalle.capital_recuperado} />
                      <MoneyLine label="Inmov." value={detalle.capital_inmovilizado} color="#b42318" />
                    </td>
                    <td style={{ ...td, textAlign: "right", minWidth: 120 }}>
                      <MoneyLine label="Liberada" value={detalle.utilidad_liberada} strong color="#067647" />
                      <MoneyLine label="Pendiente" value={detalle.utilidad_pendiente} color="#b54708" />
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontWeight: 900,
                        color: Number(detalle.margen_real || 0) < 0 ? "#b42318" : "#067647",
                      }}
                    >
                      {money(detalle.margen_real)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>
      </section>

      {detalleAuditoria && (
        <AuditoriaDetalleModal
          detalle={detalleAuditoria}
          onClose={() => setDetalleAuditoria(null)}
        />
      )}
    </div>
  );
}

const th = {
  padding: "10px 8px",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
  whiteSpace: "nowrap",
  verticalAlign: "bottom",
};

const td = {
  padding: "10px 8px",
  verticalAlign: "top",
};

const expandButton = {
  border: 0,
  background: "transparent",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#101828",
  cursor: "pointer",
  font: "inherit",
};

const openSaleButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  padding: "8px 10px",
  background: "#fff",
  color: "#344054",
  fontWeight: 850,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function MoneyLine({ label, value, strong = false, color = "#101828" }) {
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

function VentaItemsDetalle({ items, onAudit }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <strong style={{ color: "#101828" }}>Detalle de productos y servicios</strong>
        <span style={{ color: "#667085", fontSize: 12, fontWeight: 800 }}>Doble click en un ítem para auditoría completa</span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #eaecf0", borderRadius: 12, background: "#fff" }}>
        <table style={{ width: "100%", minWidth: 940, borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#475467", textAlign: "left", borderBottom: "1px solid #eaecf0", background: "#f8fafc" }}>
              <th style={th}>Ítem</th>
              <th style={{ ...th, textAlign: "right" }}>Cant.</th>
              <th style={{ ...th, textAlign: "right" }}>Precio</th>
              <th style={{ ...th, textAlign: "right" }}>Comercial</th>
              <th style={{ ...th, textAlign: "right" }}>Caja / capital</th>
              <th style={{ ...th, textAlign: "right" }}>Utilidad</th>
            </tr>
          </thead>
          <tbody>
            {items.map((detalle) => (
              <tr
                key={detalle.id_venta_item}
                title="Doble click para ver auditoría completa"
                onDoubleClick={() => onAudit(detalle)}
                style={{ borderBottom: "1px solid #f2f4f7", cursor: "zoom-in" }}
              >
                <td style={{ ...td, minWidth: 300 }}>
                  <span style={detalle.tipo_item_grupo === "servicio_taller" ? serviceBadge : productBadge}>
                    {detalle.tipo_item_grupo === "servicio_taller" ? <Wrench size={13} /> : <Package size={13} />}
                    {detalle.tipo_item_grupo === "servicio_taller" ? "Servicio" : "Producto"}
                  </span>
                  <div style={{ marginTop: 6, fontWeight: 850, lineHeight: 1.25 }}>
                    {detalle.articulo_nombre || detalle.descripcion_snapshot}
                  </div>
                  {detalle.descripcion_snapshot && detalle.descripcion_snapshot !== detalle.articulo_nombre ? (
                    <div style={{ color: "#667085", marginTop: 2, fontWeight: 500 }}>{detalle.descripcion_snapshot}</div>
                  ) : null}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {detalle.cantidad_neta}
                  {Number(detalle.cantidad_devuelta || 0) > 0 ? (
                    <div style={{ color: "#b42318", marginTop: 2 }}>Dev. {detalle.cantidad_devuelta}</div>
                  ) : null}
                </td>
                <td style={{ ...td, textAlign: "right", minWidth: 110 }}>
                  <MoneyLine label="Lista" value={detalle.precio_lista} />
                  <MoneyLine label="Aplicado" value={detalle.precio_final} strong />
                </td>
                <td style={{ ...td, textAlign: "right", minWidth: 120 }}>
                  <MoneyLine label="Ingreso" value={detalle.ingreso_comercial} strong />
                  <MoneyLine label="CMV" value={detalle.costo_total} />
                  <MoneyLine label="Margen" value={detalle.margen_bruto} />
                </td>
                <td style={{ ...td, textAlign: "right", minWidth: 130 }}>
                  <MoneyLine label="Cobrado" value={detalle.cobrado_comercial_reconocido} strong color="#2563eb" />
                  <MoneyLine label="Recuperado" value={detalle.capital_recuperado} />
                  <MoneyLine label="Inmov." value={detalle.capital_inmovilizado} color="#b42318" />
                </td>
                <td style={{ ...td, textAlign: "right", minWidth: 130 }}>
                  <MoneyLine label="Liberada" value={detalle.utilidad_liberada} strong color="#067647" />
                  <MoneyLine label="Pendiente" value={detalle.utilidad_pendiente} color="#b54708" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditoriaDetalleModal({ detalle, onClose }) {
  const comercialRows = [
    ["Precio lista unitario", money(detalle.precio_lista)],
    ["Precio aplicado unitario", money(detalle.precio_final)],
    ["Cantidad original", detalle.cantidad],
    ["Cantidad devuelta", detalle.cantidad_devuelta],
    ["Cantidad neta", detalle.cantidad_neta],
    ["Ingreso comercial", money(detalle.ingreso_comercial)],
    ["CMV comercial", money(detalle.costo_total)],
    ["Margen comercial", money(detalle.margen_bruto)],
  ];

  const cobroRows = [
    ["Medio/s de pago", detalle.medios_pago],
    ["Cobrado comercial reconocido", money(detalle.cobrado_comercial_reconocido)],
    ["Capital recuperado", money(detalle.capital_recuperado)],
    ["Capital inmovilizado", money(detalle.capital_inmovilizado)],
    ["Utilidad liberada", money(detalle.utilidad_liberada)],
    ["Utilidad pendiente", money(detalle.utilidad_pendiente)],
    ["Utilidad + financiero", money(detalle.margen_real)],
  ];

  const ajusteRows = [
    ["Bonificación", money(detalle.bonificacion_total)],
    ["Descuento comercial asignado", money(detalle.descuento_comercial_asignado)],
    ["Financiación excluida", money(detalle.financiacion_excluida)],
    ["Financiación cobrada", money(detalle.financiacion_cobrada)],
    ["Costo financiero", money(detalle.costo_financiero)],
    ["Devolución comercial", money(detalle.devolucion_comercial)],
    ["Ingreso neto liquidado asignado", money(detalle.ingreso_real_neto)],
    ["Base prorrateada", money(detalle.venta_cobrada)],
    ["CMV prorrateado", money(detalle.costo_cobrado)],
    ["Margen prorrateado", money(detalle.margen_cobrado)],
    ["Margen prorrateado pendiente", money(detalle.margen_pendiente)],
  ];

  const tecnicoRows = [
    ["ID venta item", detalle.id_venta_item],
    ["ID venta", detalle.id_venta],
    ["Fecha", fechaHora(detalle.fecha)],
    ["Cliente", detalle.cliente_nombre],
    ["Origen", detalle.origen],
    ["Estado venta", detalle.estado_venta],
    ["Tipo item", detalle.tipo_item],
    ["ID variante", detalle.id_variante || "-"],
    ["ID servicio taller", detalle.id_servicio_taller || "-"],
  ];

  return (
    <div style={modalOverlay} onClick={onClose}>
      <section style={modalCard} onClick={(event) => event.stopPropagation()}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            borderBottom: "1px solid #eaecf0",
            paddingBottom: 14,
          }}
        >
          <div>
            <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
              Auditoría de rentabilidad
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#101828" }}>
              Venta #{detalle.id_venta} · Ítem #{detalle.id_venta_item}
            </h2>
            <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.45 }}>
              {detalle.articulo_nombre || detalle.descripcion_snapshot}
            </p>
          </div>
          <button type="button" onClick={onClose} style={closeButton} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <AuditSection title="Comercial" rows={comercialRows} />
          <AuditSection title="Caja y capital" rows={cobroRows} highlight />
          <AuditSection title="Auditoría técnica" rows={ajusteRows} />
          <AuditSection title="Datos técnicos" rows={tecnicoRows} />
        </div>

        <div style={{ ...auditBox, display: "grid", gap: 6 }}>
          <strong>Descripción snapshot</strong>
          <span style={{ color: "#475467", lineHeight: 1.45 }}>
            {detalle.descripcion_snapshot || "-"}
          </span>
        </div>
      </section>
    </div>
  );
}

function AuditSection({ title, rows, highlight = false }) {
  return (
    <div style={{ ...auditBox, background: highlight ? "#ecfdf3" : "#fff" }}>
      <h3 style={{ margin: "0 0 10px", color: "#101828", fontSize: 16 }}>{title}</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #f2f4f7", paddingBottom: 6 }}>
            <span style={{ color: "#667085", fontSize: 12, fontWeight: 800 }}>{label}</span>
            <strong style={{ color: "#101828", textAlign: "right" }}>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const modalOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 70,
  background: "rgba(15, 23, 42, 0.58)",
  display: "grid",
  placeItems: "center",
  padding: 18,
};

const modalCard = {
  width: "min(1040px, 100%)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 24px 70px rgba(15,23,42,.28)",
  padding: 18,
  display: "grid",
  gap: 14,
};

const closeButton = {
  border: "1px solid #d0d5dd",
  background: "#fff",
  borderRadius: 12,
  width: 40,
  height: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const auditBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 8px 22px rgba(15,23,42,.05)",
};

function Metric({ title, value, tone = "default" }) {
  const tones = {
    default: { background: "#fff", border: "#e5e7eb", color: "#101828" },
    cost: { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    danger: { background: "#fef2f2", border: "#fecaca", color: "#b42318" },
    positive: { background: "#ecfdf3", border: "#abefc6", color: "#067647" },
  };
  const selected = tones[tone] || tones.default;

  return (
    <div
      style={{
        border: `1px solid ${selected.border}`,
        borderRadius: 16,
        padding: 14,
        background: selected.background,
        minWidth: 0,
        boxShadow: "0 10px 28px rgba(15,23,42,.06)",
      }}
    >
      <div style={{ color: "#667085", fontSize: 12, fontWeight: 850 }}>{title}</div>
      <div style={{ color: selected.color, fontSize: 19, fontWeight: 950, marginTop: 5 }}>{value}</div>
    </div>
  );
}
