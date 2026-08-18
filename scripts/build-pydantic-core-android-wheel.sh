#!/usr/bin/env bash
# Builds the Pydantic Core 2.46.4 Android wheel required by Hermes.
# This is a build-time helper only: the generated wheel links against
# Chaquopy's bundled libpython at runtime, never the tiny stub below.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="2.46.4"
PYTHON_TAG="cp311"
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
SOURCE_URL="https://files.pythonhosted.org/packages/9d/56/921726b776ace8d8f5db44c4ef961006580d91dc52b803c489fafd1aa249/pydantic_core-${VERSION}.tar.gz"
SOURCE_SHA256="62f875393d7f270851f20523dd2e29f082bcc82292d66db2b64ea71f64b6e1c1"

python_prefix="$(cd "$(dirname "${PYTHON}")/.." && pwd)"
if [[ -d "${python_prefix}/lib" ]]; then
  export LD_LIBRARY_PATH="${python_prefix}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
fi

for executable in curl sha256sum tar "${MATURIN}" "${PYTHON}"; do
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

rm -rf "${WORK}"
mkdir -p "${WORK}" "${OUT}"
# Maturin/PyO3 needs the target interpreter's sysconfig data when cross
# compiling. Keep this generated metadata in the ignored build workspace.
stdlib_dir="$("${PYTHON}" -c 'import sysconfig; print(sysconfig.get_path("stdlib"))')"
cp "${stdlib_dir}"/_sysconfigdata*.py "${WORK}/"
rm -f "${OUT}/pydantic_core-${VERSION}-${PYTHON_TAG}-${PYTHON_TAG}-android_24_${WHEEL_ABI}.whl"
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
echo "Built ${target_wheel}"
sha256sum "${target_wheel}"
