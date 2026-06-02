// Cross-shadow DOM traversal helpers. Open shadow roots are reachable via
// element.shadowRoot; closed ones aren't and we silently skip them.
//
// All walkers are *lazy generators* so callers can early-bail and we don't pay
// for traversing entire subtrees we won't use.

function* deepDescendants(root) {
  // root may be Document, ShadowRoot, or Element.
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node.querySelectorAll !== "function") continue;
    const list = node.querySelectorAll("*");
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      yield el;
      const sr = el.shadowRoot; // null when closed or absent
      if (sr) stack.push(sr);
    }
  }
}

// Find every <select> in the document, including those inside open shadow
// roots. Returns an array (caller usually iterates more than once).
function queryAllSelectsDeep(root) {
  root = root || document;
  const out = [];
  // Fast path: light-DOM <select>s.
  if (typeof root.querySelectorAll === "function") {
    for (const sel of root.querySelectorAll("select")) out.push(sel);
  }
  // Shadow-DOM walk: only descend into elements that *have* a shadowRoot, so
  // we don't walk every node on huge pages just to find the rare web
  // component.
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node.querySelectorAll !== "function") continue;
    // We only care about shadow hosts here — light-DOM selects were already
    // captured above (for the document root) or will be by the caller for
    // nested shadow roots we descend into.
    const hosts = node.querySelectorAll("*");
    for (let i = 0; i < hosts.length; i++) {
      const sr = hosts[i].shadowRoot;
      if (!sr) continue;
      for (const sel of sr.querySelectorAll("select")) out.push(sel);
      stack.push(sr);
    }
  }
  return out;
}

// Find every element matching `selector` across light + open shadow DOM.
// Used by the ARIA adapter (role=combobox, role=listbox).
function queryAllDeep(root, selector) {
  root = root || document;
  const out = [];
  if (typeof root.querySelectorAll === "function") {
    for (const el of root.querySelectorAll(selector)) out.push(el);
  }
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node.querySelectorAll !== "function") continue;
    const hosts = node.querySelectorAll("*");
    for (let i = 0; i < hosts.length; i++) {
      const sr = hosts[i].shadowRoot;
      if (!sr) continue;
      for (const el of sr.querySelectorAll(selector)) out.push(el);
      stack.push(sr);
    }
  }
  return out;
}

// Resolve aria-controls / aria-labelledby etc across shadow boundaries. ID
// lookups in shadow DOM only work within the same root, so we walk roots
// looking for the id.
function getElementByIdDeep(root, id) {
  if (!id) return null;
  root = root || document;
  if (typeof root.getElementById === "function") {
    const el = root.getElementById(id);
    if (el) return el;
  }
  // Try shadow roots.
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node.querySelectorAll !== "function") continue;
    const hosts = node.querySelectorAll("*");
    for (let i = 0; i < hosts.length; i++) {
      const sr = hosts[i].shadowRoot;
      if (!sr) continue;
      const el = sr.getElementById ? sr.getElementById(id) : null;
      if (el) return el;
      stack.push(sr);
    }
  }
  return null;
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.domWalk = {
  deepDescendants,
  queryAllSelectsDeep,
  queryAllDeep,
  getElementByIdDeep
};
