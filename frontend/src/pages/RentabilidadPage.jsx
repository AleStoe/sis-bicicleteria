import { useEffect, useMemo, useState } from "react";
import {
  crearCierreRentabilidad,
  getCierresRentabilidad,
  getReglasRentabilidad,
  getRentabilidadMensual,
} from "../services/rentabilidadService";
import { formatMoney, formatPercent } from "../utils/formatters";

const USUARIO_ID = 1;
const SUCURSAL_ID = 1;

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function money(value) {
  return formatMoney(value || 0);
}

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(15,23,42,.06)",
};

const input = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

const primaryButton = {
  border: "none",
  borderRadius: 12,
  padding: "11px 14px",
  background: "#f97316",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  color: "#344054",
  fontWeight: 750,
  cursor: "pointer",
};

export default function RentabilidadPage() {
  const [periodoMes, setPeriodoMes] = useState(mesActual());
  const [idRegla, setIdRegla] = useState("");
  const [rentabilidad, setRentabilidad] = useState(null);
  const [reglas, setReglas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function cargarBase() {
    setError("");

    try {
      const [reglasData, cierresData] = await Promise.all([
        getReglasRentabilidad({ incluir_inactivas: true }),
        getCierresRentabilidad({ limit: 20, offset: 0 }),
      ]);

      setReglas(reglasData || []);
      setCierres(cierresData || []);

      const activa = (reglasData || []).find((r) => r.activa);

      if (activa && !idRegla) {
        setIdRegla(String(activa.id));
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar base de rentabilidad");
    }
  }
  async function cargarRentabilidad() {
    setLoading(true);
    setError("");
    try {
      const data = await getRentabilidadMensual({
        periodo_mes: periodoMes,
        id_sucursal: SUCURSAL_ID,
        id_regla_distribucion: idRegla,
      });
      setRentabilidad(data);
    } catch (err) {
      setError(err.message || "No se pudo calcular la rentabilidad mensual");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarRentabilidad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoMes, idRegla]);


  async function cerrarMes() {
    if (!rentabilidad?.regla_distribucion?.id) {
      setError("Necesitás una regla activa para cerrar el mes");
      return;
    }

    if (!window.confirm("¿Cerrar este mes? El cierre guarda una foto histórica.")) return;

    setError("");
    setOk("");
    try {
      await crearCierreRentabilidad({
        periodo_mes: periodoMes,
        id_sucursal: SUCURSAL_ID,
        id_regla_distribucion: rentabilidad.regla_distribucion.id,
        id_usuario: USUARIO_ID,
        observaciones: "Cierre mensual desde Rentabilidad",
      });
      setOk("Mes cerrado correctamente");
      await cargarBase();
    } catch (err) {
      setError(err.message || "No se pudo cerrar el mes");
    }
  }

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, color: "#101828" }}>Rentabilidad mensual</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Margen real vendido menos gastos operativos, con distribución mensual congelable.
          </p>
        </div>
        <button style={primaryButton} onClick={cerrarMes}>Cerrar mes</button>
      </header>

      {error && <div style={{ ...card, padding: 14, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>{error}</div>}
      {ok && <div style={{ ...card, padding: 14, borderColor: "#bbf7d0", color: "#166534", background: "#f0fdf4" }}>{ok}</div>}

      <section style={{ ...card, padding: 16, display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Mes
          <input style={input} type="date" value={periodoMes} onChange={(e) => setPeriodoMes(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#344054" }}>
          Regla de distribución
          <select style={input} value={idRegla} onChange={(e) => setIdRegla(e.target.value)}>
            <option value="">Sin regla</option>
            {reglas.map((r) => <option key={r.id} value={r.id}>{r.nombre} {r.activa ? "" : "(inactiva)"}</option>)}
          </select>
        </label>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <Metric title="Ventas netas" value={money(rentabilidad?.ventas_netas)} />
        <Metric title="CMV neto" value={money(rentabilidad?.cmv_neto)} />
        <Metric title="Margen bruto" value={money(rentabilidad?.margen_bruto)} strong />
        <Metric title="Gastos" value={money(rentabilidad?.gastos_operativos)} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(360px, .8fr)", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ ...card, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px" }}>Resultado distribuible</h2>
            {loading ? <p>Cargando...</p> : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 34, fontWeight: 950, color: "#f97316" }}>
                  {money(rentabilidad?.resultado_distribuible)}
                </div>
                <div style={{ color: "#667085" }}>
                  Fórmula: ventas netas - costo mercadería vendida - gastos operativos.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                        <th style={{ padding: 10 }}>Destino</th>
                        <th style={{ padding: 10 }}>Porcentaje</th>
                        <th style={{ padding: 10 }}>Monto sugerido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rentabilidad?.distribuciones_sugeridas || []).map((d) => (
                        <tr key={d.id_participante} style={{ borderBottom: "1px solid #f2f4f7" }}>
                          <td style={{ padding: 10, fontWeight: 800 }}>{d.participante_nombre}</td>
                          <td style={{ padding: 10 }}>{formatPercent(d.porcentaje)}</td>
                          <td style={{ padding: 10, fontWeight: 900 }}>{money(d.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <h2 style={{ margin: "0 0 12px" }}>Cierres históricos</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ color: "#667085", textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                    <th style={{ padding: 10 }}>Mes</th>
                    <th style={{ padding: 10 }}>Resultado</th>
                    <th style={{ padding: 10 }}>Regla</th>
                    <th style={{ padding: 10 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cierres.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: 18, color: "#667085" }}>Sin cierres todavía</td></tr>
                  ) : cierres.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f2f4f7" }}>
                      <td style={{ padding: 10 }}>{c.periodo_mes}</td>
                      <td style={{ padding: 10, fontWeight: 900 }}>{money(c.resultado_distribuible)}</td>
                      <td style={{ padding: 10 }}>{c.regla_nombre_snapshot || "-"}</td>
                      <td style={{ padding: 10 }}>{c.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside style={{ ...card, padding: 16 }}>
          <h2 style={{ margin: "0 0 12px" }}>
            Distribución vigente
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            {(rentabilidad?.distribuciones_sugeridas || []).map((d) => (
              <div
                key={d.id_participante}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid #f2f4f7",
                }}
              >
                <strong>{d.participante_nombre}</strong>
                <span>{formatPercent(d.porcentaje)}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid #eaecf0",
              color: "#667085",
              fontSize: 14,
            }}
          >
            La configuración se administra desde
            Configuración Comercial.
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ title, value, strong = false }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ color: "#667085", fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ color: strong ? "#f97316" : "#101828", fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
    </div>
  );
}
