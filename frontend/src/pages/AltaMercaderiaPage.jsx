import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  subirImagenCatalogo,
  crearMarca,
  crearProducto,
  crearVariante,
  listarCatalogoPOS,
  listarCategorias,
  listarMarcas,
} from "../services/catalogoService";
import { listarProveedores } from "../services/proveedoresService";
import { crearIngresoStock } from "../services/stockService";
import { obtenerConfiguracionNegocio } from "../services/configuracionNegocioService";
import AltaMercaderiaProveedorSelect from "../components/mercaderia/alta/AltaMercaderiaProveedorSelect";
import AltaMercaderiaIngresoFields from "../components/mercaderia/alta/AltaMercaderiaIngresoFields";
import AltaMercaderiaImagenUpload from "../components/mercaderia/alta/AltaMercaderiaImagenUpload";
import HerramientasPrecioPanel from "../components/precios/HerramientasPrecioPanel";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { formatMoney, formatNumber } from "../utils/formatters";
import { useSession } from "../context/SessionContext";
import useMediaQuery from "../hooks/useMediaQuery";
import { normalizeTextUpper } from "../utils/textNormalization";
import { DEFAULT_CONFIGURACION_NEGOCIO } from "../config/defaultConfiguracionNegocio";

const ID_SUCURSAL_DEFAULT = 1;

const MARGEN_MINORISTA = 1.2;
const MARGEN_MAYORISTA = 0.55;
const UPPER_FIELDS = new Set(["nombre_producto", "nombre_variante", "codigo_proveedor"]);
const RUBROS_MERCADERIA = ["REPUESTOS", "ACCESORIOS", "INDUMENTARIA"];

export default function AltaMercaderiaPage() {
  const { usuarioId } = useSession();
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 1100px)");
  const buscarRef = useRef(null);
  const costoRef = useRef(null);

  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [configuracionNegocio, setConfiguracionNegocio] = useState(DEFAULT_CONFIGURACION_NEGOCIO);

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);

  const [modoCrear, setModoCrear] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mostrarCambioProveedor, setMostrarCambioProveedor] = useState(false);
  const [confirmacionIngreso, setConfirmacionIngreso] = useState(null);

  const [marcaNueva, setMarcaNueva] = useState("");

  const [form, setForm] = useState({
    rubro: "REPUESTOS",
    id_categoria: "",
    id_marca: "",
    nombre_producto: "",
    tipo_item: "producto",

    tiene_variantes: false,
    controlar_numero_cuadro: false,
    nombre_variante: "",

    codigo_proveedor: "",
    id_proveedor: "",
    alicuota_iva: "21.00",

    cantidad: "1",
    costo_unitario: "",
    gastos_adicionales: "0",

    precio_minorista: "0",
    precio_mayorista: "0",

    imagen_archivo: null,
    imagen_preview: "",
    observacion: "",
  });

  useEffect(() => {
    cargarDatos();
    setTimeout(() => buscarRef.current?.focus(), 100);
  }, []);

  async function cargarDatos() {
    try {
      const [cats, marcasData, provs, config] = await Promise.all([
        listarCategorias(),
        listarMarcas(),
        listarProveedores({ solo_activos: true }),
        obtenerConfiguracionNegocio().catch(() => DEFAULT_CONFIGURACION_NEGOCIO),
      ]);

      setCategorias(cats || []);
      setMarcas(marcasData || []);
      setProveedores(provs || []);
      setConfiguracionNegocio({
        ...DEFAULT_CONFIGURACION_NEGOCIO,
        ...(config || {}),
      });
    } catch (err) {
      setError(err.message || "No se pudieron cargar datos iniciales");
    }
  }
 const categoriasPermitidas = useMemo(() => {
    return categorias.filter((c) => c.activo !== false);
  }, [categorias]);

  const categoriaSeleccionada = useMemo(() => {
    return categorias.find((c) => String(c.id) === String(form.id_categoria));
  }, [categorias, form.id_categoria]);

  const esBicicleta = useMemo(() => {
    const nombre = categoriaSeleccionada?.nombre?.toLowerCase() || "";
    return nombre.includes("bici");
  }, [categoriaSeleccionada]);

  useEffect(() => {
    if (esBicicleta) {
      setForm((p) => ({
        ...p,
        tiene_variantes: true,
        controlar_numero_cuadro: true,
      }));
    }
  }, [esBicicleta]);

  const totalProductos = useMemo(() => {
    return Number(form.cantidad || 0) * Number(form.costo_unitario || 0);
  }, [form.cantidad, form.costo_unitario]);

  const costoUnitarioConGastos = useMemo(() => {
    const cantidad = Number(form.cantidad || 0);
    const total = totalProductos + Number(form.gastos_adicionales || 0);

    if (cantidad <= 0) return 0;
    return total / cantidad;
  }, [form.cantidad, totalProductos, form.gastos_adicionales]);

  const sugeridoMinorista = useMemo(() => {
    return redondearPrecio(costoUnitarioConGastos * (1 + MARGEN_MINORISTA));
  }, [costoUnitarioConGastos]);

  const sugeridoMayorista = useMemo(() => {
    return redondearPrecio(costoUnitarioConGastos * (1 + MARGEN_MAYORISTA));
  }, [costoUnitarioConGastos]);

  useEffect(() => {
    if (costoUnitarioConGastos > 0) {
      setForm((p) => ({
        ...p,
        precio_minorista:
          Number(p.precio_minorista || 0) > 0
            ? p.precio_minorista
            : String(sugeridoMinorista),
        precio_mayorista:
          Number(p.precio_mayorista || 0) > 0
            ? p.precio_mayorista
            : String(sugeridoMayorista),
      }));
    }
  }, [costoUnitarioConGastos, sugeridoMinorista, sugeridoMayorista]);

  function setCampo(campo, valor) {
    setForm((p) => ({
      ...p,
      [campo]: UPPER_FIELDS.has(campo) ? normalizeTextUpper(valor) : valor,
    }));
  }

  async function buscarProducto(valor = busqueda) {
    const q = valor.trim();
    if (!q) return;

    try {
      setBuscando(true);
      setError("");
      setMensaje("");
      setModoCrear(false);
      setSeleccionado(null);
      setMostrarCambioProveedor(false);

      const data = await listarCatalogoPOS({
        id_sucursal: ID_SUCURSAL_DEFAULT,
        query: q,
        limit: 20,
        offset: 0,
      });

      const items = Array.isArray(data) ? data : data?.items || [];
      setResultados(items);

      if (items.length === 1) {
        seleccionarExistente(items[0]);
      }

      if (items.length === 0) {
        setMensaje("No existe. Podés crearlo rápido y registrar el ingreso.");
        setModoCrear(true);
        setCampo("codigo_proveedor", q);
      }
    } catch (err) {
      setError(err.message || "No se pudo buscar producto");
    } finally {
      setBuscando(false);
    }
  }

  function seleccionarExistente(item) {
    setSeleccionado(item);
    setModoCrear(false);
    setResultados([]);
    setBusqueda(`${item.producto_nombre} - ${item.nombre_variante}`);

    setForm((p) => ({
      ...p,
      cantidad: "1",
      costo_unitario: "",
      gastos_adicionales: "0",
      id_proveedor: item.proveedor_preferido_id || p.id_proveedor || "",
    }));

    setMostrarCambioProveedor(false);
    setTimeout(() => costoRef.current?.focus(), 80);
  }

  async function handleCrearMarca() {
    if (!marcaNueva.trim()) {
      setError("La marca nueva no puede estar vacía");
      return;
    }

    try {
      setProcesando(true);
      setError("");

      const marca = await crearMarca({ nombre: marcaNueva.trim() });

      setMarcas((prev) =>
        [...prev, marca].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );

      setCampo("id_marca", marca.id);
      setMarcaNueva("");
      setMensaje(`Marca creada: ${marca.nombre}`);
    } catch (err) {
      setError(err.message || "No se pudo crear marca");
    } finally {
      setProcesando(false);
    }
  }

  function validarIngresoComun() {
    if (!form.id_proveedor) {
      return "Seleccioná proveedor";
    }

    if (!form.cantidad || Number(form.cantidad) <= 0) {
      return "La cantidad debe ser mayor a 0";
    }

    if (!form.costo_unitario || Number(form.costo_unitario) < 0) {
      return "El costo unitario debe ser válido";
    }

    return "";
  }

  function armarMensajeConfirmacion({ tipo, productoNombre, varianteNombre }) {
    return [
      tipo === "crear"
        ? "Vas a crear un producto nuevo e ingresar stock."
        : "Vas a registrar ingreso de mercadería.",
      "",
      `Producto: ${productoNombre || form.nombre_producto || "-"}`,
      `Variante: ${varianteNombre || (form.tiene_variantes ? form.nombre_variante || "Única" : "Única")}`,
      `Cantidad: ${formatNumber(form.cantidad || 0)}`,
      `Costo unitario: ${formatMoney(form.costo_unitario || 0)}`,
      `Costo productos total: ${formatMoney(totalProductos)}`,
      `Gastos adicionales: ${formatMoney(form.gastos_adicionales || 0)}`,
      `Costo final estimado por unidad: ${formatMoney(costoUnitarioConGastos)}`,
      "",
      "Confirmá para guardar. Enter solo abre esta revisión, no registra directo.",
    ].join("\n");
  }

  async function registrarIngresoExistente(e) {
    e.preventDefault();

    if (!seleccionado) {
      setError("Seleccioná un producto existente");
      return;
    }

    const errorIngreso = validarIngresoComun();
    if (errorIngreso) {
      setError(errorIngreso);
      return;
    }

    setError("");
    setConfirmacionIngreso({
      tipo: "existente",
      title: "Confirmar ingreso",
      message: armarMensajeConfirmacion({
        tipo: "existente",
        productoNombre: seleccionado.producto_nombre,
        varianteNombre: seleccionado.nombre_variante,
      }),
      item: {
        id_variante: seleccionado.id_variante,
        producto_nombre: seleccionado.producto_nombre,
        nombre_variante: seleccionado.nombre_variante,
      },
    });
  }

  async function crearProductoEIngresar(e) {
    e.preventDefault();

    if (!form.id_categoria) {
      setError("Seleccioná una categoría");
      return;
    }

    if (!form.nombre_producto.trim()) {
      setError("El nombre del producto es obligatorio");
      return;
    }

    if (!form.codigo_proveedor.trim()) {
      setError("El código proveedor es obligatorio");
      return;
    }

    if (!form.id_proveedor) {
      setError("Seleccioná proveedor");
      return;
    }

    const errorIngreso = validarIngresoComun();
    if (errorIngreso) {
      setError(errorIngreso);
      return;
    }

    setError("");
    setConfirmacionIngreso({
      tipo: "crear",
      title: "Confirmar alta e ingreso",
      message: armarMensajeConfirmacion({
        tipo: "crear",
        productoNombre: form.nombre_producto,
        varianteNombre: form.tiene_variantes ? form.nombre_variante || "Única" : "Única",
      }),
    });
  }

  async function ejecutarCrearProductoEIngresar() {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const producto = await crearProducto({
        id_categoria: Number(form.id_categoria),
        id_marca: form.id_marca ? Number(form.id_marca) : null,
        nombre: form.nombre_producto.trim(),
        rubro: form.rubro || "REPUESTOS",
        tipo_item: "producto",
        stockeable: true,
        serializable: Boolean(form.controlar_numero_cuadro),
      });

      const nombreVariante = form.tiene_variantes
        ? form.nombre_variante.trim() || "Única"
        : "Única";

      const variante = await crearVariante({
        id_producto: producto.id,
        nombre_variante: nombreVariante,
        sku: null,
        codigo_barras: null,
        codigo_proveedor: form.codigo_proveedor.trim(),
        proveedor_preferido_id: Number(form.id_proveedor),
        alicuota_iva: form.alicuota_iva,
        gravado: true,
        precio_minorista: form.precio_minorista || "0",
        precio_mayorista: form.precio_mayorista || "0",
        permite_precio_libre: false,
      });

      if (form.imagen_archivo) {
        await subirImagenCatalogo({
          archivo: form.imagen_archivo,
          id_variante: variante.id,
          es_principal: true,
          orden: 0,
        });
      }

      await registrarIngreso({
        id_variante: variante.id,
        producto_nombre: producto.nombre,
        nombre_variante: variante.nombre_variante,
      });

      limpiarAltaRapida();
    } catch (err) {
      setError(err.message || "No se pudo crear producto e ingresar mercadería");
    } finally {
      setProcesando(false);
    }
  }

  async function ejecutarConfirmacionIngreso() {
    if (procesando) return;

    const confirmacion = confirmacionIngreso;
    if (!confirmacion) return;

    setConfirmacionIngreso(null);

    if (confirmacion.tipo === "existente") {
      await registrarIngreso(confirmacion.item);
      return;
    }

    await ejecutarCrearProductoEIngresar();
  }

  async function registrarIngreso(item) {
    if (!form.id_proveedor) {
      setError("Seleccioná proveedor");
      return;
    }

    if (!form.cantidad || Number(form.cantidad) <= 0) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }

    if (!form.costo_unitario || Number(form.costo_unitario) < 0) {
      setError("El costo unitario debe ser válido");
      return;
    }

    const payload = {
      id_sucursal: ID_SUCURSAL_DEFAULT,
      id_variante: Number(item.id_variante),
      id_proveedor: Number(form.id_proveedor),
      cantidad_ingresada: Number(form.cantidad),
      costo_productos: totalProductos,
      gastos_adicionales: Number(form.gastos_adicionales || 0),
      origen_ingreso: "manual",
      observacion: form.observacion.trim() || null,
      id_usuario: usuarioId,
    };

    await crearIngresoStock(payload);

    setMensaje(
      `Ingreso registrado: ${item.producto_nombre} - ${item.nombre_variante}`
    );

    setSeleccionado(null);
    setResultados([]);
    setBusqueda("");
    setMostrarCambioProveedor(false);

    setForm((p) => ({
      ...p,
      cantidad: "1",
      costo_unitario: "",
      gastos_adicionales: "0",
      observacion: "",
    }));

    setTimeout(() => buscarRef.current?.focus(), 100);
  }

  function limpiarAltaRapida() {
    setModoCrear(false);
    setMostrarCambioProveedor(false);

    setForm((p) => ({
      ...p,
      rubro: "REPUESTOS",
      id_categoria: "",
      id_marca: "",
      nombre_producto: "",
      tipo_item: "producto",
      tiene_variantes: false,
      controlar_numero_cuadro: false,
      nombre_variante: "",
      codigo_proveedor: "",
      alicuota_iva: "21.00",
      cantidad: "1",
      costo_unitario: "",
      gastos_adicionales: "0",
      precio_minorista: "0",
      precio_mayorista: "0",
      imagen_archivo: null,
      imagen_preview: "",
      observacion: "",
    }));
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <ConfirmModal
        open={Boolean(confirmacionIngreso)}
        title={confirmacionIngreso?.title || "Confirmar ingreso"}
        message={confirmacionIngreso?.message || ""}
        confirmText={procesando ? "Guardando..." : "Confirmar y guardar"}
        cancelText="Revisar datos"
        variant="warning"
        onConfirm={ejecutarConfirmacionIngreso}
        onCancel={() => setConfirmacionIngreso(null)}
      />

      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Stock / Ingreso manual</p>
          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>Alta de mercadería</h1>
          <p style={styles.subtitle}>
            Primero escaneá o buscá. Si existe, registrás ingreso. Si no existe,
            lo creás rápido.
          </p>
        </div>
        <Link to="/servicios-taller" style={styles.serviceLink}>
          Dar de alta servicio
        </Link>
      </header>

      {error && <div style={styles.error}>Error: {error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <section style={styles.searchCard}>
        <div>
          <h2 style={styles.searchTitle}>Buscar producto</h2>
          <p style={styles.searchHelp}>
            Código proveedor, código de barras, SKU o nombre.
          </p>
        </div>

        <div style={isMobile ? styles.searchRowMobile : styles.searchRow}>
          <input
            ref={buscarRef}
            style={styles.searchInput}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setSeleccionado(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscarProducto(e.currentTarget.value);
              }
            }}
            placeholder="Escaneá o escribí para buscar..."
          />

          <button
            type="button"
            style={{
              ...styles.button,
              ...styles.primaryButton,
              opacity: buscando ? 0.7 : 1,
            }}
            onClick={() => buscarProducto()}
            disabled={buscando}
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </section>

      <section style={isNarrow ? styles.contentGridMobile : styles.contentGrid}>
        <main style={styles.mainColumn}>
          {resultados.length > 0 && (
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Resultados encontrados</h2>
                  <p style={styles.muted}>
                    Elegí el producto correcto para cargar mercadería.
                  </p>
                </div>
                <span style={styles.countBadge}>{resultados.length}</span>
              </div>

              <div style={styles.results}>
                {resultados.map((item) => (
                  <button
                    key={item.id_variante}
                    type="button"
                    style={isMobile ? styles.resultItemMobile : styles.resultItem}
                    onClick={() => seleccionarExistente(item)}
                  >
                    <div>
                      <strong>
                        {item.producto_nombre} - {item.nombre_variante}
                      </strong>
                      <span>
                        Código proveedor: {item.codigo_proveedor || "-"}
                      </span>
                    </div>

                    <div style={styles.stockPill}>
                      Stock: {formatNumber(item.stock_disponible)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {seleccionado && (
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <p style={styles.eyebrow}>Producto existente</p>
                  <h2 style={styles.cardTitle}>
                    {seleccionado.producto_nombre} -{" "}
                    {seleccionado.nombre_variante}
                  </h2>
                  <p style={styles.muted}>
                    Stock disponible actual:{" "}
                    <strong>{formatNumber(seleccionado.stock_disponible)}</strong>
                  </p>
                </div>

                <span style={styles.okBadge}>Listo para ingresar</span>
              </div>

              <form onSubmit={registrarIngresoExistente} style={styles.form}>
                {seleccionado.proveedor_preferido_id &&
                !mostrarCambioProveedor ? (
                  <div style={isMobile ? styles.providerDetectedMobile : styles.providerDetected}>
                    <div>
                      <strong>Proveedor detectado</strong>
                      <div>{seleccionado.proveedor_preferido_nombre}</div>
                    </div>

                    <button
                      type="button"
                      style={{ ...styles.button, ...styles.secondaryButton }}
                      onClick={() => setMostrarCambioProveedor(true)}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <AltaMercaderiaProveedorSelect
                    form={form}
                    setCampo={setCampo}
                    proveedores={proveedores}
                  />
                )}

                <AltaMercaderiaIngresoFields
                  form={form}
                  setCampo={setCampo}
                  costoRef={costoRef}
                  costoUnitarioConGastos={costoUnitarioConGastos}
                  totalProductos={totalProductos}
                />

                <button
                  type="submit"
                  style={{ ...styles.button, ...styles.primaryButton }}
                  disabled={procesando}
                >
                  {procesando ? "Registrando..." : "Registrar ingreso"}
                </button>
              </form>
            </section>
          )}

          {!seleccionado && !modoCrear && resultados.length === 0 && (
            <section style={styles.emptyPanel}>
              <h2>Esperando búsqueda</h2>
              <p>
                Escaneá un código. Si el producto existe, vas a cargar cantidad y
                costo. Si no existe, se habilita el alta rápida.
              </p>
            </section>
          )}

          {modoCrear && (
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <p style={styles.eyebrow}>Alta rápida</p>
                  <h2 style={styles.cardTitle}>Crear producto e ingresar stock</h2>
                  <p style={styles.muted}>
                    Cargá solo lo necesario ahora. Los datos finos se pueden
                    completar después desde catálogo.
                  </p>
                </div>

                <span style={styles.warningBadge}>Producto nuevo</span>
              </div>

              <form onSubmit={crearProductoEIngresar} style={styles.form}>
                <section style={styles.formSection}>
                  <h3 style={styles.formSectionTitle}>Datos básicos</h3>

                  <div style={isMobile ? styles.oneCol : styles.twoCols}>
                    <label style={styles.label}>
                      Rubro *
                      <select
                        style={styles.input}
                        value={form.rubro}
                        onChange={(e) => setCampo("rubro", e.target.value)}
                      >
                        {RUBROS_MERCADERIA.map((rubro) => (
                          <option key={rubro} value={rubro}>
                            {rubro}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.label}>
                      Categoría *
                      <select
                        style={styles.input}
                        value={form.id_categoria}
                        onChange={(e) =>
                          setCampo("id_categoria", e.target.value)
                        }
                      >
                        <option value="">Seleccionar...</option>
                        {categoriasPermitidas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.label}>
                      Marca
                      <select
                        style={styles.input}
                        value={form.id_marca}
                        onChange={(e) => setCampo("id_marca", e.target.value)}
                      >
                        <option value="">Sin marca</option>
                        {marcas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={isMobile ? styles.inlineCreateMobile : styles.inlineCreate}>
                    <input
                      style={styles.input}
                      value={marcaNueva}
                      onChange={(e) => setMarcaNueva(normalizeTextUpper(e.target.value))}
                      placeholder="Nueva marca..."
                    />
                    <button
                      type="button"
                      style={{ ...styles.button, ...styles.secondaryButton }}
                      onClick={handleCrearMarca}
                      disabled={procesando}
                    >
                      Crear marca
                    </button>
                  </div>

                  <label style={styles.label}>
                    Nombre producto *
                    <input
                      style={styles.input}
                      value={form.nombre_producto}
                      onChange={(e) =>
                        setCampo("nombre_producto", e.target.value)
                      }
                      placeholder="Ej: Cámara Arisun 29"
                    />
                  </label>

                  <div style={isMobile ? styles.oneCol : styles.twoCols}>
                    <label style={styles.label}>
                      Código proveedor *
                      <input
                        style={styles.input}
                        value={form.codigo_proveedor}
                        onChange={(e) =>
                          setCampo("codigo_proveedor", e.target.value)
                        }
                      />
                    </label>

                    <AltaMercaderiaProveedorSelect
                      form={form}
                      setCampo={setCampo}
                      proveedores={proveedores}
                    />
                  </div>

                  <label style={styles.check}>
                    <input
                      type="checkbox"
                      checked={form.tiene_variantes}
                      onChange={(e) =>
                        setCampo("tiene_variantes", e.target.checked)
                      }
                      disabled={esBicicleta}
                    />
                    Tiene variante real
                  </label>

                  {form.tiene_variantes && (
                    <label style={styles.label}>
                      Variante
                      <input
                        style={styles.input}
                        value={form.nombre_variante}
                        onChange={(e) =>
                          setCampo("nombre_variante", e.target.value)
                        }
                        placeholder="Ej: Negro rojo 52"
                      />
                    </label>
                  )}

                  {esBicicleta && (
                    <label style={styles.check}>
                      <input
                        type="checkbox"
                        checked={form.controlar_numero_cuadro}
                        onChange={(e) =>
                          setCampo("controlar_numero_cuadro", e.target.checked)
                        }
                      />
                      Controlar número de cuadro
                    </label>
                  )}
                </section>

                <section style={styles.formSection}>
                  <h3 style={styles.formSectionTitle}>Ingreso y costo</h3>

                  <AltaMercaderiaIngresoFields
                    form={form}
                    setCampo={setCampo}
                    costoRef={costoRef}
                    costoUnitarioConGastos={costoUnitarioConGastos}
                    totalProductos={totalProductos}
                  />
                </section>

                <section style={styles.formSection}>
                  <h3 style={styles.formSectionTitle}>Precios</h3>

                  <div style={isMobile ? styles.suggestionBoxMobile : styles.suggestionBox}>
                    <div style={styles.suggestionItem}>
                      <span style={styles.suggestionLabel}>Minorista sugerido</span>
                      <strong>{formatMoney(sugeridoMinorista)}</strong>
                    </div>
                    <div style={styles.suggestionItem}>
                      <span style={styles.suggestionLabel}>Mayorista sugerido</span>
                      <strong>{formatMoney(sugeridoMayorista)}</strong>
                    </div>
                  </div>

                  <HerramientasPrecioPanel
                    costo={costoUnitarioConGastos}
                    porcentajeDescuentoContado={
                      configuracionNegocio.porcentaje_descuento_contado_calculadora_precios
                    }
                    onAplicarMinorista={(monto) =>
                      setCampo("precio_minorista", monto)
                    }
                    onAplicarMayorista={(monto) =>
                      setCampo("precio_mayorista", monto)
                    }
                  />

                  <div style={isMobile ? styles.oneCol : styles.twoCols}>
                    <label style={styles.label}>
                      Precio minorista
                      <input
                        style={styles.input}
                        type="number"
                        value={form.precio_minorista}
                        onChange={(e) =>
                          setCampo("precio_minorista", e.target.value)
                        }
                      />
                    </label>

                    <label style={styles.label}>
                      Precio mayorista
                      <input
                        style={styles.input}
                        type="number"
                        value={form.precio_mayorista}
                        onChange={(e) =>
                          setCampo("precio_mayorista", e.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>

                <details style={styles.details}>
                  <summary style={styles.detailsSummary}>Opcionales</summary>
                  <div style={styles.detailsBody}>
                    <AltaMercaderiaImagenUpload form={form} setForm={setForm} />
                  </div>
                </details>

                <button
                  type="submit"
                  style={{ ...styles.button, ...styles.primaryButton }}
                  disabled={procesando}
                >
                  {procesando
                    ? "Creando..."
                    : "Crear producto e ingresar mercadería"}
                </button>
              </form>
            </section>
          )}
        </main>

        <aside style={isNarrow ? styles.sideColumnMobile : styles.sideColumn}>
          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Guía rápida</h3>

            <ol style={styles.steps}>
              <li>Escaneá o buscá el producto.</li>
              <li>Si existe, cargá cantidad y costo.</li>
              <li>Si no existe, completá el alta rápida.</li>
              <li>Revisá el costo final antes de guardar.</li>
            </ol>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Resumen actual</h3>

            <div style={styles.summaryRow}>
              <span>Cantidad</span>
              <strong>{formatNumber(form.cantidad || 0)}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Total productos</span>
              <strong>{formatMoney(totalProductos)}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Costo final unidad</span>
              <strong>{formatMoney(costoUnitarioConGastos)}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Minorista sugerido</span>
              <strong>{formatMoney(sugeridoMinorista)}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Mayorista sugerido</span>
              <strong>{formatMoney(sugeridoMayorista)}</strong>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function redondearPrecio(valor) {
  if (!valor || valor <= 0) return 0;
  return Math.ceil(valor / 50) * 50;
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "#f3f4f6",
    color: "#111827",
  },
  pageMobile: {
    padding: "12px",
    overflowX: "hidden",
  },

  header: {
    marginBottom: "18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  title: {
    margin: "2px 0 0",
    fontSize: "30px",
    fontWeight: 900,
  },
  titleMobile: {
    fontSize: "24px",
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },

  serviceLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    padding: "0 14px",
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 900,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },

  searchCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    marginBottom: "18px",
  },

  searchTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 900,
  },

  searchHelp: {
    margin: "4px 0 14px",
    color: "#6b7280",
    fontSize: "14px",
  },

  searchRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "center",
  },
  searchRowMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    alignItems: "stretch",
  },

  searchInput: {
    width: "100%",
    padding: "16px 18px",
    border: "2px solid #2563eb",
    borderRadius: "14px",
    fontSize: "20px",
    boxSizing: "border-box",
    outline: "none",
    background: "#ffffff",
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: "18px",
    alignItems: "start",
  },
  contentGridMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "14px",
    alignItems: "start",
  },

  mainColumn: {
    display: "grid",
    gap: "18px",
  },

  sideColumn: {
    display: "grid",
    gap: "14px",
    position: "sticky",
    top: "16px",
  },
  sideColumnMobile: {
    display: "grid",
    gap: "12px",
    position: "static",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
  },

  sideTitle: {
    margin: "0 0 12px",
    fontSize: "16px",
    fontWeight: 900,
  },

  muted: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },

  form: {
    display: "grid",
    gap: "14px",
  },

  formSection: {
    display: "grid",
    gap: "12px",
    padding: "14px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#fafafa",
  },

  formSectionTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 900,
  },

  label: {
    display: "grid",
    gap: "6px",
    fontWeight: 800,
    fontSize: "13px",
  },

  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff",
  },

  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  oneCol: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },

  inlineCreate: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    alignItems: "center",
  },
  inlineCreateMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    alignItems: "stretch",
  },

  check: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    fontWeight: 800,
    fontSize: "14px",
  },

  button: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 900,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  primaryButton: {
    background: "#2563eb",
    color: "#ffffff",
  },

  secondaryButton: {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #d1d5db",
  },

  results: {
    display: "grid",
    gap: "10px",
  },

  resultItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    width: "100%",
    textAlign: "left",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "14px",
    padding: "14px",
    cursor: "pointer",
  },
  resultItemMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    alignItems: "stretch",
    gap: "10px",
    width: "100%",
    textAlign: "left",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "14px",
    padding: "14px",
    cursor: "pointer",
  },

  stockPill: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: "999px",
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: "13px",
    whiteSpace: "nowrap",
  },

  countBadge: {
    background: "#111827",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: "13px",
  },

  okBadge: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "999px",
    padding: "7px 10px",
    fontWeight: 900,
    fontSize: "13px",
  },

  warningBadge: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: "999px",
    padding: "7px 10px",
    fontWeight: 900,
    fontSize: "13px",
  },

  providerDetected: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "14px",
    borderRadius: "14px",
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
  },
  providerDetectedMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    padding: "14px",
    borderRadius: "14px",
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
  },

  suggestionBox: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    padding: "14px",
  },
  suggestionItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  suggestionLabel: {
    color: "#1e3a8a",
    fontSize: "13px",
    fontWeight: 800,
  },
  suggestionBoxMobile: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    padding: "14px",
  },

  details: {
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#ffffff",
    overflow: "hidden",
  },

  detailsSummary: {
    cursor: "pointer",
    padding: "14px",
    fontWeight: 900,
  },

  detailsBody: {
    padding: "0 14px 14px",
  },

  steps: {
    margin: 0,
    paddingLeft: "20px",
    color: "#4b5563",
    display: "grid",
    gap: "8px",
    fontSize: "14px",
  },

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "14px",
  },

  emptyPanel: {
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    borderRadius: "18px",
    padding: "28px",
    color: "#6b7280",
    textAlign: "center",
  },

  error: {
    background: "#fef2f2",
    color: "#991b1b",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #fecaca",
    marginBottom: "14px",
    fontWeight: 700,
  },

  success: {
    background: "#ecfdf5",
    color: "#166534",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #bbf7d0",
    marginBottom: "14px",
    fontWeight: 700,
  },
};
