// Launch a real Google Chrome with Burger loaded, exposing a remote-debugging
// port. The user drives the window like normal Chrome. A sibling script
// (shoot.mjs) connects via CDP to capture the active tab.
//
// Why real Chrome (not Playwright's Chromium): Chromium shows a yellow
// "controlled by automated test software" infobar that would appear in every
// screenshot. Real Chrome over CDP doesn't.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT_ROOT = ROOT;
const PORT = 9222;

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "burger-shoot-"));
const chromeBin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!fs.existsSync(chromeBin)) {
  console.error(`Cannot find Chrome at ${chromeBin}`);
  process.exit(1);
}

const args = [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`,
  `--disable-extensions-except=${EXT_ROOT}`,
  `--load-extension=${EXT_ROOT}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1280,800",
  "--window-position=80,80",
  // Suppress the "Choose your search engine" and other first-run modals
  // that would clutter the user-data-dir flow.
  "--disable-features=ChromeWhatsNewUI"
];

const child = spawn(chromeBin, args, {
  detached: true,
  stdio: ["ignore", "inherit", "inherit"]
});

// Print a marker the parent shell can grep for to know it's up. We just need
// to wait long enough for Chrome to bind the port.
setTimeout(() => {
  console.log(`READY port=${PORT} userDataDir=${userDataDir} pid=${child.pid}`);
  // Detach so this script can exit but Chrome stays up.
  child.unref();
  process.exit(0);
}, 1500);
