// ARIA listbox fixtures: the listbox is only visible after a click. The
// extension's mutation manager observes attribute changes including
// aria-expanded / aria-hidden, scans when those flip, and reorders the
// children of the now-visible role=listbox.

import { test, expect, waitForBurger, listboxLabels, waitForOrder, enableBurger } from "./fixtures";
import type { Page } from "@playwright/test";

const TOP_US = (labels: string[]) => labels[0] === "United States";
const TOP_USD = (labels: string[]) => /^USD\b/.test(labels[0] || "");
const TOP_USD_LONG = (labels: string[]) => /US Dollar/i.test(labels[0] || "");

test.beforeEach(async ({ extContext, extensionId }) => {
  await enableBurger(extContext, extensionId);
});

async function open(page: Page, trigger: string) {
  await page.click(trigger);
}

test("positive-aria-country: opens listbox and reorders US to top", async ({ page }) => {
  await page.goto("/positive-aria-country.html");
  await waitForBurger(page);
  await open(page, "#country-input");
  const labels = await waitForOrder(page, () => listboxLabels(page, "#country-listbox"), TOP_US);
  expect(labels[0]).toBe("United States");
});

test("positive-aria-currency: opens listbox and reorders USD to top", async ({ page }) => {
  await page.goto("/positive-aria-currency.html");
  await waitForBurger(page);
  await open(page, "#currency-input");
  await waitForOrder(page, () => listboxLabels(page, "#currency-listbox"), TOP_USD_LONG);
});

test("positive-radix: hand-DOM Radix Select pattern reorders on open", async ({ page }) => {
  await page.goto("/positive-radix.html");
  await waitForBurger(page);
  await open(page, "#radix-trigger");
  await waitForOrder(page, () => listboxLabels(page, "#radix-listbox"), TOP_US);
});

test("positive-headlessui: Headless UI Listbox reorders USD on open", async ({ page }) => {
  await page.goto("/positive-headlessui.html");
  await waitForBurger(page);
  await open(page, "#headlessui-listbox-button-1");
  await waitForOrder(page, () => listboxLabels(page, "#headlessui-listbox-options-1"), TOP_USD);
});

test("positive-mui-select: portal-rendered MUI listbox reorders on open", async ({ page }) => {
  await page.goto("/positive-mui-select.html");
  await waitForBurger(page);
  await open(page, "#mui-trigger");
  // MUI mounts the popover at <body> after first open. Give the mutation
  // manager a moment to see it.
  await waitForOrder(page, () => listboxLabels(page, "#mui-listbox"), TOP_US);
});

test("positive-react-select: hand-DOM React Select reorders on open", async ({ page }) => {
  await page.goto("/positive-react-select.html");
  await waitForBurger(page);
  await open(page, "#rs-control");
  await waitForOrder(page, () => listboxLabels(page, "#rs-listbox"), TOP_US);
});

test("positive-antd: Ant Design dropdown is synth-roled and reordered on open", async ({ page }) => {
  await page.goto("/positive-antd.html");
  await waitForBurger(page);
  await open(page, "#antd-trigger");
  // Antd adapter synthesizes role=listbox on .ant-select-dropdown.
  await waitForOrder(page, () => listboxLabels(page, "#antd-dropdown"), TOP_US);
});

test("positive-mui-select: closed portal listbox is not reordered before open", async ({ page }) => {
  await page.goto("/positive-mui-select.html");
  await waitForBurger(page);
  await page.waitForTimeout(500);
  const labels = await listboxLabels(page, "#mui-listbox");
  expect(labels[0]).toBe("Argentina");
  expect(labels[labels.length - 1]).toBe("Uruguay");
});

test("positive-aria-rerender: reorders again after same-listbox child rewrite", async ({ page }) => {
  await page.goto("/positive-aria-rerender.html");
  await waitForBurger(page);
  await open(page, "#country-input");
  await waitForOrder(page, () => listboxLabels(page, "#country-listbox"), TOP_US);
  await page.click("#rebuild");
  // Mutation observer is throttled at 120ms; give it a beat after the rewrite.
  await waitForOrder(page, () => listboxLabels(page, "#country-listbox"), TOP_US, 4_000);
});

test("positive-aria-hidden-open: reorders when listbox opens via hidden attr", async ({ page }) => {
  await page.goto("/positive-aria-hidden-open.html");
  await waitForBurger(page);
  await page.click("#open-btn");
  await waitForOrder(page, () => listboxLabels(page, "#hidden-listbox"), TOP_US);
});
