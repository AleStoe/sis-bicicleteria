import BicicletaModeloForm from "./BicicletaModeloForm";
import BicicletaVariantesForm from "./BicicletaVariantesForm";
import BicicletaFichaTecnicaForm from "./BicicletaFichaTecnicaForm";
import useAltaBicicleta from "./hooks/useAltaBicicleta";

export default function AltaBicicletaForm() {
  const {
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
  } = useAltaBicicleta();

  return (
    <form onSubmit={guardar} style={styles.card}>
      {error && <div style={styles.error}>Error: {error}</div>}

      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <BicicletaModeloForm
        form={form}
        setCampo={setCampo}
        categorias={categorias}
        marcas={marcas}
        proveedores={proveedores}
        nombreProducto={nombreProducto}
      />

      <BicicletaVariantesForm
        variantes={form.variantes}
        onAdd={agregarVariante}
        onChange={setVariante}
        onRemove={quitarVariante}
      />

      <BicicletaFichaTecnicaForm
        items={form.ficha_tecnica}
        onAdd={agregarFicha}
        onChange={setFicha}
        onRemove={quitarFicha}
      />

      <button
        type="submit"
        disabled={procesando}
        style={styles.primaryButton}
      >
        {procesando
          ? "Creando..."
          : "Crear bicicleta e ingresar variantes"}
      </button>
    </form>
  );
}

const styles = {
  card: {
    background: "#fff",
    borderRadius: "14px",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    padding: "16px",
    display: "grid",
    gap: "18px",
  },
  primaryButton: {
    border: "none",
    background: "#12a15f",
    color: "#fff",
    borderRadius: "12px",
    padding: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    background: "#fff1f0",
    color: "#b42318",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #f4c7c3",
  },
  success: {
    background: "#e8fff0",
    color: "#146c2e",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #b7ebc6",
  },
};