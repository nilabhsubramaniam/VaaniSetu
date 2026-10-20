"""An [LLMEngine] backed by `llama-cpp-python` (llama.cpp's Python
binding). Loads a local GGUF file — no network call at generation time,
consistent with ADR-001 (the voice loop must not require network egress).

llama.cpp was chosen over an Apple-Silicon-only engine (e.g. MLX) because
it runs inside a plain Linux container — the actual `docker compose up`
deployment target (docs/ARCHITECTURE.md §6) — as well as natively on this
development machine. See docs/DECISIONS.md ADR-015.
"""

from __future__ import annotations

from .base import GenerateRequest, GenerateResponse, LLMEngine

# Maps the LanguageCode values in docs/openapi/chat.yaml /
# frontend/src/app/core/models/language.model.ts to a display name for the
# system prompt. Kept here, not in the registry, since it's prompting
# behavior (Python's job per docs/ARCHITECTURE.md §3.3), not model
# identity.
_LANGUAGE_NAMES = {
    "hi": "Hindi (Devanagari script)",
    "hinglish": "Hinglish (Hindi-English code-switching, romanized)",
    "en": "English",
    "bn": "Bengali",
    "gu": "Gujarati",
    "mr": "Marathi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "or": "Odia",
    "mai": "Maithili",
}

_SYSTEM_PROMPT_TEMPLATE = (
    "You are VaaniSetu, a helpful voice assistant for Indian languages. "
    "Reply naturally in {language_name}, matching the user's language and "
    "any code-switching in their message. Keep the reply short and "
    "conversational, as if it will be spoken aloud, not written prose. Do "
    "not use emoji, markdown, or other symbols that only make sense in "
    "writing — a future phase reads this reply aloud with text-to-speech."
)

# Appended to the system prompt only when request.passages is non-empty
# (Phase 7 Milestone 7d). Deliberately advisory, not a hard requirement:
# no measured relevance-score cutoff exists yet
# (docs/DECISIONS.md's Milestone 7d ADR), so an unrelated question must
# still get a normal answer rather than being forced through irrelevant
# retrieved text.
_GROUNDING_INSTRUCTION_TEMPLATE = (
    "\n\nYou have been given passages from the user's own documents, which "
    "may or may not be relevant to their message:\n{passages_block}\n"
    "If a passage is relevant, base your reply on it. If none are "
    "relevant, ignore them and answer from your own knowledge as usual."
)


def _build_system_prompt(language_name: str, passages: list[str]) -> str:
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(language_name=language_name)
    if not passages:
        return system_prompt
    passages_block = "\n".join(f"- {passage}" for passage in passages)
    return system_prompt + _GROUNDING_INSTRUCTION_TEMPLATE.format(passages_block=passages_block)


class LlamaCppEngine(LLMEngine):
    def __init__(
        self,
        model_path: str,
        context_length: int = 4096,
        max_tokens: int = 512,
        seed: int | None = None,
    ) -> None:
        # Imported lazily so importing this module (e.g. for type-checking
        # or when a fake engine is used in tests) never requires the
        # native llama-cpp-python extension to be installed/loadable.
        from llama_cpp import Llama

        self._max_tokens = max_tokens
        self._llama = Llama(
            model_path=model_path,
            n_ctx=context_length,
            n_threads=None,  # let llama.cpp pick based on available cores
            # None -> llama.cpp picks a random seed each load, giving the
            # live service natural reply-to-reply variety. A benchmark run
            # instead passes a fixed seed so its comparisons and stored
            # report are reproducible (see scripts/benchmark.py).
            seed=seed if seed is not None else -1,
            verbose=False,
        )

    def generate(self, request: GenerateRequest) -> GenerateResponse:
        language_name = _LANGUAGE_NAMES.get(request.language, request.language)
        system_prompt = _build_system_prompt(language_name, request.passages)

        try:
            completion = self._llama.create_chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.text},
                ],
                max_tokens=self._max_tokens,
            )
        except ValueError as e:
            if "System role not supported" not in str(e):
                raise
            # Some chat templates (e.g. Gemma's) have no system role at
            # all. The standard workaround is folding the system prompt
            # into the first user turn instead of dropping it.
            completion = self._llama.create_chat_completion(
                messages=[
                    {
                        "role": "user",
                        "content": f"{system_prompt}\n\n{request.text}",
                    },
                ],
                max_tokens=self._max_tokens,
            )

        reply = completion["choices"][0]["message"]["content"]
        if reply is None:
            raise RuntimeError("llama_cpp: model returned no content")

        return GenerateResponse(reply=reply.strip())
