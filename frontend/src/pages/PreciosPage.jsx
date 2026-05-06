import { useEffect, useMemo, useState } from "react";
import { listarProveedores } from "../services/proveedoresService";
import {
  listarPreciosDesfasados,
  recalcularPreciosProveedor,
} from "../services/preciosService";

export default function PreciosPage() {
  const [proveedores, setProveedores] = useState([]);
  const [idProveedor, setIdProveedor] = useState("");
  const [tipoCliente, setTipoCliente] = useState("minorista");

  const [desfasados, setDesfasados] = useState([]);
  const [preview, setPreview] = useState(null);

  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [idUsuario, setIdUsuario] = useState(1);
  const [motivo, setMotivo] = useState("Ajuste por actualización de proveedor");

  useEffect(() => {
    cargarProveedores();
  }, []);

  async function cargarProveedores() {
    try {
      setError("");
      const data = await listarProveedores({ solo_activos: true });
      setProveedores(data || []);
    } catch (err) {
      setError(err.message || "Error al cargar proveedores");
    }
  }

  async function buscarDesfasados() {
    if (!idProveedor) {
      setError("Seleccioná un proveedor");
      return;
    }

    try {
      setCargando(true);
      setError("");
      setMensaje("");
      setPreview(null);

      const data = await listarPreciosDesfasados({
        tipo_cliente: tipoCliente,
        id_proveedor: idProveedor,
      });

      setDesfasados(data?.items || []);

      if ((data?.total || 0) === 0) {
        setMensaje("No hay precios desfasados para este proveedor");
      }
    } catch (err) {
      setError(err.message || "Error al buscar precios desfasados");
    } finally {
      setCargando(false);
    }
  }

  async function generarPreview() {
    if (!idProveedor) {
      setError("Seleccioná un proveedor");
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const data = await recalcularPreciosProveedor({
        id_proveedor: Number(idProveedor),
        tipo_cliente: tipoCliente,
        aplicar: false,
      });

      setPreview(data);
      setDesfasados(data?.items || []);

      if ((data?.total_detectados || 0) === 0) {
        setMensaje("No hay cambios para aplicar");
      }
    } catch (err) {
      setError(err.message || "Error al generar preview");
    } finally {
      setProcesando(false);
    }
  }

  async function aplicarCambios() {
    if (!idProveedor) {
      setError("Seleccioná un proveedor");
      return;
    }

    if (!preview || preview.total_detectados === 0) {
      setError("Primero generá un preview con cambios");
      return;
    }

    if (!idUsuario || Number(idUsuario) <= 0) {
      setError("ID de usuario inválido");
      return;
    }

    if (!window.confirm("¿Aplicar cambios de precio al proveedor seleccionado?")) {
      return;
    }

    try {
      setProcesando(true);
      setError("");
      setMensaje("");

      const data = await recalcularPreciosProveedor({
        id_proveedor: Number(idProveedor),
        tipo_cliente: tipoCliente,
        aplicar: true,
        id_usuario: Number(idUsuario),
        motivo: motivo.trim() || "Recalculo manual por proveedor",
      });

      setPreview(data);
      setDesfasados(data?.items || []);
      setMensaje(`Cambios aplicados: ${data.total_aplicados}`);

      await buscarDesfasados();
    } catch (err) {
      setError(err.message || "Error al aplicar cambios");
    } finally {
      setProcesando(false);
    }
  }

  const resumen = useMemo(() => {
    const totalSubas = desfasados
      .filter((i) => Number(i.diferencia) > 0)
      .reduce((acc, i) => acc + Number(i.diferencia), 0);

    const totalBajas = desfasados
      .filter((i) => Number(i.diferencia) < 0)
      .reduce((acc, i) => acc + Number(i.diferencia), 0);

    return {
      cantidad: desfasados.length,
      subas: totalSubas,
      bajas: totalBajas,
    };
  }, [desfasados]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Precios</h1>
          <p style={styles.subtitle}>
            Detectá precios desfasados y aplicá recalculos manuales por proveedor.
          </p>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {mensaje && <div style={styles.success}>{mensaje}</div>}

      <section style={styles.card}>
        <div style={styles.filters}>
          <label style={styles.label}>
            Proveedor
            <select
              style={styles.input}
              value={idProveedor}
              onChange={(e) => {
                setIdProveedor(e.target.value);
                setPreview(null);
                setDesfasados([]);
              }}
            >
              <option value="">Seleccionar proveedor...</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} - {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Tipo cliente
            <select
              style={styles.input}
              value={tipoCliente}
              onChange={(e) => {
                setTipoCliente(e.target.value);
                setPreview(null);
                setDesfasados([]);
              }}
            >
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </label>

          <label style={styles.label}>
            ID usuario
            <input
              style={styles.input}
              type="number"
              value={idUsuario}
              onChange={(e) => setIdUsuario(e.target.value)}
            />
          </label>
        </div>

        <label style={styles.label}>
          Motivo para aplicar cambios
          <input
            style={styles.input}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>

        <div style={styles.actions}>
          <button
            style={styles.secondaryButton}
            type="button"
            onClick={buscarDesfasados}
            disabled={cargando || procesando}
          >
            {cargando ? "Buscando..." : "Ver desfasados"}
          </button>

          <button
            style={styles.secondaryButton}
            type="button"
            onClick={generarPreview}
            disabled={procesando}
          >
            {procesando ? "Procesando..." : "Preview recalculo"}
          </button>

          <button
            style={styles.primaryButton}
            type="button"
            onClick={aplicarCambios}
            disabled={procesando || !preview || preview.total_detectados === 0}
          >
            Aplicar cambios
          </button>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Desfasados</span>
          <strong style={styles.summaryValue}>{resumen.cantidad}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Subas acumuladas</span>
          <strong style={styles.summaryValue}>{formatMoney(resumen.subas)}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Bajas acumuladas</span>
          <strong style={styles.summaryValue}>{formatMoney(resumen.bajas)}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Modo</span>
          <strong style={styles.summaryValue}>
            {preview?.aplicado ? "Aplicado" : preview ? "Preview" : "-"}
          </strong>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <h2 style={styles.cardTitle}>Resultado</h2>
          <span style={styles.counter}>{desfasados.length} item(s)</span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Producto</th>
                <th style={styles.th}>Variante</th>
                <th style={styles.th}>Costo</th>
                <th style={styles.th}>Actual</th>
                <th style={styles.th}>Sugerido</th>
                <th style={styles.th}>Dif.</th>
                <th style={styles.th}>Margen real</th>
                <th style={styles.th}>Regla</th>
                <th style={styles.th}>Estado</th>
              </tr>
            </thead>

            <tbody>
              {desfasados.map((item) => (
                <tr key={`${item.id_variante}-${item.tipo_cliente}`}>
                  <td style={styles.tdStrong}>{item.producto_nombre}</td>
                  <td style={styles.td}>{item.nombre_variante}</td>
                  <td style={styles.td}>{formatMoney(item.costo_base)}</td>
                  <td style={styles.td}>{formatMoney(item.precio_actual)}</td>
                  <td style={styles.tdStrong}>{formatMoney(item.precio_sugerido)}</td>
                  <td
                    style={{
                      ...styles.tdStrong,
                      color: Number(item.diferencia) >= 0 ? "#137333" : "#b42318",
                    }}
                  >
                    {formatMoney(item.diferencia)}
                  </td>
                  <td style={styles.td}>{formatPercent(item.margen_real)}</td>
                  <td style={styles.td}>{item.regla_nombre}</td>
                  <td style={styles.td}>
                    {item.aplicado ? (
                      <span style={{ ...styles.badge, ...styles.badgeOk }}>
                        Aplicado
                      </span>
                    ) : (
                      <span style={{ ...styles.badge, ...styles.badgePreview }}>
                        Preview
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {!cargando && desfasados.length === 0 && (
                <tr>
                  <td style={styles.empty} colSpan={9}>
                    No hay resultados para mostrar.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td style={styles.empty} colSpan={9}>
                    Cargando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatMoney(value) {
  const n = Number(value || 0);

  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

function formatPercent(value) {
  const n = Number(value || 0) * 100;

  return `${n.toFixed(2)}%`;
}

const styles = {
  page: {
    padding: "24px",
  },
  header: {
    marginBottom: "18px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#666",
  },
  card: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "18px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    marginBottom: "18px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: "12px",
    marginBottom: "12px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontSize: "14px",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "14px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "8px",
    padding: "11px 14px",
    background: "#1f6feb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "10px 14px",
    background: "#f8f8f8",
    color: "#222",
    fontWeight: 600,
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "18px",
  },
  summaryCard: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "14px",
  },
  summaryLabel: {
    display: "block",
    color: "#666",
    fontSize: "13px",
    marginBottom: "6px",
  },
  summaryValue: {
    fontSize: "18px",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  counter: {
    color: "#777",
    fontSize: "13px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #ddd",
    padding: "10px",
    fontSize: "13px",
    color: "#555",
    whiteSpace: "nowrap",
  },
  td: {
    borderBottom: "1px solid #eee",
    padding: "10px",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  tdStrong: {
    borderBottom: "1px solid #eee",
    padding: "10px",
    fontSize: "14px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
  },
  badgeOk: {
    background: "#e7f7ed",
    color: "#137333",
  },
  badgePreview: {
    background: "#eef4ff",
    color: "#1f6feb",
  },
  empty: {
    padding: "18px",
    textAlign: "center",
    color: "#777",
  },
  error: {
    background: "#ffe8e8",
    color: "#9b1c1c",
    border: "1px solid #f5b5b5",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
  success: {
    background: "#e7f7ed",
    color: "#137333",
    border: "1px solid #b7e0c2",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
};