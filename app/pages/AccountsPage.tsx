"use client";
import { useState } from "react";
import { useApp, PORTFOLIO_ID, isPortfolio } from "../context/AppContext";
import { Account } from "../lib/types";
import { Wallet, Plus, Check, Trash2, ChevronDown, Layers } from "lucide-react";

// Supported trading platforms. Add more here as needed —
// the list drives the create-account dropdown and nothing else.
const PLATFORMS = ["MetaTrader"];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg-secondary)",
  color: "#f0f0ff", fontSize: "13px", fontFamily: "'DM Sans', sans-serif",
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
        size={14} color="#a8a8c8"
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

  const tradeCountFor = (id: string) =>
    id === PORTFOLIO_ID ? allTrades.length : allTrades.filter((t) => t.accountId === id).length;

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
    if (id === PORTFOLIO_ID) return;
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
          <p style={{ color: "#a8a8c8", fontSize: "14px", marginTop: "4px" }}>
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
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#f0f0ff", marginBottom: "20px" }}>
            {accounts.length === 0 ? "Create your first account" : "New Account"}
          </h3>

          {error && (
            <div style={{
              background: "rgba(255,77,106,0.1)", border: "1px solid #ff4d6a",
              borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
              color: "#ff4d6a", fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#a8a8c8", fontWeight: "600", display: "block", marginBottom: "6px" }}>
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
              <label style={{ fontSize: "12px", color: "#a8a8c8", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Platform
              </label>
              <SelectWrapper>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={selectStyle}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrapper>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#a8a8c8", fontWeight: "600", display: "block", marginBottom: "6px" }}>
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
              <label style={{ fontSize: "12px", color: "#a8a8c8", fontWeight: "600", display: "block", marginBottom: "6px" }}>
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
                  color: "#f0f0ff", fontSize: "13px", cursor: "pointer",
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {accounts.map((account: Account) => {
            const isActive = activeAccount?.id === account.id;
            return (
              <div
                key={account.id}
                onClick={() => setActiveAccount(account)}
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${isActive ? "var(--accent-green)" : "var(--border)"}`,
                  borderRadius: "16px", padding: "20px", cursor: "pointer",
                  transition: "all 0.15s ease", position: "relative",
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
                  {isPortfolio(account)
                    ? <Layers size={18} color={isActive ? "var(--accent-green)" : "#a8a8c8"} />
                    : <Wallet size={18} color={isActive ? "var(--accent-green)" : "#a8a8c8"} />}
                </div>

                <div style={{ fontSize: "16px", fontWeight: "700", color: "#f0f0ff", marginBottom: "4px" }}>
                  {account.name}
                </div>
                <div style={{ fontSize: "12px", color: "#a8a8c8", marginBottom: "16px" }}>
                  {isPortfolio(account)
                    ? `All accounts · ${tradeCountFor(account.id)} trades`
                    : `${account.platform} · ${tradeCountFor(account.id)} trade${tradeCountFor(account.id) === 1 ? "" : "s"}`}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontSize: "11px", color: "#a8a8c8", marginBottom: "2px" }}>
                      {isPortfolio(account) ? "Portfolio Balance" : "Initial Balance"}
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
                            color: "#f0f0ff", fontSize: "15px", fontWeight: "700",
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
                        <span style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-green)" }}>
                          {account.currency} {account.initialBalance.toLocaleString()}
                        </span>
                        <span style={{ fontSize: "10px", color: "#a8a8c8" }}>edit</span>
                      </button>
                    )}
                  </div>
                  {!isPortfolio(account) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(account.id); }}
                      style={{
                        background: "rgba(255,77,106,0.1)", border: "none",
                        borderRadius: "6px", padding: "6px", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Trash2 size={13} color="#ff4d6a" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
