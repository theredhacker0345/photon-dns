# Project TODO

- [x] Define Pocket Hermes mobile UX, state model, and runtime security boundaries.
- [x] Build setup, dashboard, agent, automation, and settings screens.
- [x] Implement local non-secret configuration persistence and secure credential handling.
- [x] Add runtime health model, background-runtime readiness guide, and native integration contract.
- [x] Add FOSS licensing and architecture documentation.
- [x] Generate a unique Pocket Hermes app icon and update Expo branding configuration.
- [x] Test type safety and core mobile interaction flows.
- [x] Capture final visual validation: dashboard and settings rendered in direct browser preview; managed capture and later proxy routes were unstable under sandbox memory pressure.
- [x] Save the initial release checkpoint (a4f3c08e).
- [x] Confirm the device-host architecture, threat model, and security boundaries before implementation.
- [x] Define the native Android foreground-service and private embedded-Hermes integration contract for true 24/7 operation; the earlier visible-Termux proposal is superseded.
- [x] Define Telegram authorization, secret-storage, and remote-access safeguards before adding connection flows.
- [x] Verify the existing Hermes Agent repository’s MIT license, Android/Termux support, and stable integration points.
- [x] Design Pocket Hermes as a supervisor and control plane for the existing Hermes Agent runtime rather than recreating the agent core.
- [x] Research and choose a no-Termux, lightweight native Android runtime architecture.
- [x] Close as superseded: the selected architecture privately embeds the upstream Hermes Python runtime and exposes no general-purpose user shell.
- [x] Design the Android foreground-service, boot recovery, and Telegram long-polling lifecycle for the native host.
- [x] Verify the license of any third-party native core before reusing it; ZeroAI application code is excluded because its top-level license has a purpose restriction.
- [x] Close ZeroClaw evaluation as not selected: the chosen path privately embeds Hermes Agent rather than substituting its agent core.
- [x] Verify a single-APK embedded Linux-userland approach so the user never installs or opens Termux.
- [x] Determine how to bundle and privately supervise the Hermes Python runtime, dependencies, and app-owned filesystem inside Pocket Hermes.
- [x] Verify APK/native-library/foreground-service constraints at architecture level; production packaging still requires a dedicated Android build validation.
- [x] Audit the Pocket Hermes mobile visual system and identify high-impact hierarchy, spacing, and interaction improvements.
- [x] Refine the dashboard and setup experience for a more polished one-handed mobile flow.
- [x] Refine the agent, schedules, and settings screens for stronger consistency and clearer operational state.
- [x] Validate the refined GUI at a mobile portrait viewport; dashboard, agent, jobs, and control screens render with consistent visual hierarchy and readable tab labels.
- [x] Save the GUI refinement checkpoint.
- [x] Research one focused GitHub shortlist for Pocket Hermes GUI improvements, including reusable UI patterns and Android/Expo-compatible tooling.
- [x] Discover relevant `SKILL.md` resources and agent tools that can improve future GUI work.
- [x] Evaluate repository licenses, maintenance quality, fit, and implementation effort before recommending integrations.
- [x] Produce a ranked GUI research brief with a concrete implementation recommendation.
- [x] Define the four Host Setup steps, validation rules, and readiness criteria.
- [x] Build the Device, Telegram, Model, and Runtime Policy setup screens with progress and back/continue interactions.
- [x] Connect the setup flow to existing secure Telegram and host-policy state without duplicating credentials.
- [x] Validate the Host Setup flow with TypeScript and deterministic policy tests; browser/screenshot visual capture was blocked by the managed preview proxy.
- [x] Save the Host Setup checkpoint.
- [x] Define completed-host dashboard status, CPU/RAM display states, readiness criteria, and gateway test behavior.
- [x] Build a post-setup main dashboard showing agent status, CPU, RAM, storage, and charging readiness.
- [x] Surface storage and charging readiness directly in the Runtime Policy setup step.
- [x] Add inline Telegram chat-ID help and a final test-gateway confirmation screen.
- [x] Validate the completed-host setup flow with portrait screenshots, TypeScript, and deterministic policy tests.
- [x] Save the completed-host dashboard checkpoint.
- [x] Define the native-supervisor telemetry interface, notification thresholds, and safe Telegram test-message behavior.
- [x] Connect dashboard CPU/RAM cards to the native-supervisor telemetry bridge with an explicit preview fallback.
- [x] Add a protected Telegram test-message send flow with delivered-message receipt details.
- [x] Add local low-battery and low-storage host notifications with duplicate-alert suppression.
- [x] Validate telemetry, gateway receipt, and host-alert flows with TypeScript and deterministic policy tests; managed screenshots were unavailable.
- [x] Save the telemetry, receipt, and alert checkpoint.
- [x] Audit Pocket Hermes source, dependencies, icons/assets, upstream Hermes code, and planned native runtime components for FOSS licensing compliance.
- [x] Document every dependency and asset that requires attribution, replacement, or license confirmation before APK distribution.
- [x] Assess the current project’s Android-native bridge readiness and identify the exact Kotlin/JNI/embedded-Python work still required.
- [x] Implement the next native Android bridge milestone and prepare a custom APK build strategy rather than claiming Expo preview features are native-complete.
- [x] Validate APK-level FOSS posture and provide a transparent release-readiness report; embedded Python wheels still require an audit when they are packaged.
- [x] Build and test the custom Android APK on a spare phone after the embedded Hermes CPython worker is implemented.
- [x] Freeze the ARM64 CPython/Hermes worker version, ABI target, feature scope, and permissively licensed wheel selection.
- [x] Create reproducible embedded-worker manifests, wheel lock data, hashes, and a CycloneDX SBOM with license evidence.
- [x] Integrate native worker extraction, verification, launch, health, and stop behavior with the Android foreground supervisor.
- [x] Validate worker bundle configuration and update the FOSS release gate for all selected Python artifacts.
- [x] Save a managed Android build checkpoint and provide the supported Publish workflow for generating the APK.
- [x] Add Chaquopy 17.0 packaging to the Android supervisor module for Python 3.11 and arm64-v8a only.
- [x] Create the constrained Hermes Telegram worker launcher with no TUI, browser tools, runtime installation, or shell exposure.
- [x] Wire Python startup, worker lifecycle, status, and deterministic stop behavior into the Android foreground service.
- [x] Generate and validate a CycloneDX SBOM for pinned embedded Python artifacts, including license evidence and hashes.
- [x] Produce and inspect a native ARM64 Android APK after the worker bundle passes the FOSS release gate.
- [x] Remove or replace unused native dependencies that force an oversized Android CMake build in the memory-constrained sandbox.
- [x] Rebuild the arm64-v8a APK entirely in the sandbox using the minimized native dependency profile.
- [x] Build and validate a MIT-licensed ARM64 Pydantic Core wheel from the pinned source because Chaquopy lacks the required published Android artifact.

# Final Release and F-Droid Submission

- [x] Restore or provision the sandbox Android/Chaquopy build toolchain
- [x] Rebuild the pinned Android wheel artifacts
- [x] Generate the final ARM64 release APK
- [x] Validate APK size, SHA-256, package ID, version, and native worker contents
- [x] Prepare and validate the F-Droid submission checklist
- [x] Save a checkpoint containing the final release metadata and checklist

- [x] Final APK build and F-Droid checklist requested by user on 2026-08-17

**Note:** The sandbox reset removed the previous local Android SDK, CPython toolchain, and `.artifacts/wheels/`; these must be regenerated before the APK can be rebuilt.

# APK Size Optimization

- [x] Audit APK contents and identify largest avoidable payloads
- [x] Research Chaquopy, ABI, and Android packaging size-reduction options
- [x] Produce an arm64-v8a-only APK variant and measure the reduction
- [x] Evaluate Python dependency pruning and release-resource shrinking
- [x] Validate optimized APK and document trade-offs
