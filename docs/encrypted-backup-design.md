# Encrypted backup and restore

## Decision and shipped scope

Pocket Relay ships an **owner-triggered, password-protected portable backup** for its non-secret control-plane data. The Android module vendors the reviewed Neuron Encrypt source and invokes it through a deliberately narrow Android-native boundary. The encrypted file extension is `.prbackup.neuron`.

> **Security rule:** A backup is never an agent tool, an MCP tool, a schedule action, or an automatic cloud upload. Only the phone owner can start export or restore from Settings.

The current format uses Neuron Encrypt’s authenticated streaming encryption construction with AES-256-GCM-SIV, Argon2id key derivation, and HKDF-SHA512 domain separation. The vendored JNI implementation accepts app-private file handles and password bytes; it clears the password byte array on the native side after the cryptographic operation completes.[1]

| Operation | Owner experience | Boundary enforced by Pocket Relay |
|---|---|---|
| Export | Select **Create encrypted backup**, enter a password of at least 12 characters, then choose a destination through Android’s system share sheet. | The password is never persisted. The portable JSON is created from an explicit allow-list before it reaches the native encryption boundary. |
| File selection | Select **Restore from backup** and choose one `.prbackup.neuron` file using Android’s file picker. | The file picker copies the selected file into app-private cache before native processing. |
| Verification | Enter the password and select **Decrypt for preview**. | Decryption returns a JSON candidate for schema/version parsing only. No live state changes happen during verification. |
| Confirmation | Review the safe contents, then select **Confirm and restore** and accept the final Android confirmation prompt. | Only this final action calls the store-level restore routine. Closing the preview or entering a wrong password makes no configuration changes. |

## Strict payload allow-list

The encrypted payload uses the versioned format identifier `pocket-relay-backup`, version `1`. It intentionally backs up portable configuration—not a device image or copy of protected Android storage.

| Included | Restored safely | Never included or restored |
|---|---|---|
| Host name, private owner chat ID, selected model metadata, Telegram proxy type/host/port, and resource policy | Restored as public configuration; protected token flags are reset. | Telegram bot token, model API keys, provider connection keys, MCP bearer tokens, Telegram proxy username/password, Android Keystore data |
| Automations and favorite model IDs | Restored as ordinary local preferences. | Conversation ledger, task history, Telegram traffic, runtime diagnostics, telemetry, QuickJS audit records |
| Provider connection labels/endpoints and active provider ID | Metadata returns without an API key, so a provider must be re-authenticated before use. | Any untyped credential-like field supplied to a provider record |
| Remote MCP server metadata, tool manifests, and time-limited approval records | Restored connectors are deliberately made **disabled** and **not checked**; an owner must verify and enable them again. | MCP credential material and any untyped credential-like field attached to a connector |
| Installed QuickJS skill manifests and source-verified portable bundles | Restored as reviewed, source-bound packages through the existing private skill storage flow. | Execution output, drafts, private history, or device files outside the skill bundle |

The serializer reconstructs proxy, provider, and MCP objects field by field. It does not spread an input object into the output. Regression tests deliberately inject token- and credential-like fields and prove that they are absent from the JSON supplied for encryption.

## Restore safeguards

The app validates the outer format and exact version before a candidate reaches the restore stage. A malformed file, wrong password, unrelated Neuron Encrypt file, or unsupported version is rejected without applying any part of the payload.

Restoration is intentionally not a merge with credentials. Existing Android-protected credentials remain device-local and are not copied into the backup. The restored public metadata is normalized so a model provider, Telegram gateway proxy, or MCP connector cannot claim that credentials were restored. In particular, MCP connectors are saved disabled and `not_checked`; they have to be re-verified under the current owner’s authority.

There is no automatic background restore, no partial silent apply, and no backup operation available to the embedded Hermes worker or QuickJS skills. A new backup password cannot be recovered by Pocket Relay; if it is lost, the encrypted file is not recoverable.

## Operational constraints

Neuron Encrypt documents an Argon2id profile with an approximately 256 MiB working-memory cost per operation.[1] This is intentional and is not silently weakened by Pocket Relay. Owners should create and restore backups while the host is idle, the device is on power, and the configured storage reserve is available. The operation is Android-only; the browser preview does not expose the native encryption boundary.

Encrypted export files reside in the app cache only until Android’s share target consumes them. The selected restore file is copied to the app-private cache. Pocket Relay does not request cloud-provider credentials, copy SecureStore databases, or expose a file-system or shell tool to the agent.

The dashboard may retain only the timestamp of the last successful encrypted export as owner-visible backup health metadata. It never stores a backup password, destination, filesystem path, or payload-derived secret. Restore confirmation presents a calculated, safe difference summary so the owner can see which allowed control-plane records would change and which private categories remain excluded.

## Compatibility and maintenance

The backup contract, test suite, and Android bridge must be updated together whenever the format version changes. A future version must retain a migration path or reject older data clearly; it must never interpret an unknown version as the current schema. Changes to the vendored Neuron Encrypt source require a renewed provenance, dependency, format, JNI, and Android build-chain review before publication.

## References

[1]: https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md "Neuron Encrypt README"
[2]: https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/LICENSE "Neuron Encrypt GPL-3.0 license"
[3]: https://developer.android.com/training/data-storage/shared/documents-files "Android Storage Access Framework"
