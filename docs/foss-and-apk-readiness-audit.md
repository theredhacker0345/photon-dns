# Pocket Hermes — FOSS and APK Readiness Audit

**Status:** **The control plane is FOSS-ready and its prior unknown development-only ngrok binary has been removed.** A local Android supervisor module now provides real host-process CPU/RAM telemetry and a foreground-service foundation. The embedded Hermes CPython worker, Android wheels, and custom-build/device validation remain unfinished.

## Why the work has been intentionally incremental

Pocket Hermes currently contains an Expo/React Native **control plane**: the user interface, protected configuration, readiness checks, telemetry contract, test-message flow, and alerts. The real 24/7 host needs custom Android code—a foreground service, a Kotlin module, a JNI-launched embedded CPython, Android ABI-compatible Python wheels, and the Hermes runtime bundle. An Expo web preview cannot supply or validate those components.

Expo documents that a development build is the app’s own native version of Expo Go and is needed when an app changes native code or native configuration. It also states that JavaScript-only changes do not require a native rebuild; native builds should be recreated when native libraries or configuration change. [1] Expo recommends a local Expo module for app-specific Kotlin code and identifies the Expo Modules API as the normal way to write Kotlin native modules. [2] [3]

The official local-module flow creates a `modules/<module>/android` directory with Kotlin source, then requires an Android prebuild and a custom native build to execute it. [8] The Android supervisor is therefore the next real implementation milestone—not an Expo web-preview feature. For I/O, foreground-service control, or network dispatch, the Expo Module API specifies asynchronous Kotlin functions rather than blocking JavaScript calls. [9]

| Deliverable | Current state | What remains before real APK validation |
|---|---|---|
| **FOSS mobile UI and control plane** | Implemented under Pocket Hermes’ MIT License. | Retain attribution and generate release notices. |
| **Hermes Agent incorporation** | Approved upstream license. | Bundle pinned source and retain Nous Research’s MIT notice. |
| **Live CPU/RAM telemetry** | Typed bridge plus local Android `PocketHermesSupervisor` module read real host-process CPU and RAM metrics. | Connect embedded Hermes-worker-specific metrics and verify them in a custom Android build. |
| **Telegram delivery receipt** | Owner-only UI flow and persisted receipt presentation are implemented. | Native worker/gateway must execute the call and return Telegram’s `message_id`. |
| **Low-resource notifications** | App-side battery/storage threshold logic and local notifications are implemented. | Native service must run checks and alert while the JS UI is not active. |
| **APK** | Not built. | Package embedded runtime assets, then create and test a custom Android development build through the managed publishing/build workflow. |

## License audit

The local package inventory reports **860 MIT packages**, plus Apache-2.0, BSD, ISC, 0BSD, BlueOak, CC0, Unlicense, Python-2.0, and narrowly scoped MPL-2.0 entries. The full inventory flagged three categories for manual treatment.

| Finding | Scope | Assessment | Release action |
|---|---|---|---|
| **Hermes Agent** | Planned embedded runtime | MIT licensed by Nous Research. [4] | Include the upstream MIT notice in the runtime bundle and release notices. |
| **Expo / React Native** | Application framework | Both primary repositories publish MIT licenses. [5] [6] | Retain relevant third-party notices. |
| **`node-forge`** | Transitive dependency | `BSD-3-Clause OR GPL-2.0`; a BSD-3-Clause route is explicitly available. | Record BSD-3-Clause selection in release notices. |
| **`lightningcss`** | Build-time package | MPL-2.0 package; it is not proprietary but has source-file-level obligations for modified MPL-covered files. | Do not modify/copy its source; preserve package notices. |
| **`caniuse-lite`** | Build-time metadata | CC-BY-4.0. | Preserve attribution in a third-party notice if distributed. |
| **`@expo/ngrok-bin`** | Former development-only transitive binary | Local metadata reported **Unknown**. The upstream project documents downloading/spawning an ngrok binary. [7] | **Removed:** `@expo/ngrok` was removed from `devDependencies`, so the unknown binary is no longer in the project dependency tree. |

## Native Android implementation backlog

1. **Completed:** Create a local Expo module with `npx create-expo-module --local`.
2. **Completed foundation:** Implement Kotlin supervisor lifecycle, foreground-service notification channel, and real host-process CPU/RAM sampling.
3. **In progress:** Add embedded-worker states, `sendGatewayTest`, and a resource-alert event stream that continues when JavaScript is inactive.
4. Implement ARM64 CPython packaging, a verified Hermes source bundle, and reproducible Android wheels.
5. **Completed initial version:** Add deterministic license inventory and `THIRD_PARTY_NOTICES.md`; generate a release SBOM before publication.
6. Build a custom development APK only after the embedded runtime can execute; test it on the intended spare phone.

> **Conclusion:** Pocket Hermes must not claim that an always-on Hermes process is finished until the embedded runtime has passed device-level testing. The local Android supervisor is now genuine FOSS native code, but it currently supervises the host process only; it does not yet launch the embedded Hermes worker. The unknown development-only ngrok binary was removed, leaving no identified proprietary runtime dependency in the current control-plane dependency inventory.

## References

[1]: https://docs.expo.dev/develop/development-builds/introduction/ "Expo: Introduction to development builds"
[2]: https://docs.expo.dev/workflow/customizing/ "Expo: Add custom native code"
[3]: https://docs.expo.dev/modules/overview/ "Expo Modules API overview"
[4]: https://github.com/NousResearch/hermes-agent/blob/main/LICENSE "NousResearch Hermes Agent — MIT License"
[5]: https://github.com/expo/expo/blob/main/LICENSE "Expo — MIT License"
[6]: https://github.com/react/react-native/blob/main/LICENSE "React Native — MIT License"
[7]: https://github.com/expo/ngrok "Expo ngrok repository and binary behavior"
[8]: https://docs.expo.dev/modules/get-started/ "Expo Modules API: Get started"
[9]: https://docs.expo.dev/modules/module-api/ "Expo Modules API: Module API reference"
