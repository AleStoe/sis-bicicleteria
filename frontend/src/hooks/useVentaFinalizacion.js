import { useState } from "react";
import { useSession } from "../context/SessionContext";
import { crearVenta, entregarVenta } from "../services/ventasService";
import { validarVentaAntesDeCrear } from "../validators/ventasValidator";
import { buildVentaPayload } from "../builders/ventasPayloadBuilder";


export default function useVentaFinalizacion({
  navigate,
  clienteId,
  tipoPrecio,
  items,
  observaciones,
  usarCredito,
  setError,
  setMensaje,
}) {
  const [guardando, setGuardando] = useState(false);
  const { usuarioId, sucursalId } = useSession();
  function validarVentaAntesDeFinalizar() {
    const errorValidacion = validarVentaAntesDeCrear({ clienteId, items });

    if (errorValidacion) {
      setError(errorValidacion);
      return false;
    }

    return true;
  }

  function crearPayloadVenta(pagos = []) {
    return buildVentaPayload({
      clienteId,
      sucursalId,
      usuarioId,
      tipoPrecio,
      items,
      pagos,
      observaciones,
      usarCredito,
    });
  }

  async function finalizarCheckout({ pagos = [], entregar_ahora }) {
    if (!validarVentaAntesDeFinalizar()) return;

    const payload = crearPayloadVenta(pagos);

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const resultado = await crearVenta(payload);

      if (entregar_ahora) {
        await entregarVenta(resultado.venta_id, {
          id_usuario: usuarioId,
        });
      }

      navigate(`/ventas/${resultado.venta_id}`);
    } catch (err) {
      setError(err.message || "No se pudo finalizar la venta");
    } finally {
      setGuardando(false);
    }
  }

  return {
    guardando,
    finalizarCheckout,
    crearPayloadVenta,
    validarVentaAntesDeFinalizar,
  };
}
