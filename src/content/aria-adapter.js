// Adapter for ARIA combobox/listbox patterns. Reorders the DOM children of a
// listbox so the target option (United States / USD) sits just below any
// placeholder. We never click, never fire events, never touch hidden state.
//
// Rules of engagement:
//   - Only act when the listbox is open (visible + not hidden by aria-hidden).
//   - Skip virtualized lists (any option carries aria-posinset/aria-setsize).
//   - Skip filtered states: if a combobox input has non-empty text and uses
//     aria-autocomplete="list"|"both", we leave it alone — the user is
//     typing and the site is filtering for them.
//   - Reapply on re-render (frameworks rewrite the menu on every render).

const ARIA_PROCESSED_FLAG = "__burgerAriaProcessed";
const ARIA_ORDER_ATTR = "data-burger-original-aria-order";
const ARIA_ORDER_ELS = "__burgerAriaOrderEls";

function normalizeOption(el) {
  const { normalize } = window.__usFirst.usAliases;
  const label = (el.textContent || "").trim();
  // Pull a "value" from common attributes. Many libraries store it on
  // data-value. The element id is a last resort — but only if it *looks*
  // like an actual code, not a DOM identifier like "rs-AR" or
  // "react-select-2-option-15". Heuristic: trim a common library prefix
  // before the last hyphen.
  let value =
    el.getAttribute("data-value") ||
    el.getAttribute("data-option-value") ||
    el.getAttribute("data-key") ||
    "";
  if (!value && el.id) {
    // Take the last hyphen-segment of the id. "rs-AR" -> "AR";
    // "react-select-2-option-15-US" -> "US". If it looks like a 2-3
    // letter code, use it; otherwise discard.
    const last = el.id.split("-").pop();
    if (/^[A-Za-z]{2,3}$/.test(last)) value = last;
  }
  return {
    element: el,
    label,
    value,
    normalizedLabel: normalize(label),
    normalizedValue: normalize(value),
    isSelected: el.getAttribute("aria-selected") === "true",
    isDisabled: el.getAttribute("aria-disabled") === "true",
    isPlaceholder: false
  };
}

function parentOrHost(node) {
  if (!node) return null;
  if (node.parentElement) return node.parentElement;
  // Cross open shadow roots: ShadowRoot has no parentElement, but .host does.
  const root = typeof node.getRootNode === "function" ? node.getRootNode() : null;
  if (root && root !== node && root.host) return root.host;
  return null;
}

function isVisible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  // Walk self + ancestors (including shadow hosts). A listbox inside a
  // [hidden] / display:none popover must not count as open even when its own
  // computed style is still "visible".
  //
  // We deliberately do NOT reject on rect.width/height being 0 — absolutely
  // positioned listboxes (Headless UI, MUI portal, React Select) can briefly
  // measure 0x0 before their popper script lays them out, even though they're
  // logically "open". Computed display/visibility is a more reliable signal.
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.hidden) return false;
    if (node.getAttribute("aria-hidden") === "true") return false;
    const inline = node.style;
    if (inline && (inline.display === "none" || inline.visibility === "hidden")) return false;
    const view = node.ownerDocument && node.ownerDocument.defaultView;
    if (view) {
      const cs = view.getComputedStyle(node);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
    }
    if (node === node.ownerDocument.documentElement) break;
    node = parentOrHost(node);
  }
  return true;
}

function looksVirtualized(optionEls) {
  // Any windowed option is enough — some virtualizers only stamp
  // aria-posinset/setsize on options after the first paint chunk.
  for (let i = 0; i < optionEls.length; i++) {
    if (optionEls[i].hasAttribute("aria-posinset")) return true;
    if (optionEls[i].hasAttribute("aria-setsize")) return true;
  }
  return false;
}

function controlsOrOwns(el, id) {
  for (const attr of ["aria-controls", "aria-owns"]) {
    const raw = el.getAttribute(attr);
    if (!raw) continue;
    if (raw.split(/\s+/).includes(id)) return true;
  }
  return false;
}

// Some combobox patterns put the input *inside* the same wrapper as the
// listbox; others link them via aria-controls. Given a listbox, try to find
// the controlling combobox so we can read its attrs + check filter state.
// Search light + open shadow DOM — document.querySelector alone misses
// comboboxes inside shadow roots.
function findControllingCombobox(listbox) {
  if (!listbox.id) return null;
  const { queryAllDeep } = window.__usFirst.domWalk;
  const id = listbox.id;
  for (const el of queryAllDeep(listbox.ownerDocument, '[role="combobox"]')) {
    if (controlsOrOwns(el, id)) return el;
  }
  return null;
}

function isFilteringActive(combobox) {
  if (!combobox) return false;
  const ac = (combobox.getAttribute("aria-autocomplete") || "").toLowerCase();
  if (ac !== "list" && ac !== "both") return false;
  // Heuristic: the input has non-empty value. Works for <input role="combobox">
  // and also for div-based comboboxes that store the typed text in textContent.
  if ("value" in combobox && typeof combobox.value === "string") {
    return combobox.value.trim().length > 0;
  }
  return (combobox.textContent || "").trim().length > 0;
}

function buildBlob(listbox, combobox) {
  const { attrBlob } = window.__usFirst.detector;
  const parts = [attrBlob(listbox)];
  if (combobox) parts.push(attrBlob(combobox));
  // If the listbox lives inside a wrapped-select wrapper (Choices.js,
  // Select2, Tom Select), include the backing <select>'s attrs — that's
  // where the "country"/"currency" label usually lives.
  const wrappedSelect = window.__usFirst.wrappedSelect;
  if (wrappedSelect && wrappedSelect.findEnclosingWrapper) {
    const found = wrappedSelect.findEnclosingWrapper(listbox);
    if (found && found.backing) parts.push(attrBlob(found.backing));
  }
  return parts.filter(Boolean).join(" ").trim();
}

function getAutocomplete(combobox) {
  return combobox ? combobox.getAttribute("autocomplete") : null;
}

function isProcessed(listbox) {
  return !!listbox[ARIA_PROCESSED_FLAG];
}

function reorderAriaListbox(listbox, scoreResult) {
  const targetOption = scoreResult.targetOption;
  if (!targetOption) return { changed: false, reason: "no-target" };

  const targetEl = targetOption.element;
  const optionEls = scoreResult.options.map(o => o.element);

  // Decide insertion point: after a placeholder if the first option qualified.
  let insertIndex = 0;
  if (scoreResult.options[0] && scoreResult.options[0].isPlaceholder) insertIndex = 1;

  if (optionEls[insertIndex] === targetEl) {
    listbox[ARIA_PROCESSED_FLAG] = true;
    return { changed: false, reason: "already-on-top" };
  }

  // Save original order once. Prefer live element identity (handles duplicate
  // labels/ids); also keep a text snapshot as a best-effort fallback if nodes
  // are replaced before restore.
  if (!listbox[ARIA_ORDER_ELS]) {
    listbox[ARIA_ORDER_ELS] = optionEls.slice();
  }
  if (!listbox.getAttribute(ARIA_ORDER_ATTR)) {
    try {
      const snapshot = optionEls.map(o => ({
        i: o.id || "",
        t: (o.textContent || "").trim()
      }));
      listbox.setAttribute(ARIA_ORDER_ATTR, JSON.stringify(snapshot));
    } catch { /* huge list — skip attr rollback support */ }
  }

  // Move the target before the option at insertIndex (within the listbox's
  // *direct* options-parent — children can be nested in a group wrapper).
  const parent = targetEl.parentNode;
  const reference = parent === optionEls[insertIndex]?.parentNode
    ? optionEls[insertIndex]
    : null;
  if (parent && (reference || parent.firstChild)) {
    parent.insertBefore(targetEl, reference || parent.firstChild);
  }

  listbox[ARIA_PROCESSED_FLAG] = true;
  return { changed: true, reason: "reordered" };
}

function restoreAriaListbox(listbox) {
  const live = listbox[ARIA_ORDER_ELS];
  if (live && live.length) {
    for (const el of live) {
      if (el && el.parentNode) el.parentNode.appendChild(el);
    }
    listbox[ARIA_ORDER_ELS] = null;
    listbox.removeAttribute(ARIA_ORDER_ATTR);
    listbox[ARIA_PROCESSED_FLAG] = false;
    return true;
  }

  const raw = listbox.getAttribute(ARIA_ORDER_ATTR);
  if (!raw) return false;
  let snapshot;
  try { snapshot = JSON.parse(raw); } catch { return false; }
  // Fallback: re-collect by id|text (ambiguous when duplicates exist).
  const opts = Array.from(listbox.querySelectorAll('[role="option"]'));
  const byKey = new Map();
  for (const o of opts) {
    byKey.set(`${o.id || ""}|${(o.textContent || "").trim()}`, o);
  }
  for (const entry of snapshot) {
    const el = byKey.get(`${entry.i}|${entry.t}`);
    if (el && el.parentNode) el.parentNode.appendChild(el);
  }
  listbox.removeAttribute(ARIA_ORDER_ATTR);
  listbox[ARIA_PROCESSED_FLAG] = false;
  return true;
}

// Score a listbox by collecting its [role=option] children and asking the
// detector to classify. Returns the full score result or null if we should
// skip outright (filtering / virtualized / hidden).
function scoreAriaListbox(listbox, options) {
  const { scoreOptions } = window.__usFirst.detector;
  const combobox = findControllingCombobox(listbox);

  // Filter active? Bail — see option choice "Reorder only when no filter is active".
  if (isFilteringActive(combobox)) {
    return { kind: "none", score: 0, reasons: ["filter-active"], sensitive: false, targetOption: null, options };
  }

  const optionEls = Array.from(listbox.querySelectorAll('[role="option"]'));
  if (optionEls.length < 2) {
    return { kind: "none", score: 0, reasons: ["too-few-options"], sensitive: false, targetOption: null, options: [] };
  }
  if (looksVirtualized(optionEls)) {
    return { kind: "none", score: 0, reasons: ["virtualized"], sensitive: false, targetOption: null, options: [] };
  }

  const opts = optionEls.map(normalizeOption);
  const blob = buildBlob(listbox, combobox);
  const autocomplete = getAutocomplete(combobox);

  return scoreOptions({ blob, options: opts, autocomplete });
}

// Iterate all open listboxes (deep, including shadow DOM).
function findOpenListboxes(root) {
  const { queryAllDeep } = window.__usFirst.domWalk;
  const out = [];
  for (const lb of queryAllDeep(root || document, '[role="listbox"]')) {
    if (!isVisible(lb)) continue;
    out.push(lb);
  }
  return out;
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.ariaAdapter = {
  findOpenListboxes,
  scoreAriaListbox,
  reorderAriaListbox,
  restoreAriaListbox,
  isProcessed,
  ARIA_PROCESSED_FLAG,
  ARIA_ORDER_ATTR
};
