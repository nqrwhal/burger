// Reorder a native <select> so that the US option sits just below any
// placeholder. Never selects anything; never fires a change event. Stashes the
// original order on the element so it can be restored.

const PROCESSED_FLAG = "__usFirstProcessed";
const ORDER_ATTR = "data-usfirst-original-order";

function reorderNativeSelect(select, scoreResult) {
  const targetOption = scoreResult.targetOption;
  if (!targetOption) return { changed: false, reason: "no-target-option" };

  const optionEls = Array.from(select.options);
  const targetEl = targetOption.element;

  // Decide insertion point: after any placeholder at index 0.
  let insertionIndex = 0;
  const first = optionEls[0];
  if (first && scoreResult.options[0] && scoreResult.options[0].isPlaceholder) {
    insertionIndex = 1;
  }

  // If the target option is already at the insertion index, nothing to do.
  if (optionEls[insertionIndex] === targetEl) {
    select[PROCESSED_FLAG] = true;
    return { changed: false, reason: "already-on-top" };
  }

  // Save original order (by value, falling back to text) once. We avoid
  // storing element references because the DOM can re-render.
  if (!select.getAttribute(ORDER_ATTR)) {
    const snapshot = optionEls.map(o => ({ v: o.value, t: o.textContent }));
    try {
      select.setAttribute(ORDER_ATTR, JSON.stringify(snapshot));
    } catch {
      // If serialization fails (huge list), skip rollback support rather than
      // refusing to reorder.
    }
  }

  // Preserve the currently selected value(s). Reordering shouldn't change
  // selection, but we restore explicitly in case any browser quirk does.
  const selectedValues = Array.from(select.selectedOptions).map(o => o.value);

  const reference = select.options[insertionIndex] || null;
  select.insertBefore(targetEl, reference);

  // Restore selection. We compare by *value*, not by index — the whole point.
  if (selectedValues.length) {
    for (const o of select.options) {
      o.selected = selectedValues.includes(o.value);
    }
  }

  select[PROCESSED_FLAG] = true;
  return { changed: true, reason: "reordered" };
}

function restoreOriginalOrder(select) {
  const raw = select.getAttribute(ORDER_ATTR);
  if (!raw) return false;
  let snapshot;
  try { snapshot = JSON.parse(raw); } catch { return false; }
  // Build a map from (value|text) to current option element, then re-append
  // in the snapshot order. Anything not in the snapshot stays where it is.
  const current = Array.from(select.options);
  const byKey = new Map();
  for (const o of current) byKey.set(`${o.value}|${o.textContent}`, o);
  const selectedValues = Array.from(select.selectedOptions).map(o => o.value);
  for (const entry of snapshot) {
    const key = `${entry.v}|${entry.t}`;
    const el = byKey.get(key);
    if (el) select.appendChild(el);
  }
  for (const o of select.options) {
    o.selected = selectedValues.includes(o.value);
  }
  select.removeAttribute(ORDER_ATTR);
  select[PROCESSED_FLAG] = false;
  return true;
}

function isProcessed(select) {
  return !!select[PROCESSED_FLAG];
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.nativeSelect = {
  reorderNativeSelect,
  restoreOriginalOrder,
  isProcessed,
  PROCESSED_FLAG,
  ORDER_ATTR
};
