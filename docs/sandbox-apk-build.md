# Sandbox ARM64 APK Build Record

## Successful Artifact

| Field | Value |
| --- | --- |
| Variant | Android `release`, restricted to `arm64-v8a` |
| Artifact | `android/app/build/outputs/apk/release/app-release.apk` |
| Size | 131 MiB |
| SHA-256 | `0c0be0371681365a5dc12b812d28b7d9ed30d3917f5865fdcca1ae6e94551303` |
| Signing verification | APK Signature Scheme v2 verified |
| Embedded interpreter | CPython 3.11 via Chaquopy 17.0.0 |
| FOSS SBOM | `sbom.json`, CycloneDX 1.6, 62 bundled Python distributions |

The APK contains `libpython3.11.so`, Chaquopy ARM64 bootstrap modules, and the embedded requirements archive. The FOSS gate generated the SBOM from the distributions packaged by the successful Android build rather than from an unverified source manifest.

## Reproducible Sandbox Command

The Android SDK has to be available at `/home/ubuntu/android-sdk`, the private build-time CPython at `/home/ubuntu/toolchains/cpython-3.11/bin/python3.11`, and the source-built Pydantic Core wheel must first be created with `scripts/build-pydantic-core-android-wheel.sh`.

```bash
cd /home/ubuntu/pocket-hermes/android
NODE_OPTIONS=--max-old-space-size=512 \
POCKET_HERMES_BUILDPYTHON=/home/ubuntu/toolchains/cpython-3.11/bin/python3.11 \
./gradlew :app:assembleRelease --no-daemon --max-workers=1 --console=plain

cd ..
node scripts/generate-sbom.mjs
```

The bounded JVM/Metro profile and single Gradle worker are intentional: they allow the complete native build to run within the available sandbox memory budget. Release lint is skipped only in this constrained local build; TypeScript, policy tests, APK signature verification, and the bundled-wheel FOSS gate remain separate release checks.

## Distribution Caveat

This is an installable **development-distribution APK**. The generated Expo Android project signs its release variant with its local Android debug keystore, as shown by `apksigner`. A public production release must be re-signed with a user-controlled release keystore before distribution to others or publishing to an app store.
