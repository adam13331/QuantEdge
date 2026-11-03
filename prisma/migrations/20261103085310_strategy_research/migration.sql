-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "change" TEXT NOT NULL,
    "expectedEffect" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "playbookId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "conclusion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Playbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT NOT NULL DEFAULT '[]',
    "timeframes" TEXT,
    "instruments" TEXT,
    "entryTriggers" TEXT NOT NULL DEFAULT '[]',
    "exitRules" TEXT,
    "notes" TEXT,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "revisions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Playbook" ("createdAt", "description", "entryTriggers", "exitRules", "id", "imageUrls", "instruments", "name", "notes", "rules", "timeframes", "updatedAt") SELECT "createdAt", "description", "entryTriggers", "exitRules", "id", "imageUrls", "instruments", "name", "notes", "rules", "timeframes", "updatedAt" FROM "Playbook";
DROP TABLE "Playbook";
ALTER TABLE "new_Playbook" RENAME TO "Playbook";
CREATE TABLE "new_Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "underlying" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "optionType" TEXT,
    "strike" REAL,
    "expiry" TEXT,
    "quantity" REAL NOT NULL,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL NOT NULL,
    "commission" REAL NOT NULL,
    "fees" REAL NOT NULL,
    "pnl" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "entryTime" TEXT,
    "exitTime" TEXT,
    "rr" TEXT,
    "plannedRisk" REAL,
    "durationMin" REAL,
    "mae" REAL,
    "mfe" REAL,
    "exitReason" TEXT,
    "magic" INTEGER,
    "legs" INTEGER,
    "averagedDown" BOOLEAN,
    "balanceAfter" REAL,
    "hourOfDay" INTEGER,
    "atr" REAL,
    "spread" REAL,
    "dayRange" REAL,
    "playbookId" TEXT,
    "setupVersion" INTEGER,
    "planId" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "mistakeTags" TEXT NOT NULL DEFAULT '[]',
    "followedPlan" BOOLEAN,
    "confidence" INTEGER,
    "isForwardTest" BOOLEAN NOT NULL DEFAULT false,
    "journalEntry" TEXT,
    "link" TEXT,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "accountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Trade" ("accountId", "averagedDown", "balanceAfter", "commission", "createdAt", "date", "direction", "durationMin", "entryPrice", "entryTime", "exitPrice", "exitReason", "exitTime", "expiry", "fees", "hourOfDay", "id", "imageUrls", "journalEntry", "legs", "link", "mae", "magic", "mfe", "optionType", "planId", "plannedRisk", "playbookId", "pnl", "quantity", "rr", "status", "strike", "symbol", "tags", "type", "underlying") SELECT "accountId", "averagedDown", "balanceAfter", "commission", "createdAt", "date", "direction", "durationMin", "entryPrice", "entryTime", "exitPrice", "exitReason", "exitTime", "expiry", "fees", "hourOfDay", "id", "imageUrls", "journalEntry", "legs", "link", "mae", "magic", "mfe", "optionType", "planId", "plannedRisk", "playbookId", "pnl", "quantity", "rr", "status", "strike", "symbol", "tags", "type", "underlying" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
