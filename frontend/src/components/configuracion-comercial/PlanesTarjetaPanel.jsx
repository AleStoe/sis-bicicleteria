import { useEffect, useState } from "react";

import {
  listarTarjetaPlanes,
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

  useEffect(() => {
    cargar();
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Planes tarjeta</div>

      {error && (
        <div style={{ padding: 16 }}>
          <div style={styles.errorBox}>{error}</div>
        </div>
      )}

      <div style={styles.table}>
        <div style={styles.tableHeadPlanes}>
          <div>Nombre</div>
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