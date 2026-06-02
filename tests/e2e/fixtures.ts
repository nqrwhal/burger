// Shared helpers for Burger e2e tests.
//
// Architecture: one persistent Chromium per Playwright worker, reused across
// every test in that worker. Tests navigate the same page to a new fixture
// URL instead of launching their own browser — saves ~2s per test (previous
// approach was ~37s for 22 tests; this brings it down significantly).
//
// Trade-off: tests in the same worker share storage and cookies. `enableBurger`
// resets chrome.storage to defaults at the start of each test, which gives the
// same isolation we had before for anything the extension cares about.
//
// Naming: Playwright reserves `context` and `browser` as built-in fixtures, so
// the worker-scoped persistent context is exposed as `extContext`. The
// `page` fixture is overridden to return the persistent context's first
// page (parked on about:blank between tests).

import { test as base, chromium, BrowserContext, Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Default to the live source tree. Override with BURGER_EXT_ROOT to test
// a packaged/unzipped build — `npm run pack` produces dist/burger-*.zip;
// extract that and point this at the extracted directory to verify the
// shipped artifact is functionally identical.
const EXT_ROOT = process.env.BURGER_EXT_ROOT || path.resolve(__dirname, "..", "..");

type WorkerFixtures = {
  extContext: BrowserContext;
  extensionId: string;
};

type TestFixtures = {
  page: Page;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  extContext: [async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "burger-e2e-"));
    const headless = process.env.BURGER_HEADLESS === "1";
    const args = [
      `--disable-extensions-except=${EXT_ROOT}`,
      `--load-extension=${EXT_ROOT}`,
      "--no-first-run",
      "--no-default-browser-check"
    ];
    if (headless) args.push("--headless=new");
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args,
      viewport: { width: 1100, height: 800 }
    });
    await use(context);
    await context.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }, { scope: "worker" }],

  extensionId: [async ({ extContext }, use) => {
    let workers = extContext.serviceWorkers();
    if (workers.length === 0) {
      workers = [await extContext.waitForEvent("serviceworker", { timeout: 5_000 })];
    }
    await use(new URL(workers[0].url()).host);
  }, { scope: "worker" }],

  page: async ({ extContext }, use) => {
    let [page] = extContext.pages();
    if (!page) page = await extContext.newPage();
    await use(page);
    // Park on about:blank so the next test starts from a clean slate.
    try { await page.goto("about:blank"); } catch { /* ignore */ }
  }
});

export const expect = test.expect;

// Wait for Burger's content script to have run at least once.
//
// We can't probe `window.__usFirst` directly from `page.evaluate` — content
// scripts run in an isolated world and their globals don't leak into the
// main world Playwright sees. Instead we wait for `document_idle` (which is
// when the manifest schedules the scripts) and give a small grace period
// for the initial scan to land. Tests then call `waitForOrder` to assert
// on the actual reorder effect — that's the real signal we care about.
export async function waitForBurger(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  // Extension scripts run at document_idle, which fires shortly after load.
  // Give them ~150ms to attach and run their first scan.
  await page.waitForTimeout(150);
}

// Read the visible <option> labels of a <select> in document order.
export async function selectLabels(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(`${selector} option`, opts => opts.map(o => (o.textContent || "").trim()));
}

// Read the visible labels of a role=listbox's options in document order.
export async function listboxLabels(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(
    `${selector} [role="option"]`,
    opts => opts.map(o => (o.textContent || "").trim())
  );
}

// Wait until predicate(labels) returns truthy, polling every 50ms.
export async function waitForOrder(
  page: Page,
  readLabels: () => Promise<string[]>,
  predicate: (labels: string[]) => boolean,
  timeoutMs = 3_000
): Promise<string[]> {
  const start = Date.now();
  let last: string[] = [];
  while (Date.now() - start < timeoutMs) {
    last = await readLabels();
    if (predicate(last)) return last;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`waitForOrder timed out; last labels:\n${JSON.stringify(last, null, 2)}`);
}

// Reset Burger to defaults (globalEnabled, no per-site disables, debug off).
// Since the context is shared across tests in a worker, storage from a
// previous test could leak in — call this in beforeEach to guarantee a
// known state. Writes via the options page (extension origin).
export async function enableBurger(extContext: BrowserContext, extensionId: string) {
  const optionsPage = await extContext.newPage();
  try {
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/options.html`);
    await optionsPage.evaluate(() => new Promise<void>(resolve => {
      chrome.storage.local.set({
        burgerizeSettings: {
          globalEnabled: true,
          countryEnabled: true,
          currencyEnabled: true,
          debugMode: false,
          disabledHosts: {}
        }
      }, () => resolve());
    }));
  } finally {
    await optionsPage.close();
  }
}
