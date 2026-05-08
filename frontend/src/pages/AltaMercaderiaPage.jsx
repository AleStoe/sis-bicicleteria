import { useEffect, useMemo, useRef, useState } from "react";
import {
  crearImagenCatalogo,
  crearMarca,
  crearProducto,
  crearVariante,
  listarCatalogoPOS,
  listarCategorias,
  listarMarcas,
} from "../services/catalogoService";
import { listarProveedores } from "../services/proveedoresService";
import { crearIngresoStock } from "../services/stockService";

const ID_USUARIO = 1;
const ID_SUCURSAL_DEFAULT = 1;

const MARGEN_MINORISTA = 1.2;
const MARGEN_MAYORISTA = 0.55;

export default function AltaMercaderiaPage() {
  const buscarRef = useRef(null);
  const costoRef = useRef(null);

  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);

  const [modoCrear, setModoCrear] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mostrarCambioProveedor, setMostrarCambioProveedor] = useState(false);

  const [marcaNueva, setMarcaNueva] = useState("");

  const [form, setForm] = useState({
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

    imagen_url: "",
    observacion: "",
  });

  useEffect(() => {
    cargarDatos();
    setTimeout(() => buscarRef.current?.focus(), 100);
  }, []);

  async function cargarDatos() {
    try {
      const [cats, marcasData, provs] = await Promise.all([
        listarCategorias(),
        listarMarcas(),
        listarProveedores({ solo_activos: true }),
      ]);

      setCategorias(cats || []);
      setMarcas(marcasData || []);
      setProveedores(provs || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar datos iniciales");
    }
  }

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
      [campo]: valor,
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
      });

      const items = data || [];
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

  async function registrarIngresoExistente(e) {
    e.preventDefault();

    if (!seleccionado) {
      setError("Seleccioná un producto existente");
      return;
    }

    await registrarIngreso({
      id_variante: seleccionado.id_variante,
      producto_nombre: seleccionado.producto_nombre,
      nombre_variante: seleccionado.nombre_variante,
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

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const producto = await crearProducto({
        id_categoria: Number(form.id_categoria),
        id_marca: form.id_marca ? Number(form.id_marca) : null,
        nombre: form.nombre_producto.trim(),
        tipo_item: form.tipo_item,
        stockeable: form.tipo_item === "producto",
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
        permite_precio_libre: form.tipo_item === "servicio",
      });

      if (form.imagen_url.trim()) {
        await crearImagenCatalogo({
          id_producto: null,
          id_variante: variante.id,
          url: form.imagen_url.trim(),
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
      id_usuario: ID_USUARIO,
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
      imagen_url: "",
      observacion: "",
    }));
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Alta de mercadería</h1>
          <p style={styles.subtitle}>
            Buscá primero. Si no existe, crealo rápido y registrá el ingreso.
          </p>
        </div>
      </header>

      {error && <div style={styles.error}>Error: {error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>1. Buscar / escanear</h2>

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
            placeholder="Código proveedor, barras, SKU o nombre"
          />

          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => buscarProducto()}
            disabled={buscando}
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>

          {resultados.length > 0 && (
            <div style={styles.results}>
              {resultados.map((item) => (
                <button
                  key={item.id_variante}
                  type="button"
                  style={styles.resultItem}
                  onClick={() => seleccionarExistente(item)}
                >
                  <strong>
                    {item.producto_nombre} - {item.nombre_variante}
                  </strong>
                  <span>
                    Prov: {item.codigo_proveedor || "-"} · Stock:{" "}
                    {formatNumber(item.stock_disponible)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {seleccionado && (
            <form onSubmit={registrarIngresoExistente} style={styles.form}>
              <div style={styles.selectedBox}>
                <strong>
                  {seleccionado.producto_nombre} - {seleccionado.nombre_variante}
                </strong>
                <span>
                  Stock disponible: {formatNumber(seleccionado.stock_disponible)}
                </span>
              </div>

              {seleccionado.proveedor_preferido_id &&
              !mostrarCambioProveedor ? (
                <div style={styles.providerDetected}>
                  <div>
                    <strong>Proveedor detectado</strong>
                    <div>{seleccionado.proveedor_preferido_nombre}</div>
                  </div>

                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => setMostrarCambioProveedor(true)}
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <ProveedorSelect
                  form={form}
                  setCampo={setCampo}
                  proveedores={proveedores}
                />
              )}

              <IngresoFields
                form={form}
                setCampo={setCampo}
                costoRef={costoRef}
                costoUnitarioConGastos={costoUnitarioConGastos}
                totalProductos={totalProductos}
              />

              <button
                type="submit"
                style={styles.primaryButton}
                disabled={procesando}
              >
                Registrar ingreso
              </button>
            </form>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>2. Crear si no existe</h2>

          {!modoCrear ? (
            <div style={styles.emptyState}>
              Buscá primero. Si no aparece, acá se habilita el alta rápida.
            </div>
          ) : (
            <form onSubmit={crearProductoEIngresar} style={styles.form}>
              <label style={styles.label}>
                Categoría *
                <select
                  style={styles.input}
                  value={form.id_categoria}
                  onChange={(e) => setCampo("id_categoria", e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {categorias.map((c) => (
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

              <div style={styles.inlineCreate}>
                <input
                  style={styles.input}
                  value={marcaNueva}
                  onChange={(e) => setMarcaNueva(e.target.value)}
                  placeholder="Nueva marca..."
                />
                <button
                  type="button"
                  style={styles.secondaryButton}
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
                  onChange={(e) => setCampo("nombre_producto", e.target.value)}
                  placeholder="Ej: Cámara Arisun 29"
                />
              </label>

              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={form.tiene_variantes}
                  onChange={(e) => setCampo("tiene_variantes", e.target.checked)}
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
                    onChange={(e) => setCampo("nombre_variante", e.target.value)}
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

              <label style={styles.label}>
                Código proveedor *
                <input
                  style={styles.input}
                  value={form.codigo_proveedor}
                  onChange={(e) => setCampo("codigo_proveedor", e.target.value)}
                />
              </label>

              <ProveedorSelect
                form={form}
                setCampo={setCampo}
                proveedores={proveedores}
              />

              <IngresoFields
                form={form}
                setCampo={setCampo}
                costoRef={costoRef}
                costoUnitarioConGastos={costoUnitarioConGastos}
                totalProductos={totalProductos}
              />

              <div style={styles.suggestionBox}>
                <div>
                  <span>Minorista sugerido</span>
                  <strong>{formatMoney(sugeridoMinorista)}</strong>
                </div>
                <div>
                  <span>Mayorista sugerido</span>
                  <strong>{formatMoney(sugeridoMayorista)}</strong>
                </div>
              </div>

              <div style={styles.twoCols}>
                <label style={styles.label}>
                  Precio minorista
                  <input
                    style={styles.input}
                    type="number"
                    value={form.precio_minorista}
                    onChange={(e) => setCampo("precio_minorista", e.target.value)}
                  />
                </label>

                <label style={styles.label}>
                  Precio mayorista
                  <input
                    style={styles.input}
                    type="number"
                    value={form.precio_mayorista}
                    onChange={(e) => setCampo("precio_mayorista", e.target.value)}
                  />
                </label>
              </div>

              <label style={styles.label}>
                Imagen URL
                <input
                  style={styles.input}
                  value={form.imagen_url}
                  onChange={(e) => setCampo("imagen_url", e.target.value)}
                  placeholder="https://..."
                />
              </label>

              {form.imagen_url && (
                <img
                  src={form.imagen_url}
                  alt="Preview"
                  style={styles.preview}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}

              <button
                type="submit"
                style={styles.primaryButton}
                disabled={procesando}
              >
                Crear e ingresar mercadería
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function ProveedorSelect({ form, setCampo, proveedores }) {
  return (
    <label style={styles.label}>
      Proveedor *
      <select
        style={styles.input}
        value={form.id_proveedor}
        onChange={(e) => setCampo("id_proveedor", e.target.value)}
      >
        <option value="">Seleccionar proveedor...</option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            #{p.id} - {p.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function IngresoFields({
  form,
  setCampo,
  costoRef,
  costoUnitarioConGastos,
  totalProductos,
}) {
  return (
    <>
      <div style={styles.twoCols}>
        <label style={styles.label}>
          Cantidad *
          <input
            style={styles.input}
            type="number"
            value={form.cantidad}
            onChange={(e) => setCampo("cantidad", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          IVA
          <select
            style={styles.input}
            value={form.alicuota_iva}
            onChange={(e) => setCampo("alicuota_iva", e.target.value)}
          >
            <option value="21.00">21%</option>
            <option value="10.50">10.5%</option>
            <option value="27.00">27%</option>
            <option value="0">0%</option>
          </select>
        </label>
      </div>

      <label style={styles.label}>
        Costo unitario real *
        <input
          ref={costoRef}
          style={styles.input}
          type="number"
          value={form.costo_unitario}
          onChange={(e) => setCampo("costo_unitario", e.target.value)}
          placeholder="Costo final por unidad"
        />
      </label>

      <label style={styles.label}>
        Gastos adicionales
        <input
          style={styles.input}
          type="number"
          value={form.gastos_adicionales}
          onChange={(e) => setCampo("gastos_adicionales", e.target.value)}
        />
      </label>

      <div style={styles.calcBox}>
        <span>Total productos</span>
        <strong>{formatMoney(totalProductos)}</strong>
      </div>

      <div style={styles.calcBox}>
        <span>Costo unitario final</span>
        <strong>{formatMoney(costoUnitarioConGastos)}</strong>
      </div>

      <label style={styles.label}>
        Observación
        <textarea
          style={styles.textarea}
          value={form.observacion}
          onChange={(e) => setCampo("observacion", e.target.value)}
          placeholder="Factura, remito, observación..."
        />
      </label>
    </>
  );
}

function redondearPrecio(valor) {
  if (!valor || valor <= 0) return 0;
  return Math.ceil(valor / 50) * 50;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: 3,
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

const styles = {
  page: { padding: "24px", background: "#f6f7fb", minHeight: "100vh" },
  header: { marginBottom: "16px" },
  title: { margin: 0, fontSize: "28px", fontWeight: 800 },
  subtitle: { margin: "6px 0 0", color: "#667085" },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    alignItems: "start",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    padding: "16px",
  },
  cardTitle: { margin: "0 0 14px", fontSize: "20px" },
  form: { display: "grid", gap: "10px", marginTop: "14px" },
  label: { display: "grid", gap: "6px", fontWeight: 700, fontSize: "14px" },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  searchInput: {
    width: "100%",
    padding: "14px 16px",
    border: "2px solid #1f6feb",
    borderRadius: "12px",
    fontSize: "18px",
    boxSizing: "border-box",
    marginBottom: "10px",
  },
  textarea: {
    width: "100%",
    minHeight: "70px",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  primaryButton: {
    border: "none",
    background: "#1f6feb",
    color: "#fff",
    borderRadius: "10px",
    padding: "12px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d0d5dd",
    background: "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  results: { display: "grid", gap: "8px", marginTop: "14px" },
  resultItem: {
    display: "grid",
    gap: "4px",
    textAlign: "left",
    border: "1px solid #d0d5dd",
    background: "#fff",
    borderRadius: "10px",
    padding: "12px",
    cursor: "pointer",
  },
  selectedBox: {
    display: "grid",
    gap: "4px",
    background: "#eef4ff",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    padding: "12px",
  },
  providerDetected: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    borderRadius: "12px",
    background: "#ecfdf3",
    border: "1px solid #abefc6",
  },
  inlineCreate: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
    alignItems: "center",
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  check: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    fontWeight: 700,
    fontSize: "14px",
  },
  calcBox: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
  },
  suggestionBox: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: "12px",
    padding: "12px",
  },
  preview: {
    width: "100%",
    maxHeight: "220px",
    objectFit: "contain",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#f9fafb",
  },
  emptyState: {
    padding: "18px",
    background: "#f9fafb",
    borderRadius: "12px",
    color: "#667085",
  },
  error: {
    background: "#fff1f0",
    color: "#b42318",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #f4c7c3",
    marginBottom: "16px",
  },
  success: {
    background: "#e8fff0",
    color: "#146c2e",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #b7ebc6",
    marginBottom: "16px",
  },
};