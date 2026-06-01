// Aliases that *unambiguously* mean "United States". "US" and "U.S." are
// intentionally treated as weak matches that require corroborating context
// (see detector.js) because they collide with cloud regions, currencies,
// pronouns, etc.

const STRONG_US_LABELS = [
  "united states",
  "united states of america",
  "usa",
  "u.s.a.",
  "u.s.a",
  "estados unidos",
  "estados unidos de america",
  "estados unidos de américa",
  "etats-unis",
  "états-unis",
  "etats unis",
  "états unis",
  "vereinigte staaten",
  "vereinigte staaten von amerika",
  "stati uniti",
  "stati uniti d'america",
  "amerika birlesik devletleri",
  "amerika birleşik devletleri",
  "stany zjednoczone",
  "美国",
  "美國",
  "アメリカ合衆国",
  "미국"
];

const WEAK_US_LABELS = ["us", "u.s.", "u.s"];

const US_VALUE_TOKENS = ["us", "usa", "840"]; // ISO alpha-2, alpha-3, numeric

function normalize(str) {
  if (str == null) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isStrongUSLabel(label) {
  return STRONG_US_LABELS.includes(normalize(label));
}

function isWeakUSLabel(label) {
  return WEAK_US_LABELS.includes(normalize(label));
}

function isUSValue(value) {
  if (!value) return false;
  return US_VALUE_TOKENS.includes(normalize(value));
}

// An option "looks US" if either:
//   - its label is a strong alias, OR
//   - its value is a known US code AND its label is plausibly US (strong or weak)
// We never act on "US" alone unless it's paired with corroborating context at
// the *selector* level (see detector.scoreSelector).
function isUSOption(label, value) {
  if (isStrongUSLabel(label)) return true;
  if (isUSValue(value) && (isStrongUSLabel(label) || isWeakUSLabel(label))) return true;
  return false;
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.usAliases = {
  normalize,
  isStrongUSLabel,
  isWeakUSLabel,
  isUSValue,
  isUSOption
};
