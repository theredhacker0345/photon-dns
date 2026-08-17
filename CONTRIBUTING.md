# Contributing to Pocket Agent Host

Thank you for contributing to Pocket Agent Host. The project is an Android
control plane for a private, owner-operated AI host. Contributions must keep
the owner-only boundary, private storage model, no-telemetry commitment, and
FOSS distribution requirements intact.

## Before opening a merge request

Create a focused branch, explain the user-visible and security effects of the
change, and add deterministic tests for new policy, storage, native-bridge, or
model-provider behavior. Run the local gates:

```bash
pnpm test
pnpm check
pnpm run sbom:js
pnpm run sbom:python
pnpm run audit:licenses
pnpm run release:preflight
```

Document updates that affect runtime boundaries, privacy, threat modeling,
F-Droid packaging, or license obligations. Do not add analytics, proprietary
runtime dependencies, hard-coded credentials, or a visible terminal workflow.

## Contribution certification

Every submitted app-owned contribution follows
[COPYRIGHT_POLICY.md](COPYRIGHT_POLICY.md). In short, contributors retain
copyright while permitting distribution of their contribution under
`GPL-3.0-only`. Please add a sign-off to each contributing commit:

```text
Signed-off-by: Full Name <email>
```

Only submit original work or compatible third-party material with its source,
license, and notice requirements clearly identified. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[CONTRIBUTORS.md](CONTRIBUTORS.md) for attribution rules.
