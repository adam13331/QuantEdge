"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Trade, Account, Playbook, PageId } from "../lib/types";

interface Tag {
  id: string;
  name: string;
}

// The single time interval every stats page reads. It lives here rather than
// in page state so switching tabs cannot reset it: the range is a user
// selection about the whole journal, not a per-page view option.
export interface DateRange {
  from: string;
  to: string;
}

const EMPTY_RANGE: DateRange = { from: "", to: "" };

const RANGE_STORAGE_KEY = "quantedge_date_range";
const SYMBOL_STORAGE_KEY = "quantedge_symbol_filter";

function loadRange(): DateRange {
  if (typeof window === "undefined") return EMPTY_RANGE;
  try {
    const stored = localStorage.getItem(RANGE_STORAGE_KEY);
    if (!stored) return EMPTY_RANGE;
    const parsed = JSON.parse(stored);
    return {
      from: typeof parsed.from === "string" ? parsed.from : "",
      to: typeof parsed.to === "string" ? parsed.to : "",
    };
  } catch {
    return EMPTY_RANGE;
  }
}

interface AppContextType {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  clearDateRange: () => void;
  // "" means every symbol. The Dashboard control writes it and the analytics
  // slice reads it, so the headline cards and tabs scope to the same market.
  symbolFilter: string;
  setSymbolFilter: (symbol: string) => void;
  activeTradeId: string | null;
  setActiveTradeId: (id: string | null) => void;
  trades: Trade[];
  allTrades: Trade[];
  setTrades: (trades: Trade[]) => void;
  reloadTrades: () => Promise<void>;
  updateTradeInMemory: (id: string, patch: Partial<Trade>) => void;
  deleteTrade: (id: string) => Promise<void>;
  selectedTrade: Trade | null;
  setSelectedTrade: (trade: Trade | null) => void;
  loading: boolean;
  accounts: Account[];
  activeAccount: Account | null;
  setActiveAccount: (account: Account) => void;
  addAccount: (account: Account) => void;
  updateAccount: (account: Account) => void;
  tags: Tag[];
  reloadTags: () => Promise<void>;
  addTag: (name: string) => Promise<Tag | null>;
  playbook: Playbook[];
  reloadPlaybook: () => Promise<void>;
}

// The built-in Portfolio aggregate was removed — every account stands alone.
// The id is kept only so a leftover row from an older version is cleaned up on
// load instead of showing up as an un-deletable phantom account.
const STALE_PORTFOLIO_ID = "portfolio";

function sortAccounts(list: Account[]): Account[] {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

const AppContext = createContext<AppContextType | null>(null);

function parseTrades(data: Trade[]): Trade[] {
  return data.map((t: Trade) => ({
    ...t,
    tags: typeof t.tags === "string" ? JSON.parse(t.tags) : t.tags || [],
    imageUrls: typeof t.imageUrls === "string" ? JSON.parse(t.imageUrls) : t.imageUrls || [],
  }));
}

function parsePlaybook(data: Playbook[]): Playbook[] {
  return data.map((p) => ({
    ...p,
    rules: typeof p.rules === "string" ? JSON.parse(p.rules) : p.rules || [],
    entryTriggers: typeof p.entryTriggers === "string" ? JSON.parse(p.entryTriggers) : p.entryTriggers || [],
    imageUrls: typeof p.imageUrls === "string" ? JSON.parse(p.imageUrls) : p.imageUrls || [],
  }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage]           = useState<PageId>("dashboard");
  // Start from EMPTY_RANGE so the hydration render matches the server; the
  // stored range is applied in the effect below. Lazy-reading localStorage
  // here would produce different input values on the client than the server
  // rendered, failing hydration.
  const [dateRange, setDateRangeState]        = useState<DateRange>(EMPTY_RANGE);
  const [symbolFilter, setSymbolFilterState]  = useState<string>("");
  const [activeTradeId, setActiveTradeId]     = useState<string | null>(null);
  const [allTrades, setAllTrades]             = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade]     = useState<Trade | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [accounts, setAccounts]               = useState<Account[]>([]);
  const [activeAccount, setActiveAccountState] = useState<Account | null>(null);
  const [tags, setTags]                       = useState<Tag[]>([]);
  const [playbook, setPlaybook]               = useState<Playbook[]>([]);

  // Every trade belongs to exactly one account; the Portfolio aggregate that
  // used to show all trades at once is gone.
  const trades = activeAccount
    ? allTrades.filter((t) => t.accountId === activeAccount.id)
    : allTrades;

  const reloadTrades = async () => {
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (Array.isArray(data)) setAllTrades(parseTrades(data));
    } catch (err) {
      console.error("Failed to load trades:", err);
    }
  };

  const updateTradeInMemory = useCallback((id: string, patch: Partial<Trade>) => {
    setAllTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    await fetch("/api/trades", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAllTrades((prev) => prev.filter((t) => t.id !== id));
    setSelectedTrade((prev) => (prev?.id === id ? null : prev));
  }, []);

  const reloadTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      if (Array.isArray(data)) setTags(data);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  }, []);

  const addTag = async (name: string): Promise<Tag | null> => {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      const tag = await res.json();
      setTags((prev) => {
        if (prev.find((t) => t.name === tag.name)) return prev;
        return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name));
      });
      return tag;
    } catch {
      return null;
    }
  };

  const reloadPlaybook = useCallback(async () => {
    try {
      const res = await fetch("/api/playbook");
      const data = await res.json();
      if (Array.isArray(data)) setPlaybook(parsePlaybook(data));
    } catch (err) {
      console.error("Failed to load playbook:", err);
    }
  }, []);

  const seedTagsFromTrades = async (trades: Trade[]) => {
    const existingRes = await fetch("/api/tags");
    const existing: Tag[] = await existingRes.json();
    const existingNames = new Set(existing.map((t) => t.name));
    const allTagNames = new Set<string>();
    for (const trade of trades) {
      const tradeTags = Array.isArray(trade.tags) ? trade.tags as string[] : [];
      tradeTags.forEach((tag) => allTagNames.add(tag));
    }
    const missing = Array.from(allTagNames).filter((name) => !existingNames.has(name));
    for (const name of missing) {
      await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }
    if (missing.length > 0) await reloadTags();
    else setTags(existing);
  };

  const setDateRange = (range: DateRange) => {
    setDateRangeState(range);
    localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(range));
  };

  const clearDateRange = () => setDateRange(EMPTY_RANGE);

  const setSymbolFilter = (symbol: string) => {
    setSymbolFilterState(symbol);
    if (symbol) localStorage.setItem(SYMBOL_STORAGE_KEY, symbol);
    else localStorage.removeItem(SYMBOL_STORAGE_KEY);
  };

  useEffect(() => {
    setDateRangeState(loadRange());
    // Same hydration rule as the range: start empty, restore after mount.
    setSymbolFilterState(localStorage.getItem(SYMBOL_STORAGE_KEY) || "");
  }, []);

  useEffect(() => {
    const load = async () => {
      await reloadTrades();
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (allTrades.length > 0) {
      seedTagsFromTrades(allTrades);
    } else {
      reloadTags();
    }
  }, [allTrades.length > 0]);

  useEffect(() => {
    reloadPlaybook();
  }, []);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch("/api/accounts");
        let data = await res.json();
        if (!Array.isArray(data)) return;

        // Remove a leftover Portfolio row from an older version. Its balance
        // was derived, never authored, so nothing of value is lost; leaving it
        // would offer an account the user can never delete.
        const stale = data.find((a: Account) => a.id === STALE_PORTFOLIO_ID);
        if (stale) {
          await fetch("/api/accounts", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: STALE_PORTFOLIO_ID }),
          });
          data = data.filter((a: Account) => a.id !== STALE_PORTFOLIO_ID);
        }

        const sorted = sortAccounts(data as Account[]);
        setAccounts(sorted);
        if (sorted.length > 0) setActiveAccountState(sorted[0]);
      } catch (err) {
        console.error("Failed to load accounts:", err);
      }
    };
    loadAccounts();
  }, []);

  const setTrades        = (newTrades: Trade[]) => setAllTrades(newTrades);
  const setActiveAccount = (account: Account)  => setActiveAccountState(account);
  const addAccount = (account: Account) => {
    setAccounts((prev) => sortAccounts([...prev, account]));
    if (!activeAccount) setActiveAccountState(account);
  };
  const updateAccount = (account: Account) => {
    setAccounts((prev) => sortAccounts(prev.map((a) => (a.id === account.id ? account : a))));
    setActiveAccountState((prev) => (prev?.id === account.id ? account : prev));
  };

  return (
    <AppContext.Provider value={{
      activePage, setActivePage,
      dateRange, setDateRange, clearDateRange,
      symbolFilter, setSymbolFilter,
      activeTradeId, setActiveTradeId,
      trades, allTrades, setTrades, reloadTrades, updateTradeInMemory, deleteTrade,
      selectedTrade, setSelectedTrade,
      loading,
      accounts, activeAccount, setActiveAccount, addAccount, updateAccount,
      tags, reloadTags, addTag,
      playbook, reloadPlaybook,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
