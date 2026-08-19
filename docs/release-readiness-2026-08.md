# Pocket Relay release-readiness review

## Assessment scope

This review covers the checked-in Android host, React Native control plane, security boundaries, release metadata, and deterministic validation gates as of 19 August 2026. It deliberately separates **source-level readiness** from hardware-dependent claims that cannot be proved in a sandbox.

| Area | Source-level status | Release caveat |
|---|---|---|
| Owner-only Telegram gateway | Implemented with a configured private owner identity, protected secrets, proxy route controls, and failure states | Verify a real bot route on the target network and proxy configuration |
| Provider connections | Implemented with protected per-provider credentials, model discovery, and connection feedback | Test each provider account and its current model catalogue |
| Embedded host | Native foreground-service, resource guardrails, telemetry, and battery/storage policies are implemented | Verify OEM battery-management exceptions, reboot recovery, and sustained ARM64 operation |
| Skills, MCP, and QuickJS | Owner-reviewed skills, HTTPS-only MCP policy, source-hash approvals, and isolated data-only QuickJS execution are implemented | Exercise each owner-approved package and connector on a physical device before relying on it |
| UI and accessibility | Semantic themes, touch targets, labels, live status, and focused UI regressions are implemented | Test system font scaling, TalkBack traversal, contrast perception, and smaller Android displays |
| F-Droid materials | GPL-3.0 licensing, reproducible source configuration, metadata, SBOM, and Fastlane initial changelog exist | Complete F-Droid maintainer review and verify the final signed reproducible artifact |

## Security conclusion

The checked-in design remains deliberately bounded: provider and Telegram credentials are protected separately; MCP is remote HTTPS-only; imported skills require explicit owner review; and QuickJS has no shell, compiler, filesystem, or network capability. A changelog contains no sensitive runtime data. These are strong source-level controls, not a replacement for device, dependency, and release-signing verification.

## What must happen before a public production claim

Perform a clean ARM64 install, confirm foreground persistence across a reboot and OEM battery optimisation, test the selected provider and Telegram route with the owner account, review Android logs for denied permissions or crashes, and complete the F-Droid build/reproducibility review. Until those physical checks pass, Pocket Relay should be described as **release-candidate source, not a fully field-validated public release**.
