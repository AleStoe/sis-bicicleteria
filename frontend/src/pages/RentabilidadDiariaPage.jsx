import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Package, Wrench } from "lucide-react";
import { getRentabilidadDiaria } from "../services/rentabilidadService";
import { formatMoney, formatPercent } from "../utils/formatters";
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
            Vista completa del día, venta por venta e ítem por ítem. No está agrupada como el panel mensual.
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
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(9, minmax(0, 1fr))",
          gap: isMobile ? 8 : 12,
          minWidth: 0,
        }}
      >
        <Metric title="Ventas" value={String(rentabilidadDiaria?.cantidad_ventas || 0)} />
        <Metric title="Ítems" value={String(detalles.length)} />
        <Metric title="Ventas netas" value={money(rentabilidadDiaria?.ventas_netas)} />
        <Metric title="Ingreso real neto" value={money(rentabilidadDiaria?.ingreso_real_neto)} />
        <Metric title="Financiación cobrada" value={money(rentabilidadDiaria?.financiacion_cobrada)} />
        <Metric title="Costo financiero" value={money(rentabilidadDiaria?.costos_financieros)} tone="danger" />
        <Metric title="CMV" value={money(rentabilidadDiaria?.cmv)} tone="cost" />
        <Metric
          title="Margen real"
          value={money(rentabilidadDiaria?.margen_real)}
          tone={Number(rentabilidadDiaria?.margen_real || 0) < 0 ? "danger" : "positive"}
        />
        <Metric title="Margen" value={formatPercent(rentabilidadDiaria?.margen_porcentaje || 0)} />
      </section>

      <section style={{ ...card, padding: isMobile ? 12 : 18, display: "grid", gap: 14, minWidth: 0 }}>
        <div style={{ display: isMobile ? "grid" : "flex", justifyContent: "space-between", gap: 12, alignItems: "end" }}>
          <div>
            <p style={{ margin: 0, color: "#2563eb", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
              Detalle completo del día
            </p>
            <h2 style={{ margin: "4px 0 0", color: "#101828" }}>Ventas e ítems</h2>
            <p style={{ margin: "5px 0 0", color: "#667085", lineHeight: 1.45 }}>
              Esta tabla muestra cada línea vendida. Acá deberían aparecer más registros que en el resumen agrupado por producto.
            </p>
          </div>
          <button type="button" onClick={cargarRentabilidadDiaria} style={{ ...secondaryButton, width: isMobile ? "100%" : undefined }}>
            Actualizar
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1780, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                <th style={{ padding: 8 }}>Venta / Fecha</th>
                <th style={{ padding: 8 }}>Cliente</th>
                <th style={{ padding: 8 }}>Origen / Estado</th>
                <th style={{ padding: 8 }}>Tipo</th>
                <th style={{ padding: 8 }}>Producto</th>
                <th style={{ padding: 8 }}>Medio</th>
                <th style={{ padding: 8, textAlign: "right" }}>Cant.</th>
                <th style={{ padding: 8, textAlign: "right" }}>Lista</th>
                <th style={{ padding: 8, textAlign: "right" }}>Aplicado</th>
                <th style={{ padding: 8, textAlign: "right" }}>Bonif.</th>
                <th style={{ padding: 8, textAlign: "right" }}>Desc.</th>
                <th style={{ padding: 8, textAlign: "right" }}>Financ.</th>
                <th style={{ padding: 8, textAlign: "right" }}>Costo fin.</th>
                <th style={{ padding: 8, textAlign: "right" }}>Dev.</th>
                <th style={{ padding: 8, textAlign: "right" }}>Ingreso</th>
                <th style={{ padding: 8, textAlign: "right" }}>Costo</th>
                <th style={{ padding: 8, textAlign: "right" }}>Margen real</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="17" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                    Calculando lectura diaria...
                  </td>
                </tr>
              ) : detalles.length === 0 ? (
                <tr>
                  <td colSpan="17" style={{ padding: 22, color: "#667085", textAlign: "center" }}>
                    No hay productos ni servicios vendidos en esta fecha.
                  </td>
                </tr>
              ) : (
                detalles.map((detalle) => (
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
                    <td style={{ padding: 8 }}>
                      <span style={detalle.tipo_item_grupo === "servicio_taller" ? serviceBadge : productBadge}>
                        {detalle.tipo_item_grupo === "servicio_taller" ? <Wrench size={13} /> : <Package size={13} />}
                        {detalle.tipo_item_grupo === "servicio_taller" ? "Servicio" : "Producto"}
                      </span>
                    </td>
                    <td style={{ padding: 8, minWidth: 230, fontWeight: 850 }}>
                      {detalle.articulo_nombre || detalle.descripcion_snapshot}
                      {detalle.descripcion_snapshot && detalle.descripcion_snapshot !== detalle.articulo_nombre ? (
                        <div style={{ color: "#667085", marginTop: 2, fontWeight: 500 }}>{detalle.descripcion_snapshot}</div>
                      ) : null}
                    </td>
                    <td style={{ padding: 8, minWidth: 130 }}>{detalle.medios_pago}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      {detalle.cantidad_neta}
                      {Number(detalle.cantidad_devuelta || 0) > 0 ? (
                        <div style={{ color: "#b42318", marginTop: 2 }}>Dev. {detalle.cantidad_devuelta}</div>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

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
