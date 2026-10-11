import { Trade } from "./types";

// The exporter (scripts/JournedgeExport.mq5) writes this line verbatim. Columns
// are appended over time, so detection and parsing work off a required prefix
// rather than an exact match — files exported by an older build still import.
const JOURNEDGE_COLUMNS = [
  "Date", "Symbol", "Underlying", "Type", "Direction", "Option Type", "Strike",
  "Expiry", "Quantity", "Entry Price", "Exit Price", "Commission", "Fees",
  "P&L", "Status", "Entry Time", "Exit Time", "R:R", "Tags", "Journal",
  "Account ID", "Ticket", "Planned Risk", "Duration (min)", "MAE", "MFE",
  "Exit Reason", "Magic", "Legs", "Averaged Down", "Balance After",
] as const;

const JOURNEDGE_HEADER = JOURNEDGE_COLUMNS.join(",");

// Everything up to and including "P&L" has always been present.
const REQUIRED_COLUMNS = JOURNEDGE_COLUMNS.slice(0, 14);

function splitHeader(line: string): string[] {
  return line
    .replace(/^\uFEFF/, "")
    .replace(/"/g, "")
    .split(/[,\t]/)
    .map((col) => col.trim());
}

// First non-empty line, tolerant of CRLF / CR / LF endings.
export function firstLine(csvText: string): string {
  const line = csvText.split(/\r\n|\n|\r/).find((l) => l.trim().length > 0) ?? "";
  return line.replace(/^\uFEFF/, "");
}

export function isMetaTraderCSV(csvText: string): boolean {
  const cols = splitHeader(firstLine(csvText)).map((c) => c.toLowerCase());
  // Older exports stop at "Account ID"; newer ones append extra columns.
  return REQUIRED_COLUMNS.every((c, i) => cols[i] === c.toLowerCase());
}

// MetaTrader's FileWrite emits tab-separated rows when the FILE_CSV flag on
// FileOpen isn't honoured, so accept either delimiter. Commas win when a line
// contains both, because tags and comments have their commas stripped before
// they are ever written.
function parseCSVLine(line: string): string[] {
  const delim = line.includes(",") ? "," : "\t";
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function normalizeDate(raw: string): string {
  const parts = raw.trim().split("/");
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return raw;
}

const num = (raw?: string): number => {
  if (raw === undefined) return 0;
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
};

export function parseMetaTraderCSV(csvText: string): Trade[] {
  const lines = csvText.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error(
      lines.length === 0
        ? "The file is empty."
        : "The file has a header but no trade rows."
    );
  }

  // Read by column name so appended columns never shift the fixed indices.
  const header = splitHeader(lines[0]);
  const at = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idx = {
    date:       at("Date"),
    symbol:     at("Symbol"),
    underlying: at("Underlying"),
    type:       at("Type"),
    direction:  at("Direction"),
    optionType: at("Option Type"),
    strike:     at("Strike"),
    expiry:     at("Expiry"),
    quantity:   at("Quantity"),
    entryPrice: at("Entry Price"),
    exitPrice:  at("Exit Price"),
    commission: at("Commission"),
    fees:       at("Fees"),
    pnl:        at("P&L"),
    status:     at("Status"),
    entryTime:  at("Entry Time"),
    exitTime:   at("Exit Time"),
    rr:         at("R:R"),
    tags:       at("Tags"),
    journal:    at("Journal"),
    accountId:  at("Account ID"),
    ticket:     at("Ticket"),
    plannedRisk: at("Planned Risk"),
    duration:   at("Duration (min)"),
    mae:        at("MAE"),
    mfe:        at("MFE"),
    exitReason: at("Exit Reason"),
    magic:      at("Magic"),
    legs:       at("Legs"),
    avgDown:    at("Averaged Down"),
    balance:    at("Balance After"),
  };

  const get = (cols: string[], i: number) => (i >= 0 ? cols[i] ?? "" : "");

  const trades: Trade[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);
    if (cols.length < 14) continue;

    const date        = get(cols, idx.date);
    const symbol      = get(cols, idx.symbol);
    const underlying  = get(cols, idx.underlying);
    const type        = get(cols, idx.type);
    const direction   = get(cols, idx.direction);
    const optionType  = get(cols, idx.optionType);
    const strike      = get(cols, idx.strike);
    const expiry      = get(cols, idx.expiry);
    const status      = get(cols, idx.status);
    const entryTime   = get(cols, idx.entryTime);
    const exitTime    = get(cols, idx.exitTime);
    const rr          = get(cols, idx.rr);
    const tags        = get(cols, idx.tags);
    const journal     = get(cols, idx.journal);
    const accountId   = get(cols, idx.accountId);
    const ticket      = get(cols, idx.ticket);
    const plannedRisk = get(cols, idx.plannedRisk);
    const duration    = get(cols, idx.duration);
    const mae         = get(cols, idx.mae);
    const mfe         = get(cols, idx.mfe);
    const exitReason  = get(cols, idx.exitReason);
    const magic       = get(cols, idx.magic);
    const legs        = get(cols, idx.legs);
    const avgDown     = get(cols, idx.avgDown);
    const balance     = get(cols, idx.balance);

    const parsedPnl   = num(get(cols, idx.pnl));
    const parsedEntry = num(get(cols, idx.entryPrice));
    const parsedExit  = num(get(cols, idx.exitPrice));
    const parsedStrike = strike ? parseFloat(strike) : undefined;
    const parsedRisk  = plannedRisk ? parseFloat(plannedRisk) : undefined;
    const parsedDur   = duration ? parseFloat(duration) : undefined;
    const parsedMae   = mae ? parseFloat(mae) : undefined;
    const parsedMfe   = mfe ? parseFloat(mfe) : undefined;
    const parsedMagic = magic ? parseInt(magic, 10) : undefined;
    const parsedLegs  = legs ? parseInt(legs, 10) : undefined;
    const parsedBal   = balance ? parseFloat(balance) : undefined;
    const parsedAvgDown = avgDown.toLowerCase() === "yes";
    const normalizedDate = normalizeDate(date);

    const derivedStatus: "win" | "loss" | "breakeven" =
      status === "win" || status === "loss" || status === "breakeven"
        ? (status as "win" | "loss" | "breakeven")
        : parsedPnl > 0 ? "win" : parsedPnl < 0 ? "loss" : "breakeven";

    // The MetaTrader position ticket is the one stable identifier available,
    // so keying on it makes re-importing the same export update the existing
    // trade instead of creating a duplicate. Older files fall back to a
    // content hash, which is still deterministic.
    const key = ticket
      ? ticket
      : [symbol, normalizedDate, parsedEntry, parsedExit, num(get(cols, idx.quantity)), parsedPnl].join("-");

    const trade: Trade = {
      id: `mt5-${key}`,
      date: normalizedDate,
      symbol,
      underlying,
      type: (["option", "stock", "future", "forex"].includes(type) ? type : "option") as "option" | "stock" | "future" | "forex",
      direction: (["long", "short"].includes(direction) ? direction : "long") as "long" | "short",
      ...(optionType && { optionType: optionType as "call" | "put" }),
      ...(parsedStrike !== undefined && { strike: parsedStrike }),
      ...(expiry && { expiry }),
      quantity: num(get(cols, idx.quantity)),
      entryPrice: parsedEntry,
      exitPrice: parsedExit,
      commission: num(get(cols, idx.commission)),
      fees: num(get(cols, idx.fees)),
      pnl: parsedPnl,
      status: derivedStatus,
      ...(entryTime && { entryTime }),
      ...(exitTime && { exitTime }),
      ...(rr && { rr }),
      ...(parsedRisk !== undefined && !isNaN(parsedRisk) && { plannedRisk: parsedRisk }),
      ...(parsedDur !== undefined && !isNaN(parsedDur) && { durationMin: parsedDur }),
      ...(parsedMae !== undefined && !isNaN(parsedMae) && { mae: parsedMae }),
      ...(parsedMfe !== undefined && !isNaN(parsedMfe) && { mfe: parsedMfe }),
      ...(exitReason && { exitReason }),
      ...(parsedMagic !== undefined && !isNaN(parsedMagic) && { magic: parsedMagic }),
      ...(parsedLegs !== undefined && !isNaN(parsedLegs) && { legs: parsedLegs }),
      ...(avgDown && { averagedDown: parsedAvgDown }),
      ...(parsedBal !== undefined && !isNaN(parsedBal) && { balanceAfter: parsedBal }),
      tags: tags ? tags.split("|").filter(Boolean) : [],
      journalEntry: journal || "",
      ...(accountId && { accountId }),
    };

    trades.push(trade);
  }

  return trades.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
