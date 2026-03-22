import { useEffect, useMemo, useState } from "react";
import { listarVariantes } from "../services/catalogoService";
import { listarStock } from "../services/stockService";
import { crearVenta, crearPago, entregarVenta } from "../services/ventasService";
import { Link } from "react-router-dom";
import { listarClientes } from "../services/clientesService";

const MEDIOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "tarjeta", label: "Tarjeta" },
];

export default function NuevaVentaPage() {
  const [variantes, setVariantes] = useState([]);
  const [stock, setStock] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState([]);
  const [pagos, setPagos] = useState([{ medio_pago: "efectivo", monto: "" }]);
  const [modoMixto, setModoMixto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(1);

  async function cargarDatos() {
    try {
      setLoading(true);
      setError("");

      const [variantesData, stockData, clientesData] = await Promise.all([
        listarVariantes(),
        listarStock(),
        listarClientes({ solo_activos: true }),
      ]);

      setVariantes(variantesData);
      setStock(stockData);
      setClientes(clientesData);

      const existeConsumidorFinal = clientesData.some((c) => c.id === 1);
      if (existeConsumidorFinal) {
        setClienteSeleccionadoId(1);
      } else if (clientesData.length > 0) {
        setClienteSeleccionadoId(clientesData[0].id);
      }
    } catch (err) {
      setError(err.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  const stockMap = useMemo(() => {
    const map = {};

    for (const fila of stock) {
      map[fila.variante_id] = Number(fila.stock_disponible ?? 0);
    }

    return map;
  }, [stock]);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    const base = variantes.map((v) => ({
      ...v,
      stock_disponible: Number(stockMap[v.id] ?? 0),
    }));

    if (!q) return base;

    return base.filter((v) => {
      const texto = [v.producto_nombre, v.nombre_variante, v.sku]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [busqueda, variantes, stockMap]);

  function cantidadEnCarrito(idVariante) {
    const item = items.find((i) => i.id_variante === idVariante);
    return item ? item.cantidad : 0;
  }

  function agregarAlCarrito(variante) {
    const stockDisponible = Number(variante.stock_disponible ?? 0);
    const yaEnCarrito = cantidadEnCarrito(variante.id);

    if (yaEnCarrito >= stockDisponible) {
      setError(`No hay más stock disponible para ${variante.nombre_variante}`);
      return;
    }

    setError("");
    setMensaje("");

    setItems((prev) => {
      const existente = prev.find((item) => item.id_variante === variante.id);

      if (existente) {
        return prev.map((item) =>
          item.id_variante === variante.id
            ? { ...item, cantidad: item.cantidad + 1 }
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
          precio: Number(variante.precio_minorista),
          cantidad: 1,
        },
      ];
    });
  }

  function cambiarCantidad(idVariante, nuevaCantidad) {
    if (!Number.isFinite(nuevaCantidad) || nuevaCantidad < 1) return;

    const stockDisponible = Number(stockMap[idVariante] ?? 0);

    if (nuevaCantidad > stockDisponible) {
      setError(`La cantidad supera el stock disponible de la variante ${idVariante}`);
      return;
    }

    setError("");
    setMensaje("");

    setItems((prev) =>
      prev.map((item) =>
        item.id_variante === idVariante
          ? { ...item, cantidad: nuevaCantidad }
          : item
      )
    );
  }

  function quitarItem(idVariante) {
    setItems((prev) => prev.filter((item) => item.id_variante !== idVariante));
    setError("");
    setMensaje("");
  }

  function agregarPago() {
    setPagos((prev) => [...prev, { medio_pago: "efectivo", monto: "" }]);
  }

  function cambiarPago(index, campo, valor) {
    setPagos((prev) =>
      prev.map((pago, i) =>
        i === index ? { ...pago, [campo]: valor } : pago
      )
    );
  }

  function quitarPago(index) {
    setPagos((prev) => prev.filter((_, i) => i !== index));
  }

  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  }, [items]);

  const totalPagado = useMemo(() => {
    return pagos.reduce((acc, pago) => acc + Number(pago.monto || 0), 0);
  }, [pagos]);

  const restante = useMemo(() => {
    return total - totalPagado;
  }, [total, totalPagado]);

  function resetVenta() {
    setItems([]);
    setBusqueda("");
    setPagos([{ medio_pago: "efectivo", monto: "" }]);
    setModoMixto(false);
    setClienteSeleccionadoId(1);
    setError("");
    setMensaje("");
  }

  async function ejecutarVentaConPagos(pagosFinales) {
    if (!clienteSeleccionadoId) {
      throw new Error("Seleccioná un cliente antes de continuar");
    }
    const payloadVenta = {
      id_cliente: Number(clienteSeleccionadoId),
      id_sucursal: 1,
      id_usuario: 1,
      items: items.map((item) => ({
        id_variante: item.id_variante,
        cantidad: item.cantidad,
      })),
    };
    if (restante > 0 && Number(clienteSeleccionadoId) === 1) {
        throw new Error(
          "Para ventas con saldo pendiente debés seleccionar un cliente real"
        );
      }
    const venta = await crearVenta(payloadVenta);

    for (const pago of pagosFinales) {
      await crearPago({
        venta_id: venta.venta_id,
        medio_pago: pago.medio_pago,
        monto: Number(pago.monto),
        id_usuario: 1,
      });
    }

    await entregarVenta(venta.venta_id, {
      id_usuario: 1,
    });

    setMensaje(`Venta cobrada y entregada correctamente. ID: ${venta.venta_id}`);
    resetVenta();
    await cargarDatos();
  }

  async function cobrarRapido(medioPago) {
    setError("");
    setMensaje("");

    if (items.length === 0) {
      setError("Agregá al menos un producto al carrito");
      return;
    }

    try {
      setGuardando(true);

      await ejecutarVentaConPagos([
        {
          medio_pago: medioPago,
          monto: total,
        },
      ]);
    } catch (err) {
      setError(err.message || "No se pudo completar la venta");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarVentaMixta() {
    setError("");
    setMensaje("");

    if (items.length === 0) {
      setError("Agregá al menos un producto al carrito");
      return;
    }

    const pagosValidos = pagos.filter((p) => Number(p.monto) > 0);

    if (pagosValidos.length === 0) {
      setError("Agregá al menos un pago");
      return;
    }

    if (restante !== 0) {
      setError("La suma de los pagos debe coincidir exactamente con el total");
      return;
    }

    try {
      setGuardando(true);
      await ejecutarVentaConPagos(pagosValidos);
    } catch (err) {
      setError(err.message || "No se pudo completar la venta");
    } finally {
      setGuardando(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (guardando || items.length === 0 || modoMixto) return;

      if (e.key === "F1") {
        e.preventDefault();
        cobrarRapido("efectivo");
      }

      if (e.key === "F2") {
        e.preventDefault();
        cobrarRapido("transferencia");
      }

      if (e.key === "F3") {
        e.preventDefault();
        cobrarRapido("mercadopago");
      }

      if (e.key === "F4") {
        e.preventDefault();
        cobrarRapido("tarjeta");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [guardando, items, modoMixto, total]);

  if (loading) return <p style={{ padding: "24px" }}>Cargando datos...</p>;

  return (
    <div style={{ padding: "16px", minHeight: "100vh", background: "#f6f7fb" }}>
      <h1 style={{ marginBottom: "16px" }}>POS / Nueva Venta</h1>

      {mensaje && (
        <div
          style={{
            background: "#e8fff0",
            color: "#146c2e",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "12px",
            border: "1px solid #b7ebc6",
          }}
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fff1f0",
            color: "#b42318",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "12px",
            border: "1px solid #f4c7c3",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <section
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2>Productos</h2>

          <input
            type="text"
            placeholder="Buscar producto, variante o SKU"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "16px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "16px",
            }}
          />

          <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
            <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Producto</th>
                  <th>Variante</th>
                  <th>SKU</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>En carrito</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {resultados.map((v) => {
                  const stockDisponible = Number(v.stock_disponible ?? 0);
                  const yaEnCarrito = cantidadEnCarrito(v.id);
                  const sinStock = stockDisponible <= 0 || yaEnCarrito >= stockDisponible;

                  return (
                    <tr key={v.id}>
                      <td>{v.id}</td>
                      <td>{v.producto_nombre}</td>
                      <td>{v.nombre_variante}</td>
                      <td>{v.sku}</td>
                      <td>${Number(v.precio_minorista).toLocaleString("es-AR")}</td>
                      <td
                        style={{
                          color:
                            stockDisponible === 0
                              ? "red"
                              : stockDisponible <= 2
                              ? "darkorange"
                              : "inherit",
                          fontWeight: stockDisponible <= 2 ? "bold" : "normal",
                        }}
                      >
                        {stockDisponible.toLocaleString("es-AR")}
                      </td>
                      <td>{yaEnCarrito}</td>
                      <td>
                        <button onClick={() => agregarAlCarrito(v)} disabled={sinStock}>
                          {stockDisponible <= 0
                            ? "Sin stock"
                            : yaEnCarrito >= stockDisponible
                            ? "Tope"
                            : "Agregar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            position: "sticky",
            top: "12px",
          }}
        >
          <h2>Carrito</h2>
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <label style={{ fontWeight: "bold" }}>Cliente</label>

            <select
              value={clienteSeleccionadoId}
              onChange={(e) => setClienteSeleccionadoId(Number(e.target.value))}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "15px",
              }}
            >
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  #{cliente.id} - {cliente.nombre}
                  {cliente.telefono ? ` (${cliente.telefono})` : ""}
                </option>
              ))}
            </select>

            <Link
              to="/clientes/nuevo"
              style={{
                textDecoration: "none",
                fontWeight: "bold",
                color: "#1565c0",
                fontSize: "14px",
                width: "fit-content",
              }}
            >
              + Nuevo cliente
            </Link>
          </div>

          {items.length === 0 ? (
            <p>No hay productos cargados.</p>
          ) : (
            <div style={{ maxHeight: "40vh", overflowY: "auto", marginBottom: "16px" }}>
              <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id_variante}>
                      <td>
                        <div>{item.producto_nombre}</div>
                        <small>{item.nombre_variante}</small>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) =>
                            cambiarCantidad(item.id_variante, Number(e.target.value))
                          }
                          style={{ width: "60px" }}
                        />
                      </td>
                      <td>${item.precio.toLocaleString("es-AR")}</td>
                      <td>${(item.precio * item.cantidad).toLocaleString("es-AR")}</td>
                      <td>
                        <button onClick={() => quitarItem(item.id_variante)}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              fontSize: "42px",
              fontWeight: "bold",
              marginTop: "12px",
              background: "#111827",
              color: "white",
              padding: "20px",
              textAlign: "center",
              borderRadius: "12px",
            }}
          >
            TOTAL ${total.toLocaleString("es-AR")}
          </div>

          {!modoMixto && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginTop: "16px",
                }}
              >
                <button
                  onClick={() => cobrarRapido("efectivo")}
                  disabled={guardando || items.length === 0}
                  style={botonPagoStyle}
                >
                  EFECTIVO
                  <small style={smallStyle}>F1</small>
                </button>

                <button
                  onClick={() => cobrarRapido("transferencia")}
                  disabled={guardando || items.length === 0}
                  style={botonPagoStyle}
                >
                  TRANSFERENCIA
                  <small style={smallStyle}>F2</small>
                </button>

                <button
                  onClick={() => cobrarRapido("mercadopago")}
                  disabled={guardando || items.length === 0}
                  style={botonPagoStyle}
                >
                  MERCADO PAGO
                  <small style={smallStyle}>F3</small>
                </button>

                <button
                  onClick={() => cobrarRapido("tarjeta")}
                  disabled={guardando || items.length === 0}
                  style={botonPagoStyle}
                >
                  TARJETA
                  <small style={smallStyle}>F4</small>
                </button>
              </div>

              <div style={{ marginTop: "12px" }}>
                <button
                  onClick={() => setModoMixto(true)}
                  disabled={guardando || items.length === 0}
                  style={{
                    width: "100%",
                    padding: "14px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    borderRadius: "10px",
                    cursor: "pointer",
                  }}
                >
                  Pago mixto / parcial
                </button>
              </div>
            </>
          )}

          {modoMixto && (
            <div style={{ marginTop: "18px" }}>
              <h3>Pagos mixtos / parciales</h3>

              {pagos.map((pago, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 90px",
                    gap: "8px",
                    marginBottom: "8px",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={pago.medio_pago}
                    onChange={(e) => cambiarPago(index, "medio_pago", e.target.value)}
                    style={{ padding: "8px" }}
                  >
                    {MEDIOS_PAGO.map((medio) => (
                      <option key={medio.value} value={medio.value}>
                        {medio.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Monto"
                    value={pago.monto}
                    onChange={(e) => cambiarPago(index, "monto", e.target.value)}
                    style={{ padding: "8px" }}
                  />

                  <button
                    onClick={() => quitarPago(index)}
                    disabled={pagos.length === 1}
                  >
                    Quitar
                  </button>
                </div>
              ))}

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={agregarPago}>Agregar pago</button>
                <button onClick={() => setModoMixto(false)}>Volver a pago rápido</button>
              </div>

              <div style={{ marginTop: "12px" }}>
                <p><strong>Pagado:</strong> ${totalPagado.toLocaleString("es-AR")}</p>
                <p
                  style={{
                    color: restante === 0 ? "green" : "darkorange",
                    fontWeight: "bold",
                  }}
                >
                  <strong>Restante:</strong> ${restante.toLocaleString("es-AR")}
                </p>
              </div>

              <button
                onClick={confirmarVentaMixta}
                disabled={guardando || items.length === 0}
                style={{
                  width: "100%",
                  marginTop: "12px",
                  padding: "16px",
                  fontSize: "18px",
                  fontWeight: "bold",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                {guardando ? "Procesando..." : "Cobrar y entregar"}
              </button>
            </div>
          )}

          <div style={{ marginTop: "12px" }}>
            <button
              onClick={resetVenta}
              disabled={guardando}
              style={{ width: "100%", padding: "12px" }}
            >
              Limpiar venta
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const botonPagoStyle = {
  padding: "18px",
  fontSize: "16px",
  fontWeight: "bold",
  borderRadius: "10px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
};

const smallStyle = {
  fontSize: "12px",
  opacity: 0.8,
};