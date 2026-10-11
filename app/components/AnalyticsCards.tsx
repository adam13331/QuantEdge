"use client";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "16px", padding: "24px", marginBottom: "20px",
    }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "2px" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{subtitle}</p>}
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
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </span>
        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--accent-green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={13} color="var(--accent-green)" />
        </div>
      </div>
      <div style={{ fontSize: "22px", fontWeight: "800", color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>{sub}</div>}
    </div>
  );
}
