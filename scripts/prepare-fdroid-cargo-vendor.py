#!/usr/bin/env python3
"""Prepare a copied Cargo vendor manifest for F-Droid scanner deletions.

F-Droid removes scanner-excluded source fixtures before custom build commands.
Cargo's vendored checksum manifest still lists those absent fixtures, so this
tool removes exactly a reviewed prefix from the manifest in the disposable
build copy. It never edits the committed vendor source tree.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--expected-removed-count", required=True, type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest_path: Path = args.manifest
    if not manifest_path.is_file():
        raise SystemExit(f"Cargo checksum manifest is missing: {manifest_path}")

    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = payload.get("files")
    if not isinstance(files, dict):
        raise SystemExit(f"Cargo checksum manifest has no files map: {manifest_path}")

    removed = sorted(path for path in files if path.startswith(args.prefix))
    if len(removed) != args.expected_removed_count:
        raise SystemExit(
            "Unexpected F-Droid scanner deletion set: "
            f"expected {args.expected_removed_count} files under {args.prefix!r}, "
            f"found {len(removed)}"
        )

    remaining = [path for path in removed if (manifest_path.parent / path).is_file()]
    if remaining:
        raise SystemExit(
            "Refusing to prune Cargo checksums while scanner-excluded fixtures remain: "
            + ", ".join(remaining)
        )

    for path in removed:
        del files[path]
    manifest_path.write_text(
        json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
