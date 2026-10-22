import { useSyncExternalStore } from "react";

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
  showRecommendations: boolean;
  // Which day a week begins on. Drives the calendar grid and any weekly
  // bucketing; forex desks and prop-firm trackers rarely agree on this.
  weekStart: "sunday" | "monday";
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
  showRecommendations: true,
  weekStart: "monday",
};

const STORAGE_KEY = "quantedge_settings";

const COLOR_MAP: Record<string, { dim: string }> = {
  "#00e57a": { dim: "rgba(0,229,122,0.12)"   },
  "#4d9fff": { dim: "rgba(77,159,255,0.12)"  },
  "#a78bfa": { dim: "rgba(167,139,250,0.12)" },
  "#fb923c": { dim: "rgba(251,146,60,0.12)"  },
  "#f472b6": { dim: "rgba(244,114,182,0.12)" },
};

function applyAccentColor(value: string) {
  const color = COLOR_MAP[value];
  if (!color) return;
  const root = document.documentElement;
  root.style.setProperty("--accent-green", value);
  root.style.setProperty("--accent-dim", color.dim);
  root.style.setProperty("--accent-green-dim", color.dim);
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
    return { ...DEFAULTS, ...JSON.parse(stored) };
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
  applyAccentColor(current.accentColor);
  applyTheme(current.theme);
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateSettings = (partial: Partial<Settings>) => {
    current = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    emit();
    if (partial.accentColor) applyAccentColor(partial.accentColor);
    if (partial.theme !== undefined) applyTheme(partial.theme);
  };

  const resetSettings = () => {
    current = DEFAULTS;
    localStorage.removeItem(STORAGE_KEY);
    emit();
    applyAccentColor(DEFAULTS.accentColor);
    applyTheme(DEFAULTS.theme);
  };

  return { settings, updateSettings, resetSettings };
}