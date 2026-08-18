# Pocket Relay Implementation Traceability Matrix

## Purpose and Status Vocabulary

This matrix is the source of truth for product claims during the gap-closure program. **Implemented** means source exists. **Verified** means a repeatable test has passed. **Prototype-only** means the visible UI or configuration has no complete native/runtime effect and must not be described as operational hosting.

| Status | Meaning |
|---|---|
| Prototype-only | Local UI/persistence or configuration exists, but it does not cause the advertised host behavior. |
| Implemented, unverified | Source is present but has not passed the required native or device acceptance test. |
| Verified | Required automated and/or physical-device acceptance evidence is attached to the release gate. |

## UI-to-Runtime Traceability

| Visible control or claim | Current handler | Current effect and persistence | Recovery / runtime owner | Acceptance evidence required | Current status |
|---|---|---|---|---|---|
| Save Telegram host configuration | `saveConfiguration` in `lib/pocket-hermes-store.tsx` | Persists public fields in AsyncStorage and Telegram token via Expo SecureStore. | React control plane; native worker receives a token only when started. | Keystore migration, token rotate/delete, native config read, redaction tests. | Prototype-only |
| Start host | `prepareRuntime` → `startNativeSupervisor` | Requests the local Android module to start the foreground service. Web reports bridge required. | Kotlin service uses `START_STICKY`; worker health is not yet authoritative in UI. | Instrumented start/duplicate-start/kill/reboot/network tests and heartbeat proof. | Implemented, unverified |
| Stop host | `stopHost` → `stopNativeSupervisor` | Requests service stop and optimistically changes client phase. | Kotlin service. | Deterministic cancellation, no duplicate worker, clean long-poll shutdown. | Implemented, unverified |
| Home CPU/RAM | `useSupervisorTelemetry` | Reads native app-process samples on Android; preview is explicitly unavailable. | Kotlin sampler. | Device sampling under idle/load and heartbeat freshness test. | Implemented, unverified |
| Telegram credential check | `testGateway` | Calls Telegram `getMe` from JavaScript with the token. | React control plane. | Native secure network client, timeouts, redaction, real credential test. | Prototype-only |
| Telegram test message | `sendTestMessage` | Calls Telegram `sendMessage` from JavaScript and stores local receipt event. | React control plane. | Owner-only path, native receipt, retry/idempotency test. | Prototype-only |
| Model endpoint | Setup/Settings text field | Stores an optional URL; no model key/name/health test enters the worker. | None. | HTTPS validation, Keystore API key, model preflight, error mapping. | Prototype-only |
| Agent Console | `addDraft` | Stores local AsyncStorage drafts; no task enters the worker. | React control plane. | Native durable queue, cancellation/retry/history and successful response test. | Prototype-only |
| Automations | `addAutomation`, `setAutomationEnabled` | Stores local cron-like records; no scheduler runs. | React control plane. | Cron/timezone validation, native restore, run history, exactly-once delivery test. | Prototype-only |
| Charging-aware policy | Setup/Settings component state | Display-only; not persisted as effective native policy. | None. | Persisted policy, native enforcement, unplug/restart test. | Prototype-only |
| Low battery/storage alerts | `useHostAlerts` | Local permission and in-memory deduplicated notifications. | React hook. | Persisted cooldown, permission/restart/threshold tests. | Implemented, unverified |
| Restart after reboot | No user control. | No tracked receiver or verified manifest declaration. | None. | Opt-in boot/unlock recovery and force-stop boundary tests. | Not implemented |
| F-Droid-ready release | Metadata and build artifact exist. | Current direct APK uses debug signing; recipe/build inputs require clean-source proof. | Release process. | Clean-source reproducible build, public tag, F-Droid dry run, signing validation. | Prototype-only |

## Authoritative Contracts

The initial secret-free contract lives in `lib/host-contracts.ts`. Future Kotlin and Python bindings must use the same contract version and must never serialize Telegram or model credentials in events, diagnostics, or JavaScript-visible health payloads.

| Contract | Required owner | Next implementation phase |
|---|---|---|
| `HostRuntimePolicy` | JavaScript persistence and native supervisor enforcement | Service lifecycle and policy phases |
| `PublicHostConfiguration` | JavaScript UI; native receives only validated secret handoff | Model and Keystore phases |
| `WorkerHealth` | Native supervisor, then UI consumer | Worker-health phase |
| `HostTask` | Native durable queue and UI | Telegram/Agent Console phases |
| `HostSchedule` | Native scheduler and Automations UI | Automation phase |
| `HostDiagnostic` | Native events with bounded, redacted retention | Lifecycle/observability phases |

## Release Claim Rules

Until the stated acceptance evidence exists, documentation and UI must use **configured**, **prototype-only**, **pending validation**, or **requires installed Android build**. They must not state that the phone is a persistent 24/7 host, that schedules execute, that the agent replies, or that the project is F-Droid-ready.
