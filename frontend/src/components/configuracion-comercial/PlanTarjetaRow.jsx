import { useState } from "react";

import {
  styles,
  formatPercent,
} from "./configuracionComercialStyles";

export default function PlanTarjetaRow({
  plan,
  onGuardar,
}) {
  const [editando, setEditando] = useState(false);

  const [form, setForm] = useState({
    nombre: plan.nombre || "",
    entidad: plan.entidad || "",
    cuotas: String(plan.cuotas || ""),
    porcentaje_recargo_cliente: String(
      plan.porcentaje_recargo_cliente || "0"
    ),
    porcentaje_costo_financiero: String(
      plan.porcentaje_costo_financiero || "0"
    ),
    activa: Boolean(plan.activa),
  });

  const [guardando, setGuardando] = useState(false);

  function cambiar(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  async function guardar() {
    try {
      setGuardando(true);

      await onGuardar(plan.id, {
        nombre: form.nombre,
        entidad: form.entidad || null,
        cuotas: Number(form.cuotas),
        porcentaje_recargo_cliente: String(
          form.porcentaje_recargo_cliente
        ),
        porcentaje_costo_financiero: String(
          form.porcentaje_costo_financiero
        ),
        activa: Boolean(form.activa),
      });

      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={styles.rowPlanes}>
      <div>
        {plan.medio_pago === "mercadopago" ? "QR / Mercado Pago" : "Tarjeta"}
      </div>

      <div>
        {editando ? (
          <input
            value={form.nombre}
            onChange={(e) =>
              cambiar("nombre", e.target.value)
            }
            style={styles.input}
          />
        ) : (
          plan.nombre
        )}
      </div>

      <div>
        {editando ? (
          <input
            value={form.entidad}
            onChange={(e) =>
              cambiar("entidad", e.target.value)
            }
            style={styles.input}
          />
        ) : (
          plan.entidad || "-"
        )}
      </div>

      <div>
        {editando ? (
          <input
            type="number"
            value={form.cuotas}
            onChange={(e) =>
              cambiar("cuotas", e.target.value)
            }
            style={styles.input}
            disabled={plan.medio_pago === "mercadopago"}
          />
        ) : (
          plan.cuotas
        )}
      </div>

      <div>
        {editando ? (
          <input
            type="number"
            step="0.01"
            value={form.porcentaje_recargo_cliente}
            onChange={(e) =>
              cambiar(
                "porcentaje_recargo_cliente",
                e.target.value
              )
            }
            style={styles.input}
          />
        ) : (
          formatPercent(plan.porcentaje_recargo_cliente)
        )}
      </div>

      <div>
        {editando ? (
          <input
            type="number"
            step="0.01"
            value={form.porcentaje_costo_financiero}
            onChange={(e) =>
              cambiar(
                "porcentaje_costo_financiero",
                e.target.value
              )
            }
            style={styles.input}
          />
        ) : (
          formatPercent(plan.porcentaje_costo_financiero)
        )}
      </div>

      <div style={styles.actionsCell}>
        {editando ? (
          <>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.activa}
                onChange={(e) =>
                  cambiar("activa", e.target.checked)
                }
              />
              Activo
            </label>

            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              style={styles.saveBtn}
            >
              Guardar
            </button>

            <button
              type="button"
              onClick={() => setEditando(false)}
              style={styles.cancelBtn}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <span
              style={{
                ...styles.badge,
                background: plan.activa
                  ? "#ecfdf3"
                  : "#f2f4f7",
                color: plan.activa
                  ? "#067647"
                  : "#667085",
              }}
            >
              {plan.activa ? "Activo" : "Inactivo"}
            </span>

            <button
              type="button"
              onClick={() => setEditando(true)}
              style={styles.editBtn}
            >
              Editar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
