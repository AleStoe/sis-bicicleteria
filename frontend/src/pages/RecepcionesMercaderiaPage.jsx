import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Calculator,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  Link2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Tags,
  Trash2,
  Upload,
} from "lucide-react";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import HerramientasPrecioPanel from "../components/precios/HerramientasPrecioPanel";
import { useSession } from "../context/SessionContext";
import { DEFAULT_CONFIGURACION_NEGOCIO } from "../config/defaultConfiguracionNegocio";
import { obtenerConfiguracionNegocio } from "../services/configuracionNegocioService";
import { listarProveedores } from "../services/proveedoresService";
import {
  aceptarVinculoRecepcionMercaderia,
  anularRecepcionMercaderia,
  agregarLecturaRecepcionMercaderia,
  configurarCostosRecepcionMercaderia,
  confirmarRecepcionMercaderia,
  corregirLecturaRecepcionMercaderia,
  clasificarItemsRecepcionMercaderia,
  deshacerCoincidenciaRecepcionMercaderia,
  eliminarDocumentoRecepcionMercaderia,
  eliminarLineaRecepcionMercaderia,
  importarDocumentoRecepcionMercaderia,
  importarTablaRecepcionMercaderia,
  listarRecepcionesMercaderia,
  obtenerRecepcionMercaderia,
  prepararAltaRecepcionMercaderia,
  previsualizarPreciosRecepcionMercaderia,
  guardarPrecioRecepcionMercaderia,
  reprocesarDocumentoRecepcionMercaderia,
  resolverReglaSugeridaRecepcionMercaderia,
  sugerirPreciosItemRecepcionMercaderia,
  subirImagenItemRecepcionMercaderia,
  quitarImagenItemRecepcionMercaderia,
} from "../services/recepcionesMercaderiaService";
import { crearMarca, listarCategorias, listarMarcas, listarRubros } from "../services/catalogoService";
import { SUBTIPOS_POR_RUBRO } from "../utils/catalogTaxonomy";
import { formatDateTime, formatMoneyPrecise, formatNumber } from "../utils/formatters";
import { getImageUrl } from "../utils/images";

const EJEMPLO = `416001103\tCARAM.VENZO MOLECULE 500cc NG+RJ SIN PORTA\t4\t$3.057,46
401034073\tCUB.MAXXIS 29x2.1 PACE C/ALAMBRE NEGRA\t1\t$14.370,54`;

const RESOLUCION = {
  exacta: { label: "Encontrado", tone: "success" },
  sugerida: { label: "Revisar vínculo", tone: "warning" },
  nueva: { label: "Producto nuevo", tone: "info" },
  alta_preparada: { label: "Alta preparada", tone: "success" },
  conflicto: { label: "Conflicto", tone: "danger" },
  incompleta: { label: "Incompleta", tone: "danger" },
};

const ESTADOS = {
  borrador: "Borrador",
  requiere_revision: "Requiere revisión",
  lista_para_confirmar: "Lista para confirmar",
  confirmada: "Confirmada",
  anulada: "Anulada",
  error: "Error",
};

export default function RecepcionesMercaderiaPage() {
  const { usuarioId, sucursalId } = useSession();
  const fileRef = useRef(null);
  const [proveedores, setProveedores] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [catalogos, setCatalogos] = useState({ rubros: [], categorias: [], marcas: [] });
  const [configuracionNegocio, setConfiguracionNegocio] = useState(DEFAULT_CONFIGURACION_NEGOCIO);
  const [proveedorId, setProveedorId] = useState("");
  const [texto, setTexto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarInicial();
  }, []);

  const resumen = useMemo(() => {
    if (!detalle) return [];
    return [
      { label: "Líneas", value: detalle.total_lineas },
      { label: "Unidades", value: formatNumber(detalle.total_unidades) },
      { label: "Encontrados", value: detalle.exactas, tone: "success" },
      { label: "Vínculos a revisar", value: detalle.sugeridas, tone: "warning" },
      { label: "Nuevos", value: detalle.nuevas, tone: "info" },
      { label: "Altas preparadas", value: detalle.altas_preparadas, tone: "success" },
      {
        label: "A revisar",
        value: Number(detalle.conflictos || 0) + Number(detalle.incompletas || 0),
        tone: "danger",
      },
      { label: "Costo cargado", value: formatMoneyPrecise(detalle.total_costo) },
    ];
  }, [detalle]);

  async function cargarInicial() {
    setCargando(true);
    setError("");
    try {
      const [proveedoresData, recepcionesData, rubrosData, categoriasData, marcasData, configuracionData] = await Promise.all([
        listarProveedores({ solo_activos: true }),
        listarRecepcionesMercaderia({ limit: 100 }),
        listarRubros(),
        listarCategorias(),
        listarMarcas(),
        obtenerConfiguracionNegocio(),
      ]);
      setProveedores(Array.isArray(proveedoresData) ? proveedoresData : []);
      setRecepciones(Array.isArray(recepcionesData) ? recepcionesData : []);
      setCatalogos({
        rubros: Array.isArray(rubrosData) ? rubrosData : [],
        categorias: Array.isArray(categoriasData) ? categoriasData : [],
        marcas: Array.isArray(marcasData) ? marcasData : [],
      });
      setConfiguracionNegocio({ ...DEFAULT_CONFIGURACION_NEGOCIO, ...(configuracionData || {}) });
    } catch (err) {
      setError(err.message || "No se pudo cargar la recepción de mercadería.");
    } finally {
      setCargando(false);
    }
  }

  async function refrescarListado() {
    try {
      const data = await listarRecepcionesMercaderia({ limit: 100 });
      setRecepciones(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "No se pudo refrescar el listado.");
    }
  }

  async function crearMarcaDesdeRecepcion(nombre) {
    const nueva = await crearMarca({ nombre: nombre.trim() });
    setCatalogos((actual) => ({
      ...actual,
      marcas: [...actual.marcas.filter((marca) => marca.id !== nueva.id), nueva]
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }));
    return nueva;
  }

  async function importar(event) {
    event.preventDefault();
    if (!proveedorId) {
      setError("Elegí el proveedor de esta mercadería.");
      return;
    }
    if (!texto.trim()) {
      setError("Pegá al menos una línea con código, producto, cantidad y costo.");
      return;
    }

    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const data = await importarTablaRecepcionMercaderia({
        id_proveedor: Number(proveedorId),
        id_sucursal: Number(sucursalId),
        texto,
        observaciones: observaciones.trim() || null,
        origen_carga: "tabla_pegada",
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setMensaje(
        `Recepción #${data.id} guardada: ${data.exactas} encontrado(s), ${data.nuevas} nuevo(s).`,
      );
      await refrescarListado();
    } catch (err) {
      setError(err.message || "No se pudo preparar la recepción.");
    } finally {
      setProcesando(false);
    }
  }

  async function abrirRecepcion(recepcionId) {
    setError("");
    setMensaje("");
    try {
      setDetalle(await obtenerRecepcionMercaderia(recepcionId));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "No se pudo abrir la recepción.");
    }
  }

  async function subirDocumento(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    if (!proveedorId) {
      setError("Elegí el proveedor antes de subir el documento.");
      event.target.value = "";
      return;
    }
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const data = await importarDocumentoRecepcionMercaderia({
        archivo,
        id_proveedor: Number(proveedorId),
        id_sucursal: Number(sucursalId),
        observaciones: observaciones.trim() || null,
        id_usuario: usuarioId,
      });
      setDetalle(data);
      const documento = data.documentos?.[0];
      setMensaje(
        documento?.extractor?.startsWith("rapidocr")
          ? `Recepción #${data.id} leída con OCR: ${data.total_lineas} línea(s) detectada(s). Revisá los datos antes de confirmar.`
          : `Recepción #${data.id} preparada desde ${archivo.name}: ${data.total_lineas} línea(s) detectada(s).`,
      );
      await refrescarListado();
    } catch (err) {
      setError(err.message || "No se pudo procesar el documento.");
    } finally {
      event.target.value = "";
      setProcesando(false);
    }
  }

  function nuevaRecepcion() {
    setDetalle(null);
    setTexto("");
    setObservaciones("");
    setError("");
    setMensaje("");
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Mercadería / Recepciones</p>
          <h1 style={styles.title}>Recepción de mercadería</h1>
          <p style={styles.subtitle}>
            Subí la factura o lista del proveedor. El sistema prepara un borrador sin modificar stock ni catálogo.
          </p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={nuevaRecepcion}>
          <Plus size={17} /> Nueva recepción
        </button>
      </header>

      {error ? <div style={styles.error}><AlertTriangle size={18} /> {error}</div> : null}
      {mensaje ? <div style={styles.success}><CheckCircle2 size={18} /> {mensaje}</div> : null}

      {!detalle ? (
        <form onSubmit={importar} style={styles.importBand}>
          <div style={styles.importHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Preparar borrador</h2>
              <p style={styles.hint}>Primero elegí el proveedor. Podés subir el documento o pegar una tabla.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
              onChange={subirDocumento}
              style={{ display: "none" }}
            />
            <button type="button" style={styles.primaryButton} disabled={procesando} onClick={() => fileRef.current?.click()}>
              <Upload size={17} /> {procesando ? "Leyendo..." : "Subir documento"}
            </button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              Proveedor
              <select value={proveedorId} onChange={(event) => setProveedorId(event.target.value)}>
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map((proveedor) => (
                  <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>
                ))}
              </select>
            </label>
            <label style={styles.field}>
              Referencia u observación
              <input
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                placeholder="Ej: Factura 126057 / Pedido 758300"
              />
            </label>
          </div>

          <label style={styles.field}>
            O pegá una lista de productos
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder={EJEMPLO}
              rows={11}
              spellCheck="false"
            />
          </label>

          <div style={styles.importFooter}>
            <div style={styles.formatHelp}>
              <ClipboardPaste size={18} />
              PDF y Excel se leen automáticamente. Las imágenes quedan guardadas para OCR.
            </div>
            <button type="submit" style={styles.primaryButton} disabled={procesando}>
              <PackageCheck size={18} /> {procesando ? "Preparando..." : "Preparar recepción"}
            </button>
          </div>
        </form>
      ) : (
        <RecepcionDetalle
          detalle={detalle}
          resumen={resumen}
          catalogos={catalogos}
          configuracionNegocio={configuracionNegocio}
          usuarioId={usuarioId}
          onCrearMarca={crearMarcaDesdeRecepcion}
          onChange={(data) => {
            setDetalle(data);
            refrescarListado();
          }}
          onError={setError}
          onMessage={setMensaje}
        />
      )}

      <section style={styles.listSection}>
        <div style={styles.listHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Recepciones guardadas</h2>
            <p style={styles.hint}>Podés abrir cualquier borrador y continuar la revisión.</p>
          </div>
          <button type="button" style={styles.iconButton} title="Refrescar" onClick={refrescarListado}>
            <RefreshCw size={18} />
          </button>
        </div>

        {cargando ? <div style={styles.empty}>Cargando recepciones...</div> : null}
        {!cargando && !recepciones.length ? (
          <div style={styles.empty}>Todavía no hay recepciones preparadas.</div>
        ) : null}
        <div style={styles.draftList}>
          {recepciones.map((recepcion) => (
            <button
              type="button"
              key={recepcion.id}
              style={styles.draftRow}
              onClick={() => abrirRecepcion(recepcion.id)}
            >
              <span style={styles.draftId}>#{recepcion.id}</span>
              <span style={styles.draftMain}>
                <strong>{recepcion.proveedor_nombre_snapshot}</strong>
                <small>{formatDateTime(recepcion.updated_at)} · {recepcion.observaciones || "Sin referencia"}</small>
              </span>
              <span style={styles.draftMetric}>{recepcion.total_lineas} líneas</span>
              <span style={styles.draftMetric}>{recepcion.nuevas} nuevos</span>
              <StatusBadge label={ESTADOS[recepcion.estado] || recepcion.estado} tone={["lista_para_confirmar", "confirmada"].includes(recepcion.estado) ? "success" : "warning"} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function RecepcionDetalle({ detalle, resumen, catalogos, configuracionNegocio, usuarioId, onCrearMarca, onChange, onError, onMessage }) {
  const attachRef = useRef(null);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState(null);
  const [sugerenciaPrecio, setSugerenciaPrecio] = useState(null);
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false);
  const [errorSugerencia, setErrorSugerencia] = useState("");
  const [procesandoImagenId, setProcesandoImagenId] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [procesandoDocumento, setProcesandoDocumento] = useState(false);
  const [lecturaEditada, setLecturaEditada] = useState(null);
  const [seleccionados, setSeleccionados] = useState([]);
  const [clasificacionMasiva, setClasificacionMasiva] = useState({
    rubro_propuesto: "",
    id_categoria_propuesta: "",
    id_marca_propuesta: "",
    subtipo_propuesto: "",
  });
  const [eliminarPendiente, setEliminarPendiente] = useState(null);
  const [reprocesoPendiente, setReprocesoPendiente] = useState(null);
  const [mostrarAnulacion, setMostrarAnulacion] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const items = filtro === "todos"
    ? detalle.items
    : detalle.items.filter((item) => item.estado_resolucion === filtro);
  const bloqueoConfirmacion = describirBloqueoConfirmacion(detalle);

  function editar(item) {
    const rubro = item.rubro_propuesto || "";
    const nuevoForm = {
      nombre_propuesto: item.nombre_propuesto || item.descripcion_original || "",
      nombre_variante_propuesta: item.nombre_variante_propuesta || "UNICA",
      rubro_propuesto: rubro,
      id_categoria_propuesta: item.id_categoria_propuesta ? String(item.id_categoria_propuesta) : "",
      id_marca_propuesta: item.id_marca_propuesta ? String(item.id_marca_propuesta) : "",
      subtipo_propuesto: item.subtipo_propuesto || "",
      precio_minorista_propuesto: item.precio_minorista_propuesto === null ? "" : String(item.precio_minorista_propuesto),
      precio_mayorista_propuesto: item.precio_mayorista_propuesto === null ? "" : String(item.precio_mayorista_propuesto),
      serializable_propuesto: Boolean(item.serializable_propuesto),
    };
    setEditandoId(item.id);
    setForm(nuevoForm);
    cargarSugerenciaPrecio(item, nuevoForm);
  }

  async function cargarSugerenciaPrecio(item, valores = form) {
    setCargandoSugerencia(true);
    setErrorSugerencia("");
    setSugerenciaPrecio(null);
    try {
      const data = await sugerirPreciosItemRecepcionMercaderia(detalle.id, item.id, {
        rubro: valores?.rubro_propuesto || null,
        id_categoria: valores?.id_categoria_propuesta ? Number(valores.id_categoria_propuesta) : null,
        id_marca: valores?.id_marca_propuesta ? Number(valores.id_marca_propuesta) : null,
        redondeo_base: 50,
      });
      setSugerenciaPrecio(data);
    } catch (err) {
      setErrorSugerencia(err.message || "No se pudo calcular el precio sugerido.");
    } finally {
      setCargandoSugerencia(false);
    }
  }

  function usarPreciosSugeridos() {
    if (!sugerenciaPrecio || !form) return;
    setForm({
      ...form,
      precio_minorista_propuesto: Number(sugerenciaPrecio.precio_minorista_sugerido || 0) > 0
        ? String(sugerenciaPrecio.precio_minorista_sugerido)
        : form.precio_minorista_propuesto,
      precio_mayorista_propuesto: Number(sugerenciaPrecio.precio_mayorista_sugerido || 0) > 0
        ? String(sugerenciaPrecio.precio_mayorista_sugerido)
        : form.precio_mayorista_propuesto,
    });
  }

  async function subirImagenItem(item, archivo) {
    if (!archivo) return;
    setProcesandoImagenId(item.id);
    onError("");
    try {
      const data = await subirImagenItemRecepcionMercaderia(detalle.id, item.id, archivo);
      onChange(data);
      onMessage(`Imagen preparada para ${item.descripcion_original}.`);
    } catch (err) {
      onError(err.message || "No se pudo preparar la imagen.");
    } finally {
      setProcesandoImagenId(null);
    }
  }

  async function quitarImagenItem(item) {
    setProcesandoImagenId(item.id);
    onError("");
    try {
      const data = await quitarImagenItemRecepcionMercaderia(detalle.id, item.id);
      onChange(data);
      onMessage(`Imagen quitada de ${item.descripcion_original}.`);
    } catch (err) {
      onError(err.message || "No se pudo quitar la imagen.");
    } finally {
      setProcesandoImagenId(null);
    }
  }

  async function guardarAlta(item) {
    if (!form.nombre_propuesto.trim() || !form.rubro_propuesto || !form.id_categoria_propuesta || !form.subtipo_propuesto.trim()) {
      onError("Completá nombre, rubro, categoría y subtipo antes de preparar el alta.");
      return;
    }
    if (Number(form.precio_minorista_propuesto) <= 0 || Number(form.precio_mayorista_propuesto) <= 0) {
      onError("Completá los precios minorista y mayorista antes de preparar el alta.");
      return;
    }
    setGuardando(true);
    onError("");
    try {
      const data = await prepararAltaRecepcionMercaderia(detalle.id, item.id, {
        ...form,
        id_categoria_propuesta: Number(form.id_categoria_propuesta),
        id_marca_propuesta: form.id_marca_propuesta ? Number(form.id_marca_propuesta) : null,
        precio_minorista_propuesto: form.precio_minorista_propuesto === "" ? null : form.precio_minorista_propuesto,
        precio_mayorista_propuesto: form.precio_mayorista_propuesto === "" ? null : form.precio_mayorista_propuesto,
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(`Alta preparada para ${form.nombre_propuesto}.`);
      setEditandoId(null);
      setForm(null);
    } catch (err) {
      onError(err.message || "No se pudo preparar el alta.");
    } finally {
      setGuardando(false);
    }
  }

  async function aceptarVinculo(item, candidato = null) {
    const idVariante = candidato?.id_variante || item.id_variante;
    if (!idVariante) {
      onError("Elegí uno de los productos sugeridos para vincular esta línea.");
      return;
    }
    setGuardando(true);
    onError("");
    try {
      const data = await aceptarVinculoRecepcionMercaderia(detalle.id, item.id, {
        id_variante: idVariante,
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(`Vínculo confirmado con ${candidato?.producto || item.producto_nombre}.`);
    } catch (err) {
      onError(err.message || "No se pudo aceptar el vínculo.");
    } finally {
      setGuardando(false);
    }
  }

  async function deshacerCoincidencia(item) {
    setGuardando(true);
    onError("");
    try {
      const data = await deshacerCoincidenciaRecepcionMercaderia(detalle.id, item.id, {
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(`Coincidencia de la línea ${item.numero_linea} descartada. Ahora podés crearla o vincularla manualmente.`);
    } catch (err) {
      onError(err.message || "No se pudo deshacer la coincidencia.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmar() {
    setConfirmando(true);
    setMostrarConfirmacion(false);
    onError("");
    try {
      const data = await confirmarRecepcionMercaderia(detalle.id, {
        confirmacion: "CONFIRMAR",
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(`Recepción #${detalle.id} confirmada. El catálogo y el stock ya fueron actualizados.`);
    } catch (err) {
      onError(err.message || "No se pudo confirmar la recepción.");
    } finally {
      setConfirmando(false);
    }
  }

  async function anular() {
    if (motivoAnulacion.trim().length < 5) {
      onError("Explicá brevemente por qué se anula la recepción.");
      return;
    }
    setGuardando(true);
    onError("");
    try {
      const data = await anularRecepcionMercaderia(detalle.id, {
        motivo: motivoAnulacion.trim(),
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(`Recepción #${detalle.id} anulada sin afectar stock ni catálogo.`);
      setMostrarAnulacion(false);
      setMotivoAnulacion("");
    } catch (err) {
      onError(err.message || "No se pudo anular la recepción.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminacion() {
    if (!eliminarPendiente) return;
    setGuardando(true);
    onError("");
    try {
      const data = eliminarPendiente.tipo === "linea"
        ? await eliminarLineaRecepcionMercaderia(detalle.id, eliminarPendiente.id, { id_usuario: usuarioId })
        : await eliminarDocumentoRecepcionMercaderia(detalle.id, eliminarPendiente.id, { id_usuario: usuarioId });
      onChange(data);
      onMessage(eliminarPendiente.tipo === "linea"
        ? "Línea eliminada y totales recalculados."
        : "Documento desvinculado de la recepción.");
      setSeleccionados((actuales) => actuales.filter((id) => id !== eliminarPendiente.id));
      setEliminarPendiente(null);
    } catch (err) {
      onError(err.message || "No se pudo completar la eliminación.");
    } finally {
      setGuardando(false);
    }
  }

  function alternarSeleccion(itemId) {
    setSeleccionados((actuales) => actuales.includes(itemId)
      ? actuales.filter((id) => id !== itemId)
      : [...actuales, itemId]);
  }

  async function aplicarClasificacionMasiva() {
    if (!seleccionados.length || !clasificacionMasiva.rubro_propuesto || !clasificacionMasiva.id_categoria_propuesta || !clasificacionMasiva.subtipo_propuesto.trim()) {
      onError("Seleccioná líneas y completá rubro, categoría y subtipo.");
      return;
    }
    setGuardando(true);
    onError("");
    try {
      const data = await clasificarItemsRecepcionMercaderia(detalle.id, {
        ids_items: seleccionados,
        ...clasificacionMasiva,
        id_categoria_propuesta: Number(clasificacionMasiva.id_categoria_propuesta),
        id_marca_propuesta: clasificacionMasiva.id_marca_propuesta ? Number(clasificacionMasiva.id_marca_propuesta) : null,
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(`Clasificación aplicada a ${seleccionados.length} línea(s).`);
      setSeleccionados([]);
    } catch (err) {
      onError(err.message || "No se pudo aplicar la clasificación masiva.");
    } finally {
      setGuardando(false);
    }
  }

  async function resolverRegla(sugerencia, decision) {
    setGuardando(true);
    onError("");
    try {
      await resolverReglaSugeridaRecepcionMercaderia(sugerencia.id, {
        decision,
        id_usuario: usuarioId,
      });
      onChange(await obtenerRecepcionMercaderia(detalle.id));
      onMessage(decision === "aceptada" ? "Regla aprobada y registrada." : "Sugerencia descartada.");
    } catch (err) {
      onError(err.message || "No se pudo resolver la sugerencia.");
    } finally {
      setGuardando(false);
    }
  }

  async function adjuntarDocumento(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    setProcesandoDocumento(true);
    onError("");
    try {
      const data = await importarDocumentoRecepcionMercaderia({
        archivo,
        id_proveedor: detalle.id_proveedor,
        id_sucursal: detalle.id_sucursal,
        id_usuario: usuarioId,
        recepcion_id: detalle.id,
      });
      onChange(data);
      onMessage(`${archivo.name} quedó vinculado a la recepción #${detalle.id}.`);
    } catch (err) {
      onError(err.message || "No se pudo adjuntar el documento.");
    } finally {
      event.target.value = "";
      setProcesandoDocumento(false);
    }
  }

  function solicitarReproceso(documento) {
    if (detalle.items?.length) {
      setReprocesoPendiente(documento);
      return;
    }
    reprocesar(documento, false);
  }

  async function reprocesar(documento, reemplazarLineas) {
    setProcesandoDocumento(true);
    onError("");
    setReprocesoPendiente(null);
    try {
      const data = await reprocesarDocumentoRecepcionMercaderia(documento.id, { reemplazarLineas });
      onChange(data);
      onMessage(reemplazarLineas
        ? `${documento.nombre_original} fue releído y reemplazó las líneas anteriores.`
        : `${documento.nombre_original} fue releído sin duplicar la recepción.`);
    } catch (err) {
      onError(err.message || "No se pudo reprocesar el documento.");
    } finally {
      setProcesandoDocumento(false);
    }
  }

  function editarLectura(item = null) {
    setLecturaEditada({
      id: item?.id || null,
      codigo_proveedor: item?.codigo_proveedor || "",
      descripcion: item?.descripcion_original || "",
      cantidad: item?.cantidad === null || item?.cantidad === undefined ? "1" : String(item.cantidad),
      costo_unitario: item?.costo_unitario === null || item?.costo_unitario === undefined ? "" : String(item.costo_unitario),
      descuento_linea_pct: String(item?.descuento_linea_pct || "0"),
    });
  }

  async function guardarLectura() {
    if (!lecturaEditada.codigo_proveedor.trim() || !lecturaEditada.descripcion.trim()) {
      onError("Completá código y descripción.");
      return;
    }
    if (Number(lecturaEditada.cantidad) <= 0 || lecturaEditada.costo_unitario === "" || Number(lecturaEditada.costo_unitario) < 0) {
      onError("Revisá cantidad y costo unitario.");
      return;
    }
    setGuardando(true);
    onError("");
    try {
      const payload = { ...lecturaEditada, id_usuario: usuarioId };
      delete payload.id;
      const data = lecturaEditada.id
        ? await corregirLecturaRecepcionMercaderia(detalle.id, lecturaEditada.id, payload)
        : await agregarLecturaRecepcionMercaderia(detalle.id, payload);
      onChange(data);
      onMessage(lecturaEditada.id ? "Lectura corregida y totales recalculados." : "Línea agregada a la recepción.");
      setLecturaEditada(null);
    } catch (err) {
      onError(err.message || "No se pudo guardar la lectura.");
    } finally {
      setGuardando(false);
    }
  }

  const categoriasDisponibles = catalogos.categorias;
  const subtiposDisponibles = SUBTIPOS_POR_RUBRO[form?.rubro_propuesto] || [];

  return (
    <section style={styles.detailSection}>
      <ConfirmModal
        open={mostrarConfirmacion}
        title="Confirmar ingreso de mercadería"
        message={`Se crearán las altas nuevas y se ingresarán ${formatNumber(detalle.total_unidades)} unidades por ${formatMoneyPrecise(detalle.total_costo)}. Esta operación afecta stock y costos.`}
        confirmText={confirmando ? "Confirmando..." : "Confirmar e ingresar stock"}
        cancelText="Seguir revisando"
        variant="warning"
        onConfirm={confirmar}
        onCancel={() => setMostrarConfirmacion(false)}
      />
      <ConfirmModal
        open={Boolean(eliminarPendiente)}
        title={eliminarPendiente?.tipo === "linea" ? "Quitar línea" : "Desvincular documento"}
        message={eliminarPendiente?.tipo === "linea"
          ? `Vas a quitar la línea ${eliminarPendiente.numero_linea}: ${eliminarPendiente.descripcion || "producto sin descripción"} por ${formatMoneyPrecise(eliminarPendiente.total || 0)}. Si pertenece a la factura, el total dejará de coincidir y tendrás que volver a agregarla.`
          : "Se quitará el archivo de esta recepción. Las líneas ya cargadas no se eliminarán automáticamente."}
        confirmText={eliminarPendiente?.tipo === "linea" ? "Quitar línea" : "Desvincular"}
        cancelText="Cancelar"
        variant="warning"
        onConfirm={confirmarEliminacion}
        onCancel={() => setEliminarPendiente(null)}
      />
      <ConfirmModal
        open={Boolean(reprocesoPendiente)}
        title="Releer y reemplazar líneas"
        message="La recepción ya tiene líneas. La nueva lectura reemplazará esas líneas y descartará sus correcciones manuales. El stock no se modifica hasta confirmar la recepción."
        confirmText={procesandoDocumento ? "Releyendo..." : "Releer y reemplazar"}
        cancelText="Conservar lectura actual"
        variant="warning"
        onConfirm={() => reprocesar(reprocesoPendiente, true)}
        onCancel={() => setReprocesoPendiente(null)}
      />
      <div style={styles.detailHeader}>
        <div>
          <p style={styles.eyebrow}>Recepción #{detalle.id}</p>
          <h2 style={styles.sectionTitle}>{detalle.proveedor_nombre_snapshot}</h2>
          <p style={styles.hint}>{detalle.observaciones || "Sin referencia"}</p>
        </div>
        <div style={styles.headerActions}>
          <StatusBadge label={ESTADOS[detalle.estado] || detalle.estado} tone={["lista_para_confirmar", "confirmada"].includes(detalle.estado) ? "success" : "warning"} />
          {!['confirmada', 'anulada'].includes(detalle.estado) ? (
            <button type="button" style={styles.dangerButton} onClick={() => setMostrarAnulacion(true)}>
              <Ban size={16} /> Anular
            </button>
          ) : null}
        </div>
      </div>

      {mostrarAnulacion ? (
        <div style={styles.cancelBand}>
          <label style={styles.field}>Motivo de anulación
            <textarea value={motivoAnulacion} onChange={(event) => setMotivoAnulacion(event.target.value)} placeholder="Ej: factura duplicada o proveedor incorrecto" />
          </label>
          <button type="button" style={styles.secondaryButton} onClick={() => setMostrarAnulacion(false)}>Volver</button>
          <button type="button" style={styles.dangerButton} disabled={guardando} onClick={anular}><Ban size={16} /> Confirmar anulación</button>
        </div>
      ) : null}

      <div style={styles.summaryGrid}>
        {resumen.map((item) => (
          <div key={item.label} style={{ ...styles.summaryItem, ...(styles[`${item.tone}Summary`] || {}) }}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      {detalle.aprendizaje ? (
        <div style={styles.learningBand}>
          <div>
            <strong>Aprendizaje de esta recepción</strong>
            <small>Las coincidencias seguras se automatizan; las reglas nuevas siempre quedan para aprobación.</small>
          </div>
          <span><b>{detalle.aprendizaje.coincidencias_automaticas}</b> automáticas</span>
          <span><b>{detalle.aprendizaje.coincidencias_sugeridas}</b> sugeridas</span>
          <span><b>{detalle.aprendizaje.total_correcciones}</b> correcciones</span>
          <span><b>{detalle.aprendizaje.duplicados_detectados}</b> posibles duplicados</span>
          <span><b>{detalle.aprendizaje.alertas_costo}</b> alertas de costo</span>
        </div>
      ) : null}

      {detalle.aprendizaje?.sugerencias_regla?.length ? (
        <div style={styles.rulesBand}>
          <div>
            <strong>Reglas detectadas por Atenea</strong>
            <small>Se aplican solamente después de una aprobación explícita.</small>
          </div>
          {detalle.aprendizaje.sugerencias_regla.map((sugerencia) => (
            <div key={sugerencia.id} style={styles.ruleRow}>
              <span><strong>{sugerencia.titulo}</strong><small>{sugerencia.motivo}</small></span>
              <b>{sugerencia.ocurrencias} veces</b>
              <button type="button" style={styles.secondaryButton} disabled={guardando} onClick={() => resolverRegla(sugerencia, "descartada")}>Descartar</button>
              <button type="button" style={styles.primaryButton} disabled={guardando} onClick={() => resolverRegla(sugerencia, "aceptada")}>Aprobar</button>
            </div>
          ))}
        </div>
      ) : null}

      <div style={styles.documentsBand}>
          <div style={styles.documentsHeader}>
            <div style={styles.documentsTitle}><FileText size={19} /><strong>Documentos de la recepción</strong></div>
            {!['confirmada', 'anulada'].includes(detalle.estado) ? (
              <>
                <input
                  ref={attachRef}
                  type="file"
                  accept=".pdf,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                  onChange={adjuntarDocumento}
                  style={{ display: "none" }}
                />
                <button type="button" style={styles.compactButton} disabled={procesandoDocumento} onClick={() => attachRef.current?.click()}>
                  <Upload size={15} /> {procesandoDocumento ? "Procesando..." : "Adjuntar documento"}
                </button>
              </>
            ) : null}
          </div>
          {!detalle.documentos?.length ? <small style={styles.hint}>Todavía no hay documentos adjuntos.</small> : null}
          {(detalle.documentos || []).map((documento) => (
            <div key={documento.id} style={styles.documentRow}>
              <span>
                <strong>{documento.nombre_original}</strong>
                <small style={styles.tableNote}>
                  {DOCUMENT_TYPES[documento.tipo_documento] || "Documento"}
                  {documento.numero_documento ? ` ${documento.numero_documento}` : ""}
                  {` · ${formatFileSize(documento.tamano_bytes)} · ${documento.extractor || "sin extractor"}`}
                  {documento.metadata_extraida?.confianza_promedio !== null && documento.metadata_extraida?.confianza_promedio !== undefined
                    ? ` · Confianza OCR ${Math.round(Number(documento.metadata_extraida.confianza_promedio) * 100)}%`
                    : ""}
                  {documento.cantidad_reprocesos ? ` · ${documento.cantidad_reprocesos} reproceso(s)` : ""}
                </small>
              </span>
              <div style={styles.documentActions}>
                <StatusBadge
                  label={documento.estado === "extraido" ? "Leído" : documento.estado === "pendiente_ocr" ? "Pendiente OCR" : documento.estado === "error" ? "Error" : "Revisar lectura"}
                  tone={documento.estado === "extraido" ? "success" : documento.estado === "error" ? "danger" : "warning"}
                />
                {!['confirmada', 'anulada'].includes(detalle.estado) ? (
                  <button type="button" style={styles.iconButton} title="Releer documento" disabled={procesandoDocumento} onClick={() => solicitarReproceso(documento)}>
                    <RefreshCw size={16} />
                  </button>
                ) : null}
                {!['confirmada', 'anulada'].includes(detalle.estado) ? (
                  <button type="button" style={styles.dangerIconButton} title="Desvincular documento" disabled={procesandoDocumento} onClick={() => setEliminarPendiente({ tipo: "documento", id: documento.id })}>
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
              {documento.error_extraccion ? <small style={styles.documentWarning}>{documento.error_extraccion}</small> : null}
              {documento.metadata_extraida?.comparacion_recepcion ? (
                <small style={styles.documentComparison}>
                  Comparación: {documento.metadata_extraida.comparacion_recepcion.coincidencias} código(s) coinciden
                  {documento.metadata_extraida.comparacion_recepcion.solo_documento?.length
                    ? ` · ${documento.metadata_extraida.comparacion_recepcion.solo_documento.length} aparecen solo en este documento`
                    : ""}
                  {documento.metadata_extraida.comparacion_recepcion.solo_recepcion?.length
                    ? ` · ${documento.metadata_extraida.comparacion_recepcion.solo_recepcion.length} faltan en este documento`
                    : ""}
                  {documento.metadata_extraida.comparacion_recepcion.diferencias?.length
                    ? ` · ${documento.metadata_extraida.comparacion_recepcion.diferencias.length} tienen otra cantidad o costo`
                    : ""}
                </small>
              ) : null}
            </div>
          ))}
      </div>

      <CostosPanel
        detalle={detalle}
        usuarioId={usuarioId}
        onChange={onChange}
        onError={onError}
        onMessage={onMessage}
      />

      <PreciosPanel
        detalle={detalle}
        usuarioId={usuarioId}
        onChange={onChange}
        onError={onError}
        onMessage={onMessage}
      />

      <div style={styles.reviewBar}>
        <div>
          <strong>Revisión de líneas</strong>
          <small style={styles.tableNote}>Las sugerencias son editables y todavía no crean stock.</small>
        </div>
        <label style={styles.filterField}>
          Mostrar
          <select value={filtro} onChange={(event) => setFiltro(event.target.value)}>
            <option value="todos">Todas</option>
            <option value="nueva">Productos nuevos</option>
            <option value="sugerida">Vínculos a revisar</option>
            <option value="alta_preparada">Altas preparadas</option>
            <option value="exacta">Encontrados</option>
            <option value="conflicto">Conflictos</option>
            <option value="incompleta">Incompletas</option>
          </select>
        </label>
        {!['confirmada', 'anulada'].includes(detalle.estado) ? (
          <button type="button" style={styles.compactButton} onClick={() => editarLectura()}>
            <Plus size={15} /> Agregar línea
          </button>
        ) : null}
      </div>

      {lecturaEditada ? (
        <div style={styles.readingEditor}>
          <div>
            <strong>{lecturaEditada.id ? "Corregir lectura" : "Agregar producto no detectado"}</strong>
            <small style={styles.tableNote}>Al guardar se recalculan los totales y deberá revisarse nuevamente la conciliación.</small>
          </div>
          <div style={styles.readingGrid}>
            <label style={styles.field}>Código
              <input value={lecturaEditada.codigo_proveedor} onChange={(e) => setLecturaEditada({ ...lecturaEditada, codigo_proveedor: e.target.value })} />
            </label>
            <label style={{ ...styles.field, gridColumn: "span 2" }}>Descripción
              <input value={lecturaEditada.descripcion} onChange={(e) => setLecturaEditada({ ...lecturaEditada, descripcion: e.target.value })} />
            </label>
            <label style={styles.field}>Cantidad
              <input type="number" min="0.001" step="0.001" value={lecturaEditada.cantidad} onChange={(e) => setLecturaEditada({ ...lecturaEditada, cantidad: e.target.value })} />
            </label>
            <label style={styles.field}>Costo unitario
              <input type="number" min="0" step="0.01" value={lecturaEditada.costo_unitario} onChange={(e) => setLecturaEditada({ ...lecturaEditada, costo_unitario: e.target.value })} />
            </label>
            <label style={styles.field}>Descuento %
              <input type="number" min="0" max="100" step="0.01" value={lecturaEditada.descuento_linea_pct} onChange={(e) => setLecturaEditada({ ...lecturaEditada, descuento_linea_pct: e.target.value })} />
            </label>
          </div>
          <div style={styles.editorActions}>
            <button type="button" style={styles.secondaryButton} onClick={() => setLecturaEditada(null)}>Cancelar</button>
            <button type="button" style={styles.primaryButton} disabled={guardando} onClick={guardarLectura}>
              <CheckCircle2 size={17} /> {guardando ? "Guardando..." : "Guardar lectura"}
            </button>
          </div>
        </div>
      ) : null}

      {seleccionados.length ? (
        <div style={styles.bulkBand}>
          <div style={styles.bulkTitle}><Tags size={18} /><strong>Clasificar {seleccionados.length} línea(s)</strong></div>
          <label style={styles.field}>Rubro
            <select value={clasificacionMasiva.rubro_propuesto} onChange={(event) => setClasificacionMasiva({ ...clasificacionMasiva, rubro_propuesto: event.target.value, subtipo_propuesto: "" })}>
              <option value="">Seleccionar...</option>
              {catalogos.rubros.map((rubro) => <option key={rubro.id} value={rubro.nombre}>{rubro.label || rubro.nombre}</option>)}
            </select>
          </label>
          <label style={styles.field}>Categoría
            <select value={clasificacionMasiva.id_categoria_propuesta} onChange={(event) => setClasificacionMasiva({ ...clasificacionMasiva, id_categoria_propuesta: event.target.value })}>
              <option value="">Seleccionar...</option>
              {catalogos.categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
            </select>
          </label>
          <label style={styles.field}>Subtipo
            <input list="subtipos-masivos" value={clasificacionMasiva.subtipo_propuesto} onChange={(event) => setClasificacionMasiva({ ...clasificacionMasiva, subtipo_propuesto: event.target.value })} />
            <datalist id="subtipos-masivos">{(SUBTIPOS_POR_RUBRO[clasificacionMasiva.rubro_propuesto] || []).map((subtipo) => <option key={subtipo} value={subtipo} />)}</datalist>
          </label>
          <label style={styles.field}>Marca
            <select value={clasificacionMasiva.id_marca_propuesta} onChange={(event) => setClasificacionMasiva({ ...clasificacionMasiva, id_marca_propuesta: event.target.value })}>
              <option value="">Sin marca</option>
              {catalogos.marcas.map((marca) => <option key={marca.id} value={marca.id}>{marca.nombre}</option>)}
            </select>
          </label>
          <button type="button" style={styles.secondaryButton} onClick={() => setSeleccionados([])}>Limpiar</button>
          <button type="button" style={styles.primaryButton} disabled={guardando} onClick={aplicarClasificacionMasiva}><Tags size={16} /> Aplicar</button>
        </div>
      ) : null}

      <div style={styles.tableWrap}>
        <table className="recepcion-lines-table" style={styles.table}>
          <colgroup>
            <col />
            <col style={{ width: 70 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 300 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Costo unitario</th>
              <th>Total</th>
              <th>Resultado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const estado = RESOLUCION[item.estado_resolucion] || RESOLUCION.incompleta;
              const costoOrigen = Number(item.costo_unitario || 0);
              const costoFinal = item.costo_unitario_calculado === null
                ? null
                : Number(item.costo_unitario_calculado);
              const ajusteUnitario = costoFinal === null ? null : costoOrigen - costoFinal;
              const ajustePct = costoFinal === null || costoOrigen <= 0
                ? null
                : (Math.abs(ajusteUnitario) / costoOrigen) * 100;
              return (
                <Fragment key={item.id}>
                <tr>
                  <td style={styles.productCell}>
                    <div style={styles.productMeta}>
                      {!['confirmada', 'anulada'].includes(detalle.estado) && ["nueva", "alta_preparada", "conflicto", "incompleta"].includes(item.estado_resolucion) ? (
                        <input type="checkbox" checked={seleccionados.includes(item.id)} onChange={() => alternarSeleccion(item.id)} aria-label={`Seleccionar línea ${item.numero_linea}`} />
                      ) : null}
                      <span>Línea {item.numero_linea}</span>
                      <b>{item.codigo_proveedor || "Sin código"}</b>
                    </div>
                    <strong>{item.descripcion_original || "No interpretado"}</strong>
                    {item.producto_nombre ? <small style={styles.tableNote}>Coincide con: {item.producto_nombre}</small> : null}
                    {item.rubro_propuesto ? (
                      <small style={styles.proposalNote}>
                        Propuesta: {item.rubro_propuesto} · {item.categoria_propuesta_nombre || "sin categoría"} · {item.subtipo_propuesto || "sin subtipo"}
                        {item.marca_propuesta_nombre ? ` · ${item.marca_propuesta_nombre}` : ""}
                      </small>
                    ) : null}
                    {item.mensaje_revision ? <small style={styles.tableNote}>{item.mensaje_revision}</small> : null}
                    {item.posible_duplicado ? (
                      <div style={styles.duplicatePanel}>
                        <div style={styles.duplicateWarning}>
                          <AlertTriangle size={15} />
                          <strong>Este producto podría existir en el catálogo</strong>
                        </div>
                        {(item.duplicado_candidatos || []).map((candidate) => (
                          <div key={candidate.id_variante} style={styles.duplicateCandidate}>
                            <div style={styles.duplicateCandidateText}>
                              <b>{candidate.producto}</b>
                              {candidate.variante && !candidate.variante.toUpperCase().replace(/[^A-Z0-9]/g, "").endsWith("NICA")
                                ? ` · ${candidate.variante}`
                                : ""}
                              <small>{Math.round(Number(candidate.similitud || 0) * 100)}% parecido</small>
                            </div>
                            <button
                              type="button"
                              style={styles.duplicateUseButton}
                              disabled={guardando}
                              onClick={() => aceptarVinculo(item, candidate)}
                            >
                              <Link2 size={14} /> Usar este producto
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          style={styles.duplicateNewButton}
                          disabled={guardando}
                          onClick={() => editar(item)}
                        >
                          <Plus size={14} /> No coincide, crear nuevo
                        </button>
                      </div>
                    ) : null}
                    <FieldConfidence value={item.confianza_codigo} origin={item.origen_extraccion} />
                    <FieldConfidence value={item.confianza_descripcion} origin={item.origen_extraccion} />
                  </td>
                  <td>{item.cantidad === null ? "-" : formatNumber(item.cantidad)}<FieldConfidence value={item.confianza_cantidad} origin={item.origen_extraccion} /></td>
                  <td>
                    {item.costo_unitario === null ? "-" : formatMoneyPrecise(item.costo_unitario)}
                    <FieldConfidence value={item.confianza_costo} origin={item.origen_extraccion} />
                    {item.costo_unitario_calculado !== null ? (
                      <small style={styles.finalCost}>Final: {formatMoneyPrecise(item.costo_unitario_calculado)}</small>
                    ) : null}
                    {detalle.costos?.conciliado && ajusteUnitario !== null && Math.abs(ajusteUnitario) >= 0.01 ? (
                      <small style={ajusteUnitario > 0 ? styles.receivedDiscount : styles.receivedSurcharge}>
                        {ajusteUnitario > 0 ? "Descuento percibido" : "Recargo final"}: {formatMoneyPrecise(Math.abs(ajusteUnitario))}
                        {ajustePct !== null ? ` (${ajustePct.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)` : ""}
                      </small>
                    ) : null}
                    {item.alerta_costo ? <small style={styles.costAlert}><AlertTriangle size={13} /> {item.alerta_costo}</small> : null}
                  </td>
                  <td>
                    {item.costo_total === null ? "-" : formatMoneyPrecise(item.costo_total)}
                    {item.costo_total_calculado !== null ? (
                      <small style={styles.finalCost}>Final: {formatMoneyPrecise(item.costo_total_calculado)}</small>
                    ) : null}
                  </td>
                  <td><StatusBadge label={estado.label} tone={estado.tone} /></td>
                  <td><div style={styles.rowActions}>
                    {!['confirmada', 'anulada'].includes(detalle.estado) ? (
                      <button type="button" style={styles.compactButton} disabled={guardando} onClick={() => editarLectura(item)}>
                        <Pencil size={15} /> Corregir lectura
                      </button>
                    ) : null}
                    {!['confirmada', 'anulada'].includes(detalle.estado) && item.estado_resolucion === "sugerida" ? (
                      <button type="button" style={styles.compactButton} disabled={guardando} onClick={() => aceptarVinculo(item)}>
                        <Link2 size={15} /> Usar vínculo
                      </button>
                    ) : null}
                    {!['confirmada', 'anulada'].includes(detalle.estado) && item.estado_resolucion === "exacta" && ["codigo_proveedor", "ean"].includes(item.origen_resolucion) ? (
                      <button type="button" style={styles.compactButton} disabled={guardando} onClick={() => deshacerCoincidencia(item)}>
                        <RotateCcw size={15} /> Deshacer coincidencia
                      </button>
                    ) : null}
                    {!['confirmada', 'anulada'].includes(detalle.estado) && ["nueva", "alta_preparada"].includes(item.estado_resolucion) ? (
                      <button type="button" style={styles.compactButton} disabled={guardando} onClick={() => editar(item)}>
                        <Pencil size={15} /> {item.estado_resolucion === "alta_preparada" ? "Editar" : "Preparar alta"}
                      </button>
                    ) : null}
                    {!['confirmada', 'anulada'].includes(detalle.estado) ? (
                      <button type="button" style={styles.dangerCompactButton} disabled={guardando} onClick={() => setEliminarPendiente({
                        tipo: "linea",
                        id: item.id,
                        numero_linea: item.numero_linea,
                        descripcion: item.descripcion_original,
                        total: item.costo_total,
                      })}>
                        <Trash2 size={15} /> Quitar
                      </button>
                    ) : null}
                  </div></td>
                </tr>
                {editandoId === item.id && form ? (
                  <tr>
                    <td colSpan={6} style={styles.editorCell}>
                      <div style={styles.editorGrid}>
                        <label style={styles.field}>Nombre
                          <input value={form.nombre_propuesto} onChange={(e) => setForm({ ...form, nombre_propuesto: e.target.value })} />
                        </label>
                        <label style={styles.field}>Variante
                          <input value={form.nombre_variante_propuesta} onChange={(e) => setForm({ ...form, nombre_variante_propuesta: e.target.value })} />
                        </label>
                        <label style={styles.field}>Rubro
                          <select value={form.rubro_propuesto} onChange={(e) => setForm({ ...form, rubro_propuesto: e.target.value, subtipo_propuesto: "" })}>
                            <option value="">Seleccionar...</option>
                            {catalogos.rubros.map((rubro) => <option key={rubro.id} value={rubro.nombre}>{rubro.label || rubro.nombre}</option>)}
                          </select>
                        </label>
                        <label style={styles.field}>Categoría
                          <select value={form.id_categoria_propuesta} onChange={(e) => setForm({ ...form, id_categoria_propuesta: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            {categoriasDisponibles.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                          </select>
                        </label>
                        <label style={styles.field}>Subtipo
                          <input list={`subtipos-${item.id}`} value={form.subtipo_propuesto} onChange={(e) => setForm({ ...form, subtipo_propuesto: e.target.value })} />
                          <datalist id={`subtipos-${item.id}`}>{subtiposDisponibles.map((subtipo) => <option key={subtipo} value={subtipo} />)}</datalist>
                        </label>
                        <MarcaField
                          value={form.id_marca_propuesta}
                          marcas={catalogos.marcas}
                          onChange={(value) => setForm({ ...form, id_marca_propuesta: value })}
                          onCreate={onCrearMarca}
                          onError={onError}
                        />
                        <label style={styles.checkField}>
                          <input type="checkbox" checked={form.serializable_propuesto} onChange={(e) => setForm({ ...form, serializable_propuesto: e.target.checked })} />
                          Controlar número de cuadro o serie
                        </label>
                      </div>
                      <section style={styles.itemImagePanel}>
                        <div style={styles.itemImageHeader}>
                          <div>
                            <strong>Imagen del producto <span style={styles.optionalLabel}>Opcional</span></strong>
                            <small style={styles.tableNote}>Se guardará como imagen principal cuando confirmes la recepción.</small>
                          </div>
                          <label style={{ ...styles.secondaryButton, ...styles.fileButton }}>
                            <Upload size={16} /> {procesandoImagenId === item.id ? "Subiendo..." : item.imagen_ruta_relativa ? "Reemplazar" : "Subir imagen"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              disabled={procesandoImagenId === item.id}
                              style={{ display: "none" }}
                              onChange={(event) => {
                                const archivo = event.target.files?.[0];
                                if (archivo) subirImagenItem(item, archivo);
                                event.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                        {item.imagen_ruta_relativa ? (
                          <div style={styles.itemImagePreviewRow}>
                            <img
                              src={getImageUrl(`/uploads/${item.imagen_ruta_relativa}`)}
                              alt={`Vista previa de ${item.descripcion_original}`}
                              style={styles.itemImagePreview}
                            />
                            <div style={styles.itemImageInfo}>
                              <strong>{item.imagen_nombre_original || "Imagen preparada"}</strong>
                              <small>Quedó adjunta a esta línea.</small>
                              <button type="button" style={styles.dangerCompactButton} disabled={procesandoImagenId === item.id} onClick={() => quitarImagenItem(item)}>
                                <Trash2 size={15} /> Quitar imagen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span style={styles.imageEmpty}>Podés continuar sin imagen y agregarla más adelante.</span>
                        )}
                      </section>
                      <section style={styles.integratedPricePanel}>
                        <div style={styles.integratedPriceHeader}>
                          <div>
                            <strong>Definir precios de venta</strong>
                            <small style={styles.tableNote}>
                              Costo final conciliado: {formatMoneyPrecise(item.costo_unitario_calculado || 0)} por unidad.
                            </small>
                          </div>
                          <button type="button" style={styles.compactButton} disabled={cargandoSugerencia} onClick={() => cargarSugerenciaPrecio(item, form)}>
                            <RefreshCw size={15} /> {cargandoSugerencia ? "Calculando..." : "Recalcular sugerido"}
                          </button>
                        </div>

                        {sugerenciaPrecio ? (
                          <div style={styles.itemSuggestionBand}>
                            <div style={styles.itemSuggestionMetric}>
                              <span>Minorista sugerido</span>
                              <strong>{formatMoneyPrecise(sugerenciaPrecio.precio_minorista_sugerido)}</strong>
                              <small>{sugerenciaPrecio.regla_minorista || "Sin regla aplicable"}{sugerenciaPrecio.margen_minorista_pct !== null ? ` · margen ${formatNumber(sugerenciaPrecio.margen_minorista_pct)}%` : ""}</small>
                            </div>
                            <div style={styles.itemSuggestionMetric}>
                              <span>Mayorista sugerido</span>
                              <strong>{formatMoneyPrecise(sugerenciaPrecio.precio_mayorista_sugerido)}</strong>
                              <small>{sugerenciaPrecio.regla_mayorista || "Sin regla aplicable"}{sugerenciaPrecio.margen_mayorista_pct !== null ? ` · margen ${formatNumber(sugerenciaPrecio.margen_mayorista_pct)}%` : ""}</small>
                            </div>
                            <button
                              type="button"
                              style={styles.primaryButton}
                              disabled={Number(sugerenciaPrecio.precio_minorista_sugerido || 0) <= 0 && Number(sugerenciaPrecio.precio_mayorista_sugerido || 0) <= 0}
                              onClick={usarPreciosSugeridos}
                            >
                              <Calculator size={17} /> Usar sugeridos
                            </button>
                          </div>
                        ) : null}
                        {errorSugerencia ? <p style={styles.priceWarning}>{errorSugerencia}</p> : null}

                        <HerramientasPrecioPanel
                          costo={item.costo_unitario_calculado}
                          porcentajeDescuentoContado={configuracionNegocio.porcentaje_descuento_contado_calculadora_precios}
                          onAplicarMinorista={(value) => setForm({ ...form, precio_minorista_propuesto: value })}
                          onAplicarMayorista={(value) => setForm({ ...form, precio_mayorista_propuesto: value })}
                          mostrarGanancia
                          textoAyuda="Podés partir del sugerido o calcular la lista desde lo que querés recibir en efectivo o transferencia."
                        />

                        <div style={styles.savedPricesBand}>
                          <div style={styles.savedPricesHeading}>
                            <strong>Precios que se guardarán</strong>
                            <small>Podés aceptar la sugerencia, usar la calculadora o escribirlos manualmente.</small>
                          </div>
                          <MoneyField label="Precio minorista / lista" value={form.precio_minorista_propuesto} onChange={(value) => setForm({ ...form, precio_minorista_propuesto: value })} />
                          <MoneyField label="Precio mayorista / lista" value={form.precio_mayorista_propuesto} onChange={(value) => setForm({ ...form, precio_mayorista_propuesto: value })} />
                        </div>
                        <small style={styles.priceSaveNotice}>Nada de este panel modifica el catálogo hasta que dejes el alta preparada y confirmes la recepción.</small>
                      </section>
                      <div style={styles.editorActions}>
                        <span style={styles.hint}>El SKU interno se generará automáticamente al confirmar la recepción.</span>
                        <button type="button" style={styles.secondaryButton} onClick={() => { setEditandoId(null); setSugerenciaPrecio(null); setErrorSugerencia(""); }}>Cancelar</button>
                        <button type="button" style={styles.primaryButton} disabled={guardando} onClick={() => guardarAlta(item)}>
                          <PackageCheck size={17} /> {guardando ? "Guardando..." : "Dejar alta preparada"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.phaseNotice}>
        <FileSpreadsheet size={20} />
        {detalle.estado === "confirmada"
          ? `Confirmada el ${formatDateTime(detalle.confirmada_at)}. Los ingresos quedaron vinculados a esta recepción.`
          : detalle.estado === "anulada"
            ? `Anulada${detalle.anulada_at ? ` el ${formatDateTime(detalle.anulada_at)}` : ""}. Motivo: ${detalle.motivo_anulacion || "sin detalle"}.`
            : "El borrador no modifica catálogo ni stock hasta que confirmes la recepción."}
      </div>

      {!['confirmada', 'anulada'].includes(detalle.estado) ? (
        <div style={{ ...styles.confirmBand, ...(detalle.estado === "lista_para_confirmar" ? styles.confirmBandReady : {}) }}>
          <div>
            <strong>{detalle.estado === "lista_para_confirmar" ? "Todo listo para ingresar" : "La confirmación todavía está bloqueada"}</strong>
            <small>
              {detalle.estado === "lista_para_confirmar"
                ? `${detalle.total_lineas} líneas · ${formatNumber(detalle.total_unidades)} unidades · ${formatMoneyPrecise(detalle.total_costo)}`
                : bloqueoConfirmacion}
            </small>
          </div>
          <button
            type="button"
            style={styles.confirmButton}
            disabled={detalle.estado !== "lista_para_confirmar" || confirmando}
            onClick={() => setMostrarConfirmacion(true)}
          >
            <ShieldCheck size={18} /> Confirmar e ingresar stock
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CostosPanel({ detalle, usuarioId, onChange, onError, onMessage }) {
  const [abierto, setAbierto] = useState(Boolean(detalle.costos));
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(() => crearFormularioCostos(detalle));
  const autoCalculoRef = useRef(null);

  useEffect(() => {
    setForm(crearFormularioCostos(detalle));
    if (detalle.costos) setAbierto(true);
  }, [detalle]);

  function cambiarCampo(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  }

  function cambiarDescuento(itemId, valor) {
    setForm((actual) => ({
      ...actual,
      descuentos_linea: {
        ...actual.descuentos_linea,
        [itemId]: valor,
      },
    }));
  }

  function cambiarNotaCreditoLinea(itemId, valor) {
    setForm((actual) => ({
      ...actual,
      notas_credito_linea: {
        ...actual.notas_credito_linea,
        [itemId]: valor,
      },
    }));
  }

  async function calcular(automatico = false) {
    const valores = automatico ? crearFormularioCostos(detalle) : form;
    setGuardando(true);
    onError("");
    try {
      const data = await configurarCostosRecepcionMercaderia(detalle.id, {
        descuento_global_pct: valores.descuento_global_pct || "0",
        bonificacion_factura: valores.bonificacion_factura || "0",
        nota_credito: valores.nota_credito || "0",
        nota_credito_modo: valores.nota_credito_modo || "global",
        flete: valores.flete || "0",
        iva_factura: valores.iva_factura || "0",
        otros_gastos: valores.otros_gastos || "0",
        impuestos_no_recuperables: valores.impuestos_no_recuperables || "0",
        total_documental: valores.total_documental === "" ? null : valores.total_documental,
        descuentos_linea: detalle.items.map((item) => ({
          id_item: item.id,
          descuento_pct: valores.descuentos_linea[item.id] || "0",
          nota_credito_monto: valores.notas_credito_linea[item.id] || "0",
        })),
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(automatico && data.costos?.conciliado
        ? "Costos finales calculados automáticamente desde la factura."
        : data.costos?.conciliado
          ? "Costos conciliados: el cálculo coincide con el documento."
          : "Costos calculados. Revisá la diferencia antes de confirmar.");
    } catch (err) {
      onError(err.message || "No se pudieron calcular los costos.");
    } finally {
      setGuardando(false);
    }
  }

  useEffect(() => {
    const factura = (detalle.documentos || []).find((documento) => documento.tipo_documento === "factura");
    const metadata = factura?.metadata_extraida || {};
    const lecturaCompleta = metadata.total_documental && metadata.bonificacion && metadata.flete && metadata.iva_21;
    if (detalle.costos || !lecturaCompleta || !detalle.items?.length || autoCalculoRef.current === detalle.id) return;
    autoCalculoRef.current = detalle.id;
    calcular(true);
  }, [detalle.id, detalle.costos, detalle.documentos, detalle.items]);

  const costos = detalle.costos;
  const notaCredito = Number(form.nota_credito || 0);
  const notaAsignada = Object.values(form.notas_credito_linea || {})
    .reduce((total, valor) => total + Number(valor || 0), 0);
  const notaPendiente = Math.round((notaCredito - notaAsignada) * 100) / 100;
  const gastos = costos
    ? Number(costos.flete || 0) + Number(costos.iva_factura || 0) + Number(costos.otros_gastos || 0) + Number(costos.impuestos_no_recuperables || 0)
    : 0;

  return (
    <section style={styles.costSection}>
      <button type="button" style={styles.costHeader} onClick={() => setAbierto((valor) => !valor)}>
        <span style={styles.costTitle}><Calculator size={19} /> Costos y conciliación</span>
        <span style={styles.costHeaderStatus}>
          {costos ? (
            <StatusBadge label={costos.conciliado ? "Conciliado" : "Con diferencia"} tone={costos.conciliado ? "success" : "danger"} />
          ) : "Configurar"}
        </span>
      </button>

      {abierto ? (
        <div style={styles.costBody}>
          <p style={styles.hint}>
            Los datos leídos de la factura quedan precargados. El sistema resta bonificaciones y notas de crédito, suma flete e IVA y distribuye todo por valor de mercadería.
          </p>

          <div style={styles.invoiceValuesBand}>
            <div style={styles.bandHeading}>
              <strong>Importes leídos de la factura</strong>
              <small>Revisalos solamente si el documento tiene una corrección.</small>
            </div>
            <MoneyField label="Bonificación de factura" value={form.bonificacion_factura} onChange={(value) => cambiarCampo("bonificacion_factura", value)} />
            <MoneyField label="Flete" value={form.flete} onChange={(value) => cambiarCampo("flete", value)} />
            <MoneyField label="IVA incluido en costo" value={form.iva_factura} onChange={(value) => cambiarCampo("iva_factura", value)} />
            <MoneyField label="Total final de la factura" value={form.total_documental} onChange={(value) => cambiarCampo("total_documental", value)} required />
          </div>

          <details style={styles.optionalCosts}>
            <summary style={styles.detailsSummary}>Otros ajustes opcionales</summary>
            <div style={styles.costFormGrid}>
              <MoneyField label="Descuento general" suffix="%" value={form.descuento_global_pct} onChange={(value) => cambiarCampo("descuento_global_pct", value)} />
              <MoneyField label="Nota de crédito" value={form.nota_credito} onChange={(value) => cambiarCampo("nota_credito", value)} />
              <MoneyField label="Otros gastos" value={form.otros_gastos} onChange={(value) => cambiarCampo("otros_gastos", value)} />
              <MoneyField label="Impuestos no recuperables" value={form.impuestos_no_recuperables} onChange={(value) => cambiarCampo("impuestos_no_recuperables", value)} />
            </div>
            {notaCredito > 0 ? (
              <div style={styles.creditModeBand}>
                <div>
                  <strong>¿Dónde impacta la nota de crédito?</strong>
                  <small>Elegí productos específicos cuando el proveedor corrigió artículos puntuales.</small>
                </div>
                <div style={styles.creditModeButtons}>
                  <button
                    type="button"
                    style={{ ...styles.modeButton, ...(form.nota_credito_modo === "global" ? styles.modeButtonActive : {}) }}
                    onClick={() => cambiarCampo("nota_credito_modo", "global")}
                  >Toda la factura</button>
                  <button
                    type="button"
                    style={{ ...styles.modeButton, ...(form.nota_credito_modo === "lineas" ? styles.modeButtonActive : {}) }}
                    onClick={() => cambiarCampo("nota_credito_modo", "lineas")}
                  >Productos específicos</button>
                </div>
                {form.nota_credito_modo === "lineas" ? (
                  <strong style={Math.abs(notaPendiente) <= 0.01 ? styles.creditAssigned : styles.creditPending}>
                    Asignado {formatMoneyPrecise(notaAsignada)} de {formatMoneyPrecise(notaCredito)}
                    {Math.abs(notaPendiente) > 0.01 ? ` · Falta ${formatMoneyPrecise(notaPendiente)}` : " · Completo"}
                  </strong>
                ) : null}
              </div>
            ) : null}
          </details>

          <details style={styles.lineDiscounts}>
            <summary style={styles.detailsSummary}>Ajustes propios de cada renglón</summary>
            <div style={styles.lineDiscountGrid}>
              {detalle.items.map((item) => (
                <label key={item.id} style={styles.lineDiscountRow}>
                  <span>
                    <strong>{item.codigo_proveedor || `Línea ${item.numero_linea}`}</strong>
                    <small style={styles.lineDiscountDescription}>{item.descripcion_original}</small>
                  </span>
                  <span style={styles.lineAdjustInputs}>
                    <label style={styles.compactField}>
                      <small>Descuento</small>
                      <span style={styles.percentInput}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={form.descuentos_linea[item.id] || ""}
                          onChange={(event) => cambiarDescuento(item.id, event.target.value)}
                        />
                        <b>%</b>
                      </span>
                    </label>
                    {notaCredito > 0 && form.nota_credito_modo === "lineas" ? (
                      <label style={styles.compactField}>
                        <small>Nota de crédito</small>
                        <span style={styles.percentInput}>
                          <b>$</b>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.notas_credito_linea[item.id] || ""}
                            onChange={(event) => cambiarNotaCreditoLinea(item.id, event.target.value)}
                          />
                        </span>
                      </label>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </details>

          {costos ? (
            <>
            {!costos.conciliado ? (
              <div style={styles.conciliationWarning}>
                <AlertTriangle size={18} />
                <span>
                  {costos.total_documental === null || costos.total_documental === undefined ? (
                    <>
                      <strong>Falta confirmar el total del comprobante.</strong>
                      {` Las líneas suman ${formatMoneyPrecise(costos.total_calculado)}. Revisá ese importe arriba y volvé a calcular.`}
                    </>
                  ) : (
                    <>
                      <strong>El cálculo no coincide con la factura.</strong>
                      {Number(costos.diferencia_conciliacion || 0) > 0
                        ? ` Faltan ${formatMoneyPrecise(costos.diferencia_conciliacion)} en las líneas o ajustes cargados. Revisá si se quitó algún producto de la factura.`
                        : ` El cálculo supera la factura por ${formatMoneyPrecise(Math.abs(Number(costos.diferencia_conciliacion || 0)))}. Revisá cantidades, costos y ajustes.`}
                    </>
                  )}
                </span>
              </div>
            ) : null}
            <div style={styles.costResult}>
              {Number(costos.subtotal_bruto || 0) !== Number(costos.total_calculado || 0) ? (
                <CostMetric
                  label={Number(costos.subtotal_bruto || 0) > Number(costos.total_calculado || 0) ? "Descuento percibido neto" : "Recargo neto"}
                  value={Math.abs(Number(costos.subtotal_bruto || 0) - Number(costos.total_calculado || 0))}
                  strong
                />
              ) : null}
              <CostMetric label="Mercadería bruta" value={costos.subtotal_bruto} />
              <CostMetric label="Descuentos por línea" value={-Number(costos.descuento_lineas_total || 0)} />
              <CostMetric label="Descuento general" value={-Number(costos.descuento_global_monto || 0)} />
              <CostMetric label="Bonificación de factura" value={-Number(costos.bonificacion_factura || 0)} />
              <CostMetric label="Nota de crédito" value={-Number(costos.nota_credito || 0)} />
              <CostMetric label="Gastos e impuestos" value={gastos} />
              <CostMetric label="Total calculado" value={costos.total_calculado} strong />
              <CostMetric label="Total factura" value={costos.total_documental} strong />
              <CostMetric
                label="Diferencia"
                value={costos.diferencia_conciliacion}
                strong
                danger={!costos.conciliado}
              />
            </div>
            </>
          ) : null}

          <div style={styles.costFooter}>
            <span style={styles.hint}>El costo unitario final queda guardado por producto y se puede auditar.</span>
            <button type="button" style={styles.primaryButton} disabled={guardando || ["confirmada", "anulada"].includes(detalle.estado)} onClick={calcular}>
              <Calculator size={17} /> {detalle.estado === "confirmada" ? "Costos confirmados" : detalle.estado === "anulada" ? "Recepción anulada" : guardando ? "Calculando..." : "Calcular y guardar"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function crearFormularioCostos(detalle) {
  const costos = detalle.costos || {};
  const documentos = detalle.documentos || [];
  const factura = documentos.find((documento) =>
    documento.tipo_documento === "factura" && documento.metadata_extraida?.total_documental
  );
  const notasCredito = documentos
    .filter((documento) => documento.tipo_documento === "nota_credito" && documento.metadata_extraida?.total_documental)
    .reduce((total, documento) => total + Number(documento.metadata_extraida.total_documental || 0), 0);
  const totalFacturaDetectado = Math.max(
    0,
    Number(factura?.metadata_extraida?.total_documental || 0) - notasCredito,
  );
  const totalListaPegada = detalle.origen_carga === "tabla_pegada"
    ? Number(costos.total_calculado ?? detalle.total_costo ?? 0)
    : 0;
  return {
    descuento_global_pct: String(costos.descuento_global_pct ?? ""),
    bonificacion_factura: costos.bonificacion_factura === undefined
      ? String(factura?.metadata_extraida?.bonificacion || "")
      : String(costos.bonificacion_factura ?? ""),
    nota_credito: costos.nota_credito === undefined ? String(notasCredito || "") : String(costos.nota_credito ?? ""),
    nota_credito_modo: String(costos.nota_credito_modo || "global"),
    flete: costos.flete === undefined ? String(factura?.metadata_extraida?.flete || "") : String(costos.flete ?? ""),
    iva_factura: costos.iva_factura === undefined
      ? String(factura?.metadata_extraida?.iva_21 || "")
      : String(costos.iva_factura ?? ""),
    otros_gastos: String(costos.otros_gastos ?? ""),
    impuestos_no_recuperables: String(costos.impuestos_no_recuperables ?? ""),
    total_documental: costos.total_documental === null || costos.total_documental === undefined
      ? String(totalFacturaDetectado || totalListaPegada || "")
      : String(costos.total_documental),
    descuentos_linea: Object.fromEntries(
      detalle.items.map((item) => [item.id, String(item.descuento_linea_pct || "")]),
    ),
    notas_credito_linea: Object.fromEntries(
      detalle.items.map((item) => [item.id, String(item.nota_credito_linea_monto || "")]),
    ),
  };
}

function describirBloqueoConfirmacion(detalle) {
  const items = detalle.items || [];
  const lecturasPendientes = items.filter((item) => item.lectura_confirmada === false).length;
  if (lecturasPendientes > 0) {
    return `Falta confirmar la lectura de ${lecturasPendientes} línea${lecturasPendientes === 1 ? "" : "s"}.`;
  }

  const lineasPendientes = items.filter(
    (item) => !["exacta", "alta_preparada"].includes(item.estado_resolucion),
  ).length;
  if (lineasPendientes > 0) {
    return `Falta resolver ${lineasPendientes} línea${lineasPendientes === 1 ? "" : "s"} de productos.`;
  }

  const altasSinPrecio = items.filter((item) => (
    item.estado_resolucion === "alta_preparada"
    && (Number(item.precio_minorista_propuesto || 0) <= 0 || Number(item.precio_mayorista_propuesto || 0) <= 0)
  )).length;
  if (altasSinPrecio > 0) {
    return `Falta completar los precios de ${altasSinPrecio} producto${altasSinPrecio === 1 ? "" : "s"} nuevo${altasSinPrecio === 1 ? "" : "s"}.`;
  }

  if (!detalle.costos) {
    return "Falta calcular y guardar los costos de la recepción.";
  }
  if (detalle.costos.total_documental === null || detalle.costos.total_documental === undefined) {
    return "Falta confirmar el total del comprobante en Costos y conciliación.";
  }
  if (!detalle.costos.conciliado) {
    return "El total calculado no coincide con el total del comprobante.";
  }

  return "Revisá los datos pendientes antes de confirmar el ingreso.";
}

function PreciosPanel({ detalle, usuarioId, onChange, onError, onMessage }) {
  const revisados = detalle.items.filter((item) => item.precio_revisado).length;
  const [abierto, setAbierto] = useState(revisados > 0);
  const [procesando, setProcesando] = useState(false);
  const [estrategia, setEstrategia] = useState("reglas");
  const [alerta, setAlerta] = useState("30");
  const [redondeo, setRedondeo] = useState("100");
  const [editando, setEditando] = useState(null);

  async function generarPreview() {
    setProcesando(true);
    onError("");
    try {
      const data = await previsualizarPreciosRecepcionMercaderia(detalle.id, {
        estrategia,
        variacion_alerta_pct: alerta || "30",
        redondeo_base: redondeo || "100",
        id_usuario: usuarioId,
      });
      onChange(data);
      const cantidadAlertas = data.items.filter((item) => item.alerta_precio).length;
      onMessage(cantidadAlertas
        ? `Vista previa lista. Hay ${cantidadAlertas} cambio(s) para revisar.`
        : "Vista previa lista. No se detectaron variaciones atípicas.");
      setAbierto(true);
    } catch (err) {
      onError(err.message || "No se pudo calcular la vista previa de precios.");
    } finally {
      setProcesando(false);
    }
  }

  async function guardarManual(item) {
    setProcesando(true);
    onError("");
    try {
      const data = await guardarPrecioRecepcionMercaderia(detalle.id, item.id, {
        precio_minorista: editando.precio_minorista,
        precio_mayorista: editando.precio_mayorista,
        id_usuario: usuarioId,
      });
      onChange(data);
      onMessage(`Precios de la línea ${item.numero_linea} revisados.`);
      setEditando(null);
    } catch (err) {
      onError(err.message || "No se pudieron guardar los precios.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section style={styles.costSection}>
      <button type="button" style={styles.costHeader} onClick={() => setAbierto((value) => !value)}>
        <span style={styles.costTitle}><ChartNoAxesCombined size={19} /> Precios de venta</span>
        <span style={styles.costHeaderStatus}>{revisados}/{detalle.items.length} revisados</span>
      </button>
      {abierto ? (
        <div style={styles.costBody}>
          <div style={styles.priceToolbar}>
            <label style={styles.field}>Estrategia
              <select value={estrategia} onChange={(event) => setEstrategia(event.target.value)}>
                <option value="reglas">Aplicar reglas comerciales</option>
                <option value="mantener_margen">Mantener margen actual</option>
                <option value="mantener_actuales">Mantener precios actuales</option>
              </select>
            </label>
            <MoneyField label="Alertar desde" suffix="%" value={alerta} onChange={setAlerta} />
            <MoneyField label="Redondear a" value={redondeo} onChange={setRedondeo} />
            <button type="button" style={styles.primaryButton} disabled={procesando || !detalle.costos?.conciliado || ["confirmada", "anulada"].includes(detalle.estado)} onClick={generarPreview}>
              <ChartNoAxesCombined size={17} /> {procesando ? "Calculando..." : "Generar vista previa"}
            </button>
          </div>
          {!detalle.costos?.conciliado ? <p style={styles.priceWarning}>Primero conciliá los costos para calcular precios confiables.</p> : null}
          <div style={styles.tableWrap}>
            <table style={{ ...styles.table, minWidth: 1050 }}>
              <thead><tr><th>Producto</th><th>Costo</th><th>Minorista</th><th>Margen</th><th>Mayorista</th><th>Margen</th><th>Regla / alerta</th><th>Acción</th></tr></thead>
              <tbody>
                {detalle.items.map((item) => (
                  <tr key={`precio-${item.id}`}>
                    <td><strong>{item.descripcion_original}</strong><small style={styles.tableNote}>{item.codigo_proveedor}</small></td>
                    <td><small style={styles.tableNote}>Antes {formatMoneyPrecise(item.costo_anterior_snapshot || 0)}</small><strong>{formatMoneyPrecise(item.costo_unitario_calculado || 0)}</strong></td>
                    <td><small style={styles.tableNote}>Antes {formatMoneyPrecise(item.precio_minorista_anterior_snapshot || 0)}</small><strong>{item.precio_minorista_propuesto ? formatMoneyPrecise(item.precio_minorista_propuesto) : "-"}</strong></td>
                    <td>{item.margen_minorista_resultante_pct == null ? "-" : `${formatNumber(item.margen_minorista_resultante_pct)}%`}</td>
                    <td><small style={styles.tableNote}>Antes {formatMoneyPrecise(item.precio_mayorista_anterior_snapshot || 0)}</small><strong>{item.precio_mayorista_propuesto ? formatMoneyPrecise(item.precio_mayorista_propuesto) : "-"}</strong></td>
                    <td>{item.margen_mayorista_resultante_pct == null ? "-" : `${formatNumber(item.margen_mayorista_resultante_pct)}%`}</td>
                    <td>
                      <small style={styles.tableNote}>{item.regla_minorista_snapshot || item.estrategia_precio || "Sin calcular"}</small>
                      {item.alerta_precio ? <span style={styles.priceAlert}><AlertTriangle size={13} /> {item.alerta_precio}</span> : null}
                    </td>
                    <td>
                      <button type="button" style={styles.compactButton} disabled={["confirmada", "anulada"].includes(detalle.estado)} onClick={() => setEditando({ id: item.id, precio_minorista: String(item.precio_minorista_propuesto || ""), precio_mayorista: String(item.precio_mayorista_propuesto || "") })}>
                        <Pencil size={14} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editando ? (() => {
            const item = detalle.items.find((row) => row.id === editando.id);
            return (
              <div style={styles.priceEditor}>
                <strong>{item?.descripcion_original}</strong>
                <MoneyField label="Precio minorista" value={editando.precio_minorista} onChange={(value) => setEditando({ ...editando, precio_minorista: value })} />
                <MoneyField label="Precio mayorista" value={editando.precio_mayorista} onChange={(value) => setEditando({ ...editando, precio_mayorista: value })} />
                <button type="button" style={styles.secondaryButton} onClick={() => setEditando(null)}>Cancelar</button>
                <button type="button" style={styles.primaryButton} disabled={procesando} onClick={() => guardarManual(item)}>Guardar precios</button>
              </div>
            );
          })() : null}
          <p style={styles.hint}>La vista previa no modifica el catálogo. Los precios se aplican junto con el stock al confirmar la recepción.</p>
        </div>
      ) : null}
    </section>
  );
}

function MarcaField({ value, marcas, onChange, onCreate, onError }) {
  const [mostrandoAlta, setMostrandoAlta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardarMarca() {
    if (nombre.trim().length < 2) {
      onError("Escribí el nombre de la nueva marca.");
      return;
    }
    setGuardando(true);
    onError("");
    try {
      const nueva = await onCreate(nombre);
      onChange(String(nueva.id));
      setNombre("");
      setMostrandoAlta(false);
    } catch (err) {
      onError(err.message || "No se pudo crear la marca.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={styles.field}>
      <span>Marca</span>
      <div style={styles.brandSelectRow}>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Sin marca</option>
          {marcas.map((marca) => <option key={marca.id} value={marca.id}>{marca.nombre}</option>)}
        </select>
        <button type="button" style={styles.iconButton} title="Crear marca" onClick={() => setMostrandoAlta((actual) => !actual)}>
          <Plus size={17} />
        </button>
      </div>
      {mostrandoAlta ? (
        <div style={styles.brandCreateRow}>
          <input value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Nueva marca" autoFocus />
          <button type="button" style={styles.compactButton} disabled={guardando} onClick={guardarMarca}>
            {guardando ? "Creando..." : "Crear"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MoneyField({ label, value, onChange, suffix = "$", required = false }) {
  return (
    <label style={styles.field}>
      {label}{required ? " *" : ""}
      <span style={styles.moneyInput}>
        {suffix === "$" ? <b>$</b> : null}
        <input style={styles.moneyTextInput} type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} />
        {suffix !== "$" ? <b>{suffix}</b> : null}
      </span>
    </label>
  );
}

function CostMetric({ label, value, strong = false, danger = false }) {
  return (
    <div style={{ ...styles.costMetric, ...(strong ? styles.costMetricStrong : {}), ...(danger ? styles.costMetricDanger : {}) }}>
      <span>{label}</span>
      <b>{value === null || value === undefined ? "-" : formatMoneyPrecise(value)}</b>
    </div>
  );
}

function FieldConfidence({ value, origin }) {
  if (origin !== "ocr" || value === null || value === undefined) return null;
  const percent = Math.round(Number(value) * 100);
  return (
    <small style={{ ...styles.fieldConfidence, ...(percent < 85 ? styles.fieldConfidenceLow : {}) }}>
      OCR {percent}%
    </small>
  );
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const DOCUMENT_TYPES = {
  factura: "Factura",
  pedido: "Pedido",
  nota_credito: "Nota de crédito",
  lista: "Lista",
  imagen: "Imagen",
  documento: "Documento",
};

function StatusBadge({ label, tone = "info" }) {
  return <span style={{ ...styles.badge, ...(styles[`${tone}Badge`] || {}) }}>{label}</span>;
}

const styles = {
  page: { display: "grid", gap: 18, color: "#0f172a" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 },
  eyebrow: { margin: 0, color: "#f15a00", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  title: { margin: "4px 0 2px", fontSize: 30, lineHeight: 1.1 },
  subtitle: { margin: 0, color: "#526078" },
  sectionTitle: { margin: 0, fontSize: 21 },
  hint: { margin: "4px 0 0", color: "#667085", fontSize: 14 },
  error: { display: "flex", alignItems: "center", gap: 9, padding: 13, border: "1px solid #fca5a5", background: "#fff1f2", color: "#b42318", borderRadius: 7, fontWeight: 700 },
  success: { display: "flex", alignItems: "center", gap: 9, padding: 13, border: "1px solid #86efac", background: "#ecfdf3", color: "#067647", borderRadius: 7, fontWeight: 700 },
  importBand: { display: "grid", gap: 16, padding: 20, background: "#fff", border: "1px solid #d8e0eb", borderRadius: 8, boxShadow: "0 5px 18px rgba(15,23,42,.06)" },
  importHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: "1px solid #e5eaf1", paddingBottom: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 },
  field: { display: "grid", gap: 7, fontWeight: 800, fontSize: 14 },
  checkField: { display: "flex", alignItems: "center", gap: 8, minHeight: 42, fontWeight: 800, fontSize: 14 },
  importFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" },
  documentsBand: { display: "grid", gap: 10, padding: 14, border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 8 },
  documentsTitle: { display: "flex", alignItems: "center", gap: 8 },
  documentsHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  documentRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" },
  documentActions: { display: "flex", alignItems: "center", gap: 8 },
  documentWarning: { gridColumn: "1 / -1", color: "#9a3412", fontWeight: 700 },
  documentComparison: { gridColumn: "1 / -1", color: "#334155", fontWeight: 700 },
  readingEditor: { display: "grid", gap: 14, padding: 16, border: "1px solid #93c5fd", background: "#eff6ff", borderRadius: 8 },
  readingGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 },
  fieldConfidence: { display: "block", marginTop: 4, color: "#166534", fontWeight: 800, fontSize: 11 },
  fieldConfidenceLow: { color: "#b45309" },
  formatHelp: { display: "flex", alignItems: "center", gap: 8, color: "#526078", fontSize: 13 },
  primaryButton: { border: 0, background: "#ff6500", color: "#fff", minHeight: 44, padding: "0 18px", borderRadius: 7, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", minHeight: 42, padding: "0 14px", borderRadius: 7, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" },
  dangerButton: { border: "1px solid #fca5a5", background: "#fff1f2", color: "#b42318", minHeight: 40, padding: "0 14px", borderRadius: 7, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" },
  iconButton: { width: 42, height: 42, border: "1px solid #cbd5e1", background: "#fff", borderRadius: 7, display: "grid", placeItems: "center", cursor: "pointer" },
  dangerIconButton: { width: 42, height: 42, border: "1px solid #fca5a5", background: "#fff1f2", color: "#b42318", borderRadius: 7, display: "grid", placeItems: "center", cursor: "pointer" },
  detailSection: { display: "grid", gap: 16, background: "#fff", border: "1px solid #d8e0eb", borderRadius: 8, padding: 20, boxShadow: "0 5px 18px rgba(15,23,42,.06)" },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  headerActions: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", justifyContent: "flex-end" },
  cancelBand: { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto auto", alignItems: "end", gap: 10, padding: 14, border: "1px solid #fca5a5", background: "#fff1f2", borderRadius: 7 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 },
  summaryItem: { display: "grid", gap: 5, padding: 12, border: "1px solid #dbe3ee", background: "#f8fafc", borderRadius: 7 },
  learningBand: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, alignItems: "center", padding: 14, border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 7, fontSize: 13 },
  rulesBand: { display: "grid", gap: 10, padding: 14, border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 7 },
  ruleRow: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto auto auto", alignItems: "center", gap: 9, paddingTop: 10, borderTop: "1px solid #fed7aa" },
  successSummary: { borderColor: "#86efac", background: "#ecfdf3" },
  infoSummary: { borderColor: "#bfdbfe", background: "#eff6ff" },
  dangerSummary: { borderColor: "#fca5a5", background: "#fff1f2" },
  tableWrap: { overflowX: "auto", border: "1px solid #dbe3ee", borderRadius: 7 },
  table: { width: "100%", minWidth: 1280, tableLayout: "fixed", borderCollapse: "collapse", fontSize: 13 },
  productCell: { minWidth: 0, verticalAlign: "top" },
  productMeta: { display: "flex", alignItems: "center", gap: 8, marginBottom: 5, color: "#526078", fontSize: 11, fontWeight: 800, flexWrap: "wrap" },
  tableNote: { display: "block", marginTop: 4, color: "#667085", fontWeight: 500 },
  proposalNote: { display: "block", marginTop: 5, color: "#175cd3", fontWeight: 700 },
  duplicatePanel: { display: "grid", gap: 7, marginTop: 8, padding: 9, border: "1px solid #fdba74", borderRadius: 6, background: "#fff7ed" },
  duplicateWarning: { display: "flex", alignItems: "center", gap: 6, color: "#9a3412" },
  duplicateCandidate: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 7, borderTop: "1px solid #fed7aa" },
  duplicateCandidateText: { display: "grid", gap: 2, minWidth: 0 },
  duplicateUseButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, flexShrink: 0, minHeight: 32, padding: "5px 9px", border: "1px solid #16a34a", borderRadius: 6, background: "#f0fdf4", color: "#166534", fontWeight: 800, cursor: "pointer" },
  duplicateNewButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, minHeight: 32, padding: "5px 9px", border: "1px solid #c2410c", borderRadius: 6, background: "#fff", color: "#9a3412", fontWeight: 800, cursor: "pointer" },
  finalCost: { display: "block", marginTop: 4, color: "#067647", fontWeight: 900 },
  receivedDiscount: { display: "block", marginTop: 4, color: "#175cd3", fontWeight: 800 },
  receivedSurcharge: { display: "block", marginTop: 4, color: "#b54708", fontWeight: 800 },
  costAlert: { display: "flex", alignItems: "flex-start", gap: 5, marginTop: 6, color: "#b42318", fontWeight: 800, maxWidth: 220 },
  reviewBar: { display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  bulkBand: { display: "grid", gridTemplateColumns: "auto repeat(4, minmax(150px, 1fr)) auto auto", alignItems: "end", gap: 10, padding: 14, border: "1px solid #93c5fd", background: "#eff6ff", borderRadius: 7 },
  bulkTitle: { display: "flex", alignItems: "center", gap: 7, alignSelf: "center", whiteSpace: "nowrap" },
  filterField: { display: "grid", gap: 5, minWidth: 210, fontSize: 13, fontWeight: 800 },
  compactButton: { border: "1px solid #bfd0e5", background: "#fff", color: "#175cd3", minHeight: 34, padding: "0 10px", borderRadius: 7, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" },
  dangerCompactButton: { border: "1px solid #fecaca", background: "#fff", color: "#b42318", minHeight: 34, padding: "0 10px", borderRadius: 7, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" },
  rowActions: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 },
  lineNumber: { marginLeft: 7 },
  editorCell: { background: "#f8fafc", padding: 16 },
  editorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 },
  brandSelectRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 42px", gap: 7 },
  brandCreateRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 7 },
  integratedPricePanel: { display: "grid", gap: 12, marginTop: 16, padding: 14, border: "1px solid #bfdbfe", borderRadius: 8, background: "#f8fbff" },
  itemImagePanel: { display: "grid", gap: 12, marginTop: 16, padding: 14, border: "1px solid #dbe3ee", borderRadius: 8, background: "#fff" },
  itemImageHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  optionalLabel: { marginLeft: 6, padding: "3px 6px", borderRadius: 5, background: "#f2f4f7", color: "#667085", fontSize: 11 },
  fileButton: { cursor: "pointer" },
  itemImagePreviewRow: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  itemImagePreview: { width: 150, height: 120, objectFit: "contain", border: "1px solid #dbe3ee", borderRadius: 7, background: "#f8fafc" },
  itemImageInfo: { display: "grid", gap: 7, alignItems: "start" },
  imageEmpty: { color: "#667085", fontSize: 13 },
  integratedPriceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  itemSuggestionBand: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, alignItems: "stretch" },
  itemSuggestionMetric: { display: "grid", gap: 4, padding: 11, border: "1px solid #93c5fd", borderRadius: 7, background: "#eff6ff" },
  savedPricesBand: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end", padding: 12, border: "1px solid #fdba74", borderRadius: 7, background: "#fff7ed" },
  savedPricesHeading: { display: "grid", gap: 4, color: "#7c2d12" },
  priceSaveNotice: { color: "#526078", fontWeight: 700 },
  editorActions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 14 },
  costSection: { border: "1px solid #bfd0e5", borderRadius: 8, overflow: "hidden", background: "#fff" },
  costHeader: { width: "100%", border: 0, background: "#f8fafc", color: "#0f172a", padding: "13px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" },
  costTitle: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 900 },
  costHeaderStatus: { fontWeight: 800, color: "#526078" },
  costBody: { display: "grid", gap: 16, padding: 16, borderTop: "1px solid #dbe3ee" },
  invoiceValuesBand: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, padding: 14, border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 7 },
  bandHeading: { gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "#334155" },
  costFormGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, paddingTop: 12 },
  moneyInput: { display: "flex", alignItems: "center", gap: 8, minWidth: 0, minHeight: 42, border: "1px solid #cbd5e1", borderRadius: 7, padding: "0 11px", background: "#fff" },
  moneyTextInput: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", fontWeight: 800 },
  optionalCosts: { border: "1px solid #dbe3ee", borderRadius: 7, padding: "11px 13px", background: "#fff" },
  lineDiscounts: { border: "1px solid #dbe3ee", borderRadius: 7, padding: "11px 13px", background: "#fff" },
  detailsSummary: { cursor: "pointer", fontWeight: 900, color: "#334155" },
  lineDiscountGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 8, paddingTop: 12 },
  lineDiscountRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(170px, 210px)", alignItems: "center", gap: 10, border: "1px solid #dbe3ee", borderRadius: 7, padding: 10 },
  lineAdjustInputs: { display: "grid", gap: 7, minWidth: 150 },
  compactField: { display: "grid", gap: 3, color: "#526078", fontWeight: 800 },
  lineDiscountDescription: { display: "block", marginTop: 3, color: "#526078", lineHeight: 1.25 },
  percentInput: { display: "flex", alignItems: "center", gap: 6 },
  creditModeBand: { gridColumn: "1 / -1", display: "grid", gap: 10, paddingTop: 12, borderTop: "1px solid #dbe3ee" },
  creditModeButtons: { display: "flex", gap: 8, flexWrap: "wrap" },
  modeButton: { minHeight: 38, padding: "0 13px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer" },
  modeButtonActive: { borderColor: "#2563eb", background: "#eff6ff", color: "#1d4ed8" },
  creditAssigned: { color: "#067647" },
  creditPending: { color: "#b42318" },
  costResult: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, padding: 12, background: "#f8fafc", border: "1px solid #dbe3ee", borderRadius: 7 },
  conciliationWarning: { display: "flex", alignItems: "flex-start", gap: 9, padding: 12, border: "1px solid #fca5a5", background: "#fff1f2", color: "#b42318", borderRadius: 7 },
  costMetric: { display: "grid", gap: 4, color: "#526078", fontSize: 13 },
  costMetricStrong: { color: "#0f172a", fontSize: 14 },
  costMetricDanger: { color: "#b42318" },
  costFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  priceToolbar: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" },
  priceWarning: { margin: 0, padding: 11, border: "1px solid #fbbf24", background: "#fffbeb", color: "#92400e", borderRadius: 7, fontWeight: 800 },
  priceAlert: { display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, padding: "4px 7px", background: "#fff4d6", color: "#9a4d00", borderRadius: 6, fontSize: 11, fontWeight: 900 },
  priceEditor: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end", padding: 13, border: "1px solid #93c5fd", background: "#eff6ff", borderRadius: 7 },
  confirmBand: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 15, border: "1px solid #fca5a5", background: "#fff1f2", borderRadius: 8 },
  confirmBandReady: { borderColor: "#86efac", background: "#ecfdf3" },
  confirmButton: { border: 0, background: "#067647", color: "#fff", minHeight: 44, padding: "0 17px", borderRadius: 7, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" },
  phaseNotice: { display: "flex", alignItems: "center", gap: 9, color: "#475467", background: "#f8fafc", border: "1px solid #dbe3ee", padding: 12, borderRadius: 7, fontSize: 13 },
  badge: { display: "inline-flex", alignItems: "center", width: "fit-content", padding: "5px 9px", borderRadius: 999, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
  successBadge: { background: "#dcfae6", color: "#067647" },
  warningBadge: { background: "#fff4d6", color: "#9a4d00" },
  infoBadge: { background: "#dbeafe", color: "#175cd3" },
  dangerBadge: { background: "#fee4e2", color: "#b42318" },
  listSection: { display: "grid", gap: 12, paddingTop: 4 },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 },
  draftList: { display: "grid", gap: 8, overflowX: "auto" },
  draftRow: { width: "100%", minWidth: 760, border: "1px solid #d8e0eb", background: "#fff", borderRadius: 7, padding: 13, display: "grid", gridTemplateColumns: "70px minmax(220px, 1fr) 100px 100px 150px", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer" },
  draftId: { color: "#f15a00", fontWeight: 900 },
  draftMain: { display: "grid", gap: 3 },
  draftMetric: { fontSize: 13, color: "#475467", fontWeight: 700 },
  empty: { padding: 26, textAlign: "center", border: "1px dashed #cbd5e1", color: "#667085", borderRadius: 7 },
};
