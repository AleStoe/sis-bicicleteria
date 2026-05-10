import { useState } from "react";

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

export default function VentaItemRow({
  item,
  onIncrementar,
  onDecrementar,
  onEliminar,
  onActualizarItem,
}) {
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [precioManual, setPrecioManual] = useState(
    item.precio_unitario_manual || item.precio_final || item.precio || 0
  );
  const [motivoPrecio, setMotivoPrecio] = useState(
    item.motivo_precio_manual || ""
  );
  const [motivoBonificacion, setMotivoBonificacion] = useState(
    item.motivo_bonificacion || ""
  );

  const precioLista = Number(
    item.precio_lista || item.precio_minorista || item.precio || 0
  );

  const precioFinal = item.bonificado
    ? 0
    : Number(item.precio_unitario_manual || item.precio_final || precioLista);

  const subtotal = precioFinal * Number(item.cantidad || 0);

  function aplicarPrecioManual() {
    if (!precioManual || Number(precioManual) <= 0) {
      alert("El precio manual debe ser mayor a 0");
      return;
    }

    if (!motivoPrecio.trim()) {
      alert("El precio manual requiere motivo");
      return;
    }

    onActualizarItem?.(item.id_variante, {
      precio_unitario_manual: Number(precioManual),
      motivo_precio_manual: motivoPrecio.trim(),
      bonificado: false,
      motivo_bonificacion: null,
    });

    setEditandoPrecio(false);
  }

  function limpiarPrecioManual() {
    setPrecioManual(precioLista);
    setMotivoPrecio("");

    onActualizarItem?.(item.id_variante, {
      precio_unitario_manual: null,
      motivo_precio_manual: null,
    });

    setEditandoPrecio(false);
  }

  function toggleBonificado() {
    if (!item.bonificado && !motivoBonificacion.trim()) {
      alert("La bonificación requiere motivo");
      return;
    }

    onActualizarItem?.(item.id_variante, {
      bonificado: !item.bonificado,
      motivo_bonificacion: !item.bonificado
        ? motivoBonificacion.trim()
        : null,
      precio_unitario_manual: null,
      motivo_precio_manual: null,
    });
  }

  return (
    <div style={styles.row}>
      <div style={styles.main}>
        <div style={styles.title}>
          {item.producto_nombre || item.nombre || item.descripcion_snapshot}
        </div>

        <div style={styles.subtitle}>
          {item.nombre_variante || item.sku || `#${item.id_variante}`}
        </div>

        <div style={styles.badges}>
          {item.bonificado && <span style={styles.badgeGift}>BONIFICADO</span>}

          {item.precio_unitario_manual && !item.bonificado && (
            <span style={styles.badgeManual}>PRECIO MANUAL</span>
          )}
        </div>

        {item.bonificado && (
          <div style={styles.audit}>
            Antes: <strong>{formatMoney(precioLista)}</strong> · Ahora:{" "}
            <strong>{formatMoney(0)}</strong>
            <br />
            Motivo: {item.motivo_bonificacion}
          </div>
        )}

        {item.precio_unitario_manual && !item.bonificado && (
          <div style={styles.audit}>
            Lista: <strong>{formatMoney(precioLista)}</strong> · Manual:{" "}
            <strong>{formatMoney(item.precio_unitario_manual)}</strong>
            <br />
            Motivo: {item.motivo_precio_manual}
          </div>
        )}

        {editandoPrecio && (
          <div style={styles.editBox}>
            <input
              type="number"
              value={precioManual}
              onChange={(e) => setPrecioManual(e.target.value)}
              placeholder="Precio manual"
              style={styles.input}
            />

            <input
              value={motivoPrecio}
              onChange={(e) => setMotivoPrecio(e.target.value)}
              placeholder="Motivo del precio manual"
              style={styles.input}
            />

            <button onClick={aplicarPrecioManual} style={styles.smallBtn}>
              Aplicar
            </button>

            <button onClick={limpiarPrecioManual} style={styles.smallBtnGhost}>
              Limpiar
            </button>
          </div>
        )}

        <div style={styles.bonifBox}>
          <input
            value={motivoBonificacion}
            onChange={(e) => setMotivoBonificacion(e.target.value)}
            placeholder="Motivo bonificación"
            style={styles.input}
            disabled={item.bonificado}
          />

          <button onClick={toggleBonificado} style={styles.giftBtn}>
            {item.bonificado ? "Quitar bonificación" : "Bonificar"}
          </button>
        </div>
      </div>

      <div style={styles.actions}>
        <div style={styles.price}>
          {item.bonificado ? (
            <>
              <span style={styles.oldPrice}>{formatMoney(precioLista)}</span>
              <strong>{formatMoney(0)}</strong>
            </>
          ) : (
            <strong>{formatMoney(subtotal)}</strong>
          )}
        </div>

        <div style={styles.qty}>
          <button onClick={() => onDecrementar?.(item)}>-</button>
          <span>{item.cantidad}</span>
          <button onClick={() => onIncrementar?.(item)}>+</button>
        </div>

        <button onClick={() => setEditandoPrecio(!editandoPrecio)}>
          ✏️
        </button>

        <button onClick={() => onEliminar?.(item)}>🗑️</button>
      </div>
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  main: {
    flex: 1,
  },
  title: {
    fontWeight: 800,
    fontSize: 15,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
  },
  badges: {
    display: "flex",
    gap: 6,
    marginTop: 6,
  },
  badgeGift: {
    background: "#dcfce7",
    color: "#166534",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },
  badgeManual: {
    background: "#fef3c7",
    color: "#92400e",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },
  audit: {
    marginTop: 6,
    fontSize: 12,
    color: "#475569",
  },
  editBox: {
    display: "flex",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  bonifBox: {
    display: "flex",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
  },
  smallBtn: {
    border: "none",
    borderRadius: 8,
    background: "#16a34a",
    color: "white",
    fontWeight: 800,
    padding: "7px 10px",
  },
  smallBtnGhost: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "white",
    fontWeight: 700,
    padding: "7px 10px",
  },
  giftBtn: {
    border: "1px solid #86efac",
    borderRadius: 8,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 800,
    padding: "7px 10px",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  price: {
    minWidth: 110,
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
  },
  oldPrice: {
    textDecoration: "line-through",
    color: "#94a3b8",
    fontSize: 12,
  },
  qty: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
};