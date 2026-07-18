import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Copy, Eye, PlayCircle, Plus, RefreshCw } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { colors, radius, shadows, spacing } from "../theme";
import { formatMoney, formatPercent } from "../utils/formatters";
import {
  crearConfiguracionArmado,
  crearVersionArmado,
  duplicarConfiguracionArmado,
  listarSucursalesArmado,
  obtenerModeloArmadoDetalle,
} from "../services/armadoService";
import { listarCatalogoPOS } from "../services/catalogoService";

export default function ArmadoModeloDetallePage() {
  const { modeloId } = useParams();
  const [detalle, setDetalle] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busquedaVarianteFinal, setBusquedaVarianteFinal] = useState("");
  const [variantesFinales, setVariantesFinales] = useState([]);
  const [buscandoVarianteFinal, setBuscandoVarianteFinal] = useState(false);
  const [varianteFinalSeleccionada, setVarianteFinalSeleccionada] = useState(null);
  const [versionForm, setVersionForm] = useState({
    nombre: "",
    descripcion: "",
    id_variante_final: "",
  });

  async function cargar(idSucursal = sucursalId) {
    setLoading(true);
    setError("");
    try {
      const [detalleData, sucursalesData] = await Promise.all([
        obtenerModeloArmadoDetalle(modeloId, idSucursal ? { id_sucursal: idSucursal } : {}),
        listarSucursalesArmado(),
      ]);
      setDetalle(detalleData);
      setSucursales(sucursalesData);
      if (!idSucursal && sucursalesData[0]?.id) setSucursalId(String(sucursalesData[0].id));
    } catch (err) {
      setError(err.message || "No se pudo cargar el modelo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [modeloId]);

  useEffect(() => {
    if (sucursalId) cargar(sucursalId);
  }, [sucursalId]);

  useEffect(() => {
    if (!sucursalId) return;
    let cancelado = false;
    const timer = setTimeout(async () => {
      setBuscandoVarianteFinal(true);
      try {
        const data = await listarCatalogoPOS({
          id_sucursal: sucursalId,
          query: busquedaVarianteFinal,
          limit: 20,
        });
        if (cancelado) return;
        const items = Array.isArray(data) ? data : data?.items || [];
        setVariantesFinales(
          items.filter((item) => {
            const serializable = item.serializable === true;
            const vendible = item.stockeable === true && item.tipo_item === "producto";
            const productoActivo = item.producto_activo !== false;
            const varianteActiva = item.variante_activa !== false && item.activo !== false;
            return serializable && vendible && productoActivo && varianteActiva;
          }),
        );
      } catch (err) {
        if (!cancelado) setVariantesFinales([]);
      } finally {
        if (!cancelado) setBuscandoVarianteFinal(false);
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [sucursalId, busquedaVarianteFinal]);

  async function crearConfig(version) {
    try {
      const nueva = await crearConfiguracionArmado({
        id_version: version.id,
        nombre: `CONFIGURACION ${version.nombre}`,
      });
      window.location.href = `/armado/configuraciones/${nueva.id}`;
    } catch (err) {
      setError(err.message || "No se pudo crear la configuracion");
    }
  }

  async function duplicarConfig(version) {
    if (!version.configuracion_activa_id) return;
    try {
      const nueva = await duplicarConfiguracionArmado(version.configuracion_activa_id, {
        nombre: `${version.nombre} COPIA`,
      });
      window.location.href = `/armado/configuraciones/${nueva.id}`;
    } catch (err) {
      setError(err.message || "No se pudo duplicar la configuracion");
    }
  }

  async function crearVersion(event) {
    event.preventDefault();
    if (!versionForm.nombre.trim() || !versionForm.id_variante_final) return;
    try {
      await crearVersionArmado({
        id_modelo: Number(modeloId),
        nombre: versionForm.nombre,
        descripcion: versionForm.descripcion || null,
        id_variante_final: Number(versionForm.id_variante_final),
      });
      setVersionForm({ nombre: "", descripcion: "", id_variante_final: "" });
      setVarianteFinalSeleccionada(null);
      setBusquedaVarianteFinal("");
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo crear la version");
    }
  }

  const modelo = detalle?.modelo;
  const versiones = detalle?.versiones || [];

  return (
    <div>
      <PageHeader
        title={modelo?.nombre || "Modelo de armado"}
        subtitle={modelo?.descripcion || "Versiones comerciales y configuraciones activas."}
        actions={
          <>
            <select
              value={sucursalId}
              onChange={(event) => setSucursalId(event.target.value)}
              style={styles.select}
            >
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => cargar()}>
              <RefreshCw size={16} /> Refrescar
            </Button>
          </>
        }
      />

      {error ? <div style={styles.error}>{error}</div> : null}
      {loading ? <div style={styles.empty}>Cargando modelo...</div> : null}

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <div style={styles.eyebrow}>Versiones</div>
            <h2 style={styles.title}>Configuraciones comerciales</h2>
          </div>
        </div>

        <form onSubmit={crearVersion} style={styles.versionForm}>
          <input
            value={versionForm.nombre}
            onChange={(event) => setVersionForm((prev) => ({ ...prev, nombre: event.target.value }))}
            placeholder="Nombre version: Economica, Pro..."
            style={styles.input}
          />
          <div style={styles.variantPicker}>
            <input
              value={
                varianteFinalSeleccionada
                  ? descripcionVarianteFinal(varianteFinalSeleccionada)
                  : busquedaVarianteFinal
              }
              onChange={(event) => {
                setVarianteFinalSeleccionada(null);
                setVersionForm((prev) => ({ ...prev, id_variante_final: "" }));
                setBusquedaVarianteFinal(event.target.value);
              }}
              placeholder="Buscar bicicleta final por nombre, SKU o codigo"
              style={styles.input}
            />
            {varianteFinalSeleccionada ? (
              <button
                type="button"
                style={styles.clearVariantButton}
                onClick={() => {
                  setVarianteFinalSeleccionada(null);
                  setVersionForm((prev) => ({ ...prev, id_variante_final: "" }));
                  setBusquedaVarianteFinal("");
                }}
              >
                Cambiar
              </button>
            ) : null}
            {!varianteFinalSeleccionada ? (
              <div style={styles.variantResults}>
                {buscandoVarianteFinal ? (
                  <div style={styles.variantEmpty}>Buscando bicicletas serializables...</div>
                ) : variantesFinales.length === 0 ? (
                  <div style={styles.variantEmpty}>
                    {busquedaVarianteFinal.trim()
                      ? "No encontré bicicletas serializables activas para esa búsqueda."
                      : "No hay bicicletas serializables activas disponibles para elegir."}
                  </div>
                ) : (
                  variantesFinales.slice(0, 8).map((item) => (
                    <button
                      key={item.id_variante}
                      type="button"
                      style={styles.variantOption}
                      onClick={() => {
                        setVarianteFinalSeleccionada(item);
                        setVersionForm((prev) => ({ ...prev, id_variante_final: String(item.id_variante) }));
                        setBusquedaVarianteFinal("");
                      }}
                    >
                      <strong>{item.producto_nombre}</strong>
                      <span>{item.nombre_variante} · SKU {item.sku || "-"} · Código {item.codigo_barras || item.codigo_proveedor || "-"}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <input
            value={versionForm.descripcion}
            onChange={(event) => setVersionForm((prev) => ({ ...prev, descripcion: event.target.value }))}
            placeholder="Descripcion opcional"
            style={styles.input}
          />
          <button type="submit" style={styles.linkButton}>
            <Plus size={15} /> Crear version
          </button>
        </form>

        <div style={styles.versionGrid}>
          {versiones.map((version) => (
            <article key={version.id} style={styles.versionCard}>
              <div style={styles.cardTop}>
                <div>
                  <h3 style={styles.versionTitle}>{version.nombre}</h3>
                  <p style={styles.muted}>
                    {version.producto_final_nombre} · {version.variante_final_nombre}
                  </p>
                </div>
                <span style={version.activo ? styles.badgeOk : styles.badgeMuted}>
                  {version.activo ? "Activa" : "Inactiva"}
                </span>
              </div>

              <div style={styles.metrics}>
                <Metric label="Costo activo" value={version.costo_estimado ? formatMoney(version.costo_estimado) : "-"} />
                <Metric label="Precio objetivo" value={version.precio_objetivo ? formatMoney(version.precio_objetivo) : "-"} />
                <Metric label="Margen" value={version.margen_estimado ? formatPercent(version.margen_estimado) : "-"} />
                <Metric label="Fabricables" value={version.cantidad_fabricable_estimada ?? "-"} />
              </div>

              <div style={styles.actions}>
                {version.configuracion_activa_id ? (
                  <>
                    <Link to={`/armado/configuraciones/${version.configuracion_activa_id}`} style={styles.linkButton}>
                      <Eye size={15} /> Ver activa
                    </Link>
                    <Link to={`/armado/configuraciones/${version.configuracion_activa_id}/simular`} style={styles.softLink}>
                      <PlayCircle size={15} /> Simular
                    </Link>
                    <button type="button" style={styles.softButton} onClick={() => duplicarConfig(version)}>
                      <Copy size={15} /> Duplicar
                    </button>
                  </>
                ) : (
                  <button type="button" style={styles.linkButton} onClick={() => crearConfig(version)}>
                    <Plus size={15} /> Crear configuracion
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function descripcionVarianteFinal(item) {
  if (!item) return "";
  const variante = item.nombre_variante ? ` - ${item.nombre_variante}` : "";
  return `${item.producto_nombre || "Producto"}${variante}`;
}

const styles = {
  select: {
    minHeight: 42,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "8px 12px",
    fontWeight: 800,
    background: "#fff",
  },
  panel: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    padding: spacing.lg,
  },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  eyebrow: { color: colors.primary, fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  title: { margin: "4px 0 14px", fontSize: 22, color: colors.textStrong },
  versionGrid: { display: "grid", gap: 12 },
  versionForm: {
    display: "grid",
    gridTemplateColumns: "1fr 1.7fr 1fr auto",
    gap: 8,
    alignItems: "center",
    padding: 12,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.md,
    background: colors.surfaceMuted,
    marginBottom: 14,
  },
  input: {
    minHeight: 38,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    padding: "8px 10px",
    fontWeight: 800,
  },
  variantPicker: {
    position: "relative",
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  clearVariantButton: {
    position: "absolute",
    right: 6,
    top: 5,
    minHeight: 28,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    background: colors.surface,
    color: colors.textStrong,
    fontWeight: 900,
    cursor: "pointer",
    padding: "4px 8px",
  },
  variantResults: {
    position: "absolute",
    zIndex: 20,
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    maxHeight: 280,
    overflowY: "auto",
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    boxShadow: shadows.md,
    padding: 6,
  },
  variantOption: {
    width: "100%",
    display: "grid",
    gap: 3,
    textAlign: "left",
    border: "none",
    borderRadius: radius.sm,
    background: "transparent",
    padding: "9px 10px",
    cursor: "pointer",
    color: colors.textStrong,
    fontWeight: 800,
  },
  variantEmpty: {
    padding: "10px 12px",
    color: colors.textMuted,
    fontWeight: 800,
    fontSize: 13,
  },
  versionCard: { border: `1px solid ${colors.borderSoft}`, borderRadius: radius.md, padding: 14, background: "#fff" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  versionTitle: { margin: 0, fontSize: 18 },
  muted: { margin: "4px 0 0", color: colors.textMuted, fontSize: 13 },
  metrics: { display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 8, marginTop: 12 },
  metric: { background: colors.surfaceMuted, borderRadius: radius.sm, padding: 10, display: "grid", gap: 4 },
  actions: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  linkButton: buttonLike(colors.primary, "#fff"),
  softLink: buttonLike("#fff", colors.textStrong, colors.border),
  softButton: { ...buttonLike("#fff", colors.textStrong, colors.border), cursor: "pointer" },
  badgeOk: { ...badgeBase(), background: colors.successSoft, color: colors.successDark },
  badgeMuted: { ...badgeBase(), background: colors.surfaceSubtle, color: colors.textMuted },
  error: { marginBottom: 14, padding: 12, borderRadius: radius.md, background: colors.dangerSoft, color: colors.dangerDark, fontWeight: 800 },
  empty: { padding: 18, background: colors.surfaceMuted, borderRadius: radius.md, color: colors.textMuted, fontWeight: 800 },
};

function buttonLike(background, color, border = "transparent") {
  return {
    minHeight: 38,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "8px 12px",
    borderRadius: radius.md,
    background,
    color,
    border: `1px solid ${border}`,
    textDecoration: "none",
    fontWeight: 900,
  };
}

function badgeBase() {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
  };
}
