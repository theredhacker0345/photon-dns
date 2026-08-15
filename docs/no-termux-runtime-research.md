# No-Termux Native Android Runtime — Research Notes

## Design question

The requirement is a **lightweight, native Android host** that stays available on a dedicated charging phone and receives owner-authorized Telegram messages. It must not depend on Termux, Python, Node.js, or a bundled general-purpose shell.

## Evidence collected

| Topic | Finding | Consequence for Pocket Hermes |
|---|---|---|
| **Upstream Hermes Agent** | Hermes’ documented Android path is Termux and its main runtime is not a small Android-native library. [1] | We cannot embed the existing upstream agent runtime unchanged in a lightweight APK. We may reuse its design concepts and compatible skill format, but the native host must be a distinct Kotlin/Rust implementation with a defined compatibility subset. |
| **Long-running Android work** | Android supports work important to the user through foreground execution with a user-visible notification. Android documentation notes constraints/quotas for long-running workers and states that direct foreground-service launch may be more appropriate where required. [2] | The native host needs a foreground service, explicit start/stop controls, a persistent notification, and restart/health logic. It must not claim that ordinary JavaScript background tasks are enough. |
| **Telegram delivery** | Telegram’s Bot API is HTTPS-based and allows bots to retrieve updates; it also provides message-send APIs. [3] | A native Kotlin client can use HTTP long polling instead of operating a webhook server, which avoids inbound ports, DNS, and an external VPS. The token remains in Android keystore-backed storage; the runtime independently checks an approved chat/user allowlist before processing a message. |
| **Local inference** | Lightweight local inference is feasible through native C/C++ inference engines and JNI, but a model itself remains the dominant storage/RAM/CPU cost. [4] | The initial runtime should support a remote OpenAI-compatible model endpoint as the lowest-footprint default and make on-device GGUF inference optional for capable phones. |
| **Native agent reference** | ZeroAI demonstrates a Kotlin UI and foreground daemon paired with a Rust agent core through UniFFI. [5] Its application-level license, however, adds a non-standard “funny, cute, or silly” use condition. [6] | We can learn from its public architecture but must not copy or depend on its application code for Pocket Hermes. Any potential Rust-core reuse needs independent license verification at the source repository. |
| **Permissive Rust core** | ZeroClaw is dual-licensed under MIT or Apache-2.0 and describes itself as small, autonomous assistant infrastructure. [7] | It is a viable candidate to evaluate as the embedded Rust agent core, provided we isolate only the required crates, use the license correctly, respect its trademarks, and complete a source-level Android build audit. |

## Candidate architecture

The strongest no-Termux design is a small **Kotlin Android service host** with an optional Rust core. The Kotlin layer owns Android lifecycle, encrypted token storage, Telegram long polling, local SQLite state, notifications, and permission checks. A compact agent-core library owns planning, structured tool dispatch, history summaries, and optional `SKILL.md` compatibility. The agent sends model calls to a configured OpenAI-compatible endpoint by default. An optional JNI bridge to `llama.cpp` or another permissively licensed native inference engine can provide offline/fully local inference later.

This architecture is genuinely lightweight at installation when it uses a remote model: the APK does not bundle a Python distribution, Node runtime, browser, Playwright, or a multi-gigabyte model. It also directly exploits the phone’s storage, RAM, and CPU for state, message handling, tools, and optional local inference.

## Important compatibility truth

Pocket Hermes can be **Hermes-inspired and skill-compatible**, but it cannot accurately market itself as the unchanged Nous Hermes Agent runtime when it does not run that repository’s Python/Node-based stack. The application should be named Pocket Hermes and describe itself as a **native Android host implementing a deliberately scoped, compatible agent profile**. The code and UI should always clearly distinguish “Hermes Agent upstream compatibility” from “native Pocket Hermes runtime.”

## Rejected shortcut

The ZeroAI repository is useful evidence that the Kotlin + Rust + foreground-service architecture can work, but it is **not an acceptable application-code base** for a broadly licensed FOSS project: its top-level license requires use to be “funny, cute, or silly.” [6] Pocket Hermes must either implement its own clean native host or reuse a separately verified permissive core.

## Practical no-Termux path found

The most practical route is **not** to port upstream Hermes Agent’s full Python runtime. It is to build Pocket Hermes as a native Android application with a **small, isolated Rust core** (evaluating the permissively licensed ZeroClaw core) connected to Kotlin through UniFFI. Kotlin owns foreground-service lifecycle, Android Keystore secrets, notifications, Telegram long polling, and local data. Rust owns the limited agent loop, tool registry, memory/scheduling abstraction, and OpenAI-compatible provider client.

The first install remains lightweight by excluding local model weights and broad desktop tools. It uses an online model endpoint, but the host still runs locally on the phone: it stores state, polls Telegram, controls schedules, dispatches approved Android tools, and applies access policy on-device. An optional model pack can add offline inference later, with an explicit storage/RAM warning.

## References

[1]: https://hermes-agent.nousresearch.com/docs/getting-started/termux "Hermes on Android with Termux"
[2]: https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running "Android: Support for long-running workers"
[3]: https://core.telegram.org/bots/api#getupdates "Telegram Bot API — getUpdates"
[4]: https://github.com/ggml-org/llama.cpp "llama.cpp repository"
[5]: https://github.com/Natfii/ZeroAI "ZeroAI — Kotlin/Rust native Android agent reference"
[6]: https://github.com/Natfii/ZeroAI/blob/main/LICENSE "ZeroAI application license"
[7]: https://github.com/zeroclaw-labs/zeroclaw "ZeroClaw core repository and dual license"
