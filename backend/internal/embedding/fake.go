package embedding

import (
	"context"
	"hash/fnv"
)

// fakeDimensions is arbitrary and deliberately small — this fake exists
// to prove the upload/persistence plumbing works, not to resemble any
// real embedding model's output. Milestone 7b's real model picks its own
// dimension, which will not match this one.
const fakeDimensions = 8

// FakeEmbeddingClient implements [EmbeddingClient] with no network call
// and no model: a deterministic vector derived from a hash of the input
// text, not a semantic embedding. Equal text always produces an equal
// vector; different text produces different vectors; nothing about the
// output reflects meaning or similarity, unlike a real embedding model.
type FakeEmbeddingClient struct{}

// NewFakeEmbeddingClient returns a ready-to-use [FakeEmbeddingClient]. It
// holds no state, so a zero-value FakeEmbeddingClient{} works equally
// well; this constructor exists only so call sites read the same way
// regardless of which EmbeddingClient implementation is being wired up.
func NewFakeEmbeddingClient() *FakeEmbeddingClient {
	return &FakeEmbeddingClient{}
}

// Embed implements [EmbeddingClient]. It never returns an error.
func (c *FakeEmbeddingClient) Embed(_ context.Context, req EmbedRequest) (EmbedResponse, error) {
	vector := make([]float32, fakeDimensions)
	for i := range vector {
		h := fnv.New32a()
		_, _ = h.Write([]byte(req.Text))
		_, _ = h.Write([]byte{byte(i)})
		// Spread the hash into a small, human-inspectable float range
		// rather than raw uint32 magnitudes — makes fake output legible
		// in test failures without claiming any real embedding scale.
		vector[i] = float32(h.Sum32()%2000)/1000 - 1 // roughly [-1, 1)
	}
	return EmbedResponse{Vector: vector, Dimensions: fakeDimensions}, nil
}
