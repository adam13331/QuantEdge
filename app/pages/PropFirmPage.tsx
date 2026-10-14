"use client";
import { useApp } from "../context/AppContext";
import PropFirmPanel from "../components/PropFirmPanel";

// Prop firm tracking is its own page rather than an Analytics tab: the rules
// are a different question from "how did I trade", and the panel needs the
// full height to be readable.
export default function PropFirmPage() {
  const { trades, activeAccount } = useApp();

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          Prop Firm
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
          Where you stand against the challenge rules
        </p>
      </div>

      <PropFirmPanel trades={trades} activeAccount={activeAccount} />
    </div>
  );
}