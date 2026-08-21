# Pocket Relay

![Pocket Relay launcher icon](docs/assets/pocket-relay-icon.png)

> **Turn a dedicated Android phone into a private, owner-operated AI relay.** Pocket Relay embeds a pinned CPython/Hermes runtime, a Kotlin foreground supervisor, and a mobile control plane on the phone itself. There is no Pocket Relay-operated cloud relay, visible Termux workflow, general Android terminal, or public multi-user control plane.

| Project | Current state |
|---|---|
| **Source** | [GitLab: `theredhacker0345/pocket-relay`](https://gitlab.com/theredhacker0345/pocket-relay) |
| **Application license** | [GPL-3.0-only](LICENSE) |
| **Package identifier** | `com.app.pockethermes` |
| **Platform** | Android 7.0+; ARM64 device host target |
| **Embedded runtime** | CPython 3.11 · Hermes Agent 0.20.1 pinned and vendored |
| **F-Droid status** | MR !46222 is open; its latest reviewer-response pipeline passed all nine jobs. Maintainer review and owner physical-device acceptance remain external gates. |

Pocket Relay is for a person who wants to dedicate an Android phone to a long-running personal agent while keeping the control plane on that phone. It is not a rooting tool, a Linux distribution, a general-purpose Android automation framework, a device-wide sandbox, or a promise that Android/OEM background policies can be bypassed.

> **Read the complete operational manual:** [Markdown guide](docs/Pocket_Relay_User_Guide.md) · [PDF guide](docs/Pocket_Relay_User_Guide.pdf).

## Contents

| Start and operate | Understand limits and security | Build and contribute |
|---|---|---|
| [Capabilities](#capabilities) · [Quick start](#quick-start) · [Telegram conversations and routing](#telegram-conversations-and-routing) · [Daily operation](#daily-operation) | [Security and privacy](#security-and-privacy) · [Agent authority](#what-the-agent-can-and-cannot-do) · [Backup and restore](#encrypted-backup-and-restore) | [Development](#development) · [F-Droid](#f-droid-and-release-status) · [Contributing](#contributing) |

## Capabilities

Pocket Relay is a mobile control plane and an Android-hosted runtime. The owner configures a private Telegram gateway and model provider, reviews resource policy, then starts a persistent Android foreground service that hosts the embedded Python worker. The application deliberately separates what is **implemented in the source/package** from what must be tested with the owner’s real phone, network, Telegram bot, and model account.

| Area | What Pocket Relay provides |
|---|---|
| **24/7 Android hosting** | A non-exported Kotlin foreground supervisor, persistent Android notification, charging/storage readiness checks, bounded recovery, opt-in boot recovery, and app-private CPython 3.11 worker lifecycle. Android foreground work is visible by design because the operating system constrains background execution.[1] |
| **Private Telegram gateway** | One configured private owner chat, protected bot token, group/unrecognized-chat rejection, direct/HTTP/SOCKS5 Telegram routing, native `getMe` checks, and measured route latency. |
| **Model providers** | Presets for OpenAI, OpenRouter, Groq, Mistral AI, Kilo Code, Ollama, LM Studio, and custom OpenAI-compatible services; protected credentials; model discovery; catalog search; favorites; connection latency/authentication feedback. |
| **Shared owner context** | The local Agent Console and authenticated Telegram owner chat share one canonical Hermes owner session and a bounded owner-visible conversation ledger. |
| **Tasks and automations** | Immediate owner requests, durable queued work, validated five-field cron schedules, run state/history, retries, and owner delivery boundaries. |
| **Resource guardrails** | Native CPU, process-RAM, workspace, storage, and charging telemetry; configurable limits and warnings; hardware-aware recommended values; and a volatile 30-sample dashboard history. |
| **Remote MCP** | Owner-added public HTTPS Streamable HTTP endpoints with optional protected bearer tokens, reviewed manifests, short grants, and explicitly owner-triggered calls. |
| **Skills** | Capability-free, source-hashed QuickJS JSON transformations; first-party gallery; AI drafting; public GitHub import; review, approval, isolated execution, export, and deletion. |
| **Encrypted backups** | Owner-triggered `.prbackup.neuron` exports using a strict non-secret allow-list, password protection, preview-first restore, and final confirmation. |
| **Owner controls** | Five themes including OLED Black, Android-local notification master toggle and test, backup reminders, creator/project links, changelog access, and issue reporting. |

## Quick start

Set up Pocket Relay on a dedicated phone that can stay powered and connected. The in-app flow validates every stage before the native host receives a configuration.

| Step | Owner action | Boundary enforced by the host |
|---|---|---|
| **1. Device** | Name the phone and review charging and free-storage readiness. | The app reports whether the phone is ready for persistent hosting before start. |
| **2. Telegram** | Add a bot token and one private owner chat ID, select Direct/HTTP/SOCKS5 routing, then test the gateway. | Only a positive private user ID is accepted; group messages do not become owner commands. |
| **3. Model** | Choose a provider, supply its protected credential if needed, test it, refresh models, select a model, and optionally favorite it. | Hosted and custom providers require HTTPS. Ollama/LM Studio have narrow numeric private-LAN HTTP exceptions. |
| **4. Policy** | Choose CPU, RAM, workspace, battery, storage, alert, notification, and restart preferences. | Values are normalized before they are passed to the Android supervisor. |

For a complete device-first walkthrough, including recovery and troubleshooting, see the [User Guide](docs/Pocket_Relay_User_Guide.md).

## Telegram conversations and routing

Pocket Relay is deliberately a one-owner host, not a group bot or a collection of disconnected chat surfaces. A message sent in the Android Agent Console and a message received from the authenticated Telegram owner chat continue the **same canonical Hermes owner session**. A **bounded 100-entry, owner-visible app-private transcript** records the cross-surface conversation; **Reset conversation** clears that displayed ledger and begins a new Hermes context.

| Route | Use case | Live check | Data boundary |
|---|---|---|---|
| **Direct** | Telegram is reachable normally from the phone. | Shows authentication outcome and measured `getMe` latency in milliseconds. | No proxy is configured. |
| **HTTP** | A trusted HTTP proxy is needed for Telegram. | Shows the chosen route, progress, redacted result, and measured latency. | Only Telegram Bot API traffic uses the proxy. |
| **SOCKS5** | A trusted SOCKS5 proxy is needed for Telegram. | Shows the chosen route, progress, redacted result, and measured latency. | Only Telegram Bot API traffic uses the proxy. |

The proxy does **not** redirect model-provider calls, remote MCP traffic, Android telemetry, or other application network traffic. Proxy credentials use protected storage and are never shown in the UI, transcript, diagnostics, logs, or backup. A successful route check proves current reachability, not a third-party proxy’s future reliability or privacy. The detailed behavior is documented in [conversation synchronization and proxy design](docs/conversation-sync-and-proxy.md).

## Daily operation

The Dashboard shows host state, charging/storage readiness, native CPU/RAM/workspace readings, the latest volatile usage history, active policy status, gateway state, and encrypted-backup health. Missing native readings are shown as unavailable rather than replaced with placeholder values. Use **Recommended limits** to fill conservative editable values based on reported hardware, then review them before saving.

The Agent Console is the owner’s local surface for an immediate request; Automations is the durable schedule surface. Schedules use validated five-field cron expressions and remain constrained by the same resource, Telegram, provider, and owner policy as immediate tasks. The app-local notification toggle affects Android safety alerts and backup reminders only; it does not disable Telegram delivery.

## Model providers and Favorites

Provider connections keep public endpoint/label metadata locally while keys remain in Android-protected secret storage. Use **Test connection** before saving, inspect its latency/authentication result, refresh the model list, then use search and filter controls to find a model. Favorite models are a convenience view; they do not copy or expose provider credentials.

| Connection type | Rule |
|---|---|
| Hosted provider or custom OpenAI-compatible service | HTTPS endpoint and protected key are required. |
| Ollama / LM Studio | HTTP is accepted only at a numeric private-LAN address; bearer authentication is optional. |
| Empty or failing catalogue | Refresh models after a passing test; provider capabilities and account access determine the returned list. |

Pocket Relay is online-only by design. Telegram and hosted providers need a network route; a LAN model endpoint reduces third-party inference dependency but does not make Telegram remote control available offline.

### Why Pocket Relay is connected-operation only

Pocket Relay is a phone-hosted control plane for a connected agent, rather than an offline assistant. Remote Telegram control requires a reachable Telegram Bot API route, and hosted model providers require their own authenticated network endpoint. The **same-network Ollama and LM Studio presets** can route inference to a compatible model server on the private LAN, but the server must still be reachable and Telegram remains unavailable without its own network route. This explicit boundary prevents the app from implying offline functionality that it does not provide.

## Remote MCP and Skills

Remote MCP and skills are intentionally narrower than general plugins. Pocket Relay accepts only an owner-selected, public default-port HTTPS Streamable HTTP MCP endpoint, validates its manifest, stores an optional bearer token through protected storage, and requires a time-limited owner grant for an explicit `/mcp serverId toolName {"argument":"value"}` command. It blocks redirects, local/stdio transports, loopback/private-network endpoints, unattended discovery-as-permission, and model-selected tool execution. Read [Remote MCP connectors](docs/mcp-connectors.md) for the complete policy.

Skills are pure, capability-free QuickJS packages that transform JSON. The starter gallery, GitHub import, and Hermes drafting flow all lead to reviewable manifest/source bytes before the owner can install, approve, and run them. Skills cannot access network APIs, secrets, Telegram, MCP credentials, a shell, a filesystem, Python, compilers, native libraries, dynamic imports, or background schedules. See [skills security](docs/skills-security.md).

## Encrypted backup and restore

Pocket Relay creates password-protected `.prbackup.neuron` files only through an explicit Settings action. The portable payload is built from a strict allow-list before Neuron Encrypt’s authenticated AES-256-GCM-SIV / Argon2id / HKDF-SHA512 construction is invoked.[2] The backup password is never stored.

| Included after review | Deliberately excluded |
|---|---|
| Non-secret host settings, model selection metadata, proxy host/type/port, policies, automations, favorites, non-secret MCP metadata, and source-verified skill bundles | Telegram token, provider/API keys, proxy password, MCP bearer tokens, Android Keystore data, conversations, task history, telemetry, diagnostics, audit records, and private file paths |

Restore is preview-first: select a file, enter its password, inspect the safe difference summary, then confirm in the Android prompt. A failed password, malformed file, unsupported version, or dismissed preview makes no live state change. Restored providers need credentials again, and restored connectors are disabled/not-checked until re-verified. Read [encrypted backup design](docs/encrypted-backup-design.md) and the [physical-device checklist](docs/physical-device-backup-acceptance-checklist.md).

## Security and privacy

Pocket Relay’s security model is a least-privilege Android application boundary. The worker has an app-private workspace, not shared storage or a device shell. Protected secrets use Android Keystore-backed mechanisms; Android’s Keystore keeps key material non-exportable from the normal app data path.[3]

| Pocket Relay does | Pocket Relay does **not** do |
|---|---|
| Keeps credentials in protected native storage; retains public configuration, bounded histories, and host events locally. | Include analytics, advertising SDKs, account sign-in, or a Pocket Relay-operated cloud relay. |
| Limits Telegram ownership to one configured private identity and exposes a clear route diagnostic. | Treat groups, unknown chats, a failed route check, or a proxy hostname as authorization. |
| Gives normal Hermes sessions an explicit empty upstream toolset. | Expose a terminal, package installer, browser, file tools, general web tools, root, ADB, Docker, arbitrary subprocesses, or local MCP. |
| Allows an owner to explicitly approve one remote MCP call. | Let the model autonomously browse tools or make remote calls. |

## What the agent can and cannot do

The embedded agent can reason over owner messages and return model-generated text through the configured provider. It can take a narrowly validated, owner-authorized remote MCP call through the documented command path. It cannot independently run shell commands, compile code, install packages, browse the web, read or edit arbitrary files, alter Android settings, access other applications, start servers, or execute general local code. The Android private workspace is a runtime boundary, not a developer terminal.

## F-Droid and release status

Pocket Relay 1.0.0 is under F-Droid review through [MR !46222](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/46222). The latest reviewer-response pipeline, `2780396625`, passed every job: F-Droid build, update checks, redirects, lint, metadata rewriting, script checks, schema validation, source scan, and APK validation. The MR contains the canonical `NonFreeNet` explanation because optional Telegram and third-party AI endpoints are non-free network services; this does not change the application’s GPL-3.0-only license.[4]

The remaining external gates are F-Droid maintainer acceptance and owner physical-device acceptance. Do not claim store publication until F-Droid accepts and publishes the package. No new tag, release, or version was created during the current 1.0.0 submission work.

## Development

The project uses Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript, NativeWind, Kotlin, Chaquopy, vendored CPython dependencies, and a local Android Expo module. A browser preview is useful for UI work but is not proof that the Android foreground service, Keystore path, notification behavior, or device telemetry works.

```bash
git clone https://gitlab.com/theredhacker0345/pocket-relay.git
cd pocket-relay
corepack enable
pnpm install
pnpm test
pnpm check
```

Run release gates before changing native/runtime or release material:

```bash
pnpm run sbom:js
pnpm run sbom:python
pnpm run audit:licenses
pnpm run release:preflight
```

The documented native build path uses a compatible Android SDK/NDK, Java toolchain, an appropriate Python build interpreter, and the checked-in vendored source closure. Refer to [Android build validation](docs/android-build-validation.md) and the [reproducible release policy](docs/reproducible-release-policy.md).

## Documentation map

| Need | Read |
|---|---|
| Complete owner workflow and troubleshooting | [Markdown User Guide](docs/Pocket_Relay_User_Guide.md) · [PDF User Guide](docs/Pocket_Relay_User_Guide.pdf) |
| Threats, trust boundaries, and residual risk | [Threat model](docs/threat-model.md) |
| Privacy and data-flow details | [Privacy notes](docs/privacy.md) |
| Telegram synchronization and proxy details | [Conversation synchronization and proxy design](docs/conversation-sync-and-proxy.md) |
| Remote MCP limits | [Remote MCP connectors](docs/mcp-connectors.md) |
| Agent sandbox and tool boundary | [Agent sandbox and tool surface](docs/agent-sandbox-and-tools.md) |
| Skills lifecycle | [Skills security](docs/skills-security.md) |
| Backup contract | [Encrypted backup design](docs/encrypted-backup-design.md) |
| F-Droid evidence | [F-Droid submission checklist](docs/fdroid-submission-checklist.md) |

## Contributing

Contributions must preserve the owner-only boundary, protected-secret model, no-telemetry commitment, online-only honesty, FOSS release requirements, and deterministic coverage expectations. Read [CONTRIBUTING.md](CONTRIBUTING.md), [COPYRIGHT_POLICY.md](COPYRIGHT_POLICY.md), [CONTRIBUTORS.md](CONTRIBUTORS.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before contributing. Please include a `Signed-off-by` line as required by the contribution policy.

## License and attribution

Pocket Relay application code is [GNU GPL v3.0 only](LICENSE). It incorporates the MIT-licensed [Hermes Agent](https://github.com/NousResearch/hermes-agent) runtime through a pinned, reviewed source closure, but is not an official Nous Research product. Password-protected backup export and restore use [Neuron Encrypt](https://gitlab.com/theredhacker0345/neuron-encrypt), whose GPL-3.0-only source and notice are retained with the native encryption boundary. Third-party notices remain part of compliant distributions.

## References

[1]: https://developer.android.com/develop/background-work/services/fgs "Android foreground services"
[2]: https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md "Neuron Encrypt README"
[3]: https://developer.android.com/privacy-and-security/keystore "Android Keystore system"
[4]: https://f-droid.org/en/docs/Anti-Features/ "F-Droid Anti-Features"
