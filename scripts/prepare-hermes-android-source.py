#!/usr/bin/env python3
"""Create an offline Android packaging worktree from verified Hermes source.

The vendored tree is kept byte-for-byte equal to the recorded upstream source
subset. This overlay only removes SPDX license fields which are valid in the
pinned upstream metadata but unsupported by the older setuptools backend
available in the Android wheel toolchain. The MIT license remains bundled in
the wheel and is recorded independently in Pocket Relay's provenance/SBOM.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path


def replace_exactly_once(source: str, old: str, new: str = "") -> str:
    if source.count(old) != 1:
        raise SystemExit(f"Expected exactly one packaging metadata fragment: {old!r}")
    return source.replace(old, new)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare-hermes-android-source.py <verified-source> <worktree>")
    source = Path(sys.argv[1]).resolve()
    worktree = Path(sys.argv[2]).resolve()
    if not (source / "UPSTREAM.md").is_file() or not (source / "pyproject.toml").is_file():
        raise SystemExit("Expected a verified Pocket Relay Hermes vendor tree.")
    if worktree.exists():
        shutil.rmtree(worktree)
    shutil.copytree(source, worktree, symlinks=False)

    pyproject = worktree / "pyproject.toml"
    content = pyproject.read_text(encoding="utf-8")
    content = replace_exactly_once(content, 'license = "MIT"\n')
    content = replace_exactly_once(content, 'license-files = ["LICENSE"]\n')
    pyproject.write_text(content, encoding="utf-8", newline="")


if __name__ == "__main__":
    main()
