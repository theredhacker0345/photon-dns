#!/usr/bin/env bash
# Rebuilds the pinned Hermes source as a no-dependencies wheel for the
# Android-specific explicit manifest. The output is intentionally ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIN="165c889e5b4277b56dadd42949a4112c1e6175a6"
VERSION="0.20.1"
PYTHON="${PYTHON:-/home/ubuntu/toolchains/cpython-3.11/bin/python3.11}"
WORK="${WORK:-${ROOT}/.cache/hermes-agent-${PIN}}"
OUT="${ROOT}/.artifacts/wheels"
REPOSITORY="https://github.com/NousResearch/hermes-agent.git"

command -v git >/dev/null
"${PYTHON}" --version | grep -q '^Python 3\.11\.'
rm -rf "${WORK}"
git clone --quiet "${REPOSITORY}" "${WORK}"
git -C "${WORK}" checkout --quiet "${PIN}"
test "$(git -C "${WORK}" rev-parse HEAD)" = "${PIN}"

mkdir -p "${OUT}"
rm -f "${OUT}/hermes_agent-${VERSION}-py3-none-any.whl"
# The reviewed Android requirements manifest supplies the explicit, pinned
# Android-safe dependency graph. Remove desktop metadata from the local wheel
# rather than allowing pip to resolve Hermes' desktop-only dependency set.
export HERMES_NIX_BUILD=1
"${PYTHON}" -m pip wheel --no-deps --wheel-dir "${OUT}" "${WORK}"
wheel="${OUT}/hermes_agent-${VERSION}-py3-none-any.whl"
test -f "${wheel}"
stage="$(mktemp -d)"
trap 'rm -rf "${stage}"' EXIT
unzip -q "${wheel}" -d "${stage}"
metadata="$(find "${stage}" -path '*/METADATA' -type f -print -quit)"
test -n "${metadata}"
grep -v '^Requires-Dist:' "${metadata}" > "${metadata}.clean"
mv "${metadata}.clean" "${metadata}"
(cd "${stage}" && zip -q -r "${wheel}" .)
sha256sum "${wheel}"
