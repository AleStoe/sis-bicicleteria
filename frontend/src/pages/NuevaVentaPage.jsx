import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarVariantes } from "../services/catalogoService";
import { listarStock } from "../services/stockService";
import { listarClientes } from "../services/clientesService";
import { crearVenta } from "../services/ventasService";
import { formatMoney } from "./VentasListPage";

export default function NuevaVentaPage() {
  const navigate = useNavigate();
  const [variantes, setVariantes] = useState([]);
  const [stock, setStock] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState([]);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(1);
  const [observaciones, setObservaciones] = useState("");
  const [usarCredito, setUsarCredito] = useState(true);
  const [montoCredito, setMontoCredito] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      setError("");

      const [variantesData, stockData, clientesData] = await Promise.all([
        listarVariantes(),
        listarStock(),
        listarClientes({ solo_activos: true }),
      ]);

      setVariantes(variantesData || []);
      setStock(stockData || []);
      setClientes(clientesData || []);

      const consumidorFinal = (clientesData || []).find((c) => Number(c.id) === 1);
      if (consumidorFinal) {
        setClienteSeleccionadoId(1);
      } else if ((clientesData || []).length > 0) {
        setClienteSeleccionadoId(clientesData[0].id);
      }
    } catch (err) {
      setError(err.message || "Error al cargar datos para venta");
    } finally {
      setLoading(false);
    }
  }

  const stockMap = useMemo(() => {
    const map = {};
    for (const fila of stock || []) {
      const varianteId = fila.variante_id ?? fila.id_variante ?? fila.id;
      map[varianteId] = Number(fila.stock_disponible ?? fila.stock_fisico ?? 0);
    }
    return map;
  }, [stock]);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    const base = (variantes || []).map((v) => ({
      ...v,
      stock_disponible: Number(stockMap[v.id] ?? 0),
    }));

    const filtrados = q
      ? base.filter((v) =>
          [v.id, v.producto_nombre, v.nombre_variante, v.sku, v.codigo_proveedor]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : base;

    return filtrados.slice(0, 100);
  }, [busqueda, variantes, stockMap]);

  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.precio || 0) * Number(item.cantidad || 0), 0);
  }, [items]);

  function cantidadEnCarrito(idVariante) {
    return items
      .filter((i) => Number(i.id_variante) === Number(idVariante) && !i.id_bicicleta_serializada)
      .reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  }

  function agregarAlCarrito(variante) {
    const stockDisponible = Number(variante.stock_disponible ?? 0);
    const yaEnCarrito = cantidadEnCarrito(variante.id);

    if (stockDisponible <= 0) {
      setError(`No hay stock disponible para ${variante.producto_nombre || variante.nombre_variante}`);
      return;
    }

    if (yaEnCarrito >= stockDisponible) {
      setError(`No hay más stock disponible para ${variante.producto_nombre || variante.nombre_variante}`);
      return;
    }

    setError("");
    setMensaje("");

    setItems((prev) => {
      const existente = prev.find(
        (item) => Number(item.id_variante) === Number(variante.id) && !item.id_bicicleta_serializada
      );

      if (existente) {
        return prev.map((item) =>
          Number(item.id_variante) === Number(variante.id) && !item.id_bicicleta_serializada
            ? { ...item, cantidad: Number(item.cantidad) + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          id_variante: variante.id,
          producto_nombre: variante.producto_nombre,
          nombre_variante: variante.nombre_variante,
          sku: variante.sku,
          precio: Number(variante.precio_minorista || 0),
          cantidad: 1,
          id_bicicleta_serializada: "",
        },
      ];
    });
  }

  function cambiarCantidad(index, nuevaCantidad) {
    if (!Number.isFinite(nuevaCantidad) || nuevaCantidad < 1) return;

    const item = items[index];
    const stockDisponible = Number(stockMap[item.id_variante] ?? 0);

    if (item.id_bicicleta_serializada && nuevaCantidad !== 1) {
      setError("Un item serializado debe tener cantidad 1");
      return;
    }

    const otrasCantidades = items.reduce((acc, actual, i) => {
      if (i === index) return acc;
      if (Number(actual.id_variante) !== Number(item.id_variante)) return acc;
      if (actual.id_bicicleta_serializada) return acc;
      return acc + Number(actual.cantidad || 0);
    }, 0);

    if (nuevaCantidad + otrasCantidades > stockDisponible) {
      setError(`La cantidad supera el stock disponible de la variante ${item.id_variante}`);
      return;
    }

    setError("");
    setMensaje("");
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, cantidad: nuevaCantidad } : it)));
  }

  function cambiarSerializada(index, valor) {
    setError("");
    setMensaje("");
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              id_bicicleta_serializada: valor,
              cantidad: valor ? 1 : item.cantidad,
            }
          : item
      )
    );
  }

  function quitarItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setError("");
    setMensaje("");
  }

  function resetVenta() {
    setItems([]);
    setBusqueda("");
    setObservaciones("");
    setUsarCredito(true);
    setMontoCredito("");
    setClienteSeleccionadoId(clientes.some((c) => Number(c.id) === 1) ? 1 : clientes[0]?.id || "");
    setError("");
    setMensaje("");
  }

  function validarVenta() {
    if (!clienteSeleccionadoId) return "Seleccioná un cliente";
    if (items.length === 0) return "Agregá al menos un item";

    const serializadas = new Set();
    for (const item of items) {
      if (Number(item.cantidad) <= 0) return "Todas las cantidades deben ser mayores a cero";
      if (item.id_bicicleta_serializada) {
        if (Number(item.cantidad) !== 1) return "Los items serializados deben tener cantidad 1";
        if (serializadas.has(String(item.id_bicicleta_serializada))) {
          return "La misma bicicleta serializada no puede repetirse en la venta";
        }
        serializadas.add(String(item.id_bicicleta_serializada));
      }
    }

    if (montoCredito && Number(montoCredito) < 0) return "El monto de crédito no puede ser negativo";
    return null;
  }

  async function confirmarVenta() {
    const errorValidacion = validarVenta();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    const payload = {
      id_cliente: Number(clienteSeleccionadoId),
      id_sucursal: 1,
      id_usuario: 1,
      items: items.map((item) => ({
        id_variante: Number(item.id_variante),
        cantidad: Number(item.cantidad),
        ...(item.id_bicicleta_serializada
          ? { id_bicicleta_serializada: Number(item.id_bicicleta_serializada) }
          : {}),
      })),
      observaciones: observaciones.trim() || null,
      usar_credito: Boolean(usarCredito),
      monto_credito_a_aplicar: montoCredito === "" ? null : Number(montoCredito),
    };

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const venta = await crearVenta(payload);

      setMensaje(
        `Venta creada correctamente. ID: ${venta.venta_id}. Estado: ${venta.estado}. Saldo: ${formatMoney(venta.saldo_pendiente)}`
      );

      resetVenta();
      navigate(`/ventas/${venta.venta_id}?pagar=1`);
    } catch (err) {
      setError(err.message || "No se pudo crear la venta");
    } finally {
      setGuardando(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (guardando || items.length === 0) return;
      if (e.key === "F8") {
        e.preventDefault();
        confirmarVenta();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [guardando, items, clienteSeleccionadoId, observaciones, usarCredito, montoCredito]);

  if (loading) return <p style={{ padding: "24px" }}>Cargando datos...</p>;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Nueva venta</h1>
          <p style={mutedStyle}>Crea la venta. Los pagos se registran desde el módulo Pagos/Caja.</p>
        </div>
        <div style={actionsStyle}>
          <Link to="/ventas" style={linkBtnStyle}>Volver</Link>
        </div>
      </div>

      {mensaje && <div style={successStyle}>{mensaje}</div>}
      {error && <div style={alertStyle}>Error: {error}</div>}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>Productos</h2>
          <input
            type="text"
            placeholder="Buscar producto, variante, SKU o ID"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={inputStyle}
          />

          <div style={{ maxHeight: "65vh", overflowY: "auto", marginTop: "14px" }}>
            <table cellPadding="8" style={tableStyle}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Variante</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((v) => {
                  const stockDisponible = Number(v.stock_disponible ?? 0);
                  const yaEnCarrito = cantidadEnCarrito(v.id);
                  const sinStock = stockDisponible <= 0 || yaEnCarrito >= stockDisponible;

                  return (
                    <tr key={v.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={tdStyle}>#{v.id}</td>
                      <td style={tdStyle}>{v.producto_nombre}</td>
                      <td style={tdStyle}>{v.nombre_variante || "-"}</td>
                      <td style={tdStyle}>{formatMoney(v.precio_minorista)}</td>
                      <td style={{ ...tdStyle, fontWeight: stockDisponible <= 2 ? "bold" : "normal", color: stockDisponible <= 0 ? "#b42318" : stockDisponible <= 2 ? "#b26a00" : "inherit" }}>
                        {stockDisponible.toLocaleString("es-AR")}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => agregarAlCarrito(v)} disabled={guardando || sinStock}>
                          {sinStock ? "Sin stock" : "Agregar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Carrito</h2>

          <label style={fieldStyle}>
            <span style={labelStyle}>Cliente</span>
            <select value={clienteSeleccionadoId} onChange={(e) => setClienteSeleccionadoId(Number(e.target.value))} style={inputStyle}>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  #{cliente.id} - {cliente.nombre}{cliente.telefono ? ` (${cliente.telefono})` : ""}
                </option>
              ))}
            </select>
            <Link to="/clientes/nuevo" style={{ width: "fit-content", textDecoration: "none", fontWeight: "bold" }}>+ Nuevo cliente</Link>
          </label>

          {items.length === 0 ? (
            <p style={mutedStyle}>No hay items cargados.</p>
          ) : (
            <div style={{ maxHeight: "38vh", overflowY: "auto", marginTop: "14px" }}>
              <table cellPadding="8" style={{ ...tableStyle, minWidth: "720px" }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Cant.</th>
                    <th style={thStyle}>Serializada ID</th>
                    <th style={thStyle}>Subtotal</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item.id_variante}-${index}`} style={{ borderTop: "1px solid #eee" }}>
                      <td style={tdStyle}>
                        <strong>{item.producto_nombre}</strong>
                        <div style={mutedStyle}>{item.nombre_variante || `Variante #${item.id_variante}`}</div>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.cantidad}
                          onChange={(e) => cambiarCantidad(index, Number(e.target.value))}
                          style={{ ...inputStyle, width: "80px" }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="1"
                          placeholder="Opcional"
                          value={item.id_bicicleta_serializada}
                          onChange={(e) => cambiarSerializada(index, e.target.value)}
                          style={{ ...inputStyle, width: "130px" }}
                        />
                      </td>
                      <td style={tdStyle}>{formatMoney(Number(item.precio) * Number(item.cantidad))}</td>
                      <td style={tdStyle}><button onClick={() => quitarItem(index)}>Quitar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={totalStyle}>TOTAL {formatMoney(total)}</div>

          <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
            <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="checkbox" checked={usarCredito} onChange={(e) => setUsarCredito(e.target.checked)} />
              Usar crédito disponible del cliente
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Monto máximo de crédito a aplicar</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={montoCredito}
                onChange={(e) => setMontoCredito(e.target.value)}
                placeholder="Vacío = usar disponible según backend"
                disabled={!usarCredito}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Observaciones</span>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
            <button onClick={confirmarVenta} disabled={guardando || items.length === 0} style={primaryBtnStyle}>
              {guardando ? "Creando..." : "Crear venta (F8)"}
            </button>
            <button onClick={resetVenta} disabled={guardando}>Limpiar venta</button>
          </div>

          <div style={noteStyle}>
            Esta pantalla ya no crea pagos automáticamente. Eso evita mezclar ventas con caja/pagos y respeta la separación actual del backend.
          </div>
        </aside>
      </div>
    </div>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" };
const actionsStyle = { display: "flex", gap: "10px", flexWrap: "wrap" };
const mutedStyle = { margin: "6px 0 0", color: "#667085" };
const gridStyle = { display: "grid", gridTemplateColumns: "minmax(520px, 1.2fr) minmax(420px, 0.8fr)", gap: "16px", alignItems: "start" };
const cardStyle = { background: "white", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "16px" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", fontSize: "15px", boxSizing: "border-box" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const linkBtnStyle = { textDecoration: "none", padding: "8px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", color: "#111827", background: "white" };
const alertStyle = { background: "#fff1f0", color: "#b42318", padding: "12px", borderRadius: "10px", border: "1px solid #f4c7c3", marginBottom: "16px" };
const successStyle = { background: "#e8fff0", color: "#146c2e", padding: "12px", borderRadius: "10px", border: "1px solid #b7ebc6", marginBottom: "16px" };
const noteStyle = { background: "#f9fafb", borderLeft: "4px solid #111827", padding: "12px", borderRadius: "8px", color: "#344054", marginTop: "14px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "760px" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb" };
const tdStyle = { padding: "10px", verticalAlign: "top" };
const totalStyle = { fontSize: "36px", fontWeight: "bold", marginTop: "14px", background: "#111827", color: "white", padding: "18px", textAlign: "center", borderRadius: "12px" };
const primaryBtnStyle = { width: "100%", padding: "16px", fontSize: "18px", fontWeight: "bold", borderRadius: "10px", cursor: "pointer" };
