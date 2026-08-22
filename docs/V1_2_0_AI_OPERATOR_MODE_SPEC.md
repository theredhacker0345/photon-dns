# Pocket Relay v1.2.0 — AI Operator Mode and Multi-Agent Orchestration

**Status:** Product and engineering specification. This document defines a proposed v1.2.0 scope; it is not a promise that every item has already shipped.

**Release principle:** *Powerful by explicit delegation, never powerful by surprise.*

## 1. Product intent

Pocket Relay v1.2.0 expands the existing self-hosted Android host into an **owner-authorized device operator**. The goal is to let an owner dedicate a spare or lightly used Android phone to AI work without requiring a factory reset. When the owner deliberately enables this mode, the agent may use the phone as a practical workspace: it can work with assigned files, navigate an approved browser profile, operate explicitly allowed visible apps, and coordinate several bounded specialist agents.

The design does **not** treat the device as secretly autonomous. The phone continues to belong to its owner. The owner chooses the available capabilities, sees an always-present operating status, can review what occurred, and can stop the operator immediately.

> **Dedicated Phone Warning:** AI Operator Mode can read visible content, operate approved apps, and modify files within the scope selected by the owner. It is not appropriate to enable broad scopes on a phone containing banking apps, password managers, authenticators, private messages, or personal files unless the owner knowingly accepts that exposure.

The mode is useful even when a phone has not been reset. Setup must present a clear risk acknowledgement, show the selected scope, and recommend—but never require—that the owner uses a spare device with personal accounts and sensitive apps removed.

## 2. Terminology

| Term | Meaning |
|---|---|
| **AI Operator Mode** | An optional Pocket Relay mode that allows an agent to carry out owner-approved work through files, a browser, and visible Android apps. |
| **Capability** | A narrowly named permission such as `files.write`, `browser.navigate`, or `apps.allowed.control`. |
| **Scope** | The concrete resources available under a capability, such as selected folders, an allowed-app list, or approved web destinations. |
| **Operator lease** | An exclusive, time-limited lock allowing exactly one agent to control the visible Android user interface. |
| **Coordinator** | The lead agent that decomposes an owner goal, assigns work, checks results, and produces the final outcome. |
| **Specialist agent** | A bounded worker such as a researcher, file worker, reviewer, monitor, or visible-app operator. |
| **Root Companion Mode** | A separate optional integration for an owner-rooted device that exposes an allowlisted set of privileged host operations. It is never silently enabled. |

## 3. Goals and non-goals

### 3.1 Goals

The release is intended to make a dedicated Android phone useful as a transparent small-scale AI workstation. It must support broad owner-selected file work, browser workflows, approved-app operation, long-running host activity, task review, recoverability, and multi-agent delegation. It should preserve Pocket Relay’s GPL-3.0-only, self-hosted, owner-controlled posture.

### 3.2 Non-goals

v1.2.0 must not claim that an AI can bypass Android authentication, biometric checks, CAPTCHAs, app-level authorization, payment confirmation, or platform restrictions. It must not hide activity, collect every screen or notification by default, bundle a rooting mechanism, or offer an unbounded arbitrary root shell. It also must not allow two agents to compete for the visible UI at the same time.

## 4. Capability model

AI Operator Mode is configured as explicit capability grants rather than one opaque “full control” switch. A broad preset may turn on multiple capabilities, but the console always shows their individual state and scope.

| Capability | Owner-selected scope | Intended actions | Default state |
|---|---|---|---|
| `files.read` | Chosen directories or a dedicated workspace | List, search, classify, and read files | Off |
| `files.write` | Chosen directories or a dedicated workspace | Create, edit, rename, move, archive, and send items to recycle bin | Off |
| `browser.navigate` | Dedicated browser profile and optional destination rules | Search, navigate, download, fill ordinary forms, and save reports | Off |
| `apps.allowed.control` | Explicit allowlist of installed apps | Launch, inspect visible UI, tap, type, scroll, and follow task playbooks | Off |
| `notifications.review` | Explicit app allowlist | Summarize and triage notifications | Off |
| `camera.capture` | Camera and target storage folder | Capture a document, photo, or whiteboard for an owner-defined task | Off |
| `network.diagnostics` | Local device network only | Test reachability, record Wi-Fi/VPN/proxy status, and suggest recovery steps | On only when host monitoring is enabled |
| `host.root.allowlisted` | Root Companion operation allowlist | Run a reviewed set of privileged host-maintenance actions | Off; unavailable unless the owner has rooted the device |

### 4.1 Broad dedicated-host preset

The **Dedicated Host** preset is for a spare or intentionally delegated phone. It removes Pocket Relay’s own CPU, RAM, and storage policy caps and can grant broad file access, browser use, and allowed-app operation. It does not promise physically unlimited resources: Android and the kernel may still throttle for heat, battery, storage pressure, memory pressure, or background-execution policy.

Before the preset becomes active, the owner must review a single-screen summary of enabled scopes, confirm that the phone may contain personal data, and choose either **Enable now** or **Review scopes**. The acknowledgement is stored locally with the capability revision and timestamp. No factory-reset check blocks activation.

## 5. Visible app and browser operation

Android accessibility services can inspect configured UI content, perform node actions, and dispatch gestures when declared with the corresponding service configuration; the feature therefore requires a deliberate system-level accessibility enablement step. [1] Pocket Relay must present this as a highly privileged capability and explain why it is being requested.

### 5.1 App Operator

The App Operator works only inside the owner’s approved app list. It can launch an allowed app, interpret visible app content, tap or scroll, enter text, return to the home screen, and report the observed result. Every session produces a local timeline containing the app package, high-level action, outcome, timestamps, and any owner confirmation decision.

The operator must pause and request the owner’s confirmation before it attempts any of the following:

| Confirmation class | Examples |
|---|---|
| **Financial or irreversible** | Purchases, transfers, subscriptions, irreversible deletion, or accepting legal terms |
| **Account/security** | Password changes, adding passkeys, two-factor authentication, recovery flows, or permission changes |
| **External publishing** | Sending messages to a new recipient, posting publicly, uploading to an external service, or sharing a file outside the assigned workspace |
| **Scope expansion** | Opening a non-allowed app, entering a new storage location, enabling a device setting, or requesting root operations |

The operator must neither attempt to defeat authentication nor interpret an owner confirmation as permission to bypass app safeguards. A blocked login, biometric prompt, CAPTCHA, or payment approval becomes a clearly reported owner step.

### 5.2 Browser Workspace

The Browser Workspace supplies a dedicated profile or logical session boundary for agent work. It tracks tabs, downloads, bookmarks, task association, destination history, and file hand-offs. Tasks may be limited to an allowlist, a blocklist, or an unrestricted owner-approved browsing scope.

The browser should support three activity modes:

| Mode | Behavior |
|---|---|
| **Research** | Read and summarize content, retain source links, and avoid forms that cause external effects. |
| **Assisted form work** | Prepare ordinary form fields and pause before submission or external sharing. |
| **Owner-supervised operation** | Perform a live task while the owner sees the current plan, destination, and pending confirmation points. |

## 6. File workspace and recoverability

The File Workspace provides a practical project area for reports, code, downloads, archives, media, and agent-created artifacts. It must show the assigned paths plainly; a user should never need to infer whether the agent can see a particular directory.

| Feature | Required behavior |
|---|---|
| **Workspace browser** | Show file locations, ownership label, current task, recent modifications, and storage use. |
| **Create and edit** | Create documents, source files, structured data, archives, and media folders within granted scope. |
| **Move and organize** | Rename, classify, archive, and deduplicate files while recording before/after paths. |
| **Recycle bin** | Send deletions to a recoverable local bin by default; permanent deletion requires confirmation. |
| **Version snapshots** | Retain lightweight pre-change copies or text diffs for agent-modified files when storage permits. |
| **Export review** | Show all files proposed for Telegram, browser upload, share sheet, or other external export before transfer. |

The operator must create a task artifact directory for each substantial task. This directory contains the plan, agent outputs, evidence links, file manifest, and a concise final result. It supports both auditability and later recovery.

## 7. Multi-agent orchestration

### 7.1 Orchestration rule

The owner interacts with one **Coordinator**, not a swarm of unaccountable processes. The Coordinator builds a plan, creates bounded sub-tasks, chooses capability-limited specialists, checks completion, and gives the owner one understandable result.

Multiple agents may reason, research, draft, classify, or review in parallel. Exactly one agent may hold the **Operator lease** at a time. The lease protects the visible Android UI from competing taps, text entry, app launches, and browser navigation.

> **UI exclusivity invariant:** A visible-app or browser action may begin only when its agent owns the active operator lease. The lease is time-limited, tied to a single task, revocable by the owner, and released on interruption, error, or task completion.

### 7.2 First release agent roles

| Agent | Primary responsibility | Capability ceiling |
|---|---|---|
| **Coordinator** | Plan, delegate, merge outputs, request confirmation, and conclude a task | Task metadata and delegated summaries; no broad device control by default |
| **Researcher** | Collect sources, compare information, and create cited notes | Browser research scope; no external submission |
| **File Worker** | Create and organize task artifacts in granted folders | Assigned file scope only |
| **Reviewer** | Check for incomplete work, unsupported claims, missing files, and unsafe proposed actions | Read-only task artifacts and summaries |
| **App Operator** | Carry out approved visible UI steps under an exclusive lease | Allowed apps/browser only; must request consequential-action approval |
| **Host Monitor** | Observe charging, thermal/host health, connectivity, and resource pressure | Telemetry only |

### 7.3 Initial concurrency policy

The first v1.2.0 implementation should default to a **three-agent ceiling**: one Coordinator, one Worker, and one Reviewer. A device may later be configured for additional research workers only after it passes resource readiness checks. The App Operator is separate from that count and may run only under the exclusive UI lease.

| Condition | Coordinator behavior |
|---|---|
| Phone is charging, cool, and has adequate free memory | Permit the configured number of background specialists. |
| Thermal, memory, or storage pressure | Stop launching new workers; checkpoint work; retain one Coordinator and the Monitor. |
| Owner pauses Operator Mode | Revoke the UI lease immediately and pause all external-effect actions. |
| Network loss | Continue local file work where safe; pause browser/app steps that require connectivity. |
| Worker failure | Preserve logs and intermediate artifacts; retry only if the task policy permits; otherwise return control to the Coordinator. |

### 7.4 Task lifecycle

1. The owner supplies a goal in Pocket Relay or Telegram.
2. The Coordinator creates a visible plan with sub-tasks, required capabilities, expected outputs, and confirmation points.
3. The owner approves the plan when it requires a broader scope or external effect; low-risk local tasks may use a standing policy.
4. Specialists run in isolated task workspaces and return structured outputs to the Coordinator.
5. The Reviewer checks the merged result and flags missing evidence, unsupported claims, duplicate work, or unsafe consequences.
6. If UI operation is needed, the Coordinator grants the App Operator an exclusive lease and records every action.
7. The Coordinator returns a final result, file manifest, activity summary, and any unresolved owner actions.

## 8. Capability Console and owner controls

The Control tab gains a **Capability Console**. It replaces a hidden, one-time permission decision with a continuously inspectable operating surface.

| Console area | Owner experience |
|---|---|
| **Capability cards** | `Files`, `Browser`, `Allowed Apps`, `Notifications`, `Camera`, `Network`, and `Root` each show scope, state, and recent use. |
| **Agent roster** | Shows the Coordinator and active specialists, their role, model, task, capability grants, context use, resource use, and stop action. |
| **Operator status** | Shows whether a UI lease exists, its holder, target app, elapsed time, and next action summary. |
| **Task plan** | Shows ordered steps, completed work, dependencies, and pending confirmations. |
| **Emergency controls** | `Pause all`, `Revoke UI control`, `Disable external actions`, and `Stop host` execute deterministic revocation flows. |
| **Activity ledger** | Filters by task, agent, app, file, destination, capability, result, and time. |

The persistent host notification must identify that Operator Mode is active and offer a fast stop action. Android foreground services are specifically intended for work that remains noticeable to the user and require a status-bar notification, making a visible host state consistent with the platform model. [2]

## 9. Root Companion Mode

Root Companion Mode is an optional enhancement for a phone the owner has already rooted through their own chosen method. Pocket Relay must not ship a rooting exploit, installer, or hidden root acquisition path.

It exposes **reviewed named operations**, not arbitrary shell text. Proposed operations include checking root-host disk health, performing controlled workspace maintenance, collecting host diagnostics, restarting approved host components, and explicitly authorized reboot or recovery workflows. Every operation has a parameter schema, capability label, audit event, time limit, and owner confirmation class.

| Rule | Requirement |
|---|---|
| Separate activation | Root mode requires its own acknowledgement after standard Operator Mode is configured. |
| Allowlist only | The companion exposes named, auditable actions; it does not pass arbitrary model-generated commands to `su`. |
| Scope display | The console names each available operation and its effect before enablement. |
| Fail closed | Missing root, broken companion verification, or malformed requests deny the operation and leave normal mode unaffected. |
| F-Droid posture | The ordinary app remains functional without root; all root-related code and documentation must remain FOSS and reviewable. |

## 10. Privacy, safety, and audit requirements

Broad device operation is inherently sensitive. v1.2.0 must make this visible rather than merely embedding warnings in documentation.

| Requirement | Implementation expectation |
|---|---|
| **No silent scope escalation** | A task cannot access a new app, directory, destination, or root operation without an explicit owner policy or confirmation. |
| **App protection** | The owner may always block selected packages. Setup prominently recommends blocking banking, password-manager, authenticator, and private-messaging apps. |
| **Local auditability** | Persist an append-oriented local activity record for task plans, capability changes, UI leases, app launches, file mutations, external destinations, and confirmations. |
| **Data minimization** | Store action summaries and structured metadata by default; capture screen content or screenshots only when the owner enables that diagnostic level. |
| **Revocation** | Pause, capability revoke, task cancellation, and host stop must interrupt pending workers and release the UI lease. |
| **External effects** | Purchases, transfers, irreversible deletion, permission changes, account recovery, public posting, and first-contact messaging require owner confirmation. |
| **Skill containment** | A skill declares needed capabilities in its manifest and cannot obtain broader access through the Coordinator implicitly. |

## 11. Proposed screens and flows

### 11.1 Onboarding flow

`Control → Enable AI Operator Mode → Review risk warning → Choose capability preset → Define file/app/browser scopes → Enable Android accessibility service when app control is selected → Review persistent notification → Complete readiness check.`

The onboarding screen must be direct about the device’s existing state: it says that a reset is recommended for a dedicated host but never makes it mandatory. If installed high-risk apps are detected, it highlights them and offers to add them to the protected-app blocklist.

### 11.2 Task flow

`Owner goal → Coordinator plan → Capability review → Parallel specialist work → Reviewer check → optional exclusive UI operation → final report and artifact manifest.`

### 11.3 Interruption flow

`Owner taps Pause all or host notification stop → revoke operator lease → cancel waiting UI actions → checkpoint task artifacts → stop external-effect work → display resumable task state.`

## 12. Implementation phases

| Phase | v1.2.0 implementation target | Completion evidence |
|---|---|---|
| **A — Capability foundations** | Capability model, risk acknowledgement, app/file/browser scope storage, persistent host state, and audit schema | Deterministic policy and persistence tests; visible Control tab states |
| **B — File and browser workspace** | Assigned file operations, recycle bin, task artifacts, browser task ledger, and external-export confirmation | File-diff/recovery tests and browser destination audit tests |
| **C — App Operator** | Accessibility activation guide, allowed-app enforcement, UI lease manager, action ledger, and emergency revoke | Native integration tests plus physical-device tests on approved apps |
| **D — Multi-agent core** | Coordinator, Worker, Reviewer roles; bounded queue; isolated task outputs; three-agent ceiling | Deterministic concurrency, cancellation, and lease-exclusivity tests |
| **E — Dedicated Host refinement** | Resource-pressure policy, heat-aware scheduling, host monitor, and capability console | Long-running physical-device acceptance test |
| **F — Optional root companion** | Allowlisted companion protocol and separate owner activation | Rooted spare-device security review and fail-closed test matrix |

## 13. Acceptance criteria

v1.2.0 is ready for release only when all of the following are true:

1. Operator Mode remains disabled until the owner completes the explicit acknowledgement and scope selection.
2. The UI operator cannot act outside the current app allowlist or without a valid exclusive lease.
3. Two agents cannot issue visible UI actions concurrently.
4. Every file mutation, app launch, browser destination, capability change, confirmation decision, and lease transition appears in the local activity ledger.
5. The owner can stop all agent activity from both the app and persistent host notification, and the system releases the UI lease deterministically.
6. Root Companion Mode fails closed and offers no arbitrary model-controlled root shell.
7. A full task can be reconstructed from its local plan, specialist outputs, reviewer result, final artifact manifest, and activity summary.
8. Dedicated Host Mode removes Pocket Relay policy caps without misrepresenting Android thermal, memory, battery, or storage enforcement as absent.
9. The standard non-root F-Droid build remains functional, GPL-3.0-only, and reviewable without proprietary services.
10. Physical-device testing validates onboarding, revocation, app operation, task recovery, resource-pressure behavior, and host persistence.

## 14. Open design decisions

The following require implementation research and owner decisions before code is committed: the browser implementation and profile boundary; the minimum Android API range for the App Operator; screenshot retention and encryption policy; task-artifact retention duration; model routing and local-provider strategy for parallel agents; the exact root-companion transport; and the first supported app playbooks.

## References

[1] [Android Developers, “Create an accessibility service.”](https://developer.android.com/guide/topics/ui/accessibility/service)

[2] [Android Developers, “Foreground services overview.”](https://developer.android.com/develop/background-work/services/fgs)
