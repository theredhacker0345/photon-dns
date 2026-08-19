# Official F-Droid Submission Notes

Sources reviewed on 2026-08-17:

1. https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/
2. https://f-droid.org/en/docs/Build_Metadata_Reference/
3. https://f-droid.org/en/docs/Inclusion_Policy/
4. https://f-droid.org/en/docs/Reproducible_Builds/

Key requirements relevant to Pocket Relay:

- A public source repository and a real, current FOSS source tree are required.
- All app and build dependencies must be FOSS; proprietary tracking, advertising, Firebase, Google Play Services, and Crashlytics are forbidden.
- Build tools must be FOSS and command-line build instructions should be available.
- Upstream release commits should be tagged with a matching version tag.
- Upstream Fastlane-style metadata should include short_description.txt (under 80 characters and no trailing period), full_description.txt, an icon, screenshots when available, and a changelog named for the versionCode with a maximum of 500 characters.
- F-Droid metadata belongs in a YAML file named for the Android application ID. It should include RepoType and Repo for automatic builds, Builds entries with versionName, versionCode, commit, and the required Gradle/build settings, and an output path when the APK is not in the default location.
- F-Droid recommends running fdroid lint and fdroid rewritemeta before submitting a merge request.
- Reproducible builds are encouraged for new apps. F-Droid verifies the build against upstream binaries when Binaries/build.binary metadata is configured, using APK signatures and byte-for-byte matching apart from signatures.
- F-Droid policy requires a unique Android application ID, source-buildable dependencies, no undisclosed anti-features, and no downloading additional executable binaries without explicit informed opt-in.

Current project status: the recipe now references the public Pocket Relay GitLab
repository and pins immutable source tag `v1.0.0-fdroid.2`
(`4ce53341ce0f47ad94f164a0d4fbff40b137f5d2`). The metadata contribution is
submitted for maintainer review in [fdroid/fdroiddata merge request !46222](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/46222).
F-Droid lint, build-server verification, reviewer anti-feature confirmation,
and acceptance remain pending.
