const LOCALE = "es-AR";
const CURRENCY = "ARS";

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatMoney(value, options = {}) {
  const {
    cents = false,
    minimumFractionDigits = cents ? 2 : 0,
    maximumFractionDigits = cents ? 2 : 0,
  } = options;

  return toNumber(value).toLocaleString(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

export function formatMoneyPrecise(value) {
  return formatMoney(value, { cents: true });
}

export function formatMoneyCompact(value) {
  return formatMoney(value, { cents: false });
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

export function formatInteger(value) {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

export function parseMoneyInput(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
}

export const formatCurrency = formatMoney;