import { useEffect, useMemo, useRef, useState } from "react";
import { obtenerPreciosComercialesCatalogo } from "../../services/reglasComercialesService";
import { formatMoney } from "../../utils/formatters";

function tienePrecio(value) {
  return Number(value || 0) > 0;
}

function dineroCopiable(value) {
  return formatMoney(value).replace(/\$\s+/g, "$");
}

async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Algunos navegadores móviles bloquean Clipboard API aunque esté disponible.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = texto;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, texto.length);

  let copiado = false;
  try {
    copiado = document.execCommand("copy");
  } catch {
    copiado = false;
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copiado) {
    window.prompt("Copiá este texto para responder la consulta:", texto);
  }

  return copiado;
}

function lineaContado(opcion) {
  const beneficio = getBeneficioBadge(opcion);
  const label = [opcion.label, beneficio].filter(Boolean).join(" ");
  return `💵 ${label}: ${dineroCopiable(opcion.monto)}`;
}

function lineasMinorista(precios, item) {
  if (!precios) return [];

  const enOferta =
    item?.en_oferta && Number(item?.precio_oferta || 0) > 0;
  const lineas = enOferta
    ? [
        `🔥 OFERTA: ${dineroCopiable(precios.precioLista)}`,
        `🏷️ Precio anterior: ${dineroCopiable(item.precio_minorista)}`,
      ]
    : [
        `🏷️ Precio de lista: ${dineroCopiable(precios.precioLista)}`,
      ];

  if (precios.contado.length) {
    lineas.push("", ...precios.contado.map(lineaContado));
  }

  if (precios.tarjetas.length) {
    lineas.push(
      "",
      ...precios.tarjetas.map(
        (plan) =>
          `💳 ${plan.cuotas} cuotas de ${dineroCopiable(plan.importeCuota)}`
      )
    );
  }

  return lineas;
}

function lineasMayorista(precios) {
  if (!precios) return [];

  return [
    ...precios.contado.map(lineaContado),
    `🏷️ Precio mayorista: ${dineroCopiable(precios.precioMayorista)}`,
  ];
}

function armarTextoConsulta(tipo, nombre, precios, item) {
  const titulo = String(nombre || "PRODUCTO").trim().toUpperCase();
  const minorista = lineasMinorista(precios.minorista, item);
  const mayorista = lineasMayorista(precios.mayorista);

  if (tipo === "minorista") return [titulo, "", ...minorista].join("\n");
  if (tipo === "mayorista") return [titulo, "", ...mayorista].join("\n");

  const bloques = [titulo];
  if (minorista.length) bloques.push("", "PRECIOS MINORISTA", ...minorista);
  if (mayorista.length) bloques.push("", "PRECIOS MAYORISTA", ...mayorista);
  return bloques.join("\n");
}

export default function PreciosComercialesCatalogo({
  item,
  nombre,
  compact = false,
  mostrarCopiado = true,
}) {
  const [precios, setPrecios] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState("");
  const timeoutRef = useRef(null);
  const precioMinorista = Number(item?.precio_minorista || 0);
  const precioMayorista = Number(item?.precio_mayorista || 0);
  const precioOferta =
    item?.en_oferta && Number(item?.precio_oferta || 0) > 0
      ? Number(item.precio_oferta)
      : 0;
  const precioMinoristaVigente = precioOferta || precioMinorista;

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");

    obtenerPreciosComercialesCatalogo({
      precioMinorista: precioMinoristaVigente,
      precioMayorista,
    })
      .then((data) => {
        if (vigente) setPrecios(data);
      })
      .catch((err) => {
        if (!vigente) return;
        setPrecios(null);
        setError(
          err?.message ||
            "No se pudieron consultar las opciones comerciales."
        );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [precioMinoristaVigente, precioMayorista]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const preciosVisibles = useMemo(
    () =>
      precios || {
        minorista: tienePrecio(precioMinoristaVigente)
          ? {
              precioLista: precioMinoristaVigente,
              contado: [],
              tarjetas: [],
            }
          : null,
        mayorista: tienePrecio(precioMayorista)
          ? {
              precioMayorista,
              contado: [],
            }
          : null,
      },
    [precios, precioMayorista, precioMinoristaVigente]
  );

  async function copiar(tipo) {
    const texto = armarTextoConsulta(tipo, nombre, preciosVisibles, item);
    const ok = await copiarTexto(texto);
    if (!ok) return;

    setCopiado(tipo);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopiado(""), 1600);
  }

  const gridStyle = compact
    ? styles.gridCompact
    : styles.grid;

  return (
    <section style={styles.wrapper} onClick={(event) => event.stopPropagation()}>
      <div style={gridStyle}>
        <BloquePrecio
          titulo="PRECIOS MINORISTA"
          tipo="minorista"
          cargando={cargando}
          precio={preciosVisibles.minorista}
          precioAnterior={precioOferta ? precioMinorista : 0}
          nombreOferta={item?.oferta_nombre}
        />
        <BloquePrecio
          titulo="PRECIOS MAYORISTA"
          tipo="mayorista"
          cargando={cargando}
          precio={preciosVisibles.mayorista}
        />
      </div>

      {error ? (
        <p style={styles.warning}>
          Se muestran los precios guardados. No fue posible cargar las opciones
          de pago.
        </p>
      ) : null}

      {mostrarCopiado ? (
        <div style={styles.actions}>
          <CopyButton
            label="Copiar minorista"
            copied={copiado === "minorista"}
            disabled={cargando || !preciosVisibles.minorista}
            onClick={() => copiar("minorista")}
          />
          <CopyButton
            label="Copiar mayorista"
            copied={copiado === "mayorista"}
            disabled={cargando || !preciosVisibles.mayorista}
            onClick={() => copiar("mayorista")}
          />
          <CopyButton
            label="Copiar ambos"
            copied={copiado === "ambos"}
            disabled={
              cargando ||
              (!preciosVisibles.minorista && !preciosVisibles.mayorista)
            }
            onClick={() => copiar("ambos")}
          />
        </div>
      ) : null}
    </section>
  );
}

function BloquePrecio({
  titulo,
  tipo,
  cargando,
  precio,
  precioAnterior = 0,
  nombreOferta = "",
}) {
  const esMinorista = tipo === "minorista";

  return (
    <div style={styles.priceBlock}>
      <div style={styles.blockTitle}>{titulo}</div>

      {cargando ? (
        <div style={styles.loading}>Consultando opciones de pago...</div>
      ) : !precio ? (
        <div style={styles.empty}>Precio no definido</div>
      ) : (
        <div style={styles.rows}>
          {esMinorista && precioAnterior > 0 ? (
            <PrecioRow
              label={nombreOferta || "OFERTA"}
              value={formatMoney(precio.precioLista)}
              highlight
              badge="OFERTA"
            />
          ) : null}
          {precio.contado.map((opcion) => (
            <PrecioRow
              key={opcion.medio}
              label={opcion.label}
              value={formatMoney(opcion.monto)}
              highlight
              badge={getBeneficioBadge(opcion)}
            />
          ))}

          <PrecioRow
            label={
              esMinorista && precioAnterior > 0
                ? "Precio anterior"
                : esMinorista
                  ? "Precio de lista"
                  : "Precio mayorista"
            }
            value={formatMoney(
              esMinorista && precioAnterior > 0
                ? precioAnterior
                : esMinorista
                  ? precio.precioLista
                  : precio.precioMayorista
            )}
          />

          {esMinorista
            ? precio.tarjetas.map((plan) => (
                <PrecioRow
                  key={plan.cuotas}
                  label={`Tarjeta ${plan.cuotas} cuotas`}
                  value={`${plan.cuotas} de ${formatMoney(plan.importeCuota)}`}
                />
              ))
            : null}
        </div>
      )}
    </div>
  );
}

function getBeneficioBadge(opcion) {
  if (Number(opcion.porcentajeDescuento) > 0) {
    return `${Number(opcion.porcentajeDescuento).toLocaleString("es-AR", {
      maximumFractionDigits: 2,
    })}% OFF`;
  }
  return Number(opcion.descuento) > 0 ? "BENEFICIO" : "";
}

function PrecioRow({ label, value, badge = "", highlight = false }) {
  return (
    <div style={{ ...styles.row, ...(highlight ? styles.rowHighlight : {}) }}>
      <div style={styles.rowLabel}>
        <span>{label}</span>
        {badge ? <small style={styles.badge}>{badge}</small> : null}
      </div>
      <strong style={styles.rowValue}>{value}</strong>
    </div>
  );
}

function CopyButton({ label, copied, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles.copyButton,
        ...(copied ? styles.copyButtonCopied : {}),
        ...(disabled ? styles.copyButtonDisabled : {}),
      }}
    >
      {copied ? "Copiado" : label}
    </button>
  );
}

const styles = {
  wrapper: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 8,
  },
  gridCompact: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },
  priceBlock: {
    border: "1px solid #d8e0ec",
    borderRadius: 8,
    overflow: "hidden",
    background: "#ffffff",
    minWidth: 0,
  },
  blockTitle: {
    padding: "7px 10px",
    background: "#f3f6fa",
    color: "#334155",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0,
  },
  rows: {
    display: "grid",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
    minHeight: 34,
    padding: "6px 10px",
    borderTop: "1px solid #edf1f6",
  },
  rowHighlight: {
    background: "#ecfdf3",
    color: "#067647",
  },
  rowLabel: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 1.2,
  },
  rowValue: {
    fontSize: 13,
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  badge: {
    display: "inline-flex",
    padding: "2px 5px",
    borderRadius: 5,
    background: "#d1fadf",
    color: "#067647",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0,
  },
  loading: {
    minHeight: 78,
    display: "grid",
    placeItems: "center",
    padding: 12,
    color: "#64748b",
    fontSize: 12,
  },
  empty: {
    minHeight: 52,
    display: "grid",
    placeItems: "center",
    padding: 12,
    color: "#94a3b8",
    fontSize: 12,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 6,
  },
  copyButton: {
    minHeight: 34,
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
    padding: "6px 8px",
  },
  copyButtonCopied: {
    borderColor: "#12b76a",
    background: "#ecfdf3",
    color: "#067647",
  },
  copyButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  warning: {
    margin: 0,
    padding: "6px 8px",
    borderRadius: 6,
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 11,
  },
};
