import { useEffect, useState } from "react";
import { listarCatalogoPOS, listarCategorias } from "../services/catalogoService";
import { listarClientes } from "../services/clientesService";
import { CURRENT_SUCURSAL_ID } from "../config/appConfig";

const ID_SUCURSAL = CURRENT_SUCURSAL_ID;
const DEFAULT_LIMIT = 80;

function tipoPrecioParaCliente(cliente) {
  return cliente?.tipo_cliente === "mayorista" ? "mayorista" : "minorista";
}

export default function useNuevaVentaData() {
  const [catalogo, setCatalogo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [clienteId, setClienteId] = useState("1");
  const [tipoPrecio, setTipoPrecio] = useState("minorista");

  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [errorData, setErrorData] = useState("");

  useEffect(() => {
    cargarInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      cargarCatalogo();
    }, 250);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoriaId]);

  async function cargarInicial() {
    try {
      setLoading(true);
      setErrorData("");

      const [categoriasData, clientesData, catalogoData] = await Promise.all([
        listarCategorias(),
        listarClientes({ solo_activos: true }),
        listarCatalogoPOS({
          id_sucursal: ID_SUCURSAL,
          limit: DEFAULT_LIMIT,
        }),
      ]);

      setCategorias(categoriasData || []);
      setClientes(clientesData || []);
      setCatalogo(Array.isArray(catalogoData) ? catalogoData : catalogoData?.items || []);

      const consumidorFinal = (clientesData || []).find((c) => Number(c.id) === 1);
      if (consumidorFinal) {
        setClienteId("1");
        setTipoPrecio(tipoPrecioParaCliente(consumidorFinal));
      } else if ((clientesData || []).length > 0) {
        const primerCliente = clientesData[0];
        setClienteId(String(primerCliente.id));
        setTipoPrecio(tipoPrecioParaCliente(primerCliente));
      }
    } catch (err) {
      setErrorData(err.message || "No se pudo cargar la venta rápida");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogo() {
    try {
      setBuscando(true);
      setErrorData("");

      const data = await listarCatalogoPOS({
        id_sucursal: ID_SUCURSAL,
        query: query.trim() || undefined,
        categoria_id: categoriaId || undefined,
        limit: DEFAULT_LIMIT,
        offset: 0,
      });

      setCatalogo(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setErrorData(err.message || "No se pudo cargar el catálogo POS");
    } finally {
      setBuscando(false);
    }
  }

  function getClienteSeleccionado() {
    return clientes.find((cliente) => Number(cliente.id) === Number(clienteId));
  }

  function handleCambiarCliente(nuevoClienteId) {
    const cliente = clientes.find((c) => Number(c.id) === Number(nuevoClienteId));

    setClienteId(nuevoClienteId);
    setTipoPrecio(tipoPrecioParaCliente(cliente));
  }

  return {
    catalogo,
    categorias,
    clientes,
    query,
    setQuery,
    categoriaId,
    setCategoriaId,
    clienteId,
    tipoPrecio,
    setTipoPrecio,
    loading,
    buscando,
    errorData,
    cargarCatalogo,
    getClienteSeleccionado,
    handleCambiarCliente,
  };
}
