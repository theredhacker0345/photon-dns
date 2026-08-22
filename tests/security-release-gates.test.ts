import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
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
    const cargoVendorPreparation = read("scripts/prepare-fdroid-cargo-vendor.py");
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
    expect(pydanticBuild).toContain('FDROID_SCANNER_DELETED_PREFIX="./vendor/regex-automata-0.4.13/tests/fuzz/testdata/"');
    expect(pydanticBuild).toContain('FDROID_SCANNER_DELETED_SENTINEL="${VENDOR_SOURCE}/${FDROID_SCANNER_DELETED_PREFIX#./}deserialize_dense_crash-9486fb7c8a93b12c12a62166b43d31640c0208a9"');
    expect(pydanticBuild).toContain('FDROID_SCANNER_DELETED_TREE_SHA256="c596f778e585215cb3f63000abfa35f660c7dc9cfad7240e9a40a19cd5d51495"');
    expect(pydanticBuild).toContain('scanner_deleted_filter=(grep -v "^${FDROID_SCANNER_DELETED_PREFIX}")');
    expect(pydanticBuild).toContain('if [[ -f "${FDROID_SCANNER_DELETED_SENTINEL}" ]]; then');
    expect(pydanticBuild).toContain('"${PYTHON}" "${ROOT}/scripts/prepare-fdroid-cargo-vendor.py"');
    expect(pydanticBuild).toContain('--manifest "${SOURCE_DIR}/${FDROID_SCANNER_DELETED_CARGO_CHECKSUM}"');
    expect(pydanticBuild).toContain('--prefix "${FDROID_SCANNER_DELETED_CARGO_PREFIX}"');
    expect(pydanticBuild).toContain("--expected-removed-count 9");
    expect(cargoVendorPreparation).toContain("F-Droid removes scanner-excluded source fixtures");
    expect(cargoVendorPreparation).toContain("Unexpected F-Droid scanner deletion set");
    expect(cargoVendorPreparation).toContain("Refusing to prune Cargo checksums while scanner-excluded fixtures remain");
    expect(pydanticBuild).not.toContain("find . -type f ! -path './UPSTREAM.md'");
    expect(reproducibleBuild).toContain('PYTHON="${POCKET_HERMES_BUILDPYTHON:-python3}"');
    expect(gitignore).toContain("!third_party/pydantic-core/vendor/**/build/");
    expect(gitignore).toContain("!third_party/pydantic-core/vendor/**/build/**");
    expect(read("third_party/pydantic-core/vendor/proc-macro2-1.0.86/build/probe.rs")).toContain("proc_macro_span");
    expect(read("third_party/pydantic-core/vendor/rustversion-1.0.17/build/build.rs")).toContain("rustc");
    expect(read("third_party/pydantic-core/vendor/rustversion-1.0.17/build/rustc.rs")).toContain("Version");
  });

  it("provisions the required Java and Cargo host toolchains with linsui's canonical F-Droid build layout", () => {
    const fdroidMetadata = read("metadata/com.app.pockethermes.yml");
    const appGradle = read("android/app/build.gradle");

    expect(fdroidMetadata).toContain("subdir: android/app");
    expect(fdroidMetadata).toContain("https://deb.debian.org/debian bookworm main");
    expect(fdroidMetadata).toContain("/etc/apt/sources.list.d/bookworm.list");
    expect(fdroidMetadata).toContain("apt-get install -y -t bookworm openjdk-17-jdk-headless");
    expect(fdroidMetadata).toContain("apt-get install -y build-essential nodejs npm rustup");
    expect(fdroidMetadata).toContain("init:\n      - cd ../..");
    expect(fdroidMetadata).toContain("npm exec --yes --package=pnpm@9.12.0 -- pnpm install --frozen-lockfile");
    expect(fdroidMetadata).not.toContain("npm install pnpm@9.12.0 --no-save --no-package-lock");
    expect(fdroidMetadata).not.toContain("rustup-init.sh");
    expect(fdroidMetadata).not.toContain("srclibs:\n      - rustup@");
    expect(fdroidMetadata).toContain("rustup default 1.88.0\n      - rustup target add aarch64-linux-android");
    expect(fdroidMetadata).toContain('echo "hermesEnabled=false" >> ../gradle.properties');
    expect(fdroidMetadata).toContain('echo "deb https://deb.debian.org/debian bookworm main" > /etc/apt/sources.list.d/bookworm.list');
    expect(fdroidMetadata).toContain("Optional Telegram gateway and third-party AI provider endpoints are non-free\n      network services.");
    expect(fdroidMetadata).toContain("build: bash ../../scripts/build-android-python-wheels.sh");
    expect(fdroidMetadata).not.toContain("output: app/build/outputs/apk/release/app-release-unsigned.apk");
    expect(fdroidMetadata).not.toContain("source $HOME/.cargo/env");
    expect(appGradle).toContain("if (hermesEnabled.toBoolean())");
    expect(appGradle).toContain("implementation jscFlavor");
  });

  it("keeps every native dependency reviewable at scan time and moves store assets upstream", () => {
    const fdroidMetadata = read("metadata/com.app.pockethermes.yml");
    const jniBuild = read("scripts/build-neuron-encrypt-android-jni.sh");
    const jniCargo = read("modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/Cargo.toml");
    const jniCargoConfig = read("modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/.cargo/config.toml");
    const nativeGradle = read("modules/pocket-hermes-supervisor/android/build.gradle");
    const pythonWheelBuild = read("scripts/build-android-python-wheels.sh");
    const fullDescription = read("fastlane/metadata/android/en-US/full_description.txt");
    const expoPreparation = read("scripts/prepare-fdroid-expo-autolinking.mjs");
    const packageJson = read("package.json");

    expect(fdroidMetadata).toContain("AuthorName: Ubaid ur Rehman");
    expect(fdroidMetadata).toContain("NonFreeNet:\n    en-US: Optional Telegram gateway and third-party AI provider endpoints are");
    expect(fdroidMetadata).toContain("non-free\n      network services.");
    expect(fdroidMetadata).not.toContain("Binaries:");
    expect(fdroidMetadata).not.toContain("AllowedAPKSigningKeys:");
    expect(fdroidMetadata).toContain("AutoUpdateMode: None");
    expect(fdroidMetadata).toContain("commit: 34f91102a2ae34fba89053fc3b17576fce40aade");
    expect(fdroidMetadata).toContain("node scripts/prepare-fdroid-expo-autolinking.mjs");
    expect(fdroidMetadata).toContain("gradle:\n      - yes");
    expect(fdroidMetadata).not.toContain("gradle:\n      - release");
    expect(jniBuild).toContain('"${CARGO_BIN}" build --release --locked --offline');
    expect(jniBuild).toContain('RUSTUP_CARGO="${CARGO_HOME}/bin/cargo"');
    expect(jniBuild).toContain('if [[ -x "${RUSTUP_CARGO}" ]]; then');
    expect(jniBuild).toContain('CARGO_BIN="${RUSTUP_CARGO}"');
    expect(jniBuild).toContain('elif CARGO_BIN="$(command -v cargo 2>/dev/null)"; then');
    expect(jniBuild).toContain("${JNI_ROOT}/vendor");
    expect(jniCargo).toContain('path = "android-core"');
    expect(jniCargoConfig).toContain('directory = "vendor"');
    expect(nativeGradle).toContain("buildNeuronEncryptArm64");
    expect(nativeGradle).toContain("dependsOn(buildNeuronEncryptArm64)");
    expect(pythonWheelBuild).toContain("rm -rf \"${ROOT}/.cache/pydantic-core-");
    expect(read("fastlane/metadata/android/en-US/images/icon.png").length).toBeGreaterThan(0);
    expect(read("fastlane/metadata/android/en-US/images/phoneScreenshots/1.png").length).toBeGreaterThan(0);
    expect(fullDescription).toContain("<ul>");
    expect(expoPreparation).toContain('const expectedVersion = "3.0.23"');
    expect(expoPreparation).toContain('"resolve", "--platform", "android", "--json"');
    expect(expoPreparation).toContain("extraDependencies.length !== 0");
    expect(expoPreparation).toContain("the locked dependency graph requires extra Android Maven repositories");
    expect(expoPreparation).toContain('url "${mavenRepo.url}"');
    expect(expoPreparation).toContain("Pocket Relay has no resolved extra Android Maven repositories.");
    expect(expoPreparation).toContain('const beforeProjectClosure = "    }\\n\\n"');
    expect(expoPreparation).toContain("settings-phase beforeProject closure");
    expect(expoPreparation).toContain('"node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"');
    expect(expoPreparation).toContain("mavenLocal().url");
    expect(expoPreparation).toContain("Pocket Relay does not publish Maven artifacts during F-Droid builds.");
    expect(expoPreparation).toContain("Expo Modules Core mavenLocal repository remained after preparation");
    expect(expoPreparation).toContain("neither the expected source nor the prepared form");
    expect(expoPreparation).toContain("Expo Android build-from-source configuration drifted");
    expect(expoPreparation).toContain("Expo Android local Maven publication set changed");
    expect(expoPreparation).toContain("sourceBuiltExpoPackages");
    expect(expoPreparation).toContain("reactNativeModuleRepositoryTransforms");
    expect(expoPreparation).toContain("@react-native-async-storage/async-storage/android/build.gradle");
    expect(expoPreparation).toContain("react-native-safe-area-context/android/build.gradle");
    expect(expoPreparation).toContain("react-native-screens/android/build.gradle");
    expect(expoPreparation).toContain("Pocket Relay resolves React Android from Maven Central during F-Droid builds.");
    expect(expoPreparation).toContain("expected one removable React Native repository block");
    expect(expoPreparation).toContain("React Native Gradle structure changed unexpectedly");
    expect(packageJson).toContain('"buildFromSource"');
    expect(packageJson).toContain('"expo-file-system"');
    expect(packageJson).toContain('"expo-secure-store"');
  });

  it("keeps the Android-reachable Neuron Encrypt Cargo closure tracked without adding a Windows prebuilt archive", () => {
    const vendorRoot = "modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/vendor";
    const excludedWindowsImportArchives = [
      "modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/vendor/windows_aarch64_gnullvm/lib/libwindows.a",
      "modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/vendor/windows_i686_gnu/lib/libwindows.a",
      "modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/vendor/windows_x86_64_gnu/lib/libwindows.a",
      "modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/vendor/windows_x86_64_gnullvm/lib/libwindows.a",
    ];
    const tracked = new Set(
      execFileSync("git", ["ls-files", "--", vendorRoot], {
        cwd: root,
        encoding: "utf8",
      })
        .trim()
        .split("\n")
        .filter(Boolean),
    );
    const checksums = readdirSync(join(root, vendorRoot), {
      recursive: true,
      encoding: "utf8",
    }) as string[];
    const checksumPaths = checksums.filter((entry) =>
      entry.endsWith(".cargo-checksum.json"),
    );

    expect(checksumPaths.length).toBeGreaterThan(0);
    const missingFromGit: string[] = [];
    for (const checksumRelativePath of checksumPaths) {
      const checksumPath = join(vendorRoot, checksumRelativePath);
      const manifest = JSON.parse(read(checksumPath)) as {
        files: Record<string, string>;
      };
      const cratePath = dirname(checksumPath);
      const missing = Object.keys(manifest.files)
        .map((requiredPath) => join(cratePath, requiredPath))
        .filter((requiredPath) => !tracked.has(requiredPath));

      missingFromGit.push(...missing);
    }

    expect(missingFromGit.sort()).toEqual(excludedWindowsImportArchives);
    expect(missingFromGit.every((requiredPath) => requiredPath.endsWith(".a"))).toBe(true);
    expect(
      read("modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/vendor/windows_aarch64_gnullvm/Cargo.toml"),
    ).toContain('name = "windows_aarch64_gnullvm"');
    expect(
      read("modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/vendor/windows-targets/Cargo.toml"),
    ).toContain("[target.aarch64-pc-windows-gnullvm.dependencies.windows_aarch64_gnullvm]");
  });
});
