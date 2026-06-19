import { useEffect, useMemo, useState } from "react";
import {
  listarTarjetaPlanes,
  simularReglasComerciales,
} from "../../services/reglasComercialesService";
import { formatMoney, formatPercent } from "../../utils/formatters";
import {
  calcularAjusteRedondeo,
  redondearComercial,
} from "../../utils/preciosPagoUtils";

let planesCache = null;
let planesPromise = null;

async function cargarPlanesActivos() {
  if (planesCache) return planesCache;

  if (!planesPromise) {
    planesPromise = listarTarjetaPlanes(true).then((planes) => {
      planesCache = planes || [];
      return planesCache;
    });
  }

  return planesPromise;
}

function toMonto(value) {
  const numero = Number(value || 0);
  return Number.isFinite(numero) ? numero : 0;
}

export default function CalculadoraPrecioPagoPreview({
  montoBase,
  onUsarComoMinorista,
  onUsarComoMayorista,
  mostrarAcciones = true,
  precioMayoristaDisponible = true,
  baseRedondeo = 100,
}) {
  const [montoDeseado, setMontoDeseado] = useState(montoBase || "");
  const [planesTarjeta, setPlanesTarjeta] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [verDetalle, setVerDetalle] = useState(false);
  const [filasSimuladas, setFilasSimuladas] = useState([]);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        setCargando(true);
        setError("");
        const data = await cargarPlanesActivos();
        if (activo) setPlanesTarjeta(data);
      } catch (err) {
        if (activo) {
          setError(err.message || "No se pudieron cargar los planes de tarjeta");
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const montoContado = toMonto(montoDeseado);
  const montoAplicable = montoContado > 0 ? String(montoContado) : "";
  const mostrarAdvertenciaPrecio = montoContado > 1000000;

  const planes = useMemo(() => {
    return (planesTarjeta || [])
      .filter((plan) => plan.activa !== false)
      .filter((plan) => String(plan.medio_pago || "tarjeta") === "tarjeta");
  }, [planesTarjeta]);

  useEffect(() => {
    let activo = true;

    async function simularPlanes() {
      if (!montoContado || montoContado <= 0 || planes.length === 0) {
        setFilasSimuladas([]);
        return;
      }

      try {
        setError("");
        const resultados = await Promise.all(
          planes.map(async (plan) => {
            const simulacion = await simularReglasComerciales({
              subtotal_base: montoContado,
              medios_pago: [
                {
                  medio_pago: "tarjeta",
                  monto_base: montoContado,
                  cuotas: plan.cuotas,
                  entidad: plan.entidad || null,
                },
              ],
            });

            const tramo = simulacion?.tramos_pago?.[0] || {};
            const totalExacto = Number(tramo.monto_total_cobrado || 0);
            const porcentaje = Number(
              tramo.porcentaje_recargo_aplicado ??
                plan.porcentaje_recargo_cliente ??
                0
            );
            const totalRedondeado = redondearComercial(totalExacto, baseRedondeo);

            return {
              id: plan.id,
              nombre: plan.nombre,
              porcentaje,
              totalExacto,
              totalRedondeado,
              ajusteRedondeo: calcularAjusteRedondeo(totalExacto, totalRedondeado),
            };
          })
        );

        if (activo) setFilasSimuladas(resultados);
      } catch (err) {
        if (activo) {
          setFilasSimuladas([]);
          setError(err.message || "No se pudo simular la referencia con tarjeta");
        }
      }
    }

    const timer = setTimeout(simularPlanes, 250);

    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [baseRedondeo, montoContado, planes]);

  function usarComoMinorista() {
    if (!montoAplicable || !onUsarComoMinorista) return;
    onUsarComoMinorista(montoAplicable);
  }

  function usarComoMayorista() {
    if (!montoAplicable || !onUsarComoMayorista || !precioMayoristaDisponible) return;
    onUsarComoMayorista(montoAplicable);
  }

  return (
    <section style={styles.box}>
      <div style={styles.header}>
        <div>
          <h4 style={styles.title}>Referencia rápida con tarjeta</h4>
          <p style={styles.help}>
            El precio guardado sigue siendo contado/transferencia.
          </p>
        </div>
      </div>

      <div style={styles.mainGrid}>
        <label style={styles.label}>
          Quiero recibir en efectivo/transferencia
          <input
            style={styles.input}
            type="number"
            min="0"
            value={montoDeseado}
            onChange={(e) => setMontoDeseado(e.target.value)}
            placeholder="Ej: 20000"
          />
        </label>

        {mostrarAcciones && (
          <div style={styles.actions}>
            <button
              type="button"
              style={styles.actionButton}
              onClick={usarComoMinorista}
              disabled={!montoAplicable}
            >
              Usar como minorista
            </button>
            <button
              type="button"
              style={{
                ...styles.actionButton,
                ...(!precioMayoristaDisponible ? styles.actionButtonDisabled : {}),
              }}
              onClick={usarComoMayorista}
              disabled={!montoAplicable || !precioMayoristaDisponible}
            >
              Usar como mayorista
            </button>
          </div>
        )}
      </div>

      {mostrarAdvertenciaPrecio && (
        <div style={styles.warning}>
          Revisá este precio. ¿Seguro que quisiste cargar este importe?
        </div>
      )}

      <div style={styles.baseLine}>
        <span>Monto contado</span>
        <strong>{formatMoney(montoContado)}</strong>
      </div>

      {cargando && <p style={styles.state}>Cargando planes...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!cargando && !error && montoContado <= 0 && (
        <p style={styles.state}>Ingresá un monto para ver la referencia.</p>
      )}

      {!cargando && !error && montoContado > 0 && filasSimuladas.length === 0 && (
        <p style={styles.state}>No hay planes de tarjeta activos.</p>
      )}

      {filasSimuladas.length > 0 && (
        <>
          <ul style={styles.simpleList}>
            {filasSimuladas.map((fila) => (
              <li key={fila.id} style={styles.simpleItem}>
                <span>{fila.nombre}</span>
                <strong>{formatMoney(fila.totalRedondeado)}</strong>
              </li>
            ))}
          </ul>

          <button
            type="button"
            style={styles.detailButton}
            onClick={() => setVerDetalle((actual) => !actual)}
          >
            {verDetalle ? "Ocultar detalle" : "Ver detalle"}
          </button>

          {verDetalle && (
            <div style={styles.detailList}>
              {filasSimuladas.map((fila) => (
                <div key={fila.id} style={styles.detailRow}>
                  <strong>{fila.nombre}</strong>
                  <span>Recargo {formatPercent(fila.porcentaje)}</span>
                  <span>Exacto {formatMoney(fila.totalExacto)}</span>
                  <span>Redondeado {formatMoney(fila.totalRedondeado)}</span>
                  <span>Diferencia {formatMoney(fila.ajusteRedondeo)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const styles = {
  box: {
    display: "grid",
    gap: "8px",
    border: "1px solid #d9e2ec",
    borderRadius: "8px",
    padding: "10px 12px",
    background: "#fbfdff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 900,
    color: "#172033",
  },
  help: {
    margin: "2px 0 0",
    color: "#5f6f82",
    fontSize: "12px",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
    alignItems: "end",
  },
  label: {
    display: "grid",
    gap: "5px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "8px 10px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff",
  },
  actions: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
  },
  actionButton: {
    border: "1px solid #86efac",
    borderRadius: "7px",
    padding: "8px 10px",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  actionButtonDisabled: {
    borderColor: "#cbd5e1",
    background: "#f1f5f9",
    color: "#94a3b8",
    cursor: "not-allowed",
  },
  baseLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    color: "#334155",
    fontSize: "13px",
  },
  warning: {
    border: "1px solid #facc15",
    borderRadius: "7px",
    padding: "8px 10px",
    background: "#fefce8",
    color: "#854d0e",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1.35,
  },
  simpleList: {
    display: "grid",
    gap: "5px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  simpleItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    padding: "3px 0",
    color: "#1f2937",
    fontSize: "13px",
  },
  detailButton: {
    justifySelf: "start",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "5px 8px",
    background: "#ffffff",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  detailList: {
    display: "grid",
    gap: "6px",
    borderTop: "1px solid #e2e8f0",
    paddingTop: "8px",
  },
  detailRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
    color: "#475569",
    fontSize: "12px",
  },
  state: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
  },
  error: {
    margin: 0,
    color: "#b91c1c",
    fontSize: "12px",
  },
};
