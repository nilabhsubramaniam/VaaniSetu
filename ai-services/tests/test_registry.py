from __future__ import annotations

import textwrap

import pytest

from app.registry import ModelEntry, RegistryError, build_engine, load_selected_entry

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
    """
)


def test_load_selected_entry_reads_the_selected_candidate(tmp_path) -> None:
    registry_path = tmp_path / "models.yaml"
    registry_path.write_text(_REGISTRY_YAML)

    entry = load_selected_entry(str(registry_path))

    assert entry == ModelEntry(
        key="model-a",
        engine="llama_cpp",
        repo_id="someorg/model-a-gguf",
        filename="model-a.Q4_K_M.gguf",
        context_length=2048,
        max_tokens=256,
        license="Apache-2.0",
    )


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

    entry = load_selected_entry(str(registry_path))

    assert entry.context_length == 4096
    assert entry.max_tokens == 512
    assert entry.license == "unknown"


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
        load_selected_entry(str(registry_path))


def test_build_engine_raises_when_model_file_is_missing(tmp_path) -> None:
    entry = ModelEntry(
        key="model-a",
        engine="llama_cpp",
        repo_id="someorg/model-a-gguf",
        filename="not-downloaded.gguf",
        context_length=4096,
        max_tokens=512,
        license="Apache-2.0",
    )

    with pytest.raises(RegistryError, match="model file not found"):
        build_engine(entry, str(tmp_path))


def test_build_engine_rejects_an_unknown_engine_kind(tmp_path) -> None:
    model_file = tmp_path / "present.gguf"
    model_file.write_bytes(b"not a real gguf, just needs to exist")

    entry = ModelEntry(
        key="model-a",
        engine="some_future_engine",
        repo_id="someorg/model-a-gguf",
        filename="present.gguf",
        context_length=4096,
        max_tokens=512,
        license="Apache-2.0",
    )

    with pytest.raises(RegistryError, match="unknown engine kind"):
        build_engine(entry, str(tmp_path))
