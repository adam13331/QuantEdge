#!/usr/bin/env node
// Verifies that every string the interface can render has a Hungarian entry.
//
//   1. collects the keys passed to tr() in the app (literal + template skeleton)
//   2. collects the keys from insights.ts the same way t() masks them at runtime
//   3. reports missing keys, placeholder mismatches and untranslated values
//
// Run with: node scripts/i18n-check.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ts = require(path.join(root, "node_modules/typescript"));

const NUMBER = /(?<![A-Za-z0-9])(?:[A-Z]{2,}[0-9]{1,4})(?![A-Za-z0-9])|[-+]?\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?/g;
const mask = (text) => {
  let i = 0;
  return text.replace(NUMBER, () => `{${i++}}`);
};

function readDict(file) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  const out = {};
  for (const m of src.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) {
    out[JSON.parse(`"${m[1]}"`)] = JSON.parse(`"${m[2]}"`);
  }
  return out;
}

const huFiles = fs
  .readdirSync(path.join(root, "app/lib"))
  .filter((f) => f.startsWith("i18n.hu") && f.endsWith(".ts") && f !== "i18n.hu.ts");

const dict = {};
const sources = {};
for (const f of huFiles) {
  for (const [k, v] of Object.entries(readDict(`app/lib/${f}`))) {
    dict[k] = v;
    sources[k] = f;
  }
}

function jsxKeys() {
  const files = [];
  for (const dir of ["app/pages", "app/components"]) {
    for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith(".tsx")) files.push(`${dir}/${f}`);
  }
  files.push("app/page.tsx");

  const keys = new Set();
  const record = (k) => {
    const v = k.replace(/\s+/g, " ").trim();
    if (v && /[A-Za-z]{2}/.test(v)) keys.add(v);
  };
  const walkArg = (node, sf) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) record(node.text);
    else if (ts.isTemplateExpression(node)) {
      let sample = node.head.text;
      for (const span of node.templateSpans) sample += "0" + span.literal.text;
      record(mask(sample));
    } else if (ts.isConditionalExpression(node)) {
      walkArg(node.whenTrue, sf);
      walkArg(node.whenFalse, sf);
    } else if (ts.isParenthesizedExpression(node)) walkArg(node.expression, sf);
  };

  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    (function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(sf) === "tr" && node.arguments.length) {
        walkArg(node.arguments[0], sf);
      }
      ts.forEachChild(node, visit);
    })(sf);
  }
  return keys;
}

const SKIP = /^(bad|warn|good|info|overview|risk|time|heatmap|execution|behavior|process|compare|adherence|profitFactor|expectancyR|edgeMargin|payoff|concentration|trend|sliceEdge|sampleSize|drawdownPct|drawdownDays|sharpe|sortino|calmar|riskPct|riskConsistency|stopBreaches|dataCoverage|dayCoverage|greenDayShare|daySkew|sessionSpread|entryEff|exitEff|stopPlacement|winnerHeat|overtrading|revengeShare|disciplineScore|sizingVsKelly|ruinRisk|recoveryFactor|costPct|reEntryGap|manualExitShare|averagingDown|legs|depositShare|advanced|great|average)$/;

function insightKeys() {
  const file = path.join(root, "app/lib/insights.ts");
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys = new Set();
  (function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!SKIP.test(node.text.trim())) keys.add(mask(node.text.replace(/\s+/g, " ").trim()));
    } else if (ts.isTemplateExpression(node)) {
      let sample = node.head.text;
      for (const span of node.templateSpans) sample += "0" + span.literal.text;
      keys.add(mask(sample.replace(/\s+/g, " ").trim()));
    }
    ts.forEachChild(node, visit);
  })(sf);
  return keys;
}

// Keys that are genuinely language-neutral: product names, notation, units and
// single-letter fragments used to build a sentence (plural suffixes).
const NEUTRAL = /^(QuantEdge|QuantEdge v|QuantEdge — Trading Performance Report|FTMO|npm run dev|git pull|GitHub|https:\/\/tradingview\.com\/\.\.\.|var\(--profit\)|\.\/types|\.\/analytics|→ running|Sharpe|Sortino|Calmar|ROI|Minimum|Platform|MetaTrader|MAE \/ MFE|MFE \/ \(MFE \+ MAE\)|Stop R|Kelly|≤ \{0\}× Kelly|\{0\}x|is|it|was|s|es)$/;

// Format-only keys: nothing but placeholders and punctuation (bands such as
// "{0}+" or "< {0}"), which read the same in both languages.
const isFormatOnly = (k) => !/[a-záéíóöőúüű]/.test(k) || /^[^a-záéíóöőúüű]{0,3}$/.test(k);

// Font families and weight names are rendered verbatim in the editor toolbar:
// translating them would make the label disagree with the font it applies.
const FONT = /^(DM Sans|Syne|Inter|Roboto|Open Sans|Lato|Poppins|Raleway|Nunito|Montserrat|Playfair Display|Georgia|Times New Roman|Courier New|Monospace|Regular|Medium|SemiBold|ExtraBold)$/;

function copyPropKeys() {
  // Strings reached through `{headline}` etc. are translated at the render
  // site, so the key is the literal stored on the object, not a tr() argument.
  const COPY = new Set([
    "label", "headline", "note", "sub", "title", "detail", "desc", "description",
    "caption", "hint", "verdict", "summary", "body", "message", "why", "what",
    "action", "unit", "word",
  ]);
  const files = [];
  for (const dir of ["app/pages", "app/components"]) {
    for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith(".tsx")) files.push(`${dir}/${f}`);
  }
  const keys = new Set();
  const record = (k) => {
    const v = k.replace(/\s+/g, " ").trim();
    if (v && /[A-Za-z]{2}/.test(v)) keys.add(mask(v));
  };
  const add = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) record(node.text);
    else if (ts.isTemplateExpression(node)) {
      let sample = node.head.text;
      for (const span of node.templateSpans) sample += "0" + span.literal.text;
      record(sample);
    } else if (ts.isConditionalExpression(node)) {
      add(node.whenTrue);
      add(node.whenFalse);
    } else if (ts.isParenthesizedExpression(node)) add(node.expression);
  };
  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    (function visit(node) {
      if (ts.isPropertyAssignment(node) && COPY.has(node.name.getText(sf).replace(/["']/g, ""))) add(node.initializer);
      ts.forEachChild(node, visit);
    })(sf);
  }
  return keys;
}

const keys = new Set([...jsxKeys(), ...insightKeys(), ...copyPropKeys()]);
const missing = [...keys].filter((k) => !NEUTRAL.test(k) && !FONT.test(k) && !isFormatOnly(k) && dict[k] === undefined);
const same = Object.entries(dict).filter(
  ([k, v]) => k === v && !NEUTRAL.test(k) && !isFormatOnly(k) && !/^[{}\d\s.,:–\-–<>=%$×≤−+]+$/.test(k),
);
// A translation may drop a placeholder that is an English suffix marker — the
// plural "s" in "{1} trade{2}" — because Hungarian does not pluralise after a
// numeral. Every other dropped placeholder is a lost figure and fails.
function droppedValue(key, value) {
  const inKey = new Set(key.match(/\{\d+\}/g) || []);
  const inValue = new Set(value.match(/\{\d+\}/g) || []);
  const lost = [...inKey].filter((p) => !inValue.has(p));
  return lost.filter((p) => {
    const at = key.indexOf(p);
    return !/[A-Za-z]/.test(key[at - 1] || "");
  });
}
const inventedValue = (key, value) =>
  (value.match(/\{\d+\}/g) || []).filter((p) => !(key.match(/\{\d+\}/g) || []).includes(p));

const placeholders = Object.entries(dict)
  .map(([k, v]) => {
    const lost = droppedValue(k, v);
    const invented = inventedValue(k, v);
    return lost.length || invented.length ? { key: k, value: v, lost, invented } : null;
  })
  .filter(Boolean);

console.log(`dictionary entries: ${Object.keys(dict).length} (${huFiles.length} files)`);
console.log(`renderable keys:    ${keys.size}`);
console.log(`missing:            ${missing.length}`);
console.log(`value == key:       ${same.length}`);
console.log(`placeholder drift:  ${placeholders.length}`);

if (missing.length) console.log("\nMISSING\n" + missing.join("\n"));
if (same.length) console.log("\nUNTRANSLATED\n" + same.map(([k]) => k).join("\n"));
if (placeholders.length)
  console.log(
    "\nPLACEHOLDERS\n" +
      placeholders
        .map((p) => `${p.key}\n  → ${p.value}\n  lost: ${p.lost.join(",") || "-"} invented: ${p.invented.join(",") || "-"}`)
        .join("\n"),
  );

process.exit(missing.length || placeholders.length || same.length ? 1 : 0);
