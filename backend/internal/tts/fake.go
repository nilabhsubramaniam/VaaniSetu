package tts

import (
	"bytes"
	"context"
	"encoding/binary"
	"math"
)

const (
	sampleRate  = 16000
	toneHz      = 440.0
	toneSeconds = 0.3
	amplitude   = 0.2 // quiet — this is a placeholder tone, not real speech
)

// FakeTTSClient implements [TTSClient] with no network call and no model: a
// short, fixed sine tone, generated fresh per call but identical regardless
// of req.Text or req.Language. It exists so the rest of the backend (API)
// and the frontend's real audio-playback code can be built and tested
// before the Python `tts` capability exists — the same role
// [asr.FakeASRClient] plays for Phase 3 Milestone 3a, mirrored here for
// Phase 4 Milestone 4a.
//
// Unlike the fake ASR/LLM clients' canned text, there is no meaningful
// "canned audio per language" to return — a sine tone carries no language
// content — so every call produces the same tone regardless of input.
type FakeTTSClient struct{}

// NewFakeTTSClient returns a ready-to-use [FakeTTSClient]. It holds no
// state, so a zero-value FakeTTSClient{} works equally well; this
// constructor exists only so call sites read the same way regardless of
// which TTSClient implementation is being wired up.
func NewFakeTTSClient() *FakeTTSClient {
	return &FakeTTSClient{}
}

// Synthesize implements [TTSClient]. It never returns an error and never
// actually looks at req.Text or req.Language — the returned audio is a
// real, valid, playable WAV file (not opaque stub bytes), so the transport
// and browser-playback plumbing is genuinely exercised end to end.
func (c *FakeTTSClient) Synthesize(_ context.Context, _ SynthesizeRequest) (SynthesizeResponse, error) {
	return SynthesizeResponse{
		Audio:       generateToneWAV(),
		ContentType: "audio/wav",
	}, nil
}

// generateToneWAV builds a short, quiet 16-bit PCM mono WAV file containing
// one sine tone — enough to be audibly and programmatically verifiable as
// "real audio played back", without pretending to be synthesized speech.
func generateToneWAV() []byte {
	numSamples := int(sampleRate * toneSeconds)
	samples := make([]int16, numSamples)
	for i := range samples {
		t := float64(i) / sampleRate
		samples[i] = int16(amplitude * math.MaxInt16 * math.Sin(2*math.Pi*toneHz*t))
	}

	dataSize := numSamples * 2 // 16-bit = 2 bytes/sample, mono
	var buf bytes.Buffer

	buf.WriteString("RIFF")
	writeUint32(&buf, uint32(36+dataSize))
	buf.WriteString("WAVE")

	buf.WriteString("fmt ")
	writeUint32(&buf, 16) // PCM fmt chunk size
	writeUint16(&buf, 1)  // audio format: PCM
	writeUint16(&buf, 1)  // channels: mono
	writeUint32(&buf, sampleRate)
	writeUint32(&buf, sampleRate*2) // byte rate
	writeUint16(&buf, 2)            // block align
	writeUint16(&buf, 16)           // bits per sample

	buf.WriteString("data")
	writeUint32(&buf, uint32(dataSize))
	for _, s := range samples {
		writeInt16(&buf, s)
	}

	return buf.Bytes()
}

func writeUint32(buf *bytes.Buffer, v uint32) {
	var b [4]byte
	binary.LittleEndian.PutUint32(b[:], v)
	buf.Write(b[:])
}

func writeUint16(buf *bytes.Buffer, v uint16) {
	var b [2]byte
	binary.LittleEndian.PutUint16(b[:], v)
	buf.Write(b[:])
}

func writeInt16(buf *bytes.Buffer, v int16) {
	writeUint16(buf, uint16(v))
}
