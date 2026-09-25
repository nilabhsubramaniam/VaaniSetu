"""Loads the model registry (docs/ARCHITECTURE.md §3.6) and builds the
engine it currently selects for a given capability ("llm", "asr", "tts",
or "langid").

Application code (app.main) references a capability by name only; which
concrete model backs it is entirely a `models.yaml` edit — never a code
change (ADR-006).
"""

from __future__ import annotations

import glob
import os
from dataclasses import dataclass, field

import yaml

from .engines.asr.base import ASREngine
from .engines.base import LLMEngine
from .engines.langid.base import LangIDEngine
from .engines.tts.base import TTSEngine


@dataclass(frozen=True)
class ModelEntry:
    key: str
    engine: str
    repo_id: str
    license: str
    # llama_cpp ("llm" capability): a single GGUF file, resolved against
    # the capability's model store directory.
    filename: str = ""
    context_length: int = 4096
    max_tokens: int = 512
    # faster_whisper ("asr" capability): the model is a directory (a full
    # repo snapshot: model.bin, config.json, tokenizer files, ...),
    # resolved as <model_store_dir>/<key>/ — filename doesn't apply.
    compute_type: str = "int8"
    device: str = "auto"
    # mms_vits / parler_tts / xtts ("tts" capability): each also a
    # directory snapshot under <model_store_dir>/<key>/. Maps a
    # LanguageCode to an engine-specific voice selector — a natural
    # language description for parler_tts, a built-in speaker name for
    # xtts, unused by mms_vits (docs/ARCHITECTURE.md §3.6's "per-language
    # voice configuration").
    voices: dict[str, str] = field(default_factory=dict)
    # fasttext_lid ("langid" capability): a single file downloaded directly
    # from a URL (not a HF repo snapshot) — resolved against the
    # capability's model store directory the same way `filename` is for
    # llama_cpp, just fetched differently by download_models.py.
    download_url: str = ""
    # indiclid ("langid" capability): three separately-downloaded files
    # (ftn/ftr/bert), each a direct URL rather than a HF repo snapshot.
    download_urls: dict[str, str] = field(default_factory=dict)
    # indiclid's BERT fallback stage: the HF tokenizer repo id
    # (ai4bharat/IndicBERTv2-MLM-only) — downloaded via snapshot_download
    # like any other HF-hosted asset, unlike the three direct-URL files.
    bert_tokenizer: str = ""


class RegistryError(Exception):
    pass


def load_selected_entry(
    registry_path: str,
    capability: str,
    voice: str | None = None,
    language: str | None = None,
) -> ModelEntry:
    """Reads `registry_path` and returns the entry `capability`
    (e.g. "llm" or "asr") currently selects.

    `tts` is the one capability with more than one simultaneously-selected
    model — `selected` is a `{language: {voice: key}}` map (Milestone 6c),
    not a single string, so a per-request language *and* voice choice can
    each load a different, already real checkpoint rather than the
    capability being limited to one fixed language/voice pair. `language`
    and `voice` are both required (and only meaningful) for
    `capability == "tts"`; `llm`/`asr`/`langid` keep their original
    single-string `selected` shape unchanged.

    Before Milestone 6c, `tts.selected` was a flat `{voice: key}` map with
    no language axis at all — every non-Hindi request silently reused the
    Hindi engine and failed inside it (docs/DECISIONS.md ADR-021's
    Hinglish `UnsupportedTextError`). The language axis makes an
    unconfigured language a clean `RegistryError` here instead.
    """
    with open(registry_path, encoding="utf-8") as f:
        doc = yaml.safe_load(f)

    try:
        section = doc[capability]
        selected = section["selected"]
        selected_key = selected[language][voice] if capability == "tts" else selected
        candidate = section["candidates"][selected_key]
    except (KeyError, TypeError) as e:
        raise RegistryError(
            f"registry: malformed {registry_path} for capability {capability!r} "
            f"(language={language!r}, voice={voice!r}): {e}"
        ) from e

    return ModelEntry(
        key=selected_key,
        engine=candidate["engine"],
        repo_id=candidate["repo_id"],
        license=candidate.get("license", "unknown"),
        filename=candidate.get("filename", ""),
        context_length=candidate.get("context_length", 4096),
        max_tokens=candidate.get("max_tokens", 512),
        compute_type=candidate.get("compute_type", "int8"),
        device=candidate.get("device", "auto"),
        voices=candidate.get("voices", {}),
        download_url=candidate.get("download_url", ""),
        download_urls=candidate.get("download_urls", {}),
        bert_tokenizer=candidate.get("bert_tokenizer", ""),
    )


def tts_languages(registry_path: str) -> list[str]:
    """The languages `models.yaml`'s `tts.selected` currently configures
    (its top-level keys) — read from config, not hardcoded in `app.main`,
    so adding a language's TTS engines stays a `models.yaml` edit, per
    ADR-006's "swap by config, not by code" mechanism."""
    with open(registry_path, encoding="utf-8") as f:
        doc = yaml.safe_load(f)

    try:
        return list(doc["tts"]["selected"].keys())
    except (KeyError, TypeError) as e:
        raise RegistryError(f"registry: malformed {registry_path} for capability 'tts': {e}") from e


def _find_model_file(directory: str, extension: str) -> str | None:
    """Finds the single `extension` file under `directory`, searching
    recursively. IndicLID's release zips extract to an unpredictable
    internal layout (varies per part), so this looks for the file by
    extension rather than assuming an exact relative path."""
    matches = glob.glob(os.path.join(directory, "**", f"*{extension}"), recursive=True)
    return matches[0] if matches else None


def build_engine(
    entry: ModelEntry, model_store_dir: str
) -> LLMEngine | ASREngine | TTSEngine | LangIDEngine:
    """Builds the engine for `entry`. `entry.engine` selects the wrapper
    class; add a branch here (never a new caller-visible type) when a
    genuinely new engine kind is needed.
    """
    if entry.engine == "llama_cpp":
        model_path = os.path.join(model_store_dir, entry.filename)
        if not os.path.isfile(model_path):
            raise RegistryError(
                f"registry: model file not found: {model_path} "
                f"(expected {entry.repo_id}/{entry.filename} downloaded there — "
                "see ai-services/scripts/download_models.py)"
            )

        from .engines.llama_cpp_engine import LlamaCppEngine

        return LlamaCppEngine(
            model_path=model_path,
            context_length=entry.context_length,
            max_tokens=entry.max_tokens,
        )

    if entry.engine == "faster_whisper":
        model_path = os.path.join(model_store_dir, entry.key)
        if not os.path.isdir(model_path):
            raise RegistryError(
                f"registry: model directory not found: {model_path} "
                f"(expected the full {entry.repo_id} snapshot downloaded there — "
                "see ai-services/scripts/download_models.py)"
            )

        from .engines.asr.faster_whisper_engine import FasterWhisperEngine

        return FasterWhisperEngine(
            model_path=model_path,
            compute_type=entry.compute_type,
            device=entry.device,
        )

    if entry.engine in ("mms_vits", "parler_tts", "xtts"):
        model_path = os.path.join(model_store_dir, entry.key)
        if not os.path.isdir(model_path):
            raise RegistryError(
                f"registry: model directory not found: {model_path} "
                f"(expected the full {entry.repo_id} snapshot downloaded there — "
                "see ai-services/scripts/download_models.py)"
            )

        if entry.engine == "mms_vits":
            from .engines.tts.mms_vits_engine import MmsVitsEngine

            return MmsVitsEngine(model_path=model_path)

        if entry.engine == "parler_tts":
            from .engines.tts.parler_engine import ParlerTTSEngine

            return ParlerTTSEngine(model_path=model_path, voices=entry.voices)

        from .engines.tts.xtts_engine import XttsEngine

        return XttsEngine(model_path=model_path, voices=entry.voices)

    if entry.engine == "fasttext_lid":
        model_path = os.path.join(model_store_dir, entry.filename)
        if not os.path.isfile(model_path):
            raise RegistryError(
                f"registry: model file not found: {model_path} "
                f"(expected {entry.download_url} downloaded there — "
                "see ai-services/scripts/download_models.py)"
            )

        from .engines.langid.fasttext_lid_engine import FastTextLIDEngine

        return FastTextLIDEngine(model_path=model_path)

    if entry.engine == "indiclid":
        base_dir = os.path.join(model_store_dir, entry.key)
        ftn_path = _find_model_file(os.path.join(base_dir, "ftn"), ".bin")
        ftr_path = _find_model_file(os.path.join(base_dir, "ftr"), ".bin")
        bert_path = _find_model_file(os.path.join(base_dir, "bert"), ".pt")
        # The BERT fallback stage's tokenizer is downloaded locally
        # alongside the three model parts (download_models.py) rather than
        # resolved by repo id at load time — resolving it by
        # `entry.bert_tokenizer` here instead would call
        # AutoTokenizer.from_pretrained() with a Hub repo id, requiring
        # network access every time this engine loads (AGENTS.md §10: no
        # network egress in the voice path).
        tokenizer_dir = os.path.join(base_dir, "tokenizer")
        if not (ftn_path and ftr_path and bert_path and os.path.isdir(tokenizer_dir)):
            raise RegistryError(
                f"registry: indiclid model files not found under {base_dir} "
                f"(expected ftn/*.bin, ftr/*.bin, bert/*.pt, tokenizer/ — "
                "see ai-services/scripts/download_models.py)"
            )

        from .engines.langid.indiclid_engine import IndicLIDEngine

        return IndicLIDEngine(
            ftn_model_path=ftn_path,
            ftr_model_path=ftr_path,
            bert_model_path=bert_path,
            bert_tokenizer=tokenizer_dir,
        )

    raise RegistryError(f"registry: unknown engine kind {entry.engine!r}")
