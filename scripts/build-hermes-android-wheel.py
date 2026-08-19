#!/usr/bin/env python3
"""Create Pocket Relay's dependency-free, deterministic Hermes Agent wheel.

The upstream package metadata declares a large desktop dependency graph which
does not belong in the embedded Android runtime. Pocket Relay supplies its own
reviewed Android requirements manifest. This assembler includes the exact
upstream packages, modules, and declared package-data selected in the vendored
source, but intentionally emits no ``Requires-Dist`` records.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import os
import zipfile
from datetime import UTC, datetime
from pathlib import Path


NAME = "hermes_agent"
VERSION = "0.20.1"
DIST_INFO = f"{NAME}-{VERSION}.dist-info"
PACKAGE_DIRECTORIES = (
    "agent",
    "tools",
    "hermes_cli",
    "gateway",
    "tui_gateway",
    "cron",
    "acp_adapter",
    "plugins",
    "providers",
)
TOP_LEVEL_MODULES = (
    "run_agent",
    "registration_lifecycle",
    "model_tools",
    "toolsets",
    "batch_runner",
    "trajectory_compressor",
    "toolset_distributions",
    "cli",
    "hermes_bootstrap",
    "hermes_constants",
    "hermes_state",
    "hermes_state_common",
    "hermes_state_portability",
    "hermes_state_schema",
    "hermes_state_search",
    "hermes_time",
    "hermes_logging",
    "utils",
    "mcp_serve",
)


def sha256_record(data: bytes) -> tuple[str, int]:
    encoded = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode("ascii").rstrip("=")
    return f"sha256={encoded}", len(data)


def include_package_file(relative: str) -> bool:
    if relative.endswith(".py"):
        return True
    if relative.startswith("hermes_cli/observability/schemas/") and relative.endswith(".json"):
        return True
    if relative.startswith("hermes_cli/data/") and relative.endswith(".json"):
        return True
    if relative.startswith("gateway/assets/"):
        return True
    return relative.startswith("plugins/") and relative.rsplit("/", 1)[-1] in {"plugin.yaml", "plugin.yml"}


def source_members(root: Path) -> dict[str, bytes]:
    members: dict[str, bytes] = {}
    for directory in PACKAGE_DIRECTORIES:
        package_root = root / directory
        if not package_root.is_dir():
            raise SystemExit(f"Vendored package directory is missing: {directory}")
        for path in sorted(item for item in package_root.rglob("*") if item.is_file()):
            relative = path.relative_to(root).as_posix()
            if include_package_file(relative):
                members[relative] = path.read_bytes()
    for module in TOP_LEVEL_MODULES:
        path = root / f"{module}.py"
        if not path.is_file():
            raise SystemExit(f"Vendored top-level module is missing: {path.name}")
        members[path.name] = path.read_bytes()
    return members


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epoch", type=int, required=True)
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    if not (source / "LICENSE").is_file() or not (source / "pyproject.toml").is_file():
        raise SystemExit("Expected the verified Hermes vendor tree.")
    date_time = datetime.fromtimestamp(args.epoch, tz=UTC).timetuple()[:6]
    if date_time[0] < 1980:
        raise SystemExit("ZIP timestamps must be on or after 1980-01-01.")

    members = source_members(source)
    members[f"{DIST_INFO}/licenses/LICENSE"] = (source / "LICENSE").read_bytes()
    members[f"{DIST_INFO}/METADATA"] = (
        "Metadata-Version: 2.3\n"
        "Name: hermes-agent\n"
        f"Version: {VERSION}\n"
        "Summary: Hermes Agent source bundled by Pocket Relay for Android\n"
        "Requires-Python: >=3.11,<3.14\n"
        "License: MIT\n"
        "License-File: LICENSE\n"
    ).encode("utf-8")
    members[f"{DIST_INFO}/WHEEL"] = (
        "Wheel-Version: 1.0\n"
        "Generator: Pocket Relay deterministic wheel builder\n"
        "Root-Is-Purelib: true\n"
        "Tag: py3-none-any\n"
    ).encode("utf-8")
    members[f"{DIST_INFO}/entry_points.txt"] = (
        "[console_scripts]\n"
        "hermes = hermes_cli.main:main\n"
        "hermes-agent = run_agent:main\n"
        "hermes-acp = acp_adapter.entry:main\n"
    ).encode("utf-8")

    record_path = f"{DIST_INFO}/RECORD"
    record_lines: list[str] = []
    for path in sorted(members):
        checksum, size = sha256_record(members[path])
        record_lines.append(f"{path},{checksum},{size}\n")
    record_lines.append(f"{record_path},,\n")
    members[record_path] = "".join(record_lines).encode("utf-8")

    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(members):
            info = zipfile.ZipInfo(path, date_time=date_time)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, members[path], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    os.utime(output, (args.epoch, args.epoch))


if __name__ == "__main__":
    main()
