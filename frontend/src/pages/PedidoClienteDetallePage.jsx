import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Printer, RefreshCcw, ShoppingCart, Trash2 } from "lucide-react";
import CatalogoPOSPanel from "../components/ventas/catalogo/CatalogoPOSPanel";
import {
  crearLineId,
  getCodigoItemCatalogo,
  getDescripcionItemCatalogo,
  getMotivoBloqueoItemCatalogo,
  getPrecioItemCatalogo,
  puedeAgregarItemCatalogo,
} from "../helpers/ventasItemsHelper";
import { listarCategorias, listarCatalogoPOS } from "../services/catalogoService";
import {
  agregarItemPedidoCliente,
  actualizarItemPedidoCliente,
  cancelarPedidoCliente,
  obtenerPedidoCliente,
  quitarItemPedidoCliente,
} from "../services/pedidosClienteService";
import { getPedidoClienteBorradorPdfUrl } from "../services/documentosService";
import { guardarVentaDraft } from "../services/ventaDraftStore";
import { useSession } from "../context/SessionContext";
import { useToast } from "../hooks/useToast";
import { buildImageUrl } from "../utils/images";
import { formatMoney, formatNumber } from "../utils/formatters";
import { Button, Card, PageHeader } from "../components/ui";
import { colors, radius, shadows, spacing, typography } from "../theme";
import { listarSerializadasDisponibles } from "../services/serializadasService";
import VentaItemSerializadaPanel from "../components/ventas/item/VentaItemSerializadaPanel";

const DEFAULT_LIMIT = 50;

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cantidadNumber(value) {
  return Number(value || 0);
}

function crearItemVentaDesdePedido(item, tipoPrecio, bicicleta = null) {
  const oferta = tipoPrecio !== "mayorista" && bicicleta?.oferta_id;
  const precioResuelto = oferta
    ? Number(bicicleta.precio_oferta || 0)
    : getPrecioItemCatalogo(item, tipoPrecio);
  return {
    line_id: crearLineId(),
    id_variante: item.id_variante,
    id_producto: item.id_producto,
    descripcion: getDescripcionItemCatalogo(item),
    codigo: getCodigoItemCatalogo(item),
    categoria_nombre: item.categoria_nombre,
    tipo_item: item.tipo_item,
    stockeable: item.stockeable,
    serializable: item.serializable,
    stock_disponible: Number(item.stock_disponible || 0),
    precio_minorista: Number(item.precio_minorista || 0),
    precio_mayorista: Number(item.precio_mayorista || 0),
    precio_lista: precioResuelto,
    en_oferta: Boolean(oferta || (tipoPrecio !== "mayorista" && item.en_oferta)),
    oferta_id: oferta ? bicicleta.oferta_id : (tipoPrecio !== "mayorista" ? item.oferta_id : null),
    oferta_nombre: oferta ? bicicleta.oferta_nombre : (tipoPrecio !== "mayorista" ? item.oferta_nombre : null),
    precio_catalogo_original: Number(item.precio_minorista || 0),
    precio_oferta: oferta ? Number(bicicleta.precio_oferta || 0) : (tipoPrecio !== "mayorista" ? Number(item.precio_oferta || 0) : null),
    oferta_alcance: oferta ? bicicleta.oferta_alcance : (item.en_oferta ? "variante" : null),
    oferta_politica_contado: oferta ? bicicleta.oferta_politica_contado : item.oferta_politica_contado,
    tipo_precio_aplicado: tipoPrecio,
    cantidad: item.serializable ? 1 : cantidadNumber(item.cantidad),
    imagen_principal: item.imagen_principal,
    id_bicicleta_serializada: bicicleta?.id || null,
    numero_cuadro: bicicleta?.numero_cuadro || "",
    modo_venta_serializada: item.serializable ? "serializada" : undefined,
  };
}

function expandirItemsParaCheckout(items, tipoPrecio, selecciones, disponiblesPorVariante) {
  const resultado = [];

  items.forEach((item) => {
    if (item.serializable) {
      const cantidad = Math.max(1, Math.floor(cantidadNumber(item.cantidad)));
      for (let i = 0; i < cantidad; i += 1) {
        const bicicletaId = selecciones[`${item.id}-${i}`];
        const bicicleta = (disponiblesPorVariante[String(item.id_variante)] || [])
          .find((unidad) => Number(unidad.id) === Number(bicicletaId));
        resultado.push(crearItemVentaDesdePedido(item, tipoPrecio, bicicleta));
      }
      return;
    }

    resultado.push(crearItemVentaDesdePedido(item, tipoPrecio));
  });

  return resultado;
}

export default function PedidoClienteDetallePage() {
  const { pedidoId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { sucursalId, usuarioId } = useSession();
  const [pedido, setPedido] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [serializadasPorVariante, setSerializadasPorVariante] = useState({});
  const [seleccionesSerializadas, setSeleccionesSerializadas] = useState({});

  const editable = pedido?.estado === "borrador";
  const items = pedido?.items || [];
  const variantesEnPedido = useMemo(
    () => new Set(items.map((item) => String(item.id_variante))),
    [items]
  );

  useEffect(() => {
    cargarInicial();
  }, [pedidoId]);

  useEffect(() => {
    const handle = setTimeout(() => cargarCatalogo(), 250);
    return () => clearTimeout(handle);
  }, [query, categoriaId, pedido?.id_sucursal]);

  useEffect(() => {
    const serializables = items.filter((item) => item.serializable);
    if (!pedido?.id_sucursal || serializables.length === 0) return;
    Promise.all(
      [...new Set(serializables.map((item) => Number(item.id_variante)))].map(async (idVariante) => {
        const unidades = await listarSerializadasDisponibles({
          id_variante: idVariante,
          id_sucursal: pedido.id_sucursal,
        });
        return [String(idVariante), unidades || []];
      })
    ).then((pares) => setSerializadasPorVariante(Object.fromEntries(pares)))
      .catch((err) => toast.error(err.message || "No se pudieron cargar los cuadros disponibles"));
  }, [pedido?.id_sucursal, pedido?.items]);

  async function cargarInicial() {
    try {
      setLoading(true);
      const [pedidoData, categoriasData] = await Promise.all([
        obtenerPedidoCliente(pedidoId),
        listarCategorias(),
      ]);
      setPedido(pedidoData);
      setCategorias(categoriasData || []);
    } catch (err) {
      toast.error(err.message || "No se pudo cargar el pedido");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogo() {
    const sucursal = pedido?.id_sucursal || sucursalId;
    if (!sucursal) return;

    try {
      setBuscando(true);
      const data = await listarCatalogoPOS({
        id_sucursal: sucursal,
        query: query.trim() || undefined,
        categoria_id: categoriaId || undefined,
        limit: DEFAULT_LIMIT,
      });
      setCatalogo(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      toast.error(err.message || "No se pudo cargar el catálogo");
    } finally {
      setBuscando(false);
    }
  }

  async function agregarProducto(producto) {
    if (!editable) return false;
    if (!puedeAgregarItemCatalogo(producto, pedido.tipo_precio)) {
      toast.error(`No se puede agregar: ${getMotivoBloqueoItemCatalogo(producto, pedido.tipo_precio)}`);
      return false;
    }

    try {
      setProcesando(true);
      const actualizado = await agregarItemPedidoCliente(pedido.id, {
        id_variante: producto.id_variante,
        cantidad: 1,
        id_usuario: usuarioId,
      });
      setPedido(actualizado);
      setProductoSeleccionadoId(null);
      return true;
    } catch (err) {
      toast.error(err.message || "No se pudo agregar el producto");
      return false;
    } finally {
      setProcesando(false);
    }
  }

  async function seleccionarProducto(producto) {
    const idVariante = String(producto.id_variante);
    if (productoSeleccionadoId === idVariante) {
      await agregarProducto(producto);
      return;
    }
    setProductoSeleccionadoId(idVariante);
  }

  async function cambiarCantidad(item, nuevaCantidad) {
    if (!editable || nuevaCantidad <= 0) return;
    try {
      const actualizado = await actualizarItemPedidoCliente(pedido.id, item.id, {
        cantidad: nuevaCantidad,
        id_usuario: usuarioId,
      });
      setPedido(actualizado);
    } catch (err) {
      toast.error(err.message || "No se pudo cambiar la cantidad");
    }
  }

  async function quitarItem(item) {
    if (!editable) return;
    try {
      const actualizado = await quitarItemPedidoCliente(pedido.id, item.id);
      setPedido(actualizado);
    } catch (err) {
      toast.error(err.message || "No se pudo quitar el item");
    }
  }

  async function cancelarPedido() {
    if (!editable) return;
    const motivo = window.prompt("Motivo de cancelación del pedido (opcional):", "");
    if (motivo === null) return;
    try {
      const actualizado = await cancelarPedidoCliente(pedido.id, {
        motivo: motivo.trim() || null,
        id_usuario: usuarioId,
      });
      setPedido(actualizado);
      toast.success("Pedido cancelado");
    } catch (err) {
      toast.error(err.message || "No se pudo cancelar el pedido");
    }
  }

  function pasarACheckout() {
    if (!pedido || !items.length) {
      toast.error("Agregá al menos un item antes de pasar a checkout");
      return;
    }

    const faltantes = items
      .filter((item) => item.serializable)
      .some((item) => Array.from(
        { length: Math.max(1, Math.floor(cantidadNumber(item.cantidad))) },
        (_, index) => seleccionesSerializadas[`${item.id}-${index}`]
      ).some((id) => !id));
    if (faltantes) {
      toast.error("Elegí el número de cuadro de cada bicicleta antes de pasar a checkout");
      return;
    }
    const elegidas = Object.values(seleccionesSerializadas).filter(Boolean);
    if (new Set(elegidas.map(Number)).size !== elegidas.length) {
      toast.error("El mismo número de cuadro no puede usarse dos veces");
      return;
    }

    const checkoutItems = expandirItemsParaCheckout(
      items,
      pedido.tipo_precio,
      seleccionesSerializadas,
      serializadasPorVariante
    );
    const total = checkoutItems.reduce(
      (acc, item) => acc + Number(item.precio_lista || 0) * Number(item.cantidad || 0),
      0
    );
    const ventaDraft = {
      pedidoClienteId: pedido.id,
      clienteId: String(pedido.id_cliente),
      cliente: {
        id: pedido.id_cliente,
        nombre: pedido.cliente_nombre,
        dni: pedido.cliente_dni,
        telefono: pedido.cliente_telefono,
      },
      tipoPrecio: pedido.tipo_precio,
      items: checkoutItems,
      total,
      observaciones: pedido.observaciones || `Pedido #${pedido.id}`,
      usarCredito: true,
      idUsuario: usuarioId,
      idSucursal: pedido.id_sucursal,
      advertencias: {
        consumidorFinalConfirmado: false,
      },
    };

    guardarVentaDraft({
      sucursalId: pedido.id_sucursal,
      usuarioId,
      draft: ventaDraft,
    });

    navigate("/ventas/checkout", { state: { ventaDraft } });
  }

  function descargarBorradorPdf() {
    window.open(getPedidoClienteBorradorPdfUrl(pedido.id), "_blank", "noopener,noreferrer");
  }

  if (!pedido) {
    return (
      <div style={styles.page}>
        <Card style={styles.emptyCard}>{loading ? "Cargando pedido..." : "No se encontró el pedido."}</Card>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title={`Pedido #${pedido.id}`}
        subtitle={`${pedido.cliente_nombre} · ${pedido.sucursal_nombre} · ${formatDate(pedido.fecha_creacion)}`}
        eyebrow="Pedido de cliente"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate("/pedidos-cliente")}>
              <ArrowLeft size={16} /> Volver
            </Button>
            <Button type="button" variant="outline" onClick={cargarInicial}>
              <RefreshCcw size={16} /> Refrescar
            </Button>
            <Button type="button" variant="outline" onClick={descargarBorradorPdf} disabled={items.length === 0}>
              <Printer size={16} /> Descargar PDF
            </Button>
          </>
        }
      />

      <main style={styles.layout}>
        <section style={styles.catalogSection}>
          <CatalogoPOSPanel
            query={query}
            onQueryChange={setQuery}
            onBuscar={() => cargarCatalogo()}
            categoriaId={categoriaId}
            onCategoriaChange={setCategoriaId}
            categorias={categorias}
            catalogo={catalogo}
            tipoPrecio={pedido.tipo_precio}
            variantesEnCarrito={variantesEnPedido}
            productoSeleccionadoId={productoSeleccionadoId}
            buscando={buscando || procesando}
            onAgregarItem={agregarProducto}
            onSeleccionarItem={seleccionarProducto}
            onRecargarCatalogo={cargarCatalogo}
          />
        </section>

        <aside style={styles.aside}>
          <Card bodyStyle={styles.summaryCardBody}>
            <div style={styles.summaryHeader}>
              <div>
                <div style={styles.kicker}>Pedido guardado</div>
                <h2 style={styles.summaryTitle}>{pedido.cliente_nombre}</h2>
              </div>
              <span style={styles.estadoPill}>{pedido.estado}</span>
            </div>

            <div style={styles.metrics}>
              <Metric label="Lista" value={pedido.tipo_precio} />
              <Metric label="Items" value={pedido.total_items} />
              <Metric label="Unidades" value={formatNumber(pedido.cantidad_total || 0)} />
              <Metric label="Estimado" value={formatMoney(pedido.total_estimado || 0)} highlight />
            </div>

            {pedido.observaciones && <p style={styles.note}>{pedido.observaciones}</p>}

            <div style={styles.itemsList}>
              {items.length === 0 ? (
                <div style={styles.emptyItems}>Agregá productos desde el listado.</div>
              ) : (
                items.map((item) => (
                  <div key={item.id} style={styles.itemRow}>
                    <div style={styles.itemImageBox}>
                      {item.imagen_principal ? (
                        <img
                          src={buildImageUrl(item.imagen_principal)}
                          alt={getDescripcionItemCatalogo(item)}
                          style={styles.itemImage}
                        />
                      ) : (
                        <ShoppingCart size={20} />
                      )}
                    </div>
                    <div style={styles.itemInfo}>
                      <strong>{getDescripcionItemCatalogo(item)}</strong>
                      <span>
                        {getCodigoItemCatalogo(item)} · {formatMoney(getPrecioItemCatalogo(item, pedido.tipo_precio))}
                      </span>
                    </div>
                    {editable ? (
                      <div style={styles.qtyControl}>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(item, cantidadNumber(item.cantidad) - 1)}
                          style={styles.qtyBtn}
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          value={String(Number(item.cantidad || 0))}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value) && value > 0) {
                              cambiarCantidad(item, value);
                            }
                          }}
                          style={styles.qtyInput}
                        />
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(item, cantidadNumber(item.cantidad) + 1)}
                          style={styles.qtyBtn}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <strong>x{formatNumber(item.cantidad || 0)}</strong>
                    )}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => quitarItem(item)}
                        style={styles.removeBtn}
                        title="Quitar"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    {item.serializable && Array.from(
                      { length: Math.max(1, Math.floor(cantidadNumber(item.cantidad))) },
                      (_, unidadIndex) => {
                        const key = `${item.id}-${unidadIndex}`;
                        const bicicletaId = seleccionesSerializadas[key] || null;
                        const disponibles = serializadasPorVariante[String(item.id_variante)] || [];
                        const bici = disponibles.find((unidad) => Number(unidad.id) === Number(bicicletaId));
                        return (
                          <div key={key} style={styles.serialSelector}>
                            <VentaItemSerializadaPanel
                              titulo={`Unidad ${unidadIndex + 1} de ${Math.max(1, Math.floor(cantidadNumber(item.cantidad)))}`}
                              item={{
                                ...item,
                                id_bicicleta_serializada: bicicletaId,
                                numero_cuadro: bici?.numero_cuadro || "",
                                en_oferta: Boolean(bici?.oferta_id || item.en_oferta),
                                oferta_id: bici?.oferta_id || item.oferta_id,
                                oferta_nombre: bici?.oferta_nombre || item.oferta_nombre,
                                precio_oferta: bici?.precio_oferta || item.precio_oferta,
                                oferta_alcance: bici?.oferta_alcance || (item.en_oferta ? "variante" : null),
                                oferta_politica_contado: bici?.oferta_politica_contado || item.oferta_politica_contado,
                                precio_lista: bici?.precio_oferta || getPrecioItemCatalogo(item, pedido.tipo_precio),
                              }}
                              bicicletasDisponibles={disponibles}
                              seleccionarSerializada={(id) => setSeleccionesSerializadas((actual) => ({ ...actual, [key]: id }))}
                              limpiarSerializada={() => setSeleccionesSerializadas((actual) => ({ ...actual, [key]: null }))}
                            />
                          </div>
                        );
                      }
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={pasarACheckout}
              disabled={!editable || items.length === 0}
              style={!editable || items.length === 0 ? styles.checkoutDisabled : styles.checkoutBtn}
            >
              Pasar a checkout
            </button>

            {editable && (
              <button type="button" onClick={cancelarPedido} style={styles.cancelBtn}>
                Cancelar pedido
              </button>
            )}

            {pedido.id_venta_generada && (
              <button
                type="button"
                onClick={() => navigate(`/ventas/${pedido.id_venta_generada}`)}
                style={styles.openSaleBtn}
              >
                Abrir venta #{pedido.id_venta_generada}
              </button>
            )}
          </Card>

          <Card bodyStyle={styles.historyCardBody}>
            <div style={styles.kicker}>Historial</div>
            <div style={styles.historyList}>
              {(pedido.historial || []).slice(0, 8).map((evento) => (
                <div key={evento.id} style={styles.historyItem}>
                  <strong>{evento.accion}</strong>
                  <span>{formatDate(evento.fecha)}</span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </main>

    </div>
  );
}

function Metric({ label, value, highlight = false }) {
  return (
    <div style={highlight ? styles.metricHighlight : styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: { display: "grid", gap: spacing.lg },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 460px",
    gap: spacing.lg,
    alignItems: "start",
  },
  catalogSection: { minWidth: 0 },
  aside: { display: "grid", gap: spacing.md, position: "sticky", top: 14 },
  summaryCardBody: { display: "grid", gap: 14 },
  summaryHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  summaryTitle: { margin: "2px 0 0", fontSize: 22, color: colors.text },
  estadoPill: {
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    padding: "7px 10px",
    fontWeight: 900,
  },
  metrics: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  metric: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: 10,
    display: "grid",
    gap: 3,
    background: "white",
  },
  metricHighlight: {
    border: "1px solid #fed7aa",
    borderRadius: radius.md,
    padding: 10,
    display: "grid",
    gap: 3,
    background: "#fff7ed",
    color: "#c2410c",
  },
  note: {
    margin: 0,
    borderRadius: radius.md,
    background: colors.surfaceAlt,
    color: colors.textMuted,
    padding: 10,
    fontWeight: 700,
  },
  itemsList: { display: "grid", gap: 10, maxHeight: "50vh", overflow: "auto", paddingRight: 4 },
  emptyItems: {
    minHeight: 160,
    border: `1px dashed ${colors.border}`,
    borderRadius: radius.md,
    display: "grid",
    placeItems: "center",
    color: colors.textMuted,
    fontWeight: 800,
  },
  itemRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 10px",
    alignItems: "center",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: 10,
    background: "white",
  },
  serialSelector: { flex: "1 0 100%", marginTop: 2 },
  itemImageBox: {
    width: 52,
    height: 46,
    flex: "0 0 52px",
    borderRadius: radius.sm,
    border: `1px solid ${colors.border}`,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "#fff",
  },
  itemImage: { width: "100%", height: "100%", objectFit: "contain" },
  itemInfo: {
    minWidth: 0,
    flex: "1 1 calc(100% - 72px)",
    display: "grid",
    gap: 3,
    lineHeight: 1.08,
  },
  qtyControl: {
    display: "grid",
    gridTemplateColumns: "30px 48px 30px",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    overflow: "hidden",
    marginLeft: 62,
  },
  qtyBtn: { border: 0, background: colors.surfaceAlt, display: "grid", placeItems: "center", cursor: "pointer" },
  qtyInput: { border: 0, textAlign: "center", fontWeight: 900, minWidth: 0 },
  removeBtn: {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    background: "white",
    height: 34,
    width: 38,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    marginLeft: "auto",
  },
  checkoutBtn: {
    minHeight: 48,
    border: 0,
    borderRadius: radius.md,
    background: colors.primary,
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: shadows.sm,
  },
  checkoutDisabled: {
    minHeight: 48,
    border: 0,
    borderRadius: radius.md,
    background: "#e5e7eb",
    color: "#94a3b8",
    fontWeight: 900,
  },
  cancelBtn: {
    minHeight: 40,
    border: "1px solid #fecaca",
    borderRadius: radius.md,
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  openSaleBtn: {
    minHeight: 40,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  historyCardBody: { display: "grid", gap: 8 },
  historyList: { display: "grid", gap: 6 },
  historyItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: 6,
  },
  emptyCard: { padding: 24 },
};
