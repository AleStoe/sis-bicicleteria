import { useEffect, useState } from "react";

import {
  crearReglaComercial,
  editarReglaComercial,
  listarReglasComerciales,
} from "../../services/reglasComercialesService";

import {
  styles,
  formatPercent,
} from "./configuracionComercialStyles";

const FORM_INICIAL = {
  nombre: "",
  tipo: "descuento",
  medio_pago: "efectivo",
  porcentaje: "",
  monto_fijo: "",
  requiere_pago_total: false,
  combinable: false,
  prioridad: "100",
  activa: true,
};

export default function ReglasComercialesPanel() {
  const [reglas, setReglas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);

  async function cargar() {
    try {
      const data = await listarReglasComerciales(false);
      setReglas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las reglas comerciales");
    }
  }

  function cambiar(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function cambiarValor(campo, valor) {
    const otroCampo = campo === "porcentaje" ? "monto_fijo" : "porcentaje";
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
      ...(valor !== "" ? { [otroCampo]: "" } : {}),
    }));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setError("");
    setMensaje("");
  }

  function comenzarEdicion(regla) {
    setEditandoId(regla.id);
    setForm({
      nombre: regla.nombre || "",
      tipo: regla.tipo || "descuento",
      medio_pago: regla.medio_pago || "",
      porcentaje: regla.porcentaje ?? "",
      monto_fijo: regla.monto_fijo ?? "",
      requiere_pago_total: Boolean(regla.requiere_pago_total),
      combinable: Boolean(regla.combinable),
      prioridad: String(regla.prioridad ?? 100),
      activa: Boolean(regla.activa),
    });
    setError("");
    setMensaje("");
  }

  function construirPayload() {
    const usaPorcentaje = form.porcentaje !== "";
    const usaMontoFijo = form.monto_fijo !== "";

    if (usaPorcentaje === usaMontoFijo) {
      throw new Error("Informá porcentaje o monto fijo, pero no ambos");
    }

    const valor = Number(usaPorcentaje ? form.porcentaje : form.monto_fijo);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error("El valor de la regla debe ser mayor a cero");
    }

    return {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      medio_pago: form.medio_pago || null,
      porcentaje: usaPorcentaje ? form.porcentaje : null,
      monto_fijo: usaMontoFijo ? form.monto_fijo : null,
      requiere_pago_total: Boolean(form.requiere_pago_total),
      combinable: Boolean(form.combinable),
      prioridad: Number(form.prioridad || 100),
      activa: Boolean(form.activa),
    };
  }

  async function guardarRegla(e) {
    e.preventDefault();

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const payload = construirPayload();

      if (editandoId) {
        await editarReglaComercial(editandoId, payload);
        setMensaje("Regla comercial actualizada");
      } else {
        await crearReglaComercial(payload);
        setMensaje("Regla comercial creada");
      }

      setEditandoId(null);
      setForm(FORM_INICIAL);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo guardar la regla comercial");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(regla) {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await editarReglaComercial(regla.id, { activa: !regla.activa });
      setMensaje(regla.activa ? "Regla desactivada" : "Regla activada");

      if (editandoId === regla.id) {
        cancelarEdicion();
      }

      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo cambiar el estado de la regla");
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

      <form onSubmit={guardarRegla} style={styles.inlineForm}>
        <input
          style={styles.input}
          value={form.nombre}
          onChange={(e) => cambiar("nombre", e.target.value)}
          placeholder="Nombre de regla"
          required
        />

        <select style={styles.input} value={form.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
          <option value="descuento">Descuento</option>
          <option value="recargo">Recargo</option>
        </select>

        <select style={styles.input} value={form.medio_pago} onChange={(e) => cambiar("medio_pago", e.target.value)}>
          <option value="">Todos los medios</option>
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
          onChange={(e) => cambiarValor("porcentaje", e.target.value)}
          placeholder="Porcentaje %"
        />

        <input
          style={styles.input}
          type="number"
          step="0.01"
          min="0"
          value={form.monto_fijo}
          onChange={(e) => cambiarValor("monto_fijo", e.target.value)}
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
          <input type="checkbox" checked={form.requiere_pago_total} onChange={(e) => cambiar("requiere_pago_total", e.target.checked)} />
          Pago total
        </label>

        <label style={styles.checkboxLabel}>
          <input type="checkbox" checked={form.combinable} onChange={(e) => cambiar("combinable", e.target.checked)} />
          Combinable
        </label>

        <label style={styles.checkboxLabel}>
          <input type="checkbox" checked={form.activa} onChange={(e) => cambiar("activa", e.target.checked)} />
          Activa
        </label>

        <div style={styles.actionsCell}>
          <button type="submit" style={styles.saveBtn} disabled={guardando}>
            {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear regla"}
          </button>
          {editandoId && (
            <button type="button" style={styles.cancelBtn} onClick={cancelarEdicion} disabled={guardando}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div style={styles.helpBox}>
        Usá porcentaje o monto fijo, nunca ambos. Las reglas no se eliminan porque pueden estar asociadas a ventas históricas: se desactivan.
      </div>

      {(error || mensaje) && (
        <div style={{ padding: "0 16px 16px" }}>
          {error && <div style={styles.errorBox}>{error}</div>}
          {mensaje && <div style={styles.successBox}>{mensaje}</div>}
        </div>
      )}

      <div style={styles.tableScroll}>
        <div style={styles.table}>
          <div style={styles.tableHeadReglas}>
            <div>Nombre</div>
            <div>Tipo</div>
            <div>Medio</div>
            <div>Valor</div>
            <div>Pago total</div>
            <div>Combinable</div>
            <div>Prioridad</div>
            <div>Estado</div>
            <div>Acciones</div>
          </div>

          {reglas.map((regla) => (
            <div key={regla.id} style={editandoId === regla.id ? styles.rowReglasActiva : styles.rowReglas}>
              <div><strong>{regla.nombre}</strong></div>
              <div>{regla.tipo === "descuento" ? "Descuento" : "Recargo"}</div>
              <div>{regla.medio_pago || "Todos"}</div>
              <div>{formatValor(regla)}</div>
              <div>{regla.requiere_pago_total ? "Sí" : "No"}</div>
              <div>{regla.combinable ? "Sí" : "No"}</div>
              <div>{regla.prioridad}</div>
              <div>
                <span style={{ ...styles.badge, ...(regla.activa ? styles.badgeActivo : styles.badgeInactivo) }}>
                  {regla.activa ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div style={styles.actionsCell}>
                <button type="button" style={styles.editBtn} onClick={() => comenzarEdicion(regla)} disabled={guardando}>
                  Editar
                </button>
                <button
                  type="button"
                  style={regla.activa ? styles.deactivateBtn : styles.activateBtn}
                  onClick={() => alternarEstado(regla)}
                  disabled={guardando}
                >
                  {regla.activa ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatValor(regla) {
  if (regla.porcentaje !== null && regla.porcentaje !== undefined) {
    return formatPercent(regla.porcentaje);
  }

  if (regla.monto_fijo !== null && regla.monto_fijo !== undefined) {
    return Number(regla.monto_fijo).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    });
  }

  return "-";
}
