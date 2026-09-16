package conversation

import "unicode"

// scriptTables lists every script this project currently tags. Checked in
// this fixed order so a tie between two scripts' character counts always
// resolves the same way; that only matters for pathological input since
// real single-language text has one script overwhelmingly dominant.
var scriptTables = []struct {
	name  string
	table *unicode.RangeTable
}{
	{"Devanagari", unicode.Devanagari},
	{"Bengali", unicode.Bengali},
	{"Gujarati", unicode.Gujarati},
	{"Gurmukhi", unicode.Gurmukhi},
	{"Tamil", unicode.Tamil},
	{"Telugu", unicode.Telugu},
	{"Kannada", unicode.Kannada},
	{"Malayalam", unicode.Malayalam},
	{"Oriya", unicode.Oriya},
	{"Latin", unicode.Latin},
}

// DetectScript reports which script's characters are most frequent in
// text. This is the "script tag" docs/ROADMAP.md Phase 3 asks every turn
// to carry — a mechanical, deterministic classification by Unicode range,
// never a language-identification model. Full language ID stays Phase 6's
// job (docs/ARCHITECTURE.md), which is a materially harder problem
// (romanized Hindi and English are both Latin script but different
// languages; this function can't and doesn't try to tell them apart).
//
// Falls back to "Latin" for text with no recognized letters at all (an
// empty string, or digits/punctuation only), since Hinglish's romanized
// text is itself Latin script and that's the common case for
// letter-less input.
func DetectScript(text string) string {
	counts := make(map[string]int, len(scriptTables))
	for _, r := range text {
		for _, st := range scriptTables {
			if unicode.In(r, st.table) {
				counts[st.name]++
				break
			}
		}
	}

	best, bestCount := "Latin", 0
	for _, st := range scriptTables {
		if c := counts[st.name]; c > bestCount {
			best, bestCount = st.name, c
		}
	}
	return best
}
