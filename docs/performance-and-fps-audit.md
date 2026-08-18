# Mobile Performance and Frame-Rate Audit

**Scope.** This audit reviews the Pocket Agent Host React Native screens, persistent state, telemetry hooks, Android supervisor, embedded worker retention bounds, and the generated ARM64 release APK. It is a static and release-build assessment; a physical Android device remains necessary to collect device-specific frame timelines, thermal behavior, and battery impact.

## Findings and Changes

| Area | Verified behavior | Change or conclusion |
|---|---|---|
| Off-screen telemetry | Home and Settings previously continued their six-second telemetry loops while their tabs were not visible. The Agent Console also continued its five-second runtime refresh loop. | The three loops now run only while their screen has focus. The UI retains its last measurement when a tab is left, then refreshes immediately on return. |
| Android workspace accounting | The foreground supervisor measured the private workspace more than once during a health pass, while the JS bridge could initiate another recursive measurement. | The service now takes one workspace and RAM snapshot per health pass, stores a short-lived workspace snapshot, and the bridge reuses it for up to 15 seconds. This preserves guardrails while avoiding duplicate file-tree walks. |
| Scroll rendering | Non-virtualized history cards have explicit small maximums: 24 tasks, 16 schedules, five shown schedule runs, 50 code-audit entries, and four Home events. | No list-virtualization refactor is required at the verified limits. Larger unbounded history must not be introduced without converting the section to `FlatList` or `SectionList`. |
| Release runtime | The release build uses Hermes and an ARM64-only ABI. | The JavaScript bundle measured 3.2 MiB uncompressed inside the APK. React Native uses Hermes rather than JSC. |
| Package footprint | The unsigned ARM64 release APK measures 72 MiB. The embedded CPython and Chaquopy requirement payload dominate the footprint. | The release configuration already enables R8 minification and resource shrinking. Reducing the package materially would require changing the embedded Python/runtime dependency set, not stripping UI code. |

## Release Package Profile

| APK category | Uncompressed size | Interpretation |
|---|---:|---|
| Chaquopy assets | 41.11 MiB | CPython standard library and packaged requirements, required by the owner-hosted worker. |
| ARM64 native libraries | 23.27 MiB | React Native, CPython, crypto, QuickJS sandbox, and supporting native code. |
| DEX bytecode | 8.17 MiB | Android, Expo, and application bytecode after the configured release optimizations. |
| JavaScript bundle | 3.21 MiB | The embedded React Native application bundle. |

## Regression Coverage

The `performance-contract.test.ts` suite verifies that off-screen polling is paused, the Android resource snapshot is reused safely, and retained history remains bounded. This complements the existing service, worker-policy, and UI telemetry tests.

## Physical-Device Acceptance Checks

Use a representative API 24+ ARM64 device, an older dedicated phone, and the intended charging configuration. Check the Home dashboard, Settings, Agent Console, and Automations screens with Android’s frame timeline or `gfxinfo`; navigate between tabs repeatedly and confirm no recurring work appears for unfocused screens. Then leave the host running for at least one supervisor interval and confirm the private-workspace, RAM, CPU, charging, and storage guardrails still react normally.

> The host intentionally favors predictable owner-visible resource enforcement over aggressive telemetry caching. The 15-second workspace snapshot is used only for display; the foreground service still remeasures on each enforcement pass before it decides whether work must stop.
