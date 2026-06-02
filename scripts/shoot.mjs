// Connect to the running Chrome (launched by photoshoot.mjs) over CDP and
// take a screenshot of the active tab. Usage:
//
//   node scripts/shoot.mjs <name>
//
// Saves to ~/Desktop/burger-screenshots/<name>.png. If the active tab is
// chrome:// or chrome-extension://, that's intentional — sometimes we want
// to capture the options page or popup. The script doesn't filter.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = 9222;
const OUT_DIR = path.join(os.homedir(), "Desktop", "burger-screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const name = (process.argv[2] || "shot").replace(/[^A-Za-z0-9._-]+/g, "-");
const outPath = path.join(OUT_DIR, `${name}.png`);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const contexts = browser.contexts();
if (contexts.length === 0) {
  console.error("No browser contexts found. Is Chrome running with photoshoot.mjs?");
  process.exit(1);
}

// Heuristic for "the tab the user is looking at": last visible page in the
// default context. CDP doesn't expose 'active tab' directly, but pages are
// ordered by recent activity in most builds; we also filter out devtools
// targets and chrome-extension service workers.
const allPages = contexts.flatMap(c => c.pages());
const candidates = allPages.filter(p => {
  const u = p.url();
  return u && !u.startsWith("chrome-extension://") || u.includes("/options/") || u.includes("/popup/");
}).filter(p => !p.url().startsWith("devtools://"));

if (candidates.length === 0) {
  console.error("No suitable page open. Tabs seen:");
  for (const p of allPages) console.error("  -", p.url());
  process.exit(1);
}

// Pick the most-recently-active by bringing each to front and asking the
// document for visibility state. The frontmost tab returns "visible".
let target = candidates[candidates.length - 1];
for (const p of candidates) {
  try {
    const state = await p.evaluate(() => document.visibilityState).catch(() => "hidden");
    if (state === "visible") { target = p; break; }
  } catch { /* ignore */ }
}

await target.screenshot({ path: outPath, fullPage: false });
console.log(`saved ${outPath}`);
console.log(`tab: ${target.url()}`);

await browser.close();   // disconnects CDP but leaves Chrome running
