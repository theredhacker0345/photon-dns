# Pocket Agent Host

Pocket Agent Host is a **FOSS Android control plane and embedded-runtime host** for [Hermes Agent](https://github.com/NousResearch/hermes-agent). It turns a dedicated Android phone into a private agent host that can be controlled remotely through an authorized Telegram bot.

The operator installs **Pocket Agent Host only**. The intended production build privately packages a pinned CPython and Hermes bundle in app-owned storage; it does not require, install, or expose a separate Termux application, terminal, package manager, or Linux desktop environment.

## Current implementation

The Expo application implements the secure mobile control plane. It provides a host dashboard, Telegram owner-gateway setup, secure token persistence on Android, a staged agent-instruction inbox, local automation definitions, activity history, and explicit runtime-health states. The UI is deliberately honest in preview mode: it does not claim to start Hermes until a native Android supervisor has been attached.

| Capability | Current state | Production target |
|---|---|---|
| **Host dashboard** | Implemented and locally persisted. | Receives real supervisor health and resource state. |
| **Telegram configuration** | Implemented; token uses Android secure storage in native builds. | Supplies an ephemeral protected configuration to the embedded gateway. |
| **Owner allowlist** | Required by the setup UI. | Enforced in the Hermes gateway configuration itself. |
| **Agent instructions** | Stored as local drafts. | Dispatched to the embedded Hermes process through a typed native bridge. |
| **Automations** | Local definitions, toggles, and delivery route. | Synced to Hermes’ local cron scheduler. |
| **24/7 host** | Documented integration contract. | Android foreground service supervising a private CPython/Hermes process. |

## Native embedded-runtime design

The intended Android release uses a narrow, app-private runtime rather than a generic hidden shell. Kotlin owns the foreground-service lifecycle, Android Keystore adapter, notification, and recovery behavior. It launches a pinned CPython 3.11 and Hermes bundle through JNI, then communicates with it through typed lifecycle requests only.

```text
Pocket Agent Host UI
        │
Typed React Native module
        │
Kotlin foreground supervisor ── Android Keystore / notification / health
        │
JNI embedded CPython ── pinned Hermes Agent bundle
        │
Telegram Bot API + approved model provider
```

The runtime has no interactive terminal surface. It uses a private workspace, a controlled tool policy, package hashes, bounded logs, capped restart backoff, and owner-only Telegram authorization. Detailed contracts are in [`docs/embedded-runtime-plan.md`](docs/embedded-runtime-plan.md) and [`docs/native-runtime-contract.md`](docs/native-runtime-contract.md).

## Security model

Telegram tokens and model-provider credentials must never enter normal preferences, logs, activity history, or analytics. On Android, Pocket Agent Host stores small secrets with `expo-secure-store`, which is backed by Android Keystore-encrypted storage. The production gateway must fail closed unless an allowed owner chat ID or explicit pairing policy has been configured. Browser preview storage is intentionally identified as temporary and non-secure.

By default, Hermes’ available files live in an app-private workspace. Any future access to user files must go through Android’s Storage Access Framework and remain restricted to the URIs the owner selected. Pocket Agent Host does not ship root access, a system-wide file scanner, package installation, a rootfs distribution, or unrestricted arbitrary shell execution.

## Upstream attribution

Pocket Agent Host uses and is designed to package the MIT-licensed [Hermes Agent](https://github.com/NousResearch/hermes-agent) project from Nous Research. Pocket Agent Host is independently maintained and is not an official Nous Research product. Every distribution that includes upstream Hermes code must retain Hermes’ license and copyright notices alongside this project’s MIT license.

## Development

```bash
pnpm install
pnpm dev
pnpm check
```

Use the mobile preview to review the control plane. Validating protected storage, foreground execution, background resilience, process recovery, and the embedded CPython worker requires a custom Android development build or release APK—not Expo Go or the web preview.

## Roadmap

The next engineering milestone is to create the native Android module: reproducible ARM64 CPython assets, Android-compatible Hermes wheels, a JNI launcher, a Kotlin foreground service, and a local typed health/control protocol. The implementation must be tested across reboot, networking loss, low storage, app process death, Telegram token rotation, and unauthorized chat attempts before any 24/7 host claim is made.
