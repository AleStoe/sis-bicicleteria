import { useEffect, useState } from "react";

import { listarReglasComerciales } from "../../services/reglasComercialesService";

import {
  styles,
  formatPercent,
} from "./configuracionComercialStyles";

export default function ReglasComercialesPanel() {
  const [reglas, setReglas] = useState([]);

  async function cargar() {
    const data = await listarReglasComerciales(false);
    setReglas(data);
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Reglas comerciales</div>

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