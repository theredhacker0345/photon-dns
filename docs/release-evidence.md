# Pocket Hermes Release Evidence Record

**Record date:** 2026-08-17  
**Scope:** Local sandbox release-candidate evidence after the complete
gap-closure program. This record distinguishes verified source-side controls
from publication and physical-device steps that require maintainer-controlled
infrastructure or hardware.

## Verified local gates

| Gate | Result | Evidence |
|---|---|---|
| Deterministic policy and contract suite | **Passed** | `pnpm test`: 6 test files and 32 tests passed. |
| Type safety | **Passed** | `pnpm check` completed with `tsc --noEmit`. |
| JavaScript dependency closure | **Passed** | `pnpm run sbom:js` generated 721 production JavaScript components with zero unresolved edges. |
| Embedded Python dependency closure | **Passed** | `pnpm run sbom:python` generated a CycloneDX 1.6 SBOM with 49 pinned components, including `hermes-agent` 0.20.1 and `jiter` 0.10.0. |
| License gate | **Passed** | `pnpm run audit:licenses` reported 770 accepted, 0 manual-review, and 0 blocked components. |
| Release configuration | **Passed** | `pnpm run release:preflight` confirmed the Metro-only app graph, fixed Android package ID, SBOM and license evidence, and unsigned-by-default F-Droid release path. |
| Existing ARM64 APK integrity | **Verified, historical** | `android/app/build/outputs/apk/release/app-release.apk` is present at 73,732,724 bytes with SHA-256 `fdfd1ca6a835044a8b395f42203f6d412841abd1139ec06b01be5cb46f6afccd`. |

## Artifact boundary

The preserved APK is the previously built ARM64 artifact and has **not** been
rebuilt during this release-hardening pass, by design. It demonstrates that the
native packaging pipeline produced the measured artifact, but it must not be
represented as a binary of the post-gap-closure source tree. A fresh unsigned
APK from the published immutable source tag is required before F-Droid
submission and current-device acceptance testing.

## F-Droid readiness boundary

Pocket Hermes has a source-controlled unsigned-release configuration. In the
absence of a maintainer key, Gradle produces an unsigned release; when an
explicit maintainer release key is supplied, the release build uses that key
only and never inherits Android's debug key. F-Droid metadata and maintainer
notes now identify the public repository/tag requirement instead of making a
premature submission claim.

F-Droid requires the build recipe's Git repository to be public, HTTPS, and
unauthenticated, while a build entry identifies its source through a
`commit`.[1] Its reproducibility process compares a F-Droid-built unsigned
artifact with an upstream-signed artifact using signature-compatible
comparison.[2] The remaining publication steps are therefore: publish the
complete source, create an immutable public tag, set real metadata URLs and
the matching commit, run the clean F-Droid build, and validate the fresh APK on
a physical ARM64 device with the owner's credentials.

## References

[1] [F-Droid, *Build Metadata Reference*](https://f-droid.org/en/docs/Build_Metadata_Reference/)

[2] [F-Droid, *Reproducible Builds*](https://f-droid.org/en/docs/Reproducible_Builds/)
