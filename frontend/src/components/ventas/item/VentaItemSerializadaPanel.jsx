import { X } from "lucide-react";
import { useMemo, useState } from "react";
import SearchField from "../../ui/SearchField";

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function explicarPrecio(item) {
  if (item.oferta_alcance === "unidades") {
    return { titulo: item.oferta_nombre || "Oferta de esta unidad", detalle: `Este cuadro tiene precio propio: ${money(item.precio_oferta)}.` };
  }
  if (item.en_oferta) {
    return { titulo: item.oferta_nombre || "Oferta general", detalle: `Aplica la oferta vigente del modelo: ${money(item.precio_oferta)}.` };
  }
  if (Number(item.precio_venta_personalizado || 0) > 0) {
    return { titulo: "Precio propio de esta unidad", detalle: `Incluye el acondicionamiento de este cuadro: ${money(item.precio_venta_personalizado)}.` };
  }
  return { titulo: "Precio normal", detalle: `Aplica el precio de lista: ${money(item.precio_lista || item.precio_minorista)}.` };
}

export default function VentaItemSerializadaPanel({ item, bicicletasDisponibles, seleccionarSerializada, limpiarSerializada, titulo = "Número de cuadro" }) {
  const [busqueda, setBusqueda] = useState("");
  const serialSeleccionada = item.id_bicicleta_serializada;
  const seleccionada = bicicletasDisponibles.find((bici) => Number(bici.id) === Number(serialSeleccionada));
  const precio = explicarPrecio(item);
  const filtradas = useMemo(() => {
    const needle = busqueda.trim().toLocaleUpperCase("es-AR");
    if (!needle) return bicicletasDisponibles;
    return bicicletasDisponibles.filter((bici) =>
      [bici.numero_cuadro, bici.ubicacion_fisica, bici.condicion_comercial]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleUpperCase("es-AR").includes(needle))
    );
  }, [bicicletasDisponibles, busqueda]);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div><div style={styles.title}>{titulo}</div><div style={styles.subtitle}>Buscá o escaneá el número pegado al cuadro.</div></div>
        {serialSeleccionada && <span style={styles.badgeOk}>Unidad confirmada</span>}
      </div>

      <div style={styles.searchRow}>
        <SearchField value={busqueda} onChange={setBusqueda} placeholder="Número de cuadro o ubicación" style={styles.searchWrap} inputStyle={styles.searchInput} />
        {busqueda && <button type="button" onClick={() => setBusqueda("")} style={styles.iconBtn} title="Limpiar búsqueda"><X size={15} /></button>}
      </div>

      <div style={styles.selectorWrap}>
        <select
          value={serialSeleccionada || ""}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return limpiarSerializada();
            seleccionarSerializada(Number(value));
          }}
          style={styles.select}
        >
          <option value="">Elegir número de cuadro</option>
          {filtradas.map((bici) => (
            <option key={bici.id} value={bici.id}>
              {bici.numero_cuadro}{bici.ubicacion_fisica ? ` · ${bici.ubicacion_fisica}` : ""}{bici.oferta_alcance === "unidades" ? ` · ${money(bici.precio_oferta)}` : bici.precio_venta_personalizado ? ` · ${money(bici.precio_venta_personalizado)}` : ""}
            </option>
          ))}
        </select>
        {serialSeleccionada && <button type="button" onClick={limpiarSerializada} style={styles.clearBtn}>Cambiar</button>}
      </div>

      {seleccionada && (
        <div style={styles.unitDetail}>
          <div><strong>{seleccionada.numero_cuadro}</strong><span>{seleccionada.condicion_comercial || "normal"}{seleccionada.ubicacion_fisica ? ` · ${seleccionada.ubicacion_fisica}` : ""}</span></div>
          <div style={styles.priceReason}>
            <strong>{precio.titulo}</strong><span>{precio.detalle}</span>
            {item.oferta_politica_contado === "precio_final_contado" && <small>Precio final: efectivo o transferencia no agregan otro descuento.</small>}
          </div>
        </div>
      )}

      {bicicletasDisponibles.length === 0 && <div style={styles.warningBox}>No hay cuadros disponibles y técnicamente listos para esta variante.</div>}
      {bicicletasDisponibles.length > 0 && filtradas.length === 0 && <div style={styles.warningBox}>No encontramos un cuadro con esa búsqueda.</div>}
    </div>
  );
}

const styles = {
  panel: { border: "1px solid #d8e0ea", background: "#f8fafc", borderRadius: 8, padding: 10 },
  header: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 9, flexWrap: "wrap" },
  title: { fontSize: 12, fontWeight: 900, color: "#1e293b" },
  subtitle: { marginTop: 3, fontSize: 12, color: "#64748b" },
  badgeOk: { background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 900 },
  searchWrap: { display: "flex", alignItems: "center", gap: 7, border: "1px solid #cbd5e1", borderRadius: 7, padding: "0 9px", background: "white", marginBottom: 8 },
  searchRow: { display: "flex", alignItems: "center", gap: 7, marginBottom: 8 },
  searchInput: { flex: 1, minWidth: 0, border: 0, outline: 0, padding: "9px 0", fontSize: 13, background: "transparent" },
  iconBtn: { width: 28, height: 28, border: 0, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" },
  selectorWrap: { display: "flex", gap: 8, alignItems: "center" },
  select: { flex: 1, minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 7, padding: "9px 10px", fontSize: 13, background: "white" },
  clearBtn: { border: "1px solid #cbd5e1", borderRadius: 7, background: "white", color: "#344054", fontWeight: 800, padding: "8px 10px", cursor: "pointer" },
  unitDetail: { marginTop: 9, display: "grid", gridTemplateColumns: "minmax(150px, .7fr) minmax(220px, 1.3fr)", gap: 10, padding: 10, border: "1px solid #fdba74", borderRadius: 7, background: "#fff7ed", color: "#9a3412", fontSize: 12 },
  priceReason: { display: "grid", gap: 2 },
  warningBox: { marginTop: 9, borderRadius: 7, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", padding: "9px 11px", fontSize: 12, fontWeight: 700 },
};
