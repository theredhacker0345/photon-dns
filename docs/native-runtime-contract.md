# Pocket Relay Native Runtime Contract

## Purpose

This contract defines the boundary between the Pocket Relay Android app and its bundled Hermes Agent process. It makes the embedded runtime **private, auditable, and replaceable**. The mobile UI never executes ad-hoc shell commands; it only sends typed lifecycle and status requests to the native supervisor.

## Bundled runtime manifest

Every Pocket Relay release contains one signed `runtime-manifest.json` under application assets. It identifies immutable runtime assets and prevents a runtime from silently downloading or replacing executable code after installation.

```json
{
  "schemaVersion": 1,
  "runtimeId": "hermes-android-arm64",
  "runtimeVersion": "0.20.1-pocket.1",
  "python": "3.11.x",
  "abi": "arm64-v8a",
  "entryPoint": "pocket_hermes.gateway_launcher",
  "assets": [
    { "path": "python/libpython3.11.so", "sha256": "<release-time hash>" },
    { "path": "python/stdlib.zip", "sha256": "<release-time hash>" },
    { "path": "hermes/hermes_bundle.zip", "sha256": "<release-time hash>" },
    { "path": "wheels.lock", "sha256": "<release-time hash>" }
  ],
  "capabilities": ["telegram", "remote-model", "local-memory", "local-schedules"],
  "prohibitedCapabilities": ["package-install", "root", "interactive-shell", "rootfs", "local-web-server"]
}
```

The production build pipeline replaces every example hash, signs the manifest, and generates a software bill of materials. The launcher verifies all assets before the first extraction and after a failed startup recovery.

## Private filesystem

| Directory | Owner | Contents | Access rule |
|---|---|---|---|
| `files/runtime/` | Native supervisor | Extracted interpreter and immutable Hermes bundle. | App-private, hash-verified, never user-editable. |
| `files/workspace/` | Hermes worker | Skills, durable memory, job state, bounded logs. | App-private by default; user exports through a deliberate action. |
| `files/selected-files/` | Document access adapter | Read-only copies or URI grants for files explicitly chosen by the owner. | No whole-device scan; access is scoped to each selected item. |
| Secure storage | Android Keystore adapter | Telegram credential, allowed chat identifiers, model credential. | Not available as a normal file and excluded from diagnostics. |
| `cache/runtime-tmp/` | Native supervisor | Temporary extraction and update staging. | Cleared after successful activation or failed verification. |

## Supervisor state machine

```text
UNINSTALLED → VERIFYING → EXTRACTING → READY → STARTING → RUNNING
                                        ↘             ↗
                                         STOPPED ← STOPPING
RUNNING → DEGRADED → RECOVERING → RUNNING
RUNNING → FAILED (after capped recovery attempts)
```

| State | Meaning | UI action |
|---|---|---|
| **Ready** | Runtime assets passed validation but the gateway is not executing. | Start host. |
| **Running** | Foreground service and Hermes gateway health probes are both current. | Pause host; inspect status. |
| **Degraded** | Service survives but Telegram/model connectivity or a health probe has failed. | View redacted diagnostics; retry. |
| **Failed** | The runtime exceeded the recovery budget or integrity verification failed. | Re-verify bundle; create a redacted support export. |
| **Stopped** | Owner explicitly paused the host. No background retries occur. | Start host. |

## Typed local bridge

The React Native UI communicates only with a Kotlin `PocketHermesRuntimeModule`. The module communicates with the foreground supervisor through bound-service calls. Python is not exposed to JavaScript, and JavaScript cannot request arbitrary process execution.

| Request | Required state | Input | Result |
|---|---|---|---|
| `getRuntimeStatus()` | Any | None | Sanitized service state, runtime version, last heartbeat, resource summary. |
| `installRuntime()` | Uninstalled / Failed | Confirmation flag | Verification and extraction progress only. |
| `startRuntime()` | Ready / Stopped | None | Transition acknowledgement and session ID. |
| `stopRuntime()` | Running / Degraded | Reason enum | Graceful gateway termination confirmation. |
| `configureGateway()` | Stopped / Ready | Reference to Keystore secrets, allowed chat IDs, model profile ID. | Redacted configuration result. |
| `getRecentEvents()` | Any | Cursor, count (max 100) | Redacted structured events, never raw secret-bearing logs. |
| `getSchedules()` | Ready / Running | None | Read-only schedule summaries. |
| `setScheduleEnabled()` | Ready / Running | Schedule ID, boolean | Updated schedule summary. |

## Secret handling

The UI sends Telegram and model credentials once to Android encrypted storage. The native supervisor obtains an ephemeral value at process launch and supplies it through a pipe or protected in-memory boot configuration. The value is not placed in app preferences, JavaScript state, persistent Python config, terminal output, event payloads, or crash reports. Secret replacement stops the active worker first, clears the prior in-memory configuration, and starts a new session only after the owner explicitly resumes it.

## Telegram authorization

The gateway starts only if the configuration contains at least one allowed owner chat identifier or an explicit one-time pairing policy. Filtering is performed in the embedded Hermes gateway configuration. Pocket Relay also records a redacted decision event—`rejected_unauthorized_chat`, `accepted_owner_chat`, or `pairing_pending`—without retaining message contents from rejected chats.

## Resource guardrails

The supervisor exposes a small host policy which is set by the owner and enforced before dispatching a task: a maximum retained log size, a bounded task concurrency of one for the MVP, a network retry budget, and a storage reserve. When storage falls below the reserve or the process restarts too frequently, the host enters **Degraded** instead of spinning indefinitely. Heavy optional tools and local model packages must remain separate, owner-triggered downloads.
