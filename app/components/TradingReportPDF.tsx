"use client";
import { t as tr } from "../lib/i18n";
import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import { Trade, Account } from "../lib/types";import { formatTime } from "../lib/time";
import { buildReportStats,
  durationMinutes, byDuration, byReEntryGap, byDirection, costProfile,
  recoveryFactor, rRiskProfile, stopQuality,
  byExitReason, byMagic, legStats, externalCashFlow,
  challengeStatus, simulateChallenge, challengePlan, challengeROI,
  ChallengeConfig, targetPctFor,
} from "../lib/analytics";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    backgroundColor: "#ffffff",
    padding: 48,
  },
  coverHeader: {
    marginBottom: 40,
    borderBottom: "2px solid #4d9fff",
    paddingBottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  coverBrand: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  brandWordmark: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#0a0a1a",
    letterSpacing: -1,
  },
  brandSub: {
    fontSize: 11,
    color: "#666688",
  },
  coverMeta: {
    marginTop: 32,
  },
  coverMetaRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  coverMetaLabel: {
    fontSize: 10,
    color: "#888",
    width: 120,
  },
  coverMetaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    marginBottom: 12,
    marginTop: 24,
    paddingBottom: 6,
    borderBottom: "1px solid #e0e0f0",
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    border: "1px solid #e0e0f0",
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#f8f8fd",
  },
  statLabel: {
    fontSize: 8,
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValueGreen: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#00b85e",
    marginBottom: 2,
  },
  statValueRed: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#cc3355",
    marginBottom: 2,
  },
  statSub: {
    fontSize: 8,
    color: "#aaa",
  },
  dayRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottom: "1px solid #f0f0f8",
    alignItems: "center",
  },
  dayDate: {
    width: 90,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
  },
  dayTrades: {
    flex: 1,
    fontSize: 9,
    color: "#888",
  },
  dayPnl: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    width: 80,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f8",
    padding: "8 6",
    borderRadius: 4,
    marginBottom: 2,
  },
  colHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    padding: "7 6",
    borderBottom: "1px solid #f4f4fc",
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: "7 6",
    backgroundColor: "#fafaff",
    borderBottom: "1px solid #f4f4fc",
  },
  colDate:   { width: 62, fontSize: 8, color: "#555" },
  colSymbol: { width: 48, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1a1a2e" },
  colType:   { width: 36, fontSize: 8, color: "#555" },
  colStrike: { width: 42, fontSize: 8, color: "#555" },
  colExpiry: { width: 52, fontSize: 8, color: "#555" },
  colQty:    { width: 28, fontSize: 8, color: "#555" },
  colEntry:  { width: 40, fontSize: 8, color: "#555" },
  colExit:   { width: 40, fontSize: 8, color: "#555" },
  colPnl:    { flex: 1,   fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" },
  colStatus: { width: 36, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" },
  journalCard: {
    border: "1px solid #e0e0f0",
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafaff",
  },
  journalCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "1px solid #e8e8f8",
  },
  journalSymbol: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
  },
  journalMeta: {
    fontSize: 8,
    color: "#888",
    marginBottom: 6,
  },
  journalPnl: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  journalTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  journalTag: {
    fontSize: 7,
    color: "#4d9fff",
    backgroundColor: "#eef4ff",
    padding: "2 6",
    borderRadius: 3,
  },
  journalText: {
    fontSize: 9,
    color: "#444",
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid #e0e0f0",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#aaa",
  },
  insightNote: {
    fontSize: 8,
    color: "#888",
    fontStyle: "italic",
    marginTop: 6,
  },
  emptyNote: {
    fontSize: 9,
    color: "#999",
    paddingVertical: 10,
  },
  dataHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f8",
    padding: "7 6",
    borderRadius: 4,
    marginBottom: 2,
  },
  dataRow: {
    flexDirection: "row",
    padding: "7 6",
    borderBottom: "1px solid #f4f4fc",
  },
  dataRowAlt: {
    flexDirection: "row",
    padding: "7 6",
    backgroundColor: "#fafaff",
    borderBottom: "1px solid #f4f4fc",
  },
  dh: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dc: { fontSize: 8, color: "#555" },
  dcBold: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1a1a2e" },
  dcRight: { fontSize: 8, color: "#555", textAlign: "right" },
  dcRightBold: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1a1a2e", textAlign: "right" },
});

function fmt(n: number) {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}

// Shared layout for the analysis tables added to the report.
const COLS = {
  label:   { width: 74 },
  labelSm: { width: 58 },
  num:     { width: 46, textAlign: "right" as const },
  numWide: { width: 58, textAlign: "right" as const },
  pct:     { width: 44, textAlign: "right" as const },
};

function SectionNote({ children }: { children: string }) {
  return <Text style={styles.insightNote}>{children}</Text>;
}

function MissingData({ children }: { children: string }) {
  return <Text style={styles.emptyNote}>{children}</Text>;
}

interface Props {
  trades: Trade[];
  account: Account | null;
  dateRange?: { from: string; to: string };
  logoUrl?: string;
  challenge?: ChallengeConfig | null;
  weekStart?: "sunday" | "monday";
  timeFormat?: "24h" | "12h";
  options?: {
    includeCover?: boolean;
    includeStats?: boolean;
    includeDailyBreakdown?: boolean;
    includeRisk?: boolean;
    includeRMultiples?: boolean;
    includeExecution?: boolean;
    includeProcess?: boolean;
    includePropFirm?: boolean;
    includeTiming?: boolean;
    includeInstruments?: boolean;
    includeTradeHistory?: boolean;
    includeJournal?: boolean;
  };
}

export default function TradingReportPDF({ trades, account, dateRange, logoUrl, challenge, weekStart = "monday", timeFormat = "24h", options = {} }: Props) {
  const {
    includeCover = true,
    includeStats = true,
    includeDailyBreakdown = true,
    includeRisk = true,
    includeRMultiples = true,
    includeExecution = true,
    includeProcess = true,
    includePropFirm = true,
    includeTiming = true,
    includeInstruments = true,
    includeTradeHistory = true,
    includeJournal = false,
  } = options;

  // Same maths the Analytics tab uses, so the report can never disagree with it.
  const s = buildReportStats(trades, account?.initialBalance ?? 0, weekStart);

  // Tier A + Tier B, the same functions the Analytics Process tab calls.
  const proc = {
    duration: byDuration(trades),
    gap: byReEntryGap(trades),
    direction: byDirection(trades),
    cost: costProfile(trades),
    recovery: recoveryFactor(s.totalPnl, s.maxDd),
    risk: rRiskProfile(s.rMs),
    stop: stopQuality(trades),
    reasons: byExitReason(trades),
    magic: byMagic(trades),
    legs: legStats(trades),
    cash: externalCashFlow(trades),
    durationCoverage: trades.filter((t) => durationMinutes(t) !== null).length,
    gapCoverage: trades.filter((t) => t.entryTime && t.exitTime).length,
    execCoverage: trades.filter((t) => t.exitReason || t.magic != null || t.legs != null || t.balanceAfter != null).length,
  };

  const propSim = challenge ? simulateChallenge(trades, challenge, 1000) : null;
  const prop = challenge && propSim
    ? {
        status: challengeStatus(trades, challenge),
        sim: propSim,
        plan: challengePlan(trades, challenge),
        roi: challengeROI(challenge, propSim.passRate),
      }
    : null;

  const byDay: Record<string, Trade[]> = {};
  for (const t of trades) {
    if (!byDay[t.date]) byDay[t.date] = [];
    byDay[t.date].push(t);
  }
  const days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));

  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const fromLabel = dateRange?.from || (trades.length > 0
    ? [...trades].sort((a, b) => a.date.localeCompare(b.date))[0].date : "—");
  const toLabel = dateRange?.to || (trades.length > 0
    ? [...trades].sort((a, b) => b.date.localeCompare(a.date))[0].date : "—");

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {includeCover && (
          <View style={styles.coverHeader}>
            <View style={styles.coverBrand}>
              {logoUrl
                ? <Image src={logoUrl} style={{ width: 210, height: 44 }} />
                : <Text style={styles.brandWordmark}>{tr("QuantEdge")}</Text>
              }
              <Text style={styles.brandSub}>{tr("Trading Performance Report")}</Text>
            </View>
          </View>
        )}

        {includeCover && (
          <View style={styles.coverMeta}>
            {account && (
              <>
                <View style={styles.coverMetaRow}>
                  <Text style={styles.coverMetaLabel}>{tr("Account")}</Text>
                  <Text style={styles.coverMetaValue}>{account.name}</Text>
                </View>
                <View style={styles.coverMetaRow}>
                  <Text style={styles.coverMetaLabel}>{tr("Platform")}</Text>
                  <Text style={styles.coverMetaValue}>{account.platform}</Text>
                </View>
              </>
            )}
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>{tr("Period")}</Text>
              <Text style={styles.coverMetaValue}>{fromLabel} — {toLabel}</Text>
            </View>
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>{tr("Generated")}</Text>
              <Text style={styles.coverMetaValue}>{generatedDate}</Text>
            </View>
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>{tr("Total Trades")}</Text>
              <Text style={styles.coverMetaValue}>{trades.length}</Text>
            </View>
          </View>
        )}

        {includeStats && (
          <>
            <Text style={styles.sectionTitle}>{tr("Performance Summary")}</Text>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Net P&L")}</Text>
                <Text style={s.totalPnl >= 0 ? styles.statValueGreen : styles.statValueRed}>{fmt(s.totalPnl)}</Text>
                <Text style={styles.statSub}>
                  {tr(s.returnPct === null ? `${trades.length} trades` : `${s.returnPct >= 0 ? "+" : ""}${s.returnPct.toFixed(2)}% · ${trades.length} trades`)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Win Rate")}</Text>
                <Text style={s.winRate >= 50 ? styles.statValueGreen : styles.statValueRed}>{s.winRate}%</Text>
                <Text style={styles.statSub}>{s.wins.length}W / {s.losses.length}L</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Avg Realised R")}</Text>
                <Text style={(s.avgRR ?? 0) > 0 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(s.avgRR === null ? "—" : `${s.avgRR >= 0 ? "+" : ""}${s.avgRR.toFixed(2)}R`)}
                </Text>
                <Text style={styles.statSub}>
                  {tr(s.rrCoverage > 0 ? `${s.rrCoverage} of ${trades.length} rated · BE = 0R` : "Not recorded")}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Expectancy")}</Text>
                <Text style={s.expectancyDollars >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {fmt(s.expectancyDollars)}
                </Text>
                <Text style={styles.statSub}>
                  {tr(s.expectancyR === null ? "per trade" : `${s.expectancyR >= 0 ? "+" : ""}${s.expectancyR.toFixed(2)}R per trade`)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("$/Hour")}</Text>
                <Text style={(s.hourlyRate ?? 0) >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(s.hourlyRate === null ? "—" : `${s.hourlyRate >= 0 ? "+" : ""}$${s.hourlyRate.toFixed(2)}`)}
                </Text>
                <Text style={styles.statSub}>
                  {tr(s.hourlyRate === null ? "Needs entry/exit times" : `over ${s.totalHours.toFixed(1)}h in market`)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Streaks")}</Text>
                <Text style={styles.statValueGreen}>
                  {s.maxWinStreak}W / {s.maxLossStreak}L
                </Text>
                <Text style={styles.statSub}>
                  {tr(s.currentType ? `now ${s.currentStreak} ${s.currentType}${s.currentStreak !== 1 ? "s" : ""}` : "longest run")}
                </Text>
              </View>
            </View>
          </>
        )}

        {includeDailyBreakdown && (
          <>
            <Text style={styles.sectionTitle}>{tr("Daily Breakdown")}</Text>
            {days.map(([date, dayTrades]) => {
              const dayPnl  = dayTrades.reduce((s, t) => s + t.pnl, 0);
              const dayWins = dayTrades.filter((t) => t.status === "win").length;
              return (
                <View key={date} style={styles.dayRow}>
                  <Text style={styles.dayDate}>{date}</Text>
                  <Text style={styles.dayTrades}>
                    {dayTrades.length}  {tr("trade")}{tr(dayTrades.length !== 1 ? "s" : "")} · {dayWins}W / {dayTrades.length - dayWins}L
                  </Text>
                  <Text style={[styles.dayPnl, { color: dayPnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                    {fmt(dayPnl)}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {includeRisk && (
          <>
            <Text style={styles.sectionTitle}>{tr("Risk & Drawdown")}</Text>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Max Drawdown")}</Text>
                <Text style={styles.statValueRed}>{fmt(s.maxDd)}</Text>
                <Text style={styles.statSub}>{s.maxDdPct.toFixed(2)}{tr("% from peak")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Sharpe")}</Text>
                <Text style={s.sharpe > 1 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(s.sharpe === 0 ? "—" : s.sharpe.toFixed(2))}
                </Text>
                <Text style={styles.statSub}>{tr(s.sharpe === 0 ? "Needs 5+ trading days" : "Risk-adjusted return")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Sortino")}</Text>
                <Text style={s.sortino > 1 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(s.sortino === 0 ? "—" : s.sortino.toFixed(2))}
                </Text>
                <Text style={styles.statSub}>{tr("Downside-adjusted")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Calmar")}</Text>
                <Text style={s.calmar > 1 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(s.calmar === 0 ? "—" : s.calmar.toFixed(2))}
                </Text>
                <Text style={styles.statSub}>{tr("Return / max drawdown")}</Text>
              </View>
            </View>

            {s.riskCoverage > 0 ? (
              <>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dh, COLS.label]}>{tr("Position Sizing")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>{tr("Value")}</Text>
                  <Text style={styles.dh}>{tr("Basis")}</Text>
                </View>
                {[
                  ["Avg planned risk", `$${s.avgRisk.toFixed(2)}`, `${s.riskPctAvg.toFixed(2)}% of balance`],
                  ["Risk range", `$${s.minRisk.toFixed(2)} – $${s.maxRisk.toFixed(2)}`, "smallest to largest stop"],
                  ["Risk consistency", `${s.riskConsistency.toFixed(0)}%`, s.riskConsistency >= 80 ? "sizing is deliberate" : "sizing drifts between trades"],
                  ["Stop breaches", String(s.stopBreaches), s.stopBreaches === 0 ? "no loss exceeded planned risk" : "losses past planned risk"],
                ].map(([label, value, basis], i) => (
                  <View key={label} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                    <Text style={[styles.dcBold, COLS.label]}>{label}</Text>
                    <Text style={[styles.dcRightBold, COLS.numWide]}>{value}</Text>
                    <Text style={styles.dc}>{basis}</Text>
                  </View>
                ))}
                <SectionNote>
                  {tr(`1R = $${s.avgRisk.toFixed(2)} across ${s.riskCoverage} of ${trades.length} trades. Set a stop loss in MetaTrader and re-run the exporter to raise this coverage.`)}
                </SectionNote>
              </>
            ) : (
              <MissingData>
                {tr("No stop loss recorded on these trades — planned risk, risk consistency and stop breaches need QuantEdgeExport.mq5 to be re-run with a stop set.")}</MissingData>
            )}
          </>
        )}

        {includeRMultiples && (
          <>
            <Text style={styles.sectionTitle}>{tr("R-Multiple Distribution")}</Text>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Avg R-Multiple")}</Text>
                <Text style={s.avgR >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(s.avgR >= 0 ? "+" : "")}{s.avgR.toFixed(2)}R
                </Text>
                <Text style={styles.statSub}>{tr("Mean outcome in R-units")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("1R Unit")}</Text>
                <Text style={styles.statValueGreen}>
                  {tr(s.rUnit > 0 ? `$${s.rUnit.toFixed(2)}` : "—")}
                </Text>
                <Text style={styles.statSub}>{tr(s.rUnitSource === "planned" ? "From your stop loss" : "Average loss (fallback)")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Expectancy")}</Text>
                <Text style={(s.expectancyR ?? 0) >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(s.expectancyR === null ? "—" : `${s.expectancyR >= 0 ? "+" : ""}${s.expectancyR.toFixed(2)}R`)}
                </Text>
                <Text style={styles.statSub}>{tr("Expected R per trade")}</Text>
              </View>
            </View>

            {s.rBuckets.length > 0 ? (
              <>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dh, COLS.labelSm]}>{tr("Bucket")}</Text>
                  <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                  <Text style={styles.dh}>{tr("Share")}</Text>
                </View>
                {s.rBuckets.map((b, i) => (
                  <View key={b.bucket} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                    <Text style={[styles.dcBold, COLS.labelSm]}>{b.bucket}</Text>
                    <Text style={[styles.dcRight, COLS.num]}>{b.count}</Text>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ flex: 1, height: 6, backgroundColor: "#f0f0f8", borderRadius: 3, overflow: "hidden" }}>
                        <View style={{
                          width: `${(b.count / trades.length) * 100}%`,
                          height: "100%",
                          backgroundColor: b.positive ? "#00b85e" : "#cc3355",
                        }} />
                      </View>
                      <Text style={{ fontSize: 7, color: "#888", width: 28, textAlign: "right" }}>
                        {Math.round((b.count / trades.length) * 100)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <MissingData>{tr("No R-multiples available for this period.")}</MissingData>
            )}
          </>
        )}

        {includeExecution && (
          <>
            <Text style={styles.sectionTitle}>{tr("Execution Quality")}</Text>
            {s.execCoverage > 0 ? (
              <>
                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{tr("Avg MAE")}</Text>
                    <Text style={styles.statValueRed}>${s.avgMae.toFixed(2)}</Text>
                    <Text style={styles.statSub}>{tr("Worst excursion against")}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{tr("Avg MFE")}</Text>
                    <Text style={styles.statValueGreen}>${s.avgMfe.toFixed(2)}</Text>
                    <Text style={styles.statSub}>{tr("Best excursion in favour")}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{tr("Entry Efficiency")}</Text>
                    <Text style={s.entryEff >= 60 ? styles.statValueGreen : styles.statValueRed}>{s.entryEff.toFixed(1)}%</Text>
                    <Text style={styles.statSub}>{tr("MFE / (MFE + MAE)")}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{tr("Exit Efficiency")}</Text>
                    <Text style={s.exitEff >= 60 ? styles.statValueGreen : styles.statValueRed}>{s.exitEff.toFixed(1)}%</Text>
                    <Text style={styles.statSub}>{tr("P&L / MFE on wins")}</Text>
                  </View>
                </View>
                <SectionNote>
                  {tr("Entry efficiency measures how close to optimal you entered. Exit efficiency measures how much of the available move you actually captured on winners.")}</SectionNote>
              </>
            ) : (
              <MissingData>
                {tr("No MAE/MFE data for this period. Run QuantEdgeExport.mq5 with excursion scanning enabled to populate it.")}</MissingData>
            )}
          </>
        )}

        {includeProcess && (
          <>
            <Text style={styles.sectionTitle}>{tr("Process Metrics")}</Text>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Recovery Factor")}</Text>
                <Text style={proc.recovery >= 1 ? styles.statValueGreen : styles.statValueRed}>{proc.recovery.toFixed(2)}</Text>
                <Text style={styles.statSub}>{tr("Net profit / max drawdown")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("R Std Dev")}</Text>
                <Text style={styles.statValueGreen}>{tr(proc.risk.sigma > 0 ? proc.risk.sigma.toFixed(2) : "—")}</Text>
                <Text style={styles.statSub}>{tr("Spread of R outcomes")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Ruin (approx)")}</Text>
                <Text style={proc.risk.sigma > 0 && proc.risk.ruinApprox * 100 <= 10 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(proc.risk.sigma > 0 ? `${(proc.risk.ruinApprox * 100).toFixed(1)}%` : "—")}
                </Text>
                <Text style={styles.statSub}>{tr("Fixed-sizing approximation")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Cost Ratio")}</Text>
                <Text style={proc.cost.costPctOfGross <= 10 ? styles.statValueGreen : styles.statValueRed}>{proc.cost.costPctOfGross.toFixed(2)}%</Text>
                <Text style={styles.statSub}>{fmt(-proc.cost.costs)}  {tr("in costs")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Stop Discipline")}</Text>
                <Text style={proc.stop.coverage > 0 && proc.stop.avgRatio < 1 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(proc.stop.coverage > 0 ? `${proc.stop.avgRatio.toFixed(2)} R` : "—")}
                </Text>
                <Text style={styles.statSub}>{tr("Avg MAE / planned risk")}</Text>
              </View>
            </View>

            {proc.durationCoverage > 0 && (
              <>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dh, COLS.label]}>{tr("Hold time")}</Text>
                  <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                  <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>{tr("Avg P&L")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
                </View>
                {proc.duration.map((b, i) => (
                  <View key={b.bucket} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                    <Text style={[styles.dcBold, COLS.label]}>{b.bucket}</Text>
                    <Text style={[styles.dcRight, COLS.num]}>{b.trades}</Text>
                    <Text style={[styles.dcRight, COLS.pct]}>{b.winRate}%</Text>
                    <Text style={[styles.dcRight, COLS.numWide]}>{fmt(b.avgPnl)}</Text>
                    <Text style={[styles.dcRightBold, COLS.numWide, { color: b.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>{fmt(b.pnl)}</Text>
                  </View>
                ))}
              </>
            )}

            {proc.direction.some((d) => d.trades > 0) && (
              <>
                <View style={[styles.dataHeader, { marginTop: 14 }]}>
                  <Text style={[styles.dh, COLS.label]}>{tr("Direction")}</Text>
                  <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                  <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>{tr("Avg P&L")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
                </View>
                {proc.direction.map((b, i) => (
                  <View key={b.bucket} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                    <Text style={[styles.dcBold, COLS.label]}>{b.bucket}</Text>
                    <Text style={[styles.dcRight, COLS.num]}>{b.trades}</Text>
                    <Text style={[styles.dcRight, COLS.pct]}>{b.winRate}%</Text>
                    <Text style={[styles.dcRight, COLS.numWide]}>{fmt(b.avgPnl)}</Text>
                    <Text style={[styles.dcRightBold, COLS.numWide, { color: b.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>{fmt(b.pnl)}</Text>
                  </View>
                ))}
              </>
            )}

            {proc.gapCoverage > 1 && (
              <>
                <View style={[styles.dataHeader, { marginTop: 14 }]}>
                  <Text style={[styles.dh, COLS.label]}>{tr("Re-entry gap")}</Text>
                  <Text style={[styles.dh, COLS.num]}>{tr("After W")}</Text>
                  <Text style={[styles.dh, COLS.num]}>{tr("After L")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>W P&L</Text>
                  <Text style={[styles.dh, COLS.numWide]}>L P&L</Text>
                </View>
                {proc.gap.map((g, i) => (
                  <View key={g.bucket} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                    <Text style={[styles.dcBold, COLS.label]}>{g.bucket}</Text>
                    <Text style={[styles.dcRight, COLS.num]}>{g.afterWin.trades}</Text>
                    <Text style={[styles.dcRight, COLS.num]}>{g.afterLoss.trades}</Text>
                    <Text style={[styles.dcRight, COLS.numWide, { color: g.afterWin.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>{fmt(g.afterWin.pnl)}</Text>
                    <Text style={[styles.dcRight, COLS.numWide, { color: g.afterLoss.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>{fmt(g.afterLoss.pnl)}</Text>
                  </View>
                ))}
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{tr("Execution Detail")}</Text>
            {proc.execCoverage === 0 ? (
              <MissingData>
                {tr("No execution data in this period. Re-run QuantEdgeExport.mq5 and re-import to populate exit reason, magic number, entry legs and balance.")}</MissingData>
            ) : (
              <>
                {proc.reasons.length > 0 && (
                  <>
                    <View style={styles.dataHeader}>
                      <Text style={[styles.dh, COLS.label]}>{tr("How it ended")}</Text>
                      <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                      <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
                      <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
                    </View>
                    {proc.reasons.map((b, i) => (
                      <View key={b.bucket} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                        <Text style={[styles.dcBold, COLS.label]}>{b.bucket}</Text>
                        <Text style={[styles.dcRight, COLS.num]}>{b.trades}</Text>
                        <Text style={[styles.dcRight, COLS.pct]}>{b.winRate}%</Text>
                        <Text style={[styles.dcRightBold, COLS.numWide, { color: b.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>{fmt(b.pnl)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {proc.magic.length > 0 && (
                  <>
                    <View style={[styles.dataHeader, { marginTop: 14 }]}>
                      <Text style={[styles.dh, COLS.label]}>{tr("Manual / EA")}</Text>
                      <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                      <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
                      <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
                    </View>
                    {proc.magic.map((b, i) => (
                      <View key={b.bucket} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                        <Text style={[styles.dcBold, COLS.label]}>{b.bucket}</Text>
                        <Text style={[styles.dcRight, COLS.num]}>{b.trades}</Text>
                        <Text style={[styles.dcRight, COLS.pct]}>{b.winRate}%</Text>
                        <Text style={[styles.dcRightBold, COLS.numWide, { color: b.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>{fmt(b.pnl)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {proc.legs.coverage > 0 && (
                  <>
                    <View style={[styles.dataHeader, { marginTop: 14 }]}>
                      <Text style={[styles.dh, COLS.label]}>{tr("Position building")}</Text>
                      <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                      <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
                      <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
                    </View>
                    {[proc.legs.singleLeg, proc.legs.multiLeg, proc.legs.averagedDown].map((b, i) => (
                      <View key={b.bucket} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                        <Text style={[styles.dcBold, COLS.label]}>{b.bucket}</Text>
                        <Text style={[styles.dcRight, COLS.num]}>{b.trades}</Text>
                        <Text style={[styles.dcRight, COLS.pct]}>{b.winRate}%</Text>
                        <Text style={[styles.dcRightBold, COLS.numWide, { color: b.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>{fmt(b.pnl)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {proc.cash.coverage > 0 && (
                  <>
                    <View style={[styles.dataHeader, { marginTop: 14 }]}>
                      <Text style={[styles.dh, COLS.label]}>{tr("Account reconciliation")}</Text>
                      <Text style={styles.dh}>{tr("Value")}</Text>
                    </View>
                    {[
                      ["Net external flow", fmt(proc.cash.netFlow), proc.cash.netFlow === 0 ? "#1a1a2e" : proc.cash.netFlow > 0 ? "#00b85e" : "#cc3355"],
                      ["Deposits", `$${proc.cash.deposits.toFixed(2)}`, "#1a1a2e"],
                      ["Withdrawals", `$${proc.cash.withdrawals.toFixed(2)}`, "#1a1a2e"],
                    ].map(([label, value, color], i) => (
                      <View key={label} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                        <Text style={[styles.dcBold, COLS.label]}>{label}</Text>
                        <Text style={[styles.dcRight, { flex: 1, color }]}>{value}</Text>
                      </View>
                    ))}
                  </>
                )}

                <SectionNote>
                  {tr("Exit reason and magic number are recorded by MetaTrader, not inferred. Reconciliation compares the balance the exporter recorded against each trade's own P&L, so a non-zero flow means cash moved outside trading.")}</SectionNote>
              </>
            )}
          </>
        )}

        {includePropFirm && prop && challenge && (
          <>
            <Text style={styles.sectionTitle}>{tr("Prop Firm Evaluation")}</Text>
            <View style={styles.dataHeader}>
              <Text style={[styles.dh, { width: 110 }]}>{tr("Rule")}</Text>
              <Text style={[styles.dh, { width: 150 }]}>{tr("Setting")}</Text>
              <Text style={styles.dh}>{tr("Standing")}</Text>
            </View>
            {[
              ["Profit target", `${targetPctFor(challenge)}% · $${prop.status.targetAmount.toFixed(2)}`, `${prop.status.profitProgress.toFixed(1)}% reached`],
              ["Max drawdown", `${challenge.maxDdPct}% ${challenge.ddMode}`, `$${prop.status.ddUsed.toFixed(2)} of $${prop.status.ddAllowed.toFixed(2)}`],
              ["Daily limit", challenge.dailyLimitPct > 0 ? `${challenge.dailyLimitPct}%` : "none", challenge.dailyLimitPct > 0 ? `worst ${fmt(prop.status.worstDayPnl)}` : "—"],
              ["Min trading days", challenge.minDays > 0 ? `${challenge.minDays} days` : "none", `${prop.status.tradingDays} days`],
              ["Time limit", challenge.maxDays ? `${challenge.maxDays} days` : "none", prop.plan.remainingDays != null ? `${prop.plan.remainingDays} left` : "—"],
              ["Consistency", challenge.consistencyPct != null ? `${challenge.consistencyPct}% of profit` : "not a rule", challenge.consistencyPct != null ? `${prop.status.consistencyShare.toFixed(1)}%` : "—"],
            ].map(([a, b, c], i) => (
              <View key={a} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                <Text style={[styles.dcBold, { width: 110 }]}>{a}</Text>
                <Text style={[styles.dc, { width: 150 }]}>{b}</Text>
                <Text style={[styles.dc, { flex: 1 }]}>{c}</Text>
              </View>
            ))}

            <View style={[styles.statRow, { marginTop: 16 }]}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Pass Probability")}</Text>
                <Text style={prop.sim.passRate >= 0.5 ? styles.statValueGreen : styles.statValueRed}>{(prop.sim.passRate * 100).toFixed(1)}%</Text>
                <Text style={styles.statSub}>{prop.sim.runs}  {tr("simulated attempts")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Fail: Drawdown")}</Text>
                <Text style={styles.statValueRed}>{(prop.sim.failDrawdown * 100).toFixed(1)}%</Text>
                <Text style={styles.statSub}>{tr("Daily limit")} {(prop.sim.failDaily * 100).toFixed(1)}%</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("Median Days")}</Text>
                <Text style={styles.statValueGreen}>{tr(prop.sim.medianDaysToPass != null ? `${prop.sim.medianDaysToPass}` : "—")}</Text>
                <Text style={styles.statSub}>{tr("Trading days to pass")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{tr("ROI on Fee")}</Text>
                <Text style={prop.roi.roiPct >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {tr(prop.roi.roiPct >= 0 ? "+" : "")}{prop.roi.roiPct.toFixed(1)}%
                </Text>
                <Text style={styles.statSub}>${prop.roi.expectedPayout.toFixed(2)}  {tr("expected payout")}</Text>
              </View>
            </View>

            <SectionNote>
              {tr(prop.sim.tooFew
                ? `Only ${prop.sim.sampleTrades} trades sampled across ${prop.sim.sampleDays} days — treat the pass rate as a direction, not a number.`
                : `Bootstrap over ${prop.sim.sampleTrades} trades across ${prop.sim.sampleDays} days, walked through every rule. Intraday drawdown is approximated from closed trades.`)}
            </SectionNote>
          </>
        )}

        {includePropFirm && !(prop && challenge) && (
          <MissingData>
            {tr("No prop-firm rules saved. Configure the Prop Firm tab in Analytics, then export again.")}</MissingData>
        )}

        {includeInstruments && s.instruments.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{tr("Instrument Breakdown")}</Text>
            <View style={styles.dataHeader}>
              <Text style={[styles.dh, COLS.label]}>{tr("Instrument")}</Text>
              <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
              <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
              <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
              <Text style={[styles.dh, COLS.numWide]}>{tr("Avg R")}</Text>
              <Text style={[styles.dh, COLS.numWide]}>{tr("Best")}</Text>
              <Text style={[styles.dh, COLS.numWide]}>{tr("Worst")}</Text>
            </View>
            {s.instruments.map((r, i) => (
              <View key={r.symbol} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                <Text style={[styles.dcBold, COLS.label]}>{r.symbol}</Text>
                <Text style={[styles.dcRight, COLS.num]}>{r.trades}</Text>
                <Text style={[styles.dcRight, COLS.pct]}>{r.winRate}%</Text>
                <Text style={[styles.dcRightBold, COLS.numWide, { color: r.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                  {fmt(r.pnl)}
                </Text>
                <Text style={[styles.dcRight, COLS.numWide]}>{tr(r.avgR === null ? "—" : `${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R`)}</Text>
                <Text style={[styles.dcRight, COLS.numWide]}>{fmt(r.best)}</Text>
                <Text style={[styles.dcRight, COLS.numWide]}>{fmt(r.worst)}</Text>
              </View>
            ))}
          </>
        )}

        {includeTiming && (s.hourData.length > 0 || s.dowData.some((d) => d.count > 0)) && (
          <>
            <Text style={styles.sectionTitle}>{tr("Timing")}</Text>

            {s.hourData.length > 0 && (
              <>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dh, COLS.labelSm]}>{tr("Hour (24h)")}</Text>
                  <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                  <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
                  <Text style={styles.dh}>{tr("Relative strength")}</Text>
                </View>
                {[...s.hourData].sort((a, b) => b.totalPnl - a.totalPnl).map((h, i) => {
                  const peak = Math.max(...s.hourData.map((x) => Math.abs(x.totalPnl)), 1);
                  return (
                    <View key={h.hour} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                      <Text style={[styles.dcBold, COLS.labelSm]}>{tr(h.label)}</Text>
                      <Text style={[styles.dcRight, COLS.num]}>{h.count}</Text>
                      <Text style={[styles.dcRight, COLS.pct]}>{h.winRate}%</Text>
                      <Text style={[styles.dcRightBold, COLS.numWide, { color: h.totalPnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                        {fmt(h.totalPnl)}
                      </Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: "#f0f0f8", borderRadius: 3, overflow: "hidden" }}>
                        <View style={{
                          width: `${(Math.abs(h.totalPnl) / peak) * 100}%`,
                          height: "100%",
                          backgroundColor: h.totalPnl >= 0 ? "#00b85e" : "#cc3355",
                        }} />
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {s.dowData.some((d) => d.count > 0) && (
              <>
                <View style={[styles.dataHeader, { marginTop: 14 }]}>
                  <Text style={[styles.dh, COLS.labelSm]}>{tr("Weekday")}</Text>
                  <Text style={[styles.dh, COLS.num]}>{tr("Trades")}</Text>
                  <Text style={[styles.dh, COLS.pct]}>{tr("Win %")}</Text>
                  <Text style={[styles.dh, COLS.numWide]}>{tr("Net P&L")}</Text>
                  <Text style={styles.dh}>{tr("Relative strength")}</Text>
                </View>
                {[...s.dowData].filter((d) => d.count > 0).map((d, i) => {
                  const peak = Math.max(...s.dowData.map((x) => Math.abs(x.pnl)), 1);
                  return (
                    <View key={d.day} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                      <Text style={[styles.dcBold, COLS.labelSm]}>{d.day}</Text>
                      <Text style={[styles.dcRight, COLS.num]}>{d.count}</Text>
                      <Text style={[styles.dcRight, COLS.pct]}>{d.wr}%</Text>
                      <Text style={[styles.dcRightBold, COLS.numWide, { color: d.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                        {fmt(d.pnl)}
                      </Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: "#f0f0f8", borderRadius: 3, overflow: "hidden" }}>
                        <View style={{
                          width: `${(Math.abs(d.pnl) / peak) * 100}%`,
                          height: "100%",
                          backgroundColor: d.pnl >= 0 ? "#00b85e" : "#cc3355",
                        }} />
                      </View>
                    </View>
                  );
                })}
              </>
            )}
            <SectionNote>{tr("Ranked by net contribution. Hours are shown in the 24-hour clock, matching MetaTrader.")}</SectionNote>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{tr("QuantEdge — Trading Performance Report")}</Text>
          <Text style={styles.footerText}>{generatedDate}</Text>
        </View>
      </Page>

      {includeTradeHistory && (
        <Page size="A4" style={{ ...styles.page, paddingTop: 36 }}>
          <Text style={styles.sectionTitle}>{tr("Trade History")}</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.colDate,   styles.colHeaderText]}>{tr("Date")}</Text>
            <Text style={[styles.colSymbol, styles.colHeaderText]}>{tr("Symbol")}</Text>
            <Text style={[styles.colType,   styles.colHeaderText]}>{tr("Type")}</Text>
            <Text style={[styles.colStrike, styles.colHeaderText]}>{tr("Strike")}</Text>
            <Text style={[styles.colExpiry, styles.colHeaderText]}>{tr("Expiry")}</Text>
            <Text style={[styles.colQty,    styles.colHeaderText]}>{tr("Qty")}</Text>
            <Text style={[styles.colEntry,  styles.colHeaderText]}>{tr("Entry")}</Text>
            <Text style={[styles.colExit,   styles.colHeaderText]}>{tr("Exit")}</Text>
            <Text style={[styles.colPnl,    styles.colHeaderText]}>P&L</Text>
            <Text style={[styles.colStatus, styles.colHeaderText]}>{tr("Result")}</Text>
          </View>

          {trades.map((t, i) => (
            <View
              key={t.id}
              style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              wrap={false}
            >
              <Text style={styles.colDate}>{t.date}</Text>
              <Text style={styles.colSymbol}>{t.underlying}</Text>
              <Text style={styles.colType}>
                {t.optionType ? t.optionType.toUpperCase() : t.type.toUpperCase()}
              </Text>
              <Text style={styles.colStrike}>{tr(t.strike ? `$${t.strike}` : "—")}</Text>
              <Text style={styles.colExpiry}>{t.expiry || "—"}</Text>
              <Text style={styles.colQty}>{t.quantity}</Text>
              <Text style={styles.colEntry}>${t.entryPrice}</Text>
              <Text style={styles.colExit}>${t.exitPrice}</Text>
              <Text style={[styles.colPnl, { color: t.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                {fmt(t.pnl)}
              </Text>
              <Text style={[styles.colStatus, { color: t.status === "win" ? "#00b85e" : "#cc3355" }]}>
                {t.status.toUpperCase()}
              </Text>
            </View>
          ))}

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>{tr("QuantEdge — Trading Performance Report")}</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              fixed
            />
          </View>
        </Page>
      )}

      {includeJournal && (() => {
        const journalTrades = trades.filter((t) => t.journalEntry && t.journalEntry.trim().length > 0);
        if (journalTrades.length === 0) return null;
        return (
          <Page size="A4" style={{ ...styles.page, paddingTop: 36 }}>
            <Text style={styles.sectionTitle}>{tr("Journal Entries")}</Text>
            <Text style={{ fontSize: 9, color: "#888", marginBottom: 16 }}>
              {journalTrades.length}  {tr("trade")}{tr(journalTrades.length !== 1 ? "s" : "")} {tr("with journal notes")}</Text>

            {journalTrades.map((t) => {
              const tags = Array.isArray(t.tags) ? t.tags as string[] : [];
              return (
                <View key={t.id} style={styles.journalCard} wrap={false}>
                  <View style={styles.journalCardHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.journalSymbol}>{t.underlying}</Text>
                      <Text style={{ fontSize: 8, color: "#888" }}>
                        {t.optionType ? t.optionType.toUpperCase() : t.type.toUpperCase()}
                        {tr(t.strike ? ` · $${t.strike}` : "")}
                        {tr(t.expiry ? ` · ${t.expiry}` : "")}
                      </Text>
                    </View>
                    <Text style={[styles.journalPnl, { color: t.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                      {tr(t.pnl >= 0 ? "+" : "")}${t.pnl.toFixed(2)}
                    </Text>
                  </View>

                  <Text style={styles.journalMeta}>
                    {t.date}{tr(t.entryTime ? ` · Entry ${formatTime(t.entryTime, timeFormat)}` : "")}{tr(t.exitTime ? ` · Exit ${formatTime(t.exitTime, timeFormat)}` : "")}{tr(t.rr ? ` · R:R ${t.rr}` : "")}
                  </Text>

                  {tags.length > 0 && (
                    <View style={styles.journalTagRow}>
                      {tags.map((tag) => (
                        <Text key={tag} style={styles.journalTag}>{tag}</Text>
                      ))}
                    </View>
                  )}

                  <Text style={styles.journalText}>{t.journalEntry}</Text>
                </View>
              );
            })}

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>{tr("QuantEdge — Trading Performance Report")}</Text>
              <Text
                style={styles.footerText}
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
                fixed
              />
            </View>
          </Page>
        );
      })()}
    </Document>
  );
}