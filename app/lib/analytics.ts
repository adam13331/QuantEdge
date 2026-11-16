import { Trade } from "./types";

// Shared trading-math used by both the Analytics tab and the PDF report, so the
// two can never drift apart. Every function here is pure.

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function normalizeDate(raw: string): string {
  if (raw.includes("/")) {
    const [mm, dd, yyyy] = raw.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return raw;
}

export function getDailyPnl(trades: Trade[]): { date: string; pnl: number }[] {
  const map: Record<string, number> = {};
  for (const t of trades) {
    const d = normalizeDate(t.date);
    map[d] = (map[d] || 0) + t.pnl;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date, pnl }));
}

export function sharpeRatio(dailyPnl: number[]): number {
  if (dailyPnl.length < 5) return 0;
  const mean = dailyPnl.reduce((s, v) => s + v, 0) / dailyPnl.length;
  const sd = stdDev(dailyPnl);
  if (sd === 0) return 0;
  return (mean / sd) * Math.sqrt(252);
}

export function sortinoRatio(dailyPnl: number[]): number {
  if (dailyPnl.length < 5) return 0;
  const mean = dailyPnl.reduce((s, v) => s + v, 0) / dailyPnl.length;
  // Downside deviation from a zero target across every period, which is the
  // standard Sortino denominator. Taking the std dev of only the losing days
  // around their own mean understates the risk (it removes the distance from
  // zero) and reports a ratio that drifts with how losing days cluster.
  const downside = dailyPnl.reduce((s, v) => s + Math.min(0, v) ** 2, 0) / dailyPnl.length;
  if (downside === 0) return mean > 0 ? 99 : 0;
  return (mean / Math.sqrt(downside)) * Math.sqrt(252);
}

export function expectancy(wins: Trade[], losses: Trade[]): number {
  if (wins.length + losses.length === 0) return 0;
  const total = wins.length + losses.length;
  const wr = wins.length / total;
  const lr = losses.length / total;
  const avgW = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgL = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  return wr * avgW - lr * avgL;
}

// Profit factor is gross profit divided by gross loss, not the payoff ratio
// (average win / average loss). A book can lose more per trade than it wins and
// still be profitable if it wins often enough, so the two ratios must stay
// separate. Null means no losing trades rather than an invented ceiling.
export function profitFactor(wins: Trade[], losses: Trade[]): number | null {
  const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  if (grossLosses === 0) return grossWins > 0 ? null : 0;
  return parseFloat((grossWins / grossLosses).toFixed(2));
}

export function drawdownStats(sortedTrades: Trade[], initialBalance: number) {
  let equity = initialBalance;
  let peak = equity;
  let maxDd = 0;
  let maxDdPct = 0;
  let currentDdStart: string | null = null;
  let longestDdDays = 0;
  let inDrawdown = false;
  const ddCurve: { date: string; dd: number; equity: number }[] = [];
  for (const t of sortedTrades) {
    equity += t.pnl;
    if (equity > peak) {
      peak = equity;
      if (inDrawdown && currentDdStart) {
        const startMs = new Date(normalizeDate(currentDdStart)).getTime();
        const endMs   = new Date(normalizeDate(t.date)).getTime();
        const days    = Math.round((endMs - startMs) / 86400000);
        if (days > longestDdDays) longestDdDays = days;
      }
      inDrawdown = false;
      currentDdStart = null;
    } else {
      if (!inDrawdown) { inDrawdown = true; currentDdStart = t.date; }
    }
    const dd    = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    const ddAbs = equity - peak;
    if (ddAbs < maxDd) { maxDd = ddAbs; maxDdPct = dd; }
    ddCurve.push({ date: normalizeDate(t.date), dd: parseFloat(dd.toFixed(2)), equity: parseFloat(equity.toFixed(2)) });
  }
  let currentDdDays = 0;
  if (inDrawdown && currentDdStart) {
    currentDdDays = Math.round((Date.now() - new Date(normalizeDate(currentDdStart)).getTime()) / 86400000);
  }
  return { maxDd, maxDdPct, longestDdDays, currentDdDays, ddCurve };
}

export function calmarRatio(totalPnl: number, initialBalance: number, tradingDays: number, maxDdPct: number): number {
  if (initialBalance === 0 || tradingDays === 0 || maxDdPct === 0) return 0;
  const annualizedReturn = (totalPnl / initialBalance) * (252 / tradingDays) * 100;
  return annualizedReturn / Math.abs(maxDdPct);
}

// True R uses the risk the trader actually accepted at entry (from the stop
// loss MetaTrader recorded). Trades without a known risk fall back to the
// average loss as the 1R unit, so mixed datasets still render.
export function rMultiples(trades: Trade[], avgLoss: number): { r: number; win: boolean }[] {
  if (avgLoss === 0 && !trades.some((t) => t.plannedRisk != null && t.plannedRisk > 0)) return [];
  return trades.map((t) => {
    const unit = (t.plannedRisk != null && t.plannedRisk > 0) ? t.plannedRisk : avgLoss;
    return {
      r: unit > 0 ? parseFloat((t.pnl / unit).toFixed(2)) : 0,
      win: t.status === "win",
    };
  });
}

export const R_BUCKET_ORDER = ["≤-3R", "-3R", "-2R", "-1R", "+0R", "+1R", "+2R", "≥3R"];

export function rHistogram(rMs: { r: number }[]): { bucket: string; count: number; positive: boolean }[] {
  const buckets: Record<string, number> = {};
  for (const { r } of rMs) {
    const bucket = r <= -3 ? "≤-3R" : r >= 3 ? "≥3R" :
      r < 0 ? `${Math.floor(r)}R` : `+${Math.floor(r)}R`;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
  return R_BUCKET_ORDER
    .filter((b) => buckets[b])
    .map((b) => ({ bucket: b, count: buckets[b], positive: b.startsWith("+") && b !== "+0R" }));
}

export function rollingWinRate(trades: Trade[], window = 20): { trade: number; wr: number }[] {
  return trades
    .slice(window - 1)
    .map((_, i) => {
      const slice = trades.slice(i, i + window);
      const wins = slice.filter((t) => t.status === "win").length;
      return { trade: i + window, wr: Math.round((wins / window) * 100) };
    });
}

export function byDayOfWeek(trades: Trade[], weekStart: "sunday" | "monday" = "monday"): { day: string; pnl: number; count: number; wr: number }[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const map: Record<number, { pnl: number; count: number; wins: number }> = {};
  for (const t of trades) {
    const d = new Date(normalizeDate(t.date) + "T12:00:00").getDay();
    if (!map[d]) map[d] = { pnl: 0, count: 0, wins: 0 };
    map[d].pnl += t.pnl;
    map[d].count += 1;
    if (t.status === "win") map[d].wins += 1;
  }
  // Five sessions, running from whichever day the trader calls the week's
  // start. A Sunday start therefore profiles Sun-Thu, which is the week a
  // crypto or futures desk actually trades.
  const first = weekStart === "monday" ? 1 : 0;
  const session = [0, 1, 2, 3, 4].map((i) => (first + i) % 7);
  return session.map((d) => ({
    day: days[d],
    pnl: parseFloat((map[d]?.pnl || 0).toFixed(2)),
    count: map[d]?.count || 0,
    wr: map[d]?.count ? Math.round((map[d].wins / map[d].count) * 100) : 0,
  }));
}

// Calendar grids and weekly bucketing both need "how many days precede this
// one". Kept here so the calendar header order and its leading blanks can never
// disagree the way two hardcoded literals silently did.
export function leadingBlanks(date: Date, weekStart: "sunday" | "monday"): number {
  const dow = date.getDay();
  return weekStart === "monday" ? (dow + 6) % 7 : dow;
}

// Weekday headers rotated to the configured start. Index 0 is the first column.
export function weekdayHeaders(weekStart: "sunday" | "monday"): string[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const offset = weekStart === "monday" ? 1 : 0;
  return [...days.slice(offset), ...days.slice(0, offset)];
}

// ─── Calendar ───────────────────────────────────────────────────────────

// The sample floor the Calendar caveat and the insights engine share, so the
// page cannot quote a different threshold than the recommendations fire on.
export const SAMPLE_FLOOR = 30;

// A trade's side, normalized. MetaTrader writes "long"/"short", but imported
// or older rows can carry either case; a strict equality check dropped those
// from every direction split without saying so.
export function tradeSide(trade: Trade): "long" | "short" {
  return (trade.direction || "").trim().toLowerCase().startsWith("s") ? "short" : "long";
}

// The book's 1R when a trade has no accepted risk on record: the mean losing
// trade. Same fallback rMultiples() uses, so a calendar row's R and the R
// distribution chart cannot disagree.
export function averageLoss(trades: Trade[]): number {
  const losses = trades.filter((t) => t.pnl < 0);
  return losses.length > 0
    ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)
    : 0;
}

export function tradeR(trade: Trade, avgLoss: number): number | null {
  const unit = trade.plannedRisk != null && trade.plannedRisk > 0 ? trade.plannedRisk : avgLoss;
  if (!(unit > 0)) return null;
  return parseFloat((trade.pnl / unit).toFixed(2));
}

export interface MonthWeek {
  index: number;
  pnl: number;
  trades: number;
}

// Weekly subtotals for one month's grid. The week index is the grid row, using
// the same offset as leadingBlanks, so a total can never sit beside a row of
// days it does not own.
export function monthWeeks(
  trades: Trade[],
  year: number,
  month: number,
  weekStart: "sunday" | "monday",
): MonthWeek[] {
  const first = leadingBlanks(new Date(year, month, 1), weekStart);
  const rows: MonthWeek[] = Array.from({ length: 6 }, (_, index) => ({ index, pnl: 0, trades: 0 }));
  for (const t of trades) {
    const [y, m, day] = normalizeDate(t.date).split("-").map(Number);
    if (y !== year || m - 1 !== month || !day) continue;
    const row = Math.floor((first + day - 1) / 7);
    if (row < 0 || row > 5) continue;
    rows[row].pnl += t.pnl;
    rows[row].trades += 1;
  }
  for (const r of rows) r.pnl = parseFloat(r.pnl.toFixed(2));
  return rows;
}

export interface DayRisk {
  lossBreached: boolean;
  tradeBreached: boolean;
  lossWarning: boolean;
  tradeWarning: boolean;
}

// Same thresholds and same comparison the Dashboard's guard strip uses, so a
// day the Calendar marks is a day the guard would have flagged too. A limit of
// 0 means "not configured" and never fires.
export function dayRisk(
  pnl: number,
  count: number,
  dailyLossLimit: number,
  maxDailyTrades: number,
): DayRisk {
  const loss = Math.abs(Math.min(pnl, 0));
  const lossBreached  = dailyLossLimit > 0 && loss >= dailyLossLimit;
  const tradeBreached = maxDailyTrades > 0 && count >= maxDailyTrades;
  return {
    lossBreached,
    tradeBreached,
    lossWarning:  !lossBreached  && dailyLossLimit > 0 && (loss / dailyLossLimit) * 100 >= 75,
    tradeWarning: !tradeBreached && maxDailyTrades > 0 && (count / maxDailyTrades) * 100 >= 75,
  };
}

export interface HourBucket {
  hour: number;
  label: string;
  count: number;
  wins: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
}

export function byHourOfDay(trades: Trade[]): HourBucket[] {
  const map: Record<number, { count: number; wins: number; totalPnl: number }> = {};
  for (const t of trades) {
    if (t.hourOfDay == null) continue;
    const h = t.hourOfDay;
    if (!map[h]) map[h] = { count: 0, wins: 0, totalPnl: 0 };
    map[h].count++;
    map[h].totalPnl += t.pnl;
    if (t.status === "win") map[h].wins++;
  }
  return Object.entries(map)
    .map(([h, d]) => {
      const hour = parseInt(h, 10);
      return {
        hour,
        // 24-hour clock, matching the HH:MM times MetaTrader exports.
        label: `${String(hour).padStart(2, "0")}:00`,
        count: d.count,
        wins: d.wins,
        totalPnl: parseFloat(d.totalPnl.toFixed(2)),
        avgPnl:   parseFloat((d.totalPnl / d.count).toFixed(2)),
        winRate:  Math.round((d.wins / d.count) * 100),
      };
    })
    .sort((a, b) => a.hour - b.hour);
}

export function streaks(trades: Trade[]) {
  let maxW = 0, maxL = 0, cur = 0;
  let curType: "win" | "loss" | null = null;
  const sorted = [...trades].sort((a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date)));
  for (const t of sorted) {
    const isWin = t.status === "win";
    if (curType === null || (isWin && curType === "win") || (!isWin && curType === "loss")) {
      cur++;
      curType = isWin ? "win" : "loss";
    } else {
      if (curType === "win") maxW = Math.max(maxW, cur);
      else maxL = Math.max(maxL, cur);
      cur = 1;
      curType = isWin ? "win" : "loss";
    }
  }
  if (curType === "win") maxW = Math.max(maxW, cur);
  else if (curType === "loss") maxL = Math.max(maxL, cur);
  return { maxWinStreak: maxW, maxLossStreak: maxL, currentStreak: cur, currentType: curType };
}

// Exact hold time when MetaTrader recorded it, else derived from the
// time-of-day pair (a close after midnight is treated as crossing over).
export function tradeHours(trade: Trade): number | null {
  if (trade.durationMin != null && trade.durationMin > 0) return trade.durationMin / 60;

  const toHours = (raw?: string): number | null => {
    if (!raw) return null;
    const t = raw.trim();
    const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const period = ampm[3].toUpperCase();
      if (period === "AM" && h === 12) h = 0;
      if (period === "PM" && h !== 12) h += 12;
      return h + parseInt(ampm[2], 10) / 60;
    }
    const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) {
      const h = parseInt(h24[1], 10);
      if (h <= 23) return h + parseInt(h24[2], 10) / 60;
    }
    return null;
  };

  const entry = toHours(trade.entryTime);
  const exit  = toHours(trade.exitTime);
  if (entry === null || exit === null) return null;
  const hours = exit - entry < 0 ? exit - entry + 24 : exit - entry;
  return hours > 0 ? hours : null;
}

// R:R is stored as free text (the trade panel hints "1:2.5") and the MetaTrader
// exporter writes a plain multiple.
export function parseRR(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[rR]/g, "");
  if (!cleaned) return null;
  const parts = cleaned.split(":");
  if (parts.length === 2) {
    const reward = parseFloat(parts[1]);
    const risk   = parseFloat(parts[0]);
    if (isNaN(reward) || isNaN(risk) || risk === 0) return null;
    return Math.abs(reward / risk);
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export interface InstrumentRow {
  symbol: string;
  trades: number;
  wins: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
  avgR: number | null;
  best: number;
  worst: number;
}

export function byInstrument(trades: Trade[]): InstrumentRow[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.underlying || t.symbol;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries())
    .map(([symbol, list]) => {
      const wins  = list.filter((t) => t.status === "win");
      const pnl   = list.reduce((s, t) => s + t.pnl, 0);
      const rs    = list
        .map((t) => (t.plannedRisk != null && t.plannedRisk > 0 ? t.pnl / t.plannedRisk : null))
        .filter((v): v is number => v !== null);
      return {
        symbol,
        trades: list.length,
        wins: wins.length,
        winRate: Math.round((wins.length / list.length) * 100),
        pnl: parseFloat(pnl.toFixed(2)),
        avgPnl: parseFloat((pnl / list.length).toFixed(2)),
        avgR: rs.length > 0 ? parseFloat((rs.reduce((s, v) => s + v, 0) / rs.length).toFixed(2)) : null,
        best: parseFloat(Math.max(...list.map((t) => t.pnl)).toFixed(2)),
        worst: parseFloat(Math.min(...list.map((t) => t.pnl)).toFixed(2)),
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

// ─── Process metrics (Tier A) ─────────────────────────────────────────
// These ask "how do I trade", not "what did I make": how long I hold, how
// quickly I re-enter, which side I favour, and what costs me.

// Exact hold time in minutes when MetaTrader recorded it, else derived from
// the time-of-day pair.
export function durationMinutes(trade: Trade): number | null {
  if (trade.durationMin != null && trade.durationMin > 0) return trade.durationMin;
  const h = tradeHours(trade);
  return h === null ? null : h * 60;
}

export interface ProcessBucket {
  bucket: string;
  trades: number;
  wins: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
}

const roll = (bucket: string, list: Trade[]): ProcessBucket => {
  const wins = list.filter((t) => t.status === "win");
  const pnl  = list.reduce((s, t) => s + t.pnl, 0);
  return {
    bucket,
    trades: list.length,
    wins: wins.length,
    winRate: list.length > 0 ? Math.round((wins.length / list.length) * 100) : 0,
    pnl: parseFloat(pnl.toFixed(2)),
    avgPnl: list.length > 0 ? parseFloat((pnl / list.length).toFixed(2)) : 0,
  };
};

const DURATION_BUCKETS: { label: string; test: (m: number) => boolean }[] = [
  { label: "Under 5m",  test: (m) => m < 5 },
  { label: "5 – 15m",   test: (m) => m >= 5 && m < 15 },
  { label: "15 – 45m",  test: (m) => m >= 15 && m < 45 },
  { label: "Over 45m",  test: (m) => m >= 45 },
];

// Holding time vs outcome. A scalper whose quick trades bleed but slower ones
// profit has the single most actionable finding in a journal.
export function byDuration(trades: Trade[]): ProcessBucket[] {
  const timed = trades.filter((t) => durationMinutes(t) !== null);
  return DURATION_BUCKETS.map((b) =>
    roll(b.label, timed.filter((t) => b.test(durationMinutes(t) as number)))
  );
}

export interface GapBucket {
  bucket: string;
  afterWin: ProcessBucket;
  afterLoss: ProcessBucket;
}

const GAP_BUCKETS: { label: string; test: (m: number) => boolean }[] = [
  { label: "Under 15m", test: (m) => m < 15 },
  { label: "15 – 60m",  test: (m) => m >= 15 && m < 60 },
  { label: "1 – 4h",    test: (m) => m >= 60 && m < 240 },
  { label: "Over 4h",   test: (m) => m >= 240 },
];

const at = (t: Trade, end: boolean): number | null => {
  const raw = end ? t.exitTime : t.entryTime;
  if (!raw) return null;
  const ms = new Date(`${normalizeDate(t.date)}T${raw}`).getTime();
  return isNaN(ms) ? null : ms;
};

// Time between the previous trade closing and this one opening, split by
// whether that previous trade won. Chasing a loss with a fast re-entry is a
// distinct habit from trading often, and it deserves its own number.
export function byReEntryGap(trades: Trade[]): GapBucket[] {
  const sorted = [...trades].sort((a, b) => {
    const ta = at(a, false), tb = at(b, false);
    if (ta === null || tb === null) return a.date.localeCompare(b.date);
    return ta - tb;
  });

  const rows: { minutes: number; prevWin: boolean; trade: Trade }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const open = at(sorted[i], false);
    const shut = at(prev, true);
    if (open === null || shut === null) continue;
    const minutes = (open - shut) / 60000;
    if (minutes < 0) continue;              // cross-day ordering fell apart
    rows.push({ minutes, prevWin: prev.status === "win", trade: sorted[i] });
  }

  return GAP_BUCKETS.map((b) => {
    const inBucket = rows.filter((r) => b.test(r.minutes));
    return {
      bucket: b.label,
      afterWin:  roll("after win",  inBucket.filter((r) => r.prevWin).map((r) => r.trade)),
      afterLoss: roll("after loss", inBucket.filter((r) => !r.prevWin).map((r) => r.trade)),
    };
  });
}

export function byDirection(trades: Trade[]): ProcessBucket[] {
  return [
    roll("Long",  trades.filter((t) => tradeSide(t) === "long")),
    roll("Short", trades.filter((t) => tradeSide(t) === "short")),
  ];
}

export interface CostProfile {
  grossProfit: number;
  costs: number;
  costPctOfGross: number;
  costPerTrade: number;
}

// Costs as a share of gross profit. Above roughly 10% this dominates the edge
// for a high-frequency book; below 1% it is noise and can be ignored.
export function costProfile(trades: Trade[]): CostProfile {
  const gross = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const costs = trades.reduce((s, t) => s + (t.commission || 0) + (t.fees || 0), 0);
  const perTrade = trades.length > 0 ? costs / trades.length : 0;
  return {
    grossProfit: parseFloat(gross.toFixed(2)),
    costs: parseFloat(costs.toFixed(2)),
    costPctOfGross: gross > 0 ? parseFloat(((costs / gross) * 100).toFixed(2)) : 0,
    costPerTrade: parseFloat(perTrade.toFixed(2)),
  };
}

// Net profit divided by the deepest drawdown. Above 3 is generally healthy;
// below 1 means the account did not earn back its worst decline.
export function recoveryFactor(totalPnl: number, maxDd: number): number {
  if (maxDd === 0) return 0;
  return parseFloat((totalPnl / Math.abs(maxDd)).toFixed(2));
}

export interface RevengeStats {
  count: number;      // trades opened after a same-day loss
  revengePnl: number; // net result of those trades
  otherPnl: number;   // net result of every other trade
}

// A trade taken after a loss on the same day is a distinct habit from trading
// often, so it gets its own P&L rather than just a count — the count alone
// cannot say whether the habit costs anything.
export function revengeSequences(trades: Trade[]): RevengeStats {
  const dayMap = new Map<string, Trade[]>();
  for (const t of trades) {
    const d = normalizeDate(t.date);
    const list = dayMap.get(d) ?? [];
    list.push(t);
    dayMap.set(d, list);
  }

  let count = 0, revengePnl = 0, otherPnl = 0;
  for (const day of dayMap.values()) {
    // Single-trade days still count as "every other trade". Skipping them used
    // to drop their P&L, which made the other-trade average in the behaviour
    // insights disagree with the book it was describing.
    const ordered = [...day].sort((a, b) => (a.entryTime || "").localeCompare(b.entryTime || ""));
    let hadLoss = false;
    for (const t of ordered) {
      if (hadLoss) { count += 1; revengePnl += t.pnl; }
      else { otherPnl += t.pnl; }
      hadLoss = t.status === "loss";
    }
  }

  return {
    count,
    revengePnl: parseFloat(revengePnl.toFixed(2)),
    otherPnl: parseFloat(otherPnl.toFixed(2)),
  };
}

export interface RRiskProfile {
  sigma: number;
  meanR: number;
  ruinApprox: number;
}

// Dispersion of outcomes, and the continuous-time ruin approximation
// q = 1 - exp(-2 * mean / sigma^2). Approximate, but it answers the question
// fixed sizing actually raises: not "what is my average" but "how likely am
// I to go broke before the average shows up".
export function rRiskProfile(rMs: { r: number }[]): RRiskProfile {
  const values = rMs.map((x) => x.r);
  if (values.length < 3) return { sigma: 0, meanR: 0, ruinApprox: 0 };
  const meanR = values.reduce((s, v) => s + v, 0) / values.length;
  const sigma = stdDev(values);
  let ruinApprox = 0;
  if (sigma > 0) {
    const q = 1 - Math.exp((-2 * meanR) / (sigma * sigma));
    ruinApprox = parseFloat(Math.min(1, Math.max(0, q)).toFixed(4));
  }
  return { sigma: parseFloat(sigma.toFixed(2)), meanR: parseFloat(meanR.toFixed(2)), ruinApprox };
}

export interface StopQuality {
  coverage: number;
  avgRatio: number;
  winnerRatio: number;
  loserRatio: number;
  losersTouchingStop: number;
  cleanWinners: number;
  losses: number;
  wins: number;
}

// How the stop loss is actually being used. Winners that barely go against
// signal clean entries; losers that reach the stop signal the risk was set
// and respected. The gap between those two is the health of the stop.
export function stopQuality(trades: Trade[]): StopQuality {
  const rated = trades.filter((t) => t.plannedRisk != null && t.plannedRisk > 0 && t.mae != null);
  const winners = rated.filter((t) => t.pnl > 0);
  const losers  = rated.filter((t) => t.pnl < 0);
  const ratio = (t: Trade) => (t.mae as number) / (t.plannedRisk as number);
  const mean = (list: Trade[]) =>
    list.length > 0 ? list.reduce((s, t) => s + ratio(t), 0) / list.length : 0;

  return {
    coverage: rated.length,
    avgRatio: parseFloat(mean(rated).toFixed(2)),
    winnerRatio: parseFloat(mean(winners).toFixed(2)),
    loserRatio: parseFloat(mean(losers).toFixed(2)),
    losersTouchingStop: losers.filter((t) => ratio(t) >= 0.9).length,
    cleanWinners: winners.filter((t) => ratio(t) < 0.5).length,
    losses: losers.length,
    wins: winners.length,
  };
}

// ─── Execution metrics (Tier B) ───────────────────────────────────────
// Facts MetaTrader can settle that a from-trades reconstruction cannot: why
// each position closed, whether software or a hand placed it, whether the
// size was built in one go, and what the account balance actually did.

const REASON_LABELS: Record<string, string> = {
  "stop-loss":   "Stopped out",
  "take-profit": "Target hit",
  "manual":      "Closed by hand",
  "expert":      "Closed by EA",
  "stop-out":    "Margin stop-out",
  "mobile":      "Closed on mobile",
  "web":         "Closed on web",
  "rollover":    "Rollover",
  "other":       "Other",
};

// Did the stop take the trade out, or did you close it yourself? The split
// between "Stopped out" and "Closed by hand" is the honest measure of how
// much of the exit is systematic versus discretionary.
export function byExitReason(trades: Trade[]): ProcessBucket[] {
  const rated = trades.filter((t) => t.exitReason);
  const keys = Array.from(new Set(rated.map((t) => t.exitReason as string)));
  return keys
    .map((k) => roll(REASON_LABELS[k] ?? k, rated.filter((t) => t.exitReason === k)))
    .sort((a, b) => b.trades - a.trades);
}

// Manual versus automated. Magic 0 is a hand-placed order; any other value is
// the id of the expert advisor that opened it.
export function byMagic(trades: Trade[]): ProcessBucket[] {
  const rated = trades.filter((t) => t.magic != null);
  const out: ProcessBucket[] = [];

  const manual = rated.filter((t) => !t.magic);
  if (manual.length > 0) out.push(roll("Manual", manual));

  const byEa = new Map<number, Trade[]>();
  for (const t of rated) {
    if (!t.magic) continue;
    const list = byEa.get(t.magic) ?? [];
    list.push(t);
    byEa.set(t.magic, list);
  }
  for (const [magic, list] of Array.from(byEa.entries()).sort((a, b) => b[1].length - a[1].length)) {
    out.push(roll(`EA #${magic}`, list));
  }
  return out;
}

export interface LegStats {
  coverage: number;
  avgLegs: number;
  singleLeg: ProcessBucket;
  multiLeg: ProcessBucket;
  averagedDown: ProcessBucket;
  multiLegPnl: number;      // net result of every position built from 2+ entries
  averagedDownPnl: number;  // net result of the averaging-down subset
}

// Position building. One entry is a plan executed; several entries are a plan
// changed mid-flight, and adding at a worse price than the first fill is the
// signature of averaging into a loser.
export function legStats(trades: Trade[]): LegStats {
  const rated = trades.filter((t) => t.legs != null && (t.legs as number) > 0);
  const single = rated.filter((t) => (t.legs as number) === 1);
  const multi  = rated.filter((t) => (t.legs as number) > 1);
  const down   = rated.filter((t) => t.averagedDown === true);
  return {
    coverage: rated.length,
    avgLegs: rated.length > 0
      ? parseFloat((rated.reduce((s, t) => s + (t.legs as number), 0) / rated.length).toFixed(2))
      : 0,
    singleLeg: roll("Single entry", single),
    multiLeg: roll("Multiple entries", multi),
    averagedDown: roll("Averaged down", down),
    multiLegPnl: roll("", multi).pnl,
    averagedDownPnl: roll("", down).pnl,
  };
}

export interface CashFlowPoint {
  date: string;
  flow: number;
  cumulative: number;
}

export interface CashFlowReport {
  coverage: number;
  netFlow: number;
  deposits: number;
  withdrawals: number;
  points: CashFlowPoint[];
}

// The account balance the exporter recorded after each trade, reconciled
// against that trade's own P&L. Between two consecutive closes the balance
// can only move by the second trade's P&L, so whatever is left over is cash
// the account paid in or took out — i.e. whether the trade curve and the
// account curve are the same thing, or whether deposits are flattering it.
export function externalCashFlow(trades: Trade[]): CashFlowReport {
  const withBal = trades
    .filter((t) => t.balanceAfter != null)
    .sort((a, b) => {
      const ka = `${normalizeDate(a.date)} ${a.exitTime ?? a.entryTime ?? ""}`;
      const kb = `${normalizeDate(b.date)} ${b.exitTime ?? b.entryTime ?? ""}`;
      return ka.localeCompare(kb);
    });

  const points: CashFlowPoint[] = [];
  let prev: number | null = null;
  let cumulative = 0;
  for (const t of withBal) {
    const bal = t.balanceAfter as number;
    if (prev !== null) {
      const flow = parseFloat((bal - prev - t.pnl).toFixed(2));
      if (Math.abs(flow) >= 0.01) {
        cumulative = parseFloat((cumulative + flow).toFixed(2));
        points.push({ date: normalizeDate(t.date), flow, cumulative });
      }
    }
    prev = bal;
  }

  const deposits    = points.filter((p) => p.flow > 0).reduce((s, p) => s + p.flow, 0);
  const withdrawals = points.filter((p) => p.flow < 0).reduce((s, p) => s + p.flow, 0);
  return {
    coverage: withBal.length,
    netFlow: parseFloat((deposits + withdrawals).toFixed(2)),
    deposits: parseFloat(deposits.toFixed(2)),
    withdrawals: parseFloat(withdrawals.toFixed(2)),
    points,
  };
}

// ─── Prop-firm challenge ──────────────────────────────────────────────
// A prop evaluation is a path-dependent problem: reaching +10% is worth
// nothing if an earlier 5% day or a 10% drawdown closes the account first.
// These helpers score a challenge the way a firm does — against its rules.

export interface ChallengeConfig {
  firm: string;
  // Which stage of the evaluation is being scored. Phase 2 is usually a smaller
  // target behind the same drawdown rules, so it cannot share one number.
  phase: "challenge" | "verification";
  // What the simulation samples: the account's own trades, or the assumed
  // metrics below. The replay-based figures only exist for real trades.
  source: "trades" | "custom";
  customWinRate: number;         // % of trades that win
  customAvgWin: number;          // average winning trade, account currency
  customAvgLoss: number;         // average losing trade, positive
  customTradesPerDay: number;    // trades taken per trading day
  accountSize: number;           // challenge account size, account currency
  targetPct: number;             // phase 1 (challenge) profit target, % of size
  verificationTargetPct: number; // phase 2 target, % of size — usually smaller
  maxDdPct: number;              // max total drawdown, % of size
  ddMode: "static" | "trailing"; // static = from size, trailing = from peak
  dailyLimitPct: number;         // max daily loss, % of size (0 = no rule)
  minDays: number;               // minimum trading days (0 = none)
  maxDays: number | null;        // time limit in days (null = none)
  consistencyPct: number | null; // cap on biggest day's share of profit (null = no rule)
  fee: number;                   // one-off challenge fee
  splitPct: number;              // profit split once funded, %
  monthsFunded: number;          // expected months the funded account runs
  expectedMonthlyPct: number;    // expected monthly return once funded, %
}

export const DEFAULT_CHALLENGE: ChallengeConfig = {
  firm: "FTMO (2-Step)",
  phase: "challenge",
  source: "trades",
  customWinRate: 45,
  customAvgWin: 200,
  customAvgLoss: 120,
  customTradesPerDay: 3,
  accountSize: 100000,
  targetPct: 10,
  verificationTargetPct: 5,
  maxDdPct: 10,
  ddMode: "static",
  dailyLimitPct: 5,
  minDays: 4,
  maxDays: null,
  consistencyPct: null,
  fee: 540,
  splitPct: 80,
  monthsFunded: 3,
  expectedMonthlyPct: 3,
};

// Starting points only. Firms change their rule sets, so edit every field
// to match the exact account you are trading before trusting the numbers.
export const FIRM_PRESETS: { name: string; config: Partial<ChallengeConfig> }[] = [
  { name: "FTMO (2-Step)",   config: { targetPct: 10, maxDdPct: 10, ddMode: "static",   dailyLimitPct: 5, minDays: 4, maxDays: null, consistencyPct: null } },
  { name: "FTMO Swing",      config: { targetPct: 10, maxDdPct: 10, ddMode: "static",   dailyLimitPct: 5, minDays: 4, maxDays: null, consistencyPct: null } },
  { name: "Apex (Eval)",     config: { targetPct: 6,  maxDdPct: 5,  ddMode: "trailing", dailyLimitPct: 0, minDays: 7, maxDays: null, consistencyPct: 30 } },
  { name: "Topstep",         config: { targetPct: 6,  maxDdPct: 4,  ddMode: "trailing", dailyLimitPct: 2, minDays: 2, maxDays: null, consistencyPct: null } },
  { name: "MyFundedFutures", config: { targetPct: 6,  maxDdPct: 6,  ddMode: "trailing", dailyLimitPct: 0, minDays: 5, maxDays: null, consistencyPct: null } },
  { name: "The5ers",         config: { targetPct: 6,  maxDdPct: 5,  ddMode: "static",   dailyLimitPct: 0, minDays: 3, maxDays: null, consistencyPct: null } },
  { name: "Funding Pips",    config: { targetPct: 8,  maxDdPct: 10, ddMode: "static",   dailyLimitPct: 5, minDays: 3, maxDays: null, consistencyPct: null } },
  { name: "Custom",          config: {} },
];

// Expected dollars per trade under the assumed metrics. Positive is the only
// thing that can carry an evaluation, however high the pass rate looks.
export function customExpectancy(config: ChallengeConfig): number {
  const p = Math.min(100, Math.max(0, config.customWinRate)) / 100;
  return ROUND2(p * config.customAvgWin - (1 - p) * config.customAvgLoss);
}

// Every rule check reads the active phase through here rather than `targetPct`,
// so switching phase re-scores the same trades against the right target.
export function targetPctFor(config: ChallengeConfig): number {
  return config.phase === "verification" ? config.verificationTargetPct : config.targetPct;
}

export function applyPreset(base: ChallengeConfig, name: string): ChallengeConfig {
  const preset = FIRM_PRESETS.find((p) => p.name === name);
  if (!preset) return { ...base, firm: name };
  return { ...base, ...preset.config, firm: name };
}

export interface ChallengeDay {
  date: string;
  pnl: number;
  trades: number;
}

export interface ChallengeStatus {
  size: number;
  balance: number;
  totalPnl: number;

  targetAmount: number;
  profitAmount: number;
  profitProgress: number;      // % of target reached
  targetHit: boolean;

  ddReference: number;         // size (static) or peak (trailing)
  ddUsed: number;              // amount
  ddAllowed: number;
  ddUsedPct: number;           // of allowed

  worstDayPnl: number;         // most negative day, 0 when none
  worstDayDate: string;
  dailyAllowed: number;
  dailyUsedPct: number;

  tradingDays: number;
  minDaysMet: boolean;

  biggestDayProfit: number;
  consistencyShare: number;    // biggest day / total profit, %
  consistencyAllowed: number | null;
  consistencyOk: boolean;

  days: ChallengeDay[];
  replayedBreach: boolean;
  replayedReason: string | null;
  replayedPass: boolean;
}

const ROUND2 = (v: number) => parseFloat(v.toFixed(2));

// Scores the trades already in the account against the rule set: where the
// challenge stands right now, and whether the same path would have passed or
// been breached. Uses MetaTrader's entry times to order trades within a day.
export function challengeStatus(trades: Trade[], config: ChallengeConfig): ChallengeStatus {
  const size  = Math.max(config.accountSize, 0);
  const targetAmount = (size * targetPctFor(config)) / 100;
  const ddAllowed    = (size * config.maxDdPct) / 100;
  const dailyAllowed = (size * config.dailyLimitPct) / 100;

  const ordered = [...trades].sort((a, b) =>
    `${normalizeDate(a.date)} ${a.entryTime ?? ""}`.localeCompare(`${normalizeDate(b.date)} ${b.entryTime ?? ""}`)
  );

  const dayMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    const d = normalizeDate(t.date);
    const row = dayMap.get(d) ?? { pnl: 0, trades: 0 };
    row.pnl += t.pnl;
    row.trades += 1;
    dayMap.set(d, row);
  }
  const days: ChallengeDay[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, r]) => ({ date, pnl: ROUND2(r.pnl), trades: r.trades }));

  const totalPnl = ROUND2(ordered.reduce((s, t) => s + t.pnl, 0));
  const balance  = ROUND2(size + totalPnl);
  const profitAmount  = ROUND2(Math.max(0, balance - size));
  const profitProgress = targetAmount > 0 ? (totalPnl / targetAmount) * 100 : 0;

  // Running peak over the full path, then the current drawdown against it.
  let peak = size;
  let run  = size;
  for (const t of ordered) { run += t.pnl; if (run > peak) peak = run; }
  const ddReference = config.ddMode === "trailing" ? peak : size;
  const ddUsed = ROUND2(Math.max(0, ddReference - balance));
  const ddUsedPct = ddAllowed > 0 ? (ddUsed / ddAllowed) * 100 : 0;

  // Replay to see whether this exact path would have ended the challenge.
  let replayBal = size, replayPeak = size, dayStart = size, curDay = "";
  let replayedBreach = false, replayedPass = false, replayedReason: string | null = null;
  for (const t of ordered) {
    const d = normalizeDate(t.date);
    if (d !== curDay) { curDay = d; dayStart = replayBal; }
    replayBal += t.pnl;
    if (replayBal > replayPeak) replayPeak = replayBal;
    const ref = config.ddMode === "trailing" ? replayPeak : size;
    if (ddAllowed > 0 && ref - replayBal >= ddAllowed) {
      replayedBreach = true;
      replayedReason = `Total drawdown of ${config.maxDdPct}% would have been hit`;
      break;
    }
    if (dailyAllowed > 0 && dayStart - replayBal >= dailyAllowed) {
      replayedBreach = true;
      replayedReason = `Daily loss limit of ${config.dailyLimitPct}% would have been hit on ${d}`;
      break;
    }
    if (targetAmount > 0 && replayBal - size >= targetAmount) { replayedPass = true; break; }
  }

  const worstDay = days.reduce(
    (w, d) => (d.pnl < w.pnl ? d : w),
    { date: "", pnl: 0, trades: 0 } as ChallengeDay
  );
  const worstDayPnl  = worstDay.pnl;
  const worstDayDate = worstDay.date;
  const dailyUsedPct = dailyAllowed > 0 ? (Math.abs(Math.min(0, worstDayPnl)) / dailyAllowed) * 100 : 0;

  const tradingDays = days.length;
  const minDaysMet  = tradingDays >= config.minDays;

  const biggestDayProfit = days.reduce((m, d) => Math.max(m, d.pnl), 0);
  const consistencyShare = totalPnl > 0 ? (biggestDayProfit / totalPnl) * 100 : 0;
  const consistencyAllowed = config.consistencyPct;
  const consistencyOk = consistencyAllowed == null || consistencyShare <= consistencyAllowed;

  return {
    size, balance, totalPnl,
    targetAmount: ROUND2(targetAmount), profitAmount, profitProgress, targetHit: profitAmount >= targetAmount && targetAmount > 0,
    ddReference: ROUND2(ddReference), ddUsed, ddAllowed: ROUND2(ddAllowed), ddUsedPct,
    worstDayPnl: ROUND2(worstDayPnl), worstDayDate, dailyAllowed: ROUND2(dailyAllowed), dailyUsedPct,
    tradingDays, minDaysMet,
    biggestDayProfit: ROUND2(biggestDayProfit), consistencyShare, consistencyAllowed, consistencyOk,
    days, replayedBreach, replayedReason, replayedPass,
  };
}

export type ChallengeOutcome = "pass" | "daily" | "dd" | "timeout" | "consistency";

export interface ChallengeSimPath {
  outcome: ChallengeOutcome;
  series: number[]; // balance at the end of each day; index 0 = starting size
}

export interface ChallengeSimBandPoint {
  day: number;
  p5: number;
  p50: number;
  p95: number;
  bandBase: number;  // p5, the invisible base of a stacked range area
  bandWidth: number; // p95 - p5, the visible band
}

export interface ChallengeSim {
  runs: number;
  passRate: number;       // clean passes (consistency rule respected)
  passRateRaw: number;    // passes ignoring the consistency rule
  failDaily: number;
  failDrawdown: number;
  timeout: number;
  consistencyFail: number; // reached target but broke the consistency rule
  medianDaysToPass: number | null;
  sampleDays: number;
  sampleTrades: number;
  tooFew: boolean;

  paths: ChallengeSimPath[];                  // a sample of attempts for the spaghetti overlay
  band: ChallengeSimBandPoint[];              // percentile envelope across all attempts
  daysToPass: { label: string; count: number }[];
  horizonDays: number;                        // last day any attempt was still alive
  scaled: boolean;                            // whether P&L was rescaled to the challenge size
  scale: number;
}

const SIM_DAY_BUCKETS: { label: string; test: (d: number) => boolean }[] = [
  { label: "1–3",   test: (d) => d <= 3 },
  { label: "4–7",   test: (d) => d >= 4 && d <= 7 },
  { label: "8–14",  test: (d) => d >= 8 && d <= 14 },
  { label: "15–30", test: (d) => d >= 15 && d <= 30 },
  { label: "31+",   test: (d) => d > 30 },
];

// Bootstrap Monte Carlo: resample the trader's own trades, day by day, and
// walk the balance through the firm's rules. This is the only honest way to
// answer "pass rate" — a closed-form win-rate x R:R figure ignores the daily
// and drawdown rules that actually end most evaluations.
//
// `accountBalance` rescales the account's own dollar P&L onto the challenge
// account size, so a $10k book can be evaluated against a $100k challenge.
// Paths are kept and returned as percentile bands plus a sample, which is what
// the Prop Firm tab draws as a fan.
// The simulation only reads a trade's P&L and date, so a modelled sample can
// be passed here without dressing it up as a journal row.
export interface SimTrade {
  pnl: number;
  date: string;
}

export function simulateChallenge(
  trades: readonly SimTrade[],
  config: ChallengeConfig,
  runs = 2000,
  accountBalance = 0,
): ChallengeSim {
  const size = Math.max(config.accountSize, 0);
  const targetAmount = (size * targetPctFor(config)) / 100;
  const ddAllowed    = (size * config.maxDdPct) / 100;
  const dailyAllowed = (size * config.dailyLimitPct) / 100;

  // Size ratio, not raw dollars: the challenge account is separate money.
  const scale = accountBalance > 0 ? size / accountBalance : 1;
  const pool = trades
    .map((t) => t.pnl * scale)
    .filter((v) => Number.isFinite(v));
  const perDay = new Map<string, number>();
  for (const t of trades) perDay.set(normalizeDate(t.date), (perDay.get(normalizeDate(t.date)) ?? 0) + 1);
  const daySizes = Array.from(perDay.values());
  const avgPerDay = daySizes.length > 0 ? Math.max(1, Math.round(daySizes.reduce((s, v) => s + v, 0) / daySizes.length)) : 1;

  const sampleDays = perDay.size;
  const sampleTrades = pool.length;
  const tooFew = sampleTrades < 30;

  const empty: ChallengeSim = {
    runs: 0, passRate: 0, passRateRaw: 0, failDaily: 0, failDrawdown: 0,
    timeout: 0, consistencyFail: 0, medianDaysToPass: null, sampleDays, sampleTrades, tooFew: true,
    paths: [], band: [], daysToPass: SIM_DAY_BUCKETS.map((b) => ({ label: b.label, count: 0 })),
    horizonDays: 0, scaled: scale !== 1, scale,
  };
  if (sampleTrades === 0 || size <= 0 || targetAmount <= 0) return empty;

  // Horizon: the firm's time limit, else a trading year.
  const hardDays = config.maxDays && config.maxDays > 0 ? config.maxDays : 252;

  let pass = 0, failDaily = 0, failDd = 0, timeout = 0, consFail = 0;
  const passDays: number[] = [];
  const dayBucketCounts = SIM_DAY_BUCKETS.map(() => 0);
  const allSeries: number[][] = [];
  const sampleEvery = Math.max(1, Math.ceil(runs / 60));
  const paths: ChallengeSimPath[] = [];

  for (let r = 0; r < runs; r++) {
    let bal = size, peak = size, biggestDay = 0;
    let outcome: ChallengeOutcome | null = null;
    let daysRun = 0;
    const series: number[] = [size];

    while (outcome === null) {
      daysRun++;
      if (daysRun > hardDays) { outcome = "timeout"; break; }

      const n = daySizes.length > 1
        ? Math.max(1, daySizes[Math.floor(Math.random() * daySizes.length)])
        : avgPerDay;
      const dayStart = bal;
      let dayPnl = 0;

      for (let k = 0; k < n; k++) {
        const pnl = pool[Math.floor(Math.random() * pool.length)];
        dayPnl += pnl;
        bal += pnl;
        if (bal > peak) peak = bal;
        const ref = config.ddMode === "trailing" ? peak : size;
        if (ddAllowed > 0 && ref - bal >= ddAllowed) { outcome = "dd"; break; }
        if (dailyAllowed > 0 && dayStart - bal >= dailyAllowed) { outcome = "daily"; break; }
        if (targetAmount > 0 && bal - size >= targetAmount) {
          // Minimum trading days gate the pass: a target hit on day 2 of a
          // 4-day rule does not fund the account yet. Either way there is no
          // reason to keep trading today once the target is reached.
          if (daysRun >= config.minDays) {
            const profit = bal - size;
            const biggest = Math.max(biggestDay, dayPnl);
            outcome = config.consistencyPct != null
              && biggest > (config.consistencyPct / 100) * profit
              ? "consistency"
              : "pass";
          }
          break;
        }
      }
      if (dayPnl > biggestDay) biggestDay = dayPnl;
      series.push(bal);
    }

    allSeries.push(series);
    if (r % sampleEvery === 0 && paths.length < 60) {
      paths.push({ outcome: outcome as ChallengeOutcome, series });
    }

    if (outcome === "pass") {
      pass++;
      passDays.push(daysRun);
      const bi = SIM_DAY_BUCKETS.findIndex((b) => b.test(daysRun));
      if (bi >= 0) dayBucketCounts[bi]++;
    } else if (outcome === "consistency") consFail++;
    else if (outcome === "daily") failDaily++;
    else if (outcome === "dd") failDd++;
    else timeout++;
  }

  passDays.sort((a, b) => a - b);
  const medianDaysToPass = passDays.length > 0
    ? passDays[Math.floor(passDays.length / 2)]
    : null;

  // Percentile envelope across every attempt. Terminated paths carry their
  // final balance forward, so the band shows the whole distribution (failures
  // flatline low, passes flatline high) rather than only the survivors.
  const horizonDays = allSeries.reduce((m, s) => Math.max(m, s.length - 1), 0);
  const pick = (sorted: number[], p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  const band: ChallengeSimBandPoint[] = [];
  for (let d = 0; d <= horizonDays; d++) {
    const vals = allSeries.map((s) => s[Math.min(d, s.length - 1)]).sort((a, b) => a - b);
    const p5 = pick(vals, 0.05);
    const p50 = pick(vals, 0.5);
    const p95 = pick(vals, 0.95);
    band.push({
      day: d,
      p5: ROUND2(p5), p50: ROUND2(p50), p95: ROUND2(p95),
      bandBase: ROUND2(p5), bandWidth: ROUND2(p95 - p5),
    });
  }

  return {
    runs,
    passRate: pass / runs,
    passRateRaw: (pass + consFail) / runs,
    failDaily: failDaily / runs,
    failDrawdown: failDd / runs,
    timeout: timeout / runs,
    consistencyFail: consFail / runs,
    medianDaysToPass,
    sampleDays,
    sampleTrades,
    tooFew,
    paths,
    band,
    daysToPass: SIM_DAY_BUCKETS.map((b, i) => ({ label: b.label, count: dayBucketCounts[i] })),
    horizonDays,
    scaled: scale !== 1,
    scale,
  };
}

// A modelled stand-in for the journal: constant-size wins and losses drawn at
// the assumed win rate, spread over days at the assumed pace. Seeded so the
// same assumptions always yield the same pool — otherwise the pass rate would
// jitter on every render.
export function syntheticTrades(config: ChallengeConfig, minPool = 120): SimTrade[] {
  const perDay = Math.max(1, Math.round(config.customTradesPerDay));
  const winRate = Math.min(100, Math.max(0, config.customWinRate)) / 100;
  const win = Math.max(0, config.customAvgWin);
  const loss = Math.max(0, config.customAvgLoss);
  // Nothing to sample: the caller shows "set your assumptions" instead of a
  // fake 100% timeout rate.
  if (win <= 0 && loss <= 0) return [];

  const days = Math.max(30, Math.ceil(minPool / perDay));
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const out: SimTrade[] = [];
  const base = Date.UTC(2026, 0, 5);
  for (let d = 0; d < days; d++) {
    const date = new Date(base + d * 86400000).toISOString().slice(0, 10);
    for (let k = 0; k < perDay; k++) {
      out.push({ pnl: ROUND2(rand() < winRate ? win : -loss), date });
    }
  }
  return out;
}

export interface ChallengePlan {
  dailyAllowed: number;
  ddAllowed: number;
  maxRiskPerTrade: number;
  maxRiskPerTradePct: number;
  avgPnl: number;
  tradesToTarget: number | null;
  remainingDays: number | null;
  requiredDailyReturn: number | null;
}

// Practical sizing: how much can one trade risk without a normal losing run
// ending the day or the account, and what pace the target needs.
export function challengePlan(trades: Trade[], config: ChallengeConfig): ChallengePlan {
  const size = Math.max(config.accountSize, 0);
  const dailyAllowed = (size * config.dailyLimitPct) / 100;
  const ddAllowed    = (size * config.maxDdPct) / 100;
  const status = challengeStatus(trades, config);

  // Daily rule binds on a bad day, so budget ~3 losers before it is hit.
  // With no daily rule, budget ~6 losers inside the total drawdown.
  const maxRiskPerTrade = dailyAllowed > 0 ? dailyAllowed / 3 : ddAllowed / 6;
  const avgPnl = trades.length > 0 ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0;

  const remainingToTarget = Math.max(0, (size * targetPctFor(config)) / 100 - status.totalPnl);
  const remainingDays = config.maxDays && config.maxDays > 0
    ? Math.max(0, config.maxDays - status.tradingDays)
    : null;

  return {
    dailyAllowed: ROUND2(dailyAllowed),
    ddAllowed: ROUND2(ddAllowed),
    maxRiskPerTrade: ROUND2(maxRiskPerTrade),
    maxRiskPerTradePct: size > 0 ? (maxRiskPerTrade / size) * 100 : 0,
    avgPnl: ROUND2(avgPnl),
    tradesToTarget: avgPnl > 0 ? Math.ceil(remainingToTarget / avgPnl) : null,
    remainingDays,
    requiredDailyReturn: remainingDays && remainingDays > 0 ? ROUND2(remainingToTarget / remainingDays) : null,
  };
}

export interface ChallengeROI {
  fee: number;
  passRate: number;
  grossMonthlyProfit: number;   // account profit per funded month
  traderMonthlyPayout: number;  // trader's split of it
  expectedPayout: number;       // probability-weighted, over monthsFunded
  netExpected: number;          // expectedPayout - one attempt's fee
  roiPct: number;
  attemptsToPass: number | null;
  costToPass: number;
}

// Expected value of one attempt, and the true cost of passing including
// retries. Positive ROI needs the probability-weighted payout to clear the fee.
export function challengeROI(config: ChallengeConfig, passRate: number): ChallengeROI {
  const size = Math.max(config.accountSize, 0);
  const grossMonthlyProfit  = (size * config.expectedMonthlyPct) / 100;
  const traderMonthlyPayout = (grossMonthlyProfit * config.splitPct) / 100;
  const expectedPayout = passRate * config.monthsFunded * traderMonthlyPayout;
  const netExpected = expectedPayout - config.fee;
  const attemptsToPass = passRate > 0 ? 1 / passRate : null;

  return {
    fee: ROUND2(config.fee),
    passRate,
    grossMonthlyProfit: ROUND2(grossMonthlyProfit),
    traderMonthlyPayout: ROUND2(traderMonthlyPayout),
    expectedPayout: ROUND2(expectedPayout),
    netExpected: ROUND2(netExpected),
    roiPct: config.fee > 0 ? ROUND2((netExpected / config.fee) * 100) : 0,
    attemptsToPass: attemptsToPass != null ? ROUND2(attemptsToPass) : null,
    costToPass: attemptsToPass != null ? ROUND2(config.fee * attemptsToPass) : 0,
  };
}

// ─── Prop-firm payout ledger ──────────────────────────────────────────
// The config above is a plan the trader can edit freely; these helpers total
// cash that actually moved. Fees are stored negative so one sum is the net,
// and recovery is measured against fees rather than trades — a challenge is
// paid for once and can then pay back many times.

export type PayoutKind = "fee" | "payout";

export interface PropLedgerEntry {
  id: string;
  kind: PayoutKind;
  date: string;              // YYYY-MM-DD, same convention as Trade.date
  amount: number;            // signed: negative = paid out, positive = received
  firm?: string | null;      // prop firm the entry belongs to, fixed at save time
  label?: string | null;
  note?: string | null;
}

export interface PayoutSummary {
  entries: number;
  feeCount: number;
  payoutCount: number;
  feesPaid: number;              // absolute, >= 0
  payoutsReceived: number;       // absolute, >= 0
  net: number;                   // payouts - fees
  recoveredPct: number | null;   // payouts / fees, null when nothing was spent
  avgPayout: number | null;
  breakEvenPayouts: number | null;
  firstDate: string | null;
  lastDate: string | null;
}

export interface PayoutCurvePoint {
  date: string;
  fees: number;
  payouts: number;
  net: number;
}

export function payoutSummary(entries: PropLedgerEntry[]): PayoutSummary {
  let feesPaid = 0;
  let payoutsReceived = 0;
  let feeCount = 0;
  let payoutCount = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const e of entries) {
    // `kind` decides the side, not the sign. A fee entered as a positive still
    // costs money, and a payout can never be allowed to read as a cost.
    const amount = Math.abs(e.amount);
    if (e.kind === "fee") { feesPaid += amount; feeCount++; }
    else { payoutsReceived += amount; payoutCount++; }

    if (firstDate === null || e.date < firstDate) firstDate = e.date;
    if (lastDate === null || e.date > lastDate) lastDate = e.date;
  }

  const avgPayout = payoutCount > 0 ? ROUND2(payoutsReceived / payoutCount) : null;
  const shortfall = ROUND2(feesPaid - payoutsReceived);

  return {
    entries: entries.length,
    feeCount,
    payoutCount,
    feesPaid: ROUND2(feesPaid),
    payoutsReceived: ROUND2(payoutsReceived),
    net: ROUND2(payoutsReceived - feesPaid),
    // null rather than 0: "nothing spent yet" and "nothing recovered" are
    // different answers and the UI has to be able to say so.
    recoveredPct: feesPaid > 0 ? ROUND2((payoutsReceived / feesPaid) * 100) : null,
    avgPayout,
    breakEvenPayouts: shortfall > 0 && avgPayout !== null && avgPayout > 0
      ? Math.ceil(shortfall / avgPayout)
      : null,
    firstDate,
    lastDate,
  };
}

// One point per entry in date order. Two cumulative lines and the net come from
// the same series, so the chart never has to keep its own running totals.
export function payoutCurve(entries: PropLedgerEntry[]): PayoutCurvePoint[] {
  const ordered = [...entries].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
  );
  let fees = 0;
  let payouts = 0;
  return ordered.map((e) => {
    if (e.kind === "fee") fees += Math.abs(e.amount);
    else payouts += Math.abs(e.amount);
    return {
      date: e.date,
      fees: ROUND2(fees),
      payouts: ROUND2(payouts),
      net: ROUND2(payouts - fees),
    };
  });
}

// The model's expected cost of getting funded and the cash the ledger records
// answer different questions, and the gap is the useful part: paying more than
// the model predicted means the pass rate is optimistic or the retries arrived
// in a bunch.
export interface CostComparison {
  estimated: number;  // challengeROI.costToPass: fee × attempts to pass
  actual: number;     // fees recorded in the ledger
  difference: number; // actual − estimated; negative means under the model
}

export function costComparison(
  estimated: number | null,
  summary: PayoutSummary,
): CostComparison | null {
  // Without a pass rate there is no attempts-to-pass figure to model from, so
  // there is nothing honest to compare the ledger against — null, not a
  // fabricated ratio.
  if (estimated == null || !(estimated > 0)) return null;
  const actual = summary.feesPaid;
  return {
    estimated: ROUND2(estimated),
    actual: ROUND2(actual),
    difference: ROUND2(actual - estimated),
  };
}

export interface ReportStats {  trades: Trade[];
  sorted: Trade[];
  wins: Trade[];
  losses: Trade[];
  totalPnl: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  tradingDays: number;

  returnPct: number | null;
  totalHours: number;
  hourlyRate: number | null;
  durationCoverage: number;

  avgRR: number | null;
  rrCoverage: number;

  rMs: { r: number; win: boolean }[];
  rBuckets: { bucket: string; count: number; positive: boolean }[];
  avgR: number;
  rUnit: number;
  rUnitSource: "planned" | "avgLoss";
  expectancyDollars: number;
  expectancyR: number | null;

  sharpe: number;
  sortino: number;
  calmar: number;
  maxDd: number;
  maxDdPct: number;
  longestDdDays: number;
  currentDdDays: number;

  riskCoverage: number;
  avgRisk: number;
  minRisk: number;
  maxRisk: number;
  riskConsistency: number;
  riskPctAvg: number;
  stopBreaches: number;

  execCoverage: number;
  avgMae: number;
  avgMfe: number;
  entryEff: number;
  exitEff: number;

  avgPostCloseMfe: number;
  avgLeftOnTable: number;
  captureRate: number;

  hourData: HourBucket[];
  dowData: { day: string; pnl: number; count: number; wr: number }[];
  instruments: InstrumentRow[];

  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number;
  currentType: "win" | "loss" | null;
}

// Everything the PDF report renders, computed once. `initialBalance` is the
// account's starting balance and drives return %, risk % and drawdown.
export function buildReportStats(
  trades: Trade[],
  initialBalance: number,
  weekStart: "sunday" | "monday" = "monday",
): ReportStats {
  const sorted = [...trades].sort((a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date)));
  const wins   = trades.filter((t) => t.status === "win");
  const losses = trades.filter((t) => t.status === "loss");
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate  = trades.length > 0 ? Math.round((wins.length / trades.length) * 100) : 0;
  const avgWin   = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss  = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;

  const returnPct = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : null;

  let totalHours = 0;
  let timedCount = 0;
  let timedPnl = 0;
  for (const t of trades) {
    const h = tradeHours(t);
    if (h !== null) { totalHours += h; timedCount++; timedPnl += t.pnl; }
  }
  // Divide by the P&L of the same trades that have hold times. Using total P&L
  // here credited untimed trades' profit to the hours of the timed ones.
  const hourlyRate = totalHours > 0 ? timedPnl / totalHours : null;

  const rrVals = trades.map((t) => parseRR(t.rr)).filter((v): v is number => v !== null);
  const avgRR = rrVals.length > 0 ? rrVals.reduce((s, v) => s + v, 0) / rrVals.length : null;

  const daily = getDailyPnl(trades);
  const dailyVals = daily.map((d) => d.pnl);
  const tradingDays = daily.length;

  const { maxDd, maxDdPct, longestDdDays, currentDdDays } = drawdownStats(sorted, initialBalance);

  const risked = trades.filter((t) => t.plannedRisk != null && t.plannedRisk > 0);
  const riskVals = risked.map((t) => t.plannedRisk as number);
  const avgRisk = riskVals.length > 0 ? riskVals.reduce((s, v) => s + v, 0) / riskVals.length : 0;
  const minRisk = riskVals.length > 0 ? Math.min(...riskVals) : 0;
  const maxRisk = riskVals.length > 0 ? Math.max(...riskVals) : 0;
  const riskSd = riskVals.length > 1 ? stdDev(riskVals) : 0;
  let stopBreaches = 0;
  for (const t of risked) {
    if (t.pnl < 0 && -t.pnl > (t.plannedRisk as number) * 1.05) stopBreaches++;
  }

  const rMs = rMultiples(trades, avgLoss);
  const avgR = rMs.length > 0 ? rMs.reduce((s, r) => s + r.r, 0) / rMs.length : 0;
  const rUnit = avgRisk > 0 && risked.length === trades.length ? avgRisk : avgLoss;
  const expDollars = expectancy(wins, losses);

  const execTrades = trades.filter((t) => t.mae != null && t.mfe != null);
  const avgMae = execTrades.length > 0 ? execTrades.reduce((s, t) => s + t.mae!, 0) / execTrades.length : 0;
  const avgMfe = execTrades.length > 0 ? execTrades.reduce((s, t) => s + t.mfe!, 0) / execTrades.length : 0;
  const entryEff = execTrades.length > 0
    ? execTrades.reduce((s, t) => {
        const total = t.mfe! + t.mae!;
        return s + (total > 0 ? (t.mfe! / total) * 100 : 50);
      }, 0) / execTrades.length
    : 0;
  const winsWithMfe = execTrades.filter((t) => t.status === "win" && t.mfe! > 0);
  const exitEff = winsWithMfe.length > 0
    ? winsWithMfe.reduce((s, t) => s + Math.min(100, (t.pnl / t.mfe!) * 100), 0) / winsWithMfe.length
    : 0;

  // Post-close run: how far price kept moving in favour after the position was
  // closed. LeftOnTable is the extra available after the hold beyond MFE;
  // CaptureRate is how much of the best possible move (during or after hold)
  // the trader actually banked on winning trades.
  const pcTrades = trades.filter((t) => t.postCloseMfe != null);
  const avgPostCloseMfe = pcTrades.length > 0
    ? pcTrades.reduce((s, t) => s + (t.postCloseMfe as number), 0) / pcTrades.length
    : 0;
  const leftOnTableVals = pcTrades
    .filter((t) => t.mfe != null)
    .map((t) => Math.max(0, (t.postCloseMfe as number) - (t.mfe as number)));
  const avgLeftOnTable = leftOnTableVals.length > 0
    ? leftOnTableVals.reduce((s, v) => s + v, 0) / leftOnTableVals.length
    : 0;
  const captureVals = pcTrades
    .filter((t) => t.status === "win" && t.mfe != null && t.postCloseMfe != null)
    .map((t) => {
      const best = Math.max(t.mfe as number, t.postCloseMfe as number);
      return best > 0 ? Math.min(100, (t.pnl / best) * 100) : 0;
    });
  const captureRate = captureVals.length > 0
    ? captureVals.reduce((s, v) => s + v, 0) / captureVals.length
    : 0;

  const s = streaks(trades);

  return {
    trades, sorted, wins, losses,
    totalPnl, winRate, avgWin, avgLoss,
    profitFactor: profitFactor(wins, losses),
    tradingDays,

    returnPct, totalHours, hourlyRate,
    durationCoverage: timedCount,

    avgRR, rrCoverage: rrVals.length,

    rMs, rBuckets: rHistogram(rMs), avgR,
    rUnit, rUnitSource: avgRisk > 0 && risked.length === trades.length ? "planned" : "avgLoss",
    expectancyDollars: expDollars,
    expectancyR: rUnit > 0 ? parseFloat((expDollars / rUnit).toFixed(2)) : null,

    sharpe: sharpeRatio(dailyVals),
    sortino: sortinoRatio(dailyVals),
    calmar: calmarRatio(totalPnl, initialBalance, tradingDays, maxDdPct),
    maxDd, maxDdPct, longestDdDays, currentDdDays,

    riskCoverage: risked.length,
    avgRisk, minRisk, maxRisk,
    riskConsistency: avgRisk > 0 ? Math.max(0, 100 - (riskSd / avgRisk) * 100) : 0,
    riskPctAvg: initialBalance > 0 && avgRisk > 0 ? (avgRisk / initialBalance) * 100 : 0,
    stopBreaches,

    execCoverage: execTrades.length,
    avgMae, avgMfe, entryEff, exitEff,
    avgPostCloseMfe, avgLeftOnTable, captureRate,

    hourData: byHourOfDay(trades),
    dowData: byDayOfWeek(trades, weekStart),
    instruments: byInstrument(trades),

    maxWinStreak: s.maxWinStreak,
    maxLossStreak: s.maxLossStreak,
    currentStreak: s.currentStreak,
    currentType: s.currentType,
  };
}

// ─── Research: uncertainty, cohorts, adherence ────────────────────────
// A number without an interval invites strategy changes the sample cannot
// support. Everything below exists so a screen can print "not distinguishable"
// instead of ranking noise, and so a rule change can be judged against the
// trades taken before and after it.

export interface Interval {
  point: number;
  low: number;
  high: number;
}

// Wilson score interval for a proportion. The normal approximation collapses
// at the sample sizes a personal journal actually reaches.
export function wilsonInterval(successes: number, n: number, z = 1.96): Interval | null {
  if (n <= 0) return null;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    point: p * 100,
    low: Math.max(0, (centre - margin) * 100),
    high: Math.min(100, (centre + margin) * 100),
  };
}

// Deterministic PRNG: the bootstrap has to return the same interval on every
// render, or the verdict column flickers between "real" and "noise".
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function bootstrapMeanCI(values: number[], iterations = 2000, seed = 20261103): Interval | null {
  if (values.length < 2) return null;
  const rand = lcg(seed);
  const means: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++) sum += values[Math.floor(rand() * values.length)];
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  const quantile = (q: number) => means[Math.min(means.length - 1, Math.max(0, Math.floor(q * means.length)))];
  const point = values.reduce((s, v) => s + v, 0) / values.length;
  return { point, low: quantile(0.025), high: quantile(0.975) };
}

// The 1R unit for a set of trades: planned risk where the exporter recorded a
// stop, average loss otherwise. Two cohorts must share one unit before their
// expectancies can be compared at all.
export function riskUnit(trades: Trade[]): number {
  const losses = trades.filter((t) => t.pnl < 0);
  return losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
}

export function rSeries(trades: Trade[], unit = riskUnit(trades)): number[] {
  return trades.map((t) => {
    const own = t.plannedRisk != null && t.plannedRisk > 0 ? t.plannedRisk : unit;
    return own > 0 ? t.pnl / own : 0;
  });
}

export interface CohortStats {
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;                 // %
  winRateCI: Interval | null;      // %
  totalPnl: number;
  expectancyR: number;
  expectancyCI: Interval | null;   // R
  profitFactor: number | null;
  avgMfe: number | null;
  mfeCapture: number | null;       // % of the favourable move kept on winners
  adherence: number | null;        // % of reviewed trades that followed the plan
  reviewed: number;
}

export function cohortStats(label: string, trades: Trade[], unit?: number): CohortStats {
  const shared = unit && unit > 0 ? unit : riskUnit(trades);
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const rs = rSeries(trades, shared);
  const meanR = rs.length > 0 ? rs.reduce((s, v) => s + v, 0) / rs.length : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const withMfe = trades.filter((t) => t.mfe != null && (t.mfe as number) > 0);
  const winMfe = wins.filter((t) => t.mfe != null && (t.mfe as number) > 0);
  const reviewed = trades.filter((t) => t.followedPlan === true || t.followedPlan === false);

  return {
    label,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    winRateCI: wilsonInterval(wins.length, trades.length),
    totalPnl: grossWin - grossLoss,
    expectancyR: meanR,
    expectancyCI: bootstrapMeanCI(rs),
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgMfe: withMfe.length > 0 ? withMfe.reduce((s, t) => s + (t.mfe as number), 0) / withMfe.length : null,
    mfeCapture: winMfe.length > 0
      ? winMfe.reduce((s, t) => s + Math.min(150, (t.pnl / (t.mfe as number)) * 100), 0) / winMfe.length
      : null,
    adherence: reviewed.length > 0
      ? (reviewed.filter((t) => t.followedPlan === true).length / reviewed.length) * 100
      : null,
    reviewed: reviewed.length,
  };
}

// 80% power, two-sided 5%, normal approximation. Only ever used to tell the
// trader how much more data a question needs before it can be answered.
export function sampleSizePerCohort(effect: number, sd: number): number | null {
  if (!(Math.abs(effect) > 0) || !(sd > 0)) return null;
  return Math.ceil((2 * (1.96 + 0.8416) ** 2 * sd * sd) / (effect * effect));
}

export interface CohortComparison {
  verdict: "a" | "b" | "indistinguishable" | "insufficient";
  gapR: number;
  neededPerCohort: number | null;
}

// Overlapping bootstrap intervals are treated as "no difference you can act
// on". That is deliberately conservative: a journal exists to stop the trader
// from switching rules on noise, not to hand out false positives.
export function compareCohorts(a: CohortStats, b: CohortStats): CohortComparison {
  const gapR = a.expectancyR - b.expectancyR;
  const sdOf = (c: CohortStats) =>
    c.expectancyCI && c.trades >= 2
      ? ((c.expectancyCI.high - c.expectancyCI.low) / 3.92) * Math.sqrt(c.trades)
      : null;
  const sdA = sdOf(a);
  const sdB = sdOf(b);
  const pooledSd = sdA != null && sdB != null
    ? Math.sqrt((sdA * sdA + sdB * sdB) / 2)
    : sdA ?? sdB;

  const needed = pooledSd != null && Math.abs(gapR) > 0
    ? sampleSizePerCohort(Math.abs(gapR), pooledSd)
    : null;

  // Below this a cohort is not a sample, it is an anecdote.
  if (a.trades < 20 || b.trades < 20) {
    return { verdict: "insufficient", gapR, neededPerCohort: needed };
  }

  const aCI = a.expectancyCI;
  const bCI = b.expectancyCI;
  if (!aCI || !bCI) return { verdict: "insufficient", gapR, neededPerCohort: needed };

  if (aCI.low > bCI.high) return { verdict: "a", gapR, neededPerCohort: null };
  if (bCI.low > aCI.high) return { verdict: "b", gapR, neededPerCohort: null };
  return { verdict: "indistinguishable", gapR, neededPerCohort: needed };
}

export interface CaptureBucket {
  label: string;
  count: number;
  avgCapture: number;
}

// How much of the move that was available did the exit actually keep? A book
// full of 30% captures is a stop-and-target problem, not a selection problem.
export function mfeCaptureBuckets(trades: Trade[]): CaptureBucket[] {
  const rated = trades
    .filter((t) => t.status === "win" && t.mfe != null && (t.mfe as number) > 0)
    .map((t) => Math.min(150, Math.max(0, (t.pnl / (t.mfe as number)) * 100)));
  const defs = [
    { label: "≤25%", test: (c: number) => c <= 25 },
    { label: "26–50%", test: (c: number) => c > 25 && c <= 50 },
    { label: "51–75%", test: (c: number) => c > 50 && c <= 75 },
    { label: "76–100%", test: (c: number) => c > 75 && c <= 100 },
    { label: ">100%", test: (c: number) => c > 100 },
  ];
  return defs.map(({ label, test }) => {
    const inBucket = rated.filter(test);
    return {
      label,
      count: inBucket.length,
      avgCapture: inBucket.length > 0 ? inBucket.reduce((s, c) => s + c, 0) / inBucket.length : 0,
    };
  });
}

export interface AtrBucket {
  label: string;
  count: number;
  winRate: number;
  expectancyR: number;
}

// Stop distance measured in ATR, so a stop can be judged against the noise of
// the instrument rather than in a currency that means nothing across symbols.
export function stopVsAtr(trades: Trade[]): AtrBucket[] {
  const rated = trades.filter((t) =>
    t.atr != null && (t.atr as number) > 0 &&
    t.plannedRisk != null && (t.plannedRisk as number) > 0 &&
    t.quantity > 0
  );
  const unit = riskUnit(rated);
  const ratioOf = (t: Trade) => ((t.plannedRisk as number) / t.quantity) / (t.atr as number);
  const defs = [
    { label: "<0.5 ATR", test: (r: number) => r < 0.5 },
    { label: "0.5–1 ATR", test: (r: number) => r >= 0.5 && r < 1 },
    { label: "1–1.5 ATR", test: (r: number) => r >= 1 && r < 1.5 },
    { label: "1.5–2 ATR", test: (r: number) => r >= 1.5 && r < 2 },
    { label: "≥2 ATR", test: (r: number) => r >= 2 },
  ];
  return defs.map(({ label, test }) => {
    const inBucket = rated.filter((t) => test(ratioOf(t)));
    return {
      label,
      count: inBucket.length,
      winRate: inBucket.length > 0 ? (inBucket.filter((t) => t.pnl > 0).length / inBucket.length) * 100 : 0,
      expectancyR: inBucket.length > 0
        ? rSeries(inBucket, unit).reduce((s, v) => s + v, 0) / inBucket.length
        : 0,
    };
  });
}

export interface RRBucket {
  label: string;
  count: number;
  winRate: number;
  expectancyR: number;
}

// Did the trades actually reach the reward the plan asked for? Intended R:R is
// a written promise; realised expectancy is the settlement.
export function outcomeByIntendedRR(trades: Trade[]): RRBucket[] {
  const rated = trades
    .map((t) => ({ t, rr: parseRR(t.rr) }))
    .filter((x): x is { t: Trade; rr: number } => x.rr != null && x.rr > 0);
  const unit = riskUnit(rated.map((x) => x.t));
  const defs = [
    { label: "<1:1", test: (r: number) => r < 1 },
    { label: "1:1–1.5", test: (r: number) => r >= 1 && r < 1.5 },
    { label: "1.5–2", test: (r: number) => r >= 1.5 && r < 2 },
    { label: "2–3", test: (r: number) => r >= 2 && r < 3 },
    { label: "≥3", test: (r: number) => r >= 3 },
  ];
  return defs.map(({ label, test }) => {
    const inBucket = rated.filter((x) => test(x.rr));
    return {
      label,
      count: inBucket.length,
      winRate: inBucket.length > 0 ? (inBucket.filter((x) => x.t.pnl > 0).length / inBucket.length) * 100 : 0,
      expectancyR: inBucket.length > 0
        ? rSeries(inBucket.map((x) => x.t), unit).reduce((s, v) => s + v, 0) / inBucket.length
        : 0,
    };
  });
}

export interface AdherenceStats {
  reviewed: number;
  followed: number;
  broke: number;
  adherencePct: number | null;
  followedExpectancyR: number | null;
  brokeExpectancyR: number | null;
  followedPnl: number;
  brokePnl: number;
  costPerBreak: number | null;   // $ gap between a break and the followed baseline
}

// The one comparison that most reliably changes behaviour: the same trader,
// same market, following the rules versus not.
export function adherenceStats(trades: Trade[]): AdherenceStats {
  const reviewed = trades.filter((t) => t.followedPlan === true || t.followedPlan === false);
  const followed = reviewed.filter((t) => t.followedPlan === true);
  const broke = reviewed.filter((t) => t.followedPlan === false);
  const unit = riskUnit(reviewed);
  const meanR = (list: Trade[]) =>
    list.length > 0 ? rSeries(list, unit).reduce((s, v) => s + v, 0) / list.length : null;
  const followedR = meanR(followed);
  const brokeR = meanR(broke);
  const followedAvgPnl = followed.length > 0
    ? followed.reduce((s, t) => s + t.pnl, 0) / followed.length : null;
  const brokeAvgPnl = broke.length > 0
    ? broke.reduce((s, t) => s + t.pnl, 0) / broke.length : null;

  return {
    reviewed: reviewed.length,
    followed: followed.length,
    broke: broke.length,
    adherencePct: reviewed.length > 0 ? (followed.length / reviewed.length) * 100 : null,
    followedExpectancyR: followedR,
    brokeExpectancyR: brokeR,
    followedPnl: followed.reduce((s, t) => s + t.pnl, 0),
    brokePnl: broke.reduce((s, t) => s + t.pnl, 0),
    costPerBreak: followedAvgPnl != null && brokeAvgPnl != null ? brokeAvgPnl - followedAvgPnl : null,
  };
}

export interface MistakeStat {
  tag: string;
  count: number;
  pnl: number;
  expectancyR: number;
  winRate: number;
}

export function mistakeTagStats(trades: Trade[]): MistakeStat[] {
  const counts: Record<string, Trade[]> = {};
  for (const t of trades) {
    const tags = Array.isArray(t.mistakeTags) ? t.mistakeTags : [];
    for (const tag of tags) {
      if (!tag) continue;
      (counts[tag] = counts[tag] || []).push(t);
    }
  }
  const unit = riskUnit(trades);
  return Object.entries(counts)
    .map(([tag, list]) => ({
      tag,
      count: list.length,
      pnl: list.reduce((s, t) => s + t.pnl, 0),
      expectancyR: rSeries(list, unit).reduce((s, v) => s + v, 0) / list.length,
      winRate: (list.filter((t) => t.pnl > 0).length / list.length) * 100,
    }))
    .sort((a, b) => a.expectancyR - b.expectancyR);
}

export interface VersionStat {
  version: number;
  count: number;
  winRate: number;
  expectancyR: number;
  pnl: number;
}

// Setup revisions: the same playbook before and after a rule change.
export function setupVersionStats(trades: Trade[]): VersionStat[] {
  const counts: Record<number, Trade[]> = {};
  for (const t of trades) {
    if (t.setupVersion == null) continue;
    (counts[t.setupVersion] = counts[t.setupVersion] || []).push(t);
  }
  const unit = riskUnit(trades);
  return Object.entries(counts)
    .map(([v, list]) => ({
      version: Number(v),
      count: list.length,
      winRate: (list.filter((t) => t.pnl > 0).length / list.length) * 100,
      expectancyR: rSeries(list, unit).reduce((s, v) => s + v, 0) / list.length,
      pnl: list.reduce((s, t) => s + t.pnl, 0),
    }))
    .sort((a, b) => a.version - b.version);
}

export interface WeekRow {
  weekStart: string;
  trades: number;
  pnl: number;
  expectancyR: number;
  adherence: number | null;
  baselineR: number | null;
  verdict: "above" | "in-line" | "below" | "insufficient";
}

// The weekly ritual: was the week's result inside the noise of the trader's
// own baseline, or did something actually change? A week is "above" only when
// its interval clears the baseline, so one good Friday is not evidence.
export function weeklyReview(trades: Trade[], weeks = 8, weekStartsOn: "monday" | "sunday" = "monday"): WeekRow[] {
  const unit = riskUnit(trades);
  const sorted = [...trades].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const weekStart = (date: string): string => {
    const d = new Date(`${normalizeDate(date)}T00:00:00Z`);
    const day = d.getUTCDay();
    const offset = weekStartsOn === "monday" ? (day + 6) % 7 : day;
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };

  const groups: Record<string, Trade[]> = {};
  for (const t of sorted) {
    const key = weekStart(t.date);
    (groups[key] = groups[key] || []).push(t);
  }

  const keys = Object.keys(groups).sort();
  const rows: WeekRow[] = [];
  let history: Trade[] = [];

  for (const key of keys) {
    const list = groups[key];
    const baselineList = history;
    const baselineR = baselineList.length >= 20
      ? rSeries(baselineList, unit).reduce((s, v) => s + v, 0) / baselineList.length
      : null;
    const rs = rSeries(list, unit);
    const meanR = rs.reduce((s, v) => s + v, 0) / rs.length;
    const ci = bootstrapMeanCI(rs);
    const reviewed = list.filter((t) => t.followedPlan === true || t.followedPlan === false);

    let verdict: WeekRow["verdict"] = "insufficient";
    if (list.length >= 8 && ci && baselineR != null) {
      verdict = ci.low > baselineR ? "above" : ci.high < baselineR ? "below" : "in-line";
    }

    rows.push({
      weekStart: key,
      trades: list.length,
      pnl: list.reduce((s, t) => s + t.pnl, 0),
      expectancyR: meanR,
      adherence: reviewed.length > 0
        ? (reviewed.filter((t) => t.followedPlan === true).length / reviewed.length) * 100
        : null,
      baselineR,
      verdict,
    });
    history = history.concat(list);
  }

  return rows.slice(-weeks);
}

