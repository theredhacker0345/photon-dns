#!/usr/bin/env bash
# Builds the Pydantic Core 2.46.4 Android wheel required by Hermes.
# This is a build-time helper only: the generated wheel links against
# Chaquopy's bundled libpython at runtime, never the tiny stub below.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="2.46.4"
PYTHON_TAG="cp311"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1704067200}"
NDK_VERSION="${ANDROID_NDK_VERSION:-27.1.12297006}"
LOCAL_PROPERTIES="${ROOT}/android/local.properties"
NDK_ROOT="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [[ -z "${NDK_ROOT}" && -f "${LOCAL_PROPERTIES}" ]]; then
  NDK_ROOT="$(sed -n -e 's/^ndk\.dir=//p' "${LOCAL_PROPERTIES}" | head -n 1)"
fi
if [[ -z "${NDK_ROOT}" ]]; then
  SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [[ -z "${SDK_ROOT}" && -f "${LOCAL_PROPERTIES}" ]]; then
    SDK_ROOT="$(sed -n -e 's/^sdk\.dir=//p' "${LOCAL_PROPERTIES}" | head -n 1)"
  fi
  [[ -n "${SDK_ROOT}" ]] || {
    echo "Android SDK root is required; set ANDROID_NDK_HOME, ANDROID_NDK_ROOT, ANDROID_HOME, or ANDROID_SDK_ROOT" >&2
    exit 1
  }
  NDK_ROOT="${SDK_ROOT}/ndk/${NDK_VERSION}"
fi
RUSTUP_HOME="${RUSTUP_HOME:-${HOME:?HOME is required for Rustup}/.rustup}"
CARGO_HOME="${CARGO_HOME:-${HOME:?HOME is required for Cargo}/.cargo}"
PYTHON="${POCKET_HERMES_BUILDPYTHON:-${PYTHON:-python3}}"
WORK="${WORK:-${ROOT}/.cache/pydantic-core-${VERSION}-android}"
OUT="${ROOT}/.artifacts/wheels"
ANDROID_ABI="${ANDROID_ABI:-arm64-v8a}"
VENDOR_SOURCE="${ROOT}/third_party/pydantic-core"
EXPECTED_TREE_SHA256="6acfaaae6fd851180487b70fd064c1b10f4b5c0a8b21250a1b1621b6822dc2a3"

python_prefix="$(cd "$(dirname "${PYTHON}")/.." && pwd)"
if [[ -d "${python_prefix}/lib" ]]; then
  export LD_LIBRARY_PATH="${python_prefix}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
fi

for executable in sha256sum cargo "${PYTHON}"; do
  command -v "${executable}" >/dev/null 2>&1 || {
    echo "Missing build prerequisite: ${executable}" >&2
    exit 1
  }
done

NDK_BIN="${NDK_ROOT}/toolchains/llvm/prebuilt/linux-x86_64/bin"
case "${ANDROID_ABI}" in
  arm64-v8a)
    RUST_TARGET="aarch64-linux-android"
    WHEEL_ABI="arm64_v8a"
    CLANG="${NDK_BIN}/aarch64-linux-android24-clang"
    CXX="${NDK_BIN}/aarch64-linux-android24-clang++"
    CARGO_ENV_TARGET="AARCH64_LINUX_ANDROID"
    ;;
  x86_64)
    RUST_TARGET="x86_64-linux-android"
    WHEEL_ABI="x86_64"
    CLANG="${NDK_BIN}/x86_64-linux-android24-clang"
    CXX="${NDK_BIN}/x86_64-linux-android24-clang++"
    CARGO_ENV_TARGET="X86_64_LINUX_ANDROID"
    ;;
  *)
    echo "Unsupported ANDROID_ABI: ${ANDROID_ABI}. Expected arm64-v8a or x86_64." >&2
    exit 1
    ;;
esac
test -x "${CLANG}" || { echo "Android NDK clang not found at ${CLANG}" >&2; exit 1; }
test -f "${VENDOR_SOURCE}/UPSTREAM.md" || { echo "Missing Pydantic Core provenance manifest: ${VENDOR_SOURCE}/UPSTREAM.md" >&2; exit 1; }
test -f "${VENDOR_SOURCE}/Cargo.lock" || { echo "Missing vendored Pydantic Core Cargo.lock" >&2; exit 1; }
test -f "${VENDOR_SOURCE}/.cargo/config.toml" || { echo "Missing offline Cargo source replacement" >&2; exit 1; }
test -d "${VENDOR_SOURCE}/vendor" || { echo "Missing vendored Rust dependency closure" >&2; exit 1; }

actual_tree_sha256="$({
  cd "${VENDOR_SOURCE}"
  find . -type f ! -path './UPSTREAM.md' -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
})"
if [[ "${actual_tree_sha256}" != "${EXPECTED_TREE_SHA256}" ]]; then
  echo "Vendored Pydantic Core tree digest mismatch" >&2
  echo "Expected: ${EXPECTED_TREE_SHA256}" >&2
  echo "Actual:   ${actual_tree_sha256}" >&2
  exit 1
fi

rm -rf "${WORK}"
mkdir -p "${WORK}" "${OUT}"
# Do not copy the build host's sysconfig data: F-Droid builds on Python 3.13,
# whereas this wheel targets the embedded CPython 3.11 Android ABI. PyO3's
# explicit configuration file keeps those target facts independent of the host.
rm -f "${OUT}/pydantic_core-${VERSION}-${PYTHON_TAG}-${PYTHON_TAG}-android_24_${WHEEL_ABI}.whl"
cp -a "${VENDOR_SOURCE}" "${WORK}/pydantic_core-${VERSION}"

# PyO3 adds -lpython3.11 even for a CPython extension module. Chaquopy owns
# that runtime library, so this zero-symbol link stub exists only to satisfy
# the Android cross-linker while the extension is compiled.
cat > "${WORK}/python-link-stub.c" <<'EOF'
void pocket_hermes_build_time_python_link_stub(void) {}
EOF
"${CLANG}" -shared -fPIC "${WORK}/python-link-stub.c" -o "${WORK}/libpython3.11.so"
cat > "${WORK}/pyo3-config.txt" <<EOF
implementation=CPython
version=3.11
shared=true
abi3=false
lib_name=python3.11
lib_dir=${WORK}
pointer_width=64
build_flags=
EOF

export RUSTUP_HOME CARGO_HOME
export ANDROID_NDK_HOME="${NDK_ROOT}"
export CARGO_NET_OFFLINE=true
export CARGO_INCREMENTAL=0
export SOURCE_DATE_EPOCH TZ=UTC LC_ALL=C LANG=C PYTHONHASHSEED=0
export "CC_${CARGO_ENV_TARGET}=${CLANG}"
export "CXX_${CARGO_ENV_TARGET}=${CXX}"
export "AR_${CARGO_ENV_TARGET}=${NDK_BIN}/llvm-ar"
export "CARGO_TARGET_${CARGO_ENV_TARGET}_LINKER=${CLANG}"
export RUSTFLAGS="${RUSTFLAGS:-} -L native=${WORK}"
export PYO3_CROSS=1
export PYO3_CONFIG_FILE="${WORK}/pyo3-config.txt"

SOURCE_DIR="${WORK}/pydantic_core-${VERSION}"
(
  cd "${SOURCE_DIR}"
  cargo build --release --locked --target "${RUST_TARGET}"
)

extension="${SOURCE_DIR}/target/${RUST_TARGET}/release/lib_pydantic_core.so"
test -f "${extension}" || { echo "Pydantic Core extension was not produced" >&2; exit 1; }
target_wheel="${OUT}/pydantic_core-${VERSION}-${PYTHON_TAG}-${PYTHON_TAG}-android_24_${WHEEL_ABI}.whl"
"${PYTHON}" "${ROOT}/scripts/build-pydantic-core-android-wheel.py" \
  --source "${SOURCE_DIR}" \
  --extension "${extension}" \
  --output "${target_wheel}" \
  --epoch "${SOURCE_DATE_EPOCH}" \
  --tag "${PYTHON_TAG}-${PYTHON_TAG}-android_24_${WHEEL_ABI}"
echo "Built ${target_wheel}"
sha256sum "${target_wheel}"
