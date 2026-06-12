import { useEffect, useMemo, useRef, useState } from "react";
import { listarCatalogoPOS } from "../services/catalogoService";
import { listarProveedores } from "../services/proveedoresService";
import RecalculoMasivoPanel from "../components/precios/RecalculoMasivoPanel";
import PrecioManualPanel from "../components/precios/PrecioManualPanel";
import ReglasPrecioPanel from "../components/precios/ReglasPrecioPanel";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import {
  buildRecalculoProveedorPayload,
  buildReglaPrecioPayload,
} from "../builders/preciosPayloadBuilder";
import {
  calcularMargen,
  calcularResumenMasivo,
} from "../utils/preciosUtils";
import {
  actualizarPrecioVariante,
  crearReglaPrecio,
  desactivarReglaPrecio,
  listarFamiliasPrecio,
  listarPreciosDesfasados,
  listarReglasPrecio,
  obtenerHistorialPrecioVariante,
  obtenerPrecioVariante,
  recalcularPreciosProveedor,
  sugerirPrecioVariante,
} from "../services/preciosService";
import { useSession } from "../context/SessionContext";

export default function PreciosPage() {
  const buscarRef = useRef(null);

  const [tab, setTab] = useState("manual");
  const { usuarioId, sucursalId } = useSession();

  const [proveedores, setProveedores] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [reglas, setReglas] = useState([]);

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState(null);
  const [historial, setHistorial] = useState([]);

  const [tipoSugerencia, setTipoSugerencia] = useState("minorista");
  const [sugerencia, setSugerencia] = useState(null);

  const [formPrecio, setFormPrecio] = useState({
    precio_minorista: "",
    precio_mayorista: "",
    motivo: "Actualización manual de precio",
  });

  const [idProveedor, setIdProveedor] = useState("");
  const [tipoCliente, setTipoCliente] = useState("minorista");
  const [desfasados, setDesfasados] = useState([]);
  const [preview, setPreview] = useState(null);
  const [motivoMasivo, setMotivoMasivo] = useState(
    "Ajuste por actualización de proveedor"
  );

  const [reglaForm, setReglaForm] = useState({
    nombre: "",
    tipo_cliente: "minorista",
    id_categoria: "",
    id_marca: "",
    id_familia_precio: "",
    id_proveedor: "",
    margen_porcentaje: "130",
    descuento_base_porcentaje: "10",
    margen_minimo_porcentaje: "100",
    redondeo_base: "500",
  });

  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [confirmConfig, setConfirmConfig] = useState(null);

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
    cargarInicial();
    setTimeout(() => buscarRef.current?.focus(), 100);
  }, []);

  async function cargarInicial() {
    try {
      setError("");

      const [provs, reglasData, familiasData] = await Promise.all([
        listarProveedores({ solo_activos: true }),
        listarReglasPrecio({ solo_activas: false }),
        listarFamiliasPrecio(),
      ]);

      setProveedores(provs || []);
      setReglas(reglasData || []);
      setFamilias(familiasData || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar datos iniciales");
    }
  }

  async function buscarVariantes(e) {
    e?.preventDefault();

    if (!query.trim()) {
      setError("Ingresá producto, SKU, EAN o código proveedor");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMensaje("");
      setVarianteSeleccionada(null);
      setHistorial([]);
      setSugerencia(null);

      const data = await listarCatalogoPOS({
        id_sucursal: sucursalId,
        query: query.trim(),
        limit: 20,
        offset: 0,
      });

      const items = Array.isArray(data) ? data : data?.items || [];
      setResultados(items);

      if (items.length === 1) {
        await seleccionarVariante(items[0]);
      }

      if (items.length === 0) {
        setMensaje("No se encontraron variantes.");
      }
    } catch (err) {
      setError(err.message || "No se pudo buscar la variante");
    } finally {
      setLoading(false);
    }
  }

  async function seleccionarVariante(item) {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      setSugerencia(null);

      const [precio, historialData] = await Promise.all([
        obtenerPrecioVariante(item.id_variante),
        obtenerHistorialPrecioVariante(item.id_variante),
      ]);

      setVarianteSeleccionada(precio);
      setHistorial(historialData?.movimientos || []);

      setFormPrecio({
        precio_minorista: String(precio.precio_minorista ?? "0"),
        precio_mayorista: String(precio.precio_mayorista ?? "0"),
        motivo: "Actualización manual de precio",
      });
    } catch (err) {
      setError(err.message || "No se pudo cargar el precio de la variante");
    } finally {
      setProcesando(false);
    }
  }

  async function guardarPrecioManual(e) {
    e.preventDefault();

    if (!varianteSeleccionada) {
      setError("Seleccioná una variante");
      return;
    }

    if (!formPrecio.motivo.trim() || formPrecio.motivo.trim().length < 3) {
      setError("El motivo es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await actualizarPrecioVariante(varianteSeleccionada.id, {
        precio_minorista: formPrecio.precio_minorista,
        precio_mayorista: formPrecio.precio_mayorista,
        motivo: formPrecio.motivo.trim(),
        id_usuario: usuarioId,
        tipo_movimiento: "actualizacion_manual",
        origen_tipo: "precios_page",
        origen_id: null,
      });

      setMensaje("Precio actualizado correctamente.");

      const actualizado = await obtenerPrecioVariante(varianteSeleccionada.id);
      const historialData = await obtenerHistorialPrecioVariante(
        varianteSeleccionada.id
      );

      setVarianteSeleccionada(actualizado);
      setHistorial(historialData?.movimientos || []);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el precio");
    } finally {
      setProcesando(false);
    }
  }

  async function calcularSugerencia() {
    if (!varianteSeleccionada) {
      setError("Seleccioná una variante");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const data = await sugerirPrecioVariante(varianteSeleccionada.id, {
        tipo_cliente: tipoSugerencia,
      });

      setSugerencia(data);
    } catch (err) {
      setError(err.message || "No se pudo calcular sugerencia");
    } finally {
      setProcesando(false);
    }
  }

  function usarSugerencia() {
    if (!sugerencia) return;

    if (sugerencia.tipo_cliente === "minorista") {
      setFormPrecio((p) => ({
        ...p,
        precio_minorista: String(sugerencia.precio_sugerido),
      }));
    } else {
      setFormPrecio((p) => ({
        ...p,
        precio_mayorista: String(sugerencia.precio_sugerido),
      }));
    }
  }

  async function buscarDesfasados() {
    if (!idProveedor) {
      setError("Seleccioná un proveedor");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMensaje("");
      setPreview(null);

      const data = await listarPreciosDesfasados({
        tipo_cliente: tipoCliente,
        id_proveedor: idProveedor,
      });

      setDesfasados(data?.items || []);

      if ((data?.total || 0) === 0) {
        setMensaje("No hay precios desfasados para este proveedor");
      }
    } catch (err) {
      setError(err.message || "Error al buscar precios desfasados");
    } finally {
      setLoading(false);
    }
  }

  async function generarPreview() {
    if (!idProveedor) {
      setError("Seleccioná un proveedor");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const data = await recalcularPreciosProveedor(
        buildRecalculoProveedorPayload({
          idProveedor,
          tipoCliente,
          aplicar: false,
        })
      );

      setPreview(data);
      setDesfasados(data?.items || []);

      if ((data?.total_detectados || 0) === 0) {
        setMensaje("No hay cambios para aplicar");
      }
    } catch (err) {
      setError(err.message || "Error al generar preview");
    } finally {
      setProcesando(false);
    }
  }

  async function aplicarCambios() {
    if (!preview || preview.total_detectados === 0) {
      setError("Primero generá un preview con cambios");
      return;
    }

    const confirmado = await pedirConfirmacion({
      title: "Aplicar cambios de precio",
      message: "¿Aplicar cambios de precio al proveedor seleccionado?",
      confirmText: "Aplicar cambios",
      cancelText: "Cancelar",
      variant: "warning",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const data = await recalcularPreciosProveedor(
        buildRecalculoProveedorPayload({
          idProveedor,
          tipoCliente,
          aplicar: true,
          usuarioId,
          motivo: motivoMasivo,
        })
      );

      setPreview(data);
      setDesfasados(data?.items || []);
      setMensaje(`Cambios aplicados: ${data.total_aplicados}`);

      await buscarDesfasados();
    } catch (err) {
      setError(err.message || "Error al aplicar cambios");
    } finally {
      setProcesando(false);
    }
  }

  async function crearRegla(e) {
    e.preventDefault();

    if (!reglaForm.nombre.trim()) {
      setError("El nombre de la regla es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await crearReglaPrecio(buildReglaPrecioPayload(reglaForm));

      setMensaje("Regla creada correctamente.");
      setReglaForm((p) => ({
        ...p,
        nombre: "",
      }));

      const reglasData = await listarReglasPrecio({ solo_activas: false });
      setReglas(reglasData || []);
    } catch (err) {
      setError(err.message || "No se pudo crear la regla");
    } finally {
      setProcesando(false);
    }
  }

  async function desactivarRegla(reglaId) {
    const confirmado = await pedirConfirmacion({
      title: "Desactivar regla de precio",
      message: "¿Desactivar esta regla de precio?",
      confirmText: "Desactivar",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await desactivarReglaPrecio(reglaId, { id_usuario: usuarioId });

      setMensaje("Regla desactivada.");
      const reglasData = await listarReglasPrecio({ solo_activas: false });
      setReglas(reglasData || []);
    } catch (err) {
      setError(err.message || "No se pudo desactivar la regla");
    } finally {
      setProcesando(false);
    }
  }

  const resumenMasivo = useMemo(
    () => calcularResumenMasivo(desfasados),
    [desfasados]
  );

  const margenMinorista = calcularMargen(
    varianteSeleccionada?.costo_promedio_vigente,
    varianteSeleccionada?.precio_minorista
  );

  const margenMayorista = calcularMargen(
    varianteSeleccionada?.costo_promedio_vigente,
    varianteSeleccionada?.precio_mayorista
  );

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Precios</h1>
          <p style={styles.subtitle}>
            Edición puntual, sugerencias, historial, reglas y recalculo masivo.
          </p>
        </div>
      </header>

      {error && <div style={styles.error}>Error: {error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <div style={styles.tabs}>
        <button
          type="button"
          style={tab === "manual" ? styles.tabActive : styles.tab}
          onClick={() => setTab("manual")}
        >
          Precio puntual
        </button>
        <button
          type="button"
          style={tab === "masivo" ? styles.tabActive : styles.tab}
          onClick={() => setTab("masivo")}
        >
          Desfasados / masivo
        </button>
        <button
          type="button"
          style={tab === "reglas" ? styles.tabActive : styles.tab}
          onClick={() => setTab("reglas")}
        >
          Reglas
        </button>
      </div>

      {tab === "manual" && (
        <PrecioManualPanel
          buscarRef={buscarRef}
          query={query}
          setQuery={setQuery}
          loading={loading}
          procesando={procesando}
          resultados={resultados}
          seleccionarVariante={seleccionarVariante}
          buscarVariantes={buscarVariantes}
          varianteSeleccionada={varianteSeleccionada}
          margenMinorista={margenMinorista}
          margenMayorista={margenMayorista}
          formPrecio={formPrecio}
          setFormPrecio={setFormPrecio}
          guardarPrecioManual={guardarPrecioManual}
          tipoSugerencia={tipoSugerencia}
          setTipoSugerencia={setTipoSugerencia}
          calcularSugerencia={calcularSugerencia}
          usarSugerencia={usarSugerencia}
          sugerencia={sugerencia}
          historial={historial}
          styles={styles}
          InfoBox={InfoBox}
        />
      )}

      {tab === "masivo" && (
        <RecalculoMasivoPanel
          proveedores={proveedores}
          idProveedor={idProveedor}
          setIdProveedor={setIdProveedor}
          tipoCliente={tipoCliente}
          setTipoCliente={setTipoCliente}
          motivoMasivo={motivoMasivo}
          setMotivoMasivo={setMotivoMasivo}
          loading={loading}
          procesando={procesando}
          buscarDesfasados={buscarDesfasados}
          generarPreview={generarPreview}
          aplicarCambios={aplicarCambios}
          resumenMasivo={resumenMasivo}
          preview={preview}
          desfasados={desfasados}
          setPreview={setPreview}
          setDesfasados={setDesfasados}
          styles={styles}
          InfoBox={InfoBox}
        />
      )}

      {tab === "reglas" && (
        <ReglasPrecioPanel
          reglaForm={reglaForm}
          setReglaForm={setReglaForm}
          reglas={reglas}
          familias={familias}
          proveedores={proveedores}
          crearRegla={crearRegla}
          desactivarRegla={desactivarRegla}
          cargarInicial={cargarInicial}
          procesando={procesando}
          styles={styles}
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
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    padding: "24px",
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  header: {
    marginBottom: "18px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#667085",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  tab: {
    border: "1px solid #d0d5dd",
    background: "white",
    borderRadius: "10px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabActive: {
    border: "1px solid #1f6feb",
    background: "#1f6feb",
    color: "white",
    borderRadius: "10px",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  manualGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 0.9fr) minmax(420px, 1.1fr)",
    gap: "16px",
    alignItems: "start",
  },
  rulesGrid: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: "16px",
    alignItems: "start",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    marginBottom: "16px",
  },
  cardWide: {
    gridColumn: "1 / -1",
    background: "#fff",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: "0 0 14px",
    fontSize: "20px",
    fontWeight: 800,
  },
  searchRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    alignItems: "end",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "12px",
    marginBottom: "12px",
  },
  form: {
    display: "grid",
    gap: "10px",
    marginTop: "14px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontSize: "14px",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "70px",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    padding: "11px 14px",
    background: "#1f6feb",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    padding: "10px 14px",
    background: "#fff",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
  },
  results: {
    display: "grid",
    gap: "8px",
    marginTop: "14px",
  },
  resultItem: {
    display: "grid",
    gap: "4px",
    textAlign: "left",
    border: "1px solid #d0d5dd",
    background: "#fff",
    borderRadius: "12px",
    padding: "12px",
    cursor: "pointer",
  },
  identityBox: {
    display: "grid",
    gap: "4px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "12px",
    color: "#344054",
  },
  priceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },
  summaryCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "14px",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    display: "grid",
    gap: "6px",
  },
  summaryLabel: {
    color: "#667085",
    fontSize: "13px",
  },
  summaryValue: {
    fontSize: "20px",
  },
  suggestionBox: {
    marginTop: "14px",
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: "12px",
    padding: "12px",
    display: "grid",
    gap: "10px",
  },
  suggestionResult: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "14px",
    flexWrap: "wrap",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  counter: {
    color: "#667085",
    fontSize: "13px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1180px",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px",
    fontSize: "13px",
    color: "#555",
    whiteSpace: "nowrap",
  },
  td: {
    borderBottom: "1px solid #eee",
    padding: "10px",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  tdStrong: {
    borderBottom: "1px solid #eee",
    padding: "10px",
    fontSize: "14px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
  },
  badgeOk: {
    background: "#e7f7ed",
    color: "#137333",
  },
  badgePreview: {
    background: "#eef4ff",
    color: "#1f6feb",
  },
  badgeOff: {
    background: "#f2f4f7",
    color: "#667085",
  },
  empty: {
    padding: "18px",
    textAlign: "center",
    color: "#667085",
  },
  error: {
    background: "#fff1f0",
    color: "#b42318",
    border: "1px solid #fecdca",
    borderRadius: "10px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
  success: {
    background: "#ecfdf3",
    color: "#067647",
    border: "1px solid #abefc6",
    borderRadius: "10px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
  note: {
    marginTop: "12px",
    background: "#f9fafb",
    borderLeft: "4px solid #111827",
    padding: "10px",
    borderRadius: "8px",
    color: "#344054",
  },
};