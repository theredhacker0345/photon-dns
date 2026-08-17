# Reproducible release policy

Pocket Agent Host produces an **unsigned** `release` APK by default. This is
intentional: F-Droid signs artifacts built from its own source recipe. The
Gradle build may use a maintainer release key only when all four
`POCKET_HERMES_RELEASE_*` signing variables (or matching Gradle properties)
are deliberately supplied. It must never fall back to the Android debug key.

## Required evidence before publication

| Gate | Required evidence |
|---|---|
| Public immutable source | A public HTTPS Git repository and a signed/reviewed immutable tag matching the metadata `commit`. |
| Dependency closure | `pnpm run sbom:js`, `pnpm run sbom`, and `pnpm run audit:licenses` complete with no unresolved or manual-review findings. |
| Native reproducibility | Two clean `./gradlew :app:assembleRelease` builds from the same source/toolchain are compared before signing. |
| Upstream signing | Any direct-distribution APK is signed with `apksigner`, then compared against the unsigned artifact before publication. |
| F-Droid recipe | `fdroid lint` and an F-Droid build-server build accept the exact tag, dependency acquisition path, and generated unsigned APK. |

## Current boundary

This repository contains the source recipe and local verification tooling, but
**does not yet have a configured public upstream Git URL and immutable release
tag**. The metadata is therefore intentionally not a submission-ready
fdroiddata entry until those two maintainer-controlled publication inputs
exist.

## Sources

F-Droid's [Build Metadata Reference][metadata] requires an authentication-free
public HTTPS repository for a `git` `Repo` entry and a per-build `commit`.
Its [Reproducible Builds guidance][reproducible] describes comparison of an
upstream signed APK with the F-Droid-built unsigned artifact, including
signature copying with `apksigner`-compatible signatures.

[metadata]: https://f-droid.org/en/docs/Build_Metadata_Reference/
[reproducible]: https://f-droid.org/en/docs/Reproducible_Builds/
