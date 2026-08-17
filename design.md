# Pocket Agent Host — Mobile Interface Design

## Product premise

Pocket Agent Host turns a dedicated Android phone into a visible, locally controlled host for a self-hosted Hermes Agent. The phone supplies its own CPU, RAM, and encrypted app storage; Telegram is the remote conversation surface. The Android application is the user-facing control plane, not an unconfined shell. The user installs Pocket Agent Host only: a pinned Python/Hermes runtime is privately embedded in app-owned storage, launched by a native Android foreground supervisor, and never appears as a separate Termux application or terminal.

## Mobile design principles

The interface is designed for **portrait 9:16 use**, with primary controls within thumb reach and important operational state visible without drilling into settings. The visual direction is a calm technical console rather than a terminal emulator: deep ink backgrounds, a small amount of ultraviolet accent, strong status contrast, and plain-language safety notices. The app follows iOS HIG-inspired conventions where applicable to Expo: readable type hierarchy, 44-point target areas, clear navigation labels, and one dominant action per screen.

## Screen list

| Screen | Primary content | Functionality |
|---|---|---|
| **Welcome / Setup** | Four-step overview: device, agent, Telegram, stay awake. | Explains the on-device architecture and begins protected setup. |
| **Dashboard** | Runtime status, last activity, device capacity, quick actions, recent events. | Starts or pauses the demo runtime state and directs users to setup or the agent console. |
| **Agent** | Conversation log, compact task composer, current task card. | Provides a local task console and preserves non-sensitive history locally. It is ready to attach to a future native runtime bridge. |
| **Automations** | Schedule list, next run, delivery route, enable switches. | Lets the user view and toggle locally persisted automation definitions. |
| **Settings** | Telegram token status, agent endpoint, runtime permissions, data controls, FOSS license link. | Guides secure configuration and makes host limitations explicit. |
| **Connection Sheet** | Telegram bot token, allowed chat ID, optional model endpoint. | Stores sensitive values in Android secure storage; it never displays the full token again. |
| **Runtime Guide** | Private runtime readiness checklist, service lifecycle, and bundled Hermes version. | Explains how the embedded runtime is supervised without exposing a separate terminal application. |

## Key user flows

| Flow | Steps |
|---|---|
| **Turn an old phone into a host** | Open Pocket Agent Host → review device-host promise → tap **Configure host** → enter Telegram bot token and allowed chat ID → save securely → inspect runtime checklist → activate the native service once installed. |
| **Operate remotely through Telegram** | Create Telegram bot in Telegram → save token in Pocket Agent Host → launch native Hermes gateway on phone → message the bot from any authorized account → dashboard shows last gateway activity. |
| **Inspect or pause the host** | Open Dashboard → read runtime badge and recent events → tap **Pause runtime** → confirm state change locally → gateway service bridge receives the pause command in a production build. |
| **Manage a scheduled task** | Open Automations → choose a scheduled item → toggle it off/on → inspect next-run time and Telegram delivery route. |
| **Protect access** | Open Settings → add/replace Telegram token → restrict allowed chat ID → optionally clear all locally saved non-secret activity data. |

## Color choices

| Role | Light | Dark | Rationale |
|---|---|---|---|
| **Ink background** | `#F6F7FB` | `#0B0D14` | Keeps high-density operational content quiet and readable. |
| **Elevated surface** | `#FFFFFF` | `#141827` | Separates cards without visual clutter. |
| **Hermes violet** | `#6750E8` | `#A99BFF` | Primary action and recognizable host identity. |
| **Live mint** | `#11866A` | `#54D8B7` | Clearly indicates healthy runtime states. |
| **Caution amber** | `#A95F00` | `#F4B65A` | Signals setup requirements without implying failure. |
| **Alert coral** | `#C3384E` | `#FF8799` | Reserves red-family tones for interrupted or destructive states. |

## Architecture boundary

Pocket Agent Host should remain fully open source and privacy-preserving. App preferences and activity presentation can live locally in AsyncStorage. Credentials such as the Telegram token must use the device keystore through secure storage. The app must not pretend that JavaScript background tasks alone provide an always-on agent: reliable long-running execution on Android needs native foreground-service support plus a private embedded CPython/Hermes runtime. The embedded package will be a curated, version-pinned agent profile—not a general-purpose Linux distribution or an unrestricted hidden shell.
