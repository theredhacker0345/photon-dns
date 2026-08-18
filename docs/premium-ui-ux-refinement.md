# Premium UI/UX Refinement

Pocket Relay is a long-running Android control plane rather than a content feed. The refinement therefore prioritizes **state clarity**, **safe action emphasis**, and **one-handed operation** over visual novelty. It preserves every host, provider, Telegram, MCP, QuickJS, and Skills behavior.

| Area | Decision | Owner benefit |
|---|---|---|
| Semantic surfaces | `surfaceInset`, `surface`, and `surfaceRaised` establish input, grouped-content, and action-layer depth across all five themes. | Dense operational information remains scannable without relying only on borders. |
| Persistent navigation | The tab bar uses the elevated surface, 60 px content height, clearer inactive contrast, and 10 px labels. | Common destinations remain easy to hit and identify on a mounted phone. |
| Agent Console | Conversation bubbles distinguish the owner and host, while the composer remains persistent, 52 px tall, and visibly disabled until there is text. | The primary remote-control task is immediate and status-safe. |
| Skills | The sample gallery, staged drafts, installed packages, and modal fields use the same layered surfaces; direct gallery actions are 44 px tall and explicitly labeled. | Review, install, export, and execution remain understandable without weakening the approval boundary. |
| Feedback | Status messages use polite live regions, disabled controls expose state, and destructive controls retain explicit confirmation. | The owner receives feedback without surprise execution or accidental removal. |

The work follows Material Design’s emphasis on hierarchy and touch-friendly components, plus Android accessibility guidance on descriptive labels and sufficiently large controls. The validation strategy is deterministic: static UI-contract tests protect semantic tokens, minimum critical hit areas, and accessibility wiring. Native interactions remain validated through the Android release build rather than a browser preview.

## Deliberate exclusions

No gradients, ornamental imagery, animation on mount, custom font download, hidden navigation, background polling, or new permissions were introduced. The OLED Black theme remains pure black where configured, and all new colors are supplied through the existing five-theme semantic palette.

## References

[1] [Material Design 3: Design principles](https://m3.material.io/foundations/interaction/overview)

[2] [Android Developers: Accessibility principles](https://developer.android.com/guide/topics/ui/accessibility/principles)

[3] [Android Developers: Quality guidelines](https://developer.android.com/docs/quality-guidelines/core-app-quality)
