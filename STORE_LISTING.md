# Chrome Web Store listing copy

Drafts of the text fields the Chrome Web Store form will ask for. Replace `<…>` placeholders before submitting.

## Item name (45 chars max)

```
Burger — US first
```

## Short description (132 chars max)

```
Moves United States to the top of country dropdowns and USD to the top of currency dropdowns. Never auto-selects. Reorder only.
```

## Detailed description

```
Burger puts United States and USD where you actually want them — at the top of the dropdown — without ever clicking for you.

If you live in the US, you've probably scrolled past Afghanistan, Argentina, and Australia a thousand times to pick your country. Burger fixes that for any well-marked country selector on the web. It also moves USD to the top of currency pickers.

What it does
• Detects country dropdowns (native <select> and ARIA combobox/listbox patterns)
• Detects currency dropdowns (ISO 4217 codes)
• Moves United States / USD just below the placeholder
• Preserves your selected value — the move is purely visual until you pick

What it never does
• It never auto-selects an option. You always pick.
• It never submits a form.
• It never touches fields whose label indicates a legally meaningful selection — citizenship, country of birth, country of incorporation, tax residency, passport issuing country. Those are skipped by design.
• It never sends data anywhere. No analytics, no telemetry, no network requests.

Safety first
Burger is deliberately conservative. It rejects look-alike fields — county lists, US state pickers, cloud regions like us-east-1, currency-named language pickers, etc. — using a confidence score. The reorder-only guarantee (we never click, never fire events, never change the selected value) is what makes the tool safe to run on government forms, visa applications, and other long country-list pages where it's most useful. If you don't want it on a particular site, one click in the popup disables it there permanently.

Source
Burger is open source. The full source ships with the extension; nothing is downloaded at runtime.
```

## Single-purpose description (for the new MV3 review checklist)

```
Burger has one purpose: reorder the options inside dropdown elements (native <select> and ARIA listbox) on web pages so that "United States" appears at the top of country selectors and "USD" appears at the top of currency selectors. It does not auto-select, submit forms, or modify any other page content.
```

## Permission justifications

### host_permissions: `<all_urls>`

```
Burger needs to run its content script on any page that may contain a country or currency dropdown. The script reads the option list of dropdowns to recognize them; it does not transmit page content anywhere, and does not modify any element other than the dropdown's option order. Fields whose label indicates a legally meaningful selection (citizenship, country of birth, tax residency, etc.) are recognized and skipped.
```

### permission: `storage`

```
Used to remember the user's preferences locally: master enable/disable, country on/off, currency on/off, debug overlay on/off, and the list of sites where the user has chosen to disable Burger. No data leaves the browser.
```

## Category

`Productivity` (primary)

## Privacy practices form

- Does your extension handle personally identifiable information? **No**
- Does your extension handle health information? **No**
- Does your extension handle financial / payment information? **No**
- Does your extension handle authentication information? **No**
- Does your extension handle personal communications? **No**
- Does your extension handle location? **No**
- Does your extension handle web history? **No**
- Does your extension handle user activity? **No**
- Does your extension handle website content? **Yes — but only the structure of dropdown elements, processed locally and not transmitted.**
- Sells or transfers user data? **No**
- Uses data for advertising? **No**
- Uses data for credit / loan eligibility? **No**

## Privacy policy URL

Host `PRIVACY.md` rendered to a public URL (e.g. GitHub Pages) and paste it here before submitting.
