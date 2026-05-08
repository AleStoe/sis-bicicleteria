import { useEffect, useMemo, useRef, useState } from "react";
import { listarCatalogoPOS } from "../services/catalogoService";
import { listarProveedores } from "../services/proveedoresService";
import {
  actualizarPrecioVariante,
  crearReglaPrecio,
  desactivarReglaPrecio,
  listarPreciosDesfasados,
  listarReglasPrecio,
  obtenerHistorialPrecioVariante,
  obtenerPrecioVariante,
  recalcularPreciosProveedor,
  sugerirPrecioVariante,
} from "../services/preciosService";
import { CURRENT_USER_ID, CURRENT_SUCURSAL_ID } from "../config/appConfig";

const ID_USUARIO = CURRENT_USER_ID || 1;
const ID_SUCURSAL = CURRENT_SUCURSAL_ID || 1;

export default function PreciosPage() {
  const buscarRef = useRef(null);

  const [tab, setTab] = useState("manual");

  const [proveedores, setProveedores] = useState([]);
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
    margen_porcentaje: "1.20",
    redondeo_base: "50",
  });

  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarInicial();
    setTimeout(() => buscarRef.current?.focus(), 100);
  }, []);

  async function cargarInicial() {
    try {
      setError("");

      const [provs, reglasData] = await Promise.all([
        listarProveedores({ solo_activos: true }),
        listarReglasPrecio({ solo_activas: false }),
      ]);

      setProveedores(provs || []);
      setReglas(reglasData || []);
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
        id_sucursal: ID_SUCURSAL,
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
        id_usuario: ID_USUARIO,
        tipo_movimiento: "actualizacion_manual",
        origen_tipo: "precios_page",
        origen_id: null,
      });

      setMensaje("Precio actualizado correctamente.");

      const actualizado = await obtenerPrecioVariante(varianteSeleccionada.id);
      const historialData = await obtenerHistorialPrecioVariante(varianteSeleccionada.id);

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

      const data = await recalcularPreciosProveedor({
        id_proveedor: Number(idProveedor),
        tipo_cliente: tipoCliente,
        aplicar: false,
      });

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

    if (!window.confirm("¿Aplicar cambios de precio al proveedor seleccionado?")) {
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const data = await recalcularPreciosProveedor({
        id_proveedor: Number(idProveedor),
        tipo_cliente: tipoCliente,
        aplicar: true,
        id_usuario: ID_USUARIO,
        motivo: motivoMasivo.trim() || "Recalculo manual por proveedor",
      });

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

      await crearReglaPrecio({
        nombre: reglaForm.nombre.trim(),
        id_categoria: null,
        id_marca: null,
        tipo_cliente: reglaForm.tipo_cliente,
        margen_porcentaje: reglaForm.margen_porcentaje,
        redondeo_base: reglaForm.redondeo_base,
      });

      setMensaje("Regla creada correctamente.");
      setReglaForm((p) => ({ ...p, nombre: "" }));

      const reglasData = await listarReglasPrecio({ solo_activas: false });
      setReglas(reglasData || []);
    } catch (err) {
      setError(err.message || "No se pudo crear la regla");
    } finally {
      setProcesando(false);
    }
  }

  async function desactivarRegla(reglaId) {
    if (!window.confirm("¿Desactivar esta regla de precio?")) return;

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      await desactivarReglaPrecio(reglaId, { id_usuario: ID_USUARIO });

      setMensaje("Regla desactivada.");
      const reglasData = await listarReglasPrecio({ solo_activas: false });
      setReglas(reglasData || []);
    } catch (err) {
      setError(err.message || "No se pudo desactivar la regla");
    } finally {
      setProcesando(false);
    }
  }

  const resumenMasivo = useMemo(() => {
    const totalSubas = desfasados
      .filter((i) => Number(i.diferencia) > 0)
      .reduce((acc, i) => acc + Number(i.diferencia), 0);

    const totalBajas = desfasados
      .filter((i) => Number(i.diferencia) < 0)
      .reduce((acc, i) => acc + Number(i.diferencia), 0);

    return {
      cantidad: desfasados.length,
      subas: totalSubas,
      bajas: totalBajas,
    };
  }, [desfasados]);

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
        <div style={styles.manualGrid}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Buscar variante</h2>

            <form onSubmit={buscarVariantes} style={styles.searchRow}>
              <input
                ref={buscarRef}
                style={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Producto, SKU, EAN o código proveedor"
              />
              <button type="submit" style={styles.primaryButton} disabled={loading}>
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </form>

            <div style={styles.results}>
              {resultados.map((item) => (
                <button
                  key={item.id_variante}
                  type="button"
                  style={styles.resultItem}
                  onClick={() => seleccionarVariante(item)}
                >
                  <strong>
                    {item.producto_nombre} - {item.nombre_variante}
                  </strong>
                  <span>
                    SKU: {item.sku || "-"} · EAN: {item.codigo_barras || "-"} · Prov:{" "}
                    {item.codigo_proveedor || "-"}
                  </span>
                  <span>
                    Minorista: {formatMoney(item.precio_minorista)} · Mayorista:{" "}
                    {formatMoney(item.precio_mayorista)}
                  </span>
                </button>
              ))}

              {!loading && resultados.length === 0 && (
                <div style={styles.empty}>Buscá una variante para editar precio.</div>
              )}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Precio actual</h2>

            {!varianteSeleccionada ? (
              <div style={styles.empty}>Seleccioná una variante.</div>
            ) : (
              <>
                <div style={styles.identityBox}>
                  <strong>
                    {varianteSeleccionada.producto_nombre} -{" "}
                    {varianteSeleccionada.nombre_variante}
                  </strong>
                  <span>SKU: {varianteSeleccionada.sku || "-"}</span>
                  <span>EAN: {varianteSeleccionada.codigo_barras || "-"}</span>
                  <span>Código proveedor: {varianteSeleccionada.codigo_proveedor || "-"}</span>
                </div>

                <div style={styles.priceGrid}>
                  <InfoBox
                    label="Costo promedio"
                    value={formatMoney(varianteSeleccionada.costo_promedio_vigente)}
                  />
                  <InfoBox
                    label="Minorista"
                    value={formatMoney(varianteSeleccionada.precio_minorista)}
                  />
                  <InfoBox
                    label="Margen minorista"
                    value={formatPercent(margenMinorista)}
                  />
                  <InfoBox
                    label="Mayorista"
                    value={formatMoney(varianteSeleccionada.precio_mayorista)}
                  />
                  <InfoBox
                    label="Margen mayorista"
                    value={formatPercent(margenMayorista)}
                  />
                </div>

                <form onSubmit={guardarPrecioManual} style={styles.form}>
                  <label style={styles.label}>
                    Precio minorista
                    <input
                      style={styles.input}
                      type="number"
                      value={formPrecio.precio_minorista}
                      onChange={(e) =>
                        setFormPrecio((p) => ({
                          ...p,
                          precio_minorista: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label style={styles.label}>
                    Precio mayorista
                    <input
                      style={styles.input}
                      type="number"
                      value={formPrecio.precio_mayorista}
                      onChange={(e) =>
                        setFormPrecio((p) => ({
                          ...p,
                          precio_mayorista: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label style={styles.label}>
                    Motivo obligatorio
                    <textarea
                      style={styles.textarea}
                      value={formPrecio.motivo}
                      onChange={(e) =>
                        setFormPrecio((p) => ({ ...p, motivo: e.target.value }))
                      }
                    />
                  </label>

                  <button type="submit" style={styles.primaryButton} disabled={procesando}>
                    {procesando ? "Guardando..." : "Guardar precio"}
                  </button>
                </form>

                <div style={styles.suggestionBox}>
                  <div style={styles.searchRow}>
                    <select
                      style={styles.input}
                      value={tipoSugerencia}
                      onChange={(e) => setTipoSugerencia(e.target.value)}
                    >
                      <option value="minorista">Sugerir minorista</option>
                      <option value="mayorista">Sugerir mayorista</option>
                    </select>

                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={calcularSugerencia}
                      disabled={procesando}
                    >
                      Calcular
                    </button>
                  </div>

                  {sugerencia && (
                    <div style={styles.suggestionResult}>
                      <div>
                        <strong>{formatMoney(sugerencia.precio_sugerido)}</strong>
                        <span>
                          Regla: {sugerencia.regla_nombre || "-"} · Margen:{" "}
                          {formatPercent(sugerencia.margen_porcentaje)}
                        </span>
                      </div>

                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={usarSugerencia}
                      >
                        Usar sugerido
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <section style={styles.cardWide}>
            <div style={styles.tableHeader}>
              <h2 style={styles.cardTitle}>Historial</h2>
              <span style={styles.counter}>{historial.length} movimiento(s)</span>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Minorista</th>
                    <th style={styles.th}>Mayorista</th>
                    <th style={styles.th}>Costo</th>
                    <th style={styles.th}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((mov) => (
                    <tr key={mov.id}>
                      <td style={styles.td}>{formatDate(mov.created_at)}</td>
                      <td style={styles.td}>{mov.tipo_movimiento}</td>
                      <td style={styles.td}>
                        {formatMoney(mov.precio_minorista_anterior)} →{" "}
                        <strong>{formatMoney(mov.precio_minorista_nuevo)}</strong>
                      </td>
                      <td style={styles.td}>
                        {formatMoney(mov.precio_mayorista_anterior)} →{" "}
                        <strong>{formatMoney(mov.precio_mayorista_nuevo)}</strong>
                      </td>
                      <td style={styles.td}>
                        {formatMoney(mov.costo_anterior)} → {formatMoney(mov.costo_nuevo)}
                      </td>
                      <td style={styles.td}>{mov.motivo || "-"}</td>
                    </tr>
                  ))}

                  {historial.length === 0 && (
                    <tr>
                      <td style={styles.empty} colSpan={6}>
                        Sin historial para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "masivo" && (
        <>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Recalculo por proveedor</h2>

            <div style={styles.filters}>
              <label style={styles.label}>
                Proveedor
                <select
                  style={styles.input}
                  value={idProveedor}
                  onChange={(e) => {
                    setIdProveedor(e.target.value);
                    setPreview(null);
                    setDesfasados([]);
                  }}
                >
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id} - {p.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Tipo cliente
                <select
                  style={styles.input}
                  value={tipoCliente}
                  onChange={(e) => {
                    setTipoCliente(e.target.value);
                    setPreview(null);
                    setDesfasados([]);
                  }}
                >
                  <option value="minorista">Minorista</option>
                  <option value="mayorista">Mayorista</option>
                </select>
              </label>
            </div>

            <label style={styles.label}>
              Motivo para aplicar cambios
              <input
                style={styles.input}
                value={motivoMasivo}
                onChange={(e) => setMotivoMasivo(e.target.value)}
              />
            </label>

            <div style={styles.actions}>
              <button
                style={styles.secondaryButton}
                type="button"
                onClick={buscarDesfasados}
                disabled={loading || procesando}
              >
                {loading ? "Buscando..." : "Ver desfasados"}
              </button>

              <button
                style={styles.secondaryButton}
                type="button"
                onClick={generarPreview}
                disabled={procesando}
              >
                {procesando ? "Procesando..." : "Preview recalculo"}
              </button>

              <button
                style={styles.primaryButton}
                type="button"
                onClick={aplicarCambios}
                disabled={procesando || !preview || preview.total_detectados === 0}
              >
                Aplicar cambios
              </button>
            </div>
          </section>

          <section style={styles.summaryGrid}>
            <InfoBox label="Desfasados" value={resumenMasivo.cantidad} />
            <InfoBox label="Subas acumuladas" value={formatMoney(resumenMasivo.subas)} />
            <InfoBox label="Bajas acumuladas" value={formatMoney(resumenMasivo.bajas)} />
            <InfoBox
              label="Modo"
              value={preview?.aplicado ? "Aplicado" : preview ? "Preview" : "-"}
            />
          </section>

          <section style={styles.card}>
            <div style={styles.tableHeader}>
              <h2 style={styles.cardTitle}>Resultado</h2>
              <span style={styles.counter}>{desfasados.length} item(s)</span>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Variante</th>
                    <th style={styles.th}>Costo</th>
                    <th style={styles.th}>Actual</th>
                    <th style={styles.th}>Sugerido</th>
                    <th style={styles.th}>Dif.</th>
                    <th style={styles.th}>Margen real</th>
                    <th style={styles.th}>Regla</th>
                    <th style={styles.th}>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {desfasados.map((item) => (
                    <tr key={`${item.id_variante}-${item.tipo_cliente}`}>
                      <td style={styles.tdStrong}>{item.producto_nombre}</td>
                      <td style={styles.td}>{item.nombre_variante}</td>
                      <td style={styles.td}>{formatMoney(item.costo_base)}</td>
                      <td style={styles.td}>{formatMoney(item.precio_actual)}</td>
                      <td style={styles.tdStrong}>{formatMoney(item.precio_sugerido)}</td>
                      <td
                        style={{
                          ...styles.tdStrong,
                          color: Number(item.diferencia) >= 0 ? "#137333" : "#b42318",
                        }}
                      >
                        {formatMoney(item.diferencia)}
                      </td>
                      <td style={styles.td}>{formatPercent(item.margen_real)}</td>
                      <td style={styles.td}>{item.regla_nombre}</td>
                      <td style={styles.td}>
                        {item.aplicado ? (
                          <span style={{ ...styles.badge, ...styles.badgeOk }}>
                            Aplicado
                          </span>
                        ) : (
                          <span style={{ ...styles.badge, ...styles.badgePreview }}>
                            Preview
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!loading && desfasados.length === 0 && (
                    <tr>
                      <td style={styles.empty} colSpan={9}>
                        No hay resultados para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "reglas" && (
        <div style={styles.rulesGrid}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Crear regla global</h2>

            <form onSubmit={crearRegla} style={styles.form}>
              <label style={styles.label}>
                Nombre
                <input
                  style={styles.input}
                  value={reglaForm.nombre}
                  onChange={(e) =>
                    setReglaForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                  placeholder="Ej: Minorista general 120%"
                />
              </label>

              <label style={styles.label}>
                Tipo cliente
                <select
                  style={styles.input}
                  value={reglaForm.tipo_cliente}
                  onChange={(e) =>
                    setReglaForm((p) => ({ ...p, tipo_cliente: e.target.value }))
                  }
                >
                  <option value="minorista">Minorista</option>
                  <option value="mayorista">Mayorista</option>
                </select>
              </label>

              <label style={styles.label}>
                Margen porcentaje
                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  value={reglaForm.margen_porcentaje}
                  onChange={(e) =>
                    setReglaForm((p) => ({
                      ...p,
                      margen_porcentaje: e.target.value,
                    }))
                  }
                />
              </label>

              <label style={styles.label}>
                Redondeo base
                <input
                  style={styles.input}
                  type="number"
                  value={reglaForm.redondeo_base}
                  onChange={(e) =>
                    setReglaForm((p) => ({ ...p, redondeo_base: e.target.value }))
                  }
                />
              </label>

              <button type="submit" style={styles.primaryButton} disabled={procesando}>
                Crear regla
              </button>
            </form>

            <div style={styles.note}>
              Esta alta crea reglas globales. Las reglas por categoría/marca conviene hacerlas
              después con selector dedicado.
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.tableHeader}>
              <h2 style={styles.cardTitle}>Reglas</h2>
              <button type="button" onClick={cargarInicial} style={styles.secondaryButton}>
                Refrescar
              </button>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nombre</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Margen</th>
                    <th style={styles.th}>Redondeo</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {reglas.map((regla) => (
                    <tr key={regla.id}>
                      <td style={styles.tdStrong}>{regla.nombre}</td>
                      <td style={styles.td}>{regla.tipo_cliente}</td>
                      <td style={styles.td}>{formatPercent(regla.margen_porcentaje)}</td>
                      <td style={styles.td}>{formatMoney(regla.redondeo_base)}</td>
                      <td style={styles.td}>
                        {regla.activa ? (
                          <span style={{ ...styles.badge, ...styles.badgeOk }}>
                            Activa
                          </span>
                        ) : (
                          <span style={{ ...styles.badge, ...styles.badgeOff }}>
                            Inactiva
                          </span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {regla.activa ? (
                          <button
                            type="button"
                            onClick={() => desactivarRegla(regla.id)}
                            disabled={procesando}
                          >
                            Desactivar
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}

                  {reglas.length === 0 && (
                    <tr>
                      <td style={styles.empty} colSpan={6}>
                        No hay reglas cargadas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
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

function calcularMargen(costo, precio) {
  const c = Number(costo || 0);
  const p = Number(precio || 0);
  if (c <= 0) return 0;
  return p / c - 1;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR");
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
    gridTemplateColumns: "380px 1fr",
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
    minWidth: "980px",
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