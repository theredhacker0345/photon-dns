#!/usr/bin/env python3
"""Scan Python 3.11 pyc files for static import instructions."""
from __future__ import annotations

import dis
import marshal
import sys
import types
from collections import defaultdict
from pathlib import Path

root = Path(sys.argv[1])
interesting = set(sys.argv[2:])
imports: dict[str, set[str]] = defaultdict(set)

def walk(code: types.CodeType, owner: str) -> None:
    for instruction in dis.get_instructions(code):
        if instruction.opname in {"IMPORT_NAME", "IMPORT_FROM"} and instruction.argval:
            imports[owner].add(str(instruction.argval))
    for constant in code.co_consts:
        if isinstance(constant, types.CodeType):
            walk(constant, owner)

for pyc in root.rglob("*.pyc"):
    try:
        with pyc.open("rb") as handle:
            handle.read(16)
            code = marshal.load(handle)
        walk(code, str(pyc.relative_to(root)))
    except Exception:
        continue

for owner in sorted(imports):
    if not interesting or any(token in owner for token in interesting):
        print(owner)
        for name in sorted(imports[owner]):
            print(f"  {name}")
