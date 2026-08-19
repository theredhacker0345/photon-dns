#!/usr/bin/env python3
"""Build Pocket Relay's local Jiter compatibility package without pip backends."""

from __future__ import annotations

import argparse
import base64
import hashlib
import os
import zipfile
from datetime import UTC, datetime
from pathlib import Path


NAME = "jiter"
VERSION = "0.10.0"
DIST_INFO = f"{NAME}-{VERSION}.dist-info"


def record_digest(data: bytes) -> tuple[str, int]:
    encoded = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode("ascii").rstrip("=")
    return f"sha256={encoded}", len(data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epoch", type=int, required=True)
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    package = source / "jiter"
    if not (source / "LICENSE").is_file() or not (source / "pyproject.toml").is_file() or not package.is_dir():
        raise SystemExit("Expected the reviewed local Jiter compatibility source tree.")
    timestamp = datetime.fromtimestamp(args.epoch, tz=UTC).timetuple()[:6]
    if timestamp[0] < 1980:
        raise SystemExit("ZIP timestamps must be on or after 1980-01-01.")

    members = {
        path.relative_to(source).as_posix(): path.read_bytes()
        for path in sorted(package.rglob("*.py"))
    }
    members[f"{DIST_INFO}/licenses/LICENSE"] = (source / "LICENSE").read_bytes()
    members[f"{DIST_INFO}/METADATA"] = (
        "Metadata-Version: 2.3\n"
        "Name: jiter\n"
        "Version: 0.10.0\n"
        "Summary: Pocket Relay Android pure-Python compatibility implementation\n"
        "Requires-Python: >=3.11\n"
        "License: MIT\n"
        "License-File: LICENSE\n"
    ).encode("utf-8")
    members[f"{DIST_INFO}/WHEEL"] = (
        "Wheel-Version: 1.0\n"
        "Generator: Pocket Relay deterministic wheel builder\n"
        "Root-Is-Purelib: true\n"
        "Tag: py3-none-any\n"
    ).encode("utf-8")
    record_path = f"{DIST_INFO}/RECORD"
    record_rows = []
    for path in sorted(members):
        digest, size = record_digest(members[path])
        record_rows.append(f"{path},{digest},{size}\n")
    record_rows.append(f"{record_path},,\n")
    members[record_path] = "".join(record_rows).encode("utf-8")

    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(members):
            info = zipfile.ZipInfo(path, date_time=timestamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, members[path], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    os.utime(output, (args.epoch, args.epoch))


if __name__ == "__main__":
    main()
