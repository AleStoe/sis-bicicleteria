import { useState } from "react";

function crearVarianteVacia() {
  return {
    talle: "",
    color: "",
    codigo_proveedor: "",
    cantidad: 1,
    costo: "",
    precio_minorista: "",
    precio_mayorista: "",
  };
}

export default function AltaBicicletaForm() {
  const [form, setForm] = useState({
    marca: "",
    modelo: "",
    rodado: "29",
    material: "Aluminio",
    tipo: "MTB",
    transmision: "",
    variantes: [crearVarianteVacia()],
  });

  function setCampo(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function setVariante(index, key, value) {
    setForm((prev) => ({
      ...prev,
      variantes: prev.variantes.map((v, i) =>
        i === index
          ? {
              ...v,
              [key]: value,
            }
          : v
      ),
    }));
  }

  function agregarVariante() {
    setForm((prev) => ({
      ...prev,
      variantes: [...prev.variantes, crearVarianteVacia()],
    }));
  }

  function quitarVariante(index) {
    if (form.variantes.length === 1) return;

    setForm((prev) => ({
      ...prev,
      variantes: prev.variantes.filter((_, i) => i !== index),
    }));
  }

  return (
    <section style={styles.card}>
      <h2 style={styles.title}>Modelo base</h2>

      <div style={styles.grid}>
        <label style={styles.label}>
          Marca
          <input
            style={styles.input}
            value={form.marca}
            onChange={(e) => setCampo("marca", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Modelo
          <input
            style={styles.input}
            value={form.modelo}
            onChange={(e) => setCampo("modelo", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Rodado
          <input
            style={styles.input}
            value={form.rodado}
            onChange={(e) => setCampo("rodado", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Material
          <input
            style={styles.input}
            value={form.material}
            onChange={(e) => setCampo("material", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Tipo
          <input
            style={styles.input}
            value={form.tipo}
            onChange={(e) => setCampo("tipo", e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Transmisión / Velocidades
          <input
            style={styles.input}
            placeholder="21V Shimano Tourney"
            value={form.transmision}
            onChange={(e) => setCampo("transmision", e.target.value)}
          />
        </label>
      </div>

      <div style={styles.separator} />

      <div style={styles.variantHeader}>
        <h2 style={styles.title}>Variantes</h2>

        <button
          type="button"
          onClick={agregarVariante}
          style={styles.addButton}
        >
          + Agregar variante
        </button>
      </div>

      <div style={styles.variantsContainer}>
        {form.variantes.map((variante, index) => (
          <div key={index} style={styles.variantCard}>
            <div style={styles.variantTop}>
              <strong>Variante #{index + 1}</strong>

              {form.variantes.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitarVariante(index)}
                  style={styles.removeButton}
                >
                  Eliminar
                </button>
              )}
            </div>

            <div style={styles.grid}>
              <label style={styles.label}>
                Talle
                <input
                  style={styles.input}
                  value={variante.talle}
                  onChange={(e) =>
                    setVariante(index, "talle", e.target.value)
                  }
                />
              </label>

              <label style={styles.label}>
                Color
                <input
                  style={styles.input}
                  value={variante.color}
                  onChange={(e) =>
                    setVariante(index, "color", e.target.value)
                  }
                />
              </label>

              <label style={styles.label}>
                Código proveedor
                <input
                  style={styles.input}
                  value={variante.codigo_proveedor}
                  onChange={(e) =>
                    setVariante(index, "codigo_proveedor", e.target.value)
                  }
                />
              </label>

              <label style={styles.label}>
                Cantidad
                <input
                  type="number"
                  style={styles.input}
                  value={variante.cantidad}
                  onChange={(e) =>
                    setVariante(index, "cantidad", e.target.value)
                  }
                />
              </label>

              <label style={styles.label}>
                Costo
                <input
                  type="number"
                  style={styles.input}
                  value={variante.costo}
                  onChange={(e) =>
                    setVariante(index, "costo", e.target.value)
                  }
                />
              </label>

              <label style={styles.label}>
                Precio minorista
                <input
                  type="number"
                  style={styles.input}
                  value={variante.precio_minorista}
                  onChange={(e) =>
                    setVariante(index, "precio_minorista", e.target.value)
                  }
                />
              </label>

              <label style={styles.label}>
                Precio mayorista
                <input
                  type="number"
                  style={styles.input}
                  value={variante.precio_mayorista}
                  onChange={(e) =>
                    setVariante(index, "precio_mayorista", e.target.value)
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" style={styles.submitButton}>
        Crear bicicleta e ingresar variantes
      </button>
    </section>
  );
}

const styles = {
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,.08)",
    display: "grid",
    gap: "18px",
  },

  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 800,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },

  label: {
    display: "grid",
    gap: "6px",
    fontWeight: 700,
    fontSize: "14px",
  },

  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
  },

  separator: {
    height: "1px",
    background: "#eaecf0",
  },

  variantHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },

  variantsContainer: {
    display: "grid",
    gap: "16px",
  },

  variantCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "16px",
    display: "grid",
    gap: "14px",
    background: "#fafafa",
  },

  variantTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  addButton: {
    border: "none",
    background: "#175cd3",
    color: "white",
    borderRadius: "10px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },

  removeButton: {
    border: "none",
    background: "#b42318",
    color: "white",
    borderRadius: "10px",
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },

  submitButton: {
    border: "none",
    background: "#12a15f",
    color: "white",
    borderRadius: "12px",
    padding: "14px",
    fontWeight: 800,
    fontSize: "15px",
    cursor: "pointer",
  },
};