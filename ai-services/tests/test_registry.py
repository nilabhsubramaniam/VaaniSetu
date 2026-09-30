from __future__ import annotations

import textwrap

import pytest

from app.registry import ModelEntry, RegistryError, build_engine, load_selected_entry, tts_languages

_REGISTRY_YAML = textwrap.dedent(
    """\
    llm:
      selected: model-a
      candidates:
        model-a:
          engine: llama_cpp
          repo_id: someorg/model-a-gguf
          filename: model-a.Q4_K_M.gguf
          context_length: 2048
          max_tokens: 256
          license: Apache-2.0
        model-b:
          engine: llama_cpp
          repo_id: someorg/model-b-gguf
          filename: model-b.Q4_K_M.gguf
    asr:
      selected: whisper-a
      candidates:
        whisper-a:
          engine: faster_whisper
          repo_id: someorg/whisper-a-ct2
          compute_type: int8
          device: cpu
          license: MIT
    tts:
      selected:
        hi:
          female: parler-a
          male: parler-b
        ml:
          female: parler-c
          male: parler-c
      candidates:
        parler-a:
          engine: parler_tts
          repo_id: someorg/parler-a
          license: Apache-2.0
          voices:
            hi: "A clear female voice speaks at a moderate pace."
            hinglish: "A clear female voice speaks at a moderate pace."
        parler-b:
          engine: parler_tts
          repo_id: someorg/parler-b
          license: Apache-2.0
        parler-c:
          engine: parler_tts
          repo_id: someorg/parler-c
          license: Apache-2.0
    langid:
      selected: fasttext-a
      candidates:
        fasttext-a:
          engine: fasttext_lid
          repo_id: someorg/fasttext-lid
          license: CC-BY-SA-3.0
          download_url: https://example.invalid/lid.176.bin
          filename: lid.176.bin
        indiclid-a:
          engine: indiclid
          repo_id: someorg/indiclid
          license: MIT
          download_urls:
            ftn: https://example.invalid/ftn.zip
            ftr: https://example.invalid/ftr.zip
            bert: https://example.invalid/bert.zip
          bert_tokenizer: someorg/indic-bert-tokenizer
    """
)


def test_load_selected_entry_reads_the_selected_llm_candidate(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    entry = load_selected_entry(str(registry_path), "llm")

    assert entry == ModelEntry(
        key="model-a",
        engine="llama_cpp",
        repo_id="someorg/model-a-gguf",
        license="Apache-2.0",
        filename="model-a.Q4_K_M.gguf",
        context_length=2048,
        max_tokens=256,
    )


def test_load_selected_entry_reads_the_selected_asr_candidate(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    entry = load_selected_entry(str(registry_path), "asr")

    assert entry == ModelEntry(
        key="whisper-a",
        engine="faster_whisper",
        repo_id="someorg/whisper-a-ct2",
        license="MIT",
        compute_type="int8",
        device="cpu",
    )


def test_load_selected_entry_reads_the_selected_tts_candidate_for_the_female_voice(
    tmp_path,
) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    entry = load_selected_entry(str(registry_path), "tts", voice="female", language="hi")

    assert entry == ModelEntry(
        key="parler-a",
        engine="parler_tts",
        repo_id="someorg/parler-a",
        license="Apache-2.0",
        voices={
            "hi": "A clear female voice speaks at a moderate pace.",
            "hinglish": "A clear female voice speaks at a moderate pace.",
        },
    )


def test_load_selected_entry_reads_the_selected_tts_candidate_for_the_male_voice(
    tmp_path,
) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    entry = load_selected_entry(str(registry_path), "tts", voice="male", language="hi")

    assert entry.key == "parler-b"
    assert entry.repo_id == "someorg/parler-b"


def test_load_selected_entry_reads_a_different_tts_language(tmp_path) -> None:
    # Milestone 6c: `selected` is a {language: {voice: key}} map — a
    # different language can point at an entirely different candidate.
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    entry = load_selected_entry(str(registry_path), "tts", voice="female", language="ml")

    assert entry.key == "parler-c"
    assert entry.repo_id == "someorg/parler-c"


def test_load_selected_entry_rejects_an_unconfigured_tts_language(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    with pytest.raises(RegistryError):
        load_selected_entry(str(registry_path), "tts", voice="female", language="bn")


def test_tts_languages_reads_the_configured_language_keys(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    assert tts_languages(str(registry_path)) == ["hi", "ml"]


def test_tts_languages_rejects_a_malformed_registry(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text("llm:\n  selected: model-a\n")

    with pytest.raises(RegistryError):
        tts_languages(str(registry_path))


def test_load_selected_entry_reads_the_selected_langid_candidate(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    entry = load_selected_entry(str(registry_path), "langid")

    assert entry == ModelEntry(
        key="fasttext-a",
        engine="fasttext_lid",
        repo_id="someorg/fasttext-lid",
        license="CC-BY-SA-3.0",
        download_url="https://example.invalid/lid.176.bin",
        filename="lid.176.bin",
    )


def test_load_selected_entry_reads_indiclids_download_urls_and_bert_tokenizer(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)
    doc = registry_path.read_text().replace("selected: fasttext-a", "selected: indiclid-a")
    registry_path.write_text(doc)

    entry = load_selected_entry(str(registry_path), "langid")

    assert entry.key == "indiclid-a"
    assert entry.engine == "indiclid"
    assert entry.download_urls == {
        "ftn": "https://example.invalid/ftn.zip",
        "ftr": "https://example.invalid/ftr.zip",
        "bert": "https://example.invalid/bert.zip",
    }
    assert entry.bert_tokenizer == "someorg/indic-bert-tokenizer"


def test_load_selected_entry_rejects_an_unknown_tts_voice(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    with pytest.raises(RegistryError):
        load_selected_entry(str(registry_path), "tts", voice="robot")


def test_load_selected_entry_applies_defaults_for_optional_fields(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(
        textwrap.dedent(
            """\
            llm:
              selected: model-b
              candidates:
                model-b:
                  engine: llama_cpp
                  repo_id: someorg/model-b-gguf
                  filename: model-b.Q4_K_M.gguf
            """
        )
    )

    entry = load_selected_entry(str(registry_path), "llm")

    assert entry.context_length == 4096
    assert entry.max_tokens == 512
    assert entry.license == "unknown"
    assert entry.compute_type == "int8"
    assert entry.device == "auto"
    assert entry.voices == {}
    assert entry.download_url == ""
    assert entry.download_urls == {}
    assert entry.bert_tokenizer == ""


def test_load_selected_entry_rejects_a_selected_key_with_no_candidate(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(
        textwrap.dedent(
            """\
            llm:
              selected: does-not-exist
              candidates:
                model-a:
                  engine: llama_cpp
                  repo_id: someorg/model-a-gguf
                  filename: model-a.gguf
            """
        )
    )

    with pytest.raises(RegistryError):
        load_selected_entry(str(registry_path), "llm")


def test_load_selected_entry_rejects_an_unknown_capability(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    with pytest.raises(RegistryError):
        load_selected_entry(str(registry_path), "vad")


def test_build_engine_raises_when_llama_cpp_model_file_is_missing(tmp_path) -> None:
    entry = ModelEntry(
        key="model-a",
        engine="llama_cpp",
        repo_id="someorg/model-a-gguf",
        license="Apache-2.0",
        filename="not-downloaded.gguf",
    )

    with pytest.raises(RegistryError, match="model file not found"):
        build_engine(entry, str(tmp_path))


def test_build_engine_raises_when_faster_whisper_model_dir_is_missing(tmp_path) -> None:
    entry = ModelEntry(
        key="whisper-a",
        engine="faster_whisper",
        repo_id="someorg/whisper-a-ct2",
        license="MIT",
    )

    with pytest.raises(RegistryError, match="model directory not found"):
        build_engine(entry, str(tmp_path))


@pytest.mark.parametrize("engine_kind", ["mms_vits", "parler_tts", "xtts"])
def test_build_engine_raises_when_tts_model_dir_is_missing(tmp_path, engine_kind: str) -> None:
    entry = ModelEntry(
        key="tts-a",
        engine=engine_kind,
        repo_id="someorg/tts-a",
        license="Apache-2.0",
    )

    with pytest.raises(RegistryError, match="model directory not found"):
        build_engine(entry, str(tmp_path))


def test_build_engine_raises_when_fasttext_lid_model_file_is_missing(tmp_path) -> None:
    entry = ModelEntry(
        key="fasttext-a",
        engine="fasttext_lid",
        repo_id="someorg/fasttext-lid",
        license="CC-BY-SA-3.0",
        download_url="https://example.invalid/lid.176.bin",
        filename="lid.176.bin",
    )

    with pytest.raises(RegistryError, match="model file not found"):
        build_engine(entry, str(tmp_path))


def test_build_engine_raises_when_indiclid_model_files_are_missing(tmp_path) -> None:
    entry = ModelEntry(
        key="indiclid-a",
        engine="indiclid",
        repo_id="someorg/indiclid",
        license="MIT",
        download_urls={"ftn": "u", "ftr": "u", "bert": "u"},
        bert_tokenizer="someorg/indic-bert-tokenizer",
    )

    with pytest.raises(RegistryError, match="indiclid model files not found"):
        build_engine(entry, str(tmp_path))


def test_build_engine_rejects_an_unknown_engine_kind(tmp_path) -> None:
    model_file = tmp_path / "present.gguf"
    model_file.write_bytes(b"not a real gguf, just needs to exist")

    entry = ModelEntry(
        key="model-a",
        engine="some_future_engine",
        repo_id="someorg/model-a-gguf",
        license="Apache-2.0",
        filename="present.gguf",
    )

    with pytest.raises(RegistryError, match="unknown engine kind"):
        build_engine(entry, str(tmp_path))
