import { describe, expect, it } from "vitest";
import { Trade } from "./types";
import {
  averageLoss,
  byDayOfWeek,
  byDirection,
  calmarRatio,
  dayRisk,
  drawdownStats,
  expectancy,
  getDailyPnl,
  leadingBlanks,
  monthWeeks,
  normalizeDate,
  profitFactor,
  rHistogram,
  rMultiples,
  sharpeRatio,
  sortinoRatio,
  stdDev,
  tradeR,
  tradeSide,
  weekdayHeaders,
} from "./analytics";

// Every fixture carries the fields the maths touches; the rest of Trade is
// optional, so a partial override is enough to describe a case.
const mk = (patch: Partial<Trade> = {}): Trade => ({
  id: patch.id ?? "t1",
  date: patch.date ?? "2026-10-05",
  symbol: "XAUUSD",
  underlying: "XAUUSD",
  type: "forex",
  direction: "long",
  quantity: 1,
  entryPrice: 1,
  exitPrice: 1,
  commission: 0,
  fees: 0,
  pnl: 0,
  status: "win",
  ...patch,
});

describe("date handling", () => {
  it("normalises the MM/DD/YYYY rows older imports wrote", () => {
    expect(normalizeDate("10/07/2026")).toBe("2026-10-07");
    expect(normalizeDate("2026-10-07")).toBe("2026-10-07");
  });

  it("groups daily P&L and returns the days in order", () => {
    const daily = getDailyPnl([
      mk({ date: "2026-10-07", pnl: -30 }),
      mk({ date: "2026-10-05", pnl: 100 }),
      mk({ date: "2026-10-07", pnl: 10 }),
    ]);
    expect(daily).toEqual([
      { date: "2026-10-05", pnl: 100 },
      { date: "2026-10-07", pnl: -20 },
    ]);
  });
});

describe("dispersion and risk ratios", () => {
  it("uses the sample standard deviation", () => {
    expect(stdDev([])).toBe(0);
    expect(stdDev([5])).toBe(0);
    expect(stdDev([1, 3])).toBeCloseTo(Math.SQRT2, 10);
  });

  it("needs five days before quoting a Sharpe", () => {
    expect(sharpeRatio([100, 200, 300, 400])).toBe(0);
    expect(sharpeRatio([100, 100, 100, 100, 100])).toBe(0); // zero dispersion
    expect(sharpeRatio([10, 20, 30, 40, 50, 60])).toBeGreaterThan(0);
  });

  it("caps Sortino at 99 when nothing ever lost", () => {
    expect(sortinoRatio([10, 20, 30, 40])).toBe(0); // too few days
    expect(sortinoRatio([10, 20, 30, 40, 50])).toBe(99);
    expect(sortinoRatio([-10, -20, -30, -40, -50])).toBeLessThan(0);
  });

  it("annullises Calmar when any input is missing", () => {
    expect(calmarRatio(0, 0, 0, 0)).toBe(0);
    // 10% a year over a 5% drawdown is 2.
    expect(calmarRatio(1000, 10_000, 252, -5)).toBe(2);
  });
});

describe("profit quality", () => {
  it("computes expectancy per trade", () => {
    expect(expectancy([], [])).toBe(0);
    const wins = [mk({ pnl: 100 }), mk({ pnl: 100 })];
    const losses = [mk({ pnl: -50 }), mk({ pnl: -50 })];
    // 50% × 100 − 50% × 50
    expect(expectancy(wins, losses)).toBe(25);
  });

  it("separates profit factor from the payoff ratio", () => {
    const wins = [mk({ pnl: 100 })];
    const losses = [mk({ pnl: -50 })];
    expect(profitFactor(wins, losses)).toBe(2);
    expect(profitFactor(wins, [])).toBeNull(); // no losing trade: not a ceiling
    expect(profitFactor([], [])).toBe(0);
  });

  it("tracks the deepest drop from the high-water mark", () => {
    const stats = drawdownStats(
      [
        mk({ date: "2026-10-01", pnl: 100 }),
        mk({ date: "2026-10-02", pnl: -300 }),
        mk({ date: "2026-10-03", pnl: 50 }),
      ],
      10_000,
    );
    expect(stats.maxDd).toBe(-300);
    expect(stats.maxDdPct).toBeCloseTo(-2.97, 2);
    expect(stats.ddCurve).toHaveLength(3);
    expect(stats.ddCurve[2].equity).toBeCloseTo(9850, 5);
  });
});

describe("R multiples", () => {
  it("uses the accepted risk when the exporter recorded one", () => {
    const rows = rMultiples(
      [mk({ pnl: 50, plannedRisk: 25, status: "win" }), mk({ pnl: -40, plannedRisk: 20, status: "loss" })],
      0,
    );
    expect(rows).toEqual([{ r: 2, win: true }, { r: -2, win: false }]);
  });

  it("falls back to the average loss when risk is unknown", () => {
    const rows = rMultiples([mk({ pnl: 30 })], 20);
    expect(rows).toEqual([{ r: 1.5, win: true }]);
  });

  it("returns nothing when there is no unit to divide by", () => {
    expect(rMultiples([mk({ pnl: 30 })], 0)).toEqual([]);
  });

  it("buckets R values including the tails", () => {
    const rows = rHistogram([{ r: -3.5 }, { r: -1.2 }, { r: 0 }, { r: 0.4 }, { r: 1.9 }, { r: 3.2 }]);
    expect(rows.map((b) => [b.bucket, b.count])).toEqual([
      ["≤-3R", 1],
      ["-2R", 1],
      ["+0R", 2],
      ["+1R", 1],
      ["≥3R", 1],
    ]);
    expect(rows.find((b) => b.bucket === "+0R")?.positive).toBe(false);
  });
});

describe("directional splits", () => {
  it("reads long/short case-insensitively", () => {
    expect(tradeSide(mk({ direction: "Short" }))).toBe("short");
    expect(tradeSide(mk({ direction: "long" }))).toBe("long");
    expect(tradeSide(mk({ direction: "" }))).toBe("long");
  });

  it("counts mixed-case rows on both sides", () => {
    const split = byDirection([
      mk({ direction: "Long", pnl: 10 }),
      mk({ direction: "short", pnl: -4 }),
      mk({ direction: "SHORT", pnl: -6 }),
    ]);
    expect(split.map((b) => [b.bucket, b.trades, b.pnl])).toEqual([
      ["Long", 1, 10],
      ["Short", 2, -10],
    ]);
  });

  it("derives the average loss only from losing trades", () => {
    expect(averageLoss([mk({ pnl: -10 }), mk({ pnl: -30 }), mk({ pnl: 50 })])).toBe(20);
    expect(averageLoss([mk({ pnl: 50 })])).toBe(0);
  });

  it("computes one trade's R with the same fallback", () => {
    expect(tradeR(mk({ pnl: 50, plannedRisk: 25 }), 20)).toBe(2);
    expect(tradeR(mk({ pnl: 50 }), 20)).toBe(2.5);
    expect(tradeR(mk({ pnl: 50 }), 0)).toBeNull();
  });

  it("rolls weekday buckets from the configured week start", () => {
    const rows = byDayOfWeek(
      [mk({ date: "2026-10-05", pnl: 10 }), mk({ date: "2026-10-06", pnl: -5 })],
      "monday",
    );
    expect(rows.map((r) => r.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(rows[0]).toEqual({ day: "Mon", pnl: 10, count: 1, wr: 100 });
    expect(rows[1].count).toBe(1);
  });
});

describe("calendar grid", () => {
  it("offsets the first row from the configured week start", () => {
    const firstOfNov = new Date(2026, 10, 1); // a Sunday
    expect(leadingBlanks(firstOfNov, "monday")).toBe(6);
    expect(leadingBlanks(firstOfNov, "sunday")).toBe(0);
    expect(weekdayHeaders("monday")[0]).toBe("Mon");
    expect(weekdayHeaders("sunday")).toHaveLength(7);
  });

  it("totals whole weeks, indexable by grid row", () => {
    const weeks = monthWeeks(
      [
        mk({ date: "2026-11-01", pnl: 10 }),
        mk({ date: "2026-11-02", pnl: -4 }),
        mk({ date: "2026-11-02", pnl: -6 }),
        mk({ date: "2026-11-09", pnl: 7 }),
        mk({ date: "2026-10-31", pnl: 99 }), // previous month: must not leak
      ],
      2026,
      10,
      "monday",
    );
    expect(weeks[0]).toEqual({ index: 0, pnl: 10, trades: 1 });
    expect(weeks[1]).toEqual({ index: 1, pnl: -10, trades: 2 });
    expect(weeks[2]).toEqual({ index: 2, pnl: 7, trades: 1 });
    expect(weeks.reduce((s, w) => s + w.trades, 0)).toBe(4);
  });

  it("flags breaches and near-misses against the risk controls", () => {
    expect(dayRisk(-500, 2, 500, 0)).toMatchObject({ lossBreached: true, lossWarning: false });
    expect(dayRisk(-400, 2, 500, 0)).toMatchObject({ lossBreached: false, lossWarning: true });
    expect(dayRisk(100, 3, 0, 3)).toMatchObject({ tradeBreached: true, tradeWarning: false });
    // A limit of 0 means "not configured" and must never fire.
    expect(dayRisk(-900, 99, 0, 0)).toEqual({
      lossBreached: false,
      tradeBreached: false,
      lossWarning: false,
      tradeWarning: false,
    });
  });
});
