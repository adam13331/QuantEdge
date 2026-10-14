/*
 * Example dataset for screenshots and local evaluation.
 *
 * This is NOT a seed script for the app — QuantEdge has no seed path on
 * purpose. Run it explicitly and it wipes existing trades first:
 *
 *   node scripts/seed-example.js
 *
 * The data is synthetic but shaped to look traded: position sizing scales with
 * a risk budget, R-multiples come from the same exit rule the real exporter
 * uses, and drawdowns are long enough to trip the drawdown insights.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Deterministic PRNG so re-running gives the same screenshots.
let seed = 20261014;
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function range(min, max) { return min + rnd() * (max - min); }

const INITIAL_BALANCE = 25_000;
const RISK_PCT = 0.005; // 0.5% per trade

const SETUPS = [
  { name: "Opening Range Breakout", symbol: "NQ", rr: [1.8, 3.2], winRate: 0.46, tags: ["ORB", "index"] },
  { name: "VWAP Reclaim",           symbol: "ES", rr: [1.4, 2.6], winRate: 0.58, tags: ["intraday", "mean-reversion"] },
  { name: "Gap Fill",               symbol: "AAPL", rr: [1.2, 2.0], winRate: 0.62, tags: ["gap", "stock"] },
  { name: "Trend Continuation",     symbol: "EURUSD", rr: [2.0, 3.6], winRate: 0.41, tags: ["trend", "fx"] },
  { name: "Failed Breakdown",       symbol: "TSLA", rr: [1.3, 2.2], winRate: 0.52, tags: ["reversal", "stock"] },
];

const PRICE = { NQ: 20_150, ES: 5_640, AAPL: 232.4, EURUSD: 1.0875, TSLA: 262.8 };

const EXIT_REASONS = ["take-profit", "stop-loss", "manual", "expert"];

function round(n, dp = 2) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// Build a session of trades for one calendar day.
function buildDay(date, accountBalance) {
  const trades = [];
  const count = Math.floor(rnd() * 4); // 0-3 trades; some days are flat
  let balance = accountBalance;

  for (let i = 0; i < count; i++) {
    const setup = pick(SETUPS);
    const base = PRICE[setup.symbol];
    const isLong = rnd() > 0.45;
    const tickish = setup.symbol === "AAPL" || setup.symbol === "TSLA" ? 0.01 : 0.25;

    // Planned risk, then R-multiple decides the exit — same relationship the
    // exporter records, so the analytics agree with each other.
    const plannedRisk = INITIAL_BALANCE * RISK_PCT * range(0.85, 1.15);
    const riskPerUnit = setup.symbol === "NQ" ? 20 : setup.symbol === "ES" ? 50
      : setup.symbol === "EURUSD" ? 10_000 : base * 0.01;
    const quantity = Math.max(1, Math.round(plannedRisk / riskPerUnit));

    const stopDist = range(0.4, 1.2);
    const entry = round(base * (1 + range(-0.004, 0.004)), setup.symbol === "EURUSD" ? 5 : 2);
    const won = rnd() < setup.winRate;

    // Winners hit a target; losers get stopped. Breakeven is folded into
    // "manual" so the manual bucket isn't suspiciously large.
    const stop = round(entry - stopDist * (isLong ? 1 : -1), 2);
    const target = round(entry + stopDist * setup.rr[Math.floor(rnd() * setup.rr.length)] * (isLong ? 1 : -1), 2);
    const rrMult = Math.abs(target - entry) / Math.max(0.0001, Math.abs(entry - stop));

    const realizedR = won ? rrMult * range(0.75, 1.0) : -range(0.85, 1.05);
    const exit = round(entry + (entry - stop) * realizedR, 2);
    const pnl = round((exit - entry) * quantity * (isLong ? 1 : -1));

    // MAE/MFE: losers approach their stop, winners give back some profit.
    const mae = round(-Math.abs(entry - stop) * quantity * range(0.55, 1.0) * (isLong ? 1 : -1));
    const mfe = won
      ? round(Math.abs(target - entry) * quantity * range(0.7, 1.0) * (isLong ? 1 : -1))
      : round(Math.abs(entry - stop) * quantity * range(0.15, 0.6) * (isLong ? 1 : -1));

    const entryHour = [9, 10, 11, 13, 14, 15][Math.floor(rnd() * 6)];
    const durMin = Math.round(range(12, 260));
    const commission = round(-Math.max(1.2, quantity * 0.02));
    const netPnl = round(pnl + commission);
    balance = round(balance + netPnl);

    const exitReason = won
      ? (rnd() > 0.25 ? "take-profit" : "manual")
      : (rnd() > 0.4 ? "stop-loss" : "manual");

    trades.push({
      id: `tr-${date.toISOString().slice(0, 10)}-${i}`,
      date: date.toISOString().slice(0, 10),
      symbol: setup.symbol,
      underlying: setup.symbol === "EURUSD" ? "EUR/USD" : setup.symbol,
      type: setup.symbol === "EURUSD" ? "Forex" : "Future",
      direction: isLong ? "Long" : "Short",
      quantity,
      entryPrice: entry,
      exitPrice: exit,
      commission,
      fees: 0,
      pnl: netPnl,
      // Must be lowercase win/loss/breakeven - every win-rate calculation in
      // the app compares against these exact strings.
      status: netPnl > 0 ? "win" : netPnl < 0 ? "loss" : "breakeven",
      entryTime: `${String(entryHour).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`,
      exitTime: `${String(Math.min(23, entryHour + Math.floor(durMin / 60))).padStart(2, "0")}:${String(durMin % 60).padStart(2, "0")}`,
      rr: realizedR.toFixed(2),
      plannedRisk: round(plannedRisk),
      durationMin: durMin,
      mae,
      mfe,
      exitReason,
      magic: rnd() > 0.85 ? 20251001 : 0,
      legs: 1,
      averagedDown: false,
      balanceAfter: balance,
      hourOfDay: entryHour,
      tags: JSON.stringify(setup.tags),
      journalEntry: won
        ? "Held through the first pullback and took the planned target. Entry was late but size was correct."
        : "Stopped out. Setup was valid but I entered into strength without waiting for the retest.",
      link: null,
      imageUrls: JSON.stringify([]),
    });
  }
  return { trades, balance };
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.trade.deleteMany();
  await prisma.tradePlan.deleteMany();
  await prisma.playbook.deleteMany();
  await prisma.account.deleteMany();

  const account = await prisma.account.create({
    data: {
      id: "acct-example",
      name: "Prop Evaluation",
      platform: "MetaTrader 5",
      initialBalance: INITIAL_BALANCE,
      currency: "USD",
    },
  });

  const playbooks = [];
  for (const s of SETUPS) {
    playbooks.push(await prisma.playbook.create({
      data: {
        id: `pb-${s.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: s.name,
        description: `${s.symbol} setup traded on the 5m and 15m charts.`,
        rules: JSON.stringify([
          "Wait for the range to form in the first 15 minutes.",
          "Enter only on a close back inside the range.",
          "Stop beyond the opposite side of the range.",
        ]),
        timeframes: "5m, 15m",
        instruments: s.symbol,
        entryTriggers: JSON.stringify(["Range break with retest", "Volume confirmation"]),
        exitRules: "Take profit at 2R. Move to breakeven after 1R.",
        notes: "Do not trade the first two candles.",
        imageUrls: JSON.stringify([]),
      },
    }));
  }

  console.log("Generating ~9 months of trades...");
  const all = [];
  let balance = INITIAL_BALANCE;
  const start = new Date("2026-01-05T00:00:00Z");
  const end = new Date("2026-10-09T00:00:00Z");

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // no weekend trading
    if (rnd() < 0.12) continue;            // days off

    const { trades, balance: b } = buildDay(d, balance);
    balance = b;
    all.push(...trades);
  }

  // Give each trade a playbook link so the per-setup stats have data.
  for (const t of all) {
    const setup = SETUPS.find((s) => s.symbol === t.symbol);
    t.playbookId = setup ? `pb-${setup.name.toLowerCase().replace(/\s+/g, "-")}` : null;
  }

  console.log(`Inserting ${all.length} trades...`);
  await prisma.trade.createMany({ data: all.map((t) => ({ ...t, accountId: account.id })) });

  // A handful of plans in mixed states.
  const planTemplates = [
    { status: "pending",  thesis: "NQ opening range break. Wait for the retest, not the first thrust." },
    { status: "executed", thesis: "ES reclaim of VWAP after the morning flush." },
    { status: "missed",   thesis: "AAPL gap fill into the prior close." },
    { status: "pending",  thesis: "EURUSD continuation if the 4H trend holds above the prior high." },
  ];
  for (let i = 0; i < planTemplates.length; i++) {
    const p = planTemplates[i];
    await prisma.tradePlan.create({
      data: {
        id: `plan-example-${i}`,
        date: new Date(Date.UTC(2026, 9, 6 + i)).toISOString().slice(0, 10),
        symbol: ["NQ", "ES", "AAPL", "EURUSD"][i],
        underlying: ["NQ", "ES", "AAPL", "EUR/USD"][i],
        direction: i % 2 === 0 ? "Long" : "Short",
        setupType: SETUPS[i % SETUPS.length].name,
        thesis: p.thesis,
        entryZone: "Within 2 points of the trigger",
        stopLevel: round(range(100, 400)),
        targetLevel: round(range(600, 1400)),
        plannedRR: "2.00",
        plannedSize: 1,
        invalidation: "One close back outside the range.",
        status: p.status,
        accountId: account.id,
      },
    });
  }

  const wins = all.filter((t) => t.pnl > 0).length;
  const net = all.reduce((s, t) => s + t.pnl, 0);
  console.log(`\nDone. ${all.length} trades, ${wins} wins (${((wins / all.length) * 100).toFixed(1)}%), net P&L $${round(net)}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());