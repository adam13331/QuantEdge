"use client";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Account } from "../lib/types";
import { Wallet, Plus, Check, Trash2, ChevronDown } from "lucide-react";

// Supported trading platforms. Add more here as needed —
// the list drives the create-account dropdown and nothing else.
const PLATFORMS = ["MetaTrader"];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: "13px", fontFamily: "'DM Sans', sans-serif",
  boxSizing: "border-box", outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none", WebkitAppearance: "none",
  cursor: "pointer", paddingRight: "36px",
};

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      {children}
      <ChevronDown
        size={14} color="var(--text-secondary)"
        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      />
    </div>
  );
}

export default function AccountsPage() {
  const { accounts, activeAccount, setActiveAccount, addAccount, updateAccount, allTrades } = useApp();
  const [showForm, setShowForm]           = useState(accounts.length === 0);
  const [name, setName]                   = useState("");
  const [platform, setPlatform]           = useState(PLATFORMS[0]);
  const [initialBalance, setInitialBalance] = useState("");
  const [currency, setCurrency]           = useState("USD");
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [balanceDraft, setBalanceDraft]   = useState("");

  // Live equity is the starting balance plus every closed trade on this
  // account. It is the figure a trader actually checks, so it leads the card
  // instead of sitting behind a page switch.
  const statsFor = (id: string) => {
    const own = allTrades.filter((t) => t.accountId === id);
    const pnl = own.reduce((sum, t) => sum + (Number.isFinite(t.pnl) ? t.pnl : 0), 0);
    const account = accounts.find((a) => a.id === id);
    const start = account?.initialBalance ?? 0;
    return { count: own.length, pnl, equity: start + pnl, pct: start > 0 ? (pnl / start) * 100 : null };
  };

  const fmtAmount = (currency: string, value: number, signed = false) =>
    `${signed && value > 0 ? "+" : value < 0 ? "-" : ""}${currency} ${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSaveBalance = async (account: Account) => {
    const value = parseFloat(balanceDraft);
    if (isNaN(value) || value < 0) return;
    const updated: Account = { ...account, initialBalance: value };
    setEditingBalance(null);
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, initialBalance: value }),
    });
    updateAccount(updated);
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError("Account name is required");
    if (!initialBalance || isNaN(Number(initialBalance))) return setError("Valid initial balance is required");

    setSaving(true);
    setError("");

    const account: Account = {
      id: `acc-${Date.now()}`,
      name: name.trim(),
      platform,
      initialBalance: parseFloat(initialBalance),
      currency,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      });
      if (!res.ok) throw new Error("Failed to create account");
      addAccount(account);
      setShowForm(false);
      setName("");
      setInitialBalance("");
    } catch {
      setError("Failed to save account. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this account? This won't delete your trades.")) return;
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    window.location.reload();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            Accounts
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Manage your trading accounts and track equity per account
          </p>
        </div>
        {accounts.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 16px", borderRadius: "8px", border: "none",
              background: "var(--accent-green)", color: "#000", fontSize: "13px",
              fontWeight: "600", cursor: "pointer",
            }}
          >
            <Plus size={15} />
            New Account
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "16px", padding: "24px", marginBottom: "24px",
        }}>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "20px" }}>
            {accounts.length === 0 ? "Create your first account" : "New Account"}
          </h3>

          {error && (
            <div style={{
              background: "rgba(255,77,106,0.1)", border: "1px solid var(--loss)",
              borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
              color: "var(--loss)", fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Account Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Trading Account"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Platform
              </label>
              <SelectWrapper>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={selectStyle}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrapper>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Initial Balance
              </label>
              <input
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="e.g. 10000" type="number"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Currency
              </label>
              <SelectWrapper>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={selectStyle}>
                  {["USD", "EUR", "GBP", "CAD", "AUD", "JPY"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </SelectWrapper>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                padding: "10px 20px", borderRadius: "8px", border: "none",
                background: "var(--accent-green)", color: "#000", fontSize: "13px",
                fontWeight: "600", cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Creating..." : "Create Account"}
            </button>
            {accounts.length > 0 && (
              <button
                onClick={() => setShowForm(false)}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--text-primary)", fontSize: "13px", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Account Cards */}
      {accounts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {accounts.map((account: Account) => {
            const isActive = activeAccount?.id === account.id;
            const stats = statsFor(account.id);
            return (
              <div
                key={account.id}
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${isActive ? "var(--accent-green)" : "var(--border)"}`,
                  borderRadius: "16px", padding: "20px",
                  transition: "all 0.15s ease", position: "relative",
                  display: "flex", flexDirection: "column",
                }}
              >
                {isActive && (
                  <div style={{
                    position: "absolute", top: "12px", right: "12px",
                    background: "var(--accent-green-dim)", borderRadius: "20px",
                    padding: "2px 8px", display: "flex", alignItems: "center", gap: "4px",
                  }}>
                    <Check size={10} color="var(--accent-green)" />
                    <span style={{ fontSize: "10px", color: "var(--accent-green)", fontWeight: "600" }}>ACTIVE</span>
                  </div>
                )}

                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  background: isActive ? "var(--accent-green-dim)" : "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "12px",
                }}>
                  <Wallet size={18} color={isActive ? "var(--accent-green)" : "var(--text-secondary)"} />
                </div>

                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                  {account.name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                  {account.platform} · {stats.count} trade{stats.count === 1 ? "" : "s"}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.4px" }}>
                    {fmtAmount(account.currency, stats.equity)}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>equity</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: stats.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                    {fmtAmount(account.currency, stats.pnl, true)}
                  </span>
                  <span style={{ fontSize: "11px", color: stats.pnl >= 0 ? "var(--profit)" : "var(--loss)", opacity: 0.85 }}>
                    {stats.pct === null ? "P&L" : `${stats.pct >= 0 ? "+" : ""}${stats.pct.toFixed(2)}%`}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>
                      Starting balance
                    </div>
                    {editingBalance === account.id ? (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input
                          value={balanceDraft}
                          onChange={(e) => setBalanceDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveBalance(account);
                            if (e.key === "Escape") setEditingBalance(null);
                          }}
                          type="number"
                          autoFocus
                          style={{
                            width: "110px", padding: "5px 8px", borderRadius: "6px",
                            border: "1px solid var(--accent-green)", background: "var(--bg-secondary)",
                            color: "var(--text-primary)", fontSize: "15px", fontWeight: "700",
                            fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
                          }}
                        />
                        <button
                          onClick={() => handleSaveBalance(account)}
                          style={{
                            background: "var(--accent-green-dim)", border: "none", borderRadius: "6px",
                            padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center",
                          }}
                        >
                          <Check size={13} color="var(--accent-green)" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingBalance(account.id);
                          setBalanceDraft(String(account.initialBalance));
                        }}
                        title="Edit balance"
                        style={{
                          background: "none", border: "none", cursor: "pointer", padding: 0,
                          display: "flex", alignItems: "center", gap: "6px",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {fmtAmount(account.currency, account.initialBalance)}
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", textDecoration: "underline" }}>edit</span>
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {!isActive && (
                      <button
                        onClick={() => setActiveAccount(account)}
                        style={{
                          padding: "6px 10px", borderRadius: "6px", cursor: "pointer",
                          border: "1px solid var(--border)", background: "transparent",
                          color: "var(--text-secondary)", fontSize: "11px", fontWeight: "600",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Set active
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(account.id)}
                      aria-label={`Delete ${account.name}`}
                      title="Delete account"
                      style={{
                        background: "rgba(255,77,106,0.1)", border: "none",
                        borderRadius: "6px", padding: "6px", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Trash2 size={13} color="var(--loss)" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
