import { useEffect, useState } from "react";
import {
  listarTurnosAgenda,
  crearTurnoAgenda,
  cambiarEstadoTurnoAgenda,
} from "../services/agendaTallerService";

export default function AgendaTallerPage() {
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    cliente_nombre: "",
    cliente_telefono: "",
    fecha: "",
    hora_inicio: "",
    tipo_servicio: "",
    descripcion: "",
  });

  useEffect(() => {
    cargarTurnos();
  }, []);

  async function cargarTurnos() {
    try {
      setLoading(true);

      const data = await listarTurnosAgenda();

      setTurnos(data ?? []);
    } catch (error) {
      console.error(error);
      alert("No se pudo cargar la agenda");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await crearTurnoAgenda({
        ...form,
        id_sucursal: 1,
        id_usuario_creador: 1,
      });

      setForm({
        cliente_nombre: "",
        cliente_telefono: "",
        fecha: "",
        hora_inicio: "",
        tipo_servicio: "",
        descripcion: "",
      });

      await cargarTurnos();
    } catch (error) {
      console.error(error);
      alert("No se pudo crear el turno");
    }
  }

  async function cambiarEstado(turnoId, estado) {
    try {
      await cambiarEstadoTurnoAgenda(turnoId, {
        estado,
      });

      await cargarTurnos();
    } catch (error) {
      console.error(error);
      alert("No se pudo actualizar el estado");
    }
  }

  return (
    <div style={styles.page}>
      <h1>Agenda Taller</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2>Nuevo turno</h2>

          <form onSubmit={handleSubmit}>
            <input
              placeholder="Cliente"
              value={form.cliente_nombre}
              onChange={(e) =>
                setForm({
                  ...form,
                  cliente_nombre: e.target.value,
                })
              }
              style={styles.input}
            />

            <input
              placeholder="Teléfono"
              value={form.cliente_telefono}
              onChange={(e) =>
                setForm({
                  ...form,
                  cliente_telefono: e.target.value,
                })
              }
              style={styles.input}
            />

            <input
              type="date"
              value={form.fecha}
              onChange={(e) =>
                setForm({
                  ...form,
                  fecha: e.target.value,
                })
              }
              style={styles.input}
            />

            <input
              type="time"
              value={form.hora_inicio}
              onChange={(e) =>
                setForm({
                  ...form,
                  hora_inicio: e.target.value,
                })
              }
              style={styles.input}
            />

            <input
              placeholder="Tipo de servicio"
              value={form.tipo_servicio}
              onChange={(e) =>
                setForm({
                  ...form,
                  tipo_servicio: e.target.value,
                })
              }
              style={styles.input}
            />

            <textarea
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) =>
                setForm({
                  ...form,
                  descripcion: e.target.value,
                })
              }
              style={styles.textarea}
            />

            <button style={styles.button}>
              Crear turno
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2>Turnos</h2>

          {loading ? (
            <div>Cargando...</div>
          ) : (
            turnos.map((turno) => (
              <div key={turno.id} style={styles.turno}>
                <div>
                  <strong>{turno.cliente_nombre}</strong>
                </div>

                <div>
                  {turno.fecha} - {turno.hora_inicio}
                </div>

                <div>{turno.tipo_servicio}</div>

                <div style={styles.estado}>
                  {turno.estado}
                </div>

                <div style={styles.actions}>
                  <button
                    onClick={() =>
                      cambiarEstado(
                        turno.id,
                        "confirmado"
                      )
                    }
                  >
                    Confirmar
                  </button>

                  <button
                    onClick={() =>
                      cambiarEstado(
                        turno.id,
                        "en_taller"
                      )
                    }
                  >
                    En taller
                  </button>

                  <button
                    onClick={() =>
                      cambiarEstado(
                        turno.id,
                        "cancelado"
                      )
                    }
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: 20,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 20,
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 20,
  },

  input: {
    width: "100%",
    marginBottom: 10,
    padding: 10,
  },

  textarea: {
    width: "100%",
    minHeight: 100,
    marginBottom: 10,
    padding: 10,
  },

  button: {
    padding: "10px 14px",
    cursor: "pointer",
  },

  turno: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  estado: {
    marginTop: 6,
    fontWeight: 700,
  },

  actions: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
};