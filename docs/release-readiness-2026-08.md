# Pocket Relay F-Droid Release Verification — August 2026

This verification covers the **Pocket Relay 1.0.0** source tree, Android package
`com.app.pockethermes`, and its immutable candidate tag `v1.0.0-fdroid.2`
(`4ce53341ce0f47ad94f164a0d4fbff40b137f5d2`). It distinguishes
source-verified controls from device-only checks and F-Droid’s own independent
build-server review. It is therefore an evidence record, not a claim that the
application has already been accepted by F-Droid.

> **Assessment.** The public source, licensing, owner-facing control plane,
> Android-local notification implementation, vendored Python build inputs, and
> deterministic local ARM64 release packaging are ready for maintainer handoff.
> The project is **submitted for F-Droid review** through
> [fdroid/fdroiddata merge request !46222](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/46222).
> A clean F-Droid build-server build, reviewer anti-feature classification,
> acceptance, and real ARM64 hardware acceptance with owner-supplied credentials
> remain external release gates.

## Scope and evidence

F-Droid requires publicly available current source, an open-source license, and
a FLOSS dependency/toolchain. Its inclusion policy rejects Firebase, Google
Play Services, proprietary tracking, advertising, and Crashlytics dependencies.[1] [2]
The repository's public GitLab `main` branch and `v1.0.0-fdroid.2` tag resolve
to `4ce53341ce0f47ad94f164a0d4fbff40b137f5d2`. The committed recipe declares
that Git URL using `RepoType: git` and pins the same immutable tag for the
submitted build.

| Area | Evidence reviewed | Verification result | Remaining condition |
|---|---|---|---|
| Source, identifiers, and license | `LICENSE`, `package.json`, `app.config.ts`, `android/app/build.gradle`, `metadata/com.app.pockethermes.yml` | **Pass in source.** GPL-3.0-only, preserved Android package ID, `1.0.0` / version code `1`, and public GitLab source fields are aligned. | F-Droid reviewer verification of the submitted immutable `v1.0.0-fdroid.2` tag. |
| Owner-facing flows | Setup, provider connections/models, Agent Console, automations, skills, Settings, encrypted backup/restore, notifications | **Covered by source contracts and regression suite.** Device-only handoff flows remain visibly bounded and do not fabricate success. | Physical-device test with real credentials and Android permission prompts. |
| Android notification stack | Native `PocketRelayLocalNotifications`, `PocketHermesBootReceiver`, Settings master preference, `backup-reminders.ts`, merged release manifest | **Pass locally.** Test, reminder, and safety delivery is device-local, permission-first, master-gated, and Firebase-free. | Repeat manifest inspection in the F-Droid build environment. |
| Privacy and tracking | JavaScript/native imports, manifest surface, Fastlane listing, merged release manifest | **Pass locally.** No analytics, crash-reporting, push-token, Firebase, or Google Play Services path is retained; credentials remain in protected storage and are excluded from backups. | Confirm the F-Droid-built dependency graph. |
| Security boundaries | Backup contract, MCP contract, QuickJS native executor, Telegram worker policy | **Pass in source.** Credentials are excluded from portable backups; restore stays preview-first; MCP is remote HTTPS-only with expiring owner approvals; QuickJS is owner-approved, isolated, and limited to data transformation rather than shell, Python, compiler, filesystem, or network access; Telegram handling is owner-chat allowlisted and fail-closed. | Exercise failures and recovery on hardware. |
| Build recipe and reproducibility | F-Droid metadata, release preflight, Gradle signing policy, vendored Hermes/Pydantic Core provenance, offline wheel assemblers, and two clean local `assembleRelease` builds | **Pass locally.** Hermes Agent 0.20.1 and Pydantic Core 2.46.4 source closures are verified vendor inputs; Gradle rebuilds all local Python wheels before Chaquopy packaging. Two clean unsigned ARM64 builds matched exactly at SHA-256 `235927e9cce6c89580f88f991e2e7f647c92c73b21ad06e1b7abbfe0208fcd81`. | Run `fdroid lint` and an independent F-Droid build-server build from the final public tag. |
| Network-service disclosure | Feature design and Fastlane listing | **Requires F-Droid reviewer classification.** Telegram and owner-selected model providers are network services outside the APK; the app describes this honestly and offers no hidden telemetry. | Confirm the appropriate F-Droid anti-feature labels with the reviewer, including whether configured third-party model services require `NonFreeNet`. |

## Feature verification boundary

The project contains deterministic regression checks for the credential-free
backup allow-list, preview-before-apply restore, compatibility warnings,
reminder bounds, master local-notification gate, and the new test-notification
permission path. Its native release gates compile Kotlin and package a release
variant. These checks support the source-level safety claims; they cannot
substitute for a real Android device's battery state, storage reserve,
notification permission dialog, background process survival, or Telegram/model
provider authentication.

| Flow | Source-level verification | Hardware acceptance still required |
|---|---|---|
| Setup and private Telegram gateway | Native worker validates owner chat configuration and exposes an explicit gateway test. | Enter a real token/chat ID, test direct and proxy routes, then reboot the host phone. |
| Provider selection and model discovery | Provider catalog, endpoint checks, protected key storage, connection tests, and model filtering are implemented. | Verify each owner-selected provider with a real account and model. |
| Agent console and automations | Shared bounded ledger, native task/schedule contracts, and owner-only interfaces are present. | Confirm background processing and recovered schedules while the UI is closed. |
| Skills and QuickJS | Strict manifests, review, source-hash approvals, isolated JSON-only execution, and audit metadata are implemented. | Test installation, revocation, and failure behavior on an ARM64 device. |
| Encrypted backup and restore | Credential exclusion, password-gated native encryption, preview-first apply, and compatibility checks are covered. | Export, share, import, use an incorrect password, and restore a known-safe test backup. |
| Device notifications | Master toggle, Android 13 permission request, native test alert, native reminder alarm, boot restoration, and safety alert bridge are implemented. | Deny/grant permission, send test alert, reboot, and wait through a configured reminder interval. |

## Android permission and component review

Pocket Relay's explicit app manifest now retains internet connectivity,
foreground-service operation, notification permission, and vibration. The
supervisor module separately declares network-state observation, wake lock,
boot reception, data-sync foreground-service capability, its non-exported host
service, its isolated QuickJS service, and the non-exported reminder receiver.
The removed app declarations were media playback, audio recording/adjustment,
overlay permission, legacy external-storage permissions, and unused biometric
permissions; the project does not use those capabilities. The locally merged
release manifest has been inspected after removal; F-Droid must independently
recreate that result.

No notification or reminder payload includes a backup password, backup contents,
provider key, Telegram token, proxy credential, or conversation record. The
master toggle is local to the device and does not alter Telegram message
delivery. On Android 13 and later the application requests `POST_NOTIFICATIONS`
only when the owner turns on or tests local alerts.

## F-Droid metadata and publication checklist

F-Droid's metadata reference accepts the public repository fields, individual
build `commit`, version details, source links, anti-feature declarations, and
Fastlane listing content used here.[3] The quick-start guide recommends a
version tag plus Fastlane title, description, icon, screenshots, and a
version-code changelog.[1] The source tree provides the description, icon, and
`changelogs/1.txt`; current release screenshots should be captured from the
real ARM64 candidate before submission rather than generated from a web preview.

| Ordered submission gate | Status | Required evidence or action |
|---|---|---|
| 1. Finish source validation | Passed locally | Deterministic tests, TypeScript, lint, release preflight, Kotlin compile, native local-wheel prerequisite, manifest inspection, and two clean release builds passed. |
| 2. Eliminate wheel-build network clone | Passed locally | Hermes Agent and Pydantic Core are verified vendored source inputs; local wheel assembly fails closed and makes no network request. |
| 3. Normalize artifact reproducibility | Passed locally | The hermetic wrapper produced two clean unsigned ARM64 APKs with the same SHA-256 checksum; retain this evidence with the candidate. |
| 4. Publish immutable candidate | Passed | Public GitLab `main` and immutable `v1.0.0-fdroid.2` resolve to `4ce53341ce0f47ad94f164a0d4fbff40b137f5d2`. |
| 5. Hardware acceptance | Pending | Complete `docs/physical-device-backup-acceptance-checklist.md` plus the flow matrix above on Android 7.0+ ARM64 hardware. |
| 6. F-Droid tooling review | Submitted for review | [MR !46222](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/46222) adds the recipe; F-Droid must run lint and a clean build-server build. |
| 7. Reviewer anti-feature decision | Pending | Disclose Telegram and owner-configured provider networking; accept F-Droid's final anti-feature labels where applicable. |

## References

[1] [F-Droid, *Submitting to F-Droid: Quick Start Guide*](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)

[2] [F-Droid, *Inclusion Policy*](https://f-droid.org/en/docs/Inclusion_Policy/)

[3] [F-Droid, *Build Metadata Reference*](https://f-droid.org/en/docs/Build_Metadata_Reference/)
