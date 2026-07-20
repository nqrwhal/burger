// Build a Chrome Web Store-ready zip of the extension.
//
// Includes only the files the extension actually loads at runtime
// (manifest, src/, icons/) — no tests, no devDeps, no docs. The Pages
// site already hosts README and PRIVACY publicly; shipping them inside
// the zip would just inflate the package and confuse the reviewer.
//
// Output: dist/burger-<version>.zip in the repo root.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

// What goes in the zip. Paths are relative to ROOT.
const INCLUDE = ["manifest.json", "src", "icons"];

function readManifest() {
  const raw = fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8");
  return JSON.parse(raw);
}

function verifyIncludedFilesExist() {
  for (const p of INCLUDE) {
    const full = path.join(ROOT, p);
    if (!fs.existsSync(full)) {
      throw new Error(`Cannot pack: missing ${p}`);
    }
  }
}

// Read manifest.json and walk its referenced files to verify they're all
// either listed in INCLUDE or inside an included directory. Catches the
// embarrassing case where someone adds a new content-script file but
// forgets to ship it.
function verifyManifestFilesAreIncluded(manifest) {
  const referenced = new Set();
  const ref = (p) => { if (p) referenced.add(p); };

  ref(manifest.background?.service_worker);
  for (const cs of manifest.content_scripts || []) {
    for (const j of cs.js || []) ref(j);
    for (const c of cs.css || []) ref(c);
  }
  for (const [, p] of Object.entries(manifest.icons || {})) ref(p);
  for (const [, p] of Object.entries(manifest.action?.default_icon || {})) ref(p);
  ref(manifest.action?.default_popup);
  ref(manifest.options_ui?.page);
  ref(manifest.options_page);
  for (const war of manifest.web_accessible_resources || []) {
    for (const r of war.resources || []) ref(r);
  }

  const missing = [];
  for (const p of referenced) {
    const full = path.join(ROOT, p);
    if (!fs.existsSync(full)) {
      missing.push(p);
      continue;
    }
    // Confirm the file lives under one of our INCLUDE paths.
    const inside = INCLUDE.some(inc => p === inc || p.startsWith(inc + "/"));
    if (!inside) missing.push(`${p} (not under INCLUDE: ${INCLUDE.join(",")})`);
  }
  if (missing.length) {
    throw new Error(`Manifest references files that won't be packed:\n  - ${missing.join("\n  - ")}`);
  }
}

function main() {
  const manifest = readManifest();
  verifyIncludedFilesExist();
  verifyManifestFilesAreIncluded(manifest);

  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, `burger-${manifest.version}.zip`);
  // Remove any prior build so `zip` doesn't append into a stale archive.
  try { fs.unlinkSync(out); } catch { /* ignore */ }

  // zip flags:
  //   -r  recurse into directories
  //   -X  strip extra macOS file attributes (cleaner archive, smaller)
  //   -q  quiet (we print a summary ourselves)
  // -x excludes: .DS_Store anywhere; any .map files.
  execFileSync("zip", [
    "-rXq", out,
    ...INCLUDE,
    "-x", "*.DS_Store",
    "-x", "*.map"
  ], { cwd: ROOT, stdio: "inherit" });

  const bytes = fs.statSync(out).size;
  const kb = (bytes / 1024).toFixed(1);
  console.log(`packed ${path.relative(ROOT, out)}  (${kb} KB)`);
  console.log(`version: ${manifest.version}`);
}

main();
