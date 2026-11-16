// One place that knows what a currency looks like on screen. Every amount used
// to be a hardcoded "$", so a EUR account read as dollars on every card, row
// and PDF page — and the currency control in Settings changed nothing.
//
// The active currency is module state for the same reason the i18n language is:
// the PDF renderer and the insight sentences are plain functions, not
// components, and they must format with the same symbol as the screen.

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
};

// One display currency for the whole app, chosen in Settings — the same control
// that used to change nothing. An account's own denomination is a separate
// fact, shown where the account is the subject (Accounts), and can be passed
// explicitly when a caller knows better.
let active: string = "USD";

export function setCurrency(code: string | null | undefined): void {
  if (code) active = code.toUpperCase();
}

export function currencySymbol(code?: string | null): string {
  const key = (code ?? active).toUpperCase();
  return SYMBOLS[key] ?? "$";
}

const fix = (value: number, digits: number): string =>
  // -0.00 is a display artefact of rounding; it reads as a loss that never
  // happened.
  Object.is(value, -0) || (value === 0 && digits > 0)
    ? (0).toFixed(digits)
    : value.toFixed(digits);

/** Symbol plus a fixed number of decimals: "$1,234.56" style stays as before. */
export function money(value: number | null | undefined, digits = 2, code?: string | null): string {
  const sign = currencySymbol(code);
  if (value == null || !Number.isFinite(Number(value))) return `${sign}0`;
  return `${sign}${fix(Number(value), digits)}`;
}

/** Symbol plus the value as it stands, for places that already rounded it. */
export function moneyRaw(value: number | string | null | undefined, code?: string | null): string {
  const sign = currencySymbol(code);
  if (value == null) return sign;
  return `${sign}${value}`;
}

/** Symbol plus a thousands-grouped value, for axis ticks and big totals. */
export function moneyGrouped(value: number, digits = 0, code?: string | null): string {
  const sign = currencySymbol(code);
  const safe = Number.isFinite(value) ? value : 0;
  return `${sign}${safe.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}
