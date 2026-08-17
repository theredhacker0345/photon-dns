# Pocket Agent Host — Third-Party Notices

Pocket Agent Host is distributed under the MIT License. This document records the primary third-party components and license obligations that apply to the app and its planned embedded runtime.

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

Before publishing an Android APK, regenerate the dependency license inventory with `node scripts/license-audit.mjs`, review changes, retain the upstream Hermes Agent license if its source is bundled, and include this notice file plus the project MIT license in the release archive.
