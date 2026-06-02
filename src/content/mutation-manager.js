// Watches the DOM for new <select> elements and re-runs the scan. Throttled so
// the extension never causes long tasks, and self-mutations are ignored via a
// short suppression flag.

// Throttle keeps us off the main thread under heavy churn, but for ARIA
// menus the perceived lag matters — a 400 ms delay between click-to-open and
// reorder is visible. 120 ms feels instant while still coalescing bursts.
const SCAN_INTERVAL_MS = 120;
const SUPPRESS_MS = 50;

function createManager(onScanRequested) {
  let pending = false;
  let lastScan = 0;
  let suppressUntil = 0;

  function requestScan(reason) {
    if (pending) return;
    pending = true;
    const now = performance.now();
    const wait = Math.max(0, SCAN_INTERVAL_MS - (now - lastScan));
    setTimeout(() => {
      pending = false;
      lastScan = performance.now();
      // Suppress observer reactions to our own DOM moves for a moment.
      suppressUntil = performance.now() + SUPPRESS_MS;
      try { onScanRequested(reason); } catch (e) { console.warn("[us-first] scan failed", e); }
    }, wait);
  }

  const observer = new MutationObserver(mutations => {
    if (performance.now() < suppressUntil) return;
    for (const m of mutations) {
      if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) {
        requestScan("mutation-childlist");
        return;
      }
      if (m.type === "attributes") {
        // aria-expanded going true means a combobox just opened — that's our
        // cue to scan for newly visible listboxes.
        if (m.attributeName === "aria-expanded" || m.attributeName === "aria-hidden") {
          requestScan("aria-state-change");
          return;
        }
      }
    }
  });

  function start() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "aria-hidden"]
    });
    // Also scan on SPA history changes — many frameworks change route without
    // triggering childList mutations on the root.
    window.addEventListener("popstate", () => requestScan("popstate"));
    // Initial scan.
    requestScan("initial");
  }

  function stop() {
    observer.disconnect();
  }

  return { start, stop, requestScan };
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.mutationManager = { createManager };
