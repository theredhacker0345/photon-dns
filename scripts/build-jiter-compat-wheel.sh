#!/usr/bin/env bash
# Builds the project-owned MIT pure-Python jiter compatibility wheel.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-/home/ubuntu/toolchains/cpython-3.11/bin/python3.11}"
SOURCE="${ROOT}/modules/pocket-hermes-supervisor/android/src/main/python/vendor/jiter-compat"
OUT="${ROOT}/.artifacts/wheels"

mkdir -p "${OUT}"
rm -f "${OUT}/jiter-0.10.0-py3-none-any.whl"
"${PYTHON}" -m pip wheel --no-deps --wheel-dir "${OUT}" "${SOURCE}"
sha256sum "${OUT}/jiter-0.10.0-py3-none-any.whl"
