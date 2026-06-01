// ISO 4217 currency codes used to recognize currency selectors. We don't need
// every entry — just enough to confidently say "this list is a list of
// currencies." Symbol-only labels ($, €, £) are too ambiguous to recognize on
// their own, but the *code* portion is reliable.

const ISO_4217 = new Set([
  "usd","eur","gbp","jpy","cny","cad","aud","nzd","chf","sek","nok","dkk",
  "pln","czk","huf","ron","bgn","try","rub","uah","inr","pkr","bdt","lkr",
  "krw","twd","hkd","sgd","myr","thb","idr","php","vnd","mxn","brl","ars",
  "clp","cop","pen","uyu","zar","ngn","kes","egp","mad","tnd","aed","sar",
  "qar","kwd","bhd","omr","jod","ils","ghs","etb","tzs","ugx","xaf","xof",
  "isk","rsd","mkd","bam","all","amd","azn","gel","kzt","uzs","mnt","npr",
  "lak","khr","mmk","afn","irr","iqd","syp","lbp","yer","sdg","lyd","dzd"
]);

// Strong labels that unambiguously mean "US Dollar".
const STRONG_USD_LABELS = [
  "us dollar",
  "u.s. dollar",
  "united states dollar",
  "us dollars",
  "u.s. dollars",
  "american dollar",
  "dolar estadounidense",
  "dólar estadounidense",
  "dollar americain",
  "dollar américain",
  "us-dollar"
];

const WEAK_USD_LABELS = ["dollar", "dollars", "$"];

const USD_VALUE_TOKENS = ["usd", "840"]; // ISO 4217 alpha + numeric

function isStrongUSDLabel(normalizedLabel) {
  return STRONG_USD_LABELS.includes(normalizedLabel);
}

function isUSDValue(normalizedValue) {
  if (!normalizedValue) return false;
  return USD_VALUE_TOKENS.includes(normalizedValue);
}

// USD is the target option when:
//   - the value is "USD" / "840", OR
//   - the label is unambiguously a US Dollar reference, OR
//   - the label contains "usd" as a code (e.g. "USD - US Dollar"), AND we're
//     in a currency selector (caller has already established that).
function isUSDOption(normalizedLabel, normalizedValue) {
  if (isUSDValue(normalizedValue)) return true;
  if (isStrongUSDLabel(normalizedLabel)) return true;
  if (/\busd\b/.test(normalizedLabel)) return true;
  return false;
}

function isRecognizedCurrencyValue(normalizedValue) {
  if (!normalizedValue) return false;
  return ISO_4217.has(normalizedValue);
}

function isRecognizedCurrencyLabel(normalizedLabel) {
  if (!normalizedLabel) return false;
  // Currency labels often look like "USD - US Dollar" or "EUR (Euro)". Look
  // for any 3-letter ISO code token in the label.
  const tokens = normalizedLabel.split(/[\s\-()\/.,;:]+/);
  for (const t of tokens) {
    if (t.length === 3 && ISO_4217.has(t)) return true;
  }
  return false;
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.currencies = {
  isStrongUSDLabel,
  isUSDValue,
  isUSDOption,
  isRecognizedCurrencyValue,
  isRecognizedCurrencyLabel
};
