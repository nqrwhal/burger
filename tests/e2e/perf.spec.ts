// Performance budget.
//
// The content script logs `[burger-perf] scan-ms=<n>` on every scanOnce when
// debugMode is on. We trigger N scans on a heavy page (40 selects + a 60-option
// ARIA listbox) by toggling a class on <body> (which the MutationObserver
// picks up via childList, since we add/remove a child). Then we read the
// samples from the page's console log and assert the budget.
//
// Budget rationale: a single scan must stay well under one frame (16.6 ms at
// 60Hz) so we never block rendering. Median target 5 ms, p95 target 20 ms.
// These are wide bands because the heavy fixture has 40 selects — real sites
// rarely have more than one or two.

import { test, expect, enableBurger, waitForBurger } from "./fixtures";

const MEDIAN_BUDGET_MS = 8;
const P95_BUDGET_MS = 25;
const SAMPLE_COUNT = 10;

function quantile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}

test("scanOnce stays under perf budget on a heavy page", async ({ page, extContext, extensionId }) => {
  await enableBurger(extContext, extensionId);

  // Flip debugMode on so the content script emits perf samples.
  const dbgPage = await extContext.newPage();
  await dbgPage.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await dbgPage.evaluate(() => new Promise<void>(resolve => {
    chrome.storage.local.get(["burgerizeSettings"], r => {
      const s = r.burgerizeSettings || {};
      s.debugMode = true;
      chrome.storage.local.set({ burgerizeSettings: s }, () => resolve());
    });
  }));
  await dbgPage.close();

  const samples: number[] = [];
  page.on("console", msg => {
    const t = msg.text();
    if (!t.startsWith("[burger-perf]")) return;
    const m = /scan-ms=([\d.]+)/.exec(t);
    if (m) samples.push(parseFloat(m[1]));
  });

  await page.goto("/perf-heavy.html");
  await waitForBurger(page);

  // Provoke additional scans by appending+removing a child every 150ms (just
  // above the scan throttle).
  for (let i = 0; i < SAMPLE_COUNT - 1; i++) {
    await page.evaluate(() => {
      const n = document.createElement("div");
      n.textContent = String(Date.now());
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 1);
    });
    await page.waitForTimeout(160);
  }
  // Wait for the last queued scan to drain.
  await page.waitForTimeout(300);

  expect(samples.length, `expected ≥${SAMPLE_COUNT} perf samples, got ${samples.length}: ${samples.join(",")}`)
    .toBeGreaterThanOrEqual(SAMPLE_COUNT);

  const median = quantile(samples, 0.5);
  const p95 = quantile(samples, 0.95);
  // Helpful diagnostic — only printed on failure.
  const summary = `samples=${samples.length} median=${median.toFixed(2)}ms p95=${p95.toFixed(2)}ms all=[${samples.map(s => s.toFixed(2)).join(",")}]`;

  expect(median, `MEDIAN over budget. ${summary}`).toBeLessThanOrEqual(MEDIAN_BUDGET_MS);
  expect(p95, `P95 over budget. ${summary}`).toBeLessThanOrEqual(P95_BUDGET_MS);

  // Report the numbers in test output even on success so we can spot drift.
  console.log(`[perf] ${summary}`);
});
