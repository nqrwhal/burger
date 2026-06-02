// Per-site + global settings backed by chrome.storage.local. Kept as a single
// JSON blob so adding fields doesn't require migration logic.

const DEFAULTS = {
  globalEnabled: true,
  countryEnabled: true,
  currencyEnabled: true,
  // When true, the content script outlines detected selectors and shows a
  // tooltip with score/kind/reasons on hover. Off by default.
  debugMode: false,
  // Hostnames where the user has explicitly disabled the extension. Object
  // (not array) so lookups are O(1) and toggles are idempotent.
  disabledHosts: {}
};

function hostKey(host) {
  return (host || "").toLowerCase();
}

async function loadAll() {
  const stored = await chrome.storage.local.get(["burgerizeSettings"]);
  const raw = { ...DEFAULTS, ...(stored.burgerizeSettings || {}) };
  // One-shot cleanup: older builds keyed file:// pages as "" (empty hostname).
  // Drop that stale key so it doesn't permanently disable every file:// page.
  if (raw.disabledHosts && raw.disabledHosts[""] != null) {
    delete raw.disabledHosts[""];
    try { await saveAll(raw); } catch {}
  }
  return raw;
}

async function saveAll(settings) {
  await chrome.storage.local.set({ burgerizeSettings: settings });
}

async function patch(partial) {
  const current = await loadAll();
  const next = { ...current, ...partial };
  await saveAll(next);
  return next;
}

async function isEnabledForHost(host) {
  const s = await loadAll();
  if (!s.globalEnabled) return false;
  return !s.disabledHosts[hostKey(host)];
}

async function setHostEnabled(host, enabled) {
  const s = await loadAll();
  const key = hostKey(host);
  if (enabled) {
    delete s.disabledHosts[key];
  } else {
    s.disabledHosts[key] = true;
  }
  await saveAll(s);
}

// Convenience getters used by the content script.
async function getKindsEnabled() {
  const s = await loadAll();
  return { country: s.countryEnabled, currency: s.currencyEnabled };
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.settings = {
  loadAll,
  saveAll,
  patch,
  isEnabledForHost,
  setHostEnabled,
  getKindsEnabled
};
