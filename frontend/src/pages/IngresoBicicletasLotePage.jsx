import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChevronRight,
  PackagePlus,
  ScanLine,
  Trash2,
} from "lucide-react";
import { listarProveedores } from "../services/proveedoresService";
import {
  crearIngresoStockLote,
  listarStock,
} from "../services/stockService";
import { useSession } from "../context/SessionContext";
import { formatMoney, formatNumber } from "../utils/formatters";
import { formatProductoVariante } from "../utils/productPresentation";

const PASO_ESCANEO = "escaneo";
const PASO_REVISION = "revision";

export default function IngresoBicicletasLotePage() {
  return (
    <IngresoMercaderiaGuiadaPage
      tipoOperativo="bicicleta"
      titulo="Bicicletas por lote"
      subtitulo="Escanea todas las bicicletas primero. Despues revisas proveedor, cantidad y costo antes de guardar."
      entidadSingular="bicicleta"
      entidadPlural="bicicletas"
      rutaAlta="/mercaderia/bicicletas/alta"
      confirmacion="Las bicicletas quedan disponibles como stock en caja. No se crea numero de cuadro."
    />
  );
}

export function IngresoMercaderiaGuiadaPage({
  tipoOperativo = "no_bicicletas",
  titulo = "Mercaderia por lote",
  subtitulo = "Escanea todo lo que ya existe en el sistema. Despues revisas proveedor, cantidad y costo antes de guardar.",
  entidadSingular = "producto",
  entidadPlural = "productos",
  rutaAlta = "/mercaderia/alta",
  confirmacion = "El stock queda cargado como ingreso fisico. Si algo no existe, cargalo primero por el alta normal.",
}) {
  const { usuarioId, sucursalId } = useSession();
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [paso, setPaso] = useState(PASO_ESCANEO);
  const [codigo, setCodigo] = useState("");
  const [lineas, setLineas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [coincidencias, setCoincidencias] = useState([]);
  const [noEncontrados, setNoEncontrados] = useState([]);

  useEffect(() => {
    listarProveedores({ solo_activos: true })
      .then((data) => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => setProveedores([]));
  }, []);

  useEffect(() => {
    if (paso === PASO_ESCANEO) {
      setTimeout(() => scannerRef.current?.focus(), 50);
    }
  }, [paso, lineas.length]);

  const totales = useMemo(() => {
    return lineas.reduce(
      (acc, linea) => {
        const cantidad = Number(linea.cantidad || 0);
        const costoUnitario = Number(linea.costo_unitario || 0);
        acc.unidades += cantidad;
        acc.costo += cantidad * costoUnitario;
        return acc;
      },
      { unidades: 0, costo: 0 },
    );
  }, [lineas]);

  async function buscarCodigo(event) {
    event.preventDefault();
    const texto = codigo.trim();
    if (!texto) return;

    setBuscando(true);
    setError("");
    setOk("");
    setCoincidencias([]);

    try {
      const resultados = await listarStock({
        q: texto,
        id_sucursal: sucursalId,
        tipo_operativo: tipoOperativo,
        ordenar_por: "producto",
        orden: "asc",
        limit: 20,
      });

      const items = Array.isArray(resultados) ? resultados : [];
      const exactas = items.filter((item) => coincideExacto(item, texto));
      const elegibles = exactas.length ? exactas : items;

      if (elegibles.length === 1) {
        agregarLinea(elegibles[0]);
        setCodigo("");
        setOk(`${capitalizar(entidadSingular)} sumado al lote.`);
      } else if (elegibles.length > 1) {
        setCoincidencias(elegibles);
        setError(`Hay varios ${entidadPlural} posibles. Elegi el correcto para sumar.`);
      } else {
        setNoEncontrados((actuales) =>
          actuales.includes(texto) ? actuales : [texto, ...actuales].slice(0, 8),
        );
        setError(
          `No encontre ${articuloIndefinido(entidadSingular)} activo con ese codigo. Si es nuevo, cargalo por alta normal.`,
        );
      }
    } catch (err) {
      setError(err.message || `No se pudo buscar ${articuloDefinido(entidadSingular)}.`);
    } finally {
      setBuscando(false);
    }
  }

  function agregarLinea(item) {
    setLineas((actuales) => {
      const index = actuales.findIndex((linea) => linea.variante_id === item.variante_id);
      if (index >= 0) {
        return actuales.map((linea, pos) =>
          pos === index
            ? { ...linea, cantidad: Number(linea.cantidad || 0) + 1 }
            : linea,
        );
      }

      return [
        ...actuales,
        {
          variante_id: item.variante_id,
          producto_id: item.producto_id,
          nombre: formatProductoVariante(item.producto_nombre, item.nombre_variante),
          producto_nombre: item.producto_nombre,
          nombre_variante: item.nombre_variante,
          sku: item.sku || "",
          codigo_barras: item.codigo_barras || "",
          codigo_proveedor: item.codigo_proveedor || "",
          imagen_url: item.imagen_url || item.producto_imagen_url || null,
          cantidad: 1,
          costo_unitario:
            item.costo_promedio_vigente !== null && item.costo_promedio_vigente !== undefined
              ? String(Number(item.costo_promedio_vigente || 0))
              : "",
          id_proveedor: item.id_proveedor ? String(item.id_proveedor) : "",
          proveedor_nombre: item.proveedor_nombre || "",
          observacion: "",
        },
      ];
    });
  }

  function seleccionarCoincidencia(item) {
    agregarLinea(item);
    setCodigo("");
    setCoincidencias([]);
    setError("");
    setOk(`${capitalizar(entidadSingular)} sumado al lote.`);
  }

  function actualizarLinea(varianteId, campo, value) {
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.variante_id === varianteId ? { ...linea, [campo]: value } : linea,
      ),
    );
  }

  function quitarLinea(varianteId) {
    setLineas((actuales) => actuales.filter((linea) => linea.variante_id !== varianteId));
  }

  function cambiarCantidad(varianteId, delta) {
    setLineas((actuales) =>
      actuales.map((linea) => {
        if (linea.variante_id !== varianteId) return linea;
        return {
          ...linea,
          cantidad: Math.max(1, Number(linea.cantidad || 1) + delta),
        };
      }),
    );
  }

  function validarRevision() {
    if (!lineas.length) return `Escanea al menos ${articuloIndefinido(entidadSingular)}.`;

    const incompleta = lineas.find(
      (linea) =>
        !linea.id_proveedor ||
        Number(linea.cantidad || 0) <= 0 ||
        linea.costo_unitario === "" ||
        Number(linea.costo_unitario) < 0,
    );

    if (incompleta) {
      return `Revisa proveedor, cantidad y costo de ${incompleta.nombre}.`;
    }

    return "";
  }

  async function confirmarIngreso() {
    const validacion = validarRevision();
    if (validacion) {
      setError(validacion);
      return;
    }

    setProcesando(true);
    setError("");
    setOk("");

    try {
      const payload = {
        id_sucursal: sucursalId,
        id_usuario: usuarioId,
        origen_ingreso: "manual",
        observacion: `Ingreso guiado de ${entidadPlural}: ${lineas.length} variante(s), ${totales.unidades} unidad(es).`,
        items: lineas.map((linea) => {
          const cantidad = Number(linea.cantidad || 0);
          const costoUnitario = Number(linea.costo_unitario || 0);
          return {
            id_variante: Number(linea.variante_id),
            id_proveedor: Number(linea.id_proveedor),
            cantidad_ingresada: cantidad,
            costo_productos: cantidad * costoUnitario,
            gastos_adicionales: 0,
            observacion:
              linea.observacion?.trim() ||
              `Ingreso guiado de ${entidadSingular}: ${linea.nombre}`,
          };
        }),
      };

      const respuesta = await crearIngresoStockLote(payload);
      setOk(
        `Ingreso confirmado: ${formatNumber(respuesta.total_unidades)} ${entidadPlural} cargado(s).`,
      );
      setLineas([]);
      setPaso(PASO_ESCANEO);
      setCodigo("");
    } catch (err) {
      setError(err.message || "No se pudo confirmar el lote.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Ingreso guiado</div>
          <h1 style={styles.title}>{titulo}</h1>
          <p style={styles.subtitle}>{subtitulo}</p>
        </div>
        <div style={styles.headerSummary}>
          <span>{formatNumber(totales.unidades)} unidad(es)</span>
          <strong>{formatMoney(totales.costo)}</strong>
        </div>
      </header>

      <div style={styles.steps}>
        <Step active={paso === PASO_ESCANEO} done={lineas.length > 0} number="1" label="Escanear" />
        <ChevronRight size={18} color="#98a2b3" />
        <Step active={paso === PASO_REVISION} number="2" label="Revisar y confirmar" />
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {ok ? <div style={styles.ok}>{ok}</div> : null}

      {paso === PASO_ESCANEO ? (
        <section style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <ScanLine size={22} color="#ff6a00" />
              <div>
                <h2 style={styles.cardTitle}>Escaneo de codigos</h2>
                <p style={styles.cardText}>Usa lector o teclado. Cada lectura suma una unidad al lote.</p>
              </div>
            </div>

            <form onSubmit={buscarCodigo} style={styles.scannerForm}>
              <input
                ref={scannerRef}
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
                placeholder="Codigo de barras, SKU, codigo proveedor o nombre..."
                style={styles.scannerInput}
                disabled={buscando}
              />
              <button type="submit" style={styles.primaryButton} disabled={buscando}>
                {buscando ? "Buscando..." : "Sumar"}
              </button>
            </form>

            {coincidencias.length ? (
              <div style={styles.matches}>
                {coincidencias.map((item) => (
                  <button
                    key={`${item.sucursal_id}-${item.variante_id}`}
                    type="button"
                    style={styles.matchRow}
                    onClick={() => seleccionarCoincidencia(item)}
                  >
                    <Bike size={20} color="#ff6a00" />
                    <span>
                      <strong>{formatProductoVariante(item.producto_nombre, item.nombre_variante)}</strong>
                      <small>
                        SKU {item.sku || "-"} · Prov {item.codigo_proveedor || "-"} · Stock {formatNumber(item.stock_disponible)}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {noEncontrados.length ? (
              <div style={styles.notFoundBox}>
                <strong>No encontrados en este lote</strong>
                <p>
                  Estos codigos no se cargaron. Si son nuevos, cargalos por el alta normal.
                </p>
                <div style={styles.notFoundList}>
                  {noEncontrados.map((item) => (
                    <span key={item} style={styles.notFoundChip}>{item}</span>
                  ))}
                </div>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => navigate(rutaAlta)}
                >
                  Ir al alta normal
                </button>
              </div>
            ) : null}
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <PackagePlus size={22} color="#0f172a" />
              <div>
                <h2 style={styles.cardTitle}>Lote armado</h2>
                <p style={styles.cardText}>Cuando termines de escanear, pasa a revision para cargar costos.</p>
              </div>
            </div>

            <LineasResumen
              lineas={lineas}
              onQuitar={quitarLinea}
              entidadPlural={entidadPlural}
            />

            <button
              type="button"
              style={{
                ...styles.primaryButton,
                width: "100%",
                marginTop: 14,
                opacity: lineas.length ? 1 : 0.55,
              }}
              disabled={!lineas.length}
              onClick={() => {
                setPaso(PASO_REVISION);
                setError("");
                setOk("");
              }}
            >
              Pasar a revision
            </button>
          </div>
        </section>
      ) : (
        <section style={styles.card}>
          <div style={styles.reviewHeader}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setPaso(PASO_ESCANEO);
                setError("");
              }}
            >
              <ArrowLeft size={18} /> Volver a escanear
            </button>
            <div style={styles.reviewTotals}>
              <span>{formatNumber(totales.unidades)} unidad(es)</span>
              <strong>{formatMoney(totales.costo)}</strong>
            </div>
          </div>

          <div style={styles.reviewTable}>
            {lineas.map((linea) => (
              <div key={linea.variante_id} style={styles.reviewRow}>
                <div style={styles.bikeCell}>
                  <div style={styles.bikeIcon}>
                    <Bike size={22} />
                  </div>
                  <div>
                    <strong>{linea.nombre}</strong>
                    <small>
                      SKU {linea.sku || "-"} · Prov {linea.codigo_proveedor || "-"}
                    </small>
                  </div>
                </div>

                <div style={styles.quantityControl}>
                  <button type="button" onClick={() => cambiarCantidad(linea.variante_id, -1)}>-</button>
                  <input
                    type="number"
                    min="1"
                    value={linea.cantidad}
                    onChange={(event) =>
                      actualizarLinea(
                        linea.variante_id,
                        "cantidad",
                        Math.max(1, Number(event.target.value || 1)),
                      )
                    }
                  />
                  <button type="button" onClick={() => cambiarCantidad(linea.variante_id, 1)}>+</button>
                </div>

                <label style={styles.field}>
                  Proveedor
                  <select
                    value={linea.id_proveedor}
                    onChange={(event) =>
                      actualizarLinea(linea.variante_id, "id_proveedor", event.target.value)
                    }
                  >
                    <option value="">Elegir</option>
                    {proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.field}>
                  Costo unitario
                  <input
                    type="number"
                    min="0"
                    value={linea.costo_unitario}
                    onChange={(event) =>
                      actualizarLinea(linea.variante_id, "costo_unitario", event.target.value)
                    }
                    placeholder="0"
                  />
                </label>

                <label style={styles.field}>
                  Observacion
                  <input
                    value={linea.observacion}
                    onChange={(event) =>
                      actualizarLinea(linea.variante_id, "observacion", event.target.value)
                    }
                    placeholder="Remito, color, detalle..."
                  />
                </label>

                <div style={styles.lineTotal}>
                  <span>Total linea</span>
                  <strong>
                    {formatMoney(Number(linea.cantidad || 0) * Number(linea.costo_unitario || 0))}
                  </strong>
                </div>

                <button
                  type="button"
                  style={styles.iconButton}
                  onClick={() => quitarLinea(linea.variante_id)}
                  title="Quitar linea"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div style={styles.confirmBar}>
            <div>
              <strong>Confirmar ingreso a stock fisico</strong>
              <p>{confirmacion}</p>
            </div>
            <button
              type="button"
              style={styles.primaryButton}
              disabled={procesando || !lineas.length}
              onClick={confirmarIngreso}
            >
              {procesando ? "Confirmando..." : "Confirmar lote"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Step({ active, done, number, label }) {
  return (
    <div style={{ ...styles.step, ...(active ? styles.stepActive : {}) }}>
      <span>{done ? <CheckCircle2 size={16} /> : number}</span>
      {label}
    </div>
  );
}

function LineasResumen({ lineas, onQuitar, entidadPlural }) {
  if (!lineas.length) {
    return (
      <div style={styles.empty}>
        <Bike size={28} />
        <strong>Todavia no escaneaste {entidadPlural}.</strong>
        <span>El lote se va armando automaticamente con cada codigo.</span>
      </div>
    );
  }

  return (
    <div style={styles.summaryList}>
      {lineas.map((linea) => (
        <div key={linea.variante_id} style={styles.summaryRow}>
          <div>
            <strong>{linea.nombre}</strong>
            <small>SKU {linea.sku || "-"} · Prov {linea.codigo_proveedor || "-"}</small>
          </div>
          <span>x{formatNumber(linea.cantidad)}</span>
          <button type="button" onClick={() => onQuitar(linea.variante_id)}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function coincideExacto(item, texto) {
  const normalizado = normalizar(texto);
  return [
    item.codigo_barras,
    item.sku,
    item.codigo_proveedor,
    item.variante_id,
  ].some((value) => normalizar(value) === normalizado);
}

function normalizar(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function capitalizar(value) {
  const texto = String(value || "");
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

function articuloIndefinido(value) {
  return String(value || "").toLowerCase().endsWith("a") ? "una" : "un";
}

function articuloDefinido(value) {
  return String(value || "").toLowerCase().endsWith("a") ? "la" : "el";
}

const styles = {
  page: {
    display: "grid",
    gap: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  eyebrow: {
    color: "#ff6a00",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: "4px 0 4px",
    fontSize: 32,
    lineHeight: 1.05,
  },
  subtitle: {
    margin: 0,
    color: "#475467",
    fontWeight: 650,
  },
  headerSummary: {
    minWidth: 210,
    padding: 16,
    borderRadius: 12,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    display: "grid",
    gap: 4,
    textAlign: "right",
  },
  steps: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  step: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: 999,
    background: "#fff",
    color: "#475467",
    fontWeight: 850,
  },
  stepActive: {
    borderColor: "#ff6a00",
    color: "#c2410c",
    background: "#fff7ed",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(360px, .85fr)",
    gap: 16,
    alignItems: "start",
  },
  card: {
    background: "#fff",
    border: "1px solid #dbe3ef",
    borderRadius: 14,
    boxShadow: "0 8px 20px rgba(15,23,42,.05)",
    padding: 16,
  },
  cardHeader: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
  },
  cardText: {
    margin: "3px 0 0",
    color: "#667085",
    fontWeight: 650,
  },
  scannerForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
  },
  scannerInput: {
    minHeight: 56,
    border: "2px solid #d0d5dd",
    borderRadius: 12,
    padding: "0 16px",
    fontSize: 18,
    fontWeight: 800,
    outline: 0,
  },
  primaryButton: {
    border: 0,
    borderRadius: 12,
    background: "#ff6a00",
    color: "#fff",
    fontWeight: 950,
    fontSize: 16,
    padding: "13px 18px",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d0d5dd",
    borderRadius: 12,
    background: "#fff",
    color: "#0f172a",
    fontWeight: 850,
    fontSize: 15,
    padding: "11px 14px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  matches: {
    marginTop: 12,
    display: "grid",
    gap: 8,
  },
  matchRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    border: "1px solid #dbe3ef",
    background: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
  },
  summaryList: {
    display: "grid",
    gap: 8,
    maxHeight: 430,
    overflow: "auto",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gap: 10,
    alignItems: "center",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
  },
  empty: {
    minHeight: 220,
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 8,
    color: "#667085",
    textAlign: "center",
  },
  reviewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  reviewTotals: {
    textAlign: "right",
    display: "grid",
    gap: 2,
  },
  reviewTable: {
    display: "grid",
    gap: 10,
  },
  reviewRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1.4fr) 120px minmax(170px, .75fr) 150px minmax(180px, .9fr) 120px auto",
    gap: 10,
    alignItems: "end",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
  },
  bikeCell: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
  },
  bikeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#fff7ed",
    color: "#ff6a00",
    display: "grid",
    placeItems: "center",
    border: "1px solid #fed7aa",
  },
  quantityControl: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr) 34px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    overflow: "hidden",
    height: 42,
  },
  field: {
    display: "grid",
    gap: 5,
    color: "#344054",
    fontSize: 12,
    fontWeight: 850,
  },
  lineTotal: {
    display: "grid",
    gap: 3,
    color: "#667085",
    fontSize: 12,
    fontWeight: 850,
  },
  iconButton: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    cursor: "pointer",
  },
  confirmBar: {
    marginTop: 16,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #dbe3ef",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  error: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #fca5a5",
    background: "#fef2f2",
    color: "#b91c1c",
    fontWeight: 850,
  },
  ok: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #86efac",
    background: "#f0fdf4",
    color: "#047857",
    fontWeight: 850,
  },
  notFoundBox: {
    marginTop: 12,
    padding: 12,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    borderRadius: 12,
    display: "grid",
    gap: 8,
  },
  notFoundList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  notFoundChip: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "#fff",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontWeight: 850,
    fontSize: 12,
  },
};
