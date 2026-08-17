# CI/CD and Cloud APK Testing Guide

This document outlines the manual GitLab CI APK build pipeline and how to test builds in the cloud using Appetize.io.

## 1. Manual GitLab CI/CD Pipeline

The `.gitlab-ci.yml` file defines a manual-only pipeline stage for building the Android ARM64 release APK (`app-release.apk`).

### Key Characteristics:
* **Manual Trigger Only (`when: manual`)**: The build job does not consume build minutes or run automatically on every push. It must be triggered manually from the GitLab UI under **Build > Pipelines**.
* **Dependencies & Testing**: Automatically runs `pnpm install`, `pnpm test` (all deterministic test suites), and `pnpm check` before compiling the Gradle release bundle.
* **Artifact Retention**: Stores the resulting ARM64 APK as a build artifact for 30 days.

---

## 2. Appetize.io Cloud Testing Integration

If you provide an Appetize.io API token, you can upload and test the compiled APK in a web-based Android emulator without needing a physical device or local Android SDK.

### Using the Helper Script:
```bash
export APPETIZE_TOKEN="your_appetize_api_token"
node scripts/upload-to-appetize.mjs
```

### What the Script Does:
1. Validates the built ARM64 release APK at `android/app/build/outputs/apk/release/app-release.apk`.
2. Authenticates against the Appetize REST API (`https://api.appetize.io/v1/apps`) using your API key (`X-API-KEY`) [2].
3. Performs a direct multipart file upload (`multipart/form-data`) [2].
4. Outputs the public view URL and embed player link for interactive cloud testing.
