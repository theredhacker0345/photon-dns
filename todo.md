# Project TODO

- [x] Define Pocket Agent Host mobile UX, state model, and runtime security boundaries.
- [x] Build setup, dashboard, agent, automation, and settings screens.
- [x] Implement local non-secret configuration persistence and secure credential handling.
- [x] Add runtime health model, background-runtime readiness guide, and native integration contract.
- [x] Add FOSS licensing and architecture documentation.
- [x] Generate a unique Pocket Agent Host app icon and update Expo branding configuration.
- [x] Test type safety and core mobile interaction flows.
- [x] Capture final visual validation: dashboard and settings rendered in direct browser preview; managed capture and later proxy routes were unstable under sandbox memory pressure.
- [x] Save the initial release checkpoint (a4f3c08e).
- [x] Confirm the device-host architecture, threat model, and security boundaries before implementation.
- [x] Define the native Android foreground-service and private embedded-Hermes integration contract for true 24/7 operation; the earlier visible-Termux proposal is superseded.
- [x] Define Telegram authorization, secret-storage, and remote-access safeguards before adding connection flows.
- [x] Verify the existing Hermes Agent repository’s MIT license, Android/Termux support, and stable integration points.
- [x] Design Pocket Agent Host as a supervisor and control plane for the existing Hermes Agent runtime rather than recreating the agent core.
- [x] Research and choose a no-Termux, lightweight native Android runtime architecture.
- [x] Close as superseded: the selected architecture privately embeds the upstream Hermes Python runtime and exposes no general-purpose user shell.
- [x] Design the Android foreground-service, boot recovery, and Telegram long-polling lifecycle for the native host.
- [x] Verify the license of any third-party native core before reusing it; ZeroAI application code is excluded because its top-level license has a purpose restriction.
- [x] Close ZeroClaw evaluation as not selected: the chosen path privately embeds Hermes Agent rather than substituting its agent core.
- [x] Verify a single-APK embedded Linux-userland approach so the user never installs or opens Termux.
- [x] Determine how to bundle and privately supervise the Hermes Python runtime, dependencies, and app-owned filesystem inside Pocket Agent Host.
- [x] Verify APK/native-library/foreground-service constraints at architecture level; production packaging still requires a dedicated Android build validation.
- [x] Audit the Pocket Agent Host mobile visual system and identify high-impact hierarchy, spacing, and interaction improvements.
- [x] Refine the dashboard and setup experience for a more polished one-handed mobile flow.
- [x] Refine the agent, schedules, and settings screens for stronger consistency and clearer operational state.
- [x] Validate the refined GUI at a mobile portrait viewport; dashboard, agent, jobs, and control screens render with consistent visual hierarchy and readable tab labels.
- [x] Save the GUI refinement checkpoint.
- [x] Research one focused GitHub shortlist for Pocket Agent Host GUI improvements, including reusable UI patterns and Android/Expo-compatible tooling.
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
- [x] Audit Pocket Agent Host source, dependencies, icons/assets, upstream Hermes code, and planned native runtime components for FOSS licensing compliance.
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

# Ten-Workstream Audit

- [x] Audit the Host dashboard tab and native telemetry fallbacks
- [x] Audit the Agent console instruction queue and relay states
- [x] Audit Automations persistence and scheduling behavior
- [x] Audit protected Settings and secret-handling flows
- [x] Audit the Host Setup state machine and readiness guards
- [x] Audit the Kotlin foreground supervisor and boot/lifecycle wiring
- [x] Audit the embedded CPython/Hermes Telegram worker and dependency profile
- [x] Audit backend/template service boundaries and confirm no unintended runtime dependency
- [x] Audit FOSS policy, SBOM, and owner authorization tests
- [x] Audit release packaging, F-Droid metadata, ABI filter, and APK integrity
- [x] Add deterministic cross-workstream release-gate tests

# Home Telemetry Display Fix

- [x] Trace why Home does not show live CPU and RAM on an Android release build
- [x] Make the dashboard distinguish live, sampling, and unavailable telemetry clearly
- [x] Add deterministic coverage for the telemetry hook and Home metric rendering contract
- [x] Validate the corrected CPU/RAM behavior and save a checkpoint

# Complete Gap-Closure Program

- [x] Create a traceability matrix mapping every visible control to runtime effect, persistence, recovery, and acceptance test
- [x] Replace prototype-ready claims in UI and documentation with verified implementation states
- [x] Define versioned cross-layer contracts for host configuration, policies, health, tasks, schedules, and redacted diagnostics
- [x] Declare and verify Android foreground-service, boot-recovery, notification, and network manifest requirements
- [x] Implement idempotent native lifecycle, heartbeat, bounded recovery, and safe diagnostics
- [x] Establish one Android Keystore-backed secret lifecycle with migration, rotation, and deletion
- [x] Implement authenticated OpenAI-compatible model configuration and preflight health validation
- [x] Enforce and test owner-only Telegram task execution with bounded task lifecycle and delivery receipts
- [x] Replace local Agent drafts with a durable runtime task queue and event history
- [x] Implement durable native scheduling with cron validation, run history, retries, and owner-only delivery
- [x] Persist and enforce charging-aware runtime policy, readiness remediation, and durable alert cooldowns
- [x] Add native worker freshness and accurate telemetry semantics to the Home dashboard
- [x] Complete threat model, privacy/security documentation, full dependency SBOM, and FOSS license gates
- [x] Remove unused app dependencies and prototype naming from the Android release graph
- [x] Add a source-controlled unsigned-release policy, release preflight, and F-Droid handoff evidence that cannot fall back to the debug signing key
- [x] Run final sandbox test, type, SBOM, license, and APK-integrity validation gates
- [ ] Publish an immutable public source tag and complete F-Droid build-server plus post-gap-closure physical-device validation (requires maintainer-controlled public hosting, credentials, and hardware)
- [x] Upgrade README with current app UI screenshots and the shipped Pocket Agent Host icon
- [x] Validate README assets, branding consistency, tests, and TypeScript before publishing the documentation update
- [x] Delete remote GitLab tags `v1.0.0` and `v1.0.1` and any attached Release objects without deleting their commits
- [x] Add provider selection, protected AI API token entry, live model discovery, and refreshable model catalog
- [x] Add provider connection latency and authentication status badge
- [x] Add model catalog search and filter bar
- [x] Push the completed provider diagnostics and model-search update to GitLab and verify the remote commit
- [x] Treat GitLab push and remote verification as required completion criteria for each future source change
- [x] Assess GPLv3 relicensing compatibility across Pocket Agent Host code, bundled dependencies, notices, and distribution obligations before changing any license
- [x] Replace the project MIT license with GPLv3 and update all license-facing metadata and notices
- [x] Add CONTRIBUTORS and a copyright/contribution policy for future code submissions
- [x] Regenerate compliance evidence and validate relicensing changes before GitLab publication
- [x] Push the verified GPLv3 update to GitLab and confirm the remote commit
- [x] Add manual-only GitLab CI workflow (`.gitlab-ci.yml`) for ARM64 release APK builds
- [x] Document Appetize.io API integration and test helper script for cloud APK launch
- [ ] Add persistent model favorites state and bookmark controls in model catalog
- [ ] Create dedicated Favorites tab (`app/(tabs)/favorites.tsx`) and tab icon mapping
- [ ] Add deterministic test coverage for model favorites and push verified changes to GitLab
- [x] Add persistent model favorites with bookmark toggles and a dedicated Favorites tab
- [x] Research Kilo Code API integration feasibility and model catalog preset
- [x] Add Kilo Code provider preset and model-provider contract support
- [x] Expose Kilo Code in Setup and Settings provider selection
- [x] Add pre-save provider connection test with success/error feedback
- [x] Validate Kilo Code integration and publish the completed changes to GitLab
- [x] Add loading spinner animation to provider connection test button
- [x] Automatically fetch and populate model catalog after successful connection test for all providers
- [x] Validate updated provider flow with deterministic tests and TypeScript check
