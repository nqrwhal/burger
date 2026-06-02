# Burger — Privacy Policy

_Last updated: 2026-06-01_

## TL;DR

Burger does not collect, transmit, store on remote servers, or sell any data about you, the pages you visit, or the forms you interact with. Everything it does happens locally in your browser.

## What Burger sees

Burger is a Chrome extension that reorders the options inside `<select>` and ARIA listbox elements so that "United States" appears at the top of country dropdowns and "USD" appears at the top of currency dropdowns. To do that, it reads:

- The structure and attributes of dropdown elements on pages you load (option labels, values, `name`, `id`, ARIA roles, labels).
- The URL of the current page, but only to recognize sensitive contexts (checkout, payment, banking, tax, identity, etc.) where it deliberately does nothing.

This reading happens entirely inside your browser. No page content, form data, URL, or option text is sent anywhere.

## What Burger stores

Burger uses `chrome.storage.local` — your browser's own per-extension storage — to remember:

- Your master enable/disable preference.
- Whether country reordering is on.
- Whether currency reordering is on.
- Whether the developer debug overlay is on.
- A list of hostnames where you've toggled Burger off via the popup.

This data lives on your device. It is not synced, not transmitted, not sold, and not shared with any third party.

## What Burger does NOT do

- It does **not** auto-select any option. It only changes the visual order of options.
- It does **not** submit forms.
- It does **not** spoof your location, identity, citizenship, residency, or any other attribute.
- It does **not** modify pages on sensitive URLs (checkout, payment, billing, tax, banking, KYC, identity verification, etc.).
- It does **not** read or modify form values, only the option list of a dropdown.
- It does **not** load remote code. All scripts ship inside the extension package.
- It does **not** use analytics, telemetry, or crash reporting.
- It does **not** make network requests at all.

## Permissions

- `storage` — to remember your settings, locally.
- `<all_urls>` host access — so the content script can run on the pages where dropdowns live. The script reads dropdown structure only; it does not exfiltrate any page content.

## Contact

If you have questions about Burger's privacy practices, file an issue at the project's source repository.
