# Burger 🍔

MV3 Chrome extension that moves **United States** to the top of country dropdowns and **USD** to the top of currency dropdowns. Reorder-only — it never auto-selects.

Supports native `<select>`, ARIA listbox/combobox patterns (Radix, Headless UI, MUI Select, React Select, hand-rolled, etc.), libraries that wrap a native select (Select2, Choices.js, Tom Select), Ant Design (via synthetic ARIA roles), and elements inside open shadow DOM.

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on
3. Click **Load unpacked** → choose this folder
4. Open `tests/fixtures/index.html` to verify

## UI

- **Popup**: one toggle for the current site. Settings link opens the full options page.
- **Options**: master switch, country on/off, currency on/off, developer debug overlay, list of per-site disables you can clear.

Settings changes apply live — no tab reload required.

## What gets reordered

A dropdown is reordered only if **all** of:

- Looks like a country selector (autocomplete/label/name says "country", or many recognized country names) **or** a currency selector (label/name says "currency", and options contain multiple ISO 4217 codes)
- Contains a "United States" or "USD" option
- Doesn't look like a county, cloud region, US state, language, timezone, or market field
- Doesn't look like a citizenship / nationality / tax-residency / country-of-birth / country-of-incorporation field

For ARIA listboxes there are two additional rules:
- We only act when the listbox is **visible**.
- We skip **virtualized** lists (any option carries `aria-posinset` / `aria-setsize`).
- We skip **filtering** comboboxes (the user is typing; the site is already searching for them).

## Debug overlay

Turn on in Options → Developer. Every detected selector gets a colored outline and a small badge showing its `kind` (`country` / `currency` / `none`) and confidence score. Hover the badge to see the reasons.

## Layout

```
manifest.json
icons/                   16/32/48/128 PNG + SVG source
PRIVACY.md
STORE_LISTING.md         draft copy for the Chrome Web Store submission
src/
  service-worker.js
  shared/
    us-aliases.js        strong vs weak US label matching
    countries.js         country-name + ISO alpha-2 dictionaries
    currencies.js        USD label/value matching + ISO 4217 dictionary
    settings.js          chrome.storage wrapper
  content/
    dom-walk.js          shadow-DOM-aware traversal helpers
    detector.js          country + currency scoring (shared by native + ARIA)
    native-select-adapter.js  reorder + rollback for <select>
    aria-adapter.js      reorder + rollback for [role=listbox]
    wrapped-select-adapter.js  recognizes Select2 / Choices.js / Tom Select wrappers
    antd-adapter.js      synthesizes role=option on Ant Design dropdowns
    debug-overlay.js     dev-mode visual diagnostics
    mutation-manager.js  throttled MutationObserver (childList + aria-expanded)
    index.js             wires everything; reacts to storage changes live
  popup/                 quick toggle for the current site
  options/               full settings page
tests/fixtures/          hand-written positive + negative HTML pages
```
