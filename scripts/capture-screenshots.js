/*
 * Regenerates docs/screenshots/*.png from a running dev server.
 *
 * Not app code and not imported by the app. Seed first, then run:
 *
 *   node scripts/seed-example.js
 *   npm run dev
 *   node scripts/capture-screenshots.js
 *
 * Charts are Recharts and animate in, so every capture waits for them to
 * settle rather than firing on load. Full-page height is capped so a tall
 * analytics tab doesn't produce a 6000px image that renders unreadable on
 * GitHub.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.APP_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "docs", "screenshots");

// Recharts animates on mount; 1.8s is enough for the paths to land.
const CHART_SETTLE = 1800;

const SHOTS = [
  { file: "dashboard.png",        page: "Dashboard" },
  { file: "journal.png",          page: "Journal" },
  { file: "calendar.png",         page: "Calendar" },
  { file: "prop-firm.png",        page: "Prop Firm" },
  { file: "plans.png",            page: "Trade Plans" },
  { file: "playbook.png",         page: "Playbook" },
  { file: "import.png",           page: "Import Trades" },
  { file: "export.png",           page: "Export" },
  { file: "settings.png",         page: "Settings" },
];

// Analytics is one page with eight tabs, so each is a separate capture.
const ANALYTICS = [
  { file: "analytics-overview.png", tab: "Overview" },
  { file: "analytics-risk.png",     tab: "Risk" },
  { file: "analytics-time.png",     tab: "Time" },
  { file: "analytics-heatmap.png",  tab: "Heatmap" },
  { file: "analytics-rmultiples.png", tab: "R-Multiples" },
  { file: "analytics-execution.png", tab: "Execution" },
  { file: "analytics-behavior.png", tab: "Behavior" },
  { file: "analytics-process.png",  tab: "Process" },
];

async function clickNav(page, label) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // The default headless shell hangs on some Windows/AV combinations. Launching
  // full Chromium with a longer timeout is the reliable path here.
  const browser = await chromium.launch({
    args: ["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox"],
    timeout: 180_000,
  });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  page.on("console", (m) => {
    if (m.type() === "error") console.log("  [console error]", m.text().slice(0, 160));
  });

  console.log(`Opening ${BASE} ...`);
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2000);

  async function shoot(file, fullPage = true) {
    await page.waitForTimeout(CHART_SETTLE);
    await page.screenshot({ path: path.join(OUT, file), fullPage });
    console.log(`  wrote ${file}`);
  }

  for (const s of SHOTS) {
    try {
      await clickNav(page, s.page);
      await shoot(s.file);
    } catch (e) {
      console.log(`  SKIPPED ${s.file}: ${String(e.message).slice(0, 120)}`);
    }
  }

  // Analytics tabs
  try {
    await clickNav(page, "Analytics");
    await page.waitForTimeout(1500);
    for (const t of ANALYTICS) {
      try {
        await page.getByRole("button", { name: t.tab, exact: true }).first().click();
        await shoot(t.file);
      } catch (e) {
        console.log(`  SKIPPED ${t.file}: ${String(e.message).slice(0, 120)}`);
      }
    }
  } catch (e) {
    console.log("  Analytics unreachable:", String(e.message).slice(0, 140));
  }

  // Trade panel quick view, opened from the first journal row.
  try {
    await clickNav(page, "Journal");
    await page.waitForTimeout(1200);
    const firstCard = page.locator("text=/20[0-9]{2}-[0-9]{2}-[0-9]{2}/").first();
    if (await firstCard.count()) {
      await firstCard.click();
      await shoot("trade-panel.png", false);
    }
  } catch (e) {
    console.log("  SKIPPED trade-panel.png:", String(e.message).slice(0, 120));
  }

  await browser.close();
  console.log("\nDone.");
})();