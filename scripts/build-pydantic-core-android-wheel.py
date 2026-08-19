#!/usr/bin/env python3
"""Package a locally compiled Pydantic Core extension as a deterministic wheel.

The source, Rust dependency closure, and native extension are all produced
locally by Pocket Relay's Android build scripts. This avoids a runtime build
backend dependency while retaining standard wheel metadata and integrity data.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import os
import zipfile
from datetime import UTC, datetime
from pathlib import Path


NAME = "pydantic_core"
VERSION = "2.46.4"
DIST_INFO = f"{NAME}-{VERSION}.dist-info"


def record_hash(data: bytes) -> tuple[str, int]:
    encoded = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode("ascii").rstrip("=")
    return f"sha256={encoded}", len(data)


def source_members(source: Path, extension: Path) -> dict[str, bytes]:
    package_root = source / "python" / "pydantic_core"
    if not package_root.is_dir():
        raise SystemExit("Vendored Pydantic Core Python package is missing.")
    if not extension.is_file():
        raise SystemExit(f"Compiled Pydantic Core extension is missing: {extension}")

    members: dict[str, bytes] = {}
    for path in sorted(item for item in package_root.rglob("*") if item.is_file()):
        relative = path.relative_to(package_root).as_posix()
        if relative.endswith((".py", ".pyi")) or relative == "py.typed":
            members[f"pydantic_core/{relative}"] = path.read_bytes()
    members["pydantic_core/_pydantic_core.so"] = extension.read_bytes()
    return members


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--extension", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epoch", type=int, required=True)
    parser.add_argument("--tag", required=True)
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    timestamp = datetime.fromtimestamp(args.epoch, tz=UTC).timetuple()[:6]
    if timestamp[0] < 1980:
        raise SystemExit("ZIP timestamps must be on or after 1980-01-01.")
    if not (source / "LICENSE").is_file():
        raise SystemExit("Vendored Pydantic Core license is missing.")

    members = source_members(source, args.extension.resolve())
    members[f"{DIST_INFO}/licenses/LICENSE"] = (source / "LICENSE").read_bytes()
    members[f"{DIST_INFO}/METADATA"] = (
        "Metadata-Version: 2.3\n"
        "Name: pydantic_core\n"
        f"Version: {VERSION}\n"
        "Summary: Core functionality for Pydantic validation and serialization\n"
        "Requires-Python: >=3.9\n"
        "Requires-Dist: typing-extensions >=4.14.1\n"
        "License: MIT\n"
        "License-File: LICENSE\n"
    ).encode("utf-8")
    members[f"{DIST_INFO}/WHEEL"] = (
        "Wheel-Version: 1.0\n"
        "Generator: Pocket Relay deterministic wheel builder\n"
        "Root-Is-Purelib: false\n"
        f"Tag: {args.tag}\n"
    ).encode("utf-8")

    record_path = f"{DIST_INFO}/RECORD"
    records = []
    for path in sorted(members):
        checksum, size = record_hash(members[path])
        records.append(f"{path},{checksum},{size}\n")
    records.append(f"{record_path},,\n")
    members[record_path] = "".join(records).encode("utf-8")

    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(members):
            info = zipfile.ZipInfo(path, date_time=timestamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, members[path], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    os.utime(output, (args.epoch, args.epoch))


if __name__ == "__main__":
    main()
