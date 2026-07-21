import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, RefreshCw } from "lucide-react";
import { obtenerPedidoCompraSugerido } from "../services/stockService";
import { cambiarReponerStockVariante } from "../services/catalogoService";
import {
  cambiarEstadoPedidoCompra,
  crearPedidoCompra,
  listarPedidosCompra,
  obtenerPedidoCompra,
  recibirPedidoCompra,
} from "../services/pedidosCompraService";
import { listarSucursalesArmado } from "../services/armadoService";
import { formatDate, formatMoney, formatNumber } from "../utils/formatters";
import { esVarianteUnica } from "../utils/productPresentation";
import { Button, Card, PageHeader } from "../components/ui";
import { colors, radius, shadows, spacing, typography } from "../theme";
import { useSession } from "../context/SessionContext";

export default function PedidoCompraSugeridoPage() {
  const { usuarioId } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [umbral, setUmbral] = useState(2);
  const [query, setQuery] = useState("");
  const [cantidades, setCantidades] = useState({});
  const [omitidos, setOmitidos] = useState(() => new Set());
  const [procesando, setProcesando] = useState("");
  const [copiado, setCopiado] = useState("");
  const [pedidos, setPedidos] = useState([]);
  const [observaciones, setObservaciones] = useState({});
  const [sucursales, setSucursales] = useState([]);
  const [recepcionPedido, setRecepcionPedido] = useState(null);
  const [recepcionItems, setRecepcionItems] = useState({});
  const [recepcionObservaciones, setRecepcionObservaciones] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const respuesta = await obtenerPedidoCompraSugerido({
        q: query.trim() || undefined,
        stock_bajo_umbral: umbral,
      });
      setData(respuesta);
      setCantidades((actuales) => {
        const siguientes = { ...actuales };
        for (const proveedor of respuesta.proveedores || []) {
          for (const item of proveedor.items || []) {
            if (siguientes[item.variante_id] === undefined) {
              siguientes[item.variante_id] = String(Number(item.cantidad_sugerida || 1));
            }
          }
        }
        return siguientes;
      });
    } catch (err) {
      setError(err.message || "No se pudo armar el pedido sugerido");
    } finally {
      setLoading(false);
    }
  }

  async function cargarPedidos() {
    try {
      const respuesta = await listarPedidosCompra({ limit: 50 });
      setPedidos(Array.isArray(respuesta) ? respuesta : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los pedidos guardados");
    }
  }

  async function cargarSucursales() {
    try {
      const respuesta = await listarSucursalesArmado();
      setSucursales(Array.isArray(respuesta) ? respuesta : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las sucursales");
    }
  }

  useEffect(() => {
    cargar();
    cargarPedidos();
    cargarSucursales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumenVisible = useMemo(() => {
    let items = 0;
    let cantidad = 0;
    for (const proveedor of data?.proveedores || []) {
      for (const item of proveedor.items || []) {
        if (omitidos.has(String(item.variante_id))) continue;
        items += 1;
        cantidad += Number(cantidades[item.variante_id] || item.cantidad_sugerida || 0);
      }
    }
    return { items, cantidad };
  }, [data, cantidades, omitidos]);

  function actualizarCantidad(varianteId, value) {
    const limpio = String(value).replace(",", ".").replace(/[^0-9.]/g, "");
    setCantidades((actuales) => ({ ...actuales, [varianteId]: limpio }));
  }

  function toggleOmitido(varianteId) {
    setOmitidos((actuales) => {
      const siguiente = new Set(actuales);
      const clave = String(varianteId);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  async function marcarNoReponer(item) {
    const ok = window.confirm(
      `¿Marcar "${nombreItem(item)}" como no reponer?\n\nVa a salir de alertas y pedidos sugeridos, pero no cambia stock ni ventas.`
    );
    if (!ok) return;

    setProcesando(String(item.variante_id));
    setError("");
    try {
      await cambiarReponerStockVariante(item.variante_id, {
        reponer_stock: false,
        id_usuario: usuarioId,
      });
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo cambiar la reposición");
    } finally {
      setProcesando("");
    }
  }

  async function copiarProveedor(proveedor) {
    const texto = textoPedidoProveedor(proveedor, cantidades, omitidos);
    if (!texto.trim()) return;

    await navigator.clipboard.writeText(texto);
    setCopiado(proveedor.proveedor_nombre);
    window.setTimeout(() => setCopiado(""), 1800);
  }

  async function guardarBorradorProveedor(proveedor) {
    const items = proveedor.items
      .filter((item) => !omitidos.has(String(item.variante_id)))
      .map((item) => ({
        id_variante: item.variante_id,
        producto_nombre: item.producto_nombre,
        nombre_variante: item.nombre_variante,
        sku: item.sku,
        codigo_proveedor: item.codigo_proveedor,
        stock_disponible_al_crear: item.stock_disponible,
        cantidad_sugerida: item.cantidad_sugerida,
        cantidad_pedida: Number(cantidades[item.variante_id] || item.cantidad_sugerida || 0),
      }))
      .filter((item) => item.cantidad_pedida > 0);

    if (items.length === 0) {
      setError("No hay ítems incluidos para guardar este pedido");
      return;
    }

    setProcesando(`guardar-${proveedor.id_proveedor ?? "sin-proveedor"}`);
    setError("");
    try {
      await crearPedidoCompra({
        id_proveedor: proveedor.id_proveedor,
        proveedor_nombre: proveedor.proveedor_nombre,
        observaciones: observaciones[proveedor.id_proveedor ?? "sin-proveedor"] || null,
        id_usuario: usuarioId,
        items,
      });
      await cargarPedidos();
    } catch (err) {
      setError(err.message || "No se pudo guardar el pedido");
    } finally {
      setProcesando("");
    }
  }

  async function cambiarEstadoPedido(pedido, estado) {
    const ok = window.confirm(`¿Cambiar pedido #${pedido.id} a ${labelEstado(estado)}?`);
    if (!ok) return;

    setProcesando(`estado-${pedido.id}`);
    setError("");
    try {
      await cambiarEstadoPedidoCompra(pedido.id, {
        estado,
        id_usuario: usuarioId,
      });
      await cargarPedidos();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado del pedido");
    } finally {
      setProcesando("");
    }
  }

  async function abrirRecepcion(pedido) {
    setProcesando(`detalle-${pedido.id}`);
    setError("");
    try {
      const detalle = await obtenerPedidoCompra(pedido.id);
      const sucursalDefault = sucursales[0]?.id ? String(sucursales[0].id) : "";
      const form = {};
      for (const item of detalle.items || []) {
        const pendiente = Math.max(0, Number(item.cantidad_pedida || 0) - Number(item.cantidad_recibida || 0));
        form[item.id] = {
          id_sucursal: sucursalDefault,
          cantidad_recibida: pendiente > 0 ? String(pendiente) : "",
          costo_unitario: "",
          gastos_adicionales: "0",
          observacion: "",
        };
      }
      setRecepcionPedido(detalle);
      setRecepcionItems(form);
      setRecepcionObservaciones("");
    } catch (err) {
      setError(err.message || "No se pudo abrir la recepción del pedido");
    } finally {
      setProcesando("");
    }
  }

  function actualizarRecepcionItem(itemId, campo, value) {
    const limpio = ["cantidad_recibida", "costo_unitario", "gastos_adicionales"].includes(campo)
      ? String(value).replace(",", ".").replace(/[^0-9.]/g, "")
      : value;
    setRecepcionItems((actuales) => ({
      ...actuales,
      [itemId]: {
        ...(actuales[itemId] || {}),
        [campo]: limpio,
      },
    }));
  }

  async function confirmarRecepcion(e) {
    e.preventDefault();
    if (!recepcionPedido) return;

    const items = (recepcionPedido.items || [])
      .map((item) => {
        const form = recepcionItems[item.id] || {};
        return {
          id_item: item.id,
          id_sucursal: Number(form.id_sucursal || 0),
          cantidad_recibida: Number(form.cantidad_recibida || 0),
          costo_unitario: Number(form.costo_unitario || 0),
          gastos_adicionales: Number(form.gastos_adicionales || 0),
          observacion: form.observacion || null,
        };
      })
      .filter((item) => item.cantidad_recibida > 0);

    if (items.length === 0) {
      setError("Cargá al menos una cantidad recibida");
      return;
    }

    if (items.some((item) => !item.id_sucursal)) {
      setError("Elegí sucursal para todos los ítems recibidos");
      return;
    }

    const sinCosto = items.find((item) => item.costo_unitario <= 0);
    if (sinCosto) {
      setError("Cargá costo unitario mayor a 0 para cada ítem recibido");
      return;
    }

    const ok = window.confirm(`¿Confirmás la recepción del pedido #${recepcionPedido.id}? Esto genera ingreso real de stock.`);
    if (!ok) return;

    setProcesando(`recibir-${recepcionPedido.id}`);
    setError("");
    try {
      await recibirPedidoCompra(recepcionPedido.id, {
        observaciones: recepcionObservaciones || null,
        id_usuario: usuarioId,
        items,
      });
      setRecepcionPedido(null);
      setRecepcionItems({});
      setRecepcionObservaciones("");
      await Promise.all([cargarPedidos(), cargar()]);
    } catch (err) {
      setError(err.message || "No se pudo registrar la recepción");
    } finally {
      setProcesando("");
    }
  }

  return (
    <div style={styles.page}>
      <style>{responsiveCss}</style>
      <PageHeader
        title="Pedido de compra sugerido"
        subtitle="Agrupado por proveedor. No afecta stock: sirve para armar, ajustar y copiar el pedido."
        actions={
          <>
            <Button type="button" variant="outline" onClick={cargar} disabled={loading}>
              <RefreshCw size={16} /> Actualizar
            </Button>
          </>
        }
      />

      {error && <div style={styles.error}>{error}</div>}

      <Card style={styles.filtersCard} bodyStyle={{ padding: 0 }}>
        <div style={styles.filtersBody} data-pedido-filters="true">
          <label style={styles.field}>
            <span>Buscar</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") cargar();
              }}
              placeholder="Producto, SKU, proveedor, categoría..."
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span>Umbral stock bajo</span>
            <input
              type="number"
              min="0"
              value={umbral}
              onChange={(e) => setUmbral(e.target.value)}
              style={styles.input}
            />
          </label>
          <Button type="button" onClick={cargar} disabled={loading}>
            Buscar sugeridos
          </Button>
        </div>
      </Card>

      <section style={styles.metrics} data-pedido-metrics="true">
        <Metric label="Proveedores" value={data?.total_proveedores || 0} />
        <Metric label="Ítems sugeridos" value={data?.total_items || 0} />
        <Metric label="Ítems a pedir" value={resumenVisible.items} />
        <Metric label="Unidades editadas" value={formatNumber(resumenVisible.cantidad)} />
      </section>

      {loading ? (
        <Card>
          <div style={styles.empty}>Armando pedido sugerido...</div>
        </Card>
      ) : data?.proveedores?.length ? (
        <div style={styles.providers}>
          {data.proveedores.map((proveedor) => (
            <ProveedorPedido
              key={proveedor.id_proveedor ?? "sin-proveedor"}
              proveedor={proveedor}
              cantidades={cantidades}
              omitidos={omitidos}
              procesando={procesando}
              copiado={copiado === proveedor.proveedor_nombre}
              onCantidad={actualizarCantidad}
              onOmitir={toggleOmitido}
              onNoReponer={marcarNoReponer}
              onCopiar={() => copiarProveedor(proveedor)}
              onGuardar={() => guardarBorradorProveedor(proveedor)}
              observacion={observaciones[proveedor.id_proveedor ?? "sin-proveedor"] || ""}
              onObservacion={(value) =>
                setObservaciones((actuales) => ({
                  ...actuales,
                  [proveedor.id_proveedor ?? "sin-proveedor"]: value,
                }))
              }
            />
          ))}
        </div>
      ) : (
        <Card>
          <div style={styles.empty}>
            No hay productos reponibles con stock bajo para los filtros actuales.
          </div>
        </Card>
      )}

      <Card
        title="Pedidos guardados"
        subtitle="Borradores y pedidos enviados. No reciben stock todavía: eso queda para la próxima fase."
        actions={
          <Button type="button" variant="outline" onClick={cargarPedidos}>
            <RefreshCw size={16} /> Actualizar
          </Button>
        }
        bodyStyle={styles.savedBody}
      >
        {pedidos.length === 0 ? (
          <div style={styles.empty}>Todavía no hay pedidos guardados.</div>
        ) : (
          <div style={styles.savedList}>
            {pedidos.map((pedido) => (
              <article key={pedido.id} data-pedido-saved-row="true" style={styles.savedRow}>
                <div style={styles.savedMain}>
                  <strong>Pedido #{pedido.id} · {pedido.proveedor_nombre_snapshot}</strong>
                  <span>
                    {formatDate(pedido.fecha_creacion)} · {pedido.total_items} ítem(s) · {formatNumber(pedido.cantidad_total_pedida)} unidad(es)
                  </span>
                  {pedido.observaciones && <small>{pedido.observaciones}</small>}
                </div>
                <span style={{ ...styles.estadoPill, ...estadoStyle(pedido.estado) }}>
                  {labelEstado(pedido.estado)}
                </span>
                <div style={styles.savedActions}>
                  {pedido.estado === "borrador" && (
                    <button
                      type="button"
                      style={styles.ghostButton}
                      disabled={procesando === `estado-${pedido.id}`}
                      onClick={() => cambiarEstadoPedido(pedido, "enviado")}
                    >
                      Marcar enviado
                    </button>
                  )}
                  {pedido.estado === "enviado" && (
                    <button
                      type="button"
                      style={styles.ghostButton}
                      disabled={procesando === `estado-${pedido.id}`}
                      onClick={() => cambiarEstadoPedido(pedido, "recibido_parcial")}
                    >
                      Recibido parcial
                    </button>
                  )}
                  {pedido.estado !== "cerrado" && (
                    <>
                      {(pedido.estado === "enviado" || pedido.estado === "recibido_parcial") && (
                        <button
                          type="button"
                          style={styles.primaryMiniButton}
                          disabled={procesando === `detalle-${pedido.id}`}
                          onClick={() => abrirRecepcion(pedido)}
                        >
                          Recibir
                        </button>
                      )}
                    </>
                  )}
                  {pedido.estado !== "cerrado" && (
                    <button
                      type="button"
                      style={styles.ghostButton}
                      disabled={procesando === `estado-${pedido.id}`}
                      onClick={() => cambiarEstadoPedido(pedido, "cerrado")}
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {recepcionPedido && (
        <RecepcionPedidoPanel
          pedido={recepcionPedido}
          itemsForm={recepcionItems}
          sucursales={sucursales}
          observaciones={recepcionObservaciones}
          procesando={procesando === `recibir-${recepcionPedido.id}`}
          onChangeItem={actualizarRecepcionItem}
          onObservaciones={setRecepcionObservaciones}
          onClose={() => setRecepcionPedido(null)}
          onSubmit={confirmarRecepcion}
        />
      )}
    </div>
  );
}

function RecepcionPedidoPanel({
  pedido,
  itemsForm,
  sucursales,
  observaciones,
  procesando,
  onChangeItem,
  onObservaciones,
  onClose,
  onSubmit,
}) {
  return (
    <div style={styles.modalBackdrop} role="dialog" aria-modal="true">
      <form style={styles.receptionPanel} onSubmit={onSubmit}>
        <div style={styles.receptionHeader}>
          <div>
            <p style={styles.eyebrow}>Recepción de mercadería</p>
            <h2 style={styles.receptionTitle}>Pedido #{pedido.id}</h2>
            <span style={styles.receptionSubtitle}>{pedido.proveedor_nombre_snapshot}</span>
          </div>
          <button type="button" style={styles.ghostButton} onClick={onClose} disabled={procesando}>
            Cerrar
          </button>
        </div>

        <div style={styles.receptionRows}>
          {(pedido.items || []).map((item) => {
            const pendiente = Math.max(0, Number(item.cantidad_pedida || 0) - Number(item.cantidad_recibida || 0));
            const form = itemsForm[item.id] || {};
            return (
              <article key={item.id} data-pedido-reception-row="true" style={styles.receptionRow}>
                <div style={styles.receptionItemMain}>
                  <strong>{nombreSnapshotItem(item)}</strong>
                  <span>
                    Pedido {formatNumber(item.cantidad_pedida)} · Recibido {formatNumber(item.cantidad_recibida)} · Pendiente {formatNumber(pendiente)}
                  </span>
                  <small>SKU {item.sku_snapshot || "-"} · Prov {item.codigo_proveedor_snapshot || "-"}</small>
                </div>
                <label style={styles.field}>
                  <span>Sucursal</span>
                  <select
                    value={form.id_sucursal || ""}
                    onChange={(e) => onChangeItem(item.id, "id_sucursal", e.target.value)}
                    style={styles.input}
                    disabled={pendiente <= 0 || procesando}
                  >
                    <option value="">Elegir</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.field}>
                  <span>Recibido</span>
                  <input
                    value={form.cantidad_recibida || ""}
                    onChange={(e) => onChangeItem(item.id, "cantidad_recibida", e.target.value)}
                    inputMode="decimal"
                    disabled={pendiente <= 0 || procesando}
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span>Costo unitario</span>
                  <input
                    value={form.costo_unitario || ""}
                    onChange={(e) => onChangeItem(item.id, "costo_unitario", e.target.value)}
                    inputMode="decimal"
                    placeholder="$"
                    disabled={pendiente <= 0 || procesando}
                    style={styles.input}
                  />
                </label>
                <label style={styles.field}>
                  <span>Gastos extra</span>
                  <input
                    value={form.gastos_adicionales || "0"}
                    onChange={(e) => onChangeItem(item.id, "gastos_adicionales", e.target.value)}
                    inputMode="decimal"
                    disabled={pendiente <= 0 || procesando}
                    style={styles.input}
                  />
                </label>
                <div style={styles.receptionTotal}>
                  <span>Total productos</span>
                  <strong>
                    {formatMoney(Number(form.cantidad_recibida || 0) * Number(form.costo_unitario || 0))}
                  </strong>
                </div>
              </article>
            );
          })}
        </div>

        <label style={styles.field}>
          <span>Observaciones de recepción</span>
          <textarea
            value={observaciones}
            onChange={(e) => onObservaciones(e.target.value)}
            placeholder="Ej: llegó parcial, proveedor cambió costo, descuento aplicado..."
            style={{ ...styles.input, minHeight: 76, paddingTop: 10 }}
            disabled={procesando}
          />
        </label>

        <div style={styles.receptionFooter}>
          <button type="button" style={styles.ghostButton} onClick={onClose} disabled={procesando}>
            Cancelar
          </button>
          <Button type="submit" disabled={procesando}>
            Confirmar recepción
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProveedorPedido({
  proveedor,
  cantidades,
  omitidos,
  procesando,
  copiado,
  onCantidad,
  onOmitir,
  onNoReponer,
  onCopiar,
  onGuardar,
  observacion,
  onObservacion,
}) {
  const visibles = proveedor.items.filter((item) => !omitidos.has(String(item.variante_id)));
  const cantidadTotal = visibles.reduce(
    (total, item) => total + Number(cantidades[item.variante_id] || item.cantidad_sugerida || 0),
    0
  );
  const grupos = agruparItemsPedido(proveedor.items);

  return (
    <Card
      title={proveedor.proveedor_nombre}
      subtitle={`${visibles.length} de ${proveedor.items.length} ítem(s) incluidos · ${formatNumber(cantidadTotal)} unidad(es)`}
      actions={
        <div style={styles.cardActions}>
          <Button type="button" variant="outline" onClick={onCopiar} disabled={visibles.length === 0}>
            <ClipboardCopy size={16} /> {copiado ? "Copiado" : "Copiar pedido"}
          </Button>
          <Button type="button" onClick={onGuardar} disabled={visibles.length === 0 || String(procesando).startsWith("guardar-")}>
            Guardar borrador
          </Button>
        </div>
      }
      bodyStyle={styles.providerBody}
    >
      <div style={styles.providerNotes}>
        <input
          value={observacion}
          onChange={(e) => onObservacion(e.target.value)}
          placeholder="Observaciones para este pedido. Ej: pedir por WhatsApp, consultar precio, urgente..."
          style={styles.input}
        />
      </div>
      <div style={styles.items}>
        {grupos.map((grupo) => (
          <section key={grupo.key} style={styles.itemGroup}>
            <div style={styles.itemGroupHeader}>
              <strong>{grupo.titulo}</strong>
              <span>{grupo.items.length} ítem(s)</span>
            </div>
            {grupo.items.map((item) => {
              const omitido = omitidos.has(String(item.variante_id));
              return (
                <article
                  key={item.variante_id}
                  data-pedido-row="true"
                  style={{
                    ...styles.itemRow,
                    ...(omitido ? styles.itemRowMuted : {}),
                  }}
                >
                  <div style={styles.itemMain}>
                    <strong style={styles.itemName}>{nombreItem(item)}</strong>
                    <div style={styles.itemMeta}>
                      {item.marca_nombre || "Sin marca"} · {item.categoria_nombre || "Sin categoría"} · SKU {item.sku || "-"} · Prov {item.codigo_proveedor || "-"}
                    </div>
                    <div style={styles.itemReason}>{item.motivo}</div>
                  </div>

                  <Mini label="Disponible" value={formatNumber(item.stock_disponible)} />
                  <Mini label="Vendidas" value={formatNumber(item.unidades_vendidas_total || 0)} />
                  <Mini label="Última venta" value={formatDate(item.ultima_venta)} />

                  <label style={styles.qtyField}>
                    <span>Pedir</span>
                    <input
                      value={cantidades[item.variante_id] ?? String(Number(item.cantidad_sugerida || 1))}
                      onChange={(e) => onCantidad(item.variante_id, e.target.value)}
                      disabled={omitido}
                      inputMode="decimal"
                      style={styles.qtyInput}
                    />
                  </label>

                  <div style={styles.actions}>
                    <button type="button" style={styles.ghostButton} onClick={() => onOmitir(item.variante_id)}>
                      {omitido ? "Incluir" : "Omitir"}
                    </button>
                    <button
                      type="button"
                      style={styles.dangerButton}
                      disabled={procesando === String(item.variante_id)}
                      onClick={() => onNoReponer(item)}
                    >
                      No reponer
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </Card>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={styles.mini}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function nombreItem(item) {
  if (esVarianteUnica(item.nombre_variante)) return item.producto_nombre;
  return `${item.producto_nombre} - ${item.nombre_variante || ""}`.trim();
}

function nombreSnapshotItem(item) {
  if (esVarianteUnica(item.variante_nombre_snapshot)) return item.producto_nombre_snapshot;
  return `${item.producto_nombre_snapshot} - ${item.variante_nombre_snapshot || ""}`.trim();
}

function textoPedidoProveedor(proveedor, cantidades, omitidos) {
  const lineas = [`Pedido ${proveedor.proveedor_nombre}`, ""];

  for (const grupo of agruparItemsPedido(proveedor.items || [])) {
    const items = grupo.items.filter((item) => {
      if (omitidos.has(String(item.variante_id))) return false;
      return Number(cantidades[item.variante_id] || item.cantidad_sugerida || 0) > 0;
    });
    if (items.length === 0) continue;
    lineas.push(grupo.titulo);
    for (const item of items) {
      const cantidad = Number(cantidades[item.variante_id] || item.cantidad_sugerida || 0);
      const codigo = item.codigo_proveedor || item.sku || `VAR-${item.variante_id}`;
      lineas.push(`- ${nombreItem(item)} x${formatNumber(cantidad)} (${codigo})`);
    }
    lineas.push("");
  }

  return lineas.join("\n");
}

function agruparItemsPedido(items = []) {
  const comunes = [];
  const bicicletas = [];
  for (const item of items) {
    if (esBicicletaPedido(item)) bicicletas.push(item);
    else comunes.push(item);
  }

  return [
    { key: "comunes", titulo: "Repuestos, accesorios y otros", items: comunes },
    { key: "bicicletas", titulo: "Bicicletas", items: bicicletas },
  ].filter((grupo) => grupo.items.length > 0);
}

function esBicicletaPedido(item) {
  if (item.tipo_operativo === "bicicleta") return true;
  if (item.serializable === true) return true;
  const categoria = String(item.categoria_nombre || "").toLowerCase();
  const producto = String(item.producto_nombre || "").toLowerCase();
  return categoria.includes("bicicleta") || producto.includes("bicicleta");
}

function labelEstado(estado) {
  const labels = {
    borrador: "Borrador",
    enviado: "Enviado",
    recibido_parcial: "Recibido parcial",
    cerrado: "Cerrado",
  };
  return labels[estado] || estado;
}

function estadoStyle(estado) {
  if (estado === "cerrado") return { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" };
  if (estado === "recibido_parcial") return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  if (estado === "enviado") return { background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" };
  return { background: "#f8fafc", color: "#334155", borderColor: "#cbd5e1" };
}

const styles = {
  page: {
    display: "grid",
    gap: spacing.lg,
  },
  error: {
    padding: 14,
    borderRadius: radius.md,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 800,
  },
  filtersCard: {
    overflow: "visible",
  },
  filtersBody: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1fr) 180px auto",
    gap: spacing.md,
    alignItems: "end",
  },
  field: {
    display: "grid",
    gap: 6,
    color: colors.textMuted,
    fontSize: typography.small.fontSize,
    fontWeight: 850,
  },
  input: {
    minHeight: 42,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    padding: "0 12px",
    fontSize: 15,
    fontWeight: 750,
    color: colors.text,
    background: colors.surface,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: spacing.md,
  },
  metric: {
    background: colors.surface,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    padding: spacing.lg,
    display: "grid",
    gap: 6,
  },
  providers: {
    display: "grid",
    gap: spacing.lg,
  },
  cardActions: {
    display: "flex",
    gap: spacing.sm,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  providerNotes: {
    padding: spacing.md,
    borderBottom: `1px solid ${colors.borderSoft}`,
    background: "#f8fafc",
  },
  providerBody: {
    padding: 0,
  },
  savedBody: {
    padding: 0,
  },
  savedList: {
    display: "grid",
  },
  savedRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) auto auto",
    gap: spacing.md,
    alignItems: "center",
    padding: spacing.md,
    borderBottom: `1px solid ${colors.borderSoft}`,
  },
  savedMain: {
    display: "grid",
    gap: 4,
    color: colors.textMuted,
    fontSize: 13,
  },
  estadoPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    borderRadius: radius.full,
    border: "1px solid transparent",
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  savedActions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  items: {
    display: "grid",
  },
  itemGroup: {
    display: "grid",
    borderBottom: `1px solid ${colors.borderSoft}`,
  },
  itemGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    padding: "12px 14px",
    background: "#f8fafc",
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 100px 100px 120px 110px 190px",
    gap: spacing.md,
    alignItems: "center",
    padding: spacing.md,
    borderBottom: `1px solid ${colors.borderSoft}`,
    background: colors.surface,
  },
  itemRowMuted: {
    opacity: 0.5,
    background: "#f8fafc",
  },
  itemMain: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  itemName: {
    color: colors.textStrong,
    fontSize: 15,
    lineHeight: 1.25,
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 1.35,
  },
  itemReason: {
    color: "#9a3412",
    fontSize: 12,
    lineHeight: 1.35,
  },
  mini: {
    display: "grid",
    gap: 4,
    fontSize: 12,
    color: colors.textMuted,
  },
  qtyField: {
    display: "grid",
    gap: 4,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: 850,
  },
  qtyInput: {
    minHeight: 38,
    width: "100%",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    padding: "0 10px",
    fontSize: 16,
    fontWeight: 900,
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  ghostButton: {
    minHeight: 36,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    padding: "0 10px",
    fontWeight: 850,
    cursor: "pointer",
  },
  dangerButton: {
    minHeight: 36,
    borderRadius: radius.md,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    padding: "0 10px",
    fontWeight: 850,
    cursor: "pointer",
  },
  primaryMiniButton: {
    minHeight: 36,
    borderRadius: radius.md,
    border: "1px solid #fb923c",
    background: "#fff7ed",
    color: "#c2410c",
    padding: "0 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    background: "rgba(15, 23, 42, 0.45)",
    display: "grid",
    justifyItems: "end",
    padding: spacing.lg,
  },
  receptionPanel: {
    width: "min(980px, 100%)",
    maxHeight: "calc(100vh - 32px)",
    overflow: "auto",
    background: colors.surface,
    borderRadius: radius.xl,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.lg,
    padding: spacing.lg,
    display: "grid",
    gap: spacing.lg,
  },
  receptionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottom: `1px solid ${colors.borderSoft}`,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    margin: 0,
    color: "#f97316",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  receptionTitle: {
    margin: "4px 0",
    fontSize: 28,
    lineHeight: 1.1,
    color: colors.textStrong,
  },
  receptionSubtitle: {
    color: colors.textMuted,
    fontWeight: 850,
  },
  receptionRows: {
    display: "grid",
    gap: spacing.md,
  },
  receptionRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 150px 120px 150px 130px 130px",
    gap: spacing.md,
    alignItems: "end",
    padding: spacing.md,
    border: `1px solid ${colors.borderSoft}`,
    borderRadius: radius.lg,
    background: "#f8fafc",
  },
  receptionItemMain: {
    display: "grid",
    gap: 4,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 13,
  },
  receptionTotal: {
    display: "grid",
    gap: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 850,
  },
  receptionFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: spacing.sm,
    borderTop: `1px solid ${colors.borderSoft}`,
    paddingTop: spacing.md,
  },
  empty: {
    color: colors.textMuted,
    fontWeight: 850,
  },
};

const responsiveCss = `
@media (max-width: 1100px) {
  [data-pedido-row="true"] {
    grid-template-columns: minmax(240px, 1fr) 90px 90px 110px;
  }

  [data-pedido-saved-row="true"] {
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  [data-pedido-reception-row="true"] {
    grid-template-columns: 1fr 1fr 1fr !important;
  }
}

@media (max-width: 760px) {
  [data-pedido-filters="true"] {
    grid-template-columns: 1fr !important;
  }

  [data-pedido-metrics="true"] {
    grid-template-columns: 1fr 1fr !important;
  }

  [data-pedido-row="true"] {
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  [data-pedido-reception-row="true"] {
    grid-template-columns: 1fr !important;
  }
}
`;
