import { useEffect, useMemo, useState } from "react";
import {
  abrirCaja,
  cerrarCaja,
  obtenerCajaAbierta,
  obtenerCajaDetalle,
  registrarEgresoCaja,
  registrarAjusteCaja,
} from "../services/cajaService";
import { formatCurrency } from "../utils/formatters";
import {
  Card,
  PageHeader,
  Button,
  Input,
  Select,
  MetricCard,
  Table,
} from "../components/ui";

const ID_SUCURSAL = 1;
const ID_USUARIO = 1;

const MOVIMIENTOS_COLUMNS = [
  { key: "fecha", label: "Fecha" },
  { key: "tipo", label: "Tipo" },
  { key: "submedio", label: "Submedio" },
  { key: "monto", label: "Monto" },
  { key: "origen", label: "Origen" },
  { key: "usuario", label: "Usuario" },
  { key: "nota", label: "Nota" },
];

export default function CajaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [montoApertura, setMontoApertura] = useState("");
  const [montoReal, setMontoReal] = useState("");
  const [egreso, setEgreso] = useState({ monto: "", nota: "" });
  const [procesando, setProcesando] = useState(false);
  const [ajuste, setAjuste] = useState({
    monto: "",
    direccion: "positivo",
    nota: "",
  });

  useEffect(() => {
    cargarCaja();
  }, []);

  async function cargarCaja() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const cajaAbierta = await obtenerCajaAbierta(ID_SUCURSAL);
      const detalleCaja = await obtenerCajaDetalle(cajaAbierta.caja.id);

      setDetalle(detalleCaja);
      setMontoReal(String(detalleCaja.efectivo_teorico ?? ""));
    } catch (err) {
      const msg = err.message || "";

      if (msg.toLowerCase().includes("no hay caja abierta")) {
        setDetalle(null);
        return;
      }

      setDetalle(null);
      setError(msg || "No se pudo cargar la caja");
    } finally {
      setLoading(false);
    }
  }

  async function handleAbrirCaja(e) {
    e.preventDefault();
    setError("");
    setMensaje("");

    const apertura = Number(montoApertura || 0);

    if (apertura < 0) {
      setError("El monto de apertura no puede ser negativo");
      return;
    }

    try {
      setProcesando(true);

      await abrirCaja({
        id_sucursal: ID_SUCURSAL,
        monto_apertura: apertura,
        id_usuario: ID_USUARIO,
      });

      setMensaje("Caja abierta correctamente");
      setMontoApertura("");

      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo abrir la caja");
    } finally {
      setProcesando(false);
    }
  }

  async function handleRegistrarEgreso(e) {
    e.preventDefault();

    if (!detalle?.caja?.id) return;

    setError("");
    setMensaje("");

    const monto = Number(egreso.monto || 0);
    const nota = egreso.nota.trim();

    if (monto <= 0) {
      setError("El monto del egreso debe ser mayor a 0");
      return;
    }

    if (nota.length < 3) {
      setError("La nota debe tener al menos 3 caracteres");
      return;
    }

    try {
      setProcesando(true);

      await registrarEgresoCaja(detalle.caja.id, {
        monto,
        nota,
        id_usuario: ID_USUARIO,
      });

      setMensaje(`Egreso registrado: ${formatCurrency(monto)}`);
      setEgreso({ monto: "", nota: "" });

      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo registrar el egreso");
    } finally {
      setProcesando(false);
    }
  }

  async function handleRegistrarAjuste(e) {
    e.preventDefault();

    if (!detalle?.caja?.id) return;

    setError("");
    setMensaje("");

    const monto = Number(ajuste.monto || 0);
    const nota = ajuste.nota.trim();

    if (monto <= 0) {
      setError("El monto del ajuste debe ser mayor a 0");
      return;
    }

    if (nota.length < 3) {
      setError("La nota debe tener al menos 3 caracteres");
      return;
    }

    try {
      setProcesando(true);

      await registrarAjusteCaja(detalle.caja.id, {
        monto,
        direccion: ajuste.direccion,
        nota,
        id_usuario: ID_USUARIO,
      });

      setMensaje(
        `Ajuste ${
          ajuste.direccion === "positivo" ? "positivo" : "negativo"
        } registrado: ${formatCurrency(monto)}`
      );

      setAjuste({ monto: "", direccion: "positivo", nota: "" });

      await cargarCaja();
    } catch (err) {
      setError(err.message || "No se pudo registrar el ajuste");
    } finally {
      setProcesando(false);
    }
  }

  async function handleCerrarCaja(e) {
    e.preventDefault();

    if (!detalle?.caja?.id) return;

    setError("");
    setMensaje("");

    const cierreReal = Number(montoReal || 0);

    if (cierreReal < 0) {
      setError("El monto real no puede ser negativo");
      return;
    }

    const confirmado = window.confirm("¿Seguro que querés cerrar la caja?");
    if (!confirmado) return;

    try {
      setProcesando(true);

      const resp = await cerrarCaja(detalle.caja.id, {
        monto_cierre_real: cierreReal,
        id_usuario: ID_USUARIO,
      });

      setMensaje(`Caja cerrada. Diferencia: ${formatCurrency(resp.diferencia)}`);
      setDetalle(null);
      setMontoReal("");
    } catch (err) {
      setError(err.message || "No se pudo cerrar la caja");
    } finally {
      setProcesando(false);
    }
  }

  const totales = useMemo(
    () =>
      detalle?.totales_por_submedio ?? {
        efectivo: 0,
        transferencia: 0,
        mercadopago: 0,
        tarjeta: 0,
      },
    [detalle]
  );

  const movimientos = detalle?.movimientos ?? [];

  const puedeRegistrarEgreso =
    !procesando &&
    Number(egreso.monto || 0) > 0 &&
    egreso.nota.trim().length >= 3;

  const puedeRegistrarAjuste =
    !procesando &&
    Number(ajuste.monto || 0) > 0 &&
    ajuste.nota.trim().length >= 3;

  const puedeAbrirCaja =
    !procesando && montoApertura !== "" && Number(montoApertura) >= 0;

  const puedeCerrarCaja =
    !procesando && montoReal !== "" && Number(montoReal) >= 0;

  if (loading) {
    return <div style={{ padding: "24px" }}>Cargando caja...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Caja"
        subtitle="Control de apertura, movimientos y cierre de caja"
        actions={
          <Button variant="outline" onClick={cargarCaja} disabled={procesando}>
            Refrescar
          </Button>
        }
      />

      {error ? <Alert type="error" message={error} /> : null}
      {mensaje ? <Alert type="success" message={mensaje} /> : null}

      {!detalle ? (
        <Card title="Abrir caja" subtitle="No hay caja abierta para la sucursal actual.">
          <form
            onSubmit={handleAbrirCaja}
            style={{ display: "grid", gap: "12px", maxWidth: "360px" }}
          >
            <Input
              label="Monto de apertura"
              type="number"
              min="0"
              step="0.01"
              value={montoApertura}
              onChange={(e) => setMontoApertura(e.target.value)}
              required
            />

            <Button fullWidth disabled={!puedeAbrirCaja}>
              {procesando ? "Abriendo..." : "Abrir caja"}
            </Button>
          </form>
        </Card>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <MetricCard label="Estado" value={detalle.caja.estado} />
            <MetricCard label="Fecha" value={detalle.caja.fecha} />
            <MetricCard
              label="Apertura"
              value={formatCurrency(detalle.caja.monto_apertura)}
            />
            <MetricCard
              label="Efectivo teórico"
              value={formatCurrency(detalle.efectivo_teorico)}
              emphasize
              tone="primary"
            />
            <MetricCard label="Caja" value={`#${detalle.caja.id}`} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <MetricCard
              label="Neto de movimientos en efectivo"
              value={formatCurrency(totales.efectivo)}
              tone={Number(totales.efectivo) < 0 ? "danger" : "success"}
            />
            <MetricCard
              label="Transferencia"
              value={formatCurrency(totales.transferencia)}
            />
            <MetricCard
              label="Mercado Pago"
              value={formatCurrency(totales.mercadopago)}
            />
            <MetricCard label="Tarjeta" value={formatCurrency(totales.tarjeta)} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <Card title="Registrar egreso" subtitle="Registrar salida manual de efectivo">
              <form
                onSubmit={handleRegistrarEgreso}
                style={{ display: "grid", gap: "12px" }}
              >
                <Input
                  label="Monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={egreso.monto}
                  onChange={(e) =>
                    setEgreso((prev) => ({ ...prev, monto: e.target.value }))
                  }
                  required
                />

                <Input
                  label="Nota"
                  type="text"
                  value={egreso.nota}
                  onChange={(e) =>
                    setEgreso((prev) => ({ ...prev, nota: e.target.value }))
                  }
                  required
                />

                <Button fullWidth disabled={!puedeRegistrarEgreso}>
                  {procesando ? "Guardando..." : "Registrar egreso"}
                </Button>
              </form>
            </Card>

            <Card title="Ajuste de caja" subtitle="Correcciones manuales auditables">
              <form
                onSubmit={handleRegistrarAjuste}
                style={{ display: "grid", gap: "12px" }}
              >
                <Select
                  label="Tipo de ajuste"
                  value={ajuste.direccion}
                  onChange={(e) =>
                    setAjuste((prev) => ({
                      ...prev,
                      direccion: e.target.value,
                    }))
                  }
                >
                  <option value="positivo">Ingreso (suma dinero)</option>
                  <option value="negativo">Egreso (resta dinero)</option>
                </Select>

                <Input
                  label="Monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={ajuste.monto}
                  onChange={(e) =>
                    setAjuste((prev) => ({ ...prev, monto: e.target.value }))
                  }
                  required
                />

                <Input
                  label="Nota"
                  type="text"
                  value={ajuste.nota}
                  onChange={(e) =>
                    setAjuste((prev) => ({ ...prev, nota: e.target.value }))
                  }
                  required
                />

                <Button fullWidth disabled={!puedeRegistrarAjuste}>
                  {procesando ? "Guardando..." : "Registrar ajuste"}
                </Button>
              </form>
            </Card>

            <Card title="Cerrar caja" subtitle="Registrar cierre y diferencia">
              <form
                onSubmit={handleCerrarCaja}
                style={{ display: "grid", gap: "12px" }}
              >
                <Input
                  label="Dinero contado en efectivo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoReal}
                  onChange={(e) => setMontoReal(e.target.value)}
                  required
                />

                <div style={{ color: "#555" }}>
                  Teórico efectivo:{" "}
                  <strong>{formatCurrency(detalle.efectivo_teorico)}</strong>
                </div>

                <Button fullWidth variant="danger" disabled={!puedeCerrarCaja}>
                  {procesando ? "Cerrando..." : "Cerrar caja"}
                </Button>
              </form>
            </Card>
          </div>

          <Card
            title="Movimientos"
            subtitle="Historial completo de movimientos de caja"
          >
            <Table
              columns={MOVIMIENTOS_COLUMNS}
              data={movimientos}
              emptyMessage="Sin movimientos registrados."
              renderRow={(mov) => (
                <>
                  <td style={tdStyle}>
                    {new Date(mov.fecha).toLocaleString("es-AR")}
                  </td>
                  <td style={tdStyle}>
                    {mov.tipo_movimiento === "ajuste"
                      ? `ajuste (${mov.direccion_ajuste})`
                      : mov.tipo_movimiento}
                  </td>
                  <td style={tdStyle}>{mov.submedio || "-"}</td>
                  <td
                    style={{
                      ...tdStyle,
                      color: getMovimientoMontoColor(mov),
                      fontWeight: 700,
                    }}
                  >
                    {formatCurrency(mov.monto)}
                  </td>
                  <td style={tdStyle}>
                    {mov.origen_tipo
                      ? `${mov.origen_tipo}${
                          mov.origen_id ? ` #${mov.origen_id}` : ""
                        }`
                      : "-"}
                  </td>
                  <td style={tdStyle}>
                    {mov.id_usuario ? `Usuario #${mov.id_usuario}` : "-"}
                  </td>
                  <td style={tdStyle}>{mov.nota || "-"}</td>
                </>
              )}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function getMovimientoMontoColor(mov) {
  if (mov.tipo_movimiento === "egreso") return "#b42318";

  if (mov.tipo_movimiento === "ajuste") {
    return mov.direccion_ajuste === "negativo" ? "#b42318" : "#027a48";
  }

  return "#027a48";
}

function Alert({ type, message }) {
  const isError = type === "error";

  return (
    <div
      style={{
        background: isError ? "#fff1f0" : "#ecfdf3",
        color: isError ? "#b42318" : "#027a48",
        padding: "12px",
        borderRadius: "10px",
        border: `1px solid ${isError ? "#f4c7c3" : "#abefc6"}`,
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

const tdStyle = {
  padding: "12px 16px",
  whiteSpace: "nowrap",
};
