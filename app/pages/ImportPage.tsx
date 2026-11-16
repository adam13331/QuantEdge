"use client";
import { t as tr } from "../lib/i18n";
import { useState, useRef, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Trade } from "../lib/types";
import { parseMetaTraderCSV, isMetaTraderCSV, firstLine } from "../lib/parseMetaTraderCSV";
import { moneyRaw as fmtMoneyRaw, currencySymbol as currencySign } from "../lib/money";
import {
  Upload, CheckCircle, AlertCircle, FileText,
  ArrowRight, X, Database, RefreshCw, ChevronDown, Download,
} from "lucide-react";

type ParseStatus = "idle" | "success" | "error" | "importing";

interface ParseResult {
  trades: Trade[];
  count:  number;
}

function FormatBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
      background: "rgba(0,229,122,0.12)", color: "var(--profit)", border: "1px solid rgba(0,229,122,0.3)",
    }}>
      <Database size={10} />
      {tr("MetaTrader Export")}</span>
  );
}

// Explains what was wrong using the file's own contents. The old generic
// "check it's a valid broker CSV" message made a mis-detected export
// impossible to diagnose.
function describeFile(text: string): string {
  if (!text.trim()) return "The file is empty (0 bytes).";

  const head = firstLine(text);
  if (!head) return "The file has no readable content.";

  const shown = head.length > 180 ? head.slice(0, 180) + "…" : head;
  return `This isn't a MetaTrader export. The first line reads: “${shown}”`;
}

const FORMAT_CARD = {
  label: "MetaTrader",
  desc:  "Run QuantEdgeExport.mq5 on any chart in MetaTrader 5, then drop the CSV it writes to MQL5\\Files. " +
         "Every closed trade is reconstructed from its deals — options, forex, futures and stocks — " +
         "with entry/exit times, commission, swap and net P&L already calculated.",
  color: "var(--profit)", bg: "rgba(0,229,122,0.06)", border: "rgba(0,229,122,0.2)",
};

export default function ImportPage() {
  const { accounts, activeAccount, setActiveAccount, allTrades, reloadTrades, setActivePage } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [status,   setStatus]   = useState<ParseStatus>("idle");
  const [message,  setMessage]  = useState("");
  const [result,   setResult]   = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");

  // The confirm dialog owns the target account. It starts on whatever is
  // active, but the whole point of the dialog is that the ambient selection is
  // the thing most likely to be wrong.
  const [confirming, setConfirming]     = useState(false);
  const [targetId, setTargetId]         = useState<string>("");

  const openConfirm = () => {
    setTargetId(activeAccount?.id ?? "");
    setConfirming(true);
  };

  const targetAccount = accounts.find((a) => a.id === targetId) || null;

  // Tickets already present in a *different* account. Re-importing the same
  // file over the same account is a harmless upsert, but the same file landing
  // elsewhere is the signature of an import that went to the wrong account.
  const misfiled = useMemo(() => {
    if (!result || !targetId) return [];
    const incoming = new Set(result.trades.map((r) => r.id));
    return allTrades.filter((t) => incoming.has(t.id) && t.accountId !== targetId);
  }, [result, targetId, allTrades]);

  const reset = () => {
    setStatus("idle");
    setMessage("");
    setResult(null);
    setFileName("");
    setConfirming(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setStatus("error");
      setMessage("Only .csv files are supported.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Check the header before parsing so a wrong file gets the diagnostic
      // message rather than a "no trade rows" complaint.
      if (!isMetaTraderCSV(text)) {
        setStatus("error");
        setMessage(describeFile(text));
        return;
      }
      try {
        const trades = parseMetaTraderCSV(text);
        setResult({ trades, count: trades.length });
        setStatus("success");
        setMessage(`Found ${trades.length} trade${trades.length !== 1 ? "s" : ""} — ready to import.`);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Could not parse this file.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    if (!result) return;
    setConfirming(false);
    setStatus("importing");
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: result.trades, accountId: targetId || null }),
      });
      if (!res.ok) throw new Error("API error");
      // Land the user on the account they actually imported into, otherwise the
      // dashboard still shows the account they picked by mistake.
      if (targetAccount) setActiveAccount(targetAccount);
      await reloadTrades();
      setActivePage("dashboard");
    } catch {
      setStatus("error");
      setMessage("Failed to save trades. Check the server is running and try again.");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          {tr("Import Trades")}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
          {tr(accounts.length > 0
            ? "You'll confirm which account these trades belong to before anything is saved"
            : "No trading account yet — create one first so equity is tracked")}
        </p>
        {accounts.length === 0 && (
          <button
            onClick={() => setActivePage("accounts")}
            style={{
              marginTop: "12px", padding: "9px 16px", borderRadius: "8px",
              border: "1px solid var(--accent-green)", background: "var(--accent-green-dim)",
              color: "var(--accent-green)", fontSize: "13px", fontWeight: "700",
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tr("Create an account")}</button>
        )}
      </div>

      {/* Broker cards */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            background: FORMAT_CARD.bg, border: `1px solid ${FORMAT_CARD.border}`,
            borderRadius: "12px", padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: FORMAT_CARD.color, marginBottom: "6px" }}>
                {tr(FORMAT_CARD.label)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                {tr(FORMAT_CARD.desc)}
              </div>
            </div>
            <a
              href="/api/exporter"
              download="QuantEdgeExport.mq5"
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "9px 14px", borderRadius: "8px",
                border: "1px solid var(--accent-green)",
                background: "var(--bg-card)", color: "var(--accent-green)",
                fontSize: "12px", fontWeight: "700", textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <Download size={13} />
              {tr("Download exporter")}</a>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "8px 20px", marginTop: "14px", paddingTop: "12px",
            borderTop: "1px solid var(--border)",
          }}>
            {[
              "1. Download the .mq5 and save it in MQL5\\Scripts",
              "2. Run the script on any MetaTrader 5 chart",
              "3. Drop the CSV it writes to MQL5\\Files below",
            ].map((step) => (
              <div key={step} style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                {tr(step)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => status === "idle" && fileRef.current?.click()}
        role="button"
        tabIndex={status === "idle" ? 0 : -1}
        aria-label={tr("Choose a CSV file to import")}
        onKeyDown={(e) => {
          if (status === "idle" && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); if (status === "idle") setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? "var(--accent-green)" : "var(--border)"}`,
          borderRadius: "16px", padding: "64px 32px", textAlign: "center",
          cursor: status === "idle" ? "pointer" : "default",
          background: dragging ? "var(--accent-green-dim)" : "var(--bg-card)",
          transition: "all 0.2s ease",
        }}
      >
        <input
          ref={fileRef} type="file" accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {status === "idle" && (
          <>
            <div style={{
              width: "56px", height: "56px", borderRadius: "14px",
              background: "var(--accent-green-dim)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Upload size={24} color="var(--accent-green)" />
            </div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
              {tr("Drop your CSV here")}</div>
            <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              {tr("QuantEdgeExport.mq5 output — format is verified automatically")}</div>
          </>
        )}

        {status === "success" && result && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <CheckCircle size={36} color="var(--accent-green)" />
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                {message}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <FileText size={12} color="var(--text-secondary)" />
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{fileName}</span>
                <FormatBadge />
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <AlertCircle size={36} color="var(--loss)" />
            <div style={{ fontSize: "14px", color: "var(--loss)", fontWeight: "600" }}>{message}</div>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 16px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <RefreshCw size={12} />
              {tr("Try again")}</button>
          </div>
        )}

        {status === "importing" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              border: "3px solid var(--accent-green-dim)",
              borderTop: "3px solid var(--accent-green)",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{tr("Saving trades…")}</div>
          </div>
        )}
      </div>

      {/* Confirm bar */}
      {status === "success" && result && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: "20px", padding: "16px 20px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "12px",
        }}>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--accent-green)", fontWeight: "700" }}>{result.count}  {tr("trades")}</span>
            {tr(" ")}{tr("ready to import — check the target account next")}</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={reset}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "9px 16px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <X size={13} />
              {tr("Cancel")}</button>
            <button
              onClick={openConfirm}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "9px 20px", borderRadius: "8px",
                border: "none", background: "var(--accent-green)",
                color: "#000", fontSize: "13px", fontWeight: "700",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {tr("Choose account…")}<ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Target account confirmation */}
      {confirming && result && (
        <div
          onClick={() => setConfirming(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "460px",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "14px", padding: "24px",
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
              {tr("Import into which account?")}</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "18px" }}>
              {result.count}  {tr("trade")}{tr(result.count !== 1 ? "s" : "")}  {tr("from")}{tr(" ")}
              <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{fileName}</span>{tr(" ")}
              {tr("will be saved under the account you pick here.")}</div>

            <div style={{ position: "relative", marginBottom: "14px" }}>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                autoFocus
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: "8px",
                  border: "1px solid var(--accent-green)", background: "var(--bg-secondary)",
                  color: "var(--text-primary)", fontSize: "14px", fontWeight: "600",
                  fontFamily: "'DM Sans', sans-serif",
                  appearance: "none", WebkitAppearance: "none",
                  cursor: "pointer", paddingRight: "36px", outline: "none",
                }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {a.platform}</option>
                ))}
                <option value="">{tr("No account (leave unlinked)")}</option>
              </select>
              <ChevronDown
                size={14} color="var(--text-secondary)"
                style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              />
            </div>

            {misfiled.length > 0 && (
              <div style={{
                display: "flex", gap: "8px", alignItems: "flex-start",
                padding: "10px 12px", borderRadius: "8px", marginBottom: "14px",
                background: "rgba(255,77,106,0.08)", border: "1px solid rgba(255,77,106,0.3)",
                fontSize: "12px", color: "var(--loss)", lineHeight: "1.5",
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span>
                  {misfiled.length} {tr("of these trades already exist under a different account. Continuing re-assigns them.")}</span>
              </div>
            )}

            {!targetId && (
              <div style={{
                padding: "10px 12px", borderRadius: "8px", marginBottom: "14px",
                background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.3)",
                fontSize: "12px", color: "#fb923c", lineHeight: "1.5",
              }}>
                {tr("These trades will be saved without an account, so equity and analytics will not include them.")}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setConfirming(false)}
                style={{
                  padding: "9px 16px", borderRadius: "8px",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {tr("Cancel")}</button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: "9px 20px", borderRadius: "8px",
                  border: "none", background: "var(--accent-green)",
                  color: "#000", fontSize: "13px", fontWeight: "700",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {tr("Yes, import")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview table */}
      {status === "success" && result && (
        <div style={{ marginTop: "24px" }}>
          <div style={{
            fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px",
            fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {tr("Preview — first")}{Math.min(result.trades.length, 10)}  {tr("of")} {result.trades.length}
          </div>
          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                  {["Date", "Symbol", "Type", "Qty", "Entry", "Exit", "P&L", "Tags"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 14px", textAlign: "left",
                      color: "var(--text-secondary)", fontWeight: "600", whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.trades.slice(0, 10).map((trade) => (
                  <tr key={trade.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{trade.date}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-primary)", fontWeight: "700" }}>{trade.underlying}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {trade.optionType ? (
                        <span style={{
                          padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "700",
                          background: trade.optionType === "call" ? "rgba(77,159,255,0.15)" : "rgba(255,77,106,0.15)",
                          color: trade.optionType === "call" ? "var(--accent-blue)" : "var(--loss)",
                        }}>
                          {trade.optionType.toUpperCase()} {tr(trade.strike ? `${fmtMoneyRaw(trade.strike)}` : "")}
                        </span>
                      ) : (
                        <span style={{
                          padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "700",
                          background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)",
                        }}>
                          {trade.type.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{trade.quantity}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{currencySign()}{trade.entryPrice}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{currencySign()}{trade.exitPrice}</td>
                    <td style={{ padding: "10px 14px", fontWeight: "700", color: trade.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                      {tr(trade.pnl >= 0 ? "+" : "")}{currencySign()}{trade.pnl.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {(Array.isArray(trade.tags) ? trade.tags : []).slice(0, 2).map((tag: string) => (
                          <span key={tag} style={{
                            padding: "1px 6px", borderRadius: "4px", fontSize: "10px",
                            background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)",
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
