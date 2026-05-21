import { useMemo, useState } from "react";
import { listarSerializadasDisponibles } from "../services/serializadasService";
import { CURRENT_SUCURSAL_ID } from "../config/appConfig";
import {
  crearLineId,
  getCodigoItemCatalogo,
  getDescripcionItemCatalogo,
  getMotivoBloqueoItemCatalogo,
  getPrecioItemCatalogo,
  puedeAgregarItemCatalogo,
} from "../helpers/ventasItemsHelper";

const ID_SUCURSAL = CURRENT_SUCURSAL_ID;

function mapProductoAItem(producto, tipoPrecio) {
  return {
    line_id: crearLineId(),
    id_variante: producto.id_variante,
    id_producto: producto.id_producto,
    descripcion: getDescripcionItemCatalogo(producto),
    codigo: getCodigoItemCatalogo(producto),
    categoria_nombre: producto.categoria_nombre,
    tipo_item: producto.tipo_item,
    stockeable: producto.stockeable,
    serializable: producto.serializable,
    stock_disponible: Number(producto.stock_disponible || 0),
    precio_minorista: Number(producto.precio_minorista || 0),
    precio_mayorista: Number(producto.precio_mayorista || 0),
    precio_lista: getPrecioItemCatalogo(producto, tipoPrecio),
    tipo_precio_aplicado: tipoPrecio,
    cantidad: 1,
    imagen_principal: producto.imagen_principal,
    id_bicicleta_serializada: null,
    numero_cuadro: "",
    ...(producto.serializable ? { modo_venta_serializada: "caja" } : {}),
  };
}

export default function useVentaCarrito({ tipoPrecio, setError, setMensaje }) {
  const [items, setItems] = useState([]);
  const [serializadasPorVariante, setSerializadasPorVariante] = useState({});
  const [cargandoSerializadas, setCargandoSerializadas] = useState({});

  const total = useMemo(() => {
    return items.reduce((acc, item) => {
      const precioUnitario = item.bonificado
        ? 0
        : Number(item.precio_unitario_manual || item.precio_final || item.precio_lista || 0);

      return acc + precioUnitario * Number(item.cantidad || 0);
    }, 0);
  }, [items]);

  async function cargarSerializadasDisponibles(idVariante) {
    const key = String(idVariante);

    if (serializadasPorVariante[key]) return serializadasPorVariante[key];

    try {
      setCargandoSerializadas((p) => ({ ...p, [key]: true }));

      const data = await listarSerializadasDisponibles({
        id_variante: idVariante,
        id_sucursal: ID_SUCURSAL,
      });

      setSerializadasPorVariante((p) => ({ ...p, [key]: data || [] }));

      return data || [];
    } catch (err) {
      setError(err.message || "No se pudieron cargar las bicicletas serializadas disponibles");
      return [];
    } finally {
      setCargandoSerializadas((p) => ({ ...p, [key]: false }));
    }
  }

  async function agregarItem(producto) {
    if (!puedeAgregarItemCatalogo(producto, tipoPrecio)) {
      setError(`No se puede agregar: ${getMotivoBloqueoItemCatalogo(producto, tipoPrecio)}`);
      return;
    }

    setError("");
    setMensaje("");

    if (producto.serializable) {
      setItems((actual) => [...actual, mapProductoAItem(producto, tipoPrecio)]);
      return;
    }

    setItems((actual) => {
      const existente = actual.find(
        (item) =>
          Number(item.id_variante) === Number(producto.id_variante) &&
          !item.id_bicicleta_serializada &&
          !item.bonificado &&
          !item.precio_unitario_manual
      );

      if (existente) {
        const nuevaCantidad = Number(existente.cantidad) + 1;

        if (producto.stockeable && nuevaCantidad > Number(producto.stock_disponible || 0)) {
          setError("La cantidad supera el stock disponible");
          return actual;
        }

        return actual.map((item) =>
          item.line_id === existente.line_id ? { ...item, cantidad: nuevaCantidad } : item
        );
      }

      return [...actual, mapProductoAItem(producto, tipoPrecio)];
    });
  }

  function seleccionarSerializada(index, bicicletaIdRaw) {
    const bicicletaId = bicicletaIdRaw ? Number(bicicletaIdRaw) : "";

    setItems((actual) =>
      actual.map((item, i) => {
        if (i !== index) return item;

        const disponibles = serializadasPorVariante[String(item.id_variante)] || [];
        const bici = disponibles.find((b) => Number(b.id) === Number(bicicletaId));

        return {
          ...item,
          id_bicicleta_serializada: bicicletaId || "",
          numero_cuadro: bici?.numero_cuadro || "",
          cantidad: 1,
        };
      })
    );
  }

  function cambiarCantidad(lineId, nuevaCantidadRaw) {
    const nuevaCantidad = Number(nuevaCantidadRaw);

    if (!Number.isFinite(nuevaCantidad)) return;

    if (nuevaCantidad <= 0) {
      quitarItem(lineId);
      return;
    }

    setItems((actual) =>
      actual.map((item) => {
        if (item.line_id !== lineId) return item;

        if (item.serializable && item.modo_venta_serializada === "serializada") {
          setError("Las bicicletas serializadas siempre tienen cantidad 1");
          return { ...item, cantidad: 1 };
        }

        if (item.stockeable && nuevaCantidad > Number(item.stock_disponible || 0)) {
          setError("La cantidad supera el stock disponible");
          return item;
        }

        setError("");
        return { ...item, cantidad: nuevaCantidad };
      })
    );
  }

  function quitarItem(lineId) {
    setItems((actual) => actual.filter((item) => item.line_id !== lineId));
  }

  function actualizarItemCarrito(lineId, cambios) {
    setItems((actual) =>
      actual.map((item) => (item.line_id === lineId ? { ...item, ...cambios } : item))
    );
  }

  function limpiarCarrito() {
    setItems([]);
  }

  return {
    items,
    setItems,
    total,
    serializadasPorVariante,
    cargandoSerializadas,
    cargarSerializadasDisponibles,
    agregarItem,
    seleccionarSerializada,
    cambiarCantidad,
    quitarItem,
    actualizarItemCarrito,
    limpiarCarrito,
  };
}
