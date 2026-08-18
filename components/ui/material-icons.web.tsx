import { AppIcon } from "./app-icon";

/**
 * Metro resolves every `@expo/vector-icons/MaterialIcons` import to this
 * browser-only adapter. Existing Android sources retain the native bundled
 * icon font; web receives locally rendered glyphs and never waits on a
 * FontFaceObserver request during application startup.
 */
export default AppIcon;

// Retained solely for type-compatible source imports. Runtime icon rendering
// is delegated to AppIcon above.
export const glyphMap = {} as const;
