package conversation

import "testing"

func TestDetectScript(t *testing.T) {
	tests := []struct {
		name string
		text string
		want string
	}{
		{"pure Hindi", "आज मौसम कैसा है", "Devanagari"},
		{"pure English", "What's the weather today?", "Latin"},
		{"romanized Hinglish", "kal ka weather kaisa rahega", "Latin"},
		{"mostly Hindi with an English word mixed in", "आज weather अच्छा है और साफ है", "Devanagari"},
		{"Bengali", "আজকের আবহাওয়া কেমন", "Bengali"},
		{"Gujarati", "આજનું હવામાન કેવું છે", "Gujarati"},
		{"Punjabi (Gurmukhi)", "ਅੱਜ ਦਾ ਮੌਸਮ ਕਿਵੇਂ ਹੈ", "Gurmukhi"},
		{"Tamil", "இன்று வானிலை எப்படி இருக்கிறது", "Tamil"},
		{"Telugu", "ఈరోజు వాతావరణం ఎలా ఉంది", "Telugu"},
		{"Kannada", "ಇಂದಿನ ಹವಾಮಾನ ಹೇಗಿದೆ", "Kannada"},
		{"Malayalam", "ഇന്നത്തെ കാലാവസ്ഥ എങ്ങനെയുണ്ട്", "Malayalam"},
		{"Odia (Oriya)", "ଆଜିର ପାଣିପାଗ କେମିତି", "Oriya"},
		{"empty string", "", "Latin"},
		{"punctuation and digits only", "12:30 PM!!", "Latin"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DetectScript(tt.text); got != tt.want {
				t.Errorf("DetectScript(%q) = %q, want %q", tt.text, got, tt.want)
			}
		})
	}
}
