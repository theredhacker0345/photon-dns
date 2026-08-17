#!/usr/bin/env python3
"""Summarize a Chaquopy .imy archive by top-level path."""
from __future__ import annotations

import sys
import zipfile
from collections import defaultdict
from pathlib import Path

archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as zf:
    totals: dict[str, int] = defaultdict(int)
    compressed: dict[str, int] = defaultdict(int)
    counts: dict[str, int] = defaultdict(int)
    for info in zf.infolist():
        top = info.filename.split("/", 1)[0] or "<root>"
        totals[top] += info.file_size
        compressed[top] += info.compress_size
        counts[top] += 1
    print(f"ARCHIVE={archive}")
    print(f"ARCHIVE_BYTES={archive.stat().st_size}")
    print("TOP_LEVEL_UNCOMPRESSED:")
    for top in sorted(totals, key=totals.get, reverse=True):
        print(f"  {totals[top]:10d} bytes ({totals[top] / 1024 / 1024:6.2f} MiB) "
              f"compressed={compressed[top] / 1024 / 1024:6.2f} MiB files={counts[top]:4d} {top}")
    print("LARGEST_ENTRIES:")
    for info in sorted(zf.infolist(), key=lambda item: item.file_size, reverse=True)[:40]:
        print(f"  {info.file_size:10d} bytes ({info.file_size / 1024 / 1024:6.2f} MiB) "
              f"compressed={info.compress_size / 1024 / 1024:6.2f} MiB {info.filename}")
