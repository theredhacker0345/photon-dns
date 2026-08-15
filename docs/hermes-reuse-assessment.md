# Reusing Hermes Agent in Pocket Hermes

## Decision

**Pocket Hermes will reuse the existing Hermes Agent project as the agent runtime.** It will not fork or recreate Hermes’ planning, memory, skills, tool, model-provider, or Telegram-gateway layers for the MVP. Pocket Hermes is instead a companion Android host controller: it helps a phone owner install, configure, supervise, and safely operate the upstream process.

## Verified upstream integration surface

| Area | Upstream capability | Pocket Hermes responsibility |
|---|---|---|
| **License** | Hermes Agent is released under the MIT License. [1] | Preserve the upstream copyright and license notice, publish Pocket Hermes’ own license, and clearly identify the independently maintained upstream dependency. |
| **Android runtime** | Hermes documents a tested, narrower Termux installation route using its `termux` extra. It explicitly excludes some desktop-style dependencies such as the standard voice extra and treats browser automation as experimental. [2] | Provide a guided Termux-first setup, visual readiness checks, logs, and safe hand-off instructions rather than claiming that the React Native UI alone runs Hermes. |
| **Messaging** | Hermes’ gateway supports Telegram and exposes setup, status, start/stop, adapter controls, and session commands. [3] | Collect the owner’s intended Telegram configuration through a protected screen; display status and safe controls without replacing the gateway implementation. |
| **Authorization** | Hermes supports platform allowlists such as `TELEGRAM_ALLOWED_USERS` and a DM-pairing model. [3] | Treat an approved owner chat ID as required setup, explain the access boundary, and prevent presenting a host as protected until the user has configured an allowlist or pairing policy. |
| **Scheduling** | Hermes includes its own gateway/cron subsystem. [1] | Surface schedule state, next runs, and delivery route; do not write a duplicate scheduler in the mobile app. |

## Recommended packaging model

The first release should install Hermes within **Termux** on the dedicated phone, then use Pocket Hermes as its local control plane. This directly follows the upstream Android documentation and avoids embedding Python, Node, shell tooling, and a broad tool-execution environment into the mobile app before the operational model is proven. [2]

Pocket Hermes must store only small credentials in Android encrypted storage. The Telegram token should never be copied into normal app preferences, activity history, screenshots, or logs. The preferred user journey is: configure token and allowed chat ID in Pocket Hermes, write a protected runtime configuration through an explicit local bridge, then start the upstream `hermes gateway` process through that bridge.

## Native-runtime roadmap

An Expo interface is suitable for the control plane, but it is not a durable substitute for an Android foreground service. The future native bridge must be separately implemented and audited. It should run a visible foreground notification, expose only narrow lifecycle/configuration operations to the app, enforce owner authorization in the Hermes gateway itself, report health over a local-only interface, and restart according to Android’s rules rather than concealing failures.

## Non-goals for the MVP

The MVP will not reimplement Hermes’ agent loop, memory system, Telegram adapter, or cron scheduler. It will not claim unrestricted browser automation, background reliability beyond the installed runtime’s guarantees, or device-wide root access. The operator remains responsible for locking the dedicated phone, keeping it powered/networked, and carefully selecting the tools that the Hermes runtime may use.

## References

[1]: https://github.com/NousResearch/hermes-agent "NousResearch/hermes-agent — GitHub"
[2]: https://hermes-agent.nousresearch.com/docs/getting-started/termux "Hermes on Android with Termux"
[3]: https://hermes-agent.nousresearch.com/docs/user-guide/messaging "Hermes Messaging Gateway documentation"
