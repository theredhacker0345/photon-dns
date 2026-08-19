# Pocket Relay

![Pocket Relay icon](docs/assets/pocket-relay-icon.png)

> **Turn a dedicated Android phone into a private, owner-operated AI relay.** Pocket Relay embeds a CPython/Hermes runtime in an Android application, keeps the control plane on the device, and accepts remote instructions only through an owner-locked Telegram gateway.

| Project | Current position |
|---|---|
| **Source** | [GitLab repository](https://gitlab.com/theredhacker0345/pocket-relay) |
| **License** | [GPL-3.0-only](LICENSE) |
| **Platform** | Android, optimized for a dedicated ARM64 phone |
| **Runtime** | Android foreground service · embedded CPython 3.11 · [Hermes Agent 0.20.1, pinned source](docs/hermes-runtime-pinning.md) |
| **Release state** | F-Droid-oriented source and metadata are prepared; F-Droid publication and a fresh physical-device acceptance build remain outstanding. |

Pocket Relay is for people who want to dedicate an old Android phone to a long-running, personal agent without asking end users to install Termux, expose a terminal, run a separate Linux distribution, or trust a Pocket Relay cloud relay. It is **not** a public multi-user service, a device-rooting tool, a general-purpose Android terminal, or a replacement for Android’s own security and memory controls.

## Contents

| Start here | Understand the host | Build and contribute |
|---|---|---|
| [What you get](#what-you-get) · [First-run path](#first-run-path) · [Telegram conversations and routing](#telegram-conversations-and-routing) · [UI gallery](#ui-gallery) | [Privacy and safety boundaries](#privacy-and-safety-boundaries) · [Architecture](#architecture) · [Resource guardrails](#resource-guardrails) | [Development](#development) · [Release and f-droid](#release-and-f-droid) · [Contributing](#contributing) |

## What you get

The app is a focused mobile control plane for an Android-hosted agent. Its operating model is intentionally narrow: one configured owner, one dedicated phone, protected provider credentials, and explicit controls over the runtime’s network and resource boundaries.

| Capability | What the host provides |
|---|---|
| **Private Telegram control** | A private-owner gateway for submitting work and receiving responses. Messages from unverified chats and groups are rejected by policy. The gateway can use Direct, HTTP, or SOCKS5 routing. |
| **Provider-aware model setup** | Hosted presets for OpenAI, OpenRouter, Groq, Mistral AI, Kilo Code, and custom HTTPS OpenAI-compatible services; plus explicit same-network Ollama and LM Studio presets. Owners can test a connection, inspect request latency, refresh `/models`, search the catalog, and save favorites. |
| **Shared owner conversation** | The Agent Console and authenticated Telegram owner chat use the same Hermes session. A bounded 100-entry, owner-visible app-private transcript records the cross-surface conversation, and **Reset conversation** safely clears the displayed ledger and starts a new Hermes context. |
| **Telegram route diagnostics** | Setup and Settings show route-specific feedback for Direct, HTTP, and SOCKS5 drafts. A successful native Telegram Bot API check displays its measured `getMe` latency in milliseconds; proxy credentials are never shown in the UI or diagnostic result. |
| **Remote MCP connectors** | Only owner-selected remote HTTPS Streamable HTTP MCP servers with optional bearer authentication are supported. Local, stdio, private-network, redirect, and unapproved-tool routes are blocked; the app never runs arbitrary connector code. |
| **24/7 host supervision** | An Android foreground service, persistent notification, charging and storage readiness checks, bounded recovery, optional boot recovery, and local schedules. Android requires special handling for foreground work because background execution is constrained by the platform.[1] |
| **Resource observability** | Native CPU, process-RAM, storage, charging, and capacity readings; a volatile dashboard history chart; configurable warning and critical percentages; and hardware-aware recommended limits. |
| **FOSS release evidence** | GPL-3.0-only app code, third-party notices, JavaScript and Python SBOM generation, a license audit, reproducibility tooling, Fastlane material, and an F-Droid recipe skeleton. |

## First-run path

The setup flow is deliberately short and fail-closed. It guides the owner through naming the phone, entering a Telegram bot token and a single owner chat ID, choosing a model provider, testing protected API credentials, selecting a model, and reviewing the host policy before the Android supervisor receives configuration.

| Step | Owner action | Host safeguard |
|---|---|---|
| **1. Identify the host** | Name the dedicated phone and review its charging and storage readiness. | The app surfaces whether the phone is suitable for persistent operation before start. |
| **2. Lock the gateway** | Add the Telegram bot token and the private owner chat ID, choose Direct, HTTP, or SOCKS5 routing if needed, then run the gateway test. | Unrecognized and group conversations are not treated as owners. Proxy credentials use protected storage; a successful test reports the active route and measured check latency. |
| **3. Select a model** | Choose a provider, test the endpoint, refresh the model catalog, and choose a model. | Hosted and custom services require an explicit HTTPS OpenAI-compatible URL and protected token. Ollama and LM Studio may use HTTP only at a numeric private-LAN address; their bearer token is optional. |
| **4. Set the policy** | Choose resource limits, notification behavior, and startup preferences. | Values are normalized and handed to the native supervisor only after validation. |

## Telegram conversations and routing

Pocket Relay is designed for one configured owner, not a collection of disconnected chat surfaces. A message sent in the Android Agent Console and a message received from the authenticated Telegram owner chat continue the same canonical Hermes owner session. Telegram-originated replies keep the normal Telegram delivery path; app-originated replies are rendered in the console and mirrored **once** to the configured owner chat. This avoids duplicate Telegram replies while making a change of surface feel continuous.

| Route | Use case | Live check result | Data boundary |
|---|---|---|---|
| **Direct** | Telegram is reachable from the phone’s normal network route. | Displays the authenticated gateway result and measured Telegram Bot API latency. | No proxy configuration is sent. |
| **HTTP** | A trusted HTTP proxy is required for Telegram reachability. | Displays the selected route, check progress, redacted result, and measured latency on success. | Only Telegram Bot API traffic uses the proxy. |
| **SOCKS5** | A trusted SOCKS5 proxy is required for Telegram reachability. | Displays the selected route, check progress, redacted result, and measured latency on success. | Only Telegram Bot API traffic uses the proxy. |

Proxy routing is optional and intentionally narrow. It does **not** redirect model-provider calls, remote MCP traffic, Android telemetry, or other application network traffic. Host, port, and route type are public configuration; an optional `username:password` proxy credential follows the Android protected-secret path and is never rendered back into the form, transcript, logs, or diagnostic output. Invalid proxy addresses, URL-embedded credentials, paths, fragments, control characters, and ports outside `1–65535` are rejected before the worker starts.

The route status answers whether the selected route can currently reach Telegram from the phone. It does not certify a third-party proxy’s privacy, availability, or future reachability. Owners should use a proxy they trust, validate it from the physical Android device, then send a Telegram message and an Agent Console message to confirm the shared conversation and single-reply behavior. See the [conversation synchronization and proxy design](docs/conversation-sync-and-proxy.md) for the detailed retention, delivery, and verification model.

## Why Pocket Relay is connected-operation only

Pocket Relay is **online-only by design** because its owner gateway relies on Telegram and its hosted model presets rely on the selected provider’s network API. The project does not present a degraded queue as an offline agent, mirror prompts to an app-operated cloud relay, or pretend that a disconnected phone can receive owner commands. This keeps the ownership and data-flow model honest: when the phone has no trusted network route, the remote gateway and hosted inference are unavailable.

The optional Ollama and LM Studio presets preserve a privacy-first alternative, but not a false offline-first promise. They connect directly from the phone to an owner-controlled model server on the same trusted LAN; HTTP is accepted only for numeric private-LAN addresses, and bearer authentication remains optional. Telegram still requires Internet reachability for remote control. Read the [privacy notes](docs/privacy.md) and [local-provider compatibility notes](docs/local-provider-compatibility-research.md) before configuring a provider or connector.

## UI gallery

The screenshots below show the current web control-plane preview. The preview labels Android-only behavior rather than pretending it can start the native foreground service or sample real device telemetry.

| Host dashboard | Agent Console |
|---|---|
| ![Pocket Relay dashboard: setup state, private workspace and owner-only gateway cards](docs/screenshots/home.png) | ![Pocket Relay Agent Console](docs/screenshots/agent-console.png) |

| Automations | Host settings |
|---|---|
| ![Pocket Relay automation scheduler](docs/screenshots/automations.png) | ![Pocket Relay settings and provider configuration](docs/screenshots/settings.png) |

The launcher image above is also shipped through the Android, splash, favicon, and adaptive-icon paths: [`assets/images/icon.png`](assets/images/icon.png).

## Privacy and safety boundaries

The important design decision is not merely that the runtime is on a phone; it is that the runtime has a deliberately small authority surface. The model is given an **app-private workspace**, not a general terminal, a rooted environment, or a device-wide sandbox.

| The host does | The host does **not** do |
|---|---|
| Run its embedded worker and private workspace inside the app’s Android boundary. | Expose an interactive shell, a visible Termux workflow, arbitrary package installation, root access, or access to other apps’ files. |
| Store Telegram, proxy, provider, and MCP credentials through Android protected storage backed by Android Keystore mechanisms.[2] | Put secrets in normal UI state, ordinary logs, telemetry, task history, conversation entries, or diagnostic exports. |
| Keep telemetry, schedules, bounded history, and host events locally. | Include analytics SDKs, advertising SDKs, accounts, or a Pocket Relay-operated cloud relay. |
| Require explicit owner grants before an MCP tool can run. | Launch local MCP processes, accept stdio connectors, follow redirects to private destinations, or treat discovery as permission. |
| Display a bounded, owner-visible conversation ledger with role, origin, delivery state, and timestamp; display numeric context-window metadata and request session-preserving compression. | Expose raw runtime diagnostics, session-store paths, provider/MCP/Telegram/proxy credentials, or conversation history to non-owner chats. |

Credential removal is an operational action, not a cosmetic one: it stops the host and clears corresponding native configuration. The full [threat model](docs/threat-model.md), [privacy notes](docs/privacy.md), and [remote MCP guide](docs/mcp-connectors.md) explain the enforced boundaries and their residual risks.

## Resource guardrails

The owner can set bounded CPU, process-RAM, and private-workspace storage limits in Settings. These are **host-process guardrails**: they supervise Pocket Relay and its app-private runtime directory. They do not create device-wide cgroups, alter unrelated Android processes, or bypass Android memory management.

| Control | Behavior |
|---|---|
| **Recommended limits** | Uses reported CPU-core count, total RAM, free storage, and the retained storage reserve to fill conservative editable values. The owner reviews and saves them; the button never silently starts a host or changes a running policy. |
| **Warning and critical percentages** | The owner selects validated percentages for visual alerts. Defaults are 80% warning and 95% critical; critical must remain above warning. |
| **Dashboard history** | The dashboard retains the latest 30 in-memory samples at the host polling cadence and draws CPU, RAM, and private-workspace trend lines. The history is intentionally volatile: it is not copied into task history, diagnostics, or persistent telemetry. |
| **Enforcement** | A workspace breach prevents new task and schedule persistence. A RAM or workspace breach stops the host; a CPU breach must be sustained before the supervisor stops it. |

Missing native values are never guessed. If the app cannot obtain a reading, it shows that state instead of fabricating a warning or a chart point.

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Pocket Relay UI                                                       │
│ Setup · Dashboard · Agent Console · Automations · Settings            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ typed Expo module bridge
┌───────────────────────────────▼──────────────────────────────────────┐
│ Kotlin Android foreground supervisor                                 │
│ Keystore-backed configuration · readiness gates · CPU/RAM telemetry  │
│ host lifecycle · policy enforcement · notifications                  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ embedded runtime handoff
┌───────────────────────────────▼──────────────────────────────────────┐
│ Embedded CPython 3.11 worker                                          │
│ Hermes Agent · shared owner Telegram session · task queue · scheduler │
│ Telegram-only Direct/HTTP/SOCKS5 route · private workspace · MCP      │
└──────────────────────────────────────────────────────────────────────┘
```

The worker incorporates the MIT-licensed [Hermes Agent](https://github.com/NousResearch/hermes-agent) project while Pocket Relay remains an independently maintained GPL-3.0-only Android application. Its embedded source is fixed at a reviewed Hermes Agent 0.20.1 commit and can only change through the documented [controlled upgrade process](docs/hermes-runtime-pinning.md). Refer to the [implementation traceability matrix](docs/implementation-traceability-matrix.md) for the source-level map from requirements to implementation and tests.

## Development

The repository uses Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript, NativeWind, a local Android Expo module, and Chaquopy 17. A browser preview is useful for the control-plane UI; it is not an Android-host substitute.

```bash
git clone https://gitlab.com/theredhacker0345/pocket-relay.git
cd pocket-relay
corepack enable
pnpm install
pnpm dev
```

Run the deterministic source gates before opening a merge request or preparing a release handoff:

```bash
pnpm test
pnpm check
pnpm run sbom:js
pnpm run sbom:python
pnpm run audit:licenses
pnpm run release:preflight
```

A native host build requires the documented Android SDK, NDK, Java, a Python 3.8+ build interpreter, and the checked-in Python-wheel sources. The embedded Android runtime remains **CPython 3.11**, but Chaquopy 16.1 permits the F-Droid build server's system Python 3.13 to drive packaging. Set `POCKET_HERMES_BUILDPYTHON` only to override the detected host interpreter for a local reproducibility run. The [reproducible release policy](docs/reproducible-release-policy.md) and [Android build validation notes](docs/android-build-validation.md) describe the constrained build path.

## Release and F-Droid

Pocket Relay is prepared for an **F-Droid maintainer handoff**, not represented as already published. F-Droid builds require public source, an immutable release tag, metadata pointing to that source, and an independent reproducible build process.[3] The repository includes the recipe skeleton at [`metadata/com.app.pockethermes.yml`](metadata/com.app.pockethermes.yml), but maintainers must complete its public repository and tag fields before submission.

| Release evidence | Current boundary |
|---|---|
| **Source tests, type checks, SBOMs, and license audit** | Reproducible, source-side gates recorded in project evidence. |
| **Android build configuration** | Unsigned-by-default F-Droid-oriented path, without a debug-key fallback. |
| **Physical ARM64 behavior** | Must be freshly built and tested with real Android hardware and user-supplied Telegram/provider credentials. |
| **F-Droid publication** | Requires maintainer-controlled public-repository metadata, a release tag, F-Droid linting, and a build-server result. |

For the exact evidence boundary, artifact context, and handoff sequence, read [release evidence](docs/release-evidence.md) and the [F-Droid submission checklist](docs/fdroid-submission-checklist.md).

## Documentation map

| If you need to understand… | Read |
|---|---|
| Threats, trust boundaries, and residual risks | [Threat model](docs/threat-model.md) |
| Credentials, network data flow, and retention | [Privacy notes](docs/privacy.md) |
| MCP endpoint, manifest, and approval restrictions | [Remote MCP connectors](docs/mcp-connectors.md) |
| What sandbox the embedded agent receives and which tools it can use | [Agent sandbox and tool surface](docs/agent-sandbox-and-tools.md) |
| How the native worker and supervisor divide responsibility | [Native runtime contract](docs/native-runtime-contract.md) |
| Model discovery behavior and supported endpoint shape | [Provider model discovery research](docs/provider-model-discovery-research.md) |
| Hermes source provenance, pin, and upgrade controls | [Hermes runtime pinning](docs/hermes-runtime-pinning.md) |
| Shared owner conversations, Telegram proxy routes, and verification limits | [Conversation synchronization and proxy design](docs/conversation-sync-and-proxy.md) |
| Local Ollama and LM Studio endpoint compatibility | [Local-provider compatibility research](docs/local-provider-compatibility-research.md) |
| Themes and the minimal control-plane design | [Theme system](docs/theme-system.md) · [Minimal UI design](docs/minimal-ui-design.md) |
| Build requirements, license checks, and artifact evidence | [Reproducible release policy](docs/reproducible-release-policy.md) · [License verification](docs/license-verification.md) · [Release evidence](docs/release-evidence.md) |
| Why this README is structured this way | [README benchmark notes](docs/readme-benchmark.md) |

## Contributing

Contributions must preserve the owner-only boundary, private-storage model, online-only behavior, no-telemetry commitment, and FOSS distribution requirements. New policy, persistence, native-bridge, or provider behavior should arrive with deterministic coverage and with any necessary updates to privacy, threat-model, F-Droid, licensing, or traceability material.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a merge request. Contributors retain copyright while allowing distribution of app-owned contributions under `GPL-3.0-only`; see the [copyright policy](COPYRIGHT_POLICY.md), [contributors list](CONTRIBUTORS.md), and [third-party notices](THIRD_PARTY_NOTICES.md). Sign each contributing commit with a `Signed-off-by` line as described in the contribution policy.

## License and attribution

Pocket Relay application code is released under the [GNU General Public License, version 3 only](LICENSE). It uses the MIT-licensed [Hermes Agent](https://github.com/NousResearch/hermes-agent) runtime from Nous Research, but is not an official Nous Research product. Applicable upstream copyright and license notices remain part of every compliant distribution.

## References

[1]: https://developer.android.com/develop/background-work/services/fgs "Android foreground services"
[2]: https://developer.android.com/privacy-and-security/keystore "Android Keystore system"
[3]: https://f-droid.org/en/docs/Build_Metadata_Reference/ "F-Droid Build Metadata Reference"
