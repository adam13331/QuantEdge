export type TimeFormat = "24h" | "12h";

// Stored times are always the exporter's 24h "HH:MM"; this only decides how
// they read on screen, so switching the setting never rewrites trade data.
// Anything that is not a clock time is passed through untouched, which keeps
// imported oddities ("09:32:07", "2:05 PM") visible instead of blank.
export function formatTime(value: string | null | undefined, mode: TimeFormat = "24h"): string {
  if (!value) return "";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!match) return value;

  const minutes = match[2];
  let hours = Number(match[1]);
  const suffix = match[3]?.toUpperCase();
  if (suffix === "PM" && hours < 12) hours += 12;
  if (suffix === "AM" && hours === 12) hours = 0;
  if (hours > 23) return value;

  if (mode === "24h") return `${String(hours).padStart(2, "0")}:${minutes}`;
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}