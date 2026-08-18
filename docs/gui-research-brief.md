# Pocket Relay GUI Research Brief

**Author:** Manus AI  
**Scope:** A single focused GitHub/skill/tool research pass for a stronger Pocket Relay mobile GUI.

## Recommendation

The strongest immediate move is to **adopt Expo’s official MIT-licensed skill pack as the primary design and implementation reference**, while retaining Pocket Relay’ existing lightweight custom component layer. It gives the project direct guidance for native-feeling UI, design systems, Expo Router, native components, and the custom native-module work that Pocket Relay will require for its embedded Hermes runtime. [1]

| Rank | Resource | License / maturity | Best use in Pocket Relay | Decision |
|---:|---|---|---|---|
| 1 | [expo/skills][1] + `expo-native-ui` | MIT; official Expo project, 2,413 stars | Native Android controls, semantic tokens, sheets, motion, secure-storage UX, and the later native-module bridge. [1] [2] | **Adopt as a reference pack.** No runtime dependency required. |
| 2 | [UI/UX Pro Max][3] | MIT; 116,995 stars and 214 commits | Structured design-system and accessibility review for the host dashboard and setup flow. [3] [4] | **Use as an advisory design tool.** Do not add it to the mobile bundle. |
| 3 | [Vercel React Native guidelines][5] | Agent-guidance repository | List virtualization, GPU-friendly animation, safe-area behavior, native navigation, and stable state patterns. [5] | **Use as a performance QA checklist.** |
| 4 | [EvanBacon/crispy][6] | License unverified in this pass | Form sheets, grouped settings, responsive rows, haptic interaction patterns. [6] | **Reference only** until the license file is independently confirmed. |
| 5 | [react-native-ui-lib][7] | MIT; mature, but compatibility/bundle risk | Tokenized primitives and a large component catalogue. [7] | **Do not add now.** The project’s React Native 0.81 baseline needs a targeted compatibility test first. |

## Practical next GUI increment

The next targeted enhancement should be a **native-feeling “Host setup sheet”**. It should convert the current Control form into a progressive four-step sheet: device protection, Telegram owner allowlist, model connection, and runtime policy. The flow should use one primary action per step, visible completion status, explanatory security copy, haptic confirmation, and a final owner-only readiness summary. This reuses the project’s current primitives and avoids a large UI-library dependency.

> The research supports a pattern-first approach: Pocket Relay is already visually coherent, so importing a broad design system would add compatibility and maintenance cost without solving a concrete interface problem.

## Tooling conclusion

Expo Skills also describes an optional Expo MCP service for up-to-date documentation, compatible dependency installation, build/workflow visibility, and simulator screenshots. [1] It is a future engineering tool, not something to enable for this GUI change. The local verified-skill catalog had no cached result for the broad mobile-UI query, so no connector or tool integration was modified.

## References

[1]: https://github.com/expo/skills "Expo Skills — official MIT AI-agent skills for Expo"
[2]: https://github.com/expo/skills/blob/main/plugins/expo/skills/expo-native-ui/SKILL.md "Expo Native UI SKILL.md"
[3]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill "UI/UX Pro Max repository"
[4]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md "UI/UX Pro Max SKILL.md"
[5]: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-native-skills/README.md "Vercel React Native guidelines"
[6]: https://github.com/EvanBacon/crispy "Crispy repository"
[7]: https://github.com/wix/react-native-ui-lib "React Native UI Lib repository"
