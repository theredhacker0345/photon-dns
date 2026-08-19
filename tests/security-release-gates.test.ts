import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("security and FOSS release gates", () => {
  it("documents actual data boundaries, owner controls, and explicit Android limitations", () => {
    const threatModel = read("docs/threat-model.md");
    const privacy = read("docs/privacy.md");
    expect(threatModel).toContain("single private numeric owner identity");
    expect(threatModel).toContain("not a general-purpose remote shell");
    expect(threatModel).toContain("guarantee that Android will keep a process alive");
    expect(privacy).toContain("does not include an app analytics SDK");
    expect(privacy).toContain("Configured HTTPS model endpoint");
    expect(privacy).toContain("native configuration deletion path");
  });

  it("keeps the JavaScript production SBOM and release license gate reproducible from source", () => {
    const generator = read("scripts/generate-js-sbom.mjs");
    const audit = read("scripts/audit-release-licenses.mjs");
    const packageJson = read("package.json");
    expect(generator).toContain('"production-js"');
    expect(generator).toContain("unresolved-production-dependencies");
    expect(audit).toContain('"manual-review"');
    expect(audit).toContain('"blocked"');
    expect(audit).toContain('report.counts["manual-review"] > 0');
    expect(read("docs/license-verification.md")).toContain("seq-queue@0.0.5");
    expect(packageJson).toContain('"sbom:js"');
    expect(packageJson).toContain('"audit:licenses"');
  });

  it("keeps a Metro-only app graph and an unsigned-by-default F-Droid release path", () => {
    const packageJson = read("package.json");
    const appConfig = read("app.config.ts");
    const gradle = read("android/app/build.gradle");
    const preflight = read("scripts/release-preflight.mjs");
    const policy = read("docs/reproducible-release-policy.md");
    const fdroidChecklist = read("docs/fdroid-submission-checklist.md");

    expect(packageJson).toContain('"dev": "pnpm dev:metro"');
    expect(packageJson).not.toContain('"dev:server"');
    expect(appConfig).toContain('const rawBundleId = "com.app.pockethermes"');
    expect(appConfig).toContain('"./plugins/with-release-signing"');
    expect(gradle).toContain("assembling an unsigned release artifact for F-Droid signing");
    const buildTypes = gradle.slice(gradle.indexOf("buildTypes {"));
    const releaseBlock = buildTypes.slice(buildTypes.indexOf("release {"), buildTypes.indexOf("proguardFiles"));
    expect(releaseBlock).not.toContain("signingConfig signingConfigs.debug");
    expect(preflight).toContain("Git tag");
    expect(preflight).toContain("manual-review");
    expect(policy).toContain("public HTTPS Git repository");
    expect(fdroidChecklist).toContain("immutable release tag");
  });

  it("keeps the Android Gradle source project in the public release tree", () => {
    const gitignore = read(".gitignore");

    expect(gitignore).not.toMatch(/^\/android$/m);
    expect(gitignore).toContain("/android/.gradle/");
    expect(gitignore).toContain("/android/app/debug.keystore");
    expect(read("android/settings.gradle")).toContain("rootProject.name");
    expect(read("android/app/build.gradle")).toContain("com.android.application");
  });

  it("declares GPLv3-only app-owned code and preserves contributor governance", () => {
    const packageJson = read("package.json");
    const fdroidMetadata = read("metadata/com.app.pockethermes.yml");
    const license = read("LICENSE");
    const notice = read("THIRD_PARTY_NOTICES.md");
    const copyrightPolicy = read("COPYRIGHT_POLICY.md");
    const contributors = read("CONTRIBUTORS.md");
    const contributing = read("CONTRIBUTING.md");
    const preflight = read("scripts/release-preflight.mjs");

    expect(packageJson).toContain('"license": "GPL-3.0-only"');
    expect(fdroidMetadata).toContain("License: GPL-3.0-only");
    expect(license).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(license).toContain("Version 3, 29 June 2007");
    expect(notice).toContain("GPL-3.0-only");
    expect(copyrightPolicy).toContain("Inbound equals outbound");
    expect(copyrightPolicy).toContain("GPL-3.0-only");
    expect(contributors).toContain("Pocket Relay Maintainer");
    expect(contributing).toContain("Signed-off-by:");
    expect(preflight).toContain("GPL-3.0-only");
  });

  it("builds the pinned Hermes worker only from verified local source and stable release inputs", () => {
    const provenance = read("third_party/hermes-agent/UPSTREAM.md");
    const vendorLicense = read("third_party/hermes-agent/LICENSE");
    const wheelBuild = read("scripts/build-hermes-android-wheel.sh");
    const wheelAssembler = read("scripts/build-hermes-android-wheel.py");
    const nativeGradle = read("modules/pocket-hermes-supervisor/android/build.gradle");
    const pythonSbom = read("scripts/generate-sbom.mjs");

    expect(provenance).toContain("165c889e5b4277b56dadd42949a4112c1e6175a6");
    expect(provenance).toContain("Stable content digest");
    expect(vendorLicense).toContain("MIT License");
    expect(wheelBuild).toContain("third_party/hermes-agent");
    expect(wheelBuild).toContain("EXPECTED_DIGEST");
    expect(wheelBuild).toContain("build-hermes-android-wheel.py");
    expect(wheelBuild).not.toContain("git clone");
    expect(wheelAssembler).toContain('parser.add_argument("--epoch"');
    expect(wheelAssembler).toContain("ZipInfo(path, date_time=date_time)");
    expect(nativeGradle).toContain("buildPocketRelayPythonWheels");
    expect(nativeGradle).toContain("installReleasePythonRequirements");
    expect(pythonSbom).toContain("vendoredHermesDigest");
    expect(pythonSbom).toContain("SOURCE_DATE_EPOCH");
    expect(pythonSbom).not.toContain("fetch(");
    expect(pythonSbom).not.toContain("randomUUID");
  });

  it("keeps the F-Droid build interpreter portable while targeting CPython 3.11 on Android", () => {
    const nativeGradle = read("modules/pocket-hermes-supervisor/android/build.gradle");
    const wheelBuild = read("scripts/build-android-python-wheels.sh");
    const pydanticBuild = read("scripts/build-pydantic-core-android-wheel.sh");
    const reproducibleBuild = read("scripts/reproducible-android-build.sh");
    const gitignore = read(".gitignore");

    expect(nativeGradle).toContain('com.chaquo.python:gradle:16.1.0');
    expect(nativeGradle).toContain('version = "3.11"');
    expect(nativeGradle).toContain('?: "python3"');
    expect(nativeGradle).not.toContain('?: "python3.11"');
    expect(wheelBuild).toContain('PYTHON="${PYTHON:-${POCKET_HERMES_BUILDPYTHON:-python3}}"');
    expect(pydanticBuild).not.toContain("_sysconfigdata*.py");
    expect(pydanticBuild).toContain('NDK_VERSION="${ANDROID_NDK_VERSION:-27.1.12297006}"');
    expect(pydanticBuild).toContain('LOCAL_PROPERTIES="${ROOT}/android/local.properties"');
    expect(pydanticBuild).toContain('ANDROID_NDK_HOME, ANDROID_NDK_ROOT, ANDROID_HOME, or ANDROID_SDK_ROOT');
    expect(pydanticBuild).not.toContain("/home/ubuntu/android-sdk");
    expect(pydanticBuild).toContain('RUSTUP_HOME="${RUSTUP_HOME:-${HOME:?HOME is required for Rustup}/.rustup}"');
    expect(pydanticBuild).toContain('CARGO_HOME="${CARGO_HOME:-${HOME:?HOME is required for Cargo}/.cargo}"');
    expect(pydanticBuild).toContain('PYO3_CONFIG_FILE="${WORK}/pyo3-config.txt"');
    expect(pydanticBuild).toContain('implementation=CPython');
    expect(pydanticBuild).toContain('version=3.11');
    expect(pydanticBuild).toContain('lib_name=python3.11');
    expect(pydanticBuild).not.toContain('PYO3_NO_PYTHON=1');
    expect(pydanticBuild).toContain('git -C "${ROOT}" ls-tree -r --name-only HEAD -- "${VENDOR_RELATIVE}"');
    expect(pydanticBuild).toContain('EXPECTED_TREE_SHA256="4754bc4a465b6681a5cfaffbbcd8b5bc5252f25f71ea7b34ae16beff55b24312"');
    expect(pydanticBuild).not.toContain("find . -type f ! -path './UPSTREAM.md'");
    expect(reproducibleBuild).toContain('PYTHON="${POCKET_HERMES_BUILDPYTHON:-python3}"');
    expect(gitignore).toContain("!third_party/pydantic-core/vendor/**/build/");
    expect(gitignore).toContain("!third_party/pydantic-core/vendor/**/build/**");
    expect(read("third_party/pydantic-core/vendor/proc-macro2-1.0.86/build/probe.rs")).toContain("proc_macro_span");
    expect(read("third_party/pydantic-core/vendor/rustversion-1.0.17/build/build.rs")).toContain("rustc");
    expect(read("third_party/pydantic-core/vendor/rustversion-1.0.17/build/rustc.rs")).toContain("Version");
  });

  it("provisions the required Java and Cargo host toolchains while retaining the pipeline-canonical F-Droid prebuild layout", () => {
    const fdroidMetadata = read("metadata/com.app.pockethermes.yml");

    expect(fdroidMetadata).toContain("https://deb.debian.org/debian bullseye main");
    expect(fdroidMetadata).toContain("/etc/apt/sources.list.d/bullseye.list");
    expect(fdroidMetadata).toContain("apt-get install -y -t bullseye openjdk-17-jdk-headless");
    expect(fdroidMetadata).toContain("apt-get install -y build-essential nodejs npm");
    expect(fdroidMetadata).toContain("--profile minimal\n        --target aarch64-linux-android");
    expect(fdroidMetadata).toContain("source $HOME/.cargo/env && bash ../scripts/build-android-python-wheels.sh");
  });

  it("keeps every native dependency reviewable at scan time and moves store assets upstream", () => {
    const fdroidMetadata = read("metadata/com.app.pockethermes.yml");
    const jniBuild = read("scripts/build-neuron-encrypt-android-jni.sh");
    const jniCargo = read("modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/Cargo.toml");
    const jniCargoConfig = read("modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/.cargo/config.toml");
    const nativeGradle = read("modules/pocket-hermes-supervisor/android/build.gradle");
    const pythonWheelBuild = read("scripts/build-android-python-wheels.sh");
    const fullDescription = read("fastlane/metadata/android/en-US/full_description.txt");

    expect(fdroidMetadata).toContain("AuthorName: Ubaid ur Rehman");
    expect(fdroidMetadata).not.toContain("Binaries:");
    expect(fdroidMetadata).not.toContain("AllowedAPKSigningKeys:");
    expect(fdroidMetadata).toContain("AutoUpdateMode: None");
    expect(jniBuild).toContain("cargo build --release --locked --offline");
    expect(jniBuild).toContain("${JNI_ROOT}/vendor");
    expect(jniCargo).toContain('path = "android-core"');
    expect(jniCargoConfig).toContain('directory = "vendor"');
    expect(nativeGradle).toContain("buildNeuronEncryptArm64");
    expect(nativeGradle).toContain("dependsOn(buildNeuronEncryptArm64)");
    expect(pythonWheelBuild).toContain("rm -rf \"${ROOT}/.cache/pydantic-core-");
    expect(read("fastlane/metadata/android/en-US/images/icon.png").length).toBeGreaterThan(0);
    expect(read("fastlane/metadata/android/en-US/images/phoneScreenshots/1.png").length).toBeGreaterThan(0);
    expect(fullDescription).toContain("<ul>");
  });
});
