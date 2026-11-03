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
 * settle rather than firing on load. The app scrolls inside its own container,
 * so a full-page capture is exactly one viewport — 1600x1000 at 2x.
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
  { file: "calendar.png",         page: "Calendar" },
  { file: "prop-firm.png",        page: "Prop Firm" },
  { file: "playbook.png",         page: "Playbook" },
  { file: "import.png",           page: "Import Trades" },
  { file: "export.png",           page: "Export" },
  { file: "settings.png",         page: "Settings" },
];

// Analytics lives on the Dashboard as tabs, so each is a separate capture.
const ANALYTICS = [
  { file: "analytics-overview.png", tab: "Overview" },
  { file: "analytics-risk.png",     tab: "Risk" },
  { file: "analytics-time.png",     tab: "Time" },
  { file: "analytics-heatmap.png",  tab: "Heatmap" },
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

  // The Export page renders a react-pdf preview that streams web fonts; its
  // screenshot waits on document.fonts and needs more than the default 30s.
  async function shoot(file, fullPage = true, timeout = 30_000) {
    await page.waitForTimeout(CHART_SETTLE);
    await page.screenshot({ path: path.join(OUT, file), fullPage, timeout });
    console.log(`  wrote ${file}`);
  }

  for (const s of SHOTS) {
    try {
      await clickNav(page, s.page);
      await shoot(s.file, true, s.page === "Export" ? 90_000 : 30_000);
    } catch (e) {
      console.log(`  SKIPPED ${s.file}: ${String(e.message).slice(0, 120)}`);
    }
  }

  // Analytics tabs sit on the Dashboard.
  try {
    await clickNav(page, "Dashboard");
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

  await browser.close();
  console.log("\nDone.");
})();