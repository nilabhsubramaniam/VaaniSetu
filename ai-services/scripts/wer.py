"""Word-error-rate calculation shared by scripts/benchmark_asr.py (WER of a
real transcript against ground truth) and scripts/benchmark_tts.py (WER of
a synthesized-then-transcribed clip against its own input text — the
"ASR-WER on synthesized audio as a proxy" intelligibility metric
docs/EVALUATION.md §5 names for TTS). Extracted here rather than
duplicated, once a second caller genuinely needed it.
"""

from __future__ import annotations

import re

_PUNCTUATION = re.compile(r"[.,!?؟।॥\"'’—\-:;]")


def normalize(text: str) -> list[str]:
    return _PUNCTUATION.sub("", text.lower()).split()


def word_error_rate(reference: str, hypothesis: str) -> float:
    """Standard word-level Levenshtein-distance WER: (substitutions +
    deletions + insertions) / len(reference words). Case- and
    light-punctuation-insensitive (see normalize) so trivial formatting
    differences aren't counted as errors.
    """
    ref = normalize(reference)
    hyp = normalize(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0

    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[n][m] / n
