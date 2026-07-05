import { useEffect, useState } from "react";

import {
  listarTarjetaPlanes,
  crearTarjetaPlan,
  editarTarjetaPlan,
} from "../../services/reglasComercialesService";

import PlanTarjetaRow from "./PlanTarjetaRow";

import {
  styles,
} from "./configuracionComercialStyles";

export default function PlanesTarjetaPanel() {
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    medio_pago: "tarjeta",
    entidad: "",
    cuotas: "1",
    porcentaje_recargo_cliente: "0",
    porcentaje_costo_financiero: "0",
  });

  async function cargar() {
    try {
      setLoading(true);

      const data = await listarTarjetaPlanes(false);

      setPlanes(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los planes");
    } finally {
      setLoading(false);
    }
  }

  async function guardarPlan(planId, payload) {
    await editarTarjetaPlan(planId, payload);
    await cargar();
  }

  async function crearPlan(event) {
    event.preventDefault();
    try {
      setCreando(true);
      setError("");
      await crearTarjetaPlan({
        ...nuevo,
        entidad: nuevo.entidad || null,
        cuotas: Number(nuevo.cuotas),
        porcentaje_recargo_cliente: String(nuevo.porcentaje_recargo_cliente),
        porcentaje_costo_financiero: String(nuevo.porcentaje_costo_financiero),
        activa: true,
      });
      setNuevo({
        nombre: "",
        medio_pago: "tarjeta",
        entidad: "",
        cuotas: "1",
        porcentaje_recargo_cliente: "0",
        porcentaje_costo_financiero: "0",
      });
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo crear el plan");
    } finally {
      setCreando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Planes y costos de cobro</div>

      <form style={styles.inlineForm} onSubmit={crearPlan}>
        <input
          required
          minLength={3}
          placeholder="Nombre del plan"
          value={nuevo.nombre}
          onChange={(e) => setNuevo((actual) => ({ ...actual, nombre: e.target.value }))}
          style={styles.input}
        />
        <select
          value={nuevo.medio_pago}
          onChange={(e) => setNuevo((actual) => ({
            ...actual,
            medio_pago: e.target.value,
            cuotas: e.target.value === "mercadopago" ? "1" : actual.cuotas,
          }))}
          style={styles.input}
        >
          <option value="tarjeta">Tarjeta</option>
          <option value="mercadopago">QR / Mercado Pago</option>
        </select>
        <input
          placeholder="Entidad (opcional)"
          value={nuevo.entidad}
          onChange={(e) => setNuevo((actual) => ({ ...actual, entidad: e.target.value }))}
          style={styles.input}
        />
        <input
          required
          min="1"
          type="number"
          placeholder="Cuotas"
          value={nuevo.cuotas}
          onChange={(e) => setNuevo((actual) => ({ ...actual, cuotas: e.target.value }))}
          style={styles.input}
          disabled={nuevo.medio_pago === "mercadopago"}
        />
        <input
          required
          min="0"
          step="0.01"
          type="number"
          placeholder="Recargo al cliente %"
          value={nuevo.porcentaje_recargo_cliente}
          onChange={(e) => setNuevo((actual) => ({ ...actual, porcentaje_recargo_cliente: e.target.value }))}
          style={styles.input}
        />
        <input
          required
          min="0"
          step="0.01"
          type="number"
          placeholder="Comisión del medio %"
          value={nuevo.porcentaje_costo_financiero}
          onChange={(e) => setNuevo((actual) => ({ ...actual, porcentaje_costo_financiero: e.target.value }))}
          style={styles.input}
        />
        <button type="submit" disabled={creando} style={styles.saveBtn}>
          {creando ? "Creando..." : "Agregar plan"}
        </button>
      </form>

      {error && (
        <div style={{ padding: 16 }}>
          <div style={styles.errorBox}>{error}</div>
        </div>
      )}

      <div style={styles.table}>
        <div style={styles.tableHeadPlanes}>
          <div>Nombre</div>
          <div>Medio</div>
          <div>Entidad</div>
          <div>Cuotas</div>
          <div>Recargo cliente</div>
          <div>Costo financiero</div>
          <div>Estado / Acción</div>
        </div>

        {planes.map((plan) => (
          <PlanTarjetaRow
            key={plan.id}
            plan={plan}
            onGuardar={guardarPlan}
          />
        ))}
      </div>

      {loading && (
        <div style={{ padding: 16 }}>
          <div style={styles.loading}>
            Cargando planes...
          </div>
        </div>
      )}
    </section>
  );
}
