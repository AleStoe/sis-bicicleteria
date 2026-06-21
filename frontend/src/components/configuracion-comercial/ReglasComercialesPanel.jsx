import { useEffect, useState } from "react";

import {
  crearReglaComercial,
  listarReglasComerciales,
} from "../../services/reglasComercialesService";

import {
  styles,
  formatPercent,
} from "./configuracionComercialStyles";

export default function ReglasComercialesPanel() {
  const [reglas, setReglas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    tipo: "descuento",
    medio_pago: "efectivo",
    porcentaje: "",
    monto_fijo: "",
    requiere_pago_total: false,
    combinable: false,
    prioridad: "100",
    activa: true,
  });

  async function cargar() {
    const data = await listarReglasComerciales(false);
    setReglas(data);
  }

  function cambiar(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  async function guardarNuevaRegla(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");

      await crearReglaComercial({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        medio_pago: form.medio_pago || null,
        porcentaje: form.porcentaje !== "" ? form.porcentaje : null,
        monto_fijo: form.monto_fijo !== "" ? form.monto_fijo : null,
        requiere_pago_total: Boolean(form.requiere_pago_total),
        combinable: Boolean(form.combinable),
        prioridad: Number(form.prioridad || 100),
        activa: Boolean(form.activa),
      });

      setForm((actual) => ({
        ...actual,
        nombre: "",
        porcentaje: "",
        monto_fijo: "",
      }));

      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo crear la regla comercial");
    } finally {
      setGuardando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Reglas comerciales</div>

      <form onSubmit={guardarNuevaRegla} style={styles.inlineForm}>
        <input
          style={styles.input}
          value={form.nombre}
          onChange={(e) => cambiar("nombre", e.target.value)}
          placeholder="Nombre de regla"
          required
        />

        <select
          style={styles.input}
          value={form.tipo}
          onChange={(e) => cambiar("tipo", e.target.value)}
        >
          <option value="descuento">Descuento</option>
          <option value="recargo">Recargo</option>
        </select>

        <select
          style={styles.input}
          value={form.medio_pago}
          onChange={(e) => cambiar("medio_pago", e.target.value)}
        >
          <option value="">Todos</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="mercadopago">MercadoPago</option>
          <option value="tarjeta">Tarjeta</option>
        </select>

        <input
          style={styles.input}
          type="number"
          step="0.01"
          min="0"
          value={form.porcentaje}
          onChange={(e) => cambiar("porcentaje", e.target.value)}
          placeholder="%"
        />

        <input
          style={styles.input}
          type="number"
          step="0.01"
          min="0"
          value={form.monto_fijo}
          onChange={(e) => cambiar("monto_fijo", e.target.value)}
          placeholder="Monto fijo"
        />

        <input
          style={styles.input}
          type="number"
          min="0"
          value={form.prioridad}
          onChange={(e) => cambiar("prioridad", e.target.value)}
          placeholder="Prioridad"
        />

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.requiere_pago_total}
            onChange={(e) => cambiar("requiere_pago_total", e.target.checked)}
          />
          Pago total
        </label>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.combinable}
            onChange={(e) => cambiar("combinable", e.target.checked)}
          />
          Combinable
        </label>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.activa}
            onChange={(e) => cambiar("activa", e.target.checked)}
          />
          Activa
        </label>

        <button type="submit" style={styles.saveBtn} disabled={guardando}>
          {guardando ? "Guardando..." : "Crear regla"}
        </button>
      </form>

      {error && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={styles.errorBox}>{error}</div>
        </div>
      )}

      <div style={styles.table}>
        <div style={styles.tableHeadReglas}>
          <div>Nombre</div>
          <div>Tipo</div>
          <div>Medio</div>
          <div>%</div>
          <div>Estado</div>
        </div>

        {reglas.map((regla) => (
          <div key={regla.id} style={styles.rowReglas}>
            <div>{regla.nombre}</div>

            <div>
              {regla.tipo === "descuento"
                ? "Descuento"
                : "Recargo"}
            </div>

            <div>{regla.medio_pago || "-"}</div>

            <div>{formatPercent(regla.porcentaje)}</div>

            <div>
              <span
                style={{
                  ...styles.badge,
                  background: regla.activa
                    ? "#ecfdf3"
                    : "#f2f4f7",
                  color: regla.activa
                    ? "#067647"
                    : "#667085",
                }}
              >
                {regla.activa ? "Activa" : "Inactiva"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
