const LOCALE = "es-AR";
const CURRENCY = "ARS";

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatMoney(value, options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return toNumber(value).toLocaleString(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

export function formatNumber(value, options = {}) {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 3,
  } = options;

  return toNumber(value).toLocaleString(LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

export function formatPercent(value, options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return `${toNumber(value).toLocaleString(LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  })}%`;
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString(LOCALE);
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(LOCALE);
}

export const formatCurrency = formatMoney;