//+------------------------------------------------------------------+
//|                                                QuantEdgeExport.mq5 |
//|  Exports MetaTrader 5 trade history to a QuantEdge CSV.           |
//|                                                                  |
//|  Usage:                                                           |
//|    1. Open a chart in MetaTrader 5.                               |
//|    2. Navigator -> Expert Advisors -> right-click -> Scripts.     |
//|    3. Drop QuantEdgeExport.mq5 on the chart (or attach it).       |
//|    4. MetaEditor: compile it once (F7). No errors allowed.        |
//|    5. In QuantEdge: Accounts -> Import Trades -> drop the file.    |
//|                                                                  |
//|  Output: <Terminal Data Folder>\MQL5\Files\quantedge-<login>-<date>.csv
//|  (MetaTrader: File -> Open Data Folder to browse to MQL5\Files)  |
//|                                                                  |
//|  IMPORTANT                                                        |
//|  QuantEdge keys every trade on its MetaTrader position ticket, so   |
//|  re-importing a newer export updates the existing trades in place   |
//|  instead of duplicating them. Export the full history each time.    |
//+------------------------------------------------------------------+
#property copyright "QuantEdge"
#property link      ""
#property version   "1.00"
#property description "Exports MetaTrader 5 closed trades to a QuantEdge CSV."
#property strict

// Must stay in sync with QUANTEDGE_COLUMNS in app/lib/parseMetaTraderCSV.ts.
// The parser reads by column name, so columns may be appended here without
// breaking files exported by older builds of this script.
#define QUANTEDGE_HEADER "Date,Symbol,Underlying,Type,Direction,Option Type,Strike,Expiry,Quantity,Entry Price,Exit Price,Commission,Fees,P&L,Status,Entry Time,Exit Time,R:R,Tags,Journal,Account ID,Ticket,Planned Risk,Duration (min),MAE,MFE,Exit Reason,Magic,Legs,Averaged Down,Balance After"

input group                 "Range"
input datetime InpFrom      = 0;  // From  (0 = entire history)
input datetime InpTo        = 0;  // To    (0 = now)

input group                 "Options"
input bool    InpIncludeOpen = false; // Include positions that are still open (exit price = 0)
input bool    InpCommentTag  = false; // Use the entry order comment as the trade tag
input bool    InpExcursions  = true;  // Scan price bars to calculate MAE / MFE (slower)
input bool    InpQuiet       = false; // Skip the completion alert (still logged to Experts)

//+------------------------------------------------------------------+
//| Trade record assembled from every deal sharing one position id.   |
//+------------------------------------------------------------------+
struct TradeRow
  {
   datetime      entry_time;
   datetime      exit_time;
   string        symbol;
   string        underlying;
   string        type;          // option | future | forex | stock
   string        direction;     // long | short
   string        option_type;   // call | put | "" (stock/future/forex)
   string        strike;
   string        expiry;
   double        quantity;
   double        entry_price;
   double        exit_price;
   double        commission;
   double        fees;
   double        pnl;
   string        comment;
   string        rr;           // reward-to-risk, empty when no stop loss was set
   string        ticket;       // position id — the stable key QuantEdge de-dupes on
   double        planned_risk; // account-currency loss if the stop had been hit
   double        duration_min; // exact hold time
   double        mae;          // worst excursion against, account currency
   double        mfe;          // best excursion in favour, account currency
   string        exit_reason;  // stop-loss | take-profit | manual | expert | ...
   long          magic;        // EA magic number; 0 means placed by hand
   int           legs;         // number of entry deals (1 = a single entry)
   bool          avg_down;     // a later entry was at a worse price than the first
   double        balance_after;// account balance once this position closed
   bool          has_balance;  // whether balance_after could be reconstructed
  };

//+------------------------------------------------------------------+
//| One raw deal, kept string-free so the array can be sorted safely. |
//+------------------------------------------------------------------+
struct DealRow
  {
   ulong          position_id;
   ulong          ticket;
   datetime       time;
   int            deal_type;
   int            deal_entry;
   double         volume;
   double         price;
   double         profit;
   double         commission;
   double         swap;
   double         fee;
   double         sl;
   long           magic;
   int            reason;
  };

DealRow g_deals[];      // source rows
int     g_order[];      // indices into g_deals, sorted by position id
string  g_comments[];   // parallel to g_deals (kept out of DealRow so it can be sorted)
int     g_file = INVALID_HANDLE;

//+------------------------------------------------------------------+
//| Account balance timeline. Every deal moves the balance, including |
//| deposits and withdrawals (DEAL_TYPE_BALANCE), so replaying them in |
//| time order gives the true account curve rather than one inferred    |
//| from trades alone. Anchored on the live balance and walked          |
//| backwards, so it is exact even without knowing the opening deposit. |
//+------------------------------------------------------------------+
struct BalPoint
  {
   datetime time;
   double   after;
  };

BalPoint g_bal[];
int      g_bal_count = 0;
bool     g_bal_ok    = false;

//+------------------------------------------------------------------+
//| Human-readable name for ENUM_DEAL_REASON. Anything unrecognised    |
//| falls back to "other" rather than losing the row.                  |
//+------------------------------------------------------------------+
string ReasonName(const int r)
  {
   if(r == DEAL_REASON_SL)       return "stop-loss";
   if(r == DEAL_REASON_TP)       return "take-profit";
   if(r == DEAL_REASON_SO)       return "stop-out";
   if(r == DEAL_REASON_EXPERT)   return "expert";
   if(r == DEAL_REASON_CLIENT)   return "manual";
   if(r == DEAL_REASON_MOBILE)   return "mobile";
   if(r == DEAL_REASON_WEB)      return "web";
   if(r == DEAL_REASON_ROLLOVER) return "rollover";
   return "other";
  }

//+------------------------------------------------------------------+
//| Replays the whole deal history to build balance-after values. Runs |
//| over the complete history regardless of the export range, so the   |
//| anchor stays correct even when the user exports a sub-range.       |
//+------------------------------------------------------------------+
void BuildBalanceTimeline()
  {
   g_bal_ok    = false;
   g_bal_count = 0;
   if(!HistorySelect(0, TimeCurrent() + 86400)) return;

   const int n = HistoryDealsTotal();
   if(n <= 0) return;

   datetime times[];
   double   deltas[];
   ArrayResize(times,  n);
   ArrayResize(deltas, n);

   int kept = 0;
   for(int i = 0; i < n; i++)
     {
      const long tk = (long)HistoryDealGetTicket(i);
      if(tk == 0) continue;
      // For ordinary deals this is the cash effect; for a balance operation
      // the amount sits in DEAL_PROFIT, so the same sum covers deposits too.
      const double d = HistoryDealGetDouble(tk, DEAL_PROFIT)
                     + HistoryDealGetDouble(tk, DEAL_COMMISSION)
                     + HistoryDealGetDouble(tk, DEAL_SWAP)
                     + HistoryDealGetDouble(tk, DEAL_FEE);
      times[kept]  = (datetime)HistoryDealGetInteger(tk, DEAL_TIME);
      deltas[kept] = d;
      kept++;
     }
   if(kept == 0) return;

   // Sort by time. HistorySelect usually returns deals in order already,
   // but the balance walk depends on it, so make it certain.
   for(int i = 1; i < kept; i++)
     {
      const datetime t = times[i];
      const double   d = deltas[i];
      int j = i - 1;
      while(j >= 0 && times[j] > t)
        {
         times[j + 1]  = times[j];
         deltas[j + 1] = deltas[j];
         j--;
        }
      times[j + 1]  = t;
      deltas[j + 1] = d;
     }

   double total = 0.0;
   for(int i = 0; i < kept; i++) total += deltas[i];

   // Balance after the final deal is the live balance, so walking forward
   // from (live - total) reproduces every historical balance exactly.
   double running = AccountInfoDouble(ACCOUNT_BALANCE) - total;
   ArrayResize(g_bal, kept);
   for(int i = 0; i < kept; i++)
     {
      running += deltas[i];
      g_bal[i].time  = times[i];
      g_bal[i].after = running;
     }

   g_bal_count = kept;
   g_bal_ok    = true;
  }

//+------------------------------------------------------------------+
//| Balance once every deal up to and including time t had settled.    |
//+------------------------------------------------------------------+
double BalanceAfter(const datetime t)
  {
   if(!g_bal_ok || g_bal_count == 0) return 0.0;
   int lo = 0, hi = g_bal_count - 1, best = -1;
   while(lo <= hi)
     {
      const int mid = (lo + hi) / 2;
      if(g_bal[mid].time <= t) { best = mid; lo = mid + 1; }
      else                      hi = mid - 1;
     }
   return (best >= 0 ? g_bal[best].after : 0.0);
  }

//+------------------------------------------------------------------+
//| Entry points that form a position round-trip. Everything else      |
//| (balance, credit, charge, commission, bonus, expiration) belongs  |
//| to the account rather than to a trade.                            |
//+------------------------------------------------------------------+
bool IsPositionDeal(const int entry)
  {
   return (entry == DEAL_ENTRY_IN      ||
           entry == DEAL_ENTRY_OUT     ||
           entry == DEAL_ENTRY_OUT_BY  ||
           entry == DEAL_ENTRY_INOUT);
  }

//+------------------------------------------------------------------+
//| Sorts g_order by position id so every position's deals end up in   |
//| one contiguous run. Written by hand rather than using the          |
//| ArraySort(array, comparator) overload, which is not available in   |
//| every terminal build. Order inside a run does not matter: the      |
//| aggregates take a min/max or a sum, and every deal in a position   |
//| carries the same symbol.                                           |
//+------------------------------------------------------------------+
void SortOrder(int lo, const int hi)
  {
   if(lo >= hi) return;

   const ulong pivot = g_deals[g_order[(lo + hi) / 2]].position_id;
   int i = lo, j = hi;

   while(i <= j)
     {
      while(g_deals[g_order[i]].position_id < pivot) i++;
      while(g_deals[g_order[j]].position_id > pivot) j--;
      if(i <= j)
        {
         const int tmp = g_order[i];
         g_order[i] = g_order[j];
         g_order[j] = tmp;
         i++;
         j--;
        }
     }

   SortOrder(lo, j);
   SortOrder(i, hi);
  }

//+------------------------------------------------------------------+
//| Character helpers                                                 |
//+------------------------------------------------------------------+
bool IsDigit(const ushort c) { return (c >= '0' && c <= '9'); }
bool IsAlpha(const ushort c) { return ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')); }

//+------------------------------------------------------------------+
//| Strips the broker contract suffix: "EURUSD.m" -> "EURUSD"         |
//+------------------------------------------------------------------+
string StripSuffix(const string sym)
  {
   const int dot = StringFind(sym, ".");
   if(dot <= 0) return sym;
   return StringSubstr(sym, 0, dot);
  }

//+------------------------------------------------------------------+
//| "EURUSD241203C1.08500" / "AAPL230120C00150000"                   |
//|   -> underlying "EURUSD", option type "call", strike "1.08500"    |
//|   -> expiry "2024-12-03"                                          |
//+------------------------------------------------------------------+
bool ParseOptionSymbol(const string base, string &underlying, string &option_type,
                       string &strike, string &expiry)
  {
   const int len = StringLen(base);
   int i = 0;

   while(i < len && IsAlpha(StringGetCharacter(base, i))) i++;
   if(i == 0 || i == len) return false;            // needs an alphabetic root

   const int digits_start = i;
   while(i < len && IsDigit(StringGetCharacter(base, i))) i++;
   const int digits = i - digits_start;
   if(digits != 6 && digits != 8) return false;   // yymmdd or yyyymmdd

   if(i >= len) return false;
   ushort cp = StringGetCharacter(base, i);
   if(cp == 'c') cp = 'C';
   if(cp == 'p') cp = 'P';
   if(cp != 'C' && cp != 'P') return false;
   i++;

   const int strike_start = i;
   while(i < len && IsDigit(StringGetCharacter(base, i))) i++;
   if(i == strike_start) return false;             // needs a strike after C/P
   strike = StringSubstr(base, strike_start, i - strike_start);

   underlying  = StringSubstr(base, 0, digits_start);
   option_type = (cp == 'C' ? "call" : "put");

   const string d = StringSubstr(base, digits_start, digits);
   if(digits == 6)
      expiry = "20" + StringSubstr(d, 0, 2) + "-" + StringSubstr(d, 2, 2) + "-" + StringSubstr(d, 4, 2);
   else
      expiry = StringSubstr(d, 0, 4) + "-" + StringSubstr(d, 4, 2) + "-" + StringSubstr(d, 6, 2);

   return true;
  }

//+------------------------------------------------------------------+
//| "EURUSDZ6" (Z = December future) -> underlying "EURUSD"           |
//+------------------------------------------------------------------+
bool ParseFutureSymbol(const string base, string &underlying)
  {
   const int len = StringLen(base);
   if(len < 5) return false;
   if(!IsDigit(StringGetCharacter(base, len - 1))) return false;

   const int head = len - 2;
   const string codes = "FGHJKMNQUVXZ";
   if(StringFind(codes, StringSubstr(base, head, 1)) < 0) return false;

   for(int i = 0; i < head; i++)
      if(!IsAlpha(StringGetCharacter(base, i))) return false;

   underlying = StringSubstr(base, 0, head);
   return true;
  }

//+------------------------------------------------------------------+
//| Classifies a raw MetaTrader symbol into QuantEdge's instrument    |
//| types and pulls out the underlying.                               |
//+------------------------------------------------------------------+
void ClassifySymbol(const string sym, string &type, string &underlying)
  {
   const string base = StripSuffix(sym);

   string option_type = "", strike = "", expiry = "";
   if(ParseOptionSymbol(base, underlying, option_type, strike, expiry))
     {
      type = "option";
      return;
     }

   if(ParseFutureSymbol(base, underlying))
     {
      type = "future";
      return;
     }

   // "EURUSD", "EURUSDm", "US30.cash" -> forex. "AAPL", "GOLD" -> stock.
   const int len = StringLen(base);
   bool six_alpha = (len >= 6);
   for(int i = 0; i < 6 && six_alpha; i++)
      if(!IsAlpha(StringGetCharacter(base, i))) six_alpha = false;

   if(six_alpha)
     {
      type       = "forex";
      underlying = StringSubstr(base, 0, 6);
      return;
     }

   type       = "stock";
   underlying = (StringLen(base) > 0 ? base : sym);   // "GER40.cash" -> "GER40"
  }

//+------------------------------------------------------------------+
//| Makes a value safe to drop in an unquoted CSV cell.               |
//+------------------------------------------------------------------+
string CleanCsv(const string s)
  {
   string out = s;
   StringReplace(out, ",",  " ");
   StringReplace(out, "\"", "'");
   StringReplace(out, "\r", " ");
   StringReplace(out, "\n", " ");
   StringReplace(out, "|",  "/");
   StringTrimLeft(out);
   StringTrimRight(out);
   return out;
  }

//+------------------------------------------------------------------+
//| "2026.10.09" -> "2026-10-09". StringReplace returns an int and edits |
//| by reference, so it can never be used inside an expression.        |
//+------------------------------------------------------------------+
string DateToDash(const datetime t)
  {
   if(t <= 0) return "";
   string s = TimeToString(t, TIME_DATE);
   StringReplace(s, ".", "-");
   return s;
  }

//+------------------------------------------------------------------+
//| "2026.10.09" -> "20261009" (for the filename).                    |
//+------------------------------------------------------------------+
string DateCompact(const datetime t)
  {
   string s = TimeToString(t, TIME_DATE);
   StringReplace(s, ".", "");
   return s;
  }

//+------------------------------------------------------------------+
//| "14:05" - the format QuantEdge stores entry/exit times in.        |
//+------------------------------------------------------------------+
string TimeOfDay(const datetime t)
  {
   if(t <= 0) return "";
   return TimeToString(t, TIME_MINUTES);
  }

//+------------------------------------------------------------------+
//| Worst and best excursion while the position was open, in account    |
//| currency. Derived from M1 bars, so it is accurate to within a       |
//| single bar at each end of the hold. Both values are positive        |
//| magnitudes — MAE is how far it went against, MFE how far it went in  |
//| favour — which is the convention QuantEdge's Execution tab expects.  |
//+------------------------------------------------------------------+
bool ComputeExcursion(const string sym, const bool is_long, const double entry_price,
                      const double volume, const datetime from, const datetime to,
                      double &mae, double &mfe)
  {
   mae = 0.0;
   mfe = 0.0;
   if(from <= 0 || to <= from || volume <= 0.0) return false;

   MqlRates rates[];
   const int copied = CopyRates(sym, PERIOD_M1, from, to, rates);
   if(copied <= 0) return false;

   const double tick_size = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   if(tick_size <= 0.0) return false;

   double tick_value = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tick_value <= 0.0) tick_value = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   if(tick_value <= 0.0) return false;

   const int n = ArraySize(rates);
   double worst = 0.0, best = 0.0;

   for(int i = 0; i < n; i++)
     {
      double adverse = 0.0, favourable = 0.0;

      if(is_long)
        {
         adverse   = (entry_price - rates[i].low)  / tick_size * tick_value * volume;
         favourable = (rates[i].high - entry_price) / tick_size * tick_value * volume;
        }
      else
        {
         adverse    = (rates[i].high - entry_price) / tick_size * tick_value * volume;
         favourable = (entry_price - rates[i].low)  / tick_size * tick_value * volume;
        }

      if(adverse   > worst) worst = adverse;
      if(favourable > best)  best  = favourable;
     }

   mae = worst;
   mfe = best;
   return true;
  }

//+------------------------------------------------------------------+
//| Price precision that matches the instrument.                      |
//+------------------------------------------------------------------+
string FormatPrice(const string sym, const double value)
  {
   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   if(digits < 2) digits = 2;
   return DoubleToString(value, digits);
  }

//+------------------------------------------------------------------+
//| Rolls one position's deals up into a single QuantEdge row.       |
//| Returns false for positions with nothing tradable in them.        |
//+------------------------------------------------------------------+
bool BuildTrade(const int from, const int to, TradeRow &row)
  {
   double in_volume = 0.0, in_notional = 0.0;
   double out_volume = 0.0, out_notional = 0.0;
   double commission_total = 0.0, fees_total = 0.0;
   bool have_in = false, have_out = false;
   int first_entry_type = -1;
   long entry_ticket = 0;
   double entry_sl = 0.0;
   double first_in_price = 0.0;
   long entry_magic = 0;
   int  exit_reason = -1;
   int  legs = 0;
   bool avg_down = false;

   row.entry_time   = 0;
   row.exit_time    = 0;
   row.commission   = 0.0;
   row.pnl          = 0.0;
   row.comment      = "";
   row.exit_reason  = "";
   row.magic        = 0;
   row.legs         = 0;
   row.avg_down     = false;
   row.balance_after = 0.0;
   row.has_balance  = false;
   row.ticket       = IntegerToString((long)g_deals[g_order[from]].position_id);

   for(int i = from; i < to; i++)
     {
      const int k = g_order[i];
      const DealRow d = g_deals[k];

      // MT5 reports gross profit, commission, swap and fee separately and all four
      // move the balance, so net P&L is their signed sum. QuantEdge stores
      // commission/fees as positive magnitudes alongside it.
      row.pnl             += d.profit + d.commission + d.swap + d.fee;
      commission_total    += d.commission;
      fees_total          += d.swap + d.fee;

      if(d.deal_entry == DEAL_ENTRY_IN || d.deal_entry == DEAL_ENTRY_INOUT)
        {
         // On an INOUT reversal the deal opens the new leg and closes the old.
         // Treat it as an entry only when the position has no plain IN deal.
         if(d.deal_entry == DEAL_ENTRY_IN || !have_in)
           {
            if(!have_in)
              {
               first_entry_type = d.deal_type;
               entry_ticket     = (long)d.ticket;
               entry_sl         = d.sl;
               entry_magic      = d.magic;
               first_in_price   = d.price;
               row.comment      = g_comments[k];
              }
            else if(first_entry_type == DEAL_TYPE_SELL ? d.price > first_in_price
                                                       : d.price < first_in_price)
              {
               // A later entry filled at a worse price than the first is the
               // classic averaging-down signature, and worth flagging on its own.
               avg_down = true;
              }
            legs++;
            in_volume   += d.volume;
            in_notional += d.price * d.volume;
            have_in      = true;
            if(row.entry_time == 0 || d.time < row.entry_time) row.entry_time = d.time;
            continue;
           }
        }

      if(d.deal_entry == DEAL_ENTRY_OUT || d.deal_entry == DEAL_ENTRY_OUT_BY || d.deal_entry == DEAL_ENTRY_INOUT)
        {
         out_volume   += d.volume;
         out_notional += d.price * d.volume;
         have_out      = true;
         if(d.time > row.exit_time)
           {
            // The reason on the deal that finally closed the position answers
            // "did the stop take me out, or did I close it myself?".
            row.exit_time = d.time;
            exit_reason   = d.reason;
           }
        }
     }

   if(!have_in || in_volume <= 0.0) return false;
   if(!have_out && !InpIncludeOpen) return false;

   row.symbol        = HistoryDealGetString(entry_ticket, DEAL_SYMBOL);
   row.quantity      = in_volume;
   row.entry_price   = in_notional / in_volume;
   row.exit_price    = (have_out && out_volume > 0.0 ? out_notional / out_volume : 0.0);
   row.direction     = (first_entry_type == DEAL_TYPE_SELL ? "short" : "long");
   row.commission    = MathAbs(commission_total);
   row.fees          = MathAbs(fees_total);
   row.magic         = entry_magic;
   row.legs          = legs;
   row.avg_down      = avg_down;
   row.exit_reason   = (have_out && exit_reason >= 0 ? ReasonName(exit_reason) : "");

   // R:R from the stop loss recorded when the position was opened. Left empty
   // when no stop was set or when the risk works out to zero — QuantEdge shows
   // "—" for trades without a ratio rather than inventing one.
   row.rr = "";
   if(entry_sl > 0.0 && have_out)
     {
      const double risk = (row.direction == "long" ? row.entry_price - entry_sl
                                                    : entry_sl - row.entry_price);
      if(risk > 0.0)
        {
         const double reward = (row.direction == "long" ? row.exit_price - row.entry_price
                                                         : row.entry_price - row.exit_price);
         row.rr = DoubleToString(reward / risk, 2);
        }
     }

   // Risk at entry, in account currency. Converted through the symbol's tick
   // size and tick value so it is correct for indices, metals and FX alike,
   // rather than assuming a fixed point value per lot.
   row.planned_risk = 0.0;
   if(entry_sl > 0.0 && have_in)
     {
      const double tick_size  = SymbolInfoDouble(row.symbol, SYMBOL_TRADE_TICK_SIZE);
      const double tick_value = SymbolInfoDouble(row.symbol, SYMBOL_TRADE_TICK_VALUE_LOSS);
      if(tick_size > 0.0 && tick_value > 0.0)
         row.planned_risk = MathAbs(row.entry_price - entry_sl) / tick_size
                            * tick_value * row.quantity;
     }

   // Exact hold time, straight from the deal timestamps.
   row.duration_min = (row.entry_time > 0 && row.exit_time > 0 && row.exit_time > row.entry_time)
                      ? (double)(row.exit_time - row.entry_time) / 60.0
                      : 0.0;

   // Account balance once this position settled, replayed from the full deal
   // history. Left unset when the timeline could not be rebuilt.
   if(g_bal_ok && row.exit_time > 0)
     {
      row.balance_after = BalanceAfter(row.exit_time);
      row.has_balance   = true;
     }

   // MAE / MFE. On a losing trade the adverse excursion can never exceed what
   // was actually lost, so clamp it there to absorb bars that straddle the
   // entry or exit moment.
   row.mae = 0.0;
   row.mfe = 0.0;
   if(InpExcursions && have_out && row.exit_time > row.entry_time)
     {
      double mae = 0.0, mfe = 0.0;
      if(ComputeExcursion(row.symbol, row.direction == "long", row.entry_price,
                          row.quantity, row.entry_time, row.exit_time, mae, mfe))
        {
         if(row.pnl < 0.0 && mae > MathAbs(row.pnl)) mae = MathAbs(row.pnl);
         row.mae = mae;
         row.mfe = mfe;
        }
     }

   ClassifySymbol(row.symbol, row.type, row.underlying);

   row.option_type = "";
   row.strike      = "";
   row.expiry      = "";

   if(row.type == "option")
     {
      string option_type = "", strike = "", expiry = "";
      if(ParseOptionSymbol(StripSuffix(row.symbol), row.underlying, option_type, strike, expiry))
        {
         row.option_type = option_type;
         row.strike      = strike;
         row.expiry      = expiry;
        }
     }

   return true;
  }

//+------------------------------------------------------------------+
//| Writes one CSV line to the open file (g_file).                     |
//| The row is assembled and joined by hand rather than handed to       |
//| FileWrite: the FILE_CSV flag on FileOpen is not honoured by every  |
//| terminal build, and FileWrite silently falls back to TAB-separated  |
//| output. QuantEdge would then read the header (written literally)    |
//| but discard every data row.                                        |
//+------------------------------------------------------------------+
void WriteRow(const TradeRow &row)
  {
   const datetime basis = (row.entry_time > 0 ? row.entry_time : row.exit_time);

   string status = "breakeven";
   if(row.pnl > 0.0)      status = "win";
   else if(row.pnl < 0.0) status = "loss";

   const string line =
                  DateToDash(basis)                         + "," +
                  CleanCsv(row.symbol)                      + "," +
                  CleanCsv(row.underlying)                  + "," +
                  row.type                                  + "," +
                  row.direction                             + "," +
                  row.option_type                           + "," +
                  row.strike                                + "," +
                  row.expiry                                + "," +
                  DoubleToString(row.quantity, 2)           + "," +
                  FormatPrice(row.symbol, row.entry_price)  + "," +
                  FormatPrice(row.symbol, row.exit_price)   + "," +
                  DoubleToString(row.commission, 2)         + "," +
                  DoubleToString(row.fees, 2)               + "," +
                  DoubleToString(row.pnl, 2)                + "," +
                  status                                    + "," +
                  TimeOfDay(row.entry_time)                 + "," +
                  TimeOfDay(row.exit_time)                  + "," +
                  row.rr                                     + "," +
                  (InpCommentTag ? CleanCsv(row.comment) : "")       + "," +
                  ""                                        + "," +   // Journal - written in QuantEdge
                  IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "," +
                  row.ticket                                + "," +
                  DoubleToString(row.planned_risk, 2)       + "," +
                  DoubleToString(row.duration_min, 2)       + "," +
                  DoubleToString(row.mae, 2)               + "," +
                  DoubleToString(row.mfe, 2)               + "," +
                  CleanCsv(row.exit_reason)                 + "," +
                  IntegerToString(row.magic)                + "," +
                  IntegerToString(row.legs)                 + "," +
                  (row.avg_down ? "yes" : "no")             + "," +
                  (row.has_balance ? DoubleToString(row.balance_after, 2) : "");

   FileWriteString(g_file, line + "\r\n");
  }

//+------------------------------------------------------------------+
void OnStart()
  {
   const datetime from = (InpFrom > 0 ? InpFrom : 0);
   // Pad the end date so deals stamped at 23:59 on InpTo are not cut off.
   const datetime to   = (InpTo   > 0 ? InpTo   : TimeCurrent() + 86400);

   // Build the balance timeline first: it does its own HistorySelect over the
   // full history, so the trade-range selection below must come after it.
   BuildBalanceTimeline();

   if(!HistorySelect(from, to))
     {
      const string e = "QuantEdge: HistorySelect failed (error " + IntegerToString(GetLastError()) + ")";
      Print(e);
      Alert(e);
      return;
     }

   const int total = HistoryDealsTotal();
   if(total <= 0)
     {
      const string e = "QuantEdge: no deals found in the selected range.";
      Print(e);
      Alert(e);
      return;
     }

   ArrayResize(g_deals, total);
   ArrayResize(g_comments, total);
   int kept = 0;

   for(int i = 0; i < total; i++)
     {
      const long ticket = (long)HistoryDealGetTicket(i);
      if(ticket == 0) continue;

      const ulong position_id = (ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      if(position_id == 0) continue;

      const int entry = (int)HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(!IsPositionDeal(entry)) continue;

      g_deals[kept].position_id = position_id;
      g_deals[kept].ticket      = ticket;
      g_deals[kept].time        = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      g_deals[kept].deal_type   = (int)HistoryDealGetInteger(ticket, DEAL_TYPE);
      g_deals[kept].deal_entry  = entry;
      g_deals[kept].volume      = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      g_deals[kept].price       = HistoryDealGetDouble(ticket, DEAL_PRICE);
      g_deals[kept].profit      = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      g_deals[kept].commission  = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      g_deals[kept].swap        = HistoryDealGetDouble(ticket, DEAL_SWAP);
      g_deals[kept].fee         = HistoryDealGetDouble(ticket, DEAL_FEE);
      g_deals[kept].sl          = HistoryDealGetDouble(ticket, DEAL_SL);
      g_deals[kept].magic       = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      g_deals[kept].reason      = (int)HistoryDealGetInteger(ticket, DEAL_REASON);
      g_comments[kept]          = HistoryDealGetString(ticket, DEAL_COMMENT);
      kept++;
     }

   if(kept == 0)
     {
      const string e = "QuantEdge: " + IntegerToString(total)
                       + " deals scanned, none belonged to a closed position.";
      Print(e);
      Alert(e);
      return;
     }

   ArrayResize(g_deals, kept);
   ArrayResize(g_comments, kept);
   ArrayResize(g_order, kept);
   for(int i = 0; i < kept; i++) g_order[i] = i;
   SortOrder(0, kept - 1);

   const string login  = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   const string fname = "quantedge-" + login + "-" + DateCompact(TimeCurrent()) + ".csv";

   // FILE_CSV is deliberately omitted — rows are written by hand (see WriteRow),
   // so the delimiter must not depend on how this build interprets the flag.
   g_file = FileOpen(fname, FILE_WRITE | FILE_ANSI);
   if(g_file == INVALID_HANDLE)
     {
      const string e = "QuantEdge: could not open " + fname
                       + " (error " + IntegerToString(GetLastError()) + ")";
      Print(e);
      Alert(e);
      return;
     }

   FileWriteString(g_file, QUANTEDGE_HEADER + "\r\n");

   int    written = 0;
   double net = 0.0;
   int i = 0;
   while(i < kept)
     {
      const ulong pid = g_deals[g_order[i]].position_id;

      int j = i;
      while(j < kept && g_deals[g_order[j]].position_id == pid) j++;

      TradeRow row;
      if(BuildTrade(i, j, row))
        {
         WriteRow(row);
         net += row.pnl;
         written++;
        }

      i = j;
     }

   FileClose(g_file);
   g_file = INVALID_HANDLE;

   const string msg = StringFormat("QuantEdge: exported %d trades (net %.2f %s) to MQL5\\Files\\%s",
                                   written, net, AccountInfoString(ACCOUNT_CURRENCY), fname);
   Print(msg);
   if(!InpQuiet) Alert(msg);
  }
//+------------------------------------------------------------------+
