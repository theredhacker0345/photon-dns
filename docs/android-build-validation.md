# Pocket Relay — Android Build and Validation Plan

## Why an APK is not rebuilt after every interface task

Pocket Relay has two classes of change. **JavaScript-only changes**—screens, setup flow, validation rules, and dashboard UI—run in the Expo preview and do not require a native rebuild. **Native changes**—the Android foreground supervisor, Kotlin source, manifest permissions, JNI, and embedded CPython/Hermes assets—require a custom development build or release APK.

Rebuilding an APK after every JavaScript edit would not validate the embedded-runtime feature and would slow iteration substantially. The correct build boundary is after a meaningful native milestone, with code and configuration frozen long enough to test on the actual spare phone.

## Current native milestone

Pocket Relay now includes an app-local Android-only Expo module at `modules/pocket-hermes-supervisor/`. Its FOSS Kotlin implementation provides:

| Feature | Current behavior | Requires device validation |
|---|---|---|
| **Foreground supervisor service** | Starts/stops an Android foreground service with an ongoing host notification. | Yes — Android 7+ through an actual custom build. |
| **CPU telemetry** | Samples host-process CPU time from `/proc/self/stat` and returns a percentage between consecutive samples. | Yes — confirm cadence and behavior under Doze. |
| **RAM telemetry** | Uses Android `ActivityManager` process-memory information and device memory totals. | Yes — confirm readings against Android Settings/debug tooling. |
| **Lifecycle bridge** | Exposes typed `getTelemetry`, `startSupervisor`, and `stopSupervisor` functions to React Native. | Yes — ensure module autolinks in a custom build. |
| **Embedded Hermes worker** | Not implemented. | Required before calling the phone an always-on Hermes host. |

## Required Android validation sequence

1. Use the project **Publish** control to initiate the managed custom Android build after saving a checkpoint. Do not treat the Expo web preview or Expo Go as a native-supervisor test environment.
2. Install the resulting build on the intended Android phone, complete the owner-only setup, then start the supervisor.
3. Verify the ongoing Android notification is visible and that the dashboard transitions to **Supervisor live** with non-placeholder CPU/RAM values.
4. Lock the screen, enable battery optimization exceptions only with the owner’s consent, and verify the service/process status after 15, 60, and 180 minutes.
5. Verify pause/restart behavior, phone reboot behavior, low-battery notification, low-storage notification, and Telegram test-message delivery.
6. Only after the embedded CPython/Hermes worker is packaged and passes this sequence should Pocket Relay claim 24/7 agent execution.

## FOSS release gate

Before publishing a user-facing APK, regenerate `THIRD_PARTY_NOTICES.md` from the deterministic dependency audit, retain the upstream Hermes Agent MIT notice in the runtime bundle, hash every embedded Python asset, and attach an SBOM. The current control-plane and local supervisor source contain no identified proprietary runtime dependency; the full embedded Python wheel set still requires a separate license review when it is selected.
