"use client";
import { t as tr } from "../lib/i18n";
import {
  LayoutDashboard, Calendar,
  Upload, PlusCircle, Settings, Wallet, ChevronDown,
  FileDown, Library, Shield, HelpCircle, Search, CalendarCheck,
} from "lucide-react";
import Image from "next/image";
import { useApp } from "../context/AppContext";
import { useSettings } from "../hooks/useSettings";
import { PageId, Account } from "../lib/types";
import { useEffect, useState } from "react";

const NAV_ITEMS: { icon: any; label: string; id: PageId }[] = [
  { icon: LayoutDashboard,   label: "Dashboard",    id: "dashboard"      },
  { icon: Calendar,          label: "Calendar",      id: "calendar"       },
  { icon: Shield,            label: "Prop Firm",     id: "propfirm"       },
  { icon: Library,           label: "Playbook",      id: "playbook"       },
  { icon: CalendarCheck,     label: "Review",        id: "review"         },
  { icon: Wallet,            label: "Accounts",      id: "accounts"       },
  { icon: Upload,            label: "Import Trades", id: "import"         },
  { icon: FileDown,          label: "Export",        id: "export"         },
];

export default function Sidebar() {
  const { activePage, setActivePage, accounts, activeAccount, setActiveAccount } = useApp();
  const { settings } = useSettings();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  // Below ~1100px the fixed 220px rail leaves too little room for the headline
  // grids. Collapse to icons and keep every control reachable.
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1100px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <aside style={{
      width: compact ? "72px" : "220px", minWidth: compact ? "72px" : "220px",
      background: "var(--bg-secondary)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "24px 0",
    }}>
      {/* Logo */}
      <div style={{ paddingBottom: compact ? "16px" : "28px" }}>
        {compact ? (
          <Image
            src="/quantedge-icon.svg"
            alt={tr("QuantEdge")}
            width={32}
            height={32}
            priority
            style={{ display: "block", margin: "0 auto" }}
          />
        ) : (
          <Image
            src={settings.theme === "light" ? "/quantedge-logo-light.svg" : "/quantedge-logo-dark.svg"}
            alt={tr("QuantEdge")}
            width={190}
            height={46}
            priority
            style={{ display: "block", margin: "0 auto" }}
          />
        )}
      </div>

      {/* Account Switcher */}
      {accounts.length > 0 && (
        <div style={{ padding: compact ? "0 8px 16px" : "0 12px 20px", position: "relative" }}>
          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            aria-label={tr(activeAccount ? `Active account: ${activeAccount.name}` : "Select account")}
            title={activeAccount?.name}
            style={{
              width: "100%", display: "flex", alignItems: "center",
              justifyContent: compact ? "center" : "space-between",
              padding: compact ? "8px" : "10px 12px",
              borderRadius: "8px", border: "1px solid var(--border)",
              background: "var(--bg-card)", cursor: "pointer", gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "6px",
                background: "var(--accent-green-dim)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Wallet size={12} color="var(--accent-green)" />
              </div>
              {!compact && (
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: "12px", fontWeight: "600", color: "var(--text-primary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {activeAccount?.name || "Select Account"}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{activeAccount?.platform || ""}</div>
                </div>
              )}
            </div>
            {!compact && (
              <ChevronDown
                size={12} color="var(--text-secondary)"
                style={{
                  transform: showAccountMenu ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease", flexShrink: 0,
                }}
              />
            )}
          </button>

          {showAccountMenu && (
            <div style={{
              position: "absolute", top: "calc(100% - 8px)", left: compact ? "8px" : "12px",
              right: "auto", width: compact ? "260px" : undefined,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "8px", zIndex: 100, overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}>
              {accounts.map((account: Account) => (
                <button
                  key={account.id}
                  onClick={() => { setActiveAccount(account); setShowAccountMenu(false); }}
                  style={{
                    width: "100%", padding: "10px 12px", border: "none",
                    background: activeAccount?.id === account.id ? "rgba(0,229,122,0.1)" : "transparent",
                    cursor: "pointer", textAlign: "left", display: "flex",
                    alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{account.name}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                      {account.platform} · {account.currency} {account.initialBalance.toLocaleString()}
                    </div>
                  </div>
                  {activeAccount?.id === account.id && (
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-green)", flexShrink: 0 }} />
                  )}
                </button>
              ))}
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <button
                  onClick={() => { setActivePage("accounts"); setShowAccountMenu(false); }}
                  style={{
                    width: "100%", padding: "10px 12px", border: "none",
                    background: "transparent", cursor: "pointer",
                    textAlign: "left", fontSize: "12px", color: "var(--text-secondary)",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <PlusCircle size={12} />
                  {tr("Manage Accounts")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No accounts nudge */}
      {accounts.length === 0 && (
        <div style={{ padding: compact ? "0 8px 16px" : "0 12px 20px" }}>
          <button
            onClick={() => setActivePage("accounts")}
            aria-label={tr("Create an account")}
            title={tr("Create an account")}
            style={{
              width: "100%", padding: compact ? "10px" : "10px 12px", borderRadius: "8px",
              border: "1px dashed var(--border)", background: "transparent",
              cursor: "pointer", textAlign: "left", justifyContent: compact ? "center" : "flex-start",
              fontSize: "12px", color: "var(--text-secondary)",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <PlusCircle size={12} />
            {!compact && "Create an account"}
          </button>
        </div>
      )}

      {/* Search. A journal with a year of trades cannot be browsed a month at
          a time, so the palette is reachable from the rail and from ⌘K. */}
      <div style={{ padding: compact ? "0 8px 12px" : "0 12px 12px" }}>
        <button
          onClick={() => window.dispatchEvent(new Event("quantedge:search"))}
          aria-label={tr("Search trades")}
          title={tr("Search trades (Ctrl/Cmd+K)")}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: "8px",
            justifyContent: compact ? "center" : "flex-start",
            padding: compact ? "10px 0" : "8px 10px", borderRadius: "8px",
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-secondary)", cursor: "pointer",
            fontSize: "12px", fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <Search size={14} />
          {!compact && (
            <>
              <span style={{ flex: 1, textAlign: "left" }}>{tr("Search trades")}</span>
              <kbd style={{
                fontSize: "10px", fontFamily: "monospace", color: "var(--text-muted)",
                border: "1px solid var(--border)", borderRadius: "4px", padding: "1px 4px",
              }}>
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: "0 12px", overflowY: "auto" }}>
        {NAV_ITEMS.map(({ icon: Icon, label, id }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              aria-current={active ? "page" : undefined}
              aria-label={compact ? tr(label) : undefined}
              title={compact ? label : undefined}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: compact ? "center" : "flex-start",
                gap: "10px", padding: compact ? "10px 0" : "10px 12px", borderRadius: "8px",
                border: "none", cursor: "pointer", marginBottom: "2px",
                background: active ? "var(--accent-green-dim)" : "transparent",
                color: active ? "var(--accent-green)" : "var(--text-secondary)",
                fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
                fontWeight: active ? "600" : "400",
                transition: "all 0.15s ease", textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              <Icon size={16} />
              {!compact && tr(label)}
            </button>
          );
        })}
      </nav>

      {/* Settings + shortcut help */}
      <div style={{ padding: compact ? "0 8px" : "0 12px", borderTop: "1px solid var(--border)", display: "flex", gap: "4px" }}>
        <button
          onClick={() => setActivePage("settings")}
          aria-current={activePage === "settings" ? "page" : undefined}
          aria-label={compact ? tr("Settings") : undefined}
          title={compact ? tr("Settings") : undefined}
          style={{
            flex: 1, display: "flex", alignItems: "center",
            justifyContent: compact ? "center" : "flex-start", gap: "10px",
            padding: compact ? "10px 0" : "10px 12px", borderRadius: "8px", border: "none",
            background: activePage === "settings" ? "var(--accent-green-dim)" : "transparent",
            color: activePage === "settings" ? "var(--accent-green)" : "var(--text-muted)",
            fontSize: "13px", fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", fontWeight: activePage === "settings" ? "600" : "400",
          }}
        >
          <Settings size={15} />
          {!compact && tr("Settings")}
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("quantedge:shortcuts"))}
          aria-label={tr("Keyboard shortcuts")}
          title={tr("Keyboard shortcuts (press /)")}
          style={{
            width: "36px", display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "8px", border: "none", background: "transparent",
            color: "var(--text-muted)", cursor: "pointer",
          }}
        >
          <HelpCircle size={15} />
        </button>
      </div>
    </aside>
  );
}
