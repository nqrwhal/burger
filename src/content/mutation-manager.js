// Watches the DOM for new <select> elements and re-runs the scan. Throttled so
// the extension never causes long tasks.
//
// We intentionally do NOT suppress observer callbacks around our own DOM moves.
// A follow-up scan after reorder hits the adapters' "already-on-top" fast path
// and does not mutate again, so there is no feedback loop — and suppressing
// would drop real framework re-renders that happen in the same turn.

const SCAN_INTERVAL_MS = 120;

function createManager(onScanRequested) {
  let pending = false;
  let lastScan = 0;

  function requestScan(reason) {
    if (pending) return;
    pending = true;
    const now = performance.now();
    const wait = Math.max(0, SCAN_INTERVAL_MS - (now - lastScan));
    setTimeout(() => {
      pending = false;
      lastScan = performance.now();
      try { onScanRequested(reason); } catch (e) { console.warn("[us-first] scan failed", e); }
    }, wait);
  }

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) {
        requestScan("mutation-childlist");
        return;
      }
      if (m.type === "attributes") {
        // Menus often open by flipping aria-expanded / aria-hidden / hidden
        // without adding nodes (e.g. a pre-mounted portal).
        if (
          m.attributeName === "aria-expanded" ||
          m.attributeName === "aria-hidden" ||
          m.attributeName === "hidden"
        ) {
          requestScan("aria-state-change");
          return;
        }
      }
    }
  });

  function injectHistoryHook() {
    // Page-world patch; content scripts cannot see the page's History methods.
    try {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("src/content/history-hook.js");
      s.async = false;
      s.onload = () => { try { s.remove(); } catch { /* ignore */ } };
      const root = document.documentElement || document.head || document.body;
      if (root) root.appendChild(s);
    } catch (e) {
      console.warn("[us-first] history hook inject failed", e);
    }
    window.addEventListener("burgerize:navigate", () => requestScan("history"));
    window.addEventListener("popstate", () => requestScan("popstate"));
  }

  function start() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "aria-hidden", "hidden"]
    });
    injectHistoryHook();
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
