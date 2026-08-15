#!/usr/bin/env bash
# Builds the Pydantic Core 2.46.4 Android ARM64 wheel required by Hermes.
# This is a build-time helper only: the generated wheel links against
# Chaquopy's bundled libpython at runtime, never the tiny stub below.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="2.46.4"
PYTHON_TAG="cp311"
NDK_ROOT="${ANDROID_NDK_HOME:-/home/ubuntu/android-sdk/ndk/27.1.12297006}"
RUSTUP_HOME="${RUSTUP_HOME:-/home/ubuntu/.rustup}"
CARGO_HOME="${CARGO_HOME:-/home/ubuntu/.cargo}"
MATURIN="${MATURIN:-${CARGO_HOME}/bin/maturin}"
WORK="${WORK:-${ROOT}/.cache/pydantic-core-${VERSION}-android}"
OUT="${ROOT}/.artifacts/wheels"
SOURCE_URL="https://files.pythonhosted.org/packages/9d/56/921726b776ace8d8f5db44c4ef961006580d91dc52b803c489fafd1aa249/pydantic_core-${VERSION}.tar.gz"
SOURCE_SHA256="62f875393d7f270851f20523dd2e29f082bcc82292d66db2b64ea71f64b6e1c1"

for executable in curl sha256sum tar "${MATURIN}"; do
  command -v "${executable}" >/dev/null 2>&1 || {
    echo "Missing build prerequisite: ${executable}" >&2
    exit 1
  }
done

NDK_BIN="${NDK_ROOT}/toolchains/llvm/prebuilt/linux-x86_64/bin"
CLANG="${NDK_BIN}/aarch64-linux-android24-clang"
test -x "${CLANG}" || { echo "Android NDK clang not found at ${CLANG}" >&2; exit 1; }
test -x "${MATURIN}" || { echo "maturin not executable at ${MATURIN}" >&2; exit 1; }

rm -rf "${WORK}"
mkdir -p "${WORK}" "${OUT}"
rm -f "${OUT}/pydantic_core-${VERSION}-"*.whl
curl --fail --silent --show-error --location "${SOURCE_URL}" --output "${WORK}/source.tar.gz"
echo "${SOURCE_SHA256}  ${WORK}/source.tar.gz" | sha256sum --check --status
tar -xzf "${WORK}/source.tar.gz" -C "${WORK}"

# PyO3 adds -lpython3.11 even for a CPython extension module. Chaquopy owns
# that runtime library, so this zero-symbol link stub exists only to satisfy
# the Android cross-linker while the extension is compiled.
cat > "${WORK}/python-link-stub.c" <<'EOF'
void pocket_hermes_build_time_python_link_stub(void) {}
EOF
"${CLANG}" -shared -fPIC "${WORK}/python-link-stub.c" -o "${WORK}/libpython3.11.so"

export RUSTUP_HOME CARGO_HOME
export ANDROID_NDK_HOME="${NDK_ROOT}"
export CC_aarch64_linux_android="${CLANG}"
export CXX_aarch64_linux_android="${NDK_BIN}/aarch64-linux-android24-clang++"
export AR_aarch64_linux_android="${NDK_BIN}/llvm-ar"
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="${CLANG}"
export RUSTFLAGS="${RUSTFLAGS:-} -L native=${WORK}"
export PYO3_CROSS=1
export PYO3_CROSS_PYTHON_VERSION=3.11
export PYO3_CROSS_PYTHON_IMPLEMENTATION=CPython

SOURCE_DIR="${WORK}/pydantic_core-${VERSION}"
(
  cd "${SOURCE_DIR}"
  "${MATURIN}" build --release --target aarch64-linux-android --interpreter python3.11 --compatibility off --out "${OUT}"
)

wheel="$(find "${OUT}" -maxdepth 1 -type f -name "pydantic_core-${VERSION}-*.whl" -print -quit)"
test -n "${wheel}" || { echo "Pydantic Core wheel was not produced" >&2; exit 1; }
target_wheel="${OUT}/pydantic_core-${VERSION}-${PYTHON_TAG}-${PYTHON_TAG}-android_24_arm64_v8a.whl"
mv "${wheel}" "${target_wheel}"
echo "Built ${target_wheel}"
sha256sum "${target_wheel}"
