# Minimal Interface Refinement

Pocket Relay should read as a **private host control plane**, not a dashboard full of decorative widgets. The interface keeps the most consequential decision and the current host state visible first, while advanced detail remains available only where it is actionable.

## Visual System

| Element | Direction |
| --- | --- |
| Surface hierarchy | Use the page background for most content and one low-radius card only when grouping changes comprehension. |
| Typography | Favor one short page title, compact all-caps labels for state, and concise supporting copy. |
| Status | Represent host, provider, and scheduler state with a single colored indicator plus a plain-language label. |
| Actions | Retain one primary action per screen. Place optional or destructive actions as smaller secondary controls. |
| Spacing | Use a consistent 16 px page rhythm, compact 12–16 px component gaps, and remove isolated decorative space. |
| Icons | Use functional icons only: navigation, status, selection, or direct action. Avoid standalone ornamental icon containers. |

## Screen Priorities

| Screen | First priority | Secondary detail |
| --- | --- | --- |
| Host | Host state and one next action | Telemetry and recent event activity |
| Agent | Host availability and message composer | Task queue and results |
| Jobs | Schedule list and add action | Runtime status and run history |
| Provider setup | Provider selection and credential validity | Model search, filters, and favorites |
| Settings | Protected configuration and tested connection state | Catalog metadata and advanced policy options |

## Implementation Boundaries

The refinement is intentionally visual and structural. It does not loosen private-owner rules, change protected token handling, remove provider diagnostics, or alter scheduler behavior.
