# Pocket Relay User Guide

**Pocket Relay 1.0.0**
**Owner-operated Android agent host**
**License: GPL-3.0-only**

> Pocket Relay turns a dedicated Android phone into a private control plane for an embedded Hermes Agent runtime. The phone remains the host: it keeps its configuration, schedules, bounded conversation ledger, protected credentials, and worker workspace inside the Android application boundary.

## 1. Before You Begin

Pocket Relay is designed for a spare or dedicated Android phone that can remain powered and connected to a trusted network. It is not an Android terminal, a cloud-hosted service operated by Pocket Relay, or a way to give an AI unrestricted device access. The app requires Android 7.0 or later and is optimized for an ARM64 Android device.

| You need | Why it is needed |
|---|---|
| A dedicated Android phone with sufficient free storage | The app stores its private runtime and app-private workspace on the phone. |
| A stable charging arrangement | Continuous foreground hosting consumes power; charging-aware policy can prevent starts when the phone is not charging. |
| Internet access for Telegram and hosted AI providers | Telegram control and hosted inference are network services. |
| A Telegram bot token and one private owner chat ID | These lock remote access to one configured owner. |
| An AI provider account or a trusted local provider endpoint | Hermes requires a configured model endpoint before it can answer work. |

The app is connected-operation only. If the phone is offline, Telegram cannot deliver remote messages and hosted providers cannot perform inference. A same-network Ollama or LM Studio endpoint may reduce reliance on a third-party model provider, but Telegram still needs a network route for remote control.

## 2. Initial Setup

Open Pocket Relay and complete the four setup stages in order. Each stage validates input before the foreground host receives configuration.

| Stage | What to do | What Pocket Relay checks |
|---|---|---|
| **Device** | Give the host phone a recognizable name and review power/storage readiness. | The app reports charging and free-storage readiness before persistent hosting begins. |
| **Telegram** | Add a bot token, enter the one private owner chat ID, select Direct, HTTP, or SOCKS5 routing, and test the gateway. | Only a positive private user ID is accepted; group conversations are rejected. Proxy credentials are protected and redacted from diagnostics. |
| **Model** | Pick a provider, enter the credential if required, test the connection, refresh models, and select one. | Hosted/custom providers require HTTPS; local presets have narrow numeric private-LAN HTTP exceptions. |
| **Runtime policy** | Set CPU, RAM, workspace, low-battery, storage-reserve, warning, notification, and restart choices. | Values are normalized before the native supervisor can start. |

When the Telegram check succeeds, Pocket Relay shows the selected route and the measured `getMe` latency in milliseconds. A passing check proves that the phone can authenticate and currently reach Telegram through that route; it does not guarantee a proxy’s long-term availability or privacy.

## 3. Choose an AI Provider and Model

Pocket Relay presents owner-configured provider connections rather than embedding provider credentials in a conversation. Select a preset, provide the endpoint and API key when necessary, run the connection test, and then refresh the model catalogue. The app saves public connection metadata locally while protected credential material follows the Android Keystore-backed secret path.

| Provider path | Typical use | Endpoint rule |
|---|---|---|
| **OpenAI, OpenRouter, Groq, Mistral AI, Kilo Code** | Hosted model APIs | HTTPS endpoint and protected API key. |
| **Custom OpenAI-compatible** | A compatible provider selected by the owner | HTTPS endpoint and protected API key. |
| **Ollama or LM Studio** | A model service on the owner’s trusted LAN | HTTP is allowed only for a numeric private-LAN address; authentication is optional. |

Use the search field to filter the refreshed model list and the bookmark control to add a model to Favorites. A connection test can show latency and authentication feedback before the connection is saved. Re-test a provider whenever its endpoint, key, or network changes.

## 4. Start and Monitor the Host

After setup, the Dashboard is the day-to-day operating screen. Starting the host launches the non-exported Android foreground supervisor, which keeps an ongoing Android notification while the embedded worker runs. Android foreground services are the platform-supported way to run visibly user-important long-lived work; the notification is intentional rather than a hidden background process.[1]

| Dashboard signal | Meaning |
|---|---|
| **Host state** | Whether the supervisor is stopped, starting, running, or blocked by policy. |
| **CPU / RAM / workspace** | Native host-process measurements and app-private workspace usage. A missing native reading is shown as unavailable, not invented. |
| **Charging and storage** | Current readiness relative to your saved policy. |
| **History chart** | The latest 30 in-memory telemetry samples. The chart is deliberately volatile and is not persistent analytics. |
| **Backup health** | Timestamp of the latest successful encrypted export, not a backup password, path, or contents. |

The resource limits are guardrails for Pocket Relay’s own host process and app-private workspace. They do not create device-wide cgroups, control other apps, or override Android’s memory manager. A sustained CPU breach or RAM/workspace breach can stop the host safely; a workspace breach also prevents new task and schedule persistence.

## 5. Work from Telegram and the Agent Console

Pocket Relay has one owner conversation rather than two unrelated histories. The local Agent Console and the authenticated Telegram owner chat use the same canonical Hermes owner session. The app keeps a bounded 100-entry, owner-visible app-private transcript so you can see cross-surface context. Use **Reset conversation** when you want to clear the displayed ledger and begin a new Hermes context.

Telegram messages are accepted only from the configured private owner chat. Group messages and unapproved identities do not become owner requests. Console-originated replies are mirrored once to the owner chat; Telegram-originated replies remain on the Telegram delivery path, avoiding duplicate messages.

| Telegram route | Choose it when | Scope |
|---|---|---|
| **Direct** | Telegram is reachable normally. | No proxy is used. |
| **HTTP** | You trust an HTTP proxy for Telegram access. | Only Telegram Bot API traffic uses the proxy. |
| **SOCKS5** | You trust a SOCKS5 proxy for Telegram access. | Only Telegram Bot API traffic uses the proxy. |

The proxy does **not** redirect model-provider calls, remote MCP traffic, Android telemetry, or other application traffic. Do not paste a proxy password into chat or a skill; configure it only in the protected Settings flow.

## 6. Console Tasks and Automations

Use the Agent Console for an immediate owner request. Use Automations for owner-configured, durable scheduled work. Each schedule uses a validated five-field cron expression and runs through the same owner-controlled task path. Inspect the schedule state and history in the Automations screen, then pause or delete a schedule that is no longer needed.

Schedules and tasks are not a mechanism for arbitrary Android automation. The runtime is bounded by the saved host policy, the configured model endpoint, the Telegram owner rule, and the limited tool surface described below.

## 7. Remote MCP Connectors

Pocket Relay supports a deliberately narrow form of Model Context Protocol integration. Add only a public, default-port **HTTPS Streamable HTTP** MCP server that you trust. The app may store optional bearer authentication through protected storage, discover a manifest, display the offered tools, and require a short owner approval before a specific call.

| Pocket Relay permits | Pocket Relay rejects |
|---|---|
| Public HTTPS remote MCP endpoints | Local, `stdio`, file, HTTP, redirecting, private-network, loopback, and non-default-port endpoints |
| Owner-reviewed manifest and tool list | Automatic tool discovery as permission |
| Time-limited owner grants | Unattended model-selected tool use |

To invoke an approved tool, the owner explicitly submits `/mcp serverId toolName {"argument":"value"}` from the controlled path. The connector must be enabled, its manifest must still contain the tool, the grant must be unexpired, and request/response bounds must pass. The embedded model does not autonomously choose an MCP tool.

## 8. Skills

Skills are small, capability-free QuickJS packages for deterministic JSON transformations. They are not browser extensions, Android plugins, packages, or general scripts. A valid skill contains `skill.json` and `main.js`, declares a FOSS SPDX license, has an empty permissions list, records an exact source hash, and exposes a synchronous `run(input)` function.

You may use the starter gallery, ask Hermes to draft a pure transformation, or import a public GitHub skill source. Import resolves a commit SHA, validates the manifest and source bytes, and stages the package for review. Installation, enabling, approval, and execution are distinct owner actions. **Approve & run** executes only the exact reviewed source in a non-exported isolated QuickJS process with bounded JSON input/output.

Skills cannot access secrets, Telegram, provider APIs, MCP credentials, network transports, a shell, the filesystem, Python, compilers, native libraries, dynamic imports, or background schedules. Export creates a portable `*.pocket-relay-skill.json` envelope with only the reviewed manifest and source; it excludes approval records, secrets, history, and private paths.

## 9. Encrypted Backup and Restore

Create backups only from Settings. Pocket Relay encrypts a versioned portable control-plane payload with Neuron Encrypt’s authenticated AES-256-GCM-SIV construction, Argon2id key derivation, and HKDF-SHA512 domain separation.[2] The backup extension is `.prbackup.neuron`.

| Operation | Safe use |
|---|---|
| **Create encrypted backup** | Use a new password of at least 12 characters, preferably while the host is idle, the phone is powered, and sufficient storage is available. Android’s share sheet chooses the destination. |
| **Restore from backup** | Pick one backup file and enter its password. The file is decrypted only for schema-validated preview first. |
| **Confirm and restore** | Read the change summary, then accept the final Android confirmation prompt. Closing the preview or using a wrong password makes no configuration change. |

Backups include selected non-secret settings, public provider metadata, proxy host/type/port, policy, automations, favorites, MCP metadata, and source-verified skill bundles. They never include Telegram bot tokens, model API keys, proxy passwords, MCP bearer tokens, Android Keystore data, conversations, task history, telemetry, audit records, or diagnostics. Restored providers need their credentials again; restored MCP connectors are disabled and not checked until you re-verify them.

Backup passwords are not stored and cannot be recovered. The Argon2id profile intentionally has a substantial memory cost, so avoid exporting or restoring while the host is under resource pressure.

## 10. Notifications, Themes, and Settings

The master device-notifications toggle controls Android-local host alerts and backup reminders. It does not stop Telegram delivery. Use **Test notification** after granting Android notification permission to verify that local alerts work. Backup reminders are optional and can be cancelled without deleting your chosen interval.

Settings also provides five visual themes, including an OLED Black low-power option, configurable warning and critical thresholds, conservative **Recommended limits**, provider and connector management, skills, backup/restore, resource policy, and creator/project links. Use the changelog link to review completed releases and the issue tracker when you find a reproducible defect.

## 11. What the Agent Cannot Do

The app-private CPython worker is not a general-purpose computer. Normal Hermes sessions receive an explicit empty upstream toolset. The agent cannot open a terminal, run shell commands, install packages, compile code, browse the web, take screenshots, access arbitrary files, start local servers, use Docker, control Android settings, or access other apps’ data. It also cannot run local or `stdio` MCP transports.

This is a least-privilege Android application boundary rather than a claim of a Linux-container VM. Android process isolation and the app-private filesystem are the relevant boundary; test the target device and its OEM power behavior before relying on unattended hosting.

## 12. Troubleshooting

| Symptom | Check first | Safe next step |
|---|---|---|
| Host will not start | Charging-aware policy, battery cutoff, free-storage reserve, RAM/workspace policy | Review the Dashboard readiness card and revise only the setting that caused the block. |
| Telegram test fails | Bot token, positive private chat ID, network route, proxy host/port | Test Direct first when available; otherwise verify the trusted proxy outside Pocket Relay. |
| Provider test fails | Endpoint type, HTTPS rule, API key, provider availability | Re-enter the protected key, check the endpoint, then run the built-in test again. |
| Model list is empty | Successful provider connection and `/models` support | Refresh models after the connection test; some providers expose only a subset of models. |
| Backup preview fails | Correct file, correct password, supported format | Do not retry with altered contents; use the original exported `.prbackup.neuron` file. |
| Connector cannot run | HTTPS/public/default-port rule, manifest, enabled state, active owner grant | Re-verify the connector and issue a new owner approval. |

## 13. Physical-Device Acceptance Checklist

Before relying on a phone for 24/7 hosting, validate it with non-production credentials and a reversible task. Confirm the foreground notification appears, Telegram accepts only the configured owner, a provider can answer a test prompt, one automation runs, resource alerts appear at a controlled threshold, encrypted export/restoration previews safely, and a reboot/unlock behaves as expected on that device.

Pocket Relay’s source, Android packaging, and F-Droid submission recipe are independently validated, but a sandbox cannot prove a particular phone’s Keystore after reboot, Telegram reachability, provider account state, or OEM battery-management decisions. Treat those as owner acceptance checks rather than assumed guarantees.

## 14. Further Reading

| Topic | Repository source |
|---|---|
| Threats and privacy | `docs/threat-model.md` · `docs/privacy.md` |
| Telegram synchronization and proxy scope | `docs/conversation-sync-and-proxy.md` |
| MCP restrictions | `docs/mcp-connectors.md` |
| Skills security | `docs/skills-security.md` |
| Backup format and boundaries | `docs/encrypted-backup-design.md` |
| Physical backup acceptance steps | `docs/physical-device-backup-acceptance-checklist.md` |
| F-Droid release evidence | `docs/fdroid-submission-checklist.md` |

## References

[1]: https://developer.android.com/develop/background-work/services/fgs "Android foreground services"
[2]: https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md "Neuron Encrypt README"
