#!/usr/bin/env bash
# Builds the project-owned MIT pure-Python jiter compatibility wheel.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-/home/ubuntu/toolchains/cpython-3.11/bin/python3.11}"
SOURCE="${ROOT}/modules/pocket-hermes-supervisor/android/src/main/python/vendor/jiter-compat"
OUT="${ROOT}/.artifacts/wheels"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1704067200}"

mkdir -p "${OUT}"
rm -f "${OUT}/jiter-0.10.0-py3-none-any.whl"
test -f "${SOURCE}/pyproject.toml" || { echo "Missing local Jiter compatibility source" >&2; exit 1; }
export SOURCE_DATE_EPOCH TZ=UTC LC_ALL=C LANG=C PYTHONHASHSEED=0 PIP_NO_INDEX=1 PIP_DISABLE_PIP_VERSION_CHECK=1
"${PYTHON}" "${ROOT}/scripts/build-jiter-compat-wheel.py" \
  --source "${SOURCE}" \
  --output "${OUT}/jiter-0.10.0-py3-none-any.whl" \
  --epoch "${SOURCE_DATE_EPOCH}"
sha256sum "${OUT}/jiter-0.10.0-py3-none-any.whl"
