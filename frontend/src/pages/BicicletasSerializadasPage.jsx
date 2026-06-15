import { useEffect, useMemo, useState } from "react";
import {
  crearSerializada,
  listarSerializadas,
} from "../services/serializadasService";
import { listarCatalogoPOS } from "../services/catalogoService";
import { getImageUrl } from "../utils/images";
import { useSession } from "../context/SessionContext";
import useMediaQuery from "../hooks/useMediaQuery";
const ESTADOS = [
  { value: "disponible", label: "Disponibles", emoji: "✅" },
  { value: "reservada", label: "Reservadas", emoji: "🟡" },
  { value: "vendida_pendiente_entrega", label: "Pendientes", emoji: "📦" },
  { value: "entregada", label: "Entregadas", emoji: "🏁" },
  { value: "fuera_de_stock", label: "Fuera stock", emoji: "⛔" },
  { value: "", label: "Todos", emoji: "📋" },
];

function normalizarEstado(estado) {
  const found = ESTADOS.find((e) => e.value === estado);
  return found?.label || estado || "-";
}

function getTituloBici(bici) {
  return [bici.producto_nombre, bici.nombre_variante]
    .filter(Boolean)
    .join(" - ") || `Bicicleta #${bici.id}`;
}

function getImagenBici(bici) {
  return getImageUrl(bici.imagen_principal || bici.imagen || bici.url_imagen);
}

function getImagenVariante(variante) {
  return getImageUrl(
    variante?.imagen_principal ||
      variante?.imagen ||
      variante?.url_imagen
  );
}

function getTituloVariante(variante) {
  return [
    variante?.producto_nombre || variante?.nombre_producto || variante?.producto,
    variante?.nombre_variante || variante?.variante_nombre,
  ]
    .filter(Boolean)
    .join(" - ") || `Variante #${variante?.id_variante || variante?.id || "-"}`;
}

function getStockDisponibleVariante(variante) {
  return Number(
    variante?.stock_disponible ??
      variante?.stock_fisico ??
      variante?.stock ??
      0
  );
}

function getOperacionLabel(bici) {
  if (!bici?.cliente_actual_nombre) return null;

  if (bici.operacion_tipo === "reserva") return "Reservada por";
  if (bici.operacion_tipo === "venta_pendiente_entrega") return "Venta pendiente para";
  if (bici.operacion_tipo === "entregada") return "Dueño / cliente";

  return "Cliente asociado";
}

function getOperacionDetalle(bici) {
  if (!bici?.cliente_actual_nombre) return null;

  const partes = [];

  if (bici.operacion_tipo === "reserva" && bici.reserva_id) {
    partes.push(`Reserva #${bici.reserva_id}`);
  }

  if (
    (bici.operacion_tipo === "venta_pendiente_entrega" ||
      bici.operacion_tipo === "entregada") &&
    bici.venta_id
  ) {
    partes.push(`Venta #${bici.venta_id}`);
  }

  if (bici.cliente_actual_telefono) {
    partes.push(bici.cliente_actual_telefono);
  }

  return partes.join(" · ");
}

export default function BicicletasSerializadasPage() {
  const { usuarioId, sucursalId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1120px)");
  const [bicis, setBicis] = useState([]);
  const [estado, setEstado] = useState("disponible");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [panelAyudaAbierto, setPanelAyudaAbierto] = useState(false);
  const [queryVariante, setQueryVariante] = useState("");
  const [variantesSerializables, setVariantesSerializables] = useState([]);
  const [buscandoVariantes, setBuscandoVariantes] = useState(false);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState(null);

  const [form, setForm] = useState({
      id_variante: "",
      id_sucursal_actual: sucursalId,
      numero_cuadro: "",
      observaciones: "",
    });

  useEffect(() => {
    cargarSerializadas();
  }, [estado]);

  useEffect(() => {
    if (!mostrarAlta) return;

    let cancelado = false;

    async function buscarVariantesSerializables() {
      try {
        setBuscandoVariantes(true);

        const data = await listarCatalogoPOS({
          id_sucursal: sucursalId,
          query: queryVariante.trim() || undefined,
          limit: 80,
          offset: 0,
        });

        if (cancelado) return;

        const items = Array.isArray(data) ? data : data?.items || [];

        const serializables = items.filter((item) => {
          const stockDisponible = getStockDisponibleVariante(item);

          return Boolean(item.serializable) && stockDisponible > 0;
        });

        setVariantesSerializables(serializables);

        if (
          varianteSeleccionada &&
          !serializables.some(
            (item) =>
              String(item.id_variante || item.id) ===
              String(varianteSeleccionada.id_variante || varianteSeleccionada.id)
          )
        ) {
          setVarianteSeleccionada(null);
          setForm((p) => ({ ...p, id_variante: "" }));
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.message || "No se pudieron buscar bicicletas serializables");
        }
      } finally {
        if (!cancelado) setBuscandoVariantes(false);
      }
    }

    buscarVariantesSerializables();

    return () => {
      cancelado = true;
    };
  }, [mostrarAlta, queryVariante]);

  async function cargarSerializadas() {
    try {
      setLoading(true);
      setError("");

      const data = await listarSerializadas({
        estado: estado || undefined,
      });

      setBicis(data || []);

      if (!seleccionadaId && data?.length) {
        setSeleccionadaId(data[0].id);
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar las bicicletas serializadas");
    } finally {
      setLoading(false);
    }
  }

  function seleccionarVarianteSerializable(variante) {
    const idVariante = variante.id_variante || variante.id;

    setVarianteSeleccionada(variante);
    setForm((p) => ({
      ...p,
      id_variante: String(idVariante),
    }));
  }

  async function handleCrear(e) {
    e.preventDefault();

    if (!form.id_variante) {
      setError("Seleccioná una bicicleta serializable antes de crear la unidad");
      return;
    }

    if (!form.numero_cuadro.trim()) {
      setError("Número de cuadro es obligatorio");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const res = await crearSerializada({
        id_variante: Number(form.id_variante),
        id_sucursal_actual: Number(form.id_sucursal_actual),
        numero_cuadro: form.numero_cuadro.trim(),
        observaciones: form.observaciones.trim() || null,
        id_usuario: usuarioId,
      });

      setMensaje(`Bicicleta serializada creada. ID #${res.bicicleta_id}`);

      setForm((p) => ({
        ...p,
        numero_cuadro: "",
        observaciones: "",
      }));

      await cargarSerializadas();
      setSeleccionadaId(res.bicicleta_id);
      setMostrarAlta(false);
      setVarianteSeleccionada(null);
      setQueryVariante("");
    } catch (err) {
      setError(err.message || "No se pudo crear la bicicleta serializada");
    } finally {
      setProcesando(false);
    }
  }

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return bicis;

    return bicis.filter((bici) => {
      const texto = [
        bici.id,
        bici.id_producto,
        bici.id_variante,
        bici.producto_nombre,
        bici.nombre_variante,
        bici.sucursal_nombre,
        bici.numero_cuadro,
        bici.estado,
        bici.observaciones,
        bici.codigo_barras,
        bici.sku,
        bici.codigo_proveedor,
        bici.cliente_actual_nombre,
        bici.cliente_actual_telefono,
        bici.operacion_tipo,
        bici.venta_id,
        bici.reserva_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [bicis, query]);

  const resumen = useMemo(() => {
    return bicis.reduce(
      (acc, bici) => {
        acc.total += 1;
        acc[bici.estado] = (acc[bici.estado] || 0) + 1;
        return acc;
      },
      {
        total: 0,
        disponible: 0,
        reservada: 0,
        vendida_pendiente_entrega: 0,
        entregada: 0,
        fuera_de_stock: 0,
      }
    );
  }, [bicis]);

  const seleccionada = useMemo(() => {
    return filtradas.find((bici) => bici.id === seleccionadaId) || filtradas[0] || null;
  }, [filtradas, seleccionadaId]);

  if (loading) {
    return (
      <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
        <section style={loadingCardStyle}>Cargando bicicletas serializadas...</section>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyle, ...(isMobile ? pageMobileStyle : {}) }}>
      <header style={isMobile ? headerMobileStyle : headerStyle}>
        <div>
          <span style={kickerStyle}>Unidades únicas</span>
          <h1 style={{ ...titleStyle, ...(isMobile ? titleMobileStyle : {}) }}>Bicicletas serializadas</h1>
          <p style={mutedStyle}>
            Control operativo por número de cuadro. Por defecto se muestran solo las disponibles para venta.
          </p>
        </div>

        <div style={isMobile ? headerActionsMobileStyle : headerActionsStyle}>
          <button type="button" onClick={() => setPanelAyudaAbierto((v) => !v)} style={refreshButtonStyle}>
            Guía
          </button>

          <button type="button" onClick={() => setMostrarAlta(true)} style={primaryHeaderButtonStyle}>
            ＋ Serializar bicicleta
          </button>

          <button onClick={cargarSerializadas} disabled={procesando} style={refreshButtonStyle}>
            ↻ Refrescar
          </button>
        </div>
      </header>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <section style={isMobile ? metricGridMobileStyle : metricGridStyle}>
        <Metric label="Vista actual" value={resumen.total} tone="dark" />
        <Metric label="Disponibles" value={resumen.disponible} tone="ok" />
        <Metric label="Reservadas" value={resumen.reservada} tone="warning" />
        <Metric label="Pendientes" value={resumen.vendida_pendiente_entrega} tone="info" />
        <Metric label="Entregadas" value={resumen.entregada} tone="muted" />
      </section>

      {panelAyudaAbierto && (
        <section style={helpPanelStyle}>
          <strong>Regla operativa</strong>
          <span>
            Esta pantalla no es stock general. Usala para identificar una bicicleta física por número de cuadro.
            Para vender rápido, trabajá primero con el filtro Disponibles.
          </span>
        </section>
      )}

      <div style={isNarrow ? gridMobileStyle : gridStyle}>
        <section style={listPanelStyle}>
          <div style={toolbarStyle}>
            <div style={searchBoxStyle}>
              <span>🔎</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por cuadro, producto, variante, SKU, cliente o venta"
                style={searchInputStyle}
              />
            </div>

            <div style={filterPillsStyle}>
              {ESTADOS.map((e) => (
                <button
                  key={e.value || "todos"}
                  type="button"
                  onClick={() => setEstado(e.value)}
                  style={estado === e.value ? pillActiveStyle : pillStyle}
                >
                  <span>{e.emoji}</span>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {filtradas.length === 0 ? (
            <div style={emptyListStyle}>No hay bicicletas para mostrar.</div>
          ) : (
            <div style={isMobile ? cardsGridMobileStyle : cardsGridStyle}>
              {filtradas.map((bici) => (
                <BiciCard
                  key={bici.id}
                  bici={bici}
                  selected={seleccionada?.id === bici.id}
                  onClick={() => setSeleccionadaId(bici.id)}
                />
              ))}
            </div>
          )}
        </section>

        <aside style={sideStyle}>
          <section style={detailCardStyle}>
            <h2 style={cardTitleStyle}>Detalle operativo</h2>
            {seleccionada ? <BiciDetalle bici={seleccionada} /> : <p style={mutedStyle}>Seleccioná una unidad.</p>}
          </section>

        </aside>
      </div>

      {mostrarAlta && (
        <div style={modalOverlayStyle} onClick={() => setMostrarAlta(false)}>
          <section style={{ ...modalCardStyle, ...(isMobile ? modalCardMobileStyle : {}) }} onClick={(e) => e.stopPropagation()}>
            <div style={isMobile ? modalHeaderMobileStyle : modalHeaderStyle}>
              <div>
                <span style={kickerStyle}>Nueva unidad única</span>
                <h2 style={modalTitleStyle}>Armar bicicleta serializada</h2>
                <p style={modalSubtitleStyle}>
                  Usalo solo cuando una bicicleta física pasa de stock genérico a unidad con número de cuadro.
                </p>
              </div>

              <button type="button" onClick={() => setMostrarAlta(false)} style={closeButtonStyle}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCrear} style={modalFormStyle}>
              <div style={variantSearchPanelStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Buscar modelo para serializar</span>
                  <input
                    type="text"
                    value={queryVariante}
                    onChange={(e) => setQueryVariante(e.target.value)}
                    style={inputStyle}
                    placeholder="Nombre, código, SKU o variante..."
                  />
                </label>

                <div style={variantResultsStyle}>
                  {buscandoVariantes ? (
                    <div style={variantEmptyStyle}>Buscando bicicletas serializables...</div>
                  ) : variantesSerializables.length === 0 ? (
                    <div style={variantEmptyStyle}>
                      {queryVariante.trim()
                        ? "No encontré bicicletas serializables con stock para esa búsqueda."
                        : "Escribí o dejá vacío para ver bicicletas serializables con stock."}
                    </div>
                  ) : (
                    variantesSerializables.slice(0, 8).map((variante) => {
                      const idVariante = variante.id_variante || variante.id;
                      const selected =
                        String(idVariante) === String(form.id_variante);
                      const imagen = getImagenVariante(variante);

                      return (
                        <button
                          key={idVariante}
                          type="button"
                          onClick={() => seleccionarVarianteSerializable(variante)}
                          style={selected ? variantOptionSelectedStyle : variantOptionStyle}
                        >
                          <div style={variantImageBoxStyle}>
                            {imagen ? (
                              <img
                                src={imagen}
                                alt={getTituloVariante(variante)}
                                style={variantImageStyle}
                              />
                            ) : (
                              <span style={imageFallbackStyle}>🚲</span>
                            )}
                          </div>

                          <div style={variantInfoStyle}>
                            <strong>{getTituloVariante(variante)}</strong>
                            <span>
                              Variante #{idVariante} · Stock disponible: {getStockDisponibleVariante(variante)}
                            </span>
                            <span>
                              {variante.sku || variante.codigo_barras || variante.codigo_proveedor || "Sin código visible"}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {varianteSeleccionada && (
                  <div style={selectedVariantStyle}>
                    <span>Seleccionada</span>
                    <strong>{getTituloVariante(varianteSeleccionada)}</strong>
                    <small>
                      Variante #{varianteSeleccionada.id_variante || varianteSeleccionada.id} · Stock disponible: {getStockDisponibleVariante(varianteSeleccionada)}
                    </small>
                  </div>
                )}
              </div>

              <ReadOnlyField label="Sucursal" value={`Sucursal #${form.id_sucursal_actual}`} />

              <TextInput
                label="Número de cuadro"
                value={form.numero_cuadro}
                onChange={(v) => setForm((p) => ({ ...p, numero_cuadro: v }))}
                type="text"
                placeholder="Ej: JY25023453"
              />

              <label style={fieldStyle}>
                <span style={labelStyle}>Observaciones</span>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
                  style={textareaStyle}
                  placeholder="Ej: armada para salón, color, detalle visual..."
                />
              </label>

              <div style={dangerNoteStyle}>
                <strong>Atención operativa</strong>
                <span>
                 Usá esta opción cuando armes una bicicleta física y quieras identificarla por su número de cuadro.
                </span>
              </div>

              <div style={isMobile ? modalActionsMobileStyle : modalActionsStyle}>
                <button type="button" onClick={() => setMostrarAlta(false)} style={secondaryButtonStyle}>
                  Cancelar
                </button>

                <button type="submit" disabled={procesando} style={primaryButtonStyle}>
                  {procesando ? "Guardando..." : "Crear serializada"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </div>
  );
}

function BiciCard({ bici, selected, onClick }) {
  const imagen = getImagenBici(bici);

  return (
    <button type="button" onClick={onClick} style={selected ? biciCardSelectedStyle : biciCardStyle}>
      <div style={imageBoxStyle}>
        {imagen ? (
          <img src={imagen} alt={getTituloBici(bici)} style={imageStyle} />
        ) : (
          <span style={imageFallbackStyle}>🚲</span>
        )}
      </div>

      <div style={biciInfoStyle}>
        <div style={biciTopRowStyle}>
          <strong style={biciTitleStyle}>{getTituloBici(bici)}</strong>
          <EstadoBadge estado={bici.estado} />
        </div>

        <div style={cuadroBoxStyle}>
          <span>Cuadro</span>
          <strong>{bici.numero_cuadro}</strong>
        </div>

        {bici.cliente_actual_nombre && (
          <div style={ownerMiniStyle}>
            <span>{getOperacionLabel(bici)}</span>
            <strong>{bici.cliente_actual_nombre}</strong>
          </div>
        )}

        <div style={metaRowStyle}>
          <span>#{bici.id}</span>
          <span>Variante #{bici.id_variante}</span>
          <span>{bici.sucursal_nombre || "Sin sucursal"}</span>
        </div>
      </div>
    </button>
  );
}

function BiciDetalle({ bici }) {
  const imagen = getImagenBici(bici);

  return (
    <div style={detalleWrapStyle}>
      <div style={detalleImageBoxStyle}>
        {imagen ? (
          <img src={imagen} alt={getTituloBici(bici)} style={detalleImageStyle} />
        ) : (
          <span style={detalleFallbackStyle}>🚲</span>
        )}
      </div>

      <div>
        <EstadoBadge estado={bici.estado} />
        <h3 style={detalleTitleStyle}>{getTituloBici(bici)}</h3>
      </div>

      <div style={detalleCuadroStyle}>
        <span>Número de cuadro</span>
        <strong>{bici.numero_cuadro}</strong>
      </div>

      <div style={detalleGridStyle}>
        <Info label="ID unidad" value={`#${bici.id}`} />
        <Info label="Variante" value={`#${bici.id_variante}`} />
        <Info label="Sucursal" value={bici.sucursal_nombre || "-"} />
        <Info label="Estado" value={normalizarEstado(bici.estado)} />
      </div>

      {bici.cliente_actual_nombre && (
        <div style={ownerDetailStyle}>
          <span>{getOperacionLabel(bici)}</span>
          <strong>{bici.cliente_actual_nombre}</strong>
          {getOperacionDetalle(bici) && <small>{getOperacionDetalle(bici)}</small>}
        </div>
      )}

      <div style={obsBoxStyle}>
        <span>Observaciones</span>
        <p>{bici.observaciones || "Sin observaciones"}</p>
      </div>


    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoBoxStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div style={{ ...metricStyle, ...(metricToneStyles[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={readOnlyFieldStyle}>
      <span style={readOnlyLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "number", placeholder = "" }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        placeholder={placeholder}
      />
    </label>
  );
}

function EstadoBadge({ estado }) {
  const style =
    estado === "disponible"
      ? okPillStyle
      : estado === "entregada"
        ? mutedPillStyle
        : estado === "vendida_pendiente_entrega"
          ? infoPillStyle
          : warningPillStyle;

  return <span style={style}>{normalizarEstado(estado)}</span>;
}

const pageStyle = { padding: 20, background: "#f1f5f9", minHeight: "100vh" };
const pageMobileStyle = { padding: 12, overflowX: "hidden" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" };
const headerMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 14 };
const kickerStyle = { display: "block", color: "#f97316", fontWeight: 1000, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12 };
const titleStyle = { margin: "3px 0 0", color: "#0f172a", fontSize: 32 };
const titleMobileStyle = { fontSize: 26 };
const mutedStyle = { color: "#64748b", margin: "6px 0 0", fontWeight: 700 };

const headerActionsStyle = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
const headerActionsMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 8, width: "100%" };
const primaryHeaderButtonStyle = { border: "none", background: "#f97316", color: "white", borderRadius: 12, padding: "11px 14px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 10px 18px rgba(249, 115, 22, 0.25)" };
const refreshButtonStyle = { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 12, padding: "11px 14px", fontWeight: 900, cursor: "pointer" };
const loadingCardStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 24, color: "#334155", fontWeight: 900 };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: 12, borderRadius: 12, border: "1px solid #f4c7c3", marginBottom: 16, fontWeight: 800 };
const helpPanelStyle = { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", borderRadius: 16, padding: 14, marginBottom: 16, display: "grid", gap: 5, fontWeight: 800 };
const successStyle = { background: "#ecfdf5", color: "#047857", padding: 12, borderRadius: 12, border: "1px solid #86efac", marginBottom: 16, fontWeight: 800 };

const metricGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12, marginBottom: 16 };
const metricGridMobileStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 14 };
const metricStyle = { background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 14, display: "grid", gap: 5, boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)" };
const metricToneStyles = {
  dark: { color: "#0f172a" },
  ok: { color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" },
  warning: { color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" },
  info: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" },
  muted: { color: "#475569", background: "#f8fafc" },
};

const gridStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 390px", gap: 16, alignItems: "start" };
const gridMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 12, alignItems: "start" };
const listPanelStyle = { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, overflow: "hidden", boxShadow: "0 16px 34px rgba(15, 23, 42, 0.08)" };
const toolbarStyle = { display: "grid", gap: 12, padding: 16, borderBottom: "1px solid #e2e8f0", background: "#ffffff" };
const searchBoxStyle = { display: "flex", alignItems: "center", gap: 10, border: "1px solid #cbd5e1", borderRadius: 14, padding: "0 12px", background: "#f8fafc" };
const searchInputStyle = { flex: 1, border: "none", background: "transparent", outline: "none", padding: "13px 0", fontSize: 15, fontWeight: 700 };
const filterPillsStyle = { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 };
const pillStyle = { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 999, padding: "9px 12px", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 };
const pillActiveStyle = { ...pillStyle, background: "#f97316", borderColor: "#f97316", color: "white", boxShadow: "0 10px 18px rgba(249, 115, 22, 0.25)" };
const cardsGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12, padding: 16 };
const cardsGridMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 10, padding: 12 };
const emptyListStyle = { padding: 22, color: "#64748b", fontWeight: 900 };

const biciCardStyle = { width: "100%", textAlign: "left", border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 18, padding: 12, display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: 12, cursor: "pointer", color: "#0f172a", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)" };
const biciCardSelectedStyle = { ...biciCardStyle, borderColor: "#f97316", boxShadow: "0 14px 28px rgba(249, 115, 22, 0.18)" };
const imageBoxStyle = { height: 88, borderRadius: 16, background: "#f8fafc", display: "grid", placeItems: "center", overflow: "hidden", padding: 8, boxSizing: "border-box" };
const imageStyle = { width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" };
const imageFallbackStyle = { fontSize: 36 };
const biciInfoStyle = { minWidth: 0, display: "grid", gap: 8 };
const biciTopRowStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "start" };
const biciTitleStyle = { fontSize: 14, lineHeight: 1.25 };
const cuadroBoxStyle = { border: "1px solid #dbeafe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 12, padding: "8px 10px", display: "grid", gap: 2 };
const ownerMiniStyle = { border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", borderRadius: 12, padding: "8px 10px", display: "grid", gap: 2, fontSize: 12 };
const metaRowStyle = { display: "flex", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 12, fontWeight: 800 };

const sideStyle = { display: "grid", gap: 16, position: "sticky", top: 16 };
const cardStyle = { background: "white", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 16px 34px rgba(15, 23, 42, 0.08)", padding: 16 };
const detailCardStyle = { ...cardStyle, background: "#0f172a", color: "white" };
const cardTitleStyle = { marginTop: 0, marginBottom: 14, fontSize: 20 };
const formStyle = { display: "grid", gap: 10 };
const fieldStyle = { display: "flex", flexDirection: "column", gap: 7 };
const labelStyle = { fontWeight: 900, fontSize: 14, color: "#334155" };
const inputStyle = { width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 15, boxSizing: "border-box", fontWeight: 700 };
const readOnlyFieldStyle = { border: "1px solid #dbeafe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 14, padding: "11px 12px", display: "grid", gap: 4 };
const readOnlyLabelStyle = { color: "#64748b", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: "0.04em" };
const textareaStyle = { ...inputStyle, minHeight: 74, resize: "vertical", fontFamily: "inherit" };
const noteStyle = { background: "#f8fafc", borderLeft: "4px solid #f97316", padding: 10, borderRadius: 10, color: "#334155", marginTop: 12, fontWeight: 700 };
const primaryButtonStyle = { border: "none", background: "#16a34a", color: "white", borderRadius: 12, padding: 13, fontWeight: 1000, cursor: "pointer", boxShadow: "0 12px 24px rgba(22, 163, 74, 0.25)" };
const secondaryButtonStyle = { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 12, padding: 13, fontWeight: 1000, cursor: "pointer" };

const modalOverlayStyle = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.62)", backdropFilter: "blur(3px)", zIndex: 50, display: "grid", placeItems: "start center", padding: "24px 20px", overflowY: "auto" };
const modalCardStyle = { width: "min(760px, 96vw)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", background: "white", borderRadius: 24, border: "1px solid #e2e8f0", boxShadow: "0 28px 80px rgba(15, 23, 42, 0.35)", padding: 20 };
const modalCardMobileStyle = { width: "min(100%, 96vw)", padding: 14, borderRadius: 18 };
const modalHeaderStyle = { position: "sticky", top: -20, zIndex: 2, background: "white", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 14, marginBottom: 16, paddingTop: 2 };
const modalHeaderMobileStyle = { position: "sticky", top: -14, zIndex: 2, background: "white", display: "grid", gridTemplateColumns: "1fr auto", gap: 10, borderBottom: "1px solid #e2e8f0", paddingBottom: 12, marginBottom: 14, paddingTop: 2 };
const modalTitleStyle = { margin: "4px 0 0", color: "#0f172a", fontSize: 26 };
const modalSubtitleStyle = { margin: "6px 0 0", color: "#64748b", fontWeight: 700 };
const closeButtonStyle = { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", borderRadius: 12, width: 40, height: 40, fontWeight: 1000, cursor: "pointer" };
const modalFormStyle = { display: "grid", gap: 12 };
const modalGridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const variantSearchPanelStyle = { border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 16, padding: 12, display: "grid", gap: 12 };
const variantResultsStyle = { display: "grid", gap: 8, maxHeight: 260, overflowY: "auto", paddingRight: 4 };
const variantEmptyStyle = { border: "1px dashed #cbd5e1", background: "white", color: "#64748b", borderRadius: 14, padding: 14, fontWeight: 800, textAlign: "center" };
const variantOptionStyle = { width: "100%", border: "1px solid #e2e8f0", background: "white", color: "#0f172a", borderRadius: 14, padding: 10, display: "grid", gridTemplateColumns: "74px minmax(0, 1fr)", gap: 10, textAlign: "left", cursor: "pointer" };
const variantOptionSelectedStyle = { ...variantOptionStyle, borderColor: "#f97316", boxShadow: "0 10px 22px rgba(249, 115, 22, 0.18)" };
const variantImageBoxStyle = { height: 66, borderRadius: 12, background: "#f1f5f9", display: "grid", placeItems: "center", overflow: "hidden", padding: 6, boxSizing: "border-box" };
const variantImageStyle = { width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" };
const variantInfoStyle = { minWidth: 0, display: "grid", gap: 3, fontSize: 12, color: "#64748b" };
const selectedVariantStyle = { border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#047857", borderRadius: 14, padding: 12, display: "grid", gap: 3, fontWeight: 900 };
const dangerNoteStyle = { border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", borderRadius: 14, padding: 12, display: "grid", gap: 4, fontWeight: 800 };
const modalActionsStyle = { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10, marginTop: 4 };
const modalActionsMobileStyle = { display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 4 };

const detalleWrapStyle = { display: "grid", gap: 14 };
const detalleImageBoxStyle = { height: 190, borderRadius: 18, background: "#ffffff", display: "grid", placeItems: "center", overflow: "hidden", padding: 12, boxSizing: "border-box" };
const detalleImageStyle = { width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" };
const detalleFallbackStyle = { fontSize: 62 };
const detalleTitleStyle = { margin: "8px 0 0", fontSize: 19, lineHeight: 1.25 };
const detalleCuadroStyle = { background: "#1e293b", border: "1px solid rgba(148, 163, 184, .25)", borderRadius: 16, padding: 14, display: "grid", gap: 5 };
const detalleGridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const infoBoxStyle = { background: "#1e293b", borderRadius: 14, padding: 10, display: "grid", gap: 4, color: "#cbd5e1" };
const ownerDetailStyle = { background: "rgba(249, 115, 22, 0.14)", border: "1px solid rgba(251, 146, 60, 0.32)", color: "#fed7aa", borderRadius: 14, padding: 12, display: "grid", gap: 4 };
const obsBoxStyle = { background: "#1e293b", borderRadius: 14, padding: 12, color: "#cbd5e1" };

const basePillStyle = { borderRadius: 999, padding: "5px 9px", fontWeight: 1000, fontSize: 12, whiteSpace: "nowrap" };
const okPillStyle = { ...basePillStyle, background: "#dcfce7", color: "#047857" };
const warningPillStyle = { ...basePillStyle, background: "#fef3c7", color: "#b45309" };
const infoPillStyle = { ...basePillStyle, background: "#dbeafe", color: "#1d4ed8" };
const mutedPillStyle = { ...basePillStyle, background: "#e2e8f0", color: "#475569" };
