// A reasonably broad set of country names and ISO codes used to validate that a
// <select> is actually a country selector. We don't need to be exhaustive — we
// just need enough recognized entries that we can confidently say "this list of
// options is a list of countries" with low false-positive rate.

const COUNTRY_NAMES = new Set([
  "afghanistan", "albania", "algeria", "andorra", "angola", "argentina",
  "armenia", "australia", "austria", "azerbaijan", "bahamas", "bahrain",
  "bangladesh", "barbados", "belarus", "belgium", "belize", "benin", "bhutan",
  "bolivia", "bosnia", "bosnia and herzegovina", "botswana", "brazil", "brunei",
  "bulgaria", "burkina faso", "burundi", "cambodia", "cameroon", "canada",
  "cape verde", "chad", "chile", "china", "colombia", "comoros", "congo",
  "costa rica", "croatia", "cuba", "cyprus", "czech republic", "czechia",
  "denmark", "djibouti", "dominica", "dominican republic", "ecuador", "egypt",
  "el salvador", "equatorial guinea", "eritrea", "estonia", "ethiopia", "fiji",
  "finland", "france", "gabon", "gambia", "georgia", "germany", "ghana",
  "greece", "grenada", "guatemala", "guinea", "guyana", "haiti", "honduras",
  "hong kong", "hungary", "iceland", "india", "indonesia", "iran", "iraq",
  "ireland", "israel", "italy", "jamaica", "japan", "jordan", "kazakhstan",
  "kenya", "kuwait", "kyrgyzstan", "laos", "latvia", "lebanon", "lesotho",
  "liberia", "libya", "liechtenstein", "lithuania", "luxembourg", "madagascar",
  "malawi", "malaysia", "maldives", "mali", "malta", "mauritania", "mauritius",
  "mexico", "moldova", "monaco", "mongolia", "montenegro", "morocco",
  "mozambique", "myanmar", "namibia", "nepal", "netherlands", "new zealand",
  "nicaragua", "niger", "nigeria", "north korea", "norway", "oman", "pakistan",
  "palestine", "panama", "papua new guinea", "paraguay", "peru", "philippines",
  "poland", "portugal", "qatar", "romania", "russia", "rwanda", "samoa",
  "san marino", "saudi arabia", "senegal", "serbia", "seychelles", "sierra leone",
  "singapore", "slovakia", "slovenia", "somalia", "south africa", "south korea",
  "spain", "sri lanka", "sudan", "suriname", "sweden", "switzerland", "syria",
  "taiwan", "tajikistan", "tanzania", "thailand", "togo", "tonga", "tunisia",
  "turkey", "turkmenistan", "uganda", "ukraine", "united arab emirates",
  "united kingdom", "united states", "united states of america", "uruguay",
  "uzbekistan", "vanuatu", "venezuela", "vietnam", "yemen", "zambia", "zimbabwe"
]);

// ISO 3166-1 alpha-2 codes. Used to recognize selects whose option *values*
// (not labels) are country codes.
const ISO_ALPHA2 = new Set([
  "af","al","dz","ad","ao","ar","am","au","at","az","bs","bh","bd","bb","by",
  "be","bz","bj","bt","bo","ba","bw","br","bn","bg","bf","bi","kh","cm","ca",
  "cv","td","cl","cn","co","km","cg","cr","hr","cu","cy","cz","dk","dj","dm",
  "do","ec","eg","sv","gq","er","ee","et","fj","fi","fr","ga","gm","ge","de",
  "gh","gr","gd","gt","gn","gy","ht","hn","hk","hu","is","in","id","ir","iq",
  "ie","il","it","jm","jp","jo","kz","ke","kw","kg","la","lv","lb","ls","lr",
  "ly","li","lt","lu","mg","mw","my","mv","ml","mt","mr","mu","mx","md","mc",
  "mn","me","ma","mz","mm","na","np","nl","nz","ni","ne","ng","kp","no","om",
  "pk","ps","pa","pg","py","pe","ph","pl","pt","qa","ro","ru","rw","ws","sm",
  "sa","sn","rs","sc","sl","sg","sk","si","so","za","kr","es","lk","sd","sr",
  "se","ch","sy","tw","tj","tz","th","tg","to","tn","tr","tm","ug","ua","ae",
  "gb","us","uy","uz","vu","ve","vn","ye","zm","zw"
]);

function isRecognizedCountryLabel(normalizedLabel) {
  return COUNTRY_NAMES.has(normalizedLabel);
}

function isRecognizedCountryValue(normalizedValue) {
  if (!normalizedValue) return false;
  return ISO_ALPHA2.has(normalizedValue);
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.countries = {
  isRecognizedCountryLabel,
  isRecognizedCountryValue
};
