// Content script entry. Wires the detector, native + ARIA adapters, mutation
// manager, and debug overlay together, and reacts to settings changes live.

(function () {
  const { detector, nativeSelect, ariaAdapter, wrappedSelect, antdAdapter, mutationManager, settings, domWalk, debugOverlay } = window.__usFirst;

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
    const selects = domWalk.queryAllSelectsDeep(document);
    for (const sel of selects) {
      if (seenNative.has(sel)) {
        if (nativeSelect.isProcessed(sel)) reapplyNativeIfNeeded(sel);
        continue;
      }
      seenNative.add(sel);
      const result = detector.scoreSelector(sel);
      if (debugMode) debugOverlay.annotate(sel, result);
      if (result.kind === "none") continue;
      if (!shouldActOn(result.kind)) continue;
      if (result.score < detector.ACT_THRESHOLD) continue;

      const r = nativeSelect.reorderNativeSelect(sel, result);
      if (r.changed) modifiedNative.add(sel);
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
    const listboxes = ariaAdapter.findOpenListboxes(document);
    for (const lb of listboxes) {
      // ARIA listboxes are often re-created on every open/close, so we
      // re-score every time we see one rather than caching on the element.
      // But we still avoid double-processing within the same open cycle via
      // the PROCESSED_FLAG on the element.
      if (ariaAdapter.isProcessed(lb)) continue;
      seenAria.add(lb);
      const result = ariaAdapter.scoreAriaListbox(lb);
      if (debugMode) debugOverlay.annotate(lb, result);
      if (result.kind === "none") continue;
      if (!shouldActOn(result.kind)) continue;
      if (result.score < detector.ACT_THRESHOLD) continue;

      const r = ariaAdapter.reorderAriaListbox(lb, result);
      if (r.changed) modifiedAria.add(lb);
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
    scanNative();
    // Synthesize ARIA roles on Ant Design dropdowns so the generic ARIA
    // adapter can handle them in the next step.
    if (antdAdapter) antdAdapter.synthesizeRoles(document);
    scanAria();
    scanWrapped();
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
