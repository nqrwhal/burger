// Lifecycle: global disable/re-enable and per-kind toggles must restore and
// re-apply correctly without requiring a full page navigation.

import {
  test,
  expect,
  waitForBurger,
  selectLabels,
  waitForOrder,
  enableBurger,
  patchBurgerSettings,
  writeBurgerSettings
} from "./fixtures";

const TOP_US = (labels: string[]) => labels[1] === "United States";

test.beforeEach(async ({ extContext, extensionId }) => {
  await enableBurger(extContext, extensionId);
});

test("global disable restores; re-enable reorders again", async ({
  page,
  extContext,
  extensionId
}) => {
  await page.goto("/positive-basic.html");
  await waitForBurger(page);
  await waitForOrder(page, () => selectLabels(page, "#country"), TOP_US);

  await writeBurgerSettings(extContext, extensionId, {
    globalEnabled: false,
    countryEnabled: true,
    currencyEnabled: true,
    debugMode: false,
    disabledHosts: {}
  });
  await expect.poll(async () => {
    const labels = await selectLabels(page, "#country");
    return labels[1];
  }, { timeout: 3_000 }).toBe("Afghanistan");

  await writeBurgerSettings(extContext, extensionId, {
    globalEnabled: true,
    countryEnabled: true,
    currencyEnabled: true,
    debugMode: false,
    disabledHosts: {}
  });
  await waitForOrder(page, () => selectLabels(page, "#country"), TOP_US, 4_000);
});

test("country kind off restores country select without navigation", async ({
  page,
  extContext,
  extensionId
}) => {
  await page.goto("/positive-basic.html");
  await waitForBurger(page);
  await waitForOrder(page, () => selectLabels(page, "#country"), TOP_US);

  await patchBurgerSettings(extContext, extensionId, { countryEnabled: false });
  await expect.poll(async () => {
    const labels = await selectLabels(page, "#country");
    return labels[1];
  }, { timeout: 3_000 }).toBe("Afghanistan");
});

test("antd synth roles are removed on global disable", async ({
  page,
  extContext,
  extensionId
}) => {
  await page.goto("/positive-antd.html");
  await waitForBurger(page);
  await page.click("#antd-trigger");
  await waitForOrder(
    page,
    () => page.$$eval(
      "#antd-dropdown [role='option']",
      els => els.map(o => (o.textContent || "").trim())
    ),
    labels => labels[0] === "United States"
  );

  await writeBurgerSettings(extContext, extensionId, {
    globalEnabled: false,
    countryEnabled: true,
    currencyEnabled: true,
    debugMode: false,
    disabledHosts: {}
  });

  await expect.poll(async () => {
    return page.$eval("#antd-dropdown", el => ({
      role: el.getAttribute("role"),
      synth: el.getAttribute("data-burger-antd-synth"),
      firstHasRole: !!el.querySelector(".ant-select-item-option[role]")
    }));
  }, { timeout: 3_000 }).toEqual({
    role: null,
    synth: null,
    firstHasRole: false
  });
});
