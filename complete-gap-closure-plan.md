# Pocket Relay Complete Gap-Closure Plan

## Goal

Turn the current **control-plane prototype with a bundled runtime** into a verifiably functional, FOSS Android host that a user can install as one APK on a spare phone, configure once, and operate continuously through an owner-locked Telegram bot. Completion means that every visible control is wired to a real native/runtime action, the agent can successfully process an approved Telegram task using a tested model endpoint, automations truly execute, recovery behavior is tested on a physical device, and the project can be submitted to F-Droid from reproducible source.

The existing `70.31 MiB` ARM64 APK is a useful build artifact, not a final publication artifact. It is debug-signed and predates the latest Home-telemetry UX change; it must not be represented as the final user release.

## Evidence-Based Gap Inventory

| Area | Current evidence | Missing work required before calling the app complete |
|---|---|---|
| Android service declaration | The local module registers only an Expo module; no tracked Android manifest is present and no service/receiver declaration was found. | Generate and verify manifest entries for the non-exported foreground service, required foreground-service permissions/type, notification channel behavior, boot receiver, and network access. Inspect the final APK manifest rather than relying on configuration source alone. |
| 24/7 recovery | `START_STICKY` handles some process death, but there is no boot/unlock receiver and no restart health protocol. | Add an opt-in restart-after-reboot path, recover only after credential storage is available, add bounded retry/backoff, retain a failure reason, and test force-stop, process kill, reboot, network loss, and Android battery restriction cases. |
| Service/worker health | Kotlin starts Python asynchronously and then leaves runtime status at `starting`; Python state changes are not relayed back to Kotlin/UI. | Implement a secret-free worker status/heartbeat bridge with `starting`, `running`, `degraded`, `stopping`, `stopped`, reason, version, last successful poll, and restart count. Do not treat a launched thread as a healthy agent. |
| Telegram owner lock | The worker exports environment variables intended to constrain Telegram, but the actual upstream Hermes gateway contract is not integration-tested against hostile/non-owner messages. | Replace environment-variable assumptions with a tested adapter at the incoming-message boundary; reject all non-owner chat IDs before task construction, cover private/group chat edge cases, add safe rate limits, and expose no token or message content in logs by default. |
| Model configuration | The UI stores an optional endpoint only. No model API key, provider capability validation, model selection, or native model-health test is wired; Python receives `model_api_key=None`. | Define an explicit OpenAI-compatible provider contract, securely store a model credential natively, validate HTTPS/URL policy, test a minimal completion before host start, and present actionable invalid-auth/network/model errors. If no authenticated model endpoint is configured, block the agent from claiming readiness. |
| Actual agent work | Python launches upstream `gateway.run` through a monkey patch but there is no task execution, reply, error, or upstream-version compatibility integration test. | Build a narrow upstream adapter with a pinned compatibility surface; test a real owner Telegram request through model response and Telegram reply on device. Define supported tools/capabilities explicitly rather than implying a general VPS shell. |
| Agent console | `AgentDraft` is AsyncStorage-only; the UI explicitly says the relay is pending. | Replace drafts with a durable native queue or make the screen a real chat/instruction submission surface. Add send, cancellation, retry, receipt, agent response, and history states, including service-offline handling. |
| Automations | Automation records are AsyncStorage-only; UI says “awaiting native scheduler”; `croniter` is packaged but unused. | Build a durable on-device scheduler linked to the foreground worker. Validate cron/time zone/DST behavior; persist enablement, next run, last run, output, errors, and retries; provide create, edit, pause, delete, run-now, and execution-history flows. |
| Runtime policy controls | Charging-aware/keep-awake switches are screen-local and are neither persisted nor delivered to native code. | Persist a typed runtime policy, hand it to the native service, enforce its chosen behavior, show its effective state, and use policy-specific tests. Never present an inactive setting as active protection. |
| Power and Doze readiness | Battery-optimization state is collected but not made actionable; no manufacturer/Android remediation flow exists. | Add a conservative readiness checklist, explain Android restrictions, link users to the OS battery-optimization screen only after consent, keep the host usable without bypassing user security settings, and surface an explicit “not suitable for unattended hosting” state. |
| Alerts | Low battery/storage alerts use an in-memory deduplication set and reset after restart. | Persist alert cooldown/state, add notification actions and channels, test permission denial/regrant, avoid alert storms, and ensure alerts are tied to actual policy thresholds. |
| Telemetry | Home now distinguishes preview/sampling/live states, but CPU is app-process CPU normalized by core count while RAM is app PSS against total device RAM; there is no native freshness/worker-health relation. | Document and label metric semantics, add last-updated/quality indicators, poll only while screen is active, add total-device metrics only if feasible and accurately labeled, and validate values on physical devices under load. |
| Secret lifecycle | Telegram data passes through JS and duplicated encrypted stores; there is no token rotation, deletion, native-only migration, model-key lifecycle, or backup/restore policy. | Establish a single secret ownership model using Android Keystore-backed native storage, migrate legacy values safely, never pass secrets to logs/events, add replace/revoke/delete flows, confirm backup exclusion, and threat-model rooted/lost-device limits. |
| Network and privacy | Telegram checks are direct client fetches with no unified timeout/retry policy; arbitrary model endpoint entry has no policy; privacy documentation is incomplete. | Centralize network client behavior, require explicit endpoint validation, define egress destinations, create a plain-language privacy policy, document no analytics/telemetry, and state exactly what remains local versus sent to Telegram/model provider. |
| Native stability | The worker uses a daemon thread and executor shutdown without tested lifecycle synchronization; duplicate starts, cancellation, long polls, exceptions, and configuration changes are not fully defined. | Add a serialized state machine, idempotent start/stop/update operations, timeout-safe shutdown, clean thread/event-loop ownership, log redaction, and a watchdog that restarts only within a bounded failure budget. |
| Product UX truthfulness | Several cards imply eventual functionality that is not present; the current dashboard phase can diverge from actual worker state. | Make all labels derive from the native status bridge, remove or gate unfinished actions until wired, add recovery actions, health detail, logs, configuration validation, accessibility labels, and device-specific onboarding copy. |
| Supported-device policy | The APK deliberately targets ARM64 only despite the spare/older-phone objective. | Decide and document whether ARM64-only is a hard product requirement or whether ARMv7 support is necessary. If support expands, build/test a second ABI and revisit the Python native-wheel and size budget; otherwise enforce and explain compatibility before setup. |
| Dependency and code hygiene | `package.json` remains named `app-template` and includes web/server/database dependencies unrelated to the Android host; FOSS verification covers the Python SBOM but not the full shipped graph. | Remove unneeded production dependencies and generated artifacts, rename package metadata, lock all shipped sources, produce a full SBOM covering npm/Gradle/Python/native artifacts, automate license notices, and scan for known vulnerabilities without introducing proprietary services. |
| Release signing | `android/app/build.gradle` explicitly uses the Android debug keystore for release builds. | Establish a release-key ownership/signing procedure outside source control, create signed reproducible release candidates, verify certificate fingerprints, and document key-loss/rotation consequences. F-Droid’s signing path is separate and does not make a debug-signed direct APK production-ready. |
| F-Droid reproducibility | Metadata references a `v1.0.0` commit, removes `node_modules`, assumes ignored wheel artifacts/build toolchains, and points at repository URLs/tags not yet verified as release-ready. | Make a clean checkout build without network-dependent implicit steps; vendor or reproducibly build every required source/wheel under F-Droid-acceptable rules; generate Android sources deterministically; pin toolchain inputs; verify the actual public repository, signed tag, license, fastlane assets, metadata, and F-Droid build log. |
| Verification | Existing tests are TypeScript contract tests; no Android instrumentation/device, Python integration, Telegram owner-lock, scheduler, reboot, or real-model end-to-end tests are demonstrated. | Add layered unit, native, integration, and physical-device acceptance suites with release gates. The final APK may only be published after those gates and a clean rebuild pass. |
| Documentation accuracy | Existing F-Droid documentation still cites the older 119 MiB artifact and marks items complete that are only configured or unverified. | Rewrite release/readiness documents to distinguish implemented, verified-on-device, and planned; publish operational setup/recovery/security docs and a precise limitations statement. |
| Sandbox wake-check | The 30-minute sandbox monitor can track task activity but cannot make the installed phone host resilient. | Keep it only as a development-process monitor if still desired; do not describe it as an app reliability feature or a replacement for native recovery testing. |

## Product Decisions to Lock Before Implementation

The implementation will proceed under these defaults unless the user changes them during review.

| Decision | Default proposed | Why it matters |
|---|---|---|
| Agent capability boundary | Telegram-only assistant with a narrowly allowlisted, user-approved task/tool set; **no exposed shell, terminal, package installation, browser automation, or arbitrary code execution**. | A phone host must not silently become a remote code-execution backdoor. The current worker already intends this constrained profile. |
| Model compatibility | One OpenAI-compatible HTTPS endpoint, explicit model identifier, and Keystore-protected API key. | Endpoint-only configuration cannot reliably make the agent answer tasks. |
| Scheduling implementation | Durable schedule records plus a native-service-owned scheduler; no external cloud dependency. | Meets the self-hosted requirement and survives UI process restarts. |
| Boot behavior | User-controlled “restart host after reboot” enabled only after owner and model setup pass health tests. | Avoids automatically resurrecting a misconfigured or insecure gateway. |
| ABI support | Retain ARM64-only as the initial release target, with a preflight compatibility check and clear onboarding warning. | Preserves the measured size reduction; ARMv7 becomes a separately tested product expansion. |
| Direct distribution | Produce a properly signed release APK for direct testing and a separate F-Droid build/review path. | Debug signing is unacceptable for a production handoff; F-Droid signs accepted builds itself. |

## Implementation Sequence

### Phase 0 — Establish a truthful baseline and release contract

1. Freeze the current prototype branch and create a gap matrix that maps each visible UI action to its actual handler, native effect, persistence owner, recovery behavior, and test.
2. Reconcile all claims in the UI and documentation with the gap inventory above. Remove “ready”, “delivered”, “persistent”, or “F-Droid ready” claims when evidence is configuration-only.
3. Define versioned typed contracts shared by TypeScript, Kotlin, and Python for host configuration, policy, worker health, tasks, schedules, events, and secret-free diagnostics.
4. Decide the supported Android range, ARM64 policy, model-provider contract, agent capability allowlist, persistence scheme, log-retention limit, and privacy disclosure.

**Exit gate:** a reviewed product contract and traceability table exist; every scope claim has an owner and acceptance test.

### Phase 1 — Make the Android host a real, recoverable service

1. Add a deterministic Android configuration plugin or tracked manifest source that declares the service, foreground-service permission/type, notification channel, boot/unlock receiver, and all minimum permissions.
2. Implement a native runtime state machine with serialized, idempotent `configure`, `start`, `stop`, `restart`, `health`, and `clearCredentials` operations.
3. Store runtime configuration/secrets in one Keystore-backed native store; migrate existing JS secure-store values once, redact all diagnostic output, and make delete/rotation explicit.
4. Implement boot recovery after user unlock, bounded retry with exponential backoff, network-change handling, stale-heartbeat detection, and a recoverable degraded state.
5. Ensure foreground notification content reflects actual worker health and links safely back into the app.

**Exit gate:** an Android instrumentation or device harness proves service start, stop, duplicate start, process kill, reboot/unlock restart, network restoration, and clean shutdown without duplicate workers or secret exposure.

### Phase 2 — Wire a real model-backed, owner-locked Telegram agent

1. Replace the current implicit environment-variable configuration with an explicit, narrow upstream-Hermes adapter, pinned to the reviewed upstream revision and protected by compatibility tests.
2. Add model endpoint, model name, and API-key fields with validation, Keystore storage, a non-destructive connection test, TLS-only default, timeout/retry/error mapping, and no secrets in React state after handoff.
3. Enforce owner validation before creating a task; reject all other chats/groups and test malformed, replayed, oversized, and rapid messages.
4. Define command/task lifecycle: accepted, queued, running, completed, failed, cancelled, output delivered, and output delivery failed. Persist only bounded, redacted metadata by default.
5. Add a device-level end-to-end test with a designated test bot/chat and a test model endpoint: owner message → queued task → model completion → owner-only Telegram reply → secret-free status receipt.

**Exit gate:** the service reports `running` only after a successful Telegram poll and model readiness check; a non-owner message demonstrably produces no task or reply.

### Phase 3 — Convert the Agent console from local drafts into real host control

1. Replace AsyncStorage-only drafts with the Phase 2 task queue, or explicitly remove the feature until it is live; no local placeholder may be presented as a host command.
2. Add send, cancel, retry, delete, delivery receipt, agent reply, last-error, and offline/service-degraded UI states.
3. Add a bounded native event/log stream consumed by Home and Agent screens, with refresh control and safe redaction.
4. Make dashboard phase/status derive only from native health, not optimistic client state.

**Exit gate:** an instruction submitted from the phone reaches the same runtime queue as Telegram, receives a visible result, and remains recoverable across app UI restart.

### Phase 4 — Implement real on-device automations

1. Define a durable schedule schema: title, instruction template, timezone, cron, enablement, destination, policy constraints, next run, last run, run history, retries, and owner linkage.
2. Validate cron and timezone before saving; show the next runs and DST behavior. Restrict delivery to the approved Telegram owner route.
3. Implement scheduler execution inside the durable native/worker runtime, restoring schedules after service or phone restart and respecting service health/power policy.
4. Add edit, delete, run-now, pause/resume, execution history, failure detail, and no-overlap/backoff controls.
5. Test invalid cron, DST transition, time-zone changes, device clock shifts, reboot, disabled schedules, service outage, duplicate delivery prevention, and recovery after a failed task.

**Exit gate:** a real scheduled task runs and delivers exactly once to the approved owner across a service restart, with timestamped history on the phone.

### Phase 5 — Make power policy, readiness, and alerts enforceable

1. Persist the charging-aware policy from Setup and Settings, hand it to native code, and decide whether it pauses new tasks, scheduler execution, or the complete host when unplugged/low battery.
2. Make battery-optimization and notification permission status actionable, but never bypass Android restrictions without an explicit user action.
3. Persist alert cooldowns; provide low-battery, low-storage, worker-degraded, offline-too-long, and recovery notifications with deduplication and user-visible thresholds.
4. Add storage quotas/cleanup for runtime data, conversation metadata, logs, task outputs, and Python caches; report usage accurately.

**Exit gate:** unplug/low-storage scenarios change the effective host behavior as documented, persist across restart, and generate one appropriate alert rather than a notification storm.

### Phase 6 — Finish observability and honest telemetry

1. Preserve the new preview/sampling/live telemetry states and integrate native worker heartbeat, freshness, and recovery status.
2. Label CPU as **Pocket Relay process CPU** and RAM as **Pocket Relay process PSS / device total** unless total-device measurements are separately implemented and verified.
3. Add last-updated data, sampling errors, bounded history (optional), manual refresh, and background polling limits to protect the old phone’s battery.
4. Test baseline sampling, a live workload, unavailable native bridge, paused host, degraded worker, permission denial, and UI resume behavior on physical hardware.

**Exit gate:** Home never renders synthetic metrics; its status, timestamps, and recovery affordances match the native worker state.

### Phase 7 — Security, privacy, FOSS, and dependency hardening

1. Perform a threat-model review for lost phone, rooted phone, stolen bot token, untrusted Telegram user, malicious model endpoint, network compromise, schedule abuse, log leakage, and denial-of-service.
2. Implement outcomes from that review: endpoint restrictions, input/output size limits, rate limiting, task concurrency limit, secret rotation/removal, safe audit events, and explicit rooted-device limitation documentation.
3. Remove unused app/server dependencies and generated debug material; correct package/project names and lock dependency versions.
4. Generate a full, machine-readable SBOM for npm, Gradle, Python, locally built wheels, and native artifacts; automate SPDX/license/notice checks and maintain upstream Hermes attribution.
5. Publish a privacy policy, security model, data-retention policy, supported-device specification, and no-Termux/limited-capability statement.

**Exit gate:** automated FOSS/license/SBOM gates cover the complete shipped artifact, security tests pass, and documentation makes no unverified guarantee.

### Phase 8 — Make the project genuinely F-Droid-ready and releaseable

1. Move all release-critical Android/prebuild/native configuration into tracked, deterministic source; prove a clean checkout can generate the Android project and build without ignored local artifacts.
2. Rework the F-Droid recipe so it references an actual public source repository and immutable release tag, obtains all dependencies from acceptable source inputs, builds required wheels reproducibly, and does not depend on a local SDK, private path, cache, or an ignored `node_modules` directory.
3. Validate the recipe in a clean, offline-oriented environment and capture exact toolchain inputs, hashes, build instructions, and reproducibility comparison results.
4. Establish protected release signing for direct APK distribution, remove debug signing from release configuration, verify signing certificate and install/update behavior, and keep signing secrets outside source control.
5. Update Fastlane metadata, screenshots, changelog, release checklist, SBOM, notices, and project docs to reflect the final artifact size and verified capability set.

**Exit gate:** clean-source reproducible builds pass; direct release APK is release-signed; F-Droid metadata is reviewable against an existing public tagged source release; no documentation retains obsolete size/status claims.

### Phase 9 — Run release-quality validation and publish only after all gates pass

1. Run TypeScript/lint/unit tests; Python tests; Kotlin/native tests; Android instrumentation tests; and mocked plus real-integration Telegram/model tests.
2. Run a physical-device matrix across the minimum supported Android version and a modern Android version, including at least one low-memory/old ARM64 phone. Test fresh install, upgrade, configure, model test, owner lock, task execution, console queue, automation, power policy, notifications, lock screen, reboot, network recovery, and uninstall/reinstall cleanup.
3. Test an adversarial matrix: invalid/rotated credentials, unauthorized messages, malformed cron, canceled worker, Android battery restriction, unavailable storage, no network, invalid model TLS/auth, process kill, and stale status.
4. Create a release candidate only after all test artifacts are attached to the release checklist. Rebuild the APK from the final source, calculate checksum, inspect its manifest/permissions/SBOM, install it on a clean device, and issue a concise known-limitations statement.

**Exit gate:** every item in the gap matrix is either demonstrated working with a test artifact or explicitly removed from the shipped UI and documentation. Only then call Pocket Relay release-ready or submit it to F-Droid.

## Test and Release Gates

| Gate | Required proof |
|---|---|
| Source correctness | TypeScript, Python syntax/type checks as applicable, formatting/lint, unit tests, no local-path-only dependencies. |
| Native correctness | Android manifest inspection, Kotlin/native tests, service lifecycle instrumentation, no exported attack surface beyond intended components. |
| Agent correctness | Owner-only Telegram integration, model health test, task queue/reply, upstream adapter compatibility test. |
| Scheduler correctness | Cron validation, next-run calculation, persistence, reboot/timezone/DST/retry/dedup tests. |
| Resilience | Service kill/restart/reboot/unlock/network/battery-optimization/low-storage tests on real devices. |
| Security/privacy | Keystore lifecycle, redaction, endpoint policy, rate/concurrency limits, dependency/license/SBOM audits, documentation review. |
| Distribution | Clean reproducible build, release signing, APK manifest/checksum/install-upgrade test, public source tag, F-Droid recipe dry run. |

## Assumptions and Risks

The plan assumes the product remains Android-only, FOSS-first, Telegram-only for remote access, and intentionally constrained rather than a general remote shell. It assumes the user can supply a valid test Telegram bot/chat and a model endpoint/API credential for the real end-to-end gate; no external service secret will be fabricated or embedded in source.

The largest risks are upstream Hermes compatibility on Android/Chaquopy, Android vendor battery restrictions, F-Droid acceptance of the Python/native build chain, and the need to balance old-device support against ARM64-only size/reproducibility. Each risk is handled as an early release gate, not deferred until the end. If the real upstream Hermes integration cannot pass owner-lock and model-response tests on Android, the correct response is to narrow or replace the adapter before feature/UI work continues.

## Completion Definition

Pocket Relay is complete only when the installed release APK—not the web preview—passes the Phase 9 gates, every surviving UI action has a verified end-to-end effect, the project builds from clean public source with complete FOSS attribution, and the release documentation accurately states all remaining limitations.
