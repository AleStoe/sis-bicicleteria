import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Calculator, ChevronDown, ChevronUp, Download, FileSpreadsheet, Link2, Plus, RefreshCw, RotateCcw, Save, Search, ShieldCheck, Unlink, Upload } from "lucide-react";
import { listarCatalogoPOS } from "../../services/catalogoService";
import {
  anularLotePrecios,
  aplicarListaPrecios,
  actualizarPreviewItemLista,
  descargarInformeListaPrecios,
  generarPreviewLista,
  guardarPerfilListaPrecios,
  importarListaPrecios,
  listarLotesPrecios,
  obtenerLotePrecios,
  procesarCoincidenciasLista,
  revertirListaPrecios,
  vincularItemLista,
  desvincularItemLista,
} from "../../services/preciosService";

const ACTIVE_STATES = new Set(["borrador", "requiere_revision", "listo_para_revisar", "listo_para_aplicar"]);
const PENDING_STATES = new Set(["borrador", "requiere_revision", "listo_para_revisar", "listo_para_aplicar", "error"]);
const FILTER_STORAGE_KEY = "precios_listas_filtros";
const SELECTED_LOT_STORAGE_KEY = "precios_lista_lote_seleccionado";
const PREVIEW_STRATEGIES = [
  ["conservar_margen", "Conservar margen actual"],
  ["usar_regla", "Usar regla comercial"],
  ["mantener_precio", "Mantener precio vigente"],
  ["manual", "Definir manualmente"],
  ["ignorar", "Ignorar"],
];

function stateLabel(value) {
  return {
    borrador: "Borrador",
    requiere_revision: "Requiere revisión",
    listo_para_revisar: "Lista para revisar",
    listo_para_aplicar: "Lista para aplicar",
    anulado: "Anulada",
    aplicado: "Aplicada",
    revertido: "Revertida",
    error: "Error",
    pendiente: "Pendiente",
    exacta: "Exacta",
    sugerida: "Sugerida",
    ambigua: "Ambigua",
    sin_coincidencia: "Sin coincidencia",
    descartada: "Descartada",
  }[value] || value;
}

function originLabel(value) {
  return {
    alias_proveedor: "Código aprendido",
    codigo_proveedor: "Código del proveedor",
    sku: "SKU exacto",
    ean: "EAN exacto",
    manual: "Confirmada manualmente",
  }[value] || value;
}

export default function ListasPreciosPanel({
  proveedores,
  usuarioId,
  sucursalId,
  porcentajeDescuentoContado = 10,
  styles,
  isMobile,
  isNarrow,
}) {
  const fileRef = useRef(null);
  const [lotes, setLotes] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState({ idProveedor: "", observaciones: "" });
  const [perfilNombre, setPerfilNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchItem, setSearchItem] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [aliasConflict, setAliasConflict] = useState(null);
  const [previewForm, setPreviewForm] = useState({
    estrategia: "conservar_margen",
    descuentoMinorista: String(porcentajeDescuentoContado ?? 10),
    descuentoMayorista: "0",
    redondeoMinorista: "100",
    redondeoMayorista: "100",
    alertaVariacion: "10",
  });
  const [editingPreviewId, setEditingPreviewId] = useState(null);
  const [actionMode, setActionMode] = useState(null);
  const [revertReason, setRevertReason] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showReading, setShowReading] = useState(true);
  const [showPreviewSettings, setShowPreviewSettings] = useState(true);
  const [itemQuery, setItemQuery] = useState("");
  const [itemScope, setItemScope] = useState("todos");
  const [lotFilters, setLotFilters] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY)) || { scope: "pendientes", query: "", provider: "" };
    } catch {
      return { scope: "pendientes", query: "", provider: "" };
    }
  });

  useEffect(() => {
    refreshLots();
  }, []);

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(lotFilters));
  }, [lotFilters]);

  async function refreshLots() {
    try {
      setLoading(true);
      setError("");
      const data = (await listarLotesPrecios({ limit: 200 })) || [];
      setLotes(data);
      if (!detalle && data.length > 0) {
        const rememberedId = Number(localStorage.getItem(SELECTED_LOT_STORAGE_KEY));
        const remembered = data.find((lot) => lot.id === rememberedId);
        const scopeMatches = remembered && (lotFilters.scope === "pendientes" ? PENDING_STATES.has(remembered.estado) : !PENDING_STATES.has(remembered.estado));
        const initial = (scopeMatches ? remembered : null)
          || data.find((lot) => lotFilters.scope === "pendientes" ? PENDING_STATES.has(lot.estado) : !PENDING_STATES.has(lot.estado))
          || data[0];
        if (initial) await openLot(initial.id);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar las listas");
    } finally {
      setLoading(false);
    }
  }

  async function openLot(id) {
    try {
      setLoading(true);
      setError("");
      const data = await obtenerLotePrecios(id);
      setDetalle(data);
      localStorage.setItem(SELECTED_LOT_STORAGE_KEY, String(id));
      setActionMode(null);
      setRevertReason("");
      setEditingPreviewId(null);
      setShowReading(!data.preview_generado_at);
      setShowPreviewSettings(!data.preview_generado_at);
      setItemQuery("");
      setItemScope("todos");
      if (data.preview_generado_at) {
        setPreviewForm((current) => ({
          ...current,
          estrategia: data.estrategia_preview || current.estrategia,
          descuentoMinorista: String(data.descuento_minorista_pct ?? current.descuentoMinorista),
          descuentoMayorista: String(data.descuento_mayorista_pct ?? current.descuentoMayorista),
          redondeoMinorista: String(data.redondeo_minorista ?? current.redondeoMinorista),
          redondeoMayorista: String(data.redondeo_mayorista ?? current.redondeoMayorista),
          alertaVariacion: String(data.alerta_variacion_pct ?? current.alertaVariacion),
        }));
      }
      setPerfilNombre(`${data.proveedor_nombre} - ${data.formato.toUpperCase()}`);
    } catch (err) {
      setError(err.message || "No se pudo abrir la lista");
    } finally {
      setLoading(false);
    }
  }

  async function uploadList(event) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!form.idProveedor || !file) {
      setError("Elegí proveedor y archivo");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await importarListaPrecios({
        archivo: file,
        idProveedor: form.idProveedor,
        observaciones: form.observaciones.trim(),
        idUsuario: usuarioId,
      });
      setDetalle(data);
      setShowUpload(false);
      localStorage.setItem(SELECTED_LOT_STORAGE_KEY, String(data.id));
      setPerfilNombre(`${data.proveedor_nombre} - ${data.formato.toUpperCase()}`);
      setMessage(`Leí ${data.total_filas} fila(s). Es un borrador: todavía no cambió ningún precio.`);
      if (fileRef.current) fileRef.current.value = "";
      await refreshLots();
    } catch (err) {
      setError(err.message || "No se pudo leer la lista");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!detalle || perfilNombre.trim().length < 3) {
      setError("Escribí un nombre para el formato");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await guardarPerfilListaPrecios(detalle.id, {
        nombre: perfilNombre.trim(),
        id_usuario: usuarioId,
      });
      setMessage("Formato guardado. Las próximas listas del proveedor podrán reutilizar este mapeo.");
      await openLot(detalle.id);
      await refreshLots();
    } catch (err) {
      setError(err.message || "No se pudo guardar el formato");
    } finally {
      setLoading(false);
    }
  }

  async function cancelLot() {
    if (!detalle || !ACTIVE_STATES.has(detalle.estado)) return;
    try {
      setLoading(true);
      setError("");
      const data = await anularLotePrecios(detalle.id, {
        motivo: "Borrador anulado por el operador",
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setMessage("Borrador anulado. El archivo original quedó conservado para auditoría.");
      await refreshLots();
    } catch (err) {
      setError(err.message || "No se pudo anular el borrador");
    } finally {
      setLoading(false);
    }
  }

  async function processMatches() {
    if (!detalle) return;
    try {
      setLoading(true);
      setError("");
      const data = await procesarCoincidenciasLista(detalle.id, { id_usuario: usuarioId });
      setDetalle(data);
      setMessage("Coincidencias analizadas. Las sugerencias siguen pendientes hasta que las confirmes.");
    } catch (err) {
      setError(err.message || "No se pudieron analizar las coincidencias");
    } finally {
      setLoading(false);
    }
  }

  async function generatePreview() {
    if (!detalle) return;
    try {
      setLoading(true);
      setError("");
      const data = await generarPreviewLista(detalle.id, {
        estrategia: previewForm.estrategia,
        descuento_minorista_pct: Number(previewForm.descuentoMinorista),
        descuento_mayorista_pct: Number(previewForm.descuentoMayorista),
        redondeo_minorista: Number(previewForm.redondeoMinorista),
        redondeo_mayorista: Number(previewForm.redondeoMayorista),
        alerta_variacion_pct: Number(previewForm.alertaVariacion),
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setShowPreviewSettings(false);
      setMessage("Vista previa calculada. Ningún costo ni precio del catálogo fue modificado.");
      await refreshLots();
    } catch (err) {
      setError(err.message || "No se pudo calcular la vista previa");
    } finally {
      setLoading(false);
    }
  }

  async function saveItemPreview(item, values) {
    try {
      setLoading(true);
      setError("");
      const data = await actualizarPreviewItemLista(detalle.id, item.id, {
        ...values,
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setEditingPreviewId(null);
      setMessage("Propuesta actualizada. Sigue siendo una vista previa sin cambios en catálogo.");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la propuesta");
    } finally {
      setLoading(false);
    }
  }

  async function applyLot() {
    if (!detalle) return;
    try {
      setLoading(true);
      setError("");
      const data = await aplicarListaPrecios(detalle.id, {
        preview_version: detalle.preview_version,
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setActionMode(null);
      setMessage("Lista aplicada. Los costos y precios quedaron registrados en el historial.");
      await refreshLots();
    } catch (err) {
      setError(err.message || "No se pudo aplicar la lista");
    } finally {
      setLoading(false);
    }
  }

  async function revertLot() {
    if (!detalle || revertReason.trim().length < 3) {
      setError("Indicá por qué necesitás revertir la lista");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const data = await revertirListaPrecios(detalle.id, {
        motivo: revertReason.trim(),
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setActionMode(null);
      setRevertReason("");
      setMessage("Lista revertida. Los valores anteriores fueron restaurados y el historial se conservó.");
      await refreshLots();
    } catch (err) {
      setError(err.message || "No se pudo revertir la lista");
    } finally {
      setLoading(false);
    }
  }

  async function downloadReport() {
    try {
      setLoading(true);
      setError("");
      await descargarInformeListaPrecios(detalle.id);
    } catch (err) {
      setError(err.message || "No se pudo descargar el informe");
    } finally {
      setLoading(false);
    }
  }

  async function linkItem(item, variantId, replaceAlias = false) {
    try {
      setLoading(true);
      setError("");
      const data = await vincularItemLista(detalle.id, item.id, {
        id_variante: variantId,
        recordar_alias: true,
        reemplazar_alias: replaceAlias,
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setSearchItem(null);
      setCatalogResults([]);
      setCatalogQuery("");
      setAliasConflict(null);
      setMessage("Producto vinculado. El código quedó recordado para este proveedor.");
    } catch (err) {
      if (String(err.message || "").includes("ya está aprendido")) {
        setAliasConflict({ item, variantId, message: err.message });
      }
      setError(err.message || "No se pudo vincular el producto");
    } finally {
      setLoading(false);
    }
  }

  async function unlinkItem(item) {
    try {
      setLoading(true);
      setError("");
      const data = await desvincularItemLista(detalle.id, item.id, {
        motivo: "Coincidencia descartada por el operador",
        id_usuario: usuarioId,
      });
      setDetalle(data);
      setMessage("Coincidencia descartada para esta fila.");
    } catch (err) {
      setError(err.message || "No se pudo descartar la coincidencia");
    } finally {
      setLoading(false);
    }
  }

  async function searchCatalog(event) {
    event.preventDefault();
    if (!catalogQuery.trim()) return;
    try {
      setLoading(true);
      setError("");
      const data = await listarCatalogoPOS({
        id_sucursal: sucursalId,
        query: catalogQuery.trim(),
        limit: 12,
        offset: 0,
      });
      setCatalogResults(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.message || "No se pudo buscar en el catálogo");
    } finally {
      setLoading(false);
    }
  }

  const mappingEntries = detalle
    ? Object.entries(detalle.mapeo_detectado || {}).map(([field, index]) => ({
        field,
        header: detalle.encabezados?.[index] || `Columna ${Number(index) + 1}`,
      }))
    : [];

  const lotCounts = useMemo(() => ({
    pendientes: lotes.filter((lot) => PENDING_STATES.has(lot.estado)).length,
    recientes: lotes.filter((lot) => !PENDING_STATES.has(lot.estado)).length,
  }), [lotes]);

  const filteredLots = useMemo(() => {
    const query = lotFilters.query.trim().toLocaleLowerCase("es");
    return lotes.filter((lot) => {
      const scopeMatches = lotFilters.scope === "pendientes" ? PENDING_STATES.has(lot.estado) : !PENDING_STATES.has(lot.estado);
      const providerMatches = !lotFilters.provider || String(lot.id_proveedor) === String(lotFilters.provider);
      const queryMatches = !query || `${lot.proveedor_nombre_snapshot} ${lot.nombre_archivo} ${stateLabel(lot.estado)}`.toLocaleLowerCase("es").includes(query);
      return scopeMatches && providerMatches && queryMatches;
    });
  }, [lotes, lotFilters]);

  const visibleItems = useMemo(() => {
    if (!detalle) return [];
    const query = itemQuery.trim().toLocaleLowerCase("es");
    return detalle.items.filter((item) => {
      const text = `${item.codigo_original || ""} ${item.descripcion_original || ""} ${item.variante_producto_nombre || ""} ${item.variante_nombre || ""}`.toLocaleLowerCase("es");
      const scopeMatches = itemScope === "todos"
        || (itemScope === "revisar" && (item.estado_coincidencia !== "exacta" || (item.preview_generado_at && !item.preview_valido)))
        || (itemScope === "alertas" && (item.alertas_preview || []).length > 0);
      return scopeMatches && (!query || text.includes(query));
    });
  }, [detalle, itemQuery, itemScope]);

  useEffect(() => {
    const candidates = lotes.filter((lot) => {
      const scopeMatches = lotFilters.scope === "pendientes" ? PENDING_STATES.has(lot.estado) : !PENDING_STATES.has(lot.estado);
      return scopeMatches && (!lotFilters.provider || String(lot.id_proveedor) === String(lotFilters.provider));
    });
    if (candidates.length === 0) return;
    if (!detalle || !candidates.some((lot) => lot.id === detalle.id)) {
      openLot(candidates[0].id);
    }
  }, [lotFilters.scope, lotFilters.provider, lotes]);

  return (
    <section style={styles.cardWide}>
      <div style={local.header}>
        <div>
          <h2 style={styles.cardTitle}>Bandeja de actualizaciones</h2>
          <p style={styles.subtitle}>{lotCounts.pendientes} pendiente(s) · {lotCounts.recientes} finalizada(s)</p>
        </div>
        <div style={local.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={refreshLots} disabled={loading} title="Refrescar">
            <RefreshCw size={17} /> Refrescar
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => setShowUpload((current) => !current)}>
            <Plus size={17} /> Nueva lista
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>Error: {error}</div>}
      {message && <div style={styles.success}>{message}</div>}
      {aliasConflict && (
        <div style={local.aliasConflict}>
          <span><strong>Código aprendido para otro producto.</strong> {aliasConflict.message}</span>
          <div style={local.headerActions}>
            <button type="button" style={local.dangerButton} onClick={() => linkItem(aliasConflict.item, aliasConflict.variantId, true)} disabled={loading}>
              Reemplazar vínculo
            </button>
            <button type="button" style={styles.secondaryButton} onClick={() => setAliasConflict(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {showUpload && (
        <form
          onSubmit={uploadList}
          style={{
            ...local.uploadPanel,
            ...local.uploadGrid,
            ...(isNarrow ? local.uploadGridNarrow : {}),
            ...(isMobile ? local.oneColumn : {}),
          }}
        >
          <label style={styles.label}>
            Proveedor
            <select
              style={styles.input}
              value={form.idProveedor}
              onChange={(event) => setForm((current) => ({ ...current, idProveedor: event.target.value }))}
            >
              <option value="">Seleccionar...</option>
              {proveedores.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.nombre}</option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Archivo
            <input ref={fileRef} style={styles.input} type="file" accept=".xlsx,.csv,.txt" />
          </label>
          <label style={styles.label}>
            Referencia
            <input
              style={styles.input}
              value={form.observaciones}
              placeholder="Ej: lista noviembre"
              onChange={(event) => setForm((current) => ({ ...current, observaciones: event.target.value }))}
            />
          </label>
          <button type="submit" style={styles.primaryButton} disabled={loading}>
            <Upload size={17} /> Leer archivo
          </button>
        </form>
      )}

      <div style={{ ...local.workspace, ...(isNarrow ? local.oneColumn : {}) }}>
        <aside style={local.listPane}>
          <div style={local.scopeTabs}>
            <button type="button" style={lotFilters.scope === "pendientes" ? local.scopeTabActive : local.scopeTab} onClick={() => setLotFilters((current) => ({ ...current, scope: "pendientes" }))}>
              Pendientes <strong>{lotCounts.pendientes}</strong>
            </button>
            <button type="button" style={lotFilters.scope === "recientes" ? local.scopeTabActive : local.scopeTab} onClick={() => setLotFilters((current) => ({ ...current, scope: "recientes" }))}>
              Historial <strong>{lotCounts.recientes}</strong>
            </button>
          </div>
          <div style={local.lotFilters}>
            <label style={local.searchInput}>
              <Search size={15} />
              <input style={local.searchInputControl} value={lotFilters.query} onChange={(event) => setLotFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar lista" />
            </label>
            <select style={styles.input} value={lotFilters.provider} onChange={(event) => setLotFilters((current) => ({ ...current, provider: event.target.value }))} aria-label="Filtrar por proveedor">
              <option value="">Todos los proveedores</option>
              {proveedores.map((provider) => <option key={provider.id} value={provider.id}>{provider.nombre}</option>)}
            </select>
          </div>
          {filteredLots.length === 0 && <span style={local.listEmpty}>No hay listas para estos filtros.</span>}
          {filteredLots.map((lot) => (
            <button
              type="button"
              key={lot.id}
              onClick={() => openLot(lot.id)}
              style={{ ...local.lotButton, ...(detalle?.id === lot.id ? local.lotButtonActive : {}) }}
            >
              <FileSpreadsheet size={18} />
              <span style={local.lotText}>
                <strong>{lot.proveedor_nombre_snapshot}</strong>
                <small>{lot.nombre_archivo} · {lot.total_filas} filas</small>
              </span>
              <small style={PENDING_STATES.has(lot.estado) ? local.pendingState : local.closedState}>{stateLabel(lot.estado)}</small>
            </button>
          ))}
        </aside>

        <div style={{ ...local.detailPane, ...(isNarrow ? local.detailPaneNarrow : {}) }}>
          {!detalle && <div style={local.empty}>Elegí una lista de la bandeja.</div>}
          {detalle && (
            <>
              <div style={local.detailHeader}>
                <div>
                  <h3 style={local.detailTitle}>{detalle.nombre_archivo}</h3>
                  <span style={styles.muted}>
                    {detalle.proveedor_nombre} · {detalle.formato.toUpperCase()}
                    {detalle.hoja_detectada ? ` · Hoja ${detalle.hoja_detectada}` : ""}
                    {` · Encabezado fila ${detalle.fila_encabezado_detectada}`}
                  </span>
                </div>
                <div style={local.headerActions}>
                  <button type="button" style={styles.primaryButton} onClick={processMatches} disabled={loading || ["anulado", "aplicado", "revertido"].includes(detalle.estado)}>
                    <Search size={17} /> Buscar coincidencias
                  </button>
                  <span style={local.status}>{stateLabel(detalle.estado)}</span>
                </div>
              </div>

              {Object.keys(detalle.resumen_coincidencias || {}).length > 0 && (
                <div style={local.matchSummary}>
                  {Object.entries(detalle.resumen_coincidencias).map(([state, count]) => (
                    <span key={state} style={local.mappingItem}><strong>{stateLabel(state)}</strong> {count}</span>
                  ))}
                </div>
              )}

              <div style={local.itemToolbar}>
                <label style={local.searchInput}>
                  <Search size={15} />
                  <input style={local.searchInputControl} value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Buscar código o producto" />
                </label>
                <div style={local.scopeTabs}>
                  <button type="button" style={itemScope === "todos" ? local.scopeTabActive : local.scopeTab} onClick={() => setItemScope("todos")}>Todos</button>
                  <button type="button" style={itemScope === "revisar" ? local.scopeTabActive : local.scopeTab} onClick={() => setItemScope("revisar")}>Para revisar</button>
                  <button type="button" style={itemScope === "alertas" ? local.scopeTabActive : local.scopeTab} onClick={() => setItemScope("alertas")}>Con alertas</button>
                </div>
                <button type="button" style={local.smallButton} onClick={() => setShowReading((current) => !current)}>
                  {showReading ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Lectura original
                </button>
              </div>

              {showReading && (
                <>
                  <div style={local.mapping}>
                    {mappingEntries.map((entry) => (
                      <span key={entry.field} style={local.mappingItem}>
                        <strong>{entry.field}</strong> ← {entry.header}
                      </span>
                    ))}
                  </div>

                  <div style={local.tableWrap}>
                    <table style={local.table}>
                      <thead>
                        <tr>
                          <th style={local.th}>Fila</th>
                          <th style={local.th}>Código leído</th>
                          <th style={local.th}>Descripción leída</th>
                          <th style={local.th}>Cantidad</th>
                          <th style={local.th}>Costo leído</th>
                          <th style={local.th}>Coincidencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleItems.map((item) => (
                          <tr key={item.id}>
                            <td style={local.td}>{item.numero_fila}</td>
                            <td style={local.td}>{item.codigo_original || "-"}</td>
                            <td style={local.td}>{item.descripcion_original || "-"}</td>
                            <td style={local.td}>{item.cantidad_original || "-"}</td>
                            <td style={local.td}>{item.costo_original || "-"}</td>
                            <td style={{ ...local.td, minWidth: 290 }}>
                              <MatchCell
                                item={item}
                                loading={loading}
                                onLink={(variantId) => linkItem(item, variantId)}
                                onUnlink={() => unlinkItem(item)}
                                onSearch={() => {
                                  setSearchItem(item);
                                  setCatalogQuery(item.descripcion_original || item.codigo_original || "");
                                  setCatalogResults([]);
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleItems.length === 0 && <div style={local.listEmpty}>No hay filas para estos filtros.</div>}
                  </div>
                </>
              )}

              <div style={local.previewSection}>
                <div style={local.previewHeader}>
                  <div>
                    <h3 style={local.detailTitle}>Vista previa de costos y precios</h3>
                    <p style={{ ...styles.muted, margin: "4px 0 0" }}>
                      Calcula propuestas con una foto de los valores actuales. No modifica el catálogo.
                    </p>
                  </div>
                  <div style={local.headerActions}>
                    {detalle.preview_generado_at && (
                      <span style={detalle.estado === "listo_para_aplicar" ? local.readyBadge : local.reviewBadge}>
                        {detalle.estado === "listo_para_aplicar" ? "Revisión completa" : "Requiere decisiones"}
                      </span>
                    )}
                    <button type="button" style={local.smallButton} onClick={() => setShowPreviewSettings((current) => !current)}>
                      <Calculator size={15} /> Ajustes de cálculo {showPreviewSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {showPreviewSettings && <div style={{ ...local.previewControls, ...(isNarrow ? local.previewControlsNarrow : {}), ...(isMobile ? local.oneColumn : {}) }}>
                  <label style={styles.label}>
                    Estrategia general
                    <select
                      style={styles.input}
                      value={previewForm.estrategia}
                      onChange={(event) => setPreviewForm((current) => ({ ...current, estrategia: event.target.value }))}
                    >
                      {PREVIEW_STRATEGIES.slice(0, 3).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <NumberField label="Desc. contado minorista" suffix="%" value={previewForm.descuentoMinorista} onChange={(value) => setPreviewForm((current) => ({ ...current, descuentoMinorista: value }))} styles={styles} />
                  <NumberField label="Redondeo minorista" prefix="$" value={previewForm.redondeoMinorista} onChange={(value) => setPreviewForm((current) => ({ ...current, redondeoMinorista: value }))} styles={styles} />
                  <NumberField label="Desc. mayorista" suffix="%" value={previewForm.descuentoMayorista} onChange={(value) => setPreviewForm((current) => ({ ...current, descuentoMayorista: value }))} styles={styles} />
                  <NumberField label="Redondeo mayorista" prefix="$" value={previewForm.redondeoMayorista} onChange={(value) => setPreviewForm((current) => ({ ...current, redondeoMayorista: value }))} styles={styles} />
                  <NumberField label="Alertar variación desde" suffix="%" value={previewForm.alertaVariacion} onChange={(value) => setPreviewForm((current) => ({ ...current, alertaVariacion: value }))} styles={styles} />
                  <button type="button" style={styles.primaryButton} onClick={generatePreview} disabled={loading || ["anulado", "aplicado", "revertido"].includes(detalle.estado)}>
                    <Calculator size={17} /> Calcular vista previa
                  </button>
                </div>}

                {detalle.preview_generado_at && (
                  <>
                    <PreviewTable
                      items={visibleItems}
                      loading={loading || ["aplicado", "revertido"].includes(detalle.estado)}
                      editingId={editingPreviewId}
                      setEditingId={setEditingPreviewId}
                      onSave={saveItemPreview}
                      styles={styles}
                      isMobile={isMobile}
                    />

                    <div style={local.applyBar}>
                      <div>
                        <strong>
                          {detalle.items.filter((item) => item.seleccionado_aplicar).length} producto(s) seleccionados
                        </strong>
                        <small style={local.productMeta}>
                          {detalle.estado === "listo_para_aplicar" && "Se volverán a validar costos y precios antes de guardar."}
                          {detalle.estado === "aplicado" && `Aplicado correctamente${detalle.aplicado_at ? ` el ${new Date(detalle.aplicado_at).toLocaleString("es-AR")}` : ""}.`}
                          {detalle.estado === "revertido" && "Los valores anteriores fueron restaurados."}
                        </small>
                      </div>
                      <div style={local.headerActions}>
                        {["aplicado", "revertido"].includes(detalle.estado) && (
                          <button type="button" style={styles.secondaryButton} onClick={downloadReport} disabled={loading}>
                            <Download size={17} /> Informe PDF
                          </button>
                        )}
                        {detalle.estado === "aplicado" && (
                          <button type="button" style={local.dangerButton} onClick={() => setActionMode("revert")} disabled={loading}>
                            <RotateCcw size={17} /> Revertir lote
                          </button>
                        )}
                        {detalle.estado === "listo_para_aplicar" && (
                          <button type="button" style={styles.primaryButton} onClick={() => setActionMode("apply")} disabled={loading}>
                            <ShieldCheck size={17} /> Aplicar actualización
                          </button>
                        )}
                      </div>
                    </div>

                    {actionMode === "apply" && (
                      <div style={local.confirmBox}>
                        <div>
                          <strong>¿Aplicar esta lista al catálogo?</strong>
                          <p style={local.confirmText}>Se actualizarán costo de reposición y precios de los productos seleccionados. Si algo cambió desde la vista previa, no se aplicará ninguno.</p>
                        </div>
                        <div style={local.headerActions}>
                          <button type="button" style={styles.secondaryButton} onClick={() => setActionMode(null)}>Cancelar</button>
                          <button type="button" style={styles.primaryButton} onClick={applyLot} disabled={loading}><ShieldCheck size={17} /> Confirmar aplicación</button>
                        </div>
                      </div>
                    )}

                    {actionMode === "revert" && (
                      <div style={local.revertBox}>
                        <div style={{ flex: "1 1 320px" }}>
                          <strong>Revertir a los valores anteriores</strong>
                          <p style={local.confirmText}>Sólo se podrá hacer si ningún producto tuvo cambios posteriores.</p>
                          <input style={styles.input} value={revertReason} onChange={(event) => setRevertReason(event.target.value)} placeholder="Motivo de la reversión" />
                        </div>
                        <div style={local.headerActions}>
                          <button type="button" style={styles.secondaryButton} onClick={() => setActionMode(null)}>Cancelar</button>
                          <button type="button" style={local.dangerButton} onClick={revertLot} disabled={loading || revertReason.trim().length < 3}><RotateCcw size={17} /> Confirmar reversión</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {searchItem && (
                <div style={local.searchBox}>
                  <div style={local.detailHeader}>
                    <div>
                      <strong>Buscar producto para la fila {searchItem.numero_fila}</strong>
                      <div style={styles.muted}>{searchItem.descripcion_original || searchItem.codigo_original}</div>
                    </div>
                    <button type="button" style={styles.secondaryButton} onClick={() => setSearchItem(null)}>Cerrar</button>
                  </div>
                  <form onSubmit={searchCatalog} style={local.searchRow}>
                    <input style={{ ...styles.input, flex: 1 }} value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} />
                    <button type="submit" style={styles.primaryButton} disabled={loading}><Search size={17} /> Buscar</button>
                  </form>
                  <div style={local.catalogResults}>
                    {catalogResults.map((result) => (
                      <button key={result.id_variante} type="button" style={local.catalogResult} onClick={() => linkItem(searchItem, result.id_variante)}>
                        <span><strong>{result.producto_nombre}</strong> {result.nombre_variante}</span>
                        <small>{result.sku || "Sin SKU"}</small>
                      </button>
                    ))}
                    {catalogResults.length === 0 && <span style={styles.muted}>Buscá por SKU, EAN, código o nombre.</span>}
                  </div>
                </div>
              )}

              <div style={local.actions}>
                <input
                  style={{ ...styles.input, flex: "1 1 260px" }}
                  value={perfilNombre}
                  placeholder="Nombre del formato del proveedor"
                  onChange={(event) => setPerfilNombre(event.target.value)}
                />
                <button type="button" style={styles.secondaryButton} onClick={saveProfile} disabled={loading || Boolean(detalle.id_perfil)}>
                  <Save size={17} /> {detalle.id_perfil ? "Formato guardado" : "Guardar formato"}
                </button>
                {ACTIVE_STATES.has(detalle.estado) && (
                  <button type="button" style={local.dangerButton} onClick={cancelLot} disabled={loading}>
                    <Ban size={17} /> Anular borrador
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange, styles, prefix, suffix }) {
  return (
    <label style={styles.label}>
      {label}
      <span style={local.numberField}>
        {prefix && <span>{prefix}</span>}
        <input
          style={local.numberInput}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <span>{suffix}</span>}
      </span>
    </label>
  );
}

function money(value) {
  if (value === null || value === undefined) return "-";
  return Number(value).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
}

function percent(value) {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

function PriceChange({ before, after, marginBefore, marginAfter }) {
  const changed = Number(before || 0) !== Number(after || 0);
  return (
    <div style={local.priceChange}>
      <span style={changed ? local.oldValue : undefined}>{money(before)}</span>
      <strong style={changed ? local.newValue : undefined}>{money(after)}</strong>
      {(marginBefore !== undefined || marginAfter !== undefined) && <small style={local.marginText}>Margen {percent(marginBefore)} → {percent(marginAfter)}</small>}
    </div>
  );
}

function PreviewTable({ items, loading, editingId, setEditingId, onSave, styles, isMobile }) {
  if (items.length === 0) {
    return <div style={local.listEmpty}>No hay productos para estos filtros.</div>;
  }
  if (isMobile) {
    return (
      <div style={local.mobilePreviewList}>
        {items.map((item) => (
          <MobilePreviewRow
            key={item.id}
            item={item}
            loading={loading}
            editing={editingId === item.id}
            onEdit={() => setEditingId(item.id)}
            onCancel={() => setEditingId(null)}
            onSave={(values) => onSave(item, values)}
            styles={styles}
          />
        ))}
      </div>
    );
  }
  return (
    <div style={{ ...local.tableWrap, marginTop: 12, maxHeight: 520 }}>
      <table style={{ ...local.table, minWidth: 1050 }}>
        <thead>
          <tr>
            <th style={local.th}>Producto</th>
            <th style={local.th}>Costo reposición</th>
            <th style={local.th}>Minorista</th>
            <th style={local.th}>Mayorista</th>
            <th style={local.th}>Revisión</th>
            <th style={local.th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <PreviewRow
              key={item.id}
              item={item}
              loading={loading}
              editing={editingId === item.id}
              onEdit={() => setEditingId(item.id)}
              onCancel={() => setEditingId(null)}
              onSave={(values) => onSave(item, values)}
              styles={styles}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobilePreviewRow({ item, loading, editing, onEdit, onCancel, onSave, styles }) {
  const [form, setForm] = useState({
    estrategia_minorista: item.estrategia_minorista || "conservar_margen",
    estrategia_mayorista: item.estrategia_mayorista || "conservar_margen",
    precio_minorista_manual: item.precio_minorista_propuesto || "",
    precio_mayorista_manual: item.precio_mayorista_propuesto || "",
    seleccionado_aplicar: item.seleccionado_aplicar !== false,
    confirmar_precio_libre: item.precio_libre_confirmado || false,
  });
  useEffect(() => {
    setForm({
      estrategia_minorista: item.estrategia_minorista || "conservar_margen",
      estrategia_mayorista: item.estrategia_mayorista || "conservar_margen",
      precio_minorista_manual: item.precio_minorista_propuesto || "",
      precio_mayorista_manual: item.precio_mayorista_propuesto || "",
      seleccionado_aplicar: item.seleccionado_aplicar !== false,
      confirmar_precio_libre: item.precio_libre_confirmado || false,
    });
  }, [item]);
  const alerts = item.alertas_preview || [];
  return (
    <div style={{ ...local.mobilePreviewCard, ...(!item.preview_valido ? local.invalidRow : {}) }}>
      <div style={local.mobilePreviewHeader}>
        <div>
          <strong>{item.variante_producto_nombre || item.descripcion_original || "Sin producto vinculado"}</strong>
          <small style={local.productMeta}>{item.variante_nombre || item.codigo_original || "-"}</small>
        </div>
        {!editing && <button type="button" style={local.smallButton} onClick={onEdit} disabled={loading}>Editar</button>}
      </div>
      {!editing ? (
        <>
          <div style={local.mobilePriceGrid}>
            <div><small>Costo</small><PriceChange before={item.costo_reposicion_anterior_snapshot} after={item.costo_reposicion_nuevo} /></div>
            <div><small>Minorista</small><PriceChange before={item.precio_minorista_anterior_snapshot} after={item.precio_minorista_propuesto} marginBefore={item.margen_minorista_anterior_pct} marginAfter={item.margen_minorista_resultante_pct} /></div>
            <div><small>Mayorista</small><PriceChange before={item.precio_mayorista_anterior_snapshot} after={item.precio_mayorista_propuesto} marginBefore={item.margen_mayorista_anterior_pct} marginAfter={item.margen_mayorista_resultante_pct} /></div>
          </div>
          {alerts.map((alert, index) => <span key={`${alert.codigo}-${index}`} style={alert.tipo === "bloqueo" ? local.blockAlert : local.warnAlert}><AlertTriangle size={13} /> {alert.mensaje}</span>)}
        </>
      ) : (
        <div style={local.mobileEditor}>
          <ChannelEditor channel="Minorista" strategy={form.estrategia_minorista} price={form.precio_minorista_manual} onStrategy={(value) => setForm((current) => ({ ...current, estrategia_minorista: value }))} onPrice={(value) => setForm((current) => ({ ...current, precio_minorista_manual: value }))} styles={styles} />
          <ChannelEditor channel="Mayorista" strategy={form.estrategia_mayorista} price={form.precio_mayorista_manual} onStrategy={(value) => setForm((current) => ({ ...current, estrategia_mayorista: value }))} onPrice={(value) => setForm((current) => ({ ...current, precio_mayorista_manual: value }))} styles={styles} />
          <label style={local.checkboxLabel}><input type="checkbox" checked={form.seleccionado_aplicar} onChange={(event) => setForm((current) => ({ ...current, seleccionado_aplicar: event.target.checked }))} /> Incluir en la actualización</label>
          {item.permite_precio_libre_snapshot && <label style={local.checkboxLabel}><input type="checkbox" checked={form.confirmar_precio_libre} onChange={(event) => setForm((current) => ({ ...current, confirmar_precio_libre: event.target.checked }))} /> Confirmo revisar este precio libre</label>}
          <div style={local.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onCancel}>Cancelar</button>
            <button type="button" style={styles.primaryButton} disabled={loading} onClick={() => onSave({ ...form, precio_minorista_manual: form.estrategia_minorista === "manual" ? Number(form.precio_minorista_manual) : null, precio_mayorista_manual: form.estrategia_mayorista === "manual" ? Number(form.precio_mayorista_manual) : null })}><Save size={16} /> Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewRow({ item, loading, editing, onEdit, onCancel, onSave, styles }) {
  const [form, setForm] = useState({
    estrategia_minorista: item.estrategia_minorista || "conservar_margen",
    estrategia_mayorista: item.estrategia_mayorista || "conservar_margen",
    precio_minorista_manual: item.precio_minorista_propuesto || "",
    precio_mayorista_manual: item.precio_mayorista_propuesto || "",
    seleccionado_aplicar: item.seleccionado_aplicar !== false,
    confirmar_precio_libre: item.precio_libre_confirmado || false,
  });

  useEffect(() => {
    setForm({
      estrategia_minorista: item.estrategia_minorista || "conservar_margen",
      estrategia_mayorista: item.estrategia_mayorista || "conservar_margen",
      precio_minorista_manual: item.precio_minorista_propuesto || "",
      precio_mayorista_manual: item.precio_mayorista_propuesto || "",
      seleccionado_aplicar: item.seleccionado_aplicar !== false,
      confirmar_precio_libre: item.precio_libre_confirmado || false,
    });
  }, [item]);

  if (editing) {
    return (
      <tr>
        <td colSpan={6} style={local.editCell}>
          <div style={local.editTitle}>
            <strong>{item.variante_producto_nombre || item.descripcion_original || "Fila sin vincular"}</strong>
            <span style={styles.muted}>{item.codigo_original || "Sin código"}</span>
          </div>
          <div style={local.editGrid}>
            <ChannelEditor channel="Minorista" strategy={form.estrategia_minorista} price={form.precio_minorista_manual} onStrategy={(value) => setForm((current) => ({ ...current, estrategia_minorista: value }))} onPrice={(value) => setForm((current) => ({ ...current, precio_minorista_manual: value }))} styles={styles} />
            <ChannelEditor channel="Mayorista" strategy={form.estrategia_mayorista} price={form.precio_mayorista_manual} onStrategy={(value) => setForm((current) => ({ ...current, estrategia_mayorista: value }))} onPrice={(value) => setForm((current) => ({ ...current, precio_mayorista_manual: value }))} styles={styles} />
            <div style={local.checks}>
              <label style={local.checkboxLabel}><input type="checkbox" checked={form.seleccionado_aplicar} onChange={(event) => setForm((current) => ({ ...current, seleccionado_aplicar: event.target.checked }))} /> Incluir en la actualización</label>
              {item.permite_precio_libre_snapshot && <label style={local.checkboxLabel}><input type="checkbox" checked={form.confirmar_precio_libre} onChange={(event) => setForm((current) => ({ ...current, confirmar_precio_libre: event.target.checked }))} /> Confirmo revisar este producto de precio libre</label>}
            </div>
          </div>
          <div style={local.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onCancel}>Cancelar</button>
            <button
              type="button"
              style={styles.primaryButton}
              disabled={loading}
              onClick={() => onSave({
                ...form,
                precio_minorista_manual: form.estrategia_minorista === "manual" ? Number(form.precio_minorista_manual) : null,
                precio_mayorista_manual: form.estrategia_mayorista === "manual" ? Number(form.precio_mayorista_manual) : null,
              })}
            >
              <Save size={16} /> Guardar propuesta
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const alerts = item.alertas_preview || [];
  return (
    <tr style={!item.preview_valido ? local.invalidRow : undefined}>
      <td style={{ ...local.td, minWidth: 230 }}>
        <strong>{item.variante_producto_nombre || item.descripcion_original || "Sin producto vinculado"}</strong>
        <small style={local.productMeta}>{item.variante_nombre || item.codigo_original || "-"}</small>
        {item.oferta_vigente_snapshot && <span style={local.offerBadge}>Oferta: {item.oferta_vigente_snapshot.nombre}</span>}
      </td>
      <td style={local.td}>
        <div style={local.priceChange}>
          <span style={local.oldValue}>{money(item.costo_reposicion_anterior_snapshot)}</span>
          <strong style={local.newValue}>{money(item.costo_reposicion_nuevo)}</strong>
          <small style={local.marginText}>{percent(item.costo_variacion_pct)}</small>
        </div>
      </td>
      <td style={local.td}><PriceChange before={item.precio_minorista_anterior_snapshot} after={item.precio_minorista_propuesto} marginBefore={item.margen_minorista_anterior_pct} marginAfter={item.margen_minorista_resultante_pct} /></td>
      <td style={local.td}><PriceChange before={item.precio_mayorista_anterior_snapshot} after={item.precio_mayorista_propuesto} marginBefore={item.margen_mayorista_anterior_pct} marginAfter={item.margen_mayorista_resultante_pct} /></td>
      <td style={{ ...local.td, minWidth: 220 }}>
        {alerts.length === 0 && <span style={local.okText}>Sin alertas</span>}
        {alerts.map((alert, index) => (
          <span key={`${alert.codigo}-${index}`} style={alert.tipo === "bloqueo" ? local.blockAlert : local.warnAlert}>
            <AlertTriangle size={13} /> {alert.mensaje}
          </span>
        ))}
      </td>
      <td style={local.td}>
        <button type="button" style={local.smallButton} onClick={onEdit} disabled={loading}>Editar</button>
      </td>
    </tr>
  );
}

function ChannelEditor({ channel, strategy, price, onStrategy, onPrice, styles }) {
  return (
    <div style={local.channelEditor}>
      <strong>{channel}</strong>
      <select style={styles.input} value={strategy} onChange={(event) => onStrategy(event.target.value)}>
        {PREVIEW_STRATEGIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {strategy === "manual" && <input style={styles.input} type="number" min="0.01" step="0.01" value={price} onChange={(event) => onPrice(event.target.value)} placeholder={`Precio ${channel.toLowerCase()}`} />}
    </div>
  );
}

function MatchCell({ item, loading, onLink, onUnlink, onSearch }) {
  if (item.id_variante) {
    return (
      <div style={local.matchCell}>
        <span style={local.matchExact}>Exacta · {originLabel(item.origen_coincidencia)}</span>
        <strong>{item.variante_producto_nombre}</strong>
        <span>{item.variante_nombre}</span>
        <button type="button" style={local.smallButton} onClick={onUnlink} disabled={loading}>
          <Unlink size={14} /> Deshacer
        </button>
      </div>
    );
  }
  return (
    <div style={local.matchCell}>
      <span style={item.estado_coincidencia === "ambigua" ? local.matchWarning : local.matchPending}>
        {stateLabel(item.estado_coincidencia)}
      </span>
      {item.mensaje_coincidencia && <small>{item.mensaje_coincidencia}</small>}
      {(item.candidatos || []).map((candidate) => (
        <div key={candidate.id_variante} style={local.candidate}>
          <span>
            <strong>{candidate.producto_nombre}</strong> {candidate.variante_nombre}
            <small style={local.candidateMeta}>{candidate.motivo} · {candidate.confianza}%</small>
          </span>
          <button type="button" style={local.smallButton} onClick={() => onLink(candidate.id_variante)} disabled={loading} title="Confirmar vínculo">
            <Link2 size={14} /> Vincular
          </button>
        </div>
      ))}
      <button type="button" style={local.smallButton} onClick={onSearch} disabled={loading}>
        <Search size={14} /> Buscar otro
      </button>
    </div>
  );
}

const local = {
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  uploadGrid: { display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(220px,1.3fr) minmax(180px,1fr) auto", gap: 12, alignItems: "end", marginTop: 16 },
  uploadPanel: { padding: 12, border: "1px solid #bfdbfe", background: "#f8fbff", borderRadius: 6 },
  uploadGridNarrow: { gridTemplateColumns: "1fr 1fr" },
  oneColumn: { gridTemplateColumns: "minmax(0,1fr)" },
  workspace: { display: "grid", gridTemplateColumns: "minmax(250px,320px) minmax(0,1fr)", gap: 16, marginTop: 18 },
  listPane: { display: "grid", alignContent: "start", gap: 8, maxHeight: "calc(100vh - 210px)", minHeight: 320, overflow: "auto", paddingRight: 3 },
  scopeTabs: { display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" },
  scopeTab: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 34, padding: "6px 9px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", borderRadius: 5, fontWeight: 750, cursor: "pointer" },
  scopeTabActive: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 34, padding: "6px 9px", border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8", borderRadius: 5, fontWeight: 800, cursor: "pointer" },
  lotFilters: { display: "grid", gap: 7, paddingBottom: 4 },
  searchInput: { display: "flex", alignItems: "center", gap: 7, minHeight: 38, padding: "0 10px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, color: "#64748b", flex: "1 1 210px" },
  searchInputControl: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", font: "inherit" },
  listEmpty: { padding: 12, color: "#64748b", fontSize: 13, textAlign: "center" },
  pendingState: { padding: "3px 5px", background: "#fff7ed", color: "#9a3412", borderRadius: 4, fontWeight: 800, whiteSpace: "nowrap" },
  closedState: { padding: "3px 5px", background: "#f1f5f9", color: "#475569", borderRadius: 4, fontWeight: 750, whiteSpace: "nowrap" },
  lotButton: { display: "flex", alignItems: "center", gap: 9, width: "100%", border: "1px solid #d8dee8", background: "#fff", padding: "10px", textAlign: "left", cursor: "pointer", borderRadius: 6 },
  lotButtonActive: { borderColor: "#f97316", background: "#fff7ed" },
  lotText: { display: "grid", gap: 2, minWidth: 0, flex: 1 },
  detailPane: { minWidth: 0, borderLeft: "1px solid #e5e7eb", paddingLeft: 16 },
  detailPaneNarrow: { borderLeft: 0, borderTop: "1px solid #e5e7eb", paddingLeft: 0, paddingTop: 16 },
  empty: { minHeight: 180, display: "grid", placeItems: "center", color: "#64748b" },
  detailHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  headerActions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  detailTitle: { margin: 0, fontSize: 18 },
  status: { padding: "5px 8px", border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", borderRadius: 6, fontSize: 12, fontWeight: 800 },
  mapping: { display: "flex", flexWrap: "wrap", gap: 7, margin: "14px 0" },
  matchSummary: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 },
  itemToolbar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "12px 0" },
  mappingItem: { padding: "5px 7px", border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 5, fontSize: 12 },
  tableWrap: { overflowX: "auto", border: "1px solid #d8dee8", borderRadius: 6, maxHeight: 430, overflowY: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 760 },
  th: { padding: "8px", textAlign: "left", fontSize: 12, background: "#f8fafc", borderBottom: "1px solid #d8dee8", position: "sticky", top: 0 },
  td: { padding: "8px", fontSize: 13, borderBottom: "1px solid #eef2f7", verticalAlign: "top" },
  actions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 },
  dangerButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", borderRadius: 6, fontWeight: 800, cursor: "pointer" },
  aliasConflict: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10, padding: 10, border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", borderRadius: 6 },
  matchCell: { display: "grid", gap: 6, alignItems: "start" },
  matchExact: { color: "#047857", fontWeight: 800, fontSize: 12 },
  matchPending: { color: "#1d4ed8", fontWeight: 800, fontSize: 12 },
  matchWarning: { color: "#b45309", fontWeight: 800, fontSize: 12 },
  candidate: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 7, border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 5 },
  candidateMeta: { display: "block", color: "#64748b", marginTop: 2 },
  smallButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, width: "fit-content", border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", padding: "6px 8px", borderRadius: 5, fontWeight: 750, cursor: "pointer" },
  searchBox: { marginTop: 14, border: "1px solid #bfdbfe", background: "#f8fbff", padding: 12, borderRadius: 6 },
  searchRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  catalogResults: { display: "grid", gap: 6, marginTop: 10 },
  catalogResult: { display: "flex", justifyContent: "space-between", gap: 10, width: "100%", padding: 9, border: "1px solid #d8dee8", background: "#fff", borderRadius: 5, textAlign: "left", cursor: "pointer" },
  previewSection: { marginTop: 18, paddingTop: 16, borderTop: "1px solid #d8dee8" },
  previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  previewControls: { display: "grid", gridTemplateColumns: "minmax(190px,1.5fr) repeat(5,minmax(120px,1fr)) auto", gap: 9, alignItems: "end", marginTop: 12 },
  previewControlsNarrow: { gridTemplateColumns: "repeat(2,minmax(0,1fr))" },
  readyBadge: { padding: "5px 8px", borderRadius: 5, background: "#dcfce7", color: "#047857", fontSize: 12, fontWeight: 800 },
  reviewBadge: { padding: "5px 8px", borderRadius: 5, background: "#fff7ed", color: "#b45309", fontSize: 12, fontWeight: 800 },
  numberField: { minHeight: 40, display: "flex", alignItems: "center", gap: 5, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff" },
  numberInput: { width: "100%", minWidth: 0, border: 0, outline: 0, font: "inherit", background: "transparent" },
  priceChange: { display: "grid", gap: 2, minWidth: 115 },
  oldValue: { color: "#64748b", textDecoration: "line-through", fontSize: 12 },
  newValue: { color: "#0f172a", fontSize: 14 },
  marginText: { color: "#64748b", fontSize: 11, whiteSpace: "nowrap" },
  productMeta: { display: "block", color: "#64748b", marginTop: 3 },
  offerBadge: { display: "inline-block", marginTop: 5, padding: "3px 5px", borderRadius: 4, background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 750 },
  okText: { color: "#047857", fontSize: 12, fontWeight: 750 },
  blockAlert: { display: "flex", gap: 5, alignItems: "flex-start", marginBottom: 4, color: "#b91c1c", fontSize: 12, lineHeight: 1.25 },
  warnAlert: { display: "flex", gap: 5, alignItems: "flex-start", marginBottom: 4, color: "#92400e", fontSize: 12, lineHeight: 1.25 },
  invalidRow: { background: "#fffafa" },
  editCell: { padding: 12, background: "#f8fafc", borderBottom: "1px solid #d8dee8" },
  editTitle: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  editGrid: { display: "grid", gridTemplateColumns: "minmax(220px,1fr) minmax(220px,1fr) minmax(220px,1fr)", gap: 12, marginBottom: 10 },
  channelEditor: { display: "grid", gap: 6 },
  checks: { display: "grid", gap: 8, alignContent: "start", paddingTop: 24 },
  checkboxLabel: { display: "flex", alignItems: "flex-start", gap: 7, fontSize: 13 },
  applyBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12, padding: 12, border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 6 },
  confirmBox: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 10, padding: 12, border: "1px solid #86efac", background: "#f0fdf4", borderRadius: 6 },
  revertBox: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginTop: 10, padding: 12, border: "1px solid #fecaca", background: "#fff7f7", borderRadius: 6 },
  confirmText: { margin: "4px 0 8px", color: "#475569", fontSize: 13 },
  mobilePreviewList: { display: "grid", gap: 8, marginTop: 12 },
  mobilePreviewCard: { display: "grid", gap: 10, padding: 10, border: "1px solid #d8dee8", background: "#fff", borderRadius: 6 },
  mobilePreviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  mobilePriceGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 },
  mobileEditor: { display: "grid", gap: 10, paddingTop: 4, borderTop: "1px solid #e2e8f0" },
};
