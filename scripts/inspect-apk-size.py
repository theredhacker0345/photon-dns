#!/usr/bin/env python3
"""Print a compact size and native-ABI breakdown for an Android APK."""
from __future__ import annotations

import sys
import zipfile
from collections import defaultdict
from pathlib import Path

apk_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("android/app/build/outputs/apk/release/app-release.apk")
if not apk_path.exists():
    raise SystemExit(f"APK not found: {apk_path}")

with zipfile.ZipFile(apk_path) as apk:
    entries = apk.infolist()
    compressed = sum(item.compress_size for item in entries)
    uncompressed = sum(item.file_size for item in entries)
    print(f"APK={apk_path}")
    print(f"DISK_BYTES={apk_path.stat().st_size}")
    print(f"ZIP_COMPRESSED_BYTES={compressed}")
    print(f"ZIP_UNCOMPRESSED_BYTES={uncompressed}")
    print("ABI_BYTES:")
    abi_sizes: dict[str, int] = defaultdict(int)
    for item in entries:
        if item.filename.startswith("lib/"):
            abi = item.filename.split("/", 2)[1]
            abi_sizes[abi] += item.file_size
    for abi, size in sorted(abi_sizes.items()):
        print(f"  {abi}: {size} bytes ({size / 1024 / 1024:.2f} MiB)")
    print("TOP_FILES:")
    for item in sorted(entries, key=lambda entry: entry.file_size, reverse=True)[:20]:
        print(f"  {item.file_size} bytes ({item.file_size / 1024 / 1024:.2f} MiB) {item.filename}")
