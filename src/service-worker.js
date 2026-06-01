// Minimal service worker. The extension does almost everything in the content
// script; the worker exists to satisfy MV3 and to handle the few cross-context
// messages we need (currently: per-site settings reads from the popup, which
// already hits chrome.storage directly, so this is a stub).

chrome.runtime.onInstalled.addListener(() => {
  // No-op. Defaults are read lazily in the content script.
});
