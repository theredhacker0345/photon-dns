# Pocket Hermes F-Droid Publication Checklist

Pocket Hermes now has the source-side components needed for an **unsigned,
F-Droid-oriented Android release**: an ARM64-only Gradle profile, optional
maintainer signing that never reuses the debug key, build/source SBOM
generators, a license gate, Fastlane metadata, and a recipe skeleton. The
local development server is Metro-only; no inherited application backend is in
the Android runtime graph.

> **Publication status.** This project is prepared for a maintainer handoff,
> not yet submitted to F-Droid. A public source repository and immutable
> public tag do not exist in this sandbox, so neither the `Repo`/`RepoType`
> metadata fields nor an F-Droid build-server result can honestly be claimed.

| Requirement | Local evidence | Status | Remaining owner-controlled action |
|---|---|---|---|
| Open-source license | `LICENSE`, Python and JavaScript SBOMs, `license-audit.json` | Passed locally | Publish the exact source alongside the tag. |
| Dependency closure | `pnpm run sbom:js`, `pnpm run sbom:python`, `pnpm run audit:licenses` | Passed locally with no manual-review or blocked license items | Repeat from the tagged checkout. |
| Unsigned F-Droid artifact | `android/app/build.gradle` emits an unsigned release when no release key is supplied | Configured and source-tested | Build it on F-Droid's build server. |
| Reproducible release target | `scripts/release-preflight.mjs --tag <tag>` checks an immutable local tag and release evidence | Tooling complete | Push a public HTTPS Git repository and tag. |
| F-Droid metadata | `metadata/com.app.pockethermes.yml` and Fastlane content are present | Skeleton only | Fill real public `SourceCode`, `IssueTracker`, `RepoType`, `Repo`, and tag before linting. |
| Current-device proof | The preserved ARM64 APK is available for baseline inspection | Historical artifact only | Build and test a **post-gap-closure** release APK on a physical device before publication. |

## Maintainer handoff sequence

First, publish the complete source tree to a public HTTPS Git repository and
create an immutable release tag for the reviewed source. Update the metadata
to point to that repository and tag. F-Droid requires a public, unauthenticated
HTTPS repository for a Git `Repo` and identifies individual builds by their
`commit` field.[1]

Second, in a clean checkout of that tag, execute the following release gates.
They regenerate the evidence rather than trusting committed results.

```bash
pnpm test
pnpm check
pnpm run sbom:js
pnpm run sbom:python
pnpm run audit:licenses
pnpm run release:preflight --tag v1.0.0
```

Third, build an unsigned release with the documented Android toolchain and
install it on a physical ARM64 device. Verify setup, encrypted credential
storage, model preflight, private-owner Telegram handling, foreground service
operation, reboot recovery, scheduler behavior, telemetry freshness, and
policy gates. This current device validation is deliberately separate from the
sandbox tests because it depends on real Android hardware and user-supplied
Telegram/model credentials.

Finally, run `fdroid lint com.app.pockethermes` and a clean F-Droid build-server
build from the public tag. If direct-distribution upstream APKs are later
offered, sign them with `apksigner` and use F-Droid's documented signature
comparison flow before asserting reproducibility.[2]

## References

[1] [F-Droid, *Build Metadata Reference*](https://f-droid.org/en/docs/Build_Metadata_Reference/)

[2] [F-Droid, *Reproducible Builds*](https://f-droid.org/en/docs/Reproducible_Builds/)
