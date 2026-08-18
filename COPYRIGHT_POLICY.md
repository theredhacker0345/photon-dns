# Copyright and Contribution Policy

> **Working policy, not legal advice.** This repository policy explains the
> project’s expected contribution terms. A maintainer should obtain qualified
> legal review before changing it for a jurisdiction-specific need.

## Project license and ownership

Pocket Relay’s **app-owned source code** is licensed under the GNU General
Public License, version 3 only (`GPL-3.0-only`). The canonical license text is
in [LICENSE](LICENSE). The initial app-owned source is copyright © 2026 Pocket
Relay contributors.

Third-party code is not relicensed by this policy. Its original terms, source
provenance, and notices remain applicable. Maintainers must preserve those
materials in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), `sbom.json`,
`sbom-js.json`, and `license-audit.json`.

## Inbound equals outbound

By opening a merge request or otherwise submitting an app-owned contribution,
the contributor certifies that they have the right to submit it and grants the
project and all downstream recipients the right to use, modify, distribute,
and sublicense that contribution under `GPL-3.0-only`. The contributor retains
their copyright; no separate copyright assignment or contributor license
agreement is required by this policy.

Contributors should include a `Signed-off-by: Full Name <email>` trailer in
each commit that contains their contribution. The trailer records the
contributor’s certification; it does not disclose more personal information
than the contributor chooses to place in the public Git history.

## Third-party material and notices

Do not submit copied code, assets, models, fonts, packages, or documentation
unless its license is compatible with the project’s distribution and the
contributor has documented its source and license in the merge request.
Maintainers must reject proprietary or undisclosed third-party material, retain
required notices, select the BSD-3-Clause alternative for `node-forge`, and
re-run the SBOM and license gate before release.

## Maintainer responsibilities

Maintainers must review contributor certifications, preserve attribution,
record substantial contributors in [CONTRIBUTORS.md](CONTRIBUTORS.md), and
publish the Corresponding Source, build instructions, lockfiles, wheel
provenance, and SBOMs for each conveyed Android APK. They must not remove a
copyright or license notice without documented authority.

## License exceptions and future changes

No exception, dual-license grant, or different inbound contribution term is
effective unless the repository owner documents it in writing in this
repository before merging the affected contribution. Any change to this policy
must preserve the rights already granted under GPLv3 for previously accepted
contributions.
