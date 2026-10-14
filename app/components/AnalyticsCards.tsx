"use client";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, AlertTriangle, XCircle, Info, Lightbulb } from "lucide-react";
import type { Insight, InsightLevel } from "../lib/insights";

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

/**
 * Recommendations for one tab. Every entry is generated from the same figures
 * the charts below render, and the chip repeats the number the call was made
 * on so it can be checked rather than trusted.
 *
 * Findings arrive pre-ranked (worst first) and every one of them is shown —
 * a hidden finding is a finding the trader cannot act on. `limit` stays only
 * as an optional override for a caller that deliberately wants a subset.
 */
export function InsightPanel({
  insights, limit = Infinity, title = "Recommendations",
}: {
  insights: Insight[]; limit?: number; title?: string;
}) {
  if (!insights || insights.length === 0) return null;
  const shown = insights.slice(0, limit);

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
        Read from the numbers on this tab. Worst first — fix the top item before reading the rest.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
        {shown.map((item, i) => {
          const s = LEVEL_STYLE[item.level];
          return (
            <div
              key={`${item.level}-${item.title}-${i}`}
              style={{
                display: "flex", gap: "10px", padding: "14px 16px",
                background: s.bg, border: `1px solid ${s.border}`, borderRadius: "12px",
              }}
            >
              <s.Icon size={15} color={s.color} style={{ flexShrink: 0, marginTop: "1px" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{item.title}</span>
                  {item.metric && (
                    <span style={{
                      fontSize: "13px", fontWeight: "700", color: s.color,
                      background: "var(--bg-card)", border: `1px solid ${s.border}`,
                      padding: "2px 8px", borderRadius: "20px", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {item.metric}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}