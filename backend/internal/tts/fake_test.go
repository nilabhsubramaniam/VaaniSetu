package tts

import (
	"bytes"
	"context"
	"encoding/binary"
	"testing"
)

func TestFakeTTSClient_Synthesize_ReturnsPlayableWAV(t *testing.T) {
	client := NewFakeTTSClient()

	resp, err := client.Synthesize(context.Background(), SynthesizeRequest{
		Text:     "नमस्ते",
		Language: "hi",
	})
	if err != nil {
		t.Fatalf("Synthesize() error = %v", err)
	}
	if resp.ContentType != "audio/wav" {
		t.Errorf("ContentType = %q, want %q", resp.ContentType, "audio/wav")
	}

	if len(resp.Audio) < 44 {
		t.Fatalf("Audio too short to contain a WAV header: %d bytes", len(resp.Audio))
	}
	if !bytes.Equal(resp.Audio[0:4], []byte("RIFF")) {
		t.Errorf("Audio does not start with RIFF header")
	}
	if !bytes.Equal(resp.Audio[8:12], []byte("WAVE")) {
		t.Errorf("Audio missing WAVE identifier")
	}
	if !bytes.Equal(resp.Audio[36:40], []byte("data")) {
		t.Errorf("Audio missing data chunk")
	}

	declaredSize := binary.LittleEndian.Uint32(resp.Audio[4:8])
	if int(declaredSize)+8 != len(resp.Audio) {
		t.Errorf("RIFF chunk size = %d, want %d (total length minus 8)", declaredSize, len(resp.Audio)-8)
	}
}

func TestFakeTTSClient_Synthesize_NeverErrors(t *testing.T) {
	client := NewFakeTTSClient()

	_, err := client.Synthesize(context.Background(), SynthesizeRequest{})
	if err != nil {
		t.Errorf("Synthesize() error = %v, want nil", err)
	}
}

func TestFakeTTSClient_Synthesize_IgnoresInputText(t *testing.T) {
	client := NewFakeTTSClient()

	respA, _ := client.Synthesize(context.Background(), SynthesizeRequest{Text: "hello", Language: "en"})
	respB, _ := client.Synthesize(context.Background(), SynthesizeRequest{Text: "completely different", Language: "hi"})

	if !bytes.Equal(respA.Audio, respB.Audio) {
		t.Errorf("expected identical fake tone audio regardless of input text/language")
	}
}
