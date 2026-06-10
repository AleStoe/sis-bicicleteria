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
import { PageHeader, Button, useBreakpoint } from "../components/ui";
import CajaAlert from "../components/caja/CajaAlert";
import CajaAperturaCard from "../components/caja/CajaAperturaCard";
import CajaResumenCards from "../components/caja/CajaResumenCards";
import CajaTotalesSubmedio from "../components/caja/CajaTotalesSubmedio";
import CajaEgresoCard from "../components/caja/CajaEgresoCard";
import CajaAjusteCard from "../components/caja/CajaAjusteCard";
import CajaCierreCard from "../components/caja/CajaCierreCard";
import CajaMovimientosTable from "../components/caja/CajaMovimientosTable";
import { useSession } from "../context/SessionContext";
import { ConfirmModal } from "../components/ui/ConfirmModal";


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
  const [confirmConfig, setConfirmConfig] = useState(null);
  const isMobile = useBreakpoint();
  const { usuarioId, sucursalId } = useSession();

  function pedirConfirmacion(config) {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...config,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        },
      });
    });
  }

  useEffect(() => {
    cargarCaja();
  }, [sucursalId]);

  async function cargarCaja() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const cajaAbierta = await obtenerCajaAbierta(sucursalId);
      const detalleCaja = await obtenerCajaDetalle(cajaAbierta.caja.id);

      setDetalle(detalleCaja);
      setMontoReal(String(detalleCaja.efectivo_teorico ?? ""));
    } catch (err) {
      const msg = String(err?.message || "");

      if (
        msg.toLowerCase().includes("no hay caja abierta") ||
        msg.toLowerCase().includes("404")
      ) {
        setDetalle(null);
        setError("");
        return;
      }

      setDetalle(null);

      if (msg.toLowerCase().includes("failed to fetch")) {
        setError(
          "No se pudo conectar con el servidor. Revisá que el backend esté encendido."
        );
        return;
      }

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
        id_sucursal: sucursalId,
        monto_apertura: apertura,
        id_usuario: usuarioId,
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

    const confirmado = await pedirConfirmacion({
      title: "Registrar egreso",
      message: `Vas a registrar un EGRESO de ${formatCurrency(monto)}.\n\nMotivo: ${nota}\n\nEsta operación impacta en caja. ¿Confirmás?`,
      confirmText: "Registrar egreso",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);

      await registrarEgresoCaja(detalle.caja.id, {
        monto,
        nota,
        id_usuario: usuarioId,
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

    const direccionTexto = ajuste.direccion === "positivo" ? "POSITIVO" : "NEGATIVO";
    const confirmado = await pedirConfirmacion({
      title: "Registrar ajuste de caja",
      message: `Vas a registrar un AJUSTE ${direccionTexto} de ${formatCurrency(monto)}.\n\nMotivo: ${nota}\n\nLos ajustes deben usarse solo para corregir diferencias reales de caja. ¿Confirmás?`,
      confirmText: "Registrar ajuste",
      cancelText: "Cancelar",
      variant: "warning",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);

      await registrarAjusteCaja(detalle.caja.id, {
        monto,
        direccion: ajuste.direccion,
        nota,
        id_usuario: usuarioId,
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

    const confirmado = await pedirConfirmacion({
      title: "Cerrar caja",
      message: `¿Seguro que querés cerrar la caja?\n\nEfectivo teórico: ${formatCurrency(detalle.efectivo_teorico)}\nEfectivo contado: ${formatCurrency(cierreReal)}\n\nDespués del cierre no deberías registrar más movimientos en esta caja.`,
      confirmText: "Cerrar caja",
      cancelText: "Cancelar",
      variant: "danger",
    });

    if (!confirmado) return;

    try {
      setProcesando(true);

      const resp = await cerrarCaja(detalle.caja.id, {
        monto_cierre_real: cierreReal,
        id_usuario: usuarioId,
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
    <div style={isMobile ? styles.pageMobile : undefined}>
      <PageHeader
        title="Caja"
        subtitle="Control de apertura, movimientos y cierre de caja"
        actions={
          <Button variant="outline" onClick={cargarCaja} disabled={procesando}>
            Refrescar
          </Button>
        }
      />

      {error ? <CajaAlert type="error" message={error} /> : null}
      {mensaje ? <CajaAlert type="success" message={mensaje} /> : null}

      {!detalle ? (
        <CajaAperturaCard
          montoApertura={montoApertura}
          setMontoApertura={setMontoApertura}
          onSubmit={handleAbrirCaja}
          puedeAbrirCaja={puedeAbrirCaja}
          procesando={procesando}
        />
      ) : (
        <>
          <CajaResumenCards detalle={detalle} formatCurrency={formatCurrency} />

          <CajaTotalesSubmedio totales={totales} formatCurrency={formatCurrency} />

          <div style={{ ...styles.operacionesGrid, ...(isMobile ? styles.operacionesGridMobile : {}) }}>
            <CajaEgresoCard
              egreso={egreso}
              setEgreso={setEgreso}
              onSubmit={handleRegistrarEgreso}
              puedeRegistrarEgreso={puedeRegistrarEgreso}
              procesando={procesando}
            />

            <CajaAjusteCard
              ajuste={ajuste}
              setAjuste={setAjuste}
              onSubmit={handleRegistrarAjuste}
              puedeRegistrarAjuste={puedeRegistrarAjuste}
              procesando={procesando}
            />

            <CajaCierreCard
              montoReal={montoReal}
              setMontoReal={setMontoReal}
              efectivoTeorico={detalle.efectivo_teorico}
              onSubmit={handleCerrarCaja}
              puedeCerrarCaja={puedeCerrarCaja}
              procesando={procesando}
              formatCurrency={formatCurrency}
            />
          </div>

          <CajaMovimientosTable
            movimientos={detalle.movimientos ?? []}
            formatCurrency={formatCurrency}
          />
        </>
      )}

      <ConfirmModal
        open={Boolean(confirmConfig)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        cancelText={confirmConfig?.cancelText}
        variant={confirmConfig?.variant}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={confirmConfig?.onCancel}
      />
    </div>
  );
}

const styles = {
  pageMobile: {
    padding: "0 0 12px",
    overflowX: "hidden",
  },
  operacionesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  operacionesGridMobile: {
    gridTemplateColumns: "1fr",
    gap: "12px",
  },
};
