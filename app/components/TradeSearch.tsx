"use client";
import { t as tr } from "../lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Trade } from "../lib/types";
import { moneyRaw as fmtMoneyRaw } from "../lib/money";

// TipTap stores the journal as a JSON document. Searching the raw string would
// only ever match structural keys, so flatten the text nodes instead. Only the
// shape this function walks is typed; everything else in the doc is ignored.
type JournalNode = { type?: string; text?: string; content?: JournalNode[] };

function journalText(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const doc = JSON.parse(raw) as JournalNode | null;
    if (doc?.type === "doc" && Array.isArray(doc.content)) {
      return doc.content
        .flatMap((node) =>
          Array.isArray(node.content)
            ? node.content.filter((n) => n.type === "text").map((n) => n.text ?? "")
            : []
        )
        .join(" ");
    }
  } catch {}
  return raw;
}

function haystack(t: Trade): string {
  return [
    t.symbol,
    t.underlying,
    t.date,
    t.direction,
    t.status,
    t.exitReason,
    Array.isArray(t.tags) ? t.tags.join(" ") : "",
    journalText(t.journalEntry),
  ]
    .join(" ")
    .toLowerCase();
}

const money = (v: number) =>
  `${v < 0 ? "-" : v > 0 ? "+" : ""}${fmtMoneyRaw(Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 }))}`;

const RESULT_LIMIT = 8;

// Mounted once in the shell. Ctrl/Cmd+K is a browser convention, so it is
// listened for here rather than in the single-letter shortcut handler, which
// deliberately ignores modified keys.
export default function TradeSearch() {
  const { trades, setSelectedTrade, selectedTrade } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const openSearch = useCallback(() => {
    // The trade drawer owns the screen; stacking a palette over it would put
    // two Escape handlers on the same key.
    if (selectedTrade) return;
    setOpen(true);
  }, [selectedTrade]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) return false;
          if (selectedTrade) return prev;
          return true;
        });
        setQuery("");
        setActive(0);
      }
    };
    const onRequest = () => openSearch();
    window.addEventListener("keydown", onKey);
    window.addEventListener("quantedge:search", onRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("quantedge:search", onRequest);
    };
  }, [openSearch, selectedTrade]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? trades.filter((t) => haystack(t).includes(q))
      : [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return pool.slice(0, RESULT_LIMIT);
  }, [trades, query]);

  const total = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? trades.filter((t) => haystack(t).includes(q)).length : trades.length;
  }, [trades, query]);

  // Keep the highlighted row inside the scrollable list when arrowing past it.
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (trade: Trade) => {
    close();
    setSelectedTrade(trade);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
      return;
    }
    if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 320 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("Search trades")}
        style={{
          position: "fixed", top: "12vh", left: "50%", transform: "translateX(-50%)",
          width: "min(620px, 95vw)", zIndex: 321,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "14px", boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "14px 16px", borderBottom: "1px solid var(--border)",
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // A new query means a new result list; keeping the old index would
              // highlight an arbitrary row.
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder={tr("Search symbol, date, tag, setup or journal…")}
            aria-label={tr("Search trades")}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: "14px",
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button
            onClick={close}
            aria-label={tr("Close search")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", display: "flex" }}
          >
            <X size={15} />
          </button>
        </div>

        <div ref={listRef} style={{ maxHeight: "46vh", overflowY: "auto", padding: "6px" }}>
          {results.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
              {tr(query.trim()
                ? `No trade matches “${query.trim()}” in this account.`
                : "No trades in this account yet.")}
            </div>
          )}

          {results.map((t, i) => {
            const selected = i === active;
            const tags = Array.isArray(t.tags) ? t.tags : [];
            return (
              <button
                key={t.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(t)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 12px", borderRadius: "9px", border: "none",
                  background: selected ? "var(--bg-hover)" : "transparent",
                  cursor: "pointer", textAlign: "left",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ width: "76px", fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                  {t.date}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                      {t.underlying || t.symbol}
                    </span>
                    <span style={{
                      fontSize: "10px", fontWeight: "700", textTransform: "uppercase",
                      color: t.direction?.toLowerCase().startsWith("s") ? "var(--loss)" : "var(--profit)",
                    }}>
                      {t.direction}
                    </span>
                    {tags.slice(0, 2).map((tag) => (
                      <span key={tag} style={{
                        fontSize: "10px", padding: "1px 6px", borderRadius: "20px",
                        background: "var(--bg-secondary)", color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div style={{
                    fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {t.symbol}
                    {tr(t.exitReason ? ` · ${t.exitReason}` : "")}
                  </div>
                </div>
                <div style={{
                  fontSize: "13px", fontWeight: "700", flexShrink: 0,
                  color: t.pnl >= 0 ? "var(--profit)" : "var(--loss)",
                }}>
                  {money(t.pnl)}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px", borderTop: "1px solid var(--border)",
          fontSize: "11px", color: "var(--text-muted)",
        }}>
          <span>
            {tr(query.trim()
              ? `${total} match${total === 1 ? "" : "es"}${total > RESULT_LIMIT ? ` · showing first ${RESULT_LIMIT}` : ""}`
              : `Recent trades${total > RESULT_LIMIT ? ` · showing ${RESULT_LIMIT} of ${total}` : ""}`)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><ArrowUp size={11} /><ArrowDown size={11} />  {tr("navigate")}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "3px" }}><CornerDownLeft size={11} />  {tr("open")}</span>
            <span>{tr("esc close")}</span>
          </span>
        </div>
      </div>
    </>
  );
}
