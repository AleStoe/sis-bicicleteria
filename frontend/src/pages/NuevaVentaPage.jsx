import { useEffect, useMemo, useState } from "react";
import { listarVariantes } from "../services/catalogoService";
import { listarStock } from "../services/stockService";
import { crearVenta, entregarVenta } from "../services/ventasService";

export default function NuevaVentaPage() {
  const [variantes, setVariantes] = useState([]);
  const [stock, setStock] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargarDatos() {
    try {
      setLoading(true);
      setError("");

      const [variantesData, stockData] = await Promise.all([
        listarVariantes(),
        listarStock(),
      ]);

      setVariantes(variantesData);
      setStock(stockData);
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

  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  }, [items]);

  async function confirmarVenta() {
    setError("");
    setMensaje("");

    if (items.length === 0) {
      setError("Agregá al menos un producto al carrito");
      return;
    }

    try {
      setGuardando(true);

      const payload = {
        id_cliente: 1,
        id_sucursal: 1,
        id_usuario: 1,
        items: items.map((item) => ({
          id_variante: item.id_variante,
          cantidad: item.cantidad,
        })),
      };

      const venta = await crearVenta(payload);

      await entregarVenta(venta.venta_id, {
        id_usuario: 1,
      });

      setMensaje(`Venta registrada y entregada correctamente. ID: ${venta.venta_id}`);
      setItems([]);
      setBusqueda("");

      await cargarDatos();
    } catch (err) {
      setError(err.message || "No se pudo registrar y entregar la venta");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p>Cargando datos...</p>;

  return (
    <div style={{ padding: "24px" }}>
      <h1>Nueva Venta</h1>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Buscar producto, variante o SKU"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ width: "100%", padding: "10px" }}
        />
      </div>

      <h2>Variantes</h2>

      <table border="1" cellPadding="6" style={{ marginBottom: "24px", width: "100%" }}>
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
                      ? "Tope carrito"
                      : "Agregar"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Carrito</h2>

      {items.length === 0 ? (
        <p>No hay productos cargados.</p>
      ) : (
        <table border="1" cellPadding="6" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Variante</th>
              <th>SKU</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id_variante}>
                <td>{item.producto_nombre}</td>
                <td>{item.nombre_variante}</td>
                <td>{item.sku}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) =>
                      cambiarCantidad(item.id_variante, Number(e.target.value))
                    }
                    style={{ width: "70px" }}
                  />
                </td>
                <td>${item.precio.toLocaleString("es-AR")}</td>
                <td>${(item.precio * item.cantidad).toLocaleString("es-AR")}</td>
                <td>
                  <button onClick={() => quitarItem(item.id_variante)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: "24px" }}>
        <h2>Total: ${total.toLocaleString("es-AR")}</h2>
      </div>

      <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
        <button onClick={confirmarVenta} disabled={guardando}>
          {guardando ? "Procesando..." : "Cobrar y entregar"}
        </button>

        <button
          onClick={() => {
            setItems([]);
            setError("");
            setMensaje("");
          }}
          disabled={guardando}
        >
          Limpiar carrito
        </button>
      </div>

      {mensaje && (
        <p style={{ color: "green", marginTop: "12px" }}>{mensaje}</p>
      )}

      {error && (
        <p style={{ color: "red", marginTop: "12px" }}>{error}</p>
      )}
    </div>
  );
}