# EVALUATION.md

How VaaniSetu will be evaluated.

This defines the **future** evaluation strategy. Do not implement evaluation
yet. The automated harness is built in Phase 9; individual phases (2, 3, 4, 7)
run lightweight, phase-scoped versions of the relevant checks to justify model
selection.

Targets below are **initial goals**, to be confirmed or revised against
measured baselines. Where a number is provisional it is marked *(provisional)*.

---

## 1. Principles

- **Measure before selecting.** No model is chosen for a capability until it is
  benchmarked on the target hardware (ADR-008).
- **Measure before fine-tuning.** A pretrained baseline is evaluated before any
  fine-tuning is considered (ADR-004).
- **Per language.** Metrics are tracked per language, not averaged into one
  number, so weak languages stay visible.
- **Track over time.** Results are stored so regressions across model-registry
  changes are caught.
- **Fixed evaluation sets.** Each metric has a held-out, versioned data set that
  does not change between runs without a note.

## 2. ASR (speech-to-text)

| Metric | Definition | Initial target |
|--------|------------|----------------|
| WER | Word error rate, per language | < 20% Hindi *(provisional)* |
| CER | Character error rate, per language | < 12% Hindi *(provisional)* |
| Language identification accuracy | Correct language / script tag from audio or transcript | > 90% *(provisional)* |
| Hinglish / code-switching accuracy | WER on utterances that switch Hindi<->English mid-sentence, including romanized Hindi | Within +10 pts of monolingual Hindi WER *(provisional)* |
| Robustness | WER delta under mild background noise | < +8 pts *(provisional)* |

Notes: evaluate romanized Hindi separately from Devanagari. Report a
Hinglish confusion matrix (Hindi vs. English vs. code-mixed).

## 3. LLM

| Metric | Definition | Initial target |
|--------|------------|----------------|
| Correctness | Task / answer accuracy on a curated Hindi + Hinglish question set | Baseline to be set, then improve |
| Instruction following | Follows explicit constraints (length, format, language) | > 90% *(provisional)* |
| Hallucination rate | Fraction of answers with unsupported factual claims (with RAG, unsupported by retrieved context) | < 10% *(provisional)* |
| Multilingual quality | Human-rated fluency / adequacy per language (1-5) | >= 3.5 *(provisional)* |
| Language fidelity | Answers in the user's turn language, not the retrieved passage's or a default | > 95% of turns *(provisional)* |
| Hinglish naturalness | Output reads as natural code-mixing, not translationese (human-rated) | >= 3.5 *(provisional)* |
| Response latency | Time to first token and total generation time, on target hardware | Time-to-first-token < 1.5s on the recommended tier *(provisional)* |

## 4. RAG

| Metric | Definition | Initial target |
|--------|------------|----------------|
| Retrieval recall@k | Fraction of queries whose gold passage is in the top-k retrieved | recall@4 > 0.8 *(provisional)* |
| Cross-lingual retrieval | recall@k when query and document languages differ | Within 10 pts of same-language recall *(provisional)* |
| Grounding / faithfulness | Fraction of answer claims supported by retrieved passages (LLM-judge + spot human check) | > 0.9 *(provisional)* |
| Answer correctness | Correct answers on a held-out document-QA set | Baseline to be set, then improve |
| Context efficiency | Passages used vs. retrieved; wasted context | Tracked, no hard target |

## 5. TTS

| Metric | Definition | Initial target |
|--------|------------|----------------|
| Intelligibility | Listener transcription accuracy of synthesized speech, or ASR-WER on synthesized audio as a proxy | proxy WER < 10% *(provisional)* |
| Pronunciation | Rate of correctly pronounced words, including named entities and English loanwords in Hinglish | > 95% *(provisional)* |
| Naturalness (MOS) | Mean opinion score, human 1-5, per language | > 3.5 *(provisional)* |
| Latency | Time to first audio chunk; real-time factor (synthesis time / audio duration) | RTF < 0.5 on the recommended tier *(provisional)* |

## 6. End-to-end voice

| Metric | Definition | Initial target |
|--------|------------|----------------|
| Response latency | End of user speech -> start of assistant audio (p50 / p95) | p50 < 3s non-streaming MVP; p50 < 1.5s streaming *(provisional)* |
| Interruption handling | Barge-in reliably stops playback and starts a new turn (Phase 11) | > 95% success *(provisional)* |
| Recognition accuracy | End-to-end transcript accuracy through the live pipeline (vs. offline ASR) | Within +5 pts WER of offline *(provisional)* |
| Task success | Fraction of scripted spoken tasks completed correctly, end to end | Baseline to be set, then improve |
| No-egress check | Zero external network calls from AI-service containers during a full turn | Pass / fail, must pass |

## 7. Hardware

Measured on each supported hardware tier (tiers defined in Phase 2 once the
developer's target machine is confirmed).

| Metric | Definition |
|--------|------------|
| CPU usage | Peak and mean CPU during a turn, per stage |
| RAM | Peak resident memory, per service and total |
| GPU / VRAM | Peak VRAM per model where a GPU is present |
| Model load time | Cold-start time to load and warm each model |
| Inference latency | Per-stage latency (VAD, ASR, LLM, TTS) at steady state |
| Throughput headroom | Concurrent turns before latency crosses target |

## 8. Reporting

- Each evaluation run produces a stored report: date, model-registry version,
  per-language metrics, hardware metrics, and pass / fail against targets.
- Model-selection decisions cite the report that justified them and are
  recorded as ADRs.
- Fine-tuned adapters (Phase 10) ship with a paired before / after report
  showing improvement on the target metric and no significant regression
  elsewhere.

## 9. What is not evaluated yet

Nothing here is implemented in Phase 0 or Phase 1. The first real measurements
are the phase-scoped model benchmarks in Phase 2 (LLM), Phase 3 (ASR), and
Phase 4 (TTS), plus Phase 5's real end-to-end response-latency measurement
(section 6's "Response latency" row) — see `docs/DECISIONS.md` ADR-024 for
the actual p50/p95 numbers and root-cause breakdown; **that target is
currently not met**. The automated, repeatable harness is Phase 9.
