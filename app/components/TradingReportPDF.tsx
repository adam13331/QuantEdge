"use client";
import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import { Trade, Account } from "../lib/types";
import { buildReportStats } from "../lib/analytics";

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
  options?: {
    includeCover?: boolean;
    includeStats?: boolean;
    includeDailyBreakdown?: boolean;
    includeRisk?: boolean;
    includeRMultiples?: boolean;
    includeExecution?: boolean;
    includeTiming?: boolean;
    includeInstruments?: boolean;
    includeTradeHistory?: boolean;
    includeJournal?: boolean;
  };
}

export default function TradingReportPDF({ trades, account, dateRange, logoUrl, options = {} }: Props) {
  const {
    includeCover = true,
    includeStats = true,
    includeDailyBreakdown = true,
    includeRisk = true,
    includeRMultiples = true,
    includeExecution = true,
    includeTiming = true,
    includeInstruments = true,
    includeTradeHistory = true,
    includeJournal = false,
  } = options;

  // Same maths the Analytics tab uses, so the report can never disagree with it.
  const s = buildReportStats(trades, account?.initialBalance ?? 0);

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
                : <Text style={styles.brandWordmark}>journedge</Text>
              }
              <Text style={styles.brandSub}>Trading Performance Report</Text>
            </View>
          </View>
        )}

        {includeCover && (
          <View style={styles.coverMeta}>
            {account && (
              <>
                <View style={styles.coverMetaRow}>
                  <Text style={styles.coverMetaLabel}>Account</Text>
                  <Text style={styles.coverMetaValue}>{account.name}</Text>
                </View>
                <View style={styles.coverMetaRow}>
                  <Text style={styles.coverMetaLabel}>Platform</Text>
                  <Text style={styles.coverMetaValue}>{account.platform}</Text>
                </View>
              </>
            )}
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Period</Text>
              <Text style={styles.coverMetaValue}>{fromLabel} — {toLabel}</Text>
            </View>
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Generated</Text>
              <Text style={styles.coverMetaValue}>{generatedDate}</Text>
            </View>
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>Total Trades</Text>
              <Text style={styles.coverMetaValue}>{trades.length}</Text>
            </View>
          </View>
        )}

        {includeStats && (
          <>
            <Text style={styles.sectionTitle}>Performance Summary</Text>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Net P&L</Text>
                <Text style={s.totalPnl >= 0 ? styles.statValueGreen : styles.statValueRed}>{fmt(s.totalPnl)}</Text>
                <Text style={styles.statSub}>
                  {s.returnPct === null ? `${trades.length} trades` : `${s.returnPct >= 0 ? "+" : ""}${s.returnPct.toFixed(2)}% · ${trades.length} trades`}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Win Rate</Text>
                <Text style={s.winRate >= 50 ? styles.statValueGreen : styles.statValueRed}>{s.winRate}%</Text>
                <Text style={styles.statSub}>{s.wins.length}W / {s.losses.length}L</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg R:R</Text>
                <Text style={(s.avgRR ?? 0) >= 1 ? styles.statValueGreen : styles.statValueRed}>
                  {s.avgRR === null ? "—" : `${s.avgRR >= 0 ? "+" : ""}${s.avgRR.toFixed(2)}R`}
                </Text>
                <Text style={styles.statSub}>
                  {s.rrCoverage > 0 ? `${s.rrCoverage} of ${trades.length} rated` : "Not recorded"}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Expectancy</Text>
                <Text style={s.expectancyDollars >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {fmt(s.expectancyDollars)}
                </Text>
                <Text style={styles.statSub}>
                  {s.expectancyR === null ? "per trade" : `${s.expectancyR >= 0 ? "+" : ""}${s.expectancyR.toFixed(2)}R per trade`}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>$/Hour</Text>
                <Text style={(s.hourlyRate ?? 0) >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {s.hourlyRate === null ? "—" : `${s.hourlyRate >= 0 ? "+" : ""}$${s.hourlyRate.toFixed(2)}`}
                </Text>
                <Text style={styles.statSub}>
                  {s.hourlyRate === null ? "Needs entry/exit times" : `over ${s.totalHours.toFixed(1)}h in market`}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Streaks</Text>
                <Text style={styles.statValueGreen}>
                  {s.maxWinStreak}W / {s.maxLossStreak}L
                </Text>
                <Text style={styles.statSub}>
                  {s.currentType ? `now ${s.currentStreak} ${s.currentType}${s.currentStreak !== 1 ? "s" : ""}` : "longest run"}
                </Text>
              </View>
            </View>
          </>
        )}

        {includeDailyBreakdown && (
          <>
            <Text style={styles.sectionTitle}>Daily Breakdown</Text>
            {days.map(([date, dayTrades]) => {
              const dayPnl  = dayTrades.reduce((s, t) => s + t.pnl, 0);
              const dayWins = dayTrades.filter((t) => t.status === "win").length;
              return (
                <View key={date} style={styles.dayRow}>
                  <Text style={styles.dayDate}>{date}</Text>
                  <Text style={styles.dayTrades}>
                    {dayTrades.length} trade{dayTrades.length !== 1 ? "s" : ""} · {dayWins}W / {dayTrades.length - dayWins}L
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
            <Text style={styles.sectionTitle}>Risk &amp; Drawdown</Text>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Max Drawdown</Text>
                <Text style={styles.statValueRed}>{fmt(s.maxDd)}</Text>
                <Text style={styles.statSub}>{s.maxDdPct.toFixed(2)}% from peak</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Sharpe</Text>
                <Text style={s.sharpe > 1 ? styles.statValueGreen : styles.statValueRed}>
                  {s.sharpe === 0 ? "—" : s.sharpe.toFixed(2)}
                </Text>
                <Text style={styles.statSub}>{s.sharpe === 0 ? "Needs 5+ trading days" : "Risk-adjusted return"}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Sortino</Text>
                <Text style={s.sortino > 1 ? styles.statValueGreen : styles.statValueRed}>
                  {s.sortino === 0 ? "—" : s.sortino.toFixed(2)}
                </Text>
                <Text style={styles.statSub}>Downside-adjusted</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Calmar</Text>
                <Text style={s.calmar > 1 ? styles.statValueGreen : styles.statValueRed}>
                  {s.calmar === 0 ? "—" : s.calmar.toFixed(2)}
                </Text>
                <Text style={styles.statSub}>Return / max drawdown</Text>
              </View>
            </View>

            {s.riskCoverage > 0 ? (
              <>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dh, COLS.label]}>Position Sizing</Text>
                  <Text style={[styles.dh, COLS.numWide]}>Value</Text>
                  <Text style={styles.dh}>Basis</Text>
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
                  {`1R = $${s.avgRisk.toFixed(2)} across ${s.riskCoverage} of ${trades.length} trades. Set a stop loss in MetaTrader and re-run the exporter to raise this coverage.`}
                </SectionNote>
              </>
            ) : (
              <MissingData>
                No stop loss recorded on these trades — planned risk, risk consistency and stop breaches need JournedgeExport.mq5 to be re-run with a stop set.
              </MissingData>
            )}
          </>
        )}

        {includeRMultiples && (
          <>
            <Text style={styles.sectionTitle}>R-Multiple Distribution</Text>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg R-Multiple</Text>
                <Text style={s.avgR >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {s.avgR >= 0 ? "+" : ""}{s.avgR.toFixed(2)}R
                </Text>
                <Text style={styles.statSub}>Mean outcome in R-units</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>1R Unit</Text>
                <Text style={styles.statValueGreen}>
                  {s.rUnit > 0 ? `$${s.rUnit.toFixed(2)}` : "—"}
                </Text>
                <Text style={styles.statSub}>{s.rUnitSource === "planned" ? "From your stop loss" : "Average loss (fallback)"}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Expectancy</Text>
                <Text style={(s.expectancyR ?? 0) >= 0 ? styles.statValueGreen : styles.statValueRed}>
                  {s.expectancyR === null ? "—" : `${s.expectancyR >= 0 ? "+" : ""}${s.expectancyR.toFixed(2)}R`}
                </Text>
                <Text style={styles.statSub}>Expected R per trade</Text>
              </View>
            </View>

            {s.rBuckets.length > 0 ? (
              <>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dh, COLS.labelSm]}>Bucket</Text>
                  <Text style={[styles.dh, COLS.num]}>Trades</Text>
                  <Text style={styles.dh}>Share</Text>
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
              <MissingData>No R-multiples available for this period.</MissingData>
            )}
          </>
        )}

        {includeExecution && (
          <>
            <Text style={styles.sectionTitle}>Execution Quality</Text>
            {s.execCoverage > 0 ? (
              <>
                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Avg MAE</Text>
                    <Text style={styles.statValueRed}>${s.avgMae.toFixed(2)}</Text>
                    <Text style={styles.statSub}>Worst excursion against</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Avg MFE</Text>
                    <Text style={styles.statValueGreen}>${s.avgMfe.toFixed(2)}</Text>
                    <Text style={styles.statSub}>Best excursion in favour</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Entry Efficiency</Text>
                    <Text style={s.entryEff >= 60 ? styles.statValueGreen : styles.statValueRed}>{s.entryEff.toFixed(1)}%</Text>
                    <Text style={styles.statSub}>MFE / (MFE + MAE)</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Exit Efficiency</Text>
                    <Text style={s.exitEff >= 60 ? styles.statValueGreen : styles.statValueRed}>{s.exitEff.toFixed(1)}%</Text>
                    <Text style={styles.statSub}>P&amp;L / MFE on wins</Text>
                  </View>
                </View>
                <SectionNote>
                  Entry efficiency measures how close to optimal you entered. Exit efficiency measures how much of the available move you actually captured on winners.
                </SectionNote>
              </>
            ) : (
              <MissingData>
                No MAE/MFE data for this period. Run JournedgeExport.mq5 with excursion scanning enabled to populate it.
              </MissingData>
            )}
          </>
        )}

        {includeInstruments && s.instruments.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Instrument Breakdown</Text>
            <View style={styles.dataHeader}>
              <Text style={[styles.dh, COLS.label]}>Instrument</Text>
              <Text style={[styles.dh, COLS.num]}>Trades</Text>
              <Text style={[styles.dh, COLS.pct]}>Win %</Text>
              <Text style={[styles.dh, COLS.numWide]}>Net P&amp;L</Text>
              <Text style={[styles.dh, COLS.numWide]}>Avg R</Text>
              <Text style={[styles.dh, COLS.numWide]}>Best</Text>
              <Text style={[styles.dh, COLS.numWide]}>Worst</Text>
            </View>
            {s.instruments.map((r, i) => (
              <View key={r.symbol} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                <Text style={[styles.dcBold, COLS.label]}>{r.symbol}</Text>
                <Text style={[styles.dcRight, COLS.num]}>{r.trades}</Text>
                <Text style={[styles.dcRight, COLS.pct]}>{r.winRate}%</Text>
                <Text style={[styles.dcRightBold, COLS.numWide, { color: r.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                  {fmt(r.pnl)}
                </Text>
                <Text style={[styles.dcRight, COLS.numWide]}>{r.avgR === null ? "—" : `${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R`}</Text>
                <Text style={[styles.dcRight, COLS.numWide]}>{fmt(r.best)}</Text>
                <Text style={[styles.dcRight, COLS.numWide]}>{fmt(r.worst)}</Text>
              </View>
            ))}
          </>
        )}

        {includeTiming && (s.hourData.length > 0 || s.dowData.some((d) => d.count > 0)) && (
          <>
            <Text style={styles.sectionTitle}>Timing</Text>

            {s.hourData.length > 0 && (
              <>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dh, COLS.labelSm]}>Hour (24h)</Text>
                  <Text style={[styles.dh, COLS.num]}>Trades</Text>
                  <Text style={[styles.dh, COLS.pct]}>Win %</Text>
                  <Text style={[styles.dh, COLS.numWide]}>Net P&amp;L</Text>
                  <Text style={styles.dh}>Relative strength</Text>
                </View>
                {[...s.hourData].sort((a, b) => b.totalPnl - a.totalPnl).map((h, i) => {
                  const peak = Math.max(...s.hourData.map((x) => Math.abs(x.totalPnl)), 1);
                  return (
                    <View key={h.hour} style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt}>
                      <Text style={[styles.dcBold, COLS.labelSm]}>{h.label}</Text>
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
                  <Text style={[styles.dh, COLS.labelSm]}>Weekday</Text>
                  <Text style={[styles.dh, COLS.num]}>Trades</Text>
                  <Text style={[styles.dh, COLS.pct]}>Win %</Text>
                  <Text style={[styles.dh, COLS.numWide]}>Net P&amp;L</Text>
                  <Text style={styles.dh}>Relative strength</Text>
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
            <SectionNote>Ranked by net contribution. Hours are shown in the 24-hour clock, matching MetaTrader.</SectionNote>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Journedge — Trading Performance Report</Text>
          <Text style={styles.footerText}>{generatedDate}</Text>
        </View>
      </Page>

      {includeTradeHistory && (
        <Page size="A4" style={{ ...styles.page, paddingTop: 36 }}>
          <Text style={styles.sectionTitle}>Trade History</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.colDate,   styles.colHeaderText]}>Date</Text>
            <Text style={[styles.colSymbol, styles.colHeaderText]}>Symbol</Text>
            <Text style={[styles.colType,   styles.colHeaderText]}>Type</Text>
            <Text style={[styles.colStrike, styles.colHeaderText]}>Strike</Text>
            <Text style={[styles.colExpiry, styles.colHeaderText]}>Expiry</Text>
            <Text style={[styles.colQty,    styles.colHeaderText]}>Qty</Text>
            <Text style={[styles.colEntry,  styles.colHeaderText]}>Entry</Text>
            <Text style={[styles.colExit,   styles.colHeaderText]}>Exit</Text>
            <Text style={[styles.colPnl,    styles.colHeaderText]}>P&L</Text>
            <Text style={[styles.colStatus, styles.colHeaderText]}>Result</Text>
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
              <Text style={styles.colStrike}>{t.strike ? `$${t.strike}` : "—"}</Text>
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
            <Text style={styles.footerText}>Journedge — Trading Performance Report</Text>
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
            <Text style={styles.sectionTitle}>Journal Entries</Text>
            <Text style={{ fontSize: 9, color: "#888", marginBottom: 16 }}>
              {journalTrades.length} trade{journalTrades.length !== 1 ? "s" : ""} with journal notes
            </Text>

            {journalTrades.map((t) => {
              const tags = Array.isArray(t.tags) ? t.tags as string[] : [];
              return (
                <View key={t.id} style={styles.journalCard} wrap={false}>
                  <View style={styles.journalCardHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.journalSymbol}>{t.underlying}</Text>
                      <Text style={{ fontSize: 8, color: "#888" }}>
                        {t.optionType ? t.optionType.toUpperCase() : t.type.toUpperCase()}
                        {t.strike ? ` · $${t.strike}` : ""}
                        {t.expiry ? ` · ${t.expiry}` : ""}
                      </Text>
                    </View>
                    <Text style={[styles.journalPnl, { color: t.pnl >= 0 ? "#00b85e" : "#cc3355" }]}>
                      {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                    </Text>
                  </View>

                  <Text style={styles.journalMeta}>
                    {t.date}{t.entryTime ? ` · Entry ${t.entryTime}` : ""}{t.exitTime ? ` · Exit ${t.exitTime}` : ""}{t.rr ? ` · R:R ${t.rr}` : ""}
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
              <Text style={styles.footerText}>Journedge — Trading Performance Report</Text>
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