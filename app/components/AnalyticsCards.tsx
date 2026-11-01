"use client";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2, AlertTriangle, XCircle, Info, Lightbulb, BookOpen,
  ChevronDown, ArrowRight,
} from "lucide-react";
import {
  LOOK_FOR, type Insight, type InsightLevel, type GuideKey, type Grade,
} from "../lib/insights";

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "16px", padding: "24px", marginBottom: "20px",
    }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "2px" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function MetricCard({
  label, value, sub, positive, neutral, icon: Icon,
}: {
  label: string; value: string; sub?: string;
  positive?: boolean; neutral?: boolean; icon: LucideIcon;
}) {
  const color = neutral ? "var(--text-muted)" : positive ? "#00e57a" : "#ff4d6a";
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </span>
        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--accent-green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={13} color="var(--accent-green)" />
        </div>
      </div>
      <div style={{ fontSize: "22px", fontWeight: "800", color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "5px" }}>{sub}</div>}
    </div>
  );
}

// ─── Recommendations ────────────────────────────────────────────────────

const LEVEL_STYLE: Record<InsightLevel, { color: string; bg: string; border: string; Icon: LucideIcon; word: string }> = {
  bad:  { color: "#ff4d6a", bg: "rgba(255,77,106,0.07)",  border: "rgba(255,77,106,0.22)",  Icon: XCircle,        word: "Fix first" },
  warn: { color: "#fbbf24", bg: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.22)",  Icon: AlertTriangle,  word: "Watch" },
  good: { color: "#00e57a", bg: "rgba(0,229,122,0.07)",   border: "rgba(0,229,122,0.22)",   Icon: CheckCircle2,   word: "Working" },
  info: { color: "#4d9fff", bg: "rgba(77,159,255,0.07)",  border: "rgba(77,159,255,0.22)",  Icon: Info,           word: "Context" },
};

// The scale reads left-to-right like a score: red is the worst band, purple the
// best. Advanced uses the palette's violet rather than a second green so the top
// two bands stay distinguishable; two identical greens read as one wider band.
const GRADE_STYLE: Record<Grade, string> = {
  bad:      "#ff4d6a",
  average:  "#fbbf24",
  good:     "#4d9fff",
  great:    "#00e57a",
  advanced: "#a78bfa",
};

// Worst to best, so the bar grows healthier toward the right.
const GRADE_AXIS: Grade[] = ["bad", "average", "good", "great", "advanced"];

/** One metric's five reference bands as a single glanceable bar. Ranges are
 *  printed under each band so the scale replaces the old table rather than
 *  hiding it. This is reference material, not advice. */
function GradeScale({ guideKey, showRanges = true }: { guideKey: GuideKey; showRanges?: boolean }) {
  const guide = LOOK_FOR[guideKey];
  return (
    <div
      role="img"
      aria-label={`${guide.label} bands, worst to best: ${GRADE_AXIS.map((g) => `${g} ${guide.bands[g]}`).join(", ")}`}
      style={{ marginTop: "10px" }}
    >
      <div style={{ display: "flex", gap: "3px", alignItems: "flex-end" }}>
        {GRADE_AXIS.map((g) => (
          <div key={g} style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              height: "7px", borderRadius: "3px",
              background: GRADE_STYLE[g], opacity: 0.9,
            }} />
            <div style={{
              marginTop: "4px", fontSize: "9.5px", fontWeight: "700",
              color: GRADE_STYLE[g], textTransform: "capitalize",
              letterSpacing: "0.2px", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {g}
            </div>
            {showRanges && (
              <div style={{
                fontSize: "9.5px", color: "var(--text-muted)", lineHeight: 1.3,
                fontVariantNumeric: "tabular-nums",
              }}>
                {guide.bands[g]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The one-line next step for a finding, taken from its metric's scale. */
function NextStep({ guideKey }: { guideKey: GuideKey }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", marginTop: "10px" }}>
      <ArrowRight size={13} color="var(--accent-green)" style={{ marginTop: "2px", flexShrink: 0 }} />
      <span style={{ fontSize: "12.5px", color: "var(--text-primary)", lineHeight: 1.5 }}>
        {LOOK_FOR[guideKey].action}
      </span>
    </div>
  );
}

function DetailToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        background: "none", border: "none", padding: 0, cursor: "pointer",
        color: "var(--text-muted)", fontSize: "11px", fontWeight: "600",
        fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.2px",
        marginTop: "10px",
      }}
    >
      {open ? "Hide detail" : "Why this matters"}
      <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
    </button>
  );
}

/** The worst finding, shown in full: verdict, figure, scale and next step. */
function HeroFinding({ item }: { item: Insight }) {
  const [open, setOpen] = useState(false);
  const s = LEVEL_STYLE[item.level];
  const guide = item.guide ? LOOK_FOR[item.guide] : null;

  return (
    <div style={{
      padding: "16px 18px", background: s.bg,
      border: `1px solid ${s.border}`, borderRadius: "14px", marginBottom: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px" }}>
        <s.Icon size={14} color={s.color} />
        <span style={{
          fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.7px",
          textTransform: "uppercase", color: s.color,
        }}>
          {s.word}
        </span>
        {item.metric && (
          <span style={{
            marginLeft: "auto", fontSize: "19px", fontWeight: "800",
            color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums",
          }}>
            {item.metric}
          </span>
        )}
      </div>

      <div style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1.35 }}>
        {item.title}
      </div>

      {guide && item.guide && (
        <>
          <GradeScale guideKey={item.guide} />
          <NextStep guideKey={item.guide} />
        </>
      )}

      <DetailToggle open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div style={{ marginTop: "8px" }}>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
            {item.detail}
          </p>
          {guide && (
            <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.5, margin: "8px 0 0" }}>
              <strong style={{ color: "var(--text-secondary)" }}>{guide.label}:</strong> {guide.what}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Every remaining finding as a scannable row that expands in place. */
function FindingRow({ item }: { item: Insight }) {
  const [open, setOpen] = useState(false);
  const s = LEVEL_STYLE[item.level];
  const guide = item.guide ? LOOK_FOR[item.guide] : null;

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: "8px", width: "100%",
          padding: "10px 2px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <s.Icon size={13} color={s.color} style={{ flexShrink: 0 }} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: "600",
          color: "var(--text-primary)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {item.title}
        </span>
        {item.metric && (
          <span style={{
            fontSize: "11.5px", fontWeight: "700", color: s.color,
            background: "var(--bg-secondary)", border: `1px solid ${s.border}`,
            padding: "1px 7px", borderRadius: "20px", whiteSpace: "nowrap",
            flexShrink: 0, fontVariantNumeric: "tabular-nums",
          }}>
            {item.metric}
          </span>
        )}
        <ChevronDown
          size={13}
          color="var(--text-muted)"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
        />
      </button>

      {open && (
        <div style={{ padding: "0 2px 14px 21px" }}>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 4px" }}>
            {item.detail}
          </p>
          {guide && item.guide && (
            <>
              <GradeScale guideKey={item.guide} />
              <NextStep guideKey={item.guide} />
              <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.5, margin: "8px 0 0" }}>
                <strong style={{ color: "var(--text-secondary)" }}>{guide.label}:</strong> {guide.what}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** When findings are off but guidance is on, the tab keeps the reference
 *  scales as compact benchmark cards instead of a wall of advice. */
function BenchmarkPanel({ keys }: { keys: GuideKey[] }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "16px", padding: "20px 24px", marginBottom: "20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <BookOpen size={14} color="var(--accent-green)" />
        <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>What good looks like</span>
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
        The benchmarks behind this tab. Findings are hidden, so grade the numbers yourself.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
        {keys.map((key) => {
          const guide = LOOK_FOR[key];
          return (
            <div key={key} style={{
              padding: "14px 16px", background: "var(--bg-secondary)",
              border: "1px solid var(--border)", borderRadius: "12px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "3px" }}>
                {guide.label}
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                {guide.what}
              </p>
              <GradeScale guideKey={key} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type InsightMode = "full" | "benchmarks";

/**
 * Guidance for one tab, in three layers:
 *   hero    the worst finding, fully readable at a glance
 *   rows    the rest, one line each, expandable
 *   scale   five reference bands per metric, so the number can be graded
 *
 * Findings still arrive pre-ranked worst-first and all of them are shown — a
 * hidden finding is one the trader cannot act on.
 */
export function InsightPanel({
  insights, limit = Infinity, title = "Recommendations", mode = "full",
}: {
  insights: Insight[]; limit?: number; title?: string;
  mode?: InsightMode;
}) {
  if (!insights || insights.length === 0) return null;
  const shown = insights.slice(0, limit);
  const hidden = insights.length - shown.length;

  if (mode === "benchmarks") {
    const keys = Array.from(new Set(shown.map((i) => i.guide).filter((g): g is GuideKey => Boolean(g))));
    if (keys.length === 0) return null;
    return <BenchmarkPanel keys={keys} />;
  }

  const [hero, ...rest] = shown;

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "16px", padding: "20px 24px", marginBottom: "20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <Lightbulb size={14} color="var(--accent-green)" />
        <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{title}</span>
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
        Start with the top finding. Open any row for the reasoning and the scale it was judged on.
      </p>

      <HeroFinding item={hero} />
      {rest.length > 0 && (
        <div>{rest.map((item, i) => (
          <FindingRow key={`${item.level}-${item.title}-${i}`} item={item} />
        ))}</div>
      )}
      {hidden > 0 && (
        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "10px 0 0" }}>
          {hidden} more below the cap — not shown here.
        </p>
      )}
    </div>
  );
}
