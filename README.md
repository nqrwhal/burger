# Burger 🍔

MV3 Chrome extension that moves **United States** to the top of country dropdowns and **USD** to the top of currency dropdowns. Reorder-only — it never auto-selects.

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on
3. Click **Load unpacked** → choose this folder
4. Open `tests/fixtures/index.html` to verify

## UI

- **Popup**: one toggle for the current site. Settings link opens the full options page.
- **Options**: master switch, country on/off, currency on/off, list of per-site disables you can clear.

Settings changes apply live — no tab reload required.

## What gets reordered

A `<select>` is reordered only if **all** of:
- Not on a sensitive URL (`/checkout`, `/payment`, `/billing`, `/bank`, `/tax`, `/visa`, etc. — country only)
- Looks like a country selector (autocomplete/label/name says "country", or many recognized country names) **or** a currency selector (label/name says "currency", and options contain multiple ISO 4217 codes)
- Contains a "United States" or "USD" option
- Doesn't look like a county, cloud region, state, language, timezone, or market field
- Doesn't look like a citizenship / nationality / tax-residency / country-of-birth / country-of-incorporation field

## Layout

```
manifest.json
src/
  service-worker.js
  shared/
    us-aliases.js       strong vs weak US label matching
    countries.js        country-name + ISO alpha-2 dictionaries
    currencies.js       USD label/value matching + ISO 4217 dictionary
    settings.js         chrome.storage wrapper
  content/
    detector.js         country + currency scoring
    native-select-adapter.js   reorder + rollback
    mutation-manager.js throttled MutationObserver
    index.js            wires everything; reacts to storage changes live
  popup/                quick toggle for the current site
  options/              full settings page
tests/fixtures/         hand-written positive + negative HTML pages
```
