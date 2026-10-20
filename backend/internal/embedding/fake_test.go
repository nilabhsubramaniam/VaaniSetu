package embedding

import (
	"context"
	"reflect"
	"testing"
)

func TestFakeEmbeddingClient_Embed_IsDeterministic(t *testing.T) {
	client := NewFakeEmbeddingClient()

	first, err := client.Embed(context.Background(), EmbedRequest{Text: "आज मौसम कैसा है?"})
	if err != nil {
		t.Fatalf("Embed() error = %v", err)
	}
	second, err := client.Embed(context.Background(), EmbedRequest{Text: "आज मौसम कैसा है?"})
	if err != nil {
		t.Fatalf("Embed() error = %v", err)
	}

	if !reflect.DeepEqual(first.Vector, second.Vector) {
		t.Errorf("Embed() not deterministic: %v != %v", first.Vector, second.Vector)
	}
}

func TestFakeEmbeddingClient_Embed_DifferentTextDiffersVector(t *testing.T) {
	client := NewFakeEmbeddingClient()

	a, err := client.Embed(context.Background(), EmbedRequest{Text: "hello"})
	if err != nil {
		t.Fatalf("Embed() error = %v", err)
	}
	b, err := client.Embed(context.Background(), EmbedRequest{Text: "goodbye"})
	if err != nil {
		t.Fatalf("Embed() error = %v", err)
	}

	if reflect.DeepEqual(a.Vector, b.Vector) {
		t.Error("Embed() returned identical vectors for different text")
	}
}

func TestFakeEmbeddingClient_Embed_DimensionsMatchVectorLength(t *testing.T) {
	client := NewFakeEmbeddingClient()

	resp, err := client.Embed(context.Background(), EmbedRequest{Text: "some text"})
	if err != nil {
		t.Fatalf("Embed() error = %v", err)
	}
	if resp.Dimensions != len(resp.Vector) {
		t.Errorf("Dimensions = %d, want len(Vector) = %d", resp.Dimensions, len(resp.Vector))
	}
}

func TestFakeEmbeddingClient_Embed_NeverErrors(t *testing.T) {
	client := NewFakeEmbeddingClient()

	_, err := client.Embed(context.Background(), EmbedRequest{})
	if err != nil {
		t.Errorf("Embed() error = %v, want nil", err)
	}
}
