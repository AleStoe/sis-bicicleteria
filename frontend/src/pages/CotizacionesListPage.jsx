import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { listarClientes } from "../services/clientesService";
import { listarVariantes } from "../services/catalogoService";
import { listarServiciosTaller } from "../services/serviciosTallerService";
import { crearCotizacion, listarCotizaciones } from "../services/cotizacionesService";
import { normalizeTextUpper } from "../utils/textNormalization";
import { formatDate, formatMoney } from "../utils/formatters";
import { Button, EmptyState, PageHeader, useBreakpoint } from "../components/ui";
import { colors, controls, radius, shadows, spacing, typography } from "../theme";
import ServicePlaceholder from "../components/servicios/ServicePlaceholder";

const ESTADOS = [
  { value: "", label: "Todas" },
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviadas" },
  { value: "aceptada", label: "Aceptadas" },
  { value: "rechazada", label: "Rechazadas" },
  { value: "vencida", label: "Vencidas" },
  { value: "cancelada", label: "Canceladas" },
];

const lineaLibreInicial = {
  descripcion_snapshot: "",
  cantidad: "1",
  precio_unitario: "",
};

function crearTempId(prefix = "cot-item") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CotizacionesListPage() {
  const navigate = useNavigate();
  const isMobile = useBreakpoint();
  const { usuarioId, sucursalId } = useSession();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [catalogoQuery, setCatalogoQuery] = useState("");
  const [carritoItems, setCarritoItems] = useState([]);
  const [lineaLibre, setLineaLibre] = useState(lineaLibreInicial);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tipo: "venta",
    tipo_precio: "minorista",
    id_cliente: "",
    cliente_nombre_snapshot: "",
    cliente_telefono_snapshot: "",
    problema_reportado: "",
    observaciones: "",
  });

  useEffect(() => {
    cargarTodo();
  }, []);

  useEffect(() => {
    cargarCotizaciones();
  }, [estadoFiltro]);

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      const [cotizacionesData, clientesData, variantesData, serviciosData] = await Promise.all([
        listarCotizaciones(),
        listarClientes({ solo_activos: true }),
        listarVariantes(),
        listarServiciosTaller(),
      ]);

      setCotizaciones(cotizacionesData || []);
      setClientes(clientesData || []);
      setVariantes((variantesData || []).filter((item) => item.activo !== false));
      setServicios((serviciosData || []).filter((item) => item.activo !== false));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las cotizaciones");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCotizaciones() {
    try {
      const data = await listarCotizaciones({ estado: estadoFiltro || undefined });
      setCotizaciones(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron actualizar las cotizaciones");
    }
  }

  const cotizacionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cotizaciones;

    return cotizaciones.filter((cotizacion) =>
      [
        cotizacion.numero,
        cotizacion.tipo,
        cotizacion.estado,
        cotizacion.cliente_nombre,
        cotizacion.cliente_nombre_snapshot,
        cotizacion.problema_reportado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [cotizaciones, busqueda]);

  const productosFiltrados = useMemo(() => {
    const q = catalogoQuery.trim().toLowerCase();

    return variantes
      .filter((variante) => {
        if (!q) return true;

        return [
          variante.producto_nombre,
          variante.nombre_variante,
          variante.categoria_nombre,
          variante.sku,
          variante.codigo_proveedor,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 40);
  }, [variantes, catalogoQuery]);

  const serviciosFiltrados = useMemo(() => {
    const q = catalogoQuery.trim().toLowerCase();

    return servicios
      .filter((servicio) => {
        if (!q) return true;

        return [servicio.nombre, servicio.descripcion]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 30);
  }, [servicios, catalogoQuery]);

  const totalCotizacionDraft = useMemo(() => {
    return carritoItems.reduce((acc, item) => {
      return acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0);
    }, 0);
  }, [carritoItems]);

  const variantesAgregadas = useMemo(() => {
    return new Set(
      carritoItems
        .filter((item) => item.tipo_item === "producto" && item.id_variante)
        .map((item) => String(item.id_variante))
    );
  }, [carritoItems]);

  const serviciosAgregados = useMemo(() => {
    return new Set(
      carritoItems
        .filter((item) => item.tipo_item === "servicio_taller" && item.id_servicio_taller)
        .map((item) => String(item.id_servicio_taller))
    );
  }, [carritoItems]);

  function seleccionarCliente(clienteId) {
    const cliente = clientes.find((item) => String(item.id) === String(clienteId));
    setForm((prev) => ({
      ...prev,
      id_cliente: clienteId,
      cliente_nombre_snapshot: cliente ? cliente.nombre : prev.cliente_nombre_snapshot,
      cliente_telefono_snapshot: cliente?.telefono || prev.cliente_telefono_snapshot,
    }));
  }

  function agregarProducto(variante) {
    setCarritoItems((actual) => {
      const existente = actual.find(
        (item) =>
          item.tipo_item === "producto" &&
          Number(item.id_variante) === Number(variante.id)
      );

      if (existente) {
        return actual.map((item) =>
          item.temp_id === existente.temp_id
            ? { ...item, cantidad: String(Number(item.cantidad || 0) + 1) }
            : item
        );
      }

      return [
        ...actual,
        {
          temp_id: crearTempId("producto"),
          tipo_item: "producto",
          id_variante: variante.id,
          id_servicio_taller: null,
          descripcion_snapshot: descripcionVariante(variante),
          detalle: variante.nombre_variante || variante.sku || "",
          cantidad: "1",
          precio_unitario: String(getPrecioVariante(variante, form.tipo_precio)),
        },
      ];
    });
  }

  function agregarServicio(servicio) {
    setCarritoItems((actual) => [
      ...actual,
      {
        temp_id: crearTempId("servicio"),
        tipo_item: "servicio_taller",
        id_variante: null,
        id_servicio_taller: servicio.id,
        descripcion_snapshot: servicio.nombre,
        detalle: servicio.descripcion || "Servicio de taller",
        cantidad: "1",
        precio_unitario: String(servicio.precio_sugerido || 0),
      },
    ]);
  }

  function agregarLineaLibre() {
    if (!lineaLibre.descripcion_snapshot.trim()) {
      setError("La linea libre necesita descripcion");
      return;
    }

    if (Number(lineaLibre.precio_unitario || 0) < 0) {
      setError("El precio de la linea libre no puede ser negativo");
      return;
    }

    setError("");
    setCarritoItems((actual) => [
      ...actual,
      {
        temp_id: crearTempId("libre"),
        tipo_item: "linea_libre",
        id_variante: null,
        id_servicio_taller: null,
        descripcion_snapshot: normalizeTextUpper(lineaLibre.descripcion_snapshot),
        detalle: "Linea libre",
        cantidad: lineaLibre.cantidad || "1",
        precio_unitario: lineaLibre.precio_unitario || "0",
      },
    ]);
    setLineaLibre(lineaLibreInicial);
  }

  function actualizarItemCarrito(tempId, campo, value) {
    setCarritoItems((actual) =>
      actual.map((item) =>
        item.temp_id === tempId ? { ...item, [campo]: value } : item
      )
    );
  }

  function quitarItemCarrito(tempId) {
    setCarritoItems((actual) => actual.filter((item) => item.temp_id !== tempId));
  }

  async function handleCrear(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");

    try {
      if (carritoItems.length === 0) {
        setError("Agrega al menos un item para crear la cotizacion");
        return;
      }

      const payload = {
        tipo: form.tipo,
        tipo_precio: form.tipo_precio,
        id_sucursal: Number(sucursalId || 1),
        id_usuario_creador: Number(usuarioId || 1),
        id_cliente: form.id_cliente ? Number(form.id_cliente) : null,
        cliente_nombre_snapshot: form.cliente_nombre_snapshot || null,
        cliente_telefono_snapshot: form.cliente_telefono_snapshot || null,
        problema_reportado: form.tipo === "reparacion" ? form.problema_reportado : null,
        observaciones: form.observaciones || null,
        items: carritoItems.map(normalizarItem),
      };

      const creada = await crearCotizacion(payload);
      navigate(`/cotizaciones/${creada.id}`);
    } catch (err) {
      setError(err.message || "No se pudo crear la cotizacion");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <EmptyState icon={FileText} title="Cargando cotizaciones..." description="Preparando presupuestos y listas comerciales." />;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <PageHeader
        title="Cotizaciones"
        subtitle="Presupuestos previos sin mover stock, caja ni deuda."
        actions={<Button type="button" variant="outline" onClick={cargarTodo}><RefreshCw size={17} /> Refrescar</Button>}
      />

      {error && <div style={styles.error}>{error}</div>}

      <main style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Nueva cotizacion</h2>
              <p style={styles.panelSubtitle}>Creala y despues enviala por WhatsApp desde el detalle.</p>
            </div>
          </div>

          <form onSubmit={handleCrear} style={styles.form}>
            <div style={styles.segmented}>
              <button type="button" onClick={() => setForm((p) => ({ ...p, tipo: "venta" }))} style={form.tipo === "venta" ? styles.segmentActive : styles.segment}>
                Bici / productos
              </button>
              <button type="button" onClick={() => setForm((p) => ({ ...p, tipo: "reparacion" }))} style={form.tipo === "reparacion" ? styles.segmentActive : styles.segment}>
                Reparacion
              </button>
            </div>

            <label style={styles.field}>
              <span>Lista aplicada</span>
              <select
                value={form.tipo_precio}
                onChange={(e) => setForm((p) => ({ ...p, tipo_precio: e.target.value }))}
                style={styles.input}
              >
                <option value="minorista">Minorista</option>
                <option value="mayorista">Mayorista</option>
              </select>
            </label>

            <label style={styles.field}>
              <span>Cliente</span>
              <select value={form.id_cliente} onChange={(e) => seleccionarCliente(e.target.value)} style={styles.input}>
                <option value="">Cliente mostrador / sin registrar</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                ))}
              </select>
            </label>

            {!form.id_cliente && (
              <div style={styles.twoCols}>
                <label style={styles.field}>
                  <span>Nombre</span>
                  <input value={form.cliente_nombre_snapshot} onChange={(e) => setForm((p) => ({ ...p, cliente_nombre_snapshot: normalizeTextUpper(e.target.value) }))} style={styles.input} />
                </label>
                <label style={styles.field}>
                  <span>Telefono</span>
                  <input value={form.cliente_telefono_snapshot} onChange={(e) => setForm((p) => ({ ...p, cliente_telefono_snapshot: e.target.value }))} style={styles.input} />
                </label>
              </div>
            )}

            {form.tipo === "reparacion" && (
              <label style={styles.field}>
                <span>Consulta / problema</span>
                <textarea value={form.problema_reportado} onChange={(e) => setForm((p) => ({ ...p, problema_reportado: normalizeTextUpper(e.target.value) }))} style={styles.textarea} required />
              </label>
            )}

            <section style={styles.quoteBuilder}>
              <div style={styles.itemHeader}>
                <div>
                  <strong>Items de la cotizacion</strong>
                  <p style={styles.builderHint}>
                    Busca productos o servicios y agregalos rapido a la cotizacion.
                  </p>
                </div>
                <strong style={styles.builderTotal}>{formatMoney(totalCotizacionDraft)}</strong>
              </div>

              <div style={styles.searchBox}>
                <Search size={17} />
                <input
                  value={catalogoQuery}
                  onChange={(e) => setCatalogoQuery(e.target.value)}
                  placeholder="Buscar producto, SKU, servicio o codigo..."
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.catalogArea}>
                <div style={styles.catalogColumn}>
                  <div style={styles.catalogHeader}>
                    <strong>Productos</strong>
                    <span>{productosFiltrados.length}</span>
                  </div>

                  <div style={styles.catalogList}>
                    {productosFiltrados.length === 0 ? (
                      <div style={styles.emptySmall}>No hay productos para esa busqueda.</div>
                    ) : (
                      productosFiltrados.map((variante) => (
                        <CotizacionCatalogCard
                          key={variante.id}
                          title={descripcionVariante(variante)}
                          meta={metaVariante(variante)}
                          price={getPrecioVariante(variante, form.tipo_precio)}
                          badge={variante.categoria_nombre || "Producto"}
                          selected={variantesAgregadas.has(String(variante.id))}
                          onAdd={() => agregarProducto(variante)}
                        />
                      ))
                    )}
                  </div>
                </div>

                {form.tipo === "reparacion" && (
                  <div style={styles.catalogColumn}>
                    <div style={styles.catalogHeader}>
                      <strong>Servicios</strong>
                      <span>{serviciosFiltrados.length}</span>
                    </div>

                    <div style={styles.catalogList}>
                      {serviciosFiltrados.length === 0 ? (
                        <div style={styles.emptySmall}>No hay servicios para esa busqueda.</div>
                      ) : (
                        serviciosFiltrados.map((servicio) => (
                          <CotizacionCatalogCard
                            key={servicio.id}
                            title={servicio.nombre}
                            meta={servicio.descripcion || "Servicio de taller"}
                            price={servicio.precio_sugerido}
                            badge="Servicio"
                            serviceVisual
                            selected={serviciosAgregados.has(String(servicio.id))}
                            onAdd={() => agregarServicio(servicio)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.lineaLibreBox}>
                <strong>Linea libre</strong>
                <div style={styles.lineaLibreGrid}>
                  <input
                    value={lineaLibre.descripcion_snapshot}
                    onChange={(e) =>
                      setLineaLibre((prev) => ({
                        ...prev,
                        descripcion_snapshot: e.target.value,
                      }))
                    }
                    placeholder="Descripcion manual"
                    style={styles.input}
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lineaLibre.cantidad}
                    onChange={(e) =>
                      setLineaLibre((prev) => ({ ...prev, cantidad: e.target.value }))
                    }
                    style={styles.input}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineaLibre.precio_unitario}
                    onChange={(e) =>
                      setLineaLibre((prev) => ({ ...prev, precio_unitario: e.target.value }))
                    }
                    placeholder="Precio"
                    style={styles.input}
                  />
                  <button type="button" onClick={agregarLineaLibre} style={styles.secondaryButton}>
                    <Plus size={16} /> Agregar
                  </button>
                </div>
              </div>

              <CotizacionCarrito
                items={carritoItems}
                onChange={actualizarItemCarrito}
                onRemove={quitarItemCarrito}
              />
            </section>

            <label style={styles.field}>
              <span>Observaciones</span>
              <textarea value={form.observaciones} onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))} style={styles.textarea} />
            </label>

            <button type="submit" disabled={guardando} style={styles.primaryButton}>
              <Plus size={17} /> {guardando ? "Creando..." : "Crear cotizacion"}
            </button>
          </form>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Listado</h2>
              <p style={styles.panelSubtitle}>{cotizacionesFiltradas.length} resultado(s)</p>
            </div>
          </div>

          <div style={styles.filters}>
            <div style={styles.searchBox}>
              <Search size={17} />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar numero, cliente o problema..." style={styles.searchInput} />
            </div>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={styles.input}>
              {ESTADOS.map((estado) => (
                <option key={estado.value} value={estado.value}>{estado.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.list}>
            {cotizacionesFiltradas.length === 0 ? (
              <div style={styles.empty}>No hay cotizaciones para mostrar.</div>
            ) : (
              cotizacionesFiltradas.map((cotizacion) => (
                <CotizacionCard key={cotizacion.id} cotizacion={cotizacion} />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function CotizacionCatalogCard({
  title,
  meta,
  price,
  badge,
  selected = false,
  serviceVisual = false,
  onAdd,
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{ ...styles.catalogCard, ...(selected ? styles.catalogCardSelected : {}) }}
      title={selected ? "Ya esta agregado. Click para sumar otra unidad" : "Click para agregar"}
    >
      {serviceVisual && <ServicePlaceholder size="sm" />}
      <div style={styles.catalogInfo}>
        <strong>{title}</strong>
        <p style={styles.catalogMeta}>{meta || "-"}</p>
      </div>
      <div style={styles.catalogRight}>
        <span style={selected ? styles.catalogBadgeSelected : styles.catalogBadge}>
          {selected ? "Agregado" : badge}
        </span>
        <strong>{formatMoney(price || 0)}</strong>
      </div>
    </button>
  );
}

function CotizacionCarrito({ items, onChange, onRemove }) {
  if (items.length === 0) {
    return <div style={styles.cartEmpty}>Todavia no agregaste items a la cotizacion.</div>;
  }

  return (
    <div style={styles.cartBox}>
      <div style={styles.catalogHeader}>
        <strong>Carrito</strong>
        <span>{items.length} item(s)</span>
      </div>

      {items.map((item) => (
        <article key={item.temp_id} style={styles.cartRow}>
          <div style={styles.cartInfo}>
            <span style={badgeTipo(item.tipo_item === "servicio_taller" ? "reparacion" : "venta")}>
              {labelTipoItem(item.tipo_item)}
            </span>
            <strong>{item.descripcion_snapshot}</strong>
            {item.detalle && <small>{item.detalle}</small>}
          </div>

          <div style={styles.cartControls}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={item.cantidad}
              onChange={(e) => onChange(item.temp_id, "cantidad", e.target.value)}
              style={styles.qtyInput}
              title="Cantidad"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.precio_unitario}
              onChange={(e) => onChange(item.temp_id, "precio_unitario", e.target.value)}
              style={styles.priceInput}
              title="Precio"
            />
            <strong style={styles.cartSubtotal}>
              {formatMoney(Number(item.cantidad || 0) * Number(item.precio_unitario || 0))}
            </strong>
            <button
              type="button"
              onClick={() => onRemove(item.temp_id)}
              style={styles.iconDanger}
              title="Quitar item"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function CotizacionCard({ cotizacion }) {
  return (
    <article style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <div style={styles.numberRow}>
            <FileText size={16} />
            <strong>{cotizacion.numero}</strong>
            <span style={badgeTipo(cotizacion.tipo)}>{cotizacion.tipo === "reparacion" ? "Reparacion" : "Venta"}</span>
            <span style={styles.priceTypeBadge}>Lista {labelTipoPrecio(cotizacion.tipo_precio)}</span>
          </div>
          <p style={styles.cardTitle}>{cotizacion.cliente_nombre || cotizacion.cliente_nombre_snapshot || "Cliente mostrador"}</p>
          {cotizacion.problema_reportado && <p style={styles.muted}>{cotizacion.problema_reportado}</p>}
        </div>
        <span style={badgeEstado(cotizacion.estado)}>{labelEstado(cotizacion.estado)}</span>
      </div>

      <div style={styles.metaGrid}>
        <Info label="Fecha" value={formatDate(cotizacion.fecha)} />
        <Info label="Items" value={cotizacion.items_count} />
        <Info label="Lista" value={labelTipoPrecio(cotizacion.tipo_precio)} />
        <Info label="Total" value={formatMoney(cotizacion.total_final)} />
      </div>

      <Link to={`/cotizaciones/${cotizacion.id}`} style={styles.detailButton}>Abrir</Link>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.info}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function normalizarItem(item, index) {
  return {
    tipo_item: item.tipo_item,
    id_variante: item.id_variante ? Number(item.id_variante) : null,
    id_servicio_taller: item.id_servicio_taller ? Number(item.id_servicio_taller) : null,
    descripcion_snapshot: item.descripcion_snapshot || null,
    cantidad: item.cantidad || "1",
    precio_unitario: item.precio_unitario === "" ? null : item.precio_unitario,
    orden: index,
  };
}

function descripcionVariante(variante) {
  return [variante.producto_nombre, variante.nombre_variante]
    .filter(Boolean)
    .join(" - ");
}

function metaVariante(variante) {
  return [
    variante.sku ? `SKU ${variante.sku}` : null,
    variante.codigo_proveedor ? `Prov ${variante.codigo_proveedor}` : null,
    variante.stock_disponible != null ? `Stock ${variante.stock_disponible}` : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function getPrecioVariante(variante, tipoPrecio) {
  if (tipoPrecio === "mayorista") return Number(variante.precio_mayorista || 0);
  return Number(variante.precio_minorista || 0);
}

function labelTipoPrecio(tipoPrecio) {
  return tipoPrecio === "mayorista" ? "Mayorista" : "Minorista";
}

function labelTipoItem(tipo) {
  const labels = {
    producto: "Producto",
    servicio_taller: "Servicio",
    linea_libre: "Libre",
  };
  return labels[tipo] || tipo;
}

function labelEstado(estado) {
  const labels = {
    borrador: "Borrador",
    enviada: "Enviada",
    aceptada: "Aceptada",
    convertida: "Convertida",
    rechazada: "Rechazada",
    vencida: "Vencida",
    cancelada: "Cancelada",
  };
  return labels[estado] || estado;
}

function badgeEstado(estado) {
  const tones = {
    borrador: ["#475569", "#f8fafc", "#e2e8f0"],
    enviada: ["#1d4ed8", "#eff6ff", "#bfdbfe"],
    aceptada: ["#047857", "#ecfdf5", "#bbf7d0"],
    convertida: ["#166534", "#dcfce7", "#bbf7d0"],
    rechazada: ["#991b1b", "#fee2e2", "#fecaca"],
    vencida: ["#92400e", "#fef3c7", "#fde68a"],
    cancelada: ["#64748b", "#f1f5f9", "#e2e8f0"],
  };
  const [color, background, border] = tones[estado] || tones.borrador;
  return { ...styles.badge, color, background, border: `1px solid ${border}` };
}

function badgeTipo(tipo) {
  return {
    ...styles.badge,
    color: tipo === "reparacion" ? "#c2410c" : "#1d4ed8",
    background: tipo === "reparacion" ? "#fff7ed" : "#eff6ff",
    border: `1px solid ${tipo === "reparacion" ? "#fed7aa" : "#bfdbfe"}`,
  };
}

const styles = {
  page: { minHeight: "100vh", display: "grid", gap: spacing.xl, color: colors.text, fontFamily: typography.fontFamily },
  pageMobile: { padding: 10 },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 22, borderRadius: 22, background: "#0f172a", color: "white", marginBottom: 16, boxShadow: "0 18px 40px rgba(15,23,42,.18)" },
  heroMobile: { display: "grid", gridTemplateColumns: "1fr", padding: 16 },
  kicker: { margin: 0, color: "#fb923c", fontSize: 12, fontWeight: 1000, textTransform: "uppercase" },
  title: { margin: "3px 0 0", fontSize: 34, fontWeight: 1000 },
  subtitle: { margin: "8px 0 0", color: "#cbd5e1", fontWeight: 700 },
  heroButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 13, padding: "12px 14px", fontWeight: 1000, cursor: "pointer" },
  layout: { display: "grid", gridTemplateColumns: "minmax(460px, 560px) minmax(0, 1fr)", gap: spacing.lg, alignItems: "start" },
  layoutMobile: { gridTemplateColumns: "1fr" },
  panel: { background: colors.surface, border: `1px solid ${colors.borderSoft}`, borderRadius: radius.lg, overflow: "hidden", boxShadow: shadows.sm },
  panelHeader: { padding: spacing.lg, borderBottom: `1px solid ${colors.borderSoft}` },
  panelTitle: { margin: 0, fontSize: typography.sectionTitle.fontSize, fontWeight: typography.sectionTitle.fontWeight },
  panelSubtitle: { margin: "4px 0 0", color: colors.textMuted, fontSize: typography.small.fontSize },
  form: { display: "grid", gap: spacing.md, padding: spacing.lg },
  segmented: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  segment: { border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 12, padding: "11px 12px", fontWeight: 1000, cursor: "pointer" },
  segmentActive: { border: "1px solid #f97316", background: "#fff7ed", color: "#c2410c", borderRadius: 12, padding: "11px 12px", fontWeight: 1000, cursor: "pointer" },
  field: { display: "grid", gap: spacing.sm, fontSize: typography.label.fontSize, fontWeight: typography.label.fontWeight, color: colors.text },
  input: { width: "100%", minHeight: controls.minHeight, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: controls.padding, boxSizing: "border-box", background: colors.surface, color: colors.text },
  compactSelect: { border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 10px", fontWeight: 900, background: "white" },
  textarea: { width: "100%", minHeight: 76, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px", fontWeight: 700, resize: "vertical", boxSizing: "border-box" },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  itemBox: { display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, background: "#f8fafc" },
  itemHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  primaryButton: { minHeight: controls.minHeight, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: spacing.sm, border: "none", background: colors.primary, color: colors.surface, borderRadius: radius.md, padding: controls.padding, fontWeight: typography.button.fontWeight, cursor: "pointer", boxShadow: shadows.sm },
  secondaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #cbd5e1", background: "#0f172a", color: "white", borderRadius: 12, padding: "11px 12px", fontWeight: 1000, cursor: "pointer", whiteSpace: "nowrap" },
  quoteBuilder: { display: "grid", gap: 12, border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, background: "#f8fafc" },
  builderHint: { margin: "4px 0 0", color: "#64748b", fontSize: 12, fontWeight: 750 },
  builderTotal: { color: "#047857", fontSize: 18, whiteSpace: "nowrap" },
  catalogArea: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  catalogColumn: { display: "grid", gap: 8, minWidth: 0 },
  catalogHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, color: "#334155", fontSize: 13, fontWeight: 1000 },
  catalogList: { display: "grid", gap: 8, maxHeight: 310, overflow: "auto", paddingRight: 2 },
  catalogCard: { width: "100%", display: "flex", gap: 10, alignItems: "center", textAlign: "left", border: "1px solid #dbe3ef", background: "white", color: "#0f172a", borderRadius: 12, padding: 10, cursor: "pointer" },
  catalogInfo: { flex: 1, minWidth: 0 },
  catalogCardSelected: { border: "1px solid #34d399", background: "#ecfdf5", boxShadow: "inset 4px 0 0 #10b981" },
  catalogMeta: { margin: "4px 0 0", color: "#64748b", fontSize: 12, fontWeight: 750, overflowWrap: "anywhere" },
  catalogRight: { display: "grid", justifyItems: "end", gap: 5, whiteSpace: "nowrap" },
  catalogBadge: { borderRadius: 999, padding: "4px 7px", background: "#eef2ff", color: "#3730a3", fontSize: 11, fontWeight: 1000, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" },
  catalogBadgeSelected: { borderRadius: 999, padding: "4px 7px", background: "#d1fae5", color: "#047857", border: "1px solid #6ee7b7", fontSize: 11, fontWeight: 1000 },
  emptySmall: { padding: 10, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#64748b", fontWeight: 850, background: "white" },
  lineaLibreBox: { display: "grid", gap: 8, borderTop: "1px solid #e2e8f0", paddingTop: 10 },
  lineaLibreGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, alignItems: "center" },
  cartEmpty: { border: "1px dashed #cbd5e1", borderRadius: 12, padding: 12, color: "#64748b", background: "white", fontWeight: 850 },
  cartBox: { display: "grid", gap: 8, borderTop: "1px solid #e2e8f0", paddingTop: 10 },
  cartRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "white" },
  cartInfo: { display: "grid", gap: 5, minWidth: 0 },
  cartControls: { display: "grid", gridTemplateColumns: "72px 105px minmax(82px, auto) 34px", gap: 7, alignItems: "center" },
  qtyInput: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 8px", fontWeight: 850, boxSizing: "border-box" },
  priceInput: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 8px", fontWeight: 850, boxSizing: "border-box" },
  cartSubtotal: { textAlign: "right", whiteSpace: "nowrap" },
  iconDanger: { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 10, cursor: "pointer" },
  filters: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px", gap: 10, padding: 16, borderBottom: "1px solid #e2e8f0" },
  searchBox: { display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 12, padding: "0 11px", background: "#f8fafc" },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", padding: "12px 0", fontWeight: 750, minWidth: 0 },
  list: { display: "grid", gap: 10, padding: 16 },
  card: { border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, display: "grid", gap: 12, background: "white" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  numberRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#0f172a" },
  priceTypeBadge: { borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 900, color: "#166534", background: "#dcfce7", border: "1px solid #bbf7d0" },
  cardTitle: { margin: "6px 0 0", fontWeight: 1000, fontSize: 17 },
  muted: { margin: "4px 0 0", color: "#64748b", fontWeight: 700 },
  metaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 },
  info: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, display: "grid", gap: 3, color: "#64748b" },
  detailButton: { textDecoration: "none", textAlign: "center", background: "#0f172a", color: "white", borderRadius: 12, padding: "10px 12px", fontWeight: 1000 },
  badge: { display: "inline-flex", alignItems: "center", width: "fit-content", borderRadius: 999, padding: "5px 8px", fontSize: 12, fontWeight: 1000 },
  empty: { padding: 18, color: "#64748b", fontWeight: 900 },
  error: { background: colors.dangerSoft, color: colors.dangerDark, border: `1px solid ${colors.danger}`, borderRadius: radius.md, padding: spacing.md, fontWeight: typography.label.fontWeight },
  state: { padding: 24, fontWeight: 900 },
};
