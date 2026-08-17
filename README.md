# Pocket Agent Host

![Pocket Agent Host icon](docs/assets/pocket-agent-host-icon.png)

> **Turn a dedicated Android phone into a private, owner-operated AI agent host.** Pocket Agent Host embeds a CPython/Hermes runtime in an Android application, keeps the control plane on the device, and accepts remote instructions only through an owner-locked Telegram gateway.

| Project | Current position |
|---|---|
| **Source** | [GitLab repository](https://gitlab.com/theredhacker0345/pocket-agent-host) |
| **License** | [GPL-3.0-only](LICENSE) |
| **Platform** | Android, optimized for a dedicated ARM64 phone |
| **Runtime** | Android foreground service · embedded CPython 3.11 · Hermes Agent |
| **Release state** | F-Droid-oriented source and metadata are prepared; F-Droid publication and a fresh physical-device acceptance build remain outstanding. |

Pocket Agent Host is for people who want to dedicate an old Android phone to a long-running, personal agent without asking end users to install Termux, expose a terminal, run a separate Linux distribution, or trust a Pocket Agent Host cloud relay. It is **not** a public multi-user service, a device-rooting tool, a general-purpose Android terminal, or a replacement for Android’s own security and memory controls.

## Contents

| Start here | Understand the host | Build and contribute |
|---|---|---|
| [What you get](#what-you-get) · [First-run path](#first-run-path) · [UI gallery](#ui-gallery) | [Privacy and safety boundaries](#privacy-and-safety-boundaries) · [Architecture](#architecture) · [Resource guardrails](#resource-guardrails) | [Development](#development) · [Release and f-droid](#release-and-f-droid) · [Contributing](#contributing) |

## What you get

The app is a focused mobile control plane for an Android-hosted agent. Its operating model is intentionally narrow: one configured owner, one dedicated phone, protected provider credentials, and explicit controls over the runtime’s network and resource boundaries.

| Capability | What the host provides |
|---|---|
| **Private Telegram control** | A private-owner gateway for submitting work and receiving responses. Messages from unverified chats and groups are rejected by policy. |
| **Provider-aware model setup** | Presets for OpenAI, OpenRouter, Groq, Mistral AI, Kilo Code, and custom HTTPS OpenAI-compatible services. Owners can test credentials, inspect request latency, refresh `/models`, search the catalog, and save favorites. |
| **Agent Console** | Durable task submission, bounded local task history, active-session context-window metadata, and a safe manual **Compress context** action. Conversation text does not cross the Python/Kotlin/JavaScript control-plane bridge. |
| **Remote MCP connectors** | Owner-selected HTTPS Streamable HTTP MCP servers, discovered tool manifests, fingerprints, short-lived per-tool grants, and live policy updates. Local, stdio, private-network, redirect, and unapproved-tool routes are blocked. |
| **24/7 host supervision** | An Android foreground service, persistent notification, charging and storage readiness checks, bounded recovery, optional boot recovery, and local schedules. Android requires special handling for foreground work because background execution is constrained by the platform.[1] |
| **Resource observability** | Native CPU, process-RAM, storage, charging, and capacity readings; a volatile dashboard history chart; configurable warning and critical percentages; and hardware-aware recommended limits. |
| **FOSS release evidence** | GPL-3.0-only app code, third-party notices, JavaScript and Python SBOM generation, a license audit, reproducibility tooling, Fastlane material, and an F-Droid recipe skeleton. |

## First-run path

The setup flow is deliberately short and fail-closed. It guides the owner through naming the phone, entering a Telegram bot token and a single owner chat ID, choosing a model provider, testing protected API credentials, selecting a model, and reviewing the host policy before the Android supervisor receives configuration.

| Step | Owner action | Host safeguard |
|---|---|---|
| **1. Identify the host** | Name the dedicated phone and review its charging and storage readiness. | The app surfaces whether the phone is suitable for persistent operation before start. |
| **2. Lock the gateway** | Add the Telegram bot token and the private owner chat ID, then run the gateway test. | Unrecognized and group conversations are not treated as owners. |
| **3. Select a model** | Choose a provider, test the endpoint, refresh the model catalog, and choose a model. | Tokens use protected storage; custom endpoints must be explicit HTTPS OpenAI-compatible URLs. |
| **4. Set the policy** | Choose resource limits, notification behavior, and startup preferences. | Values are normalized and handed to the native supervisor only after validation. |

The app is **online-only by design**. Telegram traffic reaches Telegram, and prompts or responses reach the provider selected by the owner. Pocket Agent Host does not provide a model relay or a hosted synchronization service. Read the [privacy notes](docs/privacy.md) before configuring a provider or connector.

## UI gallery

The screenshots below show the current web control-plane preview. The preview labels Android-only behavior rather than pretending it can start the native foreground service or sample real device telemetry.

| Host dashboard | Agent Console |
|---|---|
| ![Pocket Agent Host dashboard: setup state, private workspace and owner-only gateway cards](docs/screenshots/home.png) | ![Pocket Agent Host Agent Console](docs/screenshots/agent-console.png) |

| Automations | Host settings |
|---|---|
| ![Pocket Agent Host automation scheduler](docs/screenshots/automations.png) | ![Pocket Agent Host settings and provider configuration](docs/screenshots/settings.png) |

The launcher image above is also shipped through the Android, splash, favicon, and adaptive-icon paths: [`assets/images/icon.png`](assets/images/icon.png).

## Privacy and safety boundaries

The important design decision is not merely that the runtime is on a phone; it is that the runtime has a deliberately small authority surface. The model is given an **app-private workspace**, not a general terminal, a rooted environment, or a device-wide sandbox.

| The host does | The host does **not** do |
|---|---|
| Run its embedded worker and private workspace inside the app’s Android boundary. | Expose an interactive shell, a visible Termux workflow, arbitrary package installation, root access, or access to other apps’ files. |
| Store Telegram, provider, and MCP credentials through Android protected storage backed by Android Keystore mechanisms.[2] | Put secrets in normal UI state, ordinary logs, telemetry, task history, or diagnostic exports. |
| Keep telemetry, schedules, bounded history, and host events locally. | Include analytics SDKs, advertising SDKs, accounts, or a Pocket Agent Host-operated cloud relay. |
| Require explicit owner grants before an MCP tool can run. | Launch local MCP processes, accept stdio connectors, follow redirects to private destinations, or treat discovery as permission. |
| Display numeric context-window metadata and request session-preserving compression. | Render a conversation transcript through the control-plane bridge. |

Credential removal is an operational action, not a cosmetic one: it stops the host and clears corresponding native configuration. The full [threat model](docs/threat-model.md), [privacy notes](docs/privacy.md), and [remote MCP guide](docs/mcp-connectors.md) explain the enforced boundaries and their residual risks.

## Resource guardrails

The owner can set bounded CPU, process-RAM, and private-workspace storage limits in Settings. These are **host-process guardrails**: they supervise Pocket Agent Host and its app-private runtime directory. They do not create device-wide cgroups, alter unrelated Android processes, or bypass Android memory management.

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
│ Pocket Agent Host UI                                                  │
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
│ Hermes Agent · owner-only Telegram gateway · task queue · scheduler   │
│ provider preflight · private workspace · approved HTTPS MCP adapter   │
└──────────────────────────────────────────────────────────────────────┘
```

The worker incorporates the MIT-licensed [Hermes Agent](https://github.com/NousResearch/hermes-agent) project while Pocket Agent Host remains an independently maintained GPL-3.0-only Android application. Refer to the [implementation traceability matrix](docs/implementation-traceability-matrix.md) for the source-level map from requirements to implementation and tests.

## Development

The repository uses Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript, NativeWind, a local Android Expo module, and Chaquopy 17. A browser preview is useful for the control-plane UI; it is not an Android-host substitute.

```bash
git clone https://gitlab.com/theredhacker0345/pocket-agent-host.git
cd pocket-agent-host
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

A native host build requires the documented Android SDK, NDK, Java, CPython 3.11 build interpreter, and prebuilt Python wheels. Set `POCKET_HERMES_BUILDPYTHON` to the intended CPython 3.11 executable in that environment. The [reproducible release policy](docs/reproducible-release-policy.md) and [Android build validation notes](docs/android-build-validation.md) describe the constrained build path.

## Release and F-Droid

Pocket Agent Host is prepared for an **F-Droid maintainer handoff**, not represented as already published. F-Droid builds require public source, an immutable release tag, metadata pointing to that source, and an independent reproducible build process.[3] The repository includes the recipe skeleton at [`metadata/com.app.pockethermes.yml`](metadata/com.app.pockethermes.yml), but maintainers must complete its public repository and tag fields before submission.

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
| How the native worker and supervisor divide responsibility | [Native runtime contract](docs/native-runtime-contract.md) |
| Model discovery behavior and supported endpoint shape | [Provider model discovery research](docs/provider-model-discovery-research.md) |
| Themes and the minimal control-plane design | [Theme system](docs/theme-system.md) · [Minimal UI design](docs/minimal-ui-design.md) |
| Build requirements, license checks, and artifact evidence | [Reproducible release policy](docs/reproducible-release-policy.md) · [License verification](docs/license-verification.md) · [Release evidence](docs/release-evidence.md) |
| Why this README is structured this way | [README benchmark notes](docs/readme-benchmark.md) |

## Contributing

Contributions must preserve the owner-only boundary, private-storage model, online-only behavior, no-telemetry commitment, and FOSS distribution requirements. New policy, persistence, native-bridge, or provider behavior should arrive with deterministic coverage and with any necessary updates to privacy, threat-model, F-Droid, licensing, or traceability material.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a merge request. Contributors retain copyright while allowing distribution of app-owned contributions under `GPL-3.0-only`; see the [copyright policy](COPYRIGHT_POLICY.md), [contributors list](CONTRIBUTORS.md), and [third-party notices](THIRD_PARTY_NOTICES.md). Sign each contributing commit with a `Signed-off-by` line as described in the contribution policy.

## License and attribution

Pocket Agent Host application code is released under the [GNU General Public License, version 3 only](LICENSE). It uses the MIT-licensed [Hermes Agent](https://github.com/NousResearch/hermes-agent) runtime from Nous Research, but is not an official Nous Research product. Applicable upstream copyright and license notices remain part of every compliant distribution.

## References

[1]: https://developer.android.com/develop/background-work/services/fgs "Android foreground services"
[2]: https://developer.android.com/privacy-and-security/keystore "Android Keystore system"
[3]: https://f-droid.org/en/docs/Build_Metadata_Reference/ "F-Droid Build Metadata Reference"
