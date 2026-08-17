# Pocket Agent Host Privacy Notice

Pocket Agent Host is designed as a local Android host. It does not include an app analytics SDK, advertising SDK, account system, or Pocket Agent Host-operated cloud relay. The app stores host configuration, bounded task/schedule history, and local diagnostics in application-private storage. Bot tokens and model credentials are handled through protected storage and are intentionally excluded from Home telemetry and diagnostic responses.

## Data flows

| Data | Where it is handled | Why | Leaves the device? |
|---|---|---|---|
| Telegram instructions and responses | Embedded Hermes worker | Owner-directed remote operation | Yes, through Telegram when the configured bot is active. |
| Model prompts and model responses | Configured HTTPS model endpoint | Agent execution | Yes, to the endpoint selected by the owner. |
| Provider model catalog response | Selected provider’s HTTPS `/models` endpoint | Show current models for selection | Yes, on explicit refresh from Host Setup or Settings; only normalized model metadata is stored locally. |
| Host readiness, CPU/RAM, battery, storage, task and schedule state | Pocket Agent Host private app storage and foreground service | Local control plane, safety gates, and local notifications | No, unless included by the owner in an instruction to an external service. |
| Bot token and model credential | Protected storage and native runtime handoff | Authenticate the configured external services | Only when used to authenticate the selected Telegram or model service; never written into catalog records, events, telemetry, or diagnostics. |

## Owner controls

Owners can remove protected credentials from Settings. This calls the native configuration deletion path and stops the host, rather than merely hiding a field in the user interface. Disabling or deleting schedules removes their private scheduling configuration. Android system backups, device-level screenshots, and the privacy policies of Telegram and the chosen model provider are outside the app’s control.

## Contact and verification

This notice describes the current local architecture. Release reviewers should use the generated `sbom.json`, `sbom-js.json`, and `license-audit.json` together with the Android manifest and source tree to verify the included components and network boundaries.
