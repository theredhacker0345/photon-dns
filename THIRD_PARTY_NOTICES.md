# Pocket Agent Host — Third-Party Notices

Pocket Agent Host application code is distributed under the GNU General Public License, version 3 only (GPL-3.0-only). This document records the primary third-party components and their independent license obligations that apply to the app and its embedded runtime. GPLv3 does not replace, remove, or relicense these third-party notices.

## Runtime and framework

| Component | License | Use in Pocket Agent Host | Notice requirement |
|---|---|---|---|
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | MIT | Planned embedded agent runtime. | Include the upstream copyright and MIT license with every runtime bundle. |
| [Expo](https://github.com/expo/expo) | MIT | React Native tooling and native module framework. | Retain license notices in source/distribution materials as applicable. |
| [React Native](https://github.com/facebook/react-native) | MIT | Android mobile UI runtime. | Retain license notices in source/distribution materials as applicable. |
| [Expo Modules Core](https://github.com/expo/expo/tree/main/packages/expo-modules-core) | MIT | Local Kotlin supervisor module API. | Retain license notices in source/distribution materials as applicable. |

## Build and transitive dependencies requiring attention

| Component | License | Distribution handling |
|---|---|---|
| `node-forge` | BSD-3-Clause **or** GPL-2.0 | Pocket Agent Host elects the BSD-3-Clause option; preserve the applicable notice. |
| `lightningcss` | MPL-2.0 | Used as a build dependency. Pocket Agent Host does not modify or copy its source; preserve package notices. |
| `caniuse-lite` | CC-BY-4.0 | Build metadata. Preserve attribution if redistributed. |

## Exclusions

`@expo/ngrok` and its unknown-license binary dependency were removed from the project’s declared development dependencies. No proprietary runtime dependency was identified in the current Pocket Agent Host application tree.

## Release procedure

Before publishing an Android APK, regenerate the dependency license inventory with `pnpm run audit:licenses`, review changes, retain the upstream Hermes Agent license if its source is bundled, and include this notice file plus the project GPLv3 license in the release archive. Publish the corresponding source, lockfiles, wheel provenance, SBOMs, and build instructions for the exact distributed APK as described in `COPYRIGHT_POLICY.md`.
