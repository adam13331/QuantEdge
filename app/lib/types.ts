export interface Trade {
  id: string;
  date: string;
  symbol: string;
  underlying: string;
  type: string;
  direction: string;
  optionType?: string;
  strike?: number;
  expiry?: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  commission: number;
  fees: number;
  pnl: number;
  status: string;
  entryTime?: string;
  exitTime?: string;
  rr?: string;
  plannedRisk?: number;
  durationMin?: number;
  mae?: number;
  mfe?: number;
  postCloseMfe?: number;
  exitReason?: string;
  magic?: number;
  legs?: number;
  averagedDown?: boolean;
  balanceAfter?: number;
  hourOfDay?: number;
  playbookId?: string;
  planId?: string;
  tags?: string[] | string;
  journalEntry?: string;
  link?: string;
  imageUrls?: string[] | string;
  accountId?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description?: string;
  rules: string[] | string;
  timeframes?: string;
  instruments?: string;
  entryTriggers: string[] | string;
  exitRules?: string;
  notes?: string;
  imageUrls: string[] | string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  platform: string;
  initialBalance: number;
  currency: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface JournalTemplate {
  id: string;
  name: string;
  content: string;
  scope: string;
  createdAt: string;
}

export type PageId =
  | "dashboard"
  | "journal"
  | "journal-editor"
  | "calendar"
  | "propfirm"
  | "import"
  | "accounts"
  | "settings"
  | "export"
  | "playbook";
  