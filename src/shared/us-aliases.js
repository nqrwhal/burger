// Aliases that *unambiguously* mean "United States". "US" and "U.S." are
// intentionally treated as weak matches that require corroborating context
// (see detector.js) because they collide with cloud regions, currencies,
// pronouns, etc.

// Localized "United States" labels. Each entry is the lowercase, normalize()'d
// form — see normalize() below for the rules (NFKD, diacritic strip, single
// spaces). We list both with and without diacritics for languages where users
// in long-tail government forms commonly omit them.
//
// Coverage is biased toward languages used on immigration/visa/job-app forms:
// Portuguese (Brazil + PT), Russian, Arabic, Hindi, Vietnamese, etc.
const STRONG_US_LABELS = [
  // English
  "united states",
  "united states of america",
  "usa",
  "u.s.a.",
  "u.s.a",
  // Spanish
  "estados unidos",
  "estados unidos de america",
  "estados unidos de américa",
  "ee.uu.",
  "ee. uu.",
  "eeuu",
  // Portuguese (BR + PT)
  "estados unidos da america",
  "estados unidos da américa",
  // French
  "etats-unis",
  "états-unis",
  "etats unis",
  "états unis",
  "etats-unis d'amerique",
  "états-unis d'amérique",
  // German
  "vereinigte staaten",
  "vereinigte staaten von amerika",
  // Italian
  "stati uniti",
  "stati uniti d'america",
  // Dutch
  "verenigde staten",
  "verenigde staten van amerika",
  // Polish
  "stany zjednoczone",
  "stany zjednoczone ameryki",
  // Czech / Slovak
  "spojene staty",
  "spojené státy",
  "spojené štáty americké",
  "spojene staty americke",
  // Hungarian
  "egyesult allamok",
  "egyesült államok",
  // Romanian
  "statele unite",
  "statele unite ale americii",
  // Greek
  "ηνωμενες πολιτειες",
  "ηνωμένες πολιτείες",
  "ηνωμένες πολιτείες αμερικής",
  // Swedish / Norwegian / Danish
  "forenta staterna",
  "amerikas forenta stater",
  "amerikas förenta stater",
  "usa amerikas forente stater",
  // Finnish
  "yhdysvallat",
  "amerikan yhdysvallat",
  // Russian
  "соединенные штаты",
  "соединённые штаты",
  "соединенные штаты америки",
  "соединённые штаты америки",
  "сша",
  // Ukrainian
  "сполучені штати",
  "сполучені штати америки",
  "сша",
  // Bulgarian
  "съединени щати",
  "съединените щати",
  "сащ",
  // Turkish
  "amerika birlesik devletleri",
  "amerika birleşik devletleri",
  "abd",
  // Hebrew
  "ארצות הברית",
  // Arabic
  "الولايات المتحدة",
  "الولايات المتحدة الأمريكية",
  // Persian / Farsi
  "ایالات متحده",
  "ایالات متحده آمریکا",
  // Hindi
  "संयुक्त राज्य",
  "संयुक्त राज्य अमेरिका",
  // Bengali
  "মার্কিন যুক্তরাষ্ট্র",
  // Indonesian / Malay
  "amerika serikat",
  "amerika syarikat",
  // Vietnamese — normalize() strips Vietnamese tone/vowel diacritics, so we
  // only need the ASCII form. (Hoa Kỳ → hoa ky, Hợp chúng quốc → hop chung quoc.)
  "hoa ky",
  "hop chung quoc hoa ky",
  // Thai
  "สหรัฐ",
  "สหรัฐอเมริกา",
  // Chinese
  "美国",
  "美國",
  "美利坚合众国",
  "美利堅合眾國",
  // Japanese
  "アメリカ合衆国",
  // Korean
  "미국",
  "미합중국"
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

// Gov forms commonly render labels like "United States (USA)", "United States
// of America (US)", or "🇺🇸 United States". For those we want a match even
// though the label isn't an *exact* alias. We require corroborating value
// context at the call site (see isUSOption) so this never fires on
// "Honduras (USA hotline) +1..." or similar.
function containsStrongUSAlias(label) {
  const n = normalize(label);
  if (!n) return false;
  for (const alias of STRONG_US_LABELS) {
    // Whole-token match: the alias appears with word/punctuation boundaries
    // around it. Indexed includes() would false-positive on e.g. "America"
    // appearing inside "Latin America". We sidestep that by checking that
    // characters around the match aren't letters/digits in the same script.
    const i = n.indexOf(alias);
    if (i === -1) continue;
    const before = i === 0 ? "" : n.charAt(i - 1);
    const after = n.charAt(i + alias.length) || "";
    const isWord = ch => /[\p{L}\p{N}]/u.test(ch);
    if (!isWord(before) && !isWord(after)) return true;
  }
  return false;
}

function isUSValue(value) {
  if (!value) return false;
  return US_VALUE_TOKENS.includes(normalize(value));
}

// An option "looks US" if either:
//   - its label is a strong alias outright, OR
//   - its value is a known US code AND the label is plausibly US (exact strong,
//     contains-strong, or weak alias).
// "US" alone (weak) needs the value to corroborate; "United States (USA)"
// (contains-strong) also needs the value to corroborate to avoid surprises in
// long noisy labels.
function isUSOption(label, value) {
  if (isStrongUSLabel(label)) return true;
  if (isUSValue(value)) {
    if (containsStrongUSAlias(label)) return true;
    if (isWeakUSLabel(label)) return true;
  }
  return false;
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.usAliases = {
  normalize,
  isStrongUSLabel,
  isWeakUSLabel,
  isUSValue,
  containsStrongUSAlias,
  isUSOption
};
