# Pocket Hermes F-Droid Submission Checklist and Publishing Guide

This document provides a comprehensive, practitioner-grade publishing guide and submission checklist for releasing **Pocket Hermes** on F-Droid. All requirements are aligned with official F-Droid inclusion policies, reproducible build guidelines, and metadata specifications [1].

---

## 1. Project Readiness Summary

Pocket Hermes has been fully structured as a Free and Open-Source Software (FOSS) Android application under the MIT License, featuring a self-hosted embedded CPython 3.11 and Hermes Agent runtime, an owner-locked Telegram remote-control bridge, and a polished mobile control-plane UI [2].

| Component / Requirement | Status | Verification Detail |
|-------------------------|--------|---------------------|
| **FOSS License & Notice** | Completed | MIT License applied across all source files, with third-party upstream licenses properly attributed and verified [2]. |
| **No Proprietary Binary Blobs** | Completed | All native and Python dependencies compiled from source or verified against FOSS-compliant registries; zero telemetry or analytics SDKs [2]. |
| **Embedded Python Runtime** | Completed | Chaquopy 17.0 CPython 3.11 arm64-v8a build configured with pre-compiled offline wheels (`hermes_agent`, `jiter`, `pydantic_core`) [2]. |
| **Fastlane Metadata Store** | Completed | Fully populated under `fastlane/metadata/android/en-US/` including title, short description, full description, and release changelogs [3]. |
| **F-Droid Build Recipe YAML** | Completed | Upstream build recipe configured at `metadata/com.app.pockethermes.yml` with precise prebuild steps for wheel generation [3]. |
| **SBOM Generation** | Completed | CycloneDX 1.6 compliant Software Bill of Materials generated (`sbom.json`) covering 62 FOSS components [2]. |
| **ARM64 Release APK** | Completed | Successfully compiled release APK (`app-release.apk`, 119 MiB, SHA-256: `65739cc74d7296e7b7426e87d4d47d060ee94aae61e5ef60a65328762cb23f27`) [2]. |
| **Background Wake Monitor** | Completed | 30-minute automated background wake-check daemon operational in the sandbox environment [2]. |

---

## 2. F-Droid Inclusion Requirements & Compliance

To be accepted into the official F-Droid data repository, an application must satisfy strict upstream criteria [1]. Pocket Hermes addresses each requirement as follows:

1. **No Non-Free Dependencies**: Pocket Hermes uses zero proprietary libraries, Google Play Services, Firebase Cloud Messaging, or closed-source analytics. Remote control is conducted exclusively via standard Telegram Bot API long-polling over HTTPS.
2. **Reproducible Builds**: The build recipe (`metadata/com.app.pockethermes.yml`) specifies exact toolchain versions (Gradle 8.14.3, OpenJDK 21, Android NDK 27.1.12297006, CPython 3.11) and prebuild commands to ensure the APK can be independently compiled byte-for-byte by F-Droid's build servers [1].
3. **Complete Source Availability**: All Python dependencies (including `pydantic-core` and `jiter`) are built from tagged source releases or project-owned pure-Python compatibility modules without relying on precompiled proprietary binaries [2].

---

## 3. Step-by-Step F-Droid Submission Workflow

```
+------------------------------------------------------------+
| 1. Tag Release & Verify Git Tree Cleanliness               |
+------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------+
| 2. Submit Upstream Recipe (`com.app.pockethermes.yml`)       |
|    to Official F-Droid Data Repository Merge Request       |
+------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------+
| 3. F-Droid Build Server Verification & Reproducible Test   |
+------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------+
| 4. Inclusion in Official F-Droid Client Index              |
+------------------------------------------------------------+
```

### Step 1: Prepare the Source Repository
Ensure all metadata assets (`fastlane/`, `metadata/com.app.pockethermes.yml`, `sbom.json`) are committed to version control on the main release branch [3].

### Step 2: Open a Merge Request on F-Droid Data
Fork the official [F-Droid Data Repository](https://gitlab.com/fdroid/fdroiddata) and add `metadata/com.app.pockethermes.yml` (or include it directly in your project repository if using F-Droid's upstream metadata inclusion feature).

### Step 3: Address Reviewer Feedback
F-Droid maintainers will review the build log for network access during build (must be offline or use cached dependencies defined in `yml`), proprietary library references, and source reproducibility.

---

## 4. References

[1] F-Droid Team. *Submitting to F-Droid Quick Start Guide*. F-Droid Documentation, 2026. [https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)

[2] Pocket Hermes Engineering. *FOSS Architecture and ARM64 Build Record*. Project Documentation, 2026.

[3] Fastlane Project. *Android Metadata Structure and Store Guidelines*. Fastlane Docs, 2026. [https://docs.fastlane.tools/actions/supply/](https://docs.fastlane.tools/actions/supply/)
