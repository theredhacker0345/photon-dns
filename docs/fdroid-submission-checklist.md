# Pocket Relay F-Droid Publication Checklist

Pocket Relay now has the source-side components needed for an **unsigned,
F-Droid-oriented Android release**: an ARM64-only Gradle profile, optional
maintainer signing that never reuses the debug key, build/source SBOM
generators, a license gate, Fastlane metadata, and a recipe skeleton. The
local development server is Metro-only; no inherited application backend is in
the Android runtime graph.

> **Publication status.** Pocket Relay is **submitted for F-Droid review** in
> [fdroid/fdroiddata merge request !46222](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/46222).
> The public immutable release tag `v1.0.0-fdroid.2` resolves to
> `4ce53341ce0f47ad94f164a0d4fbff40b137f5d2`. The review and an independent
> F-Droid build-server result are still pending; submission does not imply
> acceptance or publication.

| Requirement | Local evidence | Status | Remaining owner-controlled action |
|---|---|---|---|
| Open-source license | `LICENSE`, Python and JavaScript SBOMs, `license-audit.json` | Passed locally; public source tag pushed | F-Droid reviewer verification. |
| Dependency closure | `pnpm run sbom:js`, `pnpm run sbom:python`, `pnpm run audit:licenses` | Passed locally with no manual-review or blocked license items | Repeat from the tagged checkout. |
| Unsigned F-Droid artifact | `android/app/build.gradle` emits an unsigned release when no release key is supplied | Configured and source-tested | Build it on F-Droid's build server. |
| Reproducible release target | `scripts/reproducible-android-build.sh` plus two clean ARM64 builds | Passed locally | Both unsigned APKs matched at SHA-256 `235927e9cce6c89580f88f991e2e7f647c92c73b21ad06e1b7abbfe0208fcd81`; repeat this from the final tag and F-Droid environment. |
| F-Droid metadata | `metadata/com.app.pockethermes.yml`, Fastlane content, verified vendor provenance, and offline wheel builders | Submitted in [MR !46222](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/46222) | F-Droid lint, build-server validation, and maintainer review. |
| Current-device proof | The preserved ARM64 APK is available for baseline inspection | Historical artifact only | Build and test a **post-gap-closure** release APK on a physical device before publication. |

## Maintainer handoff sequence

First, verify the checked-in Hermes Agent and Pydantic Core provenance manifests,
then run the local hermetic reproducibility gate. This has been completed for
the submitted source snapshot: the public HTTPS Git repository exposes immutable
tag `v1.0.0-fdroid.2` at `4ce53341ce0f47ad94f164a0d4fbff40b137f5d2`, and its
F-Droid metadata contribution is now in [MR !46222](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/46222).
F-Droid requires a public, unauthenticated HTTPS repository for a Git `Repo`
and identifies individual builds by their `commit` field.[1]

Second, in a clean checkout of that tag, execute the following release gates.
They regenerate the evidence rather than trusting committed results.

```bash
pnpm test
pnpm check
pnpm run sbom:js
pnpm run sbom:python
pnpm run audit:licenses
pnpm run release:preflight --tag v1.0.0-fdroid.2
```

Third, build an unsigned release with the documented Android toolchain and
install it on a physical ARM64 device. Verify setup, encrypted credential
storage, model preflight, private-owner Telegram handling, foreground service
operation, reboot recovery, scheduler behavior, telemetry freshness, and
policy gates. This current device validation is deliberately separate from the
sandbox tests because it depends on real Android hardware and user-supplied
Telegram/model credentials.

Finally, the F-Droid maintainers will run `fdroid lint com.app.pockethermes`
and a clean build-server build from the submitted public tag. If
direct-distribution upstream APKs are later offered, sign them with `apksigner`
and use F-Droid's documented signature comparison flow before asserting
reproducibility.[2]

## References

[1] [F-Droid, *Build Metadata Reference*](https://f-droid.org/en/docs/Build_Metadata_Reference/)

[2] [F-Droid, *Reproducible Builds*](https://f-droid.org/en/docs/Reproducible_Builds/)
