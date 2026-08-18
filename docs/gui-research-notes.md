# Pocket Relay GUI Discovery — Working Notes

## Initial repository findings

| Candidate | Evidence | GUI relevance | Initial suitability |
|---|---|---|---|
| **Expo UI** | Expo documents `@expo/ui` as a React-to-Jetpack-Compose/SwiftUI component bridge, including native cards, chips, bottom sheets, lists, progress indicators, navigation, and universal field groups. [1] | Offers a future path to native Android Material 3 components for dense Control settings, status chips, progress, and sheet-based actions. | **High strategic fit, defer adoption.** The current app runs Expo SDK 54 whereas the documentation source is SDK 57, so an upgrade/compatibility check must precede use. |
| **EvanBacon/crispy** | The repository contains Expo Router-focused reusable components, an explicit `.claude/skills` directory, iOS-style grouped forms, form sheets, custom tabs, haptics, and responsive settings rows. It has 571 stars and 255 commits. [2] | Strong reference for turning Pocket Relay’ Control tab into an owner-friendly, structured settings flow and improving responsive row/hint behavior. | **High pattern-reuse fit.** Copy small, license-verified patterns only; avoid importing a whole template. License must be independently checked before copying. |
| **wix/react-native-ui-lib** | A long-running MIT-licensed UI library with 7,154 stars, 4,752 commits, Expo demo, design-system foundations, and global component configuration. Its README says New Architecture support is in progress and lists React Native 0.73 support plus a future 0.77 target. [3] | Could replace several custom primitives and centralize tokens, card variants, and form rows. | **Moderate fit, do not add now.** The current project uses React Native 0.81, so compatibility risk and bundle cost make it better as a design-system reference than an immediate dependency. |

## Initial decision rule

Pocket Relay already has a coherent custom React Native component layer. The least-risk GUI enhancement is to selectively adopt interaction and layout patterns rather than introduce a heavyweight UI library. Recommended direction: retain the local design tokens and primitives, borrow **Crispy’s form-sheet / grouped-settings patterns** after license verification, and plan an **Expo SDK upgrade evaluation** before considering `@expo/ui` for truly native Android controls.

## Verified SKILL.md and tooling findings

| Resource | Evidence | Direct value for Pocket Relay | Recommendation |
|---|---|---|---|
| **expo/skills** | Official, MIT-licensed Expo skill collection with 2,413 stars. It includes `expo-native-ui`, `expo-design-system`, `expo-router`, `expo-ui`, and `expo-module`; the repository also documents a companion Expo MCP service for documentation, compatible dependency installation, builds, workflow monitoring, crash data, and simulator screenshots. [4] | The most direct authoritative source for a later native foreground-service module, a design-system audit, an Expo SDK upgrade, and an Android-native control refinement. | **Adopt as the primary reference skill pack.** Do not add its MCP configuration or run installs without an explicit integration need. |
| **`expo-native-ui` SKILL.md** | MIT guidance covering native screen styling, semantic colors, responsive layout, animations, haptics, secure storage, visual effects, and the decision line between Expo Go and custom builds. [5] | Fits the desired native Android-agent-host feel and reinforces the custom-build requirement once Pocket Relay adds the embedded runtime bridge. | **High-value operational reference.** Use for the next visual iteration and the native-module phase. |
| **vercel-labs/agent-skills React Native guidelines** | Agent-readable React Native rule set covering virtualized lists, GPU-friendly animations, native navigation, safe-area scrolling, native menus/modals, and design-system composition. [6] | Helps preserve smooth performance once task histories, schedules, and agent events become larger lists. | **Adopt selectively as a performance checklist.** Treat as guidance, not a dependency. |
| **UI/UX Pro Max SKILL.md** | A cross-platform design skill with local searchable guidance for mobile UI, design tokens, accessibility, touch targets, forms, navigation, typography, color, and responsive behavior. [7] | Useful as a focused design-review tool for the Pocket Relay dashboard and first-run setup. | **Potentially useful, but do not import yet.** Its repository-level license and maintenance signals need verification before incorporation. |

## Tool-discovery note

The local verified-skill catalog returned no cached match for the broad `mobile UI Expo React Native design` query. The direct GitHub research above found stronger, primary-source candidates. A real-time verified catalog lookup would require an enabled GitHub connection; no connector changes were made.

## License and maturity follow-up

| Candidate | Verified signal | Decision |
|---|---|---|
| **EvanBacon/crispy** | The direct license-file extraction did not return content, so its license remains unverified in this research pass. [8] | **Reference only.** Do not copy source until the license is verified from its repository file. |
| **UI/UX Pro Max** | Repository metadata reports **MIT**, 116,995 stars, 12,577 forks, and 214 commits. It supplies UI/UX design-system generation plus usability checks for touch targets, contrast, responsive layout, forms, and navigation. [9] | **Best non-Expo design-review skill candidate.** Use as a separate advisory tool, not as a runtime dependency. |
| **awesome-react-native-skills** | GPL-3.0 marketplace/plugin collection, created in May 2026, with skill entry points spanning React Native core, Expo, performance, testing, and NativeWind-based reusable components. [10] | **Useful discovery index, not an import candidate.** GPL-3.0 and early maturity make the official MIT Expo Skills a lower-risk primary source. |

The direct research therefore has a clear split: **Expo Skills** is the best first adoption because it is official and MIT-licensed; **UI/UX Pro Max** is the most useful optional design-analysis tool; **Vercel’s React Native guidelines** are the performance checklist; and **Crispy** is an implementation-pattern reference pending license verification.

## References

[1]: https://docs.expo.dev/versions/latest/sdk/ui/ "Expo UI documentation"
[2]: https://github.com/EvanBacon/crispy "EvanBacon/crispy repository"
[3]: https://github.com/wix/react-native-ui-lib "wix/react-native-ui-lib repository"
[4]: https://github.com/expo/skills "expo/skills repository"
[5]: https://github.com/expo/skills/blob/main/plugins/expo/skills/expo-native-ui/SKILL.md "expo-native-ui SKILL.md"
[6]: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-native-skills/README.md "Vercel React Native guidelines"
[7]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md "UI/UX Pro Max SKILL.md"
[8]: https://github.com/EvanBacon/crispy/blob/main/LICENSE "Crispy license path"
[9]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill "UI/UX Pro Max repository"
[10]: https://github.com/maikotrindade/awesome-react-native-skills "awesome-react-native-skills repository"
