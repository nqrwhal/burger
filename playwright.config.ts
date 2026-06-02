import { defineConfig } from "@playwright/test";

// Burger is an MV3 extension. Extensions only load with a persistent context
// (chromium.launchPersistentContext), so individual tests build their own
// context — we don't define a Playwright `projects` browser here. The shared
// helpers live in tests/e2e/fixtures.ts.
//
// We do still run a local static server so fixtures resolve over http:// (not
// file://). file:// frames have a "unique" security origin which interferes
// with some library scripts and exposes us to flakiness the extension itself
// would never hit on real sites.

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:5733",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node tests/serve-fixtures.mjs",
    url: "http://127.0.0.1:5733/index.html",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe"
  }
});
