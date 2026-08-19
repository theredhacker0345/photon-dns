#!/usr/bin/env bash
# Assemble every Pocket Relay-owned Android Python wheel from local reviewed
# source. This entrypoint is deliberately network-free and is the sole Gradle
# prerequisite for Chaquopy requirement installation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The wheel assemblers are host-minor agnostic. Use the F-Droid buildserver's
# system Python unless a local reproducibility run explicitly supplies one.
PYTHON="${PYTHON:-${POCKET_HERMES_BUILDPYTHON:-python3}}"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1704067200}"

python_prefix="$(cd "$(dirname "${PYTHON}")/.." && pwd)"
if [[ -d "${python_prefix}/lib" ]]; then
  export LD_LIBRARY_PATH="${python_prefix}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
fi

export PYTHON SOURCE_DATE_EPOCH
export PIP_NO_INDEX=1
export PIP_DISABLE_PIP_VERSION_CHECK=1
export CARGO_NET_OFFLINE=true
export TZ=UTC
export LC_ALL=C
export LANG=C
export PYTHONHASHSEED=0

"${ROOT}/scripts/build-hermes-android-wheel.sh"
"${ROOT}/scripts/build-jiter-compat-wheel.sh"
"${ROOT}/scripts/build-pydantic-core-android-wheel.sh"
