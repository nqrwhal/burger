// Content script entry. Wires the detector, native-select adapter, and
// mutation manager together, and reacts to settings changes live (no reload
// needed when the user flips the popup toggle).

(function () {
  const { detector, nativeSelect, mutationManager, settings } = window.__usFirst;

  if (location.protocol === "chrome-extension:" || location.protocol === "about:") return;

  let enabled = true;
  let kindsEnabled = { country: true, currency: true };
  const sensitiveUrl = detector.SENSITIVE_URL_RE.test(location.href);

  // Track which selects we've already scored (one-shot) and which we've
  // actually modified (so the "restore" action can find them).
  const seen = new WeakSet();
  const modified = new Set();

  function scanOnce() {
    if (!enabled || sensitiveUrl) return;
    const selects = document.querySelectorAll("select");
    for (const sel of selects) {
      if (seen.has(sel)) {
        // Framework re-rendered? Re-apply.
        if (nativeSelect.isProcessed(sel)) reapplyIfNeeded(sel);
        continue;
      }
      seen.add(sel);
      const result = detector.scoreSelector(sel);
      if (result.kind === "none") continue;
      if (result.kind === "country" && !kindsEnabled.country) continue;
      if (result.kind === "currency" && !kindsEnabled.currency) continue;
      if (result.score < detector.ACT_THRESHOLD) continue;

      const r = nativeSelect.reorderNativeSelect(sel, result);
      if (r.changed) modified.add(sel);
    }
  }

  function reapplyIfNeeded(sel) {
    const result = detector.scoreSelector(sel);
    if (result.kind === "country" && !kindsEnabled.country) return;
    if (result.kind === "currency" && !kindsEnabled.currency) return;
    if (result.score >= detector.ACT_THRESHOLD && result.targetOption) {
      nativeSelect.reorderNativeSelect(sel, result);
    }
  }

  // Must match siteKeyFromUrl() in the popup so the popup and content script
  // agree on the disabledHosts key. file:// pages share one key, http(s) pages
  // are keyed by hostname.
  function siteKey() {
    if (location.protocol === "file:") return "file://";
    return location.hostname.toLowerCase();
  }

  async function refreshSettings() {
    enabled = await settings.isEnabledForHost(siteKey());
    kindsEnabled = await settings.getKindsEnabled();
  }

  async function init() {
    await refreshSettings();
    const mgr = mutationManager.createManager(scanOnce);
    mgr.start();

    // Live-react to settings changes from the popup or options page.
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== "local" || !changes.burgerizeSettings) return;
      await refreshSettings();
      if (enabled) {
        mgr.requestScan("settings-changed");
      } else {
        // User just disabled — restore everything we touched.
        for (const sel of modified) nativeSelect.restoreOriginalOrder(sel);
        modified.clear();
      }
    });
  }

  // Popup needs to know enabled state. We answer with the bare minimum.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "burgerize:get-state") {
      sendResponse({
        host: location.hostname,
        enabled,
        sensitiveUrl,
        modifiedCount: modified.size
      });
      return false;
    }
    return false;
  });

  init();
})();
