#!/usr/bin/env bash
# Produces the unsigned ARM64 release APK in a hermetic, deterministic mode.
# Run it twice from clean state and compare SHA-256 before claiming a candidate
# is reproducible. This script never signs or publishes an artifact.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${POCKET_HERMES_BUILDPYTHON:-python3}"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1786807638}"

export SOURCE_DATE_EPOCH TZ=UTC LC_ALL=C LANG=C PYTHONHASHSEED=0
export POCKET_HERMES_BUILDPYTHON="${PYTHON}"

cd "${ROOT}/android"
./gradlew --no-daemon --no-parallel --no-configuration-cache --no-build-cache \
  :app:assembleRelease "$@"
