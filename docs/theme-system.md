# Pocket Agent Host Theme System

Pocket Agent Host intentionally offers four concise visual themes rather than a large skin gallery. The selector lives at the top of **Settings** so host operators can change appearance without interrupting configuration or runtime controls.

| Theme | Use case | Appearance behavior |
| --- | --- | --- |
| System | The phone is shared or follows scheduled dark mode. | Resolves to the device light/dark preference. |
| Cloud | Daytime setup and configuration. | Uses the product’s bright indigo palette. |
| Midnight | A permanently running host in a low-light space. | Uses the product’s dark indigo palette. |
| Terminal | A monitoring-oriented, low-light workspace. | Uses a dark green operational accent with the same semantic status colors. |

The chosen theme is stored locally in the application’s normal preferences store. Credentials remain in protected storage and are never coupled to appearance state. The runtime palette is propagated through NativeWind variables and the `useColors()` hook so existing screens and shared controls update as one system.
