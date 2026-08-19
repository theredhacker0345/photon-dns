#!/usr/bin/env python3
"""Normalize a Python wheel after Pocket Relay removes desktop-only metadata.

The Android build intentionally supplies its own explicit dependency graph. This
tool removes upstream Requires-Dist records, rebuilds RECORD, and writes a wheel
with a fixed ZIP member order and timestamp so the wheel can be reproduced from
the same vendored source and pinned toolchain.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import os
import shutil
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    encoded = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode("ascii").rstrip("=")
    return f"sha256={encoded}", len(data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("wheel", type=Path)
    parser.add_argument("--epoch", required=True, type=int)
    args = parser.parse_args()

    wheel = args.wheel.resolve()
    if not wheel.is_file() or wheel.suffix != ".whl":
        raise SystemExit(f"Expected an existing wheel: {wheel}")
    timestamp = datetime.fromtimestamp(args.epoch, tz=UTC).timetuple()[:6]
    if timestamp[0] < 1980:
        raise SystemExit("ZIP timestamps must be on or after 1980-01-01.")

    with tempfile.TemporaryDirectory(prefix="pocket-relay-wheel-") as temporary:
        root = Path(temporary)
        with zipfile.ZipFile(wheel) as archive:
            archive.extractall(root)

        metadata_files = sorted(root.glob("*.dist-info/METADATA"))
        record_files = sorted(root.glob("*.dist-info/RECORD"))
        if len(metadata_files) != 1 or len(record_files) != 1:
            raise SystemExit("Wheel must contain exactly one METADATA and RECORD file.")
        metadata = metadata_files[0]
        metadata.write_text(
            "".join(line for line in metadata.read_text(encoding="utf-8").splitlines(keepends=True) if not line.startswith("Requires-Dist:")),
            encoding="utf-8",
            newline="",
        )

        record = record_files[0]
        relative_record = record.relative_to(root).as_posix()
        package_files = sorted(
            path
            for path in root.rglob("*")
            if path.is_file() and path.relative_to(root).as_posix() != relative_record
        )
        with record.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            for path in package_files:
                relative = path.relative_to(root).as_posix()
                checksum, size = digest(path)
                writer.writerow((relative, checksum, size))
            writer.writerow((relative_record, "", ""))

        normalized = wheel.with_suffix(".normalized.whl")
        with zipfile.ZipFile(normalized, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(path for path in root.rglob("*") if path.is_file()):
                info = zipfile.ZipInfo(path.relative_to(root).as_posix(), date_time=timestamp)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        shutil.move(normalized, wheel)
        os.utime(wheel, (args.epoch, args.epoch))


if __name__ == "__main__":
    main()
