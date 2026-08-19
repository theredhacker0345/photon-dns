# Optional encrypted backup design

## Decision

Pocket Relay **can use Neuron Encrypt**, but it should not be embedded yet. The repository is GPLv3 and documents Android API 24 support, a streaming authenticated format, and an Android-oriented build path. Its documented memory cost of roughly 256 MiB per operation, unverified dependency chain, and observable outer-file metadata make direct inclusion premature for a resource-bounded persistent agent host.[1]

> **Design rule:** Backup is an explicit owner action, never an agent tool, never an automatic cloud upload, and never a shell or CLI invocation.

## Proposed owner flow

| Step | Owner experience | Security boundary |
|---|---|---|
| Create | The owner selects **Create encrypted backup**, chooses whether protected credentials are included, and confirms the destination with Android’s system picker. | A fresh backup passphrase is entered locally and never saved by Pocket Relay. |
| Prepare | Pocket Relay compiles a minimal allow-listed payload: public host configuration, approved skills, selected local metadata, and—only if chosen—protected credentials decrypted directly in memory. | No terminal, agent, MCP connector, or background task can request this action. |
| Encrypt | A pinned, source-built Neuron Encrypt Android library streams the payload into a single encrypted file. | The immutable format header, KDF settings, and integrity check are recorded inside the encrypted payload. |
| Share/store | Android’s document or share sheet writes the completed opaque-named file to a user-selected location. | Pocket Relay does not obtain cloud credentials or maintain a remote backup channel. |
| Restore | The owner picks a backup file, enters its passphrase, reviews the decrypted manifest, and explicitly selects items to restore. | Validation and a dry-run occur before settings or credentials are replaced; no automatic overwrite exists. |

## Payload and metadata rules

The encrypted payload should use a versioned `pocket-relay-backup.json` manifest and content-addressed skill files. It must omit execution output, audit-result text, raw Telegram traffic, unapproved drafts, decrypted passwords, and Android keystore material. The manifest itself should be inside the encrypted archive. Because Neuron Encrypt documents filename, size, and timestamp exposure, exported files should use opaque names such as `prb-<random>.vault`; the app must avoid descriptive names and minimize externally visible timestamps.[1]

Android Keystore keys are intentionally non-exportable. When the owner opts in to credential backup, the app must decrypt the required values only within its process and immediately stream them into the encrypted payload; a raw SecureStore or preferences database must never be copied. Restoring credentials must require an explicit owner confirmation and re-store them through the current protected-storage boundary.

## Runtime policy

Neuron Encrypt’s documented Argon2id configuration uses approximately 256 MiB of working memory.[1] Pocket Relay should refuse to begin a backup when the native host reports insufficient available memory, an active model task, storage below the configured reserve, or battery conditions that violate the current host policy. It must use the existing foreground notification only while the owner-initiated operation is active and provide cancellation that deletes incomplete output. The crypto profile must not be silently weakened to make a backup fit a smaller phone; any alternate profile needs a separate compatibility and security review.

## Integration gates

| Gate | Required evidence before implementation |
|---|---|
| Source and licence | Pin an immutable Neuron Encrypt revision, include corresponding source and GPL notices, generate an SBOM, and review every native dependency licence. |
| Cryptographic review | Independently inspect the format, key derivation, nonce handling, authenticated metadata, errors, zeroization claims, and restore compatibility; add known-answer and corruption test vectors. |
| Android build | Build a minimal Android library from source under Pocket Relay’s reproducible toolchain—no CLI process, downloaded binary, or externally executable helper. |
| Host safety | Prove bounded memory, cancellation cleanup, foreground lifecycle behaviour, user-selected storage destinations, and absence of plaintext temp files on API 24 and ARM64 hardware. |
| Restore safety | Add dry-run, schema/version checks, credential opt-in, partial restore selection, and a non-destructive rollback path before any persistent state changes. |

## Recommendation

Approve a **design-and-audit milestone** next, not production integration. That milestone can vendor or reference a pinned Neuron Encrypt source revision, build a compatibility harness, audit its dependencies and format, and measure memory on representative phones. Only after those gates pass should Pocket Relay expose a disabled-by-default encrypted backup beta in Settings.

## References

[1]: https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/README.md "Neuron Encrypt README"
[2]: https://gitlab.com/theredhacker0345/neuron-encrypt/-/raw/main/LICENSE "Neuron Encrypt GPL-3.0 license"
[3]: https://developer.android.com/training/data-storage/shared/documents-files "Android Storage Access Framework"
