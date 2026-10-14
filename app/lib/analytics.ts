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
  const negatives = dailyPnl.filter((v) => v < 0);
  if (negatives.length === 0) return mean > 0 ? 99 : 0;
  const downsideSd = stdDev(negatives);
  if (downsideSd === 0) return 0;
  return (mean / downsideSd) * Math.sqrt(252);
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

export function byDayOfWeek(trades: Trade[]): { day: string; pnl: number; count: number; wr: number }[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const map: Record<number, { pnl: number; count: number; wins: number }> = {};
  for (const t of trades) {
    const d = new Date(normalizeDate(t.date) + "T12:00:00").getDay();
    if (!map[d]) map[d] = { pnl: 0, count: 0, wins: 0 };
    map[d].pnl += t.pnl;
    map[d].count += 1;
    if (t.status === "win") map[d].wins += 1;
  }
  return [1, 2, 3, 4, 5].map((d) => ({
    day: days[d],
    pnl: parseFloat((map[d]?.pnl || 0).toFixed(2)),
    count: map[d]?.count || 0,
    wr: map[d]?.count ? Math.round((map[d].wins / map[d].count) * 100) : 0,
  }));
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
    roll("Long",  trades.filter((t) => t.direction === "long")),
    roll("Short", trades.filter((t) => t.direction === "short")),
  ];
}

export interface CostProfile {
  grossProfit: number;
  costs: number;
  costPctOfGross: number;
  costPerTrade: number;
  breakevenTrades: number;
}

// Costs as a share of gross profit. Above roughly 10% this dominates the edge
// for a high-frequency book; below 1% it is noise and can be ignored.
export function costProfile(trades: Trade[]): CostProfile {
  const gross = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const costs = trades.reduce((s, t) => s + (t.commission || 0) + (t.fees || 0), 0);
  const perTrade = trades.length > 0 ? costs / trades.length : 0;
  // How many trades' worth of cost the gross profit covers.
  const breakevenTrades = perTrade > 0 ? Math.ceil(costs / perTrade) : 0;
  return {
    grossProfit: parseFloat(gross.toFixed(2)),
    costs: parseFloat(costs.toFixed(2)),
    costPctOfGross: gross > 0 ? parseFloat(((costs / gross) * 100).toFixed(2)) : 0,
    costPerTrade: parseFloat(perTrade.toFixed(2)),
    breakevenTrades,
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
    if (day.length < 2) continue;
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
  accountSize: number;           // challenge account size, account currency
  targetPct: number;             // profit target, % of size
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
  accountSize: 100000,
  targetPct: 10,
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
  const targetAmount = (size * config.targetPct) / 100;
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
}

// Bootstrap Monte Carlo: resample the trader's own trades, day by day, and
// walk the balance through the firm's rules. This is the only honest way to
// answer "pass rate" — a closed-form win-rate x R:R figure ignores the daily
// and drawdown rules that actually end most evaluations.
export function simulateChallenge(
  trades: Trade[],
  config: ChallengeConfig,
  runs = 2000,
): ChallengeSim {
  const size = Math.max(config.accountSize, 0);
  const targetAmount = (size * config.targetPct) / 100;
  const ddAllowed    = (size * config.maxDdPct) / 100;
  const dailyAllowed = (size * config.dailyLimitPct) / 100;

  const pool = trades.map((t) => t.pnl).filter((v) => Number.isFinite(v));
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
  };
  if (sampleTrades === 0 || size <= 0 || targetAmount <= 0) return empty;

  // Horizon: the firm's time limit, else a trading year.
  const hardDays = config.maxDays && config.maxDays > 0 ? config.maxDays : 252;

  let pass = 0, failDaily = 0, failDd = 0, timeout = 0, consFail = 0;
  const passDays: number[] = [];

  for (let r = 0; r < runs; r++) {
    let bal = size, peak = size, biggestDay = 0;
    let outcome: "pass" | "daily" | "dd" | "timeout" | null = null;
    let daysRun = 0;

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
        if (bal - size >= targetAmount) { outcome = "pass"; break; }
      }
      if (dayPnl > biggestDay) biggestDay = dayPnl;
    }

    if (outcome === "pass") {
      const totalProfit = bal - size;
      if (config.consistencyPct != null && biggestDay > (config.consistencyPct / 100) * totalProfit) {
        consFail++;
      } else {
        pass++;
        passDays.push(daysRun);
      }
    } else if (outcome === "daily") failDaily++;
    else if (outcome === "dd") failDd++;
    else timeout++;
  }

  passDays.sort((a, b) => a - b);
  const medianDaysToPass = passDays.length > 0
    ? passDays[Math.floor(passDays.length / 2)]
    : null;

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
  };
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

  const remainingToTarget = Math.max(0, (size * config.targetPct) / 100 - status.totalPnl);
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
export function buildReportStats(trades: Trade[], initialBalance: number): ReportStats {
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
  for (const t of trades) {
    const h = tradeHours(t);
    if (h !== null) { totalHours += h; timedCount++; }
  }
  const hourlyRate = totalHours > 0 ? totalPnl / totalHours : null;

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

  const s = streaks(trades);

  return {
    trades, sorted, wins, losses,
    totalPnl, winRate, avgWin, avgLoss,
    profitFactor: avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : null,
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

    hourData: byHourOfDay(trades),
    dowData: byDayOfWeek(trades),
    instruments: byInstrument(trades),

    maxWinStreak: s.maxWinStreak,
    maxLossStreak: s.maxLossStreak,
    currentStreak: s.currentStreak,
    currentType: s.currentType,
  };
}
