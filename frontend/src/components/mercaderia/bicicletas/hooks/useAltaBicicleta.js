import { useEffect, useMemo, useState } from "react";
import {
  crearProducto,
  crearVariante,
  listarCategorias,
  listarMarcas,
  reemplazarFichaTecnicaProducto,
  subirImagenCatalogo,
} from "../../../../services/catalogoService";
import { listarProveedores } from "../../../../services/proveedoresService";
import { crearIngresoStock } from "../../../../services/stockService";
import { CURRENT_USER_ID, CURRENT_SUCURSAL_ID } from "../../../../config/appConfig";
import {
  generarNombreBicicleta,
  generarNombreVarianteBicicleta,
} from "../utils/bicicletaNombre";

const ID_USUARIO = CURRENT_USER_ID;
const ID_SUCURSAL = CURRENT_SUCURSAL_ID;

function varianteVacia() {
  return {
    talle: "",
    color: "",
    codigo_proveedor: "",
    cantidad: "1",
    costo_unitario: "",
    precio_minorista: "",
    precio_mayorista: "",
    imagen_archivo: null,
    imagen_preview: "",
  };
}

function fichaVacia(grupo = "GENERAL", clave = "", valor = "") {
  return {
    grupo,
    clave,
    valor,
    orden: 0,
  };
}

const initialForm = {
  id_categoria: "",
  id_marca: "",
  id_proveedor: "",
  modelo: "",
  rodado: "29",
  tipo_bicicleta: "MTB",
  material_cuadro: "Aluminio",
  transmision: "21V Shimano Tourney",
  variantes: [varianteVacia()],
  ficha_tecnica: [
    fichaVacia("CUADRO", "Material", "Aluminio"),
    fichaVacia("TRANSMISIÓN", "Velocidades", "21V Shimano Tourney"),
    fichaVacia("FRENOS", "Sistema", ""),
    fichaVacia("RUEDAS", "Cubiertas", ""),
  ],
};

export default function useAltaBicicleta() {
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
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

  const marcaSeleccionada = useMemo(() => {
    return marcas.find((m) => String(m.id) === String(form.id_marca));
  }, [marcas, form.id_marca]);
  console.log({
    formMarca: form.id_marca,
    marcas,
    marcaSeleccionada,
    });
  const nombreProducto = useMemo(() => {
    return generarNombreBicicleta({
      marcaNombre: marcaSeleccionada?.nombre || "",
      tipo_bicicleta: form.tipo_bicicleta,
      modelo: form.modelo,
      rodado: form.rodado,
      material_cuadro: form.material_cuadro,
      transmision: form.transmision,
    });
  }, [
    marcaSeleccionada,
    form.tipo_bicicleta,
    form.modelo,
    form.rodado,
    form.material_cuadro,
    form.transmision,
  ]);

  function setCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function setVariante(index, campo, valor) {
    setForm((prev) => ({
      ...prev,
      variantes: prev.variantes.map((v, i) =>
        i === index ? { ...v, [campo]: valor } : v
      ),
    }));
  }

  function setFicha(index, campo, valor) {
    setForm((prev) => ({
      ...prev,
      ficha_tecnica: prev.ficha_tecnica.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item
      ),
    }));
  }

  function agregarVariante() {
    setForm((prev) => ({
      ...prev,
      variantes: [...prev.variantes, varianteVacia()],
    }));
  }

  function quitarVariante(index) {
    if (form.variantes.length === 1) return;

    setForm((prev) => ({
      ...prev,
      variantes: prev.variantes.filter((_, i) => i !== index),
    }));
  }

  function agregarFicha() {
    setForm((prev) => ({
      ...prev,
      ficha_tecnica: [...prev.ficha_tecnica, fichaVacia()],
    }));
  }

  function quitarFicha(index) {
    setForm((prev) => ({
      ...prev,
      ficha_tecnica: prev.ficha_tecnica.filter((_, i) => i !== index),
    }));
  }

  function validar() {
    if (!form.id_categoria) return "Seleccioná categoría";
    if (!form.id_marca) return "Seleccioná marca";
    if (!form.id_proveedor) return "Seleccioná proveedor";
    if (!form.modelo.trim()) return "El modelo es obligatorio";
    const codigos = form.variantes
      .map((v) => v.codigo_proveedor.trim().toUpperCase())
      .filter(Boolean);

    if (new Set(codigos).size !== codigos.length) {
      return "No podés repetir el mismo código proveedor entre variantes";
    }
    for (const [index, variante] of form.variantes.entries()) {
      if (!variante.talle.trim()) return `Variante #${index + 1}: falta talle`;
      if (!variante.color.trim()) return `Variante #${index + 1}: falta color`;
      if (!variante.codigo_proveedor.trim()) {
        return `Variante #${index + 1}: falta código proveedor`;
      }
      if (Number(variante.cantidad) <= 0) {
        return `Variante #${index + 1}: cantidad inválida`;
      }
      if (variante.costo_unitario === "" || Number(variante.costo_unitario) < 0) {
        return `Variante #${index + 1}: costo inválido`;
      }
    }

    return "";
  }

  async function guardar(e) {
    e?.preventDefault?.();

    const errorValidacion = validar();

    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const producto = await crearProducto({
        id_categoria: Number(form.id_categoria),
        id_marca: Number(form.id_marca),
        nombre: nombreProducto,
        tipo_item: "producto",
        stockeable: true,
        serializable: true,
        rodado: form.rodado || null,
        tipo_bicicleta: form.tipo_bicicleta || null,
        material_cuadro: form.material_cuadro || null,
      });

      const fichaItems = form.ficha_tecnica
        .filter((item) => item.clave.trim() && item.valor.trim())
        .map((item, index) => ({
          grupo: item.grupo.trim() || "GENERAL",
          clave: item.clave.trim(),
          valor: item.valor.trim(),
          orden: index + 1,
        }));

      if (fichaItems.length > 0) {
        await reemplazarFichaTecnicaProducto(producto.id, {
          items: fichaItems,
        });
      }

      for (const varianteForm of form.variantes) {
        const talleNormalizado = varianteForm.talle.trim().toUpperCase();
        const colorNormalizado = varianteForm.color.trim().toUpperCase();

        const nombreVariante = generarNombreVarianteBicicleta({
        talle: talleNormalizado,
        color: colorNormalizado,
        });

        const variante = await crearVariante({
          id_producto: producto.id,
          nombre_variante: nombreVariante,
          talle: varianteForm.talle.trim().toUpperCase(),
          color: varianteForm.color.trim().toUpperCase(),
          sku: null,
          codigo_barras: null,
          codigo_proveedor: varianteForm.codigo_proveedor.trim(),
          proveedor_preferido_id: Number(form.id_proveedor),
          alicuota_iva: "21.00",
          gravado: true,
          precio_minorista: varianteForm.precio_minorista || "0",
          precio_mayorista: varianteForm.precio_mayorista || "0",
          permite_precio_libre: false,
        });

        await crearIngresoStock({
          id_sucursal: ID_SUCURSAL,
          id_variante: variante.id,
          id_proveedor: Number(form.id_proveedor),
          cantidad_ingresada: Number(varianteForm.cantidad),
          costo_productos:
            Number(varianteForm.cantidad) * Number(varianteForm.costo_unitario),
          gastos_adicionales: 0,
          origen_ingreso: "manual",
          observacion: `Alta bicicleta ${nombreProducto} - ${nombreVariante}`,
          id_usuario: ID_USUARIO,
        });

        if (varianteForm.imagen_archivo) {
          await subirImagenCatalogo({
            archivo: varianteForm.imagen_archivo,
            id_variante: variante.id,
            es_principal: true,
            orden: 0,
          });
        }
      }

      setMensaje(`Bicicleta creada correctamente: ${nombreProducto}`);

      setForm((prev) => ({
        ...prev,
        modelo: "",
        variantes: [varianteVacia()],
      }));
    } catch (err) {
      setError(err.message || "No se pudo crear la bicicleta");
    } finally {
      setProcesando(false);
    }
  }

  return {
    categorias,
    marcas,
    proveedores,
    form,
    procesando,
    error,
    mensaje,
    nombreProducto,
    setCampo,
    setVariante,
    setFicha,
    agregarVariante,
    quitarVariante,
    agregarFicha,
    quitarFicha,
    guardar,
  };
}