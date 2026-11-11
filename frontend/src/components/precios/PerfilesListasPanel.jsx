import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { listarPerfilesListaPrecios } from "../../services/preciosService";

export default function PerfilesListasPanel({ proveedores, styles, isMobile }) {
  const [profiles, setProfiles] = useState([]);
  const [providerId, setProviderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      setLoading(true);
      setError("");
      setProfiles((await listarPerfilesListaPrecios()) || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los formatos aprendidos");
    } finally {
      setLoading(false);
    }
  }

  const visible = useMemo(
    () => profiles.filter((profile) => !providerId || String(profile.id_proveedor) === String(providerId)),
    [profiles, providerId],
  );

  return (
    <section style={styles.cardWide}>
      <div style={local.header}>
        <div>
          <h2 style={styles.cardTitle}>Formatos aprendidos</h2>
          <p style={styles.subtitle}>{profiles.length} formato(s) de proveedor</p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={loadProfiles} disabled={loading} title="Refrescar formatos">
          <RefreshCw size={17} /> Refrescar
        </button>
      </div>
      {error && <div style={styles.error}>Error: {error}</div>}
      <select style={{ ...styles.input, maxWidth: 360, marginBottom: 12 }} value={providerId} onChange={(event) => setProviderId(event.target.value)} aria-label="Filtrar formatos por proveedor">
        <option value="">Todos los proveedores</option>
        {proveedores.map((provider) => <option key={provider.id} value={provider.id}>{provider.nombre}</option>)}
      </select>
      {visible.length === 0 && <div style={local.empty}>No hay formatos guardados para este filtro.</div>}
      <div style={isMobile ? local.mobileList : local.grid}>
        {visible.map((profile) => (
          <article key={profile.id} style={local.profile}>
            <FileSpreadsheet size={18} />
            <div style={local.profileText}>
              <strong>{profile.nombre}</strong>
              <span>{profile.proveedor_nombre || "Proveedor"} · {String(profile.formato).toUpperCase()}</span>
              <small>Encabezado fila {profile.fila_encabezado}{profile.hoja ? ` · Hoja ${profile.hoja}` : ""}</small>
            </div>
            <span style={profile.activo ? local.active : local.inactive}>{profile.activo ? "Activo" : "Inactivo"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

const local = {
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 8 },
  mobileList: { display: "grid", gridTemplateColumns: "1fr", gap: 8 },
  profile: { display: "flex", alignItems: "flex-start", gap: 9, padding: 10, border: "1px solid #d8dee8", borderRadius: 6, background: "#fff" },
  profileText: { display: "grid", gap: 2, minWidth: 0, flex: 1, color: "#475569" },
  active: { padding: "3px 5px", borderRadius: 4, background: "#dcfce7", color: "#047857", fontSize: 11, fontWeight: 800 },
  inactive: { padding: "3px 5px", borderRadius: 4, background: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 750 },
  empty: { padding: 14, textAlign: "center", color: "#64748b" },
};
