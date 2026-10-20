package documents

import "strings"

// targetChunkChars and chunkOverlapChars are deliberately simple, fixed
// constants rather than a configurable/tunable parameter — this project
// selects models and their parameters by measurement (ADR-008), and no
// retrieval pipeline exists yet (Milestone 7d) to measure chunk-size
// quality against. These are a reasonable starting point (a few
// paragraphs per chunk), not a tuned value; revisit once 7d's retrieval
// evaluation gives real evidence either way.
const (
	targetChunkChars  = 700
	chunkOverlapChars = 100
)

// SplitIntoChunks splits content into passages small enough to embed and
// retrieve individually. It is plain text-splitting, not inference
// (docs/ARCHITECTURE.md §3.3 reserves inference for Python) — this stays
// in Go, in the same background job that calls the embedding capability
// once per chunk (see worker.go).
//
// Splits on paragraph boundaries first (blank lines), then falls back to
// word boundaries for any paragraph longer than targetChunkChars, so a
// chunk never breaks in the middle of a word. Consecutive chunks overlap
// by roughly chunkOverlapChars so a passage split across a chunk
// boundary is still findable from either side. Content that already fits
// in one chunk produces exactly one result. Empty or whitespace-only
// content produces no chunks.
func SplitIntoChunks(content string) []string {
	paragraphs := splitParagraphs(content)
	if len(paragraphs) == 0 {
		return nil
	}

	var chunks []string
	var current strings.Builder

	flush := func() {
		if current.Len() == 0 {
			return
		}
		chunks = append(chunks, strings.TrimSpace(current.String()))
	}

	for _, paragraph := range paragraphs {
		for _, piece := range splitLongParagraph(paragraph) {
			if current.Len() > 0 && current.Len()+len(piece) > targetChunkChars {
				flush()
				current.Reset()
				current.WriteString(overlapTail(chunks[len(chunks)-1]))
			}
			if current.Len() > 0 {
				current.WriteString("\n\n")
			}
			current.WriteString(piece)
		}
	}
	flush()

	return chunks
}

// splitParagraphs splits on one-or-more blank lines, trimming and
// dropping any resulting empty paragraphs.
func splitParagraphs(content string) []string {
	rawParagraphs := strings.Split(content, "\n\n")
	paragraphs := make([]string, 0, len(rawParagraphs))
	for _, p := range rawParagraphs {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			paragraphs = append(paragraphs, trimmed)
		}
	}
	return paragraphs
}

// splitLongParagraph returns paragraph unchanged if it already fits
// within targetChunkChars; otherwise it splits it on word boundaries
// into pieces that do.
func splitLongParagraph(paragraph string) []string {
	if len(paragraph) <= targetChunkChars {
		return []string{paragraph}
	}

	words := strings.Fields(paragraph)
	var pieces []string
	var current strings.Builder
	for _, word := range words {
		if current.Len() > 0 && current.Len()+1+len(word) > targetChunkChars {
			pieces = append(pieces, current.String())
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteByte(' ')
		}
		current.WriteString(word)
	}
	if current.Len() > 0 {
		pieces = append(pieces, current.String())
	}
	return pieces
}

// overlapTail returns the last chunkOverlapChars of prev, on a word
// boundary, so the next chunk starts with a little of the previous
// chunk's context rather than a hard cut.
func overlapTail(prev string) string {
	if len(prev) <= chunkOverlapChars {
		return ""
	}
	tail := prev[len(prev)-chunkOverlapChars:]
	if idx := strings.IndexByte(tail, ' '); idx >= 0 {
		tail = tail[idx+1:]
	}
	return tail
}
