// Optional dev overlay. When enabled, draws a dashed outline around each
// detected selector and shows a small badge with kind + score. Hovering the
// outline shows the reasons. Entirely off when debugMode is false; all
// state lives in element data-* attributes so toggling off cleans up.

const ATTR_DEBUG_ID = "data-burger-debug-id";
const STYLE_ID = "burger-debug-style";
let enabled = false;
let nextId = 1;
const annotated = new Map(); // debugId -> { el, badgeEl }

const STYLE = `
  [${ATTR_DEBUG_ID}] {
    outline: 2px dashed rgba(217, 119, 6, 0.7) !important;
    outline-offset: 2px;
  }
  [${ATTR_DEBUG_ID}][data-burger-kind="country"] { outline-color: rgba(22, 163, 74, 0.8) !important; }
  [${ATTR_DEBUG_ID}][data-burger-kind="currency"] { outline-color: rgba(37, 99, 235, 0.8) !important; }
  [${ATTR_DEBUG_ID}][data-burger-kind="none"] { outline-color: rgba(156, 163, 175, 0.6) !important; }

  .burger-debug-badge {
    position: absolute;
    z-index: 2147483647;
    background: rgba(17, 24, 39, 0.92);
    color: #fff;
    font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 2px 6px;
    border-radius: 4px;
    pointer-events: auto;
    cursor: default;
    user-select: none;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .burger-debug-badge[data-kind="country"] { background: #166534; }
  .burger-debug-badge[data-kind="currency"] { background: #1d4ed8; }
  .burger-debug-badge[data-kind="none"] { background: #4b5563; }
  .burger-debug-badge .reasons {
    display: none;
    margin-top: 4px;
    font-weight: normal;
  }
  .burger-debug-badge:hover .reasons { display: block; }
`;

function ensureStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = STYLE;
  (document.head || document.documentElement).appendChild(s);
}

function removeStylesheet() {
  const s = document.getElementById(STYLE_ID);
  if (s) s.remove();
}

function positionBadge(badge, el) {
  const rect = el.getBoundingClientRect();
  badge.style.top = (window.scrollY + rect.top - 18) + "px";
  badge.style.left = (window.scrollX + rect.left) + "px";
}

function annotate(el, result) {
  if (!enabled || !el || !result) return;
  ensureStylesheet();

  let id = el.getAttribute(ATTR_DEBUG_ID);
  let badge;
  if (id && annotated.has(id)) {
    badge = annotated.get(id).badgeEl;
  } else {
    id = String(nextId++);
    el.setAttribute(ATTR_DEBUG_ID, id);
    badge = document.createElement("div");
    badge.className = "burger-debug-badge";
    document.body && document.body.appendChild(badge);
    annotated.set(id, { el, badgeEl: badge });
  }

  el.setAttribute("data-burger-kind", result.kind);
  badge.setAttribute("data-kind", result.kind);
  badge.innerHTML =
    `<strong>${result.kind}</strong> score:${result.score}` +
    `<div class="reasons">${(result.reasons || []).join(", ") || "(no reasons)"}</div>`;
  positionBadge(badge, el);
}

function clearAll() {
  for (const { el, badgeEl } of annotated.values()) {
    el.removeAttribute(ATTR_DEBUG_ID);
    el.removeAttribute("data-burger-kind");
    badgeEl.remove();
  }
  annotated.clear();
  removeStylesheet();
}

function setEnabled(on) {
  if (enabled === !!on) return;
  enabled = !!on;
  if (!enabled) clearAll();
}

// Re-position badges on scroll/resize so they track their targets.
window.addEventListener("scroll", () => {
  if (!enabled) return;
  for (const { el, badgeEl } of annotated.values()) positionBadge(badgeEl, el);
}, { passive: true });
window.addEventListener("resize", () => {
  if (!enabled) return;
  for (const { el, badgeEl } of annotated.values()) positionBadge(badgeEl, el);
});

window.__usFirst = window.__usFirst || {};
window.__usFirst.debugOverlay = { annotate, setEnabled };
