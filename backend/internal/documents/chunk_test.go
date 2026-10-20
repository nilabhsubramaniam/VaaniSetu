package documents

import (
	"strings"
	"testing"
)

func TestSplitIntoChunks_EmptyContentProducesNoChunks(t *testing.T) {
	if chunks := SplitIntoChunks(""); chunks != nil {
		t.Fatalf("want nil, got %#v", chunks)
	}
}

func TestSplitIntoChunks_WhitespaceOnlyProducesNoChunks(t *testing.T) {
	if chunks := SplitIntoChunks("   \n\n   \n"); chunks != nil {
		t.Fatalf("want nil, got %#v", chunks)
	}
}

func TestSplitIntoChunks_ShortContentProducesExactlyOneChunk(t *testing.T) {
	content := "This is a short document about VaaniSetu."
	chunks := SplitIntoChunks(content)
	if len(chunks) != 1 {
		t.Fatalf("want 1 chunk, got %d: %#v", len(chunks), chunks)
	}
	if chunks[0] != content {
		t.Fatalf("want unchanged content, got %q", chunks[0])
	}
}

func TestSplitIntoChunks_LongContentProducesMultipleOverlappingChunks(t *testing.T) {
	paragraph := strings.Repeat("word ", 50) // ~250 chars, well under target alone
	content := strings.Join([]string{paragraph, paragraph, paragraph, paragraph, paragraph}, "\n\n")

	chunks := SplitIntoChunks(content)
	if len(chunks) < 2 {
		t.Fatalf("want multiple chunks for long content, got %d", len(chunks))
	}
	for _, c := range chunks {
		if len(c) > targetChunkChars+chunkOverlapChars {
			t.Errorf("chunk exceeds target+overlap size: %d chars", len(c))
		}
	}

	// Consecutive chunks should share some trailing/leading context.
	firstWords := strings.Fields(chunks[0])
	secondWords := strings.Fields(chunks[1])
	lastOfFirst := firstWords[len(firstWords)-1]
	if secondWords[0] != lastOfFirst {
		t.Errorf("want chunk 2 to start with overlap word %q, got %q", lastOfFirst, secondWords[0])
	}
}

func TestSplitIntoChunks_SingleParagraphLongerThanTargetSplitsOnWords(t *testing.T) {
	content := strings.Repeat("supercalifragilisticexpialidocious ", 40) // ~1400 chars, one paragraph
	chunks := SplitIntoChunks(content)
	if len(chunks) < 2 {
		t.Fatalf("want a single long paragraph to split into multiple chunks, got %d", len(chunks))
	}
	for _, c := range chunks {
		if strings.HasPrefix(c, " ") || strings.HasSuffix(c, " ") {
			t.Errorf("chunk should not have leading/trailing space: %q", c)
		}
	}
}

func TestSplitIntoChunks_ExactBoundarySizeStaysOneChunk(t *testing.T) {
	content := strings.Repeat("a", targetChunkChars)
	chunks := SplitIntoChunks(content)
	if len(chunks) != 1 {
		t.Fatalf("want exactly 1 chunk at the boundary size, got %d", len(chunks))
	}
}
