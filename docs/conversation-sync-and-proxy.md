# Pocket Relay Conversation Synchronization and Telegram Proxy Design

## Purpose

Pocket Relay exposes one **owner conversation** across the Android Agent Console and the configured private Telegram direct message. Both input surfaces resolve to the same Hermes Telegram session key, so the agent retains one bounded upstream context window rather than creating separate app and Telegram memories.

| Surface | Input identity | Reply behavior | Context behavior |
| --- | --- | --- | --- |
| Telegram | Authenticated configured owner chat | Hermes responds in Telegram normally | Uses the canonical owner Telegram session |
| Agent Console | Internal event using the same owner Telegram session identity | Result appears in the console and is explicitly mirrored once to the configured Telegram owner chat | Uses the same canonical owner Telegram session |
| Schedules | Internal task event | Retains its existing delivery policy | Does not become an interactive transcript entry |

The Android app stores a **bounded, app-private transcript ledger** for rendering owner-visible conversation history. It is not a second prompt store and does not replace Hermes session persistence. The ledger stores a maximum of 100 entries, truncates each displayed body to 6,000 characters, never writes diagnostics, and is never returned to a non-owner Telegram chat. The owner can reset the shared Hermes session using Hermes’ supported `/reset` command and clear the displayed local ledger in the same action.

## Duplicate-delivery and privacy rules

Telegram-originated events keep Hermes’ normal adapter delivery path. The worker records those event and response bodies but does not send a second reply. Agent Console events are marked internal, invoke the same Telegram session identity, then call the active Telegram adapter once with the returned response. This separates transcript recording from delivery and avoids a second Telegram message.

All recorder, list, and reset operations are inside the private Android worker. The JavaScript bridge exposes only bounded message bodies, role, origin, delivery status, and timestamps. It does not expose provider keys, Telegram tokens, MCP credentials, proxy credentials, raw diagnostics, or session-store paths. Owners should still avoid entering credentials into ordinary conversation prompts.

## Telegram proxy policy

The Telegram transport may be configured as **Direct**, **HTTP**, or **SOCKS5**. The selected proxy applies only to the private Telegram gateway’s Bot API requests; it does not proxy model-provider, MCP, Android telemetry, or other traffic. Pocket Relay builds the proxy URL from a validated transport, host, port, and optional protected username/password, then passes it to the pinned Hermes Telegram adapter through its documented `TELEGRAM_PROXY` runtime hook. The embedded runtime already pins `httpx[socks]` and `socksio`, which provide the SOCKS-capable client path.[1]

Proxy settings are available during first-run Telegram setup and later in Settings. They use the existing Android secure-secret path for usernames and passwords. The host, port, and transport are non-secret configuration. Invalid URLs, embedded URL credentials, whitespace/control characters, paths, fragments, and ports outside 1–65535 are rejected. Proxy configuration is optional; direct Telegram connectivity remains the default. Gateway and owner test-message operations use the selected proxy to call the Telegram Bot API and return only redacted success or failure results.

## Verification boundaries

Automated tests can prove that app and Telegram events use the canonical session source, that ledger retention is bounded, that only app-originated replies invoke the mirror function, and that proxy credentials never enter public configuration or logs. They cannot prove that a particular third-party proxy is reachable from a user’s device. A physical Android check remains necessary: enter the proxy in Settings, test the Telegram gateway, send an owner message in Telegram, send an app message, confirm each reply is visible in both places, then use Reset conversation and verify the next prompt begins a new context.

## References

[1]: https://docs.python-telegram-bot.org/en/v20.6/telegram.request.httpxrequest.html "python-telegram-bot HTTPXRequest documentation"
