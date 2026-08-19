# Physical-Device Encrypted Backup Acceptance Checklist

This checklist is for an owner testing **Pocket Relay’s Android encrypted backup and restore flow on a real device**. It is deliberately manual: it confirms platform permissions, Android file sharing, password handling, private preview, explicit restore confirmation, and post-restore safeguards that emulator or browser checks cannot prove.

> **Safety boundary:** Pocket Relay backups intentionally exclude the Telegram bot token, provider API keys, proxy credentials, MCP bearer credentials, conversation history, telemetry, runtime logs, and audit records. A successful restore does not recreate those secrets or private records.

## Test Conditions

| Check | Required condition | Pass condition |
|---|---|---|
| Device | Android 7.0 / API 24 or newer, physical device | Pocket Relay opens normally and the backup controls are available. |
| App build | A release or development build containing the native Neuron Encrypt module | Export does not report that native encryption is unavailable. |
| Existing safe data | A configured host name plus at least one safe item such as a favourite, automation, disabled remote MCP server, or reviewed skill | The later preview can show a meaningful current-versus-backup comparison. |
| Protected credentials | A Telegram token or provider key may be configured for the test, but must be recorded separately by the tester | Credentials remain on the device after restore and are never displayed or written into the exported file. |
| Storage | Sufficient free private storage and a user-accessible destination such as Files, Drive, or removable storage | Android’s share sheet and later file picker can both access the `.prbackup.neuron` file. |

## A. Create and Verify an Encrypted Export

| Step | Owner action | Expected result |
|---|---|---|
| 1 | Open **Settings → Data & Backup**. | The card states that backups are password-protected and lists excluded credential and private-history categories. |
| 2 | Optionally enable a reminder and choose weekly, two-weekly, or monthly. Grant Android notification permission if asked. | A success message confirms a **local** reminder. No push token, password, or backup data is requested. |
| 3 | Tap **Create encrypted backup**. | A password sheet appears; no file is created yet. |
| 4 | Enter a unique test password of at least 12 characters. Do not reuse a provider key, Telegram token, or device unlock PIN. | The **Encrypt and share** action becomes available. |
| 5 | Tap **Encrypt and share**, then use Android’s share sheet to save the file to a known location. | A `.prbackup.neuron` file is created. The app does not retain the password or a persistent external file path. |
| 6 | Confirm the dashboard’s **Backup Health** card updates with a recent successful backup time. | The indicator reports a timestamp only—not a password, contents, or local file location. |
| 7 | In the selected file location, verify the filename and extension. Do not try to edit or rename the contents. | The file is present and cannot be meaningfully read as plain configuration text. |

## B. Validate Preview-First Restore Behavior

| Step | Owner action | Expected result |
|---|---|---|
| 1 | Change one or more safe settings after export, for example the host name, favourites, or an automation. Leave credentials in place. | The current app state differs from the backup state. |
| 2 | Return to **Settings → Data & Backup** and tap **Restore from backup**. Choose the exported file. | Android’s picker returns to Pocket Relay and the app asks for the backup password. Nothing has been restored. |
| 3 | Enter an incorrect password once. | Verification fails. No settings, skills, provider metadata, or credentials change. |
| 4 | Enter the correct password and tap **Decrypt for preview**. | The app displays a **Detailed change review** before showing any restore action. |
| 5 | Review every row marked **Will change**, **Unchanged**, or **Excluded**. | The comparison covers host configuration, automations, favourites, provider metadata, MCP metadata, skills, and cleared MCP approvals. |
| 6 | Check the compatibility notice. | A backup from an older or newer app version is shown with a warning; a valid supported format remains reviewable. An unsupported format/version fails safely with an explicit incompatibility message and no restore action. |
| 7 | Confirm that the exclusion notice names tokens, API keys, proxy/MCP credentials, conversation history, telemetry, and audit records. | The preview states that these categories are not imported. |
| 8 | Tap **Cancel restore**. | The preview closes, no state changes, and the decrypted candidate is not applied. Reopen the file to begin a new review. |

## C. Confirm a Restore and Inspect the Result

| Step | Owner action | Expected result |
|---|---|---|
| 1 | Repeat Section B through the detailed preview. | The same safe change summary is presented. |
| 2 | Tap **Confirm and restore**, then choose **Restore** in the final Android confirmation. | Only the reviewed backup data is applied. |
| 3 | Reopen Settings and Automations. | Restored safe host settings, favourites, automations, provider metadata, MCP metadata, and skills match the preview. |
| 4 | Inspect remote MCP servers and skills. | MCP servers are disabled/unverified and skills remain disabled until the owner explicitly enables them. MCP tool approvals are cleared. |
| 5 | Test Telegram and the selected model provider using their normal connection checks. | Existing protected credentials remain local; connection checks may require re-entry where the test device did not already have the needed secret. No credentials were imported from the backup. |
| 6 | Check the Dashboard and Settings. | Backup Health still shows the last successful export timestamp; it does not imply that the restored content or external file remains available. |

## D. Record the Outcome

Record the build version, device model, Android version, export destination type, reminder permission result, backup compatibility state, and whether every expected safe change appeared in the preview. Do **not** record passwords, tokens, API keys, external backup locations shared with others, or the contents of the encrypted file in an issue report.

If any step fails, report the app version, Android version, non-secret error message, and the checklist step number through the project issue tracker. Attach only sanitized screenshots that do not expose chat IDs, endpoints, file paths, or account data.
