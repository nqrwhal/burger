// Recognizer for libraries that wrap a native <select> (Select2, Choices.js,
// Tom Select).
//
// We deliberately do NOT call into the library's API to force a re-render.
// Doing so would destroy the page's library configuration (callbacks, ajax
// data, templating, placeholder text, etc.) — an unacceptable regression for
// a "reorder-only" extension.
//
// Instead:
//
//   - The native-select adapter reorders the backing <select>. That makes the
//     option order correct for keyboard / screen-reader users immediately, and
//     for any future re-init the page itself performs.
//   - The ARIA adapter handles the *visible* dropdown when the user opens it,
//     because all three libraries render their dropdowns with role=listbox /
//     role=option (Select2: .select2-results__options; Choices.js:
//     .choices__list--dropdown; Tom Select: .ts-dropdown). The ARIA adapter
//     finds them generically.
//
// This module's only remaining job is *recognition*: tell debugOverlay and
// the popup that a wrapper exists, so the user can see we know about it.

const WRAPPER_SELECTORS = ".select2-container, .choices, .ts-wrapper";

const LIBRARIES = {
  "select2-container": {
    id: "select2",
    findBackingSelect(wrapper) {
      // Select2 places its container as a sibling of the original <select>.
      let n = wrapper.previousElementSibling;
      while (n) {
        if (n.tagName === "SELECT") return n;
        n = n.previousElementSibling;
      }
      return null;
    }
  },
  "choices": {
    id: "choices",
    findBackingSelect(wrapper) {
      // Choices.js keeps the original <select> inside the wrapper.
      return wrapper.querySelector("select");
    }
  },
  "ts-wrapper": {
    id: "tom-select",
    findBackingSelect(wrapper) {
      let n = wrapper.previousElementSibling;
      while (n) {
        if (n.tagName === "SELECT") return n;
        n = n.previousElementSibling;
      }
      return null;
    }
  }
};

function libraryFor(el) {
  if (!el.classList) return null;
  for (const cls in LIBRARIES) {
    if (el.classList.contains(cls)) return LIBRARIES[cls];
  }
  return null;
}

function findWrappedSelects(root) {
  const { queryAllDeep } = window.__usFirst.domWalk;
  const out = [];
  for (const wrapper of queryAllDeep(root || document, WRAPPER_SELECTORS)) {
    const lib = libraryFor(wrapper);
    if (!lib) continue;
    const backing = lib.findBackingSelect(wrapper);
    if (!backing) continue;
    out.push({ wrapper, backing, lib });
  }
  return out;
}

// Public lookup: given any element, walk up looking for a wrapper class. If
// found, return { wrapper, backing, lib }. Used by aria-adapter to pull
// "country"/"currency" labels out of the backing <select> when scoring an
// open dropdown.
function findEnclosingWrapper(el) {
  if (!el || !el.closest) return null;
  const wrapper = el.closest(WRAPPER_SELECTORS);
  if (!wrapper) return null;
  const lib = libraryFor(wrapper);
  if (!lib) return null;
  const backing = lib.findBackingSelect(wrapper);
  if (!backing) return null;
  return { wrapper, backing, lib };
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.wrappedSelect = { findWrappedSelects, findEnclosingWrapper, LIBRARIES };
