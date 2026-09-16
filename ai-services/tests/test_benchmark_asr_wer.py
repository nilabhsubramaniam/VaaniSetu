"""Unit tests for the word-error-rate calculation used by
scripts/benchmark_asr.py — pure logic, tested in isolation from any real
audio or model.
"""

from __future__ import annotations

from scripts.benchmark_asr import _word_error_rate


def test_identical_text_has_zero_wer() -> None:
    assert _word_error_rate("आज मौसम कैसा है", "आज मौसम कैसा है") == 0.0


def test_completely_different_text_has_wer_of_one_when_same_length() -> None:
    assert _word_error_rate("one two three", "four five six") == 1.0


def test_one_substitution_out_of_four_words() -> None:
    assert _word_error_rate("the quick brown fox", "the slow brown fox") == 0.25


def test_case_and_punctuation_differences_are_ignored() -> None:
    assert _word_error_rate("Hello, world!", "hello world") == 0.0


def test_an_extra_word_counts_as_an_insertion() -> None:
    # reference has 3 words; hypothesis adds one extra -> 1 error / 3 = 0.333...
    assert round(_word_error_rate("kal ka mausam", "kal ka mausam bhai"), 3) == 0.333


def test_a_missing_word_counts_as_a_deletion() -> None:
    assert _word_error_rate("kal ka mausam kaisa", "kal mausam kaisa") == 0.25


def test_empty_reference_and_empty_hypothesis_is_zero() -> None:
    assert _word_error_rate("", "") == 0.0


def test_empty_reference_with_a_nonempty_hypothesis_is_one() -> None:
    assert _word_error_rate("", "something") == 1.0
