"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Trade, Account, TradePlan, Playbook, PageId } from "../lib/types";

interface Tag {
  id: string;
  name: string;
}

interface AppContextType {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
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
  plans: TradePlan[];
  reloadPlans: () => Promise<void>;
  playbook: Playbook[];
  reloadPlaybook: () => Promise<void>;
}

// Sentinel id for the built-in aggregate account. It is never deleted and
// its balance is the base used for return calculations when it is selected.
export const PORTFOLIO_ID = "portfolio";

function isPortfolio(account: Account | null): boolean {
  return account?.id === PORTFOLIO_ID;
}
export { isPortfolio };

// Portfolio always sorts first so it is also the default selection.
function sortAccounts(list: Account[]): Account[] {
  return [...list].sort((a, b) => {
    if (isPortfolio(a)) return -1;
    if (isPortfolio(b)) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
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
  const [activeTradeId, setActiveTradeId]     = useState<string | null>(null);
  const [allTrades, setAllTrades]             = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade]     = useState<Trade | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [accounts, setAccounts]               = useState<Account[]>([]);
  const [activeAccount, setActiveAccountState] = useState<Account | null>(null);
  const [tags, setTags]                       = useState<Tag[]>([]);
  const [plans, setPlans]                     = useState<TradePlan[]>([]);
  const [playbook, setPlaybook]               = useState<Playbook[]>([]);

  // Portfolio aggregates every account; anything else is scoped to itself.
  const trades = activeAccount
    ? isPortfolio(activeAccount)
      ? allTrades
      : allTrades.filter((t) => t.accountId === activeAccount.id)
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

  const reloadPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (Array.isArray(data)) setPlans(data);
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  }, []);

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
    reloadPlans();
    reloadPlaybook();
  }, []);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch("/api/accounts");
        const data = await res.json();
        if (!Array.isArray(data)) return;

        // The Portfolio account is created on first load. Its balance defaults
        // to the sum of the trading accounts' starting balances, which can then
        // be overridden by editing it on the Accounts page.
        if (!data.some((a: Account) => a.id === PORTFOLIO_ID)) {
          const total = data.reduce((sum: number, a: Account) => sum + a.initialBalance, 0);
          const created = await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: PORTFOLIO_ID,
              name: "Portfolio",
              platform: "MetaTrader",
              initialBalance: total,
              currency: data[0]?.currency || "USD",
            }),
          });
          if (created.ok) data.push(await created.json());
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
      activeTradeId, setActiveTradeId,
      trades, allTrades, setTrades, reloadTrades, updateTradeInMemory, deleteTrade,
      selectedTrade, setSelectedTrade,
      loading,
      accounts, activeAccount, setActiveAccount, addAccount, updateAccount,
      tags, reloadTags, addTag,
      plans, reloadPlans,
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
