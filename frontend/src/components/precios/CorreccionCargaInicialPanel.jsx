import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";

import { corregirCargaInicialVariante } from "../../services/preciosService";
import { colors, controls, radius, spacing, typography } from "../../theme";

const IVA_OPCIONES = ["0", "10.5", "21", "27"];

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function margenDesde(costo, precio) {
  const costoNumero = numero(costo);
  if (costoNumero <= 0) return 0;
  return ((numero(precio) - costoNumero) / costoNumero) * 100;
}

export default function CorreccionCargaInicialPanel({
  variante,
  proveedores = [],
  usuarioId,
  onGuardado,
}) {
  const [form, setForm] = useState({
    costo_promedio_vigente: String(variante.costo_promedio_vigente ?? 0),
    precio_minorista: String(variante.precio_minorista ?? 0),
    precio_mayorista: String(variante.precio_mayorista ?? 0),
    alicuota_iva: String(variante.alicuota_iva ?? 21),
    proveedor_preferido_id: variante.proveedor_preferido_id
      ? String(variante.proveedor_preferido_id)
      : "",
    motivo: "",
  });
  const [margen, setMargen] = useState(() =>
    String(margenDesde(
      variante.costo_promedio_vigente,
      variante.precio_minorista
    ).toFixed(2))
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const ventasHistoricas = Number(variante.ventas_historicas || 0);
  const proveedorActualVisible = useMemo(
    () => proveedores.some(
      (proveedor) => String(proveedor.id) === String(form.proveedor_preferido_id)
    ),
    [form.proveedor_preferido_id, proveedores]
  );

  function cambiarMonto(campo, valor) {
    const siguiente = { ...form, [campo]: valor };
    setForm(siguiente);

    if (campo === "costo_promedio_vigente" || campo === "precio_minorista") {
      setMargen(
        margenDesde(
          siguiente.costo_promedio_vigente,
          siguiente.precio_minorista
        ).toFixed(2)
      );
    }
  }

  function cambiarMargen(valor) {
    setMargen(valor);
    const costo = numero(form.costo_promedio_vigente);
    const porcentaje = numero(valor);
    if (costo <= 0) return;

    setForm((actual) => ({
      ...actual,
      precio_minorista: (costo * (1 + porcentaje / 100)).toFixed(2),
    }));
  }

  async function guardar(event) {
    event.preventDefault();

    if (!form.motivo.trim()) {
      setError("Indicá el motivo de la corrección.");
      return;
    }

    if (
      ventasHistoricas > 0
      && !window.confirm(
        `Esta variante tiene ${ventasHistoricas} venta(s) histórica(s). `
        + "La corrección no recalculará costos ni importes ya vendidos. ¿Continuar?"
      )
    ) {
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setResultado(null);
      const data = await corregirCargaInicialVariante(variante.id, {
        costo_promedio_vigente: form.costo_promedio_vigente,
        precio_minorista: form.precio_minorista,
        precio_mayorista: form.precio_mayorista,
        alicuota_iva: form.alicuota_iva,
        gravado: numero(form.alicuota_iva) > 0,
        proveedor_preferido_id: form.proveedor_preferido_id
          ? Number(form.proveedor_preferido_id)
          : null,
        motivo: form.motivo.trim(),
        id_usuario: usuarioId,
      });
      setResultado(data);
      setForm((actual) => ({ ...actual, motivo: "" }));
      await onGuardado?.(data);
    } catch (err) {
      setError(err.message || "No se pudo registrar la corrección inicial.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.icon}><Wrench size={18} /></div>
        <div>
          <h3 style={styles.title}>Corrección de carga inicial</h3>
          <p style={styles.hint}>
            Corrige valores maestros. No ingresa, retira ni ajusta stock físico.
          </p>
        </div>
      </div>

      {ventasHistoricas > 0 && (
        <div style={styles.warning}>
          <AlertTriangle size={17} />
          <span>
            Tiene {ventasHistoricas} venta(s) histórica(s). Esas ventas conservarán
            sus precios y costos originales.
          </span>
        </div>
      )}

      <div style={styles.grid}>
        <label style={styles.field}>
          <span>Costo vigente</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.costo_promedio_vigente}
            onChange={(e) => cambiarMonto("costo_promedio_vigente", e.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span>Margen minorista sobre costo</span>
          <div style={styles.percentInput}>
            <input
              type="number"
              step="0.01"
              value={margen}
              onChange={(e) => cambiarMargen(e.target.value)}
              style={styles.inputBare}
            />
            <strong>%</strong>
          </div>
        </label>
        <label style={styles.field}>
          <span>Precio minorista</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.precio_minorista}
            onChange={(e) => cambiarMonto("precio_minorista", e.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span>Precio mayorista</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.precio_mayorista}
            onChange={(e) => cambiarMonto("precio_mayorista", e.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span>IVA</span>
          <select
            value={form.alicuota_iva}
            onChange={(e) => setForm((actual) => ({
              ...actual,
              alicuota_iva: e.target.value,
            }))}
            style={styles.input}
          >
            {IVA_OPCIONES.map((iva) => (
              <option key={iva} value={iva}>{iva}%</option>
            ))}
          </select>
        </label>
        <label style={styles.field}>
          <span>Proveedor preferido</span>
          <select
            value={form.proveedor_preferido_id}
            onChange={(e) => setForm((actual) => ({
              ...actual,
              proveedor_preferido_id: e.target.value,
            }))}
            style={styles.input}
          >
            <option value="">Sin proveedor</option>
            {!proveedorActualVisible && variante.proveedor_preferido_id && (
              <option value={variante.proveedor_preferido_id}>
                {variante.proveedor_preferido_nombre || "Proveedor actual (inactivo)"}
              </option>
            )}
            {proveedores.map((proveedor) => (
              <option key={proveedor.id} value={proveedor.id}>
                {proveedor.nombre_comercial || proveedor.nombre || proveedor.razon_social}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={styles.field}>
        <span>Motivo de la corrección</span>
        <input
          value={form.motivo}
          maxLength={500}
          placeholder="Ej: costo inicial cargado incorrectamente"
          onChange={(e) => setForm((actual) => ({ ...actual, motivo: e.target.value }))}
          style={styles.input}
        />
      </label>

      {error && <div style={styles.error}>{error}</div>}
      {resultado && (
        <div style={styles.success}>
          <CheckCircle2 size={17} />
          <span>
            Corrección registrada y auditada.
            {resultado.advertencia ? ` ${resultado.advertencia}` : ""}
          </span>
        </div>
      )}

      <div style={styles.actions}>
        <button type="submit" disabled={guardando} style={styles.button}>
          {guardando ? "Registrando..." : "Registrar corrección"}
        </button>
      </div>
    </form>
  );
}

const styles = {
  panel: {
    display: "grid",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    border: `1px solid ${colors.primaryBorder}`,
    borderRadius: radius.md,
    background: "#fffaf5",
  },
  header: { display: "flex", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    borderRadius: radius.sm,
    color: "#c2410c",
    background: "#ffedd5",
  },
  title: { ...typography.sectionTitle, margin: 0 },
  hint: { ...typography.small, margin: "3px 0 0", color: colors.textMuted },
  warning: {
    display: "flex",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    color: "#9a3412",
    background: "#ffedd5",
    fontWeight: 700,
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: spacing.sm,
  },
  field: { display: "grid", gap: 5, fontSize: 12, fontWeight: 800 },
  input: {
    minHeight: controls.minHeight,
    padding: controls.padding,
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    background: colors.surface,
  },
  percentInput: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: controls.minHeight,
    padding: controls.padding,
    paddingTop: 0,
    paddingBottom: 0,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    background: colors.surface,
  },
  inputBare: {
    width: "100%",
    minWidth: 0,
    height: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    font: "inherit",
  },
  actions: { display: "flex", justifyContent: "flex-end" },
  button: {
    minHeight: controls.minHeight,
    padding: controls.padding,
    borderRadius: radius.sm,
    border: 0,
    color: "#fff",
    background: colors.primary,
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    color: colors.danger,
    background: "#fef2f2",
    fontWeight: 700,
  },
  success: {
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    color: "#047857",
    background: "#ecfdf5",
    fontWeight: 700,
  },
};
