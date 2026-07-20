// Decides whether a given <select> is a country selector OR a currency
// selector, and which option to move to the top. Heavily biased toward false
// negatives — we'd rather skip a real list than touch a county/region/state
// select by mistake.
//
// Returns { score, reasons, sensitive, targetOption, options, kind } where
// kind is "country" | "currency" | "none" and score is 0..100.

const ACT_THRESHOLD = 80;
const CANDIDATE_THRESHOLD = 60;

// Field-level sensitivity for country selectors: legal-meaning fields where
// the selected value IS the statement (citizenship, country of birth, tax
// residency). Reordering these is fine — we never change the selection — but
// we still skip them so the user is never even tempted to assume a default.
//
// We intentionally do NOT skip whole URLs. Government forms, visa applications,
// passport renewals, job-application country fields, etc. are the primary
// target use case: long, alphabetized country lists where scrolling past
// Afghanistan to find the United States is exactly the pain Burger exists to
// fix. The reorder-only guarantee (never change selected value, never click,
// never fire events) is what makes acting on these pages safe.
const SENSITIVE_COUNTRY_FIELD_RE = /\b(citizenship|nationality|residency|country\s*of\s*birth|country\s*of\s*incorporation|passport\s*issuing|tax\s*country|legal\s*country)\b/i;

// Strong negatives for *country* selectors. These regexes are only used when
// classifying as country; currency obviously isn't excluded by "currency".
const COUNTRY_NEG_COUNTY_RE = /\bcount(?:y|ies)\b/i;
const COUNTRY_NEG_CURRENCY_RE = /\b(currency|currencies|currencycode|fiat)\b/i;
const COUNTRY_NEG_REGION_RE = /\b(region|datacenter|data[-_]?center|availability\s*zone)\b/i;
const COUNTRY_NEG_STATE_RE = /\b(state|province|prefecture|territory)\b/i;
const COUNTRY_NEG_LANGUAGE_RE = /\b(language|locale|lang)\b/i;
const COUNTRY_NEG_TIMEZONE_RE = /\b(timezone|time[-_]?zone|tz)\b/i;
const COUNTRY_NEG_MARKET_RE = /\b(market|storefront)\b/i;

// Currency selector signals.
const CURRENCY_POS_RE = /\b(currency|currencies|currencycode|fiat)\b/i;

function attrBlob(el) {
  const parts = [
    el.name, el.id, el.className,
    el.getAttribute("autocomplete"),
    el.getAttribute("aria-label"),
    el.getAttribute("data-test"),
    el.getAttribute("data-testid"),
    el.getAttribute("placeholder"),
    el.getAttribute("title")
  ];
  // aria-labelledby: dereference the IDs and pull the referenced text. The
  // raw attribute value is meaningless (it's just IDs like "mui-label").
  // Prefer deep lookup so labels inside open shadow roots still resolve.
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const { getElementByIdDeep } = window.__usFirst.domWalk || {};
    for (const id of labelledBy.split(/\s+/)) {
      if (!id) continue;
      let ref = null;
      if (getElementByIdDeep) {
        const localRoot = typeof el.getRootNode === "function" ? el.getRootNode() : null;
        if (localRoot) ref = getElementByIdDeep(localRoot, id);
        if (!ref) ref = getElementByIdDeep(el.ownerDocument, id);
      } else {
        ref = el.ownerDocument.getElementById(id);
      }
      if (ref) parts.push(ref.textContent);
    }
  }
  if (el.id) {
    const lbl = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) parts.push(lbl.textContent);
  }
  const enclosing = el.closest && el.closest("label");
  if (enclosing) parts.push(enclosing.textContent);
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function extractOptions(select) {
  const { normalize } = window.__usFirst.usAliases;
  const opts = [];
  for (let i = 0; i < select.options.length; i++) {
    const o = select.options[i];
    opts.push({
      element: o,
      label: o.textContent || "",
      value: o.value,
      normalizedLabel: normalize(o.textContent || ""),
      normalizedValue: normalize(o.value || ""),
      index: i,
      isSelected: o.selected,
      isDisabled: o.disabled,
      isPlaceholder: false
    });
  }
  return opts;
}

function markPlaceholder(options, targetOption) {
  const first = options[0];
  if (!first) return;
  const txt = first.normalizedLabel;
  const looksLikePlaceholder =
    first.isDisabled ||
    first.value === "" ||
    /^(select|choose|please|--|country|currency|pick)/.test(txt);
  if (looksLikePlaceholder && first.element !== targetOption.element) {
    first.isPlaceholder = true;
  }
}

// --- Country scoring ------------------------------------------------------

function scoreAsCountry(blob, options, autocomplete) {
  const { isRecognizedCountryLabel, isRecognizedCountryValue } = window.__usFirst.countries;
  const { isUSOption } = window.__usFirst.usAliases;
  const reasons = [];
  let score = 0;
  let sensitive = false;

  if (SENSITIVE_COUNTRY_FIELD_RE.test(blob)) { sensitive = true; reasons.push("sensitive-field"); }

  // Hard negatives.
  if (COUNTRY_NEG_COUNTY_RE.test(blob) && !/country/i.test(blob))
    return { score: 0, reasons: ["looks-like-county"], sensitive: false };
  if (COUNTRY_NEG_CURRENCY_RE.test(blob))
    return { score: 0, reasons: ["looks-like-currency"], sensitive: false };
  if (COUNTRY_NEG_REGION_RE.test(blob) && !/country/i.test(blob))
    return { score: 0, reasons: ["looks-like-cloud-region"], sensitive: false };
  if (COUNTRY_NEG_LANGUAGE_RE.test(blob) && !/country/i.test(blob))
    return { score: 0, reasons: ["looks-like-language"], sensitive: false };
  if (COUNTRY_NEG_TIMEZONE_RE.test(blob))
    return { score: 0, reasons: ["looks-like-timezone"], sensitive: false };
  if (COUNTRY_NEG_STATE_RE.test(blob) && !/country/i.test(blob))
    return { score: 0, reasons: ["looks-like-state"], sensitive: false };
  if (COUNTRY_NEG_MARKET_RE.test(blob) && !/country/i.test(blob))
    return { score: 0, reasons: ["looks-like-market"], sensitive: false };

  const ac = (autocomplete || "").toLowerCase();
  if (ac === "country" || ac === "country-name") { score += 50; reasons.push("autocomplete-country"); }
  if (/\bcountry\b/i.test(blob)) { score += 30; reasons.push("attr-country"); }
  if (/country[-_]?code|countrycode/i.test(blob)) { score += 20; reasons.push("attr-country-code"); }

  let recognizedCount = 0;
  let isoValueCount = 0;
  for (const opt of options) {
    if (isRecognizedCountryLabel(opt.normalizedLabel)) recognizedCount++;
    if (isRecognizedCountryValue(opt.normalizedValue)) isoValueCount++;
  }
  if (recognizedCount >= 30) { score += 50; reasons.push("many-country-labels"); }
  else if (recognizedCount >= 10) { score += 35; reasons.push("some-country-labels"); }
  else if (recognizedCount >= 5) { score += 20; reasons.push("few-country-labels"); }

  if (isoValueCount >= 30) { score += 30; reasons.push("many-iso-values"); }
  else if (isoValueCount >= 10) { score += 20; reasons.push("some-iso-values"); }
  else if (isoValueCount >= 5) { score += 10; reasons.push("few-iso-values"); }

  // Plausible option count — country lists are commonly 15-300 options.
  if (options.length >= 15 && options.length <= 300) { score += 10; reasons.push("plausible-option-count"); }
  if (options.length < 5) return { score: 0, reasons: ["too-few-options"], sensitive };

  let targetOption = null;
  for (const opt of options) {
    if (isUSOption(opt.label, opt.value)) { targetOption = opt; break; }
  }
  if (!targetOption) return { score: 0, reasons: ["no-us-option"], sensitive };

  if (sensitive) score = Math.min(score, ACT_THRESHOLD - 1);

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    sensitive,
    targetOption
  };
}

// --- Currency scoring -----------------------------------------------------

function scoreAsCurrency(blob, options) {
  const { isRecognizedCurrencyLabel, isRecognizedCurrencyValue, isUSDOption } =
    window.__usFirst.currencies;
  const reasons = [];
  let score = 0;
  let sensitive = false;

  // We don't skip currency selectors on sensitive *URLs*. A checkout page is
  // exactly where moving USD up is most useful, and reordering doesn't change
  // the selected currency — same safety guarantee as country.
  //
  // Hard negative: a country field is sometimes labelled with currency hints
  // (e.g. "Country/Currency"), but if it scored as country we already handled
  // it; this branch only runs for fields that didn't.

  // Positive attribute signals.
  if (CURRENCY_POS_RE.test(blob)) { score += 50; reasons.push("attr-currency"); }

  // Option-level signals.
  let labelMatches = 0;
  let valueMatches = 0;
  for (const opt of options) {
    if (isRecognizedCurrencyValue(opt.normalizedValue)) valueMatches++;
    else if (isRecognizedCurrencyLabel(opt.normalizedLabel)) labelMatches++;
  }
  const total = labelMatches + valueMatches;

  if (valueMatches >= 5) { score += 45; reasons.push("many-iso-currency-values"); }
  else if (valueMatches >= 3) { score += 30; reasons.push("some-iso-currency-values"); }

  if (labelMatches >= 5) { score += 20; reasons.push("currency-code-labels"); }
  else if (labelMatches >= 3) { score += 10; reasons.push("few-currency-code-labels"); }

  // Require at least *some* corroboration on options. Attribute alone isn't
  // enough — could be a "currency name" text input or a misnamed field.
  if (total < 3) return { score: 0, reasons: ["not-enough-currency-options"], sensitive };
  if (options.length < 2) return { score: 0, reasons: ["too-few-options"], sensitive };

  let targetOption = null;
  for (const opt of options) {
    if (isUSDOption(opt.normalizedLabel, opt.normalizedValue)) {
      targetOption = opt;
      break;
    }
  }
  if (!targetOption) return { score: 0, reasons: ["no-usd-option"], sensitive };

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    sensitive,
    targetOption
  };
}

// --- Orchestrator ---------------------------------------------------------

// Score a set of normalized options. Used by both native <select> and ARIA
// listbox paths. `blob` is the attribute/label text, `autocomplete` is the
// HTML autocomplete attribute (if any — ARIA combobox inputs sometimes set it
// to "country" too).
function scoreOptions({ blob, options, autocomplete }) {
  // Try country first. If it's a high-confidence country selector we're done.
  const country = scoreAsCountry(blob, options, autocomplete);
  if (country.score >= ACT_THRESHOLD && country.targetOption) {
    markPlaceholder(options, country.targetOption);
    return {
      kind: "country",
      score: country.score,
      reasons: country.reasons,
      sensitive: country.sensitive,
      targetOption: country.targetOption,
      options
    };
  }

  // Otherwise try currency.
  const currency = scoreAsCurrency(blob, options);
  if (currency.score >= ACT_THRESHOLD && currency.targetOption) {
    markPlaceholder(options, currency.targetOption);
    return {
      kind: "currency",
      score: currency.score,
      reasons: currency.reasons,
      sensitive: currency.sensitive,
      targetOption: currency.targetOption,
      options
    };
  }

  const best = country.score >= currency.score ? country : currency;
  return {
    kind: "none",
    score: best.score,
    reasons: best.reasons,
    sensitive: best.sensitive,
    targetOption: null,
    options
  };
}

function scoreSelector(select) {
  return scoreOptions({
    blob: attrBlob(select),
    options: extractOptions(select),
    autocomplete: select.getAttribute("autocomplete")
  });
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.detector = {
  ACT_THRESHOLD,
  CANDIDATE_THRESHOLD,
  scoreSelector,
  scoreOptions,
  attrBlob
};
