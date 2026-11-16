"use client";
import { t as tr } from "../lib/i18n";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Calendar, BarChart2, AlertTriangle, Plus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useSettings } from "../hooks/useSettings";
import {
  leadingBlanks, weekdayHeaders, monthWeeks, dayRisk, byDirection,
  averageLoss, tradeR, normalizeDate, SAMPLE_FLOOR,
} from "../lib/analytics";
import { formatTime } from "../lib/time";
import { Trade } from "../lib/types";
import { moneyRaw as fmtMoneyRaw, currencySymbol as currencySign } from "../lib/money";

const CALENDAR_RETURN_DAY = "quantedge_calendar_return_day";
const CALENDAR_VIEW = "quantedge_calendar_view";

const WIN_COLOR   = "var(--profit)";
const LOSS_COLOR  = "var(--loss)";
const WIN_BG      = "rgba(0,229,122,0.07)";
const LOSS_BG     = "rgba(255,77,106,0.07)";
const WIN_BORDER  = "rgba(0,229,122,0.25)";
const LOSS_BORDER = "rgba(255,77,106,0.25)";

const FIELD: React.CSSProperties = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: "8px", padding: "7px 9px", color: "var(--text-primary)",
  fontSize: "12px", fontFamily: "'DM Sans', sans-serif", outline: "none",
  boxSizing: "border-box",
};

interface Draft {
  symbol: string;
  direction: "long" | "short";
  quantity: string;
  entry: string;
  exit: string;
  pnl: string;
}

const blankDraft = (): Draft => ({
  symbol: "", direction: "long", quantity: "1", entry: "", exit: "", pnl: "",
});

export default function CalendarPage() {
  const {
    trades: accountTrades, setSelectedTrade, activeAccount,
    dateRange, clearDateRange, symbolFilter, setSymbolFilter, reloadTrades,
  } = useApp();
  const { settings } = useSettings();
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [selectedDay,  setSelectedDay]  = useState<string | null>(null);
  const [onlyMissing,  setOnlyMissing]  = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [draft,        setDraft]        = useState<Draft>(blankDraft);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState("");

  // Dates and weekday order are locale data, not translations: Hungarian month
  // names do not capitalise and the short weekday form is not the English one.
  const locale = settings.language === "hu" ? "hu-HU" : "en-US";
  const monthName = (year: number, month: number) =>
    new Date(year, month, 1).toLocaleDateString(locale, { month: "long" });
  const longDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      weekday: "long", month: "long", day: "numeric",
    });
  };
  const shortDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  // The period and market controls live in the shell and scope every other
  // page. The calendar used to ignore them, so a period pick still painted the
  // whole journal; this is the same slice Analytics and the Dashboard read.
  const trades = useMemo(
    () => accountTrades.filter((t) => {
      const d = normalizeDate(t.date);
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      if (symbolFilter && (t.underlying || t.symbol) !== symbolFilter) return false;
      return true;
    }),
    [accountTrades, dateRange.from, dateRange.to, symbolFilter],
  );
  const hasFilters = Boolean(dateRange.from || dateRange.to || symbolFilter);

  // The Week column is worth 96px. On a phone that comes straight out of the
  // seven day cells (they fell to 35px wide), so below ~760px the column is
  // dropped instead of squeezing the grid. Same matchMedia pattern as Sidebar.
  const [showWeek, setShowWeek] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 760px)");
    const sync = () => setShowWeek(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const days  = weekdayHeaders(settings.weekStart);
  const gridColumns = showWeek ? "repeat(7, minmax(0, 1fr)) 96px" : "repeat(7, minmax(0, 1fr))";
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

  // Every day the account traded, ascending. The drawer's ‹ › and the arrow
  // keys walk the journal in the order it happened, skipping empty days, and
  // they read the unfiltered book so a filter cannot trap the user on one day.
  const tradingDates = useMemo(
    () => Array.from(new Set(accountTrades.map((t) => normalizeDate(t.date)).filter(Boolean))).sort(),
    [accountTrades],
  );

  const openDay = useCallback((iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    if (!y || !m) return;
    setCurrentYear(y);
    setCurrentMonth(m - 1);
    setSelectedDay(iso);
    setAdding(false);
    setFormError("");
    setDraft(blankDraft());
  }, []);

  const stepDay = useCallback((dir: -1 | 1) => {
    const at = selectedDay ? tradingDates.indexOf(selectedDay) : -1;
    const next = at === -1
      ? (dir > 0 ? tradingDates[0] : tradingDates[tradingDates.length - 1])
      : tradingDates[at + dir];
    if (next) openDay(next);
  }, [selectedDay, tradingDates, openDay]);

  // Use a ref to track whether we've snapped yet — avoids stale state issues
  const hasSnapped = useRef(false);

  // Coming back from the journal editor: reopen the day the entry belonged to
  // rather than snapping to the latest trade month with nothing selected.
  // Otherwise restore the month this tab was last looking at — a reload used
  // to throw away a review in progress.
  useEffect(() => {
    const returned = sessionStorage.getItem(CALENDAR_RETURN_DAY);
    if (returned) {
      sessionStorage.removeItem(CALENDAR_RETURN_DAY);
      const [year, month] = returned.split("-").map(Number);
      if (!year || !month) return;
      hasSnapped.current = true;
      setCurrentYear(year);
      setCurrentMonth(month - 1);
      setSelectedDay(returned);
      return;
    }
    try {
      const stored = JSON.parse(sessionStorage.getItem(CALENDAR_VIEW) || "null") as
        { year?: number; month?: number; day?: string | null } | null;
      if (stored && typeof stored.year === "number" && typeof stored.month === "number") {
        hasSnapped.current = true;
        setCurrentYear(stored.year);
        setCurrentMonth(stored.month);
        if (typeof stored.day === "string") setSelectedDay(stored.day);
      }
    } catch {
      // A malformed entry just means "start where the trades are".
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      CALENDAR_VIEW,
      JSON.stringify({ year: currentYear, month: currentMonth, day: selectedDay }),
    );
  }, [currentYear, currentMonth, selectedDay]);

  useEffect(() => {
    if (hasSnapped.current || trades.length === 0) return;

    // Find the most recent trade date and snap the calendar to that month/year
    const mostRecent = trades
      .map((t) => normalizeDate(t.date))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0];

    if (!mostRecent) return;

    // Parse YYYY-MM-DD manually to avoid timezone offset shifting the date
    const [yyyy, mm] = mostRecent.split("-").map(Number);
    if (!isNaN(yyyy) && !isNaN(mm)) {
      setCurrentYear(yyyy);
      setCurrentMonth(mm - 1); // months are 0-indexed
    }

    hasSnapped.current = true;
  }, [trades]);

  // The day drawer is a modal surface; Escape dismisses it and the arrows walk
  // to the neighbouring trading day, like the journal's prev/next buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "Escape") setSelectedDay(null);
      else if (e.key === "ArrowLeft" && selectedDay) { e.preventDefault(); stepDay(-1); }
      else if (e.key === "ArrowRight" && selectedDay) { e.preventDefault(); stepDay(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDay, stepDay]);

  const tradesByDate: Record<string, Trade[]> = {};
  for (const trade of trades) {
    const key = normalizeDate(trade.date);
    if (!tradesByDate[key]) tradesByDate[key] = [];
    tradesByDate[key].push(trade);
  }

  const pnlByDate: Record<string, number> = {};
  for (const date in tradesByDate) {
    pnlByDate[date] = tradesByDate[date].reduce((sum, t) => sum + t.pnl, 0);
  }

  // Every figure on this page is a percentage of the account's original
  // balance, not a currency amount — $2k and $20k traders then read alike.
  const baseBalance = activeAccount?.initialBalance ?? 0;
  const asPct       = (pnl: number): number | null =>
    baseBalance > 0 ? (pnl / baseBalance) * 100 : null;
  const fmtPct      = (pnl: number): string => {
    const pct = asPct(pnl);
    return pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  const firstDay    = leadingBlanks(firstDayOfMonth, settings.weekStart);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const weekRows    = Math.ceil((firstDay + daysInMonth) / 7);
  const weeks       = monthWeeks(trades, currentYear, currentMonth, settings.weekStart);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const formatDate = (day: number): string =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const monthTrades = trades.filter((t) => {
    const normalized = normalizeDate(t.date);
    const [yyyy, mm] = normalized.split("-").map(Number);
    return mm - 1 === currentMonth && yyyy === currentYear;
  });

  const monthPnl    = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
  const monthWins   = monthTrades.filter((t) => t.pnl > 0);
  const monthLosses = monthTrades.filter((t) => t.pnl < 0);
  const journaled   = monthTrades.filter((t) => (t.journalEntry || "").trim()).length;

  const dailyPnlEntries = Object.entries(pnlByDate).filter(([date]) => {
    const [yyyy, mm] = date.split("-").map(Number);
    return mm - 1 === currentMonth && yyyy === currentYear;
  });

  const tradingDaysCount = dailyPnlEntries.length;
  const avgDailyPnl      = tradingDaysCount > 0 ? monthPnl / tradingDaysCount : 0;

  const bestDay  = dailyPnlEntries.reduce<[string, number] | null>(
    (best, entry)  => (!best || entry[1] > best[1] ? entry : best), null
  );
  const worstDay = dailyPnlEntries.reduce<[string, number] | null>(
    (worst, entry) => (!worst || entry[1] < worst[1] ? entry : worst), null
  );

  const selectedTrades = selectedDay ? (tradesByDate[selectedDay] || []) : [];
  const selectedPnl    = selectedTrades.reduce((s, t) => s + t.pnl, 0);
  // Long vs short for the day: a one-sided loss reads very differently from a
  // book that was wrong in both directions.
  const split   = byDirection(selectedTrades);
  const avgLoss = averageLoss(trades);
  const dayAt   = selectedDay ? tradingDates.indexOf(selectedDay) : -1;
  const canPrev = dayAt !== 0;
  const canNext = dayAt !== -1 && dayAt < tradingDates.length - 1;

  const handleTradeClick = (trade: Trade) => {
    setSelectedDay(null);
    setSelectedTrade(trade);
  };

  const saveDraft = async () => {
    if (!selectedDay) return;
    const symbol = draft.symbol.trim();
    const quantity = parseFloat(draft.quantity);
    const entry = parseFloat(draft.entry);
    const exit = parseFloat(draft.exit);
    const pnl = parseFloat(draft.pnl);
    if (!symbol || ![quantity, entry, exit, pnl].every((n) => Number.isFinite(n))) {
      setFormError("Symbol, quantity, both prices and the P&L are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      // The API upserts on id and owns the JSON-in-TEXT columns, so the new row
      // takes the same path an import does. Type is fixed to forex because this
      // is the MetaTrader journal's own vocabulary and the exporter writes it.
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: activeAccount?.id ?? null,
          trades: [{
            id: `cal-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
            date: selectedDay,
            symbol,
            underlying: symbol,
            type: "forex",
            direction: draft.direction,
            quantity,
            entryPrice: entry,
            exitPrice: exit,
            commission: 0,
            fees: 0,
            pnl,
            status: pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven",
            tags: "[]",
            imageUrls: "[]",
            mistakeTags: "[]",
          }],
        }),
      });
      if (!res.ok) throw new Error("save failed");
      await reloadTrades();
      setAdding(false);
      setDraft(blankDraft());
    } catch {
      setFormError("Could not save the trade. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const draftValid =
    draft.symbol.trim() !== "" &&
    [draft.quantity, draft.entry, draft.exit, draft.pnl].every((v) => v.trim() !== "");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            {tr("Calendar")}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
            {tr("Your trading performance at a glance")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "10px", padding: "10px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{tr("Month Return")}</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: monthPnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
                {fmtPct(monthPnl)}
              </div>
            </div>
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "10px", padding: "10px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{tr("Trades")}</div>
              <div style={{ fontSize: "14px", fontWeight: "700" }}>
                <span style={{ color: WIN_COLOR }}>{monthWins.length}W</span>
                <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>/</span>
                <span style={{ color: LOSS_COLOR }}>{monthLosses.length}L</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setOnlyMissing((v) => !v)} aria-pressed={onlyMissing} style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: onlyMissing ? "rgba(251,191,36,0.12)" : "var(--bg-card)",
              border: `1px solid ${onlyMissing ? "rgba(251,191,36,0.5)" : "var(--border)"}`,
              borderRadius: "8px", padding: "8px 10px", cursor: "pointer",
              color: onlyMissing ? "var(--warning)" : "var(--text-muted)",
              fontSize: "11px", fontWeight: "600", fontFamily: "'DM Sans', sans-serif",
            }}>
              <AlertTriangle size={12} /> {tr("Missing notes")}
            </button>
            <button onClick={prevMonth} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "8px", padding: "8px", cursor: "pointer", color: "var(--text-primary)",
              display: "flex", alignItems: "center",
            }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", minWidth: "160px", textAlign: "center" }}>
              {monthName(currentYear, currentMonth)} {currentYear}
            </span>
            <button onClick={nextMonth} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "8px", padding: "8px", cursor: "pointer", color: "var(--text-primary)",
              display: "flex", alignItems: "center",
            }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {hasFilters && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px",
          padding: "10px 14px", marginBottom: "16px", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tr("Scoped by the period and market controls above. Empty days may simply be filtered out.")}</span>
          <button onClick={() => { clearDateRange(); setSymbolFilter(""); }} style={{
            background: "none", border: "none", cursor: "pointer", color: "var(--loss)",
            fontSize: "12px", fontWeight: "600", fontFamily: "'DM Sans', sans-serif",
          }}>{tr("Clear")}</button>
        </div>
      )}

      {monthTrades.length > 0 && monthTrades.length < SAMPLE_FLOOR && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "10px",
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)",
          borderRadius: "10px", padding: "12px 14px", marginBottom: "16px",
        }}>
          <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: "1px" }} />
          <div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--warning)" }}>
              {tr("Small sample — read the rest as provisional")}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {tr(`${monthTrades.length} trades this month — treat it as a direction, not a number`)}</div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: gridColumns, borderBottom: "1px solid var(--border)" }}>
          {days.map((day) => (
            <div key={day} style={{
              padding: "12px", textAlign: "center",
              fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px",
            }}>
              {tr(day)}
            </div>
          ))}
          {showWeek && (
            <div style={{
              padding: "12px", textAlign: "center",
              fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px",
            }}>
              {tr("Week")}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: gridColumns }}>
          {Array.from({ length: weekRows }).map((_, row) => (
            <Fragment key={row}>
              {Array.from({ length: 7 }).map((_, col) => {
                const day = row * 7 + col - firstDay + 1;
                if (day < 1 || day > daysInMonth) {
                  return (
                    <div key={col} style={{
                      minHeight: "90px",
                      borderRight: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)",
                      background: "var(--calendar-empty)",
                    }} />
                  );
                }

                const dateStr   = formatDate(day);
                const dayTrades = tradesByDate[dateStr] || [];
                const dayPnl    = pnlByDate[dateStr];
                const hasTrades = dayTrades.length > 0;
                const missingNotes = dayTrades.filter((t) => !(t.journalEntry || "").trim()).length;
                const isToday   =
                  day === today.getDate() &&
                  currentMonth === today.getMonth() &&
                  currentYear === today.getFullYear();
                const isSelected = selectedDay === dateStr;
                const isWin      = dayPnl > 0;
                const risk       = dayRisk(dayPnl || 0, dayTrades.length, settings.dailyLossLimit, settings.maxDailyTrades);
                const riskLevel  = risk.lossBreached || risk.tradeBreached
                  ? "breach"
                  : risk.lossWarning || risk.tradeWarning ? "warn" : null;
                const riskLabel  = risk.lossBreached ? "Daily loss limit breached"
                  : risk.tradeBreached ? "Trade cap reached"
                  : risk.lossWarning ? "Near the daily loss limit"
                  : "Near the trade cap";
                // The missing-notes filter dims the days that are already
                // written up instead of hiding them: the shape of the month
                // has to stay visible while you hunt for gaps.
                const dimmed    = onlyMissing && hasTrades && missingNotes === 0;

                return (
                  <div
                    key={col}
                    onClick={() => (isSelected ? setSelectedDay(null) : openDay(dateStr))}
                    style={{
                      minHeight: "90px",
                      borderRight: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)",
                      padding: "10px",
                      cursor: "pointer",
                      background: isSelected
                        ? "var(--bg-hover)"
                        : hasTrades ? (isWin ? WIN_BG : LOSS_BG) : "transparent",
                      transition: "background 0.15s ease, opacity 0.15s ease",
                      position: "relative",
                      opacity: dimmed ? 0.35 : 1,
                      boxShadow: riskLevel === "breach" ? `inset 0 0 0 2px ${LOSS_COLOR}` : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = hasTrades ? (isWin ? WIN_BG : LOSS_BG) : "transparent";
                    }}
                  >
                    {hasTrades && (
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0, width: "3px",
                        background: isWin ? WIN_COLOR : LOSS_COLOR,
                      }} />
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: "13px", fontWeight: isToday ? "800" : "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                        {isToday ? (
                          <span style={{
                            width: "22px", height: "22px", borderRadius: "50%",
                            background: WIN_COLOR, color: "#000",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: "11px", fontWeight: "800",
                          }}>
                            {day}
                          </span>
                        ) : (
                          <span>{day}</span>
                        )}
                      </div>
                      {hasTrades && riskLevel && (
                        <span
                          title={tr(riskLabel)}
                          aria-label={tr(riskLabel)}
                          style={{ display: "flex", alignItems: "center" }}
                        >
                          <AlertTriangle
                            size={12}
                            color={riskLevel === "breach" ? LOSS_COLOR : "var(--warning)"}
                          />
                        </span>
                      )}
                    </div>

                    {hasTrades && (
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: isWin ? WIN_COLOR : LOSS_COLOR, marginBottom: "3px" }}>
                          {fmtPct(dayPnl)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", fontSize: "10px", color: "var(--text-muted)" }}>
                          <span>{dayTrades.length}  {tr("trade")}{tr(dayTrades.length !== 1 ? "s" : "")}</span>
                          {missingNotes > 0 && (
                            <span
                              title={tr(`${missingNotes} trade${missingNotes !== 1 ? "s" : ""} without a journal entry`)}
                              aria-label={tr(`${missingNotes} trade${missingNotes !== 1 ? "s" : ""} without a journal entry`)}
                              style={{
                                width: "6px", height: "6px", borderRadius: "50%",
                                background: "var(--warning)", flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {showWeek && (() => {
                const week = weeks[row];
                return (
                  <div key="week" style={{
                    minHeight: "90px",
                    borderBottom: "1px solid var(--border)",
                    padding: "10px 8px",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: "3px",
                    background: "var(--bg-secondary)",
                  }}>
                    <span style={{
                      fontSize: "12px", fontWeight: "700",
                      color: !week.trades ? "var(--text-muted)" : week.pnl >= 0 ? WIN_COLOR : LOSS_COLOR,
                    }}>
                      {week.trades ? fmtPct(week.pnl) : "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {week.trades ? `${week.trades} ${tr("trade")}${tr(week.trades !== 1 ? "s" : "")}` : ""}
                    </span>
                  </div>
                );
              })()}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Monthly breakdown */}
      {tradingDaysCount > 0 ? (
        <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "16px" }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={14} color="var(--text-muted)" />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px" }}>{tr("TRADING DAYS")}</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-1px" }}>{tradingDaysCount}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{monthWins.length}W &nbsp;·&nbsp; {monthLosses.length}L</div>
          </div>

          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <BarChart2 size={14} color="var(--text-muted)" />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px" }}>{tr("AVG DAILY RETURN")}</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "-1px", color: avgDailyPnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
              {fmtPct(avgDailyPnl)}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr("per trading day")}</div>
          </div>

          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={14} color={journaled === monthTrades.length ? WIN_COLOR : "var(--warning)"} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px" }}>{tr("JOURNALED")}</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "-1px", color: journaled === monthTrades.length ? WIN_COLOR : "var(--warning)" }}>
              {journaled}<span style={{ fontSize: "16px", color: "var(--text-muted)" }}> / {monthTrades.length}</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tr(`${monthTrades.length - journaled} trades without a journal entry`)}</div>
          </div>

          <div style={{
            background: "var(--bg-card)", border: `1px solid ${WIN_BORDER}`,
            borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={14} color={WIN_COLOR} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px" }}>{tr("BEST DAY")}</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: WIN_COLOR, letterSpacing: "-1px" }}>
              {tr(bestDay ? fmtPct(bestDay[1]) : "—")}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tr(bestDay ? shortDate(bestDay[0]) : "No data")}
            </div>
          </div>

          <div style={{
            background: "var(--bg-card)", border: `1px solid ${LOSS_BORDER}`,
            borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingDown size={14} color={LOSS_COLOR} />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px" }}>{tr("WORST DAY")}</span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: LOSS_COLOR, letterSpacing: "-1px" }}>
              {tr(worstDay ? fmtPct(worstDay[1]) : "—")}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tr(worstDay ? shortDate(worstDay[0]) : "No data")}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          marginTop: "24px", background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "14px", padding: "32px", textAlign: "center",
        }}>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {tr("No trades recorded in")}{" "}{monthName(currentYear, currentMonth)} {currentYear}
          </div>
        </div>
      )}

      {/* Day Detail Panel */}
      {selectedDay && (
        <>
          <div onClick={() => setSelectedDay(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
          <div style={{
            position: "fixed", top: 0, right: 0, width: "480px", maxWidth: "100vw", height: "100vh",
            background: "var(--bg-secondary)", borderLeft: "1px solid var(--border)",
            zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
            }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>
                  {longDate(selectedDay)}
                </h3>
                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {selectedTrades.length}  {tr("trade")}{tr(selectedTrades.length !== 1 ? "s" : "")}
                  </span>
                  {selectedTrades.length > 0 && (
                    <span style={{
                      fontSize: "13px", fontWeight: "700",
                      color: selectedPnl >= 0 ? WIN_COLOR : LOSS_COLOR,
                    }}>
                      {fmtPct(selectedPnl)} {tr("day return")}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <button
                  onClick={() => stepDay(-1)}
                  disabled={!canPrev}
                  title={tr("Previous day")}
                  aria-label={tr("Previous day")}
                  style={{
                    background: "none", border: "none", padding: "4px",
                    cursor: canPrev ? "pointer" : "default",
                    color: canPrev ? "var(--text-muted)" : "var(--border)",
                    display: "flex", alignItems: "center",
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => stepDay(1)}
                  disabled={!canNext}
                  title={tr("Next day")}
                  aria-label={tr("Next day")}
                  style={{
                    background: "none", border: "none", padding: "4px",
                    cursor: canNext ? "pointer" : "default",
                    color: canNext ? "var(--text-muted)" : "var(--border)",
                    display: "flex", alignItems: "center",
                  }}
                >
                  <ChevronRight size={18} />
                </button>
                <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {selectedTrades.length > 0 && (
              <div style={{ display: "flex", gap: "8px", padding: "12px 24px 0" }}>
                {split.map((side) => (
                  <div key={side.bucket} style={{
                    flex: 1, background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: "10px", padding: "8px 10px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        width: "6px", height: "6px", borderRadius: "50%",
                        background: side.bucket === "Long" ? WIN_COLOR : LOSS_COLOR,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)" }}>
                        {tr(side.bucket)}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {side.trades} · {side.wins}W
                      </span>
                    </div>
                    <span style={{
                      fontSize: "12px", fontWeight: "700",
                      color: !side.trades ? "var(--text-muted)" : side.pnl >= 0 ? WIN_COLOR : LOSS_COLOR,
                    }}>
                      {side.trades ? fmtPct(side.pnl) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {!adding ? (
                <button
                  onClick={() => { setAdding(true); setFormError(""); setDraft(blankDraft()); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    background: "transparent", border: "1px dashed var(--border)", borderRadius: "12px",
                    padding: "10px", marginBottom: "12px", cursor: "pointer",
                    color: "var(--text-muted)", fontSize: "12px", fontWeight: "600",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <Plus size={14} /> {tr("Log a trade on this day")}
                </button>
              ) : (
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "12px", padding: "16px", marginBottom: "12px",
                }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "10px" }}>
                    {tr("Log a trade on this day")}</div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.4px" }}>{tr("Symbol")}</span>
                      <input
                        value={draft.symbol}
                        onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
                        placeholder="EURUSD"
                        style={FIELD}
                      />
                    </label>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.4px" }}>{tr("Direction")}</span>
                        <select
                          value={draft.direction}
                          onChange={(e) => setDraft({ ...draft, direction: e.target.value as "long" | "short" })}
                          style={FIELD}
                        >
                          <option value="long">{tr("Long")}</option>
                          <option value="short">{tr("Short")}</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.4px" }}>{tr("Quantity")}</span>
                        <input
                          type="number" step="any"
                          value={draft.quantity}
                          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                          style={FIELD}
                        />
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.4px" }}>{tr("Entry price")}</span>
                        <input
                          type="number" step="any"
                          value={draft.entry}
                          onChange={(e) => setDraft({ ...draft, entry: e.target.value })}
                          style={FIELD}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.4px" }}>{tr("Exit price")}</span>
                        <input
                          type="number" step="any"
                          value={draft.exit}
                          onChange={(e) => setDraft({ ...draft, exit: e.target.value })}
                          style={FIELD}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                        <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.4px" }}>{tr("P&L")}</span>
                        <input
                          type="number" step="any"
                          value={draft.pnl}
                          onChange={(e) => setDraft({ ...draft, pnl: e.target.value })}
                          style={FIELD}
                        />
                      </label>
                    </div>
                  </div>

                  {formError && (
                    <div style={{ fontSize: "11px", color: LOSS_COLOR, marginTop: "8px" }}>{tr(formError)}</div>
                  )}

                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button
                      onClick={saveDraft}
                      disabled={saving || !draftValid}
                      style={{
                        flex: 1, background: saving || !draftValid ? "var(--bg-secondary)" : "var(--accent-green-dim)",
                        border: `1px solid ${saving || !draftValid ? "var(--border)" : "var(--accent-green)"}`,
                        borderRadius: "8px", padding: "8px", cursor: saving || !draftValid ? "default" : "pointer",
                        color: saving || !draftValid ? "var(--text-muted)" : "var(--accent-green)",
                        fontSize: "12px", fontWeight: "700", fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {tr(saving ? "Saving…" : "Add trade")}
                    </button>
                    <button
                      onClick={() => { setAdding(false); setFormError(""); }}
                      style={{
                        background: "transparent", border: "1px solid var(--border)", borderRadius: "8px",
                        padding: "8px 14px", cursor: "pointer", color: "var(--text-muted)",
                        fontSize: "12px", fontWeight: "600", fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {tr("Cancel")}
                    </button>
                  </div>
                </div>
              )}

              {selectedTrades.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                  {tr("No trades on this day. Use the form above to log one.")}</p>
              ) : (
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px" }}>
                  {tr("Click any trade to view it and write the journal")}</p>
              )}

              {selectedTrades.map((trade) => {
                const r = tradeR(trade, avgLoss);
                return (
                  <div
                    key={trade.id}
                    onClick={() => handleTradeClick(trade)}
                    style={{
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderRadius: "12px", padding: "16px", marginBottom: "12px",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = WIN_COLOR;
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)" }}>{trade.underlying}</span>
                        {(() => {
                          const isShort = (trade.direction || "").toLowerCase().startsWith("s");
                          return (
                            <span style={{
                              padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700",
                              letterSpacing: "0.3px",
                              background: isShort ? "rgba(255,77,106,0.15)" : "rgba(0,229,122,0.15)",
                              color: isShort ? LOSS_COLOR : WIN_COLOR,
                            }}>
                              {tr(isShort ? "Short" : "Long")}
                            </span>
                          );
                        })()}
                        <span style={{
                          padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "600",
                          background: trade.optionType === "call" ? "rgba(77,159,255,0.15)" : "rgba(255,77,106,0.15)",
                          color: trade.optionType === "call" ? "var(--accent-blue)" : LOSS_COLOR,
                        }}>
                          {tr(trade.optionType ? `${trade.optionType.toUpperCase()} ${fmtMoneyRaw(trade.strike)}` : trade.type.toUpperCase())}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexShrink: 0 }}>
                        <span style={{ fontSize: "15px", fontWeight: "700", color: trade.pnl >= 0 ? WIN_COLOR : LOSS_COLOR }}>
                          {tr(trade.pnl >= 0 ? "+" : "")}{currencySign()}{trade.pnl}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmtPct(trade.pnl)}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr("Entry")} {currencySign()}{trade.entryPrice}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr("Exit")} {currencySign()}{trade.exitPrice}</span>
                      {trade.rr && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>R:R {trade.rr}</span>}
                      {trade.entryTime && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatTime(trade.entryTime, settings.timeFormat)}</span>}
                    </div>

                    {(trade.plannedRisk != null || r !== null || trade.durationMin != null || trade.exitTime || trade.exitReason) && (
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "8px" }}>
                        {trade.plannedRisk != null && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {tr("Risk")} {currencySign()}{trade.plannedRisk.toFixed(2)}</span>
                        )}
                        {r !== null && (
                          <span style={{ fontSize: "12px", fontWeight: "600", color: r >= 0 ? WIN_COLOR : LOSS_COLOR }}>
                            {r >= 0 ? "+" : ""}{r.toFixed(2)}R
                          </span>
                        )}
                        {trade.durationMin != null && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {tr("Hold:")} {Math.round(trade.durationMin)} {tr("min")}</span>
                        )}
                        {trade.exitTime && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {tr("Out:")} {formatTime(trade.exitTime, settings.timeFormat)}</span>
                        )}
                        {/* Older exports shifted the columns, so some rows hold a
                            number where the reason should be. Show the word only. */}
                        {trade.exitReason && /[A-Za-z]{2}/.test(trade.exitReason) && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{trade.exitReason}</span>
                        )}
                      </div>
                    )}

                    {(() => {
                      const tags: string[] = Array.isArray(trade.tags)
                        ? trade.tags as string[]
                        : typeof trade.tags === "string"
                        ? JSON.parse((trade.tags as string) || "[]")
                        : [];
                      return tags.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                          {tags.map((tag) => (
                            <span key={tag} style={{
                              padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "600",
                              background: "var(--accent-green-dim)", color: "var(--accent-green)",
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {!(trade.journalEntry || "").trim() && (
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--warning)", marginTop: "6px" }}>
                        {tr("No journal entry yet")}</div>
                    )}

                    {trade.journalEntry && (
                      <p style={{
                        fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5",
                        borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "4px",
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                      }}>
                        {trade.journalEntry}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
