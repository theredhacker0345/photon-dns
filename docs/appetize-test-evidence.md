# Appetize.io Android Test Evidence

## Session Record

| Field | Value |
|---|---|
| Test date | 2026-08-18 GMT+5 |
| Uploaded artifact | `android/app/build/outputs/apk/release/app-release-unsigned.apk` |
| Appetize public key | `dhdj7ssadadmi5btc3miv4r6vq` |
| Emulator URL | https://appetize.io/embed/dhdj7ssadadmi5btc3miv4r6vq |
| Credential health check | Passed using the read-only authenticated app-list request; token was not logged. |
| Upload result | Passed. The Appetize.io upload endpoint returned a public key for the Android APK. |
| Launch status | The emulator accepted the APK and progressed from `Loading…` to `Scanning App…`. Its first start attempt showed a generic `Unexpected error occurred` message before the app UI was reached. One retry is now in the loading state; interactive application checks remain pending. |

> This document records only test metadata and observable emulator states. It deliberately does not contain the Appetize.io API token or any user-provided secret.

## CLI Diagnosis

The authenticated command-line lookup of the uploaded public key returned an **iOS** app record, despite the submitted file being an Android APK. That platform mismatch explains why the embedded session did not reach the Android app UI. The existing upload helper sends only a multipart `file` field and does not declare a platform, so it must be corrected to use Appetize.io’s documented Android upload parameters before an Android session can be tested.

The Appetize.io REST API uses the `X-API-KEY` header for authenticated requests, and the official documentation distinguishes Android uploads from iOS uploads through their upload configuration. [1] [2]

## References

[1]: https://docs.appetize.io/rest-api "Appetize.io REST API"
[2]: https://docs.appetize.io/platform/app-management/uploading-apps "Uploading Apps | Appetize Docs"

## Corrected Android Upload

The CLI uploader now submits the required multipart metadata, `platform=android` and `fileType=apk`, with the APK. The corrected command-line upload returned Android build key `nqibtiglkaszc2sfghqnq27squ`.

The Appetize.io REST documentation specifies that a new app requires an explicit `platform` value and that direct multipart uploads retain the same fields as the REST app-creation request. [3] [4]

## CLI Session Constraint and Supported Automation Path

Appetize.io documents app uploads and app management through REST, but documents live session control through its browser-oriented JavaScript SDK. The supported session API exposes startup, UI inspection, device actions, screenshots, Android shell commands, debug logs, and optional ADB tunnel information. It requires an embedded client/frame to establish the live emulator transport; it is not a standalone REST session endpoint. [5] [6] [7]

For this account, the command-line workflow can therefore reliably perform authenticated build inspection and upload. Live Android interaction can proceed through either the documented SDK session bridge or the Appetize-generated ADB command after a session has been established. The original app record was iOS-classified; it has been superseded by the corrected Android-classified upload above.

## CLI Harness Result — 18 August 2026

The local Chromium/DevTools harness loaded the official Appetize JavaScript SDK, selected the Android build `nqibtiglkaszc2sfghqnq27squ`, and attempted to start a Pixel 4 portrait session through the documented SDK. Appetize rejected the request before Android boot with the server response: **“Embeds are not enabled for this app. The app owner must upgrade their plan to enable embeds.”**

An earlier request that enabled debugging and recording was also rejected because those capabilities require a browser session authenticated to an account authorized to debug this app. Removing the privileged flags exposed the definitive embeds-plan restriction above. The supplied API token is valid for REST app management, but Appetize's documented REST surface has no headless-device endpoint that bypasses the embed entitlement. No device UI, runtime crash, or product defect can be inferred from this account-level test blocker.

**Required owner action:** Enable Appetize embeds for the application/account, or provide a configuration with embed access. The reusable `scripts/test-appetize-cli.py` harness can then start the Android smoke test without relying on the Appetize web-player controls.

## Signed-APK Installability Repair — 18 August 2026

The Appetize installation error `INSTALL_PARSE_FAILED_NO_CERTIFICATES` was traced to the earlier unsigned F-Droid handoff artifact. The release build policy intentionally leaves the default artifact unsigned unless a maintainer explicitly supplies all four `POCKET_HERMES_RELEASE_*` signing inputs. For emulator testing, an ignored, short-lived, non-production certificate was generated locally and supplied through that established opt-in path; no production or F-Droid key was created, committed, or substituted.

The resulting `app-release.apk` passed Android `apksigner verify` with a single 3072-bit RSA signer and APK Signature Scheme v2. Its SHA-256 is `c8f4a121af896ac1f1c035c8d35e054b758eb1845534e0c51841df4878e7e5f1`. The Appetize uploader now defaults exclusively to `app-release.apk` and rejects any `*-unsigned.apk` input before network upload. This repair preserves the unsigned-by-default reproducible F-Droid pathway while preventing repeat cloud-test installation failures.

The newly uploaded Android build is available under Appetize public key `hi2zpmupf5doxgkuhq5bfmtnze`. In the direct Appetize player, the signed build advanced from **Tap to Start** to the Android **Loading** state with no `INSTALL_PARSE_FAILED_NO_CERTIFICATES` message. This is installability evidence only; the subsequent host UI smoke test remains subject to Appetize session availability and the existing embed entitlement.

The direct session subsequently reached the configured Pixel 7 / Android 13 launcher and exposed Appetize developer controls. This confirms the emulator session now proceeds past the rejected unsigned-artifact stage. The application activity still needs an explicit launch verification and screen-flow smoke test; reaching the launcher alone is not treated as an app-success result.

## x86_64 Emulator Compatibility Repair — 18 August 2026

The Appetize debug log identified the first native launch failure precisely: `SoLoaderDSONotFoundError` for `libreactnative.so` on an **x86_64** Android 13 emulator. The default release remains ARM64-only for F-Droid and dedicated physical phones, so that library was intentionally absent from the prior test artifact.

An opt-in `POCKET_HERMES_EMULATOR_TEST_BUILD=true` profile now produces a separate x86_64-only emulator artifact without changing the ARM64 default. Its matching Chaquopy dependency profile includes a locally cross-compiled `pydantic_core` wheel. The locally signed artifact passed `apksigner verify` using APK Signature Scheme v2 and includes `lib/x86_64/libreactnative.so` (6,123,008 bytes) plus `lib/x86_64/libpython3.11.so` (5,308,952 bytes). Its Appetize public key is `f5o3zdiwtnys7s4quqwhtrooqa`.

The CLI harness correctly targets this Android build but remains blocked *before device boot* by the previously recorded Appetize embed entitlement. Consequently, it cannot yet provide a cloud launch result for the repaired binary. A direct player session or an account with embeds enabled can now validate that the original missing-`libreactnative.so` crash no longer occurs.

[3]: https://docs.appetize.io/rest-api/v1/create-new-app "Create new app | Appetize Docs"
[4]: https://docs.appetize.io/rest-api/v1/direct-file-uploads "Direct file uploads | Appetize Docs"
[5]: https://docs.appetize.io/javascript-sdk "JavaScript SDK | Appetize Docs"
[6]: https://docs.appetize.io/javascript-sdk/automation/device-commands "Device commands | Appetize Docs"
[7]: https://docs.appetize.io/features/advanced-features/android/adb-tunnel "ADB tunnel | Appetize Docs"
