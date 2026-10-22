import { useEffect, useMemo, useState } from "react";
import { listarCatalogoPOS } from "../../services/catalogoService";
import { listarSerializadasDisponibles } from "../../services/serializadasService";
import {
  cambiarEstadoOferta,
  cerrarOfertasVencidas,
  crearOferta,
  editarOferta,
  listarOfertas,
} from "../../services/ofertasService";
import { useSession } from "../../context/SessionContext";
import { formatMoney, formatDate } from "../../utils/formatters";
import { formatProductoVariante } from "../../utils/productPresentation";

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function initialForm() {
  const desde = new Date();
  const hasta = new Date();
  hasta.setDate(hasta.getDate() + 7);
  return {
    nombre: "",
    precio_oferta: "",
    fecha_desde: isoDate(desde),
    fecha_hasta: isoDate(hasta),
    motivo: "",
    alcance: "variante",
    politica_contado: "precio_final_contado",
    ids_bicicletas_serializadas: [],
  };
}

export default function OfertasPanel({
  porcentajeDescuentoContado = 0,
  styles,
}) {
  const { usuarioId, sucursalId } = useSession();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [ofertas, setOfertas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [serializadas, setSerializadas] = useState([]);

  useEffect(() => {
    cargarOfertas();
  }, []);

  async function cargarOfertas() {
    try {
      setLoading(true);
      setError("");
      setOfertas(await listarOfertas({ incluir_inactivas: true }));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las ofertas");
    } finally {
      setLoading(false);
    }
  }

  async function buscar(e) {
    e.preventDefault();
    if (!query.trim()) {
      setError("Ingresá producto, SKU o código");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const data = await listarCatalogoPOS({
        id_sucursal: sucursalId,
        query: query.trim(),
        limit: 20,
        offset: 0,
      });
      setResultados(data?.items || []);
    } catch (err) {
      setError(err.message || "No se pudo buscar el producto");
    } finally {
      setLoading(false);
    }
  }

  async function cargarSerializadas(item, unidadesActuales = []) {
    if (!item?.id_variante) {
      setSerializadas([]);
      return;
    }
    const disponibles = await listarSerializadasDisponibles({
      id_variante: item.id_variante,
      id_sucursal: sucursalId,
    });
    const porId = new Map(
      [...(disponibles || []), ...unidadesActuales].map((unidad) => [Number(unidad.id), unidad])
    );
    setSerializadas([...porId.values()]);
  }

  async function seleccionar(item) {
    setSeleccionada(item);
    setEditandoId(null);
    setForm((actual) => ({
      ...initialForm(),
      nombre: `OFERTA ${item.producto_nombre}`,
      precio_oferta: "",
      motivo: actual.motivo,
    }));
    setResultados([]);
    setQuery(formatProductoVariante(item.producto_nombre, item.nombre_variante));
    try {
      await cargarSerializadas(item);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los números de cuadro");
    }
  }

  async function editar(item) {
    setEditandoId(item.id);
    setSeleccionada({
      id_variante: item.id_variante,
      producto_nombre: item.producto_nombre,
      nombre_variante: item.nombre_variante,
      sku: item.sku,
      precio_minorista: item.precio_regular_referencia,
    });
    setForm({
      nombre: item.nombre,
      precio_oferta: String(item.precio_oferta),
      fecha_desde: item.fecha_desde,
      fecha_hasta: item.fecha_hasta,
      motivo: item.motivo || "",
      alcance: item.alcance || "variante",
      politica_contado: item.politica_contado || "precio_lista_promocional",
      ids_bicicletas_serializadas: (item.unidades || []).map((unidad) => unidad.id),
    });
    try {
      await cargarSerializadas(item, item.unidades || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los números de cuadro");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function limpiar() {
    setSeleccionada(null);
    setEditandoId(null);
    setQuery("");
    setResultados([]);
    setForm(initialForm());
    setSerializadas([]);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!seleccionada) {
      setError("Seleccioná una variante");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMensaje("");
      const payload = {
        nombre: form.nombre.trim(),
        precio_oferta: form.precio_oferta,
        fecha_desde: form.fecha_desde,
        fecha_hasta: form.fecha_hasta,
        motivo: form.motivo.trim() || null,
        alcance: form.alcance,
        politica_contado: form.politica_contado,
        ids_bicicletas_serializadas:
          form.alcance === "unidades"
            ? form.ids_bicicletas_serializadas.map(Number)
            : [],
        id_usuario: usuarioId,
      };
      if (editandoId) {
        await editarOferta(editandoId, payload);
        setMensaje("Oferta actualizada correctamente.");
      } else {
        await crearOferta({
          ...payload,
          id_variante: Number(seleccionada.id_variante),
        });
        setMensaje("Oferta creada correctamente.");
      }
      limpiar();
      await cargarOfertas();
    } catch (err) {
      setError(err.message || "No se pudo guardar la oferta");
    } finally {
      setLoading(false);
    }
  }

  async function cambiarEstado(oferta) {
    try {
      setLoading(true);
      setError("");
      await cambiarEstadoOferta(oferta.id, {
        activa: !oferta.activa,
        id_usuario: usuarioId,
      });
      setMensaje(oferta.activa ? "Oferta desactivada." : "Oferta activada.");
      await cargarOfertas();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado");
    } finally {
      setLoading(false);
    }
  }

  async function cerrarVencidas() {
    try {
      setLoading(true);
      setError("");
      const resultado = await cerrarOfertasVencidas({ id_usuario: usuarioId });
      setMensaje(
        resultado.cantidad > 0
          ? `${resultado.cantidad} oferta(s) vencida(s) fueron cerradas.`
          : "No había ofertas vencidas pendientes de cierre."
      );
      await cargarOfertas();
    } catch (err) {
      setError(err.message || "No se pudieron cerrar las ofertas vencidas");
    } finally {
      setLoading(false);
    }
  }

  const vencidasActivas = useMemo(
    () => ofertas.filter((oferta) => oferta.activa && oferta.estado_calculado === "vencida"),
    [ofertas]
  );

  const preview = useMemo(() => {
    const regular = Number(seleccionada?.precio_minorista || 0);
    const oferta = Number(form.precio_oferta || 0);
    const descuento = Number(porcentajeDescuentoContado || 0);
    const contadoRegular = regular * (1 - descuento / 100);
    const contadoOferta = oferta * (1 - descuento / 100);
    return {
      regular,
      oferta,
      ahorro: Math.max(0, regular - oferta),
      contadoRegular,
      contadoOferta,
      valida: oferta > 0 && oferta < regular,
    };
  }, [form.precio_oferta, porcentajeDescuentoContado, seleccionada]);

  return (
    <div style={styles.manualGrid}>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Nueva oferta</h2>
        <p style={styles.mutedText}>
          El precio normal se conserva. La oferta vence automáticamente.
        </p>

        {!editandoId && (
          <>
            <form onSubmit={buscar} style={styles.searchRow}>
              <input
                style={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Producto, SKU o código"
              />
              <button style={styles.primaryButton} disabled={loading}>
                Buscar
              </button>
            </form>
            <div style={styles.results}>
              {resultados.map((item) => (
                <button
                  key={item.id_variante}
                  type="button"
                  style={styles.resultItem}
                  onClick={() => seleccionar(item)}
                >
                  <strong>
                    {formatProductoVariante(
                      item.producto_nombre,
                      item.nombre_variante,
                    )}
                  </strong>
                  <span>
                    {item.sku || `#${item.id_variante}`} ·{" "}
                    {formatMoney(item.precio_minorista)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {seleccionada && (
          <form onSubmit={guardar} style={styles.form}>
            <div style={styles.identityBox}>
              <strong>
                {formatProductoVariante(
                  seleccionada.producto_nombre,
                  seleccionada.nombre_variante,
                )}
              </strong>
              <span>Precio normal: {formatMoney(preview.regular)}</span>
            </div>
            <label style={styles.label}>
              Alcance
              <select
                style={styles.input}
                value={form.alcance}
                onChange={(e) => setForm((actual) => ({
                  ...actual,
                  alcance: e.target.value,
                  ids_bicicletas_serializadas: [],
                }))}
              >
                <option value="variante">Toda la variante</option>
                <option value="unidades">Números de cuadro elegidos</option>
              </select>
            </label>
            {form.alcance === "unidades" && (
              <div style={unitStyles.panel}>
                <strong>Unidades incluidas</strong>
                <span style={styles.mutedText}>Solo aparecen bicicletas disponibles y técnicamente listas.</span>
                <div style={unitStyles.grid}>
                  {serializadas.map((unidad) => {
                    const marcada = form.ids_bicicletas_serializadas.some((id) => Number(id) === Number(unidad.id));
                    const costo = Number(unidad.costo_total_unitario || 0);
                    const ganancia = Number(form.precio_oferta || 0) - costo;
                    const margen = Number(form.precio_oferta || 0) > 0
                      ? (ganancia / Number(form.precio_oferta)) * 100
                      : 0;
                    return (
                      <label key={unidad.id} style={{ ...unitStyles.option, ...(marcada ? unitStyles.optionSelected : {}) }}>
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => setForm((actual) => ({
                            ...actual,
                            ids_bicicletas_serializadas: marcada
                              ? actual.ids_bicicletas_serializadas.filter((id) => Number(id) !== Number(unidad.id))
                              : [...actual.ids_bicicletas_serializadas, unidad.id],
                          }))}
                        />
                        <span><strong>{unidad.numero_cuadro}</strong><small>Costo {formatMoney(costo)} · Ganancia {formatMoney(ganancia)} · Margen {margen.toFixed(1)}%</small></span>
                      </label>
                    );
                  })}
                </div>
                {serializadas.length === 0 && <span style={styles.offerWarning}>No hay cuadros disponibles y listos.</span>}
              </div>
            )}
            <label style={styles.label}>
              Nombre de la oferta
              <input
                style={styles.input}
                value={form.nombre}
                onChange={(e) =>
                  setForm((actual) => ({ ...actual, nombre: e.target.value }))
                }
                required
              />
            </label>
            <label style={styles.label}>
              Precio promocional
              <input
                style={styles.input}
                type="number"
                min="1"
                value={form.precio_oferta}
                onChange={(e) =>
                  setForm((actual) => ({
                    ...actual,
                    precio_oferta: e.target.value,
                  }))
                }
                required
              />
            </label>
            <div style={styles.filters}>
              <label style={styles.label}>
                Desde
                <input
                  style={styles.input}
                  type="date"
                  value={form.fecha_desde}
                  onChange={(e) =>
                    setForm((actual) => ({
                      ...actual,
                      fecha_desde: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label style={styles.label}>
                Hasta
                <input
                  style={styles.input}
                  type="date"
                  value={form.fecha_hasta}
                  onChange={(e) =>
                    setForm((actual) => ({
                      ...actual,
                      fecha_hasta: e.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>
            <label style={styles.label}>
              Política de contado
              <select
                style={styles.input}
                value={form.politica_contado}
                onChange={(e) => setForm((actual) => ({ ...actual, politica_contado: e.target.value }))}
              >
                <option value="precio_final_contado">Precio final de contado</option>
                <option value="precio_lista_promocional">Admite descuento por medio de pago</option>
              </select>
            </label>
            <label style={styles.label}>
              Motivo
              <input
                style={styles.input}
                value={form.motivo}
                onChange={(e) =>
                  setForm((actual) => ({ ...actual, motivo: e.target.value }))
                }
                placeholder="Ej: Argentina campeón"
              />
            </label>

            <div style={styles.offerPreview}>
              <span>Precio normal: {formatMoney(preview.regular)}</span>
              <strong>Oferta: {formatMoney(preview.oferta)}</strong>
              <span>Ahorro: {formatMoney(preview.ahorro)}</span>
              {Number(porcentajeDescuentoContado || 0) > 0 && (
                <>
                  <span>
                    Contado normal: {formatMoney(preview.contadoRegular)}
                  </span>
                  <strong>
                    Contado sobre oferta: {formatMoney(preview.contadoOferta)}
                  </strong>
                </>
              )}
              {preview.oferta > 0 && !preview.valida && (
                <span style={styles.offerWarning}>
                  El precio de oferta debe ser menor al precio normal.
                </span>
              )}
            </div>

            <div style={styles.actions}>
              <button
                type="submit"
                style={styles.primaryButton}
                disabled={loading || !preview.valida || (form.alcance === "unidades" && form.ids_bicicletas_serializadas.length === 0)}
              >
                {editandoId ? "Guardar cambios" : "Crear oferta"}
              </button>
              <button type="button" style={styles.secondaryButton} onClick={limpiar}>
                Cancelar
              </button>
            </div>
          </form>
        )}
        {!seleccionada && !resultados.length && (
          <div style={styles.empty}>Buscá un producto para crear la oferta.</div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.cardTitle}>Ofertas cargadas</h2>
            <span style={styles.counter}>{ofertas.length} oferta(s)</span>
          </div>
          <div style={styles.actions}>
            {vencidasActivas.length > 0 && (
              <button
                type="button"
                style={styles.primaryButton}
                onClick={cerrarVencidas}
                disabled={loading}
              >
                Cerrar vencidas ({vencidasActivas.length})
              </button>
            )}
            <button type="button" style={styles.secondaryButton} onClick={cargarOfertas}>
              Refrescar
            </button>
          </div>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        {mensaje && <div style={styles.success}>{mensaje}</div>}
        <div style={styles.offerList}>
          {ofertas.map((oferta) => (
            <article key={oferta.id} style={styles.offerCard}>
              <div style={styles.offerCardHeader}>
                <div>
                  <strong>{oferta.nombre}</strong>
                  <p style={styles.offerProduct}>
                    {formatProductoVariante(
                      oferta.producto_nombre,
                      oferta.nombre_variante,
                    )}
                  </p>
                  <span style={styles.counter}>
                    {oferta.alcance === "unidades"
                      ? `${oferta.unidades?.length || 0} cuadro(s)`
                      : "Toda la variante"}
                  </span>
                </div>
                <span
                  style={{
                    ...styles.badge,
                    ...(oferta.vigente
                      ? styles.badgeOffer
                      : oferta.activa
                        ? styles.badgePreview
                        : styles.badgeOff),
                  }}
                >
                  {{
                    vigente: "EN OFERTA",
                    programada: "PROGRAMADA",
                    vencida: "VENCIDA",
                    inactiva: "INACTIVA",
                  }[oferta.estado_calculado] || "INACTIVA"}
                </span>
              </div>
              <div style={styles.offerPrices}>
                <span style={styles.offerOldPrice}>
                  {formatMoney(oferta.precio_regular_referencia)}
                </span>
                <strong>{formatMoney(oferta.precio_oferta)}</strong>
                <span>Ahorrás {formatMoney(oferta.ahorro_unitario)}</span>
              </div>
              <p style={styles.offerDates}>
                {formatDate(oferta.fecha_desde)} al {formatDate(oferta.fecha_hasta)}
              </p>
              <p style={styles.offerDates}>
                {oferta.politica_contado === "precio_final_contado"
                  ? "Precio final de contado"
                  : "Admite beneficios por medio de pago"}
              </p>
              {oferta.unidades?.length > 0 && (
                <div style={unitStyles.chips}>
                  {oferta.unidades.map((unidad) => <span key={unidad.id} style={unitStyles.chip}>{unidad.numero_cuadro}</span>)}
                </div>
              )}
              <div style={styles.actions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => editar(oferta)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => cambiarEstado(oferta)}
                  disabled={loading}
                >
                  {oferta.activa ? "Desactivar" : "Activar"}
                </button>
              </div>
            </article>
          ))}
          {!loading && ofertas.length === 0 && (
            <div style={styles.empty}>Todavía no hay ofertas cargadas.</div>
          )}
        </div>
      </section>
    </div>
  );
}

const unitStyles = {
  panel: { display: "grid", gap: 8, padding: 12, border: "1px solid #cbd5e1", borderRadius: 7, background: "#f8fafc" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 },
  option: { display: "flex", gap: 8, alignItems: "flex-start", padding: 9, border: "1px solid #dbe3ef", borderRadius: 7, background: "#fff", cursor: "pointer" },
  optionSelected: { borderColor: "#f97316", background: "#fff7ed" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { padding: "4px 7px", border: "1px solid #fed7aa", borderRadius: 6, background: "#fff7ed", color: "#9a3412", fontSize: 12, fontWeight: 800 },
};
