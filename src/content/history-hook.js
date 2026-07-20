// Page-world hook: history.pushState/replaceState do not fire popstate, and
// content scripts cannot patch the page's History object from the isolated
// world. This tiny script runs in the page and relays navigations.
(function () {
  if (window.__burgerHistoryHooked) return;
  window.__burgerHistoryHooked = true;
  function fire() {
    try { window.dispatchEvent(new CustomEvent("burgerize:navigate")); }
    catch { /* ignore */ }
  }
  for (const name of ["pushState", "replaceState"]) {
    const orig = history[name];
    if (typeof orig !== "function") continue;
    history[name] = function (...args) {
      const ret = orig.apply(this, args);
      fire();
      return ret;
    };
  }
})();
