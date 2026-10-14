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

// ─── Overview ───────────────────────────────────────────────────────────

function overviewInsights(f: AnalyticsFacts): Insight[] {
  const out: Insight[] = [];
  const tradeCount = f.trades.length;

  if (f.expectancy < 0) {
    out.push({
      level: "bad",
      title: "Every trade at this size loses money",
      detail: `Expectancy is ${money(f.expectancy)} per trade, so volume is the problem, not signal. Cutting size until this turns positive preserves the account; trading it harder compounds the loss.`,
      metric: `${money(f.expectancy)}/trade`,
    });
  } else if (f.expectancy > 0) {
    out.push({
      level: "good",
      title: "The edge is real in cash terms",
      detail: `${money(f.expectancy)} per trade across ${tradeCount} trades. This is the figure to scale, not the win rate — it already has both sides of the ledger in it.`,
      metric: `${money(f.expectancy)}/trade`,
    });
  }

  if (f.profitFactor < T.pfFloor) {
    out.push({
      level: "bad",
      title: "Gross wins do not cover gross losses",
      detail: `Profit factor ${f.profitFactor.toFixed(2)}. Costs aside, the book returns less than it puts at risk, so no amount of position sizing turns it positive — the exits or the entry criteria have to change.`,
      metric: f.profitFactor.toFixed(2),
    });
  } else if (f.profitFactor > T.pfStrong) {
    out.push({
      level: "good",
      title: "Winners outweigh losers by a wide margin",
      detail: `Profit factor ${f.profitFactor.toFixed(2)}. With this much room, the priority is protecting it — a drawdown rule matters more than finding new setups.`,
      metric: f.profitFactor.toFixed(2),
    });
  } else if (f.profitFactor < T.pfThin) {
    out.push({
      level: "warn",
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
        title: "Winning less often than the payoff demands",
        detail: `${pct(f.winRate)} win rate against a ${pct(breakEven)} break-even at ${payoff.toFixed(2)}:1. You are right more often and still losing, so the fix is targets and stops, not entry timing.`,
        metric: `${pct(f.winRate)} vs ${pct(breakEven)}`,
      });
    } else if (margin < T.edgeMarginThinPct) {
      out.push({
        level: "warn",
        title: "The win-rate margin is thin",
        detail: `Only ${margin.toFixed(1)} points above the ${pct(breakEven)} break-even rate. A normal losing streak crosses it, so hold size down until the margin widens.`,
        metric: `+${margin.toFixed(1)} pts`,
      });
    } else if (margin >= T.edgeMarginStrongPct) {
      out.push({
        level: "good",
        title: "Clear margin over the break-even rate",
        detail: `${pct(f.winRate)} against ${pct(breakEven)} break-even, with a ${payoff.toFixed(2)}:1 payoff. That margin survives an ordinary losing run.`,
        metric: `+${margin.toFixed(1)} pts`,
      });
    }

    if (payoff < T.payoffThin) {
      out.push({
        level: "warn",
        title: "Losers are as big as winners",
        detail: `${payoff.toFixed(2)}:1 means the win rate has to carry the whole account. Letting winners run toward the target is usually worth more than an extra entry.`,
        metric: `${payoff.toFixed(2)}:1`,
      });
    } else if (payoff >= T.payoffStrong) {
      out.push({
        level: "good",
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
        title: "Almost all the profit came on one day",
        detail: `${best.date} contributed ${pct(bestShare)} of net profit. Remove it and this period is roughly break-even, so the curve is measuring one outcome rather than a repeatable process.`,
        metric: pct(bestShare),
      });
    } else if (bestShare >= T.concentrationWarnPct) {
      out.push({
        level: "warn",
        title: "Profit is concentrated in a single session",
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
        title: "The recent half is weaker than the first half",
        detail: `Average trading day fell from ${money(trend.first, 0)} to ${money(trend.second, 0)} (${trend.changePct.toFixed(0)}%). Something in the process drifted — size, timing, or the setups being taken.`,
        metric: `${trend.changePct.toFixed(0)}%`,
      });
    } else if (trend.changePct >= T.trendDeteriorationPct) {
      out.push({
        level: "good",
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
      title: `${bleeders.length} market${bleeders.length !== 1 ? "s are" : " is"} costing money`,
      detail: `${list} each cleared ${T.minSlice}+ trades at a loss. That is a sample large enough to act on: pause ${bleeders.length !== 1 ? "them" : "it"} and re-test before adding size.`,
      metric: money(sum(bleeders.map((s) => s.pnl)), 0),
    });
  }

  const earners = f.symbolData.filter((s) => s.pnl > 0 && s.count >= T.minSlice);
  if (earners.length > 0) {
    const top = earners[0];
    out.push({
      level: "good",
      title: `${top.symbol} is where the edge lives`,
      detail: `${money(top.pnl)} over ${top.count} trades at a ${top.wr}% win rate. If sizing is uniform across markets, this is the first place a deliberate tilt would show up.`,
      metric: money(top.pnl, 0),
    });
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
      title: "Drawdown deep enough to breach a standard challenge",
      detail: `${money(f.maxDd)} (${pct(ddPct)}) from a peak, lasting ${f.longestDdDays} days at its worst. At this depth a normal losing run reaches the account limit, so risk per trade has to come down before anything else.`,
      metric: pct(ddPct),
    });
  } else if (ddPct >= T.maxDdWarnPct) {
    out.push({
      level: "warn",
      title: "Drawdown is deeper than a normal correction",
      detail: `${pct(ddPct)} from peak over ${f.longestDdDays} days. Recovering this takes roughly ${(ddPct / 2).toFixed(1)}% of fresh return at your current pace — worth pricing before risking another ${pct(ddPct)}.`,
      metric: pct(ddPct),
    });
  } else if (ddPct > 0) {
    out.push({
      level: "good",
      title: "Drawdown stays inside a survivable band",
      detail: `${pct(ddPct)} peak to trough. The account can absorb this and keep trading without a recovery-only regime.`,
      metric: pct(ddPct),
    });
  }

  if (f.currentDdDays >= T.currentDdBadDays) {
    out.push({
      level: "bad",
      title: `${f.currentDdDays} days below the high-water mark`,
      detail: "Still under water this long after the peak means the recovery is not happening on the current edge. Halve size and re-check the setup before the next session.",
      metric: `${f.currentDdDays} days`,
    });
  } else if (f.currentDdDays >= T.currentDdWarnDays) {
    out.push({
      level: "warn",
      title: "Drawdown is long-running",
      detail: `${f.currentDdDays} days under water. Long flat stretches usually mean the original reason for trading is gone — check whether these setups still qualify before taking more of them.`,
      metric: `${f.currentDdDays} days`,
    });
  }

  if (f.sharpe <= 0 && f.tradingDays >= 5) {
    out.push({
      level: "bad",
      title: "Negative return per unit of volatility",
      detail: `Sharpe ${f.sharpe.toFixed(2)}. The book paid volatility without paying for it, which means the trade selection is not compensating for the swings it creates.`,
      metric: f.sharpe.toFixed(2),
    });
  } else if (f.sharpe < T.sharpeFloor && f.tradingDays >= 5) {
    out.push({
      level: "warn",
      title: "Low risk-adjusted return",
      detail: `Sharpe ${f.sharpe.toFixed(2)} across ${f.tradingDays} days. Returns are small relative to the day-to-day swings, so this edge is hard to run at a useful size.`,
      metric: f.sharpe.toFixed(2),
    });
  } else if (f.sharpe >= T.sharpeStrong) {
    out.push({
      level: "good",
      title: "Strong return for the volatility taken",
      detail: `Sharpe ${f.sharpe.toFixed(2)}. Return is well ahead of day-to-day noise, which is what lets a size increase survive contact with a bad week.`,
      metric: f.sharpe.toFixed(2),
    });
  }

  if (f.sortino > 0 && f.sharpe > 0 && f.sortino < f.sharpe * 0.75 && f.tradingDays >= 5) {
    out.push({
      level: "warn",
      title: "Losses are doing most of the damage",
      detail: `Sortino ${f.sortino.toFixed(2)} trails Sharpe ${f.sharpe.toFixed(2)} because the downside is disproportionate. Tightening exits on losers is worth more here than adding entries.`,
      metric: f.sortino.toFixed(2),
    });
  }

  if (f.calmar !== 0 && f.calmar < T.calmarFloor) {
    out.push({
      level: "warn",
      title: "Return is not compensating for the drawdown taken",
      detail: `Calmar ${f.calmar.toFixed(2)} — under 1 means the deepest decline was larger than the year's return. The path to the result is costing more than the result.`,
      metric: f.calmar.toFixed(2),
    });
  } else if (f.calmar >= 3 && f.calmar !== 0) {
    out.push({
      level: "good",
      title: "Drawdown is being paid for by the return",
      detail: `Calmar ${f.calmar.toFixed(2)}. The equity curve is efficient, so adding size here compounds faster than it does on a noisier book.`,
      metric: f.calmar.toFixed(2),
    });
  }

  if (f.riskCoverage > 0) {
    if (f.riskPctAvg >= T.riskBadPct) {
      out.push({
        level: "bad",
        title: "Risk per trade is large enough to end the account on a streak",
        detail: `${pct(f.riskPctAvg, 2)} of balance per trade ($${f.avgRisk.toFixed(2)}). Six ordinary losers in a row would take roughly ${pct(f.riskPctAvg * 6, 0)} — a normal month, not a bad one.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    } else if (f.riskPctAvg > T.riskWarnPct) {
      out.push({
        level: "warn",
        title: "Risk per trade is above the conservative band",
        detail: `${pct(f.riskPctAvg, 2)} per trade. Fine with a large edge, expensive without one — keep it while the payoff holds, cut it when it does not.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    } else if (f.riskPctAvg < T.riskLowPct) {
      out.push({
        level: "info",
        title: "Position size may be smaller than the edge allows",
        detail: `${pct(f.riskPctAvg, 2)} per trade is cautious. With the payoff and win rate on this tab, half-Kelly would justify more — worth checking before assuming the account is done growing.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    } else {
      out.push({
        level: "good",
        title: "Risk per trade sits in the survivable band",
        detail: `${pct(f.riskPctAvg, 2)} of balance per trade ($${f.avgRisk.toFixed(2)}). A normal losing run costs a fraction of the account.`,
        metric: `${pct(f.riskPctAvg, 2)}`,
      });
    }

    if (f.riskConsistency < T.riskConsistencyFloor && f.riskConsistency > 0) {
      out.push({
        level: "warn",
        title: "Position size changes from trade to trade",
        detail: `Risk consistency ${pct(f.riskConsistency, 0)}. When size is decided in the moment, drawdowns are usually a sizing outcome rather than a signal outcome.`,
        metric: `${pct(f.riskConsistency, 0)}`,
      });
    }

    if (f.stopBreaches > 0) {
      const shareOfRisked = share(f.stopBreaches, f.riskCoverage);
      out.push({
        level: "bad",
        title: `${f.stopBreaches} loss${f.stopBreaches !== 1 ? "es" : ""} exceeded the planned risk`,
        detail: `${pct(shareOfRisked, 0)} of trades with a stop lost more than that stop. Either the stop was widened mid-trade or the exit slipped — both make the real risk per trade higher than the one recorded.`,
        metric: `${f.stopBreaches} trades`,
      });
    }
  } else {
    out.push({
      level: "info",
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
        title: "Rolling win rate is trending down",
        detail: `The 20-trade window fell from ${pct(early, 0)} to ${pct(late, 0)} across the book. Sliding win rate is an early warning before expectancy turns.`,
        metric: `${delta.toFixed(0)} pts`,
      });
    } else if (delta >= 8) {
      out.push({
        level: "good",
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
  const trusted = f.dowData.filter((d) => d.count >= T.minSlice);

  if (trusted.length >= 2) {
    const best  = trusted.reduce((b, d) => (d.pnl > b.pnl ? d : b), trusted[0]);
    const worst = trusted.reduce((w, d) => (d.pnl < w.pnl ? d : w), trusted[0]);

    if (best.pnl > 0) {
      out.push({
        level: "good",
        title: `${best.day} is your strongest session`,
        detail: `${money(best.pnl)} over ${best.count} trades at a ${best.wr}% win rate. If that gap is structural — a news window, a session rhythm — it is the cheapest filter available.`,
        metric: money(best.pnl, 0),
      });
    }

    if (worst.pnl < 0) {
      const flat = Math.abs(worst.pnl) < best.pnl;
      out.push({
        level: flat ? "warn" : "bad",
        title: flat
          ? `${worst.day} is the weakest session`
          : `${worst.day} costs more than ${best.day} pays`,
        detail: `${money(worst.pnl)} across ${worst.count} trades at a ${worst.wr}% win rate. Standing aside on this day${flat ? " and trading the other four would leave the total roughly unchanged" : " would remove a real drag on the weekly result"}.`,
        metric: money(worst.pnl, 0),
      });
    }
  }

  const idle = f.dowData.filter((d) => d.count === 0);
  if (idle.length > 0 && trusted.length > 0) {
    out.push({
      level: "info",
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
        title: "Winning by a minority of days",
        detail: `Only ${pct(greenPct, 0)} of trading days were profitable, so the result rests on the size of the good days rather than on frequency. That is a fragile way to be up — one quiet week flips it.`,
        metric: pct(greenPct, 0),
      });
    } else if (greenPct >= T.greenDayStrong && netUp) {
      out.push({
        level: "good",
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
          title: "Bad days are bigger than good days",
          detail: `Average losing day ${money(-avgLoss)} against an average winning day of ${money(avgWin)}. The losing tail needs no more losing days than the winning side needs winning days, so the account drifts down between bursts.`,
          metric: `${(avgLoss / avgWin).toFixed(2)}:1 days`,
        });
      }
    }
  }

  const tags = f.tagData.filter((t) => t.count >= T.minSlice);
  if (tags.length >= 2) {
    const top = tags[0];
    const bottom = tags[tags.length - 1];
    if (top.pnl > 0) {
      out.push({
        level: "good",
        title: `Setup "${top.tag}" is your best tag`,
        detail: `${money(top.pnl)} across ${top.count} trades at a ${top.wr}% win rate. Where tags are chosen before entry, weighting size toward this one is a free improvement.`,
        metric: `${top.wr}% WR`,
      });
    }
    if (bottom.pnl < 0) {
      out.push({
        level: bottom.count >= T.minSlice * 2 ? "bad" : "warn",
        title: `Setup "${bottom.tag}" is costing money`,
        detail: `${money(bottom.pnl)} across ${bottom.count} trades at a ${bottom.wr}% win rate. Dropping this tag entirely is the cheapest test available.`,
        metric: money(bottom.pnl, 0),
      });
    }
  }

  if (f.dowData.every((d) => d.count === 0)) {
    out.push({
      level: "info",
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
      title: "No entry times recorded",
      detail: "Hour-of-day analysis needs entry times, which MetaTrader exports automatically. Re-run the exporter to unlock the best and worst trading windows.",
    });
    return out;
  }

  const totalTrades = sum(f.hourData.map((h) => h.count));
  const trusted = f.hourData.filter((h) => h.count >= T.minHourSlice);

  if (trusted.length >= 2) {
    const best  = trusted.reduce((b, h) => h.totalPnl > b.totalPnl ? h : b, trusted[0]);
    const worst = trusted.reduce((w, h) => h.totalPnl < w.totalPnl ? h : w, trusted[0]);

    if (best.totalPnl > 0) {
      out.push({
        level: "good",
        title: `${best.label}–${String(best.hour + 1).padStart(2, "0")}:00 is the window that pays`,
        detail: `${money(best.totalPnl)} over ${best.count} trades at a ${best.winRate}% win rate, ${money(best.avgPnl)} per trade. Restricting entries to this window is the highest-leverage change on this tab.`,
        metric: money(best.totalPnl, 0),
      });
    }

    if (worst.totalPnl < 0) {
      out.push({
        level: worst.totalPnl < Math.abs(best.totalPnl) ? "bad" : "warn",
        title: `${worst.label}–${String(worst.hour + 1).padStart(2, "0")}:00 is the window that bleeds`,
        detail: `${money(worst.totalPnl)} over ${worst.count} trades at a ${worst.winRate}% win rate, ${money(worst.avgPnl)} per trade. A standing rule to sit this hour out is measurable from here.`,
        metric: money(worst.totalPnl, 0),
      });
    }
  } else if (f.hourData.length >= 2) {
    out.push({
      level: "info",
      title: "No hour has enough trades to trust",
      detail: `The busiest hour holds ${Math.max(...f.hourData.map((h) => h.count))} trades. Until one hour clears ${T.minHourSlice}, the ranking here is a guess — log times on more trades and the ordering will settle.`,
      metric: `${f.hourData.length} hours`,
    });
  }

  if (trusted.length >= 2 && totalTrades > 0) {
    const busiest = f.hourData.reduce((b, h) => h.count > b.count ? h : b, f.hourData[0]);
    const best = trusted.reduce((b, h) => h.totalPnl > b.totalPnl ? h : b, trusted[0]);
    if (busiest.hour !== best.hour && busiest.totalPnl < best.totalPnl) {
      out.push({
        level: "warn",
        title: "Most active in a window that does not pay",
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
      title: "No R-multiples to read",
      detail: "R needs at least one losing trade to define the unit. Either this period has no losers yet, or no stops were recorded.",
    });
    return out;
  }

  if (f.riskCoverage === 0) {
    out.push({
      level: "info",
      title: "1R is an estimate, not your actual risk",
      detail: `Every multiple on this tab uses the average loss ($${f.rUnit.toFixed(2)}) as 1R. Set a stop on each position so the distribution is measured against the risk you actually accepted.`,
      metric: `$${f.rUnit.toFixed(2)}/R`,
    });
  }

  if (f.avgR < 0) {
    out.push({
      level: "bad",
      title: "The average trade loses money in R",
      detail: `${f.avgR.toFixed(2)}R per trade. In R terms the book is negative regardless of position size, so this has to be fixed at the setup level.`,
      metric: `${f.avgR.toFixed(2)}R`,
    });
  } else if (f.avgR >= T.rStrong) {
    out.push({
      level: "good",
      title: "Outcomes are genuinely skewed to the right",
      detail: `${f.avgR.toFixed(2)}R per trade. Winners are paying for the losers with room to spare, which is the shape that survives a long sample.`,
      metric: `${f.avgR.toFixed(2)}R`,
    });
  } else {
    out.push({
      level: "warn",
      title: "Average R is positive but thin",
      detail: `${f.avgR.toFixed(2)}R per trade. Small enough that one bad session erases a long stretch — the fix is cutting the losses below -1R, not adding trades.`,
      metric: `${f.avgR.toFixed(2)}R`,
    });
  }

  const tailBuckets = ["-2R", "-3R", "≤-3R"];
  const tail = sum(f.rHistogram.filter((b) => tailBuckets.includes(b.bucket)).map((b) => b.count));
  const tailShare = share(tail, total);
  if (tailShare >= T.leftTailBad * 100) {
    out.push({
      level: "bad",
      title: "A chunk of trades close far beyond -1R",
      detail: `${tail} of ${total} trades (${pct(tailShare, 0)}) finish worse than twice the planned risk. Stops are being widened or ignored on exactly the trades that most needed them.`,
      metric: pct(tailShare, 0),
    });
  } else if (tailShare === 0 && f.riskCoverage > 0) {
    out.push({
      level: "good",
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
      title: `${pct(winRateFromR, 0)} of trades close at +1R or better`,
      detail: `${winBucketCount} winners against ${lossBucketCount} losers in R terms. Compare against the break-even rate the payoff on this tab implies — a lower rate is fine when the payoff is high, and not fine when it is not.`,
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
      title: "No excursion data recorded",
      detail: "MAE and MFE show how far price moved for and against each trade. Without them, entry and exit quality cannot be separated from luck.",
    });
    return out;
  }

  const coverage = share(f.maeFdCount, f.trades.length);
  if (coverage < T.maeFdCoverageFloorPct) {
    out.push({
      level: "warn",
      title: `Only ${pct(coverage, 0)} of trades have MAE/MFE`,
      detail: `The findings below rest on ${f.maeFdCount} of ${f.trades.length} trades. They are the most valuable field you are not logging consistently.`,
      metric: pct(coverage, 0),
    });
  }

  if (f.entryEff < T.entryEffBad) {
    out.push({
      level: "bad",
      title: "Entries are landing in the wrong half of the move",
      detail: `Entry efficiency ${pct(f.entryEff)} — price went ${money(-f.avgMae)} against you on average and only ${money(f.avgMfe)} your way before the entry resolved. Waiting for a pullback or using a limit at the level you actually wanted is the fix.`,
      metric: pct(f.entryEff),
    });
  } else if (f.entryEff >= T.entryEffStrong) {
    out.push({
      level: "good",
      title: "Entries are close to optimal",
      detail: `${pct(f.entryEff)} efficiency means price favours you quickly after entry. Improving here has less headroom left than improving the exit.`,
      metric: pct(f.entryEff),
    });
  }

  if (f.exitEff < T.exitEffBad) {
    out.push({
      level: "bad",
      title: "Winning trades are giving back most of the move",
      detail: `Only ${pct(f.exitEff)} of available profit is captured on winners — ${money(f.avgWin)} realised against ${money(f.avgMfe)} that was on the table. This is a direct, mechanical leak in the process.`,
      metric: pct(f.exitEff),
    });
  } else if (f.exitEff < T.exitEffWarn) {
    out.push({
      level: "warn",
      title: "A third of available profit is left behind",
      detail: `${pct(f.exitEff)} of MFE captured on winning trades. Moving stops to breakeven and letting the planned target do the work usually recovers most of this.`,
      metric: pct(f.exitEff),
    });
  } else if (f.exitEff >= T.exitEffStrong) {
    out.push({
      level: "good",
      title: "Exits capture most of the available move",
      detail: `${pct(f.exitEff)} of MFE realised on winners. Very little to reclaim here — effort is better spent on entries and position selection.`,
      metric: pct(f.exitEff),
    });
  }

  if (f.avgWin > 0 && f.avgMfe > 0 && f.avgMfe > f.avgWin * 1.5) {
    out.push({
      level: "warn",
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
        title: "Stops may be tighter than the setup deserves",
        detail: `Average MAE is ${money(f.avgMae)} against a ${money(f.avgLoss)} loss — price routinely goes ${ratio.toFixed(1)}x further against you than the loss you took. Stop placement is cutting trades before the thesis has played out.`,
        metric: `${ratio.toFixed(1)}x`,
      });
    } else if (ratio < 0.7) {
      out.push({
        level: "good",
        title: "Losers are contained well before the stop",
        detail: `MAE averages ${money(f.avgMae)} against a ${money(f.avgLoss)} loss. Positions are being closed at a fraction of the risk planned, which keeps drawdowns shallow.`,
        metric: `${ratio.toFixed(2)}x`,
      });
    } else {
      out.push({
        level: "info",
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
        title: "Your highest-volume days are your worst days",
        detail: `${flaggedDays} flagged session${flaggedDays !== 1 ? "s" : ""} returned ${money(flaggedPnl, 0)}, averaging ${money(flaggedAvg, 0)} per day against ${money(restAvg, 0)} on normal days. Volume is costing money, not making it.`,
        metric: `${money(flaggedAvg, 0)}/day`,
      });
    } else if (gapPct >= 15) {
      out.push({
        level: "warn",
        title: "Flagged sessions earn less per day than normal ones",
        detail: `${f.overtradingDays.length} session${f.overtradingDays.length !== 1 ? "s" : ""} above your trade-count baseline averaged ${money(flaggedAvg, 0)} per day against ${money(restAvg, 0)} elsewhere — ${pct(gapPct, 0)} less for trading more.`,
        metric: `${pct(gapPct, 0)} less/day`,
      });
    } else {
      out.push({
        level: "info",
        title: `${f.overtradingDays.length} session${f.overtradingDays.length !== 1 ? "s" : ""} broke your trade-count baseline`,
        detail: `They averaged ${money(flaggedAvg, 0)} per day against ${money(restAvg, 0)} on normal days, so the extra volume did not hurt this sample. The threshold still exists for a reason — it protects the sessions that follow a run of losses.`,
        metric: `${f.overtradingDays.length} day${f.overtradingDays.length !== 1 ? "s" : ""}`,
      });
    }
  } else if (f.tradingDays >= 5) {
    out.push({
      level: "good",
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
        title: "Trades taken after a loss underperform every other trade",
        detail: `${f.revengeCount} re-entries (${pct(revengeShare, 0)} of the book) returned ${money(f.revengePnl, 0)}, averaging ${money(revengeAvg)} against ${money(otherAvg)} elsewhere. A mandatory break after a loss is the intervention with the clearest evidence behind it.`,
        metric: `${money(revengeAvg)}/trade`,
      });
    } else {
      out.push({
        level: "warn",
        title: `${f.revengeCount} trades were taken after a same-day loss`,
        detail: `${pct(revengeShare, 0)} of the book. They returned ${money(revengeAvg)} per trade against ${money(otherAvg)} elsewhere, so the habit is not costing much — but it is not free either.`,
        metric: `${pct(revengeShare, 0)} of trades`,
      });
    }
  }

  if (f.disciplineScore < 60) {
    out.push({
      level: "bad",
      title: "Process discipline is the binding constraint",
      detail: `Discipline ${f.disciplineScore}/100. At this score, no amount of new analysis helps — the signals exist and are not being followed. Fix the rules before the strategy.`,
      metric: `${f.disciplineScore}/100`,
    });
  } else if (f.disciplineScore >= 80) {
    out.push({
      level: "good",
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
        title: "No positive edge to size from",
        detail: `Kelly returns ${kelly.toFixed(1)}% — the current win rate and payoff do not support any position size. This is a strategy problem, and no risk percentage fixes it.`,
        metric: `${kelly.toFixed(1)}%`,
      });
    } else if (f.riskPct > kelly) {
      out.push({
        level: "bad",
        title: `Sized above Kelly at ${f.riskPct}% per trade`,
        detail: `Your edge supports ${kelly.toFixed(1)}% (${maxSafeRisk.toFixed(1)}% at half-Kelly). At ${f.riskPct}% a normal losing sequence ends the account — that is the definition of over-leveraged, not a near miss.`,
        metric: `${f.riskPct}%`,
      });
    } else if (f.riskPct > maxSafeRisk) {
      out.push({
        level: "warn",
        title: `Sized above half-Kelly at ${f.riskPct}% per trade`,
        detail: `Half-Kelly for this edge is ${maxSafeRisk.toFixed(1)}%. Full Kelly maximises long-run growth but assumes you keep trading the same edge through a bad stretch; most journals are better served below it.`,
        metric: `${f.riskPct}%`,
      });
    } else {
      out.push({
        level: "good",
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
          title: `Risk of ruin is ${ror >= 1 ? "certain" : pct(ror, 2)} at this size`,
          detail: "This is the probability of the account reaching zero under repeated bets of this size and edge. Drop the slider until the number falls under a few percent.",
          metric: ror >= 1 ? "100%" : pct(ror, 2),
        });
      } else if (ror >= T.ruinWarn * 100) {
        out.push({
          level: "warn",
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
      title: "Net profit has not repaid the worst drawdown",
      detail: `Recovery factor ${f.recFactor.toFixed(2)} — the account is still carrying the deepest decline from its own history. Nothing here is worth scaling until that turns above 1.`,
      metric: f.recFactor.toFixed(2),
    });
  } else if (f.recFactor >= T.recoveryFloor) {
    out.push({
      level: "good",
      title: "Drawdowns are repaid many times over",
      detail: `Recovery factor ${f.recFactor.toFixed(2)}. The equity curve repays its worst decline repeatedly, which is the profile that supports a size increase.`,
      metric: f.recFactor.toFixed(2),
    });
  }

  const { costs } = f;
  if (costs.costPctOfGross >= T.costBadPct) {
    out.push({
      level: "bad",
      title: "Costs are consuming a tenth of everything won",
      detail: `$${costs.costs.toFixed(2)} of commission and fees against $${costs.grossProfit.toFixed(2)} gross profit ($${costs.costPerTrade.toFixed(2)} per trade). Gross profit needs ${costs.breakevenTrades} extra trading days just to break even on friction — reducing trade count is worth more than raising targets here.`,
      metric: pct(costs.costPctOfGross, 2),
    });
  } else if (costs.costPctOfGross >= T.costWarnPct) {
    out.push({
      level: "warn",
      title: "Costs are a meaningful slice of gross profit",
      detail: `${pct(costs.costPctOfGross, 2)} of gross profit ($${costs.costPerTrade.toFixed(2)} per trade). Trimming low-conviction trades improves the net result without touching the strategy.`,
      metric: pct(costs.costPctOfGross, 2),
    });
  } else if (costs.costPctOfGross > 0 && costs.costPctOfGross < T.costNoisePct) {
    out.push({
      level: "good",
      title: "Costs are noise against gross profit",
      detail: `${pct(costs.costPctOfGross, 2)} of gross profit ($${costs.costPerTrade.toFixed(2)} per trade). Execution cost is not constraining this edge — trade selection is the only lever worth pulling.`,
      metric: pct(costs.costPctOfGross, 2),
    });
  }

  // Hold time is usually the biggest single finding in a trading journal.
  const timedBuckets = f.durationData.filter((d) => d.trades >= T.minSlice);
  if (timedBuckets.length >= 2) {
    const best = timedBuckets.reduce((b, d) => (d.pnl > b.pnl ? d : b), timedBuckets[0]);
    
    const worstBucket = timedBuckets.reduce((w, d) => (d.pnl < w.pnl ? d : w), timedBuckets[0]);

    if (worstBucket.pnl < 0) {
      const bleeders = timedBuckets.filter((d) => d.pnl < 0);
      out.push({
        level: "bad",
        title: `${worstBucket.bucket} trades lose money`,
        detail: `${money(worstBucket.pnl)} across ${worstBucket.trades} trades at ${money(worstBucket.avgPnl)} each. ${bleeders.length > 1 ? `${bleeders.length} hold-time bands are negative, so it is the process rather than one band.` : "Raising the floor on this band is the highest-value rule on this tab."}`,
        metric: money(worstBucket.pnl, 0),
      });
    }

    if (best.pnl > 0 && best.bucket !== worstBucket.bucket) {
      out.push({
        level: "good",
        title: `${best.bucket} is where holding pays`,
        detail: `${money(best.pnl)} over ${best.trades} trades at ${money(best.avgPnl)} each. If the losing band is deliberately a scalping window, that is a contradiction worth resolving on paper before the next session.`,
        metric: money(best.pnl, 0),
      });
    }
  } else if (f.durationData.every((d) => d.trades === 0)) {
    out.push({
      level: "info",
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
        title: "Quick re-entries after a loss are the losing habit",
        detail: `Entering within 15 minutes of a loss returned ${money(fastAfterLoss.pnl, 0)} over ${fastAfterLoss.trades} trades (${money(fastAfterLoss.avgPnl)} each, ${fastAfterLoss.winRate}% win rate). A cooldown after a loss is the intervention this chart supports.`,
        metric: `${money(fastAfterLoss.avgPnl)}/trade`,
      });
    } else if (fastAfterLoss.avgPnl > 0) {
      out.push({
        level: "good",
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
        title: `The edge is one-directional — ${good.bucket} only`,
        detail: `${good.bucket} returned ${money(good.pnl)} over ${good.trades} trades while ${bad.bucket} returned ${money(bad.pnl)} over ${bad.trades}. Restricting to the profitable side roughly doubles the return on the same sample, at the cost of fewer trades.`,
        metric: money(good.pnl, 0),
      });
    } else if (good.pnl > 0 && bad.pnl > 0) {
      out.push({
        level: "good",
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
        title: "R dispersion makes survival a coin flip at this size",
        detail: `Outcomes scatter ${f.rRisk.sigma.toFixed(2)}R around a ${f.rRisk.meanR.toFixed(2)}R mean, giving a ruin probability of ${pct(ruinPct, 1)}. Dispersion, not the mean, is what ends accounts at fixed sizing — reduce risk per trade until this falls.`,
        metric: pct(ruinPct, 1),
      });
    } else if (ruinPct <= T.ruinWarn * 100 && f.rRisk.meanR > 0) {
      out.push({
        level: "good",
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
        title: "Winners are taken before they work",
        detail: `Winning trades went ${f.stop.winnerRatio.toFixed(2)}R against before resolving — only ${f.stop.cleanWinners} of ${f.stop.wins} stayed under 0.5R. Entries are firing before the setup confirms; a confirmation candle or a tighter entry zone is the change to test.`,
        metric: `${f.stop.winnerRatio.toFixed(2)}R`,
      });
    } else {
      out.push({
        level: "good",
        title: "Entries are well-timed against the stop",
        detail: `Winners average only ${f.stop.winnerRatio.toFixed(2)}R of adverse movement, with ${f.stop.cleanWinners} of ${f.stop.wins} staying under 0.5R. There is real headroom before the stop is tested.`,
        metric: `${f.stop.winnerRatio.toFixed(2)}R`,
      });
    }

    const stopShare = share(f.stop.losersTouchingStop, f.stop.losses);
    if (f.stop.losses >= 5 && stopShare < 0.5) {
      out.push({
        level: "warn",
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
        title: "Manual closes cluster on losers",
        detail: `${manual.trades} trades were closed by hand at a ${manual.winRate}% win rate, returning ${money(manual.pnl, 0)}. When the hand closes more often than the stop does, the exit plan is being written after the fact.`,
        metric: `${manual.winRate}% WR`,
      });
    }

    if (targeted && manual && targeted.trades >= 5 && targeted.winRate >= 60 && manual.winRate < targeted.winRate - 20) {
      out.push({
        level: "good",
        title: "Targets do the work, hands do the damage",
        detail: `Trades that hit the target won at ${targeted.winRate}%, against ${manual.winRate}% for hand-closed trades. The plan is sound; the temptation to close early is what costs.`,
        metric: `${targeted.winRate}% vs ${manual.winRate}%`,
      });
    }

    if (stopped && stopped.trades >= 5 && stopped.pnl < 0) {
      out.push({
        level: "info",
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
        title: "Adding to a loser costs money",
        detail: `${f.legData.averagedDown.trades} position${f.legData.averagedDown.trades !== 1 ? "s were" : " was"} added to at a worse price than the first fill, for ${money(f.legData.averagedDownPnl, 0)} net. Scaling in widens risk exactly when the market is confirming the mistake.`,
        metric: money(f.legData.averagedDownPnl, 0),
      });
    } else if (f.legData.multiLeg.trades >= 5 && f.legData.multiLeg.pnl < f.legData.singleLeg.pnl) {
      out.push({
        level: "warn",
        title: "Built positions do worse than single entries",
        detail: `Multiple entries returned ${money(f.legData.multiLeg.pnl, 0)} against ${money(f.legData.singleLeg.pnl, 0)} for single entries across the same sample. Sizing the full plan at entry keeps the risk identical and removes the mid-flight decision.`,
        metric: money(f.legData.multiLegPnl, 0),
      });
    } else if (f.legData.averagedDown.trades === 0) {
      out.push({
        level: "good",
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
        title: `${best.bucket} and ${worst.bucket} are not the same strategy`,
        detail: `${best.bucket} returned ${money(best.pnl, 0)} over ${best.trades} trades; ${worst.bucket} returned ${money(worst.pnl, 0)} over ${worst.trades}. Whatever drives one and not the other is the thing worth understanding.`,
        metric: money(best.pnl, 0),
      });
    }
  }

  if (f.cashFlow.coverage >= 2 && f.cashFlow.netFlow > 0) {
    const flowShare = f.totalPnl > 0 ? share(f.cashFlow.netFlow, f.totalPnl) : 100;
    if (flowShare >= 20) {
      out.push({
        level: "bad",
        title: "Deposits are inflating the equity curve",
        detail: `$${f.cashFlow.deposits.toFixed(2)} went in and $${Math.abs(f.cashFlow.withdrawals).toFixed(2)} came out, a net ${money(f.cashFlow.netFlow)}. That is ${pct(flowShare, 0)} of net profit — read every ratio on this tab as trading performance without it.`,
        metric: money(f.cashFlow.netFlow, 0),
      });
    } else {
      out.push({
        level: "good",
        title: "The curve is entirely trade-generated",
        detail: `Every balance change is explained by your own trades across ${f.cashFlow.coverage} recorded closes. Nothing in these numbers is being flattered by external cash.`,
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