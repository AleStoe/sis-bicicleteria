import { useState } from "react";
import VentaItemPrecioPanel from "./item/VentaItemPrecioPanel";
import VentaItemBonificacionPanel from "./item/VentaItemBonificacionPanel";
import VentaItemSerializadaPanel from "./item/VentaItemSerializadaPanel";

function formatMoney(value) {
  const n = Number(value || 0);

  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function VentaItemRow({
  item,
  index,
  serializadasPorVariante,
  cargandoSerializadas,
  onCargarSerializadas,
  onSeleccionarSerializada,
  onCambiarCantidad,
  onQuitarItem,
  onActualizarItem,
}) {
  const [panelActivo, setPanelActivo] = useState(null);
  const [precioManual, setPrecioManual] = useState(
    item.precio_unitario_manual || item.precio_final || item.precio_minorista || 0
  );
  const [motivoPrecio, setMotivoPrecio] = useState(item.motivo_precio_manual || "");
  const [motivoBonificacion, setMotivoBonificacion] = useState(
    item.motivo_bonificacion || ""
  );

  const descripcion =
    item.descripcion ||
    item.producto_nombre ||
    item.nombre ||
    item.descripcion_snapshot ||
    "Producto sin descripción";

  const codigo = item.codigo || item.nombre_variante || item.sku || `#${item.id_variante}`;

  const precioLista = Number(
    item.precio_lista || item.precio_minorista || item.precio || 0
  );

  const precioFinal = item.bonificado
    ? 0
    : Number(item.precio_unitario_manual || item.precio_final || precioLista);

  const subtotal = precioFinal * Number(item.cantidad || 0);

  function togglePanel(nombre) {
    setPanelActivo((actual) => (actual === nombre ? null : nombre));
  }

  function aplicarPrecioManual() {
    if (!precioManual || Number(precioManual) <= 0) {
      alert("El precio manual debe ser mayor a 0");
      return;
    }

    if (!motivoPrecio.trim()) {
      alert("El precio manual requiere motivo");
      return;
    }

    onActualizarItem?.(item.line_id, {
      precio_unitario_manual: Number(precioManual),
      motivo_precio_manual: motivoPrecio.trim(),
      bonificado: false,
      motivo_bonificacion: null,
    });

    setPanelActivo(null);
  }

  function limpiarPrecioManual() {
    setPrecioManual(precioLista);
    setMotivoPrecio("");

    onActualizarItem?.(item.line_id, {
      precio_unitario_manual: null,
      motivo_precio_manual: null,
    });

    setPanelActivo(null);
  }

  function aplicarBonificacion() {
    if (!motivoBonificacion.trim()) {
      alert("La bonificación requiere motivo");
      return;
    }

    onActualizarItem?.(item.line_id, {
      bonificado: true,
      motivo_bonificacion: motivoBonificacion.trim(),
      precio_unitario_manual: null,
      motivo_precio_manual: null,
    });

    setPanelActivo(null);
  }

  function quitarBonificacion() {
    setMotivoBonificacion("");

    onActualizarItem?.(item.line_id, {
      bonificado: false,
      motivo_bonificacion: null,
    });

    setPanelActivo(null);
  }

  async function activarModoSerializada() {
    await onCargarSerializadas?.(item.id_variante);

    onActualizarItem?.(item.line_id, {
      modo_venta_serializada: "serializada",
      cantidad: 1,
    });
  }

  function activarModoCaja() {
    onActualizarItem?.(item.line_id, {
      modo_venta_serializada: "caja",
      id_bicicleta_serializada: null,
      numero_cuadro: "",
      cantidad: 1,
    });
  }

  return (
    <div style={styles.row}>
      <div style={styles.main}>
        <div style={styles.header}>
          <div style={styles.productInfo}>
            <div style={styles.title}>{descripcion}</div>
            <div style={styles.subtitle}>{codigo}</div>

            <div style={styles.badges}>
              {item.serializable && (
                <span style={styles.badgeSerial}>
                  {item.modo_venta_serializada === "serializada"
                    ? "ARMADA"
                    : "EN CAJA"}
                </span>
              )}

              {item.bonificado && <span style={styles.badgeGift}>BONIFICADO</span>}

              {item.precio_unitario_manual && !item.bonificado && (
                <span style={styles.badgeManual}>PRECIO MANUAL</span>
              )}
            </div>
          </div>

          <div style={styles.priceBlock}>
            {item.bonificado && (
              <span style={styles.oldPrice}>{formatMoney(precioLista)}</span>
            )}

            <strong style={styles.subtotal}>{formatMoney(subtotal)}</strong>

            <span style={styles.unitPrice}>
              {Number(item.cantidad || 0)} × {formatMoney(precioFinal)}
            </span>
          </div>
        </div>

        {(item.bonificado || item.precio_unitario_manual) && (
          <div style={styles.audit}>
            {item.bonificado && (
              <>
                Bonificado: antes <strong>{formatMoney(precioLista)}</strong>, ahora{" "}
                <strong>{formatMoney(0)}</strong>. Motivo:{" "}
                {item.motivo_bonificacion || "-"}
              </>
            )}

            {item.precio_unitario_manual && !item.bonificado && (
              <>
                Precio manual: lista <strong>{formatMoney(precioLista)}</strong>, ahora{" "}
                <strong>{formatMoney(item.precio_unitario_manual)}</strong>. Motivo:{" "}
                {item.motivo_precio_manual || "-"}
              </>
            )}
          </div>
        )}

        <div style={styles.controlRow}>
          <div style={styles.qty}>
            <button
              type="button"
              onClick={() =>
                onCambiarCantidad?.(item.line_id, Number(item.cantidad || 1) - 1)
              }
              disabled={
                item.serializable &&
                item.modo_venta_serializada === "serializada"
              }
            >
              -
            </button>

            <span>{item.cantidad}</span>

            <button
              type="button"
              onClick={() =>
                onCambiarCantidad?.(item.line_id, Number(item.cantidad || 1) + 1)
              }
              disabled={
                item.serializable &&
                item.modo_venta_serializada === "serializada"
              }
            >
              +
            </button>
          </div>

          {item.serializable && (
            <button
              type="button"
              onClick={() => togglePanel("modo")}
              style={panelActivo === "modo" ? styles.actionBtnActive : styles.actionBtn}
            >
              Modo
            </button>
          )}

          <button
            type="button"
            onClick={() => togglePanel("precio")}
            style={panelActivo === "precio" ? styles.actionBtnActive : styles.actionBtn}
          >
            Precio
          </button>

          <button
            type="button"
            onClick={() => togglePanel("bonificacion")}
            style={
              panelActivo === "bonificacion" ? styles.actionBtnActive : styles.actionBtn
            }
          >
            Bonificar
          </button>

          <button
            type="button"
            onClick={() => onQuitarItem?.(item.line_id)}
            style={styles.deleteBtn}
          >
            Eliminar
          </button>
        </div>

        {panelActivo === "modo" && item.serializable && (
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Modo de venta</div>

            <div style={styles.modeRow}>
              <button
                type="button"
                onClick={activarModoCaja}
                style={
                  item.modo_venta_serializada !== "serializada"
                    ? styles.modeBtnActive
                    : styles.modeBtn
                }
              >
                En caja
              </button>

              <button
                type="button"
                onClick={activarModoSerializada}
                style={
                  item.modo_venta_serializada === "serializada"
                    ? styles.modeBtnActive
                    : styles.modeBtn
                }
              >
                Armada / con cuadro
              </button>
            </div>

            {item.modo_venta_serializada === "serializada" && (
              <VentaItemSerializadaPanel
                item={item}
                bicicletasDisponibles={
                  serializadasPorVariante?.[String(item.id_variante)] || []
                }
                seleccionarSerializada={(id) =>
                  onSeleccionarSerializada?.(index, id)
                }
                limpiarSerializada={() =>
                  onSeleccionarSerializada?.(index, "")
                }
              />
            )}
          </div>
        )}

        {panelActivo === "precio" && (
          <VentaItemPrecioPanel
            precioManual={precioManual}
            setPrecioManual={setPrecioManual}
            motivoPrecio={motivoPrecio}
            setMotivoPrecio={setMotivoPrecio}
            aplicarPrecioManual={aplicarPrecioManual}
            limpiarPrecioManual={limpiarPrecioManual}
          />
        )}

        {panelActivo === "bonificacion" && (
          <VentaItemBonificacionPanel
            motivoBonificacion={motivoBonificacion}
            setMotivoBonificacion={setMotivoBonificacion}
            aplicarBonificacion={aplicarBonificacion}
            limpiarBonificacion={quitarBonificacion}
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  row: {
    borderBottom: "1px solid #e5e7eb",
    padding: "12px 10px",
    background: "white",
  },
  main: {
    display: "grid",
    gap: 8,
  },
  header: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 140px",
    gap: 10,
    alignItems: "start",
  },
  productInfo: {
    minWidth: 0,
  },
  title: {
    fontWeight: 900,
    fontSize: 14,
    lineHeight: 1.2,
    color: "#111827",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  badges: {
    display: "flex",
    gap: 5,
    marginTop: 6,
    flexWrap: "wrap",
  },
  badgeSerial: {
    background: "#fff7ed",
    color: "#9a3412",
    padding: "3px 7px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
  },
  badgeGift: {
    background: "#dcfce7",
    color: "#166534",
    padding: "3px 7px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
  },
  badgeManual: {
    background: "#fef3c7",
    color: "#92400e",
    padding: "3px 7px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
  },
  priceBlock: {
    textAlign: "right",
    display: "grid",
    gap: 2,
  },
  subtotal: {
    fontSize: 15,
    color: "#111827",
  },
  unitPrice: {
    fontSize: 11,
    color: "#667085",
  },
  oldPrice: {
    textDecoration: "line-through",
    color: "#94a3b8",
    fontSize: 11,
  },
  audit: {
    background: "#f9fafb",
    border: "1px solid #eaecf0",
    borderRadius: 8,
    padding: "7px 8px",
    fontSize: 12,
    color: "#475569",
  },
  controlRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  qty: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginRight: 4,
  },
  actionBtn: {
    border: "1px solid #d0d5dd",
    background: "white",
    color: "#344054",
    borderRadius: 8,
    padding: "6px 8px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  actionBtnActive: {
    border: "1px solid #0b5bd3",
    background: "#eef4ff",
    color: "#175cd3",
    borderRadius: 8,
    padding: "6px 8px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },
  deleteBtn: {
    border: "1px solid #fecdca",
    background: "#fff1f0",
    color: "#b42318",
    borderRadius: 8,
    padding: "6px 8px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    marginLeft: "auto",
  },
  panel: {
    border: "1px solid #eaecf0",
    background: "#f9fafb",
    borderRadius: 10,
    padding: 10,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: "#344054",
    marginBottom: 7,
  },
  inlineForm: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    width: 130,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
  },
  inputGrow: {
    flex: 1,
    minWidth: 160,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
  },
  applyBtn: {
    border: "none",
    borderRadius: 8,
    background: "#16a34a",
    color: "white",
    fontWeight: 900,
    padding: "7px 10px",
    cursor: "pointer",
  },
  ghostBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "white",
    color: "#344054",
    fontWeight: 800,
    padding: "7px 10px",
    cursor: "pointer",
  },
  giftBtn: {
    border: "1px solid #86efac",
    borderRadius: 8,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 900,
    padding: "7px 10px",
    cursor: "pointer",
  },
  modeRow: {
    display: "flex",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  modeBtn: {
    border: "1px solid #fcd34d",
    background: "white",
    color: "#92400e",
    borderRadius: 8,
    padding: "7px 10px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  modeBtnActive: {
    border: "1px solid #d97706",
    background: "#f59e0b",
    color: "white",
    borderRadius: 8,
    padding: "7px 10px",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },
  select: {
    width: "100%",
    border: "1px solid #fcd34d",
    borderRadius: 8,
    padding: "8px 9px",
    fontSize: 13,
    background: "white",
  },
};