"""Pure-Python Android compatibility surface for OpenAI's optional jiter parser.

Chaquopy 17 does not distribute Android wheels for the upstream Rust extension.
Pocket Hermes only needs ``from_json`` for structured streamed tool arguments;
the standard library decoder is sufficient for the owner-locked Telegram host.
"""

from __future__ import annotations

import json
from typing import Any

__all__ = ["LosslessFloat", "from_json"]
__version__ = "0.10.0"


class LosslessFloat(float):
    """Compatibility marker retained for callers which request exact floats."""


def from_json(data: str | bytes | bytearray, *, partial_mode: bool = False) -> Any:
    """Decode a complete JSON value using the Android standard library.

    The OpenAI client calls this after it has assembled a complete streamed
    content/tool-argument value. Partial JSON is intentionally rejected rather
    than guessed, which preserves fail-closed parsing semantics.
    """
    if partial_mode:
        raise ValueError("Partial JSON parsing is unavailable in the Android compatibility runtime.")
    if isinstance(data, (bytes, bytearray)):
        data = data.decode("utf-8")
    return json.loads(data)
