# Pocket Hermes Validation Notes

## Control-plane preview

The mobile web preview rendered the **Host dashboard** with the intended phone-host message, an explicit setup-required state, a configuration action, an app-private workspace boundary, an owner-only Telegram gateway boundary, and persistent bottom-tab navigation.

The dashboard’s settings action successfully opened the **Host settings** route. The settings screen rendered the identity fields, optional model endpoint, hidden Telegram token field, required allowed-owner chat ID field, secure-storage warning for web preview, runtime-policy control, and a clear-local-activity action.

## Validation limitation

The managed screenshot capture repeatedly failed because the Metro process was killed by the sandbox under memory pressure. Direct preview navigation successfully rendered the app in the browser after the development server restart. The final native Android validation still requires an APK/dev-client build because secure storage and the embedded runtime bridge cannot be accurately exercised in the browser preview.

Subsequent browser navigation to the `/agent` route returned the managed proxy’s “currently unavailable” page while the local Metro log showed a completed bundle. This is recorded as a preview-proxy availability issue, not an application type error: deterministic tests and `tsc --noEmit` remained successful. The final deliverable should be verified in a custom Android build, where the foreground-service bridge and secure-storage implementation are meaningful.
