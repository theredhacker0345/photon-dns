# Hermes Agent Runtime Pinning

Pocket Relay embeds a reviewed **Hermes Agent 0.20.1** source snapshot. It does **not** download or execute a moving `main` branch, fetch a package at app start, or update itself from a model-provider response. The Android wheel is rebuilt during a controlled developer or release workflow from commit [`165c889e5b4277b56dadd42949a4112c1e6175a6`](https://github.com/NousResearch/hermes-agent/commit/165c889e5b4277b56dadd42949a4112c1e6175a6) of the upstream repository.[1]

| Layer | Pinned value | Enforcement |
|---|---|---|
| Upstream source | `NousResearch/hermes-agent` commit `165c889e5b4277b56dadd42949a4112c1e6175a6` | `scripts/build-hermes-android-wheel.sh` checks out the exact commit and compares `rev-parse HEAD` with the pinned revision. |
| Runtime package version | `0.20.1` | The build script emits a no-dependency Android wheel with that version. |
| Python runtime | CPython `3.11` | The Android wheel build refuses another interpreter major/minor version. |
| Dependency closure | Reviewed Android requirements manifest and Python SBOM | The Hermes wheel is built with `--no-deps`; Android dependencies remain explicit and are independently audited. |

> The pinned source is an input to a reproducible build process, not a claim that every release is bit-for-bit identical across every developer machine. Release evidence records the generated wheel hash, SBOM, license audit, and Android build result for the exact release candidate.

## Controlled upgrade process

An upgrade is a source change that must be reviewed and released; it is never performed on an owner’s phone automatically. A maintainer first selects a specific upstream commit and records its associated upstream release version. They update the two pin constants in `scripts/build-hermes-android-wheel.sh`, regenerate the Android wheel using CPython 3.11, and capture the resulting SHA-256 in the release evidence. They then refresh the Python SBOM and license audit, review the upstream dependency and capability changes, run the deterministic suite and Android release compilation, and perform physical-device acceptance testing before a new signed release is proposed.

The upgrade review must reject any new dependency or capability that weakens Pocket Relay’s app-private workspace, empty upstream toolset, owner-only gateway, HTTPS-only MCP boundary, GPL-3.0-only application licensing, or F-Droid distribution requirements. The maintainer must also update this document, `THIRD_PARTY_NOTICES.md`, and any affected threat-model, license, or runtime-contract material in the same change.

## What is deliberately not automatic

The application does not check GitHub for a newer Hermes revision at launch. It does not use `pip install --upgrade` in the Android runtime. It does not allow a Telegram instruction, model response, MCP server, or QuickJS job to alter the Python package set. Those choices prevent runtime supply-chain drift and keep an owner’s installed build traceable to its published source and release evidence.

## References

[1]: https://github.com/NousResearch/hermes-agent/tree/165c889e5b4277b56dadd42949a4112c1e6175a6 "NousResearch Hermes Agent pinned source revision"
