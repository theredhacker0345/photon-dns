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

## Source-tree checkpoint

The public `main` branch was reviewed at commit `1aa9b4bab6354d212068f5a1c37de9894a080636` (`v2.1.2: fix empty output files from Drive/cloud storage`). The visible tree contains a Rust core under `neuron-encrypt/`, an Android project, CI workflows, F-Droid-style metadata, a pinned Rust toolchain, security documents, and an audit artifact. These are necessary review inputs, **not** integration approval; the following audit must inspect the pinned implementation, locked dependencies, JNI boundary, test vectors, and release workflow before Pocket Relay uses it for real backup material.

## Pinned source findings — initial code review

`neuron-encrypt/Cargo.toml` at the reviewed commit declares GPL-3.0-only, Rust 2021, a library crate plus CLI binaries, and crypto dependencies including `aes-gcm-siv 0.11`, `aead 0.5`, `argon2 0.5`, `hkdf 0.12`, `sha2 0.10`, `zeroize 1.7`, and `rand_core 0.6` with `getrandom`. It conditionally excludes desktop GUI/CLI dependencies on Android. This is compatible in principle with Pocket Relay’s license, but a future integration must vendor or pin the exact lockfile and audit all transitive crates.

The pinned `src/crypto.rs` exposes V2/V3/V4 readers. V4 uses `VAULTX04`, AES-256-GCM-SIV streaming, Argon2id (`262_144` KiB, three iterations, four lanes), HKDF-SHA512 with a V4-specific info string, `OsRng`, `Zeroizing`, 1 MiB chunks, a 4 PiB explicit stream-counter limit, and full-header AAD. These are positive code-level observations. The fixed 256 MiB KDF cost remains a material denial-of-service and resource-budget concern for older Android hosts.

The pinned JNI bridge duplicates file descriptors, zeroes the Java byte array after conversion, wraps passphrase bytes in `Zeroizing`, maps authentication errors to a generic wrong-passphrase-or-corruption error, and offers cancellation/progress callbacks. It currently performs stream decryption to a caller-owned output FD; it does **not** expose a documented verification-only API. Pocket Relay must not call this decryption path for verification because it would create plaintext output. A safe integration needs a new audited core/JNI verification API that authenticates the entire ciphertext and discards plaintext before any host-side restore action.

Sources: https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/1aa9b4bab6354d212068f5a1c37de9894a080636/neuron-encrypt/Cargo.toml ; https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/1aa9b4bab6354d212068f5a1c37de9894a080636/neuron-encrypt/src/crypto.rs ; https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/1aa9b4bab6354d212068f5a1c37de9894a080636/android/neuron-encrypt-jni/src/lib.rs

## Sources

1. [Neuron Encrypt project page](https://gitlab.com/theredhacker0345/neuron-encrypt)
2. [Neuron Encrypt README](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md)
3. [Neuron Encrypt CHANGELOG](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/CHANGELOG.md)
4. [Neuron Encrypt GPL-3.0 license](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/LICENSE)
5. [Neuron Encrypt release 2.1.2 / README](https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md)
