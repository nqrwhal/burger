// Negative fixtures: the extension must NOT reorder. We assert that the order
// is identical to the original after the extension has had a chance to run.
//
// We give the content script a generous settle time (500ms after waitForBurger)
// because there's no event that says "I decided not to act here." Absence is
// the assertion.

import { test, expect, waitForBurger, selectLabels, listboxLabels, enableBurger } from "./fixtures";

test.beforeEach(async ({ extContext, extensionId }) => {
  await enableBurger(extContext, extensionId);
});

async function settle(page: import("@playwright/test").Page) {
  await page.waitForTimeout(500);
}

test("negative-county: county list left alone", async ({ page }) => {
  await page.goto("/negative-county.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await selectLabels(page, "#county");
  expect(labels[1]).toBe("Orange County");
});

test("negative-cloud-region: region select left alone", async ({ page }) => {
  await page.goto("/negative-cloud-region.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await selectLabels(page, "#region");
  expect(labels[1]).toBe("us-east-1 (N. Virginia)");
});

test("negative-state: US-state select left alone", async ({ page }) => {
  await page.goto("/negative-state.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await selectLabels(page, "#state");
  expect(labels[1]).toBe("Alabama");
});

test("negative-sensitive-citizenship: legal-meaning field skipped", async ({ page }) => {
  await page.goto("/negative-sensitive-citizenship.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await selectLabels(page, "#citizenship");
  expect(labels[1]).toBe("Canada");
  // Confirm US is still where it was originally (last in the list).
  expect(labels[labels.length - 1]).toBe("United States");
});

test("negative-currency-no-usd: currency without USD untouched", async ({ page }) => {
  await page.goto("/negative-currency-no-usd.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await selectLabels(page, "#currency");
  expect(labels[1]).toMatch(/^EUR\b/);
});

test("negative-aria-virtualized: virtualized listbox untouched", async ({ page }) => {
  await page.goto("/negative-aria-virtualized.html");
  await waitForBurger(page);
  await settle(page);
  // Listbox is already aria-expanded=true and visible at load.
  const labels = await listboxLabels(page, "#vlist");
  expect(labels[0]).toBe("Greece");
  expect(labels[labels.length - 1]).toBe("United States");
});

test("negative-aria-filtered: combobox with active filter untouched", async ({ page }) => {
  await page.goto("/negative-aria-filtered.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await listboxLabels(page, "#flist");
  expect(labels[0]).toBe("Germany");
  expect(labels[labels.length - 1]).toBe("United States");
});

test("negative-optgroup: optgroup country select left alone", async ({ page }) => {
  await page.goto("/negative-optgroup.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await selectLabels(page, "#country");
  // Placeholder, then Americas group starting with Argentina — US stays near end of Americas.
  expect(labels[0]).toBe("Select country");
  expect(labels[1]).toBe("Argentina");
  expect(labels).toContain("United States");
  expect(labels[labels.length - 1]).not.toBe("United States");
  // Still after Mexico in original Americas order.
  expect(labels.indexOf("United States")).toBeGreaterThan(labels.indexOf("Mexico"));
});

test("negative-aria-virtualized-late: posinset after first five still skipped", async ({ page }) => {
  await page.goto("/negative-aria-virtualized-late.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await listboxLabels(page, "#vlist-late");
  expect(labels[0]).toBe("Argentina");
  expect(labels[labels.length - 1]).toBe("United States");
});

test("negative-aria-shadow-filtered: shadow combobox filter left alone", async ({ page }) => {
  await page.goto("/negative-aria-shadow-filtered.html");
  await waitForBurger(page);
  await settle(page);
  const labels = await listboxLabels(page, "#flist-shadow");
  expect(labels[0]).toBe("Germany");
  expect(labels[labels.length - 1]).toBe("United States");
});
