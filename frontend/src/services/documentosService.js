import { API_BASE_URL } from "../config/appConfig";
import { getStoredAuthToken } from "./sessionStore";

function withAccessToken(url) {
  const token = getStoredAuthToken();
  if (!token) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}access_token=${encodeURIComponent(token)}`;
}

export function getComprobanteXVentaUrl(ventaId) {
  return withAccessToken(`${API_BASE_URL}/documentos/ventas/${ventaId}/comprobante-x`);
}

export function getResumenCobrosVentaUrl(ventaId) {
  return withAccessToken(`${API_BASE_URL}/documentos/ventas/${ventaId}/resumen-cobros`);
}

export function getReciboPagoUrl(pagoId) {
  return withAccessToken(`${API_BASE_URL}/documentos/pagos/${pagoId}/recibo`);
}

export function getPresupuestoTallerUrl(ordenId) {
  return withAccessToken(`${API_BASE_URL}/documentos/taller/${ordenId}/presupuesto`);
}

export function getCotizacionPdfUrl(cotizacionId) {
  return withAccessToken(`${API_BASE_URL}/documentos/cotizaciones/${cotizacionId}/pdf`);
}

export function getEtiquetaDepositoVarianteUrl(varianteId, copias = 1) {
  return withAccessToken(
    `${API_BASE_URL}/documentos/etiquetas/variantes/${varianteId}/deposito?copias=${encodeURIComponent(copias)}`
  );
}

export function getPrecioA4VarianteUrl(varianteId) {
  return withAccessToken(`${API_BASE_URL}/documentos/etiquetas/variantes/${varianteId}/precio-a4`);
}

export function getHistoriaVarianteUrl(varianteId) {
  return withAccessToken(`${API_BASE_URL}/documentos/etiquetas/variantes/${varianteId}/historia`);
}

export function getEtiquetaDepositoBicicletaUrl(bicicletaId, copias = 1) {
  return withAccessToken(
    `${API_BASE_URL}/documentos/etiquetas/bicicletas/${bicicletaId}/deposito?copias=${encodeURIComponent(copias)}`
  );
}

export function getPrecioA4BicicletaUrl(bicicletaId) {
  return withAccessToken(`${API_BASE_URL}/documentos/etiquetas/bicicletas/${bicicletaId}/precio-a4`);
}

export function getHistoriaBicicletaUrl(bicicletaId) {
  return withAccessToken(`${API_BASE_URL}/documentos/etiquetas/bicicletas/${bicicletaId}/historia`);
}
