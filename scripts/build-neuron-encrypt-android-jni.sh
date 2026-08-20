#!/usr/bin/env bash
# Build Pocket Relay's GPL-3.0-only Neuron Encrypt JNI library from its reviewed
# offline Rust source closure. This is intentionally invoked by Gradle, after
# F-Droid's source scanner, so the source tree never needs a committed .so.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEURON_ROOT="${ROOT}/modules/pocket-hermes-supervisor/android/neuron-encrypt"
JNI_ROOT="${NEURON_ROOT}/jni"
ANDROID_ABI="${ANDROID_ABI:-arm64-v8a}"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1704067200}"
NDK_VERSION="${ANDROID_NDK_VERSION:-27.1.12297006}"
LOCAL_PROPERTIES="${ROOT}/android/local.properties"
NDK_ROOT="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
CARGO_HOME="${CARGO_HOME:-${HOME:?HOME is required for Cargo}/.cargo}"
RUSTUP_CARGO="${CARGO_HOME}/bin/cargo"

# F-Droid installs Rustup in the recipe prebuild shell. That shell's PATH does
# not persist into the later Gradle Exec task, so prefer the deterministic
# Rustup location before accepting a local builder's already-exported cargo.
if [[ -x "${RUSTUP_CARGO}" ]]; then
  CARGO_BIN="${RUSTUP_CARGO}"
elif CARGO_BIN="$(command -v cargo 2>/dev/null)"; then
  :
else
  CARGO_BIN="${RUSTUP_CARGO}"
fi

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

NDK_BIN="${NDK_ROOT}/toolchains/llvm/prebuilt/linux-x86_64/bin"
case "${ANDROID_ABI}" in
  arm64-v8a)
    RUST_TARGET="aarch64-linux-android"
    CARGO_ENV_TARGET="AARCH64_LINUX_ANDROID"
    CLANG="${NDK_BIN}/aarch64-linux-android24-clang"
    CXX="${NDK_BIN}/aarch64-linux-android24-clang++"
    ;;
  x86_64)
    RUST_TARGET="x86_64-linux-android"
    CARGO_ENV_TARGET="X86_64_LINUX_ANDROID"
    CLANG="${NDK_BIN}/x86_64-linux-android24-clang"
    CXX="${NDK_BIN}/x86_64-linux-android24-clang++"
    ;;
  *)
    echo "Unsupported ANDROID_ABI: ${ANDROID_ABI}. Expected arm64-v8a or x86_64." >&2
    exit 1
    ;;
esac

for required in "${CARGO_BIN}" "${CLANG}" "${JNI_ROOT}/android-core/UPSTREAM.md" \
  "${JNI_ROOT}/Cargo.lock" "${JNI_ROOT}/.cargo/config.toml"; do
  [[ -e "${required}" ]] || { echo "Missing JNI build prerequisite: ${required}" >&2; exit 1; }
done
[[ -d "${JNI_ROOT}/vendor" ]] || { echo "Missing vendored Neuron Encrypt Rust closure" >&2; exit 1; }
[[ -x "${CLANG}" ]] || { echo "Android NDK clang not found at ${CLANG}" >&2; exit 1; }

TARGET_DIR="${ROOT}/.cache/neuron-encrypt-jni-${ANDROID_ABI}"
OUTPUT_DIR="${ROOT}/modules/pocket-hermes-supervisor/android/src/main/jniLibs/${ANDROID_ABI}"
OUTPUT_LIB="${OUTPUT_DIR}/libneuron_encrypt_jni.so"
rm -rf "${TARGET_DIR}"
mkdir -p "${TARGET_DIR}" "${OUTPUT_DIR}"

export ANDROID_NDK_HOME="${NDK_ROOT}"
export CARGO_HOME
export PATH="${CARGO_HOME}/bin:${PATH}"
export CARGO_NET_OFFLINE=true
export CARGO_INCREMENTAL=0
export CARGO_TARGET_DIR="${TARGET_DIR}"
export SOURCE_DATE_EPOCH TZ=UTC LC_ALL=C LANG=C
export "CC_${CARGO_ENV_TARGET}=${CLANG}"
export "CXX_${CARGO_ENV_TARGET}=${CXX}"
export "AR_${CARGO_ENV_TARGET}=${NDK_BIN}/llvm-ar"
export "CARGO_TARGET_${CARGO_ENV_TARGET}_LINKER=${CLANG}"

(
  cd "${JNI_ROOT}"
  "${CARGO_BIN}" build --release --locked --offline --target "${RUST_TARGET}"
)

BUILT_LIB="${TARGET_DIR}/${RUST_TARGET}/release/libneuron_encrypt_jni.so"
[[ -f "${BUILT_LIB}" ]] || { echo "Neuron Encrypt JNI library was not produced" >&2; exit 1; }
install -m 0644 "${BUILT_LIB}" "${OUTPUT_LIB}"
touch -d "@${SOURCE_DATE_EPOCH}" "${OUTPUT_LIB}"
echo "Built ${OUTPUT_LIB}"
