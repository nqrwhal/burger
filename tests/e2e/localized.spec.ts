// Locks in the localization expansion: a single fixture page with three
// non-English country selects (Spanish/Russian/Portuguese) plus a noisy
// "Estados Unidos (USA)" label that should still match via the
// contains-strong-alias path.

import { test, expect, enableBurger, waitForBurger, waitForOrder, selectLabels } from "./fixtures";

test.beforeEach(async ({ extContext, extensionId }) => {
  await enableBurger(extContext, extensionId);
});

test("localized country labels reorder correctly", async ({ page }) => {
  await page.goto("/positive-localized.html");
  await waitForBurger(page);

  // Spanish — "Estados Unidos (USA)" should be picked up via the
  // contains-strong-alias path (label has extra "(USA)" suffix).
  const es = await waitForOrder(
    page,
    () => selectLabels(page, "#pais"),
    labels => /^Estados Unidos/.test(labels[1] || "")
  );
  expect(es[1]).toBe("Estados Unidos (USA)");

  // Russian — exact strong match on "Соединённые Штаты".
  const ru = await waitForOrder(
    page,
    () => selectLabels(page, "#strana"),
    labels => labels[1] === "Соединённые Штаты"
  );
  expect(ru[1]).toBe("Соединённые Штаты");

  // Portuguese — "Estados Unidos da América" is in the alias list.
  const pt = await waitForOrder(
    page,
    () => selectLabels(page, "#pais-pt"),
    labels => labels[1] === "Estados Unidos da América"
  );
  expect(pt[1]).toBe("Estados Unidos da América");
});
