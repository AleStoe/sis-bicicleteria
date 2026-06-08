import { useEffect, useMemo, useState } from "react";
import {
  anularGasto,
  cambiarEstadoCategoriaGasto,
  corregirGasto,
  crearCategoriaGasto,
  crearGasto,
  editarCategoriaGasto,
  listarCategoriasGasto,
  listarGastos,
  obtenerGasto,
  obtenerResumenGastos,
} from "../services/gastosService";
import { formatDate, formatMoney } from "../utils/formatters";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { PromptModal } from "../components/ui/PromptModal";

const ID_USUARIO = 1;
const ID_SUCURSAL_DEFAULT = 1;

const MOBILE_BREAKPOINT = 760;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (event) => setIsMobile(event.matches);

    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);

    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}


const FORM_GASTO_INICIAL = {
  descripcion: "",
  monto: "",
  medio_pago: "efectivo",
  impacta_caja: true,
  id_categoria_gasto: "",
  fecha: "",
  periodo_mes: "",
  es_recurrente: false,
};

const FORM_CATEGORIA_INICIAL = {
  nombre: "",
  activa: true,
};

const MEDIOS = [
  { value: "todos", label: "Todos" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "tarjeta", label: "Tarjeta" },
];

const ESTADOS = [
  { value: "todos", label: "Todos" },
  { value: "activo", label: "Activos" },
  { value: "anulado", label: "Anulados" },
];

export default function GastosPage() {
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [gastoSeleccionado, setGastoSeleccionado] = useState(null);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);

  const [formGasto, setFormGasto] = useState(FORM_GASTO_INICIAL);
  const [formCategoria, setFormCategoria] = useState(FORM_CATEGORIA_INICIAL);
  const [categoriaEditandoId, setCategoriaEditandoId] = useState(null);

  const [filtros, setFiltros] = useState({
    q: "",
    estado: "activo",
    medio_pago: "todos",
    id_categoria_gasto: "todos",
    impacta_caja: "todos",
    es_recurrente: "todos",
    fecha_desde: "",
    fecha_hasta: "",
    limit: 200,
    offset: 0,
  });

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [promptConfig, setPromptConfig] = useState(null);
  const [mostrarCategoriasInactivas, setMostrarCategoriasInactivas] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    cargarCategorias();
  }, [mostrarCategoriasInactivas]);

  useEffect(() => {
    cargarGastos();
  }, []);

  async function cargarTodo() {
    await Promise.all([cargarCategorias(), cargarGastos()]);
  }

  async function cargarCategorias() {
    try {
      const data = await listarCategoriasGasto({ incluir_inactivas: mostrarCategoriasInactivas });
      setCategorias(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las categorías");
    }
  }

  async function cargarGastos(filtrosOverride = filtros) {
    try {
      setCargando(true);
      setError("");
      const params = filtrosToApi(filtrosOverride);

      const [lista, resumenData] = await Promise.all([
        listarGastos(params),
        obtenerResumenGastos(params),
      ]);

      setGastos(lista || []);
      setResumen(resumenData || null);

      setGastoSeleccionado((actual) => {
        const siguiente = actual
          ? (lista || []).find((gasto) => gasto.id === actual.id)
          : null;
        return siguiente || (lista || [])[0] || null;
      });
    } catch (err) {
      setError(err.message || "No se pudieron cargar los gastos");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!gastoSeleccionado?.id) {
      setDetalleSeleccionado(null);
      return;
    }

    cargarDetalle(gastoSeleccionado.id);
  }, [gastoSeleccionado?.id]);

  async function cargarDetalle(gastoId) {
    try {
      const data = await obtenerGasto(gastoId);
      setDetalleSeleccionado(data || null);
    } catch (err) {
      setDetalleSeleccionado(null);
      setError(err.message || "No se pudo cargar el detalle del gasto");
    }
  }

  function actualizarFiltro(campo, valor) {
    setFiltros((prev) => ({ ...prev, [campo]: valor, offset: 0 }));
  }

  function actualizarGasto(campo, valor) {
    setFormGasto((prev) => ({ ...prev, [campo]: valor }));
  }

  function actualizarCategoria(campo, valor) {
    setFormCategoria((prev) => ({ ...prev, [campo]: valor }));
  }

  async function aplicarFiltros(e) {
    e?.preventDefault?.();
    await cargarGastos({ ...filtros, offset: 0 });
  }

  async function limpiarFiltros() {
    const nuevos = {
      q: "",
      estado: "activo",
      medio_pago: "todos",
      id_categoria_gasto: "todos",
      impacta_caja: "todos",
      es_recurrente: "todos",
      fecha_desde: "",
      fecha_hasta: "",
      limit: 200,
      offset: 0,
    };
    setFiltros(nuevos);
    await cargarGastos(nuevos);
  }

  function validarGasto() {
    if (!formGasto.descripcion.trim()) return "La descripción es obligatoria";
    if (Number(formGasto.monto) <= 0) return "El monto debe ser mayor a cero";
    if (formGasto.periodo_mes && !formGasto.periodo_mes.endsWith("-01")) {
      return "El período mensual debe cargarse como primer día del mes. Ej: 2026-06-01";
    }
    return "";
  }

  async function guardarGasto(e) {
    e.preventDefault();

    const errorValidacion = validarGasto();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    const payload = {
      id_sucursal: ID_SUCURSAL_DEFAULT,
      id_categoria_gasto: formGasto.id_categoria_gasto ? Number(formGasto.id_categoria_gasto) : null,
      descripcion: formGasto.descripcion.trim(),
      monto: Number(formGasto.monto),
      medio_pago: formGasto.medio_pago || null,
      impacta_caja: Boolean(formGasto.impacta_caja),
      fecha: formGasto.fecha || null,
      periodo_mes: formGasto.periodo_mes || null,
      es_recurrente: Boolean(formGasto.es_recurrente),
      id_usuario: ID_USUARIO,
    };

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const creado = await crearGasto(payload);
      setFormGasto(FORM_GASTO_INICIAL);
      setMensaje(
        creado?.caja_movimiento_id
          ? "Gasto creado e impactado en caja correctamente"
          : "Gasto creado correctamente"
      );
      await cargarGastos();
    } catch (err) {
      setError(err.message || "No se pudo crear el gasto");
    } finally {
      setGuardando(false);
    }
  }

  function editarCategoria(categoria) {
    setCategoriaEditandoId(categoria.id);
    setFormCategoria({
      nombre: categoria.nombre || "",
      activa: Boolean(categoria.activa),
    });
    setMensaje("");
    setError("");
  }

  function cancelarCategoria() {
    setCategoriaEditandoId(null);
    setFormCategoria(FORM_CATEGORIA_INICIAL);
  }

  async function guardarCategoria(e) {
    e.preventDefault();

    if (!formCategoria.nombre.trim()) {
      setError("El nombre de la categoría es obligatorio");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (categoriaEditandoId) {
        await editarCategoriaGasto(categoriaEditandoId, {
          nombre: formCategoria.nombre.trim(),
          activa: Boolean(formCategoria.activa),
        });
        setMensaje("Categoría actualizada correctamente");
      } else {
        await crearCategoriaGasto({ nombre: formCategoria.nombre.trim() });
        setMensaje("Categoría creada correctamente");
      }

      cancelarCategoria();
      await cargarCategorias();
    } catch (err) {
      setError(err.message || "No se pudo guardar la categoría");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstadoCategoria(categoria, activa) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await cambiarEstadoCategoriaGasto(categoria.id, activa);
      setMensaje(activa ? "Categoría activada correctamente" : "Categoría desactivada correctamente");
      await cargarCategorias();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado de la categoría");
    } finally {
      setGuardando(false);
    }
  }

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

  function pedirMotivo(config) {
    return new Promise((resolve) => {
      setPromptConfig({
        ...config,
        onConfirm: (value) => {
          setPromptConfig(null);
          resolve(value);
        },
        onCancel: () => {
          setPromptConfig(null);
          resolve(null);
        },
      });
    });
  }

  async function anular(gasto) {
    const confirmado = await pedirConfirmacion({
      title: `Anular gasto #${gasto.id}`,
      message: gasto.impacta_caja
        ? "Este gasto impactó caja. Si la caja asociada sigue abierta, se generará un ingreso compensatorio. Si está cerrada, el backend lo va a bloquear."
        : "El gasto quedará anulado y no contará como gasto activo.",
      confirmText: "Anular gasto",
      variant: "danger",
    });

    if (!confirmado) return;

    const motivo = await pedirMotivo({
      title: "Motivo de anulación",
      message: "Dejá un motivo claro para auditoría.",
      label: "Motivo",
      placeholder: "Ej: carga duplicada",
      required: true,
      minLength: 3,
      confirmText: "Continuar",
    });

    if (!motivo) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await anularGasto(gasto.id, {
        motivo,
        id_usuario: ID_USUARIO,
      });
      setMensaje("Gasto anulado correctamente");
      await cargarGastos();
    } catch (err) {
      setError(err.message || "No se pudo anular el gasto");
    } finally {
      setGuardando(false);
    }
  }

  function prepararCorreccion(gasto) {
    setFormGasto({
      descripcion: gasto.descripcion || "",
      monto: gasto.monto != null ? String(gasto.monto) : "",
      medio_pago: gasto.medio_pago || "efectivo",
      impacta_caja: Boolean(gasto.impacta_caja),
      id_categoria_gasto: gasto.id_categoria_gasto ? String(gasto.id_categoria_gasto) : "",
      fecha: gasto.fecha || "",
      periodo_mes: gasto.periodo_mes || "",
      es_recurrente: Boolean(gasto.es_recurrente),
    });
    setGastoSeleccionado(gasto);
    setMensaje("Editá el formulario y usá 'Corregir gasto seleccionado'.");
    setError("");
  }

  async function corregirSeleccionado(e) {
    e.preventDefault();

    if (!gastoSeleccionado) {
      setError("Seleccioná un gasto para corregir");
      return;
    }

    if (gastoSeleccionado.estado === "anulado") {
      setError("No se puede corregir un gasto anulado");
      return;
    }

    const errorValidacion = validarGasto();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    const motivo = await pedirMotivo({
      title: `Motivo de corrección #${gastoSeleccionado.id}`,
      message: "Si el gasto impactó caja y cambió el monto, el backend genera la diferencia.",
      label: "Motivo",
      placeholder: "Ej: monto real de factura",
      required: true,
      minLength: 3,
      confirmText: "Corregir",
    });

    if (!motivo) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await corregirGasto(gastoSeleccionado.id, {
        descripcion: formGasto.descripcion.trim(),
        monto: Number(formGasto.monto),
        id_categoria_gasto: formGasto.id_categoria_gasto ? Number(formGasto.id_categoria_gasto) : null,
        medio_pago: formGasto.medio_pago || null,
        periodo_mes: formGasto.periodo_mes || null,
        motivo,
        id_usuario: ID_USUARIO,
      });

      setFormGasto(FORM_GASTO_INICIAL);
      setMensaje("Gasto corregido correctamente");
      await cargarGastos();
    } catch (err) {
      setError(err.message || "No se pudo corregir el gasto");
    } finally {
      setGuardando(false);
    }
  }

  const categoriasActivas = useMemo(
    () => categorias.filter((categoria) => categoria.activa),
    [categorias]
  );

  const gastoActivoSeleccionado = gastoSeleccionado && gastoSeleccionado.estado !== "anulado";

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <header style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div>
          <p style={styles.kicker}>Finanzas</p>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Gastos operativos</h1>
          <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
            Registrá gastos reales del negocio sin mezclarlos con retiros, préstamos o distribución de ganancias.
          </p>
        </div>

        <button type="button" onClick={cargarTodo} disabled={cargando} style={{ ...styles.secondaryHeroButton, ...(isMobile ? styles.heroButtonMobile : {}) }}>
          {cargando ? "Cargando..." : "↻ Actualizar"}
        </button>
      </header>

      {mensaje && <div style={styles.success}>{mensaje}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      <section style={{ ...styles.summaryGrid, ...(isMobile ? styles.summaryGridMobile : {}) }}>
        <SummaryCard label="Gastos activos" value={formatMoney(resumen?.total_activos || 0)} sub={`${resumen?.cantidad_activos || 0} registro(s)`} />
        <SummaryCard label="Gastos anulados" value={formatMoney(resumen?.total_anulados || 0)} sub={`${resumen?.cantidad_anulados || 0} registro(s)`} />
        <SummaryCard label="Total filtrado" value={formatMoney(resumen?.total || 0)} sub={`${resumen?.cantidad || 0} registro(s)`} />
        <SummaryCard label="Vista actual" value={String(gastos.length)} sub="gastos en tabla" />
      </section>

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={{ ...styles.leftColumn, ...(isMobile ? styles.leftColumnMobile : {}) }}>
          <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Alta</p>
                <h2 style={styles.cardTitle}>Nuevo gasto</h2>
              </div>
              {gastoSeleccionado && (
                <button type="button" onClick={() => setFormGasto(FORM_GASTO_INICIAL)} style={styles.smallSecondary}>
                  Limpiar
                </button>
              )}
            </div>

            <form onSubmit={guardarGasto} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.label}>Descripción *</span>
                <input
                  value={formGasto.descripcion}
                  onChange={(e) => actualizarGasto("descripcion", e.target.value)}
                  placeholder="Ej: Luz local, envío proveedor, herramienta..."
                  style={styles.input}
                />
              </label>

              <div style={{ ...styles.formRow, ...(isMobile ? styles.formRowMobile : {}) }}>
                <label style={styles.field}>
                  <span style={styles.label}>Monto *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formGasto.monto}
                    onChange={(e) => actualizarGasto("monto", e.target.value)}
                    placeholder="30000"
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Medio pago</span>
                  <select
                    value={formGasto.medio_pago}
                    onChange={(e) => actualizarGasto("medio_pago", e.target.value)}
                    style={styles.input}
                  >
                    {MEDIOS.filter((m) => m.value !== "todos").map((medio) => (
                      <option key={medio.value} value={medio.value}>{medio.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={styles.field}>
                <span style={styles.label}>Categoría</span>
                <select
                  value={formGasto.id_categoria_gasto}
                  onChange={(e) => actualizarGasto("id_categoria_gasto", e.target.value)}
                  style={styles.input}
                >
                  <option value="">Sin categoría</option>
                  {categoriasActivas.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                  ))}
                </select>
              </label>

              <div style={{ ...styles.formRow, ...(isMobile ? styles.formRowMobile : {}) }}>
                <label style={styles.field}>
                  <span style={styles.label}>Fecha</span>
                  <input
                    type="date"
                    value={formGasto.fecha}
                    onChange={(e) => actualizarGasto("fecha", e.target.value)}
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Período mes</span>
                  <input
                    type="date"
                    value={formGasto.periodo_mes}
                    onChange={(e) => actualizarGasto("periodo_mes", e.target.value)}
                    style={styles.input}
                  />
                </label>
              </div>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formGasto.impacta_caja}
                  onChange={(e) => actualizarGasto("impacta_caja", e.target.checked)}
                />
                Impacta caja ahora
              </label>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formGasto.es_recurrente}
                  onChange={(e) => actualizarGasto("es_recurrente", e.target.checked)}
                />
                Gasto recurrente
              </label>

              <button type="submit" disabled={guardando} style={styles.primaryButton}>
                {guardando ? "Guardando..." : "Crear gasto"}
              </button>

              {gastoSeleccionado && (
                <button
                  type="button"
                  disabled={guardando || !gastoActivoSeleccionado}
                  onClick={corregirSeleccionado}
                  style={gastoActivoSeleccionado ? styles.darkButton : styles.disabledButton}
                >
                  Corregir gasto seleccionado
                </button>
              )}
            </form>
          </div>

          <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Categorías</p>
                <h2 style={styles.cardTitle}>{categoriaEditandoId ? `Editar #${categoriaEditandoId}` : "Nueva categoría"}</h2>
              </div>
              {categoriaEditandoId && (
                <button type="button" onClick={cancelarCategoria} style={styles.smallSecondary}>
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={guardarCategoria} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.label}>Nombre *</span>
                <input
                  value={formCategoria.nombre}
                  onChange={(e) => actualizarCategoria("nombre", e.target.value)}
                  placeholder="Ej: Servicios, Impuestos, Herramientas"
                  style={styles.input}
                />
              </label>

              {categoriaEditandoId && (
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formCategoria.activa}
                    onChange={(e) => actualizarCategoria("activa", e.target.checked)}
                  />
                  Categoría activa
                </label>
              )}

              <button type="submit" disabled={guardando} style={styles.primaryButton}>
                {guardando ? "Guardando..." : categoriaEditandoId ? "Guardar categoría" : "Crear categoría"}
              </button>
            </form>

            <div style={styles.categoryHeader}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={mostrarCategoriasInactivas}
                  onChange={(e) => setMostrarCategoriasInactivas(e.target.checked)}
                />
                Mostrar inactivas
              </label>
            </div>

            <div style={styles.categoryList}>
              {categorias.map((categoria) => (
                <div key={categoria.id} style={{ ...styles.categoryItem, ...(isMobile ? styles.categoryItemMobile : {}) }}>
                  <div>
                    <strong>{categoria.nombre}</strong>
                    <div style={styles.tdMutedText}>#{categoria.id}</div>
                  </div>
                  <div style={{ ...styles.categoryActions, ...(isMobile ? styles.categoryActionsMobile : {}) }}>
                    <span style={{ ...styles.badge, ...(categoria.activa ? styles.badgeOk : styles.badgeOff) }}>
                      {categoria.activa ? "Activa" : "Inactiva"}
                    </span>
                    <button type="button" onClick={() => editarCategoria(categoria)} style={styles.smallSecondary}>
                      Editar
                    </button>
                    {categoria.activa ? (
                      <button type="button" onClick={() => cambiarEstadoCategoria(categoria, false)} style={styles.smallDanger}>
                        Desactivar
                      </button>
                    ) : (
                      <button type="button" onClick={() => cambiarEstadoCategoria(categoria, true)} style={styles.smallPrimary}>
                        Activar
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {categorias.length === 0 && <div style={styles.emptyBox}>No hay categorías cargadas.</div>}
            </div>
          </div>
        </section>

        <section style={{ ...styles.cardNoPadding, ...(isMobile ? styles.cardNoPaddingMobile : {}) }}>
          <div style={styles.tableHeader}>
            <div>
              <p style={styles.eyebrow}>Listado</p>
              <h2 style={styles.cardTitle}>Gastos cargados</h2>
              <p style={styles.muted}>Usá esto para operación diaria. No metas préstamos de socios acá.</p>
            </div>
          </div>

          <form onSubmit={aplicarFiltros} style={{ ...styles.filters, ...(isMobile ? styles.filtersMobile : {}) }}>
            <input
              value={filtros.q}
              onChange={(e) => actualizarFiltro("q", e.target.value)}
              placeholder="Buscar descripción..."
              style={styles.input}
            />

            <select value={filtros.estado} onChange={(e) => actualizarFiltro("estado", e.target.value)} style={styles.input}>
              {ESTADOS.map((estado) => (
                <option key={estado.value} value={estado.value}>{estado.label}</option>
              ))}
            </select>

            <select value={filtros.medio_pago} onChange={(e) => actualizarFiltro("medio_pago", e.target.value)} style={styles.input}>
              {MEDIOS.map((medio) => (
                <option key={medio.value} value={medio.value}>{medio.label}</option>
              ))}
            </select>

            <select
              value={filtros.id_categoria_gasto}
              onChange={(e) => actualizarFiltro("id_categoria_gasto", e.target.value)}
              style={styles.input}
            >
              <option value="todos">Todas las categorías</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
              ))}
            </select>

            <select value={filtros.impacta_caja} onChange={(e) => actualizarFiltro("impacta_caja", e.target.value)} style={styles.input}>
              <option value="todos">Caja: todos</option>
              <option value="true">Impacta caja</option>
              <option value="false">No impacta caja</option>
            </select>

            <select value={filtros.es_recurrente} onChange={(e) => actualizarFiltro("es_recurrente", e.target.value)} style={styles.input}>
              <option value="todos">Recurrencia: todos</option>
              <option value="true">Recurrentes</option>
              <option value="false">No recurrentes</option>
            </select>

            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => actualizarFiltro("fecha_desde", e.target.value)}
              style={styles.input}
            />

            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => actualizarFiltro("fecha_hasta", e.target.value)}
              style={styles.input}
            />

            <button type="submit" disabled={cargando} style={styles.smallPrimary}>
              Filtrar
            </button>
            <button type="button" onClick={limpiarFiltros} disabled={cargando} style={styles.smallSecondary}>
              Limpiar
            </button>
          </form>

          <div style={{ ...styles.contentGrid, ...(isMobile ? styles.contentGridMobile : {}) }}>
            <div style={{ ...styles.tableWrapper, ...(isMobile ? styles.tableWrapperMobile : {}) }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Gasto</th>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Categoría</th>
                    <th style={styles.th}>Monto</th>
                    <th style={styles.th}>Caja</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((gasto) => (
                    <tr
                      key={gasto.id}
                      onClick={() => setGastoSeleccionado(gasto)}
                      style={{
                        ...styles.clickableRow,
                        ...(gastoSeleccionado?.id === gasto.id ? styles.selectedRow : {}),
                      }}
                    >
                      <td style={styles.tdStrong}>
                        #{gasto.id} · {gasto.descripcion}
                        <div style={styles.tdMutedText}>{gasto.medio_pago || "-"} · usuario #{gasto.id_usuario}</div>
                      </td>
                      <td style={styles.td}>{formatDate(gasto.fecha)}</td>
                      <td style={styles.td}>{gasto.categoria_nombre || "Sin categoría"}</td>
                      <td style={styles.tdMoney}>{formatMoney(gasto.monto)}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...(gasto.impacta_caja ? styles.badgeWarn : styles.badgeOff) }}>
                          {gasto.impacta_caja ? `Caja #${gasto.id_caja_movimiento || "-"}` : "No"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...(gasto.estado === "activo" ? styles.badgeOk : styles.badgeDanger) }}>
                          {gasto.estado}
                        </span>
                      </td>
                      <td style={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => prepararCorreccion(gasto)} style={styles.smallSecondary}>
                          Editar
                        </button>
                        {gasto.estado !== "anulado" && (
                          <button type="button" onClick={() => anular(gasto)} style={styles.smallDanger}>
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!cargando && gastos.length === 0 && (
                    <tr>
                      <td style={styles.empty} colSpan={7}>No hay gastos para mostrar.</td>
                    </tr>
                  )}

                  {cargando && (
                    <tr>
                      <td style={styles.empty} colSpan={7}>Cargando gastos...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <aside style={{ ...styles.detailPanel, ...(isMobile ? styles.detailPanelMobile : {}) }}>
              <p style={styles.eyebrow}>Detalle</p>
              {gastoSeleccionado ? (
                <>
                  <h2 style={styles.detailTitle}>Gasto #{gastoSeleccionado.id}</h2>
                  <div style={styles.detailAmount}>{formatMoney(gastoSeleccionado.monto)}</div>
                  <div style={styles.detailList}>
                    <DetailRow label="Descripción" value={gastoSeleccionado.descripcion} />
                    <DetailRow label="Fecha" value={formatDate(gastoSeleccionado.fecha)} />
                    <DetailRow label="Categoría" value={gastoSeleccionado.categoria_nombre || "Sin categoría"} />
                    <DetailRow label="Medio" value={gastoSeleccionado.medio_pago || "-"} />
                    <DetailRow label="Impacta caja" value={gastoSeleccionado.impacta_caja ? "Sí" : "No"} />
                    <DetailRow label="Estado" value={gastoSeleccionado.estado} />
                    <DetailRow label="Recurrente" value={gastoSeleccionado.es_recurrente ? "Sí" : "No"} />
                    <DetailRow label="Período" value={formatDate(gastoSeleccionado.periodo_mes)} />
                  </div>

                  <div style={styles.movementsBox}>
                    <h3 style={styles.movementsTitle}>Movimientos</h3>
                    {(detalleSeleccionado?.movimientos || []).map((mov) => (
                      <div key={mov.id} style={styles.movementItem}>
                        <div>
                          <strong>{mov.tipo_movimiento}</strong>
                          <div style={styles.tdMutedText}>{mov.detalle || "-"}</div>
                        </div>
                        <span style={styles.movementAmount}>{formatMoney(mov.monto)}</span>
                      </div>
                    ))}

                    {detalleSeleccionado && detalleSeleccionado.movimientos?.length === 0 && (
                      <div style={styles.emptyBox}>Sin movimientos.</div>
                    )}
                  </div>
                </>
              ) : (
                <div style={styles.emptyBox}>Seleccioná un gasto para ver el detalle.</div>
              )}
            </aside>
          </div>
        </section>
      </main>

      <ConfirmModal
        open={Boolean(confirmConfig)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        cancelText={confirmConfig?.cancelText || "Cancelar"}
        variant={confirmConfig?.variant || "danger"}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={confirmConfig?.onCancel}
      />

      <PromptModal
        open={Boolean(promptConfig)}
        title={promptConfig?.title}
        message={promptConfig?.message}
        label={promptConfig?.label}
        placeholder={promptConfig?.placeholder}
        required={promptConfig?.required}
        minLength={promptConfig?.minLength}
        confirmText={promptConfig?.confirmText}
        cancelText={promptConfig?.cancelText || "Cancelar"}
        onConfirm={promptConfig?.onConfirm}
        onCancel={promptConfig?.onCancel}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summarySub}>{sub}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function filtrosToApi(filtros) {
  const params = {
    limit: filtros.limit || 200,
    offset: filtros.offset || 0,
  };

  if (filtros.q?.trim()) params.q = filtros.q.trim();
  if (filtros.estado !== "todos") params.estado = filtros.estado;
  if (filtros.medio_pago !== "todos") params.medio_pago = filtros.medio_pago;
  if (filtros.id_categoria_gasto !== "todos") params.id_categoria_gasto = filtros.id_categoria_gasto;
  if (filtros.fecha_desde) params.fecha_desde = filtros.fecha_desde;
  if (filtros.fecha_hasta) params.fecha_hasta = filtros.fecha_hasta;

  if (filtros.impacta_caja !== "todos") params.impacta_caja = filtros.impacta_caja === "true";
  if (filtros.es_recurrente !== "todos") params.es_recurrente = filtros.es_recurrente === "true";

  return params;
}

const styles = {
  page: { minHeight: "100vh", padding: 20, background: "#f1f5f9", color: "#0f172a" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 24, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", boxShadow: "0 18px 40px rgba(15,23,42,.18)", marginBottom: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000, letterSpacing: "-.03em" },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700, maxWidth: 760 },
  secondaryHeroButton: { border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 14, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  success: { background: "#ecfdf5", color: "#047857", border: "1px solid #86efac", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  error: { background: "#fff1f0", color: "#b42318", border: "1px solid #fecdca", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 800 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 },
  summaryCard: { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, boxShadow: "0 10px 24px rgba(15,23,42,.05)" },
  summaryLabel: { color: "#64748b", fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" },
  summaryValue: { marginTop: 7, fontSize: 24, fontWeight: 1000, letterSpacing: "-.03em" },
  summarySub: { marginTop: 4, color: "#64748b", fontWeight: 800, fontSize: 13 },
  layout: { display: "grid", gridTemplateColumns: "420px minmax(0, 1fr)", gap: 16, alignItems: "start" },
  leftColumn: { display: "grid", gap: 16 },
  card: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  cardNoPadding: { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, overflow: "hidden", boxShadow: "0 14px 30px rgba(15,23,42,.06)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 14 },
  eyebrow: { margin: 0, color: "#f97316", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".08em" },
  cardTitle: { margin: "3px 0 0", fontSize: 22, letterSpacing: "-.02em" },
  muted: { color: "#64748b", margin: "4px 0 0", fontWeight: 700 },
  form: { display: "grid", gap: 12 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "grid", gap: 7, fontSize: 14, fontWeight: 900 },
  label: { color: "#334155" },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 13, padding: "12px 13px", fontWeight: 700, color: "#0f172a", boxSizing: "border-box", background: "white" },
  primaryButton: { border: "none", background: "#f97316", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer", boxShadow: "0 10px 20px rgba(249,115,22,.22)" },
  darkButton: { border: "none", background: "#0f172a", color: "white", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "pointer" },
  disabledButton: { border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#94a3b8", borderRadius: 13, padding: "12px 16px", fontWeight: 1000, cursor: "not-allowed" },
  smallPrimary: { border: "none", background: "#0f172a", color: "white", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallSecondary: { border: "1px solid #cbd5e1", background: "white", color: "#0f172a", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  smallDanger: { border: "1px solid #fecaca", background: "#fff1f0", color: "#b42318", borderRadius: 11, padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#334155" },
  categoryHeader: { paddingTop: 14, marginTop: 14, borderTop: "1px solid #e2e8f0" },
  categoryList: { display: "grid", gap: 10, marginTop: 12 },
  categoryItem: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#f8fafc" },
  categoryActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  tableHeader: { padding: 18, borderBottom: "1px solid #e2e8f0" },
  filters: { display: "grid", gridTemplateColumns: "1.3fr .8fr .9fr 1fr .8fr .9fr .8fr .8fr auto auto", gap: 10, alignItems: "center", padding: 16, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" },
  contentGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 310px", alignItems: "stretch" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 980 },
  th: { textAlign: "left", padding: "12px 14px", background: "#f8fafc", color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" },
  td: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", fontWeight: 800, color: "#334155", verticalAlign: "top" },
  tdStrong: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", fontWeight: 1000, color: "#0f172a", verticalAlign: "top" },
  tdMoney: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", fontWeight: 1000, color: "#0f172a", whiteSpace: "nowrap", verticalAlign: "top" },
  tdMutedText: { marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 },
  tdActions: { padding: "13px 14px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, flexWrap: "wrap" },
  clickableRow: { cursor: "pointer" },
  selectedRow: { background: "#fff7ed" },
  badge: { display: "inline-flex", borderRadius: 999, padding: "6px 10px", fontWeight: 1000, fontSize: 12, whiteSpace: "nowrap" },
  badgeOk: { background: "#ecfdf5", color: "#047857" },
  badgeOff: { background: "#f1f5f9", color: "#64748b" },
  badgeWarn: { background: "#fff7ed", color: "#c2410c" },
  badgeDanger: { background: "#fff1f0", color: "#b42318" },
  empty: { padding: 22, color: "#64748b", fontWeight: 900, textAlign: "center" },
  emptyBox: { padding: 16, color: "#64748b", fontWeight: 900, textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 14, background: "#f8fafc" },
  detailPanel: { borderLeft: "1px solid #e2e8f0", padding: 18, background: "#ffffff" },
  detailTitle: { margin: "4px 0 0", fontSize: 24, letterSpacing: "-.03em" },
  detailAmount: { marginTop: 8, fontSize: 28, fontWeight: 1000, color: "#0f172a" },
  detailList: { display: "grid", gap: 8, marginTop: 16 },
  detailRow: { display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 8, color: "#64748b", fontWeight: 800 },
  movementsBox: { marginTop: 18 },
  movementsTitle: { margin: 0, fontSize: 16 },
  movementItem: { display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 0", borderBottom: "1px solid #e2e8f0" },
  movementAmount: { fontWeight: 1000, whiteSpace: "nowrap" },
  pageMobile: { padding: 10, overflowX: "hidden" },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", alignItems: "start", padding: 16, borderRadius: 18 },
  titleMobile: { fontSize: 26, lineHeight: 1.1 },
  subtitleMobile: { fontSize: 13, lineHeight: 1.35 },
  heroButtonMobile: { width: "100%", textAlign: "center" },
  summaryGridMobile: { gridTemplateColumns: "1fr 1fr", gap: 8 },
  layoutMobile: { gridTemplateColumns: "1fr", gap: 12 },
  leftColumnMobile: { gap: 12 },
  cardMobile: { padding: 14, borderRadius: 18 },
  cardNoPaddingMobile: { borderRadius: 18 },
  formRowMobile: { gridTemplateColumns: "1fr", gap: 10 },
  categoryItemMobile: { display: "grid", gridTemplateColumns: "1fr", alignItems: "stretch" },
  categoryActionsMobile: { justifyContent: "flex-start" },
  filtersMobile: { gridTemplateColumns: "1fr", gap: 9, padding: 12 },
  contentGridMobile: { gridTemplateColumns: "1fr" },
  tableWrapperMobile: { overflowX: "auto", WebkitOverflowScrolling: "touch" },
  detailPanelMobile: { borderLeft: "none", borderTop: "1px solid #e2e8f0" },

};
