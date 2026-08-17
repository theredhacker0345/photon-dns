# Pocket Agent Host: Full Functionality Audit

**Audit date:** 2026-08-17  
**Scope:** The Android release implementation, embedded CPython payload, JavaScript control plane, native bridge, foreground service, Python worker, release gates, and deterministic tests.

## Verdict

Pocket Agent Host is **not a dummy interface**. The production Android build contains an ARM64 CPython 3.11 runtime, the embedded Python worker, the pinned Hermes gateway package, an Android foreground service, a Keystore-backed configuration path, and a React Native control plane. The release APK assembled successfully in this audit and includes `libpython3.11.so`, Chaquopy assets, and the application Python archive.

The application is nevertheless **not fully proven by sandbox validation alone**. The sandbox cannot install the APK on a physical Android device, unlock its Keystore after reboot, connect to a real owner-controlled Telegram bot, or invoke a real model provider. Those external paths are implemented and packaged, but remain physical-device release checks rather than verified claims.

| Capability | Audit evidence | Status after audit | Confidence |
|---|---|---|---|
| Android foreground host lifecycle | Non-exported `PocketHermesSupervisorService`, protected boot receiver, persistent foreground notification, Kotlin release compilation, and unsigned APK assembly succeeded. | Implemented; physical-device validation pending. | High |
| Embedded CPython and Hermes gateway | The ARM64 APK contains CPython 3.11, Chaquopy assets, the private worker archive, and the pinned `hermes_agent` dependency closure. | Implemented and packaged. | High |
| Telegram owner lock | The worker validates a positive private user ID, sets explicit Telegram and gateway allowlists, and rejects groups. | Implemented; live bot delivery requires an owner test. | High |
| Model-provider configuration | Provider catalog, HTTPS discovery, protected credentials, and native model preflight are wired through the setup, store, bridge, and worker. | Implemented; provider compatibility requires a real credential test. | High |
| Console tasks and schedules | The native bridge persists, queues, cancels, drains, and executes owner tasks through the captured Hermes runner; schedules use validated five-field cron expressions. | Implemented; live inference execution requires a physical device and provider. | Medium–high |
| Remote MCP controls | HTTPS-only public endpoints, manifest fingerprinting, short owner grants, protected credentials, and native live updates are present. | Implemented; third-party server interoperability requires an owner test. | High |
| CPU, RAM, and workspace guardrails | Boundaries are validated in TypeScript, clamped in Kotlin, and enforced by the service and worker. | Implemented; threshold behavior requires device-load testing. | High |
| Battery and storage protection | Start-time policy checks and UI alerts exist, but continuous native checking and native low-battery warning delivery required repair. | Repaired in this audit work. | High after release validation |

## Validation Evidence

The post-repair audit passed the project’s deterministic suite (**69 tests**), TypeScript validation, Expo lint, and release preflight. Kotlin release compilation completed successfully. An unsigned ARM64 release APK was assembled successfully; it measured approximately 71 MB in this environment and contained `libpython3.11.so`, `assets/chaquopy/app.imy`, `requirements-common.imy`, and ARM64 Chaquopy native libraries.

> The positive build evidence proves that the runtime is included in the distributable APK. It does not substitute for an owner-controlled Telegram and model-provider test on a physical phone.

## Verified Gaps and Repairs

| Priority | Verified gap | Impact | Repair |
|---|---|---|---|
| P1 | The foreground service checked charging state and the free-storage reserve when starting, but did not repeat those checks in its recurring native health loop. | A host that was safe at startup could remain active after unplugging or after free storage fell below its configured reserve. | Re-check the same host policy every supervision cycle and stop safely on a later violation. |
| P1 | The native service saved `lowBatteryPercent` but did not use it for a persistent host-side warning. Existing notification logic lived in a React hook and therefore only ran while the UI was mounted. | An unattended host could miss an actionable low-battery warning when charging-aware mode was disabled. | Update the ongoing native foreground notification when battery or storage reaches the saved warning conditions. |
| P2 | Settings exposed CPU, RAM, workspace, and visual thresholds, but not the saved low-battery cutoff or free-storage reserve. | Two real policy fields could not be changed from the primary configuration UI. | Add validated numeric Settings controls and save them through the existing policy bridge. |
| P2 | Setup help mentioned group chat IDs although the application intentionally rejects group IDs to preserve the owner-only boundary. | Confusing and potentially unsafe-looking guidance. | Remove the group instruction and explicitly state that only a positive private user ID is accepted. |
| P3 | No sandbox can prove post-reboot Keystore access, Telegram delivery, provider inference, or Android OEM battery-management behavior. | These are release-blocking acceptance checks, not source defects. | Keep an explicit physical-device acceptance checklist; do not claim those paths are proven until the owner runs them. |

## Physical-Device Acceptance Checks

Before an F-Droid submission, install the unsigned or reproducibly signed ARM64 release on a dedicated Android phone. Grant notification permission, configure a disposable Telegram bot and a real model credential, complete the in-app gateway test, send an owner prompt, queue a console task, and verify one scheduled task. Confirm that an unapproved Telegram identity is ignored, that switching off charging-aware mode results in a native low-battery warning at the selected threshold, and that plugging/unplugging and reducing free storage cause the configured native policy behavior. Finally, reboot and unlock the device to validate opt-in restart behavior on the target Android/OEM combination.

## Audit Boundary

This report distinguishes **implemented and packaged** behavior from **physically exercised** behavior. It does not treat a web preview as an Android-host test, does not use fake credentials as proof of provider access, and does not claim F-Droid readiness merely because a local APK assembled.
