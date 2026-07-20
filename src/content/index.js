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

  // Track which selectors we've already scored (one-shot) and which we've
  // actually modified (so "restore" can find them). modified* maps element →
  // kind so kind-toggle can restore without re-scoring a closed/empty menu.
  const seenNative = new WeakSet();
  const modifiedNative = new Map();
  const seenAria = new WeakSet();
  const modifiedAria = new Map();

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
          // Re-apply if we previously reordered (framework may rewrite options).
          // If we only saw it before (or restored after disable), re-score —
          // restore clears PROCESSED_FLAG but used to leave seenNative set,
          // which permanently skipped the control.
          if (nativeSelect.isProcessed(sel)) reapplyNativeIfNeeded(sel);
          else scoreAndMaybeReorderNative(sel);
          continue;
        }
        seenNative.add(sel);
        scoreAndMaybeReorderNative(sel);
      } catch (e) {
        console.warn("[burger] native scan threw on element:", sel, e);
      }
    }
  }

  function scoreAndMaybeReorderNative(sel) {
    const result = detector.scoreSelector(sel);
    if (debugMode) {
      console.log("[burger] native:", sel.name || sel.id || "(anon)", "→", result.kind, "score", result.score, result.reasons);
      debugOverlay.annotate(sel, result);
    }
    if (result.kind === "none") return;
    if (!shouldActOn(result.kind)) return;
    if (result.score < detector.ACT_THRESHOLD) return;

    const r = nativeSelect.reorderNativeSelect(sel, result);
    if (r.changed) modifiedNative.set(sel, result.kind);
  }

  function reapplyNativeIfNeeded(sel) {
    const result = detector.scoreSelector(sel);
    if (!shouldActOn(result.kind)) return;
    if (result.score >= detector.ACT_THRESHOLD && result.targetOption) {
      const r = nativeSelect.reorderNativeSelect(sel, result);
      if (r.changed) modifiedNative.set(sel, result.kind);
    }
  }

  function scanAria() {
    let listboxes;
    try { listboxes = ariaAdapter.findOpenListboxes(document); }
    catch (e) { console.warn("[burger] findOpenListboxes failed:", e); return; }
    if (debugMode) console.log("[burger] aria: found", listboxes.length, "open listbox(es)");
    for (const lb of listboxes) {
      try {
        // Reapply on re-render: frameworks often keep the listbox node and
        // replace its option children, which would otherwise leave us stuck
        // on the one-shot processed flag with the original order restored.
        if (ariaAdapter.isProcessed(lb)) {
          reapplyAriaIfNeeded(lb);
          continue;
        }
        seenAria.add(lb);
        scoreAndMaybeReorderAria(lb);
      } catch (e) {
        console.warn("[burger] aria scan threw on element:", lb, e);
      }
    }
  }

  function scoreAndMaybeReorderAria(lb) {
    const result = ariaAdapter.scoreAriaListbox(lb);
    if (debugMode) {
      console.log("[burger] aria:", lb.id || lb.getAttribute("aria-label") || "(anon)", "→", result.kind, "score", result.score, result.reasons);
      debugOverlay.annotate(lb, result);
    }
    if (result.kind === "none") return;
    if (!shouldActOn(result.kind)) return;
    if (result.score < detector.ACT_THRESHOLD) return;

    const r = ariaAdapter.reorderAriaListbox(lb, result);
    if (r.changed) modifiedAria.set(lb, result.kind);
  }

  function reapplyAriaIfNeeded(lb) {
    const result = ariaAdapter.scoreAriaListbox(lb);
    if (result.kind === "none") return;
    if (!shouldActOn(result.kind)) return;
    if (result.score < detector.ACT_THRESHOLD) return;
    const r = ariaAdapter.reorderAriaListbox(lb, result);
    if (r.changed) modifiedAria.set(lb, result.kind);
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
    if (!enabled) return;
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

  function forgetNative(sel) {
    modifiedNative.delete(sel);
    seenNative.delete(sel);
  }

  function forgetAria(lb) {
    modifiedAria.delete(lb);
    seenAria.delete(lb);
  }

  function restoreAll() {
    for (const sel of [...modifiedNative.keys()]) {
      nativeSelect.restoreOriginalOrder(sel);
      forgetNative(sel);
    }
    for (const lb of [...modifiedAria.keys()]) {
      ariaAdapter.restoreAriaListbox(lb);
      forgetAria(lb);
    }
    if (antdAdapter && antdAdapter.restoreSynthesizedRoles) {
      try { antdAdapter.restoreSynthesizedRoles(document); }
      catch (e) { console.warn("[burger] antdAdapter.restoreSynthesizedRoles failed:", e); }
    }
  }

  // When country/currency is toggled off, restore controls of that kind while
  // leaving the other kind alone.
  function restoreDisabledKinds() {
    for (const [sel, kind] of [...modifiedNative]) {
      try {
        if (!shouldActOn(kind)) {
          nativeSelect.restoreOriginalOrder(sel);
          forgetNative(sel);
        }
      } catch (e) {
        console.warn("[burger] restoreDisabledKinds native failed:", sel, e);
      }
    }
    for (const [lb, kind] of [...modifiedAria]) {
      try {
        if (!shouldActOn(kind)) {
          ariaAdapter.restoreAriaListbox(lb);
          forgetAria(lb);
        }
      } catch (e) {
        console.warn("[burger] restoreDisabledKinds aria failed:", lb, e);
      }
    }
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
        restoreDisabledKinds();
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
        modifiedCount: modifiedNative.size + modifiedAria.size
      });
      return false;
    }
    return false;
  });

  init();
})();
