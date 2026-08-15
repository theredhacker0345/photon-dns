# Pocket Hermes Validation Notes

## Control-plane preview

The mobile web preview rendered the **Host dashboard** with the intended phone-host message, an explicit setup-required state, a configuration action, an app-private workspace boundary, an owner-only Telegram gateway boundary, and persistent bottom-tab navigation.

The dashboard’s settings action successfully opened the **Host settings** route. The settings screen rendered the identity fields, optional model endpoint, hidden Telegram token field, required allowed-owner chat ID field, secure-storage warning for web preview, runtime-policy control, and a clear-local-activity action.

## Validation limitation

The managed screenshot capture repeatedly failed because the Metro process was killed by the sandbox under memory pressure. Direct preview navigation successfully rendered the app in the browser after the development server restart. The final native Android validation still requires an APK/dev-client build because secure storage and the embedded runtime bridge cannot be accurately exercised in the browser preview.

Subsequent browser navigation to the `/agent` route returned the managed proxy’s “currently unavailable” page while the local Metro log showed a completed bundle. This is recorded as a preview-proxy availability issue, not an application type error: deterministic tests and `tsc --noEmit` remained successful. The final deliverable should be verified in a custom Android build, where the foreground-service bridge and secure-storage implementation are meaningful.

## Host Setup flow validation

The new `/setup` route was type-checked and the existing deterministic host-policy suite passed. Managed mobile screenshot capture failed after the preview restart, and direct browser navigation returned the sandbox proxy’s unavailable page even though the local development service reported a ready Metro process. This is recorded as an environment/proxy limitation rather than evidence of a route or type error. Native Android validation remains necessary for the complete secure-storage experience.

## Completed-host dashboard and gateway validation

At a 375 × 812 portrait viewport, the Device setup screen, final Gateway Check screen, and default Host dashboard all rendered successfully. The setup progression, security explanation, large primary actions, and compact bottom navigation remained readable and reachable. The post-setup dashboard condition is covered by type-checked state logic; actual CPU/RAM values are intentionally marked as awaiting the native embedded-runtime bridge rather than shown as mock measurements.

## Supervisor telemetry, receipt, and alert validation

The TypeScript build and deterministic policy suite passed after adding the typed native-supervisor adapter, dashboard telemetry cards, Telegram delivery-receipt state, and local resource alert hook. The managed screenshot service failed for the dashboard and gateway-test paths after a successful Metro bundle, so visual confirmation of this increment is blocked by the managed capture environment. The implementation retains an explicit `Bridge pending` state until the Android supervisor module supplies live CPU/RAM values.
