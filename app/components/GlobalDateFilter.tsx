"use client";
import { Calendar, X } from "lucide-react";
import { useApp } from "../context/AppContext";

// The one time-interval control, mounted once in the shell above the page
// content. Because it renders outside the page components it survives tab
// switches, and because it writes to AppContext both pages read the same
// value instead of keeping private copies.
export default function GlobalDateFilter() {
  const { dateRange, setDateRange, clearDateRange } = useApp();
  const hasRange = Boolean(dateRange.from || dateRange.to);

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: "8px",
    border: "1px solid var(--border)", background: "var(--bg-card)",
    color: "var(--text-primary)", fontSize: "12px", colorScheme: "dark",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        marginBottom: "24px", padding: "12px 16px",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px",
      }}
    >
      <Calendar size={14} color="var(--text-muted)" />
      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>Period</span>

      <input
        type="date" value={dateRange.from}
        onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
        style={inputStyle}
      />
      <span style={{ fontSize: "12px", color: "#a8a8c8" }}>to</span>
      <input
        type="date" value={dateRange.to}
        onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
        style={inputStyle}
      />

      {hasRange && (
        <button
          onClick={clearDateRange}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: "none", border: "none", cursor: "pointer",
            color: "#ff4d6a", fontSize: "12px",
            fontFamily: "'DM Sans', sans-serif", fontWeight: "600",
          }}
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}