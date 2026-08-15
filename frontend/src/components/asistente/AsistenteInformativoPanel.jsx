import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, ExternalLink, Loader2, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAsistenteResumen, preguntarAsistente } from "../../services/asistenteService";
import { useSession } from "../../context/SessionContext";

const PREGUNTAS_BASE = [
  "Qué tengo que resolver hoy",
  "Ventas de hoy",
  "Caja actual",
  "Turnos de taller de hoy",
  "Taller pendiente",
  "Deudas abiertas",
  "Stock critico",
];

export default function AsistenteInformativoPanel() {
  const navigate = useNavigate();
  const { sucursalId } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [resumen, setResumen] = useState(null);
  const [respuesta, setRespuesta] = useState(null);
  const inputRef = useRef(null);

  const sugerencias = useMemo(() => {
    const fromData = respuesta?.sugerencias?.length
      ? respuesta.sugerencias
      : resumen?.sugerencias;
    return fromData?.length ? fromData : PREGUNTAS_BASE;
  }, [respuesta, resumen]);

  useEffect(() => {
    if (!open || resumen) return;
    cargarResumen();
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  async function cargarResumen() {
    setLoading(true);
    setError("");
    try {
      const data = await getAsistenteResumen({ id_sucursal: sucursalId });
      setResumen(data);
      if (!respuesta) {
        setRespuesta({
          intent: "resumen",
          titulo: data.titulo,
          resumen: data.resumen,
          cards: data.cards,
          items: [],
          sugerencias: data.sugerencias,
          fuentes: data.fuentes,
          solo_lectura: true,
        });
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar el asistente");
    } finally {
      setLoading(false);
    }
  }

  async function preguntar(preguntaElegida = input) {
    const pregunta = String(preguntaElegida || "").trim();
    if (!pregunta) return;

    setLoading(true);
    setError("");
    setInput("");
    try {
      const data = await preguntarAsistente({
        pregunta,
        id_sucursal: sucursalId,
      });
      setRespuesta(data);
    } catch (err) {
      setError(err.message || "No pude responder esa consulta");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function irA(to) {
    if (!to) return;
    setOpen(false);
    navigate(to);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={styles.fab}
        aria-label="Abrir asistente informativo"
      >
        {open ? <X size={21} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <section style={styles.panel} aria-label="Asistente informativo">
          <header style={styles.header}>
            <div style={styles.headerIcon}>
              <Bot size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={styles.title}>Asistente</strong>
              <span style={styles.subtitle}>Solo lectura del negocio</span>
            </div>
            <button
              type="button"
              onClick={cargarResumen}
              disabled={loading}
              style={styles.iconButton}
              title="Actualizar resumen"
            >
              {loading ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}
            </button>
          </header>

          <div style={styles.body}>
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.answerBox}>
              <div style={styles.answerKicker}>Lectura de mostrador</div>
              <h3 style={styles.answerTitle}>{respuesta?.titulo || "Preguntame algo del sistema"}</h3>
              <p style={styles.answerText}>
                {respuesta?.resumen ||
                  "Podés preguntarme por ventas, caja, taller, turnos, deudas o stock."}
              </p>
            </div>

            {respuesta?.cards?.length ? (
              <div style={styles.cardsGrid}>
                {respuesta.cards.map((card, index) => (
                  <button
                    type="button"
                    key={`${card.titulo}-${index}`}
                    onClick={() => irA(card.to)}
                    disabled={!card.to}
                    style={{
                      ...styles.card,
                      ...(styles.cardTones[card.tono] || styles.cardTones.neutral),
                      cursor: card.to ? "pointer" : "default",
                    }}
                  >
                    <span style={styles.cardLabel}>{card.titulo}</span>
                    <strong style={styles.cardValue}>{card.valor}</strong>
                    {card.detalle && <span style={styles.cardDetail}>{card.detalle}</span>}
                  </button>
                ))}
              </div>
            ) : null}

            {respuesta?.items?.length ? (
              <div style={styles.itemsBlock}>
                <div style={styles.sectionLabel}>Para mirar</div>
                {respuesta.items.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.titulo}-${index}`}
                    onClick={() => irA(item.to)}
                    disabled={!item.to}
                    style={styles.item}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong style={styles.itemTitle}>{item.titulo}</strong>
                      {item.subtitulo && <span style={styles.itemSub}>{item.subtitulo}</span>}
                      {item.detalle && <span style={styles.itemDetail}>{item.detalle}</span>}
                    </div>
                    <div style={styles.itemRight}>
                      {item.monto !== null && item.monto !== undefined && (
                        <strong style={styles.itemAmount}>{formatMoney(item.monto)}</strong>
                      )}
                      {item.to && <ExternalLink size={15} />}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <div style={styles.chips}>
              {sugerencias.slice(0, 6).map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  onClick={() => preguntar(sugerencia)}
                  disabled={loading}
                  style={styles.chip}
                >
                  {sugerencia}
                </button>
              ))}
            </div>

            {respuesta?.fuentes?.length ? (
              <div style={styles.sources}>
                Fuente: {respuesta.fuentes.slice(0, 4).join(" · ")}
              </div>
            ) : null}
          </div>

          <form
            style={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              preguntar();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ej: qué tengo pendiente hoy"
              style={styles.input}
              maxLength={300}
            />
            <button type="submit" disabled={loading || !input.trim()} style={styles.sendButton}>
              {loading ? <Loader2 size={18} /> : <Send size={18} />}
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "$ 0";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(number);
}

const styles = {
  fab: {
    position: "fixed",
    right: 22,
    bottom: 22,
    width: 54,
    height: 54,
    borderRadius: 18,
    border: "1px solid rgba(255, 106, 0, 0.35)",
    background: "linear-gradient(135deg, #ff6a00, #c94b00)",
    color: "white",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    boxShadow: "0 18px 45px rgba(201, 75, 0, 0.34)",
    zIndex: 300,
  },
  panel: {
    position: "fixed",
    right: 22,
    bottom: 88,
    width: "min(430px, calc(100vw - 28px))",
    maxHeight: "min(720px, calc(100vh - 112px))",
    background: "#ffffff",
    border: "1px solid #d8e0ea",
    borderRadius: 22,
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    zIndex: 299,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "14px 15px",
    borderBottom: "1px solid #e6edf5",
    background: "#fffaf5",
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "#111827",
    color: "#ff6a00",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  title: {
    display: "block",
    fontSize: 17,
    color: "#0f172a",
    lineHeight: 1.1,
  },
  subtitle: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  },
  iconButton: {
    marginLeft: "auto",
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  body: {
    padding: 14,
    overflowY: "auto",
    display: "grid",
    gap: 12,
    background: "#f8fafc",
  },
  error: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900,
  },
  answerBox: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    borderRadius: 16,
    padding: 13,
  },
  answerKicker: {
    color: "#ea580c",
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  answerTitle: {
    margin: "5px 0 4px",
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.12,
  },
  answerText: {
    margin: 0,
    color: "#334155",
    fontSize: 14,
    lineHeight: 1.35,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 9,
  },
  card: {
    border: "1px solid #dbe4ef",
    background: "white",
    borderRadius: 15,
    padding: 11,
    textAlign: "left",
    display: "grid",
    gap: 4,
    minHeight: 86,
  },
  cardTones: {
    neutral: {},
    success: { background: "#ecfdf5", borderColor: "#a7f3d0" },
    warning: { background: "#fff7ed", borderColor: "#fdba74" },
    danger: { background: "#fff1f2", borderColor: "#fecaca" },
    info: { background: "#eff6ff", borderColor: "#bfdbfe" },
  },
  cardLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 1000,
  },
  cardValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
  },
  cardDetail: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
  },
  itemsBlock: {
    display: "grid",
    gap: 7,
  },
  sectionLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
  },
  item: {
    width: "100%",
    border: "1px solid #dbe4ef",
    background: "white",
    borderRadius: 14,
    padding: "10px 11px",
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    textAlign: "left",
    cursor: "pointer",
  },
  itemTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.2,
  },
  itemSub: {
    display: "block",
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
    marginTop: 2,
  },
  itemDetail: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  itemRight: {
    display: "grid",
    justifyItems: "end",
    alignContent: "center",
    gap: 5,
    color: "#64748b",
    flexShrink: 0,
  },
  itemAmount: {
    color: "#0f172a",
    fontSize: 13,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 999,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  sources: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  form: {
    display: "flex",
    gap: 8,
    padding: 12,
    borderTop: "1px solid #e6edf5",
    background: "white",
  },
  input: {
    flex: 1,
    minWidth: 0,
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "11px 12px",
    fontSize: 14,
    outline: "none",
  },
  sendButton: {
    width: 44,
    border: "none",
    borderRadius: 14,
    background: "#ff6a00",
    color: "white",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
};
