// Tiny static file server that exposes tests/fixtures/ at http://127.0.0.1:5733/.
// Used by Playwright (and useful for manual browsing too).
//
// Why not file://? File URLs have a unique security origin per file, which
// breaks cross-document resource loads we don't actually care about.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures");
const port = 5733;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (rel === "" || rel === "/") rel = "index.html";
  const full = path.resolve(root, rel);
  if (!full.startsWith(root)) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }
  fs.readFile(full, (err, buf) => {
    if (err) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.setHeader("Content-Type", TYPES[path.extname(full)] || "application/octet-stream");
    res.end(buf);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fixtures: http://127.0.0.1:${port}/`);
});
