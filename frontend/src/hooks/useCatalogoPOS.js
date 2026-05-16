import { useCallback, useEffect, useState } from "react";
import {
  listarCatalogoPOS,
  listarCategorias,
  buscarCatalogoPOSExacto,
} from "../services/catalogoService";

function normalizarCatalogo(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

export function useCatalogoPOS({
  idSucursal,
  limit = 80,
  onError,
} = {}) {
  const [catalogo, setCatalogo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [buscando, setBuscando] = useState(false);

  const cargarCategorias = useCallback(async () => {
    try {
      const data = await listarCategorias();
      setCategorias(data || []);
    } catch (err) {
      onError?.(err.message || "No se pudieron cargar las categorías");
    }
  }, [onError]);

  const cargarCatalogo = useCallback(async () => {
    try {
      setBuscando(true);
      onError?.("");

      const data = await listarCatalogoPOS({
        id_sucursal: idSucursal,
        query: query.trim() || undefined,
        categoria_id: categoriaId || undefined,
        limit,
        offset: 0,
      });

      setCatalogo(normalizarCatalogo(data));
    } catch (err) {
      onError?.(err.message || "No se pudo cargar el catálogo POS");
    } finally {
      setBuscando(false);
    }
  }, [idSucursal, query, categoriaId, limit, onError]);

  const buscarProductoExacto = useCallback(
    async (codigo) => {
      return buscarCatalogoPOSExacto({
        id_sucursal: idSucursal,
        codigo,
      });
    },
    [idSucursal]
  );

  useEffect(() => {
    cargarCategorias();
  }, [cargarCategorias]);

  useEffect(() => {
    const handle = setTimeout(() => {
      cargarCatalogo();
    }, 250);

    return () => clearTimeout(handle);
  }, [cargarCatalogo]);

  return {
    catalogo,
    categorias,
    query,
    setQuery,
    categoriaId,
    setCategoriaId,
    buscando,
    cargarCatalogo,
    buscarProductoExacto,
  };
}
