const STORAGE_KEY = "burgerizeSettings";
const DEFAULTS = {
  globalEnabled: true,
  countryEnabled: true,
  currencyEnabled: true,
  debugMode: false,
  disabledHosts: {}
};
const $ = id => document.getElementById(id);

async function load() {
  const stored = await chrome.storage.local.get([STORAGE_KEY]);
  return { ...DEFAULTS, ...(stored[STORAGE_KEY] || {}) };
}

async function save(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

function renderDisabledList(settings) {
  const list = $("disabled-list");
  const empty = $("empty");
  list.innerHTML = "";
  const hosts = Object.keys(settings.disabledHosts).sort();
  if (!hosts.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  for (const host of hosts) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = host;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      const s = await load();
      delete s.disabledHosts[host];
      await save(s);
      renderDisabledList(s);
    });
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function bindCheckbox(id, key) {
  const el = $(id);
  el.addEventListener("change", async () => {
    const s = await load();
    s[key] = el.checked;
    await save(s);
  });
}

async function init() {
  const ver = $("version");
  if (ver) {
    try { ver.textContent = "v" + chrome.runtime.getManifest().version; }
    catch { /* keep HTML fallback */ }
  }

  const s = await load();
  $("global").checked = s.globalEnabled;
  $("country").checked = s.countryEnabled;
  $("currency").checked = s.currencyEnabled;
  $("debug").checked = s.debugMode;
  renderDisabledList(s);

  bindCheckbox("global", "globalEnabled");
  bindCheckbox("country", "countryEnabled");
  bindCheckbox("currency", "currencyEnabled");
  bindCheckbox("debug", "debugMode");

  // If the user removes a host elsewhere (or the popup writes a change),
  // mirror it here without requiring a reload.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    const next = { ...DEFAULTS, ...(changes[STORAGE_KEY].newValue || {}) };
    $("global").checked = next.globalEnabled;
    $("country").checked = next.countryEnabled;
    $("currency").checked = next.currencyEnabled;
    $("debug").checked = next.debugMode;
    renderDisabledList(next);
  });
}

init();
