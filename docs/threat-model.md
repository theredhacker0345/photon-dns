# Pocket Agent Host Threat Model

## Purpose and scope

Pocket Agent Host converts an owner-managed Android device into a private, long-running Hermes host. This document distinguishes **enforced controls** from operating assumptions so that the product never represents an unverified safeguard as a guarantee. The scope is the shipped Android app, its embedded worker, its owner-only Telegram gateway, and its configured model endpoint.

## Assets, trust boundaries, and actors

| Asset or boundary | Primary risk | Implemented control | Remaining owner responsibility |
|---|---|---|---|
| Telegram bot token and model credential | Credential disclosure or reuse | Android Keystore-backed handoff and deletion through the native supervisor; redacted diagnostics | Use a dedicated bot and revoke credentials if the device is compromised. |
| Private owner identity | Unauthorized instruction or group routing | A single private numeric owner identity; group and allow-all gateway routes are cleared before polling | Confirm the chat identifier belongs to the owner before enabling the host. |
| Task, schedule, and run data | Local disclosure or uncontrolled execution | App-private storage, bounded history, serial task drain, cron validation, bounded retries | Do not schedule sensitive tasks on a device shared with untrusted people. |
| Device availability | Battery depletion, storage exhaustion, restart loops | Charging/storage start gates, boot opt-in, foreground service, bounded recovery, local alerts | Keep the host charged, unlocked as required by the OS, and exempt it from aggressive vendor battery management. |
| Model endpoint | Prompt or output disclosure in transit | HTTPS-only model configuration and Android-side preflight | Select a model provider whose retention and data policies meet the owner’s requirements. |
| Remote MCP endpoint and tool manifest | Malicious endpoint, credential leakage, unapproved side effect, or private-network targeting | HTTPS-only policy; blocked local/private targets and redirects; protected credential handoff; manifest fingerprinting; explicit expiring owner grants | Select servers whose privacy, retention, and tool behavior are acceptable, and review each tool before granting it. |

## Threat scenarios

| Scenario | Security outcome | Mitigation status |
|---|---|---|
| A stranger messages the bot or adds it to a group | The request must not become a task | **Enforced:** the worker configures one owner and removes group/allow-all routes before gateway start. |
| A physical attacker opens the host app | Secrets must not be rendered or copied from diagnostics | **Partially enforced:** secrets are held in protected storage and native diagnostics are redacted. Device screen-lock and encryption remain OS-owner controls. |
| A gateway exits repeatedly | The phone must not consume resources in an infinite restart loop | **Enforced:** recovery is cooldown-controlled and capped. |
| Storage or power falls below policy | New host work must not begin in an unsafe state | **Enforced:** the same saved policy is applied to direct starts, restart recovery, and boot restoration. |
| A model provider endpoint is mistyped or unavailable | The owner must see failure before the Telegram host begins | **Enforced:** Android-native preflight validates the HTTPS endpoint, model name, and credential without persisting an exposed value. |
| An MCP server advertises a new, changed, or deceptive tool | A server response must not become tool authorization | **Enforced:** discovery normalizes untrusted metadata; a manifest change invalidates grants; invocation requires a matching enabled connector and unexpired owner approval. |
| An MCP endpoint directly names a local or private address | The agent must not become a private-network request proxy | **Enforced:** both the TypeScript discovery client and embedded worker reject non-HTTPS, loopback, private, link-local, reserved, IPv6, URL-credential, redirected, and non-standard-port destinations. DNS hostnames remain an owner-selected external-service boundary. |

## Non-goals and explicit limits

Pocket Agent Host is not a general-purpose remote shell, a mobile-device-management system, or a guarantee that Android will keep a process alive under every OEM power policy. It deliberately exposes no terminal interface, browser automation, arbitrary command execution, local/`stdio` MCP server transport, or public inbound HTTP server. The app does not provide end-to-end encryption beyond the configured external services; Telegram, the chosen model provider, and owner-selected MCP servers each have their own data-handling model.

## Security release gate

Before a public release, maintainers must verify the app lock screen behavior on a real device, validate restricted owner access from a non-owner Telegram account and group, test credential rotation/deletion, and review every `manual-review` license finding in `license-audit.json`. The implementation map in [implementation-traceability-matrix.md](./implementation-traceability-matrix.md) identifies the source contract and acceptance evidence for each control.
