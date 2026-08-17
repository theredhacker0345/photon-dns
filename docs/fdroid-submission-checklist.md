# Pocket Hermes F-Droid Submission Checklist and Publishing Guide

This document provides a comprehensive, practitioner-grade publishing guide and submission checklist for releasing **Pocket Hermes** on F-Droid. All requirements are aligned with official F-Droid inclusion policies, reproducible build guidelines, and metadata specifications [1].

---

## 1. Project Readiness Summary

Pocket Hermes is an MIT-licensed FOSS Android **prototype** with a bundled CPython 3.11 and Hermes Agent runtime, an intended owner-locked Telegram bridge, and a mobile control-plane UI. This checklist is not evidence that persistent hosting, owner-only task execution, scheduler execution, device recovery, clean-source reproducibility, or direct-distribution signing has passed its release gates. The authoritative scope and acceptance evidence live in [`implementation-traceability-matrix.md`](./implementation-traceability-matrix.md).

| Component / Requirement | Status | Verification Detail |
|-------------------------|--------|---------------------|
| **FOSS License & Notice** | Partially evidenced | App and reviewed embedded-Python sources use FOSS licenses; release-wide npm/Gradle/native SBOM and automated license gates remain required. |
| **No Proprietary Binary Blobs** | Pending release audit | The prior Python SBOM is useful evidence only. The final shipped artifact still needs full dependency, native-artifact, and clean-build verification. |
| **Embedded Python Runtime** | Implemented, unverified | Chaquopy 17.0, Python 3.11, and ARM64 wheel inputs are configured; real owner-locked model task execution and device recovery remain release gates. |
| **Fastlane Metadata Store** | Draft present | Metadata exists, but it must be reconciled with verified capabilities, final screenshots, changelog, and public release source. |
| **F-Droid Build Recipe YAML** | Draft present | The recipe needs a clean-checkout reproducibility proof, acceptable build inputs, and an actual immutable public release tag before submission. |
| **SBOM Generation** | Partial | A CycloneDX Python-component SBOM exists; the final release needs a full npm, Gradle, Python, and native-artifact SBOM. |
| **ARM64 Build Artifact** | Debug-signed prototype artifact | The existing `70.31 MiB` ARM64 APK was built in the sandbox. It predates later UI work and is not a direct-distribution release because release signing and clean-source reproducibility are unfinished. |
| **Sandbox Wake Monitor** | Development process aid | This sandbox monitor does not provide resilience for an installed Android host and must not be treated as an app feature. |

---

## 2. F-Droid Inclusion Requirements & Compliance

To be accepted into the official F-Droid data repository, an application must satisfy strict upstream criteria [1]. Pocket Hermes addresses each requirement as follows:

1. **No Non-Free Dependencies**: The project intends to use no proprietary libraries, Google Play Services, Firebase Cloud Messaging, or closed-source analytics. This remains a final-artifact audit gate rather than an accepted-release claim.
2. **Reproducible Builds**: The current recipe records intended toolchain and prebuild inputs. It has **not** yet proved that F-Droid can build from a clean checkout without sandbox-local paths, ignored artifacts, or unavailable network/build dependencies.
3. **Complete Source Availability**: Python source and wheel-generation helpers exist, but final acceptance requires a clean-source, F-Droid-acceptable rebuild with complete hashes, licenses, and artifact provenance.

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
Before tagging, complete every release gate in the traceability matrix, move all release-critical build inputs into tracked reproducible source, and ensure metadata assets (`fastlane/`, `metadata/com.app.pockethermes.yml`, and the final full SBOM) accurately describe the verified build.

### Step 2: Open a Merge Request on F-Droid Data
Only after the clean-source reproducibility and public-tag gates pass, fork the official [F-Droid Data Repository](https://gitlab.com/fdroid/fdroiddata) and add `metadata/com.app.pockethermes.yml` (or include it directly in the project repository if using F-Droid's upstream metadata inclusion feature).

### Step 3: Address Reviewer Feedback
F-Droid maintainers will review the build log for network access during build (must be offline or use cached dependencies defined in `yml`), proprietary library references, and source reproducibility.

---

## 4. References

[1] F-Droid Team. *Submitting to F-Droid Quick Start Guide*. F-Droid Documentation, 2026. [https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)

[2] Pocket Hermes Engineering. *FOSS Architecture and ARM64 Build Record*. Project Documentation, 2026.

[3] Fastlane Project. *Android Metadata Structure and Store Guidelines*. Fastlane Docs, 2026. [https://docs.fastlane.tools/actions/supply/](https://docs.fastlane.tools/actions/supply/)
