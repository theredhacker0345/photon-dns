#!/usr/bin/env bash
# Rebuilds the verified vendored Hermes source as a no-dependencies wheel for
# the Android-specific explicit manifest. This script is network-free by
# design: release builds must never clone or download Hermes Agent source.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIN="165c889e5b4277b56dadd42949a4112c1e6175a6"
VERSION="0.20.1"
PYTHON="${PYTHON:-/home/ubuntu/toolchains/cpython-3.11/bin/python3.11}"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1786807638}"
VENDORED_SOURCE="${ROOT}/third_party/hermes-agent"
OUT="${ROOT}/.artifacts/wheels"
EXPECTED_DIGEST="052ef8ebe1defc3307288b534299f63951afe9c6bd3aeffd9bfd44375f18735a"

"${PYTHON}" --version | grep -q '^Python 3\.11\.'
test -f "${VENDORED_SOURCE}/UPSTREAM.md"
test -f "${VENDORED_SOURCE}/LICENSE"
grep -Fq "${PIN}" "${VENDORED_SOURCE}/UPSTREAM.md"
grep -Fq "MIT" "${VENDORED_SOURCE}/LICENSE"

actual_digest="$(
  cd "${VENDORED_SOURCE}"
  find . -type f ! -name UPSTREAM.md -printf '%P\n' | LC_ALL=C sort |
    while IFS= read -r path; do
      printf '%s  ' "${path}"
      sha256sum "${path}" | awk '{print $1}'
    done | sha256sum | awk '{print $1}'
)"
test "${actual_digest}" = "${EXPECTED_DIGEST}"

mkdir -p "${OUT}"
rm -f "${OUT}/hermes_agent-${VERSION}-py3-none-any.whl"
# The reviewed Android requirements manifest supplies the explicit, pinned
# Android-safe dependency graph. Assemble the wheel without desktop metadata
# or a third-party build-backend download.
export HERMES_NIX_BUILD=1 SOURCE_DATE_EPOCH TZ=UTC LC_ALL=C LANG=C PYTHONHASHSEED=0
wheel="${OUT}/hermes_agent-${VERSION}-py3-none-any.whl"
"${PYTHON}" "${ROOT}/scripts/build-hermes-android-wheel.py" --source "${VENDORED_SOURCE}" --output "${wheel}" --epoch "${SOURCE_DATE_EPOCH}"
test -f "${wheel}"
sha256sum "${wheel}"
