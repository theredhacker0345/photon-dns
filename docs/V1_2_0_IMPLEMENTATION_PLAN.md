# Pocket Relay v1.2.0 — Engineering Implementation Plan

**Status:** Proposed engineering plan. This document describes how to implement the AI Operator Mode and multi-agent features agreed for v1.2.0. It does not claim these features are already present in Pocket Relay.

**Companion document:** [`V1_2_0_AI_OPERATOR_MODE_SPEC.md`](./V1_2_0_AI_OPERATOR_MODE_SPEC.md) defines the product behavior, owner boundaries, and acceptance criteria. This document turns that specification into an ordered technical delivery plan.

> **Core rule:** The owner explicitly delegates capabilities to Pocket Relay. An AI task may only use the capabilities, apps, folders, destinations, and time window selected by the owner. Broad control is visible, auditable, and revocable; it is never hidden or assumed.

## 1. Delivery outcome

v1.2.0 adds an optional **AI Operator Mode**. On an owner-approved Android phone—especially a spare phone, but not necessarily a reset phone—Pocket Relay can coordinate AI tasks that work with files, a browser, and approved visible apps. It can also divide a goal into bounded specialist tasks. The owner sees the plan, what is active, what data or device capability is being used, and where an action needs confirmation.

The initial release is deliberately conservative:

| Area | v1.2.0 delivery target | Not included in initial delivery |
|---|---|---|
| Device resources | Remove Pocket Relay policy caps in Dedicated Host Mode; show actual system pressure | Claims of unlimited physical CPU, RAM, or storage |
| Files | Broad, owner-selected read/write workspace; task artifacts; recycle bin and pre-change snapshots | Silent permanent deletion or invisible access to new folders |
| Browser | Owner-approved browser workspace, tab/task ledger, destination audit, download hand-off | Automated payment, CAPTCHA completion, or login-bypass behavior |
| Apps | Owner-allowed visible-app operation through a separately enabled accessibility service | Parallel agents controlling the same screen, or bypassing app authentication |
| Agents | Coordinator + Worker + Reviewer, with a default three-agent ceiling | Unbounded background swarms |
| Root | Optional, separately installed allowlisted companion design | Root acquisition, arbitrary AI-generated `su` commands, or mandatory root |

## 2. Architecture at a glance

The feature is implemented as a policy-first orchestration layer. The model does not call Android services, file APIs, browser navigation, or root directly. It produces a typed intent. Pocket Relay’s local policy engine validates the intent against the owner’s grants, task state, and confirmation policy before a capability-specific executor can act.

```text
Owner (Pocket Relay UI / Telegram)
        │
        ▼
Task Coordinator ───────► Task Plan + Capability Manifest
        │                         │
        ├──── Research Worker ────┤
        ├──── File Worker ────────┤──► Task Artifact Store + Audit Ledger
        ├──── Reviewer ───────────┤
        └──── App Operator ───────┘
                  │
            UI Operator Lease
                  │
                  ▼
Capability Broker ──► File / Browser / Accessibility / Native Host / Root Companion
                  │
                  ▼
      Owner confirmation, revocation, and persistent host notification
```

### 2.1 Design boundaries

| Boundary | Implementation decision |
|---|---|
| **AI versus device APIs** | A model emits typed tool requests. It never receives an arbitrary Android shell, unrestricted `su`, or direct filesystem path outside approved scopes. |
| **Device versus owner** | The owner sets scopes and confirmation rules. The app persists policy locally and cannot expand it just because an agent requests more access. |
| **Background reasoning versus visible UI** | Multiple bounded workers may reason in parallel, but a lease manager allows only one app/browser UI operator at a time. |
| **Normal versus rooted phone** | Normal Operator Mode works without root. Root Companion Mode is a separate optional integration with an operation allowlist. |
| **Task data versus long-term settings** | Task artifacts are stored by task ID with retention rules; capability configuration and audit metadata are persisted separately. |

## 3. Prerequisite work and dependency order

The work must be delivered in the following order. Building UI automation or sub-agent spawning before the capability broker and audit ledger would create unreviewable control paths.

| Order | Workstream | Why it comes first | Exit condition |
|---:|---|---|---|
| 0 | Architecture baseline | Fix shared language, models, and feature flags | Data schemas approved and migration strategy documented |
| 1 | Capability policy engine | Every later executor must enforce the same owner scope | Deny-by-default policy tests pass |
| 2 | Audit, task artifacts, and revocation | Actions need a durable, reviewable record before execution broadens | Replayable local task timeline works |
| 3 | File Workspace | Provides a safe first execution surface without UI automation | Create/edit/move/recover tests pass |
| 4 | Browser Workspace | Adds external information and downloads with destination audit | Browser task and export-confirmation tests pass |
| 5 | Accessibility App Operator | Adds high-risk visible app interaction after controls exist | Lease exclusivity and physical-device tests pass |
| 6 | Multi-agent coordinator | Delegates only into already controlled capability surfaces | Queue, cancellation, and reviewer gates pass |
| 7 | Dedicated Host policies | Optimizes long-running behavior and uncapped app policy | Thermal/memory response verified on hardware |
| 8 | Root Companion Mode | Adds privileged operations only after non-root flows are stable | Independent rooted-device security review passes |

## 4. Workstream 0 — shared models and feature flags

Create a shared domain package that the React Native UI, TypeScript task runtime, Kotlin native module, and Python/Hermes worker can all represent through serializable schemas. Existing Pocket Relay settings and host telemetry remain the base layer; v1.2.0 introduces additive records rather than replacing working 1.0.x configuration.

### 4.1 Core data model

| Model | Required fields | Purpose |
|---|---|---|
| `OperatorModePolicy` | `enabled`, `dedicatedHost`, `acknowledgedAt`, `capabilityRevision`, `emergencyPolicy` | Top-level owner decision and feature state |
| `CapabilityGrant` | `id`, `kind`, `enabled`, `scope`, `grantedAt`, `expiresAt`, `confirmationClass` | One explicit capability and its concrete scope |
| `Task` | `id`, `ownerSource`, `goal`, `state`, `plan`, `createdAt`, `completedAt` | Owner-requested unit of work |
| `TaskStep` | `id`, `taskId`, `agentRole`, `state`, `requiredCapabilities`, `inputRefs`, `outputRefs` | Reviewable planned sub-task |
| `AgentRun` | `id`, `taskId`, `role`, `modelRoute`, `state`, `budget`, `startedAt`, `endedAt` | A bounded Coordinator, Worker, Reviewer, Monitor, or Operator run |
| `OperatorLease` | `id`, `taskId`, `agentRunId`, `targetPackage`, `issuedAt`, `expiresAt`, `state` | Exclusive visible UI control lock |
| `AuditEvent` | `id`, `taskId`, `actor`, `eventType`, `summary`, `capabilityRef`, `result`, `createdAt` | Append-oriented local activity ledger |
| `ConfirmationRequest` | `id`, `taskId`, `reason`, `proposedEffect`, `expiresAt`, `decision` | Owner gate for consequential actions |
| `TaskArtifact` | `id`, `taskId`, `kind`, `path`, `hash`, `retentionClass` | Plan, report, file manifest, snapshot, or evidence item |

All fields must have strict validation. A parser failure is a denial, not a fallback to a looser object. The app will use a single policy version and migrate existing settings only through tested migration functions.

### 4.2 Feature flags

The first implementation uses owner-visible flags, not hidden server-side experimentation. `operatorMode`, `fileWorkspace`, `browserWorkspace`, `appOperator`, `multiAgent`, `dedicatedHost`, and `rootCompanion` are independently disabled by default. A dependent feature cannot be enabled when a required lower-level control is off.

## 5. Workstream 1 — capability policy engine

Implement a local TypeScript **Capability Broker** as the only entry point for all v1.2.0 actions. Every executor calls `authorize(actionRequest)`. The broker checks policy, task state, allowed scope, confirmation state, background/device health, and operator lease where applicable.

### 5.1 Typed action protocol

Each request has one named action and a small schema. Examples include:

| Action family | Example request | Required grant |
|---|---|---|
| File | `file.writeText(path, content, expectedVersion)` | `files.write` scoped to `path` |
| File | `file.move(from, to)` | `files.write` scoped to both paths |
| Browser | `browser.navigate(url, mode)` | `browser.navigate` and destination policy match |
| Browser | `browser.export(downloadRef, destination)` | `browser.navigate` plus export confirmation if external |
| App UI | `ui.launch(packageName)` | `apps.allowed.control` plus current UI lease |
| App UI | `ui.perform(nodeTarget, action)` | `apps.allowed.control`, lease, and allowed action class |
| Host | `host.inspect()` | `network.diagnostics` or host-monitor policy |
| Root | `root.run(operationId, parameters)` | `host.root.allowlisted`, operation allowlist, and confirmation policy |

The broker returns a structured decision: `allowed`, `denied`, or `confirmation_required`. It records the decision in the audit ledger before an executor runs. An executor independently rechecks the approval token just before performing the effect to prevent stale authorizations.

### 5.2 Scope types

| Capability | Scope representation | Enforcement detail |
|---|---|---|
| Files | Canonicalized root paths plus read/write mode | Resolve symlinks; reject traversal and paths outside all granted roots |
| Apps | Android package-name allowlist and protected-package denylist | Verify current foreground package before every visible action |
| Browser | Optional hostname rules, task-mode rule, and dedicated profile ID | Record final destination after redirects; deny a forbidden final host |
| Notifications | Package allowlist and content-retention level | Store metadata by default; content capture requires a separate setting |
| Camera | Capture count, resolution, destination path | Explicit prompt before first capture per task |
| Root | Named operation IDs and parameter schema | No string command pathway; reject unknown operation IDs |

### 5.3 Confirmation engine

Implement confirmation as a durable state machine, not a modal-only UI. A paused task gets a `ConfirmationRequest` that can be approved or denied on the phone and, where already supported by the owner gateway, by Telegram. Requests expire and cannot be reused for a different task, path, package, URL, or action payload.

High-risk defaults are: financial action, public publishing, first-contact messaging, permanent deletion, account/security changes, app-policy expansion, device permission changes, and all Root Companion operations. The owner may choose standing rules only for low-risk repeated local work.

## 6. Workstream 2 — audit ledger, artifacts, cancellation, and recovery

### 6.1 Append-oriented audit ledger

Build a local ledger that stores structured action summaries. Every plan creation, capability decision, file mutation, browser destination, app launch, UI lease event, confirmation, error, cancellation, and root operation writes an event. The ledger must contain enough data to explain *what happened* without retaining every screen or model prompt by default.

The UI exposes filters for task, agent, capability, package, path, destination, result, and time. A task summary can export a human-readable activity report from local artifacts.

### 6.2 Task artifact layout

Each task receives an application-private task artifact directory:

```text
tasks/<task-id>/
  plan.json
  agent-runs/<run-id>.json
  evidence/
  outputs/
  snapshots/
  file-manifest.json
  final-report.md
```

The artifact manifest hashes generated output and records its source action. Deleting a task follows the existing encrypted-backup and retention practices, while operating-file changes remain separately reversible through snapshots or the recycle bin.

### 6.3 Cancellation and emergency revoke

Define four separate controls:

| Control | Effect |
|---|---|
| **Stop current task** | Cancels one task, releases its lease, and checkpoints artifacts. |
| **Pause all operators** | Prevents new UI actions and external effects while preserving task state. |
| **Revoke a capability** | Invalidates pending authorization tokens tied to that capability or scope. |
| **Stop host** | Stops the foreground worker, cancels active runs, and leaves an explicit resume record. |

The persistent host notification must expose at least `Pause all` and `Stop host`. Android foreground services are visible to the user through a status-bar notification, so the Operator Mode state belongs there rather than in a hidden background process. [2]

## 7. Workstream 3 — File Workspace

File Workspace is the first user-visible executor because it enables useful work without accessibility control.

### 7.1 Implementation components

1. **Scoped File Service:** A Kotlin/React Native bridge for storage access that canonicalizes paths, enforces Capability Broker decisions, and returns metadata, not opaque handles.
2. **Snapshot service:** Before write, move, overwrite, or delete, captures either an atomic text diff, a compressed copy, or a no-snapshot result when the owner has disabled snapshots or storage is insufficient.
3. **Recycle-bin service:** Moves deletions into an application-managed recoverable location, records original path and expiry, and only offers permanent deletion after confirmation.
4. **File manifest service:** Generates task-level manifests with hash, source action, original path, and output path.
5. **File Workspace screen:** Displays roots, available storage, active task files, pending mutations, snapshots, and recovery controls.

### 7.2 File safety rules

The executor uses atomic writes where the filesystem permits. It validates expected file versions before overwrite, rejects traversal such as `../`, blocks writes outside grants, and treats a path that resolves through a symbolic link outside scope as denied. Bulk operations are planned first and become a confirmation request if their count crosses the owner’s configured threshold.

### 7.3 Tests

Unit tests cover path traversal, symlink escape, path-scope comparison, snapshot behavior, failed atomic write recovery, recycle-bin restore, and artifact manifest hashing. Native tests cover Android storage permission transitions. Physical-device tests cover broad workspace selection, storage pressure, large-file limits, and owner cancellation during a bulk move.

## 8. Workstream 4 — Browser Workspace

Browser work should initially use a dedicated, auditable operating surface rather than pretending to control every third-party browser feature perfectly. The implementation can combine an in-app browsing surface for controlled tasks with the App Operator for owner-approved external browser use.

### 8.1 Browser data and control flow

1. Coordinator creates a browser sub-task with mode: `research`, `assisted_form`, or `owner_supervised`.
2. Capability Broker validates browser grant and destination policy.
3. Browser executor opens a session associated with task ID and records URL, timestamps, title, download, and result.
4. Redirects are checked against final-destination rules.
5. A download becomes a `TaskArtifact` and must pass file-scope checks before placement.
6. Submission, upload, public sharing, or a new external destination requests owner confirmation when required.

### 8.2 Browser features

| Feature | Implementation detail |
|---|---|
| Session ledger | Persist task-to-tab/session association, destination history, completion state, and source references. |
| Research capture | Save selected quotes, URL, title, retrieval time, and agent interpretation separately. |
| Download handling | Place into a task staging area, scan manifest metadata, then move only after file policy approval. |
| Form preparation | Let the operator fill ordinary fields, but intercept submit when the confirmation class requires it. |
| Destination policy | Match canonical hostname after redirects; show the owner the exact external domain before a new grant. |

### 8.3 Tests

Mock navigation tests cover redirects, blocked hosts, allowed subdomains, download staging, cancelled upload, and confirmation expiration. Physical-device tests use safe test pages only. No test flow must automate real purchases, authentication challenges, or production account settings.

## 9. Workstream 5 — Accessibility App Operator and exclusive UI lease

An Android accessibility service can inspect configured window content, perform node actions, and dispatch gestures when the service declares the corresponding capabilities. It is a specialized and high-privilege Android mechanism, so Pocket Relay must require explicit owner activation in Android Settings and explain the precise scope before it is enabled. [1]

### 9.1 Native service design

Create a Kotlin `AccessibilityService` module with these responsibilities:

| Module | Responsibility |
|---|---|
| `OperatorAccessibilityService` | Receive configured accessibility events; expose current approved-window metadata only while Operator Mode is enabled. |
| `UiTreeAdapter` | Convert a limited, normalized accessibility-tree representation into serializable nodes; redact disallowed content. |
| `UiActionExecutor` | Perform a typed action only after lease and broker approval; return structured success/failure evidence. |
| `ForegroundPackageVerifier` | Confirm that the current package matches the lease’s allowed target before each action. |
| `OperatorLeaseManager` | Persist/renew/revoke exclusive lease state and reject concurrent holders. |
| `OperatorNotificationController` | Maintain a persistent notification with pause and stop actions. |

The service configuration requests only event types and flags needed for approved visible app operation. It must avoid `typeAllMask` by default because Android documents that broad event capture can be resource intensive. [1]

### 9.2 UI operator lease algorithm

1. Coordinator requests a lease for one task, agent run, and target package.
2. Lease Manager checks that Operator Mode, accessibility activation, package allowlist, and capability grant are active.
3. If no active lease exists, it writes a lease with short expiry and emits `ui_lease_granted`.
4. App Operator renews only while actively progressing its assigned step.
5. Before every launch, node action, gesture, or text entry, the executor verifies lease ID, task ID, current package, and expiry.
6. Pause, stop, confirmation wait, foreground-package mismatch, error, or expiry releases the lease.
7. A second agent receives `lease_unavailable`, never a queue bypass.

### 9.3 App safety controls

The user selects allowed packages during setup. Pocket Relay maintains a recommended protected-app blocklist including banking, password-management, authenticator, and sensitive messaging packages; the owner can extend it. Attempting a blocked app logs a denied event and produces a plain-language explanation.

The App Operator supports launch, back, home, scroll, click, text entry, and simple gesture actions. It does not attempt to solve CAPTCHAs, defeat biometrics, read hidden secure fields, bypass a login, or dismiss a security prompt. When an app asks for a password, biometric, one-time code, payment approval, or high-consequence submission, the executor pauses and creates a confirmation/owner-action request.

### 9.4 Tests

| Test layer | Required cases |
|---|---|
| Kotlin unit | Lease expiration, concurrent request rejection, package mismatch, service disabled, pause revocation |
| TypeScript policy | Allowlist, protected-app denial, confirmation request binding, audit event creation |
| Instrumented Android | Accessibility enablement state, UI action serialization, notification pause action |
| Physical device | Safe demo app flows, app switch mid-task, screen lock, incoming notification, network loss, owner stop |

## 10. Workstream 6 — Coordinator and multi-agent runtime

### 10.1 Agent roles

The initial release implements five roles, although only three non-operator agents may be live by default.

| Role | Inputs | Outputs | Prohibited behavior |
|---|---|---|---|
| Coordinator | Owner goal, policy, task history | Structured plan, assignments, final response | Direct device action without broker/executor |
| Worker | Narrow sub-task and permitted artifacts | Research note, draft, classification, file operation proposal | Broaden scope or spawn unlimited workers |
| Reviewer | Plan, worker output, evidence manifest | Pass, revision request, safety issue, missing-evidence report | Execute external effect |
| App Operator | One approved UI step and lease | Action result and observed state | Work outside target task/package/lease |
| Host Monitor | Telemetry and resource policy | Health signal and scheduling advice | Modify user files or app UI |

### 10.2 Scheduler and resource budget

The scheduler reads current host telemetry and maintains a local concurrency budget. Initial defaults are one Coordinator, one Worker, and one Reviewer. The App Operator is exclusive and is scheduled only when it holds a lease.

| Host state | Scheduler action |
|---|---|
| Charging, cool, adequate storage and memory | Run the configured maximum specialist count. |
| Battery low, heat elevated, or memory/storage pressure | Prevent new workers; checkpoint active workers; keep Coordinator/Monitor only where possible. |
| No network | Pause browser and remote-model sub-tasks; allow safe local artifact work if a model/runtime is available. |
| Owner pause | Stop issuing action tokens and revoke active UI lease immediately. |
| Worker output invalid | Send to Reviewer or Coordinator; do not retry an external action automatically. |

Dedicated Host Mode removes Pocket Relay’s own CPU/RAM/storage caps, but the scheduler still responds to Android and kernel resource signals. It must not represent thermal throttling, low-memory killing, or filesystem capacity as disabled.

### 10.3 Sub-agent spawning protocol

The Coordinator may create a `SpawnAgentRequest` only when all fields validate:

```text
parentTaskId
role
goal
expectedOutputSchema
allowedCapabilities
artifactInputs
budget { maxTurns, deadline, contextLimit }
```

The scheduler rejects a request that exceeds the concurrency budget, duplicates an active task, requests unauthorized capability, or lacks a defined expected output. Each child receives a fresh, bounded context packet rather than the complete owner/device history. All child output returns to the parent task artifact store and passes Reviewer checks before it can cause an external effect.

### 10.4 Reviewer gate

The Reviewer is not a security boundary by itself; policy enforcement remains deterministic. Its role is quality control: identify unsupported claims, stale evidence, conflicting worker outputs, destructive file plans, missing confirmation, and incomplete results. The Coordinator may auto-accept only low-risk local artifacts that meet deterministic policy and the reviewer’s expected schema.

## 11. Workstream 7 — Dedicated Host Mode and host health

Dedicated Host Mode is a profile atop existing Pocket Relay host controls. It does not require a factory reset. During onboarding, it presents a risk acknowledgement and an optional device-readiness scan that identifies personal accounts, sensitive app categories, low free space, battery health concerns, or missing accessibility activation. The scan informs the owner; it does not prevent enablement.

### 11.1 Host features

| Feature | Implementation approach |
|---|---|
| Uncapped policy profile | Disable Pocket Relay’s configurable resource ceilings and label the mode clearly in UI and audit events. |
| Resource dashboard | Display CPU, memory, storage, charge state, temperature/thermal status when supported, agent count, and current UI lease. |
| Heat-aware scheduling | Pause new workers and reduce concurrency based on native thermal telemetry and owner-configured thresholds. |
| Charging health | Surface sustained charge state, low-battery condition, and optional battery-protection schedule. |
| Connectivity | Show Wi-Fi, VPN/proxy, Telegram gateway health, and model/provider availability without exposing secrets. |
| Persistent control | Foreground notification communicates active Operator Mode, resource state, and immediate pause/stop actions. |

## 12. Workstream 8 — optional Root Companion Mode

Root features are designed only after normal Operator Mode is stable. The companion is a separately named, GPL-compatible local integration for a user-rooted device; Pocket Relay never roots a phone.

### 12.1 Protocol design

The app talks to the companion through a local authenticated IPC contract. Requests contain a versioned operation ID, JSON parameters, task ID, short-lived broker approval token, nonce, expiry, and expected result schema. The companion validates every field independently and writes its own audit event.

Example allowlisted operation classes are `host.disk.inspect`, `workspace.maintenance`, `host.diagnostics.collect`, `host.component.restart`, and owner-confirmed `host.reboot`. There is no `runShell(command)` operation. New operations require a code review, a schema, explicit documentation, and test coverage.

### 12.2 Root safety gates

1. Root Companion Mode requires a separate acknowledgement after base Operator Mode setup.
2. Every root operation requires explicit allowlist membership and an owner confirmation class.
3. The companion rejects malformed, expired, replayed, or unknown requests.
4. A missing companion, failed signature/version check, or lost root privilege fails closed.
5. Root execution history appears in the same owner-visible audit ledger.
6. Standard F-Droid builds remain useful with no root dependency.

## 13. User-interface implementation plan

| Screen | Components to build | Primary actions |
|---|---|---|
| **Operator Setup** | Risk warning, reset recommendation, capability preset, scope chooser, readiness scan | Enable/disable mode; choose scopes; open Android accessibility settings |
| **Capability Console** | Capability cards, app/folder/destination scopes, recent activity, revoke controls | Toggle scope; inspect use; revoke capability |
| **Task Planner** | Goal field, generated plan, agent assignments, capability summary, confirmation markers | Approve plan; edit scope; stop task |
| **Live Task View** | Agent roster, status, progress, current app, UI lease state, next action | Pause task; stop agent; approve/deny request |
| **File Workspace** | Roots, task artifacts, pending changes, snapshots, recycle bin | Recover file; inspect diff; approve bulk operation |
| **Browser Workspace** | Task tabs, destinations, sources, download staging, form confirmation | Review source; approve submission/export |
| **Activity Ledger** | Filterable timeline with task, agent, app, file, and destination context | Export task report; inspect denied action |
| **Dedicated Host Dashboard** | Resource health, charging, thermal state, connectivity, concurrency policy | Choose profile; change scheduling threshold; pause host |
| **Root Companion** | Availability state, named operation list, warnings, audit history | Enable separately; grant per-operation policy |

The mobile design follows portrait, one-handed usage: operational status and emergency controls stay in reach; broad capability toggles use explanation sheets; destructive or externally consequential actions use explicit bottom sheets with task-specific details.

## 14. Security and F-Droid release gates

Before v1.2.0 is considered release-ready, add deterministic tests and release checks for each new boundary.

| Gate | Required evidence |
|---|---|
| Capability policy | Tests prove deny-by-default, correct path/package/host matching, and confirmation-token binding. |
| UI lease | Tests prove only one lease can exist, expiry releases access, and revoke interrupts execution. |
| File safety | Tests prove traversal/symlink escape denial, snapshot/recycle-bin recovery, and manifest integrity. |
| Browser safety | Tests prove redirect enforcement, export confirmation, and task-bound download hand-off. |
| Multi-agent safety | Tests prove concurrency ceiling, child-context bounds, cancellation propagation, and no unauthorized child capability. |
| Auditability | Tests prove actions and denials produce task-bound ledger entries with stable ordering. |
| Root companion | Tests prove unknown operations, string-shell attempts, expired tokens, and missing companion failures are denied. |
| FOSS/F-Droid | License audit, dependency/SBOM update, source scan, reproducible build checks, and optional-accessibility documentation review all pass. |
| Physical device | A dedicated-device acceptance checklist covers operator activation, task execution, loss of connectivity, incoming interruptions, resource pressure, and emergency stop. |

## 15. Rollout and migration

### 15.1 Migration

The v1.2.0 database/settings migration is additive. Existing Pocket Relay users remain in normal host mode with all new capability flags disabled. No existing Telegram, model-provider, skill, backup, or notification data is granted to Operator Mode automatically.

### 15.2 Incremental rollout

| Milestone | Enablement | Required review |
|---|---|---|
| **M1: Policy + Audit** | Internal/test build only | Schema and threat-model review |
| **M2: File Workspace** | Opt-in local feature | File recovery and storage-pressure review |
| **M3: Browser Workspace** | Opt-in local feature | Destination/confirmation test review |
| **M4: App Operator** | Explicit Android accessibility setup | Physical-device safety review on safe demo apps |
| **M5: Multi-agent** | Three-agent ceiling | Cancellation, lease, and resource review |
| **M6: Dedicated Host** | Explicit acknowledgement | Long-running spare-device acceptance test |
| **M7: Root Companion** | Separate experimental opt-in | Independent rooted-device security review |

### 15.3 Documentation deliverables

Update the README, User Guide, privacy explanation, threat model, F-Droid metadata where applicable, skill-manifest format, and physical-device acceptance checklist. Documentation must clearly distinguish normal host behavior, non-root Operator Mode, and experimental Root Companion Mode.

## 16. Definition of done

The v1.2.0 implementation is complete only when the following end-to-end path succeeds on a physical Android device:

1. An owner enables Operator Mode, acknowledges the risk, and selects a file workspace, browser scope, and app allowlist without resetting the phone.
2. The owner gives a multi-part goal.
3. The Coordinator creates a plan and spawns a bounded Worker and Reviewer.
4. The Worker collects permitted information and prepares a file artifact inside the granted workspace.
5. The Reviewer validates the result and reports any required owner confirmation.
6. The App Operator obtains an exclusive lease, opens an allowed app, performs a safe visible action, and releases the lease.
7. A browser or external-export step pauses until the owner approves it.
8. The owner uses the persistent notification or Capability Console to pause activity; all active work checkpoints and the UI lease is revoked.
9. The activity ledger reconstructs the task, relevant source destinations, file changes, confirmations, agent runs, and final result.
10. Existing Pocket Relay host, Telegram, backup, and non-root F-Droid flows continue to work unchanged.

## References

[1] [Android Developers, “Create an accessibility service.”](https://developer.android.com/guide/topics/ui/accessibility/service)

[2] [Android Developers, “Foreground services overview.”](https://developer.android.com/develop/background-work/services/fgs)
