// Recommendations for every Analytics tab, derived from the same numbers the
// charts and metric cards render — never from a second, drifting copy of the
// math. Pure functions: same input, same advice, no React.
//
// Every finding names the figure it fired on (`metric`) so a trader can check
// it against the chart above rather than take it on faith, and each section
// states a change of behaviour rather than restating the number. A rule that
// only repeats a metric is not a recommendation.

import type { Trade } from "./types";
import type {
  HourBucket, ProcessBucket, GapBucket, CostProfile, RRiskProfile,
  StopQuality, LegStats, CashFlowReport,
} from "./analytics";

// ─── Shape ──────────────────────────────────────────────────────────────

export type InsightLevel = "good" | "warn" | "bad" | "info";

export type SectionId =
  | "overview" | "risk" | "time" | "heatmap"
  | "rmultiples" | "execution" | "behavior" | "process";

export interface Insight {
  level: InsightLevel;
  title: string;
  detail: string;
  metric?: string;
  /** Which benchmark scale explains the figure this finding fired on. Every
   *  rule sets one, so a reader who ignores the advice can still grade the
   *  number themselves. See `LOOK_FOR`. */
  guide?: GuideKey;
}

/** Flat bag of everything the recommendations read. The Analytics page maps
 *  its computed stats into this, so a missing figure is a type error here
 *  rather than a silently skipped rule on screen. */
export interface AnalyticsFacts {
  trades: Trade[];
  totalPnl: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  tradingDays: number;

  sharpe: number;
  sortino: number;
  calmar: number;
  maxDd: number;
  maxDdPct: number;
  longestDdDays: number;
  currentDdDays: number;

  rolling: { trade: number; wr: number }[];

  riskCoverage: number;
  riskMissing: number;
  avgRisk: number;
  riskPctAvg: number;
  riskConsistency: number;
  stopBreaches: number;

  daily: { date: string; pnl: number }[];
  dowData: { day: string; pnl: number; count: number; wr: number }[];
  hourData: HourBucket[];
  symbolData: { symbol: string; pnl: number; count: number; wr: number }[];
  tagData: { tag: string; pnl: number; count: number; wr: number }[];

  avgR: number;
  rUnit: number;
  rHistogram: { bucket: string; count: number; positive: boolean }[];

  hasMaeMfe: boolean;
  maeFdCount: number;
  avgMae: number;
  avgMfe: number;
  entryEff: number;
  exitEff: number;

  overtradingDays: { date: string; count: number }[];
  revengeCount: number;
  revengePnl: number;
  otherPnl: number;
  disciplineScore: number;
  maxDayTrades: number;

  ror: { kelly: number; ror: number; maxSafeRisk: number } | null;
  riskPct: number;

  recFactor: number;
  rRisk: RRiskProfile;
  costs: CostProfile;
  stop: StopQuality;
  durationData: ProcessBucket[];
  gapData: GapBucket[];
  directionData: ProcessBucket[];
  exitReasons: ProcessBucket[];
  magicData: ProcessBucket[];
  legData: LegStats;
  cashFlow: CashFlowReport;
}

// ─── Thresholds ─────────────────────────────────────────────────────────

// Trading conventions, not laws. They live in one block so they can be argued
// with in one place rather than hunted across nine rule sets.
const T = {
  minSampleTrades: 30,      // below this the whole verdict is provisional
  minSlice: 5,              // per day / hour / symbol before a slice is trusted
  minHourSlice: 5,

  pfFloor: 1,               // below 1 the book loses money
  pfThin: 1.2,
  pfStrong: 2,
  payoffThin: 1,
  payoffStrong: 2,
  edgeMarginThinPct: 5,     // win rate above break-even
  edgeMarginStrongPct: 15,

  maxDdWarnPct: 6,
  maxDdBadPct: 10,
  currentDdWarnDays: 14,
  currentDdBadDays: 30,

  sharpeFloor: 0.5,
  sharpeStrong: 2,
  calmarFloor: 1,

  riskWarnPct: 2,
  riskBadPct: 5,
  riskLowPct: 0.5,          // risk this small is worth flagging too
  riskConsistencyFloor: 80,

  concentrationWarnPct: 50, // share of profit carried by one day
  concentrationBadPct: 70,
  greenDayFloor: 45,
  greenDayStrong: 60,
  trendDeteriorationPct: 25,

  costWarnPct: 5,
  costBadPct: 10,
  costNoisePct: 1,

  recoveryWarn: 1,
  recoveryFloor: 3,

  entryEffBad: 45,
  entryEffStrong: 60,
  exitEffWarn: 50,
  exitEffStrong: 70,
  exitEffBad: 40,
  maeFdCoverageFloorPct: 50,

  revengeShareWarn: 0.2,
  ruinWarn: 0.05,
  ruinBad: 0.1,

  leftTailBad: 0.15,        // share of trades closing beyond -2R
  scratchWarn: 0.2,         // share of trades closing at roughly 0R
  earlyExitWarn: 0.7,       // share of R-winners that never reach +2R
  rStrong: 0.3,
} as const;

// ─── Reference scales ───────────────────────────────────────────────────

// Reference bands for the figures the rules fire on, best to worst. These are
// published trading benchmarks for the reader to grade themselves against, not
// firing thresholds — the rules above still read every cut-off from `T`. Bands
// reference `T` where one exists so the two can never drift apart.

export type Grade = "advanced" | "great" | "good" | "average" | "bad";

export const GRADE_ORDER: Grade[] = ["advanced", "great", "good", "average", "bad"];

export interface MetricGuide {
  label: string;
  what: string;
  /** One imperative next step for this metric, shown under the scale. */
  action: string;
  bands: Record<Grade, string>;
}

const bands = (advanced: string, great: string, good: string, average: string, bad: string) =>
  ({ advanced, great, good, average, bad });

const n1 = (v: number) => v.toFixed(1);
const n2 = (v: number) => v.toFixed(2);

export const LOOK_FOR = {
  profitFactor: {
    label: "Profit factor",
    what: "Gross wins divided by gross losses: how many dollars each dollar lost is covered by.",
    action: "Raise the average winner or cut the average loss.",
    bands: bands(`${n1(T.pfStrong * 2)}+`, `${n1(T.pfStrong)}+`, `${n1(T.pfThin)}+`, `${n1(T.pfFloor)}–${n1(T.pfThin)}`, `< ${n1(T.pfFloor)}`),
  },
  expectancyR: {
    label: "Expectancy in R",
    what: "Average result per trade measured in units of risk, so it survives a change of position size.",
    action: "Cut the trades that do not clear 1R of edge.",
    bands: bands(`+${n2(T.rStrong)}R+`, "+0.20R+", "+0.10R+", "0 to +0.10R", "< 0R"),
  },
  edgeMargin: {
    label: "Win rate vs break-even",
    what: "Points of win rate above the break-even rate your payoff requires. Below it, a high win rate still loses.",
    action: "Widen targets or tighten entries until the margin clears 5 points.",
    bands: bands(`+${T.edgeMarginStrongPct + T.edgeMarginThinPct} pts`, `+${T.edgeMarginStrongPct} pts`, `+${T.edgeMarginThinPct} pts`, `0–${T.edgeMarginThinPct} pts`, "below break-even"),
  },
  payoff: {
    label: "Payoff ratio",
    what: "Average win divided by average loss. Pair it with win rate — neither is meaningful alone.",
    action: "Let winners run further, or cut losers sooner.",
    bands: bands("3.0+", `${n1(T.payoffStrong)}+`, "1.5+", `${n1(T.payoffThin)}–1.5`, `< ${n1(T.payoffThin)}`),
  },
  concentration: {
    label: "Best-day share of profit",
    what: "How much of net profit the single best day produced. A high share means one outcome, not a process.",
    action: "Trade more days at normal size instead of one big session.",
    bands: bands("< 20%", "< 35%", `< ${T.concentrationWarnPct}%`, `${T.concentrationWarnPct}–${T.concentrationBadPct}%`, `≥ ${T.concentrationBadPct}%`),
  },
  trend: {
    label: "Recent vs earlier half",
    what: "Average trading day in the second half of the period against the first. Shows drift, not skill.",
    action: "Compare this month's rules with the prior month's.",
    bands: bands(`+${T.trendDeteriorationPct}%+`, "+10%+", "−10% to +10%", `−10% to −${T.trendDeteriorationPct}%`, `< −${T.trendDeteriorationPct}%`),
  },
  sliceEdge: {
    label: "Slice sample and edge",
    what: "A market, session, tag or hold-time band is only an edge once it clears the sample floor; judge it on profit per trade, not total.",
    action: "Test one market or window at a time before sizing it.",
    bands: bands("20+ trades, positive per trade", "10–19 trades", `${T.minSlice}–9 trades`, "3–4 trades", `< ${T.minSlice} trades`),
  },
  sampleSize: {
    label: "Trades behind the reading",
    what: "How much evidence the conclusion rests on. Below the sample floor every ratio is provisional.",
    action: "Collect more trades before changing the plan.",
    bands: bands("100+", "50–99", `${T.minSampleTrades}–49`, "10–29", "< 10"),
  },
  drawdownPct: {
    label: "Max drawdown (% of peak)",
    what: "Deepest fall from an equity high, as a share of that peak. The number a funded account is judged on.",
    action: "Cut risk per trade until drawdown stays under 6%.",
    bands: bands("< 2%", "2–4%", `4–${T.maxDdWarnPct}%`, `${T.maxDdWarnPct}–${T.maxDdBadPct}%`, `≥ ${T.maxDdBadPct}%`),
  },
  drawdownDays: {
    label: "Days under the high-water mark",
    what: "How long the account has spent below its peak. Length matters more than depth for strategy decay.",
    action: "Re-test the setup before taking more of it.",
    bands: bands("< 7", "7–10", `10–${T.currentDdWarnDays}`, `${T.currentDdWarnDays}–${T.currentDdBadDays}`, `≥ ${T.currentDdBadDays}`),
  },
  sharpe: {
    label: "Sharpe ratio",
    what: "Return per unit of total volatility. A rough measure of whether the swings are being paid for.",
    action: "Reduce position size or trade frequency to smooth returns.",
    bands: bands(`${n1(T.sharpeStrong)}+`, "1.5–2.0", "1.0–1.5", `${n1(T.sharpeFloor)}–1.0`, `< ${n1(T.sharpeFloor)}`),
  },
  sortino: {
    label: "Sortino ratio",
    what: "Return per unit of downside volatility only. Compare with Sharpe: trailing it means losses dominate.",
    action: "Tighten exits on losers before adding entries.",
    bands: bands("3.0+", "2.0+", "1.5+", "0.5–1.5", "< 0.5"),
  },
  calmar: {
    label: "Calmar ratio",
    what: "Annualised return divided by max drawdown: return per unit of worst-case pain.",
    action: "Lower risk per trade or hold winners longer.",
    bands: bands("3.0+", "2.0+", `${n1(T.calmarFloor)}–2.0`, "0.5–1.0", "< 0.5"),
  },
  riskPct: {
    label: "Risk per trade (% of balance)",
    what: "Portion of the account at stake per position. Low is survivable; high needs an unusually large edge.",
    action: "Size positions at 1% or less of the account.",
    bands: bands(`${T.riskLowPct}–0.75%`, "0.75–1%", `1–${T.riskWarnPct}%`, `${T.riskWarnPct}–${T.riskBadPct}%`, `> ${T.riskBadPct}%`),
  },
  riskConsistency: {
    label: "Risk consistency",
    what: "How little position size varies from trade to trade, out of 100. Size chosen in the moment is the leak.",
    action: "Set risk per trade once and keep it fixed.",
    bands: bands("90+", `${T.riskConsistencyFloor}+`, `70–${T.riskConsistencyFloor}`, "50–70", "< 50"),
  },
  stopBreaches: {
    label: "Losses beyond planned risk",
    what: "Losses per 100 sized trades that finished worse than the stop allowed. Widened stops are unreported risk.",
    action: "Honour the stop as entered; never widen it mid-trade.",
    bands: bands("0", "≤ 1", "≤ 3", "≤ 5", "> 5"),
  },
  dataCoverage: {
    label: "Field coverage",
    what: "Share of trades carrying the field this reading needs. Missing data turns an edge into a guess.",
    action: "Log this field on every trade and re-export.",
    bands: bands("100%", "90%+", "75%+", `${T.maeFdCoverageFloorPct}%+`, `< ${T.maeFdCoverageFloorPct}%`),
  },
  dayCoverage: {
    label: "Weekdays traded",
    what: "Distinct weekdays with trades. An untested day is untested information, not automatically a bad day.",
    action: "Backtest the untraded weekday before adding it.",
    bands: bands("5", "4", "3", "2", "1"),
  },
  greenDayShare: {
    label: "Profitable trading days",
    what: "Share of trading days that finish green. Low here means the result rests on a few outsized days.",
    action: "Cut the size that turns small wins into red days.",
    bands: bands(`${T.greenDayStrong}%+`, "55%+", "50%+", `${T.greenDayFloor}–50%`, `< ${T.greenDayFloor}%`),
  },
  daySkew: {
    label: "Losing day vs winning day",
    what: "Average losing day divided by average winning day. Above 1.0 the book needs more green days than red.",
    action: "Stop trading after the first outsized losing day.",
    bands: bands("≤ 0.5", "≤ 0.75", "≤ 1.0", "1.0–1.3", "> 1.3"),
  },
  sessionSpread: {
    label: "Win-rate spread across the day",
    what: "Difference in win rate between your best and worst well-sampled hour. Wide means time-of-day is a real variable.",
    action: "Restrict entries to your best-tested hours.",
    bands: bands("< 10 pts", "10–20 pts", "20–35 pts", "35–50 pts", "> 50 pts"),
  },
  leftTail: {
    label: "Trades worse than −2R",
    what: "Share of trades that lost more than twice the planned risk. The tail that makes a fixed-size book fragile.",
    action: "Move stops to where the setup is actually invalidated.",
    bands: bands("0%", "< 5%", "< 10%", `10–${T.leftTailBad * 100}%`, `≥ ${T.leftTailBad * 100}%`),
  },
  earlyExit: {
    label: "Winners capped at +1R",
    what: "Share of R-winners that never get past +1R. High here means targets or patience is the constraint.",
    action: "Let winners reach the planned target before closing.",
    bands: bands("< 30%", "30–50%", `50–${T.earlyExitWarn * 100}%`, `${T.earlyExitWarn * 100}–85%`, "≥ 85%"),
  },
  scratchShare: {
    label: "Scratch trades (≈0R)",
    what: "Share of trades closed around breakeven. Noise in the distribution unless they share a cause.",
    action: "Define entry criteria so uncertain trades are skipped.",
    bands: bands("< 5%", "< 10%", `< ${T.scratchWarn * 100}%`, `${T.scratchWarn * 100}–30%`, "> 30%"),
  },
  rWinShare: {
    label: "Trades closing at +1R or better",
    what: "Share of trades that reach at least one unit of reward. Read it against the payoff ratio, never alone.",
    action: "Hold winners to at least 2R when the setup allows.",
    bands: bands("50%+", "40–50%", "30–40%", "20–30%", "< 20%"),
  },
  entryEff: {
    label: "Entry efficiency",
    what: "How much of the immediate favourable move you captured at entry, out of 100. Low means chasing.",
    action: "Wait for a pullback instead of entering into the move.",
    bands: bands("70+", `${T.entryEffStrong}+`, `50–${T.entryEffStrong}`, `${T.entryEffBad}–50`, `< ${T.entryEffBad}`),
  },
  exitEff: {
    label: "Exit efficiency",
    what: "Share of the maximum favourable excursion actually realised on winners. Low means giving profit back.",
    action: "Move the stop to breakeven and let the target work.",
    bands: bands("80%+", `${T.exitEffStrong}%+`, `50–${T.exitEffStrong}%`, `${T.exitEffBad}–50%`, `< ${T.exitEffBad}%`),
  },
  stopPlacement: {
    label: "MAE vs realised loss",
    what: "How far price ran against the trade compared with the loss taken. Near 1.0 means the stop sat where the trade decided itself.",
    action: "Place the stop where the trade is actually invalidated.",
    bands: bands("0.9–1.1", "0.8–1.2", `0.7–1.3`, "0.5–0.7 or 1.3–1.6", "< 0.5 or > 1.6"),
  },
  winnerHeat: {
    label: "Adverse heat on winners",
    what: "Average distance a winning trade moved against you first, in R. High heat means entries fire before the setup confirms.",
    action: "Wait for confirmation before entering.",
    bands: bands("< 0.25R", "< 0.50R", "< 0.75R", "0.75–1.0R", "> 1.0R"),
  },
  overtrading: {
    label: "Trades per session",
    what: "Entries per trading day against your own baseline. The count matters less than whether high-volume days pay.",
    action: "Cap the session at your average trade count.",
    bands: bands("≤ 2", "≤ 3", "≤ 5", "6–8", "> 8"),
  },
  revengeShare: {
    label: "Trades after a same-day loss",
    what: "Share of the book opened after a loss that day. The risk is that these underperform the rest of the book.",
    action: "Take a break after a losing trade.",
    bands: bands("< 5%", "< 10%", "< 15%", `${15}–${T.revengeShareWarn * 100}%`, `> ${T.revengeShareWarn * 100}%`),
  },
  disciplineScore: {
    label: "Discipline score",
    what: "Composite of sizing, session limits and reaction to losses, out of 100. It measures rule-following, not edge.",
    action: "Follow one rule per session until it is automatic.",
    bands: bands("90+", "80+", "70+", "60–69", "< 60"),
  },
  sizingVsKelly: {
    label: "Size vs full Kelly",
    what: "Risk per trade as a fraction of the Kelly optimum for your win rate and payoff. Most books belong under half.",
    action: "Keep risk at or below half-Kelly.",
    bands: bands("≤ 0.25× Kelly", "0.25–0.5×", "0.5–0.75×", "0.75–1×", "> 1×"),
  },
  ruinRisk: {
    label: "Risk of ruin",
    what: "Modelled chance the account reaches zero at this size. Everything above a few percent is a countdown, not a risk.",
    action: "Reduce risk per trade until ruin risk is under 2%.",
    bands: bands("< 1%", "1–2%", `2–${T.ruinWarn * 100}%`, `${T.ruinWarn * 100}–${T.ruinBad * 100}%`, `≥ ${T.ruinBad * 100}%`),
  },
  recoveryFactor: {
    label: "Recovery factor",
    what: "Net profit divided by max drawdown: how many times over the account repays its worst decline.",
    action: "Cut size until net profit exceeds the worst drawdown.",
    bands: bands("5.0+", `${n1(T.recoveryFloor)}+`, "1.5–3.0", "1.0–1.5", `< ${n1(T.recoveryWarn)}`),
  },
  costPct: {
    label: "Costs as % of gross profit",
    what: "Commission and fees measured against what the winners make. Friction is paid on every trade, won or lost.",
    action: "Trade fewer, higher-conviction setups.",
    bands: bands(`< ${n1(T.costNoisePct)}%`, "1–3%", `3–${T.costWarnPct}%`, `${T.costWarnPct}–${T.costBadPct}%`, `> ${T.costBadPct}%`),
  },
  reEntryGap: {
    label: "Time between loss and next entry",
    what: "Cooling-off period after a losing trade. Fast re-entries are the classic revenge signature.",
    action: "Wait at least 15 minutes after a losing trade.",
    bands: bands("60 min+", "30–60 min", "15–30 min", "5–15 min", "< 5 min"),
  },
  manualExitShare: {
    label: "Losses closed by hand",
    what: "Share of losing trades exited before the stop or target did its job. A high share means the plan is written after entry.",
    action: "Let the stop or target close the trade.",
    bands: bands("< 10%", "10–25%", "25–50%", "50–70%", "> 70%"),
  },
  averagingDown: {
    label: "Positions averaged down",
    what: "Share of positions added to at a worse price. It widens risk exactly when the market disagrees.",
    action: "Size the full position at entry instead of adding to losers.",
    bands: bands("0", "≤ 2%", "≤ 5%", "5–10%", "> 10%"),
  },
  legs: {
    label: "Entries per position",
    what: "How many fills build one position. More legs means more mid-trade decisions and less comparable risk.",
    action: "Enter the planned size in one order.",
    bands: bands("1.00", "≤ 1.25", "≤ 1.50", "1.50–2.00", "> 2.00"),
  },
  depositShare: {
    label: "External cash vs net profit",
    what: "Net deposits as a share of net profit. High means the curve is funded, not earned.",
    action: "Judge performance on trading P&L, not deposits.",
    bands: bands("0%", "< 5%", "< 10%", "10–20%", "≥ 20%"),
  },
} as const satisfies Record<string, MetricGuide>;

export type GuideKey = keyof typeof LOOK_FOR;

// ─── Helpers ────────────────────────────────────────────────────────────

const money = (v: number, digits = 2) => `${v < 0 ? "-" : "+"}$${Math.abs(v).toFixed(digits)}`;
const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;
const share = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/** Mean of the first half against the second half of a series. Used to tell
 *  "this is how I trade" apart from "this is where I am now". */
function halfTrend(values: number[]): { first: number; second: number; changePct: number } | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const avg = (a: number[]) => sum(a) / Math.max(a.length, 1);
  const a = avg(first);
  const b = avg(second);
  if (a === 0) return null;
  return { first: a, second: b, changePct: ((b - a) / Math.abs(a)) * 100 };
}

const ranked = (list: Insight[]): Insight[] => {
  const rank: Record<InsightLevel, number> = { bad: 0, warn: 1, good: 2, info: 3 };
  return [...list].sort((a, b) => rank[a.level] - rank[b.level]);
};

/** Ranks a dimension without hiding the thin slices. The old rules filtered
 *  to slices clearing `minSlice` and then called the filtered winner "the
 *  best", which flatly contradicted the chart whenever a thinner slice had a
 *  bigger total. The true leader is always returned; callers use
 *  `bestTrusted` only to offer a well-sampled alternative. */
function rankBy<T>(
  items: T[],
  pnlOf: (d: T) => number,
  countOf: (d: T) => number,
  minCount = T.minSlice,
): { leader: T | null; laggard: T | null; bestTrusted: T | null; worstTrusted: T | null; trustedCount: number; tradedCount: number } {
  const traded = items.filter((d) => countOf(d) > 0);
  const trusted = traded.filter((d) => countOf(d) >= minCount);
  const max = (list: T[]) => list.reduce((b, d) => (pnlOf(d) > pnlOf(b) ? d : b));
  const min = (list: T[]) => list.reduce((w, d) => (pnlOf(d) < pnlOf(w) ? d : w));
  return {
    leader: traded.length > 0 ? max(traded) : null,
    laggard: traded.length > 0 ? min(traded) : null,
    bestTrusted: trusted.length > 0 ? max(trusted) : null,
    worstTrusted: trusted.length > 0 ? min(trusted) : null,
    trustedCount: trusted.length,
    tradedCount: traded.length,
  };
}

// ─── Overview ───────────────────────────────────────────────────────────

function overviewInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];
  const tradeCount = f.trades.length;

  if (f.expectancy < 0) {
    out.push({
      level: "bad",
      guide: "expectancyR",
      title: "The average trade loses money at this size",
      detail: `Expectancy is ${money(f.expectancy)} per trade, so volume is the problem, not signal. Cutting size until this turns positive preserves the account; trading it harder compounds the loss.`,
      metric: `${money(f.expectancy)}/trade`,
    });
  } else if (f.expectancy > 0) {
    out.push({
      level: "good",
      guide: "expectancyR",
      title: "The edge is real in cash terms",
      detail: `${money(f.expectancy)} per trade across ${tradeCount} trades. This is the figure to scale, not the win rate — it already has both sides of the ledger in it.`,
      metric: `${money(f.expectancy)}/trade`,
    });
  }

  if (f.profitFactor < T.pfFloor) {
    out.push({
      level: "bad",
      guide: "profitFactor",
      title: "Gross wins do not cover gross losses",
      detail: `Profit factor ${f.profitFactor.toFixed(2)}. Costs aside, the book returns less than it puts at risk, so no amount of position sizing turns it positive — the exits or the entry criteria have to change.`,
      metric: f.profitFactor.toFixed(2),
    });
  } else if (f.profitFactor > T.pfStrong) {
    out.push({
      level: "good",
      guide: "profitFactor",
      title: "Winners outweigh losers by a wide margin",
      detail: `Profit factor ${f.profitFactor.toFixed(2)}. With this much room, the priority is protecting it — a drawdown rule matters more than finding new setups.`,
      metric: f.profitFactor.toFixed(2),
    });
  } else if (f.profitFactor < T.pfThin) {
    out.push({
      level: "warn",
      guide: "profitFactor",
      title: "Profit factor has almost no cushion",
      detail: `${f.profitFactor.toFixed(2)} leaves a fraction of a point between a good month and a losing one. One weak streak puts the whole period underwater.`,
      metric: f.profitFactor.toFixed(2),
    });
  }

  // Win rate only means something against the break-even rate the payoff
  // demands: a 60% win rate with 1:1 payoff is still a losing book.
  if (f.avgWin > 0 && f.avgLoss > 0) {
    const payoff = f.avgWin / f.avgLoss;
    const breakEven = (f.avgLoss / (f.avgWin + f.avgLoss)) * 100;
    const margin = f.winRate - breakEven;

    if (margin < 0) {
      out.push({
        level: "bad",
        guide: "edgeMargin",
        title: "Winning less often than the payoff demands",
        detail: `${pct(f.winRate)} win rate against a ${pct(breakEven)} break-even at ${payoff.toFixed(2)}:1. The hit rate is below what this payoff needs, so the fix is targets and stops, not entry timing.`,
        metric: `${pct(f.winRate)} vs ${pct(breakEven)}`,
      });
    } else if (margin < T.edgeMarginThinPct) {
      out.push({
        level: "warn",
        guide: "edgeMargin",
        title: "The win-rate margin is thin",
        detail: `Only ${margin.toFixed(1)} points above the ${pct(breakEven)} break-even rate. A normal losing streak crosses it, so hold size down until the margin widens.`,
        metric: `+${margin.toFixed(1)} pts`,
      });
    } else if (margin >= T.edgeMarginStrongPct) {
      out.push({
        level: "good",
        guide: "edgeMargin",
        title: "Clear margin over the break-even rate",
        detail: `${pct(f.winRate)} against ${pct(breakEven)} break-even, with a ${payoff.toFixed(2)}:1 payoff. That margin survives an ordinary losing run.`,
        metric: `+${margin.toFixed(1)} pts`,
      });
    }

    if (payoff < T.payoffThin) {
      out.push({
        level: "warn",
        guide: "payoff",
        title: "Losers are as big as winners",
        detail: `${payoff.toFixed(2)}:1 means the win rate has to carry the whole account. Letting winners run toward the target is usually worth more than an extra entry.`,
        metric: `${payoff.toFixed(2)}:1`,
      });
    } else if (payoff >= T.payoffStrong) {
      out.push({
        level: "good",
        guide: "payoff",
        title: "Winners are far larger than losers",
        detail: `${payoff.toFixed(2)}:1 at a ${pct(f.winRate)} win rate. The account can absorb a low hit rate, which means you can afford to be selective instead of forcing trades.`,
        metric: `${payoff.toFixed(2)}:1`,
      });
    }
  }

  // Concentration: the same risk a spike day carries, seen from the equity
  // curve. One day holding most of the profit is one day away from a loss.
  const totalDaily = sum(f.daily.map((d) => d.pnl));
  if (f.daily.length >= 5 && totalDaily > 0) {
    const best = f.daily.reduce((b, d) => (d.pnl > b.pnl ? d : b), f.daily[0]);
    const bestShare = share(best.pnl, totalDaily);
    if (bestShare >= T.concentrationBadPct) {
      out.push({
        level: "bad",
        guide: "concentration",
        title: "Almost all the profit came on one day",
        detail: `${best.date} contributed ${pct(bestShare)} of net profit. Remove it and this period is roughly break-even, so the curve is measuring one outcome rather than a repeatable process.`,
        metric: pct(bestShare),
      });
    } else if (bestShare >= T.concentrationWarnPct) {
      out.push({
        level: "warn",
        guide: "concentration",
        title: "Profit is concentrated in a single day",
        detail: `${best.date} contributed ${pct(bestShare)} of net profit. Worth checking whether that day followed your rules or departed from them.`,
        metric: pct(bestShare),
      });
    }
  }

  const trend = halfTrend(f.daily.map((d) => d.pnl));
  if (trend && totalDaily > 0) {
    if (trend.changePct <= -T.trendDeteriorationPct) {
      out.push({
        level: "warn",
        guide: "trend",
        title: "The recent half is weaker than the first half",
        detail: `Average trading day fell from ${money(trend.first, 0)} to ${money(trend.second, 0)} (${trend.changePct.toFixed(0)}%). Something in the process drifted — size, timing, or the setups being taken.`,
        metric: `${trend.changePct.toFixed(0)}%`,
      });
    } else if (trend.changePct >= T.trendDeteriorationPct) {
      out.push({
        level: "good",
        guide: "trend",
        title: "Results are improving, not decaying",
        detail: `Average trading day rose from ${money(trend.first, 0)} to ${money(trend.second, 0)}. Whatever changed between the halves is worth writing down while it is still true.`,
        metric: `${trend.changePct.toFixed(0)}%`,
      });
    }
  }

  const bleeders = f.symbolData.filter((s) => s.pnl < 0 && s.count >= T.minSlice);
  if (bleeders.length > 0) {
    const list = bleeders.slice(0, 3).map((s) => `${s.symbol} (${money(s.pnl, 0)})`).join(", ");
    out.push({
      level: "bad",
      guide: "sliceEdge",
      title: `${bleeders.length} well-sampled market${bleeders.length !== 1 ? "s are" : " is"} costing money`,
      detail: `${list} each cleared ${T.minSlice}+ trades at a loss. That is a sample large enough to act on: pause ${bleeders.length !== 1 ? "them" : "it"} and re-test before adding size. Thin losing markets are excluded here on purpose.`,
      metric: money(sum(bleeders.map((s) => s.pnl)), 0),
    });
  }

  const symbols = rankBy(f.symbolData, (s) => s.pnl, (s) => s.count);
  const top = symbols.leader;
  if (top && top.pnl > 0) {
    if (top.count >= T.minSlice) {
      out.push({
        level: "good",
        guide: "sliceEdge",
        title: `${top.symbol} is where the edge lives`,
        detail: `${money(top.pnl)} over ${top.count} trades at a ${top.wr}% win rate. If sizing is uniform across markets, this is the first place a deliberate tilt would show up.`,
        metric: money(top.pnl, 0),
      });
    } else {
      const alt = symbols.bestTrusted && symbols.bestTrusted.symbol !== top.symbol
        ? ` The best market clearing ${T.minSlice} trades is ${symbols.bestTrusted.symbol} (${money(symbols.bestTrusted.pnl)} over ${symbols.bestTrusted.count}).`
        : "";
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${top.symbol} leads on P&L, but the sample is thin`,
        detail: `${money(top.pnl)} over ${top.count} trade${top.count !== 1 ? "s" : ""} at a ${top.wr}% win rate. Under the ${T.minSlice}-trade floor, so this is a lead to watch rather than a tilt to size.${alt}`,
        metric: money(top.pnl, 0),
      });
    }
  }


  return out;
}

// ─── Risk ───────────────────────────────────────────────────────────────

function riskInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];
  const ddPct = Math.abs(f.maxDdPct);

  if (ddPct >= T.maxDdBadPct) {
    out.push({
      level: "bad",
      guide: "drawdownPct",
      title: "Drawdown deep enough to breach a standard challenge",
      detail: `${money(f.maxDd)} (${pct(ddPct)}) from a peak, lasting ${f.longestDdDays} days at its worst. At this depth a normal losing run reaches the account limit, so risk per trade has to come down before anything else.`,
      metric: pct(ddPct),
    });
  } else if (ddPct >= T.maxDdWarnPct) {
    out.push({
      level: "warn",
      guide: "drawdownPct",
      title: "Drawdown is deeper than a normal correction",
      detail: `${pct(ddPct)} from peak over ${f.longestDdDays} days. Recovering this takes roughly ${(ddPct / 2).toFixed(1)}% of fresh return at your current pace — worth pricing before risking another ${pct(ddPct)}.`,
      metric: pct(ddPct),
    });
  } else if (ddPct > 0) {
    out.push({
      level: "good",
      guide: "drawdownPct",
      title: "Drawdown stays inside a survivable band",
      detail: `${pct(ddPct)} peak to trough. The account can absorb this and keep trading without a recovery-only regime.`,
      metric: pct(ddPct),
    });
  }

  if (f.currentDdDays >= T.currentDdBadDays) {
    out.push({
      level: "bad",
      guide: "drawdownDays",
      title: `${f.currentDdDays} days below the high-water mark`,
      detail: "Still under water this long after the peak means the recovery is not happening on the current edge. Halve size and re-check the setup before the next session.",
      metric: `${f.currentDdDays} days`,
    });
  } else if (f.currentDdDays >= T.currentDdWarnDays) {
    out.push({
      level: "warn",
      guide: "drawdownDays",
      title: "Drawdown is long-running",
      detail: `${f.currentDdDays} days under water. Long flat stretches usually mean the original reason for trading is gone — check whether these setups still qualify before taking more of them.`,
      metric: `${f.currentDdDays} days`,
    });
  }

  if (f.sharpe <= 0 && f.tradingDays >= 5) {
    out.push({
      level: "bad",
      guide: "sharpe",
      title: "Negative return per unit of volatility",
      detail: `Sharpe ${f.sharpe.toFixed(2)}. The book paid volatility without paying for it, which means the trade selection is not compensating for the swings it creates.`,
      metric: f.sharpe.toFixed(2),
    });
  } else if (f.sharpe < T.sharpeFloor && f.tradingDays >= 5) {
    out.push({
      level: "warn",
      guide: "sharpe",
      title: "Low risk-adjusted return",
      detail: `Sharpe ${f.sharpe.toFixed(2)} across ${f.tradingDays} days. Returns are small relative to the day-to-day swings, so this edge is hard to run at a useful size.`,
      metric: f.sharpe.toFixed(2),
    });
  } else if (f.sharpe >= T.sharpeStrong) {
    out.push({
      level: "good",
      guide: "sharpe",
      title: "Strong return for the volatility taken",
      detail: `Sharpe ${f.sharpe.toFixed(2)}. Return is well ahead of day-to-day noise, which is what lets a size increase survive contact with a bad week.`,
      metric: f.sharpe.toFixed(2),
    });
  }

  if (f.sortino > 0 && f.sharpe > 0 && f.sortino < f.sharpe * 0.75 && f.tradingDays >= 5) {
    out.push({
      level: "warn",
      guide: "sortino",
      title: "Losses are doing most of the damage",
      detail: `Sortino ${f.sortino.toFixed(2)} trails Sharpe ${f.sharpe.toFixed(2)} because the downside is disproportionate. Tightening exits on losers is worth more here than adding entries.`,
      metric: f.sortino.toFixed(2),
    });
  }

  if (f.calmar !== 0 && f.calmar < T.calmarFloor) {
    out.push({
      level: "warn",
      guide: "calmar",
      title: "Return is not compensating for the drawdown taken",
      detail: `Calmar ${f.calmar.toFixed(2)} — under 1 means the deepest decline was larger than the year's return. The path to the result is costing more than the result.`,
      metric: f.calmar.toFixed(2),
    });
  } else if (f.calmar >= 3 && f.calmar !== 0) {
    out.push({
      level: "good",
      guide: "calmar",
      title: "Drawdown is being paid for by the return",
      detail: `Calmar ${f.calmar.toFixed(2)}. The equity curve is efficient, so adding size here compounds faster than it does on a noisier book.`,
      metric: f.calmar.toFixed(2),
    });
  }

  if (f.riskCoverage > 0) {
    if (f.riskPctAvg >= T.riskBadPct) {
      out.push({
        level: "bad",
        guide: "riskPct",
        title: "Risk per trade is large enough to end the account on a streak",
        detail: `${pct(f.riskPctAvg, 2)} of balance per trade ($${f.avgRisk.toFixed(2)}). Six ordinary losers in a row would take roughly ${pct(f.riskPctAvg * 6, 0)} — a normal month, not a bad one.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    } else if (f.riskPctAvg > T.riskWarnPct) {
      out.push({
        level: "warn",
        guide: "riskPct",
        title: "Risk per trade is above the conservative band",
        detail: `${pct(f.riskPctAvg, 2)} per trade. Fine with a large edge, expensive without one — keep it while the payoff holds, cut it when it does not.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    } else if (f.riskPctAvg < T.riskLowPct) {
      out.push({
        level: "info",
        guide: "riskPct",
        title: "Position size may be smaller than the edge allows",
        detail: `${pct(f.riskPctAvg, 2)} per trade is cautious. With the payoff and win rate on this tab, half-Kelly would justify more — worth checking before assuming the account is done growing.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    } else {
      out.push({
        level: "good",
        guide: "riskPct",
        title: "Risk per trade sits in the survivable band",
        detail: `${pct(f.riskPctAvg, 2)} of balance per trade ($${f.avgRisk.toFixed(2)}). A normal losing run costs a fraction of the account.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    }

    if (f.riskConsistency < T.riskConsistencyFloor && f.riskConsistency > 0) {
      out.push({
        level: "warn",
        guide: "riskConsistency",
        title: "Position size changes from trade to trade",
        detail: `Risk consistency ${pct(f.riskConsistency, 0)}. When size is decided in the moment, drawdowns are usually a sizing outcome rather than a signal outcome.`,
        metric: `${pct(f.riskConsistency, 0)}`,
      });
    }

    if (f.stopBreaches > 0) {
      const shareOfRisked = share(f.stopBreaches, f.riskCoverage);
      out.push({
        level: "bad",
        guide: "stopBreaches",
        title: `${f.stopBreaches} loss${f.stopBreaches !== 1 ? "es" : ""} exceeded the planned risk`,
        detail: `${pct(shareOfRisked, 0)} of trades with a stop lost more than that stop. Either the stop was widened mid-trade or the exit slipped — both make the real risk per trade higher than the one recorded.`,
        metric: `${f.stopBreaches} trades`,
      });
    }
  } else {
    out.push({
      level: "info",
      guide: "dataCoverage",
      title: "Risk sizing is unmeasured",
      detail: `None of these trades carry a recorded stop, so risk per trade, risk consistency and stop breaches cannot be computed. Set a stop on every position in MetaTrader and re-export to get true R-multiples.`,
      metric: `${f.riskMissing} trade${f.riskMissing !== 1 ? "s" : ""}`,
    });
  }

  if (f.rolling.length >= 4) {
    const midpoint = Math.floor(f.rolling.length / 2);
    const early = sum(f.rolling.slice(0, midpoint).map((r) => r.wr)) / midpoint;
    const late  = sum(f.rolling.slice(midpoint).map((r) => r.wr)) / (f.rolling.length - midpoint);
    const delta = late - early;
    if (delta <= -8) {
      out.push({
        level: "warn",
        guide: "trend",
        title: "Rolling win rate is trending down",
        detail: `The 20-trade window fell from ${pct(early, 0)} to ${pct(late, 0)} across the book. Sliding win rate is an early warning before expectancy turns.`,
        metric: `${delta.toFixed(0)} pts`,
      });
    } else if (delta >= 8) {
      out.push({
        level: "good",
        guide: "trend",
        title: "Rolling win rate is trending up",
        detail: `The 20-trade window rose from ${pct(early, 0)} to ${pct(late, 0)}. The recent stretch is genuinely better, not just a favourable sample.`,
        metric: `${delta.toFixed(0)} pts`,
      });
    }
  }

  return out;
}

// ─── Time ───────────────────────────────────────────────────────────────

function timeInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];
  const sessions = rankBy(f.dowData, (d) => d.pnl, (d) => d.count);
  const enoughSessions = sessions.trustedCount >= 2;

  // The chart ranks every weekday, including the lightly traded ones. The
  // recommendation has to agree with it: report the true leader, and only
  // prescribe a day filter once that leader clears the sample floor.
  if (sessions.leader && sessions.leader.pnl > 0) {
    const top = sessions.leader;
    if (top.count >= T.minSlice && enoughSessions) {
      out.push({
        level: "good",
        guide: "sliceEdge",
        title: `${top.day} is your strongest session`,
        detail: `${money(top.pnl)} over ${top.count} trades at a ${top.wr}% win rate (${money(top.pnl / top.count)} per trade). If that gap is structural — a news window, a session rhythm — it is the cheapest filter available.`,
        metric: money(top.pnl, 0),
      });
    } else if (top.count >= T.minSlice) {
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${top.day} is the only well-sampled session`,
        detail: `${money(top.pnl)} over ${top.count} trades at a ${top.wr}% win rate (${money(top.pnl / top.count)} per trade). No other day clears ${T.minSlice} trades, so there is nothing to rank it against yet.`,
        metric: money(top.pnl, 0),
      });
    } else {
      const alt = sessions.bestTrusted && sessions.bestTrusted.day !== top.day
        ? ` The best day clearing ${T.minSlice} trades is ${sessions.bestTrusted.day} (${money(sessions.bestTrusted.pnl)} over ${sessions.bestTrusted.count}).`
        : "";
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${top.day} leads on P&L, but the sample is thin`,
        detail: `${money(top.pnl)} over ${top.count} trade${top.count !== 1 ? "s" : ""} at a ${top.wr}% win rate (${money(top.pnl / top.count)} per trade). Under the ${T.minSlice}-trade floor, so this is a lead to watch rather than a filter to apply.${alt}`,
        metric: money(top.pnl, 0),
      });
    }
  }

  if (sessions.laggard && sessions.laggard.pnl < 0) {
    const bad = sessions.laggard;
    if (bad.count >= T.minSlice && enoughSessions) {
      const ref = sessions.bestTrusted && sessions.bestTrusted.pnl > 0 ? sessions.bestTrusted : null;
      const flat = ref ? Math.abs(bad.pnl) < ref.pnl : true;
      const conclusion = ref
        ? flat
          ? "Standing aside on this day and trading the other four would leave the total roughly unchanged."
          : "Standing aside on this day would remove a real drag on the weekly result."
        : "Every well-sampled session is negative, so a day filter will not fix the book — the setups themselves are the problem.";
      out.push({
        level: ref && !flat ? "bad" : "warn",
        guide: "sliceEdge",
        title: ref && !flat
          ? `${bad.day} costs more than ${ref.day} pays`
          : `${bad.day} is the weakest session`,
        detail: `${money(bad.pnl)} across ${bad.count} trades at a ${bad.wr}% win rate (${money(bad.pnl / bad.count)} per trade). ${conclusion}`,
        metric: money(bad.pnl, 0),
      });
    } else {
      const alt = sessions.worstTrusted && sessions.worstTrusted.day !== bad.day
        ? ` The weakest day clearing ${T.minSlice} trades is ${sessions.worstTrusted.day} (${money(sessions.worstTrusted.pnl)}).`
        : "";
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${bad.day} looks like the weakest session, but the sample is thin`,
        detail: `${money(bad.pnl)} across ${bad.count} trade${bad.count !== 1 ? "s" : ""} at a ${bad.wr}% win rate (${money(bad.pnl / bad.count)} per trade). Under the ${T.minSlice}-trade floor, so this is a warning rather than a rule.${alt}`,
        metric: money(bad.pnl, 0),
      });
    }
  }

  const idle = f.dowData.filter((d) => d.count === 0);
  if (idle.length > 0 && sessions.trustedCount > 0) {
    out.push({
      level: "info",
      guide: "dayCoverage",
      title: `${idle.length} trading day${idle.length !== 1 ? "s" : ""} unused`,
      detail: `No trades on ${idle.map((d) => d.day).join(", ")}. Worth a deliberate test — a day that is currently untested is the cheapest untested variable left.`,
      metric: idle.map((d) => d.day).join(", "),
    });
  }

  const days = f.daily.filter((d) => d.pnl !== 0);
  if (days.length >= 5) {
    const green = days.filter((d) => d.pnl > 0);
    const red   = days.filter((d) => d.pnl < 0);
    const greenPct = share(green.length, days.length);

    const netUp = sum(days.map((d) => d.pnl)) > 0;
    if (greenPct < T.greenDayFloor && netUp) {
      out.push({
        level: "warn",
        guide: "greenDayShare",
        title: "Winning by a minority of days",
        detail: `Only ${pct(greenPct, 0)} of trading days were profitable, so the result rests on the size of the good days rather than on frequency. That is a fragile way to be up — one quiet week flips it.`,
        metric: pct(greenPct, 0),
      });
    } else if (greenPct >= T.greenDayStrong && netUp) {
      out.push({
        level: "good",
        guide: "greenDayShare",
        title: "Most trading days finish green",
        detail: `${pct(greenPct, 0)} of days profitable. Consistency of this kind is what makes a journal result repeatable rather than lucky.`,
        metric: pct(greenPct, 0),
      });
    }

    if (green.length > 0 && red.length > 0) {
      const avgWin  = sum(green.map((d) => d.pnl)) / green.length;
      const avgLoss = Math.abs(sum(red.map((d) => d.pnl)) / red.length);
      if (avgLoss > avgWin * 1.3) {
        out.push({
          level: "bad",
          guide: "daySkew",
          title: "Bad days are bigger than good days",
          detail: `Average losing day ${money(-avgLoss)} against an average winning day of ${money(avgWin)}. The losing tail needs no more losing days than the winning side needs winning days, so the account drifts down between bursts.`,
          metric: `${(avgLoss / avgWin).toFixed(2)}:1 days`,
        });
      }
    }
  }

  const tags = rankBy(f.tagData, (t) => t.pnl, (t) => t.count);
  if (f.tagData.length >= 2 && tags.leader && tags.laggard) {
    const top = tags.leader;
    const bottom = tags.laggard;
    if (top.pnl > 0) {
      if (top.count >= T.minSlice && tags.trustedCount >= 2) {
        out.push({
          level: "good",
          guide: "sliceEdge",
          title: `Setup "${top.tag}" is your best tag`,
          detail: `${money(top.pnl)} across ${top.count} trades at a ${top.wr}% win rate. Where tags are chosen before entry, weighting size toward this one is a free improvement.`,
          metric: `${top.wr}% WR`,
        });
      } else {
        const alt = tags.bestTrusted && tags.bestTrusted.tag !== top.tag
          ? ` The best tag clearing ${T.minSlice} trades is "${tags.bestTrusted.tag}" (${money(tags.bestTrusted.pnl)} over ${tags.bestTrusted.count}).`
          : "";
        out.push({
          level: "info",
          guide: "sampleSize",
          title: `Setup "${top.tag}" leads on P&L, but the sample is thin`,
          detail: `${money(top.pnl)} across ${top.count} trade${top.count !== 1 ? "s" : ""} at a ${top.wr}% win rate. Under the ${T.minSlice}-trade floor, so it is not a sizing signal yet.${alt}`,
          metric: money(top.pnl, 0),
        });
      }
    }
    if (bottom.pnl < 0 && bottom.tag !== top.tag) {
      if (bottom.count >= T.minSlice) {
        out.push({
          level: bottom.count >= T.minSlice * 2 ? "bad" : "warn",
          guide: "sliceEdge",
          title: `Setup "${bottom.tag}" is costing money`,
          detail: `${money(bottom.pnl)} across ${bottom.count} trades at a ${bottom.wr}% win rate. Dropping this tag entirely is the cheapest test available.`,
          metric: money(bottom.pnl, 0),
        });
      } else {
        out.push({
          level: "info",
          guide: "sampleSize",
          title: `Setup "${bottom.tag}" looks like the weakest tag, but the sample is thin`,
          detail: `${money(bottom.pnl)} across ${bottom.count} trade${bottom.count !== 1 ? "s" : ""} at a ${bottom.wr}% win rate. Under the ${T.minSlice}-trade floor, so do not drop it on this evidence alone.`,
          metric: money(bottom.pnl, 0),
        });
      }
    }
  }

  if (f.dowData.every((d) => d.count === 0)) {
    out.push({
      level: "info",
      guide: "sampleSize",
      title: "Not enough trading days to profile a weekly rhythm",
      detail: "Weekday performance needs at least five trades on a day before the split means anything.",
      metric: `${f.tradingDays} days`,
    });
  }

  return out;
}

// ─── Heatmap (hour of day) ──────────────────────────────────────────────

function heatmapInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];

  if (f.hourData.length === 0) {
    out.push({
      level: "info",
      guide: "dataCoverage",
      title: "No entry times recorded",
      detail: "Hour-of-day analysis needs entry times, which MetaTrader exports automatically. Re-run the exporter to unlock the best and worst trading windows.",
    });
    return out;
  }

  const totalTrades = sum(f.hourData.map((h) => h.count));
  const hours = rankBy(f.hourData, (h) => h.totalPnl, (h) => h.count, T.minHourSlice);
  const trusted = f.hourData.filter((h) => h.count >= T.minHourSlice);
  const enoughHours = hours.trustedCount >= 2;

  if (hours.leader && hours.leader.totalPnl > 0) {
    const best = hours.leader;
    const label = `${best.label}–${String(best.hour + 1).padStart(2, "0")}:00`;
    if (best.count >= T.minHourSlice && enoughHours) {
      out.push({
        level: "good",
        guide: "sliceEdge",
        title: `${label} is the window that pays`,
        detail: `${money(best.totalPnl)} over ${best.count} trades at a ${best.winRate}% win rate, ${money(best.avgPnl)} per trade. Restricting entries to this window is the highest-leverage change on this tab.`,
        metric: money(best.totalPnl, 0),
      });
    } else if (best.count >= T.minHourSlice) {
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${label} is the only well-sampled window`,
        detail: `${money(best.totalPnl)} over ${best.count} trades at a ${best.winRate}% win rate, ${money(best.avgPnl)} per trade. No other hour clears ${T.minHourSlice} trades, so there is nothing to rank it against yet.`,
        metric: money(best.totalPnl, 0),
      });
    } else {
      const alt = hours.bestTrusted && hours.bestTrusted.hour !== best.hour
        ? ` The best window clearing ${T.minHourSlice} trades is ${hours.bestTrusted.label} (${money(hours.bestTrusted.totalPnl)} over ${hours.bestTrusted.count} trades).`
        : "";
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${label} leads on P&L, but the sample is thin`,
        detail: `${money(best.totalPnl)} over ${best.count} trade${best.count !== 1 ? "s" : ""} at a ${best.winRate}% win rate, ${money(best.avgPnl)} per trade. Under the ${T.minHourSlice}-trade floor, so this is a window to watch rather than one to enforce.${alt}`,
        metric: money(best.totalPnl, 0),
      });
    }
  }

  if (hours.laggard && hours.laggard.totalPnl < 0) {
    const worst = hours.laggard;
    const label = `${worst.label}–${String(worst.hour + 1).padStart(2, "0")}:00`;
    if (worst.count >= T.minHourSlice && enoughHours) {
      const ref = hours.bestTrusted;
      const worse = ref ? Math.abs(worst.totalPnl) > Math.abs(ref.totalPnl) : false;
      out.push({
        level: worse ? "bad" : "warn",
        guide: "sliceEdge",
        title: `${label} is the window that bleeds`,
        detail: `${money(worst.totalPnl)} over ${worst.count} trades at a ${worst.winRate}% win rate, ${money(worst.avgPnl)} per trade. A standing rule to sit this hour out is measurable from here.`,
        metric: money(worst.totalPnl, 0),
      });
    } else if (worst.count >= T.minHourSlice) {
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${label} is the only well-sampled window, and it loses`,
        detail: `${money(worst.totalPnl)} over ${worst.count} trades at a ${worst.winRate}% win rate, ${money(worst.avgPnl)} per trade. It is the only hour clearing ${T.minHourSlice} trades, so treat it as a starting point rather than a proven rule.`,
        metric: money(worst.totalPnl, 0),
      });
    } else {
      out.push({
        level: "info",
        guide: "sampleSize",
        title: `${label} looks like the window that bleeds, but the sample is thin`,
        detail: `${money(worst.totalPnl)} over ${worst.count} trade${worst.count !== 1 ? "s" : ""} at a ${worst.winRate}% win rate, ${money(worst.avgPnl)} per trade. Under the ${T.minHourSlice}-trade floor, so treat it as a lead rather than a rule.`,
        metric: money(worst.totalPnl, 0),
      });
    }
  } else if (f.hourData.length >= 2 && hours.trustedCount === 0) {
    out.push({
      level: "info",
      guide: "sampleSize",
      title: "No hour has enough trades to trust",
      detail: `The busiest hour holds ${Math.max(...f.hourData.map((h) => h.count))} trades. Until one hour clears ${T.minHourSlice}, the ranking here is a guess — log times on more trades and the ordering will settle.`,
      metric: `${f.hourData.length} hours`,
    });
  }

  if (hours.trustedCount >= 2 && totalTrades > 0) {
    const busiest = f.hourData.reduce((b, h) => h.count > b.count ? h : b, f.hourData[0]);
    const best = hours.bestTrusted;
    if (best && busiest.hour !== best.hour && busiest.avgPnl < best.avgPnl) {
      const losing = busiest.totalPnl < 0;
      out.push({
        level: losing ? "warn" : "info",
        guide: "sliceEdge",
        title: losing
          ? "Most active in a window that loses money"
          : "Most active in a window that pays less",
        detail: `${busiest.label} holds ${pct(share(busiest.count, totalTrades), 0)} of all trades and returns ${money(busiest.totalPnl)} at ${money(busiest.avgPnl)} per trade, while ${best.label} returns ${money(best.totalPnl)} at ${money(best.avgPnl)}. Volume and edge are in different places.`,
        metric: `${pct(share(busiest.count, totalTrades), 0)} of trades`,
      });
    }
  }

  // Fat right tail: a low win rate in one window is fine if the winners are
  // large. Mean per trade is the honest read, win rate on its own is not.
  if (trusted.length >= 2) {
    const fatTail = trusted
      .filter((h) => h.winRate < 50 && h.avgPnl > 0)
      .sort((a, b) => b.avgPnl - a.avgPnl)[0];
    if (fatTail) {
      out.push({
        level: "info",
        guide: "payoff",
        title: `${fatTail.label} is a low-hit-rate, high-payoff window`,
        detail: `${fatTail.winRate}% win rate but ${money(fatTail.avgPnl)} per trade. Do not filter this hour out on win rate alone — it is behaving like a breakout window.`,
        metric: `${money(fatTail.avgPnl)}/trade`,
      });
    }
  }

  const winRateSpread = trusted.length >= 3
    ? Math.max(...trusted.map((h) => h.winRate)) - Math.min(...trusted.map((h) => h.winRate))
    : 0;
  if (winRateSpread >= 35) {
    out.push({
      level: "info",
      guide: "sessionSpread",
      title: `Win rates vary by ${winRateSpread.toFixed(0)} points across the day`,
        detail: "That spread is large enough that a time-of-day filter is worth more than most entry refinements. Write it into the playbook as a rule.",
      metric: `${winRateSpread.toFixed(0)} pts`,
    });
  }

  return out;
}

// ─── R-multiples ────────────────────────────────────────────────────────

function rMultiplesInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];
  const total = sum(f.rHistogram.map((b) => b.count));

  if (total === 0) {
    out.push({
      level: "info",
      guide: "dataCoverage",
      title: "No R-multiples to read",
      detail: "R needs at least one losing trade to define the unit. Either this period has no losers yet, or no stops were recorded.",
    });
    return out;
  }

  if (f.riskCoverage === 0) {
    out.push({
      level: "info",
      guide: "dataCoverage",
      title: "1R is an estimate, not your actual risk",
      detail: `Every multiple on this tab uses the average loss ($${f.rUnit.toFixed(2)}) as 1R. Set a stop on each position so the distribution is measured against the risk you actually accepted.`,
      metric: `$${f.rUnit.toFixed(2)}/R`,
    });
  }

  if (f.avgR < 0) {
    out.push({
      level: "bad",
      guide: "expectancyR",
      title: "The average trade loses money in R",
      detail: `${f.avgR.toFixed(2)}R per trade. In R terms the book is negative regardless of position size, so this has to be fixed at the setup level.`,
      metric: `${f.avgR.toFixed(2)}R`,
    });
  } else if (f.avgR >= T.rStrong) {
    out.push({
      level: "good",
      guide: "expectancyR",
      title: "Outcomes are genuinely skewed to the right",
      detail: `${f.avgR.toFixed(2)}R per trade. Winners are paying for the losers with room to spare, which is the shape that survives a long sample.`,
      metric: `${f.avgR.toFixed(2)}R`,
    });
  } else {
    out.push({
      level: "warn",
      guide: "expectancyR",
      title: "Average R is positive but thin",
      detail: `${f.avgR.toFixed(2)}R per trade. Small enough that one bad session erases a long stretch — the fix is cutting the losses below -1R, not adding trades.`,
      metric: `${f.avgR.toFixed(2)}R`,
    });
  }

  // "-2R" is the histogram bin for [-2R, -1R) — it is not beyond -2R, so it
  // must not be counted in the left tail. The bins below it are (-3R, -2R) and
  // ≤-3R, which is exactly the "worse than twice the planned risk" set.
  const tailBuckets = ["-3R", "≤-3R"];
  const tail = sum(f.rHistogram.filter((b) => tailBuckets.includes(b.bucket)).map((b) => b.count));
  const tailShare = share(tail, total);
  if (tailShare >= T.leftTailBad * 100) {
    out.push({
      level: "bad",
      guide: "leftTail",
      title: "A chunk of trades close far beyond -1R",
      detail: `${tail} of ${total} trades (${pct(tailShare, 0)}) finish worse than twice the planned risk. Stops are being widened or ignored on exactly the trades that most needed them.`,
      metric: pct(tailShare, 0),
    });
  } else if (tailShare === 0 && f.riskCoverage > 0) {
    out.push({
      level: "good",
      guide: "leftTail",
      title: "No trade exceeded -2R",
      detail: "Every loss respected its planned risk. That is the single cheapest form of risk control and it is holding.",
      metric: "0 trades",
    });
  }

  const positive = f.rHistogram.filter((b) => b.positive);
  const positiveTotal = sum(positive.map((b) => b.count));
  if (positiveTotal >= 5) {
    const early = positive.filter((b) => b.bucket === "+1R").reduce((s, b) => s + b.count, 0);
    const earlyShare = share(early, positiveTotal);
    if (earlyShare >= T.earlyExitWarn) {
      out.push({
        level: "warn",
        guide: "earlyExit",
        title: "Winners are being closed before they run",
        detail: `${pct(earlyShare, 0)} of R-winners finish at +1R and almost nothing reaches +2R. Cutting winners early is the most common way a positive win rate still loses money — check whether targets or patience is the constraint.`,
        metric: pct(earlyShare, 0),
      });
    }
  }

  const scratch = f.rHistogram.find((b) => b.bucket === "+0R")?.count ?? 0;
  const scratchShare = share(scratch, total);
  if (scratchShare >= T.scratchWarn * 100) {
    out.push({
      level: "info",
      guide: "scratchShare",
      title: `${pct(scratchShare, 0)} of trades end around 0R`,
      detail: "Scratches are noise in the distribution. If they share a feature — the same session, the same setup, the same hesitation — filtering them out is a free expectancy gain.",
      metric: pct(scratchShare, 0),
    });
  }

  const lossBucketCount = f.rHistogram.filter((b) => !b.positive).reduce((s, b) => s + b.count, 0);
  const winBucketCount = positiveTotal;
  if (lossBucketCount > 0 && winBucketCount > 0) {
    const winRateFromR = (winBucketCount / (winBucketCount + lossBucketCount)) * 100;
    out.push({
      level: "info",
      guide: "rWinShare",
      title: `${pct(winRateFromR, 0)} of trades close at +1R or better`,
      detail: `${winBucketCount} trades closed at +1R or better and ${lossBucketCount} did not. Compare against the break-even rate the payoff on this tab implies — a lower rate is fine when the payoff is high, and not fine when it is not.`,
      metric: pct(winRateFromR, 0),
    });
  }

  return out;
}

// ─── Execution ──────────────────────────────────────────────────────────

function executionInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];

  if (!f.hasMaeMfe) {
    out.push({
      level: "info",
      guide: "dataCoverage",
      title: "No excursion data recorded",
      detail: "MAE and MFE show how far price moved for and against each trade. Without them, entry and exit quality cannot be separated from luck.",
    });
    return out;
  }

  const coverage = share(f.maeFdCount, f.trades.length);
  if (coverage < T.maeFdCoverageFloorPct) {
    out.push({
      level: "warn",
      guide: "dataCoverage",
      title: `Only ${pct(coverage, 0)} of trades have MAE/MFE`,
      detail: `The findings below rest on ${f.maeFdCount} of ${f.trades.length} trades. They are the most valuable field you are not logging consistently.`,
      metric: pct(coverage, 0),
    });
  }

  if (f.entryEff < T.entryEffBad) {
    out.push({
      level: "bad",
      guide: "entryEff",
      title: "Entries are landing in the wrong half of the move",
      detail: `Entry efficiency ${pct(f.entryEff)} — price went ${money(-f.avgMae)} against you on average and only ${money(f.avgMfe)} your way before the entry resolved. Waiting for a pullback or using a limit at the level you actually wanted is the fix.`,
      metric: pct(f.entryEff),
    });
  } else if (f.entryEff >= T.entryEffStrong) {
    out.push({
      level: "good",
      guide: "entryEff",
      title: "Entries are close to optimal",
      detail: `${pct(f.entryEff)} efficiency means price favours you quickly after entry. Improving here has less headroom left than improving the exit.`,
      metric: pct(f.entryEff),
    });
  }

  if (f.exitEff < T.exitEffBad) {
    out.push({
      level: "bad",
      guide: "exitEff",
      title: "Winning trades are giving back most of the move",
      detail: `Only ${pct(f.exitEff)} of available profit is captured on winners — ${money(f.avgWin)} realised against ${money(f.avgMfe)} that was on the table. This is a direct, mechanical leak in the process.`,
      metric: pct(f.exitEff),
    });
  } else if (f.exitEff < T.exitEffWarn) {
    out.push({
      level: "warn",
      guide: "exitEff",
      title: "More than half of available profit is left behind",
      detail: `${pct(f.exitEff)} of MFE captured on winning trades, so ${pct(100 - f.exitEff)} of the move is being given back. Moving stops to breakeven and letting the planned target do the work usually recovers most of this.`,
      metric: pct(f.exitEff),
    });
  } else if (f.exitEff >= T.exitEffStrong) {
    out.push({
      level: "good",
      guide: "exitEff",
      title: "Exits capture most of the available move",
      detail: `${pct(f.exitEff)} of MFE realised on winners. Very little to reclaim here — effort is better spent on entries and position selection.`,
      metric: pct(f.exitEff),
    });
  }

  if (f.avgWin > 0 && f.avgMfe > 0 && f.avgMfe > f.avgWin * 1.5) {
    out.push({
      level: "warn",
      guide: "exitEff",
      title: "Average winner is well short of average MFE",
      detail: `${money(f.avgMfe)} available against ${money(f.avgWin)} taken. Price routinely goes 50% further than the exit allows — the constraint is the exit rule, not the setup.`,
      metric: `${((1 - f.avgWin / f.avgMfe) * 100).toFixed(0)}% left`,
    });
  }

  if (f.avgLoss > 0 && f.avgMae > 0) {
    const ratio = f.avgMae / f.avgLoss;
    if (ratio > 1.3) {
      out.push({
        level: "warn",
        guide: "stopPlacement",
        title: "Stops may be tighter than the setup deserves",
        detail: `Average MAE is ${money(f.avgMae)} against a ${money(f.avgLoss)} loss — price routinely goes ${ratio.toFixed(1)}x further against you than the loss you took. Stop placement is cutting trades before the thesis has played out.`,
        metric: `${ratio.toFixed(1)}x`,
      });
    } else if (ratio < 0.7) {
      out.push({
        level: "good",
        guide: "stopPlacement",
        title: "Losers are contained well before the stop",
        detail: `MAE averages ${money(f.avgMae)} against a ${money(f.avgLoss)} loss. Positions are being closed at a fraction of the risk planned, which keeps drawdowns shallow.`,
        metric: `${ratio.toFixed(2)}x`,
      });
    } else {
      out.push({
        level: "info",
        guide: "stopPlacement",
        title: "Stops sit close to where price actually reverses",
        detail: `MAE ${money(f.avgMae)} against a ${money(f.avgLoss)} average loss. Stops are roughly where the trade decides itself, so there is little to gain by widening or tightening them.`,
        metric: `${ratio.toFixed(2)}x`,
      });
    }
  }

  return out;
}

// ─── Behaviour ──────────────────────────────────────────────────────────

function behaviorInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];
  const flagged = new Set(f.overtradingDays.map((d) => d.date));

  if (f.overtradingDays.length > 0 && f.daily.length > 0) {
    const flaggedPnl  = sum(f.daily.filter((d) => flagged.has(d.date)).map((d) => d.pnl));
    const flaggedDays = f.daily.filter((d) => flagged.has(d.date)).length;
    const rest        = f.daily.filter((d) => !flagged.has(d.date));
    const restAvg    = rest.length > 0 ? sum(rest.map((d) => d.pnl)) / rest.length : 0;
    const flaggedAvg = flaggedDays > 0 ? flaggedPnl / flaggedDays : 0;

    // A flagged day only costs money if it averages below a normal day, and it
    // only reads as a loss if it is actually negative. Reporting a relative
    // gap as an absolute one is how a journal loses a trader's trust.
    const gapPct = restAvg !== 0 ? ((restAvg - flaggedAvg) / Math.abs(restAvg)) * 100 : 0;
    if (flaggedAvg < 0) {
      out.push({
        level: "bad",
        guide: "overtrading",
        title: "Your highest-volume days are your worst days",
        detail: `${flaggedDays} flagged session${flaggedDays !== 1 ? "s" : ""} returned ${money(flaggedPnl, 0)}, averaging ${money(flaggedAvg, 0)} per day against ${money(restAvg, 0)} on normal days. Volume is costing money, not making it.`,
        metric: `${money(flaggedAvg, 0)}/day`,
      });
    } else if (gapPct >= 15) {
      out.push({
        level: "warn",
        guide: "overtrading",
        title: "Flagged sessions earn less per day than normal ones",
        detail: `${f.overtradingDays.length} session${f.overtradingDays.length !== 1 ? "s" : ""} above your trade-count baseline averaged ${money(flaggedAvg, 0)} per day against ${money(restAvg, 0)} elsewhere — ${pct(gapPct, 0)} less for trading more.`,
        metric: `${pct(gapPct, 0)} less/day`,
      });
    } else {
      out.push({
        level: "info",
        guide: "overtrading",
        title: `${f.overtradingDays.length} session${f.overtradingDays.length !== 1 ? "s" : ""} broke your trade-count baseline`,
        detail: `They averaged ${money(flaggedAvg, 0)} per day against ${money(restAvg, 0)} on normal days, so the extra volume did not hurt this sample. The threshold still exists for a reason — it protects the sessions that follow a run of losses.`,
        metric: `${f.overtradingDays.length} day${f.overtradingDays.length !== 1 ? "s" : ""}`,
      });
    }
  } else if (f.tradingDays >= 5) {
    out.push({
      level: "good",
      guide: "overtrading",
      title: "Trade count is stable across sessions",
      detail: `No day exceeded your baseline by a significant margin over ${f.tradingDays} days. Volume is being controlled by a rule rather than by mood.`,
      metric: `${f.maxDayTrades} max`,
    });
  }

  if (f.revengeCount > 0) {
    const revengeShare = share(f.revengeCount, f.trades.length);
    const revengeAvg  = f.revengeCount > 0 ? f.revengePnl / f.revengeCount : 0;
    const otherCount  = f.trades.length - f.revengeCount;
    const otherAvg    = otherCount > 0 ? f.otherPnl / otherCount : 0;

    if (revengeAvg < otherAvg) {
      out.push({
        level: "bad",
        guide: "revengeShare",
        title: "Trades taken after a loss underperform every other trade",
        detail: `${f.revengeCount} re-entries (${pct(revengeShare, 0)} of the book) returned ${money(f.revengePnl, 0)}, averaging ${money(revengeAvg)} against ${money(otherAvg)} elsewhere. A mandatory break after a loss is the intervention with the clearest evidence behind it.`,
        metric: `${money(revengeAvg)}/trade`,
      });
    } else {
      out.push({
        level: "info",
        guide: "revengeShare",
        title: `${f.revengeCount} trades were taken after a same-day loss`,
        detail: `${pct(revengeShare, 0)} of the book. They returned ${money(revengeAvg)} per trade against ${money(otherAvg)} elsewhere, so the habit is not underperforming on this sample. Keep watching it rather than treating it as safe.`,
        metric: `${pct(revengeShare, 0)} of trades`,
      });
    }
  }

  if (f.disciplineScore < 60) {
    out.push({
      level: "bad",
      guide: "disciplineScore",
      title: "Process discipline is the binding constraint",
      detail: `Discipline ${f.disciplineScore}/100. At this score, no amount of new analysis helps — the signals exist and are not being followed. Fix the rules before the strategy.`,
      metric: `${f.disciplineScore}/100`,
    });
  } else if (f.disciplineScore >= 80) {
    out.push({
      level: "good",
      guide: "disciplineScore",
      title: "Process is holding under pressure",
      detail: `Discipline ${f.disciplineScore}/100. Position sizing, session length and loss reactions are all inside their limits, which is what lets the edge compound.`,
      metric: `${f.disciplineScore}/100`,
    });
  }

  if (f.ror) {
    const { kelly, maxSafeRisk, ror } = f.ror;
    if (kelly <= 0) {
      out.push({
        level: "bad",
        guide: "expectancyR",
        title: "No positive edge to size from",
        detail: `Kelly returns ${kelly.toFixed(1)}% — the current win rate and payoff do not support any position size. This is a strategy problem, and no risk percentage fixes it.`,
        metric: `${kelly.toFixed(1)}%`,
      });
    } else if (f.riskPct > kelly) {
      out.push({
        level: "bad",
        guide: "sizingVsKelly",
        title: `Sized above Kelly at ${f.riskPct}% per trade`,
        detail: `Your edge supports ${kelly.toFixed(1)}% (${maxSafeRisk.toFixed(1)}% at half-Kelly). At ${f.riskPct}% a normal losing sequence ends the account — that is the definition of over-leveraged, not a near miss.`,
        metric: `${f.riskPct}%`,
      });
    } else if (f.riskPct > maxSafeRisk) {
      out.push({
        level: "warn",
        guide: "sizingVsKelly",
        title: `Sized above half-Kelly at ${f.riskPct}% per trade`,
        detail: `Half-Kelly for this edge is ${maxSafeRisk.toFixed(1)}%. Full Kelly maximises long-run growth but assumes you keep trading the same edge through a bad stretch; most journals are better served below it.`,
        metric: `${f.riskPct}%`,
      });
    } else {
      out.push({
        level: "good",
        guide: "sizingVsKelly",
        title: "Position size sits below half-Kelly",
        detail: `${f.riskPct}% per trade against a half-Kelly ceiling of ${maxSafeRisk.toFixed(1)}%. Growth is slower than theoretical maximum and considerably more likely to survive contact with a losing month.`,
        metric: `${f.riskPct}%`,
      });
    }

    // With no edge the ruin number is 100% by construction, and that line has
    // already been said above. Without enough days it is noise.
    if (kelly > 0 && f.tradingDays >= 5) {
      if (ror >= T.ruinBad * 100) {
        out.push({
          level: "bad",
          guide: "ruinRisk",
          title: `Risk of ruin is ${ror >= 1 ? "certain" : pct(ror, 2)} at this size`,
          detail: "This is the probability of the account reaching zero under repeated bets of this size and edge. Drop the slider until the number falls under a few percent.",
          metric: ror >= 1 ? "100%" : pct(ror, 2),
        });
      } else if (ror >= T.ruinWarn * 100) {
        out.push({
          level: "warn",
          guide: "ruinRisk",
          title: `Risk of ruin is elevated at ${pct(ror, 2)}`,
          detail: "Not extreme, but high enough that one bad sequence matters. Half-Kelly is sized to keep this number small.",
          metric: pct(ror, 2),
        });
      }
    }
  }

  if (f.tradingDays < 5) {
    out.push({
      level: "info",
      guide: "sampleSize",
      title: "Fewer than five trading days — the ruin maths is unreliable",
      detail: `${f.tradingDays} days is not enough history to estimate an edge, and every ratio on this tab inherits that uncertainty.`,
      metric: `${f.tradingDays} days`,
    });
  }

  return out;
}

// ─── Process ────────────────────────────────────────────────────────────

function processInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];

  if (f.recFactor > 0 && f.recFactor < T.recoveryWarn) {
    out.push({
      level: "bad",
      guide: "recoveryFactor",
      title: "Net profit has not repaid the worst drawdown",
      detail: `Recovery factor ${f.recFactor.toFixed(2)} — the account is still carrying the deepest decline from its own history. Nothing here is worth scaling until that turns above 1.`,
      metric: f.recFactor.toFixed(2),
    });
  } else if (f.recFactor >= T.recoveryFloor) {
    out.push({
      level: "good",
      guide: "recoveryFactor",
      title: "Drawdowns are repaid many times over",
      detail: `Recovery factor ${f.recFactor.toFixed(2)}. The equity curve repays its worst decline repeatedly, which is the profile that supports a size increase.`,
      metric: f.recFactor.toFixed(2),
    });
  }

  const { costs } = f;
  if (costs.costPctOfGross >= T.costBadPct) {
    out.push({
      level: "bad",
      guide: "costPct",
      title: "Costs are consuming a tenth of everything won",
      detail: `$${costs.costs.toFixed(2)} of commission and fees against $${costs.grossProfit.toFixed(2)} gross profit ($${costs.costPerTrade.toFixed(2)} per trade). Every extra trade carries that friction whether it wins or loses, so reducing trade count is worth more than raising targets here.`,
      metric: pct(costs.costPctOfGross, 2),
    });
  } else if (costs.costPctOfGross >= T.costWarnPct) {
    out.push({
      level: "warn",
      guide: "costPct",
      title: "Costs are a meaningful slice of gross profit",
      detail: `${pct(costs.costPctOfGross, 2)} of gross profit ($${costs.costPerTrade.toFixed(2)} per trade). Trimming low-conviction trades improves the net result without touching the strategy.`,
      metric: pct(costs.costPctOfGross, 2),
    });
  } else if (costs.costPctOfGross > 0 && costs.costPctOfGross < T.costNoisePct) {
    out.push({
      level: "good",
      guide: "costPct",
      title: "Costs are noise against gross profit",
      detail: `${pct(costs.costPctOfGross, 2)} of gross profit ($${costs.costPerTrade.toFixed(2)} per trade). Execution cost is not constraining this edge — trade selection is the only lever worth pulling.`,
      metric: pct(costs.costPctOfGross, 2),
    });
  }

  // Hold time is usually the biggest single finding in a trading journal.
  const durations = rankBy(f.durationData, (d) => d.pnl, (d) => d.trades);
  if (durations.leader && durations.laggard && durations.tradedCount >= 2) {
    const best = durations.leader;
    const worst = durations.laggard;

    if (worst.pnl < 0) {
      if (worst.trades >= T.minSlice) {
        const bleeders = f.durationData.filter((d) => d.trades >= T.minSlice && d.pnl < 0);
        out.push({
          level: "bad",
          guide: "sliceEdge",
          title: `${worst.bucket} trades lose money`,
          detail: `${money(worst.pnl)} across ${worst.trades} trades at ${money(worst.avgPnl)} each. ${bleeders.length > 1 ? `${bleeders.length} well-sampled hold-time bands are negative, so it is the process rather than one band.` : "Raising the floor on this band is the highest-value rule on this tab."}`,
          metric: money(worst.pnl, 0),
        });
      } else {
        const alt = durations.worstTrusted && durations.worstTrusted.bucket !== worst.bucket
          ? ` The weakest band clearing ${T.minSlice} trades is ${durations.worstTrusted.bucket} (${money(durations.worstTrusted.pnl)}).`
          : "";
        out.push({
          level: "info",
          guide: "sampleSize",
          title: `${worst.bucket} looks like a losing band, but the sample is thin`,
          detail: `${money(worst.pnl)} across ${worst.trades} trade${worst.trades !== 1 ? "s" : ""} at ${money(worst.avgPnl)} each. Under the ${T.minSlice}-trade floor, so do not change the rule on this evidence alone.${alt}`,
          metric: money(worst.pnl, 0),
        });
      }
    }

    if (best.pnl > 0 && best.bucket !== worst.bucket) {
      if (best.trades >= T.minSlice) {
        out.push({
          level: "good",
          guide: "sliceEdge",
          title: `${best.bucket} is where holding pays`,
          detail: `${money(best.pnl)} over ${best.trades} trades at ${money(best.avgPnl)} each. If the losing band is deliberately a scalping window, that is a contradiction worth resolving on paper before the next session.`,
          metric: money(best.pnl, 0),
        });
      } else {
        const alt = durations.bestTrusted && durations.bestTrusted.bucket !== best.bucket
          ? ` The strongest band clearing ${T.minSlice} trades is ${durations.bestTrusted.bucket} (${money(durations.bestTrusted.pnl)}).`
          : "";
        out.push({
          level: "info",
          guide: "sampleSize",
          title: `${best.bucket} leads on P&L, but the sample is thin`,
          detail: `${money(best.pnl)} over ${best.trades} trade${best.trades !== 1 ? "s" : ""} at ${money(best.avgPnl)} each. Under the ${T.minSlice}-trade floor, so it is a lead rather than a rule.${alt}`,
          metric: money(best.pnl, 0),
        });
      }
    }
  } else if (f.durationData.every((d) => d.trades === 0)) {
    out.push({
      level: "info",
      guide: "dataCoverage",
      title: "No hold times recorded",
      detail: "Duration comes from MetaTrader's trade duration field. Without it the hold-time split on this tab stays empty.",
    });
  }

  // Re-entry speed after a loss is the classic revenge-trading signature.
  const fastAfterLoss = f.gapData.find((g) => g.bucket === "Under 15m")?.afterLoss;
  const fastAfterWin  = f.gapData.find((g) => g.bucket === "Under 15m")?.afterWin;
  if (fastAfterLoss && fastAfterLoss.trades >= 3) {
    const faster = fastAfterWin && fastAfterWin.trades >= 3;
    if (fastAfterLoss.avgPnl < 0 && (!faster || fastAfterLoss.avgPnl < fastAfterWin.avgPnl)) {
      out.push({
        level: "bad",
        guide: "reEntryGap",
        title: "Quick re-entries after a loss are the losing habit",
        detail: `Entering within 15 minutes of a loss returned ${money(fastAfterLoss.pnl, 0)} over ${fastAfterLoss.trades} trades (${money(fastAfterLoss.avgPnl)} each, ${fastAfterLoss.winRate}% win rate). A cooldown after a loss is the intervention this chart supports.`,
        metric: `${money(fastAfterLoss.avgPnl)}/trade`,
      });
    } else if (fastAfterLoss.avgPnl > 0) {
      out.push({
        level: "good",
        guide: "reEntryGap",
        title: "Fast re-entries hold up after a loss too",
        detail: `${money(fastAfterLoss.pnl, 0)} over ${fastAfterLoss.trades} trades at a ${fastAfterLoss.winRate}% win rate. The speed of the re-entry is not the problem on this sample.`,
        metric: money(fastAfterLoss.pnl, 0),
      });
    }
  }

  const sides = f.directionData.filter((d) => d.trades >= T.minSlice);
  if (sides.length === 2) {
    const good = sides.reduce((b, d) => (d.pnl > b.pnl ? d : b), sides[0]);
    const bad  = sides.reduce((w, d) => (d.pnl < w.pnl ? d : w), sides[0]);
    if (good.pnl > 0 && bad.pnl < 0) {
      out.push({
        level: "warn",
        guide: "sliceEdge",
        title: `The edge is one-directional — ${good.bucket} only`,
        detail: `${good.bucket} returned ${money(good.pnl)} over ${good.trades} trades while ${bad.bucket} returned ${money(bad.pnl)} over ${bad.trades}. Dropping the losing side would turn the combined ${money(good.pnl + bad.pnl)} into ${money(good.pnl)} on this sample, at the cost of fewer trades.`,
        metric: money(good.pnl, 0),
      });
    } else if (good.pnl > 0 && bad.pnl > 0) {
      out.push({
        level: "good",
        guide: "sliceEdge",
        title: "Both directions carry the edge",
        detail: `${good.bucket} ${money(good.pnl)} and ${bad.bucket} ${money(bad.pnl)}. No directional filter is needed, which means sizing can stay symmetrical.`,
        metric: money(good.pnl + bad.pnl, 0),
      });
    }
  }

  if (f.rRisk.sigma > 0) {
    const ruinPct = f.rRisk.ruinApprox * 100;
    if (ruinPct >= T.ruinBad * 100) {
      out.push({
        level: "bad",
        guide: "ruinRisk",
        title: "R dispersion makes survival a coin flip at this size",
        detail: `Outcomes scatter ${f.rRisk.sigma.toFixed(2)}R around a ${f.rRisk.meanR.toFixed(2)}R mean, giving a ruin probability of ${pct(ruinPct, 1)}. Dispersion, not the mean, is what ends accounts at fixed sizing — reduce risk per trade until this falls.`,
        metric: pct(ruinPct, 1),
      });
    } else if (ruinPct <= T.ruinWarn * 100 && f.rRisk.meanR > 0) {
      out.push({
        level: "good",
        guide: "ruinRisk",
        title: "Outcome dispersion is survivable",
        detail: `${f.rRisk.sigma.toFixed(2)}R spread around a ${f.rRisk.meanR.toFixed(2)}R mean keeps the ruin probability near ${pct(ruinPct, 1)}. This is a book that can be compounded rather than only monitored.`,
        metric: pct(ruinPct, 1),
      });
    }
  }

  if (f.stop.coverage > 0) {
    if (f.stop.winnerRatio >= 0.5) {
      out.push({
        level: "warn",
        guide: "winnerHeat",
        title: "Winners are taken before they work",
        detail: `Winning trades went ${f.stop.winnerRatio.toFixed(2)}R against before resolving — only ${f.stop.cleanWinners} of ${f.stop.wins} stayed under 0.5R. Entries are firing before the setup confirms; a confirmation candle or a tighter entry zone is the change to test.`,
        metric: `${f.stop.winnerRatio.toFixed(2)}R`,
      });
    } else {
      out.push({
        level: "good",
        guide: "winnerHeat",
        title: "Entries are well-timed against the stop",
        detail: `Winners average only ${f.stop.winnerRatio.toFixed(2)}R of adverse movement, with ${f.stop.cleanWinners} of ${f.stop.wins} staying under 0.5R. There is real headroom before the stop is tested.`,
        metric: `${f.stop.winnerRatio.toFixed(2)}R`,
      });
    }

    const stopShare = share(f.stop.losersTouchingStop, f.stop.losses);
    if (f.stop.losses >= 5 && stopShare < 0.5) {
      out.push({
        level: "warn",
        guide: "manualExitShare",
        title: "Losers are usually closed by hand, not by the stop",
        detail: `Only ${f.stop.losersTouchingStop} of ${f.stop.losses} losses (${pct(stopShare, 0)}) used 90%+ of planned risk. A discretionary exit that arrives early is cutting trades before the thesis resolves — and it is invisible in the R-multiples unless you keep logging risk.`,
        metric: pct(stopShare, 0),
      });
    }
  }

  if (f.exitReasons.length > 0) {
    const byName = (name: string) => f.exitReasons.find((r) => r.bucket === name);
    const manual = byName("Closed by hand");
    const stopped = byName("Stopped out");
    const targeted = byName("Target hit");

    if (manual && manual.trades >= 5 && manual.winRate < 40) {
      out.push({
        level: "bad",
        guide: "manualExitShare",
        title: "Manual closes cluster on losers",
        detail: `${manual.trades} trades were closed by hand at a ${manual.winRate}% win rate, returning ${money(manual.pnl, 0)}. When the hand closes more often than the stop does, the exit plan is being written after the fact.`,
        metric: `${manual.winRate}% WR`,
      });
    }

    if (targeted && manual && targeted.trades >= 5 && targeted.winRate >= 60 && manual.winRate < targeted.winRate - 20) {
      out.push({
        level: "good",
        guide: "manualExitShare",
        title: "Targets do the work, hands do the damage",
        detail: `Trades that hit the target won at ${targeted.winRate}%, against ${manual.winRate}% for hand-closed trades. The plan is sound; the temptation to close early is what costs.`,
        metric: `${targeted.winRate}% vs ${manual.winRate}%`,
      });
    }

    if (stopped && stopped.trades >= 5 && stopped.pnl < 0) {
      out.push({
        level: "info",
        guide: "sliceEdge",
        title: `${stopped.trades} trades reached their stop`,
        detail: `${money(stopped.pnl, 0)} at a ${stopped.winRate}% win rate. This is the cost of risk actually being respected, and the baseline every discretionary exit should be measured against.`,
        metric: money(stopped.pnl, 0),
      });
    }
  }

  if (f.legData.coverage > 0) {
    if (f.legData.averagedDown.trades > 0 && f.legData.averagedDownPnl < 0) {
      out.push({
        level: "bad",
        guide: "averagingDown",
        title: "Adding to a loser costs money",
        detail: `${f.legData.averagedDown.trades} position${f.legData.averagedDown.trades !== 1 ? "s were" : " was"} added to at a worse price than the first fill, for ${money(f.legData.averagedDownPnl, 0)} net. Scaling in widens risk exactly when the market is confirming the mistake.`,
        metric: money(f.legData.averagedDownPnl, 0),
      });
    } else if (f.legData.multiLeg.trades >= 5 && f.legData.multiLeg.pnl < f.legData.singleLeg.pnl) {
      out.push({
        level: "warn",
        guide: "legs",
        title: "Built positions do worse than single entries",
        detail: `Multiple entries returned ${money(f.legData.multiLeg.pnl, 0)} against ${money(f.legData.singleLeg.pnl, 0)} for single entries across the same sample. Sizing the full plan at entry keeps the risk identical and removes the mid-flight decision.`,
        metric: money(f.legData.multiLegPnl, 0),
      });
    } else if (f.legData.averagedDown.trades === 0) {
      out.push({
        level: "good",
        guide: "legs",
        title: "Every position was a single clean entry",
        detail: `${f.legData.avgLegs.toFixed(2)} entries per position on average, with no averaging into losers. Risk stayed where it was set, which is what makes the R-multiples on this tab trustworthy.`,
        metric: `${f.legData.avgLegs.toFixed(2)} legs`,
      });
    }
  }

  if (f.magicData.length > 1) {
    const best = f.magicData.reduce((b, d) => (d.pnl > b.pnl ? d : b), f.magicData[0]);
    const worst = f.magicData.reduce((w, d) => (d.pnl < w.pnl ? d : w), f.magicData[0]);
    if (best.trades >= 5 && worst.trades >= 5 && worst.pnl < 0) {
      out.push({
        level: "warn",
        guide: "sliceEdge",
        title: `${best.bucket} and ${worst.bucket} are not the same strategy`,
        detail: `${best.bucket} returned ${money(best.pnl, 0)} over ${best.trades} trades; ${worst.bucket} returned ${money(worst.pnl, 0)} over ${worst.trades}. Whatever drives one and not the other is the thing worth understanding.`,
        metric: money(best.pnl, 0),
      });
    }
  }

  if (f.cashFlow.coverage >= 2 && f.cashFlow.netFlow > 0) {
    const flowShare = f.totalPnl > 0 ? share(f.cashFlow.netFlow, f.totalPnl) : null;
    if (flowShare == null) {
      out.push({
        level: "bad",
        guide: "depositShare",
        title: "Deposits are carrying the equity curve",
        detail: `$${f.cashFlow.deposits.toFixed(2)} went in and $${Math.abs(f.cashFlow.withdrawals).toFixed(2)} came out, a net ${money(f.cashFlow.netFlow)}. Trading itself produced ${money(f.totalPnl)}, so the balance is rising on external cash rather than performance — read every ratio on this tab without it.`,
        metric: money(f.cashFlow.netFlow, 0),
      });
    } else if (flowShare >= 20) {
      out.push({
        level: "bad",
        guide: "depositShare",
        title: "Deposits are inflating the equity curve",
        detail: `$${f.cashFlow.deposits.toFixed(2)} went in and $${Math.abs(f.cashFlow.withdrawals).toFixed(2)} came out, a net ${money(f.cashFlow.netFlow)}. That is ${pct(flowShare, 0)} of net profit — read every ratio on this tab as trading performance without it.`,
        metric: money(f.cashFlow.netFlow, 0),
      });
    } else {
      out.push({
        level: "good",
        guide: "depositShare",
        title: "External cash is a small part of the curve",
        detail: `Net deposits of ${money(f.cashFlow.netFlow)} are under 20% of net profit across ${f.cashFlow.coverage} recorded closes. The rest is trade-generated, so the ratios on this tab still describe the strategy.`,
        metric: money(f.cashFlow.netFlow, 0),
      });
    }
  }

  return out;
}

// ─── Entry point ────────────────────────────────────────────────────────

export function buildInsights(f: AnalyticsFacts): Record<SectionId, Insight[]> {
  const sections: Record<SectionId, Insight[]> = {
    overview: ranked(overviewInsights(f)),
    risk: ranked(riskInsights(f)),
    time: ranked(timeInsights(f)),
    heatmap: ranked(heatmapInsights(f)),
    rmultiples: ranked(rMultiplesInsights(f)),
    execution: ranked(executionInsights(f)),
    behavior: ranked(behaviorInsights(f)),
    process: ranked(processInsights(f)),
  };

  // Under the sample floor every section leads with the caveat rather than
  // burying it: on a small book the numbers are real but the conclusions are
  // not, and that has to be the first thing read.
  if (f.trades.length >= T.minSampleTrades) return sections;

  const caveat: Insight = {
    level: "info",
    guide: "sampleSize",
    title: "Small sample — read the rest as provisional",
    detail: `${f.trades.length} trades. One outlier swings win rate, payoff and expectancy, so change a single variable at a time instead of reacting to one period.`,
    metric: `${f.trades.length} trade${f.trades.length !== 1 ? "s" : ""}`,
  };
  const withCaveat = {} as Record<SectionId, Insight[]>;
  for (const key of Object.keys(sections) as SectionId[]) {
    withCaveat[key] = [caveat, ...sections[key].filter((i) => i.title !== caveat.title)];
  }
  return withCaveat;
}