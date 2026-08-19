# Neuron Encrypt Backup Assessment — External Research Notes

**Repository reviewed:** [Neuron Encrypt](https://gitlab.com/theredhacker0345/neuron-encrypt) on 2026-08-19.

## Observed repository posture

The public project page identifies **GNU GPL v3.0 or later**, 162 commits, one main branch, and eight releases. The project README describes an Android 7.0+ compatible Rust implementation with a JNI layer, while the changelog documents Android-specific foreground-service, file-descriptor, and durability fixes.

| Area | Reported design | Relevance to Pocket Relay |
|---|---|---|
| License | GPL-3.0-or-later | Compatible in principle with Pocket Relay’s GPL-3.0 distribution model, subject to dependency and source audit. |
| Encryption | AES-256-GCM-SIV streaming format; authenticated V4 headers | Appropriate primitive family for authenticated backup archives if independently source-reviewed and version-pinned. |
| Key derivation | Argon2id with reported 256 MiB cost, HKDF-SHA512 expansion | Strong but potentially unsuitable for low-RAM Android devices unless a backup-specific, measured policy is agreed. |
| Memory hygiene | `Zeroizing`, OS CSPRNG, atomic temp-file rename | Positive implementation signals; must be verified from reviewed source rather than README claims alone. |
| Android behavior | JNI implementation; foreground service; API 24 minimum | Architectural fit is possible, but adding a second native Rust/JNI toolchain to Pocket Relay increases build, SBOM, and F-Droid audit scope. |
| Backup limitations | README says file names, sizes, and timestamps remain visible | A Pocket Relay design should minimize plaintext metadata or document the leakage explicitly. |

## Preliminary conclusion

Neuron Encrypt is a **promising optional backup-engine candidate**, not yet approved for direct embedding. Pocket Relay should not shell out to its CLI, should not embed prebuilt binaries, and should never expose raw password files. A future integration would require a pinned source revision, independent dependency and cryptographic-format review, Android toolchain reproducibility, a memory-cost policy compatible with the host’s resource guardrails, and owner-confirmed export/import flows.

## Follow-up source review — 2026-08-19

The public README identifies release **2.1.2**, offers GPLv3 source, and documents Android API 24 support. It reports the V4 `VAULTX04` streaming format: AES-256-GCM-SIV with an authenticated header, Argon2id at 256 MiB / three iterations / four lanes, HKDF-SHA512, 1 MiB chunks, OS randomness, temporary-file atomic writes, and zeroizing of sensitive buffers. The changelog records Android `fsync` completion handling, background-dispatcher execution, foreground-service lifecycle handling, and cloud-provider file-descriptor fixes.

These are positive claims, but **not a substitute for an independent code and dependency audit**. The fixed ≈258 MB advertised working set is materially incompatible with some Pocket Relay hosts and must never be triggered from an agent request or concurrent with constrained model work. The existing README also documents visible plaintext metadata (file names, sizes, timestamps), so an integration should use an opaque, timestamp-minimized package name and place the manifest inside the encrypted payload.

The proposed integration must use a source-built Android library rather than a CLI process or release APK, pin an immutable revision and dependency lockfile, preserve GPL notices and corresponding source, and add format compatibility vectors before storage/export support is enabled.

## Sources

1. [Neuron Encrypt project page](https://gitlab.com/theredhacker0345/neuron-encrypt)
2. [Neuron Encrypt README](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md)
3. [Neuron Encrypt CHANGELOG](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/CHANGELOG.md)
4. [Neuron Encrypt GPL-3.0 license](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/LICENSE)
5. [Neuron Encrypt release 2.1.2 / README](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md)
