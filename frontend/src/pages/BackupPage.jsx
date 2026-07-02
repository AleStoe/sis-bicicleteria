import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  DatabaseBackup,
  Download,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { Badge, Button, Card, EmptyState, MetricCard, PageHeader } from "../components/ui";
import useMediaQuery from "../hooks/useMediaQuery";
import {
  descargarBackup,
  generarBackup,
  listarBackups,
} from "../services/backupService";
import { formatDateTime } from "../utils/formatters";


export default function BackupPage() {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [backups, setBackups] = useState([]);
  const [incluirUploads, setIncluirUploads] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      setError("");
      setBackups(await listarBackups());
    } catch (err) {
      setError(err.message || "No se pudieron cargar los backups.");
    } finally {
      setCargando(false);
    }
  }

  async function crear() {
    try {
      setGenerando(true);
      setError("");
      setMensaje("");
      const backup = await generarBackup(incluirUploads);
      setMensaje(`Backup generado correctamente: ${backup.nombre}`);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo generar el backup.");
    } finally {
      setGenerando(false);
    }
  }

  async function descargar(item) {
    try {
      setDescargando(item.nombre);
      setError("");
      setMensaje("");
      await descargarBackup(item.nombre);
      setMensaje(`Descarga iniciada: ${item.nombre}`);
    } catch (err) {
      setError(err.message || "No se pudo descargar el backup.");
    } finally {
      setDescargando("");
    }
  }

  const resumen = useMemo(() => {
    const totalBytes = backups.reduce(
      (total, item) => total + Number(item.tamano_bytes || 0),
      0,
    );
    return {
      cantidad: backups.length,
      total: formatBytes(totalBytes),
      ultimo: backups[0] ? formatDateTime(backups[0].fecha) : "Todavía ninguno",
    };
  }, [backups]);

  return (
    <div style={styles.page}>
      <PageHeader
        title="Backups"
        subtitle="Copias administradas de la base de datos y archivos del sistema."
        actions={(
          <Button type="button" variant="outline" onClick={cargar} disabled={cargando}>
            <RefreshCw size={17} />
            Refrescar
          </Button>
        )}
      />

      <div style={isMobile ? styles.metricsMobile : styles.metrics}>
        <MetricCard label="Backups disponibles" value={resumen.cantidad} tone="primary" />
        <MetricCard label="Espacio ocupado" value={resumen.total} />
        <MetricCard label="Último backup" value={resumen.ultimo} />
      </div>

      {error ? <div style={styles.error}>Error: {error}</div> : null}
      {mensaje ? <div style={styles.success}>{mensaje}</div> : null}

      <div style={isMobile ? styles.layoutMobile : styles.layout}>
        <Card
          title="Generar backup"
          subtitle="La contraseña de PostgreSQL no se guarda en el archivo ni se muestra en pantalla."
        >
          <div style={styles.generateContent}>
            <div style={styles.securityNote}>
              <ShieldCheck size={22} />
              <div>
                <strong>Backup protegido</strong>
                <span style={styles.noteText}>
                  El archivo queda dentro de la carpeta privada backups del servidor.
                </span>
              </div>
            </div>

            <label style={styles.option}>
              <input
                type="checkbox"
                checked={incluirUploads}
                onChange={(event) => setIncluirUploads(event.target.checked)}
                disabled={generando}
              />
              <span style={styles.optionText}>
                <strong>Incluir imágenes y archivos subidos</strong>
                <small>Genera un ZIP con database.dump y la carpeta uploads.</small>
              </span>
            </label>

            <Button type="button" onClick={crear} disabled={generando} fullWidth>
              <DatabaseBackup size={18} />
              {generando ? "Generando backup..." : "Generar backup ahora"}
            </Button>

            <p style={styles.helper}>
              El restore no se realiza desde esta pantalla. Se mantiene como procedimiento
              manual para evitar sobrescrituras accidentales.
            </p>
          </div>
        </Card>

        <Card
          title="Copias disponibles"
          subtitle="Los backups no se pueden eliminar desde el sistema."
          bodyStyle={{ padding: 0 }}
        >
          {cargando ? (
            <div style={styles.state}>Cargando backups...</div>
          ) : backups.length === 0 ? (
            <EmptyState
              title="Todavía no hay backups"
              description="Generá la primera copia antes de continuar con el Clean Beta."
            />
          ) : (
            <div style={styles.list}>
              {backups.map((item) => (
                <div
                  key={item.nombre}
                  style={isMobile ? styles.rowMobile : styles.row}
                >
                  <div style={styles.fileIcon}>
                    {item.incluye_uploads ? <Archive size={21} /> : <HardDrive size={21} />}
                  </div>

                  <div style={styles.fileInfo}>
                    <strong style={styles.fileName}>{item.nombre}</strong>
                    <span style={styles.fileMeta}>
                      {formatDateTime(item.fecha)} · {formatBytes(item.tamano_bytes)}
                    </span>
                  </div>

                  <Badge variant={item.incluye_uploads ? "primary" : "default"}>
                    {item.incluye_uploads ? "Base + uploads" : "Base de datos"}
                  </Badge>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => descargar(item)}
                    disabled={Boolean(descargando)}
                    style={isMobile ? { width: "100%" } : {}}
                  >
                    <Download size={16} />
                    {descargando === item.nombre ? "Descargando..." : "Descargar"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}


function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const amount = bytes / (1024 ** index);
  return `${amount.toLocaleString("es-AR", {
    minimumFractionDigits: index === 0 ? 0 : 1,
    maximumFractionDigits: index === 0 ? 0 : 1,
  })} ${units[index]}`;
}


const styles = {
  page: { display: "grid", gap: 18, minWidth: 0 },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  metricsMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.7fr) minmax(0, 1.5fr)",
    gap: 16,
    alignItems: "start",
  },
  layoutMobile: { display: "grid", gridTemplateColumns: "1fr", gap: 14 },
  generateContent: { display: "grid", gap: 14 },
  securityNote: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 12,
    borderRadius: 8,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
  },
  noteText: { display: "block", marginTop: 4, fontSize: 12, lineHeight: 1.4 },
  option: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #dbe2ea",
    cursor: "pointer",
  },
  optionText: { display: "grid", gap: 4, color: "#344054" },
  helper: { margin: 0, color: "#667085", fontSize: 12, lineHeight: 1.45 },
  list: { display: "grid" },
  row: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr) auto auto",
    gap: 12,
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid #eaecf0",
  },
  rowMobile: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    padding: 14,
    borderBottom: "1px solid #eaecf0",
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    color: "#c2410c",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
  },
  fileInfo: { display: "grid", gap: 4, minWidth: 0 },
  fileName: { overflowWrap: "anywhere", color: "#101828" },
  fileMeta: { color: "#667085", fontSize: 12 },
  state: { padding: 24, color: "#667085", textAlign: "center" },
  error: {
    padding: "11px 13px",
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 800,
  },
  success: {
    padding: "11px 13px",
    borderRadius: 8,
    border: "1px solid #bbf7d0",
    background: "#ecfdf3",
    color: "#166534",
    fontWeight: 800,
  },
};
