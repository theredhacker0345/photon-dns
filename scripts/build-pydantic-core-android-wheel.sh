#!/usr/bin/env bash
# Builds the Pydantic Core 2.46.4 Android wheel required by Hermes.
# This is a build-time helper only: the generated wheel links against
# Chaquopy's bundled libpython at runtime, never the tiny stub below.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="2.46.4"
PYTHON_TAG="cp311"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1704067200}"
NDK_ROOT="${ANDROID_NDK_HOME:-/home/ubuntu/android-sdk/ndk/27.1.12297006}"
RUSTUP_HOME="${RUSTUP_HOME:-/home/ubuntu/.rustup}"
CARGO_HOME="${CARGO_HOME:-/home/ubuntu/.cargo}"
MATURIN="${MATURIN:-}"
if [[ -z "${MATURIN}" ]]; then
  MATURIN="$(command -v maturin || true)"
fi
PYTHON="${PYTHON:-/home/ubuntu/toolchains/cpython-3.11/bin/python3.11}"
WORK="${WORK:-${ROOT}/.cache/pydantic-core-${VERSION}-android}"
OUT="${ROOT}/.artifacts/wheels"
ANDROID_ABI="${ANDROID_ABI:-arm64-v8a}"
VENDOR_SOURCE="${ROOT}/third_party/pydantic-core"
EXPECTED_TREE_SHA256="6acfaaae6fd851180487b70fd064c1b10f4b5c0a8b21250a1b1621b6822dc2a3"

python_prefix="$(cd "$(dirname "${PYTHON}")/.." && pwd)"
if [[ -d "${python_prefix}/lib" ]]; then
  export LD_LIBRARY_PATH="${python_prefix}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
fi

for executable in sha256sum "${MATURIN}" "${PYTHON}"; do
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
test -x "${MATURIN}" || { echo "maturin not executable at ${MATURIN}" >&2; exit 1; }
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
# Maturin/PyO3 needs the target interpreter's sysconfig data when cross
# compiling. Keep this generated metadata in the ignored build workspace.
stdlib_dir="$("${PYTHON}" -c 'import sysconfig; print(sysconfig.get_path("stdlib"))')"
cp "${stdlib_dir}"/_sysconfigdata*.py "${WORK}/"
rm -f "${OUT}/pydantic_core-${VERSION}-${PYTHON_TAG}-${PYTHON_TAG}-android_24_${WHEEL_ABI}.whl"
cp -a "${VENDOR_SOURCE}" "${WORK}/pydantic_core-${VERSION}"

# PyO3 adds -lpython3.11 even for a CPython extension module. Chaquopy owns
# that runtime library, so this zero-symbol link stub exists only to satisfy
# the Android cross-linker while the extension is compiled.
cat > "${WORK}/python-link-stub.c" <<'EOF'
void pocket_hermes_build_time_python_link_stub(void) {}
EOF
"${CLANG}" -shared -fPIC "${WORK}/python-link-stub.c" -o "${WORK}/libpython3.11.so"

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
export PYO3_CROSS_LIB_DIR="${WORK}"
export PYO3_CROSS_PYTHON_VERSION=3.11
export PYO3_CROSS_PYTHON_IMPLEMENTATION=CPython

SOURCE_DIR="${WORK}/pydantic_core-${VERSION}"
(
  cd "${SOURCE_DIR}"
  "${MATURIN}" build --release --target "${RUST_TARGET}" --interpreter "${PYTHON}" --compatibility off --out "${OUT}"
)

wheel="$(find "${OUT}" -maxdepth 1 -type f -name "pydantic_core-${VERSION}-*.whl" -print -quit)"
test -n "${wheel}" || { echo "Pydantic Core wheel was not produced" >&2; exit 1; }
target_wheel="${OUT}/pydantic_core-${VERSION}-${PYTHON_TAG}-${PYTHON_TAG}-android_24_${WHEEL_ABI}.whl"
if [[ "${wheel}" != "${target_wheel}" ]]; then
  mv "${wheel}" "${target_wheel}"
fi
"${PYTHON}" "${ROOT}/scripts/repackage-wheel-deterministic.py" "${target_wheel}" --epoch "${SOURCE_DATE_EPOCH}"
echo "Built ${target_wheel}"
sha256sum "${target_wheel}"
