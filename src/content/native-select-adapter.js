// Reorder a native <select> so that the US option sits just below any
// placeholder. Never selects anything; never fires a change event. Stashes the
// original order on the element so it can be restored.

const PROCESSED_FLAG = "__usFirstProcessed";
const ORDER_ATTR = "data-usfirst-original-order";
const ORDER_ELS = "__usFirstOrderEls";

function reorderNativeSelect(select, scoreResult) {
  const targetOption = scoreResult.targetOption;
  if (!targetOption) return { changed: false, reason: "no-target-option" };

  // <optgroup>: select.options includes nested options, but insertBefore on
  // <select> requires a direct child. Moving across groups also ungroups.
  // Prefer skipping over corrupting the control (false-negative bias).
  if (select.querySelector("optgroup")) {
    return { changed: false, reason: "has-optgroup" };
  }

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

  // Save original order once. Prefer live element identity (handles duplicate
  // value|text keys); keep a JSON snapshot as fallback.
  if (!select[ORDER_ELS]) {
    select[ORDER_ELS] = optionEls.slice();
  }
  if (!select.getAttribute(ORDER_ATTR)) {
    const snapshot = optionEls.map(o => ({ v: o.value, t: o.textContent }));
    try {
      select.setAttribute(ORDER_ATTR, JSON.stringify(snapshot));
    } catch {
      // If serialization fails (huge list), skip attr rollback support rather
      // than refusing to reorder.
    }
  }

  // Preserve selected *elements* by identity. Matching by value is unsafe when
  // duplicate values exist — browsers can resolve single-select to the last
  // matching option.
  const selectedEls = Array.from(select.selectedOptions);

  const reference = select.options[insertionIndex] || null;
  select.insertBefore(targetEl, reference);

  if (selectedEls.length) {
    for (const o of select.options) o.selected = false;
    for (const o of selectedEls) o.selected = true;
  }

  select[PROCESSED_FLAG] = true;
  return { changed: true, reason: "reordered" };
}

function restoreOriginalOrder(select) {
  const live = select[ORDER_ELS];
  const selectedEls = Array.from(select.selectedOptions);

  if (live && live.length) {
    for (const el of live) {
      if (el && select.contains(el)) select.appendChild(el);
    }
    select[ORDER_ELS] = null;
  } else {
    const raw = select.getAttribute(ORDER_ATTR);
    if (!raw) return false;
    let snapshot;
    try { snapshot = JSON.parse(raw); } catch { return false; }
    const current = Array.from(select.options);
    const byKey = new Map();
    for (const o of current) byKey.set(`${o.value}|${o.textContent}`, o);
    for (const entry of snapshot) {
      const el = byKey.get(`${entry.v}|${entry.t}`);
      if (el) select.appendChild(el);
    }
  }

  if (selectedEls.length) {
    for (const o of select.options) o.selected = false;
    for (const o of selectedEls) o.selected = true;
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
