// Single translation point for the interface. English is the source language:
// every key in `HU` is the exact English string a component renders, so a
// missing entry falls back to English instead of showing a raw key.
//
// Findings are generated sentences with figures baked into them ("Profit factor
// 1.42"), which cannot be enumerated ahead of time. Those are matched by
// masking each number-ish run into an index placeholder ({0}, {1}, …) and
// looking the skeleton up, so word order can differ between the languages.

import { HU } from "./i18n.hu";

export type Language = "en" | "hu";

/** Options for the Settings control. Labels are endonyms: they are never
 *  translated, so a reader can find their own language in the list. */
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hu", label: "Magyar" },
];

// Kept outside React so module-level helpers and the PDF renderer, which are
// not components, translate with the same language as the screen. `useSettings`
// syncs it on every read, so the value is already correct before children of
// the shell render.
let active: Language = "en";

export function setLanguage(next: Language) {
  active = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
}

export function getLanguage(): Language {
  return active;
}

// Currency signs, percentages, decimals and thousands separators are all part
// of one token: masking "+$1,234.56" as a single value keeps the Hungarian
// sentence free to move it anywhere. Tickers are matched first and kept whole —
// a finding about GER40 must not be read as a sentence about "GER" and "40".
// Grouped thousands first, so "10,000, axis" takes the number and leaves the comma.
const TOKEN = /(?<![A-Za-z0-9])(?:[A-Z]{2,}[0-9]{1,4})(?![A-Za-z0-9])|[-+]?\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?/g;

function mask(text: string): { key: string; values: string[] } {
  const values: string[] = [];
  const key = text.replace(TOKEN, (match) => `{${values.push(match) - 1}}`);
  return { key, values };
}

/** Translate one English string. Safe to call anywhere, including outside
 *  React; returns the English input when no Hungarian entry matches. */
export function t(en: string): string {
  if (active === "en" || !en) return en;
  const exact = HU[en];
  if (exact !== undefined) return exact;

  const { key, values } = mask(en);
  const template = HU[key];
  if (template === undefined) return en;
  return template.replace(/\{(\d+)\}/g, (_, i) => values[Number(i)] ?? "");
}

/** Join a count with a translated noun. Hungarian does not pluralise after a
 *  numeral, so the plural form is only used by English. */
export function count(n: number, singular: string, plural: string): string {
  if (active === "hu") return `${n} ${t(singular)}`;
  return `${n} ${n === 1 ? singular : plural}`;
}
