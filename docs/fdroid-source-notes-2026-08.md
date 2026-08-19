# F-Droid Source Notes — August 2026

These notes preserve the external policy evidence used for the Pocket Relay
release-readiness verification. They are not a claim of acceptance by F-Droid.

| Topic | Verified F-Droid guidance | Source |
|---|---|---|
| Submission basics | Upstream source must be public, licensed, current, and use only FOSS dependencies; Fastlane metadata belongs in the source repository. | [Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/) |
| Release tag and listing files | Each release commit should be version-tagged. F-Droid recommends Fastlane title, descriptions, icon, screenshots, and a changelog named for the Android version code. | [Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/) |
| Build metadata | Per-app metadata is YAML and supports repository, build, version, source, issue-tracker, anti-feature, and signing-key fields. A public HTTPS Git repository is required when `RepoType: git` is used. | [Build Metadata Reference](https://f-droid.org/en/docs/Build_Metadata_Reference/) |
| Reproducibility | F-Droid treats reproducible APKs as best practice, not an inclusion prerequisite; source-built verification remains mandatory. | [Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/) |
| Dependency and tooling policy | F-Droid requires a FLOSS application and toolchain. It rejects proprietary tracking, advertising, Google Play Services, Firebase, and Crashlytics dependencies. It allows official prebuilt Android SDK and Hermes artifacts under the documented policy exception. | [Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/) |
| Executable downloads | Apps must not download additional executable binaries without explicit, informed, opt-in consent that explains the bypass of F-Droid checks. | [Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/) |
| Anti-features | F-Droid uses user-facing labels including Non-Free Network Services, Tethered Network Services, Non-Free Dependencies, and Tracking. These labels can be required without necessarily barring inclusion. | [Anti-Features](https://f-droid.org/en/docs/Anti-Features/) |
| Python requirement inputs | F-Droid permits prebuilt FLOSS Python wheels from PyPI where appropriate, while preferring Debian packages whenever possible. Chaquopy supports pinned requirement specifications, local wheel files, and project-relative source directories through its Gradle `pip` block. | [Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/); [Chaquopy Gradle plugin documentation](https://chaquo.com/chaquopy/doc/current/android.html) |

Pocket Relay’s final F-Droid metadata and public release record must be reviewed
against these sources at the tagged release commit.

## Current contribution workflow

The official Quick Start Guide confirms that a new-app contribution is made by
submitting a GitLab merge request to the `fdroiddata` repository. The source
repository must be public, current, and licensed; upstream Fastlane metadata
should already exist in the app source repository; and the per-app YAML must
declare the public VCS location, a source-pinned build block, the Android
version name/code, and appropriate descriptive metadata. F-Droid clones the
declared revision, runs the scanner and build, validates the resulting APK
version, and signs/publishes accepted artifacts. Reproducible developer APKs
remain best practice rather than an inclusion prerequisite. The authoritative
reference is the [Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/), accessed on 2026-08-19.

The F-Droid Data repository’s current [`CONTRIBUTING.md`](https://gitlab.com/fdroid/fdroiddata/-/blob/master/CONTRIBUTING.md)
is the repository-specific authority for branch preparation and merge-request
review. It was accessed on 2026-08-19; its raw form is used during submission
preparation because the public GitLab viewer may defer rendering long code
files.

Its required contribution flow is: fork `fdroiddata`; create an unprotected,
per-app branch in that fork; add `metadata/<application_id>.yml`; wait for the
fork pipeline to succeed; then open a merge request to upstream `fdroiddata`
and complete its template. For a local `fdroidserver` workflow, F-Droid
recommends `fdroid readmeta`, `fdroid rewritemeta <id>`, `fdroid checkupdates
<id>`, `fdroid lint <id>`, and `fdroid build -v -l <id>` before the MR. The
metadata reference additionally requires `RepoType: git` repositories to be
public HTTPS URLs without authentication and requires each build block to pin
the exact source `commit`, version name, and version code. Sources: [raw
CONTRIBUTING.md](https://gitlab.com/fdroid/fdroiddata/-/raw/master/CONTRIBUTING.md)
and [Build Metadata Reference](https://f-droid.org/en/docs/Build_Metadata_Reference/),
accessed on 2026-08-19.

## Python dependency conclusion

The source-vendored Hermes Agent and Pydantic Core inputs remain the most
important project-controlled native build inputs. The remaining fully pinned,
FLOSS Python requirements must be inventoried and disclosed in the SBOM, but
the F-Droid policy does not require wholesale vendoring of every trusted
PyPI/Chaquopy wheel solely to establish compliance. The final F-Droid build
must instead prove that each dependency is freely licensed, pinned, available
from an allowed source, and not an undisclosed executable download at runtime.
