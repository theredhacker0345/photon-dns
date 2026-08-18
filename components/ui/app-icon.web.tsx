import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";

export type AppIconName = string;

const GLYPHS: Record<string, string> = {
  "add": "+",
  "arrow-back": "‹",
  "arrow-forward": "›",
  "bolt": "ϟ",
  "cancel": "×",
  "chat": "◌",
  "check": "✓",
  "check-circle": "✓",
  "chevron-left": "‹",
  "chevron-right": "›",
  "close": "×",
  "code": "‹/›",
  "content-copy": "⧉",
  "delete-outline": "⌫",
  "developer-board": "▦",
  "done": "✓",
  "edit": "✎",
  "error-outline": "!",
  "expand-less": "⌃",
  "expand-more": "⌄",
  "favorite": "♥",
  "favorite-border": "♡",
  "history": "◴",
  "info-outline": "i",
  "lock-outline": "▣",
  "memory": "▤",
  "more-horiz": "•••",
  "notifications-active": "◉",
  "notifications-none": "○",
  "pause": "Ⅱ",
  "phone-android": "▯",
  "play-arrow": "▶",
  "refresh": "↻",
  "save": "↓",
  "search": "⌕",
  "send": "➤",
  "settings": "⚙",
  "smart-toy": "◉",
  "storage": "▰",
  "telegram": "➤",
  "verified": "✓",
  "visibility": "◉",
  "warning-amber": "!",
};

/**
 * Browser-safe fallback for the native icon font. These glyphs are rendered
 * from the platform's built-in sans-serif font and therefore cannot block
 * Pocket Relay's web preview while a remote font loads.
 */
export function AppIcon({ name, size = 24, color, style }: { name: AppIconName; size?: number; color: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      selectable={false}
      style={[{ color, fontFamily: "system-ui, sans-serif", fontSize: size, fontWeight: "700", lineHeight: Math.round(size * 1.1), textAlign: "center" }, style]}
    >
      {GLYPHS[name] ?? "•"}
    </Text>
  );
}
