// Accessibility audit.
//
// For each positive fixture: load with Burger disabled, snapshot axe-core
// violations on the listbox/select subtree, then enable Burger, wait for
// reorder, snapshot again. Assert the post-reorder set introduces no NEW
// violation IDs vs. the pre-reorder set.
//
// We compare delta rather than absolute count because some fixtures have
// pre-existing axe issues (e.g. an unlabeled <input> in our handwritten DOM).
// Those aren't our problem — we just need to confirm reorder doesn't make
// things worse.
//
// What this catches: an option moved into the wrong parent so
// `aria-activedescendant` no longer resolves; a reorder that strips a
// `data-` attribute axe cares about; placeholder logic that hides the only
// labeled option. Today the only protection is "did the e2e test still
// pass"; axe tells us *why* if we ever break it.

import { test, expect, enableBurger, waitForBurger, waitForOrder, listboxLabels, selectLabels } from "./fixtures";
import type { Page } from "@playwright/test";
import path from "node:path";

const AXE_PATH = path.resolve(__dirname, "..", "..", "node_modules", "axe-core", "axe.min.js");

// Run axe against a CSS selector subtree. Returns the set of violation IDs.
async function axeViolationIds(page: Page, selector: string): Promise<Set<string>> {
  await page.addScriptTag({ path: AXE_PATH });
  const result = await page.evaluate(async (sel) => {
    // @ts-ignore — axe is attached by the script tag above
    const r = await axe.run(document.querySelector(sel) || document.body, {
      // Best-practice rules are noisy and not what we're guarding. Stick to
      // WCAG 2.0 A/AA — those are the ones a real screen-reader user feels.
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }
    });
    return r.violations.map((v: any) => v.id);
  }, selector);
  return new Set(result);
}

// Disable Burger for a single test by writing globalEnabled=false to storage.
async function disableBurger(extContext: any, extensionId: string) {
  const page = await extContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await page.evaluate(() => new Promise<void>(resolve => {
    chrome.storage.local.set({
      burgerizeSettings: {
        globalEnabled: false, countryEnabled: true, currencyEnabled: true,
        debugMode: false, disabledHosts: {}
      }
    }, () => resolve());
  }));
  await page.close();
}

// Diff: violations present after that weren't present before.
function newViolations(before: Set<string>, after: Set<string>): string[] {
  return [...after].filter(id => !before.has(id));
}

// ── Native <select> path ──────────────────────────────────────────────────

const NATIVE_CASES = [
  { url: "/positive-basic.html",                subtree: "#country",  trigger: null,            target: () => null,                                ready: (labels: string[]) => labels[1] === "United States" },
  { url: "/positive-currency.html",             subtree: "#currency", trigger: null,            target: () => null,                                ready: (labels: string[]) => /^USD\b/.test(labels[1] || "") },
  { url: "/positive-preserves-selection.html",  subtree: "#country",  trigger: null,            target: () => null,                                ready: (labels: string[]) => labels[1] === "United States" }
];

for (const c of NATIVE_CASES) {
  test(`a11y native: no new violations after reorder — ${c.url}`, async ({ page, extContext, extensionId }) => {
    // BEFORE: Burger off.
    await disableBurger(extContext, extensionId);
    await page.goto(c.url);
    await waitForBurger(page);
    const before = await axeViolationIds(page, c.subtree);

    // AFTER: Burger on, reload, wait for reorder.
    await enableBurger(extContext, extensionId);
    await page.goto(c.url);
    await waitForBurger(page);
    await waitForOrder(page, () => selectLabels(page, c.subtree), c.ready);
    const after = await axeViolationIds(page, c.subtree);

    const added = newViolations(before, after);
    expect(added, `axe added violations: ${added.join(",")}; before=[${[...before]}] after=[${[...after]}]`).toEqual([]);
  });
}

// ── ARIA path (must click to open) ────────────────────────────────────────

const ARIA_CASES = [
  { url: "/positive-aria-country.html",  subtree: "#country-listbox",                 trigger: "#country-input",                ready: (l: string[]) => l[0] === "United States" },
  { url: "/positive-aria-currency.html", subtree: "#currency-listbox",                trigger: "#currency-input",               ready: (l: string[]) => /US Dollar/i.test(l[0] || "") },
  { url: "/positive-radix.html",         subtree: "#radix-listbox",                   trigger: "#radix-trigger",                ready: (l: string[]) => l[0] === "United States" },
  { url: "/positive-headlessui.html",    subtree: "#headlessui-listbox-options-1",    trigger: "#headlessui-listbox-button-1",  ready: (l: string[]) => /^USD\b/.test(l[0] || "") },
  { url: "/positive-mui-select.html",    subtree: "#mui-listbox",                     trigger: "#mui-trigger",                  ready: (l: string[]) => l[0] === "United States" },
  { url: "/positive-react-select.html",  subtree: "#rs-listbox",                      trigger: "#rs-control",                   ready: (l: string[]) => l[0] === "United States" },
  { url: "/positive-antd.html",          subtree: "#antd-dropdown",                   trigger: "#antd-trigger",                 ready: (l: string[]) => l[0] === "United States" }
];

for (const c of ARIA_CASES) {
  test(`a11y aria: no new violations after reorder — ${c.url}`, async ({ page, extContext, extensionId }) => {
    // BEFORE: Burger off; open the listbox; snapshot.
    await disableBurger(extContext, extensionId);
    await page.goto(c.url);
    await waitForBurger(page);
    await page.click(c.trigger);
    // Brief pause for the listbox to render (MUI portal etc.).
    await page.waitForTimeout(100);
    const before = await axeViolationIds(page, c.subtree);

    // AFTER: Burger on; reload; open; wait for reorder; snapshot.
    await enableBurger(extContext, extensionId);
    await page.goto(c.url);
    await waitForBurger(page);
    await page.click(c.trigger);
    await waitForOrder(page, () => listboxLabels(page, c.subtree), c.ready);
    const after = await axeViolationIds(page, c.subtree);

    const added = newViolations(before, after);
    expect(added, `axe added violations: ${added.join(",")}; before=[${[...before]}] after=[${[...after]}]`).toEqual([]);
  });
}
