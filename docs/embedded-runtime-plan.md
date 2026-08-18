# Pocket Relay — Embedded Hermes Runtime Plan

## Decision

Pocket Relay will pursue a **single-APK, private-runtime architecture**. The user installs Pocket Relay only. On first run, the app extracts a version-pinned Hermes Agent bundle and a private Python runtime into Pocket Relay’ app-owned storage. There is no separate Termux package, launcher icon, or terminal surface.

The APK acts as the Android-native supervisor. A foreground service starts the private runtime, watches its health, exposes one narrow local control channel to the app, and keeps the user-visible Android notification required for an always-on host. Hermes itself continues to provide its agent loop, skills, memory, cron scheduler, and Telegram gateway.

## Why this is technically credible

The upstream Hermes Agent is MIT-licensed and currently supports Python `>=3.11,<3.14`, a curated Android/Termux dependency profile, a Telegram gateway, and a cron scheduler. [1] [2] [3] The official Python documentation explains that Android Python use is done by embedding the interpreter (`libpython`), standard library, and application code inside a native Android app’s private package. [4]

> “The only way you can use Python on Android is in embedded mode – that is, by writing a native Android application, embedding a Python interpreter using `libpython`, and invoking Python code using the Python embedding API.” — Python documentation [4]

This approach is more maintainable than relying on the experimental `libtermux-android` project, even though that project validates the desired user experience: it advertises an isolated Termux environment inside private app storage without requiring a separate Termux installation. [5] Pocket Relay should use a **small fixed runtime**, not expose package installation or an interactive shell.

## Package layout

| Layer | Contents | Visible to the phone owner | Update policy |
|---|---|---|---|
| **Android APK** | Kotlin/React Native UI, foreground-service bridge, JNI launcher, secure-storage adapter, native libraries. | Pocket Relay app and a persistent “agent running” notification. | Standard signed app update. |
| **Private Python runtime** | CPython 3.11 ARM64 `libpython`, curated standard-library assets, explicitly built Android wheels. | No separate launcher or terminal. | Version-pinned with the app; integrity verified before extraction. |
| **Hermes bundle** | Audited upstream Hermes source, configuration adapter, Android compatibility shims, needed `.[termux]` features. | Managed through the Pocket Relay dashboard. | Signed manifest and release-specific hash. |
| **Workspace** | Agent state, schedules, memory, bounded logs, allowed-files area. | Exposed only through curated dashboards and export action. | Preserved over app upgrades; migrates through versioned code. |
| **Secrets** | Telegram bot token, approved Telegram chat IDs, model-provider credentials. | Never rendered after saving. | Android Keystore-backed secure storage only. |

## Runtime constraints and scope

The embedded runtime must be **curated, not a hidden unrestricted terminal**. It will exclude package managers, arbitrary user shell execution, rootfs distributions, GUI desktop support, local web servers, and unreviewed lazy dependency downloads. This keeps the first runtime materially lighter, reduces the attack surface, and preserves the Android application sandbox.

The direct embedded build has real engineering work: Hermes uses some compiled packages, including `pydantic-core`, `cryptography`, `psutil`, and Pillow, so Pocket Relay needs reproducible Android ARM64 wheels built and tested against the embedded CPython ABI. [2] Upstream already keeps separate Android/Termux installation constraints, which offers a useful compatibility starting point but does not make an APK embedding automatic. [3]

The initial supported behavior will therefore focus on Telegram conversation, remote model calls, app-private memory, skills that do not require a broad shell, local schedules, and Android-approved tools. Browser automation, voice dependencies, root access, an unrestricted Linux distro, and arbitrary software installation remain unsupported in the initial host profile.

## Android supervisor lifecycle

| Event | Pocket Relay behavior |
|---|---|
| **User starts host** | Validate protected setup, extract/verify the pinned runtime if needed, and start the native foreground service before launching the private Hermes gateway. |
| **App leaves foreground** | The service continues with a persistent Android notification; the UI can reconnect to the local health endpoint. |
| **Network loss** | Keep schedules and state local; use bounded retry with backoff for Telegram long polling and the model provider. |
| **Runtime crash** | Capture redacted diagnostic data, restart with capped exponential backoff, and mark the host degraded after the retry budget. |
| **Device reboot** | Resume only after the user has explicitly enabled the Android restart option and the OS allows the receiver/service flow. |
| **Token replacement or host stop** | Terminate gateway child processes, erase runtime copies of secrets, invalidate the local session, and remain stopped until the owner starts again. |

## Security contract

Telegram access must fail closed. The primary authorization control lives in Hermes’ gateway configuration, not solely in the Android UI: only the configured owner chat ID(s) or an explicit pairing flow may dispatch a prompt. The Android UI must store token material in encrypted storage, redact it from logs, and never fall back to an open bot when no allowlist is present. [6]

The runtime’s file capability is limited to an app-private workspace by default. Any access to user-selected files must use Android’s Storage Access Framework and preserve the selected URI boundary rather than scanning device storage. Every built asset should be pinned, hashed, and reproducibly built; Pocket Relay must not `pip install` arbitrary dependencies at runtime.

## Build sequence

| Milestone | Success criterion |
|---|---|
| **M1 — Reproducible runtime bundle** | CPython 3.11, Hermes core, and an Android-wheel lockfile build for ARM64 in CI. |
| **M2 — Native launcher** | Kotlin/JNI can launch the private interpreter and return a structured health response without exposing a terminal. |
| **M3 — Gateway host** | Foreground service supervises a Telegram-only Hermes gateway and accepts messages solely from a configured allowlist. |
| **M4 — Control plane** | Pocket Relay shows real lifecycle, logs, memory/schedule summaries, and supports start/stop/recovery. |
| **M5 — Recovery validation** | Device reboot, app process death, network loss, low storage, token rotation, and agent crash behavior are tested. |

## References

[1]: https://github.com/NousResearch/hermes-agent "NousResearch Hermes Agent repository — MIT license and Android/Termux support"
[2]: https://raw.githubusercontent.com/NousResearch/hermes-agent/main/pyproject.toml "Hermes Agent project dependencies and Python version constraint"
[3]: https://raw.githubusercontent.com/NousResearch/hermes-agent/main/constraints-termux.txt "Hermes Agent Android/Termux constraints"
[4]: https://docs.python.org/3/using/android.html "Python documentation — Using Python on Android"
[5]: https://github.com/libtermux/libtermux-android "libtermux-android repository — standalone embedded environment claim and experimental status"
[6]: https://hermes-agent.nousresearch.com/docs/user-guide/messaging "Hermes messaging gateway documentation"
