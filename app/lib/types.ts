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
  atr?: number;
  spread?: number;
  dayRange?: number;
  playbookId?: string;
  setupVersion?: number;
  planId?: string;
  tags?: string[] | string;
  mistakeTags?: string[] | string;
  followedPlan?: boolean | null;
  confidence?: number;
  isForwardTest?: boolean;
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
  revisions?: PlaybookRevision[] | string;
  createdAt: string;
  updatedAt: string;
}

// A revision is a dated snapshot of the rules after an edit. Trades carry the
// version that was live at entry, so "before vs after the change" is a query
// rather than a guess.
export interface PlaybookRevision {
  version: number;
  effectiveDate: string;
  summary: string;
  createdAt: string;
}

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  change: string;
  expectedEffect?: string | null;
  startDate: string;
  endDate?: string | null;
  playbookId?: string;
  status: "running" | "concluded" | "abandoned" | string;
  conclusion?: string;
  createdAt: string;
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
  | "journal-editor"
  | "calendar"
  | "propfirm"
  | "import"
  | "accounts"
  | "settings"
  | "export"
  | "playbook"
  | "review";
  