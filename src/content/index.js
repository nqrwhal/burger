// Content script entry. Wires the detector, native + ARIA adapters, mutation
// manager, and debug overlay together, and reacts to settings changes live.

(function () {
  if (!window.__usFirst) {
    console.error("[burger] window.__usFirst not initialized — shared modules failed to load.");
    return;
  }
  const ns = window.__usFirst;
  const missing = ["detector", "nativeSelect", "ariaAdapter", "wrappedSelect", "antdAdapter", "mutationManager", "settings", "domWalk", "debugOverlay"]
    .filter(k => !ns[k]);
  if (missing.length) {
    console.error("[burger] missing modules:", missing);
    return;
  }
  const { detector, nativeSelect, ariaAdapter, wrappedSelect, antdAdapter, mutationManager, settings, domWalk, debugOverlay } = ns;

  if (location.protocol === "chrome-extension:" || location.protocol === "about:") return;

  let enabled = true;
  let kindsEnabled = { country: true, currency: true };
  let debugMode = false;
  const sensitiveUrl = detector.SENSITIVE_URL_RE.test(location.href);

  // Track which selectors we've already scored (one-shot) and which we've
  // actually modified (so "restore" can find them). Two collections because
  // native selects use WeakSet keyed by element; modified is iterated.
  const seenNative = new WeakSet();
  const modifiedNative = new Set();
  const seenAria = new WeakSet();
  const modifiedAria = new Set();

  function shouldActOn(kind) {
    if (kind === "country") return kindsEnabled.country;
    if (kind === "currency") return kindsEnabled.currency;
    return false;
  }

  function scanNative() {
    let selects;
    try { selects = domWalk.queryAllSelectsDeep(document); }
    catch (e) { console.warn("[burger] queryAllSelectsDeep failed:", e); return; }
    for (const sel of selects) {
      try {
        if (seenNative.has(sel)) {
          if (nativeSelect.isProcessed(sel)) reapplyNativeIfNeeded(sel);
          continue;
        }
        seenNative.add(sel);
        const result = detector.scoreSelector(sel);
        if (debugMode) {
          console.log("[burger] native:", sel.name || sel.id || "(anon)", "→", result.kind, "score", result.score, result.reasons);
          debugOverlay.annotate(sel, result);
        }
        if (result.kind === "none") continue;
        if (!shouldActOn(result.kind)) continue;
        if (result.score < detector.ACT_THRESHOLD) continue;

        const r = nativeSelect.reorderNativeSelect(sel, result);
        if (r.changed) modifiedNative.add(sel);
      } catch (e) {
        console.warn("[burger] native scan threw on element:", sel, e);
      }
    }
  }

  function reapplyNativeIfNeeded(sel) {
    const result = detector.scoreSelector(sel);
    if (!shouldActOn(result.kind)) return;
    if (result.score >= detector.ACT_THRESHOLD && result.targetOption) {
      nativeSelect.reorderNativeSelect(sel, result);
    }
  }

  function scanAria() {
    let listboxes;
    try { listboxes = ariaAdapter.findOpenListboxes(document); }
    catch (e) { console.warn("[burger] findOpenListboxes failed:", e); return; }
    if (debugMode) console.log("[burger] aria: found", listboxes.length, "open listbox(es)");
    for (const lb of listboxes) {
      try {
        if (ariaAdapter.isProcessed(lb)) continue;
        seenAria.add(lb);
        const result = ariaAdapter.scoreAriaListbox(lb);
        if (debugMode) {
          console.log("[burger] aria:", lb.id || lb.getAttribute("aria-label") || "(anon)", "→", result.kind, "score", result.score, result.reasons);
          debugOverlay.annotate(lb, result);
        }
        if (result.kind === "none") continue;
        if (!shouldActOn(result.kind)) continue;
        if (result.score < detector.ACT_THRESHOLD) continue;

        const r = ariaAdapter.reorderAriaListbox(lb, result);
        if (r.changed) modifiedAria.add(lb);
      } catch (e) {
        console.warn("[burger] aria scan threw on element:", lb, e);
      }
    }
  }

  // Annotate wrappers (Select2, Choices.js, Tom Select) in debug overlay so
  // we can confirm recognition. The native adapter already reordered the
  // backing <select>; the ARIA adapter handles the visible dropdown menus
  // these libraries render with role=listbox.
  const annotatedWrappers = new WeakSet();
  function scanWrapped() {
    if (!wrappedSelect || !debugMode) return;
    for (const { wrapper, backing, lib } of wrappedSelect.findWrappedSelects(document)) {
      if (annotatedWrappers.has(wrapper)) continue;
      annotatedWrappers.add(wrapper);
      // Use the native scoring of the backing select to label the wrapper.
      const result = detector.scoreSelector(backing);
      debugOverlay.annotate(wrapper, { kind: result.kind, score: result.score, reasons: [`wrapper:${lib.id}`, ...result.reasons] });
    }
  }

  function scanOnce() {
    if (!enabled || sensitiveUrl) return;
    if (debugMode) console.log("[burger] scanOnce starting (enabled=" + enabled + ", debugMode=" + debugMode + ")");
    const t0 = debugMode ? performance.now() : 0;
    scanNative();
    if (antdAdapter) {
      try { antdAdapter.synthesizeRoles(document); }
      catch (e) { console.warn("[burger] antdAdapter.synthesizeRoles failed:", e); }
    }
    scanAria();
    try { scanWrapped(); }
    catch (e) { console.warn("[burger] scanWrapped failed:", e); }
    // Perf channel: only emitted when debugMode is on. The e2e perf test
    // greps for this exact prefix to collect per-scan latency samples.
    if (debugMode) console.log("[burger-perf] scan-ms=" + (performance.now() - t0).toFixed(3));
  }

  function restoreAll() {
    for (const sel of modifiedNative) nativeSelect.restoreOriginalOrder(sel);
    modifiedNative.clear();
    for (const lb of modifiedAria) ariaAdapter.restoreAriaListbox(lb);
    modifiedAria.clear();
  }

  function siteKey() {
    if (location.protocol === "file:") return "file://";
    return location.hostname.toLowerCase();
  }

  async function refreshSettings() {
    enabled = await settings.isEnabledForHost(siteKey());
    kindsEnabled = await settings.getKindsEnabled();
    const all = await settings.loadAll();
    debugMode = !!all.debugMode;
    if (debugOverlay) debugOverlay.setEnabled(debugMode);
  }

  async function init() {
    await refreshSettings();
    const mgr = mutationManager.createManager(scanOnce);
    mgr.start();

    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== "local" || !changes.burgerizeSettings) return;
      await refreshSettings();
      if (enabled) {
        mgr.requestScan("settings-changed");
      } else {
        restoreAll();
      }
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "burgerize:get-state") {
      sendResponse({
        host: location.hostname,
        enabled,
        sensitiveUrl,
        modifiedCount: modifiedNative.size + modifiedAria.size
      });
      return false;
    }
    return false;
  });

  init();
})();
