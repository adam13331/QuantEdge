import { useSyncExternalStore } from "react";
import { setLanguage, type Language } from "../lib/i18n";
import { setCurrency } from "../lib/money";

// One control instead of two booleans: how much of the guidance layer to show.
//   off        numbers only
//   benchmarks the reference scales, no findings
//   full       findings + next steps + scales
export type GuidanceMode = "off" | "benchmarks" | "full";

export interface Settings {
  theme: "dark" | "light";
  accentColor: string;
  defaultMultiplier: number;
  defaultCommission: number;
  defaultFees: number;
  currencyFormat: "USD" | "EUR" | "GBP" | "CAD" | "AUD";
  dailyLossLimit: number;
  maxDailyTrades: number;
  defaultRiskPct: number;
  guidance: GuidanceMode;
  // Which day a week begins on. Drives the calendar grid and any weekly
  // bucketing; forex desks and prop-firm trackers rarely agree on this.
  weekStart: "sunday" | "monday";
  // Display only: trade times are stored in 24h and formatted on render.
  timeFormat: "24h" | "12h";
  // Interface copy. Stored values (symbols, notes, tags) are never translated.
  language: Language;
}

const DEFAULTS: Settings = {
  theme: "dark",
  accentColor: "#00e57a",
  defaultMultiplier: 100,
  defaultCommission: 0,
  defaultFees: 0,
  currencyFormat: "USD",
  dailyLossLimit: 0,
  maxDailyTrades: 0,
  defaultRiskPct: 1,
  guidance: "full",
  weekStart: "monday",
  timeFormat: "24h",
  language: "en",
};

const STORAGE_KEY = "quantedge_settings";

const COLOR_MAP: Record<string, { dim: string }> = {
  "#00e57a": { dim: "rgba(0,229,122,0.12)"   },
  "#4d9fff": { dim: "rgba(77,159,255,0.12)"  },
  "#a78bfa": { dim: "rgba(167,139,250,0.12)" },
  "#fb923c": { dim: "rgba(251,146,60,0.12)"  },
  "#f472b6": { dim: "rgba(244,114,182,0.12)" },
};

// The neon accents were chosen on #0a0a0f. On a white surface they sit around
// 2:1, so light mode gets an equivalent darker shade instead of the same hex.
const LIGHT_COLOR_MAP: Record<string, { value: string; dim: string }> = {
  "#00e57a": { value: "#067a44", dim: "rgba(6,122,68,0.12)"   },
  "#4d9fff": { value: "#1a6fc4", dim: "rgba(26,111,196,0.12)" },
  "#a78bfa": { value: "#6d4fd1", dim: "rgba(109,79,209,0.12)" },
  "#fb923c": { value: "#b45309", dim: "rgba(180,83,9,0.12)"   },
  "#f472b6": { value: "#b83a76", dim: "rgba(184,58,118,0.12)" },
};

function applyAccentColor(value: string, theme: Settings["theme"] = "dark") {
  const light = LIGHT_COLOR_MAP[value];
  const dark = COLOR_MAP[value];
  if (!dark) return;
  const root = document.documentElement;
  root.style.setProperty("--accent-green", theme === "light" && light ? light.value : value);
  const dim = theme === "light" && light ? light.dim : dark.dim;
  root.style.setProperty("--accent-dim", dim);
  root.style.setProperty("--accent-green-dim", dim);
}

function applyTheme(theme: "dark" | "light") {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function readStored(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    const parsed = JSON.parse(stored) as Partial<Settings> & {
      showRecommendations?: boolean;
      showMetricGuides?: boolean;
    };
    const merged: Settings = { ...DEFAULTS, ...parsed };
    // The old build stored two switches. Map them to the single control so an
    // existing choice survives the upgrade instead of resetting to defaults.
    if (parsed.guidance === undefined) {
      merged.guidance = parsed.showRecommendations === false
        ? (parsed.showMetricGuides ? "benchmarks" : "off")
        : "full";
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}

// One store for the whole app rather than a useState copy per caller. Settings
// that drive derived numbers — weekStart orders the Calendar columns and the
// day-of-week breakdowns — must change the moment they are toggled, in every
// component, without a reload.
let current: Settings = typeof window === "undefined" ? DEFAULTS : readStored();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return current;
}

// The server always renders with DEFAULTS; without this the hydration render
// on the client would read localStorage and produce different markup, failing
// hydration for any user with non-default settings stored.
function getServerSnapshot(): Settings {
  return DEFAULTS;
}

if (typeof window !== "undefined") {
  applyTheme(current.theme);
  applyAccentColor(current.accentColor, current.theme);
  // The server renders English, so the first client render must too — the
  // stored choice only reaches the DOM once hydration has settled.
  setLanguage(current.language);
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Assign during render (not in an effect) so every component rendered below
  // the shell in this same pass already translates into the right language and
  // formats money with the right currency.
  setLanguage(settings.language);
  setCurrency(settings.currencyFormat);

  const updateSettings = (partial: Partial<Settings>) => {
    current = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    emit();
    if (partial.theme !== undefined) applyTheme(current.theme);
    if (partial.accentColor || partial.theme !== undefined) {
      applyAccentColor(current.accentColor, current.theme);
    }
  };

  const resetSettings = () => {
    current = DEFAULTS;
    localStorage.removeItem(STORAGE_KEY);
    emit();
    applyTheme(DEFAULTS.theme);
    applyAccentColor(DEFAULTS.accentColor, DEFAULTS.theme);
    setLanguage(DEFAULTS.language);
  };

  return { settings, updateSettings, resetSettings };
}