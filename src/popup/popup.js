// Popup wiring. Reads chrome.storage directly so the toggle is responsive
// even on pages where the content script hasn't finished loading.

const $ = id => document.getElementById(id);

const STORAGE_KEY = "burgerizeSettings";
const DEFAULTS = {
  globalEnabled: true,
  countryEnabled: true,
  currencyEnabled: true,
  disabledHosts: {}
};

async function loadSettings() {
  const stored = await chrome.storage.local.get([STORAGE_KEY]);
  return { ...DEFAULTS, ...(stored[STORAGE_KEY] || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Returns a key we'll use in disabledHosts. For http(s) pages it's the
// hostname. For file:// it's a synthetic "file://" key so the toggle is
// meaningful on local fixtures. Returns null only for chrome://, about:, etc.
function siteKeyFromUrl(urlStr) {
  if (!urlStr) return null;
  try {
    const u = new URL(urlStr);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.hostname.toLowerCase();
    }
    if (u.protocol === "file:") return "file://";
    return null;
  } catch {
    return null;
  }
}

function showBanner(text, kind) {
  const el = $("banner");
  el.hidden = false;
  el.textContent = text;
  el.className = "banner" + (kind ? " " + kind : "");
}

function hideBanner() {
  $("banner").hidden = true;
}

function effectiveEnabled(settings, host) {
  if (!settings.globalEnabled) return false;
  if (!host) return false;
  return !settings.disabledHosts[host];
}

function updateLabels(settings, host) {
  const enabled = effectiveEnabled(settings, host);
  $("toggle-title").textContent = enabled ? "Enabled on this site" : "Disabled on this site";

  const parts = [];
  if (settings.countryEnabled) parts.push("United States");
  if (settings.currencyEnabled) parts.push("USD");
  $("toggle-subtitle").textContent = parts.length
    ? parts.join(" and ") + " will be moved to top"
    : "Both country and currency reordering are off in Settings";

  if (!settings.globalEnabled) {
    showBanner("Globally disabled. Re-enable in Settings.", "warn");
  } else if (!settings.countryEnabled && !settings.currencyEnabled) {
    showBanner("Nothing to reorder — enable Country or Currency in Settings.", "warn");
  } else {
    hideBanner();
  }
}

async function init() {
  const tab = await activeTab();
  const host = tab ? siteKeyFromUrl(tab.url) : null;
  const settings = await loadSettings();

  $("host").textContent = host || "(not a regular page)";

  const t = $("site-toggle");

  if (!host) {
    t.disabled = true;
    $("toggle-title").textContent = "Not available here";
    $("toggle-subtitle").textContent = "Burger only runs on http, https, and file pages.";
    wireSettingsLink();
    return;
  }

  t.checked = effectiveEnabled(settings, host);
  updateLabels(settings, host);

  async function applyToggle(checked) {
    const s = await loadSettings();
    if (checked) {
      delete s.disabledHosts[host];
      // If global is off, flipping the per-site toggle on otherwise does
      // nothing — auto-enable global so behavior matches expectation.
      if (!s.globalEnabled) s.globalEnabled = true;
    } else {
      s.disabledHosts[host] = true;
    }
    await saveSettings(s);
    updateLabels(s, host);
  }

  t.addEventListener("change", () => applyToggle(t.checked));

  // React to changes from the options page or other popup instances.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    const s = { ...DEFAULTS, ...(changes[STORAGE_KEY].newValue || {}) };
    t.checked = effectiveEnabled(s, host);
    updateLabels(s, host);
  });

  wireSettingsLink();
}

function wireSettingsLink() {
  $("open-settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

init().catch(err => {
  console.error("[Burger popup] init failed:", err);
  $("toggle-title").textContent = "Popup error";
  $("toggle-subtitle").textContent = String(err && err.message || err);
});
