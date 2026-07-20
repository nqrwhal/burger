// Native <select> fixtures: extension reorders option DOM directly. No click
// to open is required — the scan runs at document_idle and on mutations.

import { test, expect, waitForBurger, selectLabels, waitForOrder, enableBurger } from "./fixtures";

const TOP_US = (labels: string[]) => labels[1] === "United States";       // [0] is placeholder
const TOP_USD = (labels: string[]) => /^USD\b/.test(labels[1] || "");

test.beforeEach(async ({ extContext, extensionId }) => {
  await enableBurger(extContext, extensionId);
});

test("positive-basic: United States moves to top of <select>", async ({ page }) => {
  await page.goto("/positive-basic.html");
  await waitForBurger(page);
  const labels = await waitForOrder(page, () => selectLabels(page, "#country"), TOP_US);
  expect(labels[0]).toBe("Select country");
  expect(labels[1]).toBe("United States");
});

test("positive-currency: USD moves to top of <select>", async ({ page }) => {
  await page.goto("/positive-currency.html");
  await waitForBurger(page);
  const labels = await waitForOrder(page, () => selectLabels(page, "#currency"), TOP_USD);
  expect(labels[0]).toBe("Select currency");
  expect(labels[1]).toMatch(/^USD\b/);
});

test("positive-preserves-selection: selected value unchanged after reorder", async ({ page }) => {
  await page.goto("/positive-preserves-selection.html");
  await waitForBurger(page);
  await waitForOrder(page, () => selectLabels(page, "#country"), TOP_US);
  const selected = await page.$eval("#country", el => (el as HTMLSelectElement).value);
  expect(selected).toBe("CA");
});

test("positive-dynamic: async-inserted select is picked up by mutation observer", async ({ page }) => {
  await page.goto("/positive-dynamic.html");
  await waitForBurger(page);
  // The fixture injects the <select> 1500ms later. Mutation observer should
  // catch it. Bump timeout accordingly.
  const labels = await waitForOrder(
    page,
    () => selectLabels(page, "#country"),
    TOP_US,
    6_000
  );
  expect(labels[1]).toBe("United States");
});

test("positive-shadow-dom: open shadow root <select> is reordered", async ({ page }) => {
  await page.goto("/positive-shadow-dom.html");
  await waitForBurger(page);
  // Read shadow-DOM options via JS, not a flat selector.
  const labels = await waitForOrder(
    page,
    () => page.evaluate(() => {
      const host = document.querySelector("country-picker") as any;
      if (!host || !host.shadowRoot) return [];
      return Array.from(host.shadowRoot.querySelectorAll("select option"))
        .map(o => (o.textContent || "").trim());
    }),
    TOP_US
  );
  expect(labels[1]).toBe("United States");
});

test("positive-choices: dropdown reorders US to top on open", async ({ page }) => {
  await page.goto("/positive-choices.html");
  await waitForBurger(page);
  // Choices.js detaches the original <option> elements from the backing
  // <select> after init, so reading the native options is misleading. The
  // user-visible signal is the role=listbox dropdown that opens on click —
  // that's what the ARIA adapter reorders.
  await page.click(".choices");
  await waitForOrder(
    page,
    () => page.$$eval(
      ".choices__list--dropdown [role='option']",
      els => els.map(o => (o.textContent || "").trim())
    ),
    // Choices.js includes the placeholder ("Select country") as the first
    // dropdown item, so US lands at index 1 — same shape as a native select.
    labels => labels[1] === "United States",
    6_000
  );
});

test("positive-tom-select: backing <select> in Tom Select wrapper is reordered", async ({ page }) => {
  await page.goto("/positive-tom-select.html");
  await waitForBurger(page);
  await waitForOrder(
    page,
    () => selectLabels(page, "#currency"),
    TOP_USD,
    6_000
  );
});

test("positive-select2: backing <select> next to .select2-container is reordered", async ({ page }) => {
  await page.goto("/positive-select2.html");
  await waitForBurger(page);
  await waitForOrder(
    page,
    () => selectLabels(page, "select"),
    TOP_US,
    6_000
  );
});

test("positive-duplicate-value: selection stays on the original option element", async ({ page }) => {
  await page.goto("/positive-duplicate-value.html");
  await waitForBurger(page);
  await waitForOrder(page, () => selectLabels(page, "#country"), TOP_US);
  const selectedId = await page.$eval("#country", el => {
    const sel = el as HTMLSelectElement;
    return sel.selectedOptions[0]?.id || "";
  });
  expect(selectedId).toBe("canada-primary");
  expect(await page.$eval("#country", el => (el as HTMLSelectElement).value)).toBe("CA");
});

test("positive-pushstate: select injected after pushState is reordered", async ({ page }) => {
  await page.goto("/positive-pushstate.html");
  await waitForBurger(page);
  await page.click("#nav");
  await waitForOrder(page, () => selectLabels(page, "#country"), TOP_US, 4_000);
});
